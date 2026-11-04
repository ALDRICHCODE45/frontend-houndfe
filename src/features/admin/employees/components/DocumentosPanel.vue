<script setup lang="ts">
/**
 * DocumentosPanel — WU-09
 *
 * Documentos tab panel for the Employee Detail View.
 *
 * Layout:
 *   1. "Documentos adjuntos" section
 *      - Count + "Subir" button (gated by can('create', 'EmployeeDocument'))
 *      - Document list: the title downloads the file; category and upload date
 *        as one muted line; the expiry date when there is one. The ⋮ menu
 *        (Descargar, Eliminar…) shows only with can('delete', 'EmployeeDocument'),
 *        because with no delete permission it would only repeat the title.
 *      - Four states (S10): skeleton, error with Reintentar, "Aún no hay documentos", data
 *   2. "Vencimientos" section
 *      - Documents with expiration dates within threshold (30 / 60 / 90 days filter)
 *      - Pending items that need action, so each carries a warning badge
 *
 * CASL gates:
 *   - Read/download: can('read', 'EmployeeDocument') — enforced at route level
 *   - Upload: can('create', 'EmployeeDocument')
 *   - Delete: can('delete', 'EmployeeDocument')
 *
 * Backend constraints (§4.4 of implementation guide):
 *   - Upload is multipart/form-data: file + category + expiresAt? + notes?
 *   - notes max 500 chars — used as document title (no `title` field, desviación #1)
 *   - Download: GET /:docId/download → { fileId } → downloadFile('/files/' + fileId)
 *   - Allowed MIME: pdf, doc, docx, jpeg, png, webp
 *   - Delete: 204 No Content
 */

import { computed, reactive, ref } from 'vue'
import DateFieldPopover from '@/features/POS/sales/components/DateFieldPopover.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { EMPLOYEE_DOCUMENT_CATEGORY } from '../constants/employee.constants'
import type { Employee, EmployeeDocumentCategory } from '../interfaces/employee.types'
import { downloadFile } from '@/core/shared/api/multipart'
import {
  useEmployeeDocuments,
  useUploadDocument,
  useDeleteDocument,
  buildDocumentEntry,
  filterExpiringDocuments,
  computeExpiringThresholdLabel,
} from '../composables/useDocumentos'
import { employeesApi } from '../api/employees.api'
import { formatTimeOffDate } from '../composables/useEmployeeColumns'

// ─── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  employee: Employee
  canCreate: boolean
  canDelete: boolean
}>()

// ─── Queries & mutations ──────────────────────────────────────────────────────

const employeeId = computed(() => props.employee.id)

const {
  data: documentsResponse,
  isLoading,
  isError,
  refetch,
} = useEmployeeDocuments(employeeId)

const { mutateAsync: uploadDocument, isPending: isUploading } = useUploadDocument(employeeId)
const { mutateAsync: deleteDocument, isPending: isDeleting } = useDeleteDocument(employeeId)

// ─── Derived data ─────────────────────────────────────────────────────────────

const allDocuments = computed(() => documentsResponse.value?.data ?? [])

const documentEntries = computed(() => allDocuments.value.map(buildDocumentEntry))

// ─── Vencimientos threshold filter ───────────────────────────────────────────

const THRESHOLD_OPTIONS = [30, 60, 90] as const
type ThresholdDays = 30 | 60 | 90

const selectedThreshold = ref<ThresholdDays>(30)

const expiringDocuments = computed(() =>
  filterExpiringDocuments(allDocuments.value, selectedThreshold.value),
)

const expiringEntries = computed(() => expiringDocuments.value.map(buildDocumentEntry))

function setThreshold(days: ThresholdDays): void {
  selectedThreshold.value = days
}

// ─── Download ─────────────────────────────────────────────────────────────────

const downloadingDocId = ref<string | null>(null)

