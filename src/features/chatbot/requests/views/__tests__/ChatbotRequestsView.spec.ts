import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref, type Ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import ChatbotRequestsView from '../ChatbotRequestsView.vue'
import { countsFixture, makeGroup, makeRow } from '../../interfaces/__tests__/chatbot-request.fixture'
import type {
  ChatbotRequestCounts,
  ChatbotRequestGroup,
  ChatbotRequestRow,
} from '../../interfaces/chatbot-request.types'

// ── mocks ─────────────────────────────────────────────────────────────────────

const mobile = vi.hoisted(() => ({ value: null as unknown as Ref<boolean> }))
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => mobile.value }) }
})

const access = vi.hoisted(() => ({ canRead: null as unknown as Ref<boolean> }))
vi.mock('../../composables/useRequestAccess', async () => {
  const { computed } = await vi.importActual<typeof import('vue')>('vue')
  return {
    useRequestAccess: () => ({
      tenantId: computed(() => 'tenant-1'),
      canRead: access.canRead,
      enabled: access.canRead,
    }),
  }
})

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ user: { id: 'u-me', name: 'Laura' } }),
}))

const countsState = vi.hoisted(() => ({ counts: null as unknown as Ref<ChatbotRequestCounts | null> }))
vi.mock('../../composables/useRequestCounts', () => ({
  useRequestCounts: () => ({ counts: countsState.counts, isEnabled: ref(true) }),
}))

const groupsState = vi.hoisted(() => ({
  groups: null as unknown as Ref<ChatbotRequestGroup[]>,
  isLoading: null as unknown as Ref<boolean>,
  isError: null as unknown as Ref<boolean>,
  needsReload: null as unknown as Ref<boolean>,
  hasNextPage: null as unknown as Ref<boolean>,
  isFetchingNextPage: null as unknown as Ref<boolean>,
  fetchNextPage: vi.fn(),
  reload: vi.fn(),
  calls: 0,
  filters: null as null | (() => Record<string, unknown>),
}))
vi.mock('../../composables/useRequestGroups', () => ({
  useRequestGroups: (options: { filters: () => Record<string, unknown> }) => {
    groupsState.calls += 1
    groupsState.filters = options.filters
    return {
      groups: groupsState.groups,
      isEnabled: ref(true),
      isLoading: groupsState.isLoading,
      isFetching: ref(false),
      isFetchingNextPage: groupsState.isFetchingNextPage,
      isPlaceholder: ref(false),
      isError: groupsState.isError,
      error: ref(null),
      needsReload: groupsState.needsReload,
      hasNextPage: groupsState.hasNextPage,
      fetchNextPage: groupsState.fetchNextPage,
      reload: groupsState.reload,
    }
  },
}))

const historyState = vi.hoisted(() => ({
  requests: null as unknown as Ref<ChatbotRequestRow[]>,
  isLoading: null as unknown as Ref<boolean>,
  isError: null as unknown as Ref<boolean>,
  needsReload: null as unknown as Ref<boolean>,
  hasNextPage: null as unknown as Ref<boolean>,
  isFetchingNextPage: null as unknown as Ref<boolean>,
  fetchNextPage: vi.fn(),
  reload: vi.fn(),
  calls: 0,
  filters: null as null | (() => Record<string, unknown>),
}))
vi.mock('../../composables/useRequestHistory', () => ({
  useRequestHistory: (options: { filters: () => Record<string, unknown> }) => {
    historyState.calls += 1
    historyState.filters = options.filters
    return {
      requests: historyState.requests,
      isEnabled: ref(true),
      isLoading: historyState.isLoading,
      isFetching: ref(false),
      isFetchingNextPage: historyState.isFetchingNextPage,
      isError: historyState.isError,
      error: ref(null),
      needsReload: historyState.needsReload,
      hasNextPage: historyState.hasNextPage,
      fetchNextPage: historyState.fetchNextPage,
      reload: historyState.reload,
    }
  },
}))

const customerState = vi.hoisted(() => ({ needsReload: null as unknown as Ref<boolean> }))
vi.mock('../../composables/useCustomerRequests', () => ({
  useCustomerRequests: () => ({
    requests: ref([]),
    isLoading: ref(false),
    isFetchingNextPage: ref(false),
    isError: ref(false),
    needsReload: customerState.needsReload,
    hasNextPage: ref(false),
    fetchNextPage: vi.fn(),
    reload: vi.fn(),
  }),
}))

