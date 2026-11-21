// router.backorders.spec.ts — «Pedidos por reposición» routes (ODD restock-backorder T1, S2).
//
// Contract: /pos/pedidos-reposicion (list, pos-backorders) and /:id (detail, pos-backorder-detail),
// dashboard layout, both guarded by read:Backorder (update alone does not open them).

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

vi.mock('@/features/auth/login/views/LoginView.vue', () => ({ default: { name: 'LoginView' } }))
vi.mock('@/features/errors/views/ForbiddenView.vue', () => ({ default: { name: 'ForbiddenView' } }))
vi.mock('@/features/errors/views/NotFoundView.vue', () => ({ default: { name: 'NotFoundView' } }))
vi.mock('@/features/POS/backorders/views/BackordersListView.vue', () => ({
  default: { name: 'BackordersListView' },
}))
vi.mock('@/features/POS/backorders/views/BackorderDetailView.vue', () => ({
  default: { name: 'BackorderDetailView' },
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

const canReadBackorder = (action: string, subject: string) => action === 'read' && subject === 'Backorder'

async function resolvedComponent(router: Awaited<typeof import('../index')>['default']) {
  const raw = router.currentRoute.value.matched[0]!.components!.default as unknown
  const resolved = typeof raw === 'function' ? await (raw as () => Promise<unknown>)() : raw
  return (resolved as { default?: unknown }).default ?? resolved
}

describe('router — /pos/pedidos-reposicion', () => {
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

  it('resolves the list in the dashboard layout, guarded by read:Backorder', async () => {
    authenticate(canReadBackorder)
    const { default: router } = await import('../index')

    await router.push('/pos/pedidos-reposicion')
    await router.isReady()

    const route = router.currentRoute.value
    expect(route.name).toBe('pos-backorders')
    expect(route.meta.layout).toBe('dashboard')
    expect(route.meta.permission).toEqual(['read', 'Backorder'])
    expect(await resolvedComponent(router)).toBe(
      (await import('@/features/POS/backorders/views/BackordersListView.vue')).default,
    )
  })

  it('resolves the detail with its id, guarded by read:Backorder', async () => {
    authenticate(canReadBackorder)
    const { default: router } = await import('../index')

    await router.push('/pos/pedidos-reposicion/3f6c1c52')
    await router.isReady()

    const route = router.currentRoute.value
    expect(route.name).toBe('pos-backorder-detail')
    expect(route.params.id).toBe('3f6c1c52')
    expect(route.meta.permission).toEqual(['read', 'Backorder'])
    expect(await resolvedComponent(router)).toBe(
      (await import('@/features/POS/backorders/views/BackorderDetailView.vue')).default,
    )
  })

  it.each(['/pos/pedidos-reposicion', '/pos/pedidos-reposicion/3f6c1c52'])(
    'sends a user without read:Backorder to /403 at %s, even with update',
    async (path) => {
      authenticate((action, subject) => action === 'update' && subject === 'Backorder')
      const { default: router } = await import('../index')

      await router.push('/login')
      await router.isReady()
      await router.push(path)
      await router.isReady()

      expect(router.currentRoute.value.path).toBe('/403')
    },
  )

  it('the list is a landing candidate, the detail is not', async () => {
    authenticate(canReadBackorder)
    const { default: router } = await import('../index')
    expect(router.resolve('/pos/pedidos-reposicion').meta.rememberAsLanding).toBe(true)
    expect(router.resolve('/pos/pedidos-reposicion/x').meta.rememberAsLanding).toBeUndefined()
  })
})
