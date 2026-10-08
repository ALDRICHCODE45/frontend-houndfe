// EligibleSalesPicker.spec.ts — STRICT-TDD tests for the T3 advanced
// create-route sale selector (S3) + inline create-conflict UX (S2).
//
// Contract under test (backend GET /delivery-routes/eligible-sales):
//   - Server search (input) + server pagination (prev/next + range).
//   - Row labels: PRIMARY = client name + address (label/street);
//     SECONDARY = folio / date / amount / product summary.
//   - Unavailable rows rendered DISABLED with a reason (never selectable).
//   - Selection + its labels are RETAINED across search and page changes.
//   - Inline conflict alert (folios) with a refresh action; the selection is
//     NEVER silently removed.
//
// The REAL picker + REAL useEligibleSales run against a mocked HTTP layer, so
// the spec exercises the component/composable contract end to end.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref, type Ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import EligibleSalesPicker from '../EligibleSalesPicker.vue'
import { useAppendDeliveryRouteStop } from '../../composables/useAppendDeliveryRouteStop'
import { eligibleSalesQueryKeys } from '../../composables/useEligibleSales'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import type { EligibleSaleRow, EligibleSalesResponse } from '../../interfaces/eligible-sales.types'

const { getMock, postMock, tenantIdRef } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  tenantIdRef: { value: 'tenant-1' },
}))

vi.mock('@/core/shared/api/http', () => ({ http: { get: getMock, post: postMock } }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: tenantIdRef.value }),
}))

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

// ── Nuxt UI stubs: deterministic, slot/attr-preserving primitives ─────────────
const UInputStub = defineComponent({
  name: 'UInput',
  props: { modelValue: { type: String, default: '' }, disabled: Boolean },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        value: props.modelValue,
        disabled: props.disabled,
        onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value),
      })
  },
})

const UCheckboxStub = defineComponent({
  name: 'UCheckbox',
  props: { modelValue: { type: Boolean, default: false }, disabled: Boolean },
  emits: ['update:modelValue'],
  setup(props, { emit, attrs }) {
    return () =>
      h('input', {
        type: 'checkbox',
        checked: props.modelValue,
        disabled: props.disabled,
        'aria-checked': String(props.modelValue),
        ...attrs,
        onChange: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).checked),
      })
  },
})

const UButtonStub = defineComponent({
  name: 'UButton',
  props: { label: { type: String, default: '' }, disabled: Boolean, type: String },
  emits: ['click'],
  setup(props, { emit, attrs }) {
    return () =>
      h(
        'button',
        {
          type: 'button',
          disabled: props.disabled,
          ...attrs,
          onClick: () => emit('click'),
        },
        props.label || undefined,
      )
  },
})

const UAlertStub = defineComponent({
  name: 'UAlert',
  props: { title: String, description: String },
  setup(props) {
    return () => h('div', { 'data-testid': 'ualert-stub' }, [props.description])
  },
})

const stubs = {
  UInput: UInputStub,
  Input: UInputStub,
  UCheckbox: UCheckboxStub,
  Checkbox: UCheckboxStub,
  UButton: UButtonStub,
  Button: UButtonStub,
  UAlert: UAlertStub,
  Alert: UAlertStub,
  UBadge: { template: '<span><slot /></span>', props: ['color', 'variant', 'size'] },
  Badge: { template: '<span><slot /></span>' },
  UIcon: { template: '<span />' },
  Icon: { template: '<span />' },
}

function makeAddress(overrides: Partial<EligibleSaleRow['shippingAddress']> = {}) {
  return {
    id: 'addr-1',
    label: 'Casa',
    street: 'Av. Reforma',
    exteriorNumber: '10',
    interiorNumber: null,
    neighborhood: 'Centro',
    municipality: 'Cuauhtémoc',
    city: 'CDMX',
    state: 'CDMX',
    zipCode: '06000',
    ...overrides,
  }
}

function makeRow(overrides: Partial<EligibleSaleRow> = {}): EligibleSaleRow {
  return {
    id: 'sale-1',
    folio: 'A-202610-000003',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    deliveryStatus: 'PENDING',
    totalCents: 127000,
    debtCents: 0,
    confirmedAt: '2026-10-07T15:37:46.000Z',
    dueDate: null,
    customer: { id: 'cust-1', name: 'Cliente A' },
    shippingAddress: makeAddress(),
    productSummary: ['Cemento 50kg', 'Varilla 3/8'],
    availability: { state: 'AVAILABLE' },
    ...overrides,
  }
}

