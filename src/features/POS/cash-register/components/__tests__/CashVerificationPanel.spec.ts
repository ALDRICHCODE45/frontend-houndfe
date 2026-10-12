/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention; vitest resolves `.vue` through
// the Vue plugin while the plain TS server used by tooling cannot).
// CashVerificationPanel: independent-person only, access-gated, notes required on
// a difference, and the two differences rendered separately. The nested recount
// form is entered in HUMAN PESOS and its emitted payload stays in wire cents.
import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CashVerificationPanel from '../CashVerificationPanel.vue'
import type { CashComparison, CashSession, CashSessionDetail } from '../../interfaces/cash.types'

function makeSession(overrides: Partial<CashSession> = {}): CashSession {
  return {
    id: 's-1',
    tenantId: 't-1',
    registerId: 'r-1',
    status: 'SUBMITTED',
    cashierUserId: 'cashier-1',
    openingCents: 50000,
    frozenAt: '2026-10-07T18:30:00.000Z',
    drawerReleasedAt: null,
    blind: false,
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
    channelSnapshot: [
      { channelKey: 'CASH', channelLabel: 'Efectivo', method: 'CASH', expectedCents: 157500 },
    ],
    ...overrides,
  }
}

const COMPARISON: CashComparison = {
  expectedCents: 157500,
  declaredCents: 158000,
  verifiedCents: 158300,
  declarationDifferenceCents: 500,
  verificationDifferenceCents: 300,
  verifiedVsExpectedDifferenceCents: 800,
  requiresDeclarationNotes: true,
  requiresVerificationNotes: true,
  hasDiscrepancy: true,
}

async function fillRecount(wrapper, value, notes) {
  await wrapper.get('[data-testid="cash-count-input-CASH"]').setValue(value)
  if (notes !== undefined) {
    await wrapper.get('[data-testid="cash-count-notes"]').setValue(notes)
  }
}

describe('CashVerificationPanel', () => {
  it('shows the access state without the derived verification abilities', () => {
    const wrapper = mountWithUApp(CashVerificationPanel, {
      props: { detail: makeDetail(), canVerify: false, currentUserId: 'verifier-2' },
    })
    expect(wrapper.find('[data-testid="cash-verification-forbidden"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-count-form"]').exists()).toBe(false)
  })

  it('blocks self-verification for the cashier', () => {
    const wrapper = mountWithUApp(CashVerificationPanel, {
      props: { detail: makeDetail(), canVerify: true, currentUserId: 'cashier-1' },
    })
    expect(wrapper.find('[data-testid="cash-verification-self"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-count-form"]').exists()).toBe(false)
  })

  it('refuses to verify a session that is not SUBMITTED', () => {
    const wrapper = mountWithUApp(CashVerificationPanel, {
      props: {
        detail: makeDetail({ session: makeSession({ status: 'COUNTING', blind: true }) }),
        canVerify: true,
        currentUserId: 'verifier-2',
      },
    })
    expect(wrapper.find('[data-testid="cash-verification-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-count-form"]').exists()).toBe(false)
  })

  it('renders the two differences as separate numbers', () => {
    const wrapper = mountWithUApp(CashVerificationPanel, {
      props: {
        detail: makeDetail(),
        canVerify: true,
        currentUserId: 'verifier-2',
        comparison: COMPARISON,
      },
    })
    expect(wrapper.get('[data-testid="cash-verification-declaration-difference"]').text()).toMatch(
      /5[.,]00/,
    )
    expect(wrapper.get('[data-testid="cash-verification-verification-difference"]').text()).toMatch(
      /3[.,]00/,
    )
  })

  it('shows the immutable original declaration beside the verifier recount', () => {
    const wrapper = mountWithUApp(CashVerificationPanel, {
      props: {
        detail: makeDetail({
          counts: [
            {
              id: 'c-1',
              kind: 'DECLARATION',
              revision: 2,
              actorUserId: 'cashier-1',
              lines: [{ channelKey: 'CASH', amountCents: 158000 }],
              denominations: null,
              notes: null,
              createdAt: '2026-10-07T18:40:00.000Z',
            },
          ],
        }),
        canVerify: true,
        currentUserId: 'verifier-2',
        comparison: COMPARISON,
      },
    })

    const original = wrapper.get('[data-testid="cash-verification-original"]')
    expect(original.get('[data-testid="cash-verification-original-CASH"]').text()).toMatch(
      /1,580[.,]00/,
    )
    expect(original.text()).toContain('original')
    // The verifier's own recount stays a distinct surface from the original facts.
    expect(wrapper.find('[data-testid="cash-count-form"]').exists()).toBe(true)
  })

  it('requires a note when the declaration difference is non-zero', async () => {
    const wrapper = mountWithUApp(CashVerificationPanel, {
      props: {
        detail: makeDetail(),
        canVerify: true,
        currentUserId: 'verifier-2',
        comparison: COMPARISON,
      },
    })
    expect(wrapper.find('[data-testid="cash-verification-notes-required"]').exists()).toBe(true)

    await fillRecount(wrapper, '1583.00', '')
    await wrapper.get('[data-testid="cash-count-form-element"]').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.find('[data-testid="cash-count-notes-error"]').exists()).toBe(true)

    await fillRecount(wrapper, '1583.00', 'Recuento: 3 pesos de más')
    await wrapper.get('[data-testid="cash-count-form-element"]').trigger('submit')
    expect(wrapper.emitted('submit')[0][0]).toEqual({
      lines: [{ channelKey: 'CASH', amountCents: 158300 }],
      notes: 'Recuento: 3 pesos de más',
    })
  })

  it('keeps the nested recount entry in pesos with an integer-cent payload', () => {
    const wrapper = mountWithUApp(CashVerificationPanel, {
      props: {
        detail: makeDetail(),
        canVerify: true,
        currentUserId: 'verifier-2',
        comparison: COMPARISON,
      },
    })
    expect(wrapper.find('[data-testid="cash-count-input-CASH"]').attributes('inputmode')).toBe(
      'decimal',
    )
    expect(wrapper.text()).not.toMatch(/centavos/i)
  })
})
