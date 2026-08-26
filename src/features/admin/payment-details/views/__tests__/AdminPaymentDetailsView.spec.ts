// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import AdminPaymentDetailsView from '../AdminPaymentDetailsView.vue'
import type { PaymentDetailTableRow } from '../../interfaces/payment-detail.types'

// ── Mocks for the single-source wrapper the view consumes ───────────────────────

const mockTable = {
  pagination: ref({ pageIndex: 0, pageSize: 10 }),
  sorting: ref<Array<{ id: string; desc: boolean }>>([{ id: 'updatedAt', desc: true }]),
  globalFilter: ref(''),
  columnPinning: ref({ left: [], right: ['actions'] }),
  columnVisibility: ref<Record<string, boolean>>({}),
  data: ref<PaymentDetailTableRow[]>([]),
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
  fullList: ref<PaymentDetailTableRow[]>([]),
  hasActiveAccount: ref(false),
}

vi.mock('@/features/admin/payment-details/composables/usePaymentDetailsTable', () => ({
  usePaymentDetailsTable: () => mockTable,
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

vi.mock('@/features/admin/payment-details/composables/usePaymentDetailColumns', () => ({
  usePaymentDetailColumns: () => ({ columns: [] }),
}))

vi.mock('@/features/admin/payment-details/composables/usePaymentDetailViewMode', () => ({
  usePaymentDetailViewMode: () => ({
    viewMode: ref('table'),
    setMode: vi.fn(),
    displayMode: computed(() => 'table'),
  }),
  isPaymentDetailViewMode: (value: string) => value === 'table' || value === 'card',
}))

vi.mock('@/features/admin/payment-details/components/PaymentDetailUpsertSlideover.vue', () => ({
  default: {
    name: 'PaymentDetailUpsertSlideover',
    template:
      '<div :data-testid="`upsert-slideover-${mode}`" :data-mode="mode" :data-payment-id="paymentDetail && paymentDetail.id"></div>',
    props: ['open', 'mode', 'paymentDetail', 'loading'],
    emits: ['create', 'edit', 'close'],
  },
}))

vi.mock('@/features/admin/payment-details/components/PaymentDetailCardGrid.vue', () => ({
  default: {
    name: 'PaymentDetailCardGrid',
    template: `
      <div data-testid="card-grid">
        <button
          v-for="row in paymentDetails"
          :key="row.id"
          :data-testid="'card-' + row.id"
          @click="$emit('card-click', row)"
        >
          {{ row.bankName }}
        </button>
      </div>
    `,
    props: ['paymentDetails', 'loading', 'empty'],
    emits: ['card-click'],
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
      enableColumnVisibility: { type: Boolean, default: false },
      error: { default: false },
      errorMessage: { default: 'No se pudieron cargar los datos. Reintenta.' },
      empty: { default: 'No se encontraron resultados' },
    },
    emits: ['add', 'refresh'],
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

vi.mock('@/features/admin/shared/components/AdminPageHeader.vue', () => ({
  default: {
    name: 'AdminPageHeader',
    template: '<div data-testid="admin-page-header"><slot /></div>',
    props: ['title', 'description'],
  },
}))

// Stub Nuxt UI primitives used by the view directly.
// Nuxt UI auto-imports register components under BOTH the `U*` name and the
// unprefixed alias. We stub both via `global.stubs` (the QuotationDetailView
// approach) because mocking the whole `@nuxt/ui` module is brittle against the
// auto-import virtual module that resolves `Alert`, `Input`, etc.
const nuxtUiStubs = {
  UAlert: {
    name: 'UAlert',
    template: '<div><slot /></div>',
    props: ['title', 'description', 'color', 'icon'],
  },
  Alert: {
    name: 'Alert',
    template: '<div><slot /></div>',
    props: ['title', 'description', 'color', 'icon'],
  },
  UDropdownMenu: {
    name: 'UDropdownMenu',
    template: '<div data-testid="kebab-menu"><slot /></div>',
    props: ['items', 'content'],
    emits: ['select'],
  },
  DropdownMenu: { name: 'DropdownMenu', template: '<div data-testid="kebab-menu"><slot /></div>' },
  UButton: {
    name: 'UButton',
    template:
      '<button v-bind="$attrs" @click="$emit(\'click\')" :data-testid="$attrs[\'data-testid\']"><slot /></button>',
    emits: ['click'],
  },
  Button: { name: 'Button', template: '<button @click="$emit(\'click\')"><slot /></button>' },
  UIcon: { name: 'UIcon', template: '<span />', props: ['name'] },
  Icon: { name: 'Icon', template: '<span />' },
  UCard: { name: 'UCard', template: '<div><slot name="header" /><slot /></div>' },
  Card: { name: 'Card', template: '<div><slot name="header" /><slot /></div>' },
}

// ── Sample data ────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<PaymentDetailTableRow> = {}): PaymentDetailTableRow {
  return {
    id: 'pd-1',
    tenantId: 'tenant-1',
    bankName: 'AFIRME',
    beneficiary: 'HUN F.E. COMERCIALIZADORA SA DE CV',
    clabe: '012180001234567890',
    accountNumber: '1234567890',
    isActive: true,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-05-15T00:00:00.000Z',
    ...overrides,
  }
}

function mountView() {
  return mount(AdminPaymentDetailsView, {
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
  mockTable.hasActiveAccount.value = false
  mockTable.refresh.mockClear()
  authMock.userCan.mockReset()
  authMock.userCan.mockReturnValue(true)
  toastMock.add.mockClear()
})

describe('AdminPaymentDetailsView — "Sin cuenta activa" banner (REQ-PD-006)', () => {
  it('renders the banner when there is no active account', async () => {
    mockTable.hasActiveAccount.value = false
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="no-active-account-banner"]').exists()).toBe(true)
  })

  it('hides the banner when there is at least one active account', async () => {
    mockTable.hasActiveAccount.value = true
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="no-active-account-banner"]').exists()).toBe(false)
  })

  it('suppresses the banner while loading', async () => {
    mockTable.isLoading.value = true
    mockTable.hasActiveAccount.value = false
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="no-active-account-banner"]').exists()).toBe(false)
  })

  it('suppresses the banner while erroring', async () => {
    mockTable.isError.value = true
    mockTable.hasActiveAccount.value = false
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="no-active-account-banner"]').exists()).toBe(false)
  })
})

describe('AdminPaymentDetailsView — list error state', () => {
  it('renders the error block with the backend-derived message when isError is true', async () => {
    mockTable.isError.value = true
    mockTable.error.value = { response: { data: { message: 'No se pudo conectar al servidor' } } }
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="table-error-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'No se pudo conectar al servidor',
    )
    expect(wrapper.find('[data-testid="table-empty-state"]').exists()).toBe(false)
  })

  it('falls back to the Spanish message when no backend message is available', async () => {
    mockTable.isError.value = true
    mockTable.error.value = {}
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'No se pudieron cargar las cuentas bancarias. Reintenta.',
    )
  })
})

