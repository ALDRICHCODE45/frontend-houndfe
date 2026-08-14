/**
 * WU-A — EmployeesListView RED stubs (REQ-1, REQ-2, REQ-3, REQ-5)
 *
 * Pinned contracts the WU-A view must satisfy:
 *  - employeesErrorMessage precedence: response.data.message (string|array[0]) >
 *    error.message > "No se pudieron cargar los colaboradores. Reintenta."
 *  - enable-column-visibility is wired on AppDataTable
 *  - :display-mode="displayMode" is forwarded (default 'table', 'cards' when card mode)
 *  - defaultPinning: { right: ['actions'] } is set on the table composable
 *  - persistKey: 'admin-employees' is set on the table composable
 *
 * RED — written before the WU-A view rewrites. This is a stub: WU-C will
 * expand it to cover status tabs in #filters, search→globalFilter, card-click,
 * card-kebab, and bulk selection. WU-A only needs the surface contracts here.
 *
 * Mocks `useServerTable` because the shared composable is UNTOUCHABLE per
 * design.md. Tests assert pass-through props, not internal table state.
 */

import { describe, it, expect as chaiExpect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'

// ── Mock state for the shared `useServerTable` composable ─────────────────────
//
// We MUST NOT import the real composable — design.md declares it UNTOUCHABLE.
// These refs/mocks let us observe the props the view passes in.

const mockState = {
  pagination: ref({ pageIndex: 0, pageSize: 10 }),
  sorting: ref<Array<{ id: string; desc: boolean }>>([]),
  globalFilter: ref(''),
  columnPinning: ref({ left: [] as string[], right: ['actions'] as string[] }),
  columnVisibility: ref<Record<string, boolean>>({}),
  rowSelection: ref<Record<string, boolean>>({}),
  data: ref<unknown[]>([]),
  totalCount: ref(0),
  pageCount: ref(0),
  isLoading: ref(false),
  isFetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refresh: vi.fn(),
  resetFilters: vi.fn(),
  selectedRows: ref<unknown[]>([]),
  clearSelection: vi.fn(),
  pageSizeOptions: [10, 20, 50],
  showingFrom: ref(0),
  showingTo: ref(0),
}

const useServerTableConfig = vi.fn()

vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: (config: unknown) => {
    useServerTableConfig(config)
    return {
      pagination: mockState.pagination,
      sorting: mockState.sorting,
      globalFilter: mockState.globalFilter,
      rowSelection: mockState.rowSelection,
      columnPinning: mockState.columnPinning,
      columnVisibility: mockState.columnVisibility,
      data: computed(() => mockState.data.value),
      totalCount: computed(() => mockState.totalCount.value),
      pageCount: computed(() => mockState.pageCount.value),
      isLoading: computed(() => mockState.isLoading.value),
      isFetching: computed(() => mockState.isFetching.value),
      isError: computed(() => mockState.isError.value),
      error: computed(() => mockState.error.value),
      refresh: mockState.refresh,
      resetFilters: mockState.resetFilters,
      selectedRows: computed(() => mockState.selectedRows.value),
      clearSelection: mockState.clearSelection,
      pageSizeOptions: mockState.pageSizeOptions,
      showingFrom: computed(() => mockState.showingFrom.value),
      showingTo: computed(() => mockState.showingTo.value),
    }
  },
}))

const authMock = {
  userCan: vi.fn(() => true),
  currentTenantId: 'tenant-1',
  currentTenant: { name: 'Acme' },
}
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authMock,
}))

vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: ref([]), isLoading: ref(false) }),
  useMutation: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: ref(false),
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    refetchQueries: vi.fn(),
  }),
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
        :data-page-size-options="String(pageSizeOptions)"
      >
        <slot name="actions" />
        <slot name="cards" />
        <slot name="filters" />
        <div v-if="error" data-testid="table-error-state" role="alert">
          <p data-testid="error-message">{{ errorMessage }}</p>
          <button data-testid="table-error-retry" @click="$emit('refresh')">Reintentar</button>
        </div>
        <div v-else-if="(Array.isArray(data) ? data : []).length === 0" data-testid="table-empty-state">{{ empty }}</div>
        <div v-else data-testid="table-data"><slot /></div>
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
      pageSizeOptions: { default: () => [5, 10, 20, 50] },
      showAddButton: { type: Boolean, default: false },
    },
    emits: ['add', 'refresh'],
  },
}))

vi.mock('@/core/shared/components/DataTable/SelectColumn.vue', () => ({
  default: {
    name: 'SelectColumn',
    template: '<div />',
    props: ['table', 'row', 'mode'],
  },
}))

vi.mock('@/core/shared/components/ViewToggle.vue', () => ({
  default: {
    name: 'ViewToggle',
    template:
      '<div data-testid="view-toggle" :data-aria-label="ariaLabel"><slot /></div>',
    props: ['modelValue', 'options', 'ariaLabel'],
    emits: ['update:modelValue'],
  },
}))

