import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { computed, ref } from 'vue'
import SalesListView from '../SalesListView.vue'
import type { ConfirmedSaleRow } from '../../interfaces/sale.types'

const customersQueryState = {
  data: ref<{ data: Array<{ id: string; firstName: string; lastName: string | null }> } | undefined>(undefined),
  isLoading: ref(false),
}

const cashiersQueryState = {
  data: ref<Array<{ id: string; name: string }> | undefined>(undefined),
  isLoading: ref(false),
}

vi.mock('@tanstack/vue-query', () => ({
  useQuery: vi.fn((options: { queryKey: unknown }) => {
    const rawKey = options.queryKey as { value?: unknown } | unknown[]
    const queryKey = Array.isArray(rawKey)
      ? rawKey
      : Array.isArray((rawKey as { value?: unknown })?.value)
        ? ((rawKey as { value?: unknown[] }).value ?? [])
        : []

    if (queryKey[0] === 'customers') {
      return {
        data: computed(() => customersQueryState.data.value),
        isLoading: computed(() => customersQueryState.isLoading.value),
      }
    }

    return {
      data: computed(() => cashiersQueryState.data.value),
      isLoading: computed(() => cashiersQueryState.isLoading.value),
    }
  }),
}))

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ query: {}, path: '/pos/ventas' }),
}))

const initialRow: ConfirmedSaleRow = {
  id: 'sale-1',
  folio: 'A-202605-000012',
  status: 'CONFIRMED',
  confirmedAt: '2026-05-06T14:43:00.000Z',
  dueDate: '2026-06-01T10:00:00.000Z',
  customer: null,
  paymentStatus: 'PAID',
  totalCents: 127000,
  debtCents: 0,
  deliveryStatus: 'DELIVERED',
  cashier: { id: 'cash-1', name: 'César' },
  seller: null,
  paymentMethods: [],
}

const mockState = {
  data: ref<ConfirmedSaleRow[]>([
    {
      ...initialRow,
    },
  ]),
  counts: ref({ all: 50, pendingPayments: 3, notDelivered: 1 }),
  pagination: ref({ pageIndex: 0, pageSize: 20 }),
  sorting: ref([{ id: 'confirmedAt', desc: true }]),
  globalFilter: ref(''),
  columnPinning: ref({ left: [], right: [] }),
  columnVisibility: ref<Record<string, boolean>>({}),
  rowSelection: ref({}),
  isLoading: ref(false),
  isFetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  pageCount: ref(3),
  totalCount: ref(50),
  showingFrom: ref(1),
  showingTo: ref(20),
  pageSizeOptions: [10, 20, 50],
  refresh: vi.fn(),
  setDeliveryStatusFilter: vi.fn(),
  filterErrors: ref<Record<string, string>>({}),
}

vi.mock('../../composables/useConfirmedSales', () => ({
  useConfirmedSales: () => ({
    ...mockState,
    data: computed(() => mockState.data.value),
    counts: computed(() => mockState.counts.value),
    pageCount: computed(() => mockState.pageCount.value),
    totalCount: computed(() => mockState.totalCount.value),
    showingFrom: computed(() => mockState.showingFrom.value),
    showingTo: computed(() => mockState.showingTo.value),
    isLoading: computed(() => mockState.isLoading.value),
    isFetching: computed(() => mockState.isFetching.value),
    isError: computed(() => mockState.isError.value),
    error: computed(() => mockState.error.value),
    filterErrors: computed(() => mockState.filterErrors.value),
  }),
}))

vi.mock('../../composables/useSalesColumns', () => ({
  useSalesColumns: () => ({
    columns: [
      { id: 'venta', accessorKey: 'folio', header: 'Venta' },
      { id: 'dueDate', accessorKey: 'dueDate', header: 'Vence' },
      { id: 'cashier', accessorKey: 'cashier', header: 'Cajero' },
      { id: 'seller', accessorKey: 'seller', header: 'Vendedor' },
    ],
  }),
  defaultColumnVisibility: {
    cashier: false,
    seller: false,
    dueDate: false,
    channel: false,
    invoice: false,
  },
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    userCan: vi.fn(() => true),
    currentTenantId: 'tenant-1',
  }),
}))

