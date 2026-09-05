import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import CustomersView from '../CustomersView.vue'
import type { Customer } from '../../interfaces/customer.types'

// Typed helper: rows use the dropdown `items` prop contract as the public
// surface for kebab assertions (no Reka UI internals).
type KebabItem = {
  label: string
  color?: string
  onSelect?: () => void
}

// ── Mocks for composables that the view consumes ─────────────────────────────

const mockState = {
  pagination: ref({ pageIndex: 0, pageSize: 10 }),
  sorting: ref<Array<{ id: string; desc: boolean }>>([{ id: 'fullName', desc: false }]),
  globalFilter: ref(''),
  columnPinning: ref({ left: [], right: [] }),
  columnVisibility: ref<Record<string, boolean>>({}),
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
    rowSelection: mockState.rowSelection,
    data: computed(() => mockState.data.value),
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

vi.mock('../../components/CustomerSalesHistorySlideover.vue', () => ({
  default: {
    name: 'CustomerSalesHistorySlideover',
    template: '<div data-testid="history-slideover" :data-open="String(open)" :data-customer="customer?.id ?? \'null\'" @click="$emit(\'update:open\', false)" />',
    props: ['open', 'customer'],
    emits: ['update:open'],
  },
}))

vi.mock('../../components/CustomerUpsertSlideover.vue', () => ({
  default: {
    name: 'CustomerUpsertSlideover',
    template: '<div />',
    props: ['open', 'mode', 'loading', 'errors', 'customer', 'globalPriceLists', 'createdCategoryId', 'createdBrandId'],
    emits: ['create', 'edit', 'createAddress', 'updateAddress', 'removeAddress', 'close', 'requestCreateCategory', 'requestCreateBrand'],
  },
}))

vi.mock('../../components/CustomerCardGrid.vue', () => ({
  default: {
    name: 'CustomerCardGrid',
    template:
      '<div data-testid="customer-card-grid"><slot /></div>',
    props: ['customers', 'loading', 'empty', 'canUpdate', 'canDelete', 'canReadSales'],
    emits: ['card-click', 'edit', 'delete', 'view-history'],
  },
}))

vi.mock('@/core/shared/components/DataTable/SortableHeader.vue', () => ({
  default: {
    name: 'SortableHeader',
    template: '<button :data-column="column.id" :data-testid="`sortable-${column.id}`" @click="column.toggleSorting(column.getIsSorted() === \'asc\')">{{ label }}</button>',
    props: ['column', 'label'],
  },
}))

vi.mock('@/core/shared/components/ViewToggle.vue', () => ({
  default: {
    name: 'ViewToggle',
    template:
      '<div data-testid="view-toggle"><button data-testid="view-toggle-table" @click="$emit(\'update:modelValue\', \'table\')">Tabla</button><button data-testid="view-toggle-card" @click="$emit(\'update:modelValue\', \'card\')">Tarjetas</button></div>',
    props: ['modelValue', 'options', 'ariaLabel'],
    emits: ['update:modelValue'],
  },
}))

// Stub AppDataTable enough to expose props + slots for assertions.
vi.mock('@/core/shared/components/DataTable/AppDataTable.vue', () => ({
  default: {
    name: 'AppDataTable',
    template: `
      <div
        data-testid="app-data-table"
        :data-display-mode="displayMode"
        :data-error="error ? 'true' : 'false'"
        :data-error-message="errorMessage"
      >
        <slot name="actions" />
        <slot name="cards" />
        <div v-if="error" data-testid="table-error-state" role="alert">
          <p data-testid="error-message">{{ errorMessage }}</p>
          <button data-testid="table-error-retry" @click="$emit('refresh')">Reintentar</button>
        </div>
        <div v-else-if="(data ?? []).length === 0" data-testid="table-empty-state">{{ empty }}</div>
        <div v-else data-testid="table-data">
          <div v-for="row in data" :key="row.id">
            <slot name="fullName-header" :column="{ id: 'fullName', getIsSorted: () => false, toggleSorting: () => {} }" />
            <slot name="email-header" :column="{ id: 'email', getIsSorted: () => false, toggleSorting: () => {} }" />
            <slot name="phone-header" :column="{ id: 'phone', getIsSorted: () => false, toggleSorting: () => {} }" />
            <slot name="globalPriceListName-header" :column="{ id: 'globalPriceListName', getIsSorted: () => false, toggleSorting: () => {} }" />
            <slot name="actions-cell" :row="{ original: row }" />
          </div>
        </div>
      </div>
    `,
    props: {
      columns: { default: () => [] },
      data: { default: () => [] },
      displayMode: { default: 'auto' },
      error: { default: false },
      errorMessage: { default: 'No se pudieron cargar los datos. Reintenta.' },
      empty: { default: 'No se encontraron resultados' },
    },
    emits: ['add', 'refresh'],
  },
}))

vi.mock('@/core/shared/components/DataTable/SelectColumn.vue', () => ({
  default: { name: 'SelectColumn', template: '<span />', props: ['mode', 'table', 'row'] },
}))

vi.mock('@/core/shared/components/AppBadge.vue', () => ({
  default: { name: 'AppBadge', template: '<span><slot /></span>', props: ['label', 'value', 'tone', 'icon', 'variant'] },
}))

vi.mock('@/core/shared/components/ConfirmModal.vue', () => ({
  default: { name: 'ConfirmModal', template: '<div />', props: ['open', 'description', 'confirmLabel', 'confirmColor', 'loading'], emits: ['update:open', 'confirm'] },
}))

vi.mock('@/core/shared/components/DataTable/TableHeaderDescription.vue', () => ({
  default: { name: 'TableHeaderDescription', template: '<div data-testid="table-header-description"><slot /></div>', props: ['title', 'description'] },
}))

// Stub Nuxt UI primitives used by CustomersView directly (UDropdownMenu
// in the actions-cell slot, UButton in the kebab trigger).
vi.mock('@nuxt/ui', () => ({
  UDropdownMenu: {
    name: 'UDropdownMenu',
    template: '<div data-testid="kebab-menu"><slot /></div>',
    props: ['items', 'content'],
    emits: ['select'],
  },
  UButton: {
    name: 'UButton',
    template:
      '<button v-bind="$attrs" @click="$emit(\'click\')" :data-testid="$attrs[\'data-testid\']"><slot /></button>',
    emits: ['click'],
  },
  UIcon: { name: 'UIcon', template: '<span />', props: ['name'] },
  UModal: { name: 'UModal', template: '<div><slot name="body" /><slot name="footer" /></div>', props: ['open', 'title', 'content'] },
}))

// The template auto-imports UDropdownMenu/UButton from the package subpaths;
// mock those so the kebab `items` are assertable via findAllComponents
// without Reka UI internals.
vi.mock('@nuxt/ui/components/DropdownMenu.vue', () => ({
  default: { name: 'UDropdownMenu', template: '<div data-testid="kebab-menu"><slot /></div>', props: ['items', 'content'], emits: ['select'] },
}))
vi.mock('@nuxt/ui/components/Button.vue', () => ({
  default: { name: 'UButton', template: '<button v-bind="$attrs"><slot /></button>', props: ['icon', 'color', 'variant'], emits: ['click'] },
}))
vi.mock('@nuxt/ui/runtime/components/DropdownMenu.vue', () => ({
  default: { name: 'UDropdownMenu', template: '<div data-testid="kebab-menu"><slot /></div>', props: ['items', 'content'], emits: ['select'] },
}))
vi.mock('@nuxt/ui/runtime/components/Button.vue', () => ({
  default: { name: 'UButton', template: '<button v-bind="$attrs"><slot /></button>', props: ['icon', 'color', 'variant'], emits: ['click'] },
}))

// ── Sample data ──────────────────────────────────────────────────────────────

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    firstName: 'Juan',
    lastName: 'Pérez',
    fullName: 'Juan Pérez',
    phoneCountryCode: '+52',
    phone: '5512345678',
    email: 'juan@test.com',
    globalPriceListId: 'pl-1',
    globalPriceListName: 'Lista General',
    comments: null,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    ...overrides,
  }
}

