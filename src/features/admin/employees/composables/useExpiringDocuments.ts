/**
 * useExpiringDocuments — WU-12B
 *
 * Pure helpers + composable for the tenant-wide Expiring Documents dashboard view.
 *
 * Exports:
 *   Pure helpers (exported for direct unit testing — ZERO mocks needed):
 *   - formatDaysRemaining(days)              — number → human-readable label
 *   - computeExpiringDocumentRow(doc, now?)  — builds display-ready row from EmployeeDocument
 *
 *   Composable (requires Vue + TanStack Query context):
 *   - useExpiringDocuments(days)             — query for tenant-wide expiring docs
 *
 * CASL gate:
 *   - Requires can('read', 'EmployeeDocument')
 *
 * Backend constraint (§4.4):
 *   - GET /admin/employees-documents/expiring?daysUntilExpiry=N
 *   - Route uses HYPHEN — NOT under /:employeeId
 *   - Default: 30 days if daysUntilExpiry is omitted
 *   - NEVER send tenantId
 */

import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { toValue } from 'vue'
import { employeeDocumentQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { employeesApi } from '../api/employees.api'
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

// ─── Client-side pagination ─────────────────────────────────────────────────────

export interface PaginatedRows<T> {
  /** The slice of rows for the requested page. */
  pageRows: T[]
  /** Total number of rows across all pages. */
  total: number
  /** Number of pages (0 when there are no rows). */
  pageCount: number
}

/**
 * Slice an in-memory array into a single page.
 *
 * The tenant-wide expiring-documents endpoint returns the FULL array
 * (server-sorted, NOT paginated), so the view paginates client-side. Uses
 * straight Array.slice semantics: a page beyond the range yields an empty slice.
 *
 * PURE — deterministic, no side effects.
 */
export function paginateRows<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
): PaginatedRows<T> {
  const total = rows.length
  const size = pageSize > 0 ? Math.floor(pageSize) : total
  const pageCount = size > 0 ? Math.ceil(total / size) : 0
  const start = Math.max(0, (page - 1) * size)
  const pageRows = size > 0 ? rows.slice(start, start + size) : [...rows]
  return { pageRows, total, pageCount }
}

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * useExpiringDocuments — query composable for tenant-wide expiring documents.
 *
 * Param days: 30 | 60 | 90 — threshold for expiry window. Default 30.
 * Returns all EmployeeDocument across the tenant expiring within N days,
 * ordered by expiresAt asc (backend sorts).
 * Requires read:EmployeeDocument permission (route-gated).
 */
export function useExpiringDocuments(days: MaybeRef<30 | 60 | 90> = 30) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  const queryKey = computed(() =>
    employeeDocumentQueryKeys.expiring(tenantId.value, toValue(days)),
  )

  const isReady = computed(() => !!tenantId.value)

  return useQuery<EmployeeDocument[]>({
    queryKey,
    queryFn: () => employeesApi.getExpiringDocuments(toValue(days)),
    enabled: isReady,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