// AppDataTable stub that exposes columnVisibility as a data-attribute for testing.
// It mirrors AppDataTable's real error/empty precedence: when `error` is true the
// error block replaces both the rows and the empty placeholder, so assertions on
// "the empty state is absent" are meaningful rather than vacuously true.
const appDataTableStub = {
  props: {
    data: { default: () => [] },
    columns: { default: () => [] },
    columnVisibility: { default: undefined },
    enableColumnVisibility: { default: undefined },
    error: { default: false },
    errorMessage: { default: 'No se pudieron cargar los datos. Reintenta.' },
    empty: { default: 'No se encontraron resultados' },
  },
  emits: ['update:columnVisibility', 'refresh'],
  template: `
    <div
      data-testid="app-data-table"
      :data-column-visibility="JSON.stringify(columnVisibility)"
      :data-enable-column-visibility="enableColumnVisibility"
      :data-error="error ? 'true' : 'false'"
    >
      <slot name="filters" />
      <slot name="actions" />
      <div v-if="error" data-testid="table-error-state" role="alert">
        <p>{{ errorMessage }}</p>
        <button data-testid="table-error-retry" @click="$emit('refresh')">Reintentar</button>
      </div>
      <template v-else>
        <div v-if="(data ?? []).length === 0" data-testid="table-empty-state">{{ empty }}</div>
        <div v-for="row in data" :key="row.id">
          <slot name="venta-cell" :row="{ original: row }" />
          <slot name="customer-cell" :row="{ original: row }" />
          <slot name="paymentStatus-cell" :row="{ original: row }" />
          <slot name="paymentMethods-cell" :row="{ original: row }" />
          <slot name="debtCents-cell" :row="{ original: row }" />
          <slot name="dueDate-cell" :row="{ original: row }" />
          <slot name="deliveryStatus-cell" :row="{ original: row }" />
        </div>
      </template>
    </div>
  `,
}

const stubs = {
  UCard: { template: '<div><slot name="header" /><slot /></div>' },
  TableHeaderDescription: { template: '<div><slot /></div>', props: ['title', 'description'] },
  AppBadge: { template: '<span><slot /></span>' },
  StatusDotBadge: {
    props: ['label', 'tone'],
    template: '<span :data-tone="tone">{{ label }}</span>',
  },
  SalesListTabs: {
    template: `<button data-testid="tab-pending" @click="$emit('change', 'PENDING')">tab</button>`,
    props: ['counts'],
  },
  AppDataTable: appDataTableStub,
  DataTableFilters: {
    props: ['state', 'schema', 'errors'],
    template: '<div data-testid="sales-filters" :data-errors="JSON.stringify(errors)" :data-schema="JSON.stringify(schema)" />',
  },
  SaleCard: {
    props: ['sale'],
    template: '<div data-testid="sale-card-stub">{{ sale.id }}</div>',
  },
  PaymentMethodPills: {
    props: ['methods'],
    template: '<div data-testid="payment-method-pills"></div>',
  },
  RouterLink: RouterLinkStub,
}