function makeResponse(
  rows: EligibleSaleRow[] = [makeRow()],
  pagination: Partial<EligibleSalesResponse['pagination']> = {},
): EligibleSalesResponse {
  return {
    data: rows,
    pagination: { page: 1, limit: 20, total: rows.length, totalPages: 1, ...pagination },
  }
}

type HostProps = Record<string, unknown>

const wrappers: VueWrapper[] = []

function mountPicker(props: HostProps = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, retryDelay: 0 } },
  })
  const selected = ref<readonly string[]>((props.modelValue as readonly string[]) ?? [])
  // Reactive so a test can change conflictAttempt/conflictSaleIds after mount.
  const liveProps = reactive<HostProps>({ ...props })
  const Host = defineComponent({
    components: { EligibleSalesPicker },
    setup() {
      return () =>
        h(EligibleSalesPicker, {
          ...liveProps,
          modelValue: selected.value,
          'onUpdate:modelValue': (v: string[]) => { selected.value = v },
          'onUpdate:selected': (v: string[]) => { selected.value = v },
        })
    },
  })
  const wrapper = mount(Host, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]], stubs },
  })
  wrappers.push(wrapper)
  return { picker: wrapper.findComponent(EligibleSalesPicker), wrapper, selected, props: liveProps }
}

async function settle(assertion: () => void) {
  await vi.waitFor(assertion)
  await nextTick()
}

// ── Legacy (append) fixtures: a ConfirmedSaleRow has NO availability field. ───
function makeLegacyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sale-1',
    folio: 'A-202610-000003',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    deliveryStatus: 'PENDING',
    totalCents: 127000,
    debtCents: 0,
    confirmedAt: '2026-10-07T15:37:46.000Z',
    dueDate: null,
    customer: { id: 'cust-1', name: 'Cliente A' },
    cashier: { id: 'u1', name: 'Caja' },
    seller: null,
    paymentMethods: [],
    ...overrides,
  }
}

function makeLegacyResponse(rows: Array<Record<string, unknown>> = [makeLegacyRow()]) {
  return {
    data: rows,
    pagination: { page: 1, limit: 20, total: rows.length, totalPages: 1 },
    counts: { all: rows.length, pendingPayments: 0, notDelivered: 0 },
    summary: { salesCount: rows.length, totalSoldCents: 0, outstandingDebtCents: 0 },
  }
}

function lastValidity(picker: VueWrapper) {
  const ev = picker.emitted('update:validity') as Array<[unknown]> | undefined
  return (ev?.[ev.length - 1]?.[0] ?? { valid: true, invalidSaleIds: [] }) as {
    valid: boolean
    invalidSaleIds: string[]
  }
}

/**
 * Shared-picker integration host: the REAL EligibleSalesPicker in append mode
 * plus the REAL useAppendDeliveryRouteStop. Used to prove the append consumer
 * keeps the legacy confirmed-sales permission path and that a successful append
 * invalidates the new eligible-sales prefix AND refetches the legacy list.
 */
function mountAppendIntegration() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, retryDelay: 0 } },
  })
  const selected = ref<readonly string[]>([])
  const Host = defineComponent({
    components: { EligibleSalesPicker },
    setup() {
      const { mutateAsync } = useAppendDeliveryRouteStop()
      async function doAppend(): Promise<void> {
        await mutateAsync({ id: 'route-1', payload: { saleId: selected.value[0]! } })
      }
      return () =>
        h('div', [
          h(EligibleSalesPicker, {
            source: 'append',
            modelValue: selected.value,
            'onUpdate:modelValue': (v: string[]) => { selected.value = v },
          }),
          h('button', { 'data-testid': 'integration-append', onClick: doAppend }, 'append'),
        ])
    },
  })
  const wrapper = mount(Host, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]], stubs },
  })
  wrappers.push(wrapper)
  return { wrapper, selected, queryClient }
}

beforeEach(() => {
  getMock.mockReset()
  getMock.mockResolvedValue({ data: makeResponse() })
  tenantIdRef.value = 'tenant-1'
})

afterEach(() => {
  while (wrappers.length) wrappers.pop()?.unmount()
})

