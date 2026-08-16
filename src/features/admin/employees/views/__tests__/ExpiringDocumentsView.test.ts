/**
 * WU-A — ExpiringDocumentsView specs (REQ-3, REQ-4, REQ-5, REQ-7, REQ-8)
 *
 * RED stubs written before the WU-A production change to ExpiringDocumentsView
 * (task 1.5). Mocks `useExpiringDocuments` (the composable surface), stubs
 * `AppDataTable` (data-error / data-error-message / data-column-visibility /
 * data-show-toolbar attrs, #filters / cell / header slots), keeps REAL
 * `SortableHeader`, and mocks the picker/name-resolution deps so the
 * un-migrated view still mounts (behavioral RED, not mount crash).
 *
 * Pinned contracts:
 *  - show-toolbar="true" (REQ-3)
 *  - enable-column-visibility (REQ-4); 4 data columns hideable, `documento` not
 *  - documentsErrorMessage precedence: response.data.message (string|array[0])
 *    → error.message → "No se pudieron cargar los documentos. Intenta de nuevo."
 *  - retry → refresh; empty placeholder suppressed on error (REQ-5)
 *  - search → globalFilter (v-model) (REQ-3)
 *  - 30/60/90 USelect lives in the #filters slot (NOT AdminPageHeader) and is
 *    bound to selectedThreshold (REQ-7)
 *  - colaborador renders server fullName; avatar seed stays employeeId (REQ-8)
 *  - NO listForPicker / name-resolution query fires from this view (REQ-8)
 */

import { describe, it, expect as chaiExpect, vi, beforeEach, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { employeesApi } from '@/features/admin/employees/api/employees.api'

// ── Mock state for `useExpiringDocuments` (new composable surface) ────────────

const mockComposable = {
  // `data`/`refetch` are the OLD (pre-migration) surface — kept so the
  // un-migrated view mounts and the RED is behavioral; dead keys once migrated.
  data: ref<unknown[]>([]),
  refetch: vi.fn(),
  selectedThreshold: ref(30),
  documents: ref<unknown[]>([]),
  pagination: ref({ pageIndex: 0, pageSize: 10 }),
  sorting: ref([{ id: 'vencimiento', desc: false }]),
  globalFilter: ref(''),
  columnVisibility: ref({}),
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

vi.mock('@/features/admin/employees/composables/useExpiringDocuments', () => ({
  useExpiringDocuments: () => mockComposable,
  // Inert helpers so the un-migrated view (which still imports them) mounts.
  // Once the view is migrated these are dead exports of the mock.
  computeExpiringDocumentRow: () => ({
    id: '', employeeId: '', fileId: '', title: '', categoryLabel: '',
    expiresAt: null, expiresAtLabel: '', daysRemaining: 0, daysRemainingLabel: '', category: '',
  }),
  paginateRows: () => ({ pageRows: [], total: 0, pageCount: 0 }),
}))

vi.mock('@/features/admin/employees/composables/useManagerResolution', () => ({
  buildManagerMap: () => new Map(),
  resolveManagerName: () => '—',
}))

// Stub the query layer so the un-migrated view (which still calls useQuery for
// the picker) mounts; harmless once the view no longer uses it directly.
vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: ref([]) }),
  useMutation: () => ({ mutate: vi.fn(), isPending: ref(false) }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), refetchQueries: vi.fn() }),
}))

const authMock = {
  userCan: vi.fn(() => false),
  currentTenantId: 'tenant-1',
  currentTenant: { name: 'Acme' },
}
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authMock,
}))

vi.mock('@/features/admin/shared/components/AdminPageHeader.vue', () => ({
  default: {
    name: 'AdminPageHeader',
    template: '<div data-testid="admin-page-header" :data-title="title"><slot /></div>',
    props: ['title', 'description', 'loading', 'fallbackText'],
  },
}))

vi.mock('@/core/shared/components/EntityAvatar.vue', () => ({
  default: {
    name: 'EntityAvatar',
    props: ['name', 'seed', 'size'],
    template:
      '<span data-testid="entity-avatar" :data-name="name" :data-seed="seed"><slot /></span>',
  },
}))

