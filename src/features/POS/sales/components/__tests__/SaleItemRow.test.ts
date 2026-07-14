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
          // Post-deploy contract: backend NET per line ($80.00 — this is the
          // unit NET, NOT unit × qty; the frontend renders it verbatim).
          // Pre-deploy drafts would lack this field and fall back to gross —
          // the new REQ-3 scenarios above cover that fallback path explicitly.
          subtotalCents: 8000,
        },
        saleId: 'sale-1', onSubmitPriceOverride, onApplyDiscount, onRemoveDiscount,
      },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('DESCUENTO -20%')
    expect(wrapper.text()).toContain('$100.00')
    expect(wrapper.text()).toContain('Promo especial')

    // Post-deploy contract (REQ-3): bold NET shows backend subtotalCents
    // ($80.00); struck gross shows prePrice × qty = 10000 × 2 = $200.00.
    const netLine = wrapper.find('[data-testid="sale-item-line-net"]')
    expect(netLine.exists()).toBe(true)
    expect(netLine.text()).toContain('$80.00')
    const grossStrike = wrapper.find('[data-testid="sale-item-line-gross-strike"]')
    expect(grossStrike.exists()).toBe(true)
    expect(grossStrike.text()).toContain('$200.00')
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

  // ── D.1 — Draft cart line renders backend NET + reward badge (REQ-3) ──────
  //
  // The backend now ADDITIVELY returns `subtotalCents` (NET per line) and
  // `rewardKind` on every draft line mutation and on GET /sales/drafts/:id.
  // For BXGY lines (unitPriceCents === prePriceCentsBeforeDiscount), the
  // bold line total MUST render the NET (subtotalCents), the struck-through
  // gross (prePrice × qty) MUST render the GROSS, and the unit price
  // strikethrough MUST NOT appear because the unit price itself did not
  // drop. The GRATIS reward badge MUST surface via SaleItemBadges.

  it('renders NET bold + struck gross + GRATIS badge + NO unit strikethrough on a BXGY draft line', () => {
    // 2x1 BXGY: buy 2 get 1 free → backend NET per line = $200.00 (2 units
    // of a $200 product, but one is free; the frontend MUST trust
    // subtotalCents and not recompute). unitPriceCents is unchanged ($200),
    // prePriceCentsBeforeDiscount equals unitPrice (no per-unit discount).
    const bxgyItem: SaleItem = {
      id: 'item-bxgy',
      productId: 'prod-1',
      variantId: null,
      productName: 'Vitamina C',
      variantName: '500mg',
      quantity: 2,
      unitPriceCents: 20000,
      unitPriceCurrency: 'MXN',
      prePriceCentsBeforeDiscount: 20000,
      discountAmountCents: 20000,
      subtotalCents: 20000,
      rewardKind: 'buy_x_get_y',
    }

    const wrapper = mount(SaleItemRow, {
      props: {
        item: bxgyItem,
        saleId: 'sale-1',
        onSubmitPriceOverride,
        onApplyDiscount,
        onRemoveDiscount,
      },
      global: { stubs },
    })

    // Bold NET line shows the backend-provided subtotalCents ($200.00).
    const netLine = wrapper.find('[data-testid="sale-item-line-net"]')
    expect(netLine.exists()).toBe(true)
    expect(netLine.text()).toContain('$200.00')
    expect(netLine.classes()).toContain('font-bold')

    // Struck-through gross line shows prePrice × qty ($400.00).
    const grossLine = wrapper.find('[data-testid="sale-item-line-gross-strike"]')
    expect(grossLine.exists()).toBe(true)
    expect(grossLine.text()).toContain('$400.00')
    expect(grossLine.classes()).toContain('line-through')

    // Unit price strikethrough MUST NOT appear: unitPriceCents (20000) is
    // NOT less than prePriceCentsBeforeDiscount (20000) — the unit price
    // did not drop on a BXGY line, the reward is line-level.
    expect(wrapper.find('[data-testid="sale-item-unit-strike-original"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sale-item-unit-strike-pre-discount"]').exists()).toBe(false)

    // Current unit price still renders, unchanged.
    expect(wrapper.text()).toContain('$200.00 c/u')

    // GRATIS reward badge is forwarded to SaleItemBadges.
    const badges = wrapper.findComponent(SaleItemBadges)
    expect(badges.exists()).toBe(true)
    expect(badges.props('rewardKind')).toBe('buy_x_get_y')
  })

  it('renders NET bold + struck gross + unit-price strikethrough on a cashier line discount', () => {
    // Cashier applied 20% off: prePrice $96.00 → unit $80.00. Backend NET
    // per line = unit × qty = $80.00 (qty 1). Unit-price strikethrough
    // appears because unitPriceCents (8000) < prePriceCentsBeforeDiscount
    // (9600).
    const cashierDiscountItem: SaleItem = {
      ...mockItem,
      quantity: 1,
      unitPriceCents: 8000,
      discountType: 'percentage',
      discountValue: 20,
      discountAmountCents: 1600,
      discountTitle: 'Descuento empleado',
      prePriceCentsBeforeDiscount: 9600,
      subtotalCents: 8000,
    }

    const wrapper = mount(SaleItemRow, {
      props: {
        item: cashierDiscountItem,
        saleId: 'sale-1',
        onSubmitPriceOverride,
        onApplyDiscount,
        onRemoveDiscount,
      },
      global: { stubs },
    })

    // Bold NET shows $80.00.
    const netLine = wrapper.find('[data-testid="sale-item-line-net"]')
    expect(netLine.exists()).toBe(true)
    expect(netLine.text()).toContain('$80.00')

    // Struck-through gross shows $96.00.
    const grossLine = wrapper.find('[data-testid="sale-item-line-gross-strike"]')
    expect(grossLine.exists()).toBe(true)
    expect(grossLine.text()).toContain('$96.00')

    // Unit-price pre-discount strikethrough present (8000 < 9600).
    const preDiscountStrike = wrapper.find('[data-testid="sale-item-unit-strike-pre-discount"]')
    expect(preDiscountStrike.exists()).toBe(true)
    expect(preDiscountStrike.text()).toContain('$96.00')
    expect(preDiscountStrike.classes()).toContain('line-through')

    // No original-price strikethrough on this line.
    expect(wrapper.find('[data-testid="sale-item-unit-strike-original"]').exists()).toBe(false)

    // NOT a reward line.
    const badges = wrapper.findComponent(SaleItemBadges)
    expect(badges.props('rewardKind')).not.toBe('buy_x_get_y')
  })

  it('renders NET bold with NO struck line and NO unit strikethrough on a no-discount line', () => {
    // No discount, no override, no reward. Bold shows gross = NET = $100.00
    // (qty 2 × $50.00). No struck line (no real discount). No unit
    // strikethrough.
    const noDiscountItem: SaleItem = {
      ...mockItem,
      quantity: 2,
      unitPriceCents: 5000,
      unitPriceCurrency: 'MXN',
      subtotalCents: 10000,
    }

    const wrapper = mount(SaleItemRow, {
      props: {
        item: noDiscountItem,
        saleId: 'sale-1',
        onSubmitPriceOverride,
        onApplyDiscount,
        onRemoveDiscount,
      },
      global: { stubs },
    })

    const netLine = wrapper.find('[data-testid="sale-item-line-net"]')
    expect(netLine.exists()).toBe(true)
    expect(netLine.text()).toContain('$100.00')

    // No struck gross line because netLine === grossLine.
    expect(wrapper.find('[data-testid="sale-item-line-gross-strike"]').exists()).toBe(false)

    // No unit-price strikethrough.
    expect(wrapper.find('[data-testid="sale-item-unit-strike-original"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sale-item-unit-strike-pre-discount"]').exists()).toBe(false)

    const badges = wrapper.findComponent(SaleItemBadges)
    expect(badges.props('rewardKind')).not.toBe('buy_x_get_y')
  })

  it('falls back to gross line total when backend subtotalCents is missing (pre-deploy drafts)', () => {
    // Pre-deploy drafts: no subtotalCents, no rewardKind. Fall back to
    // unitPriceCents × quantity. For a line with no discount or prePrice,
    // gross === NET so no struck line shows.
    const legacyItem: SaleItem = {
      id: 'item-legacy',
      productId: 'prod-1',
      variantId: null,
      productName: 'Aspirina 100mg',
      variantName: null,
      quantity: 3,
      unitPriceCents: 5000,
      unitPriceCurrency: 'MXN',
    }

    const wrapper = mount(SaleItemRow, {
      props: {
        item: legacyItem,
        saleId: 'sale-1',
        onSubmitPriceOverride,
        onApplyDiscount,
        onRemoveDiscount,
      },
      global: { stubs },
    })

    const netLine = wrapper.find('[data-testid="sale-item-line-net"]')
    expect(netLine.exists()).toBe(true)
    expect(netLine.text()).toContain('$150.00')

    expect(wrapper.find('[data-testid="sale-item-line-gross-strike"]').exists()).toBe(false)

    const badges = wrapper.findComponent(SaleItemBadges)
    expect(badges.props('rewardKind')).toBeUndefined()
  })
})
