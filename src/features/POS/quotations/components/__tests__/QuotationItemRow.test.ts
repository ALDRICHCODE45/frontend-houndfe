import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed } from 'vue'
import QuotationItemRow from '../QuotationItemRow.vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import type { QuotationItemResponseDto } from '../../interfaces/quotation.types'

function makeItem(overrides: Partial<QuotationItemResponseDto> = {}): QuotationItemResponseDto {
  return {
    id: 'item-1',
    productId: 'product-1',
    variantId: null,
    productName: 'Playera M',
    variantName: null,
    quantity: 2,
    product: {
      id: 'product-1',
      name: 'Playera M',
      sku: 'SKU-1',
      imageUrl: null,
    },
    variant: null,
    unitPriceCents: 15000,
    priceSource: 'PRICE_LIST',
    discountType: null,
    discountValue: null,
    discountAmountCents: 0,
    discountTitle: null,
    promotionId: null,
    manuallyAdjusted: false,
    overrideNote: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

const stubs = {
  AppBadge: {
    props: ['label', 'tone', 'icon'],
    template:
      '<span class="app-badge" :data-tone="tone" :data-icon="icon">{{ label }}</span>',
  },
  UButton: {
    props: ['icon', 'color', 'variant', 'disabled'],
    emits: ['click'],
    template:
      '<button class="u-btn" :data-icon="icon" :data-color="color" :data-variant="variant" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
  },
  UDropdownMenu: {
    template: '<div><slot /></div>',
  },
}

function mountRow(item: QuotationItemResponseDto, readonly = false, emitStub = false) {
  return mount(QuotationItemRow, {
    props: { item, readonly },
    global: {
      stubs,
      // Auto-imported globals (AppBadge, UButton) must be provided because
      // globalThis stubs don't override them in @vue/test-utils mount.
      components: { AppBadge, UButton: stubs.UButton, UDropdownMenu: stubs.UDropdownMenu },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('QuotationItemRow rendering', () => {
  it('renders the product name, SKU, quantity, unit price and line subtotal', () => {
    const wrapper = mountRow(makeItem({ quantity: 3, unitPriceCents: 15000 }))

    expect(wrapper.text()).toContain('Playera M')
    expect(wrapper.text()).toContain('SKU-1')
    // qty lives inside an <input> whose value attribute is a property — check
    // the visible side (line subtotal reflects quantity × unit price).
    expect(wrapper.text()).toMatch(/\$150\.00/)
    expect(wrapper.text()).toMatch(/\$450\.00/)
  })

  it('seeds the quantity input with the prop value', () => {
    const wrapper = mountRow(makeItem({ quantity: 5 }))
    const input = wrapper.find('[data-testid="quantity-input"]')
    // Either the real UInput (with an <input value="5"> child) or the stub
    // exposes the stringified value — accept either shape.
    const element = input.element as HTMLElement | undefined
    const realValue = element && 'value' in element ? (element as HTMLInputElement).value : null
    const value = input.attributes('value') ?? realValue ?? input.text()
    expect(String(value)).toContain('5')
  })

  it('shows the variant name when present', () => {
    const wrapper = mountRow(
      makeItem({
        variant: { id: 'v-1', name: 'Talla Mediana', sku: 'SKU-1-M' },
      }),
    )

    expect(wrapper.text()).toContain('Talla Mediana')
  })

  it('shows the product image alt text when imageUrl is set', () => {
    const wrapper = mountRow(makeItem({
      product: { id: 'product-1', name: 'Playera M', sku: 'SKU-1', imageUrl: 'https://example.com/img.png' },
    }))
    expect(wrapper.html()).toContain('https://example.com/img.png')
  })
})

describe('QuotationItemRow price source indicator', () => {
  it('shows "PRECIO MANUAL" badge when priceSource is CUSTOM', () => {
    const wrapper = mountRow(makeItem({ priceSource: 'CUSTOM', manuallyAdjusted: true }))

    const badge = wrapper.find('[data-testid="manual-price-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('PRECIO MANUAL')
  })

  it('hides the manual price badge when priceSource is PRICE_LIST', () => {
    const wrapper = mountRow(makeItem({ priceSource: 'PRICE_LIST' }))
    expect(wrapper.find('[data-testid="manual-price-badge"]').exists()).toBe(false)
  })

  it('hides the manual price badge when priceSource is TIER_PRICE', () => {
    const wrapper = mountRow(makeItem({ priceSource: 'TIER_PRICE' }))
    expect(wrapper.find('[data-testid="manual-price-badge"]').exists()).toBe(false)
  })

  it('shows promotion title when priceSource is PROMOTION with a discountTitle', () => {
    const wrapper = mountRow(
      makeItem({
        priceSource: 'PROMOTION',
        promotionId: 'promo-1',
        discountTitle: '10% off',
      }),
    )

    expect(wrapper.find('[data-testid="promotion-badge"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('10% off')
  })
})

describe('QuotationItemRow discount info', () => {
  it('renders the discount amount when discountAmountCents > 0', () => {
    const wrapper = mountRow(
      makeItem({
        discountAmountCents: 1500,
        discountTitle: 'Cupón',
      }),
    )

    expect(wrapper.find('[data-testid="discount-info"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Cupón')
  })

  it('hides the discount info when no discount was applied', () => {
    const wrapper = mountRow(makeItem({ discountAmountCents: 0, discountTitle: null }))
    expect(wrapper.find('[data-testid="discount-info"]').exists()).toBe(false)
  })
})

describe('QuotationItemRow quantity controls', () => {
  it('renders the quantity input and stepper buttons in DRAFT mode', () => {
    const wrapper = mountRow(makeItem({ quantity: 2 }), false)

    expect(wrapper.find('[data-testid="quantity-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quantity-increase"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quantity-decrease"]').exists()).toBe(true)
  })

  it('hides the quantity controls when readonly is true', () => {
    const wrapper = mountRow(makeItem({ quantity: 2 }), true)

    expect(wrapper.find('[data-testid="quantity-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="quantity-increase"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="quantity-decrease"]').exists()).toBe(false)
  })

  it('emits update-quantity with the new quantity when the increase button is clicked', async () => {
    const wrapper = mountRow(makeItem({ quantity: 2 }), false)

    await wrapper.get('[data-testid="quantity-increase"]').trigger('click')
    expect(wrapper.emitted('update-quantity')).toEqual([['item-1', 3]])
  })

  it('emits update-quantity with qty-1 when the decrease button is clicked', async () => {
    const wrapper = mountRow(makeItem({ quantity: 2 }), false)

    await wrapper.get('[data-testid="quantity-decrease"]').trigger('click')
    expect(wrapper.emitted('update-quantity')).toEqual([['item-1', 1]])
  })

  it('emits update-quantity from the manual quantity input commit', async () => {
    const wrapper = mountRow(makeItem({ quantity: 2 }), false)
    const input = wrapper.find('[data-testid="quantity-input"]')

    await input.setValue('5')
    await input.trigger('blur')

    expect(wrapper.emitted('update-quantity')).toEqual([['item-1', 5]])
  })

  it('does not emit update-quantity when value did not change', async () => {
    const wrapper = mountRow(makeItem({ quantity: 2 }), false)
    const input = wrapper.find('[data-testid="quantity-input"]')

    await input.setValue('2')
    await input.trigger('blur')

    expect(wrapper.emitted('update-quantity')).toBeUndefined()
  })

  it('does not emit update-quantity when value is less than 1', async () => {
    const wrapper = mountRow(makeItem({ quantity: 2 }), false)
    const input = wrapper.find('[data-testid="quantity-input"]')

    await input.setValue('0')
    await input.trigger('blur')

    expect(wrapper.emitted('update-quantity')).toBeUndefined()
  })
})

describe('QuotationItemRow actions dropdown', () => {
  it('renders the actions dropdown trigger in DRAFT mode', () => {
    const wrapper = mountRow(makeItem(), false)
    expect(wrapper.find('[data-testid="item-actions-trigger"]').exists()).toBe(true)
  })

  it('hides the actions dropdown trigger in readonly mode', () => {
    const wrapper = mountRow(makeItem(), true)
    expect(wrapper.find('[data-testid="item-actions-trigger"]').exists()).toBe(false)
    const vm = wrapper.vm as unknown as { itemActions: unknown[] }
    expect(vm.itemActions).toEqual([])
  })

  it('emits request-remove when the delete action is selected', () => {
    const wrapper = mountRow(makeItem(), false)
    const vm = wrapper.vm as unknown as {
      itemActions: Array<Array<{ label: string; onSelect: () => void }>>
    }
    const deleteAction = vm.itemActions[1]?.find(
      (action) => action.label === 'Eliminar producto',
    )
    expect(deleteAction).toBeDefined()
    deleteAction!.onSelect()
    expect(wrapper.emitted('request-remove')).toEqual([['item-1']])
  })
})

describe('QuotationItemRow price override', () => {
  it('exposes a Cambiar precio action in the dropdown', () => {
    const wrapper = mountRow(makeItem({ unitPriceCents: 15000 }), false)
    const vm = wrapper.vm as unknown as {
      itemActions: Array<Array<{ label: string; onSelect: () => void }>>
    }
    const priceAction = vm.itemActions[0]?.find(
      (action) => action.label === 'Cambiar precio',
    )
    expect(priceAction).toBeDefined()
    priceAction!.onSelect()
    expect(wrapper.emitted('request-price-override')).toEqual([['item-1']])
  })

  it('hides the price override action when readonly is true', () => {
    const wrapper = mountRow(makeItem(), true)
    const vm = wrapper.vm as unknown as { itemActions: unknown[] }
    expect(vm.itemActions).toEqual([])
    expect(wrapper.find('[data-testid="item-actions-trigger"]').exists()).toBe(false)
  })
})

// ─── S8: stock badges (REQ-QTN-013) ─────────────────────────────────────────
// Stock data is fetched lazily via `useQuotationItemStock(item.productId)`.
// The composable is mocked at the module level here so we can drive the
// rendered badge from the composable's return shape. The composable itself
// has its own dedicated test file.

const stockApiMock = vi.hoisted(() => ({
  // Mutable in each test via setStock()/clearStock().
  current: { stock: null, isAvailable: false, isError: false } as {
    stock: null | { quantity: number; minQuantity: number; isLow: boolean; isOut: boolean }
    isAvailable: boolean
    isError: boolean
  },
}))

vi.mock('../../composables/useQuotationItemStock', () => ({
  useQuotationItemStock: () => ({
    stock: computed(() => stockApiMock.current.stock),
    isAvailable: computed(() => stockApiMock.current.isAvailable),
    isError: computed(() => stockApiMock.current.isError),
  }),
}))

function setStock(quantity: number, minQuantity = 0): void {
  stockApiMock.current = {
    stock: { quantity, minQuantity, isLow: quantity <= minQuantity && quantity > 0, isOut: quantity <= 0 },
    isAvailable: true,
    isError: false,
  }
}

function setUseStockFalse(): void {
  stockApiMock.current = { stock: null, isAvailable: false, isError: false }
}

function setStockError(): void {
  stockApiMock.current = { stock: null, isAvailable: false, isError: true }
}

describe('QuotationItemRow stock badge (REQ-QTN-013 / S8.2)', () => {
  beforeEach(() => {
    setStockError() // default: nothing on the wire yet → no badge
  })

  it('does not render a stock badge when no stock data is hydrated yet', () => {
    const wrapper = mountRow(makeItem())
    expect(wrapper.find('[data-testid="stock-badge"]').exists()).toBe(false)
  })

  it('does not render a stock badge when useStock is false (informational only)', () => {
    setUseStockFalse()
    const wrapper = mountRow(makeItem())
    expect(wrapper.find('[data-testid="stock-badge"]').exists()).toBe(false)
  })

  it('renders a "Stock: 12" badge when stock data is available and quantity > 0', () => {
    setStock(12, 3)
    const wrapper = mountRow(makeItem())

    const badge = wrapper.find('[data-testid="stock-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('Stock: 12')
    // Neutral / muted tone — never blocks actions
    expect(badge.attributes('data-tone')).not.toBe('error')
    expect(badge.attributes('data-tone')).not.toBe('warning')
  })

  it('renders "Agotado" when stock quantity is zero', () => {
    setStock(0, 0)
    const wrapper = mountRow(makeItem())

    const badge = wrapper.find('[data-testid="stock-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('Agotado')
  })

  it('renders the stock badge with warning tone when stock is low but not zero', () => {
    setStock(2, 5)
    const wrapper = mountRow(makeItem())

    const badge = wrapper.find('[data-testid="stock-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('Stock: 2')
    expect(badge.attributes('data-tone')).toBe('warning')
  })

  it('renders the stock badge with error tone when stock is zero', () => {
    setStock(0, 1)
    const wrapper = mountRow(makeItem())

    const badge = wrapper.find('[data-testid="stock-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.attributes('data-tone')).toBe('error')
  })

  it('renders the stock badge even in readonly mode (purely informational)', () => {
    setStock(7, 1)
    const wrapper = mountRow(makeItem(), true)
    expect(wrapper.find('[data-testid="stock-badge"]').exists()).toBe(true)
  })

  it('does NOT disable any control when stock is zero (badge never gates actions)', () => {
    setStock(0, 0)
    const wrapper = mountRow(makeItem({ quantity: 2 }), false)

    expect(wrapper.find('[data-testid="quantity-increase"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quantity-decrease"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="item-actions-trigger"]').exists()).toBe(true)
  })
})