const AppDataTableStub = {
  name: 'AppDataTable',
  props: ['data', 'loading', 'error', 'emptyState', 'filtered'],
  emits: ['refresh', 'clear-filters'],
  template: `<div data-testid="history-table">
    <div v-for="row in data" :key="row.id" data-testid="history-row">{{ row.folio }}</div>
    <button v-if="error" data-testid="table-retry" @click="$emit('refresh')">retry</button>
    <p v-if="!loading && !error && !data.length" data-testid="table-empty">{{ emptyState.title }}</p>
  </div>`,
}

beforeEach(() => {
  mobile.value = ref(false)
  access.canRead = ref(true)
  countsState.counts = ref(countsFixture)
  groupsState.groups = ref([])
  groupsState.isLoading = ref(false)
  groupsState.isError = ref(false)
  groupsState.needsReload = ref(false)
  groupsState.hasNextPage = ref(false)
  groupsState.isFetchingNextPage = ref(false)
  groupsState.fetchNextPage = vi.fn()
  groupsState.reload = vi.fn()
  groupsState.calls = 0
  groupsState.filters = null
  historyState.requests = ref([])
  historyState.isLoading = ref(false)
  historyState.isError = ref(false)
  historyState.needsReload = ref(false)
  historyState.hasNextPage = ref(false)
  historyState.isFetchingNextPage = ref(false)
  historyState.fetchNextPage = vi.fn()
  historyState.reload = vi.fn()
  historyState.calls = 0
  historyState.filters = null
  customerState.needsReload = ref(false)
})

afterEach(() => {
  vi.useRealTimers()
})

async function mountView(url = '/chatbot/solicitudes') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/chatbot/solicitudes', name: 'chatbot-requests', component: { template: '<div />' } },
      { path: '/chatbot/solicitudes/:id', name: 'chatbot-request-detail', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(ChatbotRequestsView, {
    global: { plugins: [router], stubs: { AppDataTable: AppDataTableStub } },
    attachTo: document.body.appendChild(document.createElement('div')),
  })
  await flushPromises()
  return { wrapper, router }
}

const group = (key: string, rows: ChatbotRequestRow[], patch: Partial<ChatbotRequestGroup> = {}): ChatbotRequestGroup => ({
  ...makeGroup(key, rows),
  customer: { id: 'c-1', displayName: 'Ana López', phone: '55 **** 5678', isTrusted: true },
  ...patch,
})
const withData = (extra: Partial<ChatbotRequestRow> = {}) => {
  groupsState.groups.value = [group('k1.a', [makeRow({ id: 'a1', customerKey: 'k1.a', ...extra })])]
}
const tab = (wrapper: Awaited<ReturnType<typeof mountView>>['wrapper'], label: string) =>
  wrapper.findAll('[data-testid="list-tab"]').find((t) => t.text().startsWith(label))!
const query = (r: Awaited<ReturnType<typeof mountView>>['router']) => r.currentRoute.value.query

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ChatbotRequestsView — header', () => {
  it('shows «Solicitudes», the open count and the counts line', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.get('h1').text()).toBe('Solicitudes')
    expect(wrapper.get('[data-testid="open-count"]').text()).toBe('11 abiertas')
    expect(wrapper.get('[data-testid="counts-line"]').text()).toContain('7 nuevas · 4 en atención · 1 vencida')
  })
})

describe('ChatbotRequestsView — forbidden', () => {
  it('without read:ChatbotRequest it shows the forbidden state and nothing else', async () => {
    access.canRead.value = false
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('No tienes permiso para ver las solicitudes del chatbot')
    expect(wrapper.find('[data-kind="forbidden"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="list-tab"]').exists()).toBe(false)
    expect(groupsState.calls).toBe(0)
    expect(historyState.calls).toBe(0)
  })
})

