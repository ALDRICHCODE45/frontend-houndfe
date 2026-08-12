// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import AdminUsersView from '../AdminUsersView.vue'
import type { UserTableRow } from '../../interfaces/user.types'

// ── Mocks for composables that the view consumes ─────────────────────────────

const mockState = {
  pagination: ref({ pageIndex: 0, pageSize: 10 }),
  sorting: ref<Array<{ id: string; desc: boolean }>>([{ id: 'name', desc: false }]),
  globalFilter: ref(''),
  columnPinning: ref({ left: [], right: ['actions'] }),
  columnVisibility: ref<Record<string, boolean>>({}),
  rowSelection: ref({}),
  data: ref<UserTableRow[]>([]),
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

const authMock = {
  userCan: vi.fn(),
  currentTenantId: 'tenant-1',
  currentTenant: { name: 'Acme Tenant' },
}
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authMock,
}))

const toastMock = { add: vi.fn() }
;(globalThis as { useToast?: () => typeof toastMock }).useToast = () => toastMock

vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: ref([]), isLoading: ref(false) }),
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), refetchQueries: vi.fn() }),
}))

vi.mock('../../components/UserUpsertSlideover.vue', () => ({
  default: {
    name: 'UserUpsertSlideover',
    template:
      '<div :data-testid="`user-upsert-slideover-${mode}`" :data-mode="mode" :data-user-id="user && user.id"></div>',
    props: ['open', 'mode', 'user', 'loading'],
    emits: ['create', 'edit', 'close'],
  },
}))

vi.mock('../../components/UserCardGrid.vue', () => ({
  default: {
    name: 'UserCardGrid',
    template: `
      <div data-testid="user-card-grid">
        <button
          v-for="user in users"
          :key="user.id"
          :data-testid="'card-' + user.id"
          @click="$emit('card-click', user)"
        >
          {{ user.name }}
        </button>
      </div>
    `,
    props: ['users', 'loading', 'empty'],
    emits: ['card-click'],
  },
}))

vi.mock('../../composables/useUserColumns', () => ({
  useUserColumns: () => ({ columns: [] }),
}))

