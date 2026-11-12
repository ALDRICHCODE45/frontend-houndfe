/**
 * Notifications transport on the shared axios `http` (handoff 13).
 *
 * Query params are picked by an allow-list: the backend answers `400` to unknown fields, so only
 * `cursor`, `limit` and `unread=true` can reach the wire. The user and branch come from the JWT.
 */
import { http } from '@/core/shared/api/http'
import type {
  MarkAllReadResponse,
  MarkReadResponse,
  NotificationPreferences,
  NotificationReadOptions,
  NotificationsListParams,
  NotificationsPage,
  UnreadCountResponse,
} from '../interfaces/notifications.types'

const BASE = '/notifications'

function listQuery(params: NotificationsListParams): Record<string, unknown> {
  const query: Record<string, unknown> = {}
  if (params.cursor) query.cursor = params.cursor
  if (params.limit !== undefined) query.limit = params.limit
  // `unread=false` is not "read only"; the unfiltered list simply omits the parameter.
  if (params.unread === true) query.unread = true
  return query
}

export const notificationsApi = {
  /** GET /notifications — one cursor page, newest first. */
  async list(
    params: NotificationsListParams = {},
    options?: NotificationReadOptions,
  ): Promise<NotificationsPage> {
    const { data } = await http.get<NotificationsPage>(BASE, {
      params: listQuery(params),
      signal: options?.signal,
    })
    return data
  },

  /** GET /notifications/unread-count — unbounded per branch (the «99+» cap is ours). */
  async unreadCount(options?: NotificationReadOptions): Promise<UnreadCountResponse> {
    const { data } = await http.get<UnreadCountResponse>(`${BASE}/unread-count`, {
      signal: options?.signal,
    })
    return data
  },

  /** POST /notifications/:id/read — no body, idempotent. */
  async markRead(id: string): Promise<MarkReadResponse> {
    const { data } = await http.post<MarkReadResponse>(`${BASE}/${encodeURIComponent(id)}/read`)
    return data
  },

  /** POST /notifications/read-all — no body; only this person's unread in this branch. */
  async markAllRead(): Promise<MarkAllReadResponse> {
    const { data } = await http.post<MarkAllReadResponse>(`${BASE}/read-all`)
    return data
  },

  /** GET /me/notification-preferences — the person's, the same in every branch and device. */
  async getPreferences(options?: NotificationReadOptions): Promise<NotificationPreferences> {
    const { data } = await http.get<NotificationPreferences>('/me/notification-preferences', {
      signal: options?.signal,
    })
    return data
  },
}
