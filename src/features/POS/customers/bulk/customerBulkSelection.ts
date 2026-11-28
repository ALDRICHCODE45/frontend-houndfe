/**
 * customerBulkSelection.ts — the selection body shared by POST /customers/bulk/export and
 * POST /customers/bulk/statements (handoff 33 «Selección») and the caps of each route.
 *
 * - `{ mode: 'ids', customerIds }`: 1..1,000 ids, strict (an unknown id is a 404 with missingIds).
 * - `{ mode: 'filter', filter, excludeIds }`: the GET /customers/listing params as strings — built
 *   with the listing's own builder, so search, metric gating and empty values match the table —
 *   without page/limit/sortBy/sortOrder, and up to 1,000 excludeIds.
 */
import type { ServerTableParams } from '@/core/shared/types/table.types'
import { buildCustomersListingParams } from '../composables/useCustomersListing'

export const BULK_STATEMENTS_MAX = 50
export const BULK_CSV_MAX = 10_000
/** Max `customerIds` (ids mode) and max `excludeIds` (filter mode). */
export const BULK_SELECTION_IDS_MAX = 1_000

export type CustomerBulkSelection =
  | { mode: 'ids'; customerIds: string[] }
  | { mode: 'filter'; filter: Record<string, string>; excludeIds: string[] }

export type CustomerBulkKind = 'csv' | 'statements'

/** Keys that never go inside `filter` (paging and sort travel outside, or not at all). */
const NON_FILTER_KEYS: ReadonlySet<string> = new Set(['page', 'limit', 'sortBy', 'sortOrder'])
/** The backend answers 400 to these inside `filter`. */
const RESERVED_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])

const NO_PAGING: ServerTableParams = { pageIndex: 0, pageSize: 1 }

export function buildBulkSelectionFilter(
  search: string,
  filters: Record<string, string>,
  access: { canReadSales: boolean },
): Record<string, string> {
  const safeFilters = Object.fromEntries(Object.entries(filters).filter(([key]) => !RESERVED_KEYS.has(key)))
  const params = buildCustomersListingParams({ ...NO_PAGING, globalFilter: search }, safeFilters, access)
  const filter: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (NON_FILTER_KEYS.has(key) || RESERVED_KEYS.has(key) || value === undefined || value === null) continue
    const text = String(value)
    if (text !== '') filter[key] = text
  }
  return filter
}

const formatCount = (value: number) => value.toLocaleString('en-US')

/** Why an action is disabled for `count` customers, or null when the count fits its cap. */
export function bulkCapReason(kind: CustomerBulkKind, count: number): string | null {
  if (kind === 'statements') {
    return count > BULK_STATEMENTS_MAX ? `Máximo ${BULK_STATEMENTS_MAX} clientes por descarga` : null
  }
  return count > BULK_CSV_MAX ? `Máximo ${formatCount(BULK_CSV_MAX)} clientes por exportación` : null
}
