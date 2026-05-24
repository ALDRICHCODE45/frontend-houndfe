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

// AppDataTable stub that exposes columnVisibility as a data-attribute for testing
const appDataTableStub = {
  props: ['data', 'columns', 'columnVisibility', 'enableColumnVisibility'],
  emits: ['update:columnVisibility'],
  template: `
    <div
      data-testid="app-data-table"
      :data-column-visibility="JSON.stringify(columnVisibility)"
      :data-enable-column-visibility="enableColumnVisibility"
    >
      <slot name="filters" />
      <slot name="actions" />
      <div v-for="row in data" :key="row.id">
        <slot name="venta-cell" :row="{ original: row }" />
        <slot name="customer-cell" :row="{ original: row }" />
        <slot name="debtCents-cell" :row="{ original: row }" />
        <slot name="dueDate-cell" :row="{ original: row }" />
        <slot name="paymentMethods-cell" :row="{ original: row }" />
      </div>
    </div>
  `,
}

const stubs = {
  UCard: { template: '<div><slot name="header" /><slot /></div>' },
  TableHeaderDescription: { template: '<div><slot /></div>', props: ['title', 'description'] },
  AppBadge: { template: '<span><slot /></span>' },
  SalesListTabs: {
    template: `<button data-testid="tab-pending" @click="$emit('change', 'PENDING')">tab</button>`,
    props: ['counts'],
  },
  AppDataTable: appDataTableStub,
  DataTableFilters: {
    props: ['modelValue', 'schema', 'errors'],
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
    const schema = JSON.parse(filters.attributes('data-schema') ?? '[]') as Array<Record<string, unknown>>

    const customerField = schema.find((field) => field.id === 'customerId')
    const cashierField = schema.find((field) => field.id === 'cashierUserId')

    expect(customerField?.options).toEqual([{ value: 'customer-1', label: 'Ada Lovelace' }])
    expect(cashierField?.options).toEqual([{ value: 'cashier-1', label: 'Grace Hopper' }])
  })

  it('passes loading hints for customer and cashier filters', () => {
    customersQueryState.isLoading.value = true
    cashiersQueryState.isLoading.value = true

    const wrapper = mount(SalesListView, { global: { stubs } })
    const filters = wrapper.get('[data-testid="sales-filters"]')
    const schema = JSON.parse(filters.attributes('data-schema') ?? '[]') as Array<Record<string, unknown>>

    const customerField = schema.find((field) => field.id === 'customerId')
    const cashierField = schema.find((field) => field.id === 'cashierUserId')

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
})
