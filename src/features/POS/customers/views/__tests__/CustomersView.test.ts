import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { columnLabel } from '@/core/shared/components/DataTable/columnLayout.utils'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import CustomersView from '../CustomersView.vue'
import type { CustomerListingRow } from '../../interfaces/customer-listing.types'

// customers-module T6: the rows come from GET /customers/listing.
type Customer = CustomerListingRow

// Row actions are asserted through the public `actions` prop of the shared
// RowActionsMenu (no Reka UI internals).
type RowActionItem = { key: string; label: string; destructive?: boolean }

// ── Mocks for composables that the view consumes ─────────────────────────────

const mockState = {
  pagination: ref({ pageIndex: 0, pageSize: 10 }),
  sorting: ref<Array<{ id: string; desc: boolean }>>([{ id: 'name', desc: false }]),
  globalFilter: ref(''),
  columnPinning: ref<{ left: string[]; right: string[] }>({ left: [], right: [] }),
  columnVisibility: ref<Record<string, boolean>>({}),
  columnOrder: ref<string[]>([]),
  columnSizing: ref<Record<string, number>>({}),
  density: ref('comfortable'),
  resetLayout: vi.fn(),
  rowSelection: ref({}),
  data: ref<Customer[]>([]),
  totalCount: ref(0),
  pageCount: ref(0),
  isLoading: ref(false),
  isFetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refresh: vi.fn(),
  pageSizeOptions: [10, 20, 50],
  showingFrom: ref(0),
  showingTo: ref(0),
}

vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: () => ({
    pagination: mockState.pagination,
    sorting: mockState.sorting,
    globalFilter: mockState.globalFilter,
    columnPinning: mockState.columnPinning,
    columnVisibility: mockState.columnVisibility,
    columnOrder: mockState.columnOrder,
    columnSizing: mockState.columnSizing,
    density: mockState.density,
    resetLayout: mockState.resetLayout,
    rowSelection: mockState.rowSelection,
    data: computed(() => mockState.data.value),
    response: computed(() => undefined),
    totalCount: computed(() => mockState.totalCount.value),
    pageCount: computed(() => mockState.pageCount.value),
    isLoading: computed(() => mockState.isLoading.value),
    isFetching: computed(() => mockState.isFetching.value),
    isError: computed(() => mockState.isError.value),
    error: computed(() => mockState.error.value),
    refresh: mockState.refresh,
    pageSizeOptions: mockState.pageSizeOptions,
    showingFrom: computed(() => mockState.showingFrom.value),
    showingTo: computed(() => mockState.showingTo.value),
  }),
}))

const customerAuthMock = {
  userCan: vi.fn(),
  currentTenantId: 'tenant-1',
}
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => customerAuthMock,
}))

const toastMock = { add: vi.fn() }
;(globalThis as { useToast?: () => typeof toastMock }).useToast = () => toastMock

vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: ref([]), isLoading: ref(false) }),
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), refetchQueries: vi.fn() }),
}))

// customers-module T4: the row, the name and «Ver historial de ventas» open the customer page.
const routerPush = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  useRoute: () => ({ path: '/pos/customers', query: {} }),
}))

vi.mock('../../components/CustomerPetsSlideover.vue', () => ({
  default: {
    name: 'CustomerPetsSlideover',
    template: '<div data-testid="pets-slideover" />',
    props: ['open', 'customer'],
    emits: ['update:open'],
  },
}))

vi.mock('../../components/CustomerUpsertSlideover.vue', () => ({
  default: {
    name: 'CustomerUpsertSlideover',
    template: '<div />',
    props: ['open', 'mode', 'loading', 'errors', 'customer', 'globalPriceLists', 'createdCategoryId', 'createdBrandId', 'showPets'],
    emits: ['create', 'edit', 'createAddress', 'updateAddress', 'removeAddress', 'close', 'requestCreateCategory', 'requestCreateBrand'],
  },
}))

vi.mock('@/core/shared/components/DataTable/SortableHeader.vue', () => ({
  default: {
    name: 'SortableHeader',
    template: '<button :data-column="column.id" :data-testid="`sortable-${column.id}`" @click="column.toggleSorting(column.getIsSorted() === \'asc\')">{{ label }}</button>',
    props: ['column', 'label'],
  },
}))

