import { computed, ref, type Ref } from 'vue'
import type { AxiosError } from 'axios'
import type { ServerTableParams } from '@/core/shared/types/table.types'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { mapListingErrorToFilterField } from '@/core/shared/data-table-filters'
import { saleApi } from '../api/sale.api'
import type { ListSalesParams, SalesListCounts, SaleDeliveryStatus } from '../interfaces/sale.types'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { defaultColumnVisibility } from './useSalesColumns'
import { formatFolioForBackend } from '../utils/folio'

const DEFAULT_COUNTS: SalesListCounts = { all: 0, pendingPayments: 0, notDelivered: 0 }

/**
 * The backend's confirmed-sales endpoint only accepts these values as
 * `sortBy` (see list-sales-query.dto.ts). Any other column id — even one a
 * consumer accidentally leaves sortable in the UI — falls back to the default
 * instead of producing a 400.
 */
const ALLOWED_SALES_SORT_BY: ReadonlySet<string> = new Set(['confirmedAt', 'totalCents', 'createdAt'])

export function mapServerTableParamsToListSalesParams(params: ServerTableParams): ListSalesParams {
  const firstSort = params.sorting?.[0]
  const sortBy = firstSort && ALLOWED_SALES_SORT_BY.has(firstSort.id)
    ? firstSort.id as ListSalesParams['sortBy']
    : 'confirmedAt'

  return {
    page: params.pageIndex + 1,
    limit: params.pageSize,
    sortBy,
    sortOrder: firstSort?.desc ? 'desc' : 'asc',
    q: params.globalFilter,
  }
}

function toListingErrorPayload(error: unknown): unknown {
  const axiosError = error as AxiosError<{ error?: unknown }>
  return axiosError?.response?.data?.error ?? axiosError?.response?.data
}

function transformFolioParam(filters: Record<string, unknown>): Record<string, unknown> {
  const folio = filters.folio
  if (typeof folio !== 'string' || folio.length === 0) return filters

  const transformed = folio
    .split(',')
    .map(token => token.trim())
    .filter(Boolean)
    .map(formatFolioForBackend)
    .filter(Boolean)
    .join(',')

  return { ...filters, folio: transformed }
}

/**
 * Merge the slideover-supplied deliveryStatus with the quick-filter tab value.
 *
 * Rules (UX intent — slideover is more explicit, so it wins):
 *  - If the slideover sets `deliveryStatus` to a non-empty value, use it.
 *  - Otherwise, fall back to the quick filter (`PENDING` etc.) wrapped in an array.
 *  - If neither opines, leave it undefined so the backend returns all rows.
 *
 * The schema's `backendParams` serializes multi-enum filters as CSV strings
 * (e.g. "PENDING,DELIVERED") to match the URL query-string contract, so we
 * also accept that shape and normalize to an array.
 */
function resolveDeliveryStatus(
  schemaValue: unknown,
  quickFilter: SaleDeliveryStatus | undefined,
): SaleDeliveryStatus[] | undefined {
  if (Array.isArray(schemaValue) && schemaValue.length > 0) {
    return schemaValue as SaleDeliveryStatus[]
  }
  if (typeof schemaValue === 'string' && schemaValue.length > 0) {
    const parsed = schemaValue.split(',').map(s => s.trim()).filter(Boolean) as SaleDeliveryStatus[]
    if (parsed.length > 0) return parsed
  }
  return quickFilter ? [quickFilter] : undefined
}

/**
 * Merge the slideover-supplied paymentStatus with the quick-filter tab value.
 * The "Pagos Pendientes" quick tab (added in WU-D) sends a CSV literal
 * (`PARTIAL,CREDIT`); the slideover schema can send either a string or an
 * array. We normalize to an array to mirror `resolveDeliveryStatus`'s shape
 * (axios serializes both `csv string` and `repeated param` to the same wire
 * form per backend §6.1).
 */
function resolvePaymentStatus(
  schemaValue: unknown,
  quickFilter: string | undefined,
): string[] | undefined {
  if (Array.isArray(schemaValue) && schemaValue.length > 0) {
    return schemaValue as string[]
  }
  if (typeof schemaValue === 'string' && schemaValue.length > 0) {
    const parsed = schemaValue.split(',').map(s => s.trim()).filter(Boolean)
    if (parsed.length > 0) return parsed
  }
  return quickFilter ? [quickFilter] : undefined
}

