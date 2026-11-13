/**
 * Realtime → notifications cache (spec S5, task T4b; handoff 17 §3.2, §7). Installed once,
 * app-wide, only when `VITE_REALTIME_SSE` is on.
 *
 * `unreadCount` of the event is the person's count at delivery time: the badge is SET to it (never
 * incremented), and the lists are refetched so an open panel shows the notice. `ready` and `resync`
 * read the count and the lists again (the 90-day retention announces nothing).
 */
import type { QueryClient } from '@tanstack/vue-query'
import type { RealtimeHandler } from '@/core/realtime/types'
import type { RealtimeService } from '@/core/realtime/realtime-service'
import { notificationKeys } from '../constants/queryKeys'
import type { UnreadCountResponse } from '../interfaces/notifications.types'
import { stampRead } from '../utils/notification-cache'

export interface NotificationsRealtimeSyncOptions {
  client: QueryClient
  service: Pick<RealtimeService, 'on'>
  getTenantId(): string
}

export function startNotificationsRealtimeSync(options: NotificationsRealtimeSyncOptions): () => void {
  const { client, service } = options

  function setBadge(tenant: string, unreadCount: unknown) {
    const key = notificationKeys.unreadCount(tenant)
    if (typeof unreadCount === 'number' && Number.isFinite(unreadCount) && unreadCount >= 0) {
      client.setQueryData<UnreadCountResponse>(key, { count: unreadCount })
    } else {
      void client.invalidateQueries({ queryKey: key, exact: true })
    }
  }
  const refetchLists = (tenant: string) =>
    void client.invalidateQueries({ queryKey: notificationKeys.lists(tenant) })

  const onCreated: RealtimeHandler<unknown> = (payload) => {
    const tenant = options.getTenantId()
    if (!tenant) return
    setBadge(tenant, (payload as { unreadCount?: unknown } | null)?.unreadCount)
    refetchLists(tenant)
  }

  const onRead: RealtimeHandler<unknown> = (payload) => {
    const tenant = options.getTenantId()
    if (!tenant) return
    const event = payload as { ids?: unknown; all?: unknown; unreadCount?: unknown } | null
    if (event?.all === true) stampRead(client, tenant, 'all')
    else if (Array.isArray(event?.ids)) {
      stampRead(client, tenant, event.ids.filter((id): id is string => typeof id === 'string'))
    }
    setBadge(tenant, event?.unreadCount)
    refetchLists(tenant)
  }

  const onResync: RealtimeHandler<unknown> = () => {
    const tenant = options.getTenantId()
    if (!tenant) return
    void client.invalidateQueries({ queryKey: notificationKeys.unreadCount(tenant), exact: true })
    refetchLists(tenant)
  }

  const offs = [
    service.on('notification.created', onCreated),
    service.on('notification.read', onRead),
    service.on('ready', onResync),
    service.on('resync', onResync),
  ]
  return () => {
    for (const off of offs) off()
  }
}
