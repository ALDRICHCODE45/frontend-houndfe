/**
 * customers-module T6: the customers table on GET /customers/listing with the Sales list pieces —
 * filters sheet (URL-synced), saved views, sort select, server totals — and no money without read:Sale.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed, reactive, ref } from 'vue'
import type { ServerTableConfig } from '@/core/shared/types/table.types'
import CustomersView from '../CustomersView.vue'
import type { CustomerListingPage, CustomerListingRow } from '../../interfaces/customer-listing.types'

let capturedConfig: ServerTableConfig<CustomerListingRow> | undefined
const mockState = {
  pagination: ref({ pageIndex: 0, pageSize: 50 }),
  sorting: ref<Array<{ id: string; desc: boolean }>>([]),
  globalFilter: ref(''),
  columnPinning: ref({ left: [] as string[], right: [] as string[] }),
  columnVisibility: ref<Record<string, boolean>>({}),
  columnOrder: ref<string[]>([]),
  columnSizing: ref<Record<string, number>>({}),
  density: ref('comfortable'),
  data: ref<CustomerListingRow[]>([]),
  response: ref<CustomerListingPage | undefined>(undefined),
  isError: ref(false),
}

vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: (config: ServerTableConfig<CustomerListingRow>) => {
    capturedConfig = config
    mockState.sorting.value = [...(config.defaultSorting ?? [])]
    return {
      pagination: mockState.pagination,
      sorting: mockState.sorting,
      globalFilter: mockState.globalFilter,
      columnPinning: mockState.columnPinning,
      columnVisibility: mockState.columnVisibility,
      columnOrder: mockState.columnOrder,
      columnSizing: mockState.columnSizing,
      density: mockState.density,
      resetLayout: vi.fn(),
      data: computed(() => mockState.data.value),
      response: computed(() => mockState.response.value),
      totalCount: computed(() => mockState.data.value.length),
      pageCount: computed(() => 1),
      isLoading: computed(() => false),
      isFetching: computed(() => false),
      isError: computed(() => mockState.isError.value),
      error: computed(() => null),
      refresh: vi.fn(),
      pageSizeOptions: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
      showingFrom: computed(() => 1),
      showingTo: computed(() => 1),
    }
  },
}))

const listCustomersListing = vi.fn()
const listCustomerListingOptions = vi.fn()
vi.mock('../../api/customer.api', () => ({
  customerApi: {
    listCustomersListing: (...args: unknown[]) => listCustomersListing(...args),
    listCustomerListingOptions: (...args: unknown[]) => listCustomerListingOptions(...args),
    getById: vi.fn(),
  },
}))

const authMock = { userCan: vi.fn((_a: string, _s: string) => true), currentTenantId: 'tenant-1' }
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: ref(undefined), isLoading: ref(false) }),
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), refetchQueries: vi.fn() }),
}))
vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: { getGlobalPriceLists: vi.fn().mockResolvedValue([]) },
}))

const route = reactive({ path: '/pos/customers', query: {} as Record<string, string> })
const replace = vi.fn(async ({ query }: { query: Record<string, string> }) => {
  route.query = query
})
const push = vi.fn(async () => undefined)
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push, replace }),
  useRoute: () => route,
}))

Object.assign(globalThis, { useToast: () => ({ add: vi.fn() }) })

vi.mock('../../components/CustomerPetsSlideover.vue', () => ({ default: { name: 'CustomerPetsSlideover', template: '<div />', props: ['open', 'customer'] } }))
vi.mock('../../components/CustomerUpsertSlideover.vue', () => ({
  default: { name: 'CustomerUpsertSlideover', template: '<div />', props: ['open', 'mode', 'loading', 'errors', 'customer', 'globalPriceLists', 'showPets'] },
}))
vi.mock('@/core/shared/components/ConfirmModal.vue', () => ({ default: { name: 'ConfirmModal', template: '<div />', props: ['open'] } }))

vi.mock('@/core/shared/components/DataTable/AppDataTable.vue', () => ({
  default: {
    name: 'AppDataTable',
    props: ['columns', 'data', 'totals', 'sorting', 'error', 'errorMessage', 'filtered', 'activeFilterCount', 'rowOpen'],
    emits: ['update:sorting', 'clear-filters'],
    template: `
      <div data-testid="app-data-table">
        <div data-testid="filters-slot"><slot name="filters" /></div>
        <div v-for="row in data" :key="row.id" data-testid="table-row">
          <div v-for="column in columns" :key="column.id ?? column.accessorKey" :data-testid="'cell-' + (column.id ?? column.accessorKey)">
            <slot :name="(column.id ?? column.accessorKey) + '-cell'" :row="{ original: row }" />
          </div>
          <slot name="mobile-card" :row="row" />
        </div>
      </div>`,
  },
}))
vi.mock('@/core/shared/components/DataTable/DataTableViews.vue', () => ({
  default: { name: 'DataTableViews', props: ['views', 'counts', 'controls', 'tabIdPrefix', 'portalClass'], template: '<div data-testid="views" />' },
}))
vi.mock('@/core/shared/data-table-filters/components/DataTableFilters.vue', () => ({
  default: {
    name: 'DataTableFilters',
    props: ['state', 'schema', 'errors', 'embedded', 'portalClass'],
    emits: ['update:state'],
    template: '<div data-testid="filters" />',
  },
}))

function row(overrides: Partial<CustomerListingRow> = {}): CustomerListingRow {
  return {
    id: 'c-1',
    firstName: 'Ana',
    lastName: 'Treviño',
    fullName: 'Ana Treviño',
    businessName: null,
    phoneCountryCode: '52',
    phone: '8123456789',
    email: 'ana@example.com',
    globalPriceListId: 'pl-1',
    globalPriceListName: 'Mayoreo',
    rfc: 'TEGA800101XXX',
    fiscalRegime: '612',
    isTrusted: true,
    createdAt: '2026-03-02T17:04:11.000Z',
    primaryAddress: { id: 'a-1', neighborhood: 'Mitras Centro', municipality: 'Monterrey', city: 'Monterrey', state: 'Nuevo León', zipCode: '64460' },
    activePetsCount: 2,
    petSpecies: ['DOG', 'CAT'],
    matchedPetName: null,
    metrics: {
      openDebtCents: 128400,
      overdueDebtCents: 50000,
      overdueCount: 1,
      oldestOverdueDueDate: '2026-11-01',
      salesCount: 23,
      totalSoldCents: 1846050,
      averageTicketCents: null,
      lastPurchaseAt: '2026-11-22T18:00:00.000Z',
    },
    ...overrides,
  }
}

const onlyCustomer = (action: string, subject: string) => subject === 'Customer'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  capturedConfig = undefined
  route.query = {}
  mockState.data.value = []
  mockState.response.value = undefined
  mockState.isError.value = false
  mockState.globalFilter.value = ''
  mockState.pagination.value = { pageIndex: 0, pageSize: 50 }
  authMock.userCan.mockImplementation(() => true)
  listCustomerListingOptions.mockResolvedValue([])
})

const ctx = { queryKey: [] as readonly unknown[] }
const sortSelect = (wrapper: ReturnType<typeof mount>) =>
  wrapper.getComponent({ name: 'Select' })

describe('CustomersView — data source (risk item 3)', () => {
  it('reads GET /customers/listing (limit 50), never GET /customers', async () => {
    listCustomersListing.mockResolvedValue({ data: [], pagination: {}, filterSummary: { count: 0 } })
    mount(CustomersView)
    expect(capturedConfig?.defaultPageSize).toBe(50)
    await capturedConfig!.queryFn({ pageIndex: 0, pageSize: 50 }, ctx)
    expect(listCustomersListing).toHaveBeenCalledWith({ page: 1, limit: 50, sortBy: 'name', sortOrder: 'asc' })
  })
})

describe('CustomersView — toolbar: filters sheet and sort select', () => {
  it('renders the shared filters with the customers schema and an «Ordenar:» select', () => {
    const wrapper = mount(CustomersView)
    const filters = wrapper.getComponent({ name: 'DataTableFilters' })
    expect(filters.props('schema').fields.map((field: { id: string }) => field.id)).toContain('hasOverdue')
    expect(wrapper.get('[data-testid="customers-sort-label"]').text()).toBe('Ordenar:')
    expect(wrapper.find('[data-testid="customers-sort-select"]').exists()).toBe(true)
  })

  it('offers the backend orderings in the sort select', () => {
    const wrapper = mount(CustomersView)
    const items = sortSelect(wrapper).props('items') as Array<{ value: string }>
    expect(items.map((item) => item.value)).toEqual([
      'oldestOverdue:asc',
      'openDebt:desc',
      'lastPurchaseAt:desc',
      'totalSold:desc',
      'name:asc',
      'createdAt:desc',
    ])
  })

  it('applies the filters from the URL to the listing request (URL sync)', async () => {
    route.query = { hasOverdue: 'true', petSpecies: 'DOG,CAT', openDebtMin: '150000' }
    listCustomersListing.mockResolvedValue({ data: [], pagination: {}, filterSummary: { count: 0 } })
    mount(CustomersView)
    await flushPromises()
    await capturedConfig!.queryFn({ pageIndex: 0, pageSize: 50 }, ctx)
    expect(listCustomersListing).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasOverdue: 'true', petSpecies: 'DOG,CAT', openDebtMin: '150000' }),
    )
  })

  it('writes a filter change to the URL', async () => {
    vi.useFakeTimers()
    const wrapper = mount(CustomersView)
    const filters = wrapper.getComponent({ name: 'DataTableFilters' })
    filters.vm.$emit('update:state', { ...filters.props('state'), hasDebt: ['true'] })
    await vi.advanceTimersByTimeAsync(400)
    expect(replace).toHaveBeenCalledWith({ query: expect.objectContaining({ hasDebt: 'true' }) })
    vi.useRealTimers()
  })

  it('shows removable chips for the active filters and clears one or all', async () => {
    route.query = { hasOverdue: 'true', petSpecies: 'DOG' }
    const wrapper = mount(CustomersView)
    await flushPromises()
    const chips = wrapper.findAll('[data-testid="customers-filter-chip"]')
    expect(chips.map((chip) => chip.text())).toEqual(['Con ventas vencidas: Sí', 'Especie: Perro'])
    await chips[1]!.trigger('click')
    expect(wrapper.findAll('[data-testid="customers-filter-chip"]').map((chip) => chip.text())).toEqual([
      'Con ventas vencidas: Sí',
    ])
    await wrapper.get('[data-testid="customers-filter-chips-clear"]').trigger('click')
    expect(wrapper.find('[data-testid="customers-filter-chip"]').exists()).toBe(false)
  })
})

describe('CustomersView — saved views and totals', () => {
  it('renders the saved views bar with the five built-ins', () => {
    const wrapper = mount(CustomersView)
    const views = wrapper.getComponent({ name: 'DataTableViews' }).props('views')
    expect(views.views.value.map((view: { name: string }) => view.name)).toEqual([
      'Todos',
      'Con deuda vencida',
      'Inactivos +90 días',
      'Mejores clientes',
      'Nuevos este mes',
    ])
  })

  it('passes the server totals of the filter: «N clientes · Deuda $X (vencida $Y)»', async () => {
    mockState.data.value = [row()]
    mockState.response.value = {
      data: [row()],
      pagination: { pageIndex: 0, pageSize: 50, totalCount: 38, pageCount: 1 },
      filterSummary: { count: 38, openDebtCents: 4821550, overdueDebtCents: 3194000 },
    }
    const wrapper = mount(CustomersView)
    await flushPromises()
    const table = wrapper.getComponent({ name: 'AppDataTable' })
    expect(table.props('totals')).toEqual({ name: 38, openDebt: '$48,215.50 (vencida $31,940.00)' })
    const columns = table.props('columns') as Array<{ id?: string; meta?: { total?: { kind: string; label?: (n: number) => string } } }>
    const name = columns.find((column) => column.id === 'name')!
    expect(name.meta?.total?.label?.(38)).toBe('38 clientes')
    expect(name.meta?.total?.label?.(1)).toBe('1 cliente')
    // Money is never summed in the browser: the debt total only reads the server value.
    const debt = columns.find((column) => column.id === 'openDebt')!
    expect(debt.meta?.total?.kind).toBe('custom')
  })
})

describe('CustomersView — cells', () => {
  it('renders Cliente, Deuda with «Vencida», Vencido desde, Última compra, Total comprado, Mascotas and the list', async () => {
    mockState.data.value = [row()]
    const wrapper = mount(CustomersView)
    await flushPromises()
    expect(wrapper.get('[data-testid="cell-name"]').text()).toContain('Ana Treviño')
    expect(wrapper.get('[data-testid="cell-name"]').text()).toContain('+52 81 2345 6789')
    expect(wrapper.get('[data-testid="cell-openDebt"]').text()).toContain('$1,284.00')
    expect(wrapper.get('[data-testid="cell-openDebt"]').text()).toContain('Vencida')
    expect(wrapper.get('[data-testid="cell-oldestOverdue"]').text()).toBe('01/11/2026')
    expect(wrapper.get('[data-testid="cell-lastPurchaseAt"]').text()).toBe('22 nov 2026')
    expect(wrapper.get('[data-testid="cell-totalSold"]').text()).toContain('$18,460.50')
    expect(wrapper.get('[data-testid="cell-pets"]').text()).toContain('2')
    expect(wrapper.find('[data-testid="cell-pets"] [data-species="DOG"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cell-pets"] [data-species="CAT"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="cell-priceList"]').text()).toBe('Mayoreo')
    expect(wrapper.get('[data-testid="cell-averageTicket"]').text()).toBe('—')
    expect(wrapper.get('[data-testid="cell-location"]').text()).toBe('Mitras Centro, Monterrey')
    expect(wrapper.get('[data-testid="cell-isTrusted"]').text()).toBe('De confianza')
  })

  it('shows «—» for no debt and no overdue, and no «Vencida» badge', async () => {
    mockState.data.value = [
      row({
        metrics: {
          openDebtCents: 0,
          overdueDebtCents: 0,
          overdueCount: 0,
          oldestOverdueDueDate: null,
          salesCount: 0,
          totalSoldCents: 0,
          averageTicketCents: null,
          lastPurchaseAt: null,
        },
      }),
    ]
    const wrapper = mount(CustomersView)
    await flushPromises()
    expect(wrapper.get('[data-testid="cell-openDebt"]').text()).toBe('—')
    expect(wrapper.get('[data-testid="cell-oldestOverdue"]').text()).toBe('—')
    expect(wrapper.get('[data-testid="cell-lastPurchaseAt"]').text()).toBe('—')
  })
})

describe('CustomersView — without read:Sale', () => {
  it('hides money columns, money filters, money sorts and money views, and sends no metric param', async () => {
    authMock.userCan.mockImplementation(onlyCustomer)
    route.query = { hasDebt: 'true', petSpecies: 'DOG' }
    mockState.data.value = [row({ metrics: undefined })]
    mockState.response.value = {
      data: [row({ metrics: undefined })],
      pagination: { pageIndex: 0, pageSize: 50, totalCount: 1, pageCount: 1 },
      filterSummary: { count: 1 },
    }
    listCustomersListing.mockResolvedValue({ data: [], pagination: {}, filterSummary: { count: 0 } })
    const wrapper = mount(CustomersView)
    await flushPromises()

    const table = wrapper.getComponent({ name: 'AppDataTable' })
    const ids = (table.props('columns') as Array<{ id?: string }>).map((column) => column.id)
    for (const id of ['openDebt', 'oldestOverdue', 'lastPurchaseAt', 'totalSold', 'salesCount', 'averageTicket']) {
      expect(ids).not.toContain(id)
    }
    expect(table.props('totals')).toEqual({ name: 1 })

    const schemaIds = wrapper.getComponent({ name: 'DataTableFilters' }).props('schema').fields.map((f: { id: string }) => f.id)
    expect(schemaIds).not.toContain('hasDebt')
    expect(schemaIds).not.toContain('openDebt')

    const sortItems = sortSelect(wrapper).props('items') as Array<{ value: string }>
    expect(sortItems.map((item) => item.value)).toEqual(['name:asc', 'createdAt:desc'])

    const views = wrapper.getComponent({ name: 'DataTableViews' }).props('views')
    expect(views.views.value.map((view: { id: string }) => view.id)).toEqual(['todos', 'nuevos-mes'])

    await capturedConfig!.queryFn({ pageIndex: 0, pageSize: 50, sorting: [{ id: 'totalSold', desc: true }] }, ctx)
    expect(listCustomersListing).toHaveBeenLastCalledWith({
      page: 1,
      limit: 50,
      sortBy: 'name',
      sortOrder: 'asc',
      petSpecies: 'DOG',
    })
  })
})

describe('CustomersView — listing errors', () => {
  it('names the listing error in Spanish in the table error block', async () => {
    listCustomersListing.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { statusCode: 400, code: 'LISTING_INVALID_DATE', field: 'createdFrom', message: 'x' } },
    })
    const wrapper = mount(CustomersView)
    await capturedConfig!.queryFn({ pageIndex: 0, pageSize: 50 }, ctx).catch(() => undefined)
    mockState.isError.value = true
    await flushPromises()
    const table = wrapper.getComponent({ name: 'AppDataTable' })
    expect(table.props('errorMessage')).toBe('Cliente desde: la fecha no es válida.')
    expect(wrapper.getComponent({ name: 'DataTableFilters' }).props('errors')).toEqual({
      created: 'Cliente desde: la fecha no es válida.',
    })
  })
})
