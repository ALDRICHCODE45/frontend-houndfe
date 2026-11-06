/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention; vitest resolves `.vue` through
// the Vue plugin while the plain TS server used by tooling cannot).
//
// CashMovementsPanel — contract example A is the anchor case:
//   owner, status OPEN, blind TRUE → the HISTORY is hidden (the backend returns
//   `movements: []` and discloses no metadata) but the session is still writable,
//   so the authorized manual command forms MUST remain available to its owner.
// Ownership is enforced from the caller identity, and a non-owner never gets the
// command forms.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'
import { ref } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import CashMovementsPanel from '../CashMovementsPanel.vue'
import type { CashSession, CashSessionDetail } from '../../interfaces/cash.types'

const isMobile = ref(false)

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isMobile }) }
})

enableAutoUnmount(afterEach)

beforeEach(() => {
  isMobile.value = false
})

function makeSession(overrides: Partial<CashSession> = {}): CashSession {
  return {
    id: 's-1',
    tenantId: 't-1',
    registerId: 'r-1',
    status: 'OPEN',
    cashierUserId: 'cashier-1',
    openingCents: 50000,
    frozenAt: null,
    drawerReleasedAt: null,
    blind: true,
    ...overrides,
  }
}

function makeDetail(overrides: Partial<CashSessionDetail> = {}): CashSessionDetail {
  return {
    session: makeSession({ blind: false, status: 'OPEN' }),
    register: { id: 'r-1', name: 'Caja principal', isActive: true },
    movements: [],
    counts: [],
    handovers: [],
    closing: null,
    channelSnapshot: null,
    ...overrides,
  }
}

const ONE_MOVEMENT = {
  id: 'm-1',
  kind: 'CASH_IN',
  deltaCents: 20000,
  method: 'CASH',
  channelKey: 'CASH',
  channelLabel: 'Efectivo',
  sourceType: 'MANUAL',
  sourceId: 'src-1',
  actorUserId: 'cashier-1',
  reason: 'Cambio adicional',
  occurredAt: '2026-10-07T17:15:00.000Z',
}

