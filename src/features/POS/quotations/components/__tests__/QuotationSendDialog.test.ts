import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import QuotationSendDialog from '../QuotationSendDialog.vue'
import type { QuotationResponseDto } from '../../interfaces/quotation.types'

// Stub Nuxt UI primitives so the test stays focused on the dialog's logic.
// UModal renders only its `#body` and `#footer` slots in jsdom — matches the
// pattern used by ItemDiscountModal / PriceOverrideModal / DueDateEditModal
// tests in the POS sales module.
const modalStub = {
  props: ['open', 'title', 'dismissible', 'close'],
  emits: ['update:open'],
  template: '<div data-testid="send-dialog-modal"><slot name="body" /><slot name="footer" /></div>',
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
  UIcon: { props: ['name'], template: '<i />' },
  Icon: { props: ['name'], template: '<i />' },
}

function makeQuotation(overrides: Partial<QuotationResponseDto> = {}): QuotationResponseDto {
  return {
    id: 'quotation-1',
    customerId: null,
    customer: null,
    globalPriceListId: null,
    priceListExplicitlySet: false,
    status: 'DRAFT',
    expiresAt: null,
    cancelReason: null,
    canceledAt: null,
    subtotalCents: 0,
    discountCents: 0,
    totalCents: 0,
    manuallyEnded: false,
    items: [],
    appliedPromotions: [],
    vetoedPromotionIds: [],
    optedInManualPromotionIds: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function mountDialog(
  props: Partial<{
    quotation: QuotationResponseDto
    open: boolean
    send: (email: boolean) => Promise<unknown>
  }> = {},
) {
  const defaultQuotation = makeQuotation({
    items: [
      {
        id: 'item-1',
        productId: 'product-1',
        variantId: null,
            productName: 'Test Product',
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
      },
    ],
    customerId: 'customer-1',
    customer: {
      id: 'customer-1',
      firstName: 'María',
      lastName: 'Pérez',
      email: 'maria@example.com',
    },
  })
  return mount(QuotationSendDialog, {
    props: {
      open: true,
      quotation: defaultQuotation,
      send: vi.fn().mockResolvedValue(undefined),
      ...props,
    },
    global: { stubs },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('QuotationSendDialog — render', () => {
  it('renders the modal with both send-mode action buttons', () => {
    const wrapper = mountDialog()

    expect(wrapper.find('[data-testid="send-dialog"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="send-by-email-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mark-as-sent-button"]').exists()).toBe(true)
  })

  it('shows the customer email when one is present', () => {
    const wrapper = mountDialog()
    expect(wrapper.text()).toContain('maria@example.com')
  })
})

describe('QuotationSendDialog — pre-validation', () => {
  it('shows a warning when the quotation has no items', () => {
    const wrapper = mountDialog({
      quotation: makeQuotation({ items: [], customer: { id: 'c1', firstName: 'A', lastName: 'B', email: 'a@b.com' } }),
    })

    expect(wrapper.find('[data-testid="no-items-warning"]').exists()).toBe(true)
  })

  it('shows a warning when the customer has no email', () => {
    const wrapper = mountDialog({
      quotation: makeQuotation({
        customerId: 'customer-1',
        customer: { id: 'customer-1', firstName: 'Sin', lastName: 'Email', email: null },
      }),
    })

    expect(wrapper.find('[data-testid="no-email-warning"]').exists()).toBe(true)
  })

  it('disables the "Enviar por email" button when no email is set', () => {
    const wrapper = mountDialog({
      quotation: makeQuotation({
        customerId: 'customer-1',
        customer: { id: 'customer-1', firstName: 'Sin', lastName: 'Email', email: null },
      }),
    })

    const button = wrapper.find('[data-testid="send-by-email-button"]')
    expect((button.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('hides both warnings when quotation has items and customer has email', () => {
    const wrapper = mountDialog()

    expect(wrapper.find('[data-testid="no-items-warning"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="no-email-warning"]').exists()).toBe(false)
  })
})

describe('QuotationSendDialog — submit handlers', () => {
  it('"Enviar por email" calls send with email=true', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const wrapper = mountDialog({ send })

    await wrapper.get('[data-testid="send-by-email-button"]').trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledWith(true)
  })

  it('"Marcar como enviado" calls send with email=false', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const wrapper = mountDialog({ send })

    await wrapper.get('[data-testid="mark-as-sent-button"]').trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledWith(false)
  })

  it('emits "sent" after a successful send', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const wrapper = mountDialog({ send })

    await wrapper.get('[data-testid="send-by-email-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('sent')).toBeDefined()
  })

  it('does NOT emit "sent" when send rejects', async () => {
    const send = vi.fn().mockRejectedValue(new Error('boom'))
    const wrapper = mountDialog({ send })

    await wrapper.get('[data-testid="send-by-email-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('sent')).toBeUndefined()
  })
})

describe('QuotationSendDialog — loading state', () => {
  it('disables both action buttons while the send promise is pending', async () => {
    let resolveSend!: () => void
    const send = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveSend = resolve }),
    )
    const wrapper = mountDialog({ send })

    await wrapper.get('[data-testid="send-by-email-button"]').trigger('click')
    await flushPromises()

    expect((wrapper.find('[data-testid="send-by-email-button"]').element as HTMLButtonElement).disabled).toBe(true)
    expect((wrapper.find('[data-testid="mark-as-sent-button"]').element as HTMLButtonElement).disabled).toBe(true)

    resolveSend()
    await flushPromises()
  })
})

describe('QuotationSendDialog — close', () => {
  it('emits "close" when the cancel button is clicked', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="send-dialog-cancel"]').trigger('click')

    expect(wrapper.emitted('close')).toBeDefined()
  })
})