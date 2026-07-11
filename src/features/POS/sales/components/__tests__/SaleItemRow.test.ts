import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleItemRow from '../SaleItemRow.vue'
import SaleItemBadges from '../SaleItemBadges.vue'
import type { SaleItem } from '../../interfaces/sale.types'

describe('SaleItemRow', () => {
  const stubs = {
    UInputNumber: true,
    UIcon: true,
    UButton: true,
    UBadge: true,
    UDropdownMenu: true,
    UTooltip: true,
    Tooltip: { props: ['text'], template: '<div><slot />{{ text }}</div>' },
    PriceOverrideModal: true,
    ItemDiscountModal: true,
  }

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

  const onSubmitPriceOverride = async () => undefined
  const onApplyDiscount = async () => undefined
  const onRemoveDiscount = async () => undefined
  const onRemoveItem = async () => undefined

  it('should render product name', () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem, saleId: 'sale-1', onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Aspirina 100mg')
  })

  it('should render variant name when present', () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItemWithVariant, saleId: 'sale-1', onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Vitamina C')
    expect(wrapper.text()).toContain('500mg')
  })

  it('should display unit price formatted in MXN', () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem, saleId: 'sale-1', onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('$50.00')
  })

  it('should display line total calculated correctly', () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem, saleId: 'sale-1', onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount },
      global: { stubs },
    })

    // 5000 cents * 2 = 10000 cents = $100.00
    expect(wrapper.text()).toContain('$100.00')
  })

  it('should emit update-qty on blur when value changed', async () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem, saleId: 'sale-1', onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount },
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
      props: { item: mockItem, saleId: 'sale-1', onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount },
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
      props: { item: mockItem, saleId: 'sale-1', onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount },
      global: { stubs },
    })

    const vm = wrapper.vm as unknown as { localQty: number; handleQtyCommit: () => void }

    vm.localQty = 2 // Same as original
    vm.handleQtyCommit()

    expect(wrapper.emitted('update-qty')).toBeFalsy()
  })

  it('should receive isUpdating prop for disabled state', () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem, saleId: 'sale-1', isUpdating: true, onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount },
      global: { stubs },
    })

    // Verify component received the prop
    expect(wrapper.props('isUpdating')).toBe(true)
    // The template binds :disabled="isUpdating" on UInputNumber
    expect(wrapper.html()).toContain('disabled')
  })

  it('should not emit if quantity is less than 1', () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem, saleId: 'sale-1', onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount },
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
      props: { item: itemWithHighQty, saleId: 'sale-1', onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount },
      global: { stubs },
    })

    // 8000 cents * 10 = 80000 cents = $800.00
    expect(wrapper.text()).toContain('$800.00')
  })

  it('should sync localQty when item.quantity prop changes', async () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem, saleId: 'sale-1', onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount },
      global: { stubs },
    })

    const vm = wrapper.vm as unknown as { localQty: number }
    expect(vm.localQty).toBe(2)

    const updatedItem: SaleItem = { ...mockItem, quantity: 5 }
    await wrapper.setProps({ item: updatedItem })

    expect(vm.localQty).toBe(5)
  })

  it('should show item actions dropdown only for draft rows', () => {
    const draftWrapper = mount(SaleItemRow, {
      props: { item: mockItem, saleId: 'sale-1', isDraft: true, onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount },
      global: { stubs },
    })

    const vm = draftWrapper.vm as unknown as { itemActions: Array<Array<{ label?: string }>> }
    expect(vm.itemActions.length).toBeGreaterThan(0)
    expect(vm.itemActions[0]?.some((a) => a.label === 'Cambiar precio')).toBe(true)

    const nonDraftWrapper = mount(SaleItemRow, {
      props: { item: mockItem, saleId: 'sale-1', isDraft: false, onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount },
      global: { stubs },
    })
    const nonDraftVm = nonDraftWrapper.vm as unknown as { itemActions: Array<Array<{ label?: string }>> }
    expect(nonDraftVm.itemActions).toHaveLength(0)
  })

  it('should pass onSubmit callback and saleId to modal', async () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem, saleId: 'sale-1', onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount },
      global: { stubs },
    })

    const vm = wrapper.vm as unknown as { isPriceModalOpen: boolean }
    vm.isPriceModalOpen = true
    await wrapper.vm.$nextTick()

    const modal = wrapper.findComponent({ name: 'PriceOverrideModal' })
    expect(modal.exists()).toBe(true)
    expect(modal.props('saleId')).toBe('sale-1')
    expect(typeof modal.props('onSubmit')).toBe('function')
  })

  it('should render LISTA badge and original price for price_list source', () => {
    const wrapper = mount(SaleItemRow, {
      props: {
        item: { ...mockItem, priceSource: 'price_list', originalPriceCents: 7000, appliedPriceListId: 'list-1' },
        saleId: 'sale-1',
        onSubmitPriceOverride,
        onApplyDiscount,
        onRemoveDiscount,
      },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('PRECIO LISTA')
    expect(wrapper.text()).toContain('$70.00')
  })

  it('should render CUSTOM badge and original price for custom source', () => {
    const wrapper = mount(SaleItemRow, {
      props: {
        item: { ...mockItem, priceSource: 'custom', originalPriceCents: 7000, customPriceCents: 5000 },
        saleId: 'sale-1',
        onSubmitPriceOverride,
        onApplyDiscount,
        onRemoveDiscount,
      },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('PRECIO MANUAL')
    expect(wrapper.text()).toContain('$70.00')
  })

  it('renders badge group with wrapped layout when price source and discount are present', () => {
    const wrapper = mount(SaleItemRow, {
      props: {
        item: {
          ...mockItem,
          priceSource: 'price_list',
          originalPriceCents: 7000,
          discountType: 'percentage',
          discountValue: 20,
          discountAmountCents: 1000,
        },
        saleId: 'sale-1',
        onSubmitPriceOverride,
        onApplyDiscount,
        onRemoveDiscount,
      },
      global: { stubs },
    })

    const badgeGroup = wrapper.find('[data-testid="sale-item-badge-group"]')
    expect(badgeGroup.exists()).toBe(true)
    expect(badgeGroup.classes()).toContain('flex-wrap')
    expect(wrapper.text()).toContain('PRECIO LISTA')
    expect(wrapper.text()).toContain('DESCUENTO -20%')
  })

  it('shows Agregar descuento when no discount exists and Quitar descuento when present', () => {
    const noDiscount = mount(SaleItemRow, {
      props: { item: mockItem, saleId: 'sale-1', onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount },
      global: { stubs },
    })
    const withDiscount = mount(SaleItemRow, {
      props: {
        item: { ...mockItem, discountType: 'percentage', discountValue: 20, discountAmountCents: 1000 },
        saleId: 'sale-1', onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount,
      },
      global: { stubs },
    })

    const noActions = (noDiscount.vm as unknown as { itemActions: Array<Array<{ label: string }>> }).itemActions
    const withActions = (withDiscount.vm as unknown as { itemActions: Array<Array<{ label: string }>> }).itemActions
    expect(noActions[0]?.map((action) => action.label)).toContain('Agregar descuento')
    expect(withActions[0]?.map((action) => action.label)).toContain('Quitar descuento')
  })

  it('hides add discount action when unitPriceCents is zero', () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: { ...mockItem, unitPriceCents: 0 }, saleId: 'sale-1', onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount },
      global: { stubs },
    })

    const actions = (wrapper.vm as unknown as { itemActions: Array<Array<{ label: string }>> }).itemActions
    expect(actions[0]?.map((action) => action.label)).not.toContain('Agregar descuento')
  })

  it('renders discount badge, crossed pre-discount price, and title tooltip', () => {
    const wrapper = mount(SaleItemRow, {
      props: {
        item: {
          ...mockItem,
          unitPriceCents: 8000,
          discountType: 'percentage',
          discountValue: 20,
          discountAmountCents: 2000,
          discountTitle: 'Promo especial',
          prePriceCentsBeforeDiscount: 10000,
        },
        saleId: 'sale-1', onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount,
      },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('DESCUENTO -20%')
    expect(wrapper.text()).toContain('$100.00')
    expect(wrapper.text()).toContain('Promo especial')
  })

  it('includes Eliminar producto action with error color for draft items', () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem, saleId: 'sale-1', isDraft: true, onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount, onRemoveItem },
      global: { stubs },
    })

    const actions = (wrapper.vm as unknown as { itemActions: Array<Array<{ label: string; color?: string }>> }).itemActions
    const labels = actions[0]?.map((action) => action.label)
    expect(labels).toContain('Cambiar precio')
    expect(labels).toContain('Eliminar producto')
    expect(actions[0]?.find((action) => action.label === 'Eliminar producto')?.color).toBe('error')
  })

  it('hides Eliminar producto action for non-draft items', () => {
    const wrapper = mount(SaleItemRow, {
      props: { item: mockItem, saleId: 'sale-1', isDraft: false, onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount, onRemoveItem },
      global: { stubs },
    })

    const actions = (wrapper.vm as unknown as { itemActions: Array<Array<{ label: string }>> }).itemActions
    expect(actions).toEqual([])
  })

  // ── C.2 — forward per-line promotion remove from SaleItemBadges ─────────────

  it('passes promotionId to SaleItemBadges and marks it removable for draft rows', () => {
    const wrapper = mount(SaleItemRow, {
      props: {
        item: {
          ...mockItem,
          discountType: 'percentage',
          discountValue: 15,
          discountAmountCents: 1500,
          discountTitle: 'Promo 2x1',
          promotionId: 'promo-uuid-42',
        },
        saleId: 'sale-1',
        isDraft: true,
        onSubmitPriceOverride,
        onApplyDiscount,
        onRemoveDiscount,
      },
      global: { stubs },
    })

    const badges = wrapper.findComponent(SaleItemBadges)
    expect(badges.exists()).toBe(true)
    expect(badges.props('promotionId')).toBe('promo-uuid-42')
    expect(badges.props('removable')).toBe(true)
  })

  it('passes promotionId but NOT removable for non-draft rows (confirmed-sale safety)', () => {
    const wrapper = mount(SaleItemRow, {
      props: {
        item: {
          ...mockItem,
          discountType: 'percentage',
          discountValue: 15,
          discountAmountCents: 1500,
          discountTitle: 'Promo 2x1',
          promotionId: 'promo-uuid-42',
        },
        saleId: 'sale-1',
        isDraft: false,
        onSubmitPriceOverride,
        onApplyDiscount,
        onRemoveDiscount,
      },
      global: { stubs },
    })

    const badges = wrapper.findComponent(SaleItemBadges)
    expect(badges.exists()).toBe(true)
    expect(badges.props('promotionId')).toBe('promo-uuid-42')
    expect(badges.props('removable')).toBe(false)
  })

  it('re-emits remove-promo from SaleItemBadges upward with the promotionId', async () => {
    const wrapper = mount(SaleItemRow, {
      props: {
        item: {
          ...mockItem,
          discountType: 'percentage',
          discountValue: 15,
          discountAmountCents: 1500,
          discountTitle: 'Promo 2x1',
          promotionId: 'promo-uuid-42',
        },
        saleId: 'sale-1',
        isDraft: true,
        onSubmitPriceOverride,
        onApplyDiscount,
        onRemoveDiscount,
      },
      global: { stubs },
    })

    const badges = wrapper.findComponent(SaleItemBadges)
    expect(badges.exists()).toBe(true)

    // Drive the event from the child as the parent would.
    badges.vm.$emit('remove-promo', 'promo-uuid-42')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('remove-promo')).toBeTruthy()
    expect(wrapper.emitted('remove-promo')?.[0]).toEqual(['promo-uuid-42'])
  })
})