// Stub AppDataTable enough to expose props + slots for assertions. The four
// states against the REAL table live in CustomersView.states.spec.ts.
vi.mock('@/core/shared/components/DataTable/AppDataTable.vue', () => ({
  default: {
    name: 'AppDataTable',
    template: `
      <div
        data-testid="app-data-table"
        :data-display-mode="displayMode"
        :data-mobile-render="mobileRender"
        :data-error="error ? 'true' : 'false'"
        :data-error-message="errorMessage"
        :data-slots="Object.keys($slots).join(',')"
      >
        <div v-if="error" data-testid="table-error-state" role="alert">
          <p data-testid="error-message">{{ errorMessage }}</p>
          <button data-testid="table-error-retry" @click="$emit('refresh')">Reintentar</button>
        </div>
        <div v-else-if="(data ?? []).length === 0" data-testid="table-empty-state">{{ empty }}</div>
        <div v-else data-testid="table-data">
          <div v-for="row in data" :key="row.id" data-testid="table-row">
            <template v-for="column in columns" :key="column.id">
              <slot :name="column.id + '-header'" :column="{ id: column.id, getIsSorted: () => false, toggleSorting: () => {} }" />
            </template>
            <div data-testid="name-cell"><slot name="name-cell" :row="{ original: row }" /></div>
            <div data-testid="price-list-cell"><slot name="priceList-cell" :row="{ original: row }" /></div>
            <slot name="actions-cell" :row="{ original: row }" />
            <div data-testid="mobile-card-slot"><slot name="mobile-card" :row="row" /></div>
          </div>
        </div>
      </div>
    `,
    props: {
      columns: { default: () => [] },
      data: { default: () => [] },
      displayMode: { default: 'auto' },
      mobileRender: { default: 'table' },
      rowOpen: { default: undefined },
      emptyState: { default: undefined },
      filtered: { default: false },
      noMatchTitle: { default: undefined },
      error: { default: false },
      errorMessage: { default: 'No se pudieron cargar los datos.' },
      empty: { default: 'No se encontraron resultados' },
      portalClass: { default: undefined },
      paginationPortalClass: { default: undefined },
      globalFilter: { default: '' },
      sorting: { default: () => [] },
      pagination: { default: () => ({ pageIndex: 0, pageSize: 10 }) },
      showAddButton: { default: false },
      columnPinning: { default: undefined },
      columnVisibility: { default: undefined },
      columnOrder: { default: undefined },
      columnSizing: { default: undefined },
      density: { default: undefined },
      persistLayout: { default: false },
    },
    emits: [
      'add',
      'refresh',
      'empty-action',
      'clear-filters',
      'reset-columns',
      'update:globalFilter',
      'update:sorting',
      'update:pagination',
      'update:columnPinning',
      'update:columnVisibility',
      'update:columnOrder',
      'update:columnSizing',
      'update:density',
    ],
  },
}))

vi.mock('@/core/shared/components/ConfirmModal.vue', () => ({
  default: { name: 'ConfirmModal', template: '<div />', props: ['open', 'description', 'confirmLabel', 'confirmColor', 'loading', 'ui'], emits: ['update:open', 'confirm'] },
}))

// ── Sample data ──────────────────────────────────────────────────────────────

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    firstName: 'Juan',
    lastName: 'Pérez',
    fullName: 'Juan Pérez',
    businessName: null,
    phoneCountryCode: '+52',
    phone: '5512345678',
    email: 'juan@test.com',
    globalPriceListId: 'pl-1',
    globalPriceListName: 'Lista General',
    rfc: null,
    fiscalRegime: null,
    isTrusted: false,
    createdAt: '2024-01-15T00:00:00.000Z',
    primaryAddress: null,
    activePetsCount: 0,
    petSpecies: [],
    matchedPetName: null,
    ...overrides,
  }
}