describe('EligibleSalesPicker — rich row labels (S3)', () => {
  it('renders the client name + address as the PRIMARY label', async () => {
    const { wrapper } = mountPicker()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    const primary = wrapper.find('[data-testid="eligible-sales-picker-row-primary-sale-1"]')
    expect(primary.text()).toContain('Cliente A')
    expect(primary.text()).toContain('Av. Reforma')
    expect(primary.text()).toContain('Casa')
  })

  it('renders folio, amount, date and product summary as the SECONDARY label', async () => {
    const { wrapper } = mountPicker()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    const secondary = wrapper.find('[data-testid="eligible-sales-picker-row-secondary-sale-1"]')
    expect(secondary.text()).toContain('A-202610-000003')
    expect(secondary.text()).toContain('$1,270.00')
    expect(secondary.text()).toContain('Cemento 50kg')
    expect(secondary.text()).toContain('Varilla 3/8')
    // A date string in dd/mm/yyyy form (es-MX).
    expect(secondary.text()).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('falls back to "Cliente sin nombre" / "Sin dirección registrada" when absent', async () => {
    getMock.mockResolvedValue({
      data: makeResponse([makeRow({ id: 'sale-2', customer: null, shippingAddress: null })]),
    })
    const { wrapper } = mountPicker()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-2"]').exists()).toBe(true))
    const primary = wrapper.find('[data-testid="eligible-sales-picker-row-primary-sale-2"]')
    expect(primary.text()).toContain('Cliente sin nombre')
    expect(primary.text()).toContain('Sin dirección registrada')
  })
})

describe('EligibleSalesPicker — unavailable rows are disabled with a reason', () => {
  it('disables an OCCUPIED row and shows the route-occupancy reason', async () => {
    getMock.mockResolvedValue({
      data: makeResponse([
        makeRow({
          id: 'sale-occupied',
          availability: {
            state: 'OCCUPIED',
            reason: 'RESERVED_BY_ROUTE',
            occupiedRoute: { id: 'route-2', status: 'ACTIVE' },
          },
        }),
      ]),
    })
    const { wrapper } = mountPicker()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-occupied"]').exists()).toBe(true))

    const checkbox = wrapper.find('[data-testid="eligible-sales-picker-row-checkbox-sale-occupied"]')
    expect(checkbox.attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="eligible-sales-picker-row-toggle-sale-occupied"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="eligible-sales-picker-row-reason-sale-occupied"]').text()).toBeTruthy()
  })

  it('explains INELIGIBLE reasons (missing address / delivery status)', async () => {
    getMock.mockResolvedValue({
      data: makeResponse([
        makeRow({ id: 'sale-no-address', availability: { state: 'INELIGIBLE', reason: 'MISSING_ADDRESS' } }),
        makeRow({ id: 'sale-bad-status', availability: { state: 'INELIGIBLE', reason: 'DELIVERY_STATUS' } }),
      ]),
    })
    const { wrapper } = mountPicker()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-no-address"]').exists()).toBe(true))
    expect(wrapper.find('[data-testid="eligible-sales-picker-row-reason-sale-no-address"]').text()).toMatch(/dirección/i)
    expect(wrapper.find('[data-testid="eligible-sales-picker-row-reason-sale-bad-status"]').text()).toMatch(/entrega/i)
  })

  it('never emits a selection when an unavailable row is activated', async () => {
    getMock.mockResolvedValue({
      data: makeResponse([
        makeRow({ id: 'sale-occupied', availability: { state: 'OCCUPIED', reason: 'RESERVED_BY_ROUTE', occupiedRoute: null } }),
      ]),
    })
    const { picker, wrapper } = mountPicker()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-occupied"]').exists()).toBe(true))

    await wrapper.find('[data-testid="eligible-sales-picker-row-checkbox-sale-occupied"]').trigger('change')
    await wrapper.find('[data-testid="eligible-sales-picker-row-toggle-sale-occupied"]').trigger('click')
    await nextTick()
    expect(picker.emitted('update:selected')).toBeFalsy()
    expect(picker.emitted('update:modelValue')).toBeFalsy()
  })
})

describe('EligibleSalesPicker — selection + emit contract', () => {
  it('emits the sale id when an available row is toggled on', async () => {
    const { picker, wrapper, selected } = mountPicker()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))

    await wrapper.find('[data-testid="eligible-sales-picker-row-toggle-sale-1"]').trigger('click')
    await nextTick()
    expect(selected.value).toEqual(['sale-1'])
    expect(picker.emitted('update:selected')![0]).toEqual([['sale-1']])
  })

  it('removes the id when a selected available row is toggled off', async () => {
    const { selected, wrapper } = mountPicker({ modelValue: ['sale-1'] })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    await wrapper.find('[data-testid="eligible-sales-picker-row-toggle-sale-1"]').trigger('click')
    await nextTick()
    expect(selected.value).toEqual([])
  })

  it('renders a chip per selected sale and removes it via the chip clear button', async () => {
    const { selected, wrapper } = mountPicker({ modelValue: ['sale-1'] })
    // Wait for the row to load so the retained snapshot resolves the folio label.
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    expect(wrapper.find('[data-testid="eligible-sales-picker-chip-sale-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="eligible-sales-picker-chip-label-sale-1"]').text()).toContain('A-202610-000003')

    await wrapper.find('[data-testid="eligible-sales-picker-chip-clear-sale-1"]').trigger('click')
    await nextTick()
    expect(selected.value).toEqual([])
  })
})

