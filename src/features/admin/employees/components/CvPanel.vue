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
import EmptyState from '@/core/shared/components/EmptyState.vue'
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
    downloadError.value = 'No se pudo descargar el CV. Intenta de nuevo.'
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
    uploadError.value = 'No se pudo subir el CV. Verifica el archivo e inténtalo de nuevo.'
  } finally {
    isUploading.value = false
    // Reset input so same file can be re-selected if needed
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">

    <UCard class="employees-detail-section" :ui="{ body: 'p-0 sm:p-0' }">
      <div class="border-b border-default px-5 py-4">
        <h2 class="text-base font-semibold text-highlighted">Currículum vitae</h2>
      </div>

      <div class="p-5">

        <!-- ── CV exists: download, and replace for who can update ──────── -->
        <div v-if="employee.cvFileId" class="flex flex-col gap-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="min-w-0 text-sm font-medium text-highlighted">
              CV de {{ employee.fullName }}
            </p>
            <div class="flex shrink-0 items-center gap-2">
              <UButton
                icon="i-lucide-download"
                color="neutral"
                variant="outline"
                label="Descargar"
                :loading="isDownloading"
                @click="handleDownload"
              />
              <UButton
                v-if="canUpdate"
                icon="i-lucide-upload"
                color="neutral"
                variant="outline"
                label="Reemplazar"
                :loading="isUploading"
                @click="triggerFileInput"
              />
            </div>
          </div>

          <p
            v-if="downloadError"
            class="rounded-lg border border-(--hf-danger-border) bg-(--hf-danger-soft) px-3 py-2 text-[13px] text-(--hf-danger)"
            role="alert"
          >
            {{ downloadError }}
          </p>
        </div>

        <!-- ── No CV: the shared empty state, with the upload when allowed ── -->
        <template v-else>
          <EmptyState
            title="Sin CV registrado"
            :description="canUpdate ? 'Sube un PDF, DOC, DOCX o imagen.' : undefined"
            icon="i-lucide-file-text"
            :action-label="canUpdate ? 'Subir CV' : undefined"
            action-icon="i-lucide-upload"
            :action-loading="isUploading"
            action-test-id="cv-upload"
            @action="triggerFileInput"
          />
        </template>

        <p
          v-if="uploadError"
          class="mt-4 rounded-lg border border-(--hf-danger-border) bg-(--hf-danger-soft) px-3 py-2 text-[13px] text-(--hf-danger)"
          role="alert"
        >
          {{ uploadError }}
        </p>

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
