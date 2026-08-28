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
  // pos-sale-delivery S2 (design §6.1 / CAP-DLV-1): stub the Nuxt UI switch
  // as a checkbox input. `$attrs` is forwarded so `data-testid="delivery-toggle"`
  // (set on the real component) is queryable. The change event emits
  // `update:modelValue` with the new checked state so v-model behaves
  // identically to the production switch (boolean binding).
  USwitch: {
    props: ['modelValue', 'disabled', 'label', 'description'],
    emits: ['update:modelValue'],
    template: '<input type="checkbox" v-bind="$attrs" :checked="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
  },
  // Both `USwitch` and `Switch` keys mirror the existing UButton/Button
  // dual-stub pattern: the auto-imported form (`<USwitch>`) resolves to a
  // component whose runtime name is `Switch`, so the stub key must match
  // either form for Vue Test Utils to apply the override. Without `Switch`,
  // the real Nuxt UI Switch (a `<button>` root via reka-ui's Primitive)
  // renders and the `data-testid="delivery-toggle"` lands on that button,
  // breaking `setValue()` on what should be an `<input>` element.
  Switch: {
    props: ['modelValue', 'disabled', 'label', 'description'],
    emits: ['update:modelValue'],
    template: '<input type="checkbox" v-bind="$attrs" :checked="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
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

// pos-sale-delivery S2 (design §3 / CAP-DLV-1 idempotency requirement):
// mock the idempotency-key generator with a deterministic counter so we can
// assert both "regenerates on toggle flip" (consecutive keys differ) AND
// "stable entries keep the key stable" (consecutive keys equal). The
// production implementation calls `crypto.randomUUID()`, which is
// non-deterministic and would make the stable-key test flaky. The mock is
// reset in the S2 describe block's `beforeEach` so each test starts at 0.
let idempotencyCounter = 0
vi.mock('../../utils/idempotency.utils', () => ({
  newIdempotencyKey: () => `key-${++idempotencyCounter}`,
}))

const SHIPPING_ADDRESS_FIXTURE = {
  id: 'addr-1',
  customerId: 'cust-1',
  street: 'Av. Reforma 123',
  exteriorNumber: '123',
  interiorNumber: null,
  zipCode: '06600',
  neighborhood: 'Centro',
  municipality: 'Cuauhtémoc',
  city: 'CDMX',
  state: 'CDMX',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

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

    expect(wrapper.find('[data-testid="add-payment-entry"]').exists()).toBe(true)
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
    const custom: ActivePaymentMethodProjection = { id: UUID_A, name: 'Transferencia BBVA', category: 'transfer', subtitle: null }
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

// ─── pos-sale-delivery S2 — PaymentModal delivery toggle + idempotency + gate ──
//
// CAP-DLV-1 (specs/sales/spec.md): the "Entrega a domicilio" toggle emits
// `delivery: true` from buildPayload() when ON, omits the key when OFF, is
// gated on `shippingAddress` being present, regenerates the idempotency key
// on every flip, and resets to OFF on modal open AND on shippingAddress clear.
// The test command in tasks.md is
// `pnpm test:unit --run src/features/POS/sales/components/__tests__/PaymentModal.test.ts`.

describe('PaymentModal S2 — delivery toggle (pos-sale-delivery, CAP-DLV-1)', () => {
  beforeEach(() => {
    projectionData.value = []
    idempotencyCounter = 0
  })

  it('renders a delivery-toggle switch in a delivery-section after the due-date section', () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        shippingAddress: SHIPPING_ADDRESS_FIXTURE,
      },
      global: { stubs },
    })

    // The delivery section is a sibling of the due-date section, both inside
    // the scrollable body. We assert presence + label; the section ordering
    // matches design §1/Q1 ("immediately after the due-date section").
    expect(wrapper.find('[data-testid="delivery-section"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="delivery-toggle"]').exists()).toBe(true)
  })

  it('toggle is disabled and hint visible when shippingAddress is null', () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        shippingAddress: null,
      },
      global: { stubs },
    })

    const toggle = wrapper.get('[data-testid="delivery-toggle"]')
    expect(toggle.attributes('disabled')).toBeDefined()
    expect(wrapper.html()).toContain('asigná cliente y dirección primero')
  })

  it('toggle is enabled and hint absent when shippingAddress is present', () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        shippingAddress: SHIPPING_ADDRESS_FIXTURE,
      },
      global: { stubs },
    })

    const toggle = wrapper.get('[data-testid="delivery-toggle"]')
    expect(toggle.attributes('disabled')).toBeUndefined()
    expect(wrapper.html()).not.toContain('asigná cliente y dirección primero')
  })

  it('CTA emits request-assign-customer when toggle is gated (shippingAddress null)', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        shippingAddress: null,
      },
      global: { stubs },
    })

    await wrapper.get('[data-testid="delivery-assign-cta"]').trigger('click')
    expect(wrapper.emitted('request-assign-customer')).toBeTruthy()
    expect(wrapper.emitted('request-assign-customer')!.length).toBeGreaterThanOrEqual(1)
  })

  it('legacy branch payload carries delivery: true when toggle is ON', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-1', firstName: 'Ada', lastName: null },
        shippingAddress: SHIPPING_ADDRESS_FIXTURE,
      },
      global: { stubs },
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    // Flip the toggle ON
    await wrapper.get('[data-testid="delivery-toggle"]').setValue(true)
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    expect(submitted).toBeDefined()
    const payload = submitted!.payload as unknown as Record<string, unknown>
    expect(payload).toMatchObject({ method: 'cash', amountCents: 15000, delivery: true })
    // Multi-payment discriminator MUST stay absent
    expect(payload).not.toHaveProperty('payments')
  })

  it('multi-payment branch payload carries delivery: true when toggle is ON', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-1', firstName: 'Ada', lastName: null },
        shippingAddress: SHIPPING_ADDRESS_FIXTURE,
      },
      global: { stubs },
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-method="card_debit"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    await wrapper.get('[data-testid="payment-amount-1"]').setValue('50')
    await wrapper.get('[data-testid="payment-reference-1"]').setValue('AUTH-123')
    await wrapper.get('[data-testid="delivery-toggle"]').setValue(true)
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    expect(submitted).toBeDefined()
    const payload = submitted!.payload as unknown as Record<string, unknown> & { payments: unknown[] }
    expect(payload.delivery).toBe(true)
    expect(payload.payments).toHaveLength(2)
    // Legacy discriminants MUST stay absent
    expect(payload).not.toHaveProperty('method')
    expect(payload).not.toHaveProperty('amountCents')
  })

  it('payload omits the delivery key when toggle is OFF (legacy branch)', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-1', firstName: 'Ada', lastName: null },
        shippingAddress: SHIPPING_ADDRESS_FIXTURE,
      },
      global: { stubs },
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    // Toggle stays OFF (the default state)
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    const payload = submitted!.payload as unknown as Record<string, unknown>
    // The key MUST be absent — not just falsy — to preserve byte-identical
    // legacy charges (design §2/Q4, spec "Scenario: payload omits delivery when toggle is off").
    expect('delivery' in payload).toBe(false)
    expect(payload).toMatchObject({ method: 'cash', amountCents: 15000 })
  })

  it('payload omits the delivery key when toggle is OFF (multi-payment branch)', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-1', firstName: 'Ada', lastName: null },
        shippingAddress: SHIPPING_ADDRESS_FIXTURE,
      },
      global: { stubs },
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-method="card_debit"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    await wrapper.get('[data-testid="payment-amount-1"]').setValue('50')
    await wrapper.get('[data-testid="payment-reference-1"]').setValue('AUTH-123')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    const payload = submitted!.payload as unknown as Record<string, unknown> & { payments: unknown[] }
    expect('delivery' in payload).toBe(false)
    expect(payload.payments).toHaveLength(2)
  })

  it('modal open resets delivery to OFF (toggle flipped ON before open is reverted on next open)', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: false,
        totalCents: 15000,
        saleId: 'sale-1',
        shippingAddress: SHIPPING_ADDRESS_FIXTURE,
        customer: { id: 'c-1', firstName: 'Ada', lastName: null },
      },
      global: { stubs },
    })

    const toggle = wrapper.get('[data-testid="delivery-toggle"]')
    // Flip toggle ON before opening (a stale-ON state from a prior session)
    await toggle.setValue(true)
    await wrapper.vm.$nextTick()
    expect((toggle.element as HTMLInputElement).checked).toBe(true)

    // Open the modal — the reset-on-open watch MUST restore delivery to false
    await wrapper.setProps({ open: true })
    await wrapper.vm.$nextTick()

    expect((toggle.element as HTMLInputElement).checked).toBe(false)

    // The next submit MUST omit the delivery key (payload-level regression
    // guard — locking the "fresh modal always emits legacy charges" contract).
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    const payload = submitted!.payload as unknown as Record<string, unknown>
    expect('delivery' in payload).toBe(false)
  })

  it('toggling delivery regenerates the idempotency key (entries unchanged)', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-1', firstName: 'Ada', lastName: null },
        shippingAddress: SHIPPING_ADDRESS_FIXTURE,
      },
      global: { stubs },
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const firstKey = (wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent).idempotencyKey

    // Flip the toggle ON — the watch on [entries, delivery] MUST regenerate
    await wrapper.get('[data-testid="delivery-toggle"]').setValue(true)
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const secondKey = (wrapper.emitted('submit')?.[1]?.[0] as PaymentModalSubmitEvent).idempotencyKey

    expect(secondKey).not.toBe(firstKey)

    // Flip back to OFF — the key MUST regenerate again (every flip counts)
    await wrapper.get('[data-testid="delivery-toggle"]').setValue(false)
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const thirdKey = (wrapper.emitted('submit')?.[2]?.[0] as PaymentModalSubmitEvent).idempotencyKey

    expect(thirdKey).not.toBe(secondKey)
  })

  it('stable entries + no toggle change keeps the idempotency key stable', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-1', firstName: 'Ada', lastName: null },
        shippingAddress: SHIPPING_ADDRESS_FIXTURE,
      },
      global: { stubs },
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const firstKey = (wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent).idempotencyKey

    // No state change (no entry edit, no toggle flip) — the key MUST stay stable.
    // Asserting equality locks "no spurious regeneration on idle submits"
    // (counterpart of the regen-on-flip test above).
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const secondKey = (wrapper.emitted('submit')?.[1]?.[0] as PaymentModalSubmitEvent).idempotencyKey

    expect(secondKey).toBe(firstKey)
  })

  it('clearing shippingAddress reactively resets the toggle and disables it', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-1', firstName: 'Ada', lastName: null },
        shippingAddress: SHIPPING_ADDRESS_FIXTURE,
      },
      global: { stubs },
    })

    // Flip toggle ON while the gate is open
    const toggle = wrapper.get('[data-testid="delivery-toggle"]')
    await toggle.setValue(true)
    await wrapper.vm.$nextTick()
    expect((toggle.element as HTMLInputElement).checked).toBe(true)
    expect(toggle.attributes('disabled')).toBeUndefined()

    // Backend-driven address clear (e.g. customer reassign) → gate closes
    await wrapper.setProps({ shippingAddress: null })
    await wrapper.vm.$nextTick()

    // Gate-close watch MUST reset the toggle to OFF so a stale ON state
    // cannot leak into a subsequent buildPayload().
    expect((toggle.element as HTMLInputElement).checked).toBe(false)
    expect(toggle.attributes('disabled')).toBeDefined()
    expect(wrapper.html()).toContain('asigná cliente y dirección primero')

    // Regression: a submit AFTER the address clears MUST omit the delivery key,
    // even if the cashier never flipped the toggle back manually.
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    const payload = submitted!.payload as unknown as Record<string, unknown>
    expect('delivery' in payload).toBe(false)
  })

  // TRIANGULATE: isSubmitting also disables the toggle even when an address is present.
  // The `:disabled` expression is `!hasShippingAddress || isSubmitting`; this test
  // pins the OR semantics.
  it('toggle is also disabled while isSubmitting is true even when an address is present', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        shippingAddress: SHIPPING_ADDRESS_FIXTURE,
        isSubmitting: true,
      },
      global: { stubs },
    })

    const toggle = wrapper.get('[data-testid="delivery-toggle"]')
    expect(toggle.attributes('disabled')).toBeDefined()
    // No hint when an address IS present (gate is open); only isSubmitting.
    expect(wrapper.html()).not.toContain('asigná cliente y dirección primero')
  })

  // TRIANGULATE: when hasShippingAddress is true, the CTA MUST NOT render
  // (the disabled-state CTA only makes sense while the gate is closed).
  it('CTA is NOT rendered when shippingAddress is present', () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        shippingAddress: SHIPPING_ADDRESS_FIXTURE,
      },
      global: { stubs },
    })

    expect(wrapper.find('[data-testid="delivery-assign-cta"]').exists()).toBe(false)
  })

  // TRIANGULATE: the legacy branch with toggle ON MUST still respect a dueDate
  // when present — regression guard so `deliveryPatch` spread doesn't shadow
  // `dueDate` on either branch.
  it('legacy branch with toggle ON respects dueDate when present (deliveryPatch does not shadow)', async () => {
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
        shippingAddress: SHIPPING_ADDRESS_FIXTURE,
      },
      global: {
        stubs: { ...stubs, DateFieldPopover: dueDateStub },
      },
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100') // partial → debt + dueDate
    await wrapper.get('[data-testid="expand-due-date"]').trigger('click')
    await wrapper.get('[data-testid="due-date-input"]').setValue('2099-12-31')
    await wrapper.get('[data-testid="delivery-toggle"]').setValue(true)
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    const payload = submitted!.payload as unknown as Record<string, unknown>
    expect(payload).toMatchObject({ method: 'cash', amountCents: 10000, delivery: true, dueDate: '2099-12-31' })
  })
})
