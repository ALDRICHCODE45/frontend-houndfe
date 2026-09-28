import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { computed, ref, reactive } from 'vue'
import { routeLocationKey } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
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

const authMock = reactive({
  userCan: vi.fn(),
  currentTenantId: 'tenant-1',
  currentTenant: { name: 'Acme Tenant' },
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authMock,
}))

const toastMock = { add: vi.fn() }
;(globalThis as { useToast?: () => typeof toastMock }).useToast = () => toastMock

const apiMock = vi.hoisted(() => ({
  getById: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('../../api/users.api', () => ({ usersApi: apiMock }))
const invalidateQueries = vi.fn()
const setQueryData = vi.fn()
vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return { ...actual, useQueryClient: () => ({ invalidateQueries, setQueryData }) }
})

vi.mock('../../components/UserUpsertSlideover.vue', () => ({
  default: {
    name: 'UserUpsertSlideover',
    template:
      '<div :data-testid="`user-upsert-slideover-${mode}`" :data-mode="mode" :data-user-id="user && user.id"></div>',
    props: [
      'open',
      'mode',
      'user',
      'loading',
      'detail',
      'detailLoading',
      'errorMessage',
      'session',
    ],
    emits: ['create', 'edit', 'update:open', 'retry'],
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
            <slot name="name-cell" :row="{ original: row }" />
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
  default: {
    name: 'AppBadge',
    template: '<span><slot /></span>',
    props: ['label', 'value', 'tone', 'icon', 'variant'],
  },
}))

// The Usuario cell owns the avatar contract: which name, which seed and whether
// the status dot renders. Exposing those props as data attributes keeps the spec
// on the view's public surface, exactly like the other child stubs here.
vi.mock('@/core/shared/components/EntityAvatar.vue', () => ({
  default: {
    name: 'EntityAvatar',
    template:
      '<span data-testid="entity-avatar" :data-name="name" :data-seed="seed" :data-show-dot="String(showDot)" />',
    props: ['name', 'seed', 'showDot', 'dotClass', 'size'],
  },
}))

vi.mock('@/core/shared/components/ConfirmModal.vue', () => ({
  default: {
    name: 'ConfirmModal',
    template: '<div />',
    props: ['open', 'description', 'confirmLabel', 'confirmColor', 'loading'],
    emits: ['update:open', 'confirm'],
  },
}))

vi.mock('@/features/admin/shared/components/AdminPageHeader.vue', () => ({
  default: {
    name: 'AdminPageHeader',
    template: '<div data-testid="admin-page-header"><slot /></div>',
    props: ['title', 'description'],
  },
}))

// The seller report drawer is a separate slice with its own specs. Here the view
// contract is only: which seller, which tenant, which permission, open or not.
vi.mock('../../seller-report/components/SellerSalesReportDrawer.vue', () => ({
  default: {
    name: 'SellerSalesReportDrawer',
    template: `
      <div
        data-testid="seller-report-drawer"
        :data-open="String(open)"
        :data-tenant-id="tenantId"
        :data-seller-id="seller && seller.id"
        :data-can-read="String(canRead)"
      />
    `,
    props: ['open', 'tenantId', 'seller', 'canRead'],
    emits: ['update:open'],
  },
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
  UModal: {
    name: 'UModal',
    template: '<div><slot name="body" /><slot name="footer" /></div>',
    props: ['open', 'title', 'content'],
  },
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

const wrappers: VueWrapper[] = []
function mountView() {
  const wrapper = mount(AdminUsersView, {
    global: {
      plugins: [
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { mutations: { retry: false } } }) },
        ],
      ],
      provide: { [routeLocationKey as symbol]: {} },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

// ── Reset mock state between tests ───────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
  authMock.currentTenantId = 'tenant-1'
  apiMock.getById.mockReset().mockImplementation(async (id: string) => ({
    user: makeUser({ id }),
    roles: [{ id: roleA, name: 'Tenant role' }],
  }))
  apiMock.update.mockReset().mockResolvedValue({})
  apiMock.create.mockReset().mockRejectedValue(new Error('Unexpected create'))
  apiMock.remove.mockReset().mockRejectedValue(new Error('Unexpected remove'))
  invalidateQueries.mockReset().mockResolvedValue(undefined)
  setQueryData.mockReset()
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
    expect(wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe(
      'table',
    )
  })

  it('passes display-mode="cards" after toggling to card mode via localStorage', async () => {
    localStorage.setItem('admin-users-view-mode', 'card')
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe(
      'cards',
    )
  })

  it('wires enable-column-visibility on the AppDataTable', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-column-visibility'),
    ).toBe('true')
  })
})