describe('EligibleSalesPicker — server search', () => {
  it('re-queries the server with the typed query (q param)', async () => {
    const { wrapper } = mountPicker()
    await settle(() => expect(getMock).toHaveBeenCalledTimes(1))

    await wrapper.find('[data-testid="eligible-sales-picker-search"] input').setValue('Reforma')
    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(2))
    const [, config] = getMock.mock.calls[1] as [string, { params: Record<string, unknown> }]
    expect(config.params).toMatchObject({ q: 'Reforma', page: 1 })
  })

  it('renders a no-results message when the server returns zero rows for a query', async () => {
    getMock.mockResolvedValueOnce({ data: makeResponse([makeRow()]) })
    getMock.mockResolvedValue({ data: makeResponse([], { total: 0, totalPages: 0 }) })
    const { wrapper } = mountPicker()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))

    await wrapper.find('[data-testid="eligible-sales-picker-search"] input').setValue('zzz')
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-no-results"]').exists()).toBe(true))
  })
})

describe('EligibleSalesPicker — server pagination', () => {
  it('renders the range + pagination controls and requests the next page', async () => {
    getMock.mockResolvedValue({
      data: makeResponse([makeRow()], { page: 1, limit: 20, total: 45, totalPages: 3 }),
    })
    const { wrapper } = mountPicker()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-pagination"]').exists()).toBe(true))
    expect(wrapper.find('[data-testid="eligible-sales-picker-pagination-range"]').text()).toContain('45')

    await wrapper.find('[data-testid="eligible-sales-picker-pagination-next"]').trigger('click')
    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(2))
    const [, config] = getMock.mock.calls[1] as [string, { params: Record<string, unknown> }]
    expect(config.params).toMatchObject({ page: 2 })
  })

  it('does not render pagination controls on a single page', async () => {
    const { wrapper } = mountPicker()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    expect(wrapper.find('[data-testid="eligible-sales-picker-pagination"]').exists()).toBe(false)
  })
})

describe('EligibleSalesPicker — retained selection across search and pages', () => {
  it('keeps the chip label of a selected sale when the search changes', async () => {
    getMock.mockResolvedValueOnce({ data: makeResponse([makeRow()], { total: 1, totalPages: 1 }) })
    getMock.mockResolvedValue({
      data: makeResponse(
        [makeRow({ id: 'sale-9', folio: 'A-202610-000099', customer: { id: 'c9', name: 'Cliente Z' } })],
        { total: 1, totalPages: 1 },
      ),
    })
    const { wrapper } = mountPicker()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    await wrapper.find('[data-testid="eligible-sales-picker-row-toggle-sale-1"]').trigger('click')
    await nextTick()

    await wrapper.find('[data-testid="eligible-sales-picker-search"] input').setValue('Z')
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-9"]').exists()).toBe(true))

    // Selection + resolved label survive the search change.
    expect(wrapper.find('[data-testid="eligible-sales-picker-chip-sale-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="eligible-sales-picker-chip-label-sale-1"]').text()).toContain('A-202610-000003')
  })

  it('keeps the chip label across a page change where the selected row is absent', async () => {
    getMock.mockResolvedValue({
      data: makeResponse([makeRow()], { page: 1, limit: 20, total: 45, totalPages: 3 }),
    })
    const { wrapper } = mountPicker()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    await wrapper.find('[data-testid="eligible-sales-picker-row-toggle-sale-1"]').trigger('click')
    await nextTick()

    getMock.mockResolvedValue({
      data: makeResponse([makeRow({ id: 'sale-page-2', folio: 'A-202610-000050' })], {
        page: 2,
        limit: 20,
        total: 45,
        totalPages: 3,
      }),
    })
    await wrapper.find('[data-testid="eligible-sales-picker-pagination-next"]').trigger('click')
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-page-2"]').exists()).toBe(true))

    expect(wrapper.find('[data-testid="eligible-sales-picker-chip-sale-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="eligible-sales-picker-chip-label-sale-1"]').text()).toContain('A-202610-000003')
  })
})