// Stub vue-router so UButton's <Link> internals don't warn about the missing
// route injection (SortableHeader renders a real UButton).
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {}, query: {}, name: 'admin-expiring-documents' }),
  RouterView: { name: 'RouterView', template: '<div />' },
  RouterLink: { name: 'RouterLink', template: '<a><slot /></a>' },
  createRouter: () => ({}),
  createWebHistory: () => ({}),
}))

// ── AppDataTable stub (mirrors PendingApprovalsView.test.ts + header slots) ──

const FAKE_COLUMN = { getIsSorted: () => 'asc', toggleSorting: () => {} }

vi.mock('@/core/shared/components/DataTable/AppDataTable.vue', () => ({
  default: {
    name: 'AppDataTable',
    template: `
      <div
        data-testid="app-data-table"
        :data-column-visibility="String(enableColumnVisibility)"
        :data-error="error ? 'true' : 'false'"
        :data-error-message="errorMessage"
        :data-show-toolbar="String(showToolbar)"
        :data-page-size-options="String(pageSizeOptions)"
        :data-empty="empty"
        :data-data-length="(Array.isArray(data) ? data : []).length"
        :data-columns="JSON.stringify((Array.isArray(columns) ? columns : []).map(c => ({ id: c.id, enableHiding: !!c.enableHiding, enableSorting: !!c.enableSorting })))"
      >
        <div data-testid="filters-slot"><slot name="filters" /></div>
        <div data-testid="table-headers">
          <template v-for="c in (Array.isArray(columns) ? columns : [])" :key="c.id">
            <slot :name="c.id + '-header'" :column="fakeColumn" />
          </template>
        </div>
        <div v-if="error" data-testid="table-error-state" role="alert">
          <p data-testid="error-message">{{ errorMessage }}</p>
          <button data-testid="table-error-retry" @click="$emit('refresh')">Reintentar</button>
        </div>
        <div v-else-if="(Array.isArray(data) ? data : []).length === 0" data-testid="table-empty-state">{{ empty }}</div>
        <div v-else data-testid="table-data">
          <div
            v-for="row in (Array.isArray(data) ? data : [])"
            :key="row.id"
            data-testid="table-row"
          >
            <template v-for="c in (Array.isArray(columns) ? columns : [])" :key="c.id">
              <slot :name="c.id + '-cell'" :row="{ original: row }" />
            </template>
          </div>
        </div>
      </div>
    `,
    computed: { fakeColumn: () => FAKE_COLUMN },
    props: {
      columns: { default: () => [] },
      data: { default: () => [] },
      enableColumnVisibility: { type: Boolean, default: false },
      error: { default: false },
      errorMessage: { default: 'No se pudieron cargar los datos. Reintenta.' },
      empty: { default: 'No se encontraron resultados' },
      pageSizeOptions: { default: () => [5, 10, 20, 50] },
      showToolbar: { type: Boolean, default: true },
      pagination: { type: Object, default: () => ({ pageIndex: 0, pageSize: 10 }) },
      globalFilter: { type: String, default: '' },
      sorting: { default: () => [] },
      columnVisibility: { default: () => ({}) },
      totalCount: { type: Number, default: 0 },
      pageCount: { type: Number, default: 0 },
      showingFrom: { type: Number, default: 0 },
      showingTo: { type: Number, default: 0 },
      showRefresh: { type: Boolean, default: true },
    },
    emits: [
      'add',
      'refresh',
      'update:global-filter',
      'update:pagination',
      'update:sorting',
      'update:column-visibility',
    ],
  },
}))

// ── Module-scoped ViewModule ──────────────────────────────────────────────────

type ViewModuleType = typeof import('../ExpiringDocumentsView.vue')
let ViewModule: ViewModuleType | undefined
beforeAll(async () => {
  ViewModule = await import('../ExpiringDocumentsView.vue')
})

