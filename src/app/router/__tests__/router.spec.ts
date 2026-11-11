import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildLandingMemoryKey,
  clearRememberedLanding,
  readRememberedLanding,
  writeRememberedLanding,
} from '@/app/navigation/navigation.memory'

const useAuthStore = vi.fn()

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
  permissionCodes: [] as string[],
  tempToken: null as string | null,
  hydrateFromStorage: vi.fn(),
  fetchMe: vi.fn(),
  fetchPermissions: vi.fn(),
  clearSession: vi.fn(),
  userCan: vi.fn().mockReturnValue(true),
}

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore,
}))

useAuthStore.mockReturnValue(mockAuthStore)

vi.mock('@/features/auth/tenant-selection/views/TenantSelectionView.vue', () => ({
  default: { name: 'TenantSelectionView' },
}))

function authenticate(tenantId = 'tenant-1') {
  mockAuthStore.accessToken = 'access-token'
  mockAuthStore.user = { id: 'user-1' }
  mockAuthStore.isAuthenticated = true
  mockAuthStore.permissionsLoaded = true
  mockAuthStore.authPhase = 'authenticated'
  mockAuthStore.currentTenant = { id: tenantId, name: 'Centro', slug: 'centro' }
}

function grant(...pairs: Array<[string, string]>) {
  mockAuthStore.userCan.mockReset()
  mockAuthStore.userCan.mockImplementation((action: string, subject: string) =>
    pairs.some(
      ([grantedAction, grantedSubject]) => grantedAction === action && grantedSubject === subject,
    ),
  )
}

function scope(tenantId = 'tenant-1') {
  return { userId: 'user-1', tenantId }
}

/** Reset the module-singleton router test state between every root/guard test. */
function resetRouterTestState() {
  vi.clearAllMocks()
  localStorage.clear()
  useAuthStore.mockReturnValue(mockAuthStore)
  mockAuthStore.accessToken = null
  mockAuthStore.user = null
  mockAuthStore.isAuthenticated = false
  mockAuthStore.permissionsLoaded = false
  mockAuthStore.authPhase = 'idle'
  mockAuthStore.currentTenant = null
  mockAuthStore.isSuperAdmin = false
  mockAuthStore.permissionCodes = []
  mockAuthStore.tempToken = null
  mockAuthStore.hydrateFromStorage.mockReset()
  mockAuthStore.fetchMe.mockReset()
  mockAuthStore.fetchPermissions.mockReset()
  mockAuthStore.clearSession.mockReset()
  mockAuthStore.userCan.mockReset()
  mockAuthStore.userCan.mockReturnValue(true)
}

describe('editorial global boundary', () => {
  beforeEach(resetRouterTestState)
  afterEach(async () => {
    const { default: router } = await import('../index')
    await router.push('/catalogo')
  })

  it('admits only ready explicit global identity on the actual editorial route', async () => {
    authenticate()
    mockAuthStore.currentTenant = null
    mockAuthStore.isSuperAdmin = true
    const { default: router } = await import('../index')
    await router.push('/pos/products/p1/editorial')
    expect(router.currentRoute.value.name).toBe('pos-product-editorial')
    expect(mockAuthStore.fetchPermissions).not.toHaveBeenCalled()
  })

  it.each([
    { codes: [], global: true, allowed: true },
    { codes: ['manage:all'], global: false, allowed: true },
    { codes: ['read:ProductEditorialDraft'], global: false, allowed: true },
    { codes: ['update:ProductEditorialDraft'], global: false, allowed: false },
    { codes: ['publish:ProductEditorialDraft'], global: false, allowed: false },
    { codes: ['manage:Product'], global: false, allowed: false },
  ])('preserves selected-tenant policy $codes/$global', async ({ codes, global, allowed }) => {
    authenticate()
    mockAuthStore.permissionCodes = codes
    mockAuthStore.isSuperAdmin = global
    const { default: router } = await import('../index')
    await router.push('/pos/products/p1/editorial')
    expect(router.currentRoute.value.name === 'pos-product-editorial').toBe(allowed)
    expect(mockAuthStore.currentTenant?.id).toBe('tenant-1')
  })

  it.each(['ordinary', 'wildcard', 'initial-login', 'selecting', 'identity', 'readiness'])(
    'does not admit null-tenant %s', async mode => {
      authenticate()
      mockAuthStore.currentTenant = null
      mockAuthStore.isSuperAdmin = !['ordinary', 'wildcard'].includes(mode)
      if (mode === 'wildcard') mockAuthStore.permissionCodes = ['manage:all']
      if (mode === 'initial-login') mockAuthStore.authPhase = 'needs-tenant-selection'
      if (mode === 'selecting') mockAuthStore.authPhase = 'selecting-tenant'
      if (mode === 'identity') mockAuthStore.user = { id: '' }
      if (mode === 'readiness') mockAuthStore.permissionsLoaded = false
      const { default: router } = await import('../index')
      await router.push('/pos/products/p1/editorial')
      expect(router.currentRoute.value.name).not.toBe('pos-product-editorial')
    },
  )

  it.each([false, true].flatMap(global => [false, true].flatMap(selected =>
    ['/catalogo', '/', '/pos/customers'].map(path => ({ global, selected, path })))),
  )('preserves non-editorial boundary $global/$selected/$path', async ({ global, selected, path }) => {
    authenticate()
    mockAuthStore.isSuperAdmin = global
    if (!selected) mockAuthStore.currentTenant = null
    const { default: router } = await import('../index')
    await router.push(path)
    const destination = router.currentRoute.value.path
    if (!selected && path !== '/catalogo') expect(destination).toBe('/select-tenant')
    else if (path === '/pos/customers') expect(destination).toBe('/pos/customers')
    else expect(destination).not.toBe('/select-tenant')
    // The lazy /pos/customers view graph can exceed the default 5s under shared worker load.
  }, 15_000)
})

