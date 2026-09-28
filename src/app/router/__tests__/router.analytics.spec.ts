// router.analytics.spec.ts — STRICT-TDD tests for the sole Dashboard route at
// /dashboard (ODD dashboard-analytics D1).
//
// Mirrors router.catalogBackoffice.spec.ts: mock the auth store at the
// boundary, import the router, push to the route, assert meta + redirects +
// not-found fall-throughs, and (for the lazy-resolver case) actually invoke
// the lazy component loader and assert the resolved module/default is the
// BranchSalesSummaryView component.
//
// Drift this suite must fail on: wrong path/name/layout/permission, a return
// of /analytics/resumen-ventas, a super-admin gate, a public flag, a /dashboard
// open redirect for a denied user, or a substitution of the route component
// with anything other than the BranchSalesSummaryView module. The root path "/"
// is no longer a 404: ODD root-last-route makes it the explicit resolver-only
// `root` route, covered below.

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

const DASHBOARD_PATH = '/dashboard'
const DASHBOARD_NAME = 'dashboard'

function authenticate() {
  mockAuthStore.accessToken = 'access-token'
  mockAuthStore.user = { id: 'user-1' }
  mockAuthStore.isAuthenticated = true
  mockAuthStore.permissionsLoaded = true
  mockAuthStore.authPhase = 'authenticated'
  mockAuthStore.currentTenant = { id: 'tenant-1', name: 'Centro', slug: 'centro' }
}

function grantAnalyticsRead() {
  mockAuthStore.userCan.mockImplementation(
    (action: string, subject: string) => action === 'read' && subject === 'Analytics',
  )
}

describe('router — /dashboard (ODD dashboard-analytics D1)', () => {
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

  it('resolves exact path, name, layout and permission; no super-admin, skipTenant or public', async () => {
    authenticate()
    grantAnalyticsRead()

    const { default: router } = await import('../index')

    await router.push(DASHBOARD_PATH)
    await router.isReady()

    expect(router.currentRoute.value.path).toBe(DASHBOARD_PATH)
    expect(router.currentRoute.value.name).toBe(DASHBOARD_NAME)
    expect(router.currentRoute.value.meta.layout).toBe('dashboard')
    expect(router.currentRoute.value.meta.permission).toEqual(['read', 'Analytics'])
    expect(router.currentRoute.value.meta.requiresSuperAdmin).toBeUndefined()
    expect(router.currentRoute.value.meta.skipTenantCheck).toBeUndefined()
    expect(router.currentRoute.value.meta.public).toBeUndefined()
  })

  it('lazy loader resolves to the BranchSalesSummaryView component (module identity)', async () => {
    authenticate()
    grantAnalyticsRead()

    const { default: router } = await import('../index')
    await router.push(DASHBOARD_PATH)
    await router.isReady()

    const matched = router.currentRoute.value.matched[0]
    expect(matched).toBeDefined()
    const raw = matched!.components!.default as unknown
    // vue-router may leave the loader function in place or have already
    // resolved it to the loaded module. Handle both shapes unconditionally.
    const resolved = typeof raw === 'function' ? await (raw as () => Promise<unknown>)() : raw
    const component = (resolved as { default?: unknown }).default ?? resolved
    const expected = (await import('@/features/analytics/views/BranchSalesSummaryView.vue')).default
    expect(component).toBe(expected)
  })

  it.each([
    {
      label: 'redirects to /403 when read:Analytics is absent',
      userCan: () => false,
      expected: '/403',
    },
    {
      label: 'does not treat an unrelated read grant as route access',
      userCan: (action: string, subject: string) =>
        action === 'read' && subject === 'NotificationConfig',
      expected: '/403',
    },
  ])('$label', async ({ userCan, expected }) => {
    authenticate()
    mockAuthStore.userCan.mockImplementation(userCan)

    const { default: router } = await import('../index')
    await router.push('/login')
    await router.isReady()
    await router.push(DASHBOARD_PATH)
    await router.isReady()

    expect(router.currentRoute.value.path).toBe(expected)
  })

  it('exposes "/" as the explicit root resolver route, not a 404', async () => {
    const { default: router } = await import('../index')

    expect(router.resolve('/').name).toBe('root')
    expect(router.resolve('/analytics/resumen-ventas').name).toBe('not-found')

    await router.push('/')
    await router.isReady()

    // Unauthenticated root resolves to login without a redirect-to-root query.
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBeUndefined()
  })

  it('"/analytics/resumen-ventas" is not an application route and falls through to NotFoundView', async () => {
    const { default: router } = await import('../index')
    await router.push('/analytics/resumen-ventas')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/analytics/resumen-ventas')
    expect(router.currentRoute.value.name).toBe('not-found')
  })
})
