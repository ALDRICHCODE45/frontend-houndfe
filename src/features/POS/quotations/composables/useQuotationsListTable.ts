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
 *   - `setStatusFilter(status)` resets pageIndex to 0 and combines the tab
 *     value with the slideover-supplied filters (slideover wins).
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
 * Pure: ServerTableParams (0-indexed) → QuotationListParams (1-indexed).
 * Exported for unit testing.
 */
export function mapServerTableParamsToListQuotationsParams(params: ServerTableParams): QuotationListParams {
  const firstSort = params.sorting?.[0]

  return {
    page: params.pageIndex + 1,
    limit: params.pageSize,
    sortBy: (firstSort?.id as QuotationListParams['sortBy']) ?? 'createdAt',
    sortOrder: firstSort?.desc ? 'desc' : 'asc',
    ...(params.globalFilter ? { search: params.globalFilter } : {}),
  }
}

/**
 * Normalize the slideover-supplied `status` value (string / array / CSV) to
 * an array, symmetric with `resolveDeliveryStatus` in `useConfirmedSales`.
 * The schema serializes multi-enum filters as CSV strings, so the slideover
 * passes strings; the status tab passes a single literal. We accept both.
 */
function resolveStatus(schemaValue: unknown, tabValue: QuotationStatus | undefined): QuotationStatus[] | undefined {
  if (Array.isArray(schemaValue) && schemaValue.length > 0) {
    return schemaValue as QuotationStatus[]
  }
  if (typeof schemaValue === 'string' && schemaValue.length > 0) {
    const parsed = schemaValue.split(',').map(s => s.trim()).filter(Boolean) as QuotationStatus[]
    if (parsed.length > 0) return parsed
  }
  return tabValue ? [tabValue] : undefined
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

export function useQuotationsListTable(filters: Ref<Record<string, unknown>>) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const statusTabFilter = ref<QuotationStatus | undefined>(undefined)

  const table = useServerTable<QuotationResponseDto>({
    queryKey: () => {
      const status = resolveStatus(filters.value.status, statusTabFilter.value)
      const customerId = resolveCustomerId(filters.value.customerId)
      const baseParams: Record<string, unknown> = {
        ...(status ? { status } : {}),
        ...(customerId ? { customerId } : {}),
        ...(filters.value.expiresFrom ? { expiresFrom: filters.value.expiresFrom } : {}),
        ...(filters.value.expiresTo ? { expiresTo: filters.value.expiresTo } : {}),
        ...(typeof filters.value.minTotalCents === 'number' ? { minTotalCents: filters.value.minTotalCents } : {}),
        ...(typeof filters.value.maxTotalCents === 'number' ? { maxTotalCents: filters.value.maxTotalCents } : {}),
      }
      return quotationQueryKeys.list(tenantId.value, baseParams)
    },
    queryFn: async (params) => {
      const status = resolveStatus(filters.value.status, statusTabFilter.value)
      const customerId = resolveCustomerId(filters.value.customerId)

      const baseParams: Record<string, unknown> = {
        ...mapServerTableParamsToListQuotationsParams(params),
        ...(status ? { status } : {}),
        ...(customerId ? { customerId } : {}),
        ...(filters.value.expiresFrom ? { expiresFrom: filters.value.expiresFrom } : {}),
        ...(filters.value.expiresTo ? { expiresTo: filters.value.expiresTo } : {}),
        ...(typeof filters.value.minTotalCents === 'number' ? { minTotalCents: filters.value.minTotalCents } : {}),
        ...(typeof filters.value.maxTotalCents === 'number' ? { maxTotalCents: filters.value.maxTotalCents } : {}),
      }

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
    persistKey: 'pos-quotations-list',
    urlSync: false,
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
