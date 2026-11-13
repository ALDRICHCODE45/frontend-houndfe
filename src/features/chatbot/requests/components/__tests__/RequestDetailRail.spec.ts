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

describe('RequestDetailActionPanel — action vocabulary safety net (T7a)', () => {
  const mountPanel = (
    allowed: string[],
    denied: Array<{ action: string; code: string }> = [],
    extra: Record<string, unknown> = {},
  ) =>
    mount(RequestDetailActionPanel, {
      props: {
        allowed: allowed as ChatbotRequestAction[],
        denied: denied as ChatbotRequestDeniedAction[],
        assignee: null,
        status: 'NEW',
        version: 3,
        ...extra,
      },
      global,
    })
  const testIds = (wrapper: ReturnType<typeof mountPanel>) =>
    wrapper
      .findAll('[data-testid^="action-"]')
      .map((node) => node.attributes('data-testid'))
      .filter((id) => id !== 'action-panel')

  it('labels REPLY «Responder…» and FINISH «Finalizar conversación…»', () => {
    const wrapper = mountPanel(['REPLY', 'FINISH'], [], { status: 'IN_PROGRESS' })
    expect(wrapper.get('[data-testid="action-REPLY"]').text()).toContain('Responder')
    expect(wrapper.get('[data-testid="action-FINISH"]').text()).toContain('Finalizar conversación')
  })

  it('never renders SEND_MESSAGE or SEND_TEMPLATE (they wait for the live chat), allowed or denied', () => {
    const wrapper = mountPanel(
      ['SEND_MESSAGE', 'SEND_TEMPLATE', 'FINISH'],
      [{ action: 'SEND_TEMPLATE', code: 'NOT_ASSIGNEE' }],
      { status: 'IN_PROGRESS' },
    )
    expect(testIds(wrapper)).toEqual(['action-FINISH'])
  })

  it('never renders an action this version does not know, never as a blank button', () => {
    const wrapper = mountPanel(
      ['CLAIM', 'RESCHEDULE', 'SOMETHING_NEW'],
      [{ action: 'RESCHEDULE', code: 'INSUFFICIENT_PERMISSIONS' }],
    )
    expect(testIds(wrapper)).toEqual(['action-CLAIM'])
    for (const node of wrapper.findAll('button')) expect(node.text().trim()).not.toBe('')
  })

  it('says the request is read-only instead of an empty list when every allowed action is hidden', () => {
    const wrapper = mountPanel(['SEND_MESSAGE'], [], { status: 'IN_PROGRESS' })
    expect(testIds(wrapper)).toEqual([])
    expect(wrapper.find('[data-testid="no-actions"]').exists()).toBe(true)
  })

  it('shows one «Finalizar» button when FINISH and FINISH_IDLE are both allowed', async () => {
    const wrapper = mountPanel(['FINISH', 'FINISH_IDLE'], [], { status: 'IN_PROGRESS' })
    expect(testIds(wrapper)).toEqual(['action-FINISH'])
    await wrapper.get('[data-testid="action-FINISH"]').trigger('click')
    expect(wrapper.emitted('action')).toEqual([['FINISH']])
  })

  it('renders FINISH_IDLE on its own when FINISH is not in the list', async () => {
    const wrapper = mountPanel(['FINISH_IDLE'], [], { status: 'IN_PROGRESS' })
    expect(wrapper.get('[data-testid="action-FINISH_IDLE"]').text()).toContain('Finalizar conversación')
    await wrapper.get('[data-testid="action-FINISH_IDLE"]').trigger('click')
    expect(wrapper.emitted('action')).toEqual([['FINISH_IDLE']])
  })

  describe('live conversation actions', () => {
    const mountBar = (allowed: ChatbotRequestAction[], denied: ChatbotRequestDeniedAction[] = []) =>
      mountPanel(allowed, denied, { variant: 'bar', status: 'IN_PROGRESS' })

    it('on mobile SEND_MESSAGE is the primary «Abrir conversación» and Finalizar waits behind «Más acciones»', async () => {
      const bar = mountBar(['SEND_MESSAGE', 'FINISH'])
      expect(bar.get('[data-testid="bar-primary"]').text()).toContain('Abrir conversación')
      await bar.get('[data-testid="bar-primary"]').trigger('click')
      expect(bar.emitted('action')).toEqual([['SEND_MESSAGE']])
      await bar.get('[data-testid="bar-more"]').trigger('click')
      expect(testIds(bar)).toContain('action-FINISH')
      expect(testIds(bar)).not.toContain('action-SEND_MESSAGE')
    })

    it('on desktop the composer is in the chat: no «Abrir conversación» in «Qué hacer»', () => {
      const panel = mountPanel(['SEND_MESSAGE', 'FINISH'], [], { status: 'IN_PROGRESS' })
      expect(panel.text()).not.toContain('Abrir conversación')
      expect(testIds(panel)).toEqual(['action-FINISH'])
    })

    it('SEND_TEMPLATE has no button anywhere: it lives in the blocked composer, with its cost', () => {
      const bar = mountBar(['SEND_TEMPLATE'], [{ action: 'SEND_TEMPLATE', code: 'NOT_ASSIGNEE' }])
      expect(bar.find('[data-testid="mobile-action-bar"]').exists()).toBe(false)
      const panel = mountPanel(['SEND_TEMPLATE'], [], { status: 'IN_PROGRESS' })
      expect(testIds(panel)).toEqual([])
    })

    it('a denied SEND_MESSAGE is not a dead button either', () => {
      const bar = mountBar(['FINISH'], [{ action: 'SEND_MESSAGE', code: 'NOT_ASSIGNEE' }])
      expect(bar.find('[data-testid="denied-reason-SEND_MESSAGE"]').exists()).toBe(false)
    })
  })

  it('REPLY is the primary action of a clarification, also on a NEW one that offers «Atender»', () => {
    const panel = mountPanel(['CLAIM', 'REPLY', 'CANCEL'])
    expect(testIds(panel)[0]).toBe('action-REPLY')
    const bar = mountPanel(['CLAIM', 'REPLY', 'CANCEL'], [], { variant: 'bar' })
    expect(bar.get('[data-testid="bar-primary"]').text()).toContain('Responder')
  })

  it('without REPLY, «Atender» stays the primary action', () => {
    const bar = mountPanel(['CLAIM', 'RESOLVE'], [], { variant: 'bar' })
    expect(bar.get('[data-testid="bar-primary"]').text()).toContain('Atender')
  })

  it('a denied REPLY is a disabled button with its reason', () => {
    const wrapper = mountPanel(
      [],
      [{ action: 'REPLY', code: 'NOT_ASSIGNEE' }],
      { status: 'IN_PROGRESS', assignee: { id: 'u-2', displayName: 'Luis Ortega' } },
    )
    expect(wrapper.get('[data-testid="action-REPLY"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="denied-reason-REPLY"]').text()).toBe('Solo quien la atiende puede hacerlo.')
  })
})

