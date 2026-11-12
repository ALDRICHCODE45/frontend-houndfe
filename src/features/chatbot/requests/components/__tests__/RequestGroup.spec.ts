import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref, type Ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import RequestGroup from '../RequestGroup.vue'
import { makeGroup, makeRow } from '../../interfaces/__tests__/chatbot-request.fixture'
import type {
  ChatbotRequestGroup,
  ChatbotRequestRow,
} from '../../interfaces/chatbot-request.types'

const NOW = new Date('2026-11-11T17:05:00.000Z')

const more = vi.hoisted(() => ({
  requests: null as unknown as Ref<ChatbotRequestRow[]>,
  isLoading: null as unknown as Ref<boolean>,
  isFetchingNextPage: null as unknown as Ref<boolean>,
  isError: null as unknown as Ref<boolean>,
  needsReload: null as unknown as Ref<boolean>,
  hasNextPage: null as unknown as Ref<boolean>,
  fetchNextPage: vi.fn(),
  reload: vi.fn(),
  lastOptions: null as null | {
    customerKey: () => string | null | undefined
    status?: () => string | undefined
    filters?: () => Record<string, unknown> | undefined
  },
}))

vi.mock('../../composables/useCustomerRequests', () => ({
  useCustomerRequests: (options: never) => {
    more.lastOptions = options
    return {
      requests: more.requests,
      isLoading: more.isLoading,
      isFetchingNextPage: more.isFetchingNextPage,
      isError: more.isError,
      needsReload: more.needsReload,
      hasNextPage: more.hasNextPage,
      fetchNextPage: more.fetchNextPage,
      reload: more.reload,
    }
  },
}))

beforeEach(() => {
  more.requests = ref([])
  more.isLoading = ref(false)
  more.isFetchingNextPage = ref(false)
  more.isError = ref(false)
  more.needsReload = ref(false)
  more.hasNextPage = ref(false)
  more.fetchNextPage = vi.fn()
  more.reload = vi.fn()
  more.lastOptions = null
})

async function mountGroup(group: ChatbotRequestGroup, props: Record<string, unknown> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/chatbot/solicitudes/:id', name: 'chatbot-request-detail', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  return mount(RequestGroup, {
    props: { group, tab: 'open', layout: 'table', now: NOW, ...props },
    global: { plugins: [router] },
    attachTo: document.body.appendChild(document.createElement('div')),
  })
}

const rows = (n: number, patch: Partial<ChatbotRequestRow> = {}) =>
  Array.from({ length: n }, (_, i) => makeRow({ id: `r${i + 1}`, folio: `S-00000${i + 1}`, ...patch }))

const named = (g: ChatbotRequestGroup): ChatbotRequestGroup => ({
  ...g,
  customer: { id: 'c-1', displayName: 'Ana López', phone: '55 **** 5678', isTrusted: true },
})

