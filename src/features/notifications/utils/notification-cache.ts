/**
 * Optimistic edits of the notifications cache. A snapshot is taken before a mark-read mutation and
 * put back if the server refuses; the settled mutation invalidates, so the server has the last word.
 */
import type { InfiniteData, QueryClient } from '@tanstack/vue-query'
import { notificationKeys } from '../constants/queryKeys'
import type { NotificationsPage, UnreadCountResponse } from '../interfaces/notifications.types'

type ListCache = InfiniteData<NotificationsPage, string | undefined>

export interface NotificationsSnapshot {
  count: UnreadCountResponse | undefined
  lists: [readonly unknown[], ListCache | undefined][]
}

export function takeSnapshot(client: QueryClient, tenantId: string): NotificationsSnapshot {
  return {
    count: client.getQueryData<UnreadCountResponse>(notificationKeys.unreadCount(tenantId)),
    lists: client.getQueriesData<ListCache>({ queryKey: notificationKeys.lists(tenantId) }),
  }
}

export function restoreSnapshot(client: QueryClient, tenantId: string, snapshot: NotificationsSnapshot) {
  if (snapshot.count !== undefined) client.setQueryData(notificationKeys.unreadCount(tenantId), snapshot.count)
  for (const [key, data] of snapshot.lists) client.setQueryData(key, data)
}

/** Is this notice loaded in some list and still unread? Only then does reading it lower the count. */
export function isLoadedUnread(client: QueryClient, tenantId: string, id: string): boolean {
  return client
    .getQueriesData<ListCache>({ queryKey: notificationKeys.lists(tenantId) })
    .some(([, data]) =>
      data?.pages.some((page) => page.items.some((item) => item.id === id && item.readAt === null)),
    )
}

export function adjustCount(client: QueryClient, tenantId: string, next: (current: number) => number) {
  client.setQueryData<UnreadCountResponse>(notificationKeys.unreadCount(tenantId), (current) =>
    current ? { count: Math.max(0, next(current.count)) } : current,
  )
}

/** Stamps `readAt` on unread rows: the ones in `ids`, or every one when `ids` is `'all'`. */
export function stampRead(client: QueryClient, tenantId: string, ids: readonly string[] | 'all') {
  const readAt = new Date().toISOString()
  client.setQueriesData<ListCache>({ queryKey: notificationKeys.lists(tenantId) }, (data) => {
    if (!data) return data
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((item) =>
          item.readAt === null && (ids === 'all' || ids.includes(item.id)) ? { ...item, readAt } : item,
        ),
      })),
    }
  })
}
