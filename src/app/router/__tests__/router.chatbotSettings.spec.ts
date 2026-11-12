// router.chatbotSettings.spec.ts — route of the chatbot settings screen (ODD chatbot-requests-inbox, T5.S).
//
//   /sistema/atencion-chatbot  name chatbot-settings  read:ChatbotSettings, remembered as landing

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
vi.mock('@/features/system/chatbot-settings/views/ChatbotSettingsView.vue', () => ({
  default: { name: 'ChatbotSettingsView' },
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

const readChatbotSettings = (action: string, subject: string) =>
  action === 'read' && subject === 'ChatbotSettings'

describe('router — chatbot settings (T5.S)', () => {
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

  it('/sistema/atencion-chatbot: name, dashboard layout, read:ChatbotSettings and landing opt-in', async () => {
    authenticate(readChatbotSettings)
    const { default: router } = await import('../index')

    await router.push('/sistema/atencion-chatbot')
    await router.isReady()

    const route = router.currentRoute.value
    expect(route.path).toBe('/sistema/atencion-chatbot')
    expect(route.name).toBe('chatbot-settings')
    expect(route.meta.layout).toBe('dashboard')
    expect(route.meta.permission).toEqual(['read', 'ChatbotSettings'])
    expect(route.meta.rememberAsLanding).toBe(true)
    expect(route.meta.public).toBeUndefined()
    expect(route.meta.skipTenantCheck).toBeUndefined()
    expect(route.meta.requiresSuperAdmin).toBeUndefined()
  })

  it('lazy-resolves to the settings view', async () => {
    authenticate(readChatbotSettings)
    const { default: router } = await import('../index')

    await router.push('/sistema/atencion-chatbot')
    await router.isReady()

    const raw = router.currentRoute.value.matched[0]!.components!.default as unknown
    const resolved = typeof raw === 'function' ? await (raw as () => Promise<unknown>)() : raw
    expect((resolved as { default?: unknown }).default ?? resolved).toBe(
      (await import('@/features/system/chatbot-settings/views/ChatbotSettingsView.vue')).default,
    )
  })

  it('redirects to /403 without read:ChatbotSettings', async () => {
    authenticate(() => false)
    const { default: router } = await import('../index')

    await router.push('/login')
    await router.isReady()
    await router.push('/sistema/atencion-chatbot')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('update:ChatbotSettings or read:ChatbotRequest alone do not open the screen', async () => {
    authenticate(
      (action, subject) =>
        (action === 'update' && subject === 'ChatbotSettings') ||
        (action === 'read' && subject === 'ChatbotRequest'),
    )
    const { default: router } = await import('../index')

    await router.push('/login')
    await router.isReady()
    await router.push('/sistema/atencion-chatbot')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })
})
