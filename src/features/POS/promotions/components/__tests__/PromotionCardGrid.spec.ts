// @ts-nocheck
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PromotionCardGrid from '../PromotionCardGrid.vue'
import type { PromotionResponse } from '../../interfaces/promotion.types'

vi.mock('@nuxt/ui', () => ({
  UIcon: { template: '<span />' },
}))

vi.mock('@/core/shared/components/EntityAvatar.vue', () => ({
  default: {
    name: 'EntityAvatar',
    template: '<div data-testid="entity-avatar" />',
    props: ['name', 'seed', 'showDot', 'dotClass', 'size'],
  },
}))

vi.mock('@/core/shared/components/AppBadge.vue', () => ({
  default: {
    name: 'AppBadge',
    template: '<span data-testid="app-badge"><slot /></span>',
    props: ['label', 'value', 'tone', 'icon', 'variant'],
  },
}))

vi.mock('@/core/shared/components/StatusDotBadge.vue', () => ({
  default: {
    name: 'StatusDotBadge',
    template: '<span data-testid="status-dot-badge" :data-tone="tone"><slot />{{ label }}</span>',
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
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    ...overrides,
  }
}

describe('PromotionCardGrid', () => {
  it('renders one card per promotion', () => {
    const wrapper = mount(PromotionCardGrid, {
      props: {
        promotions: [
          makePromotion({ id: 'p1' }),
          makePromotion({ id: 'p2' }),
        ],
      },
    })
    expect(wrapper.findAll('article').length).toBe(2)
  })

  it('shows 8 skeleton placeholders when loading', () => {
    const wrapper = mount(PromotionCardGrid, {
      props: {
        promotions: [],
        loading: true,
      },
    })
    expect(wrapper.find('[data-testid="card-grid-skeleton"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="card-skeleton"]').length).toBe(8)
  })

  it('shows the empty state with icon and message when there are no promotions', () => {
    const wrapper = mount(PromotionCardGrid, {
      props: {
        promotions: [],
        empty: 'No se encontraron promociones',
      },
    })
    expect(wrapper.text()).toContain('No se encontraron promociones')
    expect(wrapper.find('[data-testid="card-grid-empty"]').exists()).toBe(true)
  })

  it('falls back to the default empty message when none is provided', () => {
    const wrapper = mount(PromotionCardGrid, {
      props: { promotions: [] },
    })
    expect(wrapper.text()).toContain('No se encontraron promociones')
  })

  it('forwards card-click to the parent', async () => {
    const promotion = makePromotion({ id: 'a' })
    const wrapper = mount(PromotionCardGrid, {
      props: { promotions: [promotion] },
    })
    await wrapper.find('article').trigger('click')
    expect(wrapper.emitted('card-click')?.[0]?.[0]).toEqual(promotion)
  })

  it('uses the responsive ladder classes (1/2/3/5/7)', () => {
    const wrapper = mount(PromotionCardGrid, {
      props: { promotions: [makePromotion()] },
    })
    const grid = wrapper.find('[data-testid="card-grid"]')
    expect(grid.exists()).toBe(true)
    const classes = grid.classes()
    expect(classes).toContain('grid')
    expect(classes).toContain('gap-3')
    expect(classes).toContain('sm:grid-cols-2')
    expect(classes).toContain('lg:grid-cols-3')
    expect(classes).toContain('xl:grid-cols-5')
    expect(classes).toContain('2xl:grid-cols-7')
  })

  it('does NOT render any checkboxes (cards are navigation-only)', () => {
    const wrapper = mount(PromotionCardGrid, {
      props: {
        promotions: [
          makePromotion({ id: 'p1' }),
          makePromotion({ id: 'p2' }),
        ],
      },
    })
    expect(wrapper.findAll('input[type="checkbox"]').length).toBe(0)
  })
})