import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/vue-query'
import { notificationsApi } from '../api/notifications.api'
import { notificationKeys } from '../constants/queryKeys'
import type { NotificationItem } from '../interfaces/notifications.types'
import { useNotificationsAccess } from './useNotificationsAccess'

/** Page size asked of the backend (it allows 1–50, default 20). */
export const NOTIFICATIONS_PAGE_SIZE = 20

export interface UseNotificationsOptions {
  /** The «Sin leer» tab: `unread=true`. */
  unread: MaybeRefOrGetter<boolean>
  /** Only read while the panel is open (default: always). */
  active?: MaybeRefOrGetter<boolean>
}

/** The panel's list: newest first, cursor pages, one cache per tab and branch. No polling. */
export function useNotifications(options: UseNotificationsOptions) {
  const access = useNotificationsAccess()
  const enabled = computed(() => access.enabled.value && toValue(options.active ?? true))
  const unread = computed(() => toValue(options.unread))

  const query = useInfiniteQuery({
    queryKey: computed(() => notificationKeys.list(access.tenantId.value, { unread: unread.value })),
    queryFn: ({ pageParam, signal }) =>
      notificationsApi.list(
        { cursor: pageParam, limit: NOTIFICATIONS_PAGE_SIZE, unread: unread.value },
        { signal },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    retry: false,
  })

  const items = computed<NotificationItem[]>(() => {
    if (!enabled.value) return []
    const seen = new Set<string>()
    const merged: NotificationItem[] = []
    for (const page of query.data.value?.pages ?? []) {
      for (const item of page.items) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
        merged.push(item)
      }
    }
    return merged
  })

  return {
    items,
    isEnabled: enabled,
    isLoading: computed(() => enabled.value && query.isLoading.value),
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: computed(() => enabled.value && query.isError.value),
    hasNextPage: computed(() => enabled.value && query.hasNextPage.value),
    fetchNextPage: () => query.fetchNextPage(),
    reload: () => query.refetch(),
  }
}
