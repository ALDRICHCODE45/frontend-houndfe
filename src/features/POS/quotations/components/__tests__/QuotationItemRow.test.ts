import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import QuotationItemRow from '../QuotationItemRow.vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import type { QuotationItemResponseDto } from '../../interfaces/quotation.types'

function makeItem(overrides: Partial<QuotationItemResponseDto> = {}): QuotationItemResponseDto {
  return {
    id: 'item-1',
    productId: 'product-1',
    variantId: null,
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
}

function mountRow(item: QuotationItemResponseDto, readonly = false, emitStub = false) {
  return mount(QuotationItemRow, {
    props: { item, readonly },
    global: {
      stubs,
      // Auto-imported globals (AppBadge, UButton) must be provided because
      // globalThis stubs don't override them in @vue/test-utils mount.
      components: { AppBadge, UButton: stubs.UButton },
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

describe('QuotationItemRow remove button', () => {
  it('renders the remove button in DRAFT mode', () => {
    const wrapper = mountRow(makeItem(), false)
    expect(wrapper.find('[data-testid="remove-item-button"]').exists()).toBe(true)
  })

  it('hides the remove button in readonly mode', () => {
    const wrapper = mountRow(makeItem(), true)
    expect(wrapper.find('[data-testid="remove-item-button"]').exists()).toBe(false)
  })

  it('emits request-remove when clicked', async () => {
    const wrapper = mountRow(makeItem(), false)

    await wrapper.get('[data-testid="remove-item-button"]').trigger('click')
    expect(wrapper.emitted('request-remove')).toEqual([['item-1']])
  })
})

describe('QuotationItemRow price override', () => {
  it('emits request-override with the current unit price when the price is clicked in DRAFT mode', async () => {
    const wrapper = mountRow(makeItem({ unitPriceCents: 15000 }), false)

    await wrapper.get('[data-testid="price-override-button"]').trigger('click')
    expect(wrapper.emitted('override-price')).toEqual([['item-1', 15000]])
  })

  it('hides the price override button when readonly is true', () => {
    const wrapper = mountRow(makeItem(), true)
    expect(wrapper.find('[data-testid="price-override-button"]').exists()).toBe(false)
  })
})
