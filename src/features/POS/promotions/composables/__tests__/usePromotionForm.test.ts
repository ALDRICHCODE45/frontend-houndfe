import { describe, it, expect } from 'vitest'
import {
  getInitialState,
  promotionToFormState,
  toCreatePayload,
  toUpdatePayload,
  usePromotionForm,
  mapApiErrorToFields,
  METHOD_OPTIONS,
  DISCOUNT_TYPE_OPTIONS,
  CUSTOMER_SCOPE_OPTIONS,
  DAY_OPTIONS,
  TARGET_TYPE_OPTIONS,
  BUY_X_GET_Y_PRESETS,
  DISCOUNT_PERCENT_OPTIONS,
} from '../usePromotionForm'
import type {
  CreateProductDiscountPayload,
  CreateOrderDiscountPayload,
  CreateBuyXGetYPayload,
  CreateAdvancedPayload,
  PromotionResponse,
} from '../../interfaces/promotion.types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeBaseResponse(overrides: Partial<PromotionResponse> = {}): PromotionResponse {
  return {
    id: 'promo-1',
    title: 'Test Promo',
    type: 'PRODUCT_DISCOUNT',
    method: 'AUTOMATIC',
    status: 'ACTIVE',
    startDate: null,
    endDate: null,
    customerScope: 'ALL',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    minPurchaseAmountCents: null,
    appliesTo: 'CATEGORIES',
    buyQuantity: null,
    getQuantity: null,
    getDiscountPercent: null,
    buyTargetType: null,
    getTargetType: null,
    targetItems: [],
    customers: [],
    priceLists: [],
    daysOfWeek: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── Option arrays ─────────────────────────────────────────────────────────────

describe('METHOD_OPTIONS', () => {
  it('contains AUTOMATIC and MANUAL options', () => {
    const values = METHOD_OPTIONS.map((o) => o.value)
    expect(values).toContain('AUTOMATIC')
    expect(values).toContain('MANUAL')
  })

  it('AUTOMATIC option has a label', () => {
    const opt = METHOD_OPTIONS.find((o) => o.value === 'AUTOMATIC')
    expect(opt!.label).toBe('Automático')
  })
})

describe('DISCOUNT_TYPE_OPTIONS', () => {
  it('contains PERCENTAGE and FIXED options', () => {
    const values = DISCOUNT_TYPE_OPTIONS.map((o) => o.value)
    expect(values).toContain('PERCENTAGE')
    expect(values).toContain('FIXED')
  })
})

describe('CUSTOMER_SCOPE_OPTIONS', () => {
  it('contains ALL, REGISTERED_ONLY, SPECIFIC', () => {
    const values = CUSTOMER_SCOPE_OPTIONS.map((o) => o.value)
    expect(values).toContain('ALL')
    expect(values).toContain('REGISTERED_ONLY')
    expect(values).toContain('SPECIFIC')
  })
})

describe('DAY_OPTIONS', () => {
  it('has 7 day options', () => {
    expect(DAY_OPTIONS).toHaveLength(7)
  })

  it('first day is MONDAY with label Lunes', () => {
    const first = DAY_OPTIONS[0]!
    expect(first.value).toBe('MONDAY')
    expect(first.label).toBe('Lunes')
  })

  it('last day is SUNDAY with label Domingo', () => {
    const last = DAY_OPTIONS[DAY_OPTIONS.length - 1]!
    expect(last.value).toBe('SUNDAY')
    expect(last.label).toBe('Domingo')
  })
})

describe('TARGET_TYPE_OPTIONS', () => {
  it('contains CATEGORIES, BRANDS, PRODUCTS', () => {
    const values = TARGET_TYPE_OPTIONS.map((o) => o.value)
    expect(values).toContain('CATEGORIES')
    expect(values).toContain('BRANDS')
    expect(values).toContain('PRODUCTS')
  })

  it('contains VARIANTS with label "Variantes"', () => {
    const variantsOpt = TARGET_TYPE_OPTIONS.find((o) => o.value === 'VARIANTS')
    expect(variantsOpt).toBeDefined()
    expect(variantsOpt!.label).toBe('Variantes')
  })
})

describe('BUY_X_GET_Y_PRESETS', () => {
  // REQ-10: locked preset table — buy quantities corrected (2x1=1, 3x2=2)
  // and Gratis (100) substituted for the legacy "discount 0".
  it('REGRESSION: 2x1 preset is locked at buyQuantity 1, getQuantity 1, getDiscountPercent 100 (Gratis)', () => {
    const preset = BUY_X_GET_Y_PRESETS.find((p) => p.label === '2x1')
    expect(preset).toBeDefined()
    expect(preset!.buyQuantity).toBe(1)
    expect(preset!.getQuantity).toBe(1)
    expect(preset!.getDiscountPercent).toBe(100)
  })

  it('REGRESSION: 3x2 preset is locked at buyQuantity 2, getQuantity 1, getDiscountPercent 100 (Gratis)', () => {
    const preset = BUY_X_GET_Y_PRESETS.find((p) => p.label === '3x2')
    expect(preset).toBeDefined()
    expect(preset!.buyQuantity).toBe(2)
    expect(preset!.getQuantity).toBe(1)
    expect(preset!.getDiscountPercent).toBe(100)
  })

  it('"Segundo al 50%" preset is locked at buyQuantity 1, getQuantity 1, getDiscountPercent 50', () => {
    const preset = BUY_X_GET_Y_PRESETS.find((p) => p.label === 'Segundo al 50%')
    expect(preset).toBeDefined()
    expect(preset!.buyQuantity).toBe(1)
    expect(preset!.getQuantity).toBe(1)
    expect(preset!.getDiscountPercent).toBe(50)
  })

  it('has exactly the three locked presets (no stale extras)', () => {
    expect(BUY_X_GET_Y_PRESETS).toHaveLength(3)
    expect(BUY_X_GET_Y_PRESETS.map((p) => p.label)).toEqual([
      '2x1',
      '3x2',
      'Segundo al 50%',
    ])
  })
})

describe('DISCOUNT_PERCENT_OPTIONS (REQ-8 extract)', () => {
  // Extract-Before-Mock: this list must live as exported pure data in
  // usePromotionForm.ts so it can be unit-tested without mounting the SFC.
  it('contains a 100 → "Gratis" entry', () => {
    const gratis = DISCOUNT_PERCENT_OPTIONS.find((o) => o.value === 100)
    expect(gratis).toBeDefined()
    expect(gratis!.label).toBe('Gratis')
  })

  it('does NOT contain a value:0 entry (legacy inverted Gratis)', () => {
    const zero = DISCOUNT_PERCENT_OPTIONS.find((o) => o.value === 0)
    expect(zero).toBeUndefined()
  })

  it('contains all 5%-step percentages from 5 through 95 with "X% OFF" labels', () => {
    for (let pct = 5; pct <= 95; pct += 5) {
      const opt = DISCOUNT_PERCENT_OPTIONS.find((o) => o.value === pct)
      expect(opt).toBeDefined()
      expect(opt!.label).toBe(`${pct}% OFF`)
    }
  })

  it('length is 20 (19 stepped percents + 1 Gratis at 100)', () => {
    expect(DISCOUNT_PERCENT_OPTIONS).toHaveLength(20)
  })
})

// ── getInitialState ────────────────────────────────────────────────────────────

describe('getInitialState', () => {
  it('returns PRODUCT_DISCOUNT initial state with empty discount fields and default appliesTo', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    expect(state.type).toBe('PRODUCT_DISCOUNT')
    expect(state.discountType).toBe('')
    expect(state.discountValue).toBe(0)
    expect(state.appliesTo).toBe('PRODUCTS')
    expect(state.targetItems).toEqual([])
  })

  it('returns ORDER_DISCOUNT initial state with hasMinPurchase false', () => {
    const state = getInitialState('ORDER_DISCOUNT')
    expect(state.type).toBe('ORDER_DISCOUNT')
    expect(state.hasMinPurchase).toBe(false)
    expect(state.minPurchaseAmountCents).toBe(0)
  })

  it('returns BUY_X_GET_Y initial state with empty quantity fields', () => {
    const state = getInitialState('BUY_X_GET_Y')
    expect(state.type).toBe('BUY_X_GET_Y')
    expect(state.buyQuantity).toBe(0)
    expect(state.getQuantity).toBe(0)
    expect(state.getDiscountPercent).toBe(0)
  })

  it('returns ADVANCED initial state with default buy/get target types', () => {
    const state = getInitialState('ADVANCED')
    expect(state.type).toBe('ADVANCED')
    expect(state.buyTargetType).toBe('PRODUCTS')
    expect(state.buyTargetItems).toEqual([])
    expect(state.getTargetType).toBe('PRODUCTS')
    expect(state.getTargetItems).toEqual([])
  })

  it('all initial states default to AUTOMATIC method', () => {
    expect(getInitialState('PRODUCT_DISCOUNT').method).toBe('AUTOMATIC')
    expect(getInitialState('ORDER_DISCOUNT').method).toBe('AUTOMATIC')
    expect(getInitialState('BUY_X_GET_Y').method).toBe('AUTOMATIC')
    expect(getInitialState('ADVANCED').method).toBe('AUTOMATIC')
  })

  it('all initial states default customerScope to ALL', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    expect(state.customerScope).toBe('ALL')
    expect(state.customerIds).toEqual([])
  })

  it('initial state has title as empty string', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    expect(state.title).toBe('')
  })

  it('initial state has hasVigencia false and empty dates', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    expect(state.hasVigencia).toBe(false)
    expect(state.startDate).toBe('')
    expect(state.endDate).toBe('')
  })
})

