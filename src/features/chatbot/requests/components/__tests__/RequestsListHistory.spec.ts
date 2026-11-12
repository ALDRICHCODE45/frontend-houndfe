import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import RequestsListHistory from '../RequestsListHistory.vue'
import { makeRow } from '../../interfaces/__tests__/chatbot-request.fixture'
import type { ChatbotRequestRow } from '../../interfaces/chatbot-request.types'

const NOW = new Date('2026-11-11T17:05:00.000Z')

const AppDataTableStub = {
  name: 'AppDataTable',
  props: ['data', 'columns', 'loading', 'error', 'errorMessage', 'emptyState', 'filtered', 'rowOpen', 'showToolbar', 'totalCount', 'displayMode', 'mobileRender'],
  emits: ['refresh'],
  template: `
    <div data-testid="table" :data-loading="loading" :data-error="error">
      <span v-for="c in columns" :key="c.id" data-testid="column-header" :data-column="c.id">{{ c.header }}</span>
      <div v-for="row in data" :key="row.id" data-testid="history-row" @click="rowOpen && rowOpen(row)">
        <slot name="request-cell" :row="{ original: row }" />
        <slot name="customer-cell" :row="{ original: row }" />
        <slot name="status-cell" :row="{ original: row }" />
        <slot name="closed-cell" :row="{ original: row }" />
        <slot name="created-cell" :row="{ original: row }" />
        <slot name="open-cell" :row="{ original: row }" />
      </div>
      <button v-if="error" data-testid="table-retry" @click="$emit('refresh')">retry</button>
      <p v-if="!loading && !error && data.length === 0" data-testid="table-empty">{{ emptyState && emptyState.title }}</p>
      <slot v-if="data.length" name="mobile-card" :row="data[0]" />
    </div>`,
}

async function mountHistory(rows: ChatbotRequestRow[] = [], props: Record<string, unknown> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/chatbot/solicitudes/:id', name: 'chatbot-request-detail', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  const push = vi.spyOn(router, 'push')
  const wrapper = mount(RequestsListHistory, {
    props: { rows, loading: false, error: false, hasNextPage: false, isFetchingNextPage: false, layout: 'table', now: NOW, timeZone: 'America/Mexico_City', ...props },
    global: { plugins: [router], stubs: { AppDataTable: AppDataTableStub } },
  })
  return { wrapper, push }
}

const closed = (patch: Partial<ChatbotRequestRow> = {}) =>
  makeRow({
    id: 'h1',
    folio: 'S-000050',
    summary: 'Zona 44100',
    subtype: 'DELIVERY_ZONE',
    status: 'RESOLVED',
    displayStatus: 'RESOLVED',
    slaLevel: null,
    createdAt: '2026-10-20T15:00:00.000Z',
    closedAt: '2026-11-02T15:00:00.000Z',
    resolvedBy: { id: 'u-1', displayName: 'Ana López' },
    ...patch,
  })