describe('ChatbotRequestsView — tabs', () => {
  it('opens on «Abiertas» asking for status open', async () => {
    const { wrapper } = await mountView()
    expect(tab(wrapper, 'Abiertas').attributes('aria-pressed')).toBe('true')
    expect(groupsState.filters!()).toEqual({ status: 'open' })
  })

  it.each([
    ['Agendadas', 'scheduled'],
    ['Resueltas', 'resolved'],
    ['Canceladas', 'cancelled'],
  ])('«%s» → ?tab=%s and status %s', async (label, status) => {
    const { wrapper, router } = await mountView()
    await tab(wrapper, label).trigger('click')
    await flushPromises()
    expect(query(router).tab).toBe(status)
    expect(groupsState.filters!()).toMatchObject({ status })
    expect(tab(wrapper, label).attributes('aria-pressed')).toBe('true')
  })

  it('going back to «Abiertas» drops tab from the URL', async () => {
    const { wrapper, router } = await mountView('/chatbot/solicitudes?tab=resolved')
    await tab(wrapper, 'Abiertas').trigger('click')
    await flushPromises()
    expect(query(router).tab).toBeUndefined()
    expect(groupsState.filters!()).toEqual({ status: 'open' })
  })

  it('«Historial» uses the history list, flat, and never the groups one', async () => {
    historyState.requests.value = [
      makeRow({ id: 'h1', folio: 'S-000050', status: 'RESOLVED', displayStatus: 'RESOLVED', slaLevel: null }),
    ]
    const { wrapper, router } = await mountView()
    const groupsBefore = groupsState.calls
    await tab(wrapper, 'Historial').trigger('click')
    await flushPromises()
    expect(query(router).tab).toBe('history')
    expect(historyState.calls).toBe(1)
    expect(historyState.filters!()).toEqual({})
    expect(wrapper.get('[data-testid="history-row"]').text()).toBe('S-000050')
    expect(wrapper.find('[data-testid="request-group"]').exists()).toBe(false)
    expect(groupsState.calls).toBe(groupsBefore)
  })

  it('the history keeps the subtype filter, and hides the search and the chips', async () => {
    const { wrapper } = await mountView('/chatbot/solicitudes?tab=history&subtype=RESTOCK&mine=1&q=ana')
    expect(historyState.filters!()).toEqual({ subtype: 'RESTOCK' })
    expect(wrapper.find('input[type="search"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="chip-mine"]').exists()).toBe(false)
  })
})

describe('ChatbotRequestsView — chips', () => {
  it('each chip writes the URL and becomes an API param', async () => {
    const { wrapper, router } = await mountView()
    await wrapper.get('[data-testid="chip-mine"]').trigger('click')
    await flushPromises()
    expect(query(router).mine).toBe('1')
    expect(groupsState.filters!()).toEqual({ status: 'open', assignee: 'me' })

    await wrapper.get('[data-testid="chip-overdue"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="chip-windowClosingSoon"]').trigger('click')
    await flushPromises()
    expect(query(router)).toMatchObject({ mine: '1', overdue: '1', window: '1' })
    expect(groupsState.filters!()).toEqual({
      status: 'open',
      assignee: 'me',
      overdue: true,
      windowClosingSoon: true,
    })
  })

  it('«Sin responsable» replaces «Mías» (one assignee)', async () => {
    const { wrapper, router } = await mountView('/chatbot/solicitudes?mine=1')
    await wrapper.get('[data-testid="chip-unassigned"]').trigger('click')
    await flushPromises()
    expect(query(router).mine).toBeUndefined()
    expect(query(router).unassigned).toBe('1')
    expect(groupsState.filters!()).toEqual({ status: 'open', assignee: 'unassigned' })
    expect(wrapper.get('[data-testid="chip-mine"]').attributes('aria-pressed')).toBe('false')
  })

  it('a second click turns the chip off and removes it from the URL', async () => {
    const { wrapper, router } = await mountView('/chatbot/solicitudes?overdue=1')
    await wrapper.get('[data-testid="chip-overdue"]').trigger('click')
    await flushPromises()
    expect(query(router).overdue).toBeUndefined()
    expect(groupsState.filters!()).toEqual({ status: 'open' })
  })

  it('the subtype select writes ?subtype= and the param', async () => {
    const { wrapper, router } = await mountView()
    await wrapper.get('select').setValue('COMPLAINT')
    await flushPromises()
    expect(query(router).subtype).toBe('COMPLAINT')
    expect(groupsState.filters!()).toEqual({ status: 'open', subtype: 'COMPLAINT' })
  })

  it('reads the whole state from the URL on load', async () => {
    const { wrapper } = await mountView(
      '/chatbot/solicitudes?tab=scheduled&q=Ana&unassigned=1&window=1&subtype=RESTOCK',
    )
    expect(groupsState.filters!()).toEqual({
      status: 'scheduled',
      q: 'Ana',
      assignee: 'unassigned',
      windowClosingSoon: true,
      subtype: 'RESTOCK',
    })
    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('Ana')
  })

  it('keeps unrelated URL params when filters change', async () => {
    const { wrapper, router } = await mountView('/chatbot/solicitudes?utm=x')
    await wrapper.get('[data-testid="chip-mine"]').trigger('click')
    await flushPromises()
    expect(query(router)).toMatchObject({ utm: 'x', mine: '1' })
  })
})