// ── promotionToFormState ───────────────────────────────────────────────────────

describe('promotionToFormState', () => {
  it('maps basic fields correctly', () => {
    const response = makeBaseResponse({ title: 'Promo navidad', method: 'MANUAL' })
    const state = promotionToFormState(response)
    expect(state.title).toBe('Promo navidad')
    expect(state.type).toBe('PRODUCT_DISCOUNT')
    expect(state.method).toBe('MANUAL')
  })

  it('maps discountValue for PRODUCT_DISCOUNT keeping as-is for PERCENTAGE', () => {
    const response = makeBaseResponse({ discountValue: 15, discountType: 'PERCENTAGE' })
    const state = promotionToFormState(response)
    expect(state.discountValue).toBe(15)
    expect(state.discountType).toBe('PERCENTAGE')
  })

  it('maps discountValue for PRODUCT_DISCOUNT converting cents to dollars for FIXED', () => {
    const response = makeBaseResponse({ discountValue: 50000, discountType: 'FIXED' })
    const state = promotionToFormState(response)
    expect(state.discountValue).toBe(500) // 50000 cents → $500
    expect(state.discountType).toBe('FIXED')
  })

  it('maps appliesTo for PRODUCT_DISCOUNT', () => {
    const response = makeBaseResponse({ appliesTo: 'CATEGORIES' })
    const state = promotionToFormState(response)
    expect(state.appliesTo).toBe('CATEGORIES')
  })

  it('maps targetItems for PRODUCT_DISCOUNT (DEFAULT side)', () => {
    const response = makeBaseResponse({
      targetItems: [{ id: 'ti-1', side: 'DEFAULT', targetType: 'CATEGORIES', targetId: 'cat-1' }],
    })
    const state = promotionToFormState(response)
    expect(state.targetItems).toHaveLength(1)
    expect(state.targetItems[0]!.targetId).toBe('cat-1')
  })

  it('maps minPurchaseAmountCents for ORDER_DISCOUNT (cents → dollars for display)', () => {
    const response = makeBaseResponse({
      type: 'ORDER_DISCOUNT',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      appliesTo: null,
      minPurchaseAmountCents: 10000,
    })
    const state = promotionToFormState(response)
    expect(state.hasMinPurchase).toBe(true)
    expect(state.minPurchaseAmountCents).toBe(100) // 10000 cents → $100
  })

  it('maps hasMinPurchase to false when minPurchaseAmountCents is null', () => {
    const response = makeBaseResponse({
      type: 'ORDER_DISCOUNT',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      appliesTo: null,
      minPurchaseAmountCents: null,
    })
    const state = promotionToFormState(response)
    expect(state.hasMinPurchase).toBe(false)
    expect(state.minPurchaseAmountCents).toBe(0)
  })

  it('maps buyQuantity / getQuantity for BUY_X_GET_Y', () => {
    const response = makeBaseResponse({
      type: 'BUY_X_GET_Y',
      discountType: null,
      discountValue: null,
      appliesTo: 'PRODUCTS',
      buyQuantity: 2,
      getQuantity: 1,
      getDiscountPercent: 0,
    })
    const state = promotionToFormState(response)
    expect(state.buyQuantity).toBe(2)
    expect(state.getQuantity).toBe(1)
    expect(state.getDiscountPercent).toBe(0)
  })

  it('maps BUY side targetItems for ADVANCED', () => {
    const response = makeBaseResponse({
      type: 'ADVANCED',
      discountType: null,
      discountValue: null,
      appliesTo: null,
      buyQuantity: 3,
      getQuantity: 1,
      getDiscountPercent: 50,
      buyTargetType: 'PRODUCTS',
      getTargetType: 'CATEGORIES',
      targetItems: [
        { id: 'ti-1', side: 'BUY', targetType: 'PRODUCTS', targetId: 'prod-1' },
        { id: 'ti-2', side: 'GET', targetType: 'CATEGORIES', targetId: 'cat-1' },
      ],
    })
    const state = promotionToFormState(response)
    expect(state.buyTargetType).toBe('PRODUCTS')
    expect(state.buyTargetItems).toHaveLength(1)
    expect(state.buyTargetItems[0]!.targetId).toBe('prod-1')
    expect(state.getTargetType).toBe('CATEGORIES')
    expect(state.getTargetItems).toHaveLength(1)
    expect(state.getTargetItems[0]!.targetId).toBe('cat-1')
  })

  it('maps customerScope and customer ids', () => {
    const response = makeBaseResponse({
      customerScope: 'SPECIFIC',
      customers: [
        { id: 'pc-1', customerId: 'cust-1', customer: null },
        { id: 'pc-2', customerId: 'cust-2', customer: null },
      ],
    })
    const state = promotionToFormState(response)
    expect(state.customerScope).toBe('SPECIFIC')
    expect(state.customerIds).toEqual(['cust-1', 'cust-2'])
  })

  it('maps priceListIds correctly', () => {
    const response = makeBaseResponse({
      priceLists: [{ id: 'pl-1', globalPriceListId: 'gpl-1', globalPriceList: null }],
    })
    const state = promotionToFormState(response)
    expect(state.hasPriceLists).toBe(true)
    expect(state.priceListIds).toEqual(['gpl-1'])
  })

  it('maps daysOfWeek correctly', () => {
    const response = makeBaseResponse({
      daysOfWeek: [
        { id: 'dow-1', day: 'MONDAY' },
        { id: 'dow-2', day: 'FRIDAY' },
      ],
    })
    const state = promotionToFormState(response)
    expect(state.hasDaysOfWeek).toBe(true)
    expect(state.daysOfWeek).toEqual(['MONDAY', 'FRIDAY'])
  })

  it('maps startDate and endDate with hasVigencia true when dates exist', () => {
    const response = makeBaseResponse({
      startDate: '2026-02-01',
      endDate: '2026-03-01',
    })
    const state = promotionToFormState(response)
    expect(state.hasVigencia).toBe(true)
    expect(state.startDate).toBe('2026-02-01')
    expect(state.endDate).toBe('2026-03-01')
  })

  it('sets hasVigencia false when startDate is null', () => {
    const response = makeBaseResponse({ startDate: null, endDate: null })
    const state = promotionToFormState(response)
    expect(state.hasVigencia).toBe(false)
  })

  // ── REQ-8: Edit-mode enriched VARIANTS hydration from backend read response ─
  //
  // Spec scenarios:
  //   - Enriched VARIANTS entry → name === variantName, productId/productName carried
  //     (applies to DEFAULT / BUY / GET sides — side-agnostic)
  //   - Deleted variant (enrichment fields ABSENT) → name === '' with productId/
  //     productName UNDEFINED, never throws
  //   - Non-VARIANTS entries (CATEGORIES / BRANDS / PRODUCTS) hydration UNCHANGED
  //     regardless of whether enrichment fields are present (the response could
  //     theoretically include them for any targetType — they MUST be ignored)

  it('REQ-8: enriched VARIANTS entry on DEFAULT side hydrates name from variantName and carries productId + productName', () => {
    const response = makeBaseResponse({
      appliesTo: 'VARIANTS',
      targetItems: [
        {
          id: 'ti-1',
          side: 'DEFAULT',
          targetType: 'VARIANTS',
          targetId: 'v1',
          productId: 'p1',
          variantName: 'Talle M',
          productName: 'Camisa',
        },
      ],
    })
    const state = promotionToFormState(response)
    expect(state.targetItems).toEqual([
      { targetId: 'v1', name: 'Talle M', productId: 'p1', productName: 'Camisa' },
    ])
  })

  it('REQ-8: enriched VARIANTS entry on BUY side (ADVANCED) hydrates identically — side-agnostic', () => {
    const response = makeBaseResponse({
      type: 'ADVANCED',
      discountType: null,
      discountValue: null,
      appliesTo: null,
      buyQuantity: 2,
      getQuantity: 1,
      getDiscountPercent: 50,
      buyTargetType: 'VARIANTS',
      getTargetType: 'VARIANTS',
      targetItems: [
        {
          id: 'ti-1',
          side: 'BUY',
          targetType: 'VARIANTS',
          targetId: 'v-buy',
          productId: 'p1',
          variantName: 'Rojo',
          productName: 'Remera',
        },
      ],
    })
    const state = promotionToFormState(response)
    expect(state.buyTargetItems).toEqual([
      { targetId: 'v-buy', name: 'Rojo', productId: 'p1', productName: 'Remera' },
    ])
    // GET side still untouched (no entry → empty array)
    expect(state.getTargetItems).toEqual([])
  })

  it('REQ-8: enriched VARIANTS entry on GET side (ADVANCED) hydrates identically — side-agnostic', () => {
    const response = makeBaseResponse({
      type: 'ADVANCED',
      discountType: null,
      discountValue: null,
      appliesTo: null,
      buyQuantity: 2,
      getQuantity: 1,
      getDiscountPercent: 50,
      buyTargetType: 'VARIANTS',
      getTargetType: 'VARIANTS',
      targetItems: [
        {
          id: 'ti-1',
          side: 'GET',
          targetType: 'VARIANTS',
          targetId: 'v-get',
          productId: 'p2',
          variantName: 'XL',
          productName: 'Buzo',
        },
      ],
    })
    const state = promotionToFormState(response)
    expect(state.getTargetItems).toEqual([
      { targetId: 'v-get', name: 'XL', productId: 'p2', productName: 'Buzo' },
    ])
    // BUY side still untouched
    expect(state.buyTargetItems).toEqual([])
  })

  it('REQ-8: BUY_X_GET_Y with VARIANTS appliesTo and enriched DEFAULT entry hydrates name (BUG_X_GET_Y uses DEFAULT side)', () => {
    const response = makeBaseResponse({
      type: 'BUY_X_GET_Y',
      discountType: null,
      discountValue: null,
      appliesTo: 'VARIANTS',
      buyQuantity: 2,
      getQuantity: 1,
      getDiscountPercent: 0,
      targetItems: [
        {
          id: 'ti-1',
          side: 'DEFAULT',
          targetType: 'VARIANTS',
          targetId: 'v-2x1',
          productId: 'p1',
          variantName: 'Negro',
          productName: 'Camiseta',
        },
      ],
    })
    const state = promotionToFormState(response)
    expect(state.targetItems).toEqual([
      { targetId: 'v-2x1', name: 'Negro', productId: 'p1', productName: 'Camiseta' },
    ])
  })

  it('REQ-8: deleted-variant VARIANTS entry (enrichment fields absent) hydrates to name="" with productId/productName UNDEFINED, no throw', () => {
    // Backend omits enrichment fields when the variant was deleted (no 404 thrown).
    // The shape: the variant id is preserved (so the chip shows the honest UUID
    // via `name || targetId`), and productId/productName are UNDEFINED — never
    // null, never empty string (so the serializer spread does not promote them
    // into the payload).
    const response = makeBaseResponse({
      appliesTo: 'VARIANTS',
      targetItems: [
        { id: 'ti-1', side: 'DEFAULT', targetType: 'VARIANTS', targetId: 'v-deleted' },
      ],
    })
    const state = promotionToFormState(response)
    expect(state.targetItems).toHaveLength(1)
    const entry = state.targetItems[0]!
    expect(entry.targetId).toBe('v-deleted')
    expect(entry.name).toBe('')
    // productId / productName MUST be UNDEFINED (not null, not empty string)
    // so the toCreatePayload spread never promotes them into the request body.
    expect(entry.productId).toBeUndefined()
    expect(entry.productName).toBeUndefined()
    expect('productId' in entry).toBe(false)
    expect('productName' in entry).toBe(false)
  })

  it('REQ-8: deleted-variant VARIANTS on BUY side — identical fallback behavior, no throw', () => {
    const response = makeBaseResponse({
      type: 'ADVANCED',
      discountType: null,
      discountValue: null,
      appliesTo: null,
      buyQuantity: 2,
      getQuantity: 1,
      getDiscountPercent: 50,
      buyTargetType: 'VARIANTS',
      getTargetType: 'VARIANTS',
      targetItems: [
        { id: 'ti-1', side: 'BUY', targetType: 'VARIANTS', targetId: 'v-buy-deleted' },
      ],
    })
    const state = promotionToFormState(response)
    expect(state.buyTargetItems).toEqual([{ targetId: 'v-buy-deleted', name: '' }])
  })

  it('REQ-8: deleted-variant VARIANTS on GET side — identical fallback behavior, no throw', () => {
    const response = makeBaseResponse({
      type: 'ADVANCED',
      discountType: null,
      discountValue: null,
      appliesTo: null,
      buyQuantity: 2,
      getQuantity: 1,
      getDiscountPercent: 50,
      buyTargetType: 'VARIANTS',
      getTargetType: 'VARIANTS',
      targetItems: [
        { id: 'ti-1', side: 'GET', targetType: 'VARIANTS', targetId: 'v-get-deleted' },
      ],
    })
    const state = promotionToFormState(response)
    expect(state.getTargetItems).toEqual([{ targetId: 'v-get-deleted', name: '' }])
  })

  it('REQ-8: non-VARIANTS items (CATEGORIES) are hydration-untouched even if enrichment fields are present', () => {
    // The backend only enriches VARIANTS, but a defensive guard: enrichment
    // fields on a CATEGORIES entry MUST be ignored — `name` must remain ''
    // (the chip will fall back to targetId via the chipLabel util).
    const response = makeBaseResponse({
      appliesTo: 'CATEGORIES',
      targetItems: [
        {
          id: 'ti-1',
          side: 'DEFAULT',
          targetType: 'CATEGORIES',
          targetId: 'cat-1',
          productId: 'p1',
          variantName: 'Talle M',
          productName: 'Camisa',
        },
      ],
    })
    const state = promotionToFormState(response)
    expect(state.targetItems).toEqual([{ targetId: 'cat-1', name: '' }])
  })

  it('REQ-8: non-VARIANTS items (BRANDS) are hydration-untouched even if enrichment fields are present', () => {
    const response = makeBaseResponse({
      appliesTo: 'BRANDS',
      targetItems: [
        {
          id: 'ti-1',
          side: 'DEFAULT',
          targetType: 'BRANDS',
          targetId: 'brand-1',
          productId: 'p1',
          variantName: 'Talle M',
          productName: 'Camisa',
        },
      ],
    })
    const state = promotionToFormState(response)
    expect(state.targetItems).toEqual([{ targetId: 'brand-1', name: '' }])
  })

  it('REQ-8: non-VARIANTS items (PRODUCTS) are hydration-untouched even if enrichment fields are present', () => {
    const response = makeBaseResponse({
      appliesTo: 'PRODUCTS',
      targetItems: [
        {
          id: 'ti-1',
          side: 'DEFAULT',
          targetType: 'PRODUCTS',
          targetId: 'prod-1',
          productId: 'p1',
          variantName: 'Talle M',
          productName: 'Camisa',
        },
      ],
    })
    const state = promotionToFormState(response)
    expect(state.targetItems).toEqual([{ targetId: 'prod-1', name: '' }])
  })
})

