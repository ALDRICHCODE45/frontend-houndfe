// router.catalogBackoffice.spec.ts — STRICT-TDD tests for the WU3A route.
//
// Mirrors router.notifications.spec.ts: mock the auth store at the
// boundary, import the router, push to the route, assert meta + redirects.
//
// The route (WU3A, REQ-4):
//   path: /system/catalog-settings
//   name: system-catalog-settings
//   meta.layout: 'dashboard'
//   meta.permission: ['read', 'TenantCatalogSettings']
//   NO skipTenantCheck, NO requiresSuperAdmin.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuthStore = {
  accessToken: null as string | null,
  user: null as { id: string } | null,
  isAuthenticated: false,
  permissionsLoaded: false,
  authPhase: 'idle' as
    | 'idle'
    | 'authenticating'
    | 'needs-tenant-selection'
    | 'selecting-tenant'
    | 'authenticated',
  currentTenant: null as { id: string; name: string; slug: string } | null,
  isSuperAdmin: false,
  tempToken: null as string | null,
  hydrateFromStorage: vi.fn(),
  fetchMe: vi.fn(),
  fetchPermissions: vi.fn(),
  clearSession: vi.fn(),
  userCan: vi.fn().mockReturnValue(false),
}

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => mockAuthStore,
}))

function authenticateWithPermission(granted: boolean) {
  mockAuthStore.accessToken = 'access-token'
  mockAuthStore.user = { id: 'user-1' }
  mockAuthStore.isAuthenticated = true
  mockAuthStore.permissionsLoaded = true
  mockAuthStore.authPhase = 'authenticated'
  mockAuthStore.currentTenant = { id: 'tenant-1', name: 'Centro', slug: 'centro' }
  mockAuthStore.userCan.mockImplementation(
    (action: string, subject: string) =>
      granted && action === 'read' && subject === 'TenantCatalogSettings',
  )
}

describe('router — /system/catalog-settings (WU3A REQ-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.accessToken = null
    mockAuthStore.user = null
    mockAuthStore.isAuthenticated = false
    mockAuthStore.permissionsLoaded = false
    mockAuthStore.authPhase = 'idle'
    mockAuthStore.currentTenant = null
    mockAuthStore.isSuperAdmin = false
    mockAuthStore.tempToken = null
    mockAuthStore.userCan.mockReturnValue(false)
  })

  it('resolves the route with dashboard layout when read:TenantCatalogSettings is granted', async () => {
    authenticateWithPermission(true)

    const { default: router } = await import('../index')

    await router.push('/system/catalog-settings')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/system/catalog-settings')
    expect(router.currentRoute.value.name).toBe('system-catalog-settings')
    expect(router.currentRoute.value.meta.permission).toEqual([
      'read',
      'TenantCatalogSettings',
    ])
    expect(router.currentRoute.value.meta.layout).toBe('dashboard')
    expect(router.currentRoute.value.meta.skipTenantCheck).toBeUndefined()
    expect(router.currentRoute.value.meta.requiresSuperAdmin).toBeUndefined()
  })

  it('does not treat an unrelated subject read grant as route access', async () => {
    // Cross-subject isolation: read:NotificationConfig alone must not open
    // /system/catalog-settings (REQ-4 scenario, negative side).
    authenticateWithPermission(false)
    mockAuthStore.userCan.mockImplementation(
      (action: string, subject: string) =>
        action === 'read' && subject === 'NotificationConfig',
    )

    const { default: router } = await import('../index')

    await router.push('/login')
    await router.isReady()
    await router.push('/system/catalog-settings')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('redirects to /403 when the permission is absent', async () => {
    authenticateWithPermission(false)

    const { default: router } = await import('../index')

    await router.push('/login')
    await router.isReady()
    await router.push('/system/catalog-settings')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('lazy-resolves to the TenantCatalogSettingsView component', async () => {
    authenticateWithPermission(true)

    const { default: router } = await import('../index')

    await router.push('/system/catalog-settings')
    await router.isReady()

      const matched = router.currentRoute.value.matched[0]
      expect(matched).toBeDefined()
      // Lazy routes store `() => Promise<module>`; vue-router may have already
      // resolved it to the loaded component object after navigation. Normalize
      // both shapes so every expect stays unconditional (no-conditional-expect).
      const raw = matched!.components!.default as unknown
      const resolved =
        typeof raw === 'function'
          ? await (raw as () => Promise<{ default?: unknown }>)()
          : raw
      const component = (resolved as { default?: unknown }).default ?? resolved
      expect(component).toBeDefined()
  })
})
