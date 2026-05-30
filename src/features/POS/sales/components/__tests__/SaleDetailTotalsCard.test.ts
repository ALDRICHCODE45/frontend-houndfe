import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleDetailTotalsCard from '../SaleDetailTotalsCard.vue'

describe('SaleDetailTotalsCard', () => {
  it('renders subtotal discount and total values', () => {
    const wrapper = mount(SaleDetailTotalsCard, {
      props: {
        subtotalCents: 127000,
        discountCents: 0,
        totalCents: 127000,
      },
      global: { stubs: { UCard: { template: '<div><slot /></div>' } } },
    })

    expect(wrapper.text()).toContain('Subtotal')
    expect(wrapper.text()).toContain('$1,270.00')
  })

  it('hides Descuentos row when discountCents is 0', () => {
    const wrapper = mount(SaleDetailTotalsCard, {
      props: {
        subtotalCents: 100000,
        discountCents: 0,
        totalCents: 100000,
      },
      global: { stubs: { UCard: { template: '<div><slot /></div>' } } },
    })

    expect(wrapper.text()).not.toContain('Descuentos')
  })

  it('shows Descuentos row when discountCents > 0', () => {
    const wrapper = mount(SaleDetailTotalsCard, {
      props: {
        subtotalCents: 100000,
        discountCents: 5000,
        totalCents: 95000,
      },
      global: { stubs: { UCard: { template: '<div><slot /></div>' } } },
    })

    expect(wrapper.text()).toContain('Descuentos')
    expect(wrapper.text()).toContain('$50.00')
  })

  it('renders discount value with a leading minus sign', () => {
    const wrapper = mount(SaleDetailTotalsCard, {
      props: {
        subtotalCents: 340000,
        discountCents: 14000,
        totalCents: 326000,
      },
      global: { stubs: { UCard: { template: '<div><slot /></div>' } } },
    })

    const discountValue = wrapper.get('[data-testid="totals-discount-value"]')
    expect(discountValue.text()).toBe('-$140.00')
  })
})