describe('SalesListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.columnVisibility.value = {}
    mockState.data.value = [{ ...initialRow }]
    mockState.isError.value = false
    mockState.error.value = null
    customersQueryState.data.value = undefined
    customersQueryState.isLoading.value = false
    cashiersQueryState.data.value = undefined
    cashiersQueryState.isLoading.value = false
    localStorage.clear()
  })

  it('renders row fallbacks and Nueva Venta button', async () => {
    const wrapper = mount(SalesListView, { global: { stubs } })

    expect(wrapper.text()).toContain('Nueva Venta')
    expect(wrapper.text()).toContain('Público en General')
    expect(wrapper.text()).toContain('—')
  })

  it('navigates to sale detail when folio is clicked', async () => {
    const wrapper = mount(SalesListView, { global: { stubs } })
    await wrapper.get('[data-testid="sale-link-sale-1"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/pos/ventas/sale-1')
  })

  it('updates delivery tab filter from tabs component', async () => {
    const wrapper = mount(SalesListView, { global: { stubs } })
    await wrapper.get('[data-testid="tab-pending"]').trigger('click')
    expect(mockState.setDeliveryStatusFilter).toHaveBeenCalledWith('PENDING')
  })

  it('passes enable-column-visibility to AppDataTable', () => {
    const wrapper = mount(SalesListView, { global: { stubs } })
    const tableComponent = wrapper.findComponent(appDataTableStub)
    expect(tableComponent.exists()).toBe(true)
    // Standalone boolean attribute renders as '' (empty string) in jsdom for stub components.
    // What matters: the attribute is present on the element (truthy).
    const attrValue = tableComponent.props('enableColumnVisibility')
    expect(attrValue === true || attrValue === '').toBe(true)
  })

  it('default hidden columns are reflected in columnVisibility (cashier, seller, dueDate, channel, invoice)', () => {
    // Simulate what useConfirmedSales returns when defaultColumnVisibility is seeded:
    // cashier:false, seller:false, channel:false, invoice:false
    mockState.columnVisibility.value = { cashier: false, seller: false, dueDate: false, channel: false, invoice: false }

    const wrapper = mount(SalesListView, { global: { stubs } })
    const table = wrapper.find('[data-testid="app-data-table"]')
    const visibility = JSON.parse(table.attributes('data-column-visibility') ?? '{}') as Record<string, boolean>

    expect(visibility.cashier).toBe(false)
    expect(visibility.seller).toBe(false)
    expect(visibility.dueDate).toBe(false)
    expect(visibility.channel).toBe(false)
    expect(visibility.invoice).toBe(false)
  })

  it('restores persisted visibility state from columnVisibility ref', () => {
    // Simulate persisted state: user had previously made seller visible
    mockState.columnVisibility.value = { cashier: false, seller: true, dueDate: false, channel: false, invoice: false }

    const wrapper = mount(SalesListView, { global: { stubs } })
    const table = wrapper.find('[data-testid="app-data-table"]')
    const visibility = JSON.parse(table.attributes('data-column-visibility') ?? '{}') as Record<string, boolean>

    expect(visibility.seller).toBe(true)
    expect(visibility.cashier).toBe(false)
  })

  it('updates columnVisibility when AppDataTable emits update:column-visibility', async () => {
    const wrapper = mount(SalesListView, { global: { stubs } })
    const table = wrapper.findComponent(appDataTableStub)

    // Simulate the AppDataTable toggling column visibility
    await table.vm.$emit('update:columnVisibility', { cashier: true, seller: false })
    expect(mockState.columnVisibility.value).toEqual({ cashier: true, seller: false })
  })

  it('renders PaymentMethodPills in paymentMethods cell slot', () => {
    const wrapper = mount(SalesListView, { global: { stubs } })
    expect(wrapper.find('[data-testid="payment-method-pills"]').exists()).toBe(true)
  })

  it('renders DataTableFilters with mapped errors', () => {
    mockState.filterErrors.value = { paymentStatus: 'Valor inválido' }
    const wrapper = mount(SalesListView, { global: { stubs } })
    const filters = wrapper.get('[data-testid="sales-filters"]')
    expect(filters.attributes('data-errors')).toContain('Valor inválido')
  })

  it('passes customer and cashier options into reactive sales schema', () => {
    customersQueryState.data.value = {
      data: [{ id: 'customer-1', firstName: 'Ada', lastName: 'Lovelace' }],
    }
    cashiersQueryState.data.value = [{ id: 'cashier-1', name: 'Grace Hopper' }]

    const wrapper = mount(SalesListView, { global: { stubs } })
    const filters = wrapper.get('[data-testid="sales-filters"]')
    const schema = JSON.parse(filters.attributes('data-schema') ?? '{}') as { fields?: Array<Record<string, unknown>> }

    const customerField = schema.fields?.find((field) => field.id === 'customerId')
    const cashierField = schema.fields?.find((field) => field.id === 'cashierUserId')

    expect(customerField?.options).toEqual([{ value: 'customer-1', label: 'Ada Lovelace' }])
    expect(cashierField?.options).toEqual([{ value: 'cashier-1', label: 'Grace Hopper' }])
  })

  it('passes loading hints for customer and cashier filters', () => {
    customersQueryState.isLoading.value = true
    cashiersQueryState.isLoading.value = true

    const wrapper = mount(SalesListView, { global: { stubs } })
    const filters = wrapper.get('[data-testid="sales-filters"]')
    const schema = JSON.parse(filters.attributes('data-schema') ?? '{}') as { fields?: Array<Record<string, unknown>> }

    const customerField = schema.fields?.find((field) => field.id === 'customerId')
    const cashierField = schema.fields?.find((field) => field.id === 'cashierUserId')

    expect(customerField?.loading).toBe(true)
    expect(cashierField?.loading).toBe(true)
  })

  it('renders dueDate formatted when value exists', () => {
    mockState.data.value = [
      {
        ...initialRow,
        dueDate: '2026-06-01T10:00:00.000Z',
      },
    ]

    const wrapper = mount(SalesListView, { global: { stubs } })
    expect(wrapper.text()).toContain('01/06/2026')
  })

  it('renders em-dash when dueDate is null', () => {
    mockState.data.value = [
      {
        ...initialRow,
        dueDate: null,
      },
    ]

    const wrapper = mount(SalesListView, { global: { stubs } })
    expect(wrapper.text()).toContain('—')
  })

  // status-badge-unification: paymentStatus + deliveryStatus render via StatusDotBadge.
  // The StatusDotBadge stub exposes :data-tone so we assert both the label text
  // and the tone attribute (the AppBadge stub has no data-tone, so the attribute
  // assertion is the RED→GREEN gate).

  it('renders PAID payment status via StatusDotBadge (Pagada, success)', () => {
    mockState.data.value = [{ ...initialRow, paymentStatus: 'PAID' }]
    const wrapper = mount(SalesListView, { global: { stubs } })
    expect(wrapper.text()).toContain('Pagada')
    expect(wrapper.find('[data-tone="success"]').exists()).toBe(true)
  })

  it('renders PARTIAL payment status via StatusDotBadge (Impaga, warning)', () => {
    mockState.data.value = [{ ...initialRow, paymentStatus: 'PARTIAL' }]
    const wrapper = mount(SalesListView, { global: { stubs } })
    expect(wrapper.text()).toContain('Impaga')
    expect(wrapper.find('[data-tone="warning"]').exists()).toBe(true)
  })

  it('renders DELIVERED status via StatusDotBadge (Entregados, success)', () => {
    mockState.data.value = [{ ...initialRow, deliveryStatus: 'DELIVERED' }]
    const wrapper = mount(SalesListView, { global: { stubs } })
    expect(wrapper.text()).toContain('Entregados')
    expect(wrapper.find('[data-tone="success"]').exists()).toBe(true)
  })

  it('renders PENDING delivery status via StatusDotBadge (No Entregados, error)', () => {
    mockState.data.value = [{ ...initialRow, deliveryStatus: 'PENDING' }]
    const wrapper = mount(SalesListView, { global: { stubs } })
    expect(wrapper.text()).toContain('No Entregados')
    expect(wrapper.find('[data-tone="error"]').exists()).toBe(true)
  })

  // HST-REQ-002/003/004: Nueva Venta adopts the Cobrar precedent
  // (gold action background) and the folio link uses coco-gold-800 for AA
  // contrast at 14px inline text.
  it('pins Cobrar precedent on Nueva Venta and coco-gold on the folio link', () => {
    mockState.data.value = [{ ...initialRow }]
    const wrapper = mount(SalesListView, { global: { stubs } })

    const nuevaVenta = wrapper.findAll('button').find(b => b.text().includes('Nueva Venta'))
    expect(nuevaVenta).toBeDefined()
    expect(nuevaVenta!.classes()).toEqual(
      expect.arrayContaining(['!bg-(--brand-action)', '!text-black', 'rounded-xl', 'font-semibold', 'shadow-sm'])
    )

    const folioLink = wrapper.get('[data-testid="sale-link-sale-1"]')
    expect(folioLink.classes()).toEqual(expect.arrayContaining(['text-coco-gold-800', 'dark:text-coco-gold-400']))
    expect(folioLink.attributes('data-color')).not.toBe('primary')
  })
})

