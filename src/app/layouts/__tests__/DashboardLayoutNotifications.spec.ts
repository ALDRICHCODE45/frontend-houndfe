import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- vue-tsc resolves this SFC; the editor's plain TS language service cannot.
// @ts-ignore -- vue-tsc resolves this SFC; the editor's plain TS language service cannot.
import DashboardLayout from '../DashboardLayout.vue'

/**
 * S4 — the notifications bell lives in the dashboard topbar, between search and the theme button,
 * only for an authenticated user with a tenant.
 */

vi.mock('@/app/composables/useSidebar', () => ({
  useSidebar: () => ({
    tenants: ref([]),
    currentTenantLabel: ref('Sucursal Centro'),
    currentTenantSlug: ref('centro'),
    showTenantSwitcher: ref(false),
    switchTenant: vi.fn(),
    teamsItems: ref([[]]),
    tenantShortcuts: ref({}),
    user: ref({ name: 'Ana Torres', avatar: { alt: 'Ana Torres', text: 'AT' } }),
    userItems: ref([[{ label: 'Perfil' }]]),
    getNavigationItems: vi.fn(() => []),
    changeColorMode: vi.fn(),
  }),
}))
vi.mock('@/app/composables/useDashboard', () => ({
  useDashboard: () => ({
    isSidebarOpen: ref(false),
    isSidebarCollapsed: ref(false),
    isSearchOpen: ref(false),
    searchGroups: ref([]),
    openSearch: vi.fn(),
    toggleSidebarOpen: vi.fn(),
    toggleSidebarCollapse: vi.fn(),
  }),
}))
vi.mock('@/features/POS/refunds/composables/usePendingRefundsCount', () => ({
  usePendingRefundsCount: () => ({ count: ref(0) }),
}))
vi.mock('@/features/shipping/delivery-zones/composables/usePendingZoneValidationsCount', () => ({
  usePendingZoneValidationsCount: () => ({ count: ref(0) }),
}))
vi.mock('@/features/notifications/api/notifications.api', () => ({
  notificationsApi: { unreadCount: vi.fn(), list: vi.fn(), getPreferences: vi.fn() },
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

import { notificationsApi } from '@/features/notifications/api/notifications.api'

enableAutoUnmount(afterEach)
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}

async function mountLayout() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = mountWithUApp(DashboardLayout, {
    global: { plugins: [router, [VueQueryPlugin, { queryClient: client }]] },
  })
  await flushPromises()
  return wrapper
}

const BELL = 'button[aria-label^="Notificaciones"]'

beforeEach(() => {
  localStorage.clear()
  auth.tenantId = 'tenant-1'
  auth.authenticated = true
  vi.mocked(notificationsApi.unreadCount).mockReset().mockResolvedValue({ count: 5 })
})

describe('DashboardLayout — notifications bell', () => {
  it('shows the bell with the unread count for an authenticated user with a tenant', async () => {
    const wrapper = await mountLayout()
    const bell = wrapper.get(`.hf-shell-actions ${BELL}`)
    expect(bell.attributes('aria-label')).toBe('Notificaciones, 5 sin leer')
  })

  it('sits between search and the theme button', async () => {
    const wrapper = await mountLayout()
    const buttons = [...wrapper.element.querySelectorAll('.hf-shell-actions button')]
    const label = (el: Element) => el.getAttribute('aria-label') ?? ''
    const search = buttons.findIndex((el) => label(el) === 'Buscar')
    const bell = buttons.findIndex((el) => label(el).startsWith('Notificaciones'))
    const user = buttons.findIndex((el) => label(el) === 'Abrir menú de usuario')
    expect(search).toBeGreaterThanOrEqual(0)
    expect(bell).toBe(search + 1)
    expect(user).toBeGreaterThan(bell + 1) // the color-mode button is in between
  })

  it('without a tenant there is no bell and no request', async () => {
    auth.tenantId = ''
    const wrapper = await mountLayout()
    expect(wrapper.find(BELL).exists()).toBe(false)
    expect(notificationsApi.unreadCount).not.toHaveBeenCalled()
  })

  it('without a session there is no bell and no request', async () => {
    auth.authenticated = false
    const wrapper = await mountLayout()
    expect(wrapper.find(BELL).exists()).toBe(false)
    expect(notificationsApi.unreadCount).not.toHaveBeenCalled()
  })
})