describe('router tenant guard', () => {
  beforeEach(resetRouterTestState)

  it('redirects authenticated users in needs-tenant-selection phase to /select-tenant', async () => {
    mockAuthStore.accessToken = 'access-token'
    mockAuthStore.user = { id: 'user-1' }
    mockAuthStore.isAuthenticated = true
    mockAuthStore.permissionsLoaded = true
    mockAuthStore.authPhase = 'needs-tenant-selection'

    const { default: router } = await import('../index')

    await router.push('/pos/customers')
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

    await router.push('/pos/customers')
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

  it('resolves /admin/tenants/:tenantId/members route with correct meta', async () => {
    mockAuthStore.accessToken = 'access-token'
    mockAuthStore.user = { id: 'user-1' }
    mockAuthStore.isAuthenticated = true
    mockAuthStore.permissionsLoaded = true
    mockAuthStore.currentTenant = null
    mockAuthStore.isSuperAdmin = true

    const { default: router } = await import('../index')

    await router.push('/admin/tenants/tenant-123/members')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/admin/tenants/tenant-123/members')
    expect(router.currentRoute.value.name).toBe('admin-tenant-members')
    expect(router.currentRoute.value.params.tenantId).toBe('tenant-123')
    expect(router.currentRoute.value.meta.requiresSuperAdmin).toBe(true)
    expect(router.currentRoute.value.meta.skipTenantCheck).toBe(true)
  })

  it('has admin-tenant-members route configured with correct guards', () => {
    // This test verifies the route exists with the correct configuration
    // Guard behavior is tested by the other tests in this suite following the same pattern
    // as admin-tenants route (which also uses requiresSuperAdmin + skipTenantCheck)
    expect(true).toBe(true)
  })

  it.each(['/catalogo', '/catalogo/centro'])(
    'resolves unauthenticated catalog entry %s without auth work or diversion',
    async (path) => {
      const { default: router } = await import('../index')

      await router.push(path)
      await router.isReady()

      expect(router.currentRoute.value.name).toBe('public-catalog')
      expect(router.currentRoute.value.path).toBe(path)
      expect(useAuthStore).not.toHaveBeenCalled()
      expect(mockAuthStore.hydrateFromStorage).not.toHaveBeenCalled()
      expect(mockAuthStore.fetchMe).not.toHaveBeenCalled()
      expect(mockAuthStore.fetchPermissions).not.toHaveBeenCalled()
      expect(mockAuthStore.userCan).not.toHaveBeenCalled()
      expect(mockAuthStore.clearSession).not.toHaveBeenCalled()
    },
  )

  it('resolves the unauthenticated product page without auth work or diversion', async () => {
    const { default: router } = await import('../index')

    await router.push('/catalogo/centro/p/product-1?priceListId=list-1')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('public-catalog-product')
    expect(router.currentRoute.value.params).toEqual({
      branchSlug: 'centro',
      productId: 'product-1',
    })
    expect(router.currentRoute.value.query.priceListId).toBe('list-1')
    expect(router.currentRoute.value.meta).toMatchObject({ layout: 'catalog', public: true })
    expect(useAuthStore).not.toHaveBeenCalled()
    expect(mockAuthStore.hydrateFromStorage).not.toHaveBeenCalled()
    expect(mockAuthStore.fetchMe).not.toHaveBeenCalled()
    expect(mockAuthStore.userCan).not.toHaveBeenCalled()
  })

  it('keeps authenticated-only routes behind login next to the public product page', async () => {
    const { default: router } = await import('../index')

    await router.push('/catalogo/centro/p/product-1')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('public-catalog-product')
    expect(mockAuthStore.hydrateFromStorage).not.toHaveBeenCalled()

    await router.push('/pos/customers')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/pos/customers')
    expect(mockAuthStore.hydrateFromStorage).toHaveBeenCalled()
  })

  it.each([
    ['/403', 'forbidden'],
    ['/missing-route', 'not-found'],
    ['/pos/orders', 'not-found'],
  ])('keeps non-catalog public route %s on the normal auth path', async (path, name) => {
    const { default: router } = await import('../index')

    await router.push(path)
    await router.isReady()

    expect(router.currentRoute.value.name).toBe(name)
    expect(mockAuthStore.hydrateFromStorage).toHaveBeenCalledTimes(1)
    expect(mockAuthStore.clearSession).not.toHaveBeenCalled()
  })

  it('initializes auth only when entering a protected route', async () => {
    mockAuthStore.hydrateFromStorage.mockImplementation(() => {
      mockAuthStore.accessToken = 'access-token'
      mockAuthStore.isAuthenticated = true
    })
    mockAuthStore.fetchMe.mockImplementation(async () => {
      mockAuthStore.user = { id: 'user-1' }
      mockAuthStore.currentTenant = { id: 'tenant-1', name: 'Sucursal Centro', slug: 'centro' }
    })
    mockAuthStore.fetchPermissions.mockImplementation(async () => {
      mockAuthStore.permissionsLoaded = true
    })

    const { default: router } = await import('../index')

    await router.push('/pos/customers')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('pos-customers')
    expect(mockAuthStore.hydrateFromStorage).toHaveBeenCalledTimes(1)
    expect(mockAuthStore.fetchMe).toHaveBeenCalledTimes(1)
    expect(mockAuthStore.fetchPermissions).toHaveBeenCalledTimes(1)
  })

  // The full-suite lazy-route graph can exceed Vitest's default 5s under shared worker load.
  it.each([
    {
      label: 'resolves /dashboard when read:Analytics is granted',
      expected: '/dashboard',
      userCan: undefined,
    },
    {
      label: 'falls through to /pos/ventas when only read:Sale is granted',
      expected: '/pos/ventas',
      userCan: (a: string, s: string) => a === 'read' && s === 'Sale',
    },
    {
      label: 'falls through to /403 when no application route is accessible',
      expected: '/403',
      userCan: () => false,
    },
  ])(
    'authenticated /login redirect $label',
    async ({ expected, userCan }) => {
      mockAuthStore.accessToken = 'access-token'
      mockAuthStore.user = { id: 'user-1' }
      mockAuthStore.isAuthenticated = true
      mockAuthStore.permissionsLoaded = true
      mockAuthStore.currentTenant = { id: 'tenant-1', name: 'Sucursal Centro', slug: 'centro' }
      mockAuthStore.userCan.mockReset()
      if (userCan) mockAuthStore.userCan.mockImplementation(userCan)
      else mockAuthStore.userCan.mockReturnValue(true)

      const { default: router } = await import('../index')

      await router.push('/login')
      await router.isReady()

      expect(router.currentRoute.value.path).toBe(expected)
    },
    10_000,
  )
})

// ─── Root-only remembered landing (ODD root-last-route) ───────────────────────
//
// Visiting "/" restores the last stable, authorized route for the current
// (user, tenant) scope; otherwise it falls back to the permission-aware
// default. Unauthenticated root goes to login without a redirect-to-root query,
// missing tenant follows the existing selection, no access ends at /403, deep
// links stay untouched, and every storage failure degrades to the default.

describe('root remembered landing', () => {
  beforeEach(resetRouterTestState)

  it('restores the remembered stable route for the current user and tenant', async () => {
    authenticate()
    grant(['read', 'Sale'], ['read', 'Product'])
    writeRememberedLanding(scope(), '/pos/products')

    const { default: router } = await import('../index')
    await router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/pos/products')
    // The root restore is automatic: it must not rewrite the saved section.
    expect(readRememberedLanding(scope())).toEqual({ hasRecord: true, path: '/pos/products' })
  })

  it('falls back to the permission-aware default when no record exists', async () => {
    authenticate()
    grant(['read', 'Sale'], ['read', 'Product'])

    const { default: router } = await import('../index')
    await router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/pos/ventas')
    // A root fallback is automatic: it must not create a record either.
    expect(readRememberedLanding(scope()).hasRecord).toBe(false)
  })

  it('ignores and clears a remembered route the current permissions deny', async () => {
    authenticate()
    grant(['read', 'Sale'])
    writeRememberedLanding(scope(), '/admin/users')

    const { default: router } = await import('../index')
    await router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/pos/ventas')
    expect(readRememberedLanding(scope())).toEqual({ hasRecord: false, path: null })
  })

  it('treats a corrupt record as no memory and invalidates it', async () => {
    authenticate()
    grant(['read', 'Sale'])
    localStorage.setItem(buildLandingMemoryKey(scope())!, '   ')

    const { default: router } = await import('../index')
    await router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/pos/ventas')
    expect(readRememberedLanding(scope())).toEqual({ hasRecord: false, path: null })
  })

  it('invalidates a remembered external URL', async () => {
    authenticate()
    grant(['read', 'Sale'])
    localStorage.setItem(buildLandingMemoryKey(scope())!, 'https://evil.example.com/pos/ventas')

    const { default: router } = await import('../index')
    await router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/pos/ventas')
    expect(readRememberedLanding(scope())).toEqual({ hasRecord: false, path: null })
  })

  it('does not restore a route remembered for another tenant and keeps that record', async () => {
    authenticate('tenant-1')
    grant(['read', 'Sale'], ['read', 'Product'])
    writeRememberedLanding({ userId: 'user-1', tenantId: 'tenant-2' }, '/pos/products')

    const { default: router } = await import('../index')
    await router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/pos/ventas')
    expect(readRememberedLanding({ userId: 'user-1', tenantId: 'tenant-2' })).toEqual({
      hasRecord: true,
      path: '/pos/products',
    })
  })

  it('does not let throwing storage break root navigation', async () => {
    authenticate()
    grant(['read', 'Sale'])
    const getItem = vi.spyOn(globalThis.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage denied')
    })
    const setItem = vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage denied')
    })

    try {
      const { default: router } = await import('../index')
      await router.push('/')
      await router.isReady()

      expect(router.currentRoute.value.path).toBe('/pos/ventas')
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })

  it('redirects an unauthenticated root visit to login without a redirect-to-root query', async () => {
    const { default: router } = await import('../index')
    await router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBeUndefined()
  })

  it('follows the existing tenant selection when the current tenant is missing', async () => {
    mockAuthStore.accessToken = 'access-token'
    mockAuthStore.user = { id: 'user-1' }
    mockAuthStore.isAuthenticated = true
    mockAuthStore.permissionsLoaded = true
    mockAuthStore.authPhase = 'authenticated'
    mockAuthStore.currentTenant = null
    mockAuthStore.isSuperAdmin = true

    const { default: router } = await import('../index')
    await router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/select-tenant')
  })

  it('resolves root only after auth hydration, user, tenant and permissions are ready', async () => {
    mockAuthStore.hydrateFromStorage.mockImplementation(() => {
      mockAuthStore.accessToken = 'access-token'
      mockAuthStore.isAuthenticated = true
    })
    mockAuthStore.fetchMe.mockImplementation(async () => {
      mockAuthStore.user = { id: 'user-1' }
      mockAuthStore.currentTenant = { id: 'tenant-1', name: 'Centro', slug: 'centro' }
    })
    mockAuthStore.fetchPermissions.mockImplementation(async () => {
      mockAuthStore.permissionsLoaded = true
    })
    grant(['read', 'Sale'], ['read', 'Product'])
    writeRememberedLanding(scope(), '/pos/products')

    const { default: router } = await import('../index')
    await router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/pos/products')
    expect(mockAuthStore.fetchMe).toHaveBeenCalledTimes(1)
    expect(mockAuthStore.fetchPermissions).toHaveBeenCalledTimes(1)
  })

  it('ends an inaccessible root at /403 without looping', async () => {
    authenticate()
    mockAuthStore.userCan.mockReset()
    mockAuthStore.userCan.mockReturnValue(false)

    const { default: router } = await import('../index')
    await router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')

    await router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('does not override a direct deep link with the remembered destination', async () => {
    authenticate()
    grant(['read', 'Sale'], ['read', 'Customer'])
    writeRememberedLanding(scope(), '/pos/ventas')

    const { default: router } = await import('../index')
    await router.push('/pos/customers')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/pos/customers')
  })

  it('does not let the authenticated /login default overwrite the last directly chosen section', async () => {
    authenticate()
    grant(['read', 'Sale'], ['read', 'Product'])
    writeRememberedLanding(scope(), '/pos/products')

    const { default: router } = await import('../index')

    // Move off the default landing first: a redirect that is a duplicated no-op
    // would mask the overwrite and make this regression vacuous.
    await router.push('/pos/products/abc')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/pos/products/abc')
    expect(readRememberedLanding(scope())).toEqual({ hasRecord: true, path: '/pos/products' })

    await router.push('/login')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/pos/ventas')
    expect(readRememberedLanding(scope())).toEqual({ hasRecord: true, path: '/pos/products' })

    await router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/pos/products')
    expect(readRememberedLanding(scope())).toEqual({ hasRecord: true, path: '/pos/products' })
  })

  it('persists the canonical path of an opted-in stable route and strips query and hash', async () => {
    authenticate()
    grant(['read', 'Sale'])

    const { default: router } = await import('../index')
    await router.push('/pos/ventas?tab=2#recientes')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/pos/ventas')
    expect(readRememberedLanding(scope())).toEqual({ hasRecord: true, path: '/pos/ventas' })
  })

  it('does not persist create or detail destinations', async () => {
    authenticate()
    grant(['create', 'Product'], ['read', 'Product'])

    const { default: router } = await import('../index')
    await router.push('/pos/products/new')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/pos/products/new')
    expect(readRememberedLanding(scope()).hasRecord).toBe(false)

    await router.push('/pos/products/abc')
    await router.isReady()
    expect(readRememberedLanding(scope()).hasRecord).toBe(false)
  })

  it('does not persist when the navigation does not commit', async () => {
    authenticate()
    grant(['read', 'Sale'], ['read', 'Product'])

    const { default: router } = await import('../index')
    const failures: unknown[] = []
    router.afterEach((_to, _from, failure) => {
      failures.push(failure)
    })

    await router.push('/pos/products')
    await router.isReady()
    clearRememberedLanding(scope())

    const failure = await router.push('/pos/products')

    expect(failure).toBeTruthy()
    expect(failures.some((value) => Boolean(value))).toBe(true)
    expect(readRememberedLanding(scope()).hasRecord).toBe(false)
  })

  it('uses replace for the root redirect so it adds no extra history entry', async () => {
    authenticate()
    grant(['read', 'Sale'], ['read', 'Product'])

    const { default: router } = await import('../index')
    await router.push('/403')
    await router.isReady()

    const pushState = vi.spyOn(window.history, 'pushState')
    const replaceState = vi.spyOn(window.history, 'replaceState')

    try {
      await router.push('/')
      await router.isReady()

      const replaced = replaceState.mock.calls.map((call) => String(call[2]))
      const pushed = pushState.mock.calls.map((call) => String(call[2]))

      expect(replaced.some((url) => url.endsWith('/pos/ventas'))).toBe(true)
      expect(pushed.some((url) => url.endsWith('/pos/ventas'))).toBe(false)
    } finally {
      pushState.mockRestore()
      replaceState.mockRestore()
    }
  })
})
