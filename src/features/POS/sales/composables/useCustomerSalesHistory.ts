import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { saleApi } from '../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import {
  SaleListSummarySchema,
  type ConfirmedSalesListResponse,
  type CustomerSalesHistoryParams,
} from '../interfaces/sale.types'

export interface UseCustomerSalesHistoryOptions {
  customerId: MaybeRefOrGetter<string | null | undefined>
  page: MaybeRefOrGetter<number>
  open: MaybeRefOrGetter<boolean>
}

// Cache entries stamp the requesting customer so cross-customer placeholder
// data from `keepPreviousData` can't leak into the exposed response.
interface CustomerHistoryCacheEntry {
  ownerCustomerId: string
  response: ConfirmedSalesListResponse
}

function httpStatus(error: unknown): number | undefined {
  const e = error as { response?: { status?: number }; status?: number; statusCode?: number } | null
  return e?.response?.status ?? e?.status ?? e?.statusCode
}

export function useCustomerSalesHistory(options: UseCustomerSalesHistoryOptions) {
  const authStore = useAuthStore()

  const customerId = computed(() => toValue(options.customerId))
  const page = computed(() => toValue(options.page))
  const open = computed(() => toValue(options.open))
  const tenantId = computed(() => authStore.currentTenantId)
  const enabled = computed(
    () => open.value && Boolean(tenantId.value) && Boolean(customerId.value),
  )

  const params = computed<CustomerSalesHistoryParams>(() => ({
    page: toValue(page),
    limit: 10,
    sortBy: 'confirmedAt',
    sortOrder: 'desc',
  }))

  const queryKey = computed(() =>
    saleQueryKeys.customerHistory(tenantId.value, customerId.value as string, params.value),
  )

  const query = useQuery<CustomerHistoryCacheEntry>({
    queryKey,
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => {
      const status = httpStatus(error)
      if (status !== undefined && [400, 401, 403].includes(status)) return false
      return failureCount < 2
    },
    queryFn: async () => {
      const id = customerId.value as string
      const response = await saleApi.listConfirmed({
        customerId: [id],
        page: toValue(page),
        limit: 10,
        sortBy: 'confirmedAt',
        sortOrder: 'desc',
      })
      SaleListSummarySchema.parse(response.summary)
      return { ownerCustomerId: id, response }
    },
  })

  const response = computed<ConfirmedSalesListResponse | undefined>(() => {
    const entry = query.data.value
    return entry && entry.ownerCustomerId === customerId.value ? entry.response : undefined
  })

  const isPageTransition = computed(
    () => response.value !== undefined && query.isFetching.value && !query.isLoading.value,
  )

  return {
    response,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isPageTransition,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
