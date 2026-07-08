// router.notifications.spec.ts — STRICT-TDD test for the new
// /sistema/configuracion/notificaciones route.
//
// Mirrors the router.promotions / router.sales pattern: mock the auth
// store at the boundary, import the router, push to the route, and
// assert meta + redirects.
//
// The route:
//   path: /sistema/configuracion/notificaciones
//   name: sistema-notification-config
//   meta.permission: ['read', 'NotificationConfig']
//   meta.layout: 'dashboard'

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
  hydrateFromStorage: vi.fn(),
  fetchMe: vi.fn(),
  fetchPermissions: vi.fn(),
  clearSession: vi.fn(),
  userCan: vi.fn().mockImplementation(
    (action: string, subject: string) =>
      action === 'read' && subject === 'NotificationConfig',
  ),
}

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => mockAuthStore,
}))

describe('router — /sistema/configuracion/notificaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.accessToken = null
    mockAuthStore.user = null
    mockAuthStore.isAuthenticated = false
    mockAuthStore.permissionsLoaded = false
    mockAuthStore.authPhase = 'idle'
    mockAuthStore.currentTenant = null
    mockAuthStore.isSuperAdmin = false
    // Default — overridden per-test.
    mockAuthStore.userCan.mockReturnValue(true)
  })

  it('resolves the route when the user has read:NotificationConfig perm', async () => {
    mockAuthStore.accessToken = 'access-token'
    mockAuthStore.user = { id: 'user-1' }
    mockAuthStore.isAuthenticated = true
    mockAuthStore.permissionsLoaded = true
    mockAuthStore.authPhase = 'authenticated'
    mockAuthStore.currentTenant = { id: 'tenant-1', name: 'Centro', slug: 'centro' }
    mockAuthStore.userCan.mockImplementation(
      (action: string, subject: string) =>
        action === 'read' && subject === 'NotificationConfig',
    )

    const { default: router } = await import('../index')

    await router.push('/sistema/configuracion/notificaciones')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe(
      '/sistema/configuracion/notificaciones',
    )
    expect(router.currentRoute.value.name).toBe('sistema-notification-config')
    expect(router.currentRoute.value.meta.permission).toEqual([
      'read',
      'NotificationConfig',
    ])
    expect(router.currentRoute.value.meta.layout).toBe('dashboard')
  })

  it('redirects to /403 when the user lacks read:NotificationConfig', async () => {
    mockAuthStore.accessToken = 'access-token'
    mockAuthStore.user = { id: 'user-1' }
    mockAuthStore.isAuthenticated = true
    mockAuthStore.permissionsLoaded = true
    mockAuthStore.authPhase = 'authenticated'
    mockAuthStore.currentTenant = { id: 'tenant-1', name: 'Centro', slug: 'centro' }
    mockAuthStore.userCan.mockReturnValue(false)

    const { default: router } = await import('../index')

    // First navigate to a permitted route so the router is in a known
    // state, then push to the guarded route — this guarantees a fresh
    // beforeEach guard evaluation.
    await router.push('/login')
    await router.isReady()
    await router.push('/sistema/configuracion/notificaciones')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })
})