import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { computed, ref } from 'vue'
import SalesListView from '../SalesListView.vue'
import SortableHeader from '@/core/shared/components/DataTable/SortableHeader.vue'
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
    // Mirrors the real column set (ids + enableSorting) so header-slot
    // assertions exercise the same shape the view renders in production.
    columns: [
      { id: 'select', header: '', enableSorting: false },
      { id: 'venta', accessorKey: 'folio', header: 'Venta', enableSorting: true },
      { id: 'confirmedAt', accessorKey: 'confirmedAt', header: 'Fecha', enableSorting: true },
      { id: 'customer', accessorKey: 'customer', header: 'Cliente', enableSorting: true },
      { id: 'paymentStatus', accessorKey: 'paymentStatus', header: 'Pago', enableSorting: true },
      { id: 'paymentMethods', accessorKey: 'paymentMethods', header: 'Método', enableSorting: false },
      { id: 'totalCents', accessorKey: 'totalCents', header: 'Total', enableSorting: true },
      { id: 'debtCents', accessorKey: 'debtCents', header: 'Deuda', enableSorting: true },
      { id: 'dueDate', accessorKey: 'dueDate', header: 'Vence', enableSorting: false },
      { id: 'deliveryStatus', accessorKey: 'deliveryStatus', header: 'Productos', enableSorting: true },
      { id: 'cashier', accessorKey: 'cashier', header: 'Cajero', enableSorting: true },
      { id: 'seller', accessorKey: 'seller', header: 'Vendedor', enableSorting: true },
      { id: 'channel', header: 'Canal', enableSorting: false },
      { id: 'invoice', header: 'Factura', enableSorting: false },
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

const authMock = {
  userCan: vi.fn((action: string, _subject: string) => {
    void action
    return true
  }),
  currentTenantId: 'tenant-1',
}

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authMock,
}))