describe('EligibleSalesPicker — inline create conflict (S2)', () => {
  it('renders the conflict alert listing the conflicting folios and preserves the selection', async () => {
    const { picker, wrapper, selected } = mountPicker({
      modelValue: ['sale-1'],
      conflictActive: true,
      conflictSaleIds: ['sale-1'],
    })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    expect(wrapper.find('[data-testid="eligible-sales-picker-conflict"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="eligible-sales-picker-conflict-item-sale-1"]').text()).toContain('A-202610-000003')
    // The selection is NEVER silently removed.
    expect(selected.value).toEqual(['sale-1'])
    expect(picker.emitted('update:selected')).toBeFalsy()
  })

  it('offers an actionable "refresh availability" control that refetches', async () => {
    const { wrapper } = mountPicker({ modelValue: ['sale-1'], conflictActive: true, conflictSaleIds: ['sale-1'] })
    await settle(() => expect(getMock).toHaveBeenCalledTimes(1))

    await wrapper.find('[data-testid="eligible-sales-picker-conflict-refresh"]').trigger('click')
    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(2))
  })

  it('shows the conflict alert even when the server sends no conflictSaleIds (race)', async () => {
    const { wrapper } = mountPicker({ conflictActive: true, conflictSaleIds: [] })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-conflict"]').exists()).toBe(true))
  })

  it('does not render the conflict alert on a clean create form', async () => {
    const { wrapper } = mountPicker()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    expect(wrapper.find('[data-testid="eligible-sales-picker-conflict"]').exists()).toBe(false)
  })
})

describe('EligibleSalesPicker — empty / loading / error / required states', () => {
  it('renders "No hay ventas pendientes o enviadas" when the eligible list is empty', async () => {
    getMock.mockResolvedValue({ data: makeResponse([], { total: 0, totalPages: 0 }) })
    const { wrapper } = mountPicker()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-empty-inline"]').exists()).toBe(true))
    expect(wrapper.text()).toContain('No hay ventas pendientes o enviadas')
  })

  it('exposes a loading indicator while the eligible list is being fetched', async () => {
    const { wrapper } = mountPicker()
    expect(wrapper.find('[data-testid="eligible-sales-picker-loading"]').exists()).toBe(true)
    await settle(() => expect(getMock).toHaveBeenCalledTimes(1))
  })

  it('renders a friendly fallback instead of the raw AxiosError message', async () => {
    getMock.mockRejectedValue(new Error('Request failed with status code 400'))
    const { wrapper } = mountPicker()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-error"]').exists()).toBe(true))
    expect(wrapper.text()).toContain('No se pudieron cargar las ventas elegibles. Reintenta.')
    expect(wrapper.text()).not.toContain('Request failed with status code 400')
  })

  it('surfaces the backend message when the API error carries an envelope', async () => {
    getMock.mockRejectedValue({ response: { data: { message: 'deliveryStatus is invalid' } } })
    const { wrapper } = mountPicker()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-error"]').exists()).toBe(true))
    expect(wrapper.text()).toContain('deliveryStatus is invalid')
  })

  it('renders the required marker when :required is true', async () => {
    const { wrapper } = mountPicker({ required: true })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-required"]').exists()).toBe(true))
  })

  it('renders the inline field error when :error is provided', async () => {
    const { wrapper } = mountPicker({ error: 'Selecciona al menos una venta' })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-error-inline"]').exists()).toBe(true))
    expect(wrapper.text()).toContain('Selecciona al menos una venta')
  })
})

// ─── Finding 1: append keeps the legacy confirmed-sales permission path ─────
describe('EligibleSalesPicker — append source preserves the legacy path (finding 1)', () => {
  it('append source reads the legacy confirmed-sales endpoint, never the create-gated eligible-sales endpoint', async () => {
    getMock.mockImplementation((url: string) =>
      url === '/sales'
        ? Promise.resolve({ data: makeLegacyResponse() })
        : Promise.reject(new Error(`unexpected GET ${url}`)),
    )
    const { wrapper } = mountAppendIntegration()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))

    const urls = getMock.mock.calls.map((c) => c[0])
    expect(urls).toContain('/sales')
    expect(urls).not.toContain('/delivery-routes/eligible-sales')
    // Legacy confirmed-sales params keep the PENDING+SHIPPED eligibility pin.
    const salesCall = getMock.mock.calls.find((c) => c[0] === '/sales')!
    const params = (salesCall[1] as { params: Record<string, unknown> }).params
    expect(params.deliveryStatus).toEqual(['PENDING', 'SHIPPED'])
  })

  it('append source never claims authoritative availability (no disabled rows, no reasons)', async () => {
    getMock.mockImplementation(() => Promise.resolve({ data: makeLegacyResponse() }))
    const { wrapper } = mountAppendIntegration()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    expect(wrapper.find('[data-testid="eligible-sales-picker-row-reason-sale-1"]').exists()).toBe(false)
    const toggle = wrapper.find('[data-testid="eligible-sales-picker-row-toggle-sale-1"]')
    expect(toggle.attributes('disabled')).toBeUndefined()
  })
})