// ── Reset mock state between tests ───────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
  mockState.pagination.value = { pageIndex: 0, pageSize: 10 }
  mockState.sorting.value = [{ id: 'name', desc: false }]
  mockState.globalFilter.value = ''
  mockState.columnPinning.value = { left: [], right: [] }
  mockState.columnVisibility.value = {}
  mockState.columnOrder.value = []
  mockState.columnSizing.value = {}
  mockState.density.value = 'comfortable'
  mockState.resetLayout.mockClear()
  mockState.rowSelection.value = {}
  mockState.data.value = []
  mockState.totalCount.value = 0
  mockState.pageCount.value = 0
  mockState.isLoading.value = false
  mockState.isFetching.value = false
  mockState.isError.value = false
  mockState.error.value = null
  mockState.refresh.mockClear()
  customerAuthMock.userCan.mockReset()
  customerAuthMock.userCan.mockReturnValue(true)
  toastMock.add.mockClear()
  routerPush.mockClear()
})

// ── S3: mobile density containment ─────────────────────────────────────────
describe('CustomersView — mobile density containment (S3)', () => {
  it('route root removes the duplicate mobile outer gutter while retaining desktop padding', () => {
    const wrapper = mount(CustomersView)
    const rootClasses = Array.from(wrapper.element.classList)

    // Design §1: Customers replaces unconditional `px-10` with
    // `w-full min-w-0 md:px-10`; the dashboard body stays the sole
    // mobile outer gutter. Class-level contract only — jsdom never
    // proves rendered geometry.
    expect(rootClasses).toEqual(expect.arrayContaining(['w-full', 'min-w-0', 'md:px-10']))
    expect(rootClasses).not.toContain('px-10')
  })

  it('contains the list surface and inner body to the available width', () => {
    const wrapper = mount(CustomersView)

    const tableEl = wrapper.get('[data-testid="app-data-table"]').element as HTMLElement
    const body = tableEl.parentElement as HTMLElement
    // Traversal: app-data-table -> inner body div -> UCard internal body
    // (ui.body classes) -> UCard root, which receives fallthrough classes.
    const surface = body.parentElement?.parentElement as HTMLElement

    expect(Array.from(surface.classList)).toEqual(
      expect.arrayContaining(['w-full', 'min-w-0', 'max-w-full', 'overflow-hidden', 'shadow-sm']),
    )

    const bodyClasses = Array.from(body.classList)
    expect(bodyClasses).toEqual(
      expect.arrayContaining(['w-full', 'min-w-0', 'px-3', 'py-3', 'sm:px-4', 'sm:py-4']),
    )
    expect(bodyClasses).not.toContain('px-6')
  })

  it('uses one list layout: table on desktop and cards on mobile, with the shared filters and no view toggle', () => {
    const wrapper = mount(CustomersView)
    const table = wrapper.get('[data-testid="app-data-table"]')

    expect(table.attributes('data-display-mode')).toBe('auto')
    expect(table.attributes('data-mobile-render')).toBe('cards')
    const slots = (table.attributes('data-slots') ?? '').split(',')
    // customers-module T6: the filters sheet and the sort select live in the toolbar, as in Ventas.
    expect(slots).toEqual(expect.arrayContaining(['mobile-card', 'name-cell', 'actions-cell', 'filters']))
    expect(slots).not.toContain('cards')
    expect(slots).not.toContain('actions')
    expect(wrapper.find('[data-testid="view-toggle"]').exists()).toBe(false)
    expect(wrapper.element.classList.contains('overflow-x-auto')).toBe(false)
  })

  // S3 (owner): the whole row opens the customer page for every reader, like Ventas and Productos.
  it('opens the customer page from the whole row, also for read-only roles, never the editor', async () => {
    customerAuthMock.userCan.mockReturnValue(false)
    const wrapper = mount(CustomersView)
    const rowOpen = wrapper.getComponent({ name: 'AppDataTable' }).props('rowOpen') as (c: Customer) => void
    expect(typeof rowOpen).toBe('function')
    rowOpen(makeCustomer({ id: 'cust-9' }))
    await flushPromises()
    expect(routerPush).toHaveBeenCalledWith({ name: 'pos-customer-detail', params: { id: 'cust-9' } })
    const editSlideover = wrapper.findAllComponents({ name: 'CustomerUpsertSlideover' })[1]!
    expect(editSlideover.props('open')).toBe(false)
  })
})