describe('ChatbotRequestsView — search', () => {
  it('waits for the typing to stop before it changes the URL and the params', async () => {
    const { wrapper, router } = await mountView()
    vi.useFakeTimers()
    const input = wrapper.get('input[type="search"]')
    await input.setValue('A')
    await input.setValue('An')
    await input.setValue('Ana')
    await vi.advanceTimersByTimeAsync(250)
    expect(query(router).q).toBeUndefined()
    expect(groupsState.filters!()).toEqual({ status: 'open' })
    await vi.advanceTimersByTimeAsync(100)
    await flushPromises()
    expect(query(router).q).toBe('Ana')
    expect(groupsState.filters!()).toEqual({ status: 'open', q: 'Ana' })
  })

  it('sends at most 100 characters', async () => {
    const { wrapper, router } = await mountView()
    vi.useFakeTimers()
    await wrapper.get('input[type="search"]').setValue('x'.repeat(150))
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    expect(String(query(router).q)).toHaveLength(100)
    expect((groupsState.filters!() as { q: string }).q).toHaveLength(100)
  })

  it('clearing the box removes q', async () => {
    const { wrapper, router } = await mountView('/chatbot/solicitudes?q=Ana')
    vi.useFakeTimers()
    await wrapper.get('input[type="search"]').setValue('')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    expect(query(router).q).toBeUndefined()
    expect(groupsState.filters!()).toEqual({ status: 'open' })
  })
})

describe('ChatbotRequestsView — data', () => {
  it('renders the groups table with the grouped rows', async () => {
    withData()
    const { wrapper } = await mountView()
    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.get('[data-testid="group-header"]').text()).toContain('Ana López')
    expect(wrapper.findAll('[data-testid="request-row"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="list-skeleton"]').exists()).toBe(false)
  })

  it('«Cargar más clientes» asks the next cursor', async () => {
    withData()
    groupsState.hasNextPage.value = true
    const { wrapper } = await mountView()
    await wrapper.get('[data-testid="load-more-groups"]').trigger('click')
    expect(groupsState.fetchNextPage).toHaveBeenCalledTimes(1)
  })

  it('the table sits on the shared table surface', async () => {
    withData()
    const { wrapper } = await mountView()
    expect(wrapper.find('.hf-table-surface').exists()).toBe(true)
  })
})

describe('ChatbotRequestsView — out of hours', () => {
  it('shows the banner with «se reanudan …» when the visible rows are paused', async () => {
    withData({ slaPaused: true, slaResumesAt: '2099-01-02T15:00:00.000Z' })
    const { wrapper } = await mountView()
    const banner = wrapper.get('[data-testid="paused-banner"]')
    expect(banner.text()).toContain('Fuera de horario de atención')
    expect(banner.text()).toContain('se reanudan')
  })

  it('no banner while the clock runs', async () => {
    withData()
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="paused-banner"]').exists()).toBe(false)
  })
})