function getView(): ViewModuleType {
  if (!ViewModule) throw new Error('ViewModule not initialized — beforeAll did not run')
  return ViewModule
}

function mountView() {
  return mount(getView().default)
}

const fixtureRow = {
  id: 'doc-1',
  employeeId: 'emp-1',
  fileId: 'file-1',
  title: 'Contrato temporal',
  categoryLabel: 'Contrato (CONTRACT)',
  expiresAt: '2026-06-15',
  expiresAtLabel: '15 jun 2026',
  daysRemaining: 10,
  daysRemainingLabel: '10 días',
  category: 'CONTRACT',
  fullName: 'Ana López',
  employeeNumber: 'EMP-001',
}

beforeEach(() => {
  mockComposable.selectedThreshold.value = 30
  mockComposable.documents.value = []
  mockComposable.isError.value = false
  mockComposable.error.value = null
  mockComposable.refresh.mockClear()
})

// ── REQ-5: documentsErrorMessage precedence + retry + empty-vs-failed ────────

describe('ExpiringDocumentsView — documentsErrorMessage precedence (REQ-5)', () => {
  it('prefers response.data.message (string) over error.message and the fallback', async () => {
    mockComposable.isError.value = true
    mockComposable.error.value = {
      response: { data: { message: 'Falla específica del backend' } },
      message: 'Generic axios error',
    }
    const wrapper = mountView()
    await flushPromises()
    chaiExpect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'Falla específica del backend',
    )
  })

  it('prefers response.data.message[0] when the backend returns an array', async () => {
    mockComposable.isError.value = true
    mockComposable.error.value = {
      response: { data: { message: ['Mensaje array 0', 'Mensaje array 1'] } },
      message: 'Generic axios error',
    }
    const wrapper = mountView()
    await flushPromises()
    chaiExpect(wrapper.find('[data-testid="error-message"]').text()).toBe('Mensaje array 0')
  })

  it('falls back to error.message when response.data.message is missing', async () => {
    mockComposable.isError.value = true
    mockComposable.error.value = { response: { data: {} }, message: 'Network Error' }
    const wrapper = mountView()
    await flushPromises()
    chaiExpect(wrapper.find('[data-testid="error-message"]').text()).toBe('Network Error')
  })

  it('falls back to the Spanish plural message when no error details are available', async () => {
    mockComposable.isError.value = true
    mockComposable.error.value = {}
    const wrapper = mountView()
    await flushPromises()
    chaiExpect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'No se pudieron cargar los documentos. Intenta de nuevo.',
    )
  })

  it('clicking retry triggers refresh', async () => {
    mockComposable.isError.value = true
    mockComposable.error.value = { response: { data: { message: 'Boom' } } }
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="table-error-retry"]').trigger('click')
    chaiExpect(mockComposable.refresh).toHaveBeenCalled()
  })

  it('suppresses the empty placeholder when the request has failed', async () => {
    mockComposable.isError.value = true
    mockComposable.error.value = { response: { data: { message: 'Boom' } } }
    mockComposable.documents.value = []
    const wrapper = mountView()
    await flushPromises()
    chaiExpect(wrapper.find('[data-testid="table-error-state"]').exists()).toBe(true)
    chaiExpect(wrapper.find('[data-testid="table-empty-state"]').exists()).toBe(false)
  })
})

// ── REQ-3/REQ-4: toolbar + search + column visibility ────────────────────────

