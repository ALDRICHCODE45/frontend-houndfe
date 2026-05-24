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

export function useConfirmedSales(filters: Ref<Record<string, unknown>> = ref({})) {
  const authStore = useAuthStore()
  const counts = ref<SalesListCounts>(DEFAULT_COUNTS)
  const deliveryStatusFilter = ref<SaleDeliveryStatus | undefined>(undefined)
  const filterErrors = ref<Record<string, string>>({})

  const table = useServerTable({
    queryKey: () =>
      saleQueryKeys.confirmed(authStore.currentTenantId, {
        ...filters.value,
        deliveryStatus: deliveryStatusFilter.value ? [deliveryStatusFilter.value] : undefined,
      }),
    queryFn: async (params) => {
      try {
        const transformedFilters = transformFolioParam(filters.value)
        const response = await saleApi.listConfirmed({
          ...mapServerTableParamsToListSalesParams(params),
          ...transformedFilters,
          deliveryStatus: deliveryStatusFilter.value ? [deliveryStatusFilter.value] : undefined,
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
