import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/vue-query'
import { chatbotRequestApi } from '../api/chatbot-request.api'
import { chatbotRequestKeys } from '../constants/queryKeys'
import type { ChatbotRequestCustomerParams, ChatbotRequestRow } from '../interfaces/chatbot-request.types'
import { isStaleCustomerKeyError } from '../utils/requestErrors'
import { REQUESTS_PAGE_SIZE } from './polling'
import { useRequestAccess } from './useRequestAccess'

export interface UseCustomerRequestsOptions {
  /** Opaque token of a group (`k1.…`). Never parsed or built here. */
  customerKey: MaybeRefOrGetter<string | null | undefined>
  status?: MaybeRefOrGetter<ChatbotRequestCustomerParams['status']>
  limit?: number
}

/** «Ver las N restantes»: every row of one customer, cursor-paginated. No polling. */
export function useCustomerRequests(options: UseCustomerRequestsOptions) {
  const { tenantId, enabled: canRead } = useRequestAccess()
  const limit = options.limit ?? REQUESTS_PAGE_SIZE
  const customerKey = computed(() => toValue(options.customerKey)?.trim() ?? '')
  const params = computed(() => ({ status: toValue(options.status), limit }))
  const enabled = computed(() => canRead.value && customerKey.value.length > 0)

  const query = useInfiniteQuery({
    queryKey: computed(() => chatbotRequestKeys.byCustomer(tenantId.value, customerKey.value, params.value)),
    queryFn: ({ pageParam, signal }) =>
      chatbotRequestApi.listByCustomer(
        { customerKey: customerKey.value, ...params.value, cursor: pageParam },
        { signal },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: false,
  })

  const requests = computed<ChatbotRequestRow[]>(() => {
    if (!enabled.value) return []
    const seen = new Set<string>()
    const merged: ChatbotRequestRow[] = []
    for (const page of query.data.value?.pages ?? []) {
      for (const row of page.items) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
        merged.push(row)
      }
    }
    return merged
  })

  return {
    requests,
    isEnabled: enabled,
    isLoading: computed(() => enabled.value && query.isLoading.value),
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: computed(() => enabled.value && query.isError.value),
    error: query.error,
    /** The stored customerKey is stale (`400`): reload the groups and use the new token. */
    needsReload: computed(() => enabled.value && isStaleCustomerKeyError(query.error.value)),
    hasNextPage: computed(() => enabled.value && query.hasNextPage.value),
    fetchNextPage: () => query.fetchNextPage(),
    reload: () => query.refetch(),
  }
}