// ── toCreatePayload ────────────────────────────────────────────────────────────

describe('toCreatePayload', () => {
  it('builds PRODUCT_DISCOUNT payload with discountValue as-is (form stores in API-expected units)', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Summer Sale',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      appliesTo: 'CATEGORIES',
      targetItems: [{ targetId: 'cat-1', name: 'Iluminación' }],
    })
    const payload = toCreatePayload(state) as CreateProductDiscountPayload
    expect(payload.type).toBe('PRODUCT_DISCOUNT')
    expect(payload.title).toBe('Summer Sale')
    expect(payload.discountType).toBe('PERCENTAGE')
    expect(payload.discountValue).toBe(15)
    expect(payload.appliesTo).toBe('CATEGORIES')
    expect(payload.targetItems).toHaveLength(1)
    expect(payload.targetItems![0]!.targetId).toBe('cat-1')
    expect(payload.targetItems![0]!.targetType).toBe('CATEGORIES')
  })

  it('builds ORDER_DISCOUNT payload without minPurchaseAmountCents when hasMinPurchase=false', () => {
    const state = getInitialState('ORDER_DISCOUNT')
    Object.assign(state, {
      title: 'Order Discount',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      hasMinPurchase: false,
      minPurchaseAmountCents: 0,
    })
    const payload = toCreatePayload(state) as CreateOrderDiscountPayload
    expect(payload.type).toBe('ORDER_DISCOUNT')
    expect(payload.minPurchaseAmountCents).toBeUndefined()
  })

  it('builds ORDER_DISCOUNT payload WITH minPurchaseAmountCents converted to cents when hasMinPurchase=true', () => {
    const state = getInitialState('ORDER_DISCOUNT')
    Object.assign(state, {
      title: 'Order Discount Min',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      hasMinPurchase: true,
      minPurchaseAmountCents: 100, // user enters $100
    })
    const payload = toCreatePayload(state) as CreateOrderDiscountPayload
    expect(payload.minPurchaseAmountCents).toBe(10000) // sent as 10000 cents to backend
  })

  it('builds BUY_X_GET_Y payload with numeric quantities', () => {
    const state = getInitialState('BUY_X_GET_Y')
    Object.assign(state, {
      title: '2x1',
      method: 'AUTOMATIC',
      buyQuantity: 2,
      getQuantity: 1,
      getDiscountPercent: 0,
      appliesTo: 'PRODUCTS',
      targetItems: [{ targetId: 'prod-1', name: 'Product A' }],
    })
    const payload = toCreatePayload(state) as CreateBuyXGetYPayload
    expect(payload.type).toBe('BUY_X_GET_Y')
    expect(payload.buyQuantity).toBe(2)
    expect(payload.getQuantity).toBe(1)
    expect(payload.getDiscountPercent).toBe(0)
  })

  it('builds ADVANCED payload mapping BUY and GET target items', () => {
    const state = getInitialState('ADVANCED')
    Object.assign(state, {
      title: 'Advanced Promo',
      method: 'MANUAL',
      buyQuantity: 3,
      getQuantity: 1,
      getDiscountPercent: 50,
      buyTargetType: 'PRODUCTS',
      buyTargetItems: [{ targetId: 'prod-1', name: 'Prod A' }],
      getTargetType: 'CATEGORIES',
      getTargetItems: [{ targetId: 'cat-1', name: 'Cat A' }],
    })
    const payload = toCreatePayload(state) as CreateAdvancedPayload
    expect(payload.type).toBe('ADVANCED')
    expect(payload.buyQuantity).toBe(3)
    expect(payload.getQuantity).toBe(1)
    expect(payload.getDiscountPercent).toBe(50)
    expect(payload.buyTargetType).toBe('PRODUCTS')
    expect(payload.buyTargetItems).toHaveLength(1)
    expect(payload.buyTargetItems![0]!.targetId).toBe('prod-1')
    expect(payload.getTargetType).toBe('CATEGORIES')
    expect(payload.getTargetItems).toHaveLength(1)
    expect(payload.getTargetItems![0]!.targetId).toBe('cat-1')
  })

  it('sends empty customerIds array when customerScope is ALL (clears relation)', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Test',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      appliesTo: 'PRODUCTS',
      customerScope: 'ALL',
      customerIds: ['cust-1'],
    })
    const payload = toCreatePayload(state)
    // Must send [] to clear the relation, NOT undefined
    expect(payload.customerIds).toEqual([])
  })

  it('sends empty customerIds array when customerScope is REGISTERED_ONLY (clears relation)', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Test',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      appliesTo: 'PRODUCTS',
      customerScope: 'REGISTERED_ONLY',
      customerIds: ['cust-1'],
    })
    const payload = toCreatePayload(state)
    // Must send [] to clear the relation, NOT undefined
    expect(payload.customerIds).toEqual([])
  })

  it('includes customerIds when customerScope is SPECIFIC', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Test',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      appliesTo: 'PRODUCTS',
      customerScope: 'SPECIFIC',
      customerIds: ['cust-1', 'cust-2'],
    })
    const payload = toCreatePayload(state)
    expect(payload.customerIds).toEqual(['cust-1', 'cust-2'])
  })

  it('includes priceListIds when hasPriceLists is true', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Test',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      appliesTo: 'PRODUCTS',
      hasPriceLists: true,
      priceListIds: ['gpl-1'],
    })
    const payload = toCreatePayload(state)
    expect(payload.priceListIds).toEqual(['gpl-1'])
  })

  it('sends empty priceListIds array when hasPriceLists is false (clears relation)', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Test',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      appliesTo: 'PRODUCTS',
      hasPriceLists: false,
      priceListIds: ['gpl-1'],
    })
    const payload = toCreatePayload(state)
    // Must send [] to clear the relation, NOT undefined
    expect(payload.priceListIds).toEqual([])
  })

  it('includes daysOfWeek when hasDaysOfWeek is true', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Test',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      appliesTo: 'PRODUCTS',
      hasDaysOfWeek: true,
      daysOfWeek: ['MONDAY', 'FRIDAY'],
    })
    const payload = toCreatePayload(state)
    expect(payload.daysOfWeek).toEqual(['MONDAY', 'FRIDAY'])
  })

  it('sends empty daysOfWeek array when hasDaysOfWeek is false (clears relation)', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Test',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      appliesTo: 'PRODUCTS',
      hasDaysOfWeek: false,
      daysOfWeek: ['MONDAY'],
    })
    const payload = toCreatePayload(state)
    // Must send [] to clear the relation, NOT undefined
    expect(payload.daysOfWeek).toEqual([])
  })

  it('includes startDate and endDate when hasVigencia is true', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Test',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      appliesTo: 'PRODUCTS',
      hasVigencia: true,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    })
    const payload = toCreatePayload(state)
    expect(payload.startDate).toBe('2026-01-01')
    expect(payload.endDate).toBe('2026-12-31')
  })

  it('omits startDate and endDate when hasVigencia is false', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Test',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      appliesTo: 'PRODUCTS',
      hasVigencia: false,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    })
    const payload = toCreatePayload(state)
    expect(payload.startDate).toBeUndefined()
    expect(payload.endDate).toBeUndefined()
  })

  it('targetItems get correct targetType from appliesTo for PRODUCT_DISCOUNT', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Test',
      method: 'AUTOMATIC',
      discountType: 'FIXED',
      discountValue: 500, // user enters $500
      appliesTo: 'BRANDS',
      targetItems: [
        { targetId: 'brand-1', name: 'Brand A' },
        { targetId: 'brand-2', name: 'Brand B' },
      ],
    })
    const payload = toCreatePayload(state) as CreateProductDiscountPayload
    expect(payload.discountValue).toBe(50000) // FIXED values converted to cents for backend
    expect(payload.targetItems).toHaveLength(2)
    expect(payload.targetItems![0]!.targetType).toBe('BRANDS')
    expect(payload.targetItems![1]!.targetType).toBe('BRANDS')
  })

  it('VARIANTS payload shape: targetItems emit only {targetType, targetId} and strip productId/name/side', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Variants Discount',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      appliesTo: 'VARIANTS',
      targetItems: [
        {
          targetId: 'v1',
          name: 'Talle M',
          productId: 'p1',
          productName: 'Camisa',
        },
      ],
    })
    const payload = toCreatePayload(state) as CreateProductDiscountPayload
    expect(payload.appliesTo).toBe('VARIANTS')
    expect(payload.targetItems).toEqual([{ targetType: 'VARIANTS', targetId: 'v1' }])
    // Hard invariant: the optional productId / productName / side / id keys must
    // NEVER leak into the payload sent to the backend (REQ-4 invariant).
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('productId')
    expect(serialized).not.toContain('productName')
    expect(serialized).not.toContain('"side"')
    expect(serialized).not.toContain('Talle M')
  })

  // ── REQ-8: INV-1 + INV-3 write-payload regression for enriched hydration ──
  //
  // Spec scenario: "Write payload remains { targetType, targetId }".
  // End-to-end: load a PromotionResponse with enriched VARIANTS entries
  // across all three sides, hydrate through `promotionToFormState`, then
  // serialize with `toCreatePayload` (PRODUCT_DISCOUNT + BUY_X_GET_Y) and
  // `toUpdatePayload` (ADVANCED). Assert each entry contains ONLY
  // { targetType, targetId } and the enrichment fields NEVER leak.

  it('REQ-8: PRODUCT_DISCOUNT write payload: enriched VARIANTS entry hydrates then serializes to { targetType, targetId } only', () => {
    const response = makeBaseResponse({
      appliesTo: 'VARIANTS',
      targetItems: [
        {
          id: 'ti-1',
          side: 'DEFAULT',
          targetType: 'VARIANTS',
          targetId: 'v1',
          productId: 'p1',
          variantName: 'Talle M',
          productName: 'Camisa',
        },
      ],
    })
    const state = promotionToFormState(response)
    // Re-mark required non-target fields the hydration doesn't touch.
    state.discountType = 'PERCENTAGE'
    state.discountValue = 10

    const payload = toCreatePayload(state) as CreateProductDiscountPayload
    expect(payload.targetItems).toEqual([{ targetType: 'VARIANTS', targetId: 'v1' }])
    // Hard invariant: enrichment fields MUST NEVER appear in the request body.
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('productId')
    expect(serialized).not.toContain('variantName')
    expect(serialized).not.toContain('productName')
    expect(serialized).not.toContain('Talle M')
    expect(serialized).not.toContain('Camisa')
  })

  it('REQ-8: BUY_X_GET_Y write payload: enriched VARIANTS entry hydrates then serializes to { targetType, targetId } only', () => {
    const response = makeBaseResponse({
      type: 'BUY_X_GET_Y',
      discountType: null,
      discountValue: null,
      appliesTo: 'VARIANTS',
      buyQuantity: 2,
      getQuantity: 1,
      getDiscountPercent: 0,
      targetItems: [
        {
          id: 'ti-1',
          side: 'DEFAULT',
          targetType: 'VARIANTS',
          targetId: 'v-2x1',
          productId: 'p1',
          variantName: 'Negro',
          productName: 'Camiseta',
        },
      ],
    })
    const state = promotionToFormState(response)

    const payload = toCreatePayload(state) as CreateBuyXGetYPayload
    expect(payload.type).toBe('BUY_X_GET_Y')
    expect(payload.targetItems).toEqual([{ targetType: 'VARIANTS', targetId: 'v-2x1' }])
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('productId')
    expect(serialized).not.toContain('variantName')
    expect(serialized).not.toContain('productName')
    expect(serialized).not.toContain('Negro')
    expect(serialized).not.toContain('Camiseta')
  })

  it('REQ-8: ADVANCED write payload (toUpdatePayload): enriched VARIANTS entries on BUY + GET sides hydrate then serialize to { targetId } only', () => {
    const response = makeBaseResponse({
      type: 'ADVANCED',
      discountType: null,
      discountValue: null,
      appliesTo: null,
      buyQuantity: 2,
      getQuantity: 1,
      getDiscountPercent: 50,
      buyTargetType: 'VARIANTS',
      getTargetType: 'VARIANTS',
      targetItems: [
        {
          id: 'ti-1',
          side: 'BUY',
          targetType: 'VARIANTS',
          targetId: 'v-buy',
          productId: 'p1',
          variantName: 'Rojo',
          productName: 'Remera',
        },
        {
          id: 'ti-2',
          side: 'GET',
          targetType: 'VARIANTS',
          targetId: 'v-get',
          productId: 'p2',
          variantName: 'XL',
          productName: 'Buzo',
        },
      ],
    })
    const state = promotionToFormState(response)

    const payload = toUpdatePayload(state) as Record<string, unknown>
    const buyArr = payload['buyTargetItems'] as Array<Record<string, unknown>>
    const getArr = payload['getTargetItems'] as Array<Record<string, unknown>>

    expect(buyArr).toEqual([{ targetId: 'v-buy' }])
    expect(getArr).toEqual([{ targetId: 'v-get' }])
    // Hard invariant: enrichment fields MUST NEVER leak into the update body.
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('productId')
    expect(serialized).not.toContain('variantName')
    expect(serialized).not.toContain('productName')
    expect(serialized).not.toContain('Rojo')
    expect(serialized).not.toContain('XL')
    expect(serialized).not.toContain('Remera')
    expect(serialized).not.toContain('Buzo')
  })

  it('REQ-8: deleted-variant enrichment-absent entry hydrates with UNDEFINED productId/productName — never promotes null into the payload', () => {
    // Hard guard: when enrichment is absent, hydration MUST NOT set productId/
    // productName to null (which would survive the serializer spread and leak
    // to the backend). They MUST be UNDEFINED so the spread strips them.
    const response = makeBaseResponse({
      appliesTo: 'VARIANTS',
      targetItems: [
        { id: 'ti-1', side: 'DEFAULT', targetType: 'VARIANTS', targetId: 'v-deleted' },
      ],
    })
    const state = promotionToFormState(response)
    const entry = state.targetItems[0]!
    expect(entry.productId).toBeUndefined()
    expect(entry.productName).toBeUndefined()
    expect(entry.name).toBe('')

    state.discountType = 'PERCENTAGE'
    state.discountValue = 10
    const payload = toCreatePayload(state) as CreateProductDiscountPayload
    expect(payload.targetItems).toEqual([{ targetType: 'VARIANTS', targetId: 'v-deleted' }])
    // Verify the serialized form has no `null` keys either.
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('null')
    expect(serialized).not.toContain('productId')
    expect(serialized).not.toContain('productName')
  })
})

