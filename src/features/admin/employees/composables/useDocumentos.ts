/**
 * useDocumentos — WU-09
 *
 * Pure helpers + composables for the Documentos tab.
 *
 * Exports:
 *   Pure helpers (exported for direct unit testing — ZERO mocks needed):
 *   - formatDocumentCategory(category)       — category enum → Spanish label
 *   - buildDocumentEntry(doc)                — builds a display-ready document entry
 *   - isExpiringSoon(expiresAt, days)        — true if doc expires within N days
 *   - filterExpiringDocuments(docs, days)    — filters docs expiring within N days
 *   - computeExpiringThresholdLabel(days)    — "Próximos N días"
 *
 *   Composables (require Vue + TanStack Query context):
 *   - useEmployeeDocuments(employeeId)       — query for documents list
 *   - useUploadDocument(employeeId)          — mutation to upload a document
 *   - useDeleteDocument(employeeId)          — mutation to delete a document
 *
 * CASL gates:
 *   - Read/download requires can('read', 'EmployeeDocument')
 *   - Upload requires can('create', 'EmployeeDocument')
 *   - Delete requires can('delete', 'EmployeeDocument')
 */

import { computed } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { toValue } from 'vue'
import { employeeDocumentQueryKeys, employeeQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { employeesApi } from '../api/employees.api'
import { DOCUMENT_CATEGORY_LABELS } from '../interfaces/employee.types'
import type { EmployeeDocument, EmployeeDocumentCategory } from '../interfaces/employee.types'

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Map an EmployeeDocumentCategory enum value to its Spanish display label.
 *
 * PURE — deterministic.
 */
export function formatDocumentCategory(category: EmployeeDocumentCategory): string {
  return DOCUMENT_CATEGORY_LABELS[category] ?? category
}

// Date formatter for createdAt timestamps (memoized)
const CREATED_AT_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export interface DocumentEntry {
  id: string
  fileId: string
  categoryLabel: string
  /** notes acts as the document title; falls back to categoryLabel if null */
  title: string
  expiresAt: string | null
  createdAtFormatted: string
  /** Raw category for badge color mapping */
  category: EmployeeDocumentCategory
}

/**
 * Build a display-ready document entry from a raw EmployeeDocument.
 * Extracts pure data transformation — no component coupling.
 *
 * Design rules:
 * - `notes` is used as the document title (backend desviación #1: no `title` field)
 * - Falls back to categoryLabel when notes is null
 *
 * PURE — deterministic.
 */
export function buildDocumentEntry(doc: EmployeeDocument): DocumentEntry {
  const categoryLabel = formatDocumentCategory(doc.category)
  return {
    id: doc.id,
    fileId: doc.fileId,
    categoryLabel,
    title: doc.notes ?? categoryLabel,
    expiresAt: doc.expiresAt,
    createdAtFormatted: CREATED_AT_FORMATTER.format(new Date(doc.createdAt)),
    category: doc.category,
  }
}

/**
 * Check if a document expires within the given number of days from today.
 * Returns false for null expiresAt (no expiration date set).
 *
 * Includes documents that expire today (expiresAt >= today in UTC date comparison).
 * The `days` threshold is the inclusive upper bound (expiresAt <= today + days).
 *
 * PURE — uses current date internally; deterministic for a given wall-clock instant.
 */
export function isExpiringSoon(expiresAt: string | null, days: number): boolean {
  if (!expiresAt) return false
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const now = Date.now()
  const todayStart = now - (now % MS_PER_DAY) // midnight UTC today
  const expiry = new Date(expiresAt).getTime()
  const thresholdMs = days * MS_PER_DAY
  // Include: expiry is today or future, and within threshold window
  return expiry >= todayStart && expiry - todayStart <= thresholdMs
}

/**
 * Filter a document array to those expiring within the given number of days.
 *
 * PURE — deterministic for a given wall-clock instant.
 */
export function filterExpiringDocuments(
  docs: EmployeeDocument[],
  days: number,
): EmployeeDocument[] {
  return docs.filter((doc) => isExpiringSoon(doc.expiresAt, days))
}

/**
 * Build a human-readable threshold label for the "Vencimientos" section filter.
 *
 * PURE — deterministic.
 */
export function computeExpiringThresholdLabel(days: 30 | 60 | 90): string {
  return `Próximos ${days} días`
}

// ─── Composables ──────────────────────────────────────────────────────────────

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

/**
 * useEmployeeDocuments — query composable for the documents list.
 *
 * Requires read:EmployeeDocument permission.
 * Returns all documents for the employee (no client-side pagination in panel;
 * loads up to pageSize=50 which covers most employees).
 */
export function useEmployeeDocuments(employeeId: MaybeRef<string>) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  const queryKey = computed(() =>
    employeeDocumentQueryKeys.list(tenantId.value, toValue(employeeId)),
  )

  const isReady = computed(() => !!tenantId.value && !!toValue(employeeId))

  return useQuery({
    queryKey,
    queryFn: () => employeesApi.getDocuments(toValue(employeeId), { pageSize: 50 }),
    enabled: isReady,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

/**
 * useUploadDocument — mutation composable to upload a new document.
 *
 * On success: invalidates documents list + employee detail keys.
 * Upload uses multipart/form-data via uploadMultipart helper.
 * Requires create:EmployeeDocument permission.
 */
export function useUploadDocument(employeeId: MaybeRef<string>) {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<EmployeeDocument, Error, FormData>({
    mutationFn: (formData: FormData) =>
      employeesApi.uploadDocument(toValue(employeeId), formData),

    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeeDocumentQueryKeys.list(tenantId.value, toValue(employeeId)),
      })
      void queryClient.invalidateQueries({
        queryKey: employeeQueryKeys.detail(tenantId.value, toValue(employeeId)),
      })
      toast.add({ title: 'Documento subido exitosamente', color: 'success' })
    },

    onError: () => {
      toast.add({
        title: 'No se pudo subir el documento',
        description: 'Verificá que el archivo sea válido (PDF, DOC, DOCX, JPG, PNG o WEBP) e intentá de nuevo.',
        color: 'error',
      })
    },
  })

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  }
}

/**
 * useDeleteDocument — mutation composable to delete a document.
 *
 * On success: invalidates documents list key.
 * Requires delete:EmployeeDocument permission.
 * Backend is best-effort on blob deletion — 204 means DB record is gone.
 */
export function useDeleteDocument(employeeId: MaybeRef<string>) {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<void, Error, string>({
    mutationFn: (docId: string) =>
      employeesApi.deleteDocument(toValue(employeeId), docId),

    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeeDocumentQueryKeys.list(tenantId.value, toValue(employeeId)),
      })
      toast.add({ title: 'Documento eliminado', color: 'success' })
    },

    onError: () => {
      toast.add({
        title: 'No se pudo eliminar el documento',
        description: 'Intentá de nuevo.',
        color: 'error',
      })
    },
  })

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
  }
}
