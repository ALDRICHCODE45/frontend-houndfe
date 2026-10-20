import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h, reactive, ref } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import { es } from '@nuxt/ui/locale'
import PaymentModal from '../PaymentModal.vue'
import type { ActivePaymentMethodProjection, ChargeSalePayload } from '../../interfaces/sale.types'

type PaymentModalSubmitEvent = {
  saleId: string
  payload: ChargeSalePayload
  idempotencyKey: string
}

/**
 * Read the `index`-th emitted `submit` event. Fails the test with an explicit
 * message when the modal did not emit it, so a missing event can never be
 * masked by a non-null cast. The `emitted` generic keeps the event strongly
 * typed, so callers never dereference an optional-chain result.
 */
function emittedSubmit(wrapper: ReturnType<typeof mount>, index = 0): PaymentModalSubmitEvent {
  const event = wrapper.emitted<[PaymentModalSubmitEvent]>('submit')?.[index]?.[0]
  expect(event).toBeDefined()
  if (!event) throw new Error(`Expected a 'submit' event at index ${index}`)
  return event
}

const modalStub = {
  name: 'Slideover',
  props: ['ui'],
  template: '<div><slot /><slot name="content" /><slot name="body" /><slot name="footer" /></div>',
}

const buttonStub = {
  props: ['disabled', 'loading'],
  template: '<button v-bind="$attrs" :disabled="disabled"><slot name="leading" /><slot /></button>',
}

const inputNumberStub = {
  props: ['modelValue', 'disabled', 'readonly'],
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" :disabled="disabled" :readonly="readonly" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
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
    '<select v-bind="$attrs" :value="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
}

const formFieldStub = {
  props: ['label', 'help', 'error'],
  template:
    '<label><span>{{ label }}</span><slot /><p v-if="help">{{ help }}</p><p v-if="error">{{ error }}</p></label>',
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
    template:
      '<div role="alert"><p>{{ title }}</p><p>{{ description }}</p><slot name="actions" /></div>',
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
    template:
      '<input type="checkbox" v-bind="$attrs" :checked="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
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
    template:
      '<input type="checkbox" v-bind="$attrs" :checked="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
  },
}

// T6/S3 — every mount provides the TanStack Query client because `PaymentModal`
// now consumes `useCashSaleSession`. The mocked ability defaults OFF, so the
// picker stays hidden and no session query runs in the legacy payment tests.
function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
}

const mountGlobal = {
  stubs,
  // A FRESH TanStack Query client on every mount read: the Caja binding must
  // never reuse rows cached by a previous test, so an isolated run and the
  // full-file run observe the same behaviour.
  get plugins() {
    return [[VueQueryPlugin, { queryClient: makeQueryClient() }]] as [
      typeof VueQueryPlugin,
      { queryClient: QueryClient },
    ][]
  },
}

// T6/S3 binding tests toggle this identity to grant `read:CashSession`. A stable
// function identity reads the mutable flag, mirroring the real ability store.
const cashAuth = reactive({
  accessToken: 'token-1' as string | null,
  currentTenantId: 'tenant-1',
  user: { id: 'user-1' } as { id: string } | null,
  permissionCodes: [] as string[],
  permissionsLoaded: true,
  canReadSessions: false,
  userCan: (action: string, subject: string): boolean =>
    cashAuth.canReadSessions && action === 'read' && subject === 'CashSession',
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => cashAuth }))
vi.mock('@/features/POS/cash-register/api/cash.api', () => ({
  cashApi: { listSessions: vi.fn() },
}))
import { authStorage } from '@/features/auth/services/auth-storage'
import { cashApi } from '@/features/POS/cash-register/api/cash.api'

const cashListSessions = (cashApi as unknown as { listSessions: ReturnType<typeof vi.fn> })
  .listSessions

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

