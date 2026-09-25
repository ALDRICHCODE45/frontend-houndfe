// router.humanDecisions.spec.ts — STRICT-TDD tests for the HD3A POS inbox shell.
//
// Route contract (ODD human-decisions-restock-inbox HD3A):
//   path: /pos/decisiones-pendientes
//   name: pos-human-decisions
//   meta.layout: 'dashboard'
//   meta.permission: ['read', 'HumanDecision']
//   NO public, NO skipTenantCheck, NO requiresSuperAdmin.

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

function authenticate(userCan: (action: string, subject: string) => boolean) {
  mockAuthStore.accessToken = 'access-token'
  mockAuthStore.user = { id: 'user-1' }
  mockAuthStore.isAuthenticated = true
  mockAuthStore.permissionsLoaded = true
  mockAuthStore.authPhase = 'authenticated'
  mockAuthStore.currentTenant = { id: 'tenant-1', name: 'Centro', slug: 'centro' }
  mockAuthStore.userCan.mockImplementation(userCan)
}

const readHumanDecision = (action: string, subject: string) =>
  action === 'read' && subject === 'HumanDecision'

describe('router — /pos/decisiones-pendientes (HD3A)', () => {
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

  it('resolves exact route, dashboard layout and read:HumanDecision with no extra gates', async () => {
    authenticate(readHumanDecision)
    const { default: router } = await import('../index')

    await router.push('/pos/decisiones-pendientes')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/pos/decisiones-pendientes')
    expect(router.currentRoute.value.name).toBe('pos-human-decisions')
    expect(router.currentRoute.value.meta.layout).toBe('dashboard')
    expect(router.currentRoute.value.meta.permission).toEqual(['read', 'HumanDecision'])
    expect(router.currentRoute.value.meta.public).toBeUndefined()
    expect(router.currentRoute.value.meta.skipTenantCheck).toBeUndefined()
    expect(router.currentRoute.value.meta.requiresSuperAdmin).toBeUndefined()
  })

  it('lazy-resolves to HumanDecisionsView', async () => {
    authenticate(readHumanDecision)
    const { default: router } = await import('../index')

    await router.push('/pos/decisiones-pendientes')
    await router.isReady()

    const raw = router.currentRoute.value.matched[0]!.components!.default as unknown
    const resolved = typeof raw === 'function' ? await (raw as () => Promise<unknown>)() : raw
    const component = (resolved as { default?: unknown }).default ?? resolved
    const expected = (await import('@/features/POS/human-decisions/views/HumanDecisionsView.vue'))
      .default
    expect(component).toBe(expected)
  })

  it('redirects to /403 when read:HumanDecision is absent', async () => {
    authenticate(() => false)
    const { default: router } = await import('../index')

    await router.push('/login')
    await router.isReady()
    await router.push('/pos/decisiones-pendientes')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('does not grant read access from update:HumanDecision alone', async () => {
    authenticate((action, subject) => action === 'update' && subject === 'HumanDecision')
    const { default: router } = await import('../index')

    await router.push('/login')
    await router.isReady()
    await router.push('/pos/decisiones-pendientes')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })
})
