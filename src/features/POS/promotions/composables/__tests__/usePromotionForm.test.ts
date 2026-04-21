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
})

describe('BUY_X_GET_Y_PRESETS', () => {
  it('has 2x1 preset with buyQuantity 2, getQuantity 1, getDiscountPercent 0', () => {
    const preset = BUY_X_GET_Y_PRESETS.find((p) => p.label === '2x1')
    expect(preset).toBeDefined()
    expect(preset!.buyQuantity).toBe(2)
    expect(preset!.getQuantity).toBe(1)
    expect(preset!.getDiscountPercent).toBe(0)
  })

  it('has 3x2 preset with buyQuantity 3, getQuantity 2', () => {
    const preset = BUY_X_GET_Y_PRESETS.find((p) => p.label === '3x2')
    expect(preset).toBeDefined()
    expect(preset!.buyQuantity).toBe(3)
    expect(preset!.getQuantity).toBe(2)
  })

  it('has at least 3 presets', () => {
    expect(BUY_X_GET_Y_PRESETS.length).toBeGreaterThanOrEqual(3)
  })
})

// ── getInitialState ────────────────────────────────────────────────────────────

describe('getInitialState', () => {
  it('returns PRODUCT_DISCOUNT initial state with empty discount fields', () => {
    const state = getInitialState('PRODUCT_DISCOUNT')
    expect(state.type).toBe('PRODUCT_DISCOUNT')
    expect(state.discountType).toBe('')
    expect(state.discountValue).toBe(0)
    expect(state.appliesTo).toBe('')
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

  it('returns ADVANCED initial state with empty buy/get target fields', () => {
    const state = getInitialState('ADVANCED')
    expect(state.type).toBe('ADVANCED')
    expect(state.buyTargetType).toBe('')
    expect(state.buyTargetItems).toEqual([])
    expect(state.getTargetType).toBe('')
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

  it('maps discountValue for PRODUCT_DISCOUNT keeping as number', () => {
    const response = makeBaseResponse({ discountValue: 15, discountType: 'PERCENTAGE' })
    const state = promotionToFormState(response)
    expect(state.discountValue).toBe(15)
    expect(state.discountType).toBe('PERCENTAGE')
  })

  it('maps appliesTo for PRODUCT_DISCOUNT', () => {
    const response = makeBaseResponse({ appliesTo: 'CATEGORIES' })
    const state = promotionToFormState(response)
    expect(state.appliesTo).toBe('CATEGORIES')
  })

  it('maps targetItems for PRODUCT_DISCOUNT (DEFAULT side)', () => {
    const response = makeBaseResponse({
      targetItems: [
        { id: 'ti-1', side: 'DEFAULT', targetType: 'CATEGORIES', targetId: 'cat-1' },
      ],
    })
    const state = promotionToFormState(response)
    expect(state.targetItems).toHaveLength(1)
    expect(state.targetItems[0]!.targetId).toBe('cat-1')
  })

  it('maps minPurchaseAmountCents for ORDER_DISCOUNT (cents → number, no division)', () => {
    const response = makeBaseResponse({
      type: 'ORDER_DISCOUNT',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      appliesTo: null,
      minPurchaseAmountCents: 10000,
    })
    const state = promotionToFormState(response)
    expect(state.hasMinPurchase).toBe(true)
    expect(state.minPurchaseAmountCents).toBe(10000)
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
      priceLists: [
        { id: 'pl-1', globalPriceListId: 'gpl-1', globalPriceList: null },
      ],
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

  it('builds ORDER_DISCOUNT payload WITH minPurchaseAmountCents as number when hasMinPurchase=true', () => {
    const state = getInitialState('ORDER_DISCOUNT')
    Object.assign(state, {
      title: 'Order Discount Min',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      hasMinPurchase: true,
      minPurchaseAmountCents: 10000,
    })
    const payload = toCreatePayload(state) as CreateOrderDiscountPayload
    expect(payload.minPurchaseAmountCents).toBe(10000)
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
      discountValue: 500,
      appliesTo: 'BRANDS',
      targetItems: [
        { targetId: 'brand-1', name: 'Brand A' },
        { targetId: 'brand-2', name: 'Brand B' },
      ],
    })
    const payload = toCreatePayload(state) as CreateProductDiscountPayload
    expect(payload.targetItems).toHaveLength(2)
    expect(payload.targetItems![0]!.targetType).toBe('BRANDS')
    expect(payload.targetItems![1]!.targetType).toBe('BRANDS')
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

  it('toUpdatePayload for ORDER_DISCOUNT includes minPurchaseAmountCents as number when set', () => {
    const state = getInitialState('ORDER_DISCOUNT')
    Object.assign(state, {
      title: 'Test',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      hasMinPurchase: true,
      minPurchaseAmountCents: 5000,
    })
    const payload = toUpdatePayload(state) as Record<string, unknown>
    expect(payload['minPurchaseAmountCents']).toBe(5000)
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
