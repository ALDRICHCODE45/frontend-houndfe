// router.humanDecisions.spec.ts — the old human-decisions inbox URL is a redirect (backlog-closeout T6, S5).
//
// Owner decision (L3): /pos/decisiones-pendientes redirects to Chatbot → Solicitudes. Every new decision
// is also created as a chatbot request and resolving it there syncs the old decision (L2), so the old
// screen is gone. The old inbox had no query semantics, so any query or hash is dropped. The target keeps
// its own guard: read:ChatbotRequest, never read:HumanDecision.

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

// Shared-route and route-view stubs: this spec pins the route records, their metadata and the REAL
// global guard, not the UI (lazy views otherwise pay a cold transform under suite load).
vi.mock('@/features/auth/login/views/LoginView.vue', () => ({ default: { name: 'LoginView' } }))
vi.mock('@/features/errors/views/ForbiddenView.vue', () => ({ default: { name: 'ForbiddenView' } }))
vi.mock('@/features/errors/views/NotFoundView.vue', () => ({ default: { name: 'NotFoundView' } }))
vi.mock('@/features/chatbot/requests/views/ChatbotRequestsView.vue', () => ({
  default: { name: 'ChatbotRequestsView' },
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

describe('router — /pos/decisiones-pendientes redirects to /chatbot/solicitudes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('lands on the chatbot request inbox, which keeps its read:ChatbotRequest guard', async () => {
    authenticate(readChatbotRequest)
    const { default: router } = await import('../index')

    await router.push('/pos/decisiones-pendientes')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/chatbot/solicitudes')
    expect(router.currentRoute.value.name).toBe('chatbot-requests')
    expect(router.currentRoute.value.meta.permission).toEqual(['read', 'ChatbotRequest'])
    expect(router.currentRoute.value.redirectedFrom?.path).toBe('/pos/decisiones-pendientes')
  })

  it('drops the old query and hash (the old inbox had none that map to the new list)', async () => {
    authenticate(readChatbotRequest)
    const { default: router } = await import('../index')

    await router.push('/pos/decisiones-pendientes?status=RESOLVED#hd-1')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/chatbot/solicitudes')
    expect(router.currentRoute.value.query).toEqual({})
    expect(router.currentRoute.value.hash).toBe('')
  })

  it('no longer registers the old route or its view', async () => {
    const { default: router } = await import('../index')

    expect(router.hasRoute('pos-human-decisions')).toBe(false)
    const record = router.getRoutes().find((r) => r.path === '/pos/decisiones-pendientes')
    expect(record?.redirect).toBeDefined()
    expect(record?.components ?? null).toBeNull()
  })

  it.each([
    ['the old read:HumanDecision permission', (a: string, s: string) => a === 'read' && s === 'HumanDecision'],
    ['update:ChatbotRequest alone', (a: string, s: string) => a === 'update' && s === 'ChatbotRequest'],
    ['no grants', () => false],
  ])('sends %s to /403 through the target guard', async (_label, userCan) => {
    authenticate(userCan)
    const { default: router } = await import('../index')

    await router.push('/login')
    await router.isReady()
    await router.push('/pos/decisiones-pendientes')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })
})
