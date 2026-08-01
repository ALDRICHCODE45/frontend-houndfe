import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import QuotationCancelDialog from '../QuotationCancelDialog.vue'
import type { CancelReason, QuotationResponseDto } from '../../interfaces/quotation.types'

// Stub Nuxt UI primitives so the test stays focused on the dialog's logic.
// Matches the pattern used by ItemDiscountModal / DueDateEditModal tests.
const modalStub = {
  props: ['open', 'title', 'dismissible', 'close'],
  emits: ['update:open'],
  template: '<div data-testid="cancel-dialog-modal"><slot name="body" /><slot name="footer" /></div>',
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
    cancel: (reason: CancelReason) => Promise<unknown>
  }> = {},
) {
  return mount(QuotationCancelDialog, {
    props: {
      open: true,
      quotation: makeQuotation(),
      cancel: vi.fn().mockResolvedValue(undefined),
      ...props,
    },
    global: { stubs },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('QuotationCancelDialog — render', () => {
  it('renders the modal with the four cancel-reason options', () => {
    const wrapper = mountDialog()

    expect(wrapper.find('[data-testid="cancel-dialog"]').exists()).toBe(true)
    // Each of the four reasons should appear in the DOM (input + label).
    expect(wrapper.find('[data-testid="reason-option-CUSTOMER_REQUEST"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reason-option-PRICE_OBJECTION"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reason-option-EXPIRED"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reason-option-OTHER"]').exists()).toBe(true)
  })
})

describe('QuotationCancelDialog — confirm gating', () => {
  it('disables the confirm button until a reason is selected', () => {
    const wrapper = mountDialog()

    const confirm = wrapper.find('[data-testid="cancel-dialog-confirm"]')
    expect((confirm.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables the confirm button when a reason option is checked', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="reason-option-CUSTOMER_REQUEST"]').setValue(true)
    await flushPromises()

    const confirm = wrapper.find('[data-testid="cancel-dialog-confirm"]')
    expect((confirm.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('switching reason updates which option is checked', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="reason-option-PRICE_OBJECTION"]').setValue(true)
    await flushPromises()

    const inputs = wrapper.findAll<HTMLInputElement>('input[type="radio"]')
    const checked = inputs.find((input) => input.element.checked)
    expect(checked?.attributes('data-testid')).toBe('reason-option-PRICE_OBJECTION')
  })
})

describe('QuotationCancelDialog — submit', () => {
  it('confirm calls cancel with the selected reason', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined)
    const wrapper = mountDialog({ cancel })

    await wrapper.get('[data-testid="reason-option-EXPIRED"]').setValue(true)
    await wrapper.get('[data-testid="cancel-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(cancel).toHaveBeenCalledWith('EXPIRED')
  })

  it('emits "cancelled" after a successful cancel', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="reason-option-OTHER"]').setValue(true)
    await wrapper.get('[data-testid="cancel-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('cancelled')).toBeDefined()
  })

  it('does NOT emit "cancelled" when cancel rejects', async () => {
    const cancel = vi.fn().mockRejectedValue(new Error('boom'))
    const wrapper = mountDialog({ cancel })

    await wrapper.get('[data-testid="reason-option-OTHER"]').setValue(true)
    await wrapper.get('[data-testid="cancel-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('cancelled')).toBeUndefined()
  })
})

describe('QuotationCancelDialog — loading state', () => {
  it('disables both buttons while the cancel promise is pending', async () => {
    let resolveCancel!: () => void
    const cancel = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveCancel = resolve }),
    )
    const wrapper = mountDialog({ cancel })

    await wrapper.get('[data-testid="reason-option-CUSTOMER_REQUEST"]').setValue(true)
    await wrapper.get('[data-testid="cancel-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect((wrapper.find('[data-testid="cancel-dialog-confirm"]').element as HTMLButtonElement).disabled).toBe(true)
    expect((wrapper.find('[data-testid="cancel-dialog-cancel"]').element as HTMLButtonElement).disabled).toBe(true)

    resolveCancel()
    await flushPromises()
  })
})

describe('QuotationCancelDialog — close', () => {
  it('emits "close" when the cancel button is clicked', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="cancel-dialog-cancel"]').trigger('click')

    expect(wrapper.emitted('close')).toBeDefined()
  })
})