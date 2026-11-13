import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { DETAIL_STUBS, makeDetail } from '../../utils/detail-fixture'
import type { ChatbotLiveSessionState, ChatbotRequestDetail } from '../../interfaces/chatbot-request.types'
import RequestLiveBanners from '../RequestLiveBanners.vue'
import RequestLiveStatus from '../RequestLiveStatus.vue'

const NOW = new Date('2026-11-13T16:06:00.000Z')

function live(
  state: ChatbotLiveSessionState,
  overrides: Partial<ChatbotRequestDetail> = {},
  session: Partial<NonNullable<ChatbotRequestDetail['liveSession']>> = {},
): ChatbotRequestDetail {
  return makeDetail({
    subtype: 'COMPLAINT',
    status: state === 'WAITING' ? 'NEW' : state === 'ENDING' || state === 'ENDED' ? 'RESOLVED' : 'IN_PROGRESS',
    assignee: state === 'WAITING' ? null : { id: 'u-1', displayName: 'Laura Méndez' },
    allowedActions: state === 'ACTIVE' ? ['SEND_MESSAGE', 'FINISH'] : state === 'WAITING' ? ['CLAIM'] : [],
    liveSession: {
      state,
      handoffEpoch: 3,
      lastStaffActivityAt: '2026-11-13T16:00:00.000Z',
      lastCustomerMessageAt: '2026-11-13T16:05:00.000Z',
      ...session,
    },
    ...overrides,
  })
}

const banners = (detail: ChatbotRequestDetail, props: Record<string, unknown> = {}) =>
  mount(RequestLiveBanners, {
    props: { detail, now: NOW, windowClosed: false, closesAt: NOW.getTime() + 20 * 3_600_000, deferred: false, scoped: false, ...props },
    global: { stubs: DETAIL_STUBS },
  })
const status = (detail: ChatbotRequestDetail, props: Record<string, unknown> = {}) =>
  mount(RequestLiveStatus, {
    props: { detail, now: NOW, windowClosed: false, closesAt: NOW.getTime() + 20 * 3_600_000, mine: true, ...props },
    global: { stubs: DETAIL_STUBS },
  })

describe('RequestLiveStatus — session badge, window chip, last reply', () => {
  it.each([
    ['STARTING', 'Conectando…'],
    ['ACTIVE', 'En vivo'],
    ['ENDING', 'Terminando…'],
    ['ENDED', 'Terminada'],
    ['WAITING', 'Sin confirmar'],
  ] as const)('%s shows «%s»', (state, label) => {
    const badge = status(live(state)).get('[data-testid="session-badge"]')
    expect(badge.text()).toContain(label)
    expect(badge.attributes('data-state')).toBe(state)
  })

  it('shows how long the window has left, and warns under 2 h', () => {
    const open = status(live('ACTIVE')).get('[data-testid="window-chip"]')
    expect(open.text()).toBe('Ventana de 24 h: cierra en 20 h')
    expect(open.classes()).not.toContain('lc-chip--warn')
    const soon = status(live('ACTIVE'), { closesAt: NOW.getTime() + 95 * 60_000 }).get('[data-testid="window-chip"]')
    expect(soon.text()).toBe('Ventana de 24 h: cierra en 1 h 35 min')
    expect(soon.classes()).toContain('lc-chip--warn')
  })

  it('says «cerrada» when it is closed, and shows no chip once the session is over or waiting', () => {
    expect(status(live('ACTIVE'), { windowClosed: true }).get('[data-testid="window-chip"]').text()).toBe(
      'Ventana de 24 h cerrada',
    )
    expect(status(live('ENDED')).find('[data-testid="window-chip"]').exists()).toBe(false)
    expect(status(live('WAITING')).find('[data-testid="window-chip"]').exists()).toBe(false)
  })

  it('tells the attendee when they last replied', () => {
    expect(status(live('ACTIVE')).get('[data-testid="staff-activity"]').text()).toBe('Tu última respuesta: hace 6 min')
    expect(status(live('ACTIVE'), { mine: false }).find('[data-testid="staff-activity"]').exists()).toBe(false)
  })
})

