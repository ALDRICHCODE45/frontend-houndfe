import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginView from '../LoginView.vue'

const pushMock = vi.fn()
const loginMock = vi.fn()

interface ResolvedRoute {
  name: string
  meta: { permission?: [string, string]; requiresSuperAdmin?: boolean }
}

// Minimal app-route table for the router.resolve mock. Each entry mirrors the
// production route's `meta.permission` / `meta.requiresSuperAdmin` so the login
// redirect logic can be exercised against realistic authorization metadata.
// Anything missing here falls through to the wildcard NotFoundView
// (`name: 'not-found'`), matching the production router's behavior for paths
// that no longer exist (e.g. "/" and "/analytics/resumen-ventas" after ODD D1).
const appRoutes: Record<string, ResolvedRoute> = {
  '/dashboard': { name: 'dashboard', meta: { permission: ['read', 'Analytics'] } },
  '/pos/orders': { name: 'pos-orders', meta: { permission: ['read', 'Order'] } },
  '/pos/ventas': { name: 'pos-sales-list', meta: { permission: ['read', 'Sale'] } },
  '/pos/products': { name: 'pos-products', meta: { permission: ['read', 'Product'] } },
  '/admin/tenants': { name: 'admin-tenants', meta: { requiresSuperAdmin: true } },
}

const resolveMock = vi.fn(
  (path: string): ResolvedRoute => appRoutes[path] ?? { name: 'not-found', meta: {} },
)

const authStoreMock = {
  login: loginMock,
  authPhase: 'authenticated' as 'idle' | 'authenticated' | 'needs-tenant-selection',
  authError: null as string | null,
  isSuperAdmin: false,
  userCan: vi.fn().mockReturnValue(true) as ReturnType<typeof vi.fn>,
  currentTenant: null as { id: string; name: string; slug: string } | null,
}

const routeMock = {
  query: {} as Record<string, string>,
}

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock, resolve: resolveMock }),
  useRoute: () => routeMock,
}))

vi.mock('@tanstack/vue-query', () => ({
  useMutation: ({ mutationFn }: { mutationFn: (payload: unknown) => Promise<unknown> }) => ({
    mutateAsync: mutationFn,
  }),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authStoreMock,
}))

vi.mock('@/features/auth/login/components/LoginHero.vue', () => ({
  default: defineComponent({
    name: 'LoginHero',
    setup() {
      return () => h('div', { 'data-test': 'login-hero' })
    },
  }),
}))

vi.mock('@/features/auth/login/components/LoginForm.vue', () => ({
  default: defineComponent({
    name: 'LoginForm',
    emits: ['submit'],
    setup(_, { emit }) {
      return () =>
        h(
          'button',
          {
            'data-test': 'submit-login',
            onClick: () => emit('submit', { email: 'user@hound.test', password: 'secret' }),
          },
          'Ingresar',
        )
    },
  }),
}))

describe('LoginView redirects by auth phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authStoreMock.authPhase = 'authenticated'
    authStoreMock.authError = null
    authStoreMock.isSuperAdmin = false
    authStoreMock.currentTenant = null
    routeMock.query = {}
    loginMock.mockResolvedValue(undefined)
  })

  it('redirects to /select-tenant when login finishes in needs-tenant-selection phase', async () => {
    authStoreMock.authPhase = 'needs-tenant-selection'
    const wrapper = mount(LoginView)

    await wrapper.get('[data-test="submit-login"]').trigger('click')

    expect(loginMock).toHaveBeenCalledWith({ email: 'user@hound.test', password: 'secret' })
    expect(pushMock).toHaveBeenCalledWith('/select-tenant')
  })

  it('redirects super-admin global login to /select-tenant', async () => {
    loginMock.mockImplementation(async () => {
      authStoreMock.authPhase = 'needs-tenant-selection'
      authStoreMock.isSuperAdmin = true
      authStoreMock.currentTenant = null
    })
    const wrapper = mount(LoginView)

    await wrapper.get('[data-test="submit-login"]').trigger('click')

    expect(pushMock).toHaveBeenCalledWith('/select-tenant')
  })

  it('redirects to query redirect when authenticated phase is reached', async () => {
    routeMock.query = { redirect: '/pos/orders' }
    const wrapper = mount(LoginView)

    await wrapper.get('[data-test="submit-login"]').trigger('click')

    expect(pushMock).toHaveBeenCalledWith('/pos/orders')
  })
})

