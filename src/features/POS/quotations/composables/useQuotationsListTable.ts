/**
 * useQuotationsListTable — REQ-QAF-014 / T-FE-06.
 *
 * Replaces the legacy `useQuotationsList` (now deleted). Wires the shared
 * `useServerTable` from `core/shared/composables/useServerTable` so the
 * quotations list benefits from the same per-module table identity every
 * other POS module uses:
 *
 *   - 0↔1 pagination adapter mirroring `useConfirmedSales`:
 *     `pageIndex+1 → page` on the way out, `page-1 → pageIndex` on the way
 *     in, `limit → pageSize`, `total → totalCount`, `totalPages → pageCount`.
 *   - Query key MUST keep the `['quotations', tenantId, 'list', params]`
 *     prefix so the `deleteMutation` in `QuotationsListView` keeps
 *     invalidating correctly via `quotationQueryKeys.list(tenantId)`.
 *   - `setStatusFilter(status)` resets pageIndex to 0 and feeds the status tab
 *     into the query — the tabs are the only status filter.
 *
 * `filters` is passed in as a `Ref<Record<string, unknown>>` — the slideover
 * uses `useDataTableFilters(...).backendParams` directly, which already
 * serializes multi-value fields as CSV strings (one round-trip through the
 * schema). The composable forwards them verbatim.
 */

import { computed, ref, type Ref } from 'vue'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { quotationQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { quotationApi } from '../api/quotation.api'
import type { QuotationListParams, QuotationResponseDto, QuotationStatus } from '../interfaces/quotation.types'
import type { ServerTableParams } from '@/core/shared/types/table.types'

/**
 * The backend's quotations endpoint only accepts these values as `sortBy`
 * (see quotation-query.dto.ts). Any other column id — even one a consumer
 * accidentally leaves sortable in the UI — falls back to the default instead
 * of producing a 400.
 */
const ALLOWED_QUOTATION_SORT_BY: ReadonlySet<string> = new Set(['createdAt', 'updatedAt', 'totalCents', 'expiresAt'])

/**
 * Pure: ServerTableParams (0-indexed) → QuotationListParams (1-indexed).
 * Exported for unit testing.
 */
export function mapServerTableParamsToListQuotationsParams(params: ServerTableParams): QuotationListParams {
  const firstSort = params.sorting?.[0]
  const sortBy = firstSort && ALLOWED_QUOTATION_SORT_BY.has(firstSort.id)
    ? firstSort.id as QuotationListParams['sortBy']
    : 'createdAt'

  return {
    page: params.pageIndex + 1,
    limit: params.pageSize,
    sortBy,
    sortOrder: firstSort?.desc ? 'desc' : 'asc',
    ...(params.globalFilter ? { search: params.globalFilter } : {}),
  }
}

/**
 * Normalize the slideover-supplied `customerId` filter (string / array /
 * CSV) to an array; the CSV serializer produces strings for the network.
 */
function resolveCustomerId(schemaValue: unknown): string[] | undefined {
  if (Array.isArray(schemaValue) && schemaValue.length > 0) return schemaValue as string[]
  if (typeof schemaValue === 'string' && schemaValue.length > 0) {
    const parsed = schemaValue.split(',').map(s => s.trim()).filter(Boolean)
    if (parsed.length > 0) return parsed
  }
  return undefined
}

/**
 * The shared numeric-range serializer emits string bounds; direct callers may
 * still pass numbers. Non-numeric or empty bounds are dropped.
 */
function resolveNumericBound(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function resolveTotalBounds(filters: Record<string, unknown>): { minTotalCents?: number; maxTotalCents?: number } {
  const min = resolveNumericBound(filters.minTotalCents)
  const max = resolveNumericBound(filters.maxTotalCents)
  return {
    ...(min !== undefined ? { minTotalCents: min } : {}),
    ...(max !== undefined ? { maxTotalCents: max } : {}),
  }
}

export function useQuotationsListTable(filters: Ref<Record<string, unknown>>) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const statusTabFilter = ref<QuotationStatus | undefined>(undefined)

  const table = useServerTable<QuotationResponseDto>({
    queryKey: () => {
      const status = statusTabFilter.value ? [statusTabFilter.value] : undefined
      const customerId = resolveCustomerId(filters.value.customerId)
      const baseParams: Record<string, unknown> = {
        ...(status ? { status } : {}),
        ...(customerId ? { customerId } : {}),
        ...(filters.value.createdFrom ? { createdFrom: filters.value.createdFrom } : {}),
        ...(filters.value.createdTo ? { createdTo: filters.value.createdTo } : {}),
        ...(filters.value.expiresFrom ? { expiresFrom: filters.value.expiresFrom } : {}),
        ...(filters.value.expiresTo ? { expiresTo: filters.value.expiresTo } : {}),
        ...resolveTotalBounds(filters.value),
      }
      return quotationQueryKeys.list(tenantId.value, baseParams)
    },
    queryFn: async (params) => {
      const status = statusTabFilter.value ? [statusTabFilter.value] : undefined
      const customerId = resolveCustomerId(filters.value.customerId)

      const baseParams: Record<string, unknown> = {
        ...mapServerTableParamsToListQuotationsParams(params),
        ...(status ? { status } : {}),
        ...(customerId ? { customerId } : {}),
        ...(filters.value.createdFrom ? { createdFrom: filters.value.createdFrom } : {}),
        ...(filters.value.createdTo ? { createdTo: filters.value.createdTo } : {}),
        ...(filters.value.expiresFrom ? { expiresFrom: filters.value.expiresFrom } : {}),
        ...(filters.value.expiresTo ? { expiresTo: filters.value.expiresTo } : {}),
        ...resolveTotalBounds(filters.value),
      }

      // SAFETY: baseParams only holds keys of QuotationListParams, built above from typed sources.
      const response = await quotationApi.list(baseParams as unknown as QuotationListParams)

      return {
        data: response.data,
        pagination: {
          pageIndex: response.pagination.page - 1,
          pageSize: response.pagination.limit,
          totalCount: response.pagination.total,
          pageCount: response.pagination.totalPages,
        },
      }
    },
    defaultPageSize: 10,
    defaultSorting: [{ id: 'createdAt', desc: true }],
    defaultPinning: { left: [], right: ['actions'] },
    persistKey: 'pos-quotations-list',
    // owner-ideas-batch S6: page, sort, search and page size in the URL next to the filters.
    urlSync: true,
  })

  function setStatusFilter(status?: QuotationStatus): void {
    statusTabFilter.value = status
    table.pagination.value = { ...table.pagination.value, pageIndex: 0 }
  }

  return {
    ...table,
    setStatusFilter,
  }
}