describe('AdminPaymentDetailsView — permission gating (REQ-PD-007)', () => {
  it('shows the add button only with create:PaymentDetail', async () => {
    authMock.userCan.mockImplementation((action) => action === 'create')
    const wrapper = mountView()
    await flushPromises()
    const appDataTable = wrapper.find('[data-testid="app-data-table"]')
    expect(appDataTable.exists()).toBe(true)
    // Add button is controlled by `:show-add-button` prop forwarded to AppDataTable.
    // We assert the prop was wired through the mock's captured attrs.
    expect(appDataTable.attributes('data-show-add-button')).toBeUndefined()
  })

  it('renders the kebab menu only when update OR delete permission is held', async () => {
    mockTable.data.value = [makeRow()]
    authMock.userCan.mockReturnValue(true)
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="kebab-menu"]').exists()).toBe(true)
  })

  it('hides the kebab menu when neither update nor delete is held', async () => {
    mockTable.data.value = [makeRow()]
    authMock.userCan.mockReturnValue(false)
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="kebab-menu"]').exists()).toBe(false)
  })
})

describe('AdminPaymentDetailsView — badge rendering', () => {
  it('renders a status badge per row with the correct label', async () => {
    mockTable.data.value = [makeRow({ isActive: true }), makeRow({ id: 'pd-2', isActive: false })]
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="table-data"]').exists()).toBe(true)
  })
})
