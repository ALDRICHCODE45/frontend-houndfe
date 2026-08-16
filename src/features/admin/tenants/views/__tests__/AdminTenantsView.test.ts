// @ts-nocheck
/**
 * AdminTenantsView — view tests for standardized admin tenants table.
 *
 * WU-A RED stub: pins `tenantsErrorMessage` precedence and column
 * structure. WU-C expands with full coverage (view mode persistence,
 * header, #filters slot, kebab gating, card slot, slideover click).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import AdminTenantsView from '../AdminTenantsView.vue'
import type { TenantTableRow } from '../../interfaces/tenant.types'

// ── Mocks for composables that the view consumes ─────────────────────────────

const mockState = {
  pagination: ref({ pageIndex: 0, pageSize: 10 }),
  sorting: ref<Array<{ id: string; desc: boolean }>>([{ id: 'name', desc: false }]),
  globalFilter: ref(''),
  columnPinning: ref({ left: [], right: ['actions'] }),
  columnVisibility: ref<Record<string, boolean>>({}),
  rowSelection: ref({}),
  data: ref<TenantTableRow[]>([]),
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
  isSuperAdmin: true,
  userCan: vi.fn(() => true),
  currentTenantId: 'tenant-1',
  currentTenant: { name: 'Acme Tenant' },
}
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authMock,
}))

vi.mock('@tanstack/vue-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), refetchQueries: vi.fn() }),
}))

vi.mock('../../components/TenantUpsertSlideover.vue', () => ({
  default: {
    name: 'TenantUpsertSlideover',
    template:
      '<div :data-testid="`tenant-upsert-slideover-${mode}`" :data-mode="mode" :data-tenant-id="tenant && tenant.id"></div>',
    props: ['open', 'mode', 'tenant', 'loading'],
    emits: ['create', 'edit', 'close'],
  },
}))

vi.mock('../../components/TenantCardGrid.vue', () => ({
  default: {
    name: 'TenantCardGrid',
    template: `
      <div data-testid="tenant-card-grid">
        <button
          v-for="tenant in tenants"
          :key="tenant.id"
          :data-testid="'card-' + tenant.id"
          @click="$emit('card-click', tenant)"
        >
          {{ tenant.name }}
        </button>
      </div>
    `,
    props: ['tenants', 'loading', 'empty'],
    emits: ['card-click'],
  },
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
    inheritAttrs: false,
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
        <slot name="filters" />
        <div v-if="error" data-testid="table-error-state" role="alert">
          <p data-testid="error-message">{{ errorMessage }}</p>
          <button data-testid="table-error-retry" @click="$emit('refresh')">Reintentar</button>
        </div>
        <div v-else-if="(Array.isArray(data) ? data : []).length === 0" data-testid="table-empty-state">{{ empty }}</div>
        <div v-else data-testid="table-data">
          <div v-for="row in (Array.isArray(data) ? data : [])" :key="row.id">
            <slot name="name-header" :column="{ id: 'name', getIsSorted: () => false, toggleSorting: () => {} }" />
            <slot name="slug-header" :column="{ id: 'slug', getIsSorted: () => false, toggleSorting: () => {} }" />
            <slot name="address-header" :column="{ id: 'address', getIsSorted: () => false, toggleSorting: () => {} }" />
            <slot name="phone-header" :column="{ id: 'phone', getIsSorted: () => false, toggleSorting: () => {} }" />
            <slot name="createdAt-header" :column="{ id: 'createdAt', getIsSorted: () => false, toggleSorting: () => {} }" />
            <slot name="isActive-cell" :row="{ original: row }" />
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

vi.mock('@/core/shared/components/StatusDotBadge.vue', () => ({
  default: {
    name: 'StatusDotBadge',
    inheritAttrs: true,
    props: ['label', 'tone'],
    template:
      '<span :data-testid="$attrs[\'data-testid\']" :data-tone="tone" :aria-label="`Estado: ${label}`">{{ label }}</span>',
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
  UCheckbox: {
    name: 'UCheckbox',
    template:
      '<input type="checkbox" :data-testid="$attrs[\'data-testid\']" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
  },
}))

// ── Sample data ──────────────────────────────────────────────────────────────

function makeTenant(overrides: Partial<TenantTableRow> = {}): TenantTableRow {
  return {
    id: 'tenant-1',
    name: 'Sucursal Centro',
    slug: 'centro',
    address: 'Av. Siempre Viva 123',
    phone: '+54 11 5555-1234',
    isActive: true,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    ...overrides,
  }
}

function mountView() {
  return mount(AdminTenantsView)
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
  authMock.isSuperAdmin = true
  authMock.userCan.mockReset()
  authMock.userCan.mockReturnValue(true)
})

// ── WU-A RED STUBS — expanded by WU-C ────────────────────────────────────────

describe('AdminTenantsView — error state', () => {
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

  it('prefers response.data.message over error.message', async () => {
    mockState.isError.value = true
    mockState.error.value = {
      response: { data: { message: 'Backend derived message' } },
      message: 'Generic error.message',
    }
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'Backend derived message',
    )
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
      'No se pudieron cargar las sucursales. Reintenta.',
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

describe('AdminTenantsView — view mode', () => {
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
    localStorage.setItem('admin-tenants-view-mode', 'card')
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe('cards')
  })

  it('falls back to display-mode="table" when the stored value is invalid', async () => {
    localStorage.setItem('admin-tenants-view-mode', 'bogus')
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
    expect(header.attributes('data-title')).toBe('Gestión de sucursales')
  })
})

describe('AdminTenantsView — super-admin gating', () => {
  it('hides the kebab on the row when the user is not super-admin', async () => {
    authMock.isSuperAdmin = false
    mockState.data.value = [makeTenant()]
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.html()).not.toContain('reka-dropdown-menu-trigger')
  })

  it('shows the kebab on the row when the user is super-admin', async () => {
    authMock.isSuperAdmin = true
    mockState.data.value = [makeTenant()]
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.html()).toContain('reka-dropdown-menu-trigger')
  })

  it('flattens kebab items to Editar, Gestionar miembros, Desactivar for super-admin', async () => {
    authMock.isSuperAdmin = true
    mockState.data.value = [makeTenant({ id: 'tenant-42', name: 'Sucursal Norte' })]
    const wrapper = mountView()
    await flushPromises()

    const trigger = wrapper.find('[id^="reka-dropdown-menu-trigger"]')
    expect(trigger.exists()).toBe(true)
    await trigger.trigger('click')
    await flushPromises()

    const html = document.body.innerHTML
    expect(html).toContain('Editar')
    expect(html).toContain('Gestionar miembros')
    expect(html).toContain('Desactivar')
  })
})

describe('AdminTenantsView — card slot', () => {
  it('renders TenantCardGrid inside the cards slot when in card mode', async () => {
    mockState.data.value = [makeTenant()]
    localStorage.setItem('admin-tenants-view-mode', 'card')
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="tenant-card-grid"]').exists()).toBe(true)
  })

  it('card click opens the edit slideover with the clicked tenant and does not push to router', async () => {
    // No router push should occur — there is no detail route.
    const routerPush = vi.fn()
    // @ts-expect-error - intentional global to detect any router import.
    globalThis.useRouter = () => ({ push: routerPush })

    mockState.data.value = [makeTenant({ id: 'tenant-77', name: 'Sucursal Sur' })]
    localStorage.setItem('admin-tenants-view-mode', 'card')
    const wrapper = mountView()
    await flushPromises()

    const card = wrapper.find('[data-testid="card-tenant-77"]')
    expect(card.exists()).toBe(true)
    await card.trigger('click')
    await flushPromises()

    // The edit slideover must be present and bound to the clicked tenant.
    const slideover = wrapper.find('[data-testid="tenant-upsert-slideover-edit"]')
    expect(slideover.exists()).toBe(true)
    expect(slideover.attributes('data-tenant-id')).toBe('tenant-77')
    expect(slideover.attributes('data-mode')).toBe('edit')

    // No router navigation occurred — card click is slideover-only.
    expect(routerPush).not.toHaveBeenCalled()

    // Cleanup the global stub so it does not leak across tests.
    // @ts-expect-error - intentional global to detect any router import.
    delete globalThis.useRouter
  })
})

describe('AdminTenantsView — #filters slot and isActive cell', () => {
  it('renders the includeInactive checkbox inside the filters slot in table mode', async () => {
    const wrapper = mountView()
    await flushPromises()
    // The UCheckbox (mocked or real) renders a checkbox role inside the
    // AppDataTable toolbar. Assert it exists in the rendered tree.
    expect(wrapper.findAll('[role="checkbox"]').length).toBeGreaterThan(0)
  })

  // WU-4 / polish-filters-bottom-sheet: the includeInactive checkbox is
  // wrapped in a card section so the unified bottom-sheet gives it a title.
  it('wraps the includeInactive checkbox in a card section with data-section-id="inactive"', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-section-id="inactive"]').exists()).toBe(true)
    // The UCheckbox lives inside the wrapper so the card section is its
    // first DOM ancestor with that testid.
    const card = wrapper.find('[data-section-id="inactive"]')
    expect(card.find('[role="checkbox"]').exists()).toBe(true)
  })

  it('renders the includeInactive checkbox inside the filters slot in card mode', async () => {
    localStorage.setItem('admin-tenants-view-mode', 'card')
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.findAll('[role="checkbox"]').length).toBeGreaterThan(0)
  })

  it('renders isActive=true via StatusDotBadge with data-testid, label "Activa", and aria-label "Estado: Activa"', async () => {
    mockState.data.value = [makeTenant({ id: 't-active', isActive: true })]
    const wrapper = mountView()
    await flushPromises()
    const badge = wrapper.find('[data-testid="status-badge-t-active"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('Activa')
    expect(badge.attributes('aria-label')).toBe('Estado: Activa')
  })

  it('renders isActive=false via StatusDotBadge with label "Inactiva"', async () => {
    mockState.data.value = [makeTenant({ id: 't-inactive', isActive: false })]
    const wrapper = mountView()
    await flushPromises()
    const badge = wrapper.find('[data-testid="status-badge-t-inactive"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('Inactiva')
    expect(badge.attributes('aria-label')).toBe('Estado: Inactiva')
  })
})