describe('RequestsListHistory — flat table', () => {
  it('uses the shared table, without its own toolbar or pagination, with the history columns', async () => {
    const { wrapper } = await mountHistory([closed()])
    const table = wrapper.getComponent({ name: 'AppDataTable' })
    expect(table.props('showToolbar')).toBe(false)
    expect(table.props('totalCount')).toBe(0)
    expect(wrapper.findAll('[data-testid="column-header"]').map((c) => c.text())).toEqual([
      'Solicitud',
      'Estado',
      'Cierre',
      'Creada',
      'Abrir',
    ])
  })

  it('shows folio, subtype, summary as text, status and the closing line', async () => {
    const { wrapper } = await mountHistory([closed({ summary: '<i>Zona</i>' })])
    const row = wrapper.get('[data-testid="history-row"]')
    expect(row.text()).toContain('<i>Zona</i>')
    expect(row.find('i').exists()).toBe(false)
    expect(row.text()).toContain('S-000050')
    expect(row.text()).toContain('Zona de entrega')
    expect(row.text()).toContain('Resuelta')
    expect(row.get('[data-testid="closed-line"]').text()).toContain('por Ana López')
  })

  it('a cancelled row says why it closed', async () => {
    const { wrapper } = await mountHistory([
      closed({ status: 'CANCELLED', displayStatus: 'CANCELLED', cancelReason: 'SUPERSEDED', mergedInto: { id: 'x', folio: 'S-000049' }, resolvedBy: null }),
    ])
    expect(wrapper.get('[data-testid="closed-line"]').text()).toContain('Fusionada en S-000049')
  })

  it('the summary and the chevron link to the detail; the row click opens it', async () => {
    const { wrapper, push } = await mountHistory([closed()])
    const links = wrapper.findAll('a')
    expect(links.length).toBeGreaterThanOrEqual(1)
    for (const link of links) expect(link.attributes('href')).toBe('/chatbot/solicitudes/h1')
    await wrapper.get('[data-testid="history-row"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'chatbot-request-detail', params: { id: 'h1' } })
  })

  it('has no action buttons in the rows', async () => {
    const { wrapper } = await mountHistory([closed({ allowedActions: ['CLAIM', 'CANCEL'] })])
    expect(wrapper.get('[data-testid="history-row"]').find('button').exists()).toBe(false)
  })
})

describe('RequestsListHistory — «Cliente» column (handoff 14 §15.4)', () => {
  const customer = (patch: Partial<NonNullable<ChatbotRequestRow['customer']>> = {}) => ({
    id: 'c-1',
    displayName: 'Juan Pérez',
    phone: '55 **** 5678',
    isTrusted: false,
    ...patch,
  })
  const headers = (w: Awaited<ReturnType<typeof mountHistory>>['wrapper']) =>
    w.findAll('[data-testid="column-header"]').map((c) => c.text())

  it('adds «Cliente» after «Solicitud» when the rows carry the customer', async () => {
    const { wrapper } = await mountHistory([closed({ customer: customer() })])
    expect(headers(wrapper)).toEqual(['Solicitud', 'Cliente', 'Estado', 'Cierre', 'Creada', 'Abrir'])
  })

  it('shows the name, the phone exactly as the server sent it and «De confianza»', async () => {
    const { wrapper } = await mountHistory([closed({ customer: customer({ isTrusted: true }) })])
    const cell = wrapper.get('[data-testid="history-customer"]')
    expect(cell.text()).toContain('Juan Pérez')
    expect(cell.get('[data-testid="history-customer-phone"]').text()).toBe('55 **** 5678')
    expect(cell.text()).toContain('De confianza')
  })

  it('passes an unmasked phone through untouched and does not mark an untrusted customer', async () => {
    const { wrapper } = await mountHistory([closed({ customer: customer({ phone: '+525512345678' }) })])
    const cell = wrapper.get('[data-testid="history-customer"]')
    expect(cell.get('[data-testid="history-customer-phone"]').text()).toBe('+525512345678')
    expect(cell.text()).not.toContain('De confianza')
  })

  it('an unlinked customer reads «Cliente sin vincular» with its phone', async () => {
    const { wrapper } = await mountHistory([
      closed({ customer: customer({ id: null, displayName: null }) }),
    ])
    const cell = wrapper.get('[data-testid="history-customer"]')
    expect(cell.text()).toContain('Cliente sin vincular')
    expect(cell.get('[data-testid="history-customer-phone"]').text()).toBe('55 **** 5678')
  })

  it('a customer without phone says «Sin teléfono» and the name is shown as text', async () => {
    const { wrapper } = await mountHistory([
      closed({ customer: customer({ displayName: '<b>Ana</b>', phone: null }) }),
    ])
    const cell = wrapper.get('[data-testid="history-customer"]')
    expect(cell.text()).toContain('<b>Ana</b>')
    expect(cell.find('b').exists()).toBe(false)
    expect(cell.get('[data-testid="history-customer-phone"]').text()).toBe('Sin teléfono')
  })

  it('degrades without the column when no row carries a customer (older backend)', async () => {
    const { wrapper } = await mountHistory([closed()])
    expect(headers(wrapper)).not.toContain('Cliente')
    expect(wrapper.find('[data-testid="history-customer"]').exists()).toBe(false)
  })

  it('the mobile card shows the customer above the card', async () => {
    const { wrapper } = await mountHistory([closed({ customer: customer({ isTrusted: true }) })], { layout: 'cards' })
    const line = wrapper.get('[data-testid="history-card-customer"]')
    expect(line.text()).toContain('Juan Pérez')
    expect(line.text()).toContain('55 **** 5678')
    expect(line.text()).toContain('De confianza')
  })
})

describe('RequestsListHistory — states and paging', () => {
  it('passes loading and error through; the retry of the table emits retry', async () => {
    const { wrapper } = await mountHistory([], { loading: true })
    expect(wrapper.getComponent({ name: 'AppDataTable' }).props('loading')).toBe(true)
    const failed = await mountHistory([], { error: true })
    await failed.wrapper.get('[data-testid="table-retry"]').trigger('click')
    expect(failed.wrapper.emitted('retry')).toHaveLength(1)
  })

  it('empty history has its own copy; a filtered one reads as no match', async () => {
    const { wrapper } = await mountHistory([])
    expect(wrapper.getComponent({ name: 'AppDataTable' }).props('emptyState')).toMatchObject({
      title: 'Todavía no hay solicitudes en el historial',
    })
    const filtered = await mountHistory([], { filtered: true })
    expect(filtered.wrapper.getComponent({ name: 'AppDataTable' }).props('filtered')).toBe(true)
  })

  it('«Cargar más» only with a next cursor, busy while fetching', async () => {
    expect((await mountHistory([closed()])).wrapper.find('[data-testid="load-more-history"]').exists()).toBe(false)
    const { wrapper } = await mountHistory([closed()], { hasNextPage: true })
    await wrapper.get('[data-testid="load-more-history"]').trigger('click')
    expect(wrapper.emitted('load-more')).toHaveLength(1)
    const busy = await mountHistory([closed()], { hasNextPage: true, isFetchingNextPage: true })
    expect(busy.wrapper.get('[data-testid="load-more-history"]').attributes('disabled')).toBeDefined()
  })

  it('renders the card layout on mobile', async () => {
    const { wrapper } = await mountHistory([closed()], { layout: 'cards' })
    expect(wrapper.getComponent({ name: 'AppDataTable' }).props('displayMode')).toBe('cards')
    expect(wrapper.find('[data-testid="request-card"]').exists()).toBe(true)
  })
})
