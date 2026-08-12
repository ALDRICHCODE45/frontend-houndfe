// @ts-nocheck
/**
 * AdminTenantMembersView — view tests for standardized admin tenant
 * members table.
 *
 * WU-A RED stubs: pins `membershipsErrorMessage` precedence, column
 * shape, `defaultSorting` bug fix, `enable-column-visibility`, and
 * `displayMode` default. WU-C expands with view-mode persistence,
 * kebab gating, card click, and the add-flow preservation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import AdminTenantMembersView from '../AdminTenantMembersView.vue'
import { useMembershipColumns } from '../../composables/useMembershipColumns'
import type { MembershipTableRow } from '../../interfaces/membership.types'

// ── Mocks for composables that the view consumes ─────────────────────────────

const mockState = {
  pagination: ref({ pageIndex: 0, pageSize: 10 }),
  sorting: ref<Array<{ id: string; desc: boolean }>>([{ id: 'userName', desc: false }]),
  globalFilter: ref(''),
  columnPinning: ref({ left: [], right: ['actions'] }),
  columnVisibility: ref<Record<string, boolean>>({}),
  rowSelection: ref({}),
  data: ref<MembershipTableRow[]>([]),
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

const { useServerTableMock } = vi.hoisted(() => ({
  useServerTableMock: vi.fn(() => ({
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
  })),
}))
vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: useServerTableMock,
}))

const authMock = {
  isSuperAdmin: false,
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

const routerPushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { tenantId: 'tenant-123' } }),
  useRouter: () => ({ push: routerPushMock }),
}))

vi.mock('../../components/MembershipUpsertSlideover.vue', () => ({
  default: {
    name: 'MembershipUpsertSlideover',
    template:
      '<div v-if="open" :data-testid="`membership-upsert-slideover-${mode}`" :data-mode="mode" :data-membership-id="membership && membership.id"></div>',
    props: ['open', 'mode', 'tenantId', 'membership', 'loading'],
    emits: ['create', 'edit', 'close'],
  },
}))

vi.mock('@/core/shared/components/DataTable/SortableHeader.vue', () => ({
  default: {
    name: 'SortableHeader',
    template:
      '<button :data-column="column.id" :data-testid="`sortable-${column.id}`">{{ label }}</button>',
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
        <div data-testid="app-data-table-toolbar">
          <button
            v-if="showAddButton"
            data-testid="app-data-table-add-button"
            @click="$emit('add')"
          >{{ addButtonText }}</button>
        </div>
        <slot name="actions" />
        <slot name="cards" />
        <div v-if="error" data-testid="table-error-state" role="alert">
          <p data-testid="error-message">{{ errorMessage }}</p>
          <button data-testid="table-error-retry" @click="$emit('refresh')">Reintentar</button>
        </div>
        <div v-else-if="(Array.isArray(data) ? data : []).length === 0" data-testid="table-empty-state">{{ empty }}</div>
        <div v-else data-testid="table-data">
          <div v-for="row in (Array.isArray(data) ? data : [])" :key="row.id">
            <slot name="userName-header" :column="{ id: 'userName' }" />
            <slot name="roleName-header" :column="{ id: 'roleName' }" />
            <slot name="createdAt-header" :column="{ id: 'createdAt' }" />
            <slot name="userName-cell" :row="{ original: row }" />
            <slot name="roleName-cell" :row="{ original: row }" />
            <slot name="createdAt-cell" :row="{ original: row }" />
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
      showAddButton: { type: Boolean, default: false },
      addButtonText: { type: String, default: 'Agregar' },
      addButtonIcon: { type: String, default: 'i-lucide-plus' },
    },
    emits: ['add', 'refresh'],
  },
}))

vi.mock('../../components/MemberCardGrid.vue', () => ({
  default: {
    name: 'MemberCardGrid',
    template: `
      <div data-testid="member-card-grid" :data-loading="String(loading)">
        <button
          v-for="member in members"
          :key="member.id"
          :data-testid="'member-card-' + member.id"
          :data-user-name="member.userName"
          :data-user-is-active="member.userIsActive === undefined ? 'undefined' : String(member.userIsActive)"
          @click="$emit('card-click', member)"
        >
          {{ member.userName }}
        </button>
      </div>
    `,
    props: ['members', 'loading', 'empty'],
    emits: ['card-click'],
  },
}))

vi.mock('@/core/shared/components/AppBadge.vue', () => ({
  default: { name: 'AppBadge', template: '<span><slot /></span>', props: ['label', 'value', 'tone', 'icon', 'variant'] },
}))

vi.mock('@/core/shared/components/ConfirmModal.vue', () => ({
  default: { name: 'ConfirmModal', template: '<div />', props: ['open', 'description', 'confirmText', 'cancelText'], emits: ['update:open', 'confirm'] },
}))

vi.mock('@/features/admin/shared/components/AdminPageHeader.vue', () => ({
  default: {
    name: 'AdminPageHeader',
    template: '<div data-testid="admin-page-header" :data-title="title"><h2>{{ title }}</h2></div>',
    props: ['title', 'description', 'loading'],
  },
}))

vi.mock('@/core/shared/components/ViewToggle.vue', () => ({
  default: {
    name: 'ViewToggle',
    template:
      '<div data-testid="view-toggle" :aria-label="ariaLabel"><button data-testid="view-toggle-table" @click="$emit(\'update:modelValue\', \'table\')">Tabla</button><button data-testid="view-toggle-card" @click="$emit(\'update:modelValue\', \'card\')">Tarjetas</button></div>',
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
  UCard: { name: 'UCard', template: '<div><slot name="header" /><slot /></div>' },
}))

// UDropdownMenu / UButton / UCard are auto-imported by Nuxt, not pulled
// from the @nuxt/ui module path. Mount-time stubs ensure our kebab mock
// is the one Vue resolves in the component tree.
const nuxtStubs = {
  UDropdownMenu: {
    name: 'UDropdownMenu',
    template:
      '<div data-testid="kebab-menu" :data-items="JSON.stringify(items || [])"><slot /></div>',
    props: ['items', 'content'],
  },
  UButton: {
    name: 'UButton',
    template:
      '<button v-bind="$attrs" @click="$emit(\'click\')" :data-testid="$attrs[\'data-testid\']"><slot /></button>',
    emits: ['click'],
  },
  UCard: { name: 'UCard', template: '<div><slot name="header" /><slot /></div>' },
}

vi.mock('@/features/admin/tenants/composables/useTenantSummary', () => ({
  useTenantSummary: () => ({
    tenantName: ref('Sucursal Centro'),
    isLoadingTenantName: ref(false),
  }),
}))

// ── Sample data ──────────────────────────────────────────────────────────────

function makeMember(overrides: Partial<MembershipTableRow> = {}): MembershipTableRow {
  return {
    id: 'm-1',
    userId: 'u-1',
    tenantId: 'tenant-123',
    roleId: 'r-1',
    createdAt: '2024-01-15T00:00:00.000Z',
    userName: 'Ada Lovelace',
    userEmail: 'ada@example.com',
    roleName: 'Admin',
    userIsActive: true,
    ...overrides,
  }
}

function mountView() {
  return mount(AdminTenantMembersView, {
    global: { stubs: nuxtStubs },
  })
}

// ── Reset mock state between tests ───────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
  mockState.pagination.value = { pageIndex: 0, pageSize: 10 }
  mockState.sorting.value = [{ id: 'userName', desc: false }]
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
  routerPushMock.mockClear()
  useServerTableMock.mockClear()
  authMock.isSuperAdmin = false
  authMock.userCan.mockReset()
  authMock.userCan.mockReturnValue(true)
})

// ── WU-A RED STUBS — expanded by WU-C ────────────────────────────────────────

describe('AdminTenantMembersView — error state', () => {
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

  it('reads response.data.message[0] when the backend returns an array of messages', async () => {
    mockState.isError.value = true
    mockState.error.value = {
      response: { data: { message: ['First backend error', 'Second one'] } },
    }
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="error-message"]').text()).toBe('First backend error')
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
      'No se pudieron cargar los miembros. Reintenta.',
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

describe('AdminTenantMembersView — view mode wiring', () => {
  it('passes display-mode="table" by default', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode'),
    ).toBe('table')
  })

  it('wires enable-column-visibility on the AppDataTable', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-column-visibility'),
    ).toBe('true')
  })

  it('passes display-mode="cards" after toggling to card mode via localStorage', async () => {
    localStorage.setItem('admin-tenant-members-view-mode', 'card')
    const wrapper = mountView()
    await flushPromises()
    expect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode'),
    ).toBe('cards')
  })

  it('falls back to display-mode="table" when the stored value is invalid', async () => {
    localStorage.setItem('admin-tenant-members-view-mode', 'bogus')
    const wrapper = mountView()
    await flushPromises()
    expect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode'),
    ).toBe('table')
  })

  it('renders AdminPageHeader with the standardized title', async () => {
    const wrapper = mountView()
    await flushPromises()
    const header = wrapper.find('[data-testid="admin-page-header"]')
    expect(header.exists()).toBe(true)
    expect(header.attributes('data-title')).toBe('Miembros del tenant')
  })
})

describe('AdminTenantMembersView — card click', () => {
  it('opens the edit slideover when a card is clicked with update permission', async () => {
    authMock.userCan.mockImplementation(
      (_action: string, _subject: string) =>
        _subject === 'TenantMembership' && (_action === 'read' || _action === 'update'),
    )
    mockState.data.value = [makeMember({ id: 'm-42', userName: 'Ada' })]
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="member-card-m-42"]').trigger('click')
    await flushPromises()
    const slideover = wrapper.find('[data-testid="membership-upsert-slideover-edit"]')
    expect(slideover.exists()).toBe(true)
    expect(slideover.attributes('data-mode')).toBe('edit')
    expect(slideover.attributes('data-membership-id')).toBe('m-42')
  })

  it('does not call router.push when a card is clicked', async () => {
    authMock.userCan.mockReturnValue(true)
    mockState.data.value = [makeMember({ id: 'm-99' })]
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="member-card-m-99"]').trigger('click')
    await flushPromises()
    expect(routerPushMock).not.toHaveBeenCalled()
  })

  it('does not open the edit slideover when update permission is denied', async () => {
    // Grant read so the table renders; deny update so the card click is a no-op.
    authMock.userCan.mockImplementation(
      (_action: string, _subject: string) =>
        _subject === 'TenantMembership' && _action === 'read',
    )
    mockState.data.value = [makeMember({ id: 'm-deny' })]
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="member-card-m-deny"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="membership-upsert-slideover-edit"]').exists()).toBe(false)
  })
})

describe('AdminTenantMembersView — defaultSorting', () => {
  it('passes defaultSorting targeting userName — never userEmail', async () => {
    mountView()
    await flushPromises()
    const lastCall = useServerTableMock.mock.calls.at(-1)?.[0] as Record<string, unknown>
    const serialized = JSON.stringify(lastCall)
    expect(serialized).toContain('"userName"')
    expect(serialized).not.toContain('userEmail')
    expect(mockState.sorting.value).toEqual([{ id: 'userName', desc: false }])
  })
})

describe('AdminTenantMembersView — empty vs error precedence', () => {
  it('suppresses the empty placeholder when isError is true', async () => {
    mockState.isError.value = true
    mockState.error.value = { message: 'Boom' }
    mockState.data.value = []
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="table-error-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="table-empty-state"]').exists()).toBe(false)
  })
})

describe('AdminTenantMembersView — kebab CASL gating', () => {
  it('renders no kebab when both update and delete are denied', async () => {
    authMock.userCan.mockImplementation(
      (_action: string, _subject: string) =>
        _subject === 'TenantMembership' && _action === 'read',
    )
    mockState.data.value = [makeMember({ id: 'm-1' })]
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[id^="reka-dropdown-menu-trigger"]').exists()).toBe(false)
  })

  it('renders the kebab when both update and delete are allowed', async () => {
    authMock.userCan.mockReturnValue(true)
    mockState.data.value = [makeMember({ id: 'm-2' })]
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[id^="reka-dropdown-menu-trigger"]').exists()).toBe(true)
  })
})

describe('AdminTenantMembersView — add flow preserved', () => {
  it('wires the "Agregar miembro" add button through AppDataTable', async () => {
    authMock.userCan.mockImplementation(
      (_action: string, _subject: string) =>
        _subject === 'TenantMembership' && (_action === 'create' || _action === 'update' || _action === 'delete' || _action === 'read'),
    )
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.html()).toContain('Agregar miembro')
  })
})

describe('MemberCard — null-safe userIsActive chip', () => {
  // Direct unit tests on MemberCard. Mounting the full view would render
  // the chip inside the card-grid mock, but we want to assert the
  // v-if on userIsActive !== undefined, which lives in MemberCard.
  it('renders StatusDotBadge when userIsActive is defined (true → Activo)', async () => {
    const MemberCard = (await import('../../components/MemberCard.vue')).default
    const wrapper = mount(MemberCard, {
      props: { member: makeMember({ userIsActive: true }) },
    })
    const chip = wrapper.find('[data-testid="status-badge"]')
    expect(chip.exists()).toBe(true)
    expect(chip.text()).toBe('Activo')
  })

  it('renders StatusDotBadge when userIsActive is false (Inactivo)', async () => {
    const MemberCard = (await import('../../components/MemberCard.vue')).default
    const wrapper = mount(MemberCard, {
      props: { member: makeMember({ userIsActive: false }) },
    })
    const chip = wrapper.find('[data-testid="status-badge"]')
    expect(chip.exists()).toBe(true)
    expect(chip.text()).toBe('Inactivo')
  })

  it('omits StatusDotBadge entirely when userIsActive is undefined', async () => {
    const MemberCard = (await import('../../components/MemberCard.vue')).default
    const wrapper = mount(MemberCard, {
      props: { member: makeMember({ userIsActive: undefined }) },
    })
    // StatusDotBadge renders with data-testid="status-badge" when
    // defined. When undefined, the v-if prevents it entirely.
    expect(wrapper.find('[data-testid="status-badge"]').exists()).toBe(false)
  })
})

describe('useMembershipColumns — column shape', () => {
  it('orders columns as [userName, roleName, createdAt, actions]', () => {
    const { columns } = useMembershipColumns()
    const ids = columns.map((c) => {
      if ('accessorKey' in c && c.accessorKey) return c.accessorKey as string
      return (c as { id: string }).id
    })
    expect(ids).toEqual(['userName', 'roleName', 'createdAt', 'actions'])
  })

  it('uses the standardized Spanish headers', () => {
    const { columns } = useMembershipColumns()
    const headers = columns.map((c) => c.header)
    expect(headers).toContain('Usuario')
    expect(headers).toContain('Rol')
    expect(headers).toContain('Fecha de ingreso')
  })
})