// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import AdminRolesView from '../AdminRolesView.vue'
import type { RoleTableRow } from '../../interfaces/role.types'

// ── Mocks for composables that the view consumes ─────────────────────────────

const mockState = {
  pagination: ref({ pageIndex: 0, pageSize: 10 }),
  sorting: ref<Array<{ id: string; desc: boolean }>>([{ id: 'name', desc: false }]),
  globalFilter: ref(''),
  columnPinning: ref({ left: [], right: ['actions'] }),
  columnVisibility: ref<Record<string, boolean>>({}),
  rowSelection: ref({}),
  data: ref<RoleTableRow[]>([]),
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

vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: ref([]), isLoading: ref(false) }),
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), refetchQueries: vi.fn() }),
}))

vi.mock('../../components/RoleUpsertSlideover.vue', () => ({
  default: {
    name: 'RoleUpsertSlideover',
    template:
      '<div :data-testid="`role-upsert-slideover-${mode}`" :data-mode="mode" :data-role-id="role && role.id"></div>',
    props: ['open', 'mode', 'role', 'loading'],
    emits: ['create', 'edit', 'close'],
  },
}))

vi.mock('../../components/RolePermissionsSlideover.vue', () => ({
  default: { name: 'RolePermissionsSlideover', template: '<div />', props: ['open', 'role', 'loading'], emits: ['save'] },
}))

vi.mock('../../components/RoleCardGrid.vue', () => ({
  default: {
    name: 'RoleCardGrid',
    template: `
      <div data-testid="role-card-grid">
        <button
          v-for="role in roles"
          :key="role.id"
          :data-testid="'card-' + role.id"
          @click="$emit('card-click', role)"
        >
          {{ role.name }}
        </button>
      </div>
    `,
    props: ['roles', 'loading', 'empty'],
    emits: ['card-click'],
  },
}))

vi.mock('../../composables/useRoleColumns', () => ({
  useRoleColumns: () => ({
    columns: [
      { accessorKey: 'name', header: 'Nombre', enableSorting: true, enableHiding: true },
      { accessorKey: 'description', header: 'Descripción', enableSorting: false, enableHiding: true },
      { accessorKey: 'permissionCount', header: 'Permisos', enableSorting: true, enableHiding: true },
      { accessorKey: 'userCount', header: 'Usuarios', enableSorting: true, enableHiding: true },
      { accessorKey: 'createdAt', header: 'Creación', enableSorting: true, enableHiding: true },
      { id: 'actions', header: '', enableSorting: false, enableHiding: false, meta: { class: { td: 'text-right' } } },
    ],
  }),
}))