describe('CustomersView — error state', () => {
  it('renders the error block with a human title, never the backend message', async () => {
    mockState.isError.value = true
    mockState.error.value = {
      response: { data: { message: 'No se pudo conectar al servidor' } },
    }
    const wrapper = mount(CustomersView)
    await flushPromises()
    expect(wrapper.find('[data-testid="table-error-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'No se pudieron cargar los clientes',
    )
    expect(wrapper.text()).not.toContain('No se pudo conectar al servidor')
    // The empty placeholder must NOT render when there is an error.
    expect(wrapper.find('[data-testid="table-empty-state"]').exists()).toBe(false)
  })

  it.each([
    ['an error message', { message: 'Network Error' }],
    ['no error detail', {}],
  ])('keeps the same human title with %s', async (_label, error) => {
    mockState.isError.value = true
    mockState.error.value = error
    const wrapper = mount(CustomersView)
    await flushPromises()
    expect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'No se pudieron cargar los clientes',
    )
    expect(wrapper.text()).not.toContain('Network Error')
  })

  it('triggers refresh when the retry button is clicked', async () => {
    mockState.isError.value = true
    mockState.error.value = { response: { data: { message: 'Boom' } } }
    const wrapper = mount(CustomersView)
    await flushPromises()
    await wrapper.find('[data-testid="table-error-retry"]').trigger('click')
    expect(mockState.refresh).toHaveBeenCalled()
  })
})

describe('CustomersView — customer phone rendering', () => {
  it.each([
    ['52', '+52 55 8587 6245'],
    ['+52', '+52 55 8587 6245'],
    ['++52', '+52 55 8587 6245'],
    [null, '55 8587 6245'],
    ['', '55 8587 6245'],
    ['   ', '55 8587 6245'],
  ])('renders phone prefix %j as %j in the list row', async (phoneCountryCode, expected) => {
    mockState.data.value = [makeCustomer({ phoneCountryCode, phone: '5585876245' })]
    const wrapper = mount(CustomersView)
    await flushPromises()
    expect(wrapper.get('[data-testid="customer-phone"]').text()).toBe(expected)
    wrapper.unmount()
  })
})

describe('CustomersView — sortable headers', () => {
  // customers-module T6: only the columns GET /customers/listing can order by.
  it('mounts SortableHeader slots for the sortable columns only', async () => {
    mockState.data.value = [makeCustomer()]
    const wrapper = mount(CustomersView)
    await flushPromises()
    const sortable = wrapper.findAll('[data-testid^="sortable-"]').map((header) => header.attributes('data-column'))
    expect(sortable).toEqual([
      'name',
      'openDebt',
      'oldestOverdue',
      'lastPurchaseAt',
      'totalSold',
      'createdAt',
      'salesCount',
      'averageTicket',
    ])
  })
})

describe('CustomersView — row identity and mobile card', () => {
  it('shows the name as the primary text of the row with a neutral person avatar, never an id', async () => {
    mockState.data.value = [makeCustomer({ id: 'cust-secret-id' })]
    const wrapper = mount(CustomersView)
    await flushPromises()
    const cell = wrapper.get('[data-testid="name-cell"]')
    expect(cell.get('.hf-row-primary').text()).toBe('Juan Pérez')
    expect(cell.find('button.hf-row-primary').exists()).toBe(true)
    expect(cell.findComponent({ name: 'EntityAvatar' }).exists()).toBe(true)
    expect(wrapper.text()).not.toContain('cust-secret-id')
  })

  it('the name button opens the customer page, also when the role cannot update', async () => {
    customerAuthMock.userCan.mockReturnValue(false)
    mockState.data.value = [makeCustomer()]
    const wrapper = mount(CustomersView)
    await flushPromises()
    const cell = wrapper.get('[data-testid="name-cell"]')
    await cell.get('button.hf-row-primary').trigger('click')
    expect(routerPush).toHaveBeenCalledWith({ name: 'pos-customer-detail', params: { id: 'cust-1' } })
  })

  it('the mobile card opens the customer page', async () => {
    customerAuthMock.userCan.mockReturnValue(false)
    mockState.data.value = [makeCustomer()]
    const wrapper = mount(CustomersView)
    await flushPromises()
    const card = wrapper.getComponent({ name: 'CustomerMobileCard' })
    expect(card.props('openable')).toBe(true)
    card.vm.$emit('open', makeCustomer({ id: 'cust-7' }))
    await flushPromises()
    expect(routerPush).toHaveBeenCalledWith({ name: 'pos-customer-detail', params: { id: 'cust-7' } })
  })

  it('shows the price list as plain text and an em dash when absent (no legacy badge)', async () => {
    mockState.data.value = [makeCustomer(), makeCustomer({ id: 'c2', globalPriceListName: null })]
    const wrapper = mount(CustomersView)
    await flushPromises()
    const cells = wrapper.findAll('[data-testid="price-list-cell"]')
    expect(cells[0]!.text()).toBe('Lista General')
    expect(cells[1]!.text()).toBe('—')
    expect(wrapper.find('.clients-badge').exists()).toBe(false)
  })

  it('renders each customer as a mobile card with the same actions as the table row', async () => {
    mockState.data.value = [makeCustomer()]
    const wrapper = mount(CustomersView)
    await flushPromises()
    const card = wrapper.getComponent({ name: 'CustomerMobileCard' })
    expect(card.props('customer')).toEqual(makeCustomer())
    expect(card.props('openable')).toBe(true)
    const row = wrapper.get('[data-testid="table-row"]')
    const [tableMenu, cardMenu] = row.findAllComponents({ name: 'RowActionsMenu' })
    expect(cardMenu!.props('actions')).toEqual(tableMenu!.props('actions'))
  })
})

