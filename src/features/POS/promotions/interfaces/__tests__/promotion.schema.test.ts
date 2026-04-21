import { describe, it, expect } from 'vitest'
import { promotionFormSchema } from '../promotion.schema'

// Helper: build a minimal valid PRODUCT_DISCOUNT form state
function makeProductDiscount(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Test promo',
    type: 'PRODUCT_DISCOUNT',
    method: 'AUTOMATIC',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    appliesTo: 'CATEGORIES',
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
    ...overrides,
  }
}

function makeOrderDiscount(overrides: Record<string, unknown> = {}) {
  return makeProductDiscount({
    type: 'ORDER_DISCOUNT',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    appliesTo: '',
    ...overrides,
  })
}

function makeBuyXGetY(overrides: Record<string, unknown> = {}) {
  return makeProductDiscount({
    type: 'BUY_X_GET_Y',
    discountType: '',
    discountValue: 0,
    appliesTo: '',
    buyQuantity: 2,
    getQuantity: 1,
    getDiscountPercent: 0,
    ...overrides,
  })
}

function makeAdvanced(overrides: Record<string, unknown> = {}) {
  return makeProductDiscount({
    type: 'ADVANCED',
    discountType: '',
    discountValue: 0,
    appliesTo: '',
    buyQuantity: 2,
    getQuantity: 1,
    getDiscountPercent: 50,
    buyTargetType: 'PRODUCTS',
    buyTargetItems: [{ targetId: 'uuid-1', name: 'Product A' }],
    getTargetType: 'PRODUCTS',
    getTargetItems: [{ targetId: 'uuid-2', name: 'Product B' }],
    ...overrides,
  })
}

describe('promotionFormSchema — PRODUCT_DISCOUNT', () => {
  it('validates a valid PRODUCT_DISCOUNT with PERCENTAGE', () => {
    const result = promotionFormSchema.safeParse(makeProductDiscount())
    expect(result.success).toBe(true)
  })

  it('rejects PRODUCT_DISCOUNT missing discountType', () => {
    const result = promotionFormSchema.safeParse(makeProductDiscount({ discountType: '' }))
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message.includes('tipo de descuento'))).toBe(true)
  })

  it('rejects PRODUCT_DISCOUNT missing discountValue', () => {
    const result = promotionFormSchema.safeParse(makeProductDiscount({ discountValue: 0 }))
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message.includes('valor del descuento') || i.message.includes('obligatorio'))).toBe(true)
  })

  it('rejects PRODUCT_DISCOUNT missing appliesTo', () => {
    const result = promotionFormSchema.safeParse(makeProductDiscount({ appliesTo: '' }))
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message.includes('aplica'))).toBe(true)
  })

  it('rejects PERCENTAGE discountValue of 0', () => {
    const result = promotionFormSchema.safeParse(makeProductDiscount({ discountValue: 0 }))
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message.includes('1') || i.message.includes('porcentaje') || i.message.includes('obligatorio'))).toBe(true)
  })

  it('rejects PERCENTAGE discountValue of 101', () => {
    const result = promotionFormSchema.safeParse(makeProductDiscount({ discountValue: 101 }))
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message.includes('100') || i.message.includes('porcentaje'))).toBe(true)
  })

  it('accepts PERCENTAGE discountValue of 100', () => {
    const result = promotionFormSchema.safeParse(makeProductDiscount({ discountValue: 100 }))
    expect(result.success).toBe(true)
  })

  it('accepts FIXED discountValue of 1 (centavo)', () => {
    const result = promotionFormSchema.safeParse(
      makeProductDiscount({ discountType: 'FIXED', discountValue: 1 }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects FIXED discountValue of 0', () => {
    const result = promotionFormSchema.safeParse(
      makeProductDiscount({ discountType: 'FIXED', discountValue: 0 }),
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message.includes('mayor') || i.message.includes('0'))).toBe(true)
  })
})

describe('promotionFormSchema — ORDER_DISCOUNT', () => {
  it('validates a valid ORDER_DISCOUNT', () => {
    const result = promotionFormSchema.safeParse(makeOrderDiscount())
    expect(result.success).toBe(true)
  })

  it('rejects ORDER_DISCOUNT missing discountType', () => {
    const result = promotionFormSchema.safeParse(makeOrderDiscount({ discountType: '' }))
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message.includes('tipo de descuento'))).toBe(true)
  })

  it('rejects ORDER_DISCOUNT missing discountValue', () => {
    const result = promotionFormSchema.safeParse(makeOrderDiscount({ discountValue: 0 }))
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message.includes('valor del descuento') || i.message.includes('obligatorio'))).toBe(true)
  })
})