vi.mock('@/core/shared/components/DataTable/SortableHeader.vue', () => ({
  default: {
    name: 'SortableHeader',
    template:
      '<button :data-column="column.id" :data-testid="`sortable-${column.id}`" @click="column.toggleSorting(column.getIsSorted() === \'asc\')">{{ label }}</button>',
    props: ['column', 'label'],
  },
}))

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
            <slot name="description-header" :column="{ id: 'description', getIsSorted: () => false, toggleSorting: () => {} }" />
            <slot name="permissionCount-header" :column="{ id: 'permissionCount', getIsSorted: () => false, toggleSorting: () => {} }" />
            <slot name="userCount-header" :column="{ id: 'userCount', getIsSorted: () => false, toggleSorting: () => {} }" />
            <slot name="createdAt-header" :column="{ id: 'createdAt', getIsSorted: () => false, toggleSorting: () => {} }" />
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
  default: {
    name: 'AdminPageHeader',
    template: '<div data-testid="admin-page-header" :data-title="title"><h2>{{ title }}</h2></div>',
    props: ['title', 'description'],
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

vi.mock('@nuxt/ui', () => ({
  UDropdownMenu: {
    name: 'UDropdownMenu',
    template:
      '<div data-testid="kebab-menu" :data-items="JSON.stringify(items || [])"><slot /></div>',
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

function makeRole(overrides: Partial<RoleTableRow> = {}): RoleTableRow {
  return {
    id: 'role-1',
    name: 'Admin',
    description: 'Administrador del sistema',
    isSystem: false,
    permissionCount: 5,
    userCount: 3,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    ...overrides,
  }
}

function mountView() {
  return mount(AdminRolesView)
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
})

describe('AdminRolesView — error state', () => {
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
      'No se pudieron cargar los roles. Reintenta.',
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

describe('AdminRolesView — view mode', () => {
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
    localStorage.setItem('admin-roles-view-mode', 'card')
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe('cards')
  })

  it('falls back to display-mode="table" when the stored value is invalid', async () => {
    localStorage.setItem('admin-roles-view-mode', 'bogus')
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe('table')
  })

  it('wires enable-column-visibility on the AppDataTable', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-column-visibility'),
    ).toBe('true')
  })

  it('renders AdminPageHeader with the standardized title', async () => {
    const wrapper = mountView()
    await flushPromises()
    const header = wrapper.find('[data-testid="admin-page-header"]')
    expect(header.exists()).toBe(true)
    expect(header.attributes('data-title')).toBe('Gestión de roles')
  })
})

describe('AdminRolesView — permission gating', () => {
  it('hides the kebab on the row when user lacks update AND delete', async () => {
    authMock.userCan.mockImplementation(
      (_action: string, subject: string) => subject !== 'Role' || false,
    )
    mockState.data.value = [makeRole()]
    const wrapper = mountView()
    await flushPromises()
    const html = wrapper.html()
    // When canManageRoleActions is false the UDropdownMenu is removed
    // entirely (v-if in the view); the kebab trigger id is absent.
    expect(html).not.toContain('reka-dropdown-menu-trigger')
  })

  it('shows the kebab on the row when the user has update permission', async () => {
    authMock.userCan.mockImplementation(
      (action: string, subject: string) =>
        (action === 'update' && subject === 'Role') || action === 'read',
    )
    mockState.data.value = [makeRole()]
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.html()).toContain('reka-dropdown-menu-trigger')
  })

  it('shows the kebab on the row when the user has delete permission', async () => {
    authMock.userCan.mockImplementation(
      (action: string, subject: string) =>
        (action === 'delete' && subject === 'Role') || action === 'read',
    )
    mockState.data.value = [makeRole()]
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.html()).toContain('reka-dropdown-menu-trigger')
  })

  it('system role rows hide the "Eliminar" entry even when delete permission is granted', async () => {
    authMock.userCan.mockImplementation(
      (action: string, subject: string) =>
        (action === 'update' && subject === 'Role') ||
        (action === 'delete' && subject === 'Role') ||
        action === 'read',
    )
    mockState.data.value = [makeRole({ id: 'role-sys', isSystem: true })]
    const wrapper = mountView()
    await flushPromises()

    // The real UDropdownMenu is rendered (Nuxt UI is not mocked at the
    // virtual-module level). Open the popover by clicking the trigger and
    // inspect the rendered menu items.
    const trigger = wrapper.find('[id^="reka-dropdown-menu-trigger"]')
    expect(trigger.exists()).toBe(true)
    await trigger.trigger('click')
    await flushPromises()

    const html = document.body.innerHTML
    expect(html).toContain('Editar')
    expect(html).toContain('Permisos')
    expect(html).not.toContain('Eliminar')
  })

  it('non-system roles show "Eliminar" when delete permission is granted', async () => {
    authMock.userCan.mockImplementation(
      (action: string, subject: string) =>
        (action === 'update' && subject === 'Role') ||
        (action === 'delete' && subject === 'Role') ||
        action === 'read',
    )
    mockState.data.value = [makeRole({ isSystem: false })]
    const wrapper = mountView()
    await flushPromises()

    const trigger = wrapper.find('[id^="reka-dropdown-menu-trigger"]')
    expect(trigger.exists()).toBe(true)
    await trigger.trigger('click')
    await flushPromises()

    const html = document.body.innerHTML
    expect(html).toContain('Eliminar')
  })
})

describe('AdminRolesView — card slot', () => {
  it('renders RoleCardGrid inside the cards slot when in card mode', async () => {
    mockState.data.value = [makeRole()]
    localStorage.setItem('admin-roles-view-mode', 'card')
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="role-card-grid"]').exists()).toBe(true)
  })

  it('card click opens the edit slideover with the clicked role and does not push to router', async () => {
    // No router push should occur — there is no detail route.
    const routerPush = vi.fn()
    // @ts-expect-error - intentional global to detect any router import.
    globalThis.useRouter = () => ({ push: routerPush })

    mockState.data.value = [makeRole({ id: 'role-42', name: 'Manager' })]
    localStorage.setItem('admin-roles-view-mode', 'card')
    const wrapper = mountView()
    await flushPromises()

    const card = wrapper.find('[data-testid="card-role-42"]')
    expect(card.exists()).toBe(true)
    await card.trigger('click')
    await flushPromises()

    // The edit slideover must be present and bound to the clicked role.
    const slideover = wrapper.find('[data-testid="role-upsert-slideover-edit"]')
    expect(slideover.exists()).toBe(true)
    expect(slideover.attributes('data-role-id')).toBe('role-42')
    expect(slideover.attributes('data-mode')).toBe('edit')

    // No router navigation occurred — card click is slideover-only.
    expect(routerPush).not.toHaveBeenCalled()

    // Cleanup the global stub so it does not leak across tests.
    // @ts-expect-error - intentional global to detect any router import.
    delete globalThis.useRouter
  })
})
