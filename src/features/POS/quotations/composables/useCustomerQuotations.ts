/**
 * The quotations of one customer (customers-module T4, «Cotizaciones» tab of the customer page):
 * `GET /quotations?customerId=` (L3: supported), newest first, one page at a time. Needs
 * `read:Quotation`; nothing is fetched without it or while the tab is closed.
 *
 * Its key sits under the tenant's `quotations` root but outside `list`, so the list editor's cache
 * writes (which prepend a new draft to every list page) never leak another customer's quotation in.
 */
import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { quotationApi } from '../api/quotation.api'
import type { PaginatedQuotations, QuotationListParams } from '../interfaces/quotation.types'

export const CUSTOMER_QUOTATIONS_PAGE_SIZE = 10

export function useCustomerQuotations(options: {
  customerId: MaybeRefOrGetter<string | null | undefined>
  enabled: MaybeRefOrGetter<boolean>
}) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const customerId = computed(() => toValue(options.customerId) || undefined)
  const canRead = computed(
    () => typeof authStore.userCan === 'function' && authStore.userCan('read', 'Quotation'),
  )
  const page = shallowRef(1)
  watch(customerId, () => {
    page.value = 1
  })

  const params = computed<QuotationListParams>(() => ({
    customerId: customerId.value,
    page: page.value,
    limit: CUSTOMER_QUOTATIONS_PAGE_SIZE,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  }))

  const query = useQuery<PaginatedQuotations>({
    queryKey: computed(() => ['quotations', tenantId.value, 'by-customer', customerId.value, params.value] as const),
    queryFn: () => quotationApi.list(params.value),
    enabled: computed(
      () => toValue(options.enabled) && canRead.value && !!tenantId.value && !!customerId.value,
    ),
    staleTime: 30_000,
  })

  return {
    canRead,
    page,
    response: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  }
}
