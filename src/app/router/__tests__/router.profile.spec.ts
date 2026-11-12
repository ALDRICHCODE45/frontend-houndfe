// router.profile.spec.ts — /perfil (chatbot-requests-inbox T3.N2, S4).
//
// «Mi perfil» is for every authenticated user: the route carries NO permission
// meta (the preferences belong to the person, handoff 13 §1) and uses the
// dashboard layout. Mirrors the router.notifications pattern: mock the auth
// store at the boundary, import the real router and its real global guard.

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
  tempToken: null as string | null,
  isSuperAdmin: false,
  hydrateFromStorage: vi.fn(),
  fetchMe: vi.fn(),
  fetchPermissions: vi.fn(),
  clearSession: vi.fn(),
  userCan: vi.fn().mockReturnValue(false),
}

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => mockAuthStore,
}))

// Lazy views are stubbed so this spec pins the record, its metadata and the
// REAL guard, not the UI (cold transforms would time out under suite load).
vi.mock('@/features/auth/login/views/LoginView.vue', () => ({ default: { name: 'LoginView' } }))
vi.mock('@/features/errors/views/ForbiddenView.vue', () => ({ default: { name: 'ForbiddenView' } }))
vi.mock('@/features/errors/views/NotFoundView.vue', () => ({ default: { name: 'NotFoundView' } }))
vi.mock('@/features/profile/views/ProfileView.vue', () => ({ default: { name: 'ProfileView' } }))

function signIn({ withPermissions }: { withPermissions: boolean }) {
  mockAuthStore.accessToken = 'access-token'
  mockAuthStore.user = { id: 'user-1' }
  mockAuthStore.isAuthenticated = true
  mockAuthStore.permissionsLoaded = true
  mockAuthStore.authPhase = 'authenticated'
  mockAuthStore.currentTenant = { id: 'tenant-1', name: 'Centro', slug: 'centro' }
  mockAuthStore.userCan.mockReturnValue(withPermissions)
}

describe('router — /perfil', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.accessToken = null
    mockAuthStore.user = null
    mockAuthStore.isAuthenticated = false
    mockAuthStore.permissionsLoaded = false
    mockAuthStore.authPhase = 'idle'
    mockAuthStore.currentTenant = null
    mockAuthStore.tempToken = null
    mockAuthStore.isSuperAdmin = false
    mockAuthStore.userCan.mockReturnValue(false)
  })

  it('resolves for an authenticated user who holds no permission at all', async () => {
    signIn({ withPermissions: false })

    const { default: router } = await import('../index')

    await router.push('/perfil')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/perfil')
    expect(router.currentRoute.value.name).toBe('profile')
    expect(router.currentRoute.value.meta.layout).toBe('dashboard')
  })

  it('carries no permission or super-admin meta', async () => {
    signIn({ withPermissions: false })

    const { default: router } = await import('../index')

    const record = router.getRoutes().find((r) => r.name === 'profile')
    expect(record).toBeDefined()
    expect(record?.path).toBe('/perfil')
    expect(record?.meta.permission).toBeUndefined()
    expect(record?.meta.requiresSuperAdmin).toBeUndefined()
    expect(record?.meta.public).toBeUndefined()
  })

  it('redirects to /login with the redirect query when there is no session', async () => {
    const { default: router } = await import('../index')

    // The router is a module singleton: start elsewhere so the push is a fresh guard run.
    await router.push('/login')
    await router.isReady()
    await router.push('/perfil')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/perfil')
  })

  it('never asks the permission check for the route (no /403 for a permission-less user)', async () => {
    signIn({ withPermissions: false })

    const { default: router } = await import('../index')

    await router.push('/login')
    await router.isReady()
    await router.push('/perfil')

    expect(router.currentRoute.value.name).toBe('profile')
    expect(router.currentRoute.value.path).not.toBe('/403')
  })
})