vi.mock('@/features/admin/shared/components/AdminPageHeader.vue', () => ({
  default: {
    name: 'AdminPageHeader',
    template: '<div data-testid="admin-page-header" :data-title="title"><slot /></div>',
    props: ['title', 'description', 'loading', 'fallbackText'],
  },
}))

vi.mock('@/features/admin/employees/components/EmployeeCardGrid.vue', () => ({
  default: {
    name: 'EmployeeCardGrid',
    template: '<div data-testid="employee-card-grid" />',
    props: ['employees', 'managerMap', 'loading', 'canUpdate', 'empty'],
    emits: ['edit', 'terminate', 'reactivate', 'card-click'],
  },
}))

vi.mock('@/features/admin/employees/components/EmployeeFilters.vue', () => ({
  default: {
    name: 'EmployeeFilters',
    template: '<div data-testid="employee-filters" />',
    props: ['search', 'statusTab', 'isLoading'],
    emits: ['update:search', 'update:status-tab'],
  },
}))

vi.mock('@/features/admin/employees/components/CreateEmployeeSlideover.vue', () => ({
  default: {
    name: 'CreateEmployeeSlideover',
    template: '<div />',
    props: ['open'],
    emits: ['update:open', 'success'],
  },
}))

vi.mock('@/features/admin/employees/components/EmployeeEditSlideover.vue', () => ({
  default: {
    name: 'EmployeeEditSlideover',
    template: '<div />',
    props: ['open', 'employee'],
    emits: ['update:open', 'success'],
  },
}))

vi.mock('@/features/admin/employees/components/TerminateEmployeeDialog.vue', () => ({
  default: {
    name: 'TerminateEmployeeDialog',
    template: '<div />',
    props: ['open', 'employee'],
    emits: ['update:open', 'success'],
  },
}))

vi.mock('@/features/admin/employees/components/ReactivateEmployeeDialog.vue', () => ({
  default: {
    name: 'ReactivateEmployeeDialog',
    template: '<div />',
    props: ['open', 'employee'],
    emits: ['update:open', 'success'],
  },
}))

vi.mock('@/features/admin/employees/components/BatchTerminateModal.vue', () => ({
  default: {
    name: 'BatchTerminateModal',
    template: '<div />',
    props: ['open', 'employees', 'loading'],
    emits: ['update:open', 'confirm'],
  },
}))

vi.mock('@/core/shared/components/ConfirmModal.vue', () => ({
  default: {
    name: 'ConfirmModal',
    template: '<div />',
    props: ['open', 'title', 'description', 'confirmLabel', 'confirmColor', 'items', 'loading'],
    emits: ['update:open', 'confirm'],
  },
}))

vi.mock('@/core/shared/components/EntityAvatar.vue', () => ({
  default: { name: 'EntityAvatar', template: '<span data-testid="entity-avatar" />', props: ['name', 'seed', 'showDot', 'size'] },
}))
vi.mock('@/core/shared/components/DotBadge.vue', () => ({
  default: { name: 'DotBadge', template: '<span data-testid="dot-badge" />', props: ['label', 'dotClass'] },
}))
vi.mock('@/core/shared/components/StatusDotBadge.vue', () => ({
  default: { name: 'StatusDotBadge', template: '<span data-testid="status-dot-badge" />', props: ['tone', 'label'] },
}))

vi.mock('@/features/admin/employees/composables/useEmployeeColumns', () => ({
  useEmployeeColumns: () => ({ columns: ref([]), canReadSalary: ref(false) }),
  formatHireDate: (iso: string) => iso,
}))

vi.mock('@/features/admin/employees/composables/useManagerResolution', () => ({
  useManagerResolution: () => ({ managerMap: ref(new Map()) }),
  resolveManagerName: () => '—',
  resolveManagerEmail: () => null,
}))

vi.mock('@/features/admin/employees/composables/useEmployeeActions', () => ({
  getEmployeeRowActions: () => [],
}))

vi.mock('@/features/admin/employees/composables/useBatchDeleteEmployee', () => ({
  useBatchDeleteEmployee: () => ({ mutateAsync: vi.fn(), isPending: ref(false) }),
}))
vi.mock('@/features/admin/employees/composables/useBatchTerminateEmployee', () => ({
  useBatchTerminateEmployee: () => ({ mutateAsync: vi.fn(), isPending: ref(false) }),
}))
vi.mock('@/features/admin/employees/composables/useBatchReactivateEmployee', () => ({
  useBatchReactivateEmployee: () => ({ mutateAsync: vi.fn(), isPending: ref(false) }),
}))

const routerPush = vi.fn()
;(globalThis as { useRouter?: () => { push: typeof routerPush } }).useRouter = () => ({
  push: routerPush,
})

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
  mockState.pagination.value = { pageIndex: 0, pageSize: 10 }
  mockState.sorting.value = []
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
  mockState.clearSelection.mockClear()
  useServerTableConfig.mockClear()
  routerPush.mockClear()
  authMock.userCan.mockReset()
  authMock.userCan.mockReturnValue(true)
})

const viewModule = '../EmployeesListView.vue'

