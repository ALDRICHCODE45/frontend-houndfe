import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import QuotationPromotionCard from '../QuotationPromotionCard.vue'
import type { AppliedPromotion } from '../../interfaces/quotation.types'

function makePromotion(overrides: Partial<AppliedPromotion> = {}): AppliedPromotion {
  return {
    id: 'ap-1',
    promotionId: 'promo-1',
    title: 'Promo SpiderMan',
    discountCents: 3000,
    ...overrides,
  }
}

function mountCard(props: {
  promotion: AppliedPromotion
  method: 'MANUAL' | 'AUTOMATIC'
  readonly?: boolean
}) {
  return mount(QuotationPromotionCard, {
    props: { readonly: false, ...props },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// T-UI-18/19 — REQ-UI-008 promotion card. Each applied promotion becomes
// a card with `border-l-4` in `--coco-accent`, a bold title, the discount
// rendered in `--coco-info` blue, an `AUTOMÁTICA` / `MANUAL` badge, and a
// removal button that emits either `remove` (MANUAL) or `veto` (AUTOMATIC).

describe('QuotationPromotionCard — root contract', () => {
  it('renders the root container with testid "quotation-promotion-card"', () => {
    const wrapper = mountCard({ promotion: makePromotion(), method: 'AUTOMATIC' })
    expect(wrapper.find('[data-testid="quotation-promotion-card"]').exists()).toBe(true)
  })

  it('renders the promotion title in bold', () => {
    const wrapper = mountCard({
      promotion: makePromotion({ title: 'Promo SpiderMan' }),
      method: 'AUTOMATIC',
    })
    const title = wrapper.find('[data-testid="promo-title"]')
    expect(title.exists()).toBe(true)
    expect(title.text()).toBe('Promo SpiderMan')
  })

  it('renders the discount in blue (info) — formatted as MXN currency', () => {
    const wrapper = mountCard({
      promotion: makePromotion({ discountCents: 3000 }),
      method: 'AUTOMATIC',
    })
    const discount = wrapper.find('[data-testid="promo-discount"]')
    expect(discount.exists()).toBe(true)
    expect(discount.text()).toMatch(/30\.00/)
  })

  it('uses the accent border-left-4 styling for visual prominence', () => {
    const wrapper = mountCard({ promotion: makePromotion(), method: 'AUTOMATIC' })
    const root = wrapper.find('[data-testid="quotation-promotion-card"]')
    expect(root.classes()).toContain('border-l-4')
  })
})

describe('QuotationPromotionCard — method badge', () => {
  it('renders the AUTOMÁTICA badge when method=AUTOMATIC', () => {
    const wrapper = mountCard({ promotion: makePromotion(), method: 'AUTOMATIC' })
    const badge = wrapper.find('[data-testid="promo-method-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('Automática')
  })

  it('renders the MANUAL badge when method=MANUAL', () => {
    const wrapper = mountCard({ promotion: makePromotion(), method: 'MANUAL' })
    const badge = wrapper.find('[data-testid="promo-method-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('Manual')
  })
})

describe('QuotationPromotionCard — removal / veto action', () => {
  it('renders the "Vetar" outlined button for AUTOMATIC promotions', () => {
    const wrapper = mountCard({ promotion: makePromotion(), method: 'AUTOMATIC' })
    const button = wrapper.find('[data-testid="promo-remove-btn"]')
    expect(button.exists()).toBe(true)
    expect(button.text()).toContain('Vetar')
  })

  it('renders the "Quitar" outlined button for MANUAL promotions', () => {
    const wrapper = mountCard({ promotion: makePromotion(), method: 'MANUAL' })
    const button = wrapper.find('[data-testid="promo-remove-btn"]')
    expect(button.exists()).toBe(true)
    expect(button.text()).toContain('Quitar')
  })

  it('emits "veto" with the promotion id when the AUTOMATIC card button is clicked', async () => {
    const wrapper = mountCard({
      promotion: makePromotion({ promotionId: 'promo-auto-1' }),
      method: 'AUTOMATIC',
    })
    await wrapper.get('[data-testid="promo-remove-btn"]').trigger('click')
    expect(wrapper.emitted('veto')).toBeDefined()
    expect(wrapper.emitted('veto')![0]).toEqual(['promo-auto-1'])
  })

  it('emits "remove" with the promotion id when the MANUAL card button is clicked', async () => {
    const wrapper = mountCard({
      promotion: makePromotion({ promotionId: 'promo-manual-1' }),
      method: 'MANUAL',
    })
    await wrapper.get('[data-testid="promo-remove-btn"]').trigger('click')
    expect(wrapper.emitted('remove')).toBeDefined()
    expect(wrapper.emitted('remove')![0]).toEqual(['promo-manual-1'])
    expect(wrapper.emitted('veto')).toBeUndefined()
  })

  it('hides the removal button when readonly=true', () => {
    const wrapper = mountCard({
      promotion: makePromotion(),
      method: 'AUTOMATIC',
      readonly: true,
    })
    expect(wrapper.find('[data-testid="promo-remove-btn"]').exists()).toBe(false)
  })
})

describe('QuotationPromotionCard — optional description', () => {
  it('renders the description row when present', () => {
    const wrapper = mountCard({
      promotion: {
        ...makePromotion(),
        description: 'Aplica sobre analgésicos · vigente al 30 sep',
      } as AppliedPromotion & { description?: string },
      method: 'AUTOMATIC',
    })
    const description = wrapper.find('[data-testid="promo-description"]')
    expect(description.exists()).toBe(true)
    expect(description.text()).toContain('Aplica sobre analgésicos')
  })

  it('omits the description row when not provided', () => {
    const wrapper = mountCard({ promotion: makePromotion(), method: 'AUTOMATIC' })
    expect(wrapper.find('[data-testid="promo-description"]').exists()).toBe(false)
  })
})
