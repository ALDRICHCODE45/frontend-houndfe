import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import { makeNotice } from '../../composables/__tests__/support'

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
import NotificationsHost from '../NotificationsHost.vue'

const api = vi.mocked(notificationsApi)
enableAutoUnmount(afterEach)

async function mountHost() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = mountWithUApp(NotificationsHost, {
    global: { plugins: [router, [VueQueryPlugin, { queryClient: client }]] },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset()
  auth.tenantId = 'tenant-1'
  auth.authenticated = true
  api.unreadCount.mockResolvedValue({ count: 3 })
  api.list.mockResolvedValue({ items: [makeNotice('a')], nextCursor: null })
})

describe('NotificationsHost', () => {
  it('an authenticated user with a tenant gets the bell with the unread count', async () => {
    const wrapper = await mountHost()
    const bell = wrapper.get('button[aria-label^="Notificaciones"]')
    expect(bell.attributes('aria-label')).toBe('Notificaciones, 3 sin leer')
    expect(api.unreadCount).toHaveBeenCalledTimes(1)
  })

  it('without a tenant: no bell and no request', async () => {
    auth.tenantId = ''
    const wrapper = await mountHost()
    expect(wrapper.find('button[aria-label^="Notificaciones"]').exists()).toBe(false)
    expect(api.unreadCount).not.toHaveBeenCalled()
  })

  it('without a session: no bell and no request', async () => {
    auth.authenticated = false
    const wrapper = await mountHost()
    expect(wrapper.find('button[aria-label^="Notificaciones"]').exists()).toBe(false)
    expect(api.unreadCount).not.toHaveBeenCalled()
  })

  it('the bell opens and closes the panel', async () => {
    const wrapper = await mountHost()
    const bell = wrapper.get('button[aria-label^="Notificaciones"]')
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()

    await bell.trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    expect(bell.attributes('aria-expanded')).toBe('true')
    expect(api.list).toHaveBeenCalled()

    await bell.trigger('click')
    await flushPromises()
    expect(bell.attributes('aria-expanded')).toBe('false')
  })
})
