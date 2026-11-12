/**
 * Preferences belong to the person (handoff 13 §3: the same in every sucursal), so the key is
 * scoped by user and never by tenant: switching sucursal keeps the cached value.
 */
export const profileKeys = {
  all: (userId: string) => ['profile', userId] as const,
  notificationPreferences: (userId: string) =>
    ['profile', userId, 'notification-preferences'] as const,
}