describe('RequestGroup — header', () => {
  it('shows name, «De confianza», the phone as the server sent it and the open count', async () => {
    const group = { ...named(makeGroup('k1.a', rows(2))), openCount: 5 }
    const wrapper = await mountGroup(group)
    const head = wrapper.get('[data-testid="group-header"]')
    expect(head.text()).toContain('Ana López')
    expect(head.text()).toContain('De confianza')
    expect(head.get('[data-testid="group-phone"]').text()).toBe('55 **** 5678')
    expect(head.text()).toContain('5 abiertas')
  })

  it('does not mark a customer who is not trusted, and names an unlinked one', async () => {
    const wrapper = await mountGroup(makeGroup('k1.a', rows(1)))
    expect(wrapper.text()).not.toContain('De confianza')
    expect(wrapper.get('[data-testid="group-header"]').text()).toContain('Cliente sin vincular')
  })

  it('shows the phone unmasked only if the server sent it unmasked, and never invents one', async () => {
    const full = { ...makeGroup('k1.a', rows(1)), customer: { id: null, displayName: null, phone: '+525512345678', isTrusted: false } }
    expect((await mountGroup(full)).get('[data-testid="group-phone"]').text()).toBe('+525512345678')
    const none = { ...makeGroup('k1.b', rows(1)), customer: { id: null, displayName: null, phone: null, isTrusted: false } }
    expect((await mountGroup(none)).get('[data-testid="group-phone"]').text()).toBe('Sin teléfono')
  })

  it('counts the overdue rows with the right plural', async () => {
    const overdue = { overdueAt: '2026-11-11T16:00:00.000Z', displayStatus: 'EXPIRED', slaLevel: 'OVERDUE' } as const
    const two = await mountGroup(named(makeGroup('k1.a', [makeRow({ id: 'a', ...overdue }), makeRow({ id: 'b', ...overdue }), makeRow({ id: 'c' })])))
    expect(two.get('[data-testid="group-overdue"]').text()).toContain('2 vencidas')
    const one = await mountGroup(named(makeGroup('k1.b', [makeRow({ id: 'a', ...overdue })])))
    expect(one.get('[data-testid="group-overdue"]').text()).toContain('1 vencida')
    expect(one.get('[data-testid="group-overdue"]').text()).not.toContain('vencidas')
    const none = await mountGroup(named(makeGroup('k1.c', rows(2))))
    expect(none.find('[data-testid="group-overdue"]').exists()).toBe(false)
  })

  it('prefers the exact overdueCount of the backend over the rows on screen', async () => {
    const group = { ...named(makeGroup('k1.a', rows(3))), openCount: 25, overdueCount: 13, moreRequests: 22 }
    const wrapper = await mountGroup(group)
    expect(wrapper.get('[data-testid="group-overdue"]').text()).toContain('13 vencidas')
  })

  it('a backend overdueCount of 1 reads in the singular; 0 shows no badge even with overdue rows loaded', async () => {
    const overdue = { overdueAt: '2026-11-11T16:00:00.000Z', displayStatus: 'EXPIRED', slaLevel: 'OVERDUE' } as const
    const one = await mountGroup({ ...named(makeGroup('k1.a', rows(2))), overdueCount: 1 })
    expect(one.get('[data-testid="group-overdue"]').text()).toContain('1 vencida')
    expect(one.get('[data-testid="group-overdue"]').text()).not.toContain('vencidas')
    const zero = await mountGroup({ ...named(makeGroup('k1.b', [makeRow({ id: 'a', ...overdue })])), overdueCount: 0 })
    expect(zero.find('[data-testid="group-overdue"]').exists()).toBe(false)
  })

  it('the tone dot is the most urgent row of the group', async () => {
    const wrapper = await mountGroup(
      named(makeGroup('k1.a', [makeRow({ id: 'a', slaLevel: 'OK' }), makeRow({ id: 'b', slaLevel: 'ESCALATION' })])),
    )
    expect(wrapper.get('[data-testid="group-tone"]').attributes('data-tone')).toBe('bad')
  })

  it('closed tabs count the closed rows of the group', async () => {
    const closed = rows(2, { status: 'RESOLVED', displayStatus: 'RESOLVED', slaLevel: null, closedAt: '2026-11-11T15:00:00.000Z' })
    const wrapper = await mountGroup({ ...named(makeGroup('k1.a', closed)), openCount: 0, moreRequests: 1 }, { tab: 'resolved' })
    expect(wrapper.get('[data-testid="group-header"]').text()).toContain('3 resueltas')
  })
})

describe('RequestGroup — collapse', () => {
  it('starts expanded and the toggle hides and shows its rows', async () => {
    const wrapper = await mountGroup(named(makeGroup('k1.a', rows(2))))
    const toggle = wrapper.get('[data-testid="group-toggle"]')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(toggle.attributes('aria-label')).toBe('Contraer solicitudes de Ana López')
    expect(wrapper.findAll('[data-testid="request-row"]')).toHaveLength(2)

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(toggle.attributes('aria-label')).toBe('Expandir solicitudes de Ana López')
    expect(wrapper.findAll('[data-testid="request-row"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="group-header"]').exists()).toBe(true)

    await toggle.trigger('click')
    expect(wrapper.findAll('[data-testid="request-row"]')).toHaveLength(2)
  })
})