describe('LoginView — ?redirect= validation (ODD dashboard-analytics D1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authStoreMock.authPhase = 'authenticated'
    authStoreMock.authError = null
    authStoreMock.isSuperAdmin = false
    authStoreMock.currentTenant = null
    authStoreMock.userCan.mockReturnValue(true)
    routeMock.query = {}
    loginMock.mockResolvedValue(undefined)
  })

  it.each([{ removedPath: '/' }, { removedPath: '/analytics/resumen-ventas' }])(
    'falls back to the resolver when ?redirect= is the removed path "$removedPath"',
    async ({ removedPath }) => {
      routeMock.query = { redirect: removedPath }
      const wrapper = mount(LoginView)

      await wrapper.get('[data-test="submit-login"]').trigger('click')

      expect(pushMock).toHaveBeenCalledTimes(1)
      expect(pushMock).not.toHaveBeenCalledWith(removedPath)
      // Resolver with read:Analytics allowed (userCan = true) → /dashboard.
      expect(pushMock).toHaveBeenCalledWith('/dashboard')
    },
  )

  it('uses the explicit ?redirect= when it points to a real application route', async () => {
    routeMock.query = { redirect: '/pos/ventas' }
    const wrapper = mount(LoginView)

    await wrapper.get('[data-test="submit-login"]').trigger('click')

    expect(pushMock).toHaveBeenCalledWith('/pos/ventas')
    expect(pushMock).toHaveBeenCalledTimes(1)
  })

  it('ignores an authorized-looking ?redirect=/dashboard the identity cannot read, landing on the first permitted route', async () => {
    // Regression: lacks read:Analytics but holds read:Sale. The old code pushed
    // /dashboard because it only checked that the route existed, then the
    // router guard bounced the user to /403.
    routeMock.query = { redirect: '/dashboard' }
    authStoreMock.userCan.mockImplementation(
      (action: string, subject: string) => action === 'read' && subject === 'Sale',
    )
    const wrapper = mount(LoginView)

    await wrapper.get('[data-test="submit-login"]').trigger('click')

    expect(pushMock).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith('/pos/ventas')
    expect(pushMock).not.toHaveBeenCalledWith('/dashboard')
    expect(pushMock).not.toHaveBeenCalledWith('/403')
  })

  it('ignores an explicit redirect to a real but unauthorized route', async () => {
    routeMock.query = { redirect: '/pos/orders' }
    authStoreMock.userCan.mockImplementation(
      (action: string, subject: string) => action === 'read' && subject === 'Sale',
    )
    const wrapper = mount(LoginView)

    await wrapper.get('[data-test="submit-login"]').trigger('click')

    expect(pushMock).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith('/pos/ventas')
    expect(pushMock).not.toHaveBeenCalledWith('/pos/orders')
  })

  it('honors a super-admin-only explicit redirect for a super admin', async () => {
    routeMock.query = { redirect: '/admin/tenants' }
    authStoreMock.isSuperAdmin = true
    const wrapper = mount(LoginView)

    await wrapper.get('[data-test="submit-login"]').trigger('click')

    expect(pushMock).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith('/admin/tenants')
  })

  it('ignores a super-admin-only explicit redirect for a non-super-admin', async () => {
    routeMock.query = { redirect: '/admin/tenants' }
    authStoreMock.isSuperAdmin = false
    authStoreMock.userCan.mockReturnValue(false)
    const wrapper = mount(LoginView)

    await wrapper.get('[data-test="submit-login"]').trigger('click')

    expect(pushMock).toHaveBeenCalledTimes(1)
    expect(pushMock).not.toHaveBeenCalledWith('/admin/tenants')
    expect(pushMock).toHaveBeenCalledWith('/403')
  })

  it.each([
    {
      label: 'first permitted registry child (/pos/ventas) when only read:Sale is granted',
      userCan: (action: string, subject: string) => action === 'read' && subject === 'Sale',
      expected: '/pos/ventas',
    },
    {
      label: '/403 when no application route is accessible',
      userCan: () => false,
      expected: '/403',
    },
  ])('resolver outcome: $label', async ({ userCan, expected }) => {
    authStoreMock.userCan.mockImplementation(userCan)
    const wrapper = mount(LoginView)

    await wrapper.get('[data-test="submit-login"]').trigger('click')

    expect(pushMock).toHaveBeenCalledWith(expected)
    expect(pushMock).not.toHaveBeenCalledWith('/dashboard')
  })
})

describe('LoginView — 403 no active tenants error display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authStoreMock.authPhase = 'authenticated'
    authStoreMock.authError = null
    loginMock.mockReset()
    routeMock.query = {}
  })

  it('displays authError from store when login throws 403 no-active-tenants', async () => {
    const error403 = Object.assign(new Error('Forbidden'), {
      isAxiosError: true,
      response: { status: 403, data: { message: 'User does not belong to an active tenant' } },
    })
    // The store sets authError internally; login rejects
    loginMock.mockImplementation(async () => {
      authStoreMock.authError = 'No tienes acceso a ninguna sucursal. Contacta al administrador.'
      authStoreMock.authPhase = 'idle'
      throw error403
    })

    const wrapper = mount(LoginView)
    await wrapper.get('[data-test="submit-login"]').trigger('click')

    // Wait for DOM update after the async handler settles
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain(
      'No tienes acceso a ninguna sucursal. Contacta al administrador.',
    )
  })

  it('does NOT show authError message when login succeeds', async () => {
    loginMock.mockResolvedValue(undefined)
    authStoreMock.authError = null

    const wrapper = mount(LoginView)

    expect(wrapper.text()).not.toContain('No tienes acceso')
  })
})
