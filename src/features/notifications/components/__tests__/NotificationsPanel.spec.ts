import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { defineComponent, h } from 'vue'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import { axiosError, deferred, makeNotice } from '../../composables/__tests__/support'

vi.mock('../../api/notifications.api', () => ({
  notificationsApi: {
    list: vi.fn(),
    unreadCount: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    getPreferences: vi.fn(),
  },
}))

const auth = vi.hoisted(() => ({ tenantId: 'tenant-1', authenticated: true }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get currentTenantId() {
      return auth.tenantId
    },
    get isAuthenticated() {
      return auth.authenticated
    },
  }),
}))

import { notificationsApi } from '../../api/notifications.api'
import NotificationsPanel from '../NotificationsPanel.vue'

const api = vi.mocked(notificationsApi)
enableAutoUnmount(afterEach)

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

const UNREAD = makeNotice('a', { title: 'Solicitud vencida', type: 'REQUEST_OVERDUE', createdAt: new Date().toISOString() })
const READ = makeNotice('b', {
  title: 'El cliente canceló la solicitud',
  type: 'REQUEST_CANCELLED',
  createdAt: daysAgo(3),
  readAt: daysAgo(3),
})

const body = () => document.body
const find = (selector: string) => body().querySelector<HTMLElement>(selector)
const findText = (selector: string, text: string) =>
  [...body().querySelectorAll<HTMLElement>(selector)].find((el) => el.textContent?.includes(text))

async function mountPanel(props: Record<string, unknown> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/')
  const onUpdateOpen = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const panelProps = { open: true, unreadCount: 1, countError: false, 'onUpdate:open': onUpdateOpen, ...props }
  // The panel's root is a fragment (a portaled dialog): hosting it in an element, as the topbar does,
  // lets Vue unmount it cleanly.
  const Harness = defineComponent({
    setup: () => () => h(UApp, null, { default: () => h('div', [h(NotificationsPanel, panelProps)]) }),
  })
  const wrapper = mount(Harness, {
    global: { plugins: [router, [VueQueryPlugin, { queryClient: client }]] },
  })
  await flushPromises()
  return { wrapper, router, onUpdateOpen, client }
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset()
  auth.tenantId = 'tenant-1'
  auth.authenticated = true
  api.list.mockResolvedValue({ items: [UNREAD, READ], nextCursor: null })
  api.markRead.mockResolvedValue({ id: 'a', readAt: 'x' })
  api.markAllRead.mockResolvedValue({ updated: 1 })
  api.unreadCount.mockResolvedValue({ count: 0 })
})

