import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleTotalsFooter from '../SaleTotalsFooter.vue'
import type { SaleItem } from '../../interfaces/sale.types'

describe('SaleTotalsFooter', () => {
  const mockItems: SaleItem[] = [
    {
      id: 'item-1',
      productId: 'prod-1',
      variantId: null,
      productName: 'Aspirina',
      variantName: null,
      quantity: 2,
      unitPriceCents: 5000,
      unitPriceCurrency: 'MXN',
    },
    {
      id: 'item-2',
      productId: 'prod-2',
      variantId: 'var-1',
      productName: 'Vitamina C',
      variantName: '500mg',
      quantity: 3,
      unitPriceCents: 8000,
      unitPriceCurrency: 'MXN',
    },
  ]

  it('should display subtotal count correctly', () => {
    const wrapper = mount(SaleTotalsFooter, {
      props: { items: mockItems },
      global: {
        stubs: { UButton: true, USeparator: true },
      },
    })

    expect(wrapper.html()).toContain('Subtotal')
    expect(wrapper.html()).toContain('2 productos')
  })

  it('should display total amount formatted in MXN', () => {
    const wrapper = mount(SaleTotalsFooter, {
      props: { items: mockItems },
      global: {
        stubs: { UButton: true, USeparator: true },
      },
    })

    // (5000 * 2) + (8000 * 3) = 10000 + 24000 = 34000 cents = $340.00
    expect(wrapper.html()).toContain('$340.00')
  })

  it('should display zero total when items is empty', () => {
    const wrapper = mount(SaleTotalsFooter, {
      props: { items: [] },
      global: {
        stubs: { UButton: true, USeparator: true },
      },
    })

    expect(wrapper.html()).toContain('Subtotal')
    expect(wrapper.html()).toContain('0 productos')
    expect(wrapper.html()).toContain('$0.00')
  })

  it('should calculate total correctly for single item', () => {
    const singleItem: SaleItem[] = [mockItems[0]!]
    const wrapper = mount(SaleTotalsFooter, {
      props: { items: singleItem },
      global: {
        stubs: { UButton: true, USeparator: true },
      },
    })

    expect(wrapper.html()).toContain('Subtotal')
    expect(wrapper.html()).toContain('1 producto')
    expect(wrapper.html()).toContain('$100.00') // 5000 * 2 = 10000 cents
  })

  it('should handle items with different quantities', () => {
    const multiQuantityItems: SaleItem[] = [
      {
        id: 'item-1',
        productId: 'prod-1',
        variantId: null,
        productName: 'Product A',
        variantName: null,
        quantity: 10,
        unitPriceCents: 1000,
        unitPriceCurrency: 'MXN',
      },
      {
        id: 'item-2',
        productId: 'prod-2',
        variantId: null,
        productName: 'Product B',
        variantName: null,
        quantity: 5,
        unitPriceCents: 2000,
        unitPriceCurrency: 'MXN',
      },
    ]

    const wrapper = mount(SaleTotalsFooter, {
      props: { items: multiQuantityItems },
      global: {
        stubs: { UButton: true, USeparator: true },
      },
    })

    // (1000 * 10) + (2000 * 5) = 10000 + 10000 = 20000 cents = $200.00
    expect(wrapper.html()).toContain('$200.00')
  })
})
