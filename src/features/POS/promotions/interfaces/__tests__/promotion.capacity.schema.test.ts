import { describe, it, expect } from 'vitest'
import { promotionFormSchema } from '../promotion.schema'
import { MAX_PRODUCT_UNITS_LIMIT, PROMOTION_CAPACITY_MODE } from '../promotion.types'

// Minimal valid PRODUCT_DISCOUNT state carrying the capacity tri-state.
// Mirrors the shape used by `getInitialState` without importing the
// composable (keeps this suite focused on the schema contract).
function makeState(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Capacidad',
    type: 'PRODUCT_DISCOUNT',
    method: 'AUTOMATIC',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    appliesTo: 'PRODUCTS',
    targetItems: [],
    hasMinPurchase: false,
    minPurchaseAmountCents: 0,
    buyQuantity: 0,
    getQuantity: 0,
    getDiscountPercent: 0,
    buyTargetType: '',
    buyTargetItems: [],
    getTargetType: '',
    getTargetItems: [],
    hasVigencia: false,
    startDate: '',
    endDate: '',
    customerScope: 'ALL',
    customerIds: [],
    hasPriceLists: false,
    priceListIds: [],
    hasDaysOfWeek: false,
    daysOfWeek: [],
    capacityMode: PROMOTION_CAPACITY_MODE.UNLIMITED,
    maxProductUnits: null,
    consumedProductUnits: 0,
    remainingProductUnits: null,
    ...overrides,
  }
}

describe('promotionFormSchema — capacity maxProductUnits bounds', () => {
  it('accepts a positive integer inside the INT range', () => {
    const result = promotionFormSchema.safeParse(
      makeState({
        capacityMode: PROMOTION_CAPACITY_MODE.LIMITED,
        maxProductUnits: 100,
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts the upper INT bound', () => {
    const result = promotionFormSchema.safeParse(
      makeState({
        capacityMode: PROMOTION_CAPACITY_MODE.LIMITED,
        maxProductUnits: MAX_PRODUCT_UNITS_LIMIT,
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts explicit null when unlimited', () => {
    const result = promotionFormSchema.safeParse(
      makeState({ capacityMode: PROMOTION_CAPACITY_MODE.UNLIMITED, maxProductUnits: null }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects 0', () => {
    const result = promotionFormSchema.safeParse(
      makeState({ capacityMode: PROMOTION_CAPACITY_MODE.LIMITED, maxProductUnits: 0 }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects negative values', () => {
    const result = promotionFormSchema.safeParse(
      makeState({ capacityMode: PROMOTION_CAPACITY_MODE.LIMITED, maxProductUnits: -5 }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects decimals', () => {
    const result = promotionFormSchema.safeParse(
      makeState({ capacityMode: PROMOTION_CAPACITY_MODE.LIMITED, maxProductUnits: 1.5 }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects above the upper INT bound', () => {
    const result = promotionFormSchema.safeParse(
      makeState({
        capacityMode: PROMOTION_CAPACITY_MODE.LIMITED,
        maxProductUnits: MAX_PRODUCT_UNITS_LIMIT + 1,
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects NaN', () => {
    const result = promotionFormSchema.safeParse(
      makeState({ capacityMode: PROMOTION_CAPACITY_MODE.LIMITED, maxProductUnits: NaN }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects string coercion "100"', () => {
    const result = promotionFormSchema.safeParse(
      makeState({ capacityMode: PROMOTION_CAPACITY_MODE.LIMITED, maxProductUnits: '100' }),
    )
    expect(result.success).toBe(false)
  })
})

describe('promotionFormSchema — capacity tri-state coherence', () => {
  it('rejects limited mode without a numeric cap', () => {
    const result = promotionFormSchema.safeParse(
      makeState({ capacityMode: PROMOTION_CAPACITY_MODE.LIMITED, maxProductUnits: null }),
    )
    expect(result.success).toBe(false)
    const issue = result.error?.issues.find((i) => i.path[0] === 'maxProductUnits')
    expect(issue).toBeDefined()
    expect(issue!.message).toContain('límite')
  })

  it('rejects a limit below the server-owned consumed count', () => {
    const result = promotionFormSchema.safeParse(
      makeState({
        capacityMode: PROMOTION_CAPACITY_MODE.LIMITED,
        maxProductUnits: 50,
        consumedProductUnits: 80,
      }),
    )
    expect(result.success).toBe(false)
    const issue = result.error?.issues.find((i) => i.path[0] === 'maxProductUnits')
    expect(issue).toBeDefined()
    expect(issue!.message).toContain('80')
  })

  it('accepts a limit equal to the consumed count (remaining 0)', () => {
    const result = promotionFormSchema.safeParse(
      makeState({
        capacityMode: PROMOTION_CAPACITY_MODE.LIMITED,
        maxProductUnits: 80,
        consumedProductUnits: 80,
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts unchanged mode (update: omit key) with existing cap context', () => {
    const result = promotionFormSchema.safeParse(
      makeState({
        capacityMode: PROMOTION_CAPACITY_MODE.UNCHANGED,
        maxProductUnits: 100,
        consumedProductUnits: 20,
      }),
    )
    expect(result.success).toBe(true)
  })

  it('keeps legacy states without capacity fields valid (backward compatible)', () => {
    const legacy = makeState()
    delete (legacy as Record<string, unknown>).capacityMode
    delete (legacy as Record<string, unknown>).maxProductUnits
    delete (legacy as Record<string, unknown>).consumedProductUnits
    const result = promotionFormSchema.safeParse(legacy)
    expect(result.success).toBe(true)
  })
})
