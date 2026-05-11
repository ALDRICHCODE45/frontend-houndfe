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
    expect(wrapper.text()).toContain('Descuentos')
    expect(wrapper.text()).toContain('$0.00')
    expect(wrapper.text()).toContain('$1,270.00')
  })
})