describe('RequestDetailActionPanel — finish in flight (T7c)', () => {
  it('FINISH_IDLE alone shows as loading when the host reports FINISH (same form, same command)', () => {
    const wrapper = mount(RequestDetailActionPanel, {
      props: { allowed: ['FINISH_IDLE'], denied: [], assignee: null, status: 'IN_PROGRESS', version: 1, pendingAction: 'FINISH' },
      global,
    })
    expect(wrapper.get('[data-testid="action-FINISH_IDLE"]').attributes('disabled')).toBeDefined()
  })
})

describe('RequestDetailActionPanel — a command in flight (T2.U4)', () => {
  const mountPending = (variant: 'panel' | 'bar' = 'panel') =>
    mount(RequestDetailActionPanel, {
      props: {
        allowed: ['CLAIM', 'CANCEL'],
        denied: [],
        assignee: null,
        status: 'NEW',
        version: 1,
        variant,
        pendingAction: 'CLAIM',
      },
      global,
    })

  it('disables every action while one is being sent and ignores clicks', async () => {
    const wrapper = mountPending()
    for (const action of ['CLAIM', 'CANCEL']) {
      expect(wrapper.get(`[data-testid="action-${action}"]`).attributes('disabled')).toBeDefined()
    }
    await wrapper.get('[data-testid="action-CLAIM"]').trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
  })

  it('disables the mobile bar buttons too', () => {
    const wrapper = mountPending('bar')
    expect(wrapper.get('[data-testid="bar-primary"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="bar-more"]').attributes('disabled')).toBeDefined()
  })
})
