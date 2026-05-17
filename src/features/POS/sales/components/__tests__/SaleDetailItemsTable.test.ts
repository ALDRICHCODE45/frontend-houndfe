import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleDetailItemsTable from '../SaleDetailItemsTable.vue'

describe('SaleDetailItemsTable', () => {
  it('renders placeholder when imageUrl is null', () => {
    const wrapper = mount(SaleDetailItemsTable, {
      props: {
        items: [
          {
            productName: 'Jean Recto',
            variantName: null,
            imageUrl: null,
            unitPriceCents: 17000,
            quantity: 2,
            discountCents: 0,
            subtotalCents: 34000,
          },
        ],
      },
    })

    const image = wrapper.get('[data-testid="item-image-0"]')
    expect(image.attributes('src')).toContain('placeholder')
    expect(wrapper.text()).toContain('Jean Recto')
  })

  it('renders quantity as clean text with × prefix', () => {
    const wrapper = mount(SaleDetailItemsTable, {
      props: {
        items: [
          {
            productName: 'Jean Recto',
            variantName: 'Talla M',
            imageUrl: null,
            unitPriceCents: 17000,
            quantity: 3,
            discountCents: 0,
            subtotalCents: 51000,
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('× 3')
    expect(wrapper.text()).toContain('Jean Recto')
    expect(wrapper.text()).toContain('$170.00')
    expect(wrapper.text()).toContain('$510.00')
  })
})