describe('PaymentModal received amounts', () => {
  beforeEach(() => {
    projectionData.value = []
  })

  it.each(['cash', 'card_credit', 'card_debit', 'transfer', 'custom'])(
    'prefills %s with the sale total and submits the exact cents',
    async (method) => {
      const customId = '11111111-1111-4111-8111-111111111111'
      projectionData.value = [
        { id: customId, name: 'Mercado Pago', category: 'transfer', subtitle: null },
      ]
      const wrapper = mount(PaymentModal, {
        props: { open: true, totalCents: 45050, saleId: 'sale-1' },
        global: mountGlobal,
      })
      try {
        const selector =
          method === 'custom'
            ? `[data-testid="payment-method-tile-custom-${customId}"]`
            : `[data-method="${method}"]`
        await wrapper.get(selector).trigger('click')
        expect(
          (wrapper.get('[data-testid="payment-amount-0"]').element as HTMLInputElement).value,
        ).toBe('450.5')
        await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
        const event = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent
        expect(event.payload).toEqual({
          method: method === 'custom' ? 'transfer' : method,
          amountCents: 45050,
          ...(method === 'custom' ? { paymentMethodId: customId } : {}),
        })
      } finally {
        wrapper.unmount()
      }
    },
  )

  it.each(['cash', 'card_credit', 'card_debit', 'transfer'])(
    'parses a typed decimal with the real %s number input under Spanish app locale',
    async (method) => {
      const Host = defineComponent({
        setup: () => () =>
          h(
            UApp,
            { locale: es },
            {
              default: () => h(PaymentModal, { open: true, totalCents: 4550, saleId: 'sale-1' }),
            },
          ),
      })
      const host = mount(Host, {
        attachTo: document.body,
        global: { ...mountGlobal, stubs: { ...stubs, UInputNumber: false, InputNumber: false } },
      })
      try {
        const wrapper = host.findComponent(PaymentModal)
        await wrapper.get(`[data-method="${method}"]`).trigger('click')
        const input = wrapper.get('input[role="spinbutton"]')
        await input.setValue('45.5')
        await input.trigger('blur')
        expect((input.element as HTMLInputElement).value).toContain('45.50')
        expect(wrapper.text()).toContain('Recibido: $45.50')
        await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
        const event = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent
        expect(event.payload).toEqual({ method, amountCents: 4550 })
      } finally {
        host.unmount()
      }
    },
  )
})

