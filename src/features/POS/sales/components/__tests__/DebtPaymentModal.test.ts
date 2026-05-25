import { computed, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DebtPaymentModal from '../DebtPaymentModal.vue'

const submitSafeMock = vi.fn()
const isSubmittingRef = ref(false)
const externalErrorCodeRef = ref<string | null>(null)
const shouldCloseRef = ref(false)
const resetErrorMock = vi.fn()

vi.mock('../../composables/useDebtPayment', () => ({
  useDebtPayment: () => ({
    submitSafe: submitSafeMock,
    isSubmitting: computed(() => isSubmittingRef.value),
    externalErrorCode: computed(() => externalErrorCodeRef.value),
    shouldClose: computed(() => shouldCloseRef.value),
    resetError: resetErrorMock,
  }),
}))

vi.mock('../../utils/idempotency.utils', () => ({
  newIdempotencyKey: vi
    .fn()
    .mockReturnValueOnce('key-1')
    .mockReturnValueOnce('key-2')
    .mockReturnValue('key-next'),
}))

const stubs = {
  USlideover: {
    props: ['open'],
    emits: ['update:open'],
    template: '<div v-if="open"><slot name="content" /></div>',
  },
  Slideover: {
    props: ['open'],
    emits: ['update:open'],
    template: '<div v-if="open"><slot name="content" /></div>',
  },
  UButton: {
    props: ['disabled', 'loading'],
    emits: ['click'],
    template: '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  Button: {
    props: ['disabled', 'loading'],
    emits: ['click'],
    template: '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  PaymentMethodTileGrid: {
    props: ['disabled', 'maxReached'],
    emits: ['select'],
    template: `
      <div>
        <button data-testid="payment-method-tile-cash" :disabled="disabled" @click="$emit('select', 'cash')">cash</button>
        <button data-testid="payment-method-tile-card_credit" :disabled="disabled" @click="$emit('select', 'card_credit')">credit</button>
        <button data-testid="payment-method-tile-card_debit" :disabled="disabled" @click="$emit('select', 'card_debit')">debit</button>
        <button data-testid="payment-method-tile-transfer" :disabled="disabled" @click="$emit('select', 'transfer')">transfer</button>
        <p v-if="maxReached">Máximo 5 pagos</p>
      </div>
    `,
  },
  PaymentEntryCard: {
    props: ['entry', 'index', 'validation'],
    emits: ['update', 'remove'],
    template: `
      <div :data-testid="'payment-entry-' + index">
        <p :data-testid="'payment-entry-method-' + index">{{ entry.method }}</p>
        <p :data-testid="'payment-entry-amount-' + index">{{ entry.amountCents }}</p>
        <input
          :data-testid="'payment-entry-amount-input-' + index"
          :value="entry.amountCents"
          @input="$emit('update', index, { amountCents: Number($event.target.value) })"
        />
        <input
          v-if="entry.method !== 'cash'"
          :data-testid="'payment-entry-reference-' + index"
          :value="entry.reference || ''"
          @input="$emit('update', index, { reference: $event.target.value })"
        />
        <p v-if="validation?.reference">{{ validation.reference }}</p>
      </div>
    `,
  },
  PaymentTotalsRow: {
    props: ['error'],
    template: '<p v-if="error" data-testid="aggregate-error">{{ error }}</p>',
  },
}

describe('DebtPaymentModal', () => {
  beforeEach(() => {
    submitSafeMock.mockReset()
    submitSafeMock.mockResolvedValue(undefined)
    resetErrorMock.mockReset()
    isSubmittingRef.value = false
    externalErrorCodeRef.value = null
    shouldCloseRef.value = false
  })

  it('opens with empty entries and submit disabled', () => {
    const wrapper = mount(DebtPaymentModal, {
      props: { open: true, saleId: 'sale-1', debtCents: 80000 },
      global: { stubs },
    })

    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="confirm-debt-payment"]').attributes('disabled')).toBeDefined()
  })

  it('click cash tile adds entry with amount = debtCents', async () => {
    const wrapper = mount(DebtPaymentModal, {
      props: { open: true, saleId: 'sale-1', debtCents: 80000 },
      global: { stubs },
    })

    await wrapper.get('[data-testid="payment-method-tile-cash"]').trigger('click')

    expect(wrapper.get('[data-testid="payment-entry-method-0"]').text()).toBe('cash')
    expect(wrapper.get('[data-testid="payment-entry-amount-0"]').text()).toBe('80000')
  })

  it('click card_credit tile adds entry with amount 0 and reference visible', async () => {
    const wrapper = mount(DebtPaymentModal, {
      props: { open: true, saleId: 'sale-1', debtCents: 80000 },
      global: { stubs },
    })

    await wrapper.get('[data-testid="payment-method-tile-card_credit"]').trigger('click')

    expect(wrapper.get('[data-testid="payment-entry-method-0"]').text()).toBe('card_credit')
    expect(wrapper.get('[data-testid="payment-entry-amount-0"]').text()).toBe('0')
    expect(wrapper.find('[data-testid="payment-entry-reference-0"]').exists()).toBe(true)
  })

  it('submit with valid entries calls submitSafe with payload', async () => {
    submitSafeMock.mockResolvedValue({ paymentStatus: 'PAID' })
    const wrapper = mount(DebtPaymentModal, {
      props: { open: true, saleId: 'sale-1', debtCents: 80000 },
      global: { stubs },
    })

    await wrapper.get('[data-testid="payment-method-tile-cash"]').trigger('click')
    await wrapper.get('[data-testid="confirm-debt-payment"]').trigger('click')

    expect(submitSafeMock).toHaveBeenCalledTimes(1)
    expect(submitSafeMock.mock.calls[0]?.[0]).toEqual({
      payload: { payments: [{ method: 'cash', amountCents: 80000 }] },
      idempotencyKey: expect.any(String),
    })
  })

  it('shows aggregate error when sum exceeds debt', async () => {
    const wrapper = mount(DebtPaymentModal, {
      props: { open: true, saleId: 'sale-1', debtCents: 80000 },
      global: { stubs },
    })

    await wrapper.get('[data-testid="payment-method-tile-cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-method-tile-card_credit"]').trigger('click')
    await wrapper.get('[data-testid="payment-entry-amount-input-1"]').setValue('1')
    await wrapper.get('[data-testid="payment-entry-reference-1"]').setValue('ABC')
    expect(wrapper.get('[data-testid="aggregate-error"]').text()).toContain('El total supera la deuda')
  })

  it('shows reference error for non-cash with empty reference', async () => {
    const wrapper = mount(DebtPaymentModal, {
      props: { open: true, saleId: 'sale-1', debtCents: 80000 },
      global: { stubs },
    })

    await wrapper.get('[data-testid="payment-method-tile-card_credit"]').trigger('click')
    expect(wrapper.text()).toContain('La referencia es obligatoria')
    expect(wrapper.get('[data-testid="confirm-debt-payment"]').attributes('disabled')).toBeDefined()
  })

  it('max 5 entries: sixth click does nothing', async () => {
    const wrapper = mount(DebtPaymentModal, {
      props: { open: true, saleId: 'sale-1', debtCents: 80000 },
      global: { stubs },
    })

    for (let i = 0; i < 6; i += 1) {
      await wrapper.get('[data-testid="payment-method-tile-card_credit"]').trigger('click')
    }

    expect(wrapper.findAll('[data-testid^="payment-entry-method-"]')).toHaveLength(5)
  })

  it('closes modal on success', async () => {
    submitSafeMock.mockResolvedValue({ paymentStatus: 'PAID' })
    const wrapper = mount(DebtPaymentModal, {
      props: { open: true, saleId: 'sale-1', debtCents: 80000 },
      global: { stubs },
    })

    await wrapper.get('[data-testid="payment-method-tile-cash"]').trigger('click')
    await wrapper.get('[data-testid="confirm-debt-payment"]').trigger('click')

    expect(wrapper.emitted('success')).toBeTruthy()
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })
})