async function onDownloadDocument(docId: string): Promise<void> {
  if (downloadingDocId.value) return // prevent concurrent downloads
  try {
    downloadingDocId.value = docId
    const { fileId } = await employeesApi.downloadDocumentInfo(employeeId.value, docId)
    const blob = await downloadFile(`/files/${fileId}`)
    // Trigger browser download via temporary object URL
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileId
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    // Error toast handled by downloadFile; log silently
  } finally {
    downloadingDocId.value = null
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

const deletingDocId = ref<string | null>(null)
const isDeleteConfirmOpen = ref(false)
const docToDelete = ref<{ id: string; title: string } | null>(null)

function openDeleteConfirm(id: string, title: string): void {
  docToDelete.value = { id, title }
  isDeleteConfirmOpen.value = true
}

function closeDeleteConfirm(): void {
  isDeleteConfirmOpen.value = false
  docToDelete.value = null
}

async function onConfirmDelete(): Promise<void> {
  if (!docToDelete.value) return
  try {
    deletingDocId.value = docToDelete.value.id
    await deleteDocument(docToDelete.value.id)
    closeDeleteConfirm()
  } catch {
    // useDeleteDocument.onError handles toast
  } finally {
    deletingDocId.value = null
  }
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

const isUploadOpen = ref(false)

const CATEGORY_OPTIONS: { label: string; value: EmployeeDocumentCategory }[] = [
  { label: 'Contrato', value: EMPLOYEE_DOCUMENT_CATEGORY.CONTRACT },
  { label: 'Acuerdo de confidencialidad', value: EMPLOYEE_DOCUMENT_CATEGORY.NDA },
  { label: 'Evaluación', value: EMPLOYEE_DOCUMENT_CATEGORY.EVALUATION },
  { label: 'Certificado', value: EMPLOYEE_DOCUMENT_CATEGORY.CERTIFICATE },
  { label: 'Amonestación', value: EMPLOYEE_DOCUMENT_CATEGORY.WARNING },
  { label: 'Identificación', value: EMPLOYEE_DOCUMENT_CATEGORY.ID_DOCUMENT },
  { label: 'Currículum', value: EMPLOYEE_DOCUMENT_CATEGORY.CV },
  { label: 'Médico', value: EMPLOYEE_DOCUMENT_CATEGORY.MEDICAL },
  { label: 'Otro', value: EMPLOYEE_DOCUMENT_CATEGORY.OTHER },
]

const uploadState = reactive({
  file: null as File | null,
  category: '' as EmployeeDocumentCategory | '',
  expiresAt: '',
  notes: '',
})

function resetUploadForm(): void {
  uploadState.file = null
  uploadState.category = ''
  uploadState.expiresAt = ''
  uploadState.notes = ''
}

function closeUploadModal(): void {
  resetUploadForm()
  isUploadOpen.value = false
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  uploadState.file = input.files?.[0] ?? null
}

async function onUploadSubmit(): Promise<void> {
  if (!uploadState.file || !uploadState.category) return
  const formData = new FormData()
  formData.append('file', uploadState.file)
  formData.append('category', uploadState.category)
  if (uploadState.expiresAt) formData.append('expiresAt', uploadState.expiresAt)
  if (uploadState.notes.trim()) formData.append('notes', uploadState.notes.trim())
  try {
    await uploadDocument(formData)
    closeUploadModal()
  } catch {
    // useUploadDocument.onError handles toast
  }
}

// ─── Row menu ─────────────────────────────────────────────────────────────────
// The title already downloads, so the menu exists only when it adds Eliminar…
// (destructive, last, confirmed).

const rowActions: RowAction[] = [
  { key: 'download', label: 'Descargar', icon: 'i-lucide-download' },
  { key: 'delete', label: 'Eliminar…', icon: 'i-lucide-trash-2', destructive: true },
]

function onRowAction(key: string, entry: { id: string; title: string }): void {
  if (key === 'download') void onDownloadDocument(entry.id)
  else if (key === 'delete') openDeleteConfirm(entry.id, entry.title)
}
</script>

<template>
  <div class="flex flex-col gap-6">

    <!-- ── Documentos adjuntos ──────────────────────────────────────────────── -->
    <UCard class="employees-detail-section" :ui="{ body: 'p-0 sm:p-0' }">
      <div class="flex items-center justify-between gap-3 border-b border-default px-5 py-4">
        <h2 class="text-base font-semibold text-highlighted">
          Documentos adjuntos
          <span v-if="documentEntries.length > 0" class="font-normal text-muted">
            · {{ documentEntries.length }}
          </span>
        </h2>
        <UButton
          v-if="canCreate"
          icon="i-lucide-upload"
          size="sm"
          variant="outline"
          color="neutral"
          label="Subir"
          @click="isUploadOpen = true"
        />
      </div>

      <!-- Loading -->
      <div
        v-if="isLoading"
        class="flex flex-col gap-3 px-5 py-6"
        aria-busy="true"
        data-testid="documents-skeleton"
      >
        <span class="sr-only">Cargando</span>
        <div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-lg bg-(--hf-surface-muted)" aria-hidden="true" />
      </div>

      <!-- Error -->
      <div v-else-if="isError" class="p-5" data-testid="documents-error">
        <EmptyState
          kind="error"
          title="No se pudieron cargar los documentos"
          action-label="Reintentar"
          action-test-id="documents-retry"
          @action="() => refetch()"
        />
      </div>

      <!-- Empty -->
      <div v-else-if="documentEntries.length === 0" class="p-5" data-testid="documents-empty">
        <EmptyState
          title="Aún no hay documentos"
          description="Aquí aparecerán los archivos del colaborador."
          icon="i-lucide-file-x"
        />
      </div>

      <!-- Document list -->
      <ul v-else class="divide-y divide-default">
        <li
          v-for="entry in documentEntries"
          :key="entry.id"
          class="flex items-center gap-3 px-5 py-3"
          data-testid="document-row"
        >
          <div class="min-w-0 flex-1">
            <button
              type="button"
              class="hf-row-primary flex items-center gap-1.5 text-left"
              :title="`Descargar ${entry.title}`"
              :disabled="downloadingDocId === entry.id"
              @click="onDownloadDocument(entry.id)"
            >
              <UIcon
                v-if="downloadingDocId === entry.id"
                name="i-lucide-loader-circle"
                class="size-4 shrink-0 animate-spin"
                aria-hidden="true"
              />
              <span class="truncate">{{ entry.title }}</span>
            </button>
            <p class="hf-row-secondary">{{ entry.categoryLabel }} · Subido el {{ entry.createdAtFormatted }}</p>
          </div>

          <span
            v-if="entry.expiresAt"
            class="shrink-0 text-[13px] text-muted"
            data-testid="document-expiry"
          >
            Vence el {{ formatTimeOffDate(entry.expiresAt) }}
          </span>

          <RowActionsMenu
            v-if="canDelete"
            :actions="rowActions"
            :row-label="entry.title"
            portal-class="employees-form-portal"
            @select="onRowAction($event, entry)"
          />
        </li>
      </ul>
    </UCard>

    <!-- ── Vencimientos ─────────────────────────────────────────────────────── -->
    <UCard class="employees-detail-section" :ui="{ body: 'p-0 sm:p-0' }">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-default px-5 py-4">
        <h2 class="text-base font-semibold text-highlighted">Vencimientos</h2>
        <div class="employees-threshold-group" role="group" aria-label="Ventana de vencimiento">
          <button
            v-for="days in THRESHOLD_OPTIONS"
            :key="days"
            type="button"
            class="employees-threshold"
            :aria-pressed="selectedThreshold === days"
            @click="setThreshold(days)"
          >
            {{ computeExpiringThresholdLabel(days) }}
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div
        v-if="isLoading"
        class="flex flex-col gap-3 px-5 py-6"
        aria-busy="true"
        data-testid="expirations-skeleton"
      >
        <span class="sr-only">Cargando</span>
        <div v-for="i in 2" :key="i" class="h-14 animate-pulse rounded-lg bg-(--hf-surface-muted)" aria-hidden="true" />
      </div>

      <!-- Error -->
      <div v-else-if="isError" class="p-5" data-testid="expirations-error">
        <EmptyState
          kind="error"
          title="No se pudieron cargar los vencimientos"
          action-label="Reintentar"
          action-test-id="expirations-retry"
          @action="() => refetch()"
        />
      </div>

      <!-- Empty -->
      <div v-else-if="expiringEntries.length === 0" class="p-5" data-testid="expirations-empty">
        <EmptyState
          title="Sin vencimientos próximos"
          :description="computeExpiringThresholdLabel(selectedThreshold)"
          icon="i-lucide-calendar-check"
        />
      </div>

      <!-- Expiring docs: pending items that need action -->
      <ul v-else class="divide-y divide-default">
        <li
          v-for="entry in expiringEntries"
          :key="entry.id"
          class="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
          data-testid="expiring-row"
        >
          <div class="min-w-0">
            <p class="hf-row-primary">{{ entry.title }}</p>
            <p class="hf-row-secondary">{{ entry.categoryLabel }}</p>
          </div>
          <StatusBadge
            tone="warning"
            :label="`Vence el ${formatTimeOffDate(entry.expiresAt ?? '')}`"
            aria-prefix="Vencimiento:"
          />
        </li>
      </ul>
    </UCard>

  </div>

  <!-- ── Upload modal ─────────────────────────────────────────────────────────── -->
  <UModal v-model:open="isUploadOpen" title="Subir documento" :ui="{ content: 'hf-theme hf-ui hf-form-overlay employees-form-portal', footer: 'justify-end' }">
    <template #body>
      <div class="flex flex-col gap-4">
        <!-- File picker -->
        <UFormField label="Archivo" required>
          <div
            class="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-default p-6 transition-colors hover:border-(--hf-muted)"
          >
            <p class="text-sm text-muted">
              {{
                uploadState.file
                  ? uploadState.file.name
                  : 'Elige un archivo (PDF, DOC, DOCX, JPG, PNG, WEBP)'
              }}
            </p>
            <label class="cursor-pointer">
              <UButton size="xs" variant="outline" color="neutral" as="span">
                Seleccionar archivo
              </UButton>
              <input
                type="file"
                class="sr-only"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
                @change="onFileChange"
              />
            </label>
          </div>
        </UFormField>

        <!-- Category select -->
        <UFormField label="Categoría" required>
          <USelect :ui="{ content: 'hf-theme hf-ui hf-form-overlay employees-form-portal' }"
            v-model="uploadState.category"
            :items="CATEGORY_OPTIONS"
            value-key="value"
            label-key="label"
            placeholder="Selecciona una categoría"
            class="w-full"
          />
        </UFormField>

        <!-- Expiration date -->
        <UFormField label="Fecha de vencimiento" hint="Opcional">
          <DateFieldPopover portal-class="hf-theme hf-ui hf-form-overlay employees-form-portal"
            v-model="uploadState.expiresAt"
            placeholder="Elegir fecha de vencimiento"
            :min-iso="null"
          />
        </UFormField>

        <!-- Notes / title -->
        <UFormField label="Descripción" hint="Opcional — máx. 500 caracteres">
          <UTextarea
            v-model="uploadState.notes"
            :rows="3"
            placeholder="Ej: Contrato de trabajo 2026, firmado el 15/01"
            :maxlength="500"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <UButton color="neutral" variant="ghost" @click="closeUploadModal">
        Cancelar
      </UButton>
      <UButton
        color="primary"
        icon="i-lucide-upload"
        :loading="isUploading"
        :disabled="!uploadState.file || !uploadState.category"
        @click="onUploadSubmit"
      >
        Subir documento
      </UButton>
    </template>
  </UModal>

  <!-- ── Delete confirmation ───────────────────────────────────────────────── -->
  <ConfirmModal
    v-model:open="isDeleteConfirmOpen"
    title="Eliminar documento"
    :description="`Se eliminará «${docToDelete?.title ?? ''}» de forma permanente. Esta acción no se puede deshacer.`"
    confirm-label="Eliminar"
    confirm-color="error"
    :loading="isDeleting"
    :ui="{ content: 'hf-theme hf-ui hf-form-overlay employees-form-portal' }"
    @confirm="onConfirmDelete"
  />
</template>
