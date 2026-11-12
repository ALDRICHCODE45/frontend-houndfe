// router.chatbotRequests.spec.ts — routes of the chatbot request inbox (T2.U1).
//
//   /chatbot/solicitudes      name chatbot-requests        read:ChatbotRequest, remembered as landing
//   /chatbot/solicitudes/:id  name chatbot-request-detail  read:ChatbotRequest (email deep link)
//   /pos/decisiones-pendientes keeps working (read:HumanDecision) without a nav entry.

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

// Shared-route and route-view stubs (same isolation as router.humanDecisions.spec.ts): this spec pins
// the route records, their metadata and the REAL global guard, not the UI.
vi.mock('@/features/auth/login/views/LoginView.vue', () => ({ default: { name: 'LoginView' } }))
vi.mock('@/features/errors/views/ForbiddenView.vue', () => ({ default: { name: 'ForbiddenView' } }))
vi.mock('@/features/errors/views/NotFoundView.vue', () => ({ default: { name: 'NotFoundView' } }))
vi.mock('@/features/chatbot/requests/views/ChatbotRequestsView.vue', () => ({
  default: { name: 'ChatbotRequestsView' },
}))
vi.mock('@/features/chatbot/requests/views/ChatbotRequestDetailView.vue', () => ({
  default: { name: 'ChatbotRequestDetailView' },
}))
vi.mock('@/features/POS/human-decisions/views/HumanDecisionsView.vue', () => ({
  default: { name: 'HumanDecisionsView' },
}))
vi.mock('@/features/POS/human-decisions/views/HumanDecisionsOfflineDemoRouteView.vue', () => ({
  default: { name: 'HumanDecisionsOfflineDemoRouteView' },
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

const readChatbotRequest = (action: string, subject: string) =>
  action === 'read' && subject === 'ChatbotRequest'

async function lazyComponentOf(router: { currentRoute: { value: { matched: Array<{ components?: Record<string, unknown> | null }> } } }) {
  const raw = router.currentRoute.value.matched[0]!.components!.default as unknown
  const resolved = typeof raw === 'function' ? await (raw as () => Promise<unknown>)() : raw
  return (resolved as { default?: unknown }).default ?? resolved
}

describe('router — chatbot request inbox (T2.U1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.resetModules()
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

  it('/chatbot/solicitudes: name, dashboard layout, read:ChatbotRequest and landing opt-in', async () => {
    authenticate(readChatbotRequest)
    const { default: router } = await import('../index')

    await router.push('/chatbot/solicitudes')
    await router.isReady()

    const route = router.currentRoute.value
    expect(route.path).toBe('/chatbot/solicitudes')
    expect(route.name).toBe('chatbot-requests')
    expect(route.meta.layout).toBe('dashboard')
    expect(route.meta.permission).toEqual(['read', 'ChatbotRequest'])
    expect(route.meta.rememberAsLanding).toBe(true)
    expect(route.meta.public).toBeUndefined()
    expect(route.meta.skipTenantCheck).toBeUndefined()
    expect(route.meta.requiresSuperAdmin).toBeUndefined()
  })

  it('/chatbot/solicitudes/:id: name, params and the same permission, not a landing candidate', async () => {
    authenticate(readChatbotRequest)
    const { default: router } = await import('../index')

    await router.push('/chatbot/solicitudes/2b7c1a90-6f3e-4d2a-8b1c-0d9e8f7a6b5c')
    await router.isReady()

    const route = router.currentRoute.value
    expect(route.name).toBe('chatbot-request-detail')
    expect(route.params.id).toBe('2b7c1a90-6f3e-4d2a-8b1c-0d9e8f7a6b5c')
    expect(route.meta.layout).toBe('dashboard')
    expect(route.meta.permission).toEqual(['read', 'ChatbotRequest'])
    expect(route.meta.rememberAsLanding).toBeUndefined()
  })

  it('lazy-resolves the list and the detail to their views', async () => {
    authenticate(readChatbotRequest)
    const { default: router } = await import('../index')

    await router.push('/chatbot/solicitudes')
    await router.isReady()
    expect(await lazyComponentOf(router)).toBe(
      (await import('@/features/chatbot/requests/views/ChatbotRequestsView.vue')).default,
    )

    await router.push('/chatbot/solicitudes/req-1')
    expect(await lazyComponentOf(router)).toBe(
      (await import('@/features/chatbot/requests/views/ChatbotRequestDetailView.vue')).default,
    )
  })

  it.each(['/chatbot/solicitudes', '/chatbot/solicitudes/req-1'])(
    'redirects %s to /403 without read:ChatbotRequest',
    async (path) => {
      authenticate(() => false)
      const { default: router } = await import('../index')

      await router.push('/login')
      await router.isReady()
      await router.push(path)
      await router.isReady()

      expect(router.currentRoute.value.path).toBe('/403')
    },
  )

  it('update:ChatbotRequest or read:HumanDecision alone do not grant the new routes', async () => {
    authenticate(
      (action, subject) =>
        (action === 'update' && subject === 'ChatbotRequest') ||
        (action === 'read' && subject === 'HumanDecision'),
    )
    const { default: router } = await import('../index')

    await router.push('/login')
    await router.isReady()
    await router.push('/chatbot/solicitudes')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('the old /pos/decisiones-pendientes route still resolves for read:HumanDecision (no nav entry, BE backfill pending)', async () => {
    authenticate((action, subject) => action === 'read' && subject === 'HumanDecision')
    const { default: router } = await import('../index')

    await router.push('/pos/decisiones-pendientes')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/pos/decisiones-pendientes')
    expect(router.currentRoute.value.name).toBe('pos-human-decisions')
    expect(router.currentRoute.value.meta.permission).toEqual(['read', 'HumanDecision'])
  })

  it('the old route is not opened by read:ChatbotRequest alone', async () => {
    authenticate(readChatbotRequest)
    const { default: router } = await import('../index')

    await router.push('/login')
    await router.isReady()
    await router.push('/pos/decisiones-pendientes')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })
})
