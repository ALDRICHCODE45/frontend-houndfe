import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { quotationQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { quotationApi } from '../api/quotation.api'
import type {
  PaginatedQuotations,
  QuotationResponseDto,
} from '../interfaces/quotation.types'

/**
 * Detail query and the mutations needed by the first quotation editor slice.
 * Every mutation replaces the detail and paginated-list cache entries with the
 * complete quotation returned by the backend.
 */
export function useQuotationDetail(
  quotationId: MaybeRefOrGetter<string | null | undefined>,
) {
  const authStore = useAuthStore()
  const queryClient = useQueryClient()
  const router = useRouter()

  const tenantId = computed(() => authStore.currentTenantId)
  const id = computed(() => toValue(quotationId) ?? '')
  const detailKey = computed(() =>
    quotationQueryKeys.detail(tenantId.value, id.value),
  )
  const listKey = computed(() => quotationQueryKeys.list(tenantId.value))

  const detailQuery = useQuery<QuotationResponseDto>({
    queryKey: detailKey,
    queryFn: () => quotationApi.getById(id.value),
    enabled: computed(() => Boolean(tenantId.value && id.value)),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  })

  function updateQuotationCaches(
    updated: QuotationResponseDto,
    addToList = false,
  ): void {
    const detailKey = quotationQueryKeys.detail(tenantId.value, updated.id)
    queryClient.setQueryData(detailKey, updated)
    queryClient.invalidateQueries({ queryKey: detailKey })
    queryClient.setQueriesData<PaginatedQuotations>(
      { queryKey: listKey.value },
      (page) => {
        if (!page) return page
        const exists = page.data.some((quotation) => quotation.id === updated.id)
        if (addToList && !exists) {
          return {
            ...page,
            data: [updated, ...page.data],
            pagination: { ...page.pagination, total: page.pagination.total + 1 },
          }
        }
        return {
          ...page,
          data: page.data.map((quotation) =>
            quotation.id === updated.id ? updated : quotation,
          ),
        }
      },
    )
  }

  const createDraftMutation = useMutation<
    QuotationResponseDto,
    Error,
    string | undefined
  >({
    mutationFn: (customerId) => quotationApi.createDraft(customerId),
    onSuccess: async (created) => {
      updateQuotationCaches(created, true)
      await queryClient.invalidateQueries({ queryKey: listKey.value })
      await router.replace(`/pos/cotizaciones/${created.id}`)
    },
  })

  const assignCustomerMutation = useMutation<
    QuotationResponseDto,
    Error,
    string
  >({
    mutationFn: (customerId) => quotationApi.assignCustomer(id.value, customerId),
    onSuccess: (updated) => updateQuotationCaches(updated),
  })

  const changePriceListMutation = useMutation<
    QuotationResponseDto,
    Error,
    string | null
  >({
    mutationFn: (globalPriceListId) =>
      quotationApi.setPriceList(id.value, globalPriceListId),
    onSuccess: (updated) => updateQuotationCaches(updated),
  })

  return {
    quotation: detailQuery.data,
    isLoading: detailQuery.isLoading,
    isError: detailQuery.isError,
    error: detailQuery.error,
    createDraft: (customerId?: string) =>
      createDraftMutation.mutateAsync(customerId),
    assignCustomer: (customerId: string) =>
      assignCustomerMutation.mutateAsync(customerId),
    changePriceList: (globalPriceListId: string | null) =>
      changePriceListMutation.mutateAsync(globalPriceListId),
  }
}
