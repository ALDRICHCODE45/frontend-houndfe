import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const app = {
    use: vi.fn(),
    mount: vi.fn(),
  }
  const authStore = {
    hydrateFromStorage: vi.fn(),
    clearSession: vi.fn(),
  }
  const router = {
    currentRoute: {
      value: {
        name: 'public-catalog',
        path: '/catalogo',
        fullPath: '/catalogo',
      },
    },
    isReady: vi.fn(),
    replace: vi.fn(),
  }

  return {
    app,
    authStore,
    createApp: vi.fn(() => app),
    createPinia: vi.fn(() => ({})),
    onSessionExpired: vi.fn(),
    router,
  }
})

vi.mock('vue', () => ({ createApp: mocks.createApp }))
vi.mock('pinia', () => ({ createPinia: mocks.createPinia }))
vi.mock('@tanstack/vue-query', () => ({ VueQueryPlugin: {} }))
vi.mock('@casl/vue', () => ({ abilitiesPlugin: {} }))
vi.mock('@nuxt/ui/vue-plugin', () => ({ default: {} }))
vi.mock('@/core/shared/api/queryClient', () => ({ queryClient: {} }))
vi.mock('@/app/router', () => ({ default: mocks.router }))
vi.mock('@/features/auth/authorization/ability', () => ({ ability: {} }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => mocks.authStore }))
vi.mock('@/features/auth/services/session-events', () => ({ onSessionExpired: mocks.onSessionExpired }))
vi.mock('./App.vue', () => ({ default: {} }))

describe('application bootstrap', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.app.use.mockReturnValue(mocks.app)
    mocks.router.isReady.mockResolvedValue(undefined)
    mocks.router.replace.mockResolvedValue(undefined)
    mocks.router.currentRoute.value = {
      name: 'public-catalog',
      path: '/catalogo',
      fullPath: '/catalogo',
    }
  })

  it('does not hydrate auth and waits for the initial route before mounting', async () => {
    let resolveRouter!: () => void
    mocks.router.isReady.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRouter = resolve
      }),
    )

    await import('./main')

    expect(mocks.authStore.hydrateFromStorage).not.toHaveBeenCalled()
    expect(mocks.app.mount).not.toHaveBeenCalled()

    resolveRouter()
    await Promise.resolve()

    expect(mocks.router.isReady).toHaveBeenCalledTimes(1)
    expect(mocks.app.mount).toHaveBeenCalledWith('#app')
  })

  it('clears an expired catalog session without redirecting to login', async () => {
    await import('./main')

    const handler = mocks.onSessionExpired.mock.calls[0]?.[0] as (reason: string) => void
    handler('refresh-failed')

    expect(mocks.authStore.clearSession).toHaveBeenCalledTimes(1)
    expect(mocks.router.replace).not.toHaveBeenCalled()
  })

  it('clears an expired protected session and redirects to login with its path', async () => {
    mocks.router.currentRoute.value = {
      name: 'pos-orders',
      path: '/pos/orders',
      fullPath: '/pos/orders?status=pending',
    }

    await import('./main')

    const handler = mocks.onSessionExpired.mock.calls[0]?.[0] as (reason: string) => void
    handler('refresh-failed')

    expect(mocks.authStore.clearSession).toHaveBeenCalledTimes(1)
    expect(mocks.router.replace).toHaveBeenCalledWith({
      path: '/login',
      query: { redirect: '/pos/orders?status=pending' },
    })
  })
})