describe('AdminUsersView — usuario avatar', () => {
  it('renders EntityAvatar with the user name and id seed and the active dot', async () => {
    mockState.data.value = [makeUser({ id: 'user-7', name: 'Ana Gomez', isActive: true })]
    const wrapper = mountView()
    await flushPromises()

    const avatar = wrapper.find('[data-testid="entity-avatar"]')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('data-name')).toBe('Ana Gomez')
    expect(avatar.attributes('data-seed')).toBe('user-7')
    expect(avatar.attributes('data-show-dot')).toBe('true')
  })

  it('omits the active dot for an inactive user', async () => {
    mockState.data.value = [makeUser({ id: 'user-8', name: 'Beto Ruiz', isActive: false })]
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="entity-avatar"]').attributes('data-show-dot')).toBe('false')
  })

  it('replaces the legacy UAvatar in the name cell', async () => {
    mockState.data.value = [makeUser()]
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="entity-avatar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="u-avatar"]').exists()).toBe(false)
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
    vi.stubGlobal('useRouter', () => ({ push: routerPush }))

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
    vi.unstubAllGlobals()
  })
})

const roleA = 'abd93355-a3dc-4ae7-8f17-877ff3986d2c'
const roleB = 'bdbaea96-4b0b-4c6e-ae92-b1306f7e369d'
function deferred() {
  let resolve!: (value: unknown) => void
  let reject!: (error: unknown) => void
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function editor(wrapper: VueWrapper) {
  return wrapper
    .findAllComponents({ name: 'UserUpsertSlideover' })
    .find((child) => child.props('mode') === 'edit')!
}
async function openEditor(wrapper: VueWrapper, id = 'user-1') {
  await wrapper.find(`[data-testid="card-${id}"]`).trigger('click')
  await flushPromises()
  return editor(wrapper)
}
function submit(
  child: ReturnType<typeof editor>,
  payload: { name: string; email?: string; roleIds?: string[] },
) {
  child.vm.$emit('edit', payload, child.props('session'))
}

describe('AdminUsersView — detail-backed mutations', () => {
  beforeEach(() => {
    mockState.data.value = [makeUser(), makeUser({ id: 'user-2' })]
  })

  it('loads authoritative detail and forwards email and the complete role set', async () => {
    const wrapper = mountView()
    const child = await openEditor(wrapper)
    expect(apiMock.getById).toHaveBeenCalledWith('user-1')
    expect(child.props('detail').roles).toEqual([{ id: roleA, name: 'Tenant role' }])
    submit(child, { name: 'Edited', email: 'new@test.com', roleIds: [roleA, roleB] })
    await flushPromises()
    expect(apiMock.update).toHaveBeenCalledWith('user-1', {
      name: 'Edited',
      email: 'new@test.com',
      roleIds: [roleA, roleB],
    })
    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['admin', 'users', 'tenant-1', 'paginated'] }),
      { throwOnError: true },
    )
    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['admin', 'users', 'tenant-1', 'detail', 'user-1'] }),
    )
    expect(apiMock.getById).toHaveBeenCalledTimes(2)
    expect(editor(wrapper).props('open')).toBe(false)
  })

  it('cannot submit before detail loads or after detail fails', async () => {
    const request = deferred()
    apiMock.getById.mockReturnValueOnce(request.promise)
    const wrapper = mountView()
    const child = await openEditor(wrapper)
    submit(child, { name: 'Edited' })
    expect(apiMock.update).not.toHaveBeenCalled()
    request.reject({ response: { data: { message: 'Forbidden detail' } } })
    await flushPromises()
    submit(editor(wrapper), { name: 'Edited' })
    expect(apiMock.update).not.toHaveBeenCalled()
    expect(editor(wrapper).props('errorMessage')).toContain('Forbidden detail')
    editor(wrapper).vm.$emit('retry')
    await flushPromises()
    expect(editor(wrapper).props('detail').user.id).toBe('user-1')
  })

  it.each([400, 403, 409])('preserves the editor on HTTP %s', async (status) => {
    apiMock.update.mockRejectedValueOnce({
      response: { status, data: { message: ['Useful error'] } },
    })
    const child = await openEditor(mountView())
    submit(child, { name: 'Edited', email: 'new@test.com' })
    await flushPromises()
    expect(child.props('open')).toBe(true)
    expect(child.props('errorMessage')).toContain('Useful error')
    expect(invalidateQueries).not.toHaveBeenCalled()
  })

  it('treats a refresh failure as saved, not as a failed write', async () => {
    invalidateQueries.mockRejectedValue(new Error('Refresh failed'))
    const wrapper = mountView()
    submit(await openEditor(wrapper), { name: 'Edited' })
    await flushPromises()
    expect(apiMock.update).toHaveBeenCalledTimes(1)
    expect(editor(wrapper).props('open')).toBe(false)
    expect(wrapper.text()).toContain('guardado')
    expect(apiMock.getById).toHaveBeenCalledTimes(2)
  })

  it('omits reordered roles and gates replacement without blocking profile edits', async () => {
    authMock.userCan.mockImplementation(
      (_action: string, subject: string) => subject !== 'TenantMembership',
    )
    const child = await openEditor(mountView())
    submit(child, { name: 'Edited', roleIds: [roleB] })
    await flushPromises()
    expect(apiMock.update).not.toHaveBeenCalled()
    submit(child, { name: 'Edited' })
    await flushPromises()
    expect(apiMock.update).toHaveBeenCalledWith('user-1', { name: 'Edited' })
  })

  it('does not serialize a role set that is unchanged', async () => {
    const child = await openEditor(mountView())
    submit(child, { name: 'Edited', roleIds: [roleA] })
    await flushPromises()
    expect(apiMock.update).toHaveBeenCalledWith('user-1', { name: 'Edited' })
  })

  it.each(['user', 'tenant', 'reopen'])('fences stale detail on %s ABA', async (change) => {
    const oldRequest = deferred()
    apiMock.getById.mockReturnValueOnce(oldRequest.promise)
    const wrapper = mountView()
    await openEditor(wrapper)
    if (change === 'user') {
      await openEditor(wrapper, 'user-2')
      await openEditor(wrapper)
    }
    if (change === 'tenant') {
      authMock.currentTenantId = 'tenant-2'
      await flushPromises()
      authMock.currentTenantId = 'tenant-1'
      await flushPromises()
    }
    if (change === 'reopen') {
      editor(wrapper).vm.$emit('update:open', false)
      await flushPromises()
      await openEditor(wrapper)
    }
    oldRequest.resolve({ user: makeUser({ name: 'STALE' }), roles: [] })
    await flushPromises()
    expect(editor(wrapper).props('detail').user.name).not.toBe('STALE')
  })

  it.each(['user', 'tenant', 'reopen'])(
    'stale mutation cannot close a newer editor after %s',
    async (change) => {
      const oldWrite = deferred()
      apiMock.update.mockReturnValueOnce(oldWrite.promise)
      const wrapper = mountView()
      submit(await openEditor(wrapper), { name: 'Edited' })
      await flushPromises()
      if (change === 'user') {
        await openEditor(wrapper, 'user-2')
        await openEditor(wrapper)
      }
      if (change === 'tenant') {
        authMock.currentTenantId = 'tenant-2'
        await flushPromises()
        authMock.currentTenantId = 'tenant-1'
        await flushPromises()
      }
      if (change === 'reopen') {
        editor(wrapper).vm.$emit('update:open', false)
        await flushPromises()
        await openEditor(wrapper)
      }
      oldWrite.resolve({})
      await flushPromises()
      expect(editor(wrapper).props('open')).toBe(true)
      expect(editor(wrapper).props('errorMessage')).toBe('')
    },
  )
})