function rowActions(wrapper: ReturnType<typeof mount>, rowIndex = 0): RowActionItem[] {
  const row = wrapper.findAll('[data-testid="table-row"]')[rowIndex]
  const menu = row?.findComponent({ name: 'RowActionsMenu' })
  return (menu?.props('actions') as RowActionItem[] | undefined) ?? []
}

function selectRowAction(wrapper: ReturnType<typeof mount>, key: string, rowIndex = 0) {
  const row = wrapper.findAll('[data-testid="table-row"]')[rowIndex]!
  row.findComponent({ name: 'RowActionsMenu' }).vm.$emit('select', key)
}

describe('CustomersView — permission gating', () => {
  async function actionsFor(perm: (action: string, subject: string) => boolean) {
    customerAuthMock.userCan.mockImplementation(perm)
    mockState.data.value = [makeCustomer()]
    const wrapper = mount(CustomersView)
    await flushPromises()
    return rowActions(wrapper)
  }

  it('compact union: none / update / delete / read:Sale / update+delete', async () => {
    const none = await actionsFor(() => false)
    const upd = await actionsFor((a, s) => a === 'update' && s === 'Customer')
    const del = await actionsFor((a, s) => a === 'delete' && s === 'Customer')
    const sales = await actionsFor((a, s) => a === 'read' && s === 'Sale')
    const both = await actionsFor((a, s) =>
      (a === 'update' && s === 'Customer') || (a === 'delete' && s === 'Customer'),
    )

    expect(none).toHaveLength(0)
    expect(upd.map((i) => i.label)).toEqual(['Editar'])
    expect(upd.some((i) => i.destructive)).toBe(false)
    // Delete needs a confirmation, so its label ends in an ellipsis.
    expect(del.map((i) => i.label)).toEqual(['Eliminar…'])
    expect(del[0]?.destructive).toBe(true)
    // read:Sale alone must surface exactly the history action (S4 contract).
    expect(sales.map((i) => i.label)).toEqual(['Ver historial de ventas'])
    expect(both.map((i) => i.label)).toEqual(['Editar', 'Eliminar…'])
    expect(both[1]?.destructive).toBe(true)
  })

  it('puts the destructive action last, after edit and history', async () => {
    const all = await actionsFor(() => true)
    expect(all.map((i) => i.label)).toEqual([
      'Editar',
      'Mascotas',
      'Ver historial de ventas',
      'Eliminar…',
    ])
    expect(all[all.length - 1]?.destructive).toBe(true)
  })

  it('shows the create action in the empty state only with the create permission', () => {
    customerAuthMock.userCan.mockReturnValue(true)
    const allowed = mount(CustomersView)
    expect(allowed.getComponent({ name: 'AppDataTable' }).props('emptyState')).toMatchObject({
      title: 'Aún no hay clientes',
      actionLabel: 'Crear cliente',
    })
    customerAuthMock.userCan.mockReturnValue(false)
    const denied = mount(CustomersView)
    const emptyState = denied.getComponent({ name: 'AppDataTable' }).props('emptyState')
    expect(emptyState.title).toBe('Aún no hay clientes')
    expect(emptyState.actionLabel).toBeUndefined()
  })
})