describe('ExpiringDocumentsView — toolbar, search, column visibility (REQ-3, REQ-4)', () => {
  it('renders the toolbar (show-toolbar="true")', async () => {
    const wrapper = mountView()
    await flushPromises()
    chaiExpect(wrapper.find('[data-testid="app-data-table"]').attributes('data-show-toolbar')).toBe(
      'true',
    )
  })

  it('enables column visibility', async () => {
    const wrapper = mountView()
    await flushPromises()
    chaiExpect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-column-visibility'),
    ).toBe('true')
  })

  it('binds search through v-model:global-filter (REQ-3)', async () => {
    const wrapper = mountView()
    await flushPromises()
    const table = wrapper.findComponent({ name: 'AppDataTable' })
    table.vm.$emit('update:global-filter', 'jo')
    await flushPromises()
    chaiExpect(mockComposable.globalFilter.value).toBe('jo')
  })

  it('marks the 4 data columns hideable and keeps documento non-hideable + non-sortable (REQ-4)', async () => {
    const wrapper = mountView()
    await flushPromises()
    const attr = wrapper.find('[data-testid="app-data-table"]').attributes('data-columns') ?? '[]'
    const parsed = JSON.parse(attr) as {
      id: string
      enableHiding: boolean
      enableSorting: boolean
    }[]
    const hideable = parsed.filter((c) => c.enableHiding).map((c) => c.id)
    chaiExpect(hideable).toEqual(
      chaiExpect.arrayContaining(['categoria', 'colaborador', 'vencimiento', 'restante']),
    )
    const documento = parsed.find((c) => c.id === 'documento')
    chaiExpect(documento?.enableHiding).toBe(false)
    chaiExpect(documento?.enableSorting).toBe(false)
  })

  it('renders SortableHeader slots with the Spanish labels for the 4 sortable columns', async () => {
    const wrapper = mountView()
    await flushPromises()
    const headers = wrapper.find('[data-testid="table-headers"]')
    const text = headers.text()
    chaiExpect(text).toContain('Fecha de vencimiento')
    chaiExpect(text).toContain('Tiempo restante')
    chaiExpect(text).toContain('Categoría')
    chaiExpect(text).toContain('Colaborador')
  })
})

// ── REQ-7: expiry-window selector lives in #filters (not header) ─────────────

describe('ExpiringDocumentsView — threshold selector in #filters (REQ-7)', () => {
  it('renders exactly one selector and it lives inside the #filters slot, not AdminPageHeader', async () => {
    const wrapper = mountView()
    await flushPromises()
    // USelect auto-resolves to Nuxt UI's `Select` runtime component (v4).
    const selects = wrapper.findAllComponents({ name: 'Select' })
    chaiExpect(selects).toHaveLength(1)
    chaiExpect(
      wrapper.find('[data-testid="filters-slot"]').find('[data-testid="expiring-threshold-filters"]').exists(),
    ).toBe(true)
    chaiExpect(
      wrapper.find('[data-testid="admin-page-header"]').find('[data-testid="expiring-threshold-filters"]').exists(),
    ).toBe(false)
  })

  it('binds the selector to selectedThreshold — change updates the composable state', async () => {
    const wrapper = mountView()
    await flushPromises()
    const select = wrapper.findComponent({ name: 'Select' })
    chaiExpect(select.exists()).toBe(true)
    select.vm.$emit('update:modelValue', 60)
    await flushPromises()
    chaiExpect(mockComposable.selectedThreshold.value).toBe(60)
  })

  it('empty message interpolates the selected threshold', async () => {
    const wrapper = mountView()
    await flushPromises()
    chaiExpect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-empty'),
    ).toContain('30 días')
  })
})

// ── REQ-8: colaborador renders server fullName; avatar seed stays employeeId ──

describe('ExpiringDocumentsView — colaborador cell (REQ-8)', () => {
  it('renders the server fullName and keeps the avatar seed as employeeId', async () => {
    mockComposable.documents.value = [fixtureRow]
    const wrapper = mountView()
    await flushPromises()
    chaiExpect(wrapper.text()).toContain('Ana López')
    const avatar = wrapper.find('[data-testid="entity-avatar"]')
    chaiExpect(avatar.attributes('data-name')).toBe('Ana López')
    chaiExpect(avatar.attributes('data-seed')).toBe('emp-1')
  })

  it('does NOT fire any listForPicker name-resolution query from this view', async () => {
    const spy = vi.spyOn(employeesApi, 'listForPicker')
    mockComposable.documents.value = [fixtureRow]
    const wrapper = mountView()
    await flushPromises()
    chaiExpect(wrapper.text()).toContain('Ana López')
    chaiExpect(spy).not.toHaveBeenCalled()
  })
})
