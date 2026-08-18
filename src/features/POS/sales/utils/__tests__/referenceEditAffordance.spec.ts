import { describe, expect, it } from 'vitest'
import { shouldShowEditReference } from '../referenceEditAffordance'
import type { SaleDetailPayment } from '../../interfaces/sale.types'

function makePayment(overrides: Partial<SaleDetailPayment> = {}): SaleDetailPayment {
  return {
    paymentId: 'pay-1',
    method: 'CARD_DEBIT',
    amountCents: 127000,
    tenderedCents: 127000,
    changeCents: 0,
    reference: 'AUTH-1',
    paidAt: '2026-05-06T14:43:00.000Z',
    ...overrides,
  }
}

describe('shouldShowEditReference', () => {
  it('returns true for CARD_DEBIT with a paymentId', () => {
    expect(shouldShowEditReference(makePayment({ method: 'CARD_DEBIT' }))).toBe(true)
  })

  it('returns true for CARD_CREDIT with a paymentId', () => {
    expect(shouldShowEditReference(makePayment({ method: 'CARD_CREDIT' }))).toBe(true)
  })

  it('returns true for TRANSFER with a paymentId', () => {
    expect(shouldShowEditReference(makePayment({ method: 'TRANSFER' }))).toBe(true)
  })

  it('returns false for CASH regardless of paymentId (cash has no reference)', () => {
    expect(shouldShowEditReference(makePayment({ method: 'CASH' }))).toBe(false)
  })

  it('returns false for CREDIT regardless of paymentId (credit sales have no reference)', () => {
    expect(shouldShowEditReference(makePayment({ method: 'CREDIT' }))).toBe(false)
  })

  it('returns false when paymentId is empty (defensive guard)', () => {
    expect(shouldShowEditReference(makePayment({ paymentId: '' }))).toBe(false)
  })
})