// ── S4: sales history entry ──────────────────────────────────────────────────
describe('CustomersView — sales history entry (S4)', () => {
  it('exposes the history action on the mobile card when the role can read sales', async () => {
    customerAuthMock.userCan.mockImplementation(
      (action: string, subject: string) => action === 'read' && subject === 'Sale',
    )
    mockState.data.value = [makeCustomer()]
    const wrapper = mount(CustomersView)
    await flushPromises()
    const card = wrapper.getComponent({ name: 'CustomerMobileCard' })
    expect((card.props('actions') as RowActionItem[]).map((a) => a.label)).toEqual(['Ver historial de ventas'])
  })

  it('table history action opens the customer page on the «Ventas» tab', async () => {
    customerAuthMock.userCan.mockImplementation(
      (action: string, subject: string) => action === 'read' && subject === 'Sale',
    )
    const customerB = makeCustomer({ id: 'cust-B', fullName: 'Bea B' })
    mockState.data.value = [customerB]
    const wrapper = mount(CustomersView)
    await flushPromises()
    expect(rowActions(wrapper).map((i) => i.key)).toEqual(['history'])
    selectRowAction(wrapper, 'history')
    await flushPromises()
    expect(routerPush).toHaveBeenCalledWith({
      name: 'pos-customer-detail',
      params: { id: 'cust-B' },
      query: { tab: 'ventas' },
    })
    const [createSlideover, editSlideover] = wrapper.findAllComponents({ name: 'CustomerUpsertSlideover' })
    expect(editSlideover!.props('open')).toBe(false)
    expect(createSlideover!.props('open')).toBe(false)
  })

  it('the mobile card history action forwards the card identity unchanged', async () => {
    customerAuthMock.userCan.mockImplementation(
      (action: string, subject: string) => action === 'read' && subject === 'Sale',
    )
    const customerB = makeCustomer({ id: 'cust-B', fullName: 'Bea B' })
    mockState.data.value = [customerB]
    const wrapper = mount(CustomersView)
    await flushPromises()
    wrapper.getComponent({ name: 'CustomerMobileCard' }).vm.$emit('action', 'history', customerB)
    await flushPromises()
    expect(routerPush).toHaveBeenCalledWith({
      name: 'pos-customer-detail',
      params: { id: 'cust-B' },
      query: { tab: 'ventas' },
    })
  })
})


