/**
 * Tenant-scoped keys: a branch switch never reuses another branch's notices. Everything lives
 * under `all(tenant)`. Cursors are page params of the infinite query, never part of a key.
 */
export const notificationKeys = {
  all: (tenantId: string) => ['notifications', tenantId] as const,
  lists: (tenantId: string) => ['notifications', tenantId, 'list'] as const,
  list: (tenantId: string, filters: { unread: boolean }) =>
    ['notifications', tenantId, 'list', filters] as const,
  unreadCount: (tenantId: string) => ['notifications', tenantId, 'unread-count'] as const,
  latest: (tenantId: string) => ['notifications', tenantId, 'latest'] as const,
  preferences: (tenantId: string) => ['notifications', tenantId, 'preferences'] as const,
}
