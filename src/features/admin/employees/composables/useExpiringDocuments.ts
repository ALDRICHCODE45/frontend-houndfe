/**
 * useExpiringDocuments — WU-A (REQ-1 migration to useServerTable)
 *
 * Pure helpers + closure-composition composable for the tenant-wide Expiring
 * Documents dashboard view.
 *
 * Exports:
 *   Pure helpers (exported for direct unit testing — ZERO mocks needed):
 *   - formatDaysRemaining(days)              — number → human-readable label
 *   - computeExpiringDocumentRow(doc, now?)  — builds display-ready row from EmployeeDocument
 *
 *   Composable:
 *   - useExpiringDocuments(options)          — useServerTable-backed composable
 *
 * Closure composition (mirrors useEmployeesList — Fase 3 #1):
 *   - `selectedThreshold` (30 | 60 | 90, default 30) closes `queryKey` and
 *     `queryFn`, so switching the expiry window changes the cache slot and
 *     refetches with a new `daysUntilExpiry`.
 *   - `watch(selectedThreshold)` resets `pageIndex` to 0 (REQ-1/REQ-7 —
 *     useServerTable resets page only on sorting/search, not on key change).
 *   - Shared `useServerTable` is UNTOUCHED. staleTime 30_000 +
 *     refetchOnWindowFocus false are useServerTable defaults (kept).
 *
 * Backend constraint (§4.4):
 *   - GET /admin/employees-documents/expiring?daysUntilExpiry=N (server-paginated)
 *   - Route uses HYPHEN — NOT under /:employeeId
 *   - Items carry server-resolved fullName / employeeNumber (no listForPicker)
 *   - NEVER send tenantId
 */

import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { employeeDocumentQueryKeys } from '@/core/shared/constants/query-keys'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { employeesApi } from '../api/employees.api'
import type { ExpiringDocumentItem } from '../api/employees.api'
import { DOCUMENT_CATEGORY_LABELS } from '../interfaces/employee.types'
import type { EmployeeDocument } from '../interfaces/employee.types'
import { formatTimeOffDate } from './useEmployeeColumns'

// ─── Constants ────────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Format the number of days remaining until expiry into a human-readable label.
 *
 * Rules:
 *   - Negative → "Vencido" (already expired)
 *   - 0 → "Hoy"
 *   - 1 → "1 día"
 *   - N → "N días"
 *
 * PURE — deterministic.
 */
export function formatDaysRemaining(days: number): string {
  if (days < 0) return 'Vencido'
  if (days === 0) return 'Hoy'
  if (days === 1) return '1 día'
  return `${days} días`
}

export interface ExpiringDocumentRow {
  id: string
  employeeId: string
  fileId: string
  /** notes field used as title; falls back to category label when null */
  title: string
  /** Category enum + Spanish label, e.g. "Acuerdo de confidencialidad (NDA)" */
  categoryLabel: string
  expiresAt: string | null
  /** Localized, human-readable expiry date (via formatTimeOffDate); "—" when null */
  expiresAtLabel: string
  /** Integer number of days from now until expiry. Negative if expired. */
  daysRemaining: number
  /** Human-readable label from formatDaysRemaining */
  daysRemainingLabel: string
  category: string
}

/**
 * Build a display-ready row for the expiring documents table.
 *
 * Accepts an optional `now` Date for deterministic testing; defaults to today UTC.
 *
 * PURE — deterministic for a given wall-clock instant.
 */
export function computeExpiringDocumentRow(
  doc: EmployeeDocument,
  now: Date = new Date(),
): ExpiringDocumentRow {
  const categoryDisplayLabel = DOCUMENT_CATEGORY_LABELS[doc.category] ?? doc.category
  const title = doc.notes ?? categoryDisplayLabel

  let daysRemaining = 0
  if (doc.expiresAt) {
    const nowStart = now.getTime() - (now.getTime() % MS_PER_DAY) // midnight UTC
    const expiryTime = new Date(doc.expiresAt).getTime()
    daysRemaining = Math.round((expiryTime - nowStart) / MS_PER_DAY)
  }

  return {
    id: doc.id,
    employeeId: doc.employeeId,
    fileId: doc.fileId,
    title,
    categoryLabel: `${categoryDisplayLabel} (${doc.category})`,
    expiresAt: doc.expiresAt,
    expiresAtLabel: formatTimeOffDate(doc.expiresAt ?? ''),
    daysRemaining,
    daysRemainingLabel: formatDaysRemaining(daysRemaining),
    category: doc.category,
  }
}

// ─── Composable ───────────────────────────────────────────────────────────────

export type ExpiringThreshold = 30 | 60 | 90

/** Row type consumed by the view: display row + server-resolved identity. */
export type ExpiringDocumentTableRow = ExpiringDocumentRow & {
  fullName: string
  employeeNumber: string
}

export interface UseExpiringDocumentsOptions {
  defaultPageSize?: number
  debounceMs?: number
}

/**
 * useExpiringDocuments — server-side expiring documents table state.
 *
 * Wraps the shared (UNTOUCHED) useServerTable. `selectedThreshold` closes
 * queryKey/queryFn so the 30/60/90 selector in the view's `#filters` slot
 * refetches with a new `daysUntilExpiry` and resets to page 1.
 * Requires read:EmployeeDocument permission (route-gated).
 */
export function useExpiringDocuments(options: UseExpiringDocumentsOptions = {}) {
  const { defaultPageSize = 10, debounceMs = 300 } = options

  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  // Feature-local filter state (close over queryKey/queryFn) — 30/60/90 window.
  const selectedThreshold = ref<ExpiringThreshold>(30)

  // ── Compose the shared useServerTable (untouched) ──────────────────────────
  const t = useServerTable<ExpiringDocumentItem>({
    queryKey: () => employeeDocumentQueryKeys.expiring(tenantId.value, selectedThreshold.value),
    queryFn: (params) => employeesApi.getExpiringDocumentsPaginated(params, selectedThreshold.value),
    defaultSorting: [{ id: 'vencimiento', desc: false }],
    defaultPageSize,
    debounceMs,
    pageSizeOptions: [10, 20, 50],
    persistKey: 'admin-expiring-documents',
    urlSync: false,
  })

  // REQ-1/REQ-7: useServerTable resets the page only on sorting/search — NOT on a
  // closure-key change. Reset pageIndex to 0 when the expiry window changes.
  watch(selectedThreshold, () => {
    t.pagination.value = { ...t.pagination.value, pageIndex: 0 }
  })

  // REQ-8: map server rows into display rows carrying the resolved fullName and
  // employeeNumber (the view renders these directly — no view-side merge).
  const documents = computed<ExpiringDocumentTableRow[]>(() =>
    t.data.value.map((item) => ({
      ...computeExpiringDocumentRow(item),
      fullName: item.fullName,
      employeeNumber: item.employeeNumber,
    })),
  )

  return {
    // Feature-local state
    selectedThreshold,
    // Derived rows
    documents,
    // useServerTable surface — see src/core/shared/composables/useServerTable.ts
    pagination: t.pagination,
    sorting: t.sorting,
    globalFilter: t.globalFilter,
    columnVisibility: t.columnVisibility,
    totalCount: t.totalCount,
    pageCount: t.pageCount,
    isLoading: t.isLoading,
    isFetching: t.isFetching,
    isError: t.isError,
    error: t.error,
    refresh: t.refresh,
    pageSizeOptions: t.pageSizeOptions,
    showingFrom: t.showingFrom,
    showingTo: t.showingTo,
  }
}
