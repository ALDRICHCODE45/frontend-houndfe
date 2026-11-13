import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import RequestGroupRow from '../RequestGroupRow.vue'
import { makeRow } from '../../interfaces/__tests__/chatbot-request.fixture'
import type { ChatbotRequestRow } from '../../interfaces/chatbot-request.types'

const NOW = new Date('2026-11-11T17:05:00.000Z') // Wed 11 nov, 11:05 in Mexico City
const TZ = 'America/Mexico_City'

function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/chatbot/solicitudes', name: 'chatbot-requests', component: { template: '<div />' } },
      { path: '/chatbot/solicitudes/:id', name: 'chatbot-request-detail', component: { template: '<div />' } },
    ],
  })
  return router
}

async function mountRow(
  row: Partial<ChatbotRequestRow> = {},
  props: Record<string, unknown> = {},
) {
  const router = makeRouter()
  await router.push('/chatbot/solicitudes')
  await router.isReady()
  const push = vi.spyOn(router, 'push')
  const wrapper = mount(RequestGroupRow, {
    props: { row: makeRow(row), layout: 'table', tab: 'open', customerName: 'Ana López', now: NOW, timeZone: TZ, ...props },
    global: { plugins: [router] },
    attachTo: document.body.appendChild(document.createElement('div')),
  })
  return { wrapper, router, push }
}

