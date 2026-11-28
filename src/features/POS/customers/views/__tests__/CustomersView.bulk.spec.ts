/**
 * customers-bulk-actions T1 (S1-S3, risk item 2): selection + bulk bar of the customers table.
 * - «Exportar CSV» exists ONLY with read:Customer + export:Customer (never with manage:Customer).
 * - «Estados de cuenta PDF» needs read:Sale + read:Customer; without any action there is no selection.
 * - Caps disable with an explanation (50 statements, 10,000 CSV rows).
 * - Whole page marked + more rows → «Seleccionar los N clientes del filtro» → filter mode body.
 * - The download goes through the authenticated API helper; success toasts the file name.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed, reactive, ref } from 'vue'
import CustomersView from '../CustomersView.vue'
import type { CustomerListingRow } from '../../interfaces/customer-listing.types'

const mockState = {
  pagination: ref({ pageIndex: 0, pageSize: 50 }),
  sorting: ref<Array<{ id: string; desc: boolean }>>([]),
  globalFilter: ref(''),
  data: ref<CustomerListingRow[]>([]),
  total: ref(0),
}
const refresh = vi.fn()

vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: (config: { defaultSorting?: Array<{ id: string; desc: boolean }> }) => {
    mockState.sorting.value = [...(config.defaultSorting ?? [])]
    return {
      pagination: mockState.pagination,
      sorting: mockState.sorting,
      globalFilter: mockState.globalFilter,
      columnPinning: ref({ left: [], right: [] }),
      columnVisibility: ref({}),
      columnOrder: ref([]),
      columnSizing: ref({}),
      density: ref('comfortable'),
      resetLayout: vi.fn(),
      data: computed(() => mockState.data.value),
      response: computed(() => undefined),
      totalCount: computed(() => mockState.total.value),
      pageCount: computed(() => 1),
      isLoading: computed(() => false),
      isFetching: computed(() => false),
      isError: computed(() => false),
      error: computed(() => null),
      refresh,
      pageSizeOptions: [5, 10, 50],
      showingFrom: computed(() => 1),
      showingTo: computed(() => 1),
    }
  },
}))

const bulkExportCustomers = vi.fn()
const bulkCustomerStatements = vi.fn()
vi.mock('../../api/customer.api', () => ({
  customerApi: {
    listCustomersListing: vi.fn(),
    listCustomerListingOptions: vi.fn().mockResolvedValue([]),
    getById: vi.fn(),
    bulkExportCustomers: (...args: unknown[]) => bulkExportCustomers(...args),
    bulkCustomerStatements: (...args: unknown[]) => bulkCustomerStatements(...args),
  },
}))
const saveBlobAsFile = vi.fn()
vi.mock('@/core/shared/utils/downloadFile', () => ({
  saveBlobAsFile: (...args: unknown[]) => saveBlobAsFile(...args),
}))

const authMock = reactive({
  grants: [] as string[],
  permissionCodes: [] as string[],
  isSuperAdmin: false,
  currentTenantId: 'tenant-1',
  userCan(action: string, subject: string) {
    return this.grants.includes(`${action}:${subject}`)
  },
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

function grant(...codes: string[]) {
  authMock.grants = codes
  authMock.permissionCodes = codes
}

vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: ref(undefined), isLoading: ref(false) }),
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), refetchQueries: vi.fn() }),
}))
vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: { getGlobalPriceLists: vi.fn().mockResolvedValue([]) },
}))

const route = reactive({ path: '/pos/customers', query: {} as Record<string, string> })
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(async ({ query }: { query: Record<string, string> }) => {
      route.query = query
    }),
  }),
  useRoute: () => route,
}))

const toastAdd = vi.hoisted(() => vi.fn())
vi.mock('@nuxt/ui/runtime/composables/useToast', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useToast: () => ({ add: toastAdd }),
}))
Object.assign(globalThis, { useToast: () => ({ add: toastAdd }) })

vi.mock('../../components/CustomerPetsSlideover.vue', () => ({ default: { name: 'CustomerPetsSlideover', template: '<div />', props: ['open', 'customer'] } }))
vi.mock('../../components/CustomerUpsertSlideover.vue', () => ({
  default: { name: 'CustomerUpsertSlideover', template: '<div />', props: ['open', 'mode', 'loading', 'errors', 'customer', 'globalPriceLists', 'showPets'] },
}))
vi.mock('@/core/shared/components/ConfirmModal.vue', () => ({ default: { name: 'ConfirmModal', template: '<div />', props: ['open'] } }))
vi.mock('../../components/CustomerBulkDownloadDialog.vue', () => ({
  default: {
    name: 'CustomerBulkDownloadDialog',
    props: ['open', 'kind', 'count', 'running', 'error', 'canRetry', 'canRetryWithoutMissing'],
    emits: ['update:open', 'submit', 'cancel', 'retry', 'retry-without-missing'],
    template: '<div v-if="open" data-testid="bulk-dialog-stub">{{ kind }}<span v-if="error" data-testid="bulk-dialog-stub-error">{{ error.message }}</span></div>',
  },
}))

vi.mock('@/core/shared/components/DataTable/AppDataTable.vue', () => ({
  default: {
    name: 'AppDataTable',
    props: ['columns', 'data', 'bulkActions', 'selectionCount', 'rowSelection', 'enableRowSelection', 'totalCount'],
    emits: ['update:rowSelection', 'clear-selection'],
    template: `
      <div data-testid="app-data-table">
        <div data-testid="bulk-summary"><slot name="bulk-summary" :count="selectionCount" /></div>
      </div>`,
  },
}))
vi.mock('@/core/shared/components/DataTable/DataTableViews.vue', () => ({
  default: { name: 'DataTableViews', props: ['views', 'controls', 'tabIdPrefix', 'portalClass'], template: '<div />' },
}))
vi.mock('@/core/shared/data-table-filters/components/DataTableFilters.vue', () => ({
  default: { name: 'DataTableFilters', props: ['state', 'schema', 'errors', 'embedded', 'portalClass'], template: '<div />' },
}))

function row(id: string): CustomerListingRow {
  return {
    id,
    firstName: id,
    lastName: null,
    fullName: id,
    businessName: null,
    phoneCountryCode: null,
    phone: null,
    email: null,
    globalPriceListId: null,
    globalPriceListName: null,
    rfc: null,
    fiscalRegime: null,
    isTrusted: false,
    createdAt: '2026-03-02T17:04:11.000Z',
    primaryAddress: null,
    activePetsCount: 0,
    petSpecies: [],
    matchedPetName: null,
  }
}

type BulkActionProp = { id: string; label: string; disabled?: boolean; onClick: (rows: unknown[]) => void }
const table = (wrapper: ReturnType<typeof mount>) => wrapper.getComponent({ name: 'AppDataTable' })
const actions = (wrapper: ReturnType<typeof mount>) => (table(wrapper).props('bulkActions') ?? []) as BulkActionProp[]
const action = (wrapper: ReturnType<typeof mount>, id: string) => actions(wrapper).find((item) => item.id === id)

async function markRows(wrapper: ReturnType<typeof mount>, selection: Record<number, boolean>) {
  table(wrapper).vm.$emit('update:rowSelection', selection)
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  route.query = {}
  mockState.data.value = [row('a'), row('b'), row('c')]
  mockState.total.value = 3
  mockState.globalFilter.value = ''
  mockState.sorting.value = []
  grant('read:Customer', 'read:Sale', 'export:Customer')
})

describe('CustomersView bulk — permission gating (risk item 2)', () => {
  it('shows both actions with read:Sale + read:Customer + export:Customer', () => {
    const wrapper = mount(CustomersView)
    expect(actions(wrapper).map((item) => item.label)).toEqual(['Estados de cuenta PDF', 'Exportar CSV'])
    expect(table(wrapper).props('enableRowSelection')).toBe(true)
    expect(table(wrapper).props('columns')[0].id).toBe('select')
  })

  it('never shows «Exportar CSV» without export:Customer, even with manage:Customer', () => {
    grant('read:Customer', 'read:Sale', 'manage:Customer')
    const wrapper = mount(CustomersView)
    expect(action(wrapper, 'csv')).toBeUndefined()
    expect(action(wrapper, 'statements')).toBeDefined()
  })

  it('hides «Estados de cuenta PDF» without read:Sale', () => {
    grant('read:Customer', 'export:Customer')
    const wrapper = mount(CustomersView)
    expect(actions(wrapper).map((item) => item.id)).toEqual(['csv'])
  })

  it('has no selection at all without any bulk action', () => {
    grant('read:Customer')
    const wrapper = mount(CustomersView)
    expect(actions(wrapper)).toEqual([])
    expect(table(wrapper).props('enableRowSelection')).toBe(false)
    expect(table(wrapper).props('columns').some((column: { id?: string }) => column.id === 'select')).toBe(false)
  })
})

describe('CustomersView bulk — selection and caps', () => {
  it('counts the marked rows in the bulk bar and exports them by id with the table sort', async () => {
    bulkExportCustomers.mockResolvedValue({ blob: new Blob(['x']), fileName: 'clientes-2026-11-27.csv' })
    const wrapper = mount(CustomersView)
    await markRows(wrapper, { 0: true, 2: true })
    expect(table(wrapper).props('selectionCount')).toBe(2)

    action(wrapper, 'csv')!.onClick([])
    await flushPromises()

    expect(bulkExportCustomers).toHaveBeenCalledWith(
      { selection: { mode: 'ids', customerIds: ['a', 'c'] }, sortBy: 'name', sortOrder: 'asc' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(saveBlobAsFile).toHaveBeenCalledWith(expect.any(Blob), 'clientes-2026-11-27.csv')
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'success', description: 'clientes-2026-11-27.csv' }),
    )
  })

  it('offers «Seleccionar los N clientes del filtro» and then sends the filter without paging keys', async () => {
    mockState.total.value = 120
    mockState.globalFilter.value = 'ana'
    bulkExportCustomers.mockResolvedValue({ blob: new Blob(['x']), fileName: 'c.csv' })
    const wrapper = mount(CustomersView)
    await markRows(wrapper, { 0: true, 1: true, 2: true })

    const selectAll = wrapper.get('[data-testid="customers-bulk-select-filter"]')
    expect(selectAll.text()).toBe('Seleccionar los 120 clientes del filtro')
    await selectAll.trigger('click')
    expect(table(wrapper).props('selectionCount')).toBe(120)

    await markRows(wrapper, { 0: true, 2: true })
    expect(table(wrapper).props('selectionCount')).toBe(119)

    action(wrapper, 'csv')!.onClick([])
    await flushPromises()
    const body = bulkExportCustomers.mock.calls[0]![0]
    expect(body.selection).toEqual({ mode: 'filter', filter: { search: 'ana' }, excludeIds: ['b'] })
    for (const key of ['page', 'limit', 'sortBy', 'sortOrder']) expect(body.selection.filter).not.toHaveProperty(key)
  })

  it('disables «Estados de cuenta PDF» above 50 with «Máximo 50 clientes por descarga»', async () => {
    mockState.total.value = 51
    const wrapper = mount(CustomersView)
    await markRows(wrapper, { 0: true, 1: true, 2: true })
    await wrapper.get('[data-testid="customers-bulk-select-filter"]').trigger('click')
    expect(action(wrapper, 'statements')!.disabled).toBe(true)
    expect(action(wrapper, 'csv')!.disabled).toBe(false)
    expect(wrapper.get('[data-testid="customers-bulk-cap"]').text()).toContain('Máximo 50 clientes por descarga')
  })

  it('disables «Exportar CSV» above 10,000 with its explanation', async () => {
    mockState.total.value = 10_001
    const wrapper = mount(CustomersView)
    await markRows(wrapper, { 0: true, 1: true, 2: true })
    await wrapper.get('[data-testid="customers-bulk-select-filter"]').trigger('click')
    expect(action(wrapper, 'csv')!.disabled).toBe(true)
    expect(wrapper.get('[data-testid="customers-bulk-cap"]').text()).toContain('Máximo 10,000 clientes por exportación')
  })

  it('clears the selection when the search changes and on «Quitar selección»', async () => {
    const wrapper = mount(CustomersView)
    await markRows(wrapper, { 0: true })
    mockState.globalFilter.value = 'otro'
    await flushPromises()
    expect(table(wrapper).props('selectionCount')).toBe(0)

    await markRows(wrapper, { 1: true })
    table(wrapper).vm.$emit('clear-selection')
    await flushPromises()
    expect(table(wrapper).props('selectionCount')).toBe(0)
  })

  it('«Estados de cuenta PDF» opens the period dialog; its submit downloads the ZIP', async () => {
    bulkCustomerStatements.mockResolvedValue({ blob: new Blob(['PK']), fileName: 'e.zip' })
    const wrapper = mount(CustomersView)
    await markRows(wrapper, { 1: true })
    action(wrapper, 'statements')!.onClick([])
    await flushPromises()
    const dialog = wrapper.getComponent({ name: 'CustomerBulkDownloadDialog' })
    expect(dialog.props('open')).toBe(true)
    expect(dialog.props('kind')).toBe('statements')

    dialog.vm.$emit('submit', { from: '2026-11-01', to: '2026-12-01' })
    await flushPromises()
    expect(bulkCustomerStatements).toHaveBeenCalledWith(
      { selection: { mode: 'ids', customerIds: ['b'] }, from: '2026-11-01', to: '2026-12-01' },
      expect.anything(),
    )
    expect(dialog.props('open')).toBe(false)
  })

  it('404 → «Reintentar sin ellos» drops the missing customers and retries', async () => {
    bulkExportCustomers.mockRejectedValueOnce({
      response: { status: 404, data: { code: 'BULK_CUSTOMERS_NOT_FOUND', details: { missingIds: ['a'] } } },
    })
    bulkExportCustomers.mockResolvedValueOnce({ blob: new Blob(['x']), fileName: 'c.csv' })
    const wrapper = mount(CustomersView)
    await markRows(wrapper, { 0: true, 1: true })
    action(wrapper, 'csv')!.onClick([])
    await flushPromises()
    const dialog = wrapper.getComponent({ name: 'CustomerBulkDownloadDialog' })
    expect(dialog.props('error').message).toBe('1 cliente de la selección ya no existe.')
    expect(dialog.props('canRetryWithoutMissing')).toBe(true)

    dialog.vm.$emit('retry-without-missing')
    await flushPromises()
    expect(bulkExportCustomers.mock.calls[1]![0].selection).toEqual({ mode: 'ids', customerIds: ['b'] })
    expect(table(wrapper).props('selectionCount')).toBe(1)
  })
})