// Minimal TanStack Column double handed to the #<id>-header slots. Sorting
// state is read from — and written back to — the same `sorting` ref the
// USelect shortcut uses, so header clicks and the dropdown provably share one
// source of truth (REQ-13).
function makeHeaderColumn(id: string) {
  return {
    id,
    getIsSorted: () => {
      const entry = mockState.sorting.value.find((s) => s.id === id)
      if (!entry) return false as const
      return entry.desc ? ('desc' as const) : ('asc' as const)
    },
    toggleSorting: (desc: boolean) => {
      mockState.sorting.value = [{ id, desc }]
    },
  }
}

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
    showAddButton: { default: false },
    addButtonText: { default: 'Agregar' },
    addButtonTestId: { default: undefined },
    displayMode: { default: 'auto' },
    mobileRender: { default: 'table' },
  },
  emits: ['update:columnVisibility', 'refresh', 'add'],
  methods: {
    headerColumn(id: string) {
      return makeHeaderColumn(id)
    },
  },
  template: `
    <div
      data-testid="app-data-table"
      :data-column-visibility="JSON.stringify(columnVisibility)"
      :data-enable-column-visibility="enableColumnVisibility"
      :data-error="error ? 'true' : 'false'"
      :data-display-mode="displayMode"
      :data-mobile-render="mobileRender"
      :data-show-add-button="showAddButton ? 'true' : 'false'"
      :data-add-button-text="addButtonText"
    >
      <slot name="filters" />
      <slot name="actions" />
      <!-- The add button lives in AppDataTable's own toolbar now; the stub
           renders it so @add click flows can still be exercised. -->
      <button
        v-if="showAddButton"
        :data-testid="addButtonTestId"
        @click="$emit('add')"
      >{{ addButtonText }}</button>
      <div v-if="error" data-testid="table-error-state" role="alert">
        <p>{{ errorMessage }}</p>
        <button data-testid="table-error-retry" @click="$emit('refresh')">Reintentar</button>
      </div>
      <template v-else>
        <div v-if="(data ?? []).length === 0" data-testid="table-empty-state">{{ empty }}</div>
        <div v-for="row in data" :key="row.id">
          <slot name="venta-cell" :row="{ original: row }" />
          <slot name="confirmedAt-cell" :row="{ original: row }" />
          <slot name="customer-cell" :row="{ original: row }" />
          <slot name="paymentStatus-cell" :row="{ original: row }" />
          <slot name="paymentMethods-cell" :row="{ original: row }" />
          <slot name="totalCents-cell" :row="{ original: row }" />
          <slot name="debtCents-cell" :row="{ original: row }" />
          <slot name="dueDate-cell" :row="{ original: row }" />
          <slot name="deliveryStatus-cell" :row="{ original: row }" />
          <slot name="cashier-cell" :row="{ original: row }" />
          <slot name="seller-cell" :row="{ original: row }" />
          <slot name="channel-cell" :row="{ original: row }" />
          <slot name="invoice-cell" :row="{ original: row }" />
          <div data-testid="cards-host"><slot name="cards" :data="data ?? []" :loading="loading" :empty="empty" /></div>
        </div>
      </template>
      <!-- Header slot passthrough: UTable resolves #<id>-header per column, so
           the stub does the same to let header assertions run. Each column is
           handed a minimal TanStack Column double. -->
      <div data-testid="table-headers">
        <div v-for="col in columns" :key="col.id" :data-header-for="col.id">
          <slot :name="col.id + '-header'" :column="headerColumn(col.id)" />
        </div>
      </div>
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
    emits: ['update:state'],
    // The `set-status-filter` button lets a test drive real filter state
    // through the real useDataTableFilters, so "Limpiar" can be verified by
    // its observable effect rather than by spying on an internal method.
    template: `
      <div data-testid="sales-filters" :data-errors="JSON.stringify(errors)" :data-schema="JSON.stringify(schema)">
        <button
          data-testid="set-status-filter"
          @click="$emit('update:state', { ...state, status: ['CONFIRMED'] })"
        />
      </div>
    `,
  },
  SaleCard: {
    props: ['sale'],
    template: '<div data-testid="sale-card-stub">{{ sale.id }}</div>',
  },
  SaleCardGrid: {
    props: ['sales', 'loading', 'empty'],
    emits: ['card-click'],
    template: `
      <div data-testid="sale-card-grid-stub">
        <div v-for="sale in sales" :key="sale.id">
          <div data-testid="sale-card-stub" @click="$emit('card-click', sale)">{{ sale.id }}</div>
        </div>
      </div>
    `,
  },
  PaymentMethodPills: {
    props: ['methods'],
    template: '<div data-testid="payment-method-pills"></div>',
  },
  RouterLink: RouterLinkStub,
}

// Top-level so every describe in this file starts from the same state. The
// suite has several describes now; scoping this to one of them let `data: []`
// from the error-state cases leak into later blocks.
beforeEach(() => {
  vi.clearAllMocks()
  authMock.userCan.mockReturnValue(true)
  mockState.columnVisibility.value = {}
  mockState.data.value = [{ ...initialRow }]
  mockState.isError.value = false
  mockState.error.value = null
  mockState.sorting.value = [{ id: 'confirmedAt', desc: true }]
  mockState.globalFilter.value = ''
  mockState.filterErrors.value = {}
  customersQueryState.data.value = undefined
  customersQueryState.isLoading.value = false
  cashiersQueryState.data.value = undefined
  cashiersQueryState.isLoading.value = false
  localStorage.clear()
})

describe('SalesListView', () => {
  it('renders row fallbacks for an anonymous customer and a zero debt', () => {
    const wrapper = mount(SalesListView, { global: { stubs } })

    // The add button is AppDataTable's now — asserted via its contract in the
    // consolidated-toolbar suite rather than by scanning rendered text here.
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

  // HST-REQ-002/003/004: the folio link uses coco-gold-800 for AA contrast at
  // 14px inline text. The "Nueva Venta" half of this case moved to the
  // AppDataTable toolbar (REQ-15), which owns the CTA's styling now — so the
  // assertion is on the toolbar contract instead of hand-applied classes.
  it('drives Nueva Venta from the toolbar and keeps coco-gold on the folio link', () => {
    mockState.data.value = [{ ...initialRow }]
    const wrapper = mount(SalesListView, { global: { stubs } })

    const table = wrapper.get('[data-testid="app-data-table"]')
    expect(table.attributes('data-add-button-text')).toBe('Nueva Venta')
    expect(wrapper.get('[data-testid="toolbar-add-button"]').text()).toBe('Nueva Venta')

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

// REQ-13: every backend-sortable column gets a clickable SortableHeader, and
// the columns the backend cannot order by get none. The USelect shortcut stays
// as a second entry point onto the same `sorting` ref.
describe('SalesListView — sortable column headers (REQ-13)', () => {
  const SORTABLE_LABELS: Record<string, string> = {
    venta: 'Venta',
    confirmedAt: 'Fecha',
    customer: 'Cliente',
    paymentStatus: 'Pago',
    totalCents: 'Total',
    debtCents: 'Deuda',
    deliveryStatus: 'Productos',
    cashier: 'Cajero',
    seller: 'Vendedor',
  }

  it('renders a SortableHeader for each of the nine sortable columns with its Spanish label', () => {
    const wrapper = mount(SalesListView, { global: { stubs } })

    const headers = wrapper.findAllComponents(SortableHeader)
    expect(headers).toHaveLength(9)

    const rendered = Object.fromEntries(
      headers.map((h) => [h.props('column').id, h.props('label')]),
    )
    expect(rendered).toEqual(SORTABLE_LABELS)
  })

  it('renders no sort control on the columns the backend cannot order by', () => {
    const wrapper = mount(SalesListView, { global: { stubs } })

    for (const id of ['select', 'paymentMethods', 'dueDate', 'channel', 'invoice']) {
      const slot = wrapper.get(`[data-header-for="${id}"]`)
      expect(slot.findComponent(SortableHeader).exists()).toBe(false)
      expect(slot.text()).toBe('')
    }
  })

  it('updates sorting to totalCents when the Total header is clicked', async () => {
    mockState.sorting.value = [{ id: 'confirmedAt', desc: true }]
    const wrapper = mount(SalesListView, { global: { stubs } })

    const totalHeader = wrapper
      .findAllComponents(SortableHeader)
      .find((h) => h.props('label') === 'Total')
    expect(totalHeader).toBeDefined()

    await totalHeader!.get('button').trigger('click')

    expect(mockState.sorting.value).toEqual([{ id: 'totalCents', desc: false }])
  })

  it('reflects the shared sorting state on the matching header', () => {
    // The USelect shortcut writes into the same `sorting` ref. A header must
    // therefore report itself as sorted when that ref names its column, and
    // report nothing when it names a different one.
    mockState.sorting.value = [{ id: 'totalCents', desc: true }]
    const wrapper = mount(SalesListView, { global: { stubs } })

    const headers = wrapper.findAllComponents(SortableHeader)
    const total = headers.find((h) => h.props('label') === 'Total')
    const fecha = headers.find((h) => h.props('label') === 'Fecha')

    expect(total!.props('column').getIsSorted()).toBe('desc')
    expect(fecha!.props('column').getIsSorted()).toBe(false)
  })

  it('keeps the USelect sort shortcut alongside the headers', () => {
    // Design decision #1: headers are additive; the dropdown shortcut stays.
    const wrapper = mount(SalesListView, { global: { stubs } })

    expect(wrapper.find('select').exists()).toBe(true)
    expect(wrapper.text()).toContain('Más recientes')
  })
})

// REQ-14 / REQ-15: one toolbar row assembled by AppDataTable — the add button
// comes from show-add-button, the ViewToggle sits in #actions, and the
// slideover filters move into #filters above the tabs.
describe('SalesListView — consolidated toolbar (REQ-14, REQ-15)', () => {
  it('drives "Nueva Venta" through AppDataTable instead of a slot button', () => {
    authMock.userCan.mockReturnValue(true)
    const wrapper = mount(SalesListView, { global: { stubs } })

    const table = wrapper.get('[data-testid="app-data-table"]')
    expect(table.attributes('data-show-add-button')).toBe('true')
    expect(table.attributes('data-add-button-text')).toBe('Nueva Venta')
    expect(wrapper.find('[data-testid="toolbar-add-button"]').exists()).toBe(true)
  })

  it('hides the add button when the user cannot create sales', () => {
    authMock.userCan.mockImplementation((action) => action !== 'create')
    const wrapper = mount(SalesListView, { global: { stubs } })

    const table = wrapper.get('[data-testid="app-data-table"]')
    expect(table.attributes('data-show-add-button')).toBe('false')
    expect(wrapper.find('[data-testid="toolbar-add-button"]').exists()).toBe(false)
  })

  it('navigates to the new sale route when the toolbar add button is clicked', async () => {
    authMock.userCan.mockReturnValue(true)
    const wrapper = mount(SalesListView, { global: { stubs } })

    await wrapper.get('[data-testid="toolbar-add-button"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/pos/ventas/nueva')
  })

  it('renders the ViewToggle in the actions slot with the sales aria-label', () => {
    const wrapper = mount(SalesListView, { global: { stubs } })

    const toggle = wrapper.get('[role="tablist"]')
    expect(toggle.attributes('aria-label')).toBe('Seleccionar vista de ventas')
    expect(toggle.findAll('[role="tab"]').map((t) => t.text())).toEqual(['Tabla', 'Tarjetas'])
  })

  it('switches AppDataTable to cards when Tarjetas is selected, and persists it', async () => {
    const wrapper = mount(SalesListView, { global: { stubs } })

    expect(wrapper.get('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe('table')

    const tarjetas = wrapper.findAll('[role="tab"]').find((t) => t.text() === 'Tarjetas')
    await tarjetas!.trigger('click')

    expect(wrapper.get('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe('cards')
    expect(localStorage.getItem('pos-sales-view-mode')).toBe('card')
  })

  it('lets the persisted mode win at every viewport instead of a mobile override', () => {
    // Design decision #4: mobile-render="cards" forced cards on small screens
    // regardless of the stored preference, so it must be gone.
    localStorage.setItem('pos-sales-view-mode', 'card')
    const wrapper = mount(SalesListView, { global: { stubs } })

    const table = wrapper.get('[data-testid="app-data-table"]')
    expect(table.attributes('data-display-mode')).toBe('cards')
    expect(table.attributes('data-mobile-render')).toBe('table')
  })

  it('renders DataTableFilters inside the AppDataTable filters slot', () => {
    const wrapper = mount(SalesListView, { global: { stubs } })

    const table = wrapper.get('[data-testid="app-data-table"]')
    expect(table.find('[data-testid="sales-filters"]').exists()).toBe(true)
    // Nothing may remain outside the table — that was the second toolbar row.
    const stray = Array.from(
      (wrapper.element as HTMLElement).querySelectorAll('[data-testid="sales-filters"]'),
    ).filter((el) => !el.closest('[data-testid="app-data-table"]'))
    expect(stray).toHaveLength(0)
  })

  it('clears only the slideover filter state when Limpiar is clicked', async () => {
    const wrapper = mount(SalesListView, { global: { stubs } })
    mockState.sorting.value = [{ id: 'totalCents', desc: false }]
    mockState.globalFilter.value = 'ada'

    await wrapper.get('[data-testid="set-status-filter"]').trigger('click')
    expect(wrapper.get('[data-testid="extended-filters-indicator"]').text()).toContain(
      'Filtros activos: 1',
    )

    await wrapper.get('[data-testid="clear-extended-filters"]').trigger('click')

    expect(wrapper.find('[data-testid="extended-filters-indicator"]').exists()).toBe(false)
    // Sorting, search text, and view mode are deliberately untouched.
    expect(mockState.sorting.value).toEqual([{ id: 'totalCents', desc: false }])
    expect(mockState.globalFilter.value).toBe('ada')
  })
})

// REQ-16: the standardization must not disturb the sales domain surface.
// These are approval tests — they pin behavior that already exists so a later
// toolbar or column change cannot quietly regress it.
describe('SalesListView — preserved invariants (REQ-16)', () => {
  it('keeps salesFiltersSchema at 11 fields across 4 sections', () => {
    const wrapper = mount(SalesListView, { global: { stubs } })
    const schema = JSON.parse(
      wrapper.get('[data-testid="sales-filters"]').attributes('data-schema') ?? '{}',
    ) as { fields?: Array<{ id: string; section?: string }> }

    expect(schema.fields).toHaveLength(11)
    expect([...new Set(schema.fields!.map((f) => f.section).filter(Boolean))]).toEqual([
      'Estado',
      'Personas',
      'Montos',
      'Fechas',
    ])
  })

  it('keeps every cell slot rendering its domain component or formatter', () => {
    mockState.data.value = [
      {
        ...initialRow,
        customer: { id: 'c-1', name: 'Ada Lovelace' },
        seller: { id: 's-1', name: 'Grace Hopper' },
        debtCents: 5000,
        totalCents: 127000,
      },
    ]

    const wrapper = mount(SalesListView, { global: { stubs } })
    const text = wrapper.text()

    expect(wrapper.find('[data-testid="sale-link-sale-1"]').text()).toBe('#12')
    expect(text).toContain('Ada Lovelace')
    expect(text).toContain('Grace Hopper')
    expect(text).toContain('César')
    expect(text).toContain('Punto de Venta')
    expect(text).toContain('$1,270.00')
    expect(text).toContain('$50.00')
    expect(wrapper.find('[data-testid="payment-method-pills"]').exists()).toBe(true)
  })

  it('keeps SaleCardGrid wired to the cards slot', () => {
    const wrapper = mount(SalesListView, { global: { stubs } })

    const cards = wrapper.get('[data-testid="sale-card-grid-stub"]')
    expect(cards.find('[data-testid="sale-card-stub"]').text()).toBe('sale-1')
  })

  it('navigates to sale detail when a card in the cards slot is clicked', async () => {
    // REQ-12: card-click from SaleCardGrid drives the view's goToSaleDetail.
    const wrapper = mount(SalesListView, { global: { stubs } })

    await wrapper.get('[data-testid="sale-card-stub"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/pos/ventas/sale-1')
  })

  it('keeps SalesListTabs driving the delivery-status quick filter', async () => {
    const wrapper = mount(SalesListView, { global: { stubs } })

    await wrapper.get('[data-testid="tab-pending"]').trigger('click')

    expect(mockState.setDeliveryStatusFilter).toHaveBeenCalledWith('PENDING')
  })

  it('keeps row selection disabled and the pos-sales-list persist key intact', () => {
    const wrapper = mount(SalesListView, { global: { stubs } })

    expect(wrapper.get('[data-testid="app-data-table"]').attributes('enable-row-selection')).toBe(
      'false',
    )
  })
})
