import { watch, type Ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { notificationsApi } from '../api/notifications.api'
import { notificationKeys } from '../constants/queryKeys'
import type { NotificationItem } from '../interfaces/notifications.types'
import { playNotificationSound } from '../utils/notification-sound'

export interface UseNotificationAlertsOptions {
  /** Unread count of the bell; `null` while unknown. */
  count: Ref<number | null>
  tenantId: Ref<string>
  /** The user clicked the browser notice: open this request. */
  onOpenRequest?: (requestId: string) => void
}

/**
 * Alerts for a notice that arrives while the tab is hidden: the count went up since the last
 * known value. Visible tab: nothing (the badge already says it).
 *
 * - Browser notification: only when `Notification.permission === 'granted'`. That is a per-device
 *   permission; there is no server field and nothing here asks for it (the profile screen does).
 * - Sound: only when the server preference `soundEnabled` is true, read fresh each time so a change
 *   made in /perfil applies at once. It does not depend on the browser permission.
 *
 * The first value of a branch is never an alert (it is a load, not an arrival). Whenever the count
 * rises, the lists are invalidated so an open panel shows the new notice.
 */
export function useNotificationAlerts(options: UseNotificationAlertsOptions) {
  const client = useQueryClient()
  let previous: number | null = null

  watch(options.tenantId, () => {
    previous = null
  })

  watch(
    options.count,
    (next) => {
      const before = previous
      previous = next
      if (next === null || before === null || next <= before) return
      void client.invalidateQueries({ queryKey: notificationKeys.lists(options.tenantId.value) })
      if (document.visibilityState === 'hidden') void alertHidden(next)
    },
    { immediate: true },
  )

  async function readLatest(): Promise<NotificationItem | null> {
    try {
      const page = await client.fetchQuery({
        queryKey: notificationKeys.latest(options.tenantId.value),
        queryFn: ({ signal }) => notificationsApi.list({ limit: 1, unread: true }, { signal }),
        staleTime: 0,
      })
      return page.items[0] ?? null
    } catch {
      return null
    }
  }

  async function soundEnabled(): Promise<boolean> {
    try {
      const preferences = await client.fetchQuery({
        queryKey: notificationKeys.preferences(options.tenantId.value),
        queryFn: ({ signal }) => notificationsApi.getPreferences({ signal }),
        staleTime: 0,
      })
      return preferences.soundEnabled === true
    } catch {
      return false
    }
  }

  const canNotify = () => typeof Notification !== 'undefined' && Notification.permission === 'granted'

  async function showBrowserNotice(count: number) {
    if (!canNotify()) return
    const latest = await readLatest()
    try {
      const notice = new Notification(latest?.title ?? 'Nueva notificación', {
        body: latest?.body ?? `Tienes ${count} avisos sin leer`,
        tag: latest?.id,
      })
      notice.onclick = () => {
        window.focus()
        notice.close()
        if (latest?.requestId) options.onOpenRequest?.(latest.requestId)
      }
    } catch {
      // Some platforms refuse the constructor (e.g. mobile Chrome); the bell still has the notice.
    }
  }

  async function alertHidden(count: number) {
    const [, sound] = await Promise.all([showBrowserNotice(count), soundEnabled()])
    if (sound) playNotificationSound()
  }
}
