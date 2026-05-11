import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleTotalsFooter from '../SaleTotalsFooter.vue'
import type { SaleItem } from '../../interfaces/sale.types'

const stubs = {
  UButton: {
    props: ['disabled', 'loading'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  USeparator: true,
  UTooltip: {
    name: 'UTooltip',
    props: ['text'],
    template: '<span>{{ text }}<slot /></span>',
  },
  UIcon: true,
  UKbd: true,
  Tooltip: {
    name: 'Tooltip',
    props: ['text'],
    template: '<span><slot /></span>',
  },
}

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

  it('should display subtotal label and total a cobrar', () => {
    const wrapper = mount(SaleTotalsFooter, {
      props: { items: mockItems },
      global: { stubs },
    })

    expect(wrapper.html()).toContain('Subtotal')
    expect(wrapper.html()).toContain('Total a cobrar')
    // 5 productos total quantity (2+3), 2 líneas
    expect(wrapper.html()).toContain('5 productos')
    expect(wrapper.html()).toContain('2 líneas')
  })

  it('should display total amount formatted in MXN', () => {
    const wrapper = mount(SaleTotalsFooter, {
      props: { items: mockItems },
      global: { stubs },
    })

    // (5000 * 2) + (8000 * 3) = 10000 + 24000 = 34000 cents = $340.00
    expect(wrapper.html()).toContain('$340.00')
  })

  it('should display zero total when items is empty', () => {
    const wrapper = mount(SaleTotalsFooter, {
      props: { items: [] },
      global: { stubs },
    })

    expect(wrapper.html()).toContain('Subtotal')
    expect(wrapper.html()).toContain('$0.00')
    expect(wrapper.html()).toContain('0 productos')
  })

  it('should calculate total correctly for single item', () => {
    const singleItem: SaleItem[] = [mockItems[0]!]
    const wrapper = mount(SaleTotalsFooter, {
      props: { items: singleItem },
      global: { stubs },
    })

    expect(wrapper.html()).toContain('Subtotal')
    expect(wrapper.html()).toContain('1 línea')
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
      global: { stubs },
    })

    // (1000 * 10) + (2000 * 5) = 10000 + 10000 = 20000 cents = $200.00
    expect(wrapper.html()).toContain('$200.00')
  })

  it('enables Cobrar and emits click when items exist and not pending', async () => {
    const wrapper = mount(SaleTotalsFooter, {
      props: { items: mockItems, isChargePending: false },
      global: { stubs },
    })

    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeUndefined()

    await button.trigger('click')
    expect(wrapper.emitted('charge-click')).toBeTruthy()
  })

  it('disables Cobrar when draft has no items', () => {
    const wrapper = mount(SaleTotalsFooter, {
      props: { items: [], isChargePending: false },
      global: { stubs },
    })

    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('disables Cobrar and shows loading while charge is pending (S31)', async () => {
    const wrapper = mount(SaleTotalsFooter, {
      props: { items: mockItems, isChargePending: true },
      global: { stubs },
    })

    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeDefined()

    await button.trigger('click')
    expect(wrapper.emitted('charge-click')).toBeFalsy()
  })
})
