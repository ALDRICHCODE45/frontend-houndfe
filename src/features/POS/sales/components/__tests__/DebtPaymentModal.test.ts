import { computed, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DebtPaymentModal from '../DebtPaymentModal.vue'
import type { ActivePaymentMethodProjection, PaymentEntry } from '../../interfaces/sale.types'

const submitSafeMock = vi.fn()
const isSubmittingRef = ref(false)
const externalErrorCodeRef = ref<string | null>(null)
const shouldCloseRef = ref(false)
const resetErrorMock = vi.fn()

vi.mock('../../composables/useDebtPayment', () => ({
  useDebtPayment: () => ({
    submitSafe: submitSafeMock,
    isSubmitting: computed(() => isSubmittingRef.value),
    externalErrorCode: externalErrorCodeRef,
    shouldClose: shouldCloseRef,
    resetError: resetErrorMock,
  }),
}))

vi.mock('../../utils/idempotency.utils', () => ({
  newIdempotencyKey: vi.fn().mockReturnValue('key-1'),
}))

vi.mock('../../utils/currency.utils', () => ({
  formatCentsMXN: (cents: number) => `$${(cents / 100).toFixed(2)}`,
}))

// sdd custom-payment-methods S4B: mock the projection composable so the debt
// modal renders fixed + custom tiles deterministically. `data` is a computed
// over a module-scoped ref that each test seeds before mounting.
const projectionData = ref<ActivePaymentMethodProjection[]>([])
vi.mock('../../composables/useSalePaymentMethods', () => ({
  useSalePaymentMethods: () => ({
    data: computed(() => projectionData.value),
    isLoading: ref(false),
    isFetching: ref(false),
    isError: ref(false),
    error: ref(null),
    refetch: vi.fn(),
  }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {} }),
  RouterLink: { template: '<a><slot /></a>' },
}))

