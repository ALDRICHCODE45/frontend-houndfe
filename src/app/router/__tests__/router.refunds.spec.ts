// router.refunds.spec.ts — «Reembolsos pendientes» route (T19).
//
// Route contract: path /pos/reembolsos, name pos-refunds, dashboard layout,
// permission ['read', 'SaleRefund'] (update alone does not open it).

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuthStore = {
  accessToken: null as string | null,
  user: null as { id: string } | null,
  isAuthenticated: false,
  permissionsLoaded: false,
  authPhase: 'idle' as string,
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

// Shared-route stubs. The guard tests start at /login and land on /403 or the
// not-found route; each of those is a lazy view too, and its cold transform was
// charged to whichever test reached it first (a 5000ms timeout under suite
// load). This spec asserts paths and metadata, never these components.
vi.mock('@/features/auth/login/views/LoginView.vue', () => ({ default: { name: 'LoginView' } }))
vi.mock('@/features/errors/views/ForbiddenView.vue', () => ({ default: { name: 'ForbiddenView' } }))
vi.mock('@/features/errors/views/NotFoundView.vue', () => ({ default: { name: 'NotFoundView' } }))

vi.mock('@/features/POS/refunds/views/PendingRefundsView.vue', () => ({
  default: { name: 'PendingRefundsView' },
}))

function authenticate(userCan: (action: string, subject: string) => boolean) {
  mockAuthStore.accessToken = 'access-token'
  mockAuthStore.user = { id: 'user-1' }
  mockAuthStore.isAuthenticated = true
  mockAuthStore.permissionsLoaded = true
  mockAuthStore.authPhase = 'authenticated'
  mockAuthStore.currentTenant = { id: 'tenant-1', name: 'Centro', slug: 'centro' }
  mockAuthStore.userCan.mockImplementation(userCan)
}

describe('router — /pos/reembolsos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockAuthStore.accessToken = null
    mockAuthStore.user = null
    mockAuthStore.isAuthenticated = false
    mockAuthStore.permissionsLoaded = false
    mockAuthStore.authPhase = 'idle'
    mockAuthStore.currentTenant = null
    mockAuthStore.userCan.mockReturnValue(false)
  })

  it('resolves the page in the dashboard layout, guarded by read:SaleRefund', async () => {
    authenticate((action, subject) => action === 'read' && subject === 'SaleRefund')
    const { default: router } = await import('../index')

    await router.push('/pos/reembolsos')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('pos-refunds')
    expect(router.currentRoute.value.meta.layout).toBe('dashboard')
    expect(router.currentRoute.value.meta.permission).toEqual(['read', 'SaleRefund'])
    const raw = router.currentRoute.value.matched[0]!.components!.default as unknown
    const resolved = typeof raw === 'function' ? await (raw as () => Promise<unknown>)() : raw
    const component = (resolved as { default?: unknown }).default ?? resolved
    expect(component).toBe((await import('@/features/POS/refunds/views/PendingRefundsView.vue')).default)
  })

  it('sends a user without read:SaleRefund to /403, even with update', async () => {
    authenticate((action, subject) => action === 'update' && subject === 'SaleRefund')
    const { default: router } = await import('../index')

    await router.push('/login')
    await router.isReady()
    await router.push('/pos/reembolsos')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })
})
