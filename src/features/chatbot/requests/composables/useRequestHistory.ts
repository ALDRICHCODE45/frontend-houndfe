import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/vue-query'
import { chatbotRequestApi } from '../api/chatbot-request.api'
import { chatbotRequestKeys } from '../constants/queryKeys'
import type { ChatbotRequestHistoryParams, ChatbotRequestRow } from '../interfaces/chatbot-request.types'
import { isStaleCustomerKeyError } from '../utils/requestErrors'
import { REQUESTS_PAGE_SIZE } from './polling'
import { useRequestAccess } from './useRequestAccess'

export interface UseRequestHistoryOptions {
  filters: MaybeRefOrGetter<Omit<ChatbotRequestHistoryParams, 'cursor' | 'limit'>>
  limit?: number
}

/** «Historial»: closed more than 7 days ago, flat and newest first. No polling. */
export function useRequestHistory(options: UseRequestHistoryOptions) {
  const { tenantId, enabled } = useRequestAccess()
  const limit = options.limit ?? REQUESTS_PAGE_SIZE
  const filters = computed(() => ({ ...toValue(options.filters), limit }))

  const query = useInfiniteQuery({
    queryKey: computed(() => chatbotRequestKeys.history(tenantId.value, filters.value)),
    queryFn: ({ pageParam, signal }) =>
      chatbotRequestApi.listHistory({ ...filters.value, cursor: pageParam }, { signal }),
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
    /** `400 VALIDATION_ERROR` (bad range pair or stale cursor/token): reload, do not retry. */
    needsReload: computed(() => enabled.value && isStaleCustomerKeyError(query.error.value)),
    hasNextPage: computed(() => enabled.value && query.hasNextPage.value),
    fetchNextPage: () => query.fetchNextPage(),
    reload: () => query.refetch(),
  }
}
