import { describe, it, expect } from 'vitest'
import {
  buildPromotionSummaryBullets,
  resolvePromotionCapacityState,
} from '../promotionSummary.utils'
import { getInitialState } from '../../composables/usePromotionForm'
import { PROMOTION_CAPACITY_MODE } from '../../interfaces/promotion.types'

// ── resolvePromotionCapacityState ─────────────────────────────────────────────

describe('resolvePromotionCapacityState — server-owned states', () => {
  it('unlimited when cap is null and there is no consumption', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: null,
      consumedProductUnits: 0,
      remainingProductUnits: null,
    })
    expect(status.state).toBe('unlimited')
    expect(status.remaining).toBeNull()
  })

  it('unlimited_consumed when cap is null and consumption is positive', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: null,
      consumedProductUnits: 7,
      remainingProductUnits: null,
    })
    expect(status.state).toBe('unlimited_consumed')
    expect(status.consumed).toBe(7)
  })

  it('available when remaining is positive below the 80% threshold', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: 100,
      consumedProductUnits: 79,
      remainingProductUnits: 21,
    })
    expect(status.state).toBe('available')
    expect(status.remaining).toBe(21)
  })

  it('near_limit at exactly 80% consumption', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: 100,
      consumedProductUnits: 80,
      remainingProductUnits: 20,
    })
    expect(status.state).toBe('near_limit')
  })

  it('near_limit above the threshold', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: 10,
      consumedProductUnits: 9,
      remainingProductUnits: 1,
    })
    expect(status.state).toBe('near_limit')
  })

  it('exhausted when remaining is exactly 0', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: 100,
      consumedProductUnits: 100,
      remainingProductUnits: 0,
    })
    expect(status.state).toBe('exhausted')
  })

  it('near_limit just below exhausted', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: 100,
      consumedProductUnits: 99,
      remainingProductUnits: 1,
    })
    expect(status.state).toBe('near_limit')
  })
})

describe('resolvePromotionCapacityState — inconsistent / stale values never crash', () => {
  it('stale when a finite cap has null remaining', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: 100,
      consumedProductUnits: 80,
      remainingProductUnits: null,
    })
    expect(status.state).toBe('stale')
  })

  it('stale when consumed + remaining does not equal the cap', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: 100,
      consumedProductUnits: 80,
      remainingProductUnits: 30,
    })
    expect(status.state).toBe('stale')
  })

  it('stale when unlimited carries a non-null remaining', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: null,
      consumedProductUnits: 5,
      remainingProductUnits: 0,
    })
    expect(status.state).toBe('stale')
  })

  it('stale on negative remaining', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: 100,
      consumedProductUnits: 100,
      remainingProductUnits: -1,
    })
    expect(status.state).toBe('stale')
  })

  it('stale on negative consumed', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: 100,
      consumedProductUnits: -1,
      remainingProductUnits: 101,
    })
    expect(status.state).toBe('stale')
  })

  it('stale on a zero cap', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: 0,
      consumedProductUnits: 0,
      remainingProductUnits: 0,
    })
    expect(status.state).toBe('stale')
  })

  it('stale on NaN', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: NaN,
      consumedProductUnits: NaN,
      remainingProductUnits: NaN,
    })
    expect(status.state).toBe('stale')
  })

  it('stale on decimals', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: 10.5,
      consumedProductUnits: 1,
      remainingProductUnits: 9,
    })
    expect(status.state).toBe('stale')
  })

  it('stale on string values (no coercion)', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: '100' as unknown as number,
      consumedProductUnits: 0,
      remainingProductUnits: 100,
    })
    expect(status.state).toBe('stale')
  })

  it('stale on entirely missing counters (never a false unlimited)', () => {
    const status = resolvePromotionCapacityState({})
    expect(status.state).toBe('stale')
  })

  it('unlimited only on an EXPLICIT null cap (all counters present)', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: null,
      consumedProductUnits: 0,
      remainingProductUnits: null,
    })
    expect(status.state).toBe('unlimited')
  })

  it('stale when an unlimited snapshot carries an explicit null consumed', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: null,
      consumedProductUnits: null,
      remainingProductUnits: null,
    })
    expect(status.state).toBe('stale')
  })

  it('stale when a finite snapshot carries an explicit null consumed', () => {
    const status = resolvePromotionCapacityState({
      maxProductUnits: 100,
      consumedProductUnits: null,
      remainingProductUnits: 20,
    })
    expect(status.state).toBe('stale')
  })
})

// ── buildPromotionSummaryBullets capacity copy ────────────────────────────────

describe('buildPromotionSummaryBullets — capacity copy', () => {
  function makeState(overrides: Record<string, unknown> = {}) {
    return { ...getInitialState('PRODUCT_DISCOUNT'), ...overrides }
  }

  it('describes an explicit limited cap before save', () => {
    const bullets = buildPromotionSummaryBullets(
      makeState({
        capacityMode: PROMOTION_CAPACITY_MODE.LIMITED,
        maxProductUnits: 100,
      }),
    )
    expect(bullets.some((b) => b.includes('100') && b.toLowerCase().includes('cupo'))).toBe(true)
  })

  it('describes a preserved cap when untouched in edit mode', () => {
    const bullets = buildPromotionSummaryBullets(
      makeState({
        capacityMode: PROMOTION_CAPACITY_MODE.UNCHANGED,
        maxProductUnits: 100,
      }),
    )
    expect(bullets.some((b) => b.toLowerCase().includes('conserva'))).toBe(true)
  })

  it('mentions historic consumption for an unlimited promotion with usage', () => {
    const bullets = buildPromotionSummaryBullets(
      makeState({
        capacityMode: PROMOTION_CAPACITY_MODE.UNLIMITED,
        maxProductUnits: null,
        consumedProductUnits: 12,
      }),
    )
    expect(bullets.some((b) => b.includes('12') && b.toLowerCase().includes('sin límite'))).toBe(
      true,
    )
  })

  it('stays silent for a fresh unlimited create state (no noise)', () => {
    const bullets = buildPromotionSummaryBullets(
      makeState({
        capacityMode: PROMOTION_CAPACITY_MODE.UNLIMITED,
        maxProductUnits: null,
        consumedProductUnits: 0,
      }),
    )
    expect(bullets.some((b) => b.toLowerCase().includes('conserva'))).toBe(false)
  })
})
