import { describe, it, expect } from 'vitest'
import SaleItemBadges from '../SaleItemBadges.vue'
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
})