vi.mock('@/core/shared/components/DataTable/SortableHeader.vue', () => ({
  default: {
    name: 'SortableHeader',
    template:
      '<button :data-column="column.id" :data-testid="`sortable-${column.id}`" @click="column.toggleSorting(column.getIsSorted() === \'asc\')">{{ label }}</button>',
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
        :data-column-visibility="String(enableColumnVisibility)"
        :data-error="error ? 'true' : 'false'"
        :data-error-message="errorMessage"
      >
        <slot name="actions" />
        <slot name="cards" />
        <div v-if="error" data-testid="table-error-state" role="alert">
          <p data-testid="error-message">{{ errorMessage }}</p>
          <button data-testid="table-error-retry" @click="$emit('refresh')">Reintentar</button>
        </div>
        <div v-else-if="(Array.isArray(data) ? data : []).length === 0" data-testid="table-empty-state">{{ empty }}</div>
        <div v-else data-testid="table-data">
          <div v-for="row in (Array.isArray(data) ? data : [])" :key="row.id">
            <slot name="name-header" :column="{ id: 'name', getIsSorted: () => false, toggleSorting: () => {} }" />
            <slot name="email-header" :column="{ id: 'email', getIsSorted: () => false, toggleSorting: () => {} }" />
            <slot name="actions-cell" :row="{ original: row }" />
          </div>
        </div>
      </div>
    `,
    props: {
      columns: { default: () => [] },
      data: { default: () => [] },
      displayMode: { default: 'auto' },
      enableColumnVisibility: { type: Boolean, default: false },
      error: { default: false },
      errorMessage: { default: 'No se pudieron cargar los datos. Reintenta.' },
      empty: { default: 'No se encontraron resultados' },
    },
    emits: ['add', 'refresh'],
  },
}))

vi.mock('@/core/shared/components/AppBadge.vue', () => ({
  default: { name: 'AppBadge', template: '<span><slot /></span>', props: ['label', 'value', 'tone', 'icon', 'variant'] },
}))

vi.mock('@/core/shared/components/ConfirmModal.vue', () => ({
  default: { name: 'ConfirmModal', template: '<div />', props: ['open', 'description', 'confirmLabel', 'confirmColor', 'loading'], emits: ['update:open', 'confirm'] },
}))

vi.mock('@/features/admin/shared/components/AdminPageHeader.vue', () => ({
  default: { name: 'AdminPageHeader', template: '<div data-testid="admin-page-header"><slot /></div>', props: ['title', 'description'] },
}))

// Stub Nuxt UI primitives used by AdminUsersView directly.
//
// We rely on the real Reka UI rendering for the kebab trigger (just like
// CustomersView.test.ts) and assert against the `reka-dropdown-menu-trigger`
// substring the real Nuxt UI emits. This mirrors the established pattern
// in this codebase and avoids fighting with @nuxt/ui's virtual-module
// resolution. Items rendered inside the popover are not asserted here;
// the kebab gating contract is the only thing the view owns.
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
  UAvatar: { name: 'UAvatar', template: '<span data-testid="u-avatar" />', props: ['alt', 'text'] },
  UIcon: { name: 'UIcon', template: '<span />', props: ['name'] },
  UModal: { name: 'UModal', template: '<div><slot name="body" /><slot name="footer" /></div>', props: ['open', 'title', 'content'] },
  UCard: { name: 'UCard', template: '<div><slot name="header" /><slot /></div>' },
}))

// ── Sample data ──────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<UserTableRow> = {}): UserTableRow {
  return {
    id: 'user-1',
    email: 'user@test.com',
    name: 'Juan Pérez',
    isActive: true,
    createdAt: '2024-01-15T00:00:00.000Z',
    roles: [{ id: 'r1', name: 'Admin' }],
    ...overrides,
  }
}

function mountView() {
  return mount(AdminUsersView)
}

// ── Reset mock state between tests ───────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
  mockState.pagination.value = { pageIndex: 0, pageSize: 10 }
  mockState.sorting.value = [{ id: 'name', desc: false }]
  mockState.globalFilter.value = ''
  mockState.columnPinning.value = { left: [], right: ['actions'] }
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
  authMock.userCan.mockReset()
  authMock.userCan.mockReturnValue(true)
  toastMock.add.mockClear()
})

describe('AdminUsersView — error state', () => {
  it('renders the error block with the backend-derived message when isError is true', async () => {
    mockState.isError.value = true
    mockState.error.value = {
      response: { data: { message: 'No se pudo conectar al servidor' } },
    }
    const wrapper = mountView()
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
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="error-message"]').text()).toBe('Network Error')
  })

  it('falls back to the Spanish message when nothing else is available', async () => {
    mockState.isError.value = true
    mockState.error.value = {}
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'No se pudieron cargar los usuarios. Reintenta.',
    )
  })

  it('triggers refresh when the retry button is clicked', async () => {
    mockState.isError.value = true
    mockState.error.value = { response: { data: { message: 'Boom' } } }
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="table-error-retry"]').trigger('click')
    expect(mockState.refresh).toHaveBeenCalled()
  })
})

describe('AdminUsersView — view mode', () => {
  it('renders ViewToggle in the toolbar actions slot', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="view-toggle"]').exists()).toBe(true)
  })

  it('passes display-mode="table" by default', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe('table')
  })

  it('passes display-mode="cards" after toggling to card mode via localStorage', async () => {
    localStorage.setItem('admin-users-view-mode', 'card')
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe('cards')
  })

  it('wires enable-column-visibility on the AppDataTable', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-column-visibility'),
    ).toBe('true')
  })
})

describe('AdminUsersView — permission gating', () => {
  it('hides the kebab on the row when user lacks update AND delete', async () => {
    authMock.userCan.mockImplementation(
      (_action: string, subject: string) => subject !== 'User' || false,
    )
    mockState.data.value = [makeUser()]
    const wrapper = mountView()
    await flushPromises()
    const html = wrapper.html()
    // When canManageUserActions is false the UDropdownMenu is removed
    // entirely (v-if in the view); the kebab trigger id is absent.
    expect(html).not.toContain('reka-dropdown-menu-trigger')
  })

  it('shows the kebab on the row when the user has update permission', async () => {
    authMock.userCan.mockImplementation(
      (action: string, subject: string) =>
        (action === 'update' && subject === 'User') || action === 'read',
    )
    mockState.data.value = [makeUser()]
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.html()).toContain('reka-dropdown-menu-trigger')
  })

  it('shows the kebab on the row when the user has delete permission', async () => {
    authMock.userCan.mockImplementation(
      (action: string, subject: string) =>
        (action === 'delete' && subject === 'User') || action === 'read',
    )
    mockState.data.value = [makeUser()]
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.html()).toContain('reka-dropdown-menu-trigger')
  })
})

describe('AdminUsersView — card slot', () => {
  it('renders UserCardGrid inside the cards slot when in card mode', async () => {
    mockState.data.value = [makeUser()]
    localStorage.setItem('admin-users-view-mode', 'card')
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="user-card-grid"]').exists()).toBe(true)
  })

  it('card click opens the edit slideover with the clicked user and does not push to router', async () => {
    // No router push should occur — there is no detail route.
    const routerPush = vi.fn()
    // @ts-expect-error - intentional global to detect any router import.
    globalThis.useRouter = () => ({ push: routerPush })

    mockState.data.value = [makeUser({ id: 'user-42', name: 'Maria Lopez' })]
    localStorage.setItem('admin-users-view-mode', 'card')
    const wrapper = mountView()
    await flushPromises()

    const card = wrapper.find('[data-testid="card-user-42"]')
    expect(card.exists()).toBe(true)
    await card.trigger('click')
    await flushPromises()

    // The edit slideover must be present and bound to the clicked user.
    const slideover = wrapper.find('[data-testid="user-upsert-slideover-edit"]')
    expect(slideover.exists()).toBe(true)
    expect(slideover.attributes('data-user-id')).toBe('user-42')
    expect(slideover.attributes('data-mode')).toBe('edit')

    // No router navigation occurred — card click is slideover-only.
    expect(routerPush).not.toHaveBeenCalled()

    // Cleanup the global stub so it does not leak across tests.
    // @ts-expect-error - intentional global to detect any router import.
    delete globalThis.useRouter
  })
})