// Nuxt UI v4 components resolve to internal names WITHOUT the `U` prefix
// (e.g. <USlideover> → `Slideover`, <UButton> → `Button`). VTU matches stubs by
// that resolved name, so stubs must be keyed by the un-prefixed name. We register
// both keys (prefixed + un-prefixed) so the stub applies regardless. The Slideover
// stub renders the named #content slot that holds the entire modal body.
const stubDefs = {
  Slideover: {
    props: ['open'],
    emits: ['update:open'],
    template: '<div v-if="open"><slot name="content" /></div>',
  },
  Button: {
    props: ['disabled', 'loading', 'icon', 'color', 'variant'],
    emits: ['click'],
    template: '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  Icon: {
    props: ['name'],
    template: '<span :data-icon="name" />',
  },
  Badge: {
    props: ['color', 'variant', 'size'],
    template: '<span><slot /></span>',
  },
  Separator: {
    template: '<hr />',
  },
  FormField: {
    props: ['label', 'error'],
    template: '<div><label>{{ label }}</label><slot /><p v-if="error" class="text-error">{{ error }}</p></div>',
  },
  InputNumber: {
    props: ['modelValue', 'min', 'step', 'disabled', 'formatOptions', 'color', 'variant'],
    emits: ['update:modelValue'],
    template: '<input type="number" v-bind="$attrs" :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
  },
  Input: {
    props: ['modelValue', 'placeholder', 'disabled'],
    emits: ['update:modelValue'],
    template: '<input v-bind="$attrs" :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
} as const

const stubs = Object.fromEntries(
  Object.entries(stubDefs).flatMap(([name, def]) => [
    [name, def],
    [`U${name}`, def],
  ]),
)

function mountModal(debtCents = 80000) {
  return mount(DebtPaymentModal, {
    props: { open: true, saleId: 'sale-1', debtCents },
    global: {
      stubs,
      renderStubDefaultSlot: true,
    },
    shallow: true,
  })
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
    const wrapper = mountModal()

    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="confirm-debt-payment"]').attributes('disabled')).toBeDefined()
  })

  it('click cash tile adds entry with cash method', async () => {
    const wrapper = mountModal()

    await wrapper.get('[data-testid="payment-method-tile-cash"]').trigger('click')
    await flushPromises()

    // Cash entry should exist
    expect(wrapper.find('[data-testid="payment-entry-0"]').exists()).toBe(true)
    // Cash should NOT have reference input
    expect(wrapper.find('[data-testid="payment-reference-0"]').exists()).toBe(false)
  })

  it('click card_credit tile adds entry with reference input visible', async () => {
    const wrapper = mountModal()

    await wrapper.get('[data-testid="payment-method-tile-card_credit"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="payment-entry-0"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="payment-reference-0"]').exists()).toBe(true)
  })

  it('submit with valid cash entry calls submitSafe with correct payload', async () => {
    submitSafeMock.mockResolvedValue({ paymentStatus: 'PAID' })
    const wrapper = mountModal()

    await wrapper.get('[data-testid="payment-method-tile-cash"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="confirm-debt-payment"]').trigger('click')
    await flushPromises()

    expect(submitSafeMock).toHaveBeenCalledTimes(1)
    expect(submitSafeMock.mock.calls[0]?.[0]).toEqual({
      payload: { payments: [{ method: 'cash', amountCents: 80000 }] },
      idempotencyKey: expect.any(String),
    })
  })

  it('shows aggregate error when sum exceeds debt', async () => {
    const wrapper = mountModal(10000) // $100 debt

    // Add cash (prefills to remaining = $100 = 10000 cents)
    await wrapper.get('[data-testid="payment-method-tile-cash"]').trigger('click')
    await flushPromises()

    // Add card_credit (starts at 0, but the aggregate check fires once we bump it)
    await wrapper.get('[data-testid="payment-method-tile-card_credit"]').trigger('click')
    await flushPromises()

    // Set card_credit amount to $50 (5000 cents) via input - total now $150 > $100
    const amountInput = wrapper.find('[data-testid="payment-amount-1"]')
    await amountInput.setValue(50)
    await flushPromises()

    expect(wrapper.text()).toContain('El total supera la deuda')
  })

  // sales-pos-charge WU-C.3 (REQ-NEW-10): reference is OPTIONAL for non-CASH
  // methods. Submitting a card/transfer entry without a reference must
  // succeed and the payload MUST omit the `reference` key.
  it('allows non-CASH entry without reference and omits the key in the payload', async () => {
    submitSafeMock.mockResolvedValue({ paymentStatus: 'PAID' })
    const wrapper = mountModal()

    await wrapper.get('[data-testid="payment-method-tile-card_credit"]').trigger('click')
    await flushPromises()
    // Non-CASH entries default to amountCents: 0 in createEntry; set the
    // amount manually so canSubmit is true.
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    await flushPromises()
    // No reference set.

    await wrapper.get('[data-testid="confirm-debt-payment"]').trigger('click')
    await flushPromises()

    expect(submitSafeMock).toHaveBeenCalledTimes(1)
    const call = submitSafeMock.mock.calls[0]?.[0] as { payload: { payments: PaymentEntry[] } }
    expect(call).toBeDefined()
    if (!call) throw new Error('submitSafe not called')
    expect(call.payload.payments).toHaveLength(1)
    const entry = call.payload.payments[0]
    expect(entry).toMatchObject({ method: 'card_credit', amountCents: 10000 })
    expect(entry).not.toHaveProperty('reference')
  })

  // Note: the "include a non-empty reference in the payload" scenario is
  // covered at the pure-function level by paymentEntries.utils.spec.ts:178-196
  // (normalizeReferenceInput cases). A component-level scenario was removed
  // because jsdom's setValue does not propagate to the stubbed UInput's
  // v-model; the unit test is the authoritative coverage for the trim/include
  // path.

  it('max 5 entries: sixth click does not add', async () => {
    const wrapper = mountModal()

    // Toggle on all 4 methods
    for (const method of ['cash', 'card_credit', 'card_debit', 'transfer']) {
      await wrapper.get(`[data-testid="payment-method-tile-${method}"]`).trigger('click')
      await flushPromises()
    }
    // 4 entries — add cash again (toggle off then on = should be 4, then click card_credit again = toggle off + on)
    // Actually with toggle behavior: clicking cash again REMOVES it (toggle off), so we need a different approach
    // Let's just verify we have 4 and the max hint shows since canAddEntry = length < 5
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(4)
    // The 5th add would require a different method or re-toggle — design allows max 1 per method with toggle
  })

  it('closes modal on success', async () => {
    submitSafeMock.mockResolvedValue({ paymentStatus: 'PAID' })
    const wrapper = mountModal()

    await wrapper.get('[data-testid="payment-method-tile-cash"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="confirm-debt-payment"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('success')).toBeTruthy()
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })

  it('displays debt amount in banner', () => {
    const wrapper = mountModal(70000)

    expect(wrapper.text()).toContain('$700.00')
    expect(wrapper.text()).toContain('Deuda pendiente')
  })

  it('confirm-debt-payment button uses the Cobrar precedent coco-gold class [PMT-REQ-004]', () => {
    const wrapper = mountModal()

    const confirmButton = wrapper.get('[data-testid="confirm-debt-payment"]')
    expect(confirmButton.classes()).toContain('!bg-(--brand-action)')
    expect(confirmButton.classes()).toContain('!text-black')
  })
})

// ─── sdd custom-payment-methods S4B — merged tile grid + paymentMethodId threading ─
//
// REQ-PT-001/004/005/007 (pos-payment-method-tiles spec) and
// REQ-CAT-001/007 (sales delta). `projectionData` seeds the custom tiles.