// ─── Finding 2: append success invalidates the new eligible-sales prefix ────
describe('EligibleSalesPicker — append success invalidates eligible-sales (finding 2)', () => {
  it('invalidates BOTH the eligible-sales prefix and the confirmed-sales prefix, and refetches the legacy list', async () => {
    getMock.mockImplementation(() => Promise.resolve({ data: makeLegacyResponse() }))
    postMock.mockResolvedValue({
      data: {
        id: 'route-1', status: 'DRAFT', driver: null,
        startedAt: null, completedAt: null, cancelledAt: null, notes: null,
        stops: [], timeline: [],
      },
    })
    const { wrapper, queryClient } = mountAppendIntegration()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    await wrapper.find('[data-testid="eligible-sales-picker-row-toggle-sale-1"]').trigger('click')
    await nextTick()
    const fetchesBefore = getMock.mock.calls.length

    await wrapper.find('[data-testid="integration-append"]').trigger('click')
    await vi.waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))
    // The legacy confirmed list actually refetches (invalidated slot is active).
    await vi.waitFor(() => expect(getMock.mock.calls.length).toBeGreaterThan(fetchesBefore))

    const keys = invalidateSpy.mock.calls.map(
      (c) => (c[0] as { queryKey: unknown }).queryKey,
    )
    expect(keys).toContainEqual(eligibleSalesQueryKeys.listPrefix('tenant-1'))
    expect(keys).toContainEqual(saleQueryKeys.confirmedPrefix('tenant-1'))
  })
})

// ─── Finding 3: selection validity (block stale/invalid selections) ─────────
describe('EligibleSalesPicker — selection validity (finding 3)', () => {
  it('marks a selected sale invalid when refreshed availability is no longer AVAILABLE', async () => {
    getMock.mockResolvedValue({
      data: makeResponse([
        makeRow({ id: 'sale-1', availability: { state: 'OCCUPIED', reason: 'RESERVED_BY_ROUTE', occupiedRoute: null } }),
      ]),
    })
    const { picker, wrapper } = mountPicker({ modelValue: ['sale-1'] })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    const validity = lastValidity(picker)
    expect(validity.valid).toBe(false)
    expect(validity.invalidSaleIds).toEqual(['sale-1'])
  })

  it('reports a selected conflict id as invalid while it stays selected', async () => {
    const { picker, wrapper } = mountPicker({
      modelValue: ['sale-1'],
      conflictActive: true,
      conflictSaleIds: ['sale-1'],
    })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    expect(lastValidity(picker).invalidSaleIds).toEqual(['sale-1'])
  })

  it('blocks on an empty-id conflict until availability is refreshed, then permits a retry', async () => {
    getMock.mockResolvedValue({ data: makeResponse([makeRow()]) })
    const { picker, wrapper } = mountPicker({
      modelValue: ['sale-1'],
      conflictActive: true,
      conflictSaleIds: [],
    })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    // Still a conflict (empty ids) — must not be labelled resolved.
    expect(wrapper.find('[data-testid="eligible-sales-picker-conflict"]').exists()).toBe(true)
    expect(lastValidity(picker).valid).toBe(false)

    await wrapper.find('[data-testid="eligible-sales-picker-conflict-refresh"]').trigger('click')
    await vi.waitFor(() => expect(lastValidity(picker).valid).toBe(true))
  })

  it('becomes valid again once the conflicting sale is removed', async () => {
    getMock.mockResolvedValue({ data: makeResponse([makeRow()]) })
    const { picker, wrapper } = mountPicker({
      modelValue: ['sale-1'],
      conflictActive: true,
      conflictSaleIds: ['sale-1'],
    })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    expect(lastValidity(picker).valid).toBe(false)
    await wrapper.find('[data-testid="eligible-sales-picker-chip-clear-sale-1"]').trigger('click')
    await nextTick()
    expect(lastValidity(picker).valid).toBe(true)
  })
})