describe('PaymentModal', () => {
  it('opens with empty payments list (no method preselected)', () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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
        customer: { id: 'customer-1', firstName: 'Test', lastName: 'Customer' },
      },
      global: mountGlobal,
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
        customer: null,
      },
      global: mountGlobal,
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
        customer: { id: 'customer-1', firstName: 'Test', lastName: 'Customer' },
      },
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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
      template:
        '<input :data-testid="testid" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    }

    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-1', firstName: 'Ada', lastName: null },
      },
      global: {
        ...mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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

  function mountWithProjection(
    projection: ActivePaymentMethodProjection[],
    props: Record<string, unknown> = {},
  ) {
    projectionData.value = projection
    return mount(PaymentModal, {
      props: { open: true, totalCents: 15000, saleId: 'sale-1', ...props },
      global: mountGlobal,
    })
  }

  it('REQ-PT-004 — renders 4 fixed tiles followed by custom tiles from the projection', () => {
    const wrapper = mountWithProjection([customMercadoPago])

    expect(wrapper.find('[data-testid="add-payment-entry"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="payment-method-tile-card_credit"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="payment-method-tile-card_debit"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="payment-method-tile-transfer"]').exists()).toBe(true)
    expect(wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).text()).toContain(
      'Mercado Pago',
    )
  })

  it('REQ-PT-007 — custom tile renders the grey subtitle sub-line when present', () => {
    const wrapper = mountWithProjection([customMercadoPago])

    const sub = wrapper.get(`[data-testid="payment-method-tile-subtitle-${UUID_A}"]`)
    expect(sub.text()).toContain('Link')
    expect(sub.classes()).toContain('text-muted')
  })

  it('REQ-PT-007 — null subtitle hides the sub-line', () => {
    const wrapper = mountWithProjection([
      { id: UUID_B, name: 'Efectivo USD', category: 'cash', subtitle: null },
    ])

    expect(wrapper.find('[data-testid^="payment-method-tile-subtitle-"]').exists()).toBe(false)
  })

  it('REQ-PT-007 — whitespace-only subtitle is treated as absent', () => {
    const wrapper = mountWithProjection([
      { id: UUID_B, name: 'Foo', category: 'cash', subtitle: '   ' },
    ])

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
    const bbva: ActivePaymentMethodProjection = {
      id: UUID_A,
      name: 'Transferencia BBVA',
      category: 'transfer',
      subtitle: null,
    }
    const afirme: ActivePaymentMethodProjection = {
      id: UUID_B,
      name: 'Transferencia AFIRME',
      category: 'transfer',
      subtitle: null,
    }
    const wrapper = mountWithProjection([bbva, afirme])

    await wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).trigger('click')
    await wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_B}"]`).trigger('click')

    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(2)
    expect(wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).text()).toContain(
      '1',
    )
    expect(wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_B}"]`).text()).toContain(
      '1',
    )

    // Toggling BBVA off removes ONLY BBVA's entry
    await wrapper.get(`[data-testid="payment-method-tile-custom-${UUID_A}"]`).trigger('click')
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(1)
  })

  it('REQ-PT-001 — a fixed tile and a custom tile of the same category do NOT collide', async () => {
    const custom: ActivePaymentMethodProjection = {
      id: UUID_A,
      name: 'Transferencia BBVA',
      category: 'transfer',
      subtitle: null,
    }
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

    const { payload } = emittedSubmit(wrapper)
    const payments = (
      payload as {
        payments: Array<{ method: string; amountCents: number; paymentMethodId?: string }>
      }
    ).payments
    expect(payments).toHaveLength(2)
    expect(payments[0]).toEqual({ method: 'cash', amountCents: 10000 })
    expect(payments[1]).toEqual({ method: 'transfer', amountCents: 5000, paymentMethodId: UUID_A })
  })

  it('REQ-CAT-007 — catalogClearSignal filter regenerates the idempotency key (design §8.3)', async () => {
    // totalCents 10000 so the fixed cash entry (prefilled to the full total)
    // alone is a complete payment AFTER the custom entry is filtered — a
    // partial leftover would (correctly) block the second submit.
    const wrapper = mountWithProjection([customMercadoPago], {
      catalogClearSignal: 0,
      totalCents: 10000,
    })

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
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
    })

    const toggle = wrapper.get('[data-testid="delivery-toggle"]')
    expect(toggle.attributes('disabled')).toBeUndefined()
    expect(wrapper.html()).not.toContain('asigná cliente y dirección primero')
  })

  // Backend sale shipping snapshot: a customer who deletes the address after
  // the sale leaves a complete address with `id: null`. It is still an address
  // to deliver to, so the toggle must stay available.
  it('toggle stays enabled when the snapshot address has no id', () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        shippingAddress: { ...SHIPPING_ADDRESS_FIXTURE, id: null },
      },
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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
    const payload = submitted!.payload as unknown as Record<string, unknown> & {
      payments: unknown[]
    }
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
      global: mountGlobal,
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
      global: mountGlobal,
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-method="card_debit"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    await wrapper.get('[data-testid="payment-amount-1"]').setValue('50')
    await wrapper.get('[data-testid="payment-reference-1"]').setValue('AUTH-123')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    const payload = submitted!.payload as unknown as Record<string, unknown> & {
      payments: unknown[]
    }
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
      global: mountGlobal,
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
      global: mountGlobal,
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const firstKey = emittedSubmit(wrapper, 0).idempotencyKey

    // Flip the toggle ON — the watch on [entries, delivery] MUST regenerate
    await wrapper.get('[data-testid="delivery-toggle"]').setValue(true)
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const secondKey = emittedSubmit(wrapper, 1).idempotencyKey

    expect(secondKey).not.toBe(firstKey)

    // Flip back to OFF — the key MUST regenerate again (every flip counts)
    await wrapper.get('[data-testid="delivery-toggle"]').setValue(false)
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const thirdKey = emittedSubmit(wrapper, 2).idempotencyKey

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
      global: mountGlobal,
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const firstKey = emittedSubmit(wrapper, 0).idempotencyKey

    // No state change (no entry edit, no toggle flip) — the key MUST stay stable.
    // Asserting equality locks "no spurious regeneration on idle submits"
    // (counterpart of the regen-on-flip test above).
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const secondKey = emittedSubmit(wrapper, 1).idempotencyKey

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
      global: mountGlobal,
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
      global: mountGlobal,
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
      global: mountGlobal,
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
      template:
        '<input :data-testid="testid" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
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
        ...mountGlobal,
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
    expect(payload).toMatchObject({
      method: 'cash',
      amountCents: 10000,
      delivery: true,
      dueDate: '2099-12-31',
    })
  })

  it('clips inset corners and stacks full-width actions on mobile', () => {
    const wrapper = mount(PaymentModal, {
      props: { open: true, totalCents: 15000, saleId: 'sale-1' },
      global: mountGlobal,
    })

    const slideover = wrapper.findComponent({ name: 'Slideover' })
    expect((slideover.props('ui') as { content?: string }).content).toContain('overflow-hidden')

    const actions = wrapper.get('[data-testid="payment-actions"]')
    expect(actions.classes()).toEqual(
      expect.arrayContaining(['flex-col', 'sm:flex-row', 'sm:justify-end']),
    )
    for (const button of actions.findAll('button')) {
      expect(button.classes()).toEqual(expect.arrayContaining(['w-full', 'sm:w-auto']))
    }
  })
})

