import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { computed, ref } from 'vue'
import SalesListView from '../SalesListView.vue'

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ query: {}, path: '/pos/ventas' }),
}))

const mockState = {
  data: ref([
    {
      id: 'sale-1',
      folio: 'A-202605-000012',
      confirmedAt: '2026-05-06T14:43:00.000Z',
      customer: null,
      paymentStatus: 'PAID',
      totalCents: 127000,
      debtCents: 0,
      deliveryStatus: 'DELIVERED',
      cashier: { id: 'cash-1', name: 'César' },
      seller: null,
      paymentMethods: [],
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
  }),
}))

vi.mock('../../composables/useSalesColumns', () => ({
  useSalesColumns: () => ({
    columns: [
      { id: 'venta', accessorKey: 'folio', header: 'Venta' },
      { id: 'cashier', accessorKey: 'cashier', header: 'Cajero' },
      { id: 'seller', accessorKey: 'seller', header: 'Vendedor' },
    ],
  }),
  defaultColumnVisibility: {
    cashier: false,
    seller: false,
    channel: false,
    invoice: false,
  },
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    userCan: vi.fn(() => true),
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

  it('default hidden columns are reflected in columnVisibility (cashier, seller, channel, invoice)', () => {
    // Simulate what useConfirmedSales returns when defaultColumnVisibility is seeded:
    // cashier:false, seller:false, channel:false, invoice:false
    mockState.columnVisibility.value = { cashier: false, seller: false, channel: false, invoice: false }

    const wrapper = mount(SalesListView, { global: { stubs } })
    const table = wrapper.find('[data-testid="app-data-table"]')
    const visibility = JSON.parse(table.attributes('data-column-visibility') ?? '{}') as Record<string, boolean>

    expect(visibility.cashier).toBe(false)
    expect(visibility.seller).toBe(false)
    expect(visibility.channel).toBe(false)
    expect(visibility.invoice).toBe(false)
  })

  it('restores persisted visibility state from columnVisibility ref', () => {
    // Simulate persisted state: user had previously made seller visible
    mockState.columnVisibility.value = { cashier: false, seller: true, channel: false, invoice: false }

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
})