describe('AdminUsersView — submission boundaries', () => {
  beforeEach(() => {
    mockState.data.value = [makeUser()]
  })

  it('rejects empty/duplicate role replacements without issuing a PATCH', async () => {
    const child = await openEditor(mountView())
    submit(child, { name: 'Edited', roleIds: [] })
    submit(child, { name: 'Edited', roleIds: [roleA, roleA] })
    await flushPromises()
    expect(apiMock.update).not.toHaveBeenCalled()
  })

  it('prevents duplicate submissions while a write is pending', async () => {
    const write = deferred()
    apiMock.update.mockReturnValueOnce(write.promise)
    const child = await openEditor(mountView())
    submit(child, { name: 'Edited' })
    await flushPromises()
    submit(child, { name: 'Edited twice' })
    await flushPromises()
    expect(apiMock.update).toHaveBeenCalledTimes(1)
    write.resolve({})
    await flushPromises()
  })

  it('ignores a delayed submit event from a closed editor session', async () => {
    const wrapper = mountView()
    const oldChild = await openEditor(wrapper)
    const session = oldChild.props('session')
    oldChild.vm.$emit('update:open', false)
    await flushPromises()
    const child = await openEditor(wrapper)
    child.vm.$emit('edit', { name: 'Stale' }, session)
    await flushPromises()
    expect(apiMock.update).not.toHaveBeenCalled()
  })

  it('does not refresh an old user using a different current tenant', async () => {
    const write = deferred()
    apiMock.update.mockReturnValueOnce(write.promise)
    const wrapper = mountView()
    submit(await openEditor(wrapper), { name: 'Edited' })
    await flushPromises()
    authMock.currentTenantId = 'tenant-2'
    await flushPromises()
    const count = apiMock.getById.mock.calls.length
    write.resolve({})
    await flushPromises()
    expect(apiMock.getById).toHaveBeenCalledTimes(count)
    expect(invalidateQueries).toHaveBeenCalledWith(
      { queryKey: ['admin', 'users', 'tenant-1', 'paginated'], refetchType: 'none' },
      { throwOnError: true },
    )
    expect(editor(wrapper).props('open')).toBe(true)
  })

  it('does not show an old mutation error in a reopened editor', async () => {
    const write = deferred()
    apiMock.update.mockReturnValueOnce(write.promise)
    const wrapper = mountView()
    const child = await openEditor(wrapper)
    submit(child, { name: 'Edited' })
    await flushPromises()
    child.vm.$emit('update:open', false)
    await flushPromises()
    await openEditor(wrapper)
    write.reject(new Error('Stale error'))
    await flushPromises()
    expect(editor(wrapper).props('errorMessage')).toBe('')
  })

  it('requires update:User even when other permissions exist', async () => {
    authMock.userCan.mockImplementation(
      (action: string, subject: string) => !(action === 'update' && subject === 'User'),
    )
    const wrapper = mountView()
    await openEditor(wrapper)
    expect(editor(wrapper).props('open')).toBe(false)
    expect(apiMock.getById).not.toHaveBeenCalled()
    submit(editor(wrapper), { name: 'Edited' })
    await flushPromises()
    expect(apiMock.update).not.toHaveBeenCalled()
  })
})

