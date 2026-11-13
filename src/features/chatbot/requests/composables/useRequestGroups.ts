import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/vue-query'
import { chatbotRequestApi } from '../api/chatbot-request.api'
import { chatbotRequestKeys } from '../constants/queryKeys'
import type { ChatbotRequestGroup, ChatbotRequestGroupsFilters } from '../interfaces/chatbot-request.types'
import { isStaleCustomerKeyError } from '../utils/requestErrors'
import { pollingInterval, REQUESTS_PAGE_SIZE } from './polling'
import { useRealtimeOpen } from '@/core/realtime/polling'
import { useRequestAccess } from './useRequestAccess'

export interface UseRequestGroupsOptions {
  /** Tab and filters of `GET /chatbot-requests/groups`; the cursor is managed here. */
  filters: MaybeRefOrGetter<ChatbotRequestGroupsFilters>
  limit?: number
}

/**
 * The inbox: customer groups, cursor-paginated (pages accumulate), refetched every 30 s while the
 * tab is visible. A `400` on a stale cursor shows as `needsReload` and is never retried.
 */
export function useRequestGroups(options: UseRequestGroupsOptions) {
  const streamOpen = useRealtimeOpen()
  const { tenantId, enabled } = useRequestAccess()
  const limit = options.limit ?? REQUESTS_PAGE_SIZE
  const filters = computed<ChatbotRequestGroupsFilters>(() => ({ ...toValue(options.filters), limit }))

  const query = useInfiniteQuery({
    queryKey: computed(() => chatbotRequestKeys.groups(tenantId.value, filters.value)),
    queryFn: ({ pageParam, signal }) =>
      chatbotRequestApi.listGroups({ ...filters.value, cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
    // The previous tab stays on screen while the next one loads (the tenant is in the key).
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: false,
    // Re-evaluated when the stream opens or closes (the closure holds the state it was built with).
    refetchInterval: computed(() => {
      const open = streamOpen.value
      return (query: Parameters<typeof pollingInterval>[0]) => pollingInterval(query, open)
    }),
  })

  // Pages never repeat a group, but a refetch can overlap two cursors: first occurrence wins.
  const groups = computed<ChatbotRequestGroup[]>(() => {
    if (!enabled.value) return []
    const seen = new Set<string>()
    const merged: ChatbotRequestGroup[] = []
    for (const page of query.data.value?.pages ?? []) {
      for (const group of page.items) {
        if (seen.has(group.customerKey)) continue
        seen.add(group.customerKey)
        merged.push(group)
      }
    }
    return merged
  })

  return {
    groups,
    isEnabled: enabled,
    isLoading: computed(() => enabled.value && query.isLoading.value),
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isPlaceholder: query.isPlaceholderData,
    isError: computed(() => enabled.value && query.isError.value),
    error: query.error,
    /** Stale token or cursor: reload the list, do not retry. */
    needsReload: computed(() => enabled.value && isStaleCustomerKeyError(query.error.value)),
    hasNextPage: computed(() => enabled.value && query.hasNextPage.value),
    fetchNextPage: () => query.fetchNextPage(),
    reload: () => query.refetch(),
  }
}
