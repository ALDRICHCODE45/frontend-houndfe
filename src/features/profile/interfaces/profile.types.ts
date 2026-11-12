/**
 * Profile types. The notification preferences are the whole contract of handoff 13 §3
 * (`GET`/`PATCH /me/notification-preferences`); they belong to the person, so they are the same
 * in every sucursal and on every device. Browser notifications are NOT a server field: they are
 * a per-device permission read from the browser.
 */

/** The two server preferences; both default to `true` on the backend. */
export interface NotificationPreferences {
  emailEnabled: boolean
  soundEnabled: boolean
}

export type NotificationPreferenceKey = keyof NotificationPreferences

/** PATCH body: at least one flag; the other keeps its stored value. */
export type NotificationPreferencesPatch = Partial<NotificationPreferences>

/** Per-device browser permission, or `unsupported` when there is no Notification API. */
export type BrowserNotificationState = 'default' | 'granted' | 'denied' | 'unsupported'
