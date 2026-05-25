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

export function mapServerTableParamsToListSalesParams(params: ServerTableParams): ListSalesParams {
  const firstSort = params.sorting?.[0]

  return {
    page: params.pageIndex + 1,
    limit: params.pageSize,
    sortBy: (firstSort?.id as ListSalesParams['sortBy']) ?? 'confirmedAt',
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

export function useConfirmedSales(filters: Ref<Record<string, unknown>> = ref({})) {
  const authStore = useAuthStore()
  const counts = ref<SalesListCounts>(DEFAULT_COUNTS)
  const deliveryStatusFilter = ref<SaleDeliveryStatus | undefined>(undefined)
  const filterErrors = ref<Record<string, string>>({})

  const table = useServerTable({
    queryKey: () =>
      saleQueryKeys.confirmed(authStore.currentTenantId, {
        ...filters.value,
        deliveryStatus: resolveDeliveryStatus(filters.value.deliveryStatus, deliveryStatusFilter.value),
      }),
    queryFn: async (params) => {
      try {
        const transformedFilters = transformFolioParam(filters.value)
        const response = await saleApi.listConfirmed({
          ...mapServerTableParamsToListSalesParams(params),
          ...transformedFilters,
          deliveryStatus: resolveDeliveryStatus(filters.value.deliveryStatus, deliveryStatusFilter.value),
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
    urlSync: false,
  })

  function setDeliveryStatusFilter(status?: SaleDeliveryStatus) {
    deliveryStatusFilter.value = status
    table.pagination.value = { ...table.pagination.value, pageIndex: 0 }
  }

  return {
    ...table,
    counts: computed(() => counts.value),
    filterErrors: computed(() => filterErrors.value),
    setDeliveryStatusFilter,
  }
}
