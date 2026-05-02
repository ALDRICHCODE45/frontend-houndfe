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
  userCan: vi.fn().mockReturnValue(true),
}

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => mockAuthStore,
}))

vi.mock('@/features/auth/tenant-selection/views/TenantSelectionView.vue', () => ({
  default: { name: 'TenantSelectionView' },
}))

describe('router tenant guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.accessToken = null
    mockAuthStore.user = null
    mockAuthStore.isAuthenticated = false
    mockAuthStore.permissionsLoaded = false
    mockAuthStore.authPhase = 'idle'
    mockAuthStore.currentTenant = null
    mockAuthStore.isSuperAdmin = false
  })

  it('redirects authenticated users in needs-tenant-selection phase to /select-tenant', async () => {
    mockAuthStore.accessToken = 'access-token'
    mockAuthStore.user = { id: 'user-1' }
    mockAuthStore.isAuthenticated = true
    mockAuthStore.permissionsLoaded = true
    mockAuthStore.authPhase = 'needs-tenant-selection'

    const { default: router } = await import('../index')

    await router.push('/pos/orders')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/select-tenant')
  })

  it('redirects authenticated super-admin without tenant to /select-tenant on tenant-scoped routes', async () => {
    mockAuthStore.accessToken = 'access-token'
    mockAuthStore.user = { id: 'user-1' }
    mockAuthStore.isAuthenticated = true
    mockAuthStore.permissionsLoaded = true
    mockAuthStore.authPhase = 'authenticated'
    mockAuthStore.currentTenant = null
    mockAuthStore.isSuperAdmin = true

    const { default: router } = await import('../index')

    await router.push('/pos/orders')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/select-tenant')
  })

  it('keeps /select-tenant accessible for authenticated super-admin without tenant', async () => {
    mockAuthStore.accessToken = 'access-token'
    mockAuthStore.user = { id: 'user-1' }
    mockAuthStore.isAuthenticated = true
    mockAuthStore.permissionsLoaded = true
    mockAuthStore.authPhase = 'authenticated'
    mockAuthStore.currentTenant = null
    mockAuthStore.isSuperAdmin = true

    const { default: router } = await import('../index')

    await router.push('/select-tenant')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/select-tenant')
  })

  it('keeps public routes unaffected', async () => {
    const { default: router } = await import('../index')

    await router.push('/login')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('redirects unauthenticated users from /admin/tenants to login', async () => {
    const { default: router } = await import('../index')

    await router.push('/admin/tenants')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/admin/tenants')
  })

  it('redirects authenticated non-super-admin from /admin/tenants to /403', async () => {
    mockAuthStore.accessToken = 'access-token'
    mockAuthStore.user = { id: 'user-1' }
    mockAuthStore.isAuthenticated = true
    mockAuthStore.permissionsLoaded = true
    mockAuthStore.currentTenant = { id: 'tenant-1', name: 'Sucursal Centro', slug: 'centro' }
    mockAuthStore.isSuperAdmin = false

    const { default: router } = await import('../index')

    await router.push('/admin/tenants')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('allows authenticated super-admin without tenant to access /admin/tenants', async () => {
    mockAuthStore.accessToken = 'access-token'
    mockAuthStore.user = { id: 'user-1' }
    mockAuthStore.isAuthenticated = true
    mockAuthStore.permissionsLoaded = true
    mockAuthStore.authPhase = 'authenticated'
    mockAuthStore.currentTenant = null
    mockAuthStore.isSuperAdmin = true

    const { default: router } = await import('../index')

    await router.push('/admin/tenants')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/admin/tenants')
  })
})
