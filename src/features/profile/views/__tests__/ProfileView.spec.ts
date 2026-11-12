import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import ProfileView from '../ProfileView.vue'
import type { NotificationPreferences } from '../../interfaces/profile.types'

vi.mock('../../api/notification-preferences.api', () => ({
  notificationPreferencesApi: { get: vi.fn(), patch: vi.fn() },
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1', name: 'Laura Méndez', email: 'laura.mendez@ejemplo.mx' },
  }),
}))

import { notificationPreferencesApi } from '../../api/notification-preferences.api'

const get = vi.mocked(notificationPreferencesApi.get)
const patch = vi.mocked(notificationPreferencesApi.patch)

type Permission = 'default' | 'granted' | 'denied'

function stubNotification(permission: Permission, requestResult: Permission = permission) {
  const fake = { permission, requestPermission: vi.fn() }
  fake.requestPermission.mockImplementation(async () => {
    fake.permission = requestResult
    return requestResult
  })
  vi.stubGlobal('Notification', fake)
  return fake
}

function mountView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = mount(ProfileView, {
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
    attachTo: document.body.appendChild(document.createElement('div')),
  })
  return { wrapper, client }
}

async function mountLoaded() {
  const mounted = mountView()
  await flushPromises()
  return mounted
}

const row = (wrapper: ReturnType<typeof mountView>['wrapper'], key: string) =>
  wrapper.find(`[data-testid="pref-${key}"]`)

beforeEach(() => {
  get.mockReset()
  patch.mockReset()
  get.mockResolvedValue({ emailEnabled: true, soundEnabled: true })
  stubNotification('default')
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('ProfileView — page and account', () => {
  it('titles the page «Mi perfil» and shows the signed-in name and email, read-only', async () => {
    const { wrapper } = await mountLoaded()

    expect(wrapper.find('h1').text()).toBe('Mi perfil')
    const account = wrapper.find('[data-testid="profile-account"]')
    expect(account.text()).toContain('Laura Méndez')
    expect(account.text()).toContain('laura.mendez@ejemplo.mx')
    expect(account.find('input').exists()).toBe(false)
    expect(account.text()).not.toContain('Rol')
  })

  it('uses switch rows and no checkbox anywhere', async () => {
    const { wrapper } = await mountLoaded()

    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.findAll('[role="switch"]')).toHaveLength(2)
  })
})

describe('ProfileView — server preferences', () => {
  it('shows a loading state while the preferences load', async () => {
    get.mockReturnValue(new Promise(() => {}))
    const { wrapper } = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="prefs-loading"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.findAll('[role="switch"]')).toHaveLength(0)
  })

  it('renders both rows with their copy and the loaded values', async () => {
    get.mockResolvedValue({ emailEnabled: true, soundEnabled: false })
    const { wrapper } = await mountLoaded()

    const email = row(wrapper, 'emailEnabled')
    const sound = row(wrapper, 'soundEnabled')
    expect(email.text()).toContain('Avisos por correo')
    expect(email.attributes('role')).toBe('switch')
    expect(email.attributes('aria-checked')).toBe('true')
    expect(email.text()).toContain('Activado')
    expect(sound.text()).toContain('Sonido de avisos')
    expect(sound.attributes('aria-checked')).toBe('false')
    expect(sound.text()).toContain('Desactivado')
  })

  it('shows an error with a retry when the preferences do not load', async () => {
    get.mockRejectedValueOnce(new Error('HTTP 500'))
    const { wrapper } = await mountLoaded()

    const error = wrapper.find('[data-testid="prefs-error"]')
    expect(error.exists()).toBe(true)
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('No se pudieron cargar tus preferencias')
    expect(wrapper.findAll('[role="switch"]')).toHaveLength(0)

    await error.find('button').trigger('click')
    await flushPromises()

    expect(get).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="prefs-error"]').exists()).toBe(false)
    expect(wrapper.findAll('[role="switch"]')).toHaveLength(2)
  })

  it('keeps the account and the browser row visible when the preferences fail to load', async () => {
    get.mockRejectedValue(new Error('HTTP 500'))
    const { wrapper } = await mountLoaded()

    expect(wrapper.find('[data-testid="profile-account"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="browser-row"]').exists()).toBe(true)
  })

  it('a click on a row PATCHes only its field and flips it at once with «Guardando…»', async () => {
    let finish!: (value: NotificationPreferences) => void
    patch.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const { wrapper } = await mountLoaded()

    await row(wrapper, 'soundEnabled').trigger('click')

    expect(patch).toHaveBeenCalledTimes(1)
    expect(patch).toHaveBeenCalledWith({ soundEnabled: false })
    const sound = row(wrapper, 'soundEnabled')
    expect(sound.attributes('aria-checked')).toBe('false')
    expect(sound.attributes('aria-busy')).toBe('true')
    expect(sound.text()).toContain('Guardando…')
    expect(row(wrapper, 'emailEnabled').attributes('aria-busy')).toBeUndefined()

    finish({ emailEnabled: true, soundEnabled: false })
    await flushPromises()

    expect(row(wrapper, 'soundEnabled').attributes('aria-busy')).toBeUndefined()
    expect(row(wrapper, 'soundEnabled').text()).toContain('Desactivado')
  })

  it('toggling email sends only emailEnabled', async () => {
    patch.mockResolvedValue({ emailEnabled: false, soundEnabled: true })
    const { wrapper } = await mountLoaded()

    await row(wrapper, 'emailEnabled').trigger('click')
    await flushPromises()

    expect(patch).toHaveBeenCalledWith({ emailEnabled: false })
  })

  it('rolls back and says «No se pudo guardar» on that row only when the PATCH fails', async () => {
    patch.mockRejectedValue(new Error('HTTP 500'))
    const { wrapper } = await mountLoaded()

    await row(wrapper, 'soundEnabled').trigger('click')
    await flushPromises()

    expect(row(wrapper, 'soundEnabled').attributes('aria-checked')).toBe('true')
    const message = wrapper.find('[data-testid="pref-error-soundEnabled"]')
    expect(message.attributes('role')).toBe('alert')
    expect(message.text()).toContain('No se pudo guardar')
    expect(row(wrapper, 'soundEnabled').attributes('aria-describedby')).toContain(
      message.attributes('id'),
    )
    expect(wrapper.find('[data-testid="pref-error-emailEnabled"]').exists()).toBe(false)
  })

  it('«Reintentar» on a failed row tries the change again and clears the message on success', async () => {
    patch.mockRejectedValueOnce(new Error('HTTP 500'))
    patch.mockResolvedValueOnce({ emailEnabled: true, soundEnabled: false })
    const { wrapper } = await mountLoaded()

    await row(wrapper, 'soundEnabled').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="pref-retry-soundEnabled"]').trigger('click')
    await flushPromises()

    expect(patch).toHaveBeenCalledTimes(2)
    expect(patch).toHaveBeenLastCalledWith({ soundEnabled: false })
    expect(wrapper.find('[data-testid="pref-error-soundEnabled"]').exists()).toBe(false)
    expect(row(wrapper, 'soundEnabled').attributes('aria-checked')).toBe('false')
  })
})