describe('ChatbotRequestsView — states', () => {
  it('loading: skeleton, no table and no empty message', async () => {
    groupsState.isLoading.value = true
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="list-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.find('[data-kind="empty"]').exists()).toBe(false)
  })

  it('loading on mobile uses card skeletons', async () => {
    mobile.value.value = true
    groupsState.isLoading.value = true
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="skeleton-card"]').exists()).toBe(true)
  })

  it.each([
    ['', 'No hay solicitudes abiertas'],
    ['?tab=scheduled', 'No hay solicitudes agendadas'],
    ['?tab=resolved', 'No hay solicitudes resueltas en los últimos 7 días'],
    ['?tab=cancelled', 'No hay solicitudes canceladas en los últimos 7 días'],
    ['?tab=history', 'Todavía no hay solicitudes en el historial'],
  ])('empty %s → «%s»', async (search, title) => {
    const { wrapper } = await mountView(`/chatbot/solicitudes${search}`)
    expect(wrapper.text()).toContain(title)
  })

  it('empty with filters reads as no match and «Quitar filtros» clears them', async () => {
    const { wrapper, router } = await mountView('/chatbot/solicitudes?tab=resolved&q=Zeta&mine=1&subtype=RESTOCK&utm=x')
    expect(wrapper.text()).toContain('Sin resultados para «Zeta»')
    expect(wrapper.find('[data-kind="no-match"]').exists()).toBe(true)
    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    await flushPromises()
    expect(query(router)).toEqual({ tab: 'resolved', utm: 'x' })
    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('')
  })

  it('error: message and «Reintentar», which reloads the groups', async () => {
    groupsState.isError.value = true
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-kind="error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No pudimos cargar las solicitudes')
    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    expect(groupsState.reload).toHaveBeenCalledTimes(1)
  })

  it('error with groups already on screen keeps the groups', async () => {
    withData()
    groupsState.isError.value = true
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="request-row"]').exists()).toBe(true)
    expect(wrapper.find('[data-kind="error"]').exists()).toBe(false)
  })

  it('stale token: «La lista cambió, recarga» with a reload action', async () => {
    groupsState.isError.value = true
    groupsState.needsReload.value = true
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('La lista cambió, recarga')
    expect(wrapper.text()).not.toContain('No pudimos cargar las solicitudes')
    const action = wrapper.get('[data-testid="empty-state-action"]')
    expect(action.text()).toBe('Recargar')
    await action.trigger('click')
    expect(groupsState.reload).toHaveBeenCalledTimes(1)
  })

  it('a group whose customerKey went stale shows the same state; reloading clears it', async () => {
    withData()
    groupsState.groups.value = [{ ...groupsState.groups.value[0]!, moreRequests: 3 }]
    const { wrapper } = await mountView()
    await wrapper.get('[data-testid="group-more"] button').trigger('click')
    customerState.needsReload.value = true
    await flushPromises()
    expect(wrapper.text()).toContain('La lista cambió, recarga')
    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    await flushPromises()
    expect(groupsState.reload).toHaveBeenCalledTimes(1)
  })

  it('history error and retry', async () => {
    historyState.isError.value = true
    const { wrapper } = await mountView('/chatbot/solicitudes?tab=history')
    await wrapper.get('[data-testid="table-retry"]').trigger('click')
    expect(historyState.reload).toHaveBeenCalledTimes(1)
  })

  it('history «Cargar más» asks the next cursor', async () => {
    historyState.requests.value = [makeRow({ id: 'h1', status: 'RESOLVED', displayStatus: 'RESOLVED', slaLevel: null })]
    historyState.hasNextPage.value = true
    const { wrapper } = await mountView('/chatbot/solicitudes?tab=history')
    await wrapper.get('[data-testid="load-more-history"]').trigger('click')
    expect(historyState.fetchNextPage).toHaveBeenCalledTimes(1)
  })
})

describe('ChatbotRequestsView — mobile', () => {
  it('below 768 px the rows are cards and the table is gone', async () => {
    mobile.value.value = true
    withData()
    const { wrapper } = await mountView()
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.find('section[data-testid="request-group"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="request-card"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="request-row"]').exists()).toBe(false)
  })

  it('on desktop the same data is a table', async () => {
    withData()
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="request-card"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="request-row"]').exists()).toBe(true)
  })
})

describe('ChatbotRequestsView — row link', () => {
  it('a row links to chatbot-request-detail with its id', async () => {
    withData({ id: 'req-77' })
    const { wrapper } = await mountView()
    expect(wrapper.get('a.chatbot-row__link').attributes('href')).toBe('/chatbot/solicitudes/req-77')
  })

  it('«por ti» for the signed-in user (auth store id)', async () => {
    withData({ status: 'IN_PROGRESS', displayStatus: 'IN_PROGRESS', assignee: { id: 'u-me', displayName: 'Laura' } })
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('En atención · por ti')
  })
})
