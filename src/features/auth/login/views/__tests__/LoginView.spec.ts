import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoginView from '../LoginView.vue'

const push = vi.fn()
const login = vi.fn()
const verify = vi.fn()
const resend = vi.fn()
const cancel = vi.fn()
const challenge = {
  requiresOtp: true as const,
  challengeId: 'challenge',
  expiresAt: 600000,
  resendAt: 60000,
}
const store = reactive({
  login,
  verifyLoginOtp: verify,
  resendLoginOtp: resend,
  cancelLogin: cancel,
  otpChallenge: null as typeof challenge | null,
  otpRestartRequired: false,
  otpError: null as string | null,
  otpRetryAt: 0,
  loginBusy: false,
  authPhase: 'idle',
  authError: null as string | null,
  isSuperAdmin: false,
  currentTenant: null,
  userCan: vi.fn().mockReturnValue(true),
})
const route = { query: {} as Record<string, string> }
const routes: Record<
  string,
  { name: string; meta: { permission?: [string, string]; requiresSuperAdmin?: boolean } }
> = {
  '/dashboard': { name: 'dashboard', meta: { permission: ['read', 'Analytics'] } },
  '/pos/orders': { name: 'orders', meta: { permission: ['read', 'Order'] } },
  '/pos/ventas': { name: 'sales', meta: { permission: ['read', 'Sale'] } },
  '/admin/tenants': { name: 'tenants', meta: { requiresSuperAdmin: true } },
}
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push,
    resolve: (path: string) => routes[path] ?? { name: 'not-found', meta: {} },
  }),
  useRoute: () => route,
}))
vi.mock('@tanstack/vue-query', () => ({
  useMutation: ({ mutationFn }: { mutationFn: unknown }) => ({ mutateAsync: mutationFn }),
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => store }))
vi.mock('@/features/auth/login/components/LoginHero.vue', () => ({
  default: { template: '<div />' },
}))
vi.mock('@/features/auth/login/components/LoginForm.vue', () => ({
  default: defineComponent({
    emits: ['submit'],
    setup(_, { emit }) {
      return () =>
        h(
          'button',
          {
            'data-test': 'password',
            onClick: () => emit('submit', { email: 'user@hound.test', password: 'synthetic' }),
          },
          'Ingresar',
        )
    },
  }),
}))
vi.mock('@/features/auth/login/components/LoginOtpForm.vue', () => ({
  default: defineComponent({
    name: 'LoginOtpForm',
    props: [
      'resendSeconds',
      'expiresSeconds',
      'retrySeconds',
      'error',
      'restartRequired',
      'loading',
    ],
    emits: ['verify', 'resend', 'restart'],
    setup(props, { emit }) {
      return () =>
        h('div', [
          h('span', { 'data-test': 'seconds' }, String(props.resendSeconds)),
          h('span', props.error as string),
          ...(['verify', 'resend', 'restart'] as const).map((event) =>
            h(
              'button',
              {
                'data-test': event,
                onClick: () => (event === 'verify' ? emit(event, '001234') : emit(event)),
              },
              event,
            ),
          ),
        ])
    },
  }),
}))

const wrappers: ReturnType<typeof mount>[] = []
function render() {
  const wrapper = mount(LoginView, {
    global: { stubs: { UAlert: { props: ['title'], template: '<div>{{ title }}</div>' } } },
  })
  wrappers.push(wrapper)
  return wrapper
}
async function password(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('[data-test="password"]').trigger('click')
  await flushPromises()
}
async function submitCode(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('[data-test="verify"]').trigger('click')
  await flushPromises()
}