// ── Seller sales report entry ────────────────────────────────

interface KebabItem {
  label?: string
  color?: string
  onSelect?: () => void
}

/**
 * The kebab's PUBLIC `items` prop is the asserted surface, exactly like the
 * committed CustomersView specs: Reka internals are not the view's contract.
 * The real Nuxt UI component is rendered here (so the existing trigger
 * assertions keep their meaning), which means it is found under its own SFC
 * name rather than under the auto-import alias.
 */
function rowKebabItems(wrapper: VueWrapper): KebabItem[] {
  const dropdowns = [
    ...wrapper.findAllComponents({ name: 'UDropdownMenu' }),
    ...wrapper.findAllComponents({ name: 'DropdownMenu' }),
  ]
  if (dropdowns.length === 0) return []
  const groups = (dropdowns[0]!.props('items') as Array<Array<KebabItem>> | undefined) ?? []
  return groups.flat()
}

function reportDrawer(wrapper: VueWrapper) {
  return wrapper.find('[data-testid="seller-report-drawer"]')
}

describe('AdminUsersView — seller sales report entry', () => {
  it('offers the report to a reader who cannot update or delete users', async () => {
    authMock.userCan.mockImplementation((action: string) => action === 'read')
    mockState.data.value = [makeUser()]
    const wrapper = mountView()
    await flushPromises()

    expect(rowKebabItems(wrapper).map((item) => item.label)).toEqual(['Ver reporte de ventas'])
    expect(reportDrawer(wrapper).attributes('data-open')).toBe('false')
  })

  it('requires read:User AND read:Sale AND read:Analytics for the report action', async () => {
    const labelsByMissingRead: Record<string, string[]> = {}

    for (const missing of ['User', 'Sale', 'Analytics'] as const) {
      authMock.userCan.mockImplementation(
        (action: string, subject: string) =>
          (action === 'update' && subject === 'User') || (action === 'read' && subject !== missing),
      )
      mockState.data.value = [makeUser()]
      const wrapper = mountView()
      await flushPromises()

      labelsByMissingRead[missing] = rowKebabItems(wrapper).map((item) => item.label ?? '')
    }

    // Update-only identities keep 'Editar'; the report disappears entirely.
    expect(labelsByMissingRead).toEqual({
      User: ['Editar'],
      Sale: ['Editar'],
      Analytics: ['Editar'],
    })
  })

  it('hides the kebab when only a partial read set is granted', async () => {
    authMock.userCan.mockImplementation(
      (action: string, subject: string) => action === 'read' && subject !== 'Sale',
    )
    mockState.data.value = [makeUser()]
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.html()).not.toContain('reka-dropdown-menu-trigger')
  })

  it('opens the report for the selected seller, including an inactive user', async () => {
    authMock.userCan.mockImplementation((action: string) => action === 'read')
    mockState.data.value = [makeUser({ id: 'user-inactive', name: 'Inactiva', isActive: false })]
    const wrapper = mountView()
    await flushPromises()

    rowKebabItems(wrapper)[0]?.onSelect?.()
    await flushPromises()

    const drawer = reportDrawer(wrapper)
    expect(drawer.attributes('data-open')).toBe('true')
    expect(drawer.attributes('data-seller-id')).toBe('user-inactive')
    expect(drawer.attributes('data-tenant-id')).toBe('tenant-1')
    expect(drawer.attributes('data-can-read')).toBe('true')
  })

  it('closes the report when the read permission is lost while it is open', async () => {
    const readAllowed = ref(true)
    authMock.userCan.mockImplementation((action: string) => action === 'read' && readAllowed.value)
    mockState.data.value = [makeUser()]
    const wrapper = mountView()
    await flushPromises()

    rowKebabItems(wrapper)[0]?.onSelect?.()
    await flushPromises()
    expect(reportDrawer(wrapper).attributes('data-open')).toBe('true')

    readAllowed.value = false
    await flushPromises()

    expect(reportDrawer(wrapper).attributes('data-open')).toBe('false')
    // The seller is cleared, so the attribute is absent rather than empty.
    expect(reportDrawer(wrapper).attributes('data-seller-id')).toBeUndefined()
  })

  it('closes the report when the tenant changes while it is open', async () => {
    authMock.userCan.mockImplementation((action: string) => action === 'read')
    mockState.data.value = [makeUser()]
    const wrapper = mountView()
    await flushPromises()

    rowKebabItems(wrapper)[0]?.onSelect?.()
    await flushPromises()
    expect(reportDrawer(wrapper).attributes('data-open')).toBe('true')

    authMock.currentTenantId = 'tenant-2'
    await flushPromises()

    expect(reportDrawer(wrapper).attributes('data-open')).toBe('false')
  })

  it('keeps the report action out of reach when it is missing at open time', async () => {
    authMock.userCan.mockImplementation((action: string) => action === 'read')
    mockState.data.value = [makeUser()]
    const wrapper = mountView()
    await flushPromises()

    expect(reportDrawer(wrapper).attributes('data-open')).toBe('false')
    expect(rowKebabItems(wrapper).map((item) => item.label)).toEqual(['Ver reporte de ventas'])
  })
})
