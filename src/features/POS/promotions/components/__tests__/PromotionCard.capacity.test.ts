import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PromotionCard from '../PromotionCard.vue'
import type { PromotionResponse } from '../../interfaces/promotion.types'

vi.mock('@nuxt/ui', () => ({
  UIcon: { template: '<span />' },
}))

vi.mock('@/core/shared/components/EntityAvatar.vue', () => ({
  default: {
    name: 'EntityAvatar',
    template: '<div data-testid="entity-avatar" />',
    props: ['name', 'seed', 'size'],
  },
}))

vi.mock('@/core/shared/components/AppBadge.vue', () => ({
  default: {
    name: 'AppBadge',
    template: '<span data-testid="app-badge">{{ label }}</span>',
    props: ['label', 'value', 'tone', 'icon', 'variant'],
  },
}))

vi.mock('@/core/shared/components/StatusDotBadge.vue', () => ({
  default: {
    name: 'StatusDotBadge',
    template: '<span data-testid="status-dot-badge" />',
    props: ['label', 'tone', 'compact'],
  },
}))

function makePromotion(overrides: Partial<PromotionResponse> = {}): PromotionResponse {
  return {
    id: 'promo-1',
    title: 'Black Friday',
    type: 'PRODUCT_DISCOUNT',
    method: 'AUTOMATIC',
    status: 'ACTIVE',
    startDate: null,
    endDate: null,
    customerScope: 'ALL',
    discountType: 'PERCENTAGE',
    discountValue: 10,
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
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    ...overrides,
  }
}

describe('PromotionCard — server-owned capacity', () => {
  it('renders the capacity status for a finite cap', () => {
    const wrapper = mount(PromotionCard, {
      props: {
        promotion: makePromotion({
          maxProductUnits: 100,
          consumedProductUnits: 80,
          remainingProductUnits: 20,
        }),
      },
    })
    const status = wrapper.find('[data-testid="promotion-capacity-status"]')
    expect(status.exists()).toBe(true)
    expect(status.attributes('data-state')).toBe('near_limit')
  })

  it('renders unlimited capacity without deriving a remaining value', () => {
    const wrapper = mount(PromotionCard, {
      props: { promotion: makePromotion({ maxProductUnits: null, consumedProductUnits: 4 }) },
    })
    const status = wrapper.find('[data-testid="promotion-capacity-status"]')
    expect(status.attributes('data-state')).toBe('unlimited_consumed')
  })
})