describe('ProfileView — browser notifications (per device)', () => {
  const state = (wrapper: ReturnType<typeof mountView>['wrapper']) =>
    wrapper.find('[data-testid="browser-row"]')

  it('granted: «Activados en este dispositivo», no permission button', async () => {
    stubNotification('granted')
    const { wrapper } = await mountLoaded()

    expect(state(wrapper).text()).toContain('Avisos del navegador')
    expect(state(wrapper).text()).toContain('Activados en este dispositivo')
    expect(wrapper.find('[data-testid="browser-request"]').exists()).toBe(false)
  })

  it('denied: «Bloqueados en el navegador» with how to unblock, no permission button', async () => {
    stubNotification('denied')
    const { wrapper } = await mountLoaded()

    expect(state(wrapper).text()).toContain('Bloqueados en el navegador')
    expect(wrapper.find('[data-testid="browser-unblock"]').text()).toContain('candado')
    expect(wrapper.find('[data-testid="browser-request"]').exists()).toBe(false)
  })

  it('default: «Permitir avisos» asks the browser and then shows the answer', async () => {
    const fake = stubNotification('default', 'granted')
    const { wrapper } = await mountLoaded()

    const button = wrapper.find('[data-testid="browser-request"]')
    expect(button.text()).toBe('Permitir avisos')

    await button.trigger('click')
    await flushPromises()

    expect(fake.requestPermission).toHaveBeenCalledTimes(1)
    expect(state(wrapper).text()).toContain('Activados en este dispositivo')
    expect(wrapper.find('[data-testid="browser-request"]').exists()).toBe(false)
  })

  it('default then denied by the user: shows the blocked state and how to unblock', async () => {
    stubNotification('default', 'denied')
    const { wrapper } = await mountLoaded()

    await wrapper.find('[data-testid="browser-request"]').trigger('click')
    await flushPromises()

    expect(state(wrapper).text()).toContain('Bloqueados en el navegador')
    expect(wrapper.find('[data-testid="browser-unblock"]').exists()).toBe(true)
  })

  it('unsupported browser: says so and offers no button', async () => {
    vi.stubGlobal('Notification', undefined)
    const { wrapper } = await mountLoaded()

    expect(state(wrapper).text()).toContain('Este navegador no admite avisos')
    expect(wrapper.find('[data-testid="browser-request"]').exists()).toBe(false)
  })

  it('never sends the browser permission to the server', async () => {
    const fake = stubNotification('default', 'granted')
    const { wrapper } = await mountLoaded()

    await wrapper.find('[data-testid="browser-request"]').trigger('click')
    await flushPromises()

    expect(fake.requestPermission).toHaveBeenCalled()
    expect(patch).not.toHaveBeenCalled()
  })
})
