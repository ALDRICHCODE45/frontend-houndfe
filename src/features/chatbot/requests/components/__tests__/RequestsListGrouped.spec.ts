import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import RequestsListGrouped from '../RequestsListGrouped.vue'
import { makeGroup, makeRow } from '../../interfaces/__tests__/chatbot-request.fixture'

const NOW = new Date('2026-11-11T17:05:00.000Z')

const more = vi.hoisted(() => ({ needsReload: null as unknown as import('vue').Ref<boolean> }))
vi.mock('../../composables/useCustomerRequests', () => ({
  useCustomerRequests: () => ({
    requests: ref([]),
    isLoading: ref(false),
    isFetchingNextPage: ref(false),
    isError: ref(false),
    needsReload: more.needsReload,
    hasNextPage: ref(false),
    fetchNextPage: vi.fn(),
    reload: vi.fn(),
  }),
}))

beforeEach(() => {
  more.needsReload = ref(false)
})

const groups = () => [
  { ...makeGroup('k1.a', [makeRow({ id: 'a1', customerKey: 'k1.a' })]), openCount: 1 },
  { ...makeGroup('k1.b', [makeRow({ id: 'b1', customerKey: 'k1.b' }), makeRow({ id: 'b2', customerKey: 'k1.b' })]), openCount: 2 },
]

async function mountGrouped(props: Record<string, unknown> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/chatbot/solicitudes/:id', name: 'chatbot-request-detail', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  return mount(RequestsListGrouped, {
    props: {
      groups: groups(),
      tab: 'open',
      layout: 'table',
      hasNextPage: false,
      isFetchingNextPage: false,
      now: NOW,
      ...props,
    },
    global: { plugins: [router] },
  })
}

describe('RequestsListGrouped — table', () => {
  it('is a real table: columns Solicitud, Estado, Tiempo, Antigüedad and an «Abrir» column', async () => {
    const wrapper = await mountGrouped()
    const heads = wrapper.findAll('thead th')
    expect(heads.map((h) => h.text())).toEqual(['Solicitud', 'Estado', 'Tiempo', 'Antigüedad', 'Abrir'])
    for (const head of heads) expect(head.attributes('scope')).toBe('col')
    expect(wrapper.get('table').attributes('aria-label')).toBe('Solicitudes por cliente')
  })

  it('one tbody per customer group, rows inside it', async () => {
    const wrapper = await mountGrouped()
    const bodies = wrapper.findAll('tbody[data-testid="request-group"]')
    expect(bodies).toHaveLength(2)
    expect(bodies[1]!.findAll('[data-testid="request-row"]')).toHaveLength(2)
  })

  it('closed tabs name the column «Cierre»', async () => {
    const wrapper = await mountGrouped({ tab: 'resolved' })
    expect(wrapper.findAll('thead th')[2]!.text()).toBe('Cierre')
  })

  it('shows the SLA legend on the open tab only', async () => {
    expect((await mountGrouped()).find('.chatbot-legend').exists()).toBe(true)
    expect((await mountGrouped({ tab: 'resolved' })).find('.chatbot-legend').exists()).toBe(false)
    expect((await mountGrouped({ tab: 'scheduled' })).find('.chatbot-legend').exists()).toBe(false)
  })
})

describe('RequestsListGrouped — footer and «Cargar más clientes»', () => {
  it('counts the loaded customers and has no button without a next cursor', async () => {
    const wrapper = await mountGrouped()
    const foot = wrapper.get('[data-testid="list-footer"]')
    expect(foot.text()).toContain('2 clientes cargados')
    expect(wrapper.find('[data-testid="load-more-groups"]').exists()).toBe(false)
  })

  it('singular for one customer', async () => {
    const wrapper = await mountGrouped({ groups: groups().slice(0, 1) })
    expect(wrapper.get('[data-testid="list-footer"]').text()).toContain('1 cliente cargado')
  })

  it('offers «Cargar más clientes» with a next cursor and emits load-more', async () => {
    const wrapper = await mountGrouped({ hasNextPage: true })
    const button = wrapper.get('[data-testid="load-more-groups"]')
    expect(button.text()).toBe('Cargar más clientes')
    await button.trigger('click')
    expect(wrapper.emitted('load-more')).toHaveLength(1)
  })

  it('while loading the next page the button is busy and disabled', async () => {
    const wrapper = await mountGrouped({ hasNextPage: true, isFetchingNextPage: true })
    const button = wrapper.get('[data-testid="load-more-groups"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-busy')).toBe('true')
  })
})

describe('RequestsListGrouped — cards (mobile)', () => {
  it('has no table: sections with cards', async () => {
    const wrapper = await mountGrouped({ layout: 'cards' })
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.findAll('section[data-testid="request-group"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="request-card"]')).toHaveLength(3)
  })

  it('keeps the footer and the legend (open tab) on mobile', async () => {
    const wrapper = await mountGrouped({ layout: 'cards', hasNextPage: true })
    expect(wrapper.find('.chatbot-legend').exists()).toBe(true)
    expect(wrapper.find('[data-testid="load-more-groups"]').exists()).toBe(true)
  })
})

describe('RequestsListGrouped — stale customerKey', () => {
  it('re-emits the stale event of a group so the view can ask for a reload', async () => {
    const wrapper = await mountGrouped()
    wrapper.findAllComponents({ name: 'RequestGroup' })[0]!.vm.$emit('stale')
    expect(wrapper.emitted('stale')).toHaveLength(1)
  })
})