// REQ-12: a failed /sales/confirmed request must surface as a real error block,
// never as the "No hay ventas todavía" empty placeholder. The empty-state
// assertions below are meaningful because the companion test proves the stub
// DOES render that copy when the list is genuinely empty.
describe('SalesListView — confirmed sales request errors (REQ-12)', () => {
  it('renders the empty state when the list is genuinely empty and no error occurred', () => {
    mockState.data.value = []
    mockState.isError.value = false

    const wrapper = mount(SalesListView, { global: { stubs } })

    expect(wrapper.find('[data-testid="table-empty-state"]').text()).toBe('No hay ventas todavía')
    expect(wrapper.find('[data-testid="table-error-state"]').exists()).toBe(false)
  })

  it('renders the error block instead of the empty state when the request failed', () => {
    mockState.data.value = []
    mockState.isError.value = true
    mockState.error.value = { response: { data: { message: 'Las ventas no se pudieron consultar' } } }

    const wrapper = mount(SalesListView, { global: { stubs } })

    expect(wrapper.get('[data-testid="table-error-state"]').text()).toContain(
      'Las ventas no se pudieron consultar',
    )
    expect(wrapper.text()).not.toContain('No hay ventas todavía')
    expect(wrapper.find('[data-testid="table-empty-state"]').exists()).toBe(false)
  })

  it('falls back to the default table error copy when the failure carries no message', () => {
    mockState.isError.value = true
    mockState.error.value = new Error('Network Error')

    const wrapper = mount(SalesListView, { global: { stubs } })

    expect(wrapper.get('[data-testid="table-error-state"]').text()).toContain(
      'No se pudieron cargar las ventas. Reintenta.',
    )
  })

  it('refetches through the composable when the error retry is clicked', async () => {
    mockState.isError.value = true
    mockState.error.value = new Error('boom')

    const wrapper = mount(SalesListView, { global: { stubs } })
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')

    expect(mockState.refresh).toHaveBeenCalledTimes(1)
  })
})
