import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestDetailSlaPanel from '../RequestDetailSlaPanel.vue'
import RequestDetailActionPanel from '../RequestDetailActionPanel.vue'
import { DETAIL_STUBS, makeDetail } from '../../utils/detail-fixture'
import type {
  ChatbotRequestAction,
  ChatbotRequestDeniedAction,
  ChatbotRequestDetail,
} from '../../interfaces/chatbot-request.types'

const TZ = 'America/Mexico_City'
const NOW = new Date('2026-11-11T17:05:00.000Z') // Wed 11:05 in Mexico City
const global = { stubs: DETAIL_STUBS }

describe('RequestDetailSlaPanel — «Tiempo límite»', () => {
  const mountSla = (overrides: Partial<ChatbotRequestDetail> = {}, currentUserId: string | null = 'u-1') =>
    mount(RequestDetailSlaPanel, {
      props: { request: makeDetail(overrides), currentUserId, timeZone: TZ, now: NOW },
      global,
    })

  it('shows the backend light and the deadline to claim a NEW request', () => {
    const wrapper = mountSla({
      claimDeadlineAt: '2026-11-11T18:00:00.000Z',
      resolveDeadlineAt: '2026-11-12T17:00:00.000Z',
      slaLevel: 'HALF',
    })
    expect(wrapper.text()).toContain('Tiempo límite')
    expect(wrapper.get('[data-testid="sla-indicator"]').attributes('data-tone')).toBe('warn')
    expect(wrapper.get('[data-testid="deadline-claim"]').text()).toContain('hoy 12:00')
    expect(wrapper.get('[data-testid="deadline-resolve"]').text()).toContain('mañana 11:00')
  })

  it('omits a deadline the request does not have', () => {
    const wrapper = mountSla({ claimDeadlineAt: null, resolveDeadlineAt: null, slaLevel: null })
    expect(wrapper.find('[data-testid="deadline-claim"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="deadline-resolve"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="sla-indicator"]').text()).toContain('Sin límite')
  })

  it('says when it expired and that it stays open', () => {
    const wrapper = mountSla({
      status: 'IN_PROGRESS',
      displayStatus: 'EXPIRED',
      slaLevel: 'OVERDUE',
      overdueAt: '2026-11-11T15:00:00.000Z',
    })
    expect(wrapper.get('[data-testid="overdue-note"]').text()).toContain('Venció hoy 9:00')
    expect(wrapper.get('[data-testid="overdue-note"]').text()).toContain('Sigue abierta')
    expect(wrapper.get('[data-testid="sla-indicator"]').attributes('data-tone')).toBe('bad')
  })

  it('shows «se reanuda …» while the clock is paused out of hours', () => {
    const wrapper = mountSla({ slaPaused: true, slaResumesAt: '2026-11-12T15:00:00.000Z' })
    expect(wrapper.get('[data-testid="sla-indicator"]').attributes('data-tone')).toBe('pause')
    expect(wrapper.get('[data-testid="sla-indicator"]').text()).toContain('se reanuda mañana 9:00')
    expect(wrapper.get('[data-testid="pause-note"]').text()).toContain('Fuera de horario')
  })

  it('names the assignee: nobody, someone else, or the signed-in user', () => {
    expect(mountSla({ assignee: null }).get('[data-testid="assignee"]').text()).toBe('Sin responsable')
    expect(
      mountSla({ assignee: { id: 'u-2', displayName: 'Luis Ortega' } }).get('[data-testid="assignee"]').text(),
    ).toBe('La atiende Luis Ortega')
    expect(
      mountSla({ assignee: { id: 'u-1', displayName: 'Laura Méndez' } }).get('[data-testid="assignee"]').text(),
    ).toBe('La atiendes tú')
  })

  it('a closed request has no light and no assignee line, just «La solicitud ya se cerró»', () => {
    const wrapper = mountSla({ status: 'RESOLVED', displayStatus: 'RESOLVED', slaLevel: null })
    expect(wrapper.text()).toContain('La solicitud ya se cerró')
    expect(wrapper.find('[data-testid="sla-indicator"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="assignee"]').exists()).toBe(false)
  })
})

