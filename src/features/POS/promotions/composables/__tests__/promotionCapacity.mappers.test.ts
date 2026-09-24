import { describe, it, expect } from 'vitest'
import {
  getInitialState,
  promotionToFormState,
  toCreatePayload,
  toUpdatePayload,
} from '../usePromotionForm'
import { PROMOTION_CAPACITY_MODE, type PromotionResponse } from '../../interfaces/promotion.types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeResponse(overrides: Partial<PromotionResponse> = {}): PromotionResponse {
  return {
    id: 'promo-1',
    title: 'Capacidad',
    type: 'PRODUCT_DISCOUNT',
    method: 'AUTOMATIC',
    status: 'ACTIVE',
    startDate: null,
    endDate: null,
    customerScope: 'ALL',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    minPurchaseAmountCents: null,
    appliesTo: 'PRODUCTS',
    buyQuantity: null,
    getQuantity: null,
    getDiscountPercent: null,
    buyTargetType: null,
    getTargetType: null,
    targetItems: [],
    customers: [],
    priceLists: [],
    daysOfWeek: [],
    maxProductUnits: null,
    consumedProductUnits: 0,
    remainingProductUnits: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── getInitialState ───────────────────────────────────────────────────────────

describe('getInitialState capacity defaults', () => {
  it('creates default to explicit unlimited (null) per create contract', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    expect(state.capacityMode).toBe(PROMOTION_CAPACITY_MODE.UNLIMITED)
    expect(state.maxProductUnits).toBeNull()
    expect(state.consumedProductUnits).toBe(0)
    expect(state.remainingProductUnits).toBeNull()
  })
})

// ── promotionToFormState ──────────────────────────────────────────────────────

describe('promotionToFormState capacity hydration', () => {
  it('hydrates a finite cap as unchanged + preserves the server value', () => {
    const state = promotionToFormState(
      makeResponse({ maxProductUnits: 100, consumedProductUnits: 80, remainingProductUnits: 20 }),
    )
    expect(state.capacityMode).toBe(PROMOTION_CAPACITY_MODE.UNCHANGED)
    expect(state.maxProductUnits).toBe(100)
    expect(state.consumedProductUnits).toBe(80)
    expect(state.remainingProductUnits).toBe(20)
  })

  it('hydrates an unlimited promotion as unchanged + null cap', () => {
    const state = promotionToFormState(makeResponse({ maxProductUnits: null }))
    expect(state.capacityMode).toBe(PROMOTION_CAPACITY_MODE.UNCHANGED)
    expect(state.maxProductUnits).toBeNull()
  })

  it('renders the server-owned remaining value verbatim (never derived)', () => {
    const state = promotionToFormState(
      makeResponse({ maxProductUnits: 100, consumedProductUnits: 10, remainingProductUnits: 89 }),
    )
    expect(state.remainingProductUnits).toBe(89)
  })

  it('preserves absent runtime counters verbatim instead of faking unlimited/zero', () => {
    const response = makeResponse() as unknown as Record<string, unknown>
    delete response.maxProductUnits
    delete response.consumedProductUnits
    delete response.remainingProductUnits

    const state = promotionToFormState(response as unknown as PromotionResponse)

    expect(state.maxProductUnits).toBeUndefined()
    expect(state.consumedProductUnits).toBeUndefined()
    expect(state.remainingProductUnits).toBeUndefined()
  })
})

// ── toCreatePayload ───────────────────────────────────────────────────────────

describe('toCreatePayload capacity serialization', () => {
  it('sends explicit null when the field is unlimited', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Sin cupo',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      capacityMode: PROMOTION_CAPACITY_MODE.UNLIMITED,
      maxProductUnits: null,
    })
    const payload = toCreatePayload(state) as unknown as Record<string, unknown>
    expect('maxProductUnits' in payload).toBe(true)
    expect(payload['maxProductUnits']).toBeNull()
  })

  it('sends the positive integer when limited', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Con cupo',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      capacityMode: PROMOTION_CAPACITY_MODE.LIMITED,
      maxProductUnits: 250,
    })
    const payload = toCreatePayload(state) as unknown as Record<string, unknown>
    expect(payload['maxProductUnits']).toBe(250)
  })

  it('never serializes consumed or remaining counters', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Con cupo',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      capacityMode: PROMOTION_CAPACITY_MODE.LIMITED,
      maxProductUnits: 100,
      consumedProductUnits: 40,
      remainingProductUnits: 60,
    })
    const serialized = JSON.stringify(toCreatePayload(state))
    expect(serialized).not.toContain('consumedProductUnits')
    expect(serialized).not.toContain('remainingProductUnits')
  })

  it('keeps every existing promotion variant valid (PRODUCT_DISCOUNT)', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Variante',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      capacityMode: PROMOTION_CAPACITY_MODE.LIMITED,
      maxProductUnits: 5,
    })
    const payload = toCreatePayload(state) as unknown as Record<string, unknown>
    expect(payload['type']).toBe('PRODUCT_DISCOUNT')
    expect(payload['maxProductUnits']).toBe(5)
  })
})

// ── toUpdatePayload ───────────────────────────────────────────────────────────

describe('toUpdatePayload capacity tri-state', () => {
  function makeEditState() {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Editar',
      discountType: 'PERCENTAGE',
      discountValue: 10,
    })
    return state
  }

  it('omits maxProductUnits when untouched (unchanged)', () => {
    const state = makeEditState()
    Object.assign(state, {
      capacityMode: PROMOTION_CAPACITY_MODE.UNCHANGED,
      maxProductUnits: 100,
    })
    const payload = toUpdatePayload(state) as Record<string, unknown>
    expect('maxProductUnits' in payload).toBe(false)
  })

  it('sends explicit null when explicitly unlimited', () => {
    const state = makeEditState()
    Object.assign(state, {
      capacityMode: PROMOTION_CAPACITY_MODE.UNLIMITED,
      maxProductUnits: 100,
    })
    const payload = toUpdatePayload(state) as Record<string, unknown>
    expect('maxProductUnits' in payload).toBe(true)
    expect(payload['maxProductUnits']).toBeNull()
  })

  it('sends the integer when changed to a limited value', () => {
    const state = makeEditState()
    Object.assign(state, {
      capacityMode: PROMOTION_CAPACITY_MODE.LIMITED,
      maxProductUnits: 42,
    })
    const payload = toUpdatePayload(state) as Record<string, unknown>
    expect(payload['maxProductUnits']).toBe(42)
  })

  it('never sends consumed or remaining counters on update', () => {
    const state = makeEditState()
    Object.assign(state, {
      capacityMode: PROMOTION_CAPACITY_MODE.LIMITED,
      maxProductUnits: 100,
      consumedProductUnits: 30,
      remainingProductUnits: 70,
    })
    const serialized = JSON.stringify(toUpdatePayload(state))
    expect(serialized).not.toContain('consumedProductUnits')
    expect(serialized).not.toContain('remainingProductUnits')
  })
})