describe('CashMovementsPanel · contract example A (owner, OPEN, blind)', () => {
  it('keeps the manual command forms available to the OWNER and hides only the history', async () => {
    const wrapper = mountWithUApp(CashMovementsPanel, {
      props: {
        detail: makeDetail({
          // Status OPEN + blind true: exactly example A. The payload still carries
          // a movement, and the UI must not render it.
          session: makeSession({ status: 'OPEN', blind: true }),
          movements: [ONE_MOVEMENT],
        }),
        currentUserId: 'cashier-1',
        canCashIn: true,
        canCashOut: true,
      },
    })

    expect(wrapper.find('[data-testid="cash-movements-history-hidden"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-movements-table"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Cambio adicional')

    // The command entry point stays usable for the owner.
    expect(wrapper.find('[data-testid="cash-movement-form"]').exists()).toBe(true)

    await wrapper.get('[data-testid="cash-movement-amount"]').setValue('25.00')
    await wrapper.get('[data-testid="cash-movement-reason"]').setValue('Compra de bolsas')
    await wrapper.get('[data-testid="cash-in-submit"]').trigger('click')

    expect(wrapper.emitted('submit')).toEqual([
      [{ kind: 'CASH_IN', amountCents: 2500, reason: 'Compra de bolsas' }],
    ])
  })

  it('hides the history for a blind session even when the payload is malformed', () => {
    const wrapper = mountWithUApp(CashMovementsPanel, {
      props: {
        detail: makeDetail({
          session: makeSession({ status: 'OPEN', blind: true }),
          movements: [ONE_MOVEMENT],
        }),
        currentUserId: 'cashier-1',
        canCashIn: true,
        canCashOut: true,
      },
    })
    expect(wrapper.find('[data-testid="cash-movements-table"]').exists()).toBe(false)
  })
})

describe('CashMovementsPanel · ownership', () => {
  it('never offers manual commands to a non-owner on a writable session', () => {
    const wrapper = mountWithUApp(CashMovementsPanel, {
      props: {
        detail: makeDetail({ session: makeSession({ blind: false, status: 'OPEN' }) }),
        currentUserId: 'someone-else',
        canCashIn: true,
        canCashOut: true,
      },
    })

    expect(wrapper.find('[data-testid="cash-movement-form"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-movements-owner-denied"]').exists()).toBe(true)
  })

  it('a non-owner cannot reach the commands even while blind', () => {
    const wrapper = mountWithUApp(CashMovementsPanel, {
      props: {
        detail: makeDetail({
          session: makeSession({ status: 'OPEN', blind: true }),
          movements: [ONE_MOVEMENT],
        }),
        currentUserId: 'someone-else',
        canCashIn: true,
        canCashOut: true,
      },
    })

    expect(wrapper.find('[data-testid="cash-movement-form"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-movements-table"]').exists()).toBe(false)
  })

  it('treats a missing caller identity as a non-owner', () => {
    const wrapper = mountWithUApp(CashMovementsPanel, {
      props: { detail: makeDetail(), canCashIn: true, canCashOut: true },
    })
    expect(wrapper.find('[data-testid="cash-movement-form"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-movements-owner-denied"]').exists()).toBe(true)
  })
})

describe('CashMovementsPanel · frozen and permission states', () => {
  it('disables movements and explains the freeze once the session is frozen', () => {
    const wrapper = mountWithUApp(CashMovementsPanel, {
      props: {
        detail: makeDetail({
          session: makeSession({
            blind: true,
            status: 'COUNTING',
            frozenAt: '2026-10-07T18:30:00.000Z',
          }),
        }),
        currentUserId: 'cashier-1',
        canCashIn: true,
        canCashOut: true,
      },
    })
    expect(wrapper.find('[data-testid="cash-movements-frozen"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-movement-form"]').exists()).toBe(false)
  })

  it('lists visible movements once the blind window is over', () => {
    const wrapper = mountWithUApp(CashMovementsPanel, {
      props: {
        detail: makeDetail({ movements: [ONE_MOVEMENT] }),
        currentUserId: 'cashier-1',
        canCashIn: true,
        canCashOut: true,
      },
    })
    expect(wrapper.find('[data-testid="cash-movement-m-1"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Cambio adicional')
  })

  it('requires a reason and a positive pesos amount', async () => {
    const wrapper = mountWithUApp(CashMovementsPanel, {
      props: {
        detail: makeDetail(),
        currentUserId: 'cashier-1',
        canCashIn: true,
        canCashOut: true,
      },
    })

    await wrapper.get('[data-testid="cash-movement-amount"]').setValue('25.00')
    await wrapper.get('[data-testid="cash-in-submit"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.find('[data-testid="cash-movement-local-error"]').exists()).toBe(true)

    await wrapper.get('[data-testid="cash-movement-amount"]').setValue('0')
    await wrapper.get('[data-testid="cash-movement-reason"]').setValue('Cambio')
    await wrapper.get('[data-testid="cash-in-submit"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()

    await wrapper.get('[data-testid="cash-movement-amount"]').setValue('25.00')
    await wrapper.get('[data-testid="cash-in-submit"]').trigger('click')
    expect(wrapper.emitted('submit')[0][0]).toEqual({
      kind: 'CASH_IN',
      amountCents: 2500,
      reason: 'Cambio',
    })
  })

  it('offers the out button only with the out permission', () => {
    const wrapper = mountWithUApp(CashMovementsPanel, {
      props: {
        detail: makeDetail(),
        currentUserId: 'cashier-1',
        canCashIn: false,
        canCashOut: true,
      },
    })
    expect(wrapper.find('[data-testid="cash-in-submit"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-out-submit"]').exists()).toBe(true)
  })

  it('shows the access state for the owner without either movement permission', () => {
    const wrapper = mountWithUApp(CashMovementsPanel, {
      props: {
        detail: makeDetail(),
        currentUserId: 'cashier-1',
        canCashIn: false,
        canCashOut: false,
      },
    })
    expect(wrapper.find('[data-testid="cash-movements-forbidden"]').exists()).toBe(true)
  })
})

describe('CashMovementsPanel · readable history', () => {
  it('keeps complete long and multiline reasons in their own column without changing amounts', () => {
    const reason = `Compra de bolsas y materiales para la sucursal.\n${'referencia'.repeat(30)}`
    const wrapper = mountWithUApp(CashMovementsPanel, {
      props: {
        detail: makeDetail({ movements: [{ ...ONE_MOVEMENT, reason }] }),
        currentUserId: 'cashier-1',
        canCashIn: true,
        canCashOut: true,
      },
    })
    const table = wrapper.get('[data-testid="cash-movements-table"]')
    expect(table.findAll('th').map((header) => header.text())).toEqual([
      'Tipo',
      'Fecha',
      'Canal',
      'Importe',
      'Motivo',
    ])
    const cells = table.get('tbody tr').findAll('td')
    expect(cells[0].text()).toBe('Ingreso manual')
    expect(cells[3].text()).toBe('$200.00')
    expect(cells[3].find('.hf-figure').exists()).toBe(true)
    expect(cells[4].get('.movement-history-reason').element.textContent).toBe(reason)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('signs outgoing money and never shows ids', () => {
    const wrapper = mountWithUApp(CashMovementsPanel, {
      props: {
        detail: makeDetail({
          movements: [{ ...ONE_MOVEMENT, id: 'm-9', kind: 'CASH_OUT', deltaCents: -4550 }],
        }),
        currentUserId: 'cashier-1',
        canCashIn: true,
      },
    })
    const row = wrapper.get('[data-testid="cash-movement-m-9"]')
    expect(row.text()).toBe('Retiro manual')
    expect(wrapper.get('tbody tr').text()).toContain('-$45.50')
    expect(wrapper.text()).not.toMatch(/\bm-9\b|\bsrc-1\b/)
  })
})

describe('CashMovementsPanel · four states (S10)', () => {
  const props = { currentUserId: 'cashier-1', canCashIn: true, canCashOut: true }

  it('empty: "Aún no hay movimientos" on the shared empty state', () => {
    const wrapper = mountWithUApp(CashMovementsPanel, {
      props: { ...props, detail: makeDetail() },
    })
    expect(wrapper.get('.hf-empty-state[data-kind="empty"]').text()).toContain(
      'Aún no hay movimientos',
    )
    expect(wrapper.find('[data-testid="cash-movements-empty"]').exists()).toBe(true)
  })

  it('loading: renders the table skeleton while the session loads', () => {
    const wrapper = mountWithUApp(CashMovementsPanel, { props: { ...props, loading: true } })
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-movements-empty-detail"]').exists()).toBe(false)
  })

  it('loading on mobile: renders card skeletons', () => {
    isMobile.value = true
    const wrapper = mountWithUApp(CashMovementsPanel, { props: { ...props, loading: true } })
    expect(wrapper.findAll('[data-testid="mobile-card-skeleton"]')).toHaveLength(3)
  })

  it('data: rows of the history, and cards on mobile', () => {
    const detail = makeDetail({ movements: [ONE_MOVEMENT] })
    const table = mountWithUApp(CashMovementsPanel, { props: { ...props, detail } })
    expect(table.findAll('tbody tr')).toHaveLength(1)

    isMobile.value = true
    const cards = mountWithUApp(CashMovementsPanel, { props: { ...props, detail } })
    const card = cards.get('[data-testid="mobile-cards-list"] article')
    expect(card.text()).toContain('Ingreso manual')
    expect(card.text()).toContain('$200.00')
    expect(card.text()).toContain('Cambio adicional')
  })

  it('error: shows the table error with Reintentar that asks for a refresh', async () => {
    const wrapper = mountWithUApp(CashMovementsPanel, { props: { ...props, error: true } })
    const state = wrapper.get('[data-testid="table-error-state"]')
    expect(state.attributes('role')).toBe('alert')
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(wrapper.emitted('refresh')).toEqual([[]])
  })

  it('keeps the blind window closed even while the session is loading again', () => {
    const wrapper = mountWithUApp(CashMovementsPanel, {
      props: {
        ...props,
        detail: makeDetail({
          session: makeSession({ status: 'OPEN', blind: true }),
          movements: [ONE_MOVEMENT],
        }),
      },
    })
    expect(wrapper.find('[data-testid="cash-movements-history-hidden"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="table-view"]').exists()).toBe(false)
  })
})

// S1: the human enters money in PESOS; the wire keeps integer cents.
describe('CashMovementsPanel · PESOS money entry', () => {
  function mountOwned(overrides = {}) {
    return mountWithUApp(CashMovementsPanel, {
      props: {
        detail: makeDetail(),
        currentUserId: 'cashier-1',
        canCashIn: true,
        canCashOut: true,
        ...overrides,
      },
    })
  }

  it('converts human pesos to exact integer cents for IN and OUT (350.25 → 35025)', async () => {
    const incoming = mountOwned()
    await incoming.get('[data-testid="cash-movement-amount"]').setValue('350.25')
    await incoming.get('[data-testid="cash-movement-reason"]').setValue('Cambio adicional')
    await incoming.get('[data-testid="cash-in-submit"]').trigger('click')
    expect(incoming.emitted('submit')).toEqual([
      [{ kind: 'CASH_IN', amountCents: 35025, reason: 'Cambio adicional' }],
    ])

    const outgoing = mountOwned()
    await outgoing.get('[data-testid="cash-movement-amount"]').setValue('0.01')
    await outgoing.get('[data-testid="cash-movement-reason"]').setValue('Vuelto')
    await outgoing.get('[data-testid="cash-out-submit"]').trigger('click')
    expect(outgoing.emitted('submit')).toEqual([
      [{ kind: 'CASH_OUT', amountCents: 1, reason: 'Vuelto' }],
    ])
  })

  it('rejects zero, over-precision, signs, exponents and overflow without emitting', async () => {
    for (const value of ['0', '1.234', '-5', '1e3', '21474836.48', '5,00,00']) {
      const wrapper = mountOwned()
      await wrapper.get('[data-testid="cash-movement-amount"]').setValue(value)
      await wrapper.get('[data-testid="cash-movement-reason"]').setValue('Cambio')
      await wrapper.get('[data-testid="cash-in-submit"]').trigger('click')
      expect(wrapper.emitted('submit')).toBeUndefined()
      expect(wrapper.find('[data-testid="cash-movement-local-error"]').exists()).toBe(true)
    }
  })

  it('clears the pesos amount after a successful submission', async () => {
    const wrapper = mountOwned()
    await wrapper.get('[data-testid="cash-movement-amount"]').setValue('25.00')
    await wrapper.get('[data-testid="cash-movement-reason"]').setValue('Cambio')
    await wrapper.get('[data-testid="cash-in-submit"]').trigger('click')
    expect(wrapper.get('[data-testid="cash-movement-amount"]').element.value).toBe('')
    expect(wrapper.get('[data-testid="cash-movement-reason"]').element.value).toBe('')
  })

  it('does not ask for cents in the movement money entry', async () => {
    const wrapper = mountOwned()
    expect(wrapper.text()).not.toMatch(/centavos/i)
    expect(wrapper.get('[data-testid="cash-movement-amount"]').attributes('inputmode')).toBe(
      'decimal',
    )
  })
})

describe('CashMovementsPanel · design pass (T4)', () => {
  it('names the real state of a session that no longer takes movements', () => {
    const closed = mountWithUApp(CashMovementsPanel, {
      props: { detail: makeDetail({ session: makeSession({ blind: false, status: 'CLOSED' }) }) },
    })
    const note = closed.get('[data-testid="cash-movements-frozen"]')
    expect(note.text()).toContain('cerrada')
    expect(note.text()).not.toContain('congelada')
    // A closed session is a settled state, not a warning.
    expect(note.classes()).not.toContain('cash-note--warning')

    const declared = mountWithUApp(CashMovementsPanel, {
      props: { detail: makeDetail({ session: makeSession({ blind: false, status: 'SUBMITTED' }) }) },
    })
    expect(declared.get('[data-testid="cash-movements-frozen"]').text()).toContain('declarada')
  })

  it('says nothing about the session state while its detail is loading or failed', () => {
    for (const state of [{ loading: true }, { error: true }]) {
      const wrapper = mountWithUApp(CashMovementsPanel, { props: { detail: null, ...state } })
      expect(wrapper.find('[data-testid="cash-movements-frozen"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="cash-movements-owner-denied"]').exists()).toBe(false)
    }
  })

  it('shows when each movement happened, as a short date', () => {
    const wrapper = mountWithUApp(CashMovementsPanel, {
      props: { detail: makeDetail({ movements: [ONE_MOVEMENT] }) },
    })
    const when = wrapper.get(`[data-testid="cash-movement-time-${ONE_MOVEMENT.id}"]`)
    expect(when.text()).toMatch(/\d{1,2} \w+/)
    expect(when.text()).not.toContain('T')
    expect(when.attributes('datetime')).toBe(ONE_MOVEMENT.occurredAt)
  })
})
