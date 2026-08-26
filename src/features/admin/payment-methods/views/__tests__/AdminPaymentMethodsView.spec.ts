// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import AdminPaymentMethodsView from '../AdminPaymentMethodsView.vue'
import type { PaymentMethodTableRow } from '../../interfaces/payment-method.types'

// ── Single-source wrapper mock ────────────────────────────────────────────────
//
// S2B is read-only: the view consumes `usePaymentMethodsTable` for the
// `data` page slice + `fullList` for list-wide flags (none currently, but
// the wrapper exposes it for parity). `create`/`update`/`remove` mutation
// lifecycle lands in S3B; S2B only asserts read path + permission gating
// + empty/loading/error states.

const mockTable = {
  pagination: ref({ pageIndex: 0, pageSize: 10 }),
  sorting: ref<Array<{ id: string; desc: boolean }>>([{ id: 'updatedAt', desc: true }]),
  globalFilter: ref(''),
  columnPinning: ref({ left: [], right: ['actions'] }),
  columnVisibility: ref<Record<string, boolean>>({}),
  data: ref<PaymentMethodTableRow[]>([]),
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
  fullList: ref<PaymentMethodTableRow[]>([]),
}

vi.mock('@/features/admin/payment-methods/composables/usePaymentMethodsTable', () => ({
  usePaymentMethodsTable: () => mockTable,
}))

const authMock = {
  userCan: vi.fn(),
  currentTenantId: 'tenant-1',
  currentTenant: { name: 'Acme Tenant' },
}
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authMock,
}))

vi.mock('@/features/admin/payment-methods/composables/usePaymentMethodColumns', () => ({
  usePaymentMethodColumns: () => ({ columns: [] }),
}))

vi.mock('@/features/admin/payment-methods/composables/usePaymentMethodViewMode', () => ({
  usePaymentMethodViewMode: () => ({
    viewMode: ref('table'),
    setMode: vi.fn(),
    displayMode: computed(() => 'table'),
  }),
  isPaymentMethodViewMode: (value: string) => value === 'table' || value === 'card',
}))

