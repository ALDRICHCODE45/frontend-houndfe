<script setup lang="ts">
/**
 * DocumentosPanel — WU-09
 *
 * Documentos tab panel for the Employee Detail View.
 *
 * Layout (per Claude Design):
 *   1. "Documentos adjuntos" section
 *      - Count badge + "Subir" button (gated by can('create', 'EmployeeDocument'))
 *      - Document list: category badge, notes as title, expiresAt if present,
 *        createdAt, delete button (gated by can('delete', 'EmployeeDocument'))
 *      - Click on row → downloadDocumentInfo → downloadFile('/files/' + fileId)
 *      - Empty state: "Sin documentos adjuntos"
 *   2. "Vencimientos" section
 *      - Documents with expiration dates within threshold (30 / 60 / 90 days filter)
 *      - Threshold filter is hardcoded to three options
 *      - Empty state: "Ningún documento con vencimiento próximo"
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
import { UploadDocumentDtoSchema } from '../interfaces/employee.types'
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

// ─── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  employee: Employee
  canCreate: boolean
  canDelete: boolean
}>()

// ─── Queries & mutations ──────────────────────────────────────────────────────

const employeeId = computed(() => props.employee.id)

const { data: documentsResponse, isLoading } = useEmployeeDocuments(employeeId)

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
const uploadFormId = 'upload-document-form'

const CATEGORY_OPTIONS: { label: string; value: EmployeeDocumentCategory }[] = [
  { label: 'Contrato', value: 'CONTRACT' },
  { label: 'Acuerdo de confidencialidad', value: 'NDA' },
  { label: 'Evaluación', value: 'EVALUATION' },
  { label: 'Certificado', value: 'CERTIFICATE' },
  { label: 'Amonestación', value: 'WARNING' },
  { label: 'Identificación', value: 'ID_DOCUMENT' },
  { label: 'Currículum', value: 'CV' },
  { label: 'Médico', value: 'MEDICAL' },
  { label: 'Otro', value: 'OTHER' },
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

// ─── Category badge color ─────────────────────────────────────────────────────

const CATEGORY_BADGE_COLORS: Record<EmployeeDocumentCategory, string> = {
  CONTRACT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  NDA: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  EVALUATION: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  CERTIFICATE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  WARNING: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  ID_DOCUMENT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  CV: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  MEDICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  OTHER: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
}
</script>

<template>
  <div class="flex flex-col gap-6">

    <!-- ── Documentos adjuntos ──────────────────────────────────────────────── -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-default px-5 py-4">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-paperclip" class="size-4 text-primary" />
          <h3 class="text-sm font-semibold text-highlighted">Documentos adjuntos</h3>
          <span
            v-if="documentEntries.length > 0"
            class="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {{ documentEntries.length }}
          </span>
        </div>
        <UButton
          v-if="canCreate"
          icon="i-lucide-upload"
          size="xs"
          variant="outline"
          color="primary"
          label="Subir"
          @click="isUploadOpen = true"
        />
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="px-5 py-6">
        <div class="flex flex-col gap-3">
          <div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-lg bg-elevated" />
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="documentEntries.length === 0"
        class="flex flex-col items-center gap-2 px-5 py-12 text-center"
      >
        <UIcon name="i-lucide-file-x" class="size-10 text-muted opacity-40" />
        <p class="text-sm font-medium text-muted">Sin documentos adjuntos</p>
        <p v-if="canCreate" class="text-xs text-muted">
          Usá el botón "Subir" para agregar el primer documento.
        </p>
      </div>

      <!-- Document list -->
      <div v-else class="divide-y divide-default">
        <div
          v-for="entry in documentEntries"
          :key="entry.id"
          class="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-elevated/40"
        >
          <!-- File icon (clickable to download) -->
          <button
            class="mt-0.5 shrink-0 rounded-lg p-2 transition-colors hover:bg-primary/10"
            :title="`Descargar ${entry.title}`"
            :disabled="downloadingDocId === entry.id"
            @click="onDownloadDocument(entry.id)"
          >
            <UIcon
              v-if="downloadingDocId === entry.id"
              name="i-lucide-loader-circle"
              class="size-5 animate-spin text-primary"
            />
            <UIcon v-else name="i-lucide-file-down" class="size-5 text-primary" />
          </button>

          <!-- Content -->
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <!-- Title + category badge -->
              <div class="flex flex-wrap items-center gap-2">
                <span
                  :class="[
                    'inline-block rounded px-1.5 py-0.5 text-xs font-medium',
                    CATEGORY_BADGE_COLORS[entry.category],
                  ]"
                >
                  {{ entry.categoryLabel }}
                </span>
                <button
                  class="text-sm font-medium text-highlighted hover:text-primary hover:underline"
                  :title="`Descargar ${entry.title}`"
                  @click="onDownloadDocument(entry.id)"
                >
                  {{ entry.title }}
                </button>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-1">
                <!-- Expiration date badge -->
                <span
                  v-if="entry.expiresAt"
                  class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                >
                  <UIcon name="i-lucide-calendar-clock" class="size-3" />
                  {{ entry.expiresAt }}
                </span>

                <!-- Delete button -->
                <UButton
                  v-if="canDelete"
                  icon="i-lucide-trash-2"
                  size="xs"
                  color="error"
                  variant="ghost"
                  :loading="deletingDocId === entry.id"
                  :title="`Eliminar ${entry.title}`"
                  class="opacity-0 transition-opacity group-hover:opacity-100"
                  @click.stop="openDeleteConfirm(entry.id, entry.title)"
                />
              </div>
            </div>

            <!-- Created at -->
            <p class="mt-0.5 text-xs text-muted">Subido el {{ entry.createdAtFormatted }}</p>
          </div>
        </div>
      </div>
    </UCard>

    <!-- ── Vencimientos ─────────────────────────────────────────────────────── -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <!-- Header with threshold filter -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-default px-5 py-4">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-calendar-x" class="size-4 text-warning" />
          <h3 class="text-sm font-semibold text-highlighted">Vencimientos</h3>
        </div>
        <!-- Threshold filter pills -->
        <div class="flex items-center gap-1">
          <button
            v-for="days in THRESHOLD_OPTIONS"
            :key="days"
            :class="[
              'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              selectedThreshold === days
                ? 'bg-primary text-white'
                : 'bg-elevated text-muted hover:text-default',
            ]"
            @click="setThreshold(days)"
          >
            {{ computeExpiringThresholdLabel(days) }}
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="px-5 py-6">
        <div class="flex flex-col gap-3">
          <div v-for="i in 2" :key="i" class="h-14 animate-pulse rounded-lg bg-elevated" />
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="expiringEntries.length === 0"
        class="flex flex-col items-center gap-2 px-5 py-10 text-center"
      >
        <UIcon name="i-lucide-check-circle" class="size-8 text-success opacity-60" />
        <p class="text-sm text-muted">Ningún documento con vencimiento próximo</p>
        <p class="text-xs text-muted">
          {{ computeExpiringThresholdLabel(selectedThreshold) }}
        </p>
      </div>

      <!-- Expiring docs list -->
      <div v-else class="divide-y divide-default">
        <div
          v-for="entry in expiringEntries"
          :key="entry.id"
          class="flex items-start gap-3 px-5 py-4"
        >
          <UIcon name="i-lucide-alert-triangle" class="mt-0.5 size-4 shrink-0 text-warning" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                :class="[
                  'inline-block rounded px-1.5 py-0.5 text-xs font-medium',
                  CATEGORY_BADGE_COLORS[entry.category],
                ]"
              >
                {{ entry.categoryLabel }}
              </span>
              <span class="text-sm font-medium text-highlighted">{{ entry.title }}</span>
            </div>
            <p class="mt-0.5 text-xs text-warning font-medium">
              Vence el {{ entry.expiresAt }}
            </p>
          </div>
        </div>
      </div>
    </UCard>

  </div>

  <!-- ── Upload modal ─────────────────────────────────────────────────────────── -->
  <UModal v-model:open="isUploadOpen" title="Subir documento" :ui="{ footer: 'justify-end' }">
    <template #body>
      <div class="flex flex-col gap-4">
        <!-- File picker -->
        <UFormField label="Archivo" required>
          <div
            class="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-default p-6 transition-colors hover:border-primary/60"
          >
            <UIcon name="i-lucide-upload-cloud" class="size-8 text-muted" />
            <p class="text-sm text-muted">
              {{
                uploadState.file
                  ? uploadState.file.name
                  : 'Arrastrá o seleccioná un archivo (PDF, DOC, DOCX, JPG, PNG, WEBP)'
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
          <USelect
            v-model="uploadState.category"
            :items="CATEGORY_OPTIONS"
            value-key="value"
            label-key="label"
            placeholder="Seleccioná una categoría"
            class="w-full"
          />
        </UFormField>

        <!-- Expiration date -->
        <UFormField label="Fecha de vencimiento" hint="Opcional">
          <DateFieldPopover
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

  <!-- ── Delete confirmation modal ─────────────────────────────────────────── -->
  <UModal
    v-model:open="isDeleteConfirmOpen"
    title="Eliminar documento"
    description="Esta acción no se puede deshacer."
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <div class="flex items-start gap-3 rounded-xl border border-error/20 bg-error/5 p-4">
        <UIcon name="i-lucide-alert-triangle" class="mt-0.5 size-5 shrink-0 text-error" />
        <div>
          <p class="text-sm font-medium text-highlighted">
            ¿Eliminar <span class="text-error">{{ docToDelete?.title }}</span>?
          </p>
          <p class="mt-1 text-xs text-muted">
            El archivo se borrará permanentemente del sistema.
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton color="neutral" variant="ghost" @click="closeDeleteConfirm">
        Cancelar
      </UButton>
      <UButton
        color="error"
        icon="i-lucide-trash-2"
        :loading="isDeleting"
        @click="onConfirmDelete"
      >
        Eliminar
      </UButton>
    </template>
  </UModal>
</template>
