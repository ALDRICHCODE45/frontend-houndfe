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
  it('explains the genuine unselected turn and how to pick one', () => {
    const wrapper = render()

    expect(wrapper.get('[data-testid="cash-workspace-shift-title"]').text()).toContain('Tu turno')
    expect(wrapper.find('[data-testid="cash-workspace-no-shift"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-session-summary"]').exists()).toBe(false)
    // No selection is invented: the card only explains and offers the list.
    expect(wrapper.text()).toContain('No se selecciona sola')
  })

  it('requests the session list without selecting anything itself', async () => {
    const wrapper = render()

    await wrapper.get('[data-testid="cash-workspace-shift-select"]').trigger('click')

    expect(wrapper.emitted('requestSessions')).toHaveLength(1)
    expect(wrapper.find('[data-testid="cash-session-summary"]').exists()).toBe(false)
  })

  it('navigates to opening a turn without selecting a register or session', async () => {
    const wrapper = render()

    await wrapper.get('[data-testid="cash-workspace-shift-open"]').trigger('click')

    expect(wrapper.emitted('requestOpening')).toHaveLength(1)
    expect(wrapper.find('[data-testid="cash-session-summary"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-workspace-no-shift"]').exists()).toBe(true)
  })

  it('presents the selected turn as a hero with the real register and status', () => {
    const wrapper = render({ hasSelection: true, detail: OPEN_DETAIL, isOwnShift: true })

    expect(wrapper.find('[data-testid="cash-workspace-no-shift"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-session-summary"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="cash-workspace-shift-title"]').text()).toContain(
      'Tu turno, bajo control',
    )
    expect(wrapper.get('[data-testid="cash-shift-register"]').text()).toBe('Caja principal')
    expect(wrapper.get('[data-testid="cash-shift-status"]').text()).toBe('Abierta')
    // The cashier is described from real identity, never a discovered name.
    expect(wrapper.get('[data-testid="cash-shift-cashier"]').text()).toContain('Tú')
  })

  it('describes the selected-session context without implementation jargon', () => {
    const wrapper = render({ hasSelection: true, detail: OPEN_DETAIL, isOwnShift: true })

    const copy = wrapper.get('.cash-shift-description').text()
    expect(copy).not.toMatch(/hero|componente|contexto del|wrapper/i)
    expect(copy.length).toBeGreaterThan(20)
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

    expect(wrapper.find('[data-testid="cash-shift-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-shift-register"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-session-summary"]').exists()).toBe(false)
  })

  it('shows the failure state instead of stale turn facts when the detail read fails', () => {
    const wrapper = render({ hasSelection: true, detail: OPEN_DETAIL, error: true })

    expect(wrapper.find('[data-testid="cash-shift-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-shift-register"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-session-summary"]').exists()).toBe(false)
  })
})