// ── toUpdatePayload ────────────────────────────────────────────────────────────

describe('toUpdatePayload', () => {
  it('returns a partial payload without type field', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Updated Title',
      method: 'MANUAL',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      appliesTo: 'PRODUCTS',
    })
    const payload = toUpdatePayload(state)
    expect('type' in payload).toBe(false)
    expect(payload.title).toBe('Updated Title')
    expect(payload.method).toBe('MANUAL')
  })

  it('toUpdatePayload discountValue is numeric', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    Object.assign(state, {
      title: 'Test',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 25,
      appliesTo: 'CATEGORIES',
    })
    const payload = toUpdatePayload(state) as Record<string, unknown>
    expect(payload['discountValue']).toBe(25)
  })

  it('toUpdatePayload for ORDER_DISCOUNT includes minPurchaseAmountCents converted to cents when set', () => {
    const state = getInitialState('ORDER_DISCOUNT')
    Object.assign(state, {
      title: 'Test',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      hasMinPurchase: true,
      minPurchaseAmountCents: 50, // user enters $50
    })
    const payload = toUpdatePayload(state) as Record<string, unknown>
    expect(payload['minPurchaseAmountCents']).toBe(5000) // sent as 5000 cents to backend
  })
})

// ── mapApiErrorToFields ────────────────────────────────────────────────────────