describe('NotificationsPanel — shell', () => {
  it('is a dialog named «Notificaciones» with groups Hoy / Antes', async () => {
    await mountPanel()

    expect(find('[role="dialog"]')).not.toBeNull()
    expect(findText('[role="dialog"] *', 'Notificaciones')).toBeDefined()
    expect([...body().querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Hoy', 'Antes'])
    expect(api.list).toHaveBeenCalledWith(
      { cursor: undefined, limit: 20, unread: false },
      expect.anything(),
    )
  })

  it('closed: nothing rendered and no request', async () => {
    await mountPanel({ open: false })
    expect(find('[role="dialog"]')).toBeNull()
    expect(api.list).not.toHaveBeenCalled()
  })

  it('names the unread count in the header (capped) and offers the preferences link', async () => {
    await mountPanel({ unreadCount: 250 })
    expect(findText('[role="dialog"] *', '99+ sin leer')).toBeDefined()
    const gear = find('a[href="/perfil"][aria-label="Preferencias de notificaciones"]')
    expect(gear).not.toBeNull()
  })

  it('says the badge count may be out of date', async () => {
    await mountPanel({ countError: true })
    expect(findText('[role="status"]', 'El conteo puede estar desfasado')).toBeDefined()
  })
})

describe('NotificationsPanel — tabs and paging', () => {
  it('«Sin leer» asks the server for unread=true', async () => {
    await mountPanel()
    findText('button', 'Sin leer')!.click()
    await flushPromises()

    expect(api.list).toHaveBeenLastCalledWith(
      { cursor: undefined, limit: 20, unread: true },
      expect.anything(),
    )
    expect(findText('button', 'Sin leer')!.getAttribute('aria-pressed')).toBe('true')
    expect(findText('button', 'Todas')!.getAttribute('aria-pressed')).toBe('false')
  })

  it('«Ver anteriores» sends the cursor unchanged', async () => {
    api.list.mockResolvedValueOnce({ items: [UNREAD], nextCursor: 'cur-2' })
    await mountPanel()
    api.list.mockResolvedValueOnce({ items: [READ], nextCursor: null })

    find('[data-testid="load-more"]')!.click()
    await flushPromises()

    expect(api.list).toHaveBeenLastCalledWith(
      { cursor: 'cur-2', limit: 20, unread: false },
      expect.anything(),
    )
    expect(find('[data-testid="load-more"]')).toBeNull()
  })
})

describe('NotificationsPanel — opening a notice', () => {
  it('marks it read, goes to the request and closes the panel', async () => {
    const { router, onUpdateOpen } = await mountPanel()

    find('a[href="/chatbot/solicitudes/req-a"]')!.click()
    await flushPromises()

    expect(api.markRead).toHaveBeenCalledWith('a')
    expect(router.currentRoute.value.fullPath).toBe('/chatbot/solicitudes/req-a')
    expect(onUpdateOpen).toHaveBeenCalledWith(false)
  })

  it('a notice that is already read is not marked again, but still opens', async () => {
    const { router, onUpdateOpen } = await mountPanel()

    find('a[href="/chatbot/solicitudes/req-b"]')!.click()
    await flushPromises()

    expect(api.markRead).not.toHaveBeenCalled()
    expect(router.currentRoute.value.fullPath).toBe('/chatbot/solicitudes/req-b')
    expect(onUpdateOpen).toHaveBeenCalledWith(false)
  })

  it('the preferences link closes the panel', async () => {
    const { onUpdateOpen } = await mountPanel()
    find('a[href="/perfil"]')!.click()
    await flushPromises()
    expect(onUpdateOpen).toHaveBeenCalledWith(false)
  })
})

describe('NotificationsPanel — mark all', () => {
  it('«Marcar todas como leídas» posts read-all', async () => {
    await mountPanel({ unreadCount: 3 })
    findText('button', 'Marcar todas como leídas')!.click()
    await flushPromises()

    expect(api.markAllRead).toHaveBeenCalledTimes(1)
  })

  it('is disabled, with its reason, when nothing is unread', async () => {
    await mountPanel({ unreadCount: 0 })
    const button = findText('button', 'Marcar todas como leídas')!
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(findText('*', 'No hay avisos sin leer.')).toBeDefined()
    button.click()
    expect(api.markAllRead).not.toHaveBeenCalled()
  })

  it('a refusal shows an alert that says nothing was lost and can retry', async () => {
    api.markAllRead.mockRejectedValueOnce(axiosError(500))
    await mountPanel({ unreadCount: 3 })

    findText('button', 'Marcar todas como leídas')!.click()
    await flushPromises()

    const alert = findText('[role="alert"]', 'No se pudieron marcar como leídas')!
    expect(alert.textContent).toContain('siguen sin leer')

    findText('[role="alert"] button', 'Reintentar')!.click()
    await flushPromises()
    expect(api.markAllRead).toHaveBeenCalledTimes(2)
    expect(findText('[role="alert"]', 'No se pudieron marcar como leídas')).toBeUndefined()
  })
})

describe('NotificationsPanel — states', () => {
  it('loading', async () => {
    const pending = deferred<{ items: []; nextCursor: null }>()
    api.list.mockReturnValue(pending.promise)
    await mountPanel()
    expect(find('[aria-busy="true"][aria-label="Cargando notificaciones"]')).not.toBeNull()
  })

  it('empty', async () => {
    api.list.mockResolvedValue({ items: [], nextCursor: null })
    await mountPanel({ unreadCount: 0 })
    expect(findText('*', 'No tienes avisos')).toBeDefined()
  })

  it('«Todo leído» on the unread tab goes back to all with «Ver todas»', async () => {
    await mountPanel({ unreadCount: 0 })
    api.list.mockResolvedValueOnce({ items: [], nextCursor: null })
    findText('button', 'Sin leer')!.click()
    await flushPromises()
    expect(findText('*', 'Todo leído')).toBeDefined()

    find('[data-testid="show-all"]')!.click()
    await flushPromises()
    expect(findText('button', 'Todas')!.getAttribute('aria-pressed')).toBe('true')
  })

  it('error: «Reintentar» reads again', async () => {
    api.list.mockRejectedValueOnce(axiosError(500))
    await mountPanel()
    expect(findText('[role="alert"]', 'No se pudieron cargar las notificaciones')).toBeDefined()

    find('[data-testid="empty-state-action"]')!.click()
    await flushPromises()
    expect(api.list).toHaveBeenCalledTimes(2)
    expect(find('a[href="/chatbot/solicitudes/req-a"]')).not.toBeNull()
  })
})
