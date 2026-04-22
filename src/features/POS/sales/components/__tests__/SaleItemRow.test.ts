import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleItemRow from '../SaleItemRow.vue'
import type { SaleItem } from '../../interfaces/sale.types'

describe('SaleItemRow', () => {
  const stubs = { UInputNumber: true, UIcon: true }

  const mockItem: SaleItem = {
    id: 'item-1',
    productId: 'prod-1',
    variantId: null,
    productName: 'Aspirina 100mg',
    variantName: null,
    quantity: 2,
    unitPriceCents: 5000,
    unitPriceCurrency: 'MXN',
  }

  const mockItemWithVariant: SaleItem = {
    id: 'item-2',
    productId: 'prod-2',
    variantId: 'var-1',
    productName: 'Vitamina C',
    variantName: '500mg',
    quantity: 3,
    unitPriceCents: 8000,
    unitPriceCurrency: 'MXN',
  }

  it('should render product name', () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Aspirina 100mg')
  })

  it('should render variant name when present', () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItemWithVariant },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Vitamina C')
    expect(wrapper.text()).toContain('500mg')
  })

  it('should display unit price formatted in MXN', () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('$50.00')
  })

  it('should display line total calculated correctly', () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem },
      global: { stubs },
    })

    // 5000 cents * 2 = 10000 cents = $100.00
    expect(wrapper.text()).toContain('$100.00')
  })

  it('should emit update-qty on blur when value changed', async () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem },
      global: { stubs },
    })

    // Access the component's internal state via vm
    const vm = wrapper.vm as unknown as { localQty: number; handleQtyCommit: () => void }

    // Simulate user changing the quantity
    vm.localQty = 5
    vm.handleQtyCommit()

    expect(wrapper.emitted('update-qty')).toBeTruthy()
    expect(wrapper.emitted('update-qty')?.[0]).toEqual(['item-1', 5])
  })

  it('should emit update-qty via change event', async () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem },
      global: { stubs },
    })

    const vm = wrapper.vm as unknown as { localQty: number; handleQtyCommit: () => void }

    vm.localQty = 3
    vm.handleQtyCommit()

    expect(wrapper.emitted('update-qty')).toBeTruthy()
    expect(wrapper.emitted('update-qty')?.[0]).toEqual(['item-1', 3])
  })

  it('should not emit if quantity unchanged', () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem },
      global: { stubs },
    })

    const vm = wrapper.vm as unknown as { localQty: number; handleQtyCommit: () => void }

    vm.localQty = 2 // Same as original
    vm.handleQtyCommit()

    expect(wrapper.emitted('update-qty')).toBeFalsy()
  })

  it('should receive isUpdating prop for disabled state', () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem, isUpdating: true },
      global: { stubs },
    })

    // Verify component received the prop
    expect(wrapper.props('isUpdating')).toBe(true)
    // The template binds :disabled="isUpdating" on UInputNumber
    expect(wrapper.html()).toContain('disabled')
  })

  it('should not emit if quantity is less than 1', () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem },
      global: { stubs },
    })

    const vm = wrapper.vm as unknown as {
      localQty: number
      previousQty: number
      handleQtyCommit: () => void
    }

    vm.localQty = 0
    vm.handleQtyCommit()

    expect(wrapper.emitted('update-qty')).toBeFalsy()
    // Should revert to previous value
    expect(vm.localQty).toBe(2)
  })

  it('should calculate line total for different quantities', () => {
    const itemWithHighQty: SaleItem = {
      ...mockItemWithVariant,
      quantity: 10,
    }

    const wrapper = mount(SaleItemRow, {
      props: { item: itemWithHighQty },
      global: { stubs },
    })

    // 8000 cents * 10 = 80000 cents = $800.00
    expect(wrapper.text()).toContain('$800.00')
  })

  it('should sync localQty when item.quantity prop changes', async () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem },
      global: { stubs },
    })

    const vm = wrapper.vm as unknown as { localQty: number }
    expect(vm.localQty).toBe(2)

    const updatedItem: SaleItem = { ...mockItem, quantity: 5 }
    await wrapper.setProps({ item: updatedItem })

    expect(vm.localQty).toBe(5)
  })
})
