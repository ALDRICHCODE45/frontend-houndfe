import type { PromotionResponse } from '../../interfaces/promotion.types'

export const botRule = {
  type: 'PRODUCT_DISCOUNT' as const,
  method: 'AUTOMATIC' as const,
  appliesTo: ['PRODUCTS' as const],
  customerScopes: ['ALL' as const],
  allowsPriceLists: false,
  allowsDaysOfWeek: false,
}

export function botPromotion(overrides: Partial<PromotionResponse> = {}): PromotionResponse {
  return {
    id: 'bot-promo',
    title: 'Oferta',
    type: 'PRODUCT_DISCOUNT',
    method: 'AUTOMATIC',
    status: 'ACTIVE',
    botEligible: true,
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
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  }
}