// ─── Finding 4: disabled chip removal + target size ────────────────────────
describe('EligibleSalesPicker — chip removal respects disabled (finding 4)', () => {
  it('does not remove a sale via the chip clear button when the picker is disabled', async () => {
    const { picker, selected, wrapper } = mountPicker({ modelValue: ['sale-1'], disabled: true })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    const clear = wrapper.find('[data-testid="eligible-sales-picker-chip-clear-sale-1"]')
    expect(clear.attributes('disabled')).toBeDefined()
    await clear.trigger('click')
    await nextTick()
    expect(selected.value).toEqual(['sale-1'])
    expect(picker.emitted('update:selected')).toBeFalsy()
  })

  it('chip clear control exposes a >=24px (32px) target', async () => {
    const { wrapper } = mountPicker({ modelValue: ['sale-1'] })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-chip-clear-sale-1"]').exists()).toBe(true))
    const clear = wrapper.find('[data-testid="eligible-sales-picker-chip-clear-sale-1"]')
    expect(clear.classes()).toContain('size-8')
  })
})

// ═══ Targeted verifier fixes — behavioral RED first ═══════════════════════

// Fix 1 — a FAILED refresh must not mark the conflict reviewed/unblocked.
describe('EligibleSalesPicker — failed refresh keeps the conflict blocked (fix 1)', () => {
  it('stays blocked and exposes a retry when the refresh rejects', async () => {
    getMock.mockResolvedValue({ data: makeResponse([makeRow()]) })
    const { picker, wrapper } = mountPicker({
      modelValue: ['sale-1'],
      conflictActive: true,
      conflictSaleIds: [],
    })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    expect(lastValidity(picker).valid).toBe(false)

    getMock.mockRejectedValue(new Error('network down'))
    await wrapper.find('[data-testid="eligible-sales-picker-conflict-refresh"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="eligible-sales-picker-error"]').exists()).toBe(true))
    await nextTick()

    // Still blocked, and the retry affordance is present.
    expect(lastValidity(picker).valid).toBe(false)
    expect(wrapper.find('[data-testid="eligible-sales-picker-error-retry"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="eligible-sales-picker-conflict"]').exists()).toBe(true)
  })

  it('recovers when the retry later succeeds (no permanent dead end)', async () => {
    getMock.mockResolvedValue({ data: makeResponse([makeRow()]) })
    const { picker, wrapper } = mountPicker({
      modelValue: ['sale-1'],
      conflictActive: true,
      conflictSaleIds: [],
    })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))

    getMock.mockRejectedValueOnce(new Error('network down'))
    await wrapper.find('[data-testid="eligible-sales-picker-conflict-refresh"]').trigger('click')
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="eligible-sales-picker-error-retry"]').exists()).toBe(true),
    )
    expect(lastValidity(picker).valid).toBe(false)

    getMock.mockResolvedValue({ data: makeResponse([makeRow()]) })
    await wrapper.find('[data-testid="eligible-sales-picker-error-retry"]').trigger('click')
    await vi.waitFor(() => expect(lastValidity(picker).valid).toBe(true))
  })
})