describe('LoginView password then OTP', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(store, {
      otpChallenge: null,
      otpRestartRequired: false,
      otpError: null,
      otpRetryAt: 0,
      loginBusy: false,
      authPhase: 'idle',
      authError: null,
      isSuperAdmin: false,
    })
    route.query = {}
    store.userCan.mockReturnValue(true)
    login.mockImplementation(async () => {
      store.otpChallenge = {
        ...challenge,
        expiresAt: Date.now() + 600000,
        resendAt: Date.now() + 60000,
      }
      return challenge
    })
    verify.mockImplementation(async () => {
      store.authPhase = 'authenticated'
      store.otpChallenge = null
      return { requiresTenantSelection: false }
    })
    resend.mockResolvedValue(challenge)
    cancel.mockImplementation(() => {
      store.otpChallenge = null
      store.otpRestartRequired = false
      store.loginBusy = false
    })
  })
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.useRealTimers()
  })

  it('does not navigate after password, even with an existing authenticated session', async () => {
    store.authPhase = 'authenticated'
    const wrapper = render()
    await password(wrapper)
    expect(push).not.toHaveBeenCalled()
    expect(wrapper.find('[data-test="password"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="verify"]').exists()).toBe(true)
    await submitCode(wrapper)
    expect(verify).toHaveBeenCalledWith('001234')
    expect(push).toHaveBeenCalledWith('/dashboard')
  })

  it.each([false, true])('routes verified tenant selection (superadmin=%s)', async (superadmin) => {
    verify.mockImplementation(async () => {
      store.authPhase = 'needs-tenant-selection'
      store.isSuperAdmin = superadmin
      return {}
    })
    const wrapper = render()
    await password(wrapper)
    await submitCode(wrapper)
    expect(push).toHaveBeenCalledWith('/select-tenant')
  })

  it.each([
    ['/', '/dashboard'],
    ['/analytics/resumen-ventas', '/dashboard'],
    ['/pos/orders', '/pos/orders'],
    ['/pos/ventas', '/pos/ventas'],
  ])('preserves authorized landing for redirect %s', async (redirect, expected) => {
    route.query.redirect = redirect
    const wrapper = render()
    await password(wrapper)
    await submitCode(wrapper)
    expect(push).toHaveBeenCalledExactlyOnceWith(expected)
  })

  it.each(['/dashboard', '/pos/orders', '/admin/tenants'])(
    'ignores forbidden redirect %s',
    async (redirect) => {
      route.query.redirect = redirect
      store.userCan.mockImplementation(
        (action: string, subject: string) => action === 'read' && subject === 'Sale',
      )
      const wrapper = render()
      await password(wrapper)
      await submitCode(wrapper)
      expect(push).toHaveBeenCalledExactlyOnceWith('/pos/ventas')
    },
  )

  it('honors a superadmin route after proof', async () => {
    route.query.redirect = '/admin/tenants'
    store.isSuperAdmin = true
    const wrapper = render()
    await password(wrapper)
    await submitCode(wrapper)
    expect(push).toHaveBeenCalledExactlyOnceWith('/admin/tenants')
  })

  it('lands on 403 when no route is permitted', async () => {
    store.userCan.mockReturnValue(false)
    const wrapper = render()
    await password(wrapper)
    await submitCode(wrapper)
    expect(push).toHaveBeenCalledExactlyOnceWith('/403')
  })

  it('preserves the password error and store-specific 403 UX', async () => {
    login.mockRejectedValue(new Error('Unauthorized'))
    const wrapper = render()
    await password(wrapper)
    expect(wrapper.text()).toContain('Verifica credenciales')
    store.authError = 'No tienes acceso a ninguna sucursal. Contacta al administrador.'
    await password(wrapper)
    expect(wrapper.text()).toContain(store.authError)
    expect(push).not.toHaveBeenCalled()
  })

  it('restarts on request and fences late verification navigation after restart', async () => {
    let resolve!: (value: unknown) => void
    verify.mockImplementation(
      () =>
        new Promise((res) => {
          resolve = res
        }),
    )
    const wrapper = render()
    await password(wrapper)
    await wrapper.get('[data-test="verify"]').trigger('click')
    await wrapper.get('[data-test="restart"]').trigger('click')
    expect(cancel).toHaveBeenCalled()
    expect(wrapper.find('[data-test="password"]').exists()).toBe(true)
    resolve({ requiresTenantSelection: false })
    await flushPromises()
    expect(push).not.toHaveBeenCalled()
  })

  it('fences a late password failure after unmount', async () => {
    let reject!: (error: unknown) => void
    login.mockImplementation(
      () =>
        new Promise((_, rej) => {
          reject = rej
        }),
    )
    const wrapper = render()
    await wrapper.get('[data-test="password"]').trigger('click')
    wrapper.unmount()
    reject(new Error('late'))
    await flushPromises()
    expect(cancel).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('uses response deadlines for countdown and cleans its timer on unmount', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    const wrapper = render()
    await password(wrapper)
    expect(wrapper.get('[data-test="seconds"]').text()).toBe('60')
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.get('[data-test="seconds"]').text()).toBe('58')
    await wrapper.get('[data-test="resend"]').trigger('click')
    expect(resend).toHaveBeenCalledOnce()
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
