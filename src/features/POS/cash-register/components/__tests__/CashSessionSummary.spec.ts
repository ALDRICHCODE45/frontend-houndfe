/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention: specs import `.vue` and the
// plain TS server used by tooling cannot resolve SFC types; vitest resolves them
// through the Vue plugin at runtime).
// CashSessionSummary: blind windows never render expected/difference/movements,
// and status vs drawer release stay two separate facts.
import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CashSessionSummary from '../CashSessionSummary.vue'
import type { CashSession, CashSessionDetail } from '../../interfaces/cash.types'

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
    session: makeSession(),
    register: { id: 'r-1', name: 'Caja principal', isActive: true },
    movements: [],
    counts: [],
    handovers: [],
    closing: null,
    channelSnapshot: null,
    ...overrides,
  }
}

describe('CashSessionSummary', () => {
  it('renders loading and error states', () => {
    const loading = mountWithUApp(CashSessionSummary, { props: { loading: true } })
    expect(loading.find('[data-testid="cash-session-loading"]').exists()).toBe(true)

    const error = mountWithUApp(CashSessionSummary, { props: { error: true } })
    expect(error.find('[data-testid="cash-session-error"]').exists()).toBe(true)
  })

  it('hides expected/difference and movements in the blind window even with malformed loaded values', () => {
    const wrapper = mountWithUApp(CashSessionSummary, {
      props: {
        detail: makeDetail({
          session: makeSession({
            blind: true,
            status: 'COUNTING',
            expectedCashCents: 157500,
            differenceCents: 500,
          }),
          movements: [
            {
              id: 'm-1',
              kind: 'CASH_IN',
              deltaCents: 20000,
              method: 'CASH',
              channelKey: 'CASH',
              channelLabel: 'Efectivo',
              sourceType: 'MANUAL',
              sourceId: 'src-1',
              actorUserId: 'cashier-1',
              reason: null,
              occurredAt: '2026-10-07T17:15:00.000Z',
            },
          ],
          requiredChannels: [{ channelKey: 'CASH', channelLabel: 'Efectivo', method: 'CASH' }],
        }),
      },
    })

    expect(wrapper.find('[data-testid="cash-session-blind"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-session-expected"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-session-declaration-difference"]').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/1[.,]575[.,]00/)
    expect(wrapper.text()).not.toContain('Ingreso manual')
  })

  it('shows the opening fund once, apart from custody', () => {
    const wrapper = mountWithUApp(CashSessionSummary, { props: { detail: makeDetail() } })
    expect(wrapper.get('[data-testid="cash-session-opening"]').text()).toMatch(/500[.,]00/)
  })

  it('renders status and drawer release as separate facts', () => {
    const frozen = mountWithUApp(CashSessionSummary, {
      props: { detail: makeDetail({ session: makeSession({ status: 'COUNTING', blind: true }) }) },
    })
    expect(frozen.get('[data-testid="cash-session-status"]').text()).toContain('Congelada')
    expect(frozen.get('[data-testid="cash-session-drawer-state"]').text()).toContain(
      'Cajón sin liberar',
    )

    const released = mountWithUApp(CashSessionSummary, {
      props: {
        detail: makeDetail({
          session: makeSession({
            status: 'COUNTING',
            blind: true,
            drawerReleasedAt: '2026-10-07T19:00:00.000Z',
          }),
        }),
      },
    })
    expect(released.get('[data-testid="cash-session-status"]').text()).toContain('Congelada')
    expect(released.get('[data-testid="cash-session-drawer-state"]').text()).toContain(
      'Cajón liberado',
    )
  })

  it('shows the expected cash and the declaration difference separately once visible', () => {
    const wrapper = mountWithUApp(CashSessionSummary, {
      props: {
        detail: makeDetail({
          session: makeSession({
            blind: false,
            status: 'SUBMITTED',
            expectedCashCents: 157500,
            differenceCents: 500,
          }),
        }),
      },
    })
    expect(wrapper.get('[data-testid="cash-session-expected"]').text()).toMatch(/1[.,]575[.,]00/)
    expect(wrapper.get('[data-testid="cash-session-declaration-difference"]').text()).toMatch(
      /5[.,]00/,
    )
  })
})
