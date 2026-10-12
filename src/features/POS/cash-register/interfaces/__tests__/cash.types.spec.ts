/**
 * S1 subset — compile-time and runtime assertions for the cash contract types.
 *
 * The type assertions are the guardrail: optional means "absent in the blind
 * window", never `null` and never `0`. The `isCashComparisonFallback` guard is
 * the only discriminator between the normal and fallback DECLARE comparison.
 */

import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  isCashComparisonFallback,
  type CashComparisonFallback,
  type CashComparisonNormal,
  type CashSession,
  type CashSessionDetail,
  type CashSessionStatus,
} from '../cash.types'

const NORMAL: CashComparisonNormal = {
  expectedCents: 157500,
  declaredCents: 158000,
  verifiedCents: null,
  declarationDifferenceCents: 500,
  verificationDifferenceCents: null,
  verifiedVsExpectedDifferenceCents: null,
  requiresDeclarationNotes: true,
  requiresVerificationNotes: false,
  hasDiscrepancy: true,
}

const FALLBACK: CashComparisonFallback = {
  expectedCents: 157500,
  declaredCents: 158000,
  verifiedCents: null,
  differenceCents: 500,
  requiresDeclarationNotes: true,
  requiresVerificationNotes: false,
  hasDiscrepancy: true,
  notesRequired: true,
}

/** A blind OPEN session exactly as example A: only the projection keys. */
const BLIND_SESSION: CashSession = {
  id: '33333333-3333-4333-8333-333333333333',
  tenantId: '11111111-1111-4111-8111-111111111111',
  registerId: '22222222-2222-4222-8222-222222222222',
  status: 'OPEN',
  cashierUserId: '44444444-4444-4444-8444-444444444444',
  openingCents: 50000,
  frozenAt: null,
  drawerReleasedAt: null,
  blind: true,
}

describe('cash contract types (S1)', () => {
  it('pins the lifecycle status union', () => {
    expectTypeOf<CashSessionStatus>().toEqualTypeOf<'OPEN' | 'COUNTING' | 'SUBMITTED' | 'CLOSED'>()
  })

  it('treats visible expected/difference as optional, so blind absence compiles', () => {
    expectTypeOf<CashSession['expectedCashCents']>().toEqualTypeOf<number | undefined>()
    expectTypeOf<CashSession['differenceCents']>().toEqualTypeOf<number | undefined>()
    expect('expectedCashCents' in BLIND_SESSION).toBe(false)
    expect('differenceCents' in BLIND_SESSION).toBe(false)
    expect(BLIND_SESSION.expectedCashCents).toBeUndefined()
  })

  it('keeps the detail document free of synthesized blind values', () => {
    const detail: CashSessionDetail = {
      session: BLIND_SESSION,
      register: null,
      movements: [],
      counts: [],
      handovers: [],
      closing: null,
      channelSnapshot: null,
    }

    expect(detail.channelSnapshot).toBeNull()
    expect('requiredChannels' in detail).toBe(false)
  })

  it('recognizes the fallback comparison by its `notesRequired` marker', () => {
    expect(isCashComparisonFallback(FALLBACK)).toBe(true)
    expect(isCashComparisonFallback(NORMAL)).toBe(false)
  })

  it('narrows the fallback so `differenceCents` is readable without optional chaining', () => {
    const comparison = FALLBACK as CashComparisonNormal | CashComparisonFallback
    expect(isCashComparisonFallback(comparison)).toBe(true)
    if (!isCashComparisonFallback(comparison)) throw new Error('Expected fallback comparison')
    expectTypeOf(comparison.differenceCents).toEqualTypeOf<number | null>()
    expect(comparison.differenceCents).toBe(500)

    const normal = NORMAL as CashComparisonNormal | CashComparisonFallback
    expect(isCashComparisonFallback(normal)).toBe(false)
    if (isCashComparisonFallback(normal)) throw new Error('Expected normal comparison')
    expectTypeOf(normal.declarationDifferenceCents).toEqualTypeOf<number>()
    expect(normal.declarationDifferenceCents).toBe(500)
  })

  it('keeps the two differences distinct in the normal comparison', () => {
    expect(NORMAL.declarationDifferenceCents).toBe(500)
    expect(NORMAL.verificationDifferenceCents).toBeNull()
    expect('differenceCents' in NORMAL).toBe(false)
  })

  it('allows a null differenceCents fallback for an unrepresentable subtraction', () => {
    const overflow: CashComparisonFallback = { ...FALLBACK, differenceCents: null }

    expect(isCashComparisonFallback(overflow)).toBe(true)
    expect(overflow.differenceCents).toBeNull()
    expect(overflow.notesRequired).toBe(true)
  })
})