describe('EmployeesListView — useServerTable wiring (REQ-2, REQ-5, REQ-10)', () => {
  it('composes useServerTable with persistKey "admin-employees" and urlSync false', async () => {
    mount((await import(viewModule)).default)
    await flushPromises()
    chaiExpect(useServerTableConfig).toHaveBeenCalled()
    const config = useServerTableConfig.mock.calls[useServerTableConfig.mock.calls.length - 1]![0] as {
      persistKey?: string
      urlSync?: boolean
    }
    chaiExpect(config.persistKey).toBe('admin-employees')
    chaiExpect(config.urlSync).toBe(false)
  })

  it('sets defaultPinning to { left: [], right: ["actions"] }', async () => {
    mount((await import(viewModule)).default)
    await flushPromises()
    const config = useServerTableConfig.mock.calls[useServerTableConfig.mock.calls.length - 1]![0] as {
      defaultPinning?: { left: string[]; right: string[] }
    }
    chaiExpect(config.defaultPinning).toEqual({ left: [], right: ['actions'] })
  })

  it('sets pageSizeOptions to [10, 20, 50]', async () => {
    mount((await import(viewModule)).default)
    await flushPromises()
    const config = useServerTableConfig.mock.calls[useServerTableConfig.mock.calls.length - 1]![0] as {
      pageSizeOptions?: number[]
    }
    chaiExpect(config.pageSizeOptions).toEqual([10, 20, 50])
  })
})

describe('EmployeesListView — error message precedence (REQ-1)', () => {
  it('prefers response.data.message (string) over error.message and fallback', async () => {
    mockState.isError.value = true
    mockState.error.value = {
      response: { data: { message: 'Falla específica del backend' } },
      message: 'Generic axios error',
    }
    const wrapper = mount((await import(viewModule)).default)
    await flushPromises()
    chaiExpect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'Falla específica del backend',
    )
  })

  it('prefers response.data.message[0] when the backend returns an array', async () => {
    mockState.isError.value = true
    mockState.error.value = {
      response: { data: { message: ['Mensaje array 0', 'Mensaje array 1'] } },
      message: 'Generic axios error',
    }
    const wrapper = mount((await import(viewModule)).default)
    await flushPromises()
    chaiExpect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'Mensaje array 0',
    )
  })

  it('falls back to error.message when response.data.message is missing', async () => {
    mockState.isError.value = true
    mockState.error.value = {
      response: { data: {} },
      message: 'Network Error',
    }
    const wrapper = mount((await import(viewModule)).default)
    await flushPromises()
    chaiExpect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'Network Error',
    )
  })

  it('falls back to the Spanish message when no error details are available', async () => {
    mockState.isError.value = true
    mockState.error.value = {}
    const wrapper = mount((await import(viewModule)).default)
    await flushPromises()
    chaiExpect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'No se pudieron cargar los colaboradores. Reintenta.',
    )
  })

  it('retry button triggers refresh', async () => {
    mockState.isError.value = true
    mockState.error.value = { response: { data: { message: 'Boom' } } }
    const wrapper = mount((await import(viewModule)).default)
    await flushPromises()
    await wrapper.find('[data-testid="table-error-retry"]').trigger('click')
    chaiExpect(mockState.refresh).toHaveBeenCalled()
  })
})

describe('EmployeesListView — header / column visibility / displayMode (REQ-3, REQ-5, REQ-6)', () => {
  it('renders AdminPageHeader with title "Colaboradores"', async () => {
    const wrapper = mount((await import(viewModule)).default)
    await flushPromises()
    chaiExpect(wrapper.find('[data-testid="admin-page-header"]').exists()).toBe(true)
    chaiExpect(wrapper.find('[data-testid="admin-page-header"]').attributes('data-title')).toBe('Colaboradores')
  })

  it('passes enable-column-visibility=true to AppDataTable', async () => {
    const wrapper = mount((await import(viewModule)).default)
    await flushPromises()
    chaiExpect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-column-visibility'),
    ).toBe('true')
  })

  it('passes display-mode="table" by default', async () => {
    const wrapper = mount((await import(viewModule)).default)
    await flushPromises()
    chaiExpect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode'),
    ).toBe('table')
  })

  it('passes display-mode="cards" when localStorage employee-view-mode is "card"', async () => {
    localStorage.setItem('employee-view-mode', 'card')
    const wrapper = mount((await import(viewModule)).default)
    await flushPromises()
    chaiExpect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode'),
    ).toBe('cards')
  })

  it('renders ViewToggle with aria-label "Seleccionar vista de empleados"', async () => {
    const wrapper = mount((await import(viewModule)).default)
    await flushPromises()
    chaiExpect(wrapper.find('[data-testid="view-toggle"]').exists()).toBe(true)
    chaiExpect(
      wrapper.find('[data-testid="view-toggle"]').attributes('data-aria-label'),
    ).toBe('Seleccionar vista de empleados')
  })
})

// ── Forced reference so vi.mock dynamic import isn't flagged as unused ─────
void chaiExpect