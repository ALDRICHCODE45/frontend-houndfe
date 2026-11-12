/**
 * Notification preferences transport on the shared axios `http` (handoff 13 §3).
 *
 * `PATCH` sends only the flags named: the backend answers `400` to an empty body or to an
 * unknown field, so nothing else reaches the wire and an empty patch never leaves the browser.
 * Both routes only need a signed-in user (no CASL permission).
 */
import { http } from '@/core/shared/api/http'
import type {
  NotificationPreferences,
  NotificationPreferencesPatch,
} from '../interfaces/profile.types'

const URL = '/me/notification-preferences'
const FLAGS = ['emailEnabled', 'soundEnabled'] as const

export interface NotificationPreferencesReadOptions {
  /** The executing TanStack query signal. */
  signal?: AbortSignal
}

export const notificationPreferencesApi = {
  /** GET /me/notification-preferences → `{ emailEnabled, soundEnabled }`. */
  async get(options?: NotificationPreferencesReadOptions): Promise<NotificationPreferences> {
    const { data } = await http.get<NotificationPreferences>(URL, { signal: options?.signal })
    return data
  },

  /** PATCH /me/notification-preferences — returns the full object, not just the changed flag. */
  async patch(body: NotificationPreferencesPatch): Promise<NotificationPreferences> {
    const record = body as Record<string, unknown>
    const picked: NotificationPreferencesPatch = {}
    for (const flag of FLAGS) {
      if (typeof record[flag] === 'boolean') picked[flag] = record[flag]
    }
    if (Object.keys(picked).length === 0) {
      throw new Error('notification preferences patch needs at least one flag')
    }
    const { data } = await http.patch<NotificationPreferences>(URL, picked)
    return data
  },
}