// AppDataTable stub: exposes showAddButton + displayMode + error + empty so
// the view's gating assertions are genuine (not no-ops).
vi.mock('@/core/shared/components/DataTable/AppDataTable.vue', () => ({
  default: {
    name: 'AppDataTable',
    template: `
      <div
        data-testid="app-data-table"
        :data-show-add-button="showAddButton ? 'true' : 'false'"
        :data-display-mode="displayMode"
        :data-error="error ? 'true' : 'false'"
        :data-error-message="errorMessage"
      >
        <slot name="actions" />
        <div v-if="error" data-testid="table-error-state" role="alert">
          <p data-testid="error-message">{{ errorMessage }}</p>
          <button data-testid="table-error-retry" @click="$emit('refresh')">Reintentar</button>
        </div>
        <div v-else-if="(Array.isArray(data) ? data : []).length === 0" data-testid="table-empty-state">{{ empty }}</div>
        <div v-else data-testid="table-data">
          <div v-for="row in (Array.isArray(data) ? data : [])" :key="row.id">
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
      showAddButton: { type: Boolean, default: false },
      error: { default: false },
      errorMessage: { default: 'No se pudieron cargar los datos. Reintenta.' },
      empty: { default: 'No se encontraron resultados' },
    },
    emits: ['add', 'refresh'],
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

vi.mock('@/core/shared/components/ViewToggle.vue', () => ({
  default: {
    name: 'ViewToggle',
    template:
      '<div data-testid="view-toggle"><button data-testid="view-toggle-table" @click="$emit(\'update:modelValue\', \'table\')">Tabla</button><button data-testid="view-toggle-card" @click="$emit(\'update:modelValue\', \'card\')">Tarjetas</button></div>',
    props: ['modelValue', 'options', 'ariaLabel'],
    emits: ['update:modelValue'],
  },
}))

vi.mock('@/features/admin/shared/components/AdminPageHeader.vue', () => ({
  default: {
    name: 'AdminPageHeader',
    template: '<div data-testid="admin-page-header"><p data-testid="admin-page-header-title">{{ title }}</p><p data-testid="admin-page-header-description">{{ description }}</p></div>',
    props: ['title', 'description'],
  },
}))

const nuxtUiStubs = {
  UButton: { name: 'UButton', template: '<button v-bind="$attrs" @click="$emit(\'click\')" :data-testid="$attrs[\'data-testid\']"><slot /></button>', emits: ['click'] },
  Button: { name: 'Button', template: '<button @click="$emit(\'click\')"><slot /></button>' },
  UIcon: { name: 'UIcon', template: '<span />', props: ['name'] },
  Icon: { name: 'Icon', template: '<span />' },
  UCard: { name: 'UCard', template: '<div><slot name="header" /><slot /></div>' },
  Card: { name: 'Card', template: '<div><slot name="header" /><slot /></div>' },
}

function makeRow(overrides: Partial<PaymentMethodTableRow> = {}): PaymentMethodTableRow {
  return {
    id: 'pm-1',
    tenantId: 'tenant-1',
    name: 'Mercado Pago',
    category: 'transfer',
    subtitle: 'Link',
    isActive: true,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-05-15T00:00:00.000Z',
    ...overrides,
  }
}

function mountView() {
  return mount(AdminPaymentMethodsView, {
    global: { stubs: nuxtUiStubs },
  })
}

beforeEach(() => {
  localStorage.clear()
  mockTable.pagination.value = { pageIndex: 0, pageSize: 10 }
  mockTable.sorting.value = [{ id: 'updatedAt', desc: true }]
  mockTable.globalFilter.value = ''
  mockTable.columnPinning.value = { left: [], right: ['actions'] }
  mockTable.columnVisibility.value = {}
  mockTable.data.value = []
  mockTable.totalCount.value = 0
  mockTable.pageCount.value = 0
  mockTable.isLoading.value = false
  mockTable.isFetching.value = false
  mockTable.isError.value = false
  mockTable.error.value = null
  mockTable.fullList.value = []
  mockTable.refresh.mockClear()
  authMock.userCan.mockReset()
  authMock.userCan.mockReturnValue(true)
})

describe('AdminPaymentMethodsView — read view (sdd custom-payment-methods S2B, REQ-PM-001/006/011)', () => {
  it('renders the page header with title and description (REQ-PM-001)', async () => {
    const wrapper = mountView()
    await flushPromises()
    const titleEl = wrapper.find('[data-testid="admin-page-header-title"]')
    const descEl = wrapper.find('[data-testid="admin-page-header-description"]')
    expect(titleEl.exists()).toBe(true)
    expect(titleEl.text()).toBe('Métodos de cobro')
    expect(descEl.exists()).toBe(true)
    expect(descEl.text()).toContain('Catálogo personalizado')
  })

  it('renders active + inactive rows; active shows "Activo", inactive shows "Inactivo" (REQ-PM-001)', async () => {
    mockTable.data.value = [
      makeRow({ id: 'a', name: 'Mercado Pago', isActive: true }),
      makeRow({ id: 'b', name: 'SPEI', isActive: false }),
      makeRow({ id: 'c', name: 'Visa Débito', isActive: true }),
    ]
    mockTable.fullList.value = mockTable.data.value
    const wrapper = mountView()
    await flushPromises()

    // The AppDataTable stub renders the cells via slot; verify the isActive
    // badge label is wired through `paymentMethodStatusLabel`. We assert
    // through the stub's slot emission of `row.original`.
    const html = wrapper.html()
    // The status label is computed inside the view's slot template; the
    // label source is `paymentMethodStatusLabel`. The view wires the badge
    // label via `paymentMethodStatusLabel(row.original.isActive)` (REQ-PM-001).
    // We assert the testid-based data row is rendered for each row.
    expect(html).toContain('Activo')
    expect(html).toContain('Inactivo')
  })

  it('does NOT render a "no active methods" banner even when all rows are inactive (REQ-PM-001)', async () => {
    mockTable.data.value = [makeRow({ id: 'a', isActive: false })]
    mockTable.fullList.value = mockTable.data.value
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="no-active-methods-banner"]').exists()).toBe(false)
  })

  it('shows the empty state when the list is empty (REQ-PM-011)', async () => {
    mockTable.data.value = []
    mockTable.fullList.value = []
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="table-empty-state"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No hay métodos de cobro')
  })

  it('renders the error block when isError is true (REQ-PM-011)', async () => {
    mockTable.isError.value = true
    mockTable.error.value = { message: 'boom' }
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="table-error-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="error-message"]').exists()).toBe(true)
  })

  it('hides the add button when user lacks create:PaymentMethod (REQ-PM-006)', async () => {
    authMock.userCan.mockImplementation((action: string, subject: string) => {
      if (subject === 'PaymentMethod' && action === 'create') return false
      return true
    })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="app-data-table"]').attributes('data-show-add-button')).toBe('false')
  })

  it('shows the add button when user has create:PaymentMethod (REQ-PM-006)', async () => {
    authMock.userCan.mockImplementation((action: string, subject: string) => {
      if (subject === 'PaymentMethod' && action === 'create') return true
      return true
    })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="app-data-table"]').attributes('data-show-add-button')).toBe('true')
  })

  it('uses displayMode from usePaymentMethodViewMode for the AppDataTable', async () => {
    const wrapper = mountView()
    await flushPromises()
    // The view forwards displayMode from the wrapper; the stub exposes it.
    expect(wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe('table')
  })

  it('uses displayMode from usePaymentMethodViewMode for the AppDataTable', async () => {
    const wrapper = mountView()
    await flushPromises()
    // The view forwards displayMode from the wrapper; the stub exposes it.
    expect(wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe('table')
  })
})

describe('AdminPaymentMethodsView — list error state (sdd custom-payment-methods S2B, REQ-PM-011)', () => {
  it('renders the table error block (NOT a toast) when list fetch fails', async () => {
    mockTable.isError.value = true
    mockTable.error.value = { response: { data: { message: 'Falla de red' } } }
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="table-error-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="error-message"]').text()).toContain('Falla de red')
  })

  it('falls back to Spanish copy when no backend message is available', async () => {
    mockTable.isError.value = true
    mockTable.error.value = null
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="error-message"]').text()).toContain('No se pudieron cargar los métodos de cobro')
  })
})

describe('AdminPaymentMethodsView — permission gating (sdd custom-payment-methods S2B, REQ-PM-006)', () => {
  it('reads userCan("read", "PaymentMethod") is not needed inside the view — the route guard handles it', async () => {
    // The CASL read gate happens at the route meta.permission level
    // (`/admin/payment-methods` requires `['read', 'PaymentMethod']`); the
    // view itself does not need to re-check. We assert the create gate is
    // consulted and read is NOT consulted inside the view body so a future
    // regression that adds a redundant read call is caught.
    authMock.userCan.mockReset()
    authMock.userCan.mockReturnValue(true)
    mountView()
    await flushPromises()
    const calls = authMock.userCan.mock.calls
    const sawCreatePaymentMethod = calls.some(
      (c) => c[0] === 'create' && c[1] === 'PaymentMethod',
    )
    expect(sawCreatePaymentMethod).toBe(true)
    const sawReadPaymentMethod = calls.some(
      (c) => c[0] === 'read' && c[1] === 'PaymentMethod',
    )
    expect(sawReadPaymentMethod).toBe(false)
  })

  })

describe('AdminPaymentMethodsView — view-mode toggle (sdd custom-payment-methods S2B, REQ-PM-001)', () => {
  it('renders the view toggle inside the actions slot', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="view-toggle"]').exists()).toBe(true)
  })
})
// ─── S3B: mutation lifecycle + CASL gating + ConfirmModal + error dispatch ──

const toastMock = { add: vi.fn() }
vi.mock('@nuxt/ui/runtime/composables/useToast', () => ({
  useToast: () => toastMock,
}))

const mutationHandles: Array<{
  config: { onSuccess?: (...args: unknown[]) => unknown; onError?: (...args: unknown[]) => unknown }
  mutate: ReturnType<typeof vi.fn>
  mutateAsync: ReturnType<typeof vi.fn>
  isPending: { value: boolean }
  lastArgs?: unknown[]
}> = []
const invalidateQueriesMock = vi.fn()

vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: ref([]), isLoading: ref(false) }),
  useMutation: (config: { onSuccess?: (...args: unknown[]) => unknown; onError?: (...args: unknown[]) => unknown }) => {
    const handle = {
      config,
      mutate: vi.fn((...args: unknown[]) => {
        handle.lastArgs = args
        if (config?.onSuccess) void config.onSuccess(...args)
      }),
      mutateAsync: vi.fn(async (...args: unknown[]) => {
        handle.lastArgs = args
        if (config?.onSuccess) void config.onSuccess(...args)
        return args[0]
      }),
      isPending: ref(false),
    }
    mutationHandles.push(handle)
    return handle
  },
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock, refetchQueries: vi.fn() }),
}))

vi.mock('@/features/admin/payment-methods/components/PaymentMethodUpsertSlideover.vue', () => ({
  default: {
    name: 'PaymentMethodUpsertSlideover',
    template:
      '<div :data-testid="`upsert-slideover-${mode}`" :data-mode="mode"><slot /></div>',
    props: ['open', 'mode', 'loading', 'paymentMethod'],
    emits: ['create', 'edit', 'update:open'],
  },
}))

vi.mock('@/features/admin/payment-methods/components/PaymentMethodCardGrid.vue', () => ({
  default: {
    name: 'PaymentMethodCardGrid',
    template:
      '<div data-testid="card-grid"><button v-for="row in paymentMethods" :key="row.id" :data-testid="`card-${row.id}`" @click="$emit(\'card-click\', row)">{{ row.name }}</button></div>',
    props: ['paymentMethods', 'loading', 'empty'],
    emits: ['card-click'],
  },
}))

vi.mock('@/core/shared/components/ConfirmModal.vue', () => ({
  default: {
    name: 'ConfirmModal',
    template:
      '<div data-testid="confirm-modal" :data-open="open ? \'true\' : \'false\'" :data-description="description"><slot /></div>',
    props: ['open', 'description', 'confirmLabel', 'confirmColor', 'loading'],
    emits: ['update:open', 'confirm', 'cancel'],
  },
}))

beforeEach(() => {
  mutationHandles.length = 0
  invalidateQueriesMock.mockClear()
  toastMock.add.mockClear()
})

describe('AdminPaymentMethodsView — slideover gating (sdd custom-payment-methods S3B, REQ-PM-006)', () => {
  it('renders the create slideover always (open state starts false)', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="upsert-slideover-create"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="upsert-slideover-edit"]').exists()).toBe(true)
  })

  it('create slideover is hidden from the DOM when showAddButton is false', async () => {
    authMock.userCan.mockImplementation((action: string, subject: string) => {
      if (subject === 'PaymentMethod' && action === 'create') return false
      return true
    })
    const wrapper = mountView()
    await flushPromises()
    // The view conditionally renders the create slideover with `v-if` only when
    // the user has create:PaymentMethod. The data-testid="upsert-slideover-create"
    // must NOT be in the DOM.
    expect(wrapper.find('[data-testid="upsert-slideover-create"]').exists()).toBe(false)
  })
})

describe('AdminPaymentMethodsView — mutation lifecycle (sdd custom-payment-methods S3B, REQ-PM-007/010)', () => {
  it('invokes 3 useMutation hooks (create / update / remove)', async () => {
    mountView()
    await flushPromises()
    expect(mutationHandles.length).toBe(3)
  })

  it('create success invalidates adminPaymentMethodQueryKeys.list(tenantId) (REQ-PM-010)', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(mutationHandles.length).toBe(3)

    // Trigger the create mutation directly via its captured handle.
    const createMutation = mutationHandles[0]!
    createMutation.mutate({ name: 'MP', category: 'transfer' })
    await flushPromises()

    expect(invalidateQueriesMock).toHaveBeenCalled()
    const call = invalidateQueriesMock.mock.calls[0]![0]
    expect(call).toEqual({ queryKey: ['admin', 'payment-methods', 'tenant-1', 'list'] })
  })

  it('create success does NOT invalidate saleQueryKeys.paymentMethods (REQ-PM-010 cross-check)', async () => {
    mountView()
    await flushPromises()
    const createMutation = mutationHandles[0]!
    createMutation.mutate({ name: 'MP', category: 'transfer' })
    await flushPromises()

    const invalidateCalls = invalidateQueriesMock.mock.calls
    const sawSaleProjectionInvalidation = invalidateCalls.some(
      (c) => {
        const key = (c[0] as { queryKey: readonly unknown[] }).queryKey
        return key.includes('payment-methods') && key.includes('sales')
      },
    )
    expect(sawSaleProjectionInvalidation).toBe(false)
  })

  it('update success invalidates the list query', async () => {
    mountView()
    await flushPromises()
    const updateMutation = mutationHandles[1]!
    updateMutation.mutate({ id: 'pm-1', data: { name: 'NEW' } })
    await flushPromises()

    expect(invalidateQueriesMock).toHaveBeenCalled()
  })

  it('delete success invalidates the list query', async () => {
    mountView()
    await flushPromises()
    const deleteMutation = mutationHandles[2]!
    deleteMutation.mutate('pm-1')
    await flushPromises()

    expect(invalidateQueriesMock).toHaveBeenCalled()
  })
})

describe('AdminPaymentMethodsView — error dispatch (sdd custom-payment-methods S3B, REQ-PM-007)', () => {
  it('create error with DUPLICATE_NAME toasts the specific domain message', async () => {
    mountView()
    await flushPromises()
    const createMutation = mutationHandles[0]!
    createMutation.config.onError?.({
      response: { data: { error: 'DUPLICATE_NAME' } },
    })
    await flushPromises()
    expect(toastMock.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Ya existe un método con ese nombre en esta sucursal',
        color: 'error',
      }),
    )
  })

  it('create error with ENTITY_NOT_FOUND toasts the domain message', async () => {
    mountView()
    await flushPromises()
    const createMutation = mutationHandles[0]!
    createMutation.config.onError?.({
      response: { data: { error: 'ENTITY_NOT_FOUND' } },
    })
    await flushPromises()
    expect(toastMock.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'No encontrado',
        color: 'error',
      }),
    )
  })

  it('update error with NAME_TOO_LONG toasts the domain message', async () => {
    mountView()
    await flushPromises()
    const updateMutation = mutationHandles[1]!
    updateMutation.config.onError?.({
      response: { data: { error: 'NAME_TOO_LONG' } },
    })
    await flushPromises()
    expect(toastMock.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'El nombre no puede superar 60 caracteres',
        color: 'error',
      }),
    )
  })
})
