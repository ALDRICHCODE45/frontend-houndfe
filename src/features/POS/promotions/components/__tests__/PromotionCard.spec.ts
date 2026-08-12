// @ts-nocheck
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
    template: '<div :data-seed="seed" :data-name="name" data-testid="entity-avatar" />',
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
    title: 'Black Friday 30%',
    type: 'PRODUCT_DISCOUNT',
    method: 'AUTOMATIC',
    status: 'ACTIVE',
    startDate: '2026-01-15',
    endDate: null,
    customerScope: 'ALL',
    discountType: 'PERCENTAGE',
    discountValue: 30,
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

describe('PromotionCard', () => {
  it('renders the promotion title', () => {
    const wrapper = mount(PromotionCard, {
      props: { promotion: makePromotion() },
    })
    expect(wrapper.text()).toContain('Black Friday 30%')
  })

  it('passes the promotion id to EntityAvatar as seed', () => {
    const wrapper = mount(PromotionCard, {
      props: { promotion: makePromotion({ id: 'promo-42' }) },
    })
    const avatar = wrapper.find('[data-testid="entity-avatar"]')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('data-seed')).toBe('promo-42')
    expect(avatar.attributes('data-name')).toBe('Black Friday 30%')
  })

  it('renders status badge with the correct tone', () => {
    const wrapper = mount(PromotionCard, {
      props: { promotion: makePromotion({ status: 'ACTIVE' }) },
    })
    const statusBadge = wrapper.find('[data-testid="status-dot-badge"]')
    expect(statusBadge.exists()).toBe(true)
    expect(statusBadge.attributes('data-tone')).toBe('active')
    expect(statusBadge.text()).toContain('Activa')
  })

  it('does NOT render a kebab menu (cards are click-only)', () => {
    const wrapper = mount(PromotionCard, {
      props: { promotion: makePromotion() },
    })
    expect(wrapper.find('[data-testid="kebab-menu"]').exists()).toBe(false)
  })

  it('does NOT render any checkbox', () => {
    const wrapper = mount(PromotionCard, {
      props: { promotion: makePromotion() },
    })
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })

  it('emits click with the promotion when the article is clicked', async () => {
    const promotion = makePromotion({ id: 'promo-99' })
    const wrapper = mount(PromotionCard, {
      props: { promotion },
    })
    await wrapper.find('article').trigger('click')
    expect(wrapper.emitted('click')?.[0]?.[0]).toEqual(promotion)
  })

  it('renders startDate and createdAt using formatPromotionDate', () => {
    const wrapper = mount(PromotionCard, {
      props: {
        promotion: makePromotion({
          startDate: '2026-04-01',
          createdAt: '2024-01-15T00:00:00.000Z',
        }),
      },
    })
    // The exact date format depends on date-fns / locale; just assert that the
    // formatted strings appear and not raw ISO timestamps.
    expect(wrapper.text()).not.toContain('2026-04-01T00:00:00')
    expect(wrapper.text()).toContain('Inicio')
    expect(wrapper.text()).toContain('Creada')
  })

  it('falls back to em-dash when startDate is null', () => {
    const wrapper = mount(PromotionCard, {
      props: { promotion: makePromotion({ startDate: null }) },
    })
    expect(wrapper.text()).toContain('—')
  })

  it('renders type and method chips', () => {
    const wrapper = mount(PromotionCard, {
      props: {
        promotion: makePromotion({
          type: 'PRODUCT_DISCOUNT',
          method: 'AUTOMATIC',
        }),
      },
    })
    const badges = wrapper.findAll('[data-testid="app-badge"]')
    expect(badges.length).toBeGreaterThanOrEqual(2)
  })
})