// Discriminated payload from SalesListTabs — a tab activates exactly one
// filter dimension at a time. Adding new quick-tab dimensions means adding
// an optional field here and a corresponding branch in `setTabFilter`.
type SalesListTabChange = {
  deliveryStatus?: SaleDeliveryStatus
  paymentStatus?: string
}

export function useConfirmedSales(filters: Ref<Record<string, unknown>> = ref({})) {
  const authStore = useAuthStore()
  const counts = ref<SalesListCounts>(DEFAULT_COUNTS)
  const deliveryStatusFilter = ref<SaleDeliveryStatus | undefined>(undefined)
  const paymentStatusFilter = ref<string | undefined>(undefined)
  const filterErrors = ref<Record<string, string>>({})

  // Merge the two tab-state dimensions into the API-bound filters. The slideover
  // schema (baseFilters) takes precedence over the quick-tab state when both
  // are present, mirroring the same UX intent documented on `resolveDeliveryStatus`.
  function resolveActiveFilters(baseFilters: Record<string, unknown>): Record<string, unknown> {
    const ds = resolveDeliveryStatus(baseFilters.deliveryStatus, deliveryStatusFilter.value)
    const ps = resolvePaymentStatus(baseFilters.paymentStatus, paymentStatusFilter.value)
    return {
      ...baseFilters,
      ...(ds !== undefined ? { deliveryStatus: ds } : {}),
      ...(ps !== undefined ? { paymentStatus: ps } : {}),
    }
  }

  const table = useServerTable({
    queryKey: () =>
      saleQueryKeys.confirmed(authStore.currentTenantId, resolveActiveFilters(filters.value)),
    queryFn: async (params) => {
      try {
        const transformedFilters = transformFolioParam(filters.value)
        const activeFilters = resolveActiveFilters(transformedFilters)
        const response = await saleApi.listConfirmed({
          ...mapServerTableParamsToListSalesParams(params),
          ...activeFilters,
        })

        filterErrors.value = {}

        counts.value = response.counts

        return {
          data: response.data,
          pagination: {
            pageIndex: response.pagination.page - 1,
            pageSize: response.pagination.limit,
            totalCount: response.pagination.total,
            pageCount: response.pagination.totalPages,
          },
        }
      }
      catch (error) {
        const mapped = mapListingErrorToFilterField(toListingErrorPayload(error))
        filterErrors.value = mapped ? { [mapped.filterId]: mapped.message } : {}
        throw error
      }

    },
    defaultPageSize: 20,
    persistKey: 'pos-sales-list',
    defaultSorting: [{ id: 'confirmedAt', desc: true }],
    defaultColumnVisibility,
    defaultPinning: { left: [], right: ['actions'] },
    urlSync: false,
  })

  // Generic tab-change handler (WU-D). Replaces the previous
  // `setDeliveryStatusFilter` flow: a tab activates exactly one dimension;
  // the other dimension is cleared so the activated one wins.
  function setTabFilter(payload: SalesListTabChange): void {
    if (payload.deliveryStatus !== undefined) {
      deliveryStatusFilter.value = payload.deliveryStatus
      paymentStatusFilter.value = undefined
    } else if (payload.paymentStatus !== undefined) {
      deliveryStatusFilter.value = undefined
      paymentStatusFilter.value = payload.paymentStatus
    } else {
      deliveryStatusFilter.value = undefined
      paymentStatusFilter.value = undefined
    }
    table.pagination.value = { ...table.pagination.value, pageIndex: 0 }
  }

  // Backward-compatible alias so callers passing a raw delivery status still work.
  function setDeliveryStatusFilter(status?: SaleDeliveryStatus): void {
    setTabFilter({ deliveryStatus: status })
  }

  return {
    ...table,
    counts: computed(() => counts.value),
    filterErrors: computed(() => filterErrors.value),
    setTabFilter,
    setDeliveryStatusFilter,
  }
}