// ── Reset mock state between tests ───────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
  mockState.pagination.value = { pageIndex: 0, pageSize: 10 }
  mockState.sorting.value = [{ id: 'fullName', desc: false }]
  mockState.globalFilter.value = ''
  mockState.columnPinning.value = { left: [], right: [] }
  mockState.columnVisibility.value = {}
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
})

describe('CustomersView — error state', () => {
  it('renders the error block with the backend-derived message when isError is true', async () => {
    mockState.isError.value = true
    mockState.error.value = {
      response: { data: { message: 'No se pudo conectar al servidor' } },
    }
    const wrapper = mount(CustomersView)
    await flushPromises()
    expect(wrapper.find('[data-testid="table-error-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'No se pudo conectar al servidor',
    )
    // The empty placeholder must NOT render when there is an error.
    expect(wrapper.find('[data-testid="table-empty-state"]').exists()).toBe(false)
  })

  it('falls back to error.message when the backend message is missing', async () => {
    mockState.isError.value = true
    mockState.error.value = { message: 'Network Error' }
    const wrapper = mount(CustomersView)
    await flushPromises()
    expect(wrapper.find('[data-testid="error-message"]').text()).toBe('Network Error')
  })

  it('falls back to the Spanish message when nothing else is available', async () => {
    mockState.isError.value = true
    mockState.error.value = {}
    const wrapper = mount(CustomersView)
    await flushPromises()
    expect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'No se pudieron cargar los clientes. Reintenta.',
    )
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

describe('CustomersView — sortable headers', () => {
  it('mounts SortableHeader slots for fullName, email, phone, globalPriceListName', async () => {
    mockState.data.value = [makeCustomer()]
    const wrapper = mount(CustomersView)
    await flushPromises()
    expect(wrapper.find('[data-testid="sortable-fullName"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sortable-email"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sortable-phone"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sortable-globalPriceListName"]').exists()).toBe(true)
  })
})

describe('CustomersView — view mode', () => {
  it('renders ViewToggle in the toolbar actions slot', async () => {
    const wrapper = mount(CustomersView)
    await flushPromises()
    expect(wrapper.find('[data-testid="view-toggle"]').exists()).toBe(true)
  })

  it('passes display-mode="table" by default', async () => {
    const wrapper = mount(CustomersView)
    await flushPromises()
    expect(wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe('table')
  })

  it('passes display-mode="cards" after toggling to card mode', async () => {
    localStorage.setItem('customers-view-mode', 'card')
    const wrapper = mount(CustomersView)
    await flushPromises()
    expect(wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe('cards')
  })
})

function rowKebabGroups(wrapper: ReturnType<typeof mount>): Array<Array<KebabItem>> {
  const kebabs = wrapper.findAllComponents({ name: 'UDropdownMenu' })
  if (kebabs.length === 0) return []
  return (kebabs[0]!.props('items') as Array<Array<KebabItem>> | undefined) ?? []
}

function rowKebabForIndex(wrapper: ReturnType<typeof mount>, rowIndex: number): KebabItem[] {
  const dropdowns = wrapper.findAllComponents({ name: 'UDropdownMenu' })
  const items = dropdowns[rowIndex]?.props('items') as Array<Array<KebabItem>> | undefined
  return (items ?? []).flat()
}

function flatRowKebabItems(wrapper: ReturnType<typeof mount>): KebabItem[] {
  return rowKebabGroups(wrapper).flat()
}

describe('CustomersView — permission gating', () => {
  // The kebab PUBLIC `items` prop contract is the only surface we assert
  // against; Reka UI internals (reka-dropdown-menu-trigger) are not checked.
  async function rowKebabFor(
    perm: (action: string, subject: string) => boolean,
  ): Promise<{ flat: KebabItem[]; groups: Array<Array<KebabItem>> }> {
    customerAuthMock.userCan.mockImplementation(perm)
    mockState.data.value = [makeCustomer()]
    const wrapper = mount(CustomersView)
    await flushPromises()
    return { flat: flatRowKebabItems(wrapper), groups: rowKebabGroups(wrapper) }
  }

  it('compact union: none / update / delete / read:Sale / update+delete', async () => {
    const none = await rowKebabFor(() => false)
    const upd = await rowKebabFor((a, s) => a === 'update' && s === 'Customer')
    const del = await rowKebabFor((a, s) => a === 'delete' && s === 'Customer')
    const sales = await rowKebabFor((a, s) => a === 'read' && s === 'Sale')
    const both = await rowKebabFor((a, s) =>
      (a === 'update' && s === 'Customer') || (a === 'delete' && s === 'Customer'),
    )

    expect(none.flat).toHaveLength(0)
    expect(upd.flat.map((i) => i.label)).toEqual(['Editar'])
    expect(upd.flat.some((i) => i.color === 'error')).toBe(false)
    expect(del.flat.map((i) => i.label)).toEqual(['Eliminar'])
    expect(del.flat[0]?.color).toBe('error')
    // read:Sale alone must surface exactly the history action (S4 contract).
    expect(sales.flat.map((i) => i.label)).toEqual(['Ver historial de ventas'])
    expect(both.groups).toHaveLength(2)
    expect(both.groups[0]?.map((i) => i.label)).toEqual(['Editar'])
    expect(both.groups[1]?.map((i) => i.label)).toEqual(['Eliminar'])
    expect(both.groups[1]?.[0]?.color).toBe('error')
  })

  it('omits the row kebab when no permission is granted (none)', async () => {
    const { flat } = await rowKebabFor(() => false)
    expect(flat).toHaveLength(0)
  })
})

describe('CustomersView — card slot', () => {
  it('renders the CustomerCardGrid inside the cards slot', async () => {
    mockState.data.value = [makeCustomer()]
    localStorage.setItem('customers-view-mode', 'card')
    const wrapper = mount(CustomersView)
    await flushPromises()
    // When display-mode="cards" the AppDataTable renders the #cards slot
    // which mounts CustomerCardGrid.
    expect(wrapper.find('[data-testid="customer-card-grid"]').exists()).toBe(true)
  })
})

// ── S4: sales history entry ──────────────────────────────────────────────────
describe('CustomersView — sales history entry (S4)', () => {
  it('passes canReadSales to CustomerCardGrid', async () => {
    customerAuthMock.userCan.mockImplementation(
      (action: string, subject: string) => action === 'read' && subject === 'Sale',
    )
    mockState.data.value = [makeCustomer()]
    localStorage.setItem('customers-view-mode', 'card')
    const wrapper = mount(CustomersView)
    await flushPromises()
    const grid = wrapper.findComponent({ name: 'CustomerCardGrid' })
    expect(grid.exists()).toBe(true)
    expect(grid.props('canReadSales')).toBe(true)
  })

  it('history slideover is closed by default', async () => {
    const wrapper = mount(CustomersView)
    await flushPromises()
    const slideover = wrapper.findComponent({ name: 'CustomerSalesHistorySlideover' })
    expect(slideover.exists()).toBe(true)
    expect(slideover.props('open')).toBe(false)
    expect(slideover.props('customer')).toBeNull()
  })

  it('table history action opens the slideover with the selected customer (identity preserved)', async () => {
    customerAuthMock.userCan.mockImplementation(
      (action: string, subject: string) => action === 'read' && subject === 'Sale',
    )
    const customerB = makeCustomer({ id: 'cust-B', fullName: 'Bea B' })
    mockState.data.value = [customerB]
    const wrapper = mount(CustomersView)
    await flushPromises()
    const history = flatRowKebabItems(wrapper).find((i) => i.label === 'Ver historial de ventas')
    expect(history).toBeDefined()
    history!.onSelect!()
    await flushPromises()
    const slideover = wrapper.findComponent({ name: 'CustomerSalesHistorySlideover' })
    expect(slideover.props('open')).toBe(true)
    expect(slideover.props('customer')).toEqual(customerB)
  })

  it('closes history via update:open without opening edit/detail and preserves selected-customer identity across reopen', async () => {
    customerAuthMock.userCan.mockImplementation((action, subject) =>
      action === 'read' && subject === 'Sale',
    )
    const customerA = makeCustomer({ id: 'cust-A', fullName: 'Ana Álvarez' })
    const customerB = makeCustomer({ id: 'cust-B', fullName: 'Bruno Beto' })
    mockState.data.value = [customerA, customerB]

    const wrapper = mount(CustomersView)
    await flushPromises()

    const upsertSlideoverWrappers = wrapper.findAllComponents({ name: 'CustomerUpsertSlideover' })
    expect(upsertSlideoverWrappers).toHaveLength(2)
    const createSlideover = upsertSlideoverWrappers[0]!
    const editSlideover = upsertSlideoverWrappers[1]!
    const historySlideover = () => wrapper.findComponent({ name: 'CustomerSalesHistorySlideover' })

    const historyA = rowKebabForIndex(wrapper, 0).find(
      (item) => item.label === 'Ver historial de ventas',
    )
    expect(historyA).toBeDefined()
    historyA?.onSelect?.()
    await flushPromises()

    expect(historySlideover().props('open')).toBe(true)
    expect(historySlideover().props('customer')).toEqual(customerA)
    expect(editSlideover.props('open')).toBe(false)
    expect(createSlideover.props('open')).toBe(false)

    historySlideover().vm.$emit('update:open', false)
    await flushPromises()

    expect(historySlideover().props('open')).toBe(false)
    expect(editSlideover.props('open')).toBe(false)
    expect(createSlideover.props('open')).toBe(false)

    const historyB = rowKebabForIndex(wrapper, 1).find(
      (item) => item.label === 'Ver historial de ventas',
    )
    expect(historyB).toBeDefined()
    historyB?.onSelect?.()
    await flushPromises()

    expect(historySlideover().props('open')).toBe(true)
    expect(historySlideover().props('customer')).toEqual(customerB)
    expect(editSlideover.props('open')).toBe(false)
    expect(createSlideover.props('open')).toBe(false)
  })

  it('grid view-history forwards the card identity unchanged', async () => {
    customerAuthMock.userCan.mockImplementation(
      (action: string, subject: string) => action === 'read' && subject === 'Sale',
    )
    const customerB = makeCustomer({ id: 'cust-B', fullName: 'Bea B' })
    mockState.data.value = [customerB]
    localStorage.setItem('customers-view-mode', 'card')
    const wrapper = mount(CustomersView)
    await flushPromises()
    const grid = wrapper.findComponent({ name: 'CustomerCardGrid' })
    grid.vm.$emit('view-history', customerB)
    await flushPromises()
    const slideover = wrapper.findComponent({ name: 'CustomerSalesHistorySlideover' })
    expect(slideover.props('open')).toBe(true)
    expect(slideover.props('customer')).toEqual(customerB)
  })
})