describe('mapApiErrorToFields', () => {
  it('maps INVALID_DATE_RANGE to endDate field error', () => {
    const result = mapApiErrorToFields({ error: 'INVALID_DATE_RANGE', message: 'bad dates' })
    expect(result.fieldErrors).toHaveLength(1)
    expect(result.fieldErrors[0]!.path).toBe('endDate')
    expect(result.fieldErrors[0]!.message).toBe(
      'La fecha de fin debe ser posterior a la fecha de inicio',
    )
    expect(result.toastMessage).toBeNull()
  })

  it('maps MISSING_REQUIRED_FIELD with "title" in message to title field error', () => {
    const result = mapApiErrorToFields({
      error: 'MISSING_REQUIRED_FIELD',
      message: 'Field title is required',
    })
    expect(result.fieldErrors).toHaveLength(1)
    expect(result.fieldErrors[0]!.path).toBe('title')
    expect(result.fieldErrors[0]!.message).toContain('requerido')
    expect(result.toastMessage).toBeNull()
  })

  it('maps MISSING_REQUIRED_FIELD with unmapped field to toast fallback', () => {
    const result = mapApiErrorToFields({
      error: 'MISSING_REQUIRED_FIELD',
      message: 'Field unknownField is required',
    })
    expect(result.fieldErrors).toHaveLength(0)
    expect(result.toastMessage).not.toBeNull()
  })

  it('maps DUPLICATE_TARGET to field-level error on targetItems (S39)', () => {
    const result = mapApiErrorToFields({ error: 'DUPLICATE_TARGET', message: 'duplicate' })
    expect(result.fieldErrors).toHaveLength(1)
    expect(result.fieldErrors[0]!.path).toBe('targetItems')
    expect(result.fieldErrors[0]!.message).toBe(
      'Hay targets duplicados. Revisá que no haya items repetidos.',
    )
    expect(result.toastMessage).toBeNull()
  })

  it('maps INVALID_TARGET to field-level error on targetItems with Spanish message (REQ-6)', () => {
    const result = mapApiErrorToFields({
      error: 'INVALID_TARGET',
      message: 'Variant not found',
    })
    expect(result.fieldErrors).toHaveLength(1)
    expect(result.fieldErrors[0]!.path).toBe('targetItems')
    expect(result.fieldErrors[0]!.message).toBe(
      'La variante seleccionada no existe o no pertenece a tu comercio',
    )
    expect(result.toastMessage).toBeNull()
  })

  it('maps ENTITY_ALREADY_EXISTS to toast (cannot bind to specific field)', () => {
    const result = mapApiErrorToFields({ error: 'ENTITY_ALREADY_EXISTS', message: 'exists' })
    expect(result.fieldErrors).toHaveLength(0)
    expect(result.toastMessage).toBe('Ya existe una promoción con esos datos.')
  })

  it('maps INVALID_FIELD_VALUE with "discountValue" in message to discountValue field', () => {
    const result = mapApiErrorToFields({
      error: 'INVALID_FIELD_VALUE',
      message: 'discountValue must be positive',
    })
    expect(result.fieldErrors).toHaveLength(1)
    expect(result.fieldErrors[0]!.path).toBe('discountValue')
  })

  it('returns toast for completely unknown error code', () => {
    const result = mapApiErrorToFields({ error: 'UNKNOWN_CODE', message: 'something went wrong' })
    expect(result.fieldErrors).toHaveLength(0)
    expect(result.toastMessage).toBe('something went wrong')
  })

  it('returns generic toast when no error and no message', () => {
    const result = mapApiErrorToFields({})
    expect(result.fieldErrors).toHaveLength(0)
    expect(result.toastMessage).not.toBeNull()
  })
})