describe('RequestDetailActionPanel', () => {
  const mountPanel = (
    allowed: ChatbotRequestAction[],
    denied: ChatbotRequestDeniedAction[] = [],
    extra: Record<string, unknown> = {},
  ) =>
    mount(RequestDetailActionPanel, {
      props: {
        allowed,
        denied,
        assignee: null,
        status: 'NEW',
        version: 3,
        ...extra,
      },
      global,
    })
  const button = (w: ReturnType<typeof mountPanel>, action: string) =>
    w.get(`[data-testid="action-${action}"]`)

  it('renders each allowed action as an enabled button and emits «action» with its code', async () => {
    const wrapper = mountPanel(['CLAIM', 'REASSIGN', 'CANCEL'])
    expect(button(wrapper, 'CLAIM').text()).toContain('Atender')
    expect(button(wrapper, 'REASSIGN').text()).toContain('Reasignar…')
    expect(button(wrapper, 'CANCEL').text()).toContain('Cancelar solicitud…')
    for (const action of ['CLAIM', 'REASSIGN', 'CANCEL']) {
      expect(button(wrapper, action).attributes('disabled')).toBeUndefined()
    }
    await button(wrapper, 'CLAIM').trigger('click')
    await button(wrapper, 'CANCEL').trigger('click')
    expect(wrapper.emitted('action')).toEqual([['CLAIM'], ['CANCEL']])
  })

  it('offers «Resolver sin tomarla…» next to «Atender» when both are allowed', async () => {
    const wrapper = mountPanel(['CLAIM', 'RESOLVE'])
    expect(button(wrapper, 'CLAIM').text()).toContain('Atender')
    expect(button(wrapper, 'RESOLVE').text()).toContain('Resolver sin tomarla…')
    await button(wrapper, 'RESOLVE').trigger('click')
    expect(wrapper.emitted('action')).toEqual([['RESOLVE']])
  })

  it('«Resolver…» is the plain label once the request is in attention', () => {
    const wrapper = mountPanel(['RELEASE', 'RESOLVE'], [], { status: 'IN_PROGRESS' })
    expect(button(wrapper, 'RESOLVE').text()).toContain('Resolver…')
    expect(button(wrapper, 'RELEASE').text()).toContain('Liberar')
  })

  it('renders each denied action as a disabled button with its reason and never emits for it', async () => {
    const wrapper = mountPanel(
      [],
      [
        { action: 'RESOLVE', code: 'REQUEST_CLAIMED_BY_OTHER' },
        { action: 'CANCEL', code: 'INSUFFICIENT_PERMISSIONS' },
        { action: 'RELEASE', code: 'NOT_ASSIGNEE' },
      ],
      { status: 'IN_PROGRESS', assignee: { id: 'u-2', displayName: 'Luis Ortega' } },
    )
    const resolve = button(wrapper, 'RESOLVE')
    expect(resolve.attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="denied-reason-RESOLVE"]').text()).toBe('La atiende Luis Ortega.')
    expect(resolve.attributes('aria-describedby')).toBe(
      wrapper.get('[data-testid="denied-reason-RESOLVE"]').attributes('id'),
    )
    expect(button(wrapper, 'CANCEL').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="denied-reason-CANCEL"]').text()).toBe('No tienes permiso para hacerlo.')
    expect(wrapper.get('[data-testid="denied-reason-RELEASE"]').text()).toBe('Solo quien la atiende puede hacerlo.')
    await resolve.trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
  })

  it('shows allowed and denied together, with the allowed ones enabled', () => {
    const wrapper = mountPanel(['CLAIM'], [{ action: 'CANCEL', code: 'CANCEL_NOT_ALLOWED' }])
    expect(button(wrapper, 'CLAIM').attributes('disabled')).toBeUndefined()
    expect(button(wrapper, 'CANCEL').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="denied-reason-CANCEL"]').text()).toBe('Esta solicitud no se puede cancelar.')
  })

  it('says the request is read-only when the server offers no action at all', () => {
    const wrapper = mountPanel([])
    expect(wrapper.get('[data-testid="no-actions"]').text()).toContain('Solo puedes verla')
  })

  it('names who is attending when there are no actions', () => {
    const wrapper = mountPanel([], [], { status: 'IN_PROGRESS', assignee: { id: 'u-2', displayName: 'Luis Ortega' } })
    expect(wrapper.get('[data-testid="no-actions"]').text()).toContain('La está atendiendo Luis Ortega')
  })

  it.each([
    ['RESOLVED', 'Solicitud resuelta'],
    ['CANCELLED', 'Solicitud cancelada'],
  ] as const)('a %s request says it no longer takes actions', (status, title) => {
    const wrapper = mountPanel([], [], { status })
    expect(wrapper.get('[data-testid="closed-actions"]').text()).toContain(title)
    expect(wrapper.get('[data-testid="closed-actions"]').text()).toContain('Ya no admite acciones')
    expect(wrapper.find('[data-testid="no-actions"]').exists()).toBe(false)
  })

  it('shows the version the actions apply to', () => {
    expect(mountPanel(['CLAIM']).text()).toContain('Versión 3')
  })

  describe('bar variant (mobile footer)', () => {
    const mountBar = (allowed: ChatbotRequestAction[], denied: ChatbotRequestDeniedAction[] = [], extra = {}) =>
      mountPanel(allowed, denied, { variant: 'bar', ...extra })

    it('puts the primary action in the bar and the rest behind «Más acciones»', async () => {
      const wrapper = mountBar(['CLAIM', 'CANCEL'], [{ action: 'REASSIGN', code: 'INSUFFICIENT_PERMISSIONS' }])
      const bar = wrapper.get('[data-testid="mobile-action-bar"]')
      expect(bar.text()).toContain('Atender')
      expect(wrapper.find('[data-testid="action-CANCEL"]').exists()).toBe(false)

      await wrapper.get('[data-testid="bar-more"]').trigger('click')
      expect(wrapper.get('[data-testid="bar-more"]').attributes('aria-expanded')).toBe('true')
      expect(button(wrapper, 'CANCEL').attributes('disabled')).toBeUndefined()
      expect(button(wrapper, 'REASSIGN').attributes('disabled')).toBeDefined()
      expect(wrapper.get('[data-testid="denied-reason-REASSIGN"]').text()).toBe('No tienes permiso para hacerlo.')

      await button(wrapper, 'CANCEL').trigger('click')
      expect(wrapper.emitted('action')).toEqual([['CANCEL']])
    })

    it('the primary button emits too', async () => {
      const wrapper = mountBar(['CLAIM'])
      await wrapper.get('[data-testid="bar-primary"]').trigger('click')
      expect(wrapper.emitted('action')).toEqual([['CLAIM']])
      expect(wrapper.find('[data-testid="bar-more"]').exists()).toBe(false)
    })

    it('uses «Resolver…» as the primary when «Atender» is not allowed', () => {
      const wrapper = mountBar(['RESOLVE', 'RELEASE'], [], { status: 'IN_PROGRESS' })
      expect(wrapper.get('[data-testid="bar-primary"]').text()).toContain('Resolver…')
    })

    it('with no allowed action but denied ones, shows a single «Acciones (n)» button', async () => {
      const wrapper = mountBar([], [{ action: 'RESOLVE', code: 'REQUEST_CLAIMED_BY_OTHER' }], {
        status: 'IN_PROGRESS',
        assignee: { id: 'u-2', displayName: 'Luis Ortega' },
      })
      expect(wrapper.find('[data-testid="bar-primary"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="bar-more"]').text()).toContain('Acciones (1)')
      await wrapper.get('[data-testid="bar-more"]').trigger('click')
      expect(wrapper.get('[data-testid="denied-reason-RESOLVE"]').text()).toBe('La atiende Luis Ortega.')
    })

    it('renders no bar for a closed request or one with nothing to show', () => {
      expect(mountBar([], [], { status: 'RESOLVED' }).find('[data-testid="mobile-action-bar"]').exists()).toBe(false)
      expect(mountBar([]).find('[data-testid="mobile-action-bar"]').exists()).toBe(false)
    })
  })
})