describe('RequestGroup — «Ver las N restantes»', () => {
  const grouped = () => ({ ...named(makeGroup('k1.big', rows(3))), openCount: 5, moreRequests: 2 })

  it('shows the button only when the group has more requests', async () => {
    expect((await mountGroup(named(makeGroup('k1.a', rows(2))))).find('[data-testid="group-more"]').exists()).toBe(false)
    const wrapper = await mountGroup(grouped())
    expect(wrapper.get('[data-testid="group-more"]').text()).toContain('Ver las 2 restantes')
    expect(more.lastOptions!.customerKey()).toBeNull()
  })

  it('a click asks for the rest of that customer with the tab status, inline', async () => {
    const wrapper = await mountGroup(grouped())
    await wrapper.get('[data-testid="group-more"] button').trigger('click')
    expect(more.lastOptions!.customerKey()).toBe('k1.big')
    expect(more.lastOptions!.status!()).toBe('open')
  })

  it('the expansion uses the active list filters', async () => {
    const filters = { assignee: 'unassigned', subtype: 'COMPLAINT', q: 'rosa' }
    const wrapper = await mountGroup(grouped(), { filters })
    await wrapper.get('[data-testid="group-more"] button').trigger('click')
    expect(more.lastOptions!.filters!()).toEqual(filters)
  })

  it('without filters the expansion sends none', async () => {
    const wrapper = await mountGroup(grouped())
    await wrapper.get('[data-testid="group-more"] button').trigger('click')
    expect(more.lastOptions!.filters?.() ?? {}).toEqual({})
  })

  it('a scheduled tab reads the open requests of the customer', async () => {
    const wrapper = await mountGroup(grouped(), { tab: 'scheduled' })
    await wrapper.get('[data-testid="group-more"] button').trigger('click')
    expect(more.lastOptions!.status!()).toBe('open')
  })

  it('while loading the button is busy and disabled', async () => {
    const wrapper = await mountGroup(grouped())
    await wrapper.get('[data-testid="group-more"] button').trigger('click')
    more.isLoading.value = true
    await nextTick()
    const button = wrapper.get('[data-testid="group-more"] button')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-busy')).toBe('true')
  })

  it('once loaded, the group lists its rows plus the new ones and the button goes away', async () => {
    const wrapper = await mountGroup(grouped())
    await wrapper.get('[data-testid="group-more"] button').trigger('click')
    more.requests.value = rows(5)
    await nextTick()
    expect(wrapper.findAll('[data-testid="request-row"]').map((r) => r.text().match(/S-\d{6}/)![0])).toEqual([
      'S-000001',
      'S-000002',
      'S-000003',
      'S-000004',
      'S-000005',
    ])
    expect(wrapper.find('[data-testid="group-more"]').exists()).toBe(false)
  })

  it('a customer with more than one page offers «Cargar más solicitudes»', async () => {
    const wrapper = await mountGroup(grouped())
    await wrapper.get('[data-testid="group-more"] button').trigger('click')
    more.requests.value = rows(5)
    more.hasNextPage.value = true
    await nextTick()
    await wrapper.get('[data-testid="group-more-page"] button').trigger('click')
    expect(more.fetchNextPage).toHaveBeenCalledTimes(1)
  })

  it('an error keeps the rows and offers a retry', async () => {
    const wrapper = await mountGroup(grouped())
    await wrapper.get('[data-testid="group-more"] button').trigger('click')
    more.isError.value = true
    await nextTick()
    const error = wrapper.get('[data-testid="group-more-error"]')
    expect(error.text()).toContain('No se pudieron cargar las solicitudes restantes')
    expect(wrapper.findAll('[data-testid="request-row"]')).toHaveLength(3)
    await error.get('button').trigger('click')
    expect(more.reload).toHaveBeenCalledTimes(1)
  })

  it('a stale customerKey is reported to the list instead of retried', async () => {
    const wrapper = await mountGroup(grouped())
    await wrapper.get('[data-testid="group-more"] button').trigger('click')
    more.needsReload.value = true
    await nextTick()
    expect(wrapper.emitted('stale')).toHaveLength(1)
    expect(wrapper.find('[data-testid="group-more-error"]').exists()).toBe(false)
  })
})

describe('RequestGroup — card layout (mobile)', () => {
  it('is a labelled section with the header line, cards and the «Ver las N restantes» button', async () => {
    const overdue = { overdueAt: '2026-11-11T16:00:00.000Z', displayStatus: 'EXPIRED', slaLevel: 'OVERDUE' } as const
    const group = {
      ...named(makeGroup('k1.m', [makeRow({ id: 'a', ...overdue }), makeRow({ id: 'b' })])),
      openCount: 4,
      moreRequests: 2,
    }
    const wrapper = await mountGroup(group, { layout: 'cards' })
    const section = wrapper.get('section[data-testid="request-group"]')
    expect(section.attributes('aria-label')).toBe('Ana López')
    expect(section.find('tr').exists()).toBe(false)
    expect(section.findAll('[data-testid="request-card"]')).toHaveLength(2)
    const head = section.get('[data-testid="group-header"]')
    expect(head.text()).toContain('Ana López')
    expect(head.text()).toContain('4 abiertas')
    expect(head.text()).toContain('1 vencida')
    expect(section.get('[data-testid="group-more"]').text()).toContain('Ver las 2 restantes')
  })

  it('collapses on the header toggle too', async () => {
    const wrapper = await mountGroup(named(makeGroup('k1.m', rows(2))), { layout: 'cards' })
    await wrapper.get('[data-testid="group-toggle"]').trigger('click')
    expect(wrapper.findAll('[data-testid="request-card"]')).toHaveLength(0)
  })
})
