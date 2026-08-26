import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import PaymentModal from '../PaymentModal.vue'
import type { ActivePaymentMethodProjection, ChargeSalePayload } from '../../interfaces/sale.types'

type PaymentModalSubmitEvent = {
  saleId: string
  payload: ChargeSalePayload
  idempotencyKey: string
}

const modalStub = {
  template: '<div><slot /><slot name="content" /><slot name="body" /><slot name="footer" /></div>',
}

const buttonStub = {
  props: ['disabled', 'loading'],
  template: '<button v-bind="$attrs" :disabled="disabled"><slot name="leading" /><slot /></button>',
}

const inputNumberStub = {
  props: ['modelValue', 'disabled', 'readonly'],
  emits: ['update:modelValue'],
  template: '<input :value="modelValue" :disabled="disabled" :readonly="readonly" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
}

const inputStub = {
  props: ['modelValue', 'disabled', 'readonly'],
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" :disabled="disabled" :readonly="readonly" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

const selectStub = {
  props: ['modelValue', 'items', 'disabled'],
  emits: ['update:modelValue'],
  template:
    '<select :value="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
}

const formFieldStub = {
  props: ['label', 'help', 'error'],
  template: '<label><span>{{ label }}</span><slot /><p v-if="help">{{ help }}</p><p v-if="error">{{ error }}</p></label>',
}

const stubs = {
  UModal: modalStub,
  Modal: modalStub,
  USlideover: modalStub,
  Slideover: modalStub,
  UButton: buttonStub,
  Button: buttonStub,
  UInputNumber: inputNumberStub,
  InputNumber: inputNumberStub,
  UInput: inputStub,
  Input: inputStub,
  USelect: selectStub,
  Select: selectStub,
  UBadge: { template: '<span><slot /></span>' },
  Badge: { template: '<span><slot /></span>' },
  USeparator: { template: '<hr />' },
  Separator: { template: '<hr />' },
  UFormField: formFieldStub,
  FormField: formFieldStub,
  UIcon: { template: '<span />' },
  Icon: { template: '<span />' },
  UAlert: {
    props: ['title', 'description'],
    template: '<div role="alert"><p>{{ title }}</p><p>{{ description }}</p><slot name="actions" /></div>',
  },
  URadioGroup: {
    props: ['modelValue', 'items'],
    emits: ['update:modelValue'],
    template: '<div />',
  },
}

// sdd custom-payment-methods S4B: mock the projection composable so the modal
// renders fixed + custom tiles deterministically. `data` is a computed over a
// module-scoped ref that each test seeds before mounting (same convention as
// DebtPaymentModal.test.ts mocking useDebtPayment).
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

describe('PaymentModal', () => {
  it('opens with empty payments list (no method preselected)', () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(0)
  })

  it('clicking an unselected method tile adds it to the payments list', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    const cashButton = wrapper.get('[data-testid="add-payment-entry"]')
    await cashButton.trigger('click')

    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(1)
  })

  it('clicking a selected method tile removes it from the payments list (toggle)', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    const cashButton = wrapper.get('[data-testid="add-payment-entry"]')
    await cashButton.trigger('click')
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(1)

    // Click again to remove
    await cashButton.trigger('click')
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(0)
  })

  it('submit with empty payments + customer assigned + total > 0 → emits submit with payments: [] (allowed, all-debt)', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'customer-1', firstName: 'Test', lastName: 'Customer' }
      },
      global: { stubs },
    })

    const submitButton = wrapper.get('[data-testid="confirm-charge"]')
    await submitButton.trigger('click')

    const emitted = wrapper.emitted('submit') as PaymentModalSubmitEvent[][]
    expect(emitted).toHaveLength(1)
    expect(emitted[0]![0]!.payload.payments).toEqual([])
  })

  it('submit with empty payments + NO customer + total > 0 → blocked, alert visible with assign CTA', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: null
      },
      global: { stubs },
    })

    const submitButton = wrapper.get('[data-testid="confirm-charge"]')
    expect(submitButton.attributes('disabled')).toBeDefined() // Should be disabled

    expect(wrapper.text()).toContain('Asigna un cliente para registrar una venta con deuda')
  })

  it('submit with one method @ 0 → entry is filtered out before emit; if customer present, treated as all-debt', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'customer-1', firstName: 'Test', lastName: 'Customer' }
      },
      global: { stubs },
    })

    // Add a payment method with zero amount
    const cashButton = wrapper.get('[data-testid="add-payment-entry"]')
    await cashButton.trigger('click')

    const amountInput = wrapper.get('[data-testid="payment-amount-0"]')
    await amountInput.setValue(0)

    const submitButton = wrapper.get('[data-testid="confirm-charge"]')
    await submitButton.trigger('click')

    const emitted = wrapper.emitted('submit') as PaymentModalSubmitEvent[][]
    expect(emitted).toHaveLength(1)
    expect(emitted[0]![0]!.payload.payments).toEqual([]) // Zero amount filtered out
  })

  it('allows up to 4 payment entries (one per supported method) and toggles them on/off', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    // Each tile toggles ONE entry of its method. There are 4 supported methods.
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-method="card_credit"]').trigger('click')
    await wrapper.get('[data-method="card_debit"]').trigger('click')
    await wrapper.get('[data-method="transfer"]').trigger('click')

    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(4)
  })

  it('adds and removes payment entries via toggle on method tiles', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-method="card_debit"]').trigger('click')
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(2)

    // Click an already-selected tile to deselect it (toggle off)
    await wrapper.get('[data-method="card_debit"]').trigger('click')
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(1)
  })

  it('shows reference field only for card and transfer methods', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    // Initially no entries, so no reference fields
    expect(wrapper.find('[data-testid="payment-reference-0"]').exists()).toBe(false)

    // Click card_credit - creates entry 0 with reference field
    await wrapper.get('[data-method="card_credit"]').trigger('click')
    expect(wrapper.find('[data-testid="payment-reference-0"]').exists()).toBe(true)

    // Click transfer - creates entry 1 with reference field
    await wrapper.get('[data-method="transfer"]').trigger('click')
    expect(wrapper.find('[data-testid="payment-reference-1"]').exists()).toBe(true)
  })

  // sales-pos-charge WU-C.2 (REQ-NEW-9): reference is OPTIONAL for card and
  // transfer methods. Submitting a non-CASH entry with no reference must
  // succeed and the payload MUST omit the `reference` key so the backend
  // defaults to null on save.
  it('allows non-CASH entry without reference and omits the key in the payload', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    await wrapper.get('[data-method="card_debit"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submit = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    expect(submit).toBeDefined()
    if (!submit) throw new Error('submit event not emitted')

    const payload = submit.payload as { method: string; amountCents: number; reference?: string }
    expect(payload).toMatchObject({ method: 'card_debit', amountCents: 15000 })
    expect(payload).not.toHaveProperty('reference')
  })

  // Note: the "include a non-empty reference in the payload" scenario is
  // covered at the pure-function level by paymentEntries.utils.spec.ts:178-196
  // (normalizeReferenceInput cases). A component-level scenario was removed
  // because jsdom's setValue does not propagate to the stubbed UInput's
  // v-model; the unit test is the authoritative coverage for the trim/include
  // path.

  it('disables submit for partial payment without customer assignment', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    // Add a cash entry first
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    const confirmButton = wrapper.get('[data-testid="confirm-charge"]')
    expect(confirmButton.attributes('disabled')).toBeDefined()
    expect(wrapper.html()).toContain('Asigna un cliente para registrar una venta con deuda')
  })

  it('regenerates idempotency key when entry fields change', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    // Add a cash entry first
    await wrapper.get('[data-testid="add-payment-entry"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const firstPayload = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined

    await wrapper.get('[data-testid="payment-amount-0"]').setValue('151')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const secondPayload = wrapper.emitted('submit')?.[1]?.[0] as PaymentModalSubmitEvent | undefined

    expect(firstPayload).toBeDefined()
    expect(secondPayload).toBeDefined()
    if (!firstPayload || !secondPayload) throw new Error('Missing submit event payload')
    expect(firstPayload.idempotencyKey).not.toBe(secondPayload.idempotencyKey)
  })

  it('emits payments[] payload for multi-payment and legacy for single', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    // Add a cash entry for single payment test
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const singleSubmit = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    expect(singleSubmit).toBeDefined()
    const singlePayload = singleSubmit?.payload
    expect(singlePayload).toMatchObject({ method: 'cash', amountCents: 15000 })
    expect(singlePayload).not.toHaveProperty('payments')

    // Add a second method to make it a multi-payment (sum must equal total = $150 = 15000 cents)
    await wrapper.get('[data-method="card_debit"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('50')
    await wrapper.get('[data-testid="payment-amount-1"]').setValue('100')
    // card_debit requires reference
    await wrapper.get('[data-testid="payment-reference-1"]').setValue('AUTH-123')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const multiSubmit = wrapper.emitted('submit')?.[1]?.[0] as PaymentModalSubmitEvent | undefined
    expect(multiSubmit).toBeDefined()
    const multiPayload = multiSubmit?.payload
    expect(multiPayload).toHaveProperty('payments')
    expect(multiPayload).not.toHaveProperty('method')
    expect(multiPayload).not.toHaveProperty('amountCents')
  })

  it('renders only supported payment methods', () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    const html = wrapper.html()
    expect(html).toContain('Efectivo')
    expect(html).toContain('Tarjeta crédito')
    expect(html).toContain('Tarjeta débito')
    expect(html).toContain('Transferencia')
    expect(html).not.toContain('Crédito')
    expect(html).not.toContain('Múltiple')
  })

  it('shows partial payment guard when sum is below total', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')

    const confirmButton = wrapper.get('[data-testid="confirm-charge"]')
    expect(confirmButton.attributes('disabled')).toBeDefined()
    expect(wrapper.html()).toContain('Asigna un cliente para registrar una venta con deuda')
  })

  it('allows partial payment with customer, shows debt, and emits submit', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-1', firstName: 'Ada', lastName: null },
      },
      global: { stubs },
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    expect(wrapper.text()).toContain('Deuda a generar:')
    expect(wrapper.text()).toContain('$50.00')
    expect(wrapper.get('[data-testid="confirm-charge"]').text()).toContain('Deuda $50.00')

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeTruthy()
  })

  it('emits request-assign-customer when partial without customer clicks CTA', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    const cta = wrapper.get('[data-testid="assign-customer-cta"]')
    await cta.trigger('click')

    expect(wrapper.emitted('request-assign-customer')).toBeTruthy()
  })

  it('allows pure-credit (empty payments) when customer is assigned', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-2', firstName: 'Lin', lastName: null },
      },
      global: { stubs },
    })

    // No method selected = pure debt for the full total
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="confirm-charge"]').text()).toContain('Deuda $150.00')

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeTruthy()
  })

  it('includes optional dueDate in the charge payload when provided', async () => {
    const dueDateStub = {
      props: ['modelValue', 'placeholder', 'disabled', 'minIso', 'testid'],
      emits: ['update:modelValue'],
      template: '<input :data-testid="testid" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    }

    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-1', firstName: 'Ada', lastName: null },
      },
      global: {
        stubs: { ...stubs, DateFieldPopover: dueDateStub },
      },
    })

    // Add a partial payment (so the sale will end with debt)
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')

    // Expand the optional dueDate section
    await wrapper.get('[data-testid="expand-due-date"]').trigger('click')

    // Pick a due date far in the future (safe across clocks)
    await wrapper.get('[data-testid="due-date-input"]').setValue('2099-12-31')

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    expect(submitted).toBeDefined()
    expect(submitted?.payload).toMatchObject({ dueDate: '2099-12-31' })
  })

  it('omits dueDate from the payload when input is empty', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-1', firstName: 'Ada', lastName: null },
      },
      global: { stubs },
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    expect(submitted).toBeDefined()
    expect(submitted?.payload).not.toHaveProperty('dueDate')
  })

  it('confirm-charge button uses the Cobrar precedent coco-gold class [PMT-REQ-004]', () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    const confirmButton = wrapper.get('[data-testid="confirm-charge"]')
    expect(confirmButton.classes()).toContain('!bg-(--brand-action)')
    expect(confirmButton.classes()).toContain('!text-black')
  })

  it('selected method tile renders coco-gold tint when toggled on [PMT-REQ-002]', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    const cashTile = wrapper.get('[data-testid="add-payment-entry"]')
    await cashTile.trigger('click')

    expect(cashTile.classes()).toContain('border-coco-gold-500/40')
    expect(cashTile.classes()).toContain('bg-coco-gold-500/5')
  })
})