describe('RequestGroupRow — table layout', () => {
  it('shows the summary, folio, subtype, status, SLA and age', async () => {
    const { wrapper } = await mountRow({ createdAt: '2026-11-11T17:00:00.000Z' })
    const row = wrapper.get('[data-testid="request-row"]')
    expect(row.element.tagName).toBe('TR')
    expect(row.text()).toContain('Croquetas 15 kg')
    expect(row.text()).toContain('S-000001')
    expect(row.text()).toContain('Reposición')
    expect(row.text()).toContain('Nueva')
    expect(row.find('[data-testid="sla-indicator"]').exists()).toBe(true)
    expect(row.get('[data-testid="request-age"]').text()).toBe('5 min')
  })

  it('renders the bot summary as text, never as HTML', async () => {
    const { wrapper } = await mountRow({ summary: '<b>Hola</b> <img src=x onerror=alert(1)>' })
    expect(wrapper.text()).toContain('<b>Hola</b>')
    // The SLA light renders its own <b>, so look inside the summary link only.
    expect(wrapper.get('a.chatbot-row__link').find('b').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('the summary link and the chevron point to the detail of the request', async () => {
    const { wrapper } = await mountRow({ id: 'req-7', folio: 'S-000007' })
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(2)
    for (const link of links) expect(link.attributes('href')).toBe('/chatbot/solicitudes/req-7')
    expect(links[1]!.attributes('aria-label')).toBe('Abrir S-000007')
  })

  it('has no action buttons: allowedActions are not rendered in the list', async () => {
    const { wrapper } = await mountRow({ allowedActions: ['CLAIM', 'RESOLVE', 'CANCEL'] })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/Atender|Resolver|Cancelar|Tomar/)
  })

  it('has no checkbox', async () => {
    const { wrapper } = await mountRow()
    expect(wrapper.find('input[type="checkbox"], [role="checkbox"]').exists()).toBe(false)
  })

  it('a click on the row opens the detail once; a click on its link is not doubled', async () => {
    const { wrapper, push } = await mountRow({ id: 'req-3' })
    await wrapper.get('[data-testid="request-row"]').trigger('click')
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith({ name: 'chatbot-request-detail', params: { id: 'req-3' } })
    push.mockClear()
    await wrapper.get('a').trigger('click')
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('Enter on the focused row opens the detail', async () => {
    const { wrapper, push } = await mountRow({ id: 'req-4' })
    await wrapper.get('[data-testid="request-row"]').trigger('keydown', { key: 'Enter' })
    expect(push).toHaveBeenCalledWith({ name: 'chatbot-request-detail', params: { id: 'req-4' } })
  })

  it('does not open the detail while the user is selecting text', async () => {
    const { wrapper, push } = await mountRow()
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'Croquetas' } as Selection)
    await wrapper.get('[data-testid="request-row"]').trigger('click')
    expect(push).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('names the row for assistive tech with folio, subtype and customer', async () => {
    const { wrapper } = await mountRow()
    expect(wrapper.get('[data-testid="request-row"]').attributes('aria-label')).toBe(
      'S-000001, Reposición, Ana López. Abrir detalle',
    )
  })

  it('«por X» of the assignee, «por ti» for the signed-in user', async () => {
    const assignee = { id: 'u-1', displayName: 'Luis Ortega' }
    const row = { status: 'IN_PROGRESS', displayStatus: 'IN_PROGRESS', assignee } as const
    expect((await mountRow(row)).wrapper.text()).toContain('En atención · por Luis Ortega')
    expect((await mountRow(row, { currentUserId: 'u-1' })).wrapper.text()).toContain('En atención · por ti')
  })

  it('«Vencida» is red and said in words', async () => {
    const { wrapper } = await mountRow({
      status: 'IN_PROGRESS',
      displayStatus: 'EXPIRED',
      slaLevel: 'OVERDUE',
      overdueAt: '2026-11-11T16:00:00.000Z',
    })
    expect(wrapper.text()).toContain('Vencida')
    expect(wrapper.get('[data-testid="sla-indicator"]').attributes('data-tone')).toBe('bad')
  })

  it('shows the WhatsApp window tag only when it closes within 2 hours', async () => {
    const soon = await mountRow({ whatsappWindowClosesAt: '2026-11-11T18:20:00.000Z' })
    expect(soon.wrapper.get('[data-testid="window-tag"]').text()).toContain('Ventana de 24 h cierra en 1 h 15 min')
    const far = await mountRow({ whatsappWindowClosesAt: '2026-11-12T10:00:00.000Z' })
    expect(far.wrapper.find('[data-testid="window-tag"]').exists()).toBe(false)
  })

  it('a paused row says «se reanuda …» through the SLA indicator', async () => {
    const { wrapper } = await mountRow({
      slaPaused: true,
      slaResumesAt: '2026-11-12T15:00:00.000Z',
      slaLevel: 'OK',
    })
    expect(wrapper.get('[data-testid="sla-indicator"]').text()).toContain('se reanuda mañana 9:00')
  })
})

describe('RequestGroupRow — closed tabs', () => {
  const resolved = {
    status: 'RESOLVED',
    displayStatus: 'RESOLVED',
    slaLevel: null,
    closedAt: '2026-11-11T15:00:00.000Z',
    resolvedBy: { id: 'u-1', displayName: 'Ana López' },
  } as const

  it('resolved: «Resuelta …» with who, and no SLA light', async () => {
    const { wrapper } = await mountRow(resolved, { tab: 'resolved' })
    const closed = wrapper.get('[data-testid="closed-line"]')
    expect(closed.text()).toContain('Resuelta hoy 9:00')
    expect(closed.text()).toContain('por Ana López')
    expect(wrapper.find('[data-testid="sla-indicator"]').exists()).toBe(false)
  })

  it.each([
    [{ cancelReason: 'CUSTOMER_WITHDREW' }, 'El cliente la retiró'],
    [{ cancelReason: 'AUTO_RESOLVED' }, 'El chatbot la cerró solo'],
    [{ cancelReason: 'STAFF', staffCancelReason: 'NOT_ACTIONABLE' }, 'Cancelada por el personal · No se puede atender'],
    [{ cancelReason: 'SUPERSEDED', mergedInto: { id: 'req-9', folio: 'S-000009' } }, 'Fusionada en S-000009'],
  ] as const)('cancelled %j reads «%s»', async (cause, text) => {
    const { wrapper } = await mountRow(
      { status: 'CANCELLED', displayStatus: 'CANCELLED', slaLevel: null, closedAt: '2026-11-11T15:00:00.000Z', ...cause },
      { tab: 'cancelled' },
    )
    const closed = wrapper.get('[data-testid="closed-line"]')
    expect(closed.text()).toContain('Cancelada hoy 9:00')
    expect(closed.text()).toContain(text)
  })

  it('a closed row has no window tag', async () => {
    const { wrapper } = await mountRow(
      { ...resolved, whatsappWindowClosesAt: '2026-11-11T18:00:00.000Z' },
      { tab: 'resolved' },
    )
    expect(wrapper.find('[data-testid="window-tag"]').exists()).toBe(false)
  })
})

describe('RequestGroupRow — card layout (mobile)', () => {
  it('is an article with a stretched link to the detail, status, folio, subtype and a footer', async () => {
    const { wrapper } = await mountRow({ id: 'req-5', createdAt: '2026-11-11T14:55:00.000Z' }, { layout: 'cards' })
    const card = wrapper.get('[data-testid="request-card"]')
    expect(card.element.tagName).toBe('ARTICLE')
    expect(wrapper.find('tr').exists()).toBe(false)
    const link = card.get('a.chatbot-card__link')
    expect(link.attributes('href')).toBe('/chatbot/solicitudes/req-5')
    expect(link.text()).toBe('Croquetas 15 kg')
    expect(card.text()).toContain('Nueva')
    expect(card.text()).toContain('S-000001')
    expect(card.text()).toContain('Reposición')
    const foot = card.get('[data-testid="card-foot"]')
    expect(foot.find('[data-testid="sla-indicator"]').exists()).toBe(true)
    expect(foot.get('[data-testid="request-age"]').text()).toBe('2 h 10 min')
  })

  it('the card has no action buttons either', async () => {
    const { wrapper } = await mountRow({ allowedActions: ['CLAIM', 'RESOLVE'] }, { layout: 'cards' })
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('closed cards show the closing line in the footer', async () => {
    const { wrapper } = await mountRow(
      {
        status: 'CANCELLED',
        displayStatus: 'CANCELLED',
        slaLevel: null,
        closedAt: '2026-11-10T15:00:00.000Z',
        cancelReason: 'CUSTOMER_WITHDREW',
      },
      { layout: 'cards', tab: 'cancelled' },
    )
    expect(wrapper.get('[data-testid="card-foot"]').text()).toContain('Cancelada ayer 9:00')
    expect(wrapper.get('[data-testid="card-foot"]').text()).toContain('El cliente la retiró')
  })

  it('a click on the card body opens the detail', async () => {
    const { wrapper, push } = await mountRow({ id: 'req-6' }, { layout: 'cards' })
    await wrapper.get('a.chatbot-card__link').trigger('click')
    expect(push).toHaveBeenCalledTimes(1)
  })
})

describe('RequestGroupRow — unread customer messages', () => {
  it('shows «N nuevos» on a row with unread customer messages, in the table and in the card', async () => {
    const table = await mountRow({ unreadCustomerMessages: 3 })
    const badge = table.wrapper.get('[data-testid="unread-badge"]')
    expect(badge.text()).toBe('3 nuevos')
    expect(badge.attributes('aria-label')).toBe('3 mensajes nuevos del cliente')

    const card = await mountRow({ unreadCustomerMessages: 12 }, { layout: 'cards' })
    expect(card.wrapper.get('[data-testid="unread-badge"]').text()).toBe('12 nuevos')
  })

  it('reads «1 nuevo» for a single message', async () => {
    const { wrapper } = await mountRow({ unreadCustomerMessages: 1 })
    expect(wrapper.get('[data-testid="unread-badge"]').text()).toBe('1 nuevo')
    expect(wrapper.get('[data-testid="unread-badge"]').attributes('aria-label')).toBe('1 mensaje nuevo del cliente')
  })

  it('shows nothing when the count is 0', async () => {
    const table = await mountRow({ unreadCustomerMessages: 0 })
    expect(table.wrapper.find('[data-testid="unread-badge"]').exists()).toBe(false)
    const card = await mountRow({ unreadCustomerMessages: 0 }, { layout: 'cards' })
    expect(card.wrapper.find('[data-testid="unread-badge"]').exists()).toBe(false)
  })

  it('tolerates a backend that does not send the count yet', async () => {
    const { wrapper } = await mountRow({ unreadCustomerMessages: undefined as unknown as number })
    expect(wrapper.find('[data-testid="unread-badge"]').exists()).toBe(false)
  })
})

describe('RequestGroupRow — scheduled conversations (handoff 21)', () => {
  const FUTURE = '2026-11-17T16:30:00.000Z' // Tue 10:30 in Mexico City

  it('a future scheduled row reads «Agendada · mar 10:30» in both layouts', async () => {
    const table = await mountRow({ scheduledFor: FUTURE, scheduleVersion: 1 })
    expect(table.wrapper.get('[data-testid="sla-indicator"]').text()).toContain('Agendada · mar 10:30')
    const card = await mountRow({ scheduledFor: FUTURE, scheduleVersion: 1 }, { layout: 'cards' })
    expect(card.wrapper.get('[data-testid="sla-indicator"]').text()).toContain('Agendada · mar 10:30')
  })

  it('needsReschedule adds a visible «Reagendar» marker, with its reason for assistive tech', async () => {
    const table = await mountRow({ scheduledFor: FUTURE, needsReschedule: true })
    const tag = table.wrapper.get('[data-testid="reschedule-tag"]')
    expect(tag.text()).toBe('Reagendar')
    expect(tag.attributes('aria-label')).toContain('Por reagendar')
    const card = await mountRow({ scheduledFor: FUTURE, needsReschedule: true }, { layout: 'cards' })
    expect(card.wrapper.get('[data-testid="reschedule-tag"]').text()).toBe('Reagendar')
  })

  it('no marker without needsReschedule, and none on a closed row', async () => {
    const plain = await mountRow({ scheduledFor: FUTURE })
    expect(plain.wrapper.find('[data-testid="reschedule-tag"]').exists()).toBe(false)
    const closed = await mountRow(
      { status: 'CANCELLED', displayStatus: 'CANCELLED', closedAt: '2026-11-11T16:00:00.000Z', needsReschedule: true },
      { tab: 'cancelled' },
    )
    expect(closed.wrapper.find('[data-testid="reschedule-tag"]').exists()).toBe(false)
  })
})

