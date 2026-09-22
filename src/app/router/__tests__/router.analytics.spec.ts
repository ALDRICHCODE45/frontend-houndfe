// router.analytics.spec.ts — STRICT-TDD tests for the branch sales summary
// route (ODD branch-sales-summary A3d).
//
// Mirrors router.catalogBackoffice.spec.ts: mock the auth store at the
// boundary, import the router, push to the route, assert meta + redirects.
//
// The route:
//   path: /analytics/resumen-ventas
//   name: analytics-sales-summary
//   meta.layout: 'dashboard'
//   meta.permission: ['read', 'Analytics']
//   NO skipTenantCheck, NO requiresSuperAdmin, NO public.

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

const ANALYTICS_PATH = '/analytics/resumen-ventas'
const ANALYTICS_NAME = 'analytics-sales-summary'

/** Authenticate with an authenticated, tenant-scoped session. */
function authenticate() {
  mockAuthStore.accessToken = 'access-token'
  mockAuthStore.user = { id: 'user-1' }
  mockAuthStore.isAuthenticated = true
  mockAuthStore.permissionsLoaded = true
  mockAuthStore.authPhase = 'authenticated'
  mockAuthStore.currentTenant = { id: 'tenant-1', name: 'Centro', slug: 'centro' }
}

/** Grant exactly `read:Analytics`; no other subject. */
function grantAnalyticsRead() {
  mockAuthStore.userCan.mockImplementation(
    (action: string, subject: string) => action === 'read' && subject === 'Analytics',
  )
}

describe('router — /analytics/resumen-ventas (ODD branch-sales-summary A3d)', () => {
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

  it('resolves the exact path, name and meta when read:Analytics is granted', async () => {
    authenticate()
    grantAnalyticsRead()

    const { default: router } = await import('../index')

    await router.push(ANALYTICS_PATH)
    await router.isReady()

    expect(router.currentRoute.value.path).toBe(ANALYTICS_PATH)
    expect(router.currentRoute.value.name).toBe(ANALYTICS_NAME)
    expect(router.currentRoute.value.meta.layout).toBe('dashboard')
    expect(router.currentRoute.value.meta.permission).toEqual(['read', 'Analytics'])
  })

  it('does not gate the route behind super-admin or tenant skip', async () => {
    authenticate()
    grantAnalyticsRead()

    const { default: router } = await import('../index')

    await router.push(ANALYTICS_PATH)
    await router.isReady()

    expect(router.currentRoute.value.meta.requiresSuperAdmin).toBeUndefined()
    expect(router.currentRoute.value.meta.skipTenantCheck).toBeUndefined()
    expect(router.currentRoute.value.meta.public).toBeUndefined()
  })

  it('lazy-resolves to the committed BranchSalesSummaryView', async () => {
    authenticate()
    grantAnalyticsRead()

    const { default: router } = await import('../index')

    await router.push(ANALYTICS_PATH)
    await router.isReady()

    const matched = router.currentRoute.value.matched[0]
    expect(matched).toBeDefined()

    // Lazy routes store `() => Promise<module>`; vue-router may already have
    // resolved it to the loaded component object after navigation. Normalize
    // both shapes so the expect stays unconditional (no-conditional-expect).
    const raw = matched!.components!.default as unknown
    const resolved =
      typeof raw === 'function' ? await (raw as () => Promise<{ default?: unknown }>)() : raw
    const component = (resolved as { default?: unknown }).default ?? resolved

    const expected = (await import('@/features/analytics/views/BranchSalesSummaryView.vue')).default
    expect(component).toBe(expected)
  })

  it('redirects to /403 when read:Analytics is absent', async () => {
    authenticate()
    mockAuthStore.userCan.mockReturnValue(false)

    const { default: router } = await import('../index')

    // Reach a permitted route first so the guard re-evaluates on the push.
    await router.push('/login')
    await router.isReady()
    await router.push(ANALYTICS_PATH)
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('does not treat an unrelated read grant as route access', async () => {
    authenticate()
    mockAuthStore.userCan.mockImplementation(
      (action: string, subject: string) => action === 'read' && subject === 'NotificationConfig',
    )

    const { default: router } = await import('../index')

    await router.push('/login')
    await router.isReady()
    await router.push(ANALYTICS_PATH)
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })
})