describe('RequestLiveBanners — session states (handoff 20 §1)', () => {
  it('STARTING: «Conectando…» with the elapsed time only, and that nothing was sent', () => {
    const wrapper = banners(live('STARTING', {}, { lastStaffActivityAt: '2026-11-13T16:05:18.000Z' }))
    const alert = wrapper.get('[data-testid="banner-starting"]')
    expect(alert.text()).toContain('Conectando…')
    expect(wrapper.get('[data-testid="starting-elapsed"]').text()).toBe('0:42')
    expect(alert.text()).toContain('vuelve a Nueva')
    expect(alert.text()).not.toMatch(/\d+ s restantes|falta/)
  })

  it('WAITING: the bot did not confirm; «Atender de nuevo» only when CLAIM is allowed', async () => {
    const wrapper = banners(live('WAITING'))
    expect(wrapper.get('[data-testid="banner-waiting"]').text()).toContain('El bot no confirmó a tiempo')
    await wrapper.get('[data-testid="banner-claim"]').trigger('click')
    expect(wrapper.emitted('action')![0]).toEqual(['CLAIM'])
    expect(banners(live('WAITING', { allowedActions: [] })).find('[data-testid="banner-claim"]').exists()).toBe(false)
  })

  it('ENDING: the bot says goodbye, no need to wait', () => {
    expect(banners(live('ENDING')).get('[data-testid="banner-ending"]').text()).toContain('hasta 10 min')
  })

  it('ENDED: summary with the complaint outcome, or «Sin clasificar» when it closed by itself', () => {
    const classified = banners(live('ENDED', { complaintOutcome: 'REPLACEMENT' })).get('[data-testid="banner-ended"]')
    expect(classified.text()).toContain('Conversación terminada')
    expect(classified.text()).toContain('Reemplazo')
    expect(banners(live('ENDED', { complaintOutcome: null })).get('[data-testid="banner-ended"]').text()).toContain(
      'Sin clasificar',
    )
    expect(
      banners(live('ENDED', { subtype: 'TALK_TO_HUMAN', complaintOutcome: null })).get('[data-testid="banner-ended"]').text(),
    ).not.toContain('Clasificación')
  })

  it('ACTIVE with nothing to say shows no banner', () => {
    expect(banners(live('ACTIVE')).find('[role="status"], [role="alert"]').exists()).toBe(false)
  })
})

describe('RequestLiveBanners — what changes while it is live', () => {
  it('FINISH_IDLE: customer silent → «puedes finalizar ahora sin más pasos» with the button', async () => {
    const detail = live('ACTIVE', { allowedActions: ['SEND_MESSAGE', 'FINISH', 'FINISH_IDLE'] }, { lastCustomerMessageAt: '2026-11-13T15:28:00.000Z' })
    const wrapper = banners(detail)
    const idle = wrapper.get('[data-testid="banner-idle"]')
    expect(idle.text()).toContain('no escribe desde hace 38 min')
    expect(idle.text()).toContain('sin más pasos')
    await wrapper.get('[data-testid="banner-finish"]').trigger('click')
    expect(wrapper.emitted('action')![0]).toEqual(['FINISH_IDLE'])
  })

  it('a window closing in under 2 h says what happens next', () => {
    const wrapper = banners(live('ACTIVE'), { closesAt: NOW.getTime() + 95 * 60_000 })
    expect(wrapper.get('[data-testid="banner-window-soon"]').text()).toContain('La ventana cierra en 1 h 35 min')
  })

  it('a DEFERRED message: WhatsApp closed the window and only the template is left', () => {
    const wrapper = banners(live('ACTIVE'), { deferred: true, windowClosed: true })
    expect(wrapper.get('[data-testid="banner-deferred"]').text()).toContain('WhatsApp cerró la ventana')
  })

  it('without read:ChatbotConversation the attendee is told they only see their session', () => {
    const wrapper = banners(live('ACTIVE'), { scoped: true })
    expect(wrapper.get('[data-testid="banner-scoped"]').text()).toContain('Solo ves los mensajes de tu sesión')
  })
})