// Fix 2 — reconcile conflict IDs ONLY from fresh post-conflict successful data.
describe('EligibleSalesPicker — conflict reconciliation from fresh data (fix 2)', () => {
  it('clears a selected conflict id once a successful refresh proves it AVAILABLE', async () => {
    getMock.mockResolvedValue({
      data: makeResponse([makeRow({ id: 'sale-1', availability: { state: 'AVAILABLE' } })]),
    })
    const { picker, wrapper } = mountPicker({
      modelValue: ['sale-1'],
      conflictActive: true,
      conflictSaleIds: ['sale-1'],
    })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    expect(lastValidity(picker).valid).toBe(false)

    await wrapper.find('[data-testid="eligible-sales-picker-conflict-refresh"]').trigger('click')
    await vi.waitFor(() => expect(lastValidity(picker).valid).toBe(true))
    expect(lastValidity(picker).invalidSaleIds).toEqual([])
  })

  it('keeps a conflict id invalid when the refresh shows it OCCUPIED', async () => {
    getMock.mockResolvedValue({
      data: makeResponse([
        makeRow({ id: 'sale-1', availability: { state: 'OCCUPIED', reason: 'RESERVED_BY_ROUTE', occupiedRoute: null } }),
      ]),
    })
    const { picker, wrapper } = mountPicker({
      modelValue: ['sale-1'],
      conflictActive: true,
      conflictSaleIds: ['sale-1'],
    })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    await wrapper.find('[data-testid="eligible-sales-picker-conflict-refresh"]').trigger('click')
    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(2))
    await nextTick()
    expect(lastValidity(picker).valid).toBe(false)
    expect(lastValidity(picker).invalidSaleIds).toEqual(['sale-1'])
  })

  it('keeps an off-page conflict id invalid when a refresh returns a page without it', async () => {
    getMock.mockResolvedValue({
      data: makeResponse([makeRow({ id: 'sale-other' })], { page: 1, limit: 20, total: 2, totalPages: 2 }),
    })
    const { picker, wrapper } = mountPicker({
      modelValue: ['sale-1'],
      conflictActive: true,
      conflictSaleIds: ['sale-1'],
    })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-conflict"]').exists()).toBe(true))
    await wrapper.find('[data-testid="eligible-sales-picker-conflict-refresh"]').trigger('click')
    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(2))
    await nextTick()
    expect(lastValidity(picker).valid).toBe(false)
    expect(lastValidity(picker).invalidSaleIds).toEqual(['sale-1'])
  })

  it('allows removing and re-selecting a reconciled id', async () => {
    getMock.mockResolvedValue({ data: makeResponse([makeRow({ id: 'sale-1' })]) })
    const { picker, wrapper, selected } = mountPicker({
      modelValue: ['sale-1'],
      conflictActive: true,
      conflictSaleIds: ['sale-1'],
    })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    await wrapper.find('[data-testid="eligible-sales-picker-conflict-refresh"]').trigger('click')
    await vi.waitFor(() => expect(lastValidity(picker).valid).toBe(true))

    await wrapper.find('[data-testid="eligible-sales-picker-chip-clear-sale-1"]').trigger('click')
    await nextTick()
    expect(selected.value).toEqual([])

    await wrapper.find('[data-testid="eligible-sales-picker-row-toggle-sale-1"]').trigger('click')
    await nextTick()
    expect(selected.value).toEqual(['sale-1'])
    expect(lastValidity(picker).valid).toBe(true)
  })
})

// Fix 3 — legacy append must not claim a missing address the API omitted.
describe('EligibleSalesPicker — address absent vs null (fix 3)', () => {
  it('create source with a real null address keeps the missing-address text', async () => {
    getMock.mockResolvedValue({ data: makeResponse([makeRow({ id: 'sale-x', shippingAddress: null })]) })
    const { wrapper } = mountPicker()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-x"]').exists()).toBe(true))
    expect(
      wrapper.find('[data-testid="eligible-sales-picker-row-primary-sale-x"]').text(),
    ).toContain('Sin dirección registrada')
  })

  it('append source omits the address line instead of claiming a missing address', async () => {
    getMock.mockImplementation((url: string) =>
      url === '/sales'
        ? Promise.resolve({ data: makeLegacyResponse() })
        : Promise.reject(new Error(`unexpected ${url}`)),
    )
    const { wrapper } = mountAppendIntegration()
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    const primary = wrapper.find('[data-testid="eligible-sales-picker-row-primary-sale-1"]')
    expect(primary.text()).not.toContain('Sin dirección registrada')
    expect(wrapper.find('[data-testid="eligible-sales-picker-row-address-sale-1"]').exists()).toBe(false)
  })
})

// Fix 4 — explicit conflict attempt signal reblocks repeated empty-id conflicts.
describe('EligibleSalesPicker — explicit conflict attempt signal (fix 4)', () => {
  it('reblocks an already-reviewed blank conflict when a new attempt arrives', async () => {
    getMock.mockResolvedValue({ data: makeResponse([makeRow()]) })
    const { picker, wrapper, props } = mountPicker({
      modelValue: ['sale-1'],
      conflictActive: true,
      conflictSaleIds: [],
      conflictAttempt: 1,
    })
    await settle(() => expect(wrapper.find('[data-testid="eligible-sales-picker-row-sale-1"]').exists()).toBe(true))
    await wrapper.find('[data-testid="eligible-sales-picker-conflict-refresh"]').trigger('click')
    await vi.waitFor(() => expect(lastValidity(picker).valid).toBe(true))

    props.conflictAttempt = 2
    await nextTick()
    await nextTick()
    expect(lastValidity(picker).valid).toBe(false)
    expect(wrapper.find('[data-testid="eligible-sales-picker-conflict"]').exists()).toBe(true)
  })
})

const _unusedRef = (r: Ref<unknown>) => r // keep the Ref import used across TS configs
void _unusedRef
