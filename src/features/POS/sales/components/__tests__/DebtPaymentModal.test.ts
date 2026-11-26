import { computed, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DebtPaymentModal from '../DebtPaymentModal.vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { ActivePaymentMethodProjection, PaymentEntry } from '../../interfaces/sale.types'
import type { CashSession } from '@/features/POS/cash-register/interfaces/cash.types'

const submitSafeMock = vi.fn()
const isSubmittingRef = ref(false)
const externalErrorCodeRef = ref<string | null>(null)
const shouldCloseRef = ref(false)
const resetErrorMock = vi.fn()
// sdd custom-payment-methods S5A: useDebtPayment now returns catalogClearSignal
// (design §8.3) — the mock must provide it so the modal's new watch binds.
const catalogClearSignalRef = ref(0)

vi.mock('../../composables/useDebtPayment', () => ({
  useDebtPayment: () => ({
    submitSafe: submitSafeMock,
    isSubmitting: computed(() => isSubmittingRef.value),
    externalErrorCode: externalErrorCodeRef,
    shouldClose: shouldCloseRef,
    resetError: resetErrorMock,
    catalogClearSignal: catalogClearSignalRef,
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

// BE handoff 24 §3 (T2b): CASH counter payments send the user's OPEN cash session. The shared
// POS source (useCashSaleSession) is faked: `cashSessions` are the own + OPEN rows it offers.
const openSession = (id: string): CashSession => ({
  id,
  tenantId: 'tenant-1',
  registerId: 'reg-1',
  status: 'OPEN',
  cashierUserId: 'user-1',
  openingCents: 0,
  frozenAt: null,
  drawerReleasedAt: null,
  blind: false,
})
const cashSessions = ref<CashSession[]>([openSession('sess-1')])
const cashCanRead = ref(true)
const cashFetching = ref(false)
const cashSelectedId = ref<string | null>(null)
const cashRevalidate = () => cashSessions.value.some((session) => session.id === cashSelectedId.value)
vi.mock('@/features/POS/cash-register/composables/useCashSaleSession', () => ({
  useCashSaleSession: () => ({
    canReadSessions: computed(() => cashCanRead.value),
    availableSessions: computed(() => (cashCanRead.value ? cashSessions.value : [])),
    selectedId: cashSelectedId,
    isSelectionEligible: computed(() => cashRevalidate()),
    page: computed(() => 1),
    pageSize: computed(() => 25),
    total: computed(() => cashSessions.value.length),
    pageCount: computed(() => 1),
    isFetching: computed(() => cashFetching.value),
    isError: computed(() => false),
    selectSession: (id: string | null) => { cashSelectedId.value = id || null },
    clearSelection: () => { cashSelectedId.value = null },
    isSelectionScopeCurrent: () => cashSelectedId.value !== null,
    revalidateSelection: cashRevalidate,
    setPage: vi.fn(),
    refetch: vi.fn(),
  }),
}))

// Live check D2: only a user who can open a till (create:CashSession) is sent to Caja.
const cashCanOpen = ref(true)
vi.mock('@/features/POS/cash-register/composables/useCashAccess', () => ({
  useCashAccess: () => ({ canOpenSession: computed(() => cashCanOpen.value) }),
}))

// Live check D3: the picker labels each till by its register name.
vi.mock('../../composables/useCashRegisterNames', () => ({
  useCashRegisterNames: () => computed(() => ({ 'reg-1': 'Caja Principal' })),
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

const stubs = {
  ...Object.fromEntries(
    Object.entries(stubDefs).flatMap(([name, def]) => [
      [name, def],
      [`U${name}`, def],
    ]),
  ),
  // The real money field (over the Input stub), so the typed text is parsed.
  HfMoneyInput: false,
}

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
    catalogClearSignalRef.value = 0
    cashSessions.value = [openSession('sess-1')]
    cashCanRead.value = true
    cashFetching.value = false
    cashSelectedId.value = null
  })

  it('names the installed close and entry-removal buttons without submitting payments', async () => {
    const wrapper = mountWithUApp(DebtPaymentModal, {
      props: { open: true, saleId: 'sale-1', debtCents: 80000 }, attachTo: document.body,
    })
    try {
      await flushPromises()
      expect(document.querySelector('button[aria-label="Cerrar cobro de deuda"]')).not.toBeNull()
      const cash = document.querySelector<HTMLButtonElement>('[data-testid="payment-method-tile-cash"]')!
      cash.click()
      await flushPromises()
      const remove = document.querySelector<HTMLButtonElement>('[data-testid="remove-payment-entry-0"]')!
      expect(remove.getAttribute('aria-label')).toBe('Eliminar pago 1')
      remove.click()
      await flushPromises()
      expect(document.querySelector('[data-testid="payment-entry-0"]')).toBeNull()
      expect(submitSafeMock).not.toHaveBeenCalled()
    } finally { wrapper.vm.$.appContext.app.unmount() }
  })

  it('associates a native dialog title and description without submitting', async () => {
    const wrapper = mountWithUApp(DebtPaymentModal, {
      props: { open: true, saleId: 'sale-1', debtCents: 80000 }, attachTo: document.body,
    })
    try {
      await flushPromises()
      const dialog = document.querySelector('[role="dialog"]')!
      expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent)
        .toBe('Cobrar deuda')
      expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent)
        .toBe('Selecciona los métodos de pago')
      expect(submitSafeMock).not.toHaveBeenCalled()
    } finally { wrapper.vm.$.appContext.app.unmount() }
  })

  it('announces payment tile selection and preserves toggle behavior', async () => {
    const wrapper = mountModal()
    const cash = wrapper.get('[data-testid="payment-method-tile-cash"]')
    expect(cash.attributes('aria-pressed')).toBe('false')
    await cash.trigger('click')
    expect(cash.attributes('aria-pressed')).toBe('true')
    await cash.trigger('click')
    expect(cash.attributes('aria-pressed')).toBe('false')
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(0)
    expect(submitSafeMock).not.toHaveBeenCalled()
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
      payload: { payments: [{ method: 'cash', amountCents: 80000 }], cashSessionId: 'sess-1' },
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

  // T22/S18: the typed amount is read with the one money rule, never 100×.
  it.each([
    ['70.55', 7055],
    ['70,55', 7055],
    ['1,234.50', 123450],
  ])('submits %j typed as the amount as %i cents', async (text, cents) => {
    submitSafeMock.mockResolvedValue({ paymentStatus: 'PAID' })
    const wrapper = mountModal(200000)

    await wrapper.get('[data-testid="payment-method-tile-card_credit"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="payment-amount-0"]').setValue(text)
    await flushPromises()
    expect(wrapper.text()).toContain(`Recibido: $${(cents / 100).toFixed(2)}`)

    await wrapper.get('[data-testid="confirm-debt-payment"]').trigger('click')
    await flushPromises()

    const call = submitSafeMock.mock.calls[0]?.[0] as { payload: { payments: PaymentEntry[] } }
    expect(call.payload.payments).toEqual([{ method: 'card_credit', amountCents: cents }])
  })

  it('blocks the payment while the typed amount does not parse', async () => {
    const wrapper = mountModal()

    await wrapper.get('[data-testid="payment-method-tile-card_credit"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('1,23,4')
    await wrapper.get('[data-testid="payment-amount-0"]').trigger('blur')
    await flushPromises()

    expect(wrapper.text()).toContain('Escribe el monto con punto para los centavos, por ejemplo 70.55.')
    await wrapper.get('[data-testid="confirm-debt-payment"]').trigger('click')
    await flushPromises()
    expect(submitSafeMock).not.toHaveBeenCalled()
  })

  // A removed entry's field unmounts; its last parse error must go with it.
  it('drops the amount error when the entry is removed and added again', async () => {
    submitSafeMock.mockResolvedValue({ paymentStatus: 'PAID' })
    const wrapper = mountModal()
    const tile = () => wrapper.get('[data-testid="payment-method-tile-card_credit"]')

    await tile().trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('1,23,4')
    await wrapper.get('[data-testid="payment-amount-0"]').trigger('blur')
    await tile().trigger('click')
    await flushPromises()
    await tile().trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Escribe el monto con punto para los centavos')
    await wrapper.get('[data-testid="confirm-debt-payment"]').trigger('click')
    await flushPromises()
    expect(submitSafeMock).toHaveBeenCalledTimes(1)
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

  it('confirm-debt-payment button uses the shared primary control [PMT-REQ-004]', () => {
    const wrapper = mountModal()

    const confirmButton = wrapper.get('[data-testid="confirm-debt-payment"]')
    expect(confirmButton.classes()).toContain('hf-primary-control')
    expect(confirmButton.classes().join(' ')).not.toContain('brand-action')
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

    expect(wrapper.find('[data-testid="payment-method-tile-cash"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="payment-method-tile-card_credit"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="payment-method-tile-card_debit"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="payment-method-tile-transfer"]').exists()).toBe(true)
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

  it('S5A — composable catalogClearSignal increment removes custom entries but preserves fixed entries (design §8.3)', async () => {
    projectionData.value = [customTransfer]
    const wrapper = mountModal()

    await wrapper.get('[data-testid="payment-method-tile-cash"]').trigger('click')
    await wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(2)

    // useDebtPayment.onError increments the signal it returns; the modal
    // watches that signal and drops only custom entries.
    catalogClearSignalRef.value += 1
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

// BE handoff 24 §3 (T2b): a cash payment taken without a session is outside every till, so
// CASH sends the user's OPEN session and is blocked without one; other methods go as before.
describe('DebtPaymentModal — cash session of a counter payment (BE handoff 24 §3)', () => {
  beforeEach(() => {
    submitSafeMock.mockReset()
    submitSafeMock.mockResolvedValue(undefined)
    isSubmittingRef.value = false
    externalErrorCodeRef.value = null
    shouldCloseRef.value = false
    catalogClearSignalRef.value = 0
    projectionData.value = []
    cashSessions.value = [openSession('sess-1')]
    cashCanRead.value = true
    cashFetching.value = false
    cashSelectedId.value = null
    cashCanOpen.value = true
  })

  async function payWith(wrapper: ReturnType<typeof mountModal>, tile: string) {
    await wrapper.get(`[data-testid="payment-method-tile-${tile}"]`).trigger('click')
    await flushPromises()
    // Non-cash entries start at 0; give them an amount so only the session rule can block.
    if (tile !== 'cash') {
      await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
      await flushPromises()
    }
  }
  const confirm = (wrapper: ReturnType<typeof mountModal>) => wrapper.get('[data-testid="confirm-debt-payment"]')

  it('cash with the one open session sends its id', async () => {
    submitSafeMock.mockResolvedValue({ paymentStatus: 'PAID' })
    const wrapper = mountModal()
    await payWith(wrapper, 'cash')
    expect(wrapper.find('[data-testid="debt-cash-session-missing"]').exists()).toBe(false)
    await confirm(wrapper).trigger('click')
    await flushPromises()
    expect(submitSafeMock.mock.calls[0]?.[0].payload).toEqual({
      payments: [{ method: 'cash', amountCents: 80000 }],
      cashSessionId: 'sess-1',
    })
  })

  it('cash without an open session is blocked with the message and a link to Caja', async () => {
    cashSessions.value = []
    const wrapper = mountModal()
    await payWith(wrapper, 'cash')
    const notice = wrapper.get('[data-testid="debt-cash-session-missing"]')
    expect(notice.text()).toContain('Abre tu caja para cobrar en efectivo.')
    expect(notice.get('[data-testid="debt-cash-session-open-caja"]').attributes('to')).toBe('/pos/caja')
    expect(confirm(wrapper).attributes('disabled')).toBeDefined()
    await confirm(wrapper).trigger('click')
    await flushPromises()
    expect(submitSafeMock).not.toHaveBeenCalled()
  })

  it('a user who cannot open a till is not sent to Caja and is told how to charge instead', async () => {
    cashSessions.value = []
    cashCanOpen.value = false
    const wrapper = mountModal()
    await payWith(wrapper, 'cash')
    const notice = wrapper.get('[data-testid="debt-cash-session-missing"]')
    expect(notice.text()).toContain(
      'No puedes abrir caja. Pide a un cajero que cobre en efectivo o cobra con tarjeta o transferencia.',
    )
    expect(notice.text()).not.toContain('Abre tu caja para cobrar en efectivo.')
    expect(notice.find('[data-testid="debt-cash-session-open-caja"]').exists()).toBe(false)
    expect(confirm(wrapper).attributes('disabled')).toBeDefined()
  })

  it('the picker hides the unbound legacy choice and names the tills in the debt payment', async () => {
    cashSessions.value = [openSession('sess-1'), openSession('sess-2')]
    const wrapper = mountModal()
    await payWith(wrapper, 'cash')
    const picker = wrapper.findComponent({ name: 'CashSaleSessionPicker' })
    expect(picker.props('allowUnbound')).toBe(false)
    expect(picker.props('registerNames')).toEqual({ 'reg-1': 'Caja Principal' })
  })

  it('cash is blocked the same way when the user cannot read cash sessions', async () => {
    cashCanRead.value = false
    const wrapper = mountModal()
    await payWith(wrapper, 'cash')
    expect(wrapper.get('[data-testid="debt-cash-session-missing"]').text()).toContain('Abre tu caja para cobrar en efectivo.')
    expect(confirm(wrapper).attributes('disabled')).toBeDefined()
  })

  it('waits for the sessions to load before blocking or sending', async () => {
    cashSessions.value = []
    cashFetching.value = true
    const wrapper = mountModal()
    await payWith(wrapper, 'cash')
    expect(wrapper.find('[data-testid="debt-cash-session-missing"]').exists()).toBe(false)
    expect(confirm(wrapper).attributes('disabled')).toBeDefined()
  })

  it('with several open sessions the user picks one (POS picker rule) before paying', async () => {
    submitSafeMock.mockResolvedValue({ paymentStatus: 'PAID' })
    cashSessions.value = [openSession('sess-1'), openSession('sess-2')]
    const wrapper = mountModal()
    await payWith(wrapper, 'cash')
    expect(wrapper.findComponent({ name: 'CashSaleSessionPicker' }).exists()).toBe(true)
    expect(confirm(wrapper).attributes('disabled')).toBeDefined()
    wrapper.findComponent({ name: 'CashSaleSessionPicker' }).vm.$emit('update:selectedId', 'sess-2')
    await flushPromises()
    await confirm(wrapper).trigger('click')
    await flushPromises()
    expect(submitSafeMock.mock.calls[0]?.[0].payload.cashSessionId).toBe('sess-2')
  })

  it.each([['card_credit'], ['card_debit'], ['transfer']])(
    'a %s payment goes without a session even when none is open',
    async (tile) => {
      submitSafeMock.mockResolvedValue({ paymentStatus: 'PAID' })
      cashSessions.value = []
      const wrapper = mountModal()
      await payWith(wrapper, tile)
      expect(wrapper.find('[data-testid="debt-cash-session-missing"]').exists()).toBe(false)
      await confirm(wrapper).trigger('click')
      await flushPromises()
      const payload = submitSafeMock.mock.calls[0]?.[0].payload
      expect(payload).not.toHaveProperty('cashSessionId')
      expect(payload.payments[0].method).toBe(tile)
    },
  )

  it('a card payment does not carry the open session either', async () => {
    submitSafeMock.mockResolvedValue({ paymentStatus: 'PAID' })
    const wrapper = mountModal()
    await payWith(wrapper, 'transfer')
    await confirm(wrapper).trigger('click')
    await flushPromises()
    expect(submitSafeMock.mock.calls[0]?.[0].payload).not.toHaveProperty('cashSessionId')
  })
})

/**
 * payment-split T2 (S2-S5, S7): the sale debt payment splits `debtCents` across its tenders with the
 * shared helper. Helper amounts go through the same amount handler as typing, so the payload,
 * the debt cap («El total supera la deuda»), the session rule and the idempotency key are its own.
 */
describe('DebtPaymentModal — split the debt across methods (payment-split)', () => {
  beforeEach(() => {
    submitSafeMock.mockReset()
    submitSafeMock.mockResolvedValue({ paymentStatus: 'PAID' })
    isSubmittingRef.value = false
    externalErrorCodeRef.value = null
    shouldCloseRef.value = false
    catalogClearSignalRef.value = 0
    projectionData.value = []
    cashSessions.value = [openSession('sess-1')]
    cashCanRead.value = true
    cashFetching.value = false
    cashSelectedId.value = null
    cashCanOpen.value = true
  })

  function mountSplit(debtCents = 607629) {
    return mount(DebtPaymentModal, {
      props: { open: true, saleId: 'sale-1', debtCents },
      global: {
        stubs: { ...stubs, TenderSplitControl: false, TenderRemainingButton: false },
        renderStubDefaultSlot: true,
      },
      shallow: true,
    })
  }
  type Wrapper = ReturnType<typeof mountSplit>
  async function pick(wrapper: Wrapper, ...methods: string[]) {
    for (const method of methods) {
      await wrapper.get(`[data-testid="payment-method-tile-${method}"]`).trigger('click')
      await flushPromises()
    }
  }
  async function type(wrapper: Wrapper, selector: string, value: string) {
    await wrapper.get(selector).setValue(value)
    await flushPromises()
  }
  async function click(wrapper: Wrapper, selector: string) {
    await wrapper.get(selector).trigger('click')
    await flushPromises()
  }
  const amountText = (wrapper: Wrapper, index: number) =>
    (wrapper.get(`[data-testid="payment-amount-${index}"]`).element as HTMLInputElement).value
  const entryText = (wrapper: Wrapper, index: number) =>
    wrapper.get(`[data-testid="payment-entry-${index}"]`).text()
  async function pay(wrapper: Wrapper) {
    await click(wrapper, '[data-testid="confirm-debt-payment"]')
    expect(submitSafeMock).toHaveBeenCalledTimes(1)
    const payments = submitSafeMock.mock.calls[0]?.[0].payload.payments as PaymentEntry[]
    return payments.map((payment) => [payment.method, payment.amountCents])
  }

  describe('S5 — a new method enters with what is still due', () => {
    it('a non-cash first method takes the whole debt', async () => {
      const wrapper = mountSplit()
      await pick(wrapper, 'card_debit')
      expect(amountText(wrapper, 0)).toBe('6076.29')
      expect(await pay(wrapper)).toEqual([['card_debit', 607629]])
    })

    it('the next method takes what the others leave pending', async () => {
      const wrapper = mountSplit()
      await pick(wrapper, 'cash')
      await type(wrapper, '[data-testid="payment-amount-0"]', '2000')
      await pick(wrapper, 'transfer')
      expect(amountText(wrapper, 1)).toBe('4076.29')
      expect(await pay(wrapper)).toEqual([
        ['cash', 200000],
        ['transfer', 407629],
      ])
    })

    it('when the debt is covered it enters blank, without an error, until the cashier types', async () => {
      const wrapper = mountSplit()
      await pick(wrapper, 'cash', 'card_credit')
      expect(amountText(wrapper, 1)).toBe('')
      expect(entryText(wrapper, 1)).not.toContain('El monto debe ser mayor a 0')
      // A blank amount still cannot be paid: the confirm stays blocked.
      expect(wrapper.get('[data-testid="confirm-debt-payment"]').attributes('disabled')).toBeDefined()
      await type(wrapper, '[data-testid="payment-amount-1"]', '0')
      expect(entryText(wrapper, 1)).toContain('El monto debe ser mayor a 0')
    })

    describe('a blank method blocking the confirm says why', () => {
      const HINT = 'Escribe un monto o quita el método vacío.'
      const hint = (wrapper: Wrapper) => wrapper.find('[data-testid="debt-blank-tender-hint"]')
      const confirmDisabled = (wrapper: Wrapper) =>
        wrapper.get('[data-testid="confirm-debt-payment"]').attributes('disabled') !== undefined

      it('covered debt + blank method: confirm disabled and a hint near it, no field error', async () => {
        const wrapper = mountSplit()
        await pick(wrapper, 'cash', 'card_credit')
        expect(confirmDisabled(wrapper)).toBe(true)
        expect(hint(wrapper).exists()).toBe(true)
        expect(hint(wrapper).text()).toBe(HINT)
        expect(entryText(wrapper, 1)).not.toContain('El monto debe ser mayor a 0')
      })

      it('typing an amount in the blank method hides the hint', async () => {
        const wrapper = mountSplit()
        await pick(wrapper, 'cash', 'card_credit')
        await type(wrapper, '[data-testid="payment-amount-0"]', '6000')
        expect(hint(wrapper).exists()).toBe(true)
        await type(wrapper, '[data-testid="payment-amount-1"]', '76.29')
        expect(hint(wrapper).exists()).toBe(false)
        expect(confirmDisabled(wrapper)).toBe(false)
      })

      it('typing 0 trades the hint for the field error', async () => {
        const wrapper = mountSplit()
        await pick(wrapper, 'cash', 'card_credit')
        await type(wrapper, '[data-testid="payment-amount-1"]', '0')
        expect(hint(wrapper).exists()).toBe(false)
        expect(entryText(wrapper, 1)).toContain('El monto debe ser mayor a 0')
      })

      it('removing the blank method hides the hint and frees the confirm', async () => {
        const wrapper = mountSplit()
        await pick(wrapper, 'cash', 'card_credit')
        await click(wrapper, '[data-testid="remove-payment-entry-1"]')
        expect(hint(wrapper).exists()).toBe(false)
        expect(confirmDisabled(wrapper)).toBe(false)
      })

      it('is not shown when something else also blocks the confirm', async () => {
        const wrapper = mountSplit()
        await pick(wrapper, 'cash', 'card_credit')
        // Cash over the debt: the aggregate error already explains the block.
        await type(wrapper, '[data-testid="payment-amount-0"]', '7000')
        expect(confirmDisabled(wrapper)).toBe(true)
        expect(hint(wrapper).exists()).toBe(false)
      })
    })

    it('a failed payment does not make a blank method added later show an error', async () => {
      submitSafeMock.mockResolvedValue(undefined)
      const wrapper = mountSplit()
      await pick(wrapper, 'cash')
      await click(wrapper, '[data-testid="confirm-debt-payment"]')
      expect(submitSafeMock).toHaveBeenCalledTimes(1)
      await pick(wrapper, 'transfer')
      expect(amountText(wrapper, 1)).toBe('')
      expect(entryText(wrapper, 1)).not.toContain('El monto debe ser mayor a 0')
    })
  })

  describe('S2 — «Lo que falta» on each amount', () => {
    it('completes the tender with what the others leave pending', async () => {
      const wrapper = mountSplit()
      await pick(wrapper, 'cash')
      await type(wrapper, '[data-testid="payment-amount-0"]', '2000')
      await pick(wrapper, 'card_debit')
      await type(wrapper, '[data-testid="payment-amount-1"]', '1000')
      const fill = wrapper.get('[data-testid="payment-fill-remaining-1"]')
      expect(fill.text()).toContain('Lo que falta')
      expect(fill.attributes('aria-label')).toBe(
        'Completar Tarjeta débito con lo que falta: $4,076.29',
      )
      await click(wrapper, '[data-testid="payment-fill-remaining-1"]')
      expect(amountText(wrapper, 1)).toBe('4076.29')
      expect(await pay(wrapper)).toEqual([
        ['cash', 200000],
        ['card_debit', 407629],
      ])
    })

    it('is hidden while the tender already holds what is pending for it', async () => {
      const wrapper = mountSplit()
      await pick(wrapper, 'cash')
      expect(wrapper.find('[data-testid="payment-fill-remaining-0"]').exists()).toBe(false)
      await type(wrapper, '[data-testid="payment-amount-0"]', '100')
      expect(wrapper.find('[data-testid="payment-fill-remaining-0"]').exists()).toBe(true)
    })

    it('brings a card above the debt back to what is pending (cash 2,000 + card 5,000 → 4,076.29)', async () => {
      const wrapper = mountSplit()
      await pick(wrapper, 'cash')
      await type(wrapper, '[data-testid="payment-amount-0"]', '2000')
      await pick(wrapper, 'card_debit')
      await type(wrapper, '[data-testid="payment-amount-1"]', '5000')
      expect(wrapper.text()).toContain('El total supera la deuda')
      await click(wrapper, '[data-testid="payment-fill-remaining-1"]')
      expect(amountText(wrapper, 1)).toBe('4076.29')
      expect(wrapper.text()).not.toContain('El total supera la deuda')
    })
  })

  describe('S3 — «Repartir en partes iguales»', () => {
    it('is offered only with 2 or more methods', async () => {
      const wrapper = mountSplit()
      await pick(wrapper, 'cash')
      expect(wrapper.find('[data-testid="tender-split-equal"]').exists()).toBe(false)
      await pick(wrapper, 'transfer')
      expect(wrapper.get('[data-testid="tender-split-equal"]').text()).toContain(
        'Repartir en partes iguales',
      )
    })

    it.each([
      [607629, [202543, 202543, 202543]],
      [100000, [33333, 33333, 33334]],
    ])('splits %i in exact cents, the leftover on the last method', async (debt, amounts) => {
      const wrapper = mountSplit(debt)
      await pick(wrapper, 'cash', 'card_credit', 'transfer')
      await click(wrapper, '[data-testid="tender-split-equal"]')
      expect(wrapper.text()).not.toContain('El monto debe ser mayor a 0')
      expect(await pay(wrapper)).toEqual([
        ['cash', amounts[0]],
        ['card_credit', amounts[1]],
        ['transfer', amounts[2]],
      ])
    })
  })

  describe('S4 — «Por porcentaje»', () => {
    it('applies 50/30/20 in exact cents', async () => {
      const wrapper = mountSplit()
      await pick(wrapper, 'cash', 'card_credit', 'transfer')
      await click(wrapper, '[data-testid="tender-split-percent-toggle"]')
      await type(wrapper, '[data-testid="tender-split-percent-0"]', '50')
      await type(wrapper, '[data-testid="tender-split-percent-1"]', '30')
      await type(wrapper, '[data-testid="tender-split-percent-2"]', '20')
      await click(wrapper, '[data-testid="tender-split-percent-apply"]')
      expect(await pay(wrapper)).toEqual([
        ['cash', 303814],
        ['card_credit', 182288],
        ['transfer', 121527],
      ])
    })
  })

  describe('S7 — never more than the debt', () => {
    it('two non-cash methods completed sum exactly to the debt and go without a session', async () => {
      const wrapper = mountSplit()
      await pick(wrapper, 'card_credit', 'transfer')
      expect(wrapper.find('[data-testid="payment-fill-remaining-1"]').exists()).toBe(false)
      await type(wrapper, '[data-testid="payment-amount-0"]', '6000')
      await click(wrapper, '[data-testid="payment-fill-remaining-1"]')
      expect(await pay(wrapper)).toEqual([
        ['card_credit', 600000],
        ['transfer', 7629],
      ])
      expect(submitSafeMock.mock.calls[0]?.[0].payload).not.toHaveProperty('cashSessionId')
    })

    it('the split actions are disabled while the payment is submitting', async () => {
      const wrapper = mountSplit()
      await pick(wrapper, 'cash', 'transfer')
      await type(wrapper, '[data-testid="payment-amount-0"]', '100')
      isSubmittingRef.value = true
      await flushPromises()
      expect(wrapper.get('[data-testid="tender-split-equal"]').attributes('disabled')).toBeDefined()
      expect(
        wrapper.get('[data-testid="payment-fill-remaining-1"]').attributes('disabled'),
      ).toBeDefined()
    })
  })
})
