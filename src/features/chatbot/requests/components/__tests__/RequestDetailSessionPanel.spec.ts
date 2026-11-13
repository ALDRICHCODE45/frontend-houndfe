import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestDetailSessionPanel from '../RequestDetailSessionPanel.vue'
import { DETAIL_STUBS, makeAuditEvent, makeDetail } from '../../utils/detail-fixture'
import type { ChatbotRequestDetail, ChatbotRequestLiveSession } from '../../interfaces/chatbot-request.types'

const TZ = 'America/Mexico_City'
const NOW = new Date('2026-11-12T22:00:00.000Z') // Thu 12 nov, 16:00 in Mexico City

const session = (overrides: Partial<ChatbotRequestLiveSession> = {}): ChatbotRequestLiveSession => ({
  state: 'ACTIVE',
  handoffEpoch: 1,
  lastStaffActivityAt: '2026-11-12T21:50:00.000Z',
  lastCustomerMessageAt: '2026-11-12T21:59:00.000Z', // 1 min ago
  ...overrides,
})

const live = (overrides: Partial<ChatbotRequestDetail> = {}) =>
  makeDetail({
    kind: 'CONVERSATION',
    subtype: 'TALK_TO_HUMAN',
    status: 'IN_PROGRESS',
    assignee: { id: 'u-1', displayName: 'Laura Méndez' },
    liveSession: session(),
    allowedActions: ['FINISH', 'REASSIGN'],
    whatsappWindowClosesAt: null,
    audit: [
      makeAuditEvent('CLAIMED', { createdAt: '2026-11-12T21:30:00.000Z', toStatus: 'IN_PROGRESS' }),
      makeAuditEvent('CREATED', { createdAt: '2026-11-12T21:00:00.000Z', toStatus: 'NEW' }),
    ],
    ...overrides,
  })

const mountPanel = (detail: ChatbotRequestDetail, currentUserId: string | null = 'u-1') =>
  mount(RequestDetailSessionPanel, {
    props: { detail, currentUserId, timeZone: TZ, now: NOW },
    global: { stubs: DETAIL_STUBS },
  })
const row = (wrapper: ReturnType<typeof mountPanel>, id: string) => wrapper.get(`[data-testid="session-${id}"]`).text()

describe('RequestDetailSessionPanel — «Esta conversación» (design A rail card)', () => {
  it('shows session state, attendee, start, last customer message and window', () => {
    const wrapper = mountPanel(live())
    expect(wrapper.get('h2').text()).toBe('Esta conversación')
    expect(row(wrapper, 'state')).toContain('En vivo')
    expect(row(wrapper, 'attendee')).toBe('Laura Méndez (tú)')
    expect(row(wrapper, 'started')).toBe('hoy 15:30')
    expect(row(wrapper, 'customer')).toBe('escribió hace 1 min')
    // 24 h after the customer's last message (21:59Z) → 23 h 59 min left.
    expect(row(wrapper, 'window')).toBe('cierra en 23 h 59 min')
  })

  it('names another attendee without «(tú)»', () => {
    const wrapper = mountPanel(live(), 'u-9')
    expect(row(wrapper, 'attendee')).toBe('Laura Méndez')
  })

  it('says the customer has been silent when finishing for idleness is offered', () => {
    const wrapper = mountPanel(
      live({
        allowedActions: ['FINISH_IDLE'],
        liveSession: session({ lastCustomerMessageAt: '2026-11-12T21:00:00.000Z' }),
      }),
    )
    expect(row(wrapper, 'customer')).toBe('sin escribir desde hace 1 h')
  })

  it('reads a closed window as «cerrada»', () => {
    const wrapper = mountPanel(live({ liveSession: session({ lastCustomerMessageAt: '2026-11-10T10:00:00.000Z' }) }))
    expect(row(wrapper, 'window')).toBe('cerrada')
  })

  it('a session nobody holds says «Nadie todavía» and leaves the start and the customer out', () => {
    const wrapper = mountPanel(
      live({ status: 'NEW', assignee: null, liveSession: session({ state: 'WAITING', lastCustomerMessageAt: null }), audit: [] }),
    )
    expect(row(wrapper, 'state')).toContain('Sin confirmar')
    expect(row(wrapper, 'attendee')).toBe('Nadie todavía')
    expect(row(wrapper, 'started')).toBe('—')
    expect(row(wrapper, 'customer')).toBe('—')
  })

  it('never invents the start: with no CLAIMED event in the detail it is a dash', () => {
    expect(row(mountPanel(live({ audit: [] })), 'started')).toBe('—')
  })

  it('notes the automatic finish after 2 h of silence only while the session is active', () => {
    expect(mountPanel(live()).get('[data-testid="session-auto-finish"]').text()).toContain(
      'Si Juan Pérez no escribe en 2 h, la conversación se finaliza sola.',
    )
    expect(
      mountPanel(live({ liveSession: session({ state: 'ENDED' }) })).find('[data-testid="session-auto-finish"]').exists(),
    ).toBe(false)
  })

  it('says «el cliente» in the note when the customer has no name', () => {
    const detail = live()
    detail.customer.displayName = null
    expect(mountPanel(detail).get('[data-testid="session-auto-finish"]').text()).toContain('Si el cliente no escribe')
  })

  it('renders nothing without a live session', () => {
    expect(mountPanel(live({ liveSession: null })).find('[data-testid="session-panel"]').exists()).toBe(false)
  })
})