describe('Customers main workspace visual boundary', () => {
  it('opts in only the listing, keeps overlays outside and moves the title above the panel', () => {
    const wrapper = mount(CustomersView)
    const workspace = wrapper.get('.clients-visual')
    expect(workspace.classes()).toEqual(expect.arrayContaining(['hf-theme', 'hf-ui']))
    expect(workspace.get('h1').text()).toBe('Clientes')
    // Text diet: the title says it, so there is no subtitle.
    expect(workspace.find('.hf-page-subtitle').exists()).toBe(false)
    expect(workspace.get('h1').element.closest('.hf-table-surface')).toBeNull()
    expect(workspace.findComponent({ name: 'CustomerUpsertSlideover' }).exists()).toBe(false)
    expect(workspace.findComponent({ name: 'ConfirmModal' }).exists()).toBe(false)
    expect(workspace.get('[data-testid="app-data-table"]').classes()).toContain('hf-data-table')
  })

  it('owns list and row portals without borrowing the Products marker', () => {
    mockState.data.value = [makeCustomer()]
    const wrapper = mount(CustomersView)
    const portalClass = 'hf-theme hf-ui clients-list-portal'
    expect(wrapper.getComponent({ name: 'AppDataTable' }).props('portalClass')).toBe(portalClass)
    expect(wrapper.getComponent({ name: 'AppDataTable' }).props('paginationPortalClass')).toBe(portalClass)
    const [tableMenu] = wrapper.findAllComponents({ name: 'RowActionsMenu' })
    expect(tableMenu!.props('portalClass')).toBe('clients-list-portal')
    expect(wrapper.getComponent({ name: 'CustomerMobileCard' }).props('portalClass')).toBe('clients-list-portal')
  })

  it('hands the empty, no-match and error states to the shared table without masking errors', async () => {
    const wrapper = mount(CustomersView)
    const table = wrapper.getComponent({ name: 'AppDataTable' })
    expect(table.props('emptyState')).toMatchObject({ title: 'Aún no hay clientes' })
    expect(table.props('filtered')).toBe(false)
    mockState.globalFilter.value = 'zzz'
    await flushPromises()
    expect(table.props('filtered')).toBe(true)
    expect(table.props('noMatchTitle')).toBe('Ningún resultado para «zzz»')
    mockState.isError.value = true
    await flushPromises()
    expect(wrapper.find('[data-testid="table-empty-state"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-error-state"]').exists()).toBe(true)
  })

  it('clears the search from the no-match action and creates from the empty action', async () => {
    const wrapper = mount(CustomersView)
    const table = wrapper.getComponent({ name: 'AppDataTable' })
    mockState.globalFilter.value = 'zzz'
    mockState.pagination.value = { pageIndex: 3, pageSize: 10 }
    table.vm.$emit('clear-filters')
    await flushPromises()
    expect(mockState.globalFilter.value).toBe('')
    expect(mockState.pagination.value.pageIndex).toBe(0)
    table.vm.$emit('empty-action')
    await flushPromises()
    expect(wrapper.findAllComponents({ name: 'CustomerUpsertSlideover' })[0]!.props('open')).toBe(true)
  })

  it('preserves search, sorting, pagination and create-permission bindings', async () => {
    customerAuthMock.userCan.mockReturnValue(false)
    const wrapper = mount(CustomersView)
    const table = wrapper.getComponent({ name: 'AppDataTable' })
    expect(table.props('showAddButton')).toBe(false)
    table.vm.$emit('update:globalFilter', 'Juan')
    table.vm.$emit('update:sorting', [{ id: 'email', desc: true }])
    table.vm.$emit('update:pagination', { pageIndex: 2, pageSize: 20 })
    await flushPromises()
    expect(mockState.globalFilter.value).toBe('Juan')
    expect(mockState.sorting.value).toEqual([{ id: 'email', desc: true }])
    expect(mockState.pagination.value).toEqual({ pageIndex: 2, pageSize: 20 })
  })
})

// ── S1-S3: deletion confirmation opt-in ──────────────────────────────────────
describe('CustomersView — delete confirmation opt-in (S1-S3)', () => {
  const overlayMarker = 'hf-theme hf-ui hf-form-overlay clients-form-portal'

  it('forwards the form-portal content marker while keeping destructive semantics', async () => {
    customerAuthMock.userCan.mockReturnValue(true)
    mockState.data.value = [makeCustomer()]
    const wrapper = mount(CustomersView)
    await flushPromises()

    const confirm = wrapper.findComponent({ name: 'ConfirmModal' })
    expect(confirm.exists()).toBe(true)
    // Public `ui` prop contract: content root opts into the Clients palette.
    expect(confirm.props('ui')).toEqual({ content: overlayMarker })
    // Semantic confirm color, label and loading wiring stay untouched.
    expect(confirm.props('confirmColor')).toBe('error')
    expect(confirm.props('confirmLabel')).toBe('Eliminar')
    expect(confirm.props('loading')).toBe(false)
  })

  it('keeps the destructive prompt description and close wiring intact', async () => {
    customerAuthMock.userCan.mockReturnValue(true)
    mockState.data.value = [makeCustomer({ id: 'cust-A', fullName: 'Ana Álvarez' })]
    const wrapper = mount(CustomersView)
    await flushPromises()

    const confirm = wrapper.findComponent({ name: 'ConfirmModal' })
    expect(rowActions(wrapper).map((item) => item.key)).toContain('delete')
    selectRowAction(wrapper, 'delete')
    await flushPromises()

    expect(confirm.props('open')).toBe(true)
    expect(confirm.props('description')).toContain('Ana Álvarez')
    expect(confirm.props('confirmColor')).toBe('error')

    confirm.vm.$emit('update:open', false)
    await flushPromises()
    expect(confirm.props('open')).toBe(false)
  })
})

