import { describe, it, expect } from 'vitest'
import SaleItemBadges from '../SaleItemBadges.vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import { mountWithUApp } from '@/test/mountWithUApp'

describe('SaleItemBadges', () => {
  it('renders nothing when there is no override and no discount', () => {
    const wrapper = mountWithUApp(SaleItemBadges, {
      props: {
        priceSource: 'default',
        unitPriceCents: 20000,
      },
    })

    expect(wrapper.find('[data-testid="sale-item-badge-group"]').exists()).toBe(false)
  })

  it('renders PRECIO MANUAL badge when priceSource is custom and price changed', () => {
    const wrapper = mountWithUApp(SaleItemBadges, {
      props: {
        priceSource: 'custom',
        originalPriceCents: 80000,
        unitPriceCents: 90000,
      },
    })

    expect(wrapper.text()).toContain('PRECIO MANUAL')
  })

  it('renders PRECIO LISTA badge when priceSource is price_list and price changed', () => {
    const wrapper = mountWithUApp(SaleItemBadges, {
      props: {
        priceSource: 'price_list',
        originalPriceCents: 70000,
        unitPriceCents: 63000,
      },
    })

    expect(wrapper.text()).toContain('PRECIO LISTA')
  })

  it('does NOT render price badge when originalPriceCents equals unitPriceCents', () => {
    const wrapper = mountWithUApp(SaleItemBadges, {
      props: {
        priceSource: 'custom',
        originalPriceCents: 80000,
        unitPriceCents: 80000,
      },
    })

    expect(wrapper.text()).not.toContain('PRECIO')
  })

  it('renders percentage discount label with the explicit value', () => {
    const wrapper = mountWithUApp(SaleItemBadges, {
      props: {
        priceSource: 'default',
        unitPriceCents: 63000,
        discountType: 'percentage',
        discountValue: 10,
        discountAmountCents: 7000,
      },
    })

    expect(wrapper.text()).toContain('DESCUENTO -10%')
  })

  it('renders amount discount label using formatted cents when type is amount', () => {
    const wrapper = mountWithUApp(SaleItemBadges, {
      props: {
        priceSource: 'default',
        unitPriceCents: 60000,
        discountType: 'amount',
        discountValue: 5000,
        discountAmountCents: 5000,
      },
    })

    expect(wrapper.text()).toContain('DESCUENTO -$50.00')
  })

  // ── C.1 — promotionId discriminator (per-line promo badge + remove) ─────────

  it('renders promo badge with discountTitle and a remove control when promotionId is set and removable=true', async () => {
    const wrapper = mountWithUApp(SaleItemBadges, {
      props: {
        priceSource: 'default',
        unitPriceCents: 63000,
        discountType: 'percentage',
        discountValue: 15,
        discountAmountCents: 9450,
        discountTitle: 'Promo 2x1 Vitaminas',
        promotionId: 'promo-uuid-1',
        removable: true,
      },
    })

    const promoBadge = wrapper.find('[data-testid="sale-item-promo-badge"]')
    expect(promoBadge.exists()).toBe(true)
    expect(promoBadge.text()).toContain('Promo 2x1 Vitaminas')

    const removeBtn = wrapper.find('[data-testid="sale-item-remove-promo"]')
    expect(removeBtn.exists()).toBe(true)

    await removeBtn.trigger('click')

    expect(wrapper.emitted('remove-promo')).toBeTruthy()
    expect(wrapper.emitted('remove-promo')?.[0]).toEqual(['promo-uuid-1'])
  })

  it('renders the promo badge but NOT the remove control when promotionId is set and removable is omitted (confirmed-sale safety)', () => {
    const wrapper = mountWithUApp(SaleItemBadges, {
      props: {
        priceSource: 'default',
        unitPriceCents: 63000,
        discountType: 'percentage',
        discountValue: 15,
        discountAmountCents: 9450,
        discountTitle: 'Promo 2x1 Vitaminas',
        promotionId: 'promo-uuid-1',
      },
    })

    expect(wrapper.find('[data-testid="sale-item-promo-badge"]').exists()).toBe(true)

    // Critical: SaleDetailItem (confirmed-sale) renders this component WITHOUT
    // removable=true. The remove control MUST NOT appear in that surface.
    expect(wrapper.find('[data-testid="sale-item-remove-promo"]').exists()).toBe(false)
  })

  it('does NOT render a promo badge for a manual free-form discount (promotionId=null) but keeps the existing manual discount badge', () => {
    const wrapper = mountWithUApp(SaleItemBadges, {
      props: {
        priceSource: 'default',
        unitPriceCents: 60000,
        discountType: 'amount',
        discountValue: 5000,
        discountAmountCents: 5000,
        discountTitle: 'Descuento manual',
        promotionId: null,
      },
    })

    // Manual free-form discount path: NO promo badge, NO remove control.
    expect(wrapper.find('[data-testid="sale-item-promo-badge"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sale-item-remove-promo"]').exists()).toBe(false)

    // The existing manual discount badge must still render unchanged.
    expect(wrapper.text()).toContain('DESCUENTO')
    expect(wrapper.text()).toContain('-$50.00')
  })

  // ── B.2 — BXGY reward badge (buy-x-get-y-promotion REQ-2) ─────────────────

  it('renders a percent-aware reward badge for a 100% BXGY reward', () => {
    const wrapper = mountWithUApp(SaleItemBadges, {
      props: {
        priceSource: 'default',
        unitPriceCents: 12000,
        rewardKind: 'buy_x_get_y',
        rewardDiscountPercent: 100,
      },
    })

    const rewardBadge = wrapper.find('[data-testid="sale-item-reward-badge"]')
    expect(rewardBadge.exists()).toBe(true)
    expect(rewardBadge.text()).toContain('GRATIS')
  })

  it('renders a partial reward percent and never GRATIS for a partial BXGY reward', () => {
    const wrapper = mountWithUApp(SaleItemBadges, {
      props: {
        priceSource: 'default',
        unitPriceCents: 12000,
        rewardKind: 'buy_x_get_y',
        rewardDiscountPercent: 50,
      },
    })

    const rewardBadge = wrapper.find('[data-testid="sale-item-reward-badge"]')
    expect(rewardBadge.exists()).toBe(true)
    expect(rewardBadge.text()).toContain('-50%')
    expect(rewardBadge.text()).not.toContain('GRATIS')
  })

  it('does NOT render a reward badge when a BXGY reward percent is null', () => {
    const wrapper = mountWithUApp(SaleItemBadges, {
      props: {
        priceSource: 'default',
        unitPriceCents: 12000,
        rewardKind: 'buy_x_get_y',
        rewardDiscountPercent: null,
      },
    })

    expect(wrapper.find('[data-testid="sale-item-reward-badge"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sale-item-badge-group"]').exists()).toBe(false)
  })

  it('keeps success tone and gift icon for free and partial reward badges', () => {
    for (const rewardDiscountPercent of [100, 50]) {
      const wrapper = mountWithUApp(SaleItemBadges, {
        props: {
          priceSource: 'default',
          unitPriceCents: 12000,
          rewardKind: 'buy_x_get_y',
          rewardDiscountPercent,
        },
      })

      const rewardBadge = wrapper.findComponent(AppBadge)
      expect(rewardBadge.props('tone')).toBe('success')
      expect(rewardBadge.props('icon')).toBe('i-lucide-gift')
    }
  })

  it('does NOT render a reward badge when rewardKind is null', () => {
    const wrapper = mountWithUApp(SaleItemBadges, {
      props: {
        priceSource: 'default',
        unitPriceCents: 12000,
        rewardKind: null,
      },
    })

    expect(wrapper.find('[data-testid="sale-item-reward-badge"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sale-item-badge-group"]').exists()).toBe(false)
  })

  it('does NOT render a reward badge when rewardKind is omitted', () => {
    const wrapper = mountWithUApp(SaleItemBadges, {
      props: {
        priceSource: 'default',
        unitPriceCents: 12000,
      },
    })

    expect(wrapper.find('[data-testid="sale-item-reward-badge"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sale-item-badge-group"]').exists()).toBe(false)
  })
})
