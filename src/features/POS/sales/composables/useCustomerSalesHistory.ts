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

  const query = useQuery<ConfirmedSalesListResponse>({
    queryKey,
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const response = await saleApi.listConfirmed({
        customerId: [customerId.value as string],
        page: toValue(page),
        limit: 10,
        sortBy: 'confirmedAt',
        sortOrder: 'desc',
      })
      SaleListSummarySchema.parse(response.summary)
      return response
    },
  })

  const response = computed<ConfirmedSalesListResponse | undefined>(() => query.data.value)

  return {
    response,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