// ── usePromotionForm composable ────────────────────────────────────────────────

describe('usePromotionForm', () => {
  it('returns schema, state, resetForm, setState', () => {
    const { schema, state, resetForm, setState } = usePromotionForm('PRODUCT_DISCOUNT')
    expect(schema).toBeDefined()
    expect(state).toBeDefined()
    expect(typeof resetForm).toBe('function')
    expect(typeof setState).toBe('function')
  })

  it('state is initialized for the given type', () => {
    const { state } = usePromotionForm('ORDER_DISCOUNT')
    expect(state.type).toBe('ORDER_DISCOUNT')
    expect(state.hasMinPurchase).toBe(false)
  })

  it('resetForm restores initial state', () => {
    const { state, resetForm } = usePromotionForm('PRODUCT_DISCOUNT')
    state.title = 'Modified Title'
    state.discountValue = 42
    resetForm()
    expect(state.title).toBe('')
    expect(state.discountValue).toBe(0)
  })

  it('setState updates state reactively', () => {
    const { state, setState } = usePromotionForm('BUY_X_GET_Y')
    setState({ ...getInitialState('BUY_X_GET_Y'), buyQuantity: 3, getQuantity: 2 })
    expect(state.buyQuantity).toBe(3)
    expect(state.getQuantity).toBe(2)
  })
})
