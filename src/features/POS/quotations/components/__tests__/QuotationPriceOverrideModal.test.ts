import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import QuotationPriceOverrideModal from '../QuotationPriceOverrideModal.vue'
import type { QuotationItemResponseDto } from '../../interfaces/quotation.types'

// Stub Nuxt UI primitives so the test stays focused on the modal's logic.
// Matches the pattern used by QuotationSendDialog / QuotationCancelDialog and
// the sales module's PriceOverrideModal tests.
const modalStub = {
  props: ['open', 'title', 'dismissible', 'close'],
  emits: ['update:open'],
  template: '<div data-testid="price-override-modal"><slot name="body" /><slot name="footer" /></div>',
}
const buttonStub = {
  props: ['label', 'color', 'variant', 'loading', 'disabled'],
  emits: ['click'],
  template:
    '<button :disabled="disabled" :data-loading="loading" @click="$emit(\'click\')">{{ label }}<slot /></button>',
}
const stubs = {
  UModal: modalStub,
  Modal: modalStub,
  UButton: buttonStub,
  Button: buttonStub,
  UFormField: { template: '<div><slot /></div>' },
  FormField: { template: '<div><slot /></div>' },
  UInput: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input type="number" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  Input: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input type="number" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  UAlert: { props: ['description'], template: '<p>{{ description }}</p>' },
  Alert: { props: ['description'], template: '<p>{{ description }}</p>' },
}

function makeItem(overrides: Partial<QuotationItemResponseDto> = {}): QuotationItemResponseDto {
  return {
    id: 'item-1',
    productId: 'product-1',
    variantId: null,
    productName: 'Playera M',
    variantName: null,
    quantity: 1,
    product: { id: 'product-1', name: 'Playera M', sku: 'SKU-1', imageUrl: null },
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

function mountModal(
  props: Partial<{
    open: boolean
    item: QuotationItemResponseDto
    onSubmit: (itemId: string, unitPriceCents: number) => Promise<unknown>
  }> = {},
) {
  return mount(QuotationPriceOverrideModal, {
    props: {
      open: true,
      item: makeItem(),
      onSubmit: vi.fn().mockResolvedValue(undefined),
      ...props,
    },
    global: { stubs },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('QuotationPriceOverrideModal — render', () => {
  it('renders the modal with the product name and current unit price when open', () => {
    const wrapper = mountModal()

    expect(wrapper.find('[data-testid="price-override-modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Playera M')
    const currentPrice = wrapper.get('[data-testid="price-override-current-price"]')
    expect(currentPrice.text()).toContain('$150.00')
  })

  it('disables the submit button while the input is empty', () => {
    const wrapper = mountModal()

    const submit = wrapper.find('[data-testid="price-override-submit"]')
    expect((submit.element as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('QuotationPriceOverrideModal — validation', () => {
  it('shows a validation error and does NOT submit when the value is invalid', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const wrapper = mountModal({ onSubmit })

    await wrapper.get('[data-testid="price-override-input"]').setValue('0')
    await wrapper.get('form#quotation-price-override-form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-testid="price-override-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Ingresa un precio válido mayor a 0.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not render the validation error before a submit attempt', () => {
    const wrapper = mountModal()

    expect(wrapper.find('[data-testid="price-override-error"]').exists()).toBe(false)
  })
})

describe('QuotationPriceOverrideModal — submit', () => {
  it('calls onSubmit with the item id and cents on a valid submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const wrapper = mountModal({ onSubmit })

    await wrapper.get('[data-testid="price-override-input"]').setValue('199.50')
    await flushPromises()
    await wrapper.get('form#quotation-price-override-form').trigger('submit')
    await flushPromises()

    expect(onSubmit).toHaveBeenCalledWith('item-1', 19950)
  })

  it('emits update:open false after a successful submit', async () => {
    const wrapper = mountModal()

    await wrapper.get('[data-testid="price-override-input"]').setValue('300')
    await flushPromises()
    await wrapper.get('form#quotation-price-override-form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('does NOT emit update:open when the submit promise rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('boom'))
    const wrapper = mountModal({ onSubmit })

    await wrapper.get('[data-testid="price-override-input"]').setValue('300')
    await flushPromises()
    await wrapper.get('form#quotation-price-override-form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('update:open')).toBeUndefined()
    expect(wrapper.text()).toContain('No se pudo aplicar el cambio de precio. Reintenta.')
  })
})

describe('QuotationPriceOverrideModal — reset on reopen', () => {
  it('resets the price input and validation error when reopened', async () => {
    const wrapper = mountModal()

    await wrapper.get('[data-testid="price-override-input"]').setValue('0')
    await wrapper.get('form#quotation-price-override-form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[data-testid="price-override-error"]').exists()).toBe(true)

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()

    const input = wrapper.get('[data-testid="price-override-input"]')
    const element = input.element as HTMLInputElement
    const value = input.attributes('value') ?? element.value
    expect(String(value)).toBe('')
    expect(wrapper.find('[data-testid="price-override-error"]').exists()).toBe(false)
  })
})
