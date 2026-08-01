// Value-pin contract tests for `quotation.constants.ts` (backend-v1 freeze).
// Each row asserts EXACT string equality — a renamed literal
// (e.g. 'DRAFT' → 'DRAFT_SALE', 'CANCELLED' → 'CANCELED' — ONE L) fails the
// build. Never edit a value.
//
// GUARDRAIL CONTEXT:
//   - Quotations use 'CANCELLED' (TWO L's). sales uses 'CANCELED' (ONE L).
//     These are intentionally distinct backend contracts. Keep constants
//     PER-MODULE — a shared global would cause the exact homonym bug.

import { describe, it, expect } from 'vitest'
import {
  QUOTATION_STATUS,
  CANCEL_REASONS,
  QUOTATION_STATUS_TONE,
} from '../quotation.constants'

type PinRow = [actual: string, expected: string]

describe('QUOTATION_STATUS — value-pin contract', () => {
  const cases: PinRow[] = [
    [QUOTATION_STATUS.DRAFT, 'DRAFT'],
    [QUOTATION_STATUS.SENT, 'SENT'],
    [QUOTATION_STATUS.EXPIRED, 'EXPIRED'],
    [QUOTATION_STATUS.CANCELLED, 'CANCELLED'],
  ]

  it.each(cases)('%s === "%s"', (actual, expected) => expect(actual).toBe(expected))

  it('contains exactly four statuses (matches backend lifecycle)', () => {
    expect(Object.keys(QUOTATION_STATUS)).toHaveLength(4)
  })

  it('CANCELLED uses TWO L\'s (distinct from sales CANCELED)', () => {
    expect(QUOTATION_STATUS.CANCELLED).toBe('CANCELLED')
    expect(QUOTATION_STATUS.CANCELLED.length).toBe(9)
    expect(QUOTATION_STATUS.CANCELLED.match(/L/g)?.length ?? 0).toBe(2)
  })
})

describe('CANCEL_REASONS — value-pin contract', () => {
  const cases: PinRow[] = [
    [CANCEL_REASONS.CUSTOMER_REQUEST, 'CUSTOMER_REQUEST'],
    [CANCEL_REASONS.PRICE_OBJECTION, 'PRICE_OBJECTION'],
    [CANCEL_REASONS.EXPIRED, 'EXPIRED'],
    [CANCEL_REASONS.OTHER, 'OTHER'],
  ]

  it.each(cases)('%s === "%s"', (actual, expected) => expect(actual).toBe(expected))

  it('contains exactly four reasons', () => {
    expect(Object.keys(CANCEL_REASONS)).toHaveLength(4)
  })
})

describe('QUOTATION_STATUS_TONE — status to badge tone mapping', () => {
  it('DRAFT maps to info tone', () => {
    expect(QUOTATION_STATUS_TONE.DRAFT).toBe('info')
  })

  it('SENT maps to success tone', () => {
    expect(QUOTATION_STATUS_TONE.SENT).toBe('success')
  })

  it('EXPIRED maps to warning tone', () => {
    expect(QUOTATION_STATUS_TONE.EXPIRED).toBe('warning')
  })

  it('CANCELLED maps to error tone', () => {
    expect(QUOTATION_STATUS_TONE.CANCELLED).toBe('error')
  })

  it('maps every QUOTATION_STATUS value to a tone (no orphans)', () => {
    const tones = Object.values(QUOTATION_STATUS_TONE)
    expect(tones).toHaveLength(Object.keys(QUOTATION_STATUS).length)
    for (const tone of tones) {
      expect(['info', 'success', 'warning', 'error']).toContain(tone)
    }
  })
})