// ─── PCA-2 — capacity re-quote acceptance signal ─────────────────────────────
//
// After a `PROMO_CAPACITY_RE_QUOTE` the parent refetches the draft and shows a
// separate acceptance modal. ONLY when the cashier accepts that refreshed
// quote does the parent bump `requoteAcceptSignal`; the modal must then mint a
// fresh idempotency key while preserving the entered payments. An unchanged
// retry (no signal bump, no payment edit) must keep reusing the current key.
describe('PaymentModal PCA-2 — capacity re-quote acceptance signal', () => {
  async function mountWithSingleCashEntry(signal: number) {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-1', firstName: 'Ada', lastName: null },
        requoteAcceptSignal: signal,
      },
      global: mountGlobal,
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    return wrapper
  }

  it('regenerates the idempotency key when the parent bumps requoteAcceptSignal', async () => {
    const wrapper = await mountWithSingleCashEntry(0)

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const firstKey = emittedSubmit(wrapper, 0).idempotencyKey

    // Acceptance of the refreshed quote — entries are intentionally untouched.
    await wrapper.setProps({ requoteAcceptSignal: 1 })
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const secondKey = emittedSubmit(wrapper, 1).idempotencyKey

    expect(secondKey).not.toBe(firstKey)
    // The payments the cashier entered survive the key regeneration.
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(1)
  })

  it('reuses the current key on an unchanged retry (no signal bump, no data change)', async () => {
    const wrapper = await mountWithSingleCashEntry(7)

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const firstKey = emittedSubmit(wrapper, 0).idempotencyKey

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const secondKey = emittedSubmit(wrapper, 1).idempotencyKey

    expect(secondKey).toBe(firstKey)
  })

  it('does not regenerate the key from a signal bump while the modal is closed', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: false,
        totalCents: 15000,
        saleId: 'sale-1',
        requoteAcceptSignal: 0,
      },
      global: mountGlobal,
    })

    await wrapper.setProps({ requoteAcceptSignal: 1 })
    await wrapper.vm.$nextTick()

    // Opening afterwards mints exactly one key (the open watcher), and no
    // submit fired while closed.
    await wrapper.setProps({ open: true })
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    expect(submitted?.idempotencyKey).toBeTruthy()
  })
})

