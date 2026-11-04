/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention; vitest resolves `.vue`
// through the Vue plugin while the plain TS server cannot).
import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CashWorkspaceShiftCard from '../CashWorkspaceShiftCard.vue'

const OPEN_DETAIL = {
  session: {
    id: 's-1',
    tenantId: 't-1',
    registerId: 'r-1',
    status: 'OPEN',
    cashierUserId: 'user-1',
    openingCents: 50000,
    frozenAt: null,
    drawerReleasedAt: null,
    blind: false,
  },
  register: { id: 'r-1', name: 'Caja principal', isActive: true },
  movements: [],
  counts: [],
  handovers: [],
  closing: null,
  channelSnapshot: null,
}

function render(overrides: Record<string, unknown> = {}) {
  return mountWithUApp(CashWorkspaceShiftCard, {
    props: { hasSelection: false, ...overrides },
  })
}

describe('CashWorkspaceShiftCard', () => {
  it('shows the genuine unselected turn on the shared empty state', () => {
    const wrapper = render()

    expect(wrapper.get('[data-testid="cash-workspace-shift-title"]').text()).toContain('Tu turno')
    expect(wrapper.find('[data-testid="cash-workspace-no-shift"]').exists()).toBe(true)
    expect(wrapper.get('.hf-empty-state[data-kind="empty"]').text()).toContain(
      'Aún no hay un turno en foco',
    )
    expect(wrapper.find('[data-testid="cash-session-summary"]').exists()).toBe(false)
  })

  it('navigates to opening a turn without selecting a register or session', async () => {
    const wrapper = render()

    await wrapper.get('[data-testid="cash-workspace-shift-open"]').trigger('click')

    expect(wrapper.emitted('requestOpening')).toHaveLength(1)
    expect(wrapper.find('[data-testid="cash-session-summary"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-workspace-no-shift"]').exists()).toBe(true)
  })

  describe('without a selected turn, the card reflects the context it can act on', () => {
    const description = (wrapper) => wrapper.get('[data-testid="cash-workspace-no-shift"]').text()

    it('shows a shaped skeleton while the registers load, never the idle copy', () => {
      const wrapper = render({ noShiftContext: 'loading' })

      expect(wrapper.get('[data-testid="cash-shift-context-loading"]').attributes('aria-busy')).toBe('true')
      expect(wrapper.find('[data-testid="cash-workspace-no-shift"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="cash-workspace-shift-open"]').exists()).toBe(false)
    })

    it('asks to choose a register when there are registers and none is chosen', () => {
      const wrapper = render({ noShiftContext: 'choose-register' })

      expect(description(wrapper)).toContain('Elige una caja para abrir tu turno.')
    })

    it('asks for the starting float once a register is chosen', () => {
      const wrapper = render({ noShiftContext: 'register-chosen' })

      expect(description(wrapper)).toContain('Ingresa el fondo inicial para abrir tu turno.')
    })

    it('says there are no registers yet', () => {
      const wrapper = render({ noShiftContext: 'no-registers' })

      expect(description(wrapper)).toContain('Aún no hay cajas para abrir un turno.')
    })

    it('points at the session list when no turn can be opened here', () => {
      const wrapper = render({ noShiftContext: 'choose-session' })

      expect(description(wrapper)).toContain('Elige una sesión para operar, contar o verificar.')
      expect(wrapper.find('[data-testid="cash-workspace-shift-open"]').exists()).toBe(false)
    })

    it('offers no "Abrir un turno" button on the opening task itself, where it would do nothing', () => {
      const wrapper = render({ noShiftContext: 'choose-register', openingActive: true })

      expect(description(wrapper)).toContain('Elige una caja para abrir tu turno.')
      expect(wrapper.find('[data-testid="cash-workspace-shift-open"]').exists()).toBe(false)
    })
  })

  it('presents the selected turn as a hero with the real register and status', () => {
    const wrapper = render({ hasSelection: true, detail: OPEN_DETAIL, isOwnShift: true })

    expect(wrapper.find('[data-testid="cash-workspace-no-shift"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-session-summary"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="cash-workspace-shift-title"]').text()).toContain(
      'Tu turno',
    )
    expect(wrapper.get('[data-testid="cash-shift-register"]').text()).toBe('Caja principal')
    const status = wrapper.get('[data-testid="cash-shift-status"]')
    expect(status.classes()).toContain('hf-status-badge')
    expect(status.text()).toBe('Abierta')
    expect(status.attributes('data-tone')).toBe('success')
    // The cashier is described from real identity, never a discovered name.
    expect(wrapper.get('[data-testid="cash-shift-cashier"]').text()).toContain('Tú')
  })

  it('carries no help paragraph, eyebrow or status note', () => {
    const wrapper = render({ hasSelection: true, detail: OPEN_DETAIL, isOwnShift: true })

    expect(wrapper.find('.cash-shift-description').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Lista para seguir operando')
    expect(wrapper.text()).not.toContain('Sobre este turno')
  })

  it('says the count has not started, then shows its short date', () => {
    const pending = render({ hasSelection: true, detail: OPEN_DETAIL, isOwnShift: true })
    expect(pending.get('[data-testid="cash-shift-frozen"]').text()).toBe('Sin iniciar')

    const frozen = render({
      hasSelection: true,
      isOwnShift: true,
      detail: {
        ...OPEN_DETAIL,
        session: { ...OPEN_DETAIL.session, status: 'COUNTING', frozenAt: '2020-03-03T20:43:00Z' },
      },
    })
    expect(frozen.get('[data-testid="cash-shift-frozen"]').text()).not.toContain('2020-03-03')
    expect(frozen.get('[data-testid="cash-shift-status"]').attributes('data-tone')).toBe('warning')
  })

  it('never renders a stale status badge while the selected detail is loading or failed', () => {
    const loading = render({ hasSelection: true, detail: OPEN_DETAIL, loading: true })
    expect(loading.find('[data-testid="cash-shift-status"]').exists()).toBe(false)

    const failed = render({ hasSelection: true, detail: OPEN_DETAIL, error: true })
    expect(failed.find('[data-testid="cash-shift-status"]').exists()).toBe(false)
  })

  it('does not present a selected turn as the viewer own when ownership is unknown or another person', () => {
    const other = render({ hasSelection: true, detail: OPEN_DETAIL, isOwnShift: false })
    expect(other.get('[data-testid="cash-workspace-shift-title"]').text()).toContain(
      'Turno seleccionado',
    )
    expect(other.get('[data-testid="cash-workspace-shift-title"]').text()).not.toContain('Tu turno')

    const unknown = render({ hasSelection: true, detail: OPEN_DETAIL })
    expect(unknown.get('[data-testid="cash-workspace-shift-title"]').text()).not.toContain(
      'Tu turno',
    )
  })

  it('does not claim the selected turn belongs to the viewer when it does not', () => {
    const wrapper = render({ hasSelection: true, detail: OPEN_DETAIL, isOwnShift: false })

    expect(wrapper.get('[data-testid="cash-shift-cashier"]').text()).toContain('Otra persona')
    expect(wrapper.get('[data-testid="cash-shift-cashier"]').text()).not.toContain('Tú')
  })

  it('shows a loading state instead of stale turn facts while the detail is in flight', () => {
    const wrapper = render({ hasSelection: true, detail: OPEN_DETAIL, loading: true })

    expect(wrapper.get('[data-testid="cash-shift-loading"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[data-testid="cash-shift-register"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-session-summary"]').exists()).toBe(false)
  })

  it('does not repeat the failure title in a second sentence', () => {
    const wrapper = render({ hasSelection: true, detail: OPEN_DETAIL, error: true })
    const state = wrapper.get('[data-testid="cash-shift-error"]')
    expect(state.text()).toContain('No se pudo cargar la sesión')
    expect(state.text()).not.toContain('Reintenta.')
    expect(state.findAll('p')).toHaveLength(1)
  })

  it('shows the failure state with Reintentar instead of stale turn facts when the read fails', async () => {
    const wrapper = render({ hasSelection: true, detail: OPEN_DETAIL, error: true })

    expect(wrapper.get('[data-testid="cash-shift-error"]').attributes('role')).toBe('alert')
    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    expect(wrapper.find('[data-testid="cash-shift-register"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-session-summary"]').exists()).toBe(false)
  })
})
