import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginView from '../LoginView.vue'

const pushMock = vi.fn()
const loginMock = vi.fn()

const authStoreMock = {
  login: loginMock,
  authPhase: 'authenticated' as 'idle' | 'authenticated' | 'needs-tenant-selection',
  authError: null as string | null,
  isSuperAdmin: false,
  currentTenant: null as { id: string; name: string; slug: string } | null,
}

const routeMock = {
  query: {} as Record<string, string>,
}

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
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

  it('redirects to query redirect (or /) when authenticated phase is reached', async () => {
    routeMock.query = { redirect: '/pos/orders' }
    const wrapper = mount(LoginView)

    await wrapper.get('[data-test="submit-login"]').trigger('click')

    expect(pushMock).toHaveBeenCalledWith('/pos/orders')
  })
})

describe('LoginView — 403 no active tenants error display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authStoreMock.authPhase = 'authenticated'
    authStoreMock.authError = null
    routeMock.query = {}
  })

  it('displays authError from store when login throws 403 no-active-tenants', async () => {
    const error403 = Object.assign(new Error('Forbidden'), {
      isAxiosError: true,
      response: { status: 403, data: { message: 'User does not belong to an active tenant' } },
    })

    // The store sets authError internally; login rejects
    loginMock.mockImplementation(async () => {
      authStoreMock.authError =
        'No tienes acceso a ninguna sucursal. Contacta al administrador.'
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
