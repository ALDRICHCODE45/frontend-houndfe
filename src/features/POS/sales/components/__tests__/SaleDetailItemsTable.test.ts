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
})