describe('CustomersView — column layout (premium tables T9)', () => {
  // customers-module T6: the layout persists under a new key (other columns) and, as in Ventas, the
  // views bar reports layout changes, so there is no «Guardado en tu vista» pill (persist-layout off).
  it('binds the persisted layout (pos-customers-listing) and «Restablecer columnas»', async () => {
    const composable = readFileSync(resolve(__dirname, '../../composables/useCustomersListing.ts'), 'utf8')
    expect(composable).toContain("persistKey: 'pos-customers-listing'")
    const wrapper = mount(CustomersView)
    const table = wrapper.getComponent({ name: 'AppDataTable' })
    expect(table.props()).toMatchObject({
      persistLayout: false,
      columnPinning: { left: [], right: [] },
      columnVisibility: {},
      columnOrder: [],
      columnSizing: {},
      density: 'comfortable',
    })

    table.vm.$emit('update:columnOrder', ['email', 'name'])
    table.vm.$emit('update:columnSizing', { name: 300 })
    table.vm.$emit('update:columnPinning', { left: ['name'], right: ['actions'] })
    table.vm.$emit('update:columnVisibility', { email: false })
    table.vm.$emit('update:density', 'compact')
    expect(mockState.columnOrder.value).toEqual(['email', 'name'])
    expect(mockState.columnSizing.value).toEqual({ name: 300 })
    expect(mockState.columnPinning.value).toEqual({ left: ['name'], right: ['actions'] })
    expect(mockState.columnVisibility.value).toEqual({ email: false })
    expect(mockState.density.value).toBe('compact')

    table.vm.$emit('reset-columns')
    expect(mockState.resetLayout).toHaveBeenCalledTimes(1)
  })

  it('names every column for the «Columnas» panel, never with its id', () => {
    const table = mount(CustomersView).getComponent({ name: 'AppDataTable' })
    const labels = (table.props('columns') as Parameters<typeof columnLabel>[0][]).map(columnLabel)
    // customers-bulk-actions: the locked selection column comes first when a bulk action exists.
    expect(labels).toEqual([
      'Selección',
      'Cliente',
      'Deuda',
      'Vencido desde',
      'Última compra',
      'Total comprado',
      'Mascotas',
      'Lista de precios',
      'Correo',
      'Colonia y ciudad',
      'RFC',
      'Alta',
      'Compras',
      'Ticket promedio',
      'De confianza',
      'Acciones',
    ])
  })
})

// ── Customer pets (handoff 27): «Mascotas» entry, listing needs read:Customer ──
describe('CustomersView — Mascotas entry', () => {
  it('offers «Mascotas» only with read:Customer and opens the pets slideover for that customer', async () => {
    customerAuthMock.userCan.mockImplementation(() => false)
    mockState.data.value = [makeCustomer()]
    const denied = mount(CustomersView)
    await flushPromises()
    expect(rowActions(denied).map((i) => i.key)).not.toContain('pets')

    customerAuthMock.userCan.mockImplementation(
      (action: string, subject: string) => action === 'read' && subject === 'Customer',
    )
    const customerB = makeCustomer({ id: 'cust-B', fullName: 'Bea B' })
    mockState.data.value = [customerB]
    const wrapper = mount(CustomersView)
    await flushPromises()
    expect(rowActions(wrapper).map((i) => i.key)).toEqual(['pets'])
    selectRowAction(wrapper, 'pets')
    await flushPromises()
    const slideover = wrapper.getComponent({ name: 'CustomerPetsSlideover' })
    expect(slideover.props('open')).toBe(true)
    expect(slideover.props('customer')).toMatchObject({ id: 'cust-B', fullName: 'Bea B' })
  })

  it('opts the edit card into the «Mascotas» tab, never the create form', async () => {
    const wrapper = mount(CustomersView)
    await flushPromises()
    const [create, edit] = wrapper.findAllComponents({ name: 'CustomerUpsertSlideover' })
    expect(create!.props('showPets')).toBeFalsy()
    expect(edit!.props('showPets')).toBe(true)
  })
})