describe('promotionFormSchema — BUY_X_GET_Y', () => {
  it('validates a valid BUY_X_GET_Y', () => {
    const result = promotionFormSchema.safeParse(makeBuyXGetY())
    expect(result.success).toBe(true)
  })

  it('rejects BUY_X_GET_Y missing buyQuantity', () => {
    const result = promotionFormSchema.safeParse(makeBuyXGetY({ buyQuantity: 0 }))
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message.includes('cantidad de compra') || i.message.includes('cantidad'))).toBe(true)
  })

  it('rejects BUY_X_GET_Y missing getQuantity', () => {
    const result = promotionFormSchema.safeParse(makeBuyXGetY({ getQuantity: 0 }))
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message.includes('cantidad a llevar') || i.message.includes('cantidad'))).toBe(true)
  })

  it('rejects BUY_X_GET_Y getDiscountPercent of 100 (0=free is max)', () => {
    const result = promotionFormSchema.safeParse(makeBuyXGetY({ getDiscountPercent: 100 }))
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message.includes('100') || i.message.includes('99'))).toBe(true)
  })

  it('accepts BUY_X_GET_Y getDiscountPercent of 0 (free)', () => {
    const result = promotionFormSchema.safeParse(makeBuyXGetY({ getDiscountPercent: 0 }))
    expect(result.success).toBe(true)
  })

  it('accepts BUY_X_GET_Y getDiscountPercent of 99', () => {
    const result = promotionFormSchema.safeParse(makeBuyXGetY({ getDiscountPercent: 99 }))
    expect(result.success).toBe(true)
  })

  it('rejects BUY_X_GET_Y buyQuantity below 1', () => {
    const result = promotionFormSchema.safeParse(makeBuyXGetY({ buyQuantity: 0 }))
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message.includes('buyQuantity') || i.message.includes('1') || i.message.includes('cantidad'))).toBe(true)
  })
})

describe('promotionFormSchema — ADVANCED', () => {
  it('validates a valid ADVANCED promotion', () => {
    const result = promotionFormSchema.safeParse(makeAdvanced())
    expect(result.success).toBe(true)
  })

  it('rejects ADVANCED missing buyTargetItems when buyTargetType is set', () => {
    const result = promotionFormSchema.safeParse(
      makeAdvanced({ buyTargetType: 'PRODUCTS', buyTargetItems: [] }),
    )
    expect(result.success).toBe(false)
    expect(
      result.error?.issues.some(
        (i) => i.message.includes('buyTargetItems') || i.message.includes('compra'),
      ),
    ).toBe(true)
  })

  it('rejects ADVANCED missing getTargetItems when getTargetType is set', () => {
    const result = promotionFormSchema.safeParse(
      makeAdvanced({ getTargetType: 'PRODUCTS', getTargetItems: [] }),
    )
    expect(result.success).toBe(false)
    expect(
      result.error?.issues.some(
        (i) => i.message.includes('getTargetItems') || i.message.includes('obtiene'),
      ),
    ).toBe(true)
  })

  it('rejects ADVANCED missing buyQuantity', () => {
    const result = promotionFormSchema.safeParse(makeAdvanced({ buyQuantity: 0 }))
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message.includes('cantidad de compra') || i.message.includes('cantidad'))).toBe(true)
  })
})

describe('promotionFormSchema — date range validation', () => {
  it('accepts when endDate >= startDate', () => {
    const result = promotionFormSchema.safeParse(
      makeProductDiscount({
        hasVigencia: true,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts same startDate and endDate', () => {
    const result = promotionFormSchema.safeParse(
      makeProductDiscount({
        hasVigencia: true,
        startDate: '2026-01-01',
        endDate: '2026-01-01',
      }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects when endDate is before startDate', () => {
    const result = promotionFormSchema.safeParse(
      makeProductDiscount({
        hasVigencia: true,
        startDate: '2026-01-31',
        endDate: '2026-01-01',
      }),
    )
    expect(result.success).toBe(false)
    expect(
      result.error?.issues.some(
        (i) => i.message.includes('fecha') || i.message.includes('endDate'),
      ),
    ).toBe(true)
  })
})

describe('promotionFormSchema — title validation', () => {
  it('rejects empty title', () => {
    const result = promotionFormSchema.safeParse(makeProductDiscount({ title: '' }))
    expect(result.success).toBe(false)
  })

  it('rejects title exceeding 200 chars', () => {
    const result = promotionFormSchema.safeParse(
      makeProductDiscount({ title: 'a'.repeat(201) }),
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message.includes('200'))).toBe(true)
  })

  it('accepts title of exactly 200 chars', () => {
    const result = promotionFormSchema.safeParse(
      makeProductDiscount({ title: 'a'.repeat(200) }),
    )
    expect(result.success).toBe(true)
  })
})