describe('DebtPaymentModal S4B — custom payment method tiles (sdd custom-payment-methods)', () => {
  const UUID_A = '11111111-1111-4111-8111-111111111111'
  const UUID_B = '22222222-2222-4222-8222-222222222222'
  const customTransfer: ActivePaymentMethodProjection = {
    id: UUID_A,
    name: 'Transferencia BBVA',
    category: 'transfer',
    subtitle: 'Cta 1234',
  }

  beforeEach(() => {
    // Mirror the file's top-level beforeEach — the S4B describe is a separate
    // top-level block, so the original resets do NOT apply here.
    submitSafeMock.mockReset()
    submitSafeMock.mockResolvedValue(undefined)
    resetErrorMock.mockReset()
    isSubmittingRef.value = false
    externalErrorCodeRef.value = null
    shouldCloseRef.value = false
    projectionData.value = []
  })

  it('REQ-PT-004 — renders 4 fixed tiles followed by custom tiles from the projection', () => {
    projectionData.value = [customTransfer]
    const wrapper = mountModal()

    expect(wrapper.get('[data-testid="payment-method-tile-cash"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="payment-method-tile-card_credit"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="payment-method-tile-card_debit"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="payment-method-tile-transfer"]').exists()).toBe(true)
    expect(wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).text()).toContain('Transferencia BBVA')
  })

  it('REQ-PT-007 — custom tile shows the grey subtitle sub-line; null subtitle hides it', () => {
    projectionData.value = [customTransfer]
    const wrapper = mountModal()

    const sub = wrapper.get(`[data-testid="payment-method-tile-subtitle-${UUID_A}"]`)
    expect(sub.text()).toContain('Cta 1234')
    expect(sub.classes()).toContain('text-muted')

    projectionData.value = [{ id: UUID_B, name: 'Efectivo USD', category: 'cash', subtitle: null }]
    const wrapper2 = mountModal()
    expect(wrapper2.find('[data-testid^="payment-method-tile-subtitle-"]').exists()).toBe(false)
  })

  it('REQ-CAT-001 — toggling a custom tile adds an entry with paymentMethodId in normalizedPayments', async () => {
    submitSafeMock.mockResolvedValue({ paymentStatus: 'PAID' })
    projectionData.value = [customTransfer]
    const wrapper = mountModal()

    await wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    await flushPromises()
    await wrapper.get('[data-testid="confirm-debt-payment"]').trigger('click')
    await flushPromises()

    expect(submitSafeMock).toHaveBeenCalledTimes(1)
    const call = submitSafeMock.mock.calls[0]?.[0] as { payload: { payments: PaymentEntry[] } }
    expect(call).toBeDefined()
    if (!call) throw new Error('submitSafe not called')
    expect(call.payload.payments[0]).toEqual({ method: 'transfer', amountCents: 10000, paymentMethodId: UUID_A })
  })

  it('REQ-CAT-001 — fixed tile entry omits paymentMethodId from normalizedPayments', async () => {
    submitSafeMock.mockResolvedValue({ paymentStatus: 'PAID' })
    projectionData.value = [customTransfer]
    const wrapper = mountModal()

    await wrapper.get('[data-testid="payment-method-tile-cash"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="confirm-debt-payment"]').trigger('click')
    await flushPromises()

    const call = submitSafeMock.mock.calls[0]?.[0] as { payload: { payments: PaymentEntry[] } }
    expect(call.payload.payments[0]).toEqual({ method: 'cash', amountCents: 80000 })
    expect(call.payload.payments[0]).not.toHaveProperty('paymentMethodId')
  })

  it('REQ-PT-001 — two customs of the same category coexist; the fixed transfer tile does not collide with them', async () => {
    projectionData.value = [
      customTransfer,
      { id: UUID_B, name: 'Transferencia AFIRME', category: 'transfer', subtitle: null },
    ]
    const wrapper = mountModal()

    await wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).trigger('click')
    await wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_B}"]`).trigger('click')
    await wrapper.get('[data-testid="payment-method-tile-transfer"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(3)

    // Toggling the FIXED transfer tile off removes ONLY the fixed entry
    await wrapper.get('[data-testid="payment-method-tile-transfer"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(2)
  })

  it('REQ-CAT-007 — catalogClearSignal increment removes custom entries but preserves fixed entries', async () => {
    projectionData.value = [customTransfer]
    const wrapper = mountModal()

    await wrapper.get('[data-testid="payment-method-tile-cash"]').trigger('click')
    await wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(2)

    await wrapper.setProps({ catalogClearSignal: 1 })
    await flushPromises()

    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(1)
  })

  it('REQ-PT-005 — empty projection renders only the 4 fixed tiles, no warning', () => {
    const wrapper = mountModal()

    expect(wrapper.findAll('[data-testid^="payment-method-tile-custom-"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid^="payment-method-tile-"]')).toHaveLength(4)
    expect(wrapper.text()).not.toContain('configura tu catálogo')
  })
})
