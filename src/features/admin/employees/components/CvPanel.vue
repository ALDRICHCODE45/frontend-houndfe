<script setup lang="ts">
/**
 * CvPanel — WU-08
 *
 * CV tab panel for the Employee Detail View.
 *
 * Layout (per design brief):
 *   - If employee.cvFileId exists:
 *       Shows CV download button — calls downloadFile('/files/:cvFileId').
 *       Triggers browser save-as for the returned Blob.
 *   - If no cvFileId:
 *       Shows "Subir CV" button (requires update:Employee permission).
 *       Upload flow: POST /files/upload (multipart) → get fileId →
 *         PATCH /admin/employees/:id with { cvFileId }.
 *   - Empty state when no CV and user lacks permission to upload:
 *       "No hay CV ni datos de educación registrados."
 *
 * CASL gates:
 *   - Download: any user with read:Employee can download (standard tier).
 *   - Upload: requires update:Employee (canUpdate prop).
 *
 * CV upload uses the two-step flow per §4.1 backend doc:
 *   Step 1: POST /files/upload (multipart) → returns { id: fileId }
 *   Step 2: PATCH /admin/employees/:id { cvFileId: fileId } → updates employee
 *
 * Uses uploadMultipart + downloadFile from multipart.ts.
 * On upload success: emits 'cv-updated' so EmployeeDetailView can refetch.
 */

import { ref } from 'vue'
import type { Employee } from '../interfaces/employee.types'
import { downloadFile, uploadMultipart } from '@/core/shared/api/multipart'
import { employeesApi } from '../api/employees.api'
import { buildCvDownloadUrl } from '../composables/useOrganigrama'

// ─── Props & emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  employee: Employee
  canUpdate: boolean
}>()

const emit = defineEmits<{
  'cv-updated': []
}>()

// ─── Download state ────────────────────────────────────────────────────────────

const isDownloading = ref(false)
const downloadError = ref<string | null>(null)

async function handleDownload(): Promise<void> {
  if (!props.employee.cvFileId) return
  isDownloading.value = true
  downloadError.value = null
  try {
    const url = buildCvDownloadUrl(props.employee.cvFileId)
    const blob = await downloadFile(url)
    // Trigger browser save-as dialog
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = `CV_${props.employee.fullName.replace(/\s+/g, '_')}.pdf`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(objectUrl)
  } catch {
    downloadError.value = 'No se pudo descargar el CV. Intentá de nuevo.'
  } finally {
    isDownloading.value = false
  }
}

// ─── Upload state ──────────────────────────────────────────────────────────────

const isUploading = ref(false)
const uploadError = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

function triggerFileInput(): void {
  fileInputRef.value?.click()
}

async function handleFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  isUploading.value = true
  uploadError.value = null

  try {
    // Step 1: Upload file to FilesService → get fileId
    const formData = new FormData()
    formData.append('file', file)
    const uploaded = await uploadMultipart<{ id: string }>('/files/upload', formData)

    // Step 2: Patch employee with the new cvFileId
    await employeesApi.update(props.employee.id, { cvFileId: uploaded.id })

    // Signal parent to refetch employee detail
    emit('cv-updated')
  } catch {
    uploadError.value = 'No se pudo subir el CV. Verificá el archivo e intentá de nuevo.'
  } finally {
    isUploading.value = false
    // Reset input so same file can be re-selected if needed
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <!-- Header -->
      <div class="flex items-center gap-2 border-b border-default px-5 py-4">
        <UIcon name="i-lucide-file-text" class="size-4 text-primary" />
        <h3 class="text-sm font-semibold text-highlighted">Currículum Vitae</h3>
      </div>

      <!-- Body -->
      <div class="px-5 py-6">

        <!-- ── CV exists: show download option ──────────────────────────── -->
        <template v-if="employee.cvFileId">
          <div class="flex flex-col gap-4">
            <!-- CV indicator card -->
            <div class="flex items-center gap-4 rounded-xl border border-default bg-elevated/40 px-4 py-3">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <UIcon name="i-lucide-file-text" class="size-5 text-primary" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-highlighted">
                  CV de {{ employee.fullName }}
                </p>
                <p class="text-xs text-muted">Archivo disponible para descarga</p>
              </div>
              <UButton
                icon="i-lucide-download"
                color="primary"
                variant="soft"
                size="sm"
                label="Descargar"
                :loading="isDownloading"
                @click="handleDownload"
              />
            </div>

            <!-- Download error -->
            <div
              v-if="downloadError"
              class="flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error"
            >
              <UIcon name="i-lucide-alert-circle" class="size-3.5 shrink-0" />
              <span>{{ downloadError }}</span>
            </div>

            <!-- Replace CV option (only for users who can update) -->
            <div v-if="canUpdate" class="mt-2">
              <p class="mb-2 text-xs text-muted">¿Querés reemplazar el CV actual?</p>
              <UButton
                icon="i-lucide-upload"
                color="neutral"
                variant="outline"
                size="xs"
                label="Subir nuevo CV"
                :loading="isUploading"
                @click="triggerFileInput"
              />
            </div>
          </div>
        </template>

        <!-- ── No CV ────────────────────────────────────────────────────── -->
        <template v-else>

          <!-- Upload button (only for users with update:Employee) -->
          <div v-if="canUpdate" class="flex flex-col items-center gap-4 py-6 text-center">
            <div class="flex size-14 items-center justify-center rounded-full bg-elevated">
              <UIcon name="i-lucide-upload-cloud" class="size-7 text-muted opacity-60" />
            </div>
            <div>
              <p class="font-semibold text-highlighted">Sin CV registrado</p>
              <p class="mt-1 text-sm text-muted">
                Subí el CV del colaborador en formato PDF, DOC, DOCX o imagen.
              </p>
            </div>
            <UButton
              icon="i-lucide-upload"
              color="primary"
              label="Subir CV"
              :loading="isUploading"
              @click="triggerFileInput"
            />
          </div>

          <!-- Empty state for read-only users -->
          <div v-else class="flex flex-col items-center gap-3 py-10 text-center">
            <UIcon name="i-lucide-file-x" class="size-10 text-muted opacity-40" />
            <p class="text-sm text-muted">No hay CV ni datos de educación registrados.</p>
          </div>

          <!-- Upload error -->
          <div
            v-if="uploadError"
            class="mt-4 flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error"
          >
            <UIcon name="i-lucide-alert-circle" class="size-3.5 shrink-0" />
            <span>{{ uploadError }}</span>
          </div>
        </template>

      </div>
    </UCard>

    <!-- Hidden file input for CV upload -->
    <input
      ref="fileInputRef"
      type="file"
      class="hidden"
      accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
      @change="handleFileSelected"
    />

  </div>
</template>