// ─── T6/S3 — explicit Caja session binding (cash-register-pesos-and-sales-binding) ──
//
// The pos charge may carry an explicit `cashSessionId`. It is a shared TOP-LEVEL
// optional field on BOTH payload shapes, present ONLY when the cashier explicitly
// selected an own/OPEN session. A legacy unbound charge must omit the key entirely
// (never `null`, never an empty string), nothing is auto-selected, and a stale or
// ineligible selection is blocked instead of silently downgrading to unbound.
describe('PaymentModal T6 — explicit Caja session binding (cash-register-pesos-and-sales-binding)', () => {
  const OPEN_UUID = '11111111-1111-4111-8111-111111111111'
  const OTHER_OPEN_UUID = '22222222-2222-4222-8222-222222222222'
  const COUNTING_UUID = '33333333-3333-4333-8333-333333333333'

  function cashSession(overrides: Record<string, unknown> = {}) {
    return {
      id: OPEN_UUID,
      tenantId: 'tenant-1',
      registerId: 'r-1',
      status: 'OPEN',
      cashierUserId: 'user-1',
      openingCents: 0,
      frozenAt: null,
      drawerReleasedAt: null,
      blind: false,
      ...overrides,
    }
  }

  function enableBinding(items: unknown[] = [cashSession()], total = items.length) {
    cashAuth.canReadSessions = true
    cashAuth.permissionCodes = ['read:CashSession']
    cashListSessions.mockResolvedValue({ items, page: 1, limit: 25, total })
  }

  async function mountModal(props: Record<string, unknown> = {}) {
    const wrapper = mount(PaymentModal, {
      props: { open: true, totalCents: 15000, saleId: 'sale-1', ...props },
      global: mountGlobal,
    })
    await flushPromises()
    return wrapper
  }

  function submitPayload(wrapper: ReturnType<typeof mount>): ChargeSalePayload | undefined {
    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    return submitted?.payload
  }

  beforeEach(() => {
    cashListSessions.mockReset()
    cashAuth.canReadSessions = false
    cashAuth.permissionCodes = []
    cashAuth.permissionsLoaded = true
  })

  it('does not render the picker and never fetches without read:CashSession', async () => {
    const wrapper = await mountModal()

    expect(wrapper.find('[data-testid="cash-session-binding"]').exists()).toBe(false)
    expect(cashListSessions).not.toHaveBeenCalled()
  })

  it('legacy single-payment branch carries the explicit selected UUID at the top level', async () => {
    enableBinding()
    const wrapper = await mountModal()

    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    expect(submitPayload(wrapper)).toEqual({
      method: 'cash',
      amountCents: 15000,
      cashSessionId: OPEN_UUID,
    })
    expect(submitPayload(wrapper)).not.toHaveProperty('payments')
  })

  it('multi-payment branch carries the same top-level cashSessionId and never nests it in payments', async () => {
    enableBinding()
    const wrapper = await mountModal({
      customer: { id: 'c-1', firstName: 'Ada', lastName: null },
    })

    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-method="card_debit"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    await wrapper.get('[data-testid="payment-amount-1"]').setValue('50')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const payload = submitPayload(wrapper) as unknown as {
      payments: Array<Record<string, unknown>>
      cashSessionId?: string
    }
    expect(payload.cashSessionId).toBe(OPEN_UUID)
    expect(payload.payments).toHaveLength(2)
    for (const payment of payload.payments) {
      expect(payment).not.toHaveProperty('cashSessionId')
    }
  })

  it('legacy unbound charge omits the key entirely (no null, no empty string) even with eligible sessions visible', async () => {
    enableBinding()
    const wrapper = await mountModal()

    // The picker offers an eligible session, but nothing is auto-selected.
    expect(wrapper.find('[data-testid="cash-session-binding"]').exists()).toBe(true)
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const payload = submitPayload(wrapper) as unknown as Record<string, unknown>
    expect('cashSessionId' in payload).toBe(false)
  })

  it('offers only own/OPEN/current-tenant rows (foreign and non-OPEN are not selectable)', async () => {
    enableBinding([
      cashSession({ id: OPEN_UUID }),
      cashSession({ id: COUNTING_UUID, status: 'COUNTING' }),
      cashSession({ id: OTHER_OPEN_UUID, cashierUserId: 'other-user' }),
    ])
    const wrapper = await mountModal()

    const options = wrapper
      .get('[data-testid="cash-session-select"]')
      .findAll('option')
      .map((option) => option.attributes('value'))
    expect(options).toContain(OPEN_UUID)
    expect(options).not.toContain(COUNTING_UUID)
    expect(options).not.toContain(OTHER_OPEN_UUID)
  })

  it('blocks the charge (no submit, inline error) when the selected session is no longer eligible', async () => {
    enableBinding([cashSession({ id: OPEN_UUID })], 30)
    const wrapper = await mountModal()

    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)

    // The next page no longer exposes the selected session (backend reports it
    // as COUNTING). The selection STAYS explicit and the charge must be blocked.
    cashListSessions.mockResolvedValue({
      items: [cashSession({ id: COUNTING_UUID, status: 'COUNTING' })],
      page: 2,
      limit: 25,
      total: 30,
    })
    await wrapper.get('[data-testid="cash-session-next-page"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('ya no está disponible')
  })

  it('blocks a same-tick submit after the read ability is revoked (never emits the prior-scope charge)', async () => {
    enableBinding()
    const wrapper = await mountModal()

    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')

    // Revoke `read:CashSession` and submit in the SAME tick — no nextTick between.
    cashAuth.permissionCodes = []
    cashAuth.canReadSessions = false
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('blocks a same-tick submit after a same-principal lifecycle change', async () => {
    enableBinding()
    const wrapper = await mountModal()

    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')

    // Same user/tenant/permissions, NEW session lifecycle — the captured scope
    // no longer describes the active session, so the charge must not go out.
    authStorage.setTokens({ accessToken: 'token-2', refreshToken: 'refresh-2' })
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('mints a fresh key when the explicit binding changes (select B after submit A)', async () => {
    enableBinding([cashSession({ id: OPEN_UUID }), cashSession({ id: OTHER_OPEN_UUID })], 2)
    const wrapper = await mountModal()

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')

    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const first = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined

    await wrapper.get('[data-testid="cash-session-select"]').setValue(OTHER_OPEN_UUID)
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const second = wrapper.emitted('submit')?.[1]?.[0] as PaymentModalSubmitEvent | undefined

    expect(first).toBeDefined()
    expect(second).toBeDefined()
    if (!first || !second) throw new Error('Missing submit event payload')
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey)
    expect((second.payload as unknown as Record<string, unknown>).cashSessionId).toBe(
      OTHER_OPEN_UUID,
    )
  })

  it('reuses the key on an unchanged bound retry (same selection, no payment edit)', async () => {
    enableBinding()
    const wrapper = await mountModal()

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const first = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const second = wrapper.emitted('submit')?.[1]?.[0] as PaymentModalSubmitEvent | undefined

    expect(first).toBeDefined()
    expect(second).toBeDefined()
    if (!first || !second) throw new Error('Missing submit event payload')
    expect(second.idempotencyKey).toBe(first.idempotencyKey)
  })

  it('mints a fresh key when the binding is explicitly opted out', async () => {
    enableBinding()
    const wrapper = await mountModal()

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const first = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined

    await wrapper.get('[data-testid="cash-session-clear"]').trigger('click')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const second = wrapper.emitted('submit')?.[1]?.[0] as PaymentModalSubmitEvent | undefined

    expect(first).toBeDefined()
    expect(second).toBeDefined()
    if (!first || !second) throw new Error('Missing submit event payload')
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey)
    expect('cashSessionId' in (second.payload as unknown as Record<string, unknown>)).toBe(false)
  })

  it('mints a fresh key after a rejected bound attempt when the binding is deliberately edited', async () => {
    enableBinding([cashSession({ id: OPEN_UUID }), cashSession({ id: OTHER_OPEN_UUID })], 2)
    const wrapper = await mountModal()

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const first = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined

    // The parent surfaces the backend rejection on the same modal session.
    await wrapper.setProps({ externalError: 'Pago rechazado' })
    await wrapper.get('[data-testid="cash-session-select"]').setValue(OTHER_OPEN_UUID)
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const second = wrapper.emitted('submit')?.[1]?.[0] as PaymentModalSubmitEvent | undefined

    expect(first).toBeDefined()
    expect(second).toBeDefined()
    if (!first || !second) throw new Error('Missing submit event payload')
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey)
  })

  it('never reuses a prior key when the binding changes in the same tick as submit', async () => {
    enableBinding([cashSession({ id: OPEN_UUID }), cashSession({ id: OTHER_OPEN_UUID })], 2)
    const wrapper = await mountModal()

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const first = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined

    const select = wrapper.get('[data-testid="cash-session-select"]')
    ;(select.element as HTMLSelectElement).value = OTHER_OPEN_UUID
    const pendingChange = select.trigger('change')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    await pendingChange

    const second = wrapper.emitted('submit')?.[1]?.[0] as PaymentModalSubmitEvent | undefined
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    if (!first || !second) throw new Error('Missing submit event payload')
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey)
  })

  it('recovers from a stale-selection block by picking an eligible replacement (no payment edit, no reopen)', async () => {
    enableBinding([cashSession({ id: OPEN_UUID })], 30)
    const wrapper = await mountModal()

    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')

    // Page 2 no longer exposes the selected session, but DOES offer an eligible one.
    cashListSessions.mockResolvedValue({
      items: [cashSession({ id: OTHER_OPEN_UUID })],
      page: 2,
      limit: 25,
      total: 30,
    })
    await wrapper.get('[data-testid="cash-session-next-page"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('ya no está disponible')

    // Deliberate binding edit ONLY: the eligible replacement unblocks the charge.
    await wrapper.get('[data-testid="cash-session-select"]').setValue(OTHER_OPEN_UUID)
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    expect(submitted).toBeDefined()
    expect((submitted!.payload as unknown as Record<string, unknown>).cashSessionId).toBe(
      OTHER_OPEN_UUID,
    )
  })

  it('recovers from a stale-selection block via explicit opt-out (legacy) without editing payments', async () => {
    enableBinding([cashSession({ id: OPEN_UUID })], 30)
    const wrapper = await mountModal()

    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')

    cashListSessions.mockResolvedValue({
      items: [cashSession({ id: COUNTING_UUID, status: 'COUNTING' })],
      page: 2,
      limit: 25,
      total: 30,
    })
    await wrapper.get('[data-testid="cash-session-next-page"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()

    // Explicit opt-out is its own recovery path: legacy unbound charge goes out.
    await wrapper.get('[data-testid="cash-session-clear"]').trigger('click')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    expect(submitted).toBeDefined()
    expect('cashSessionId' in (submitted!.payload as unknown as Record<string, unknown>)).toBe(
      false,
    )
  })

  it('clears a lost binding on permission loss and offers an accessible explicit opt-out that preserves payments', async () => {
    enableBinding()
    const wrapper = await mountModal({
      customer: { id: 'c-1', firstName: 'Ada', lastName: null },
    })

    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')

    // Read permission is lost: the permission-gated picker disappears and the
    // ACTUAL selection is cleared (no old scope id remains).
    cashAuth.permissionCodes = []
    cashAuth.canReadSessions = false
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="cash-session-binding"]').exists()).toBe(false)

    // The stale-scope confirm must NOT charge implicitly unbound.
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()

    // An explicit opt-out stays reachable WITHOUT read permission.
    const optOut = wrapper.get('[data-testid="cash-session-binding-optout"]')
    await optOut.trigger('click')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    expect(submitted).toBeDefined()
    const payload = submitted!.payload as unknown as Record<string, unknown>
    expect('cashSessionId' in payload).toBe(false)
    // The payment entries are preserved (single cash entry → legacy shape).
    expect(payload).toMatchObject({ method: 'cash', amountCents: 10000 })
  })

  it('clears a lost binding when permissions become unresolved and keeps the opt-out reachable', async () => {
    enableBinding()
    const wrapper = await mountModal({
      customer: { id: 'c-1', firstName: 'Ada', lastName: null },
    })

    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')

    cashAuth.permissionsLoaded = false
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()

    await wrapper.get('[data-testid="cash-session-binding-optout"]').trigger('click')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    expect(submitted).toBeDefined()
    expect('cashSessionId' in (submitted!.payload as unknown as Record<string, unknown>)).toBe(
      false,
    )
  })

  it('does not wipe an unrelated validation error when the binding changes', async () => {
    const dueDateStub = {
      props: ['modelValue', 'placeholder', 'disabled', 'minIso', 'testid'],
      emits: ['update:modelValue'],
      template:
        '<input :data-testid="testid" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    }
    enableBinding([cashSession({ id: OPEN_UUID }), cashSession({ id: OTHER_OPEN_UUID })], 2)
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-1', firstName: 'Ada', lastName: null },
      },
      global: { ...mountGlobal, stubs: { ...stubs, DateFieldPopover: dueDateStub } },
    })
    await flushPromises()

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    await wrapper.get('[data-testid="expand-due-date"]').trigger('click')
    await wrapper.get('[data-testid="due-date-input"]').setValue('2000-01-01')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    expect(wrapper.text()).toContain('La fecha de vencimiento debe ser hoy o posterior')

    // Changing the binding must clear ONLY the binding error, never this one.
    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)
    expect(wrapper.text()).toContain('La fecha de vencimiento debe ser hoy o posterior')
  })

  it('never downgrades a bound charge to unbound when the session list errors', async () => {
    enableBinding([cashSession({ id: OPEN_UUID })], 30)
    const wrapper = await mountModal()
    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)

    // The next page fails to load: the explicit selection stays (never silently
    // dropped to unbound) and the picker surfaces the page error.
    cashListSessions.mockRejectedValue(new Error('network'))
    await wrapper.get('[data-testid="cash-session-next-page"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="cash-session-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-session-stale"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-session-clear"]').exists()).toBe(true)

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    // The unavailable page cannot revalidate the choice: the submit is blocked
    // (no unbound fallback) and the binding error explains why.
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('La sesión de caja elegida ya no está disponible')
  })

  it('keeps the peso conversion unchanged: sale $350 paid with $500 yields 35000/50000/15000 cents', async () => {
    enableBinding()
    const wrapper = await mountModal({ totalCents: 35000 })

    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('500')
    expect(wrapper.text()).toContain('Cambio:')
    expect(wrapper.text()).toContain('$150.00')

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const payload = submitPayload(wrapper) as { method: string; amountCents: number }
    expect(payload.method).toBe('cash')
    expect(payload.amountCents).toBe(50000)
  })

  it('clears the selection when the modal is reopened (a fresh modal starts unbound)', async () => {
    enableBinding()
    const wrapper = await mountModal()
    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const payload = submitPayload(wrapper) as unknown as Record<string, unknown>
    expect('cashSessionId' in payload).toBe(false)
  })

  it('clears the selection when the charged sale changes', async () => {
    enableBinding()
    const wrapper = await mountModal()
    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)

    await wrapper.setProps({ saleId: 'sale-2' })
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = emittedSubmit(wrapper)
    expect(submitted.saleId).toBe('sale-2')
    expect(submitted.payload).not.toHaveProperty('cashSessionId')
  })
})