// ─── sdd custom-payment-methods S4B — merged tile grid + paymentMethodId threading ─
//
// REQ-PT-001/004/005/006/007 (pos-payment-method-tiles spec) and
// REQ-CAT-001/002/007 (sales delta). The projection composable is mocked above;
// `projectionData` seeds the custom tiles before each mount.

describe('PaymentModal S4B — custom payment method tiles (sdd custom-payment-methods)', () => {
  const UUID_A = '11111111-1111-4111-8111-111111111111'
  const UUID_B = '22222222-2222-4222-8222-222222222222'
  const customMercadoPago: ActivePaymentMethodProjection = {
    id: UUID_A,
    name: 'Mercado Pago',
    category: 'transfer',
    subtitle: 'Link',
  }

  beforeEach(() => {
    projectionData.value = []
  })

  function mountWithProjection(projection: ActivePaymentMethodProjection[], props: Record<string, unknown> = {}) {
    projectionData.value = projection
    return mount(PaymentModal, {
      props: { open: true, totalCents: 15000, saleId: 'sale-1', ...props },
      global: { stubs },
    })
  }

  it('REQ-PT-004 — renders 4 fixed tiles followed by custom tiles from the projection', () => {
    const wrapper = mountWithProjection([customMercadoPago])

    expect(wrapper.get('[data-testid="add-payment-entry"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="payment-method-tile-card_credit"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="payment-method-tile-card_debit"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="payment-method-tile-transfer"]').exists()).toBe(true)
    expect(
      wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).text(),
    ).toContain('Mercado Pago')
  })

  it('REQ-PT-007 — custom tile renders the grey subtitle sub-line when present', () => {
    const wrapper = mountWithProjection([customMercadoPago])

    const sub = wrapper.get(`[data-testid="payment-method-tile-subtitle-${UUID_A}"]`)
    expect(sub.text()).toContain('Link')
    expect(sub.classes()).toContain('text-muted')
  })

  it('REQ-PT-007 — null subtitle hides the sub-line', () => {
    const wrapper = mountWithProjection([{ id: UUID_B, name: 'Efectivo USD', category: 'cash', subtitle: null }])

    expect(wrapper.find('[data-testid^="payment-method-tile-subtitle-"]').exists()).toBe(false)
  })

  it('REQ-PT-007 — whitespace-only subtitle is treated as absent', () => {
    const wrapper = mountWithProjection([{ id: UUID_B, name: 'Foo', category: 'cash', subtitle: '   ' }])

    expect(wrapper.find('[data-testid^="payment-method-tile-subtitle-"]').exists()).toBe(false)
  })

  it('REQ-PT-001/REQ-CAT-001 — toggling a custom tile creates an entry carrying paymentMethodId; single-entry payload flattens with the id (REQ-CAT-002)', async () => {
    const wrapper = mountWithProjection([customMercadoPago])

    await wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).trigger('click')
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(1)

    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    expect(submitted?.payload).toEqual({
      method: 'transfer',
      amountCents: 15000,
      paymentMethodId: UUID_A,
    })
  })

  it('REQ-CAT-001 — toggling a fixed tile keeps the legacy payload byte-identical (no paymentMethodId key)', async () => {
    const wrapper = mountWithProjection([customMercadoPago])

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    expect(submitted?.payload).toEqual({ method: 'cash', amountCents: 15000 })
    expect(submitted?.payload).not.toHaveProperty('paymentMethodId')
  })

  it('REQ-PT-001 — two customs of the same category coexist and toggle independently (distinct keys)', async () => {
    const bbva: ActivePaymentMethodProjection = { id: UUID_A, name: 'Transferencia BBVA', category: 'transfer', subtitle: null }
    const afirme: ActivePaymentMethodProjection = { id: UUID_B, name: 'Transferencia AFIRME', category: 'transfer', subtitle: null }
    const wrapper = mountWithProjection([bbva, afirme])

    await wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).trigger('click')
    await wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_B}"]`).trigger('click')

    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(2)
    expect(wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).text()).toContain('1')
    expect(wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_B}"]`).text()).toContain('1')

    // Toggling BBVA off removes ONLY BBVA's entry
    await wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).trigger('click')
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(1)
  })

  it('REQ-PT-001 — a fixed tile and a custom tile of the same category do NOT collide', async () => {
    const custom = { id: UUID_A, name: 'Transferencia BBVA', category: 'transfer', subtitle: null }
    const wrapper = mountWithProjection([custom])

    // Fixed Transferencia tile
    await wrapper.get('[data-testid="payment-method-tile-transfer"]').trigger('click')
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(1)

    // Custom transfer tile — coexists with the fixed one
    await wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).trigger('click')
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(2)

    // Toggling the FIXED transfer tile off must NOT remove the custom entry
    await wrapper.get('[data-testid="payment-method-tile-transfer"]').trigger('click')
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(1)
  })

  it('REQ-PT-004 — entries list shows the catalog name for custom entries (tile-identity display)', async () => {
    const wrapper = mountWithProjection([customMercadoPago])

    await wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).trigger('click')

    expect(wrapper.get('[data-testid="payment-method-0"]').text()).toBe('Mercado Pago')
  })

  it('REQ-CAT-007 — catalogClearSignal increment removes custom entries but preserves fixed entries', async () => {
    const wrapper = mountWithProjection([customMercadoPago], { catalogClearSignal: 0 })

    await wrapper.get('[data-testid="add-payment-entry"]').trigger('click') // fixed cash
    await wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).trigger('click') // custom
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(2)

    await wrapper.setProps({ catalogClearSignal: 1 })
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="payment-method-0"]').text()).toBe('Efectivo')
  })

  it('REQ-CAT-002 — multi-payment payload carries paymentMethodId on the custom entry row (and omits it on the fixed row)', async () => {
    const wrapper = mountWithProjection([customMercadoPago])

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    await wrapper.get('[data-testid="payment-amount-1"]').setValue('50')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    const payments = (submitted?.payload as { payments: Array<{ method: string; amountCents: number; paymentMethodId?: string }> }).payments
    expect(payments).toHaveLength(2)
    expect(payments[0]).toEqual({ method: 'cash', amountCents: 10000 })
    expect(payments[1]).toEqual({ method: 'transfer', amountCents: 5000, paymentMethodId: UUID_A })
  })

  it('REQ-CAT-007 — catalogClearSignal filter regenerates the idempotency key (design §8.3)', async () => {
    // totalCents 10000 so the fixed cash entry (prefilled to the full total)
    // alone is a complete payment AFTER the custom entry is filtered — a
    // partial leftover would (correctly) block the second submit.
    const wrapper = mountWithProjection([customMercadoPago], { catalogClearSignal: 0, totalCents: 10000 })

    await wrapper.get('[data-testid="add-payment-entry"]').trigger('click')
    await wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    await wrapper.get('[data-testid="payment-amount-1"]').setValue('50')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const firstPayload = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined

    await wrapper.setProps({ catalogClearSignal: 1 })
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const secondPayload = wrapper.emitted('submit')?.[1]?.[0] as PaymentModalSubmitEvent | undefined

    expect(firstPayload).toBeDefined()
    expect(secondPayload).toBeDefined()
    if (!firstPayload || !secondPayload) throw new Error('Missing submit event payload')
    expect(firstPayload.idempotencyKey).not.toBe(secondPayload.idempotencyKey)
  })

  it('REQ-PT-005 — empty projection renders exactly the 4 fixed tiles with no warning', () => {
    const wrapper = mountWithProjection([])

    expect(wrapper.findAll('[data-testid^="payment-method-tile-custom-"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-method]')).toHaveLength(4)
    expect(wrapper.find('[data-testid="add-payment-entry"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('configura tu catálogo')
  })

  it('REQ-PT-006 — projection fetch failure (data undefined) degrades to fixed-only with no toast / no blocking alert', () => {
    projectionData.value = undefined as unknown as ActivePaymentMethodProjection[]
    const wrapper = mount(PaymentModal, {
      props: { open: true, totalCents: 15000, saleId: 'sale-1' },
      global: { stubs },
    })

    expect(wrapper.findAll('[data-method]')).toHaveLength(4)
    expect(wrapper.find('[data-testid^="payment-method-tile-custom-"]').exists()).toBe(false)
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
  })
})
