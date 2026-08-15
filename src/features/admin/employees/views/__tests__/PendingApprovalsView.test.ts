/**
 * WU-A — PendingApprovalsView.specs (REQ-1, REQ-2, REQ-3, REQ-5, REQ-8)
 *
 * RED stubs written before the WU-A production change to PendingApprovalsView.
 *
 * Pinned contracts for WU-A scope only (WU-B/C tests land later):
 *  - pendingErrorMessage precedence: response.data.message (string | array[0])
 *    > error.message > "No se pudieron cargar las solicitudes pendientes.
 *    Intenta de nuevo."
 *  - retry button triggers refetch
 *  - :data receives paged.pageRows (client-side full-array pagination)
 *  - v-model:pagination bridge (0-based AppDataTable ↔ 1-based view)
 *  - v-model:global-filter bound to searchQuery
 *  - enable-column-visibility wired on AppDataTable
 *  - v-model:column-pinning is { right: ['acciones'] }
 *  - :show-toolbar="queueNonEmpty" (hidden on empty queue)
 *  - NO `bulkActions` / `enableRowSelection` props passed (REQ-7)
 *  - AdminPageHeader with title "Validaciones pendientes"
 *
 * Mocks usePendingApprovals (mockState incl. isError / error / refetch) + the
 * picker listForPicker query + useReviewTimeOff (isReviewing). Real
 * usePendingApprovalsViewMode (localStorage-driven) + real
 * usePendingApprovalsColumns.
 */

import { describe, it, expect as chaiExpect, vi, beforeEach, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'

// ── Mock state for `usePendingApprovals` ───────────────────────────────────────

const mockPending = {
  data: ref<unknown[]>([]),
  isLoading: ref(false),
  isFetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refetch: vi.fn(),
}

vi.mock('@/features/admin/employees/composables/useReviewTimeOff', () => ({
  // Reactive tenant-wide PENDING queue (REQ-8 invariant: NOT split out of this file).
  usePendingApprovals: () => ({
    data: mockPending.data,
    isLoading: mockPending.isLoading,
    isFetching: mockPending.isFetching,
    isError: mockPending.isError,
    error: mockPending.error,
    refetch: mockPending.refetch,
  }),
  // Mutation — WU-A does not exercise this path; stub returns inert state.
  useReviewTimeOff: () => ({
    mutateAsync: vi.fn(),
    isPending: ref(false),
    error: ref(null),
  }),
}))

// Picker query (name resolution, REQ-8) — stub to empty so the view has no map.
vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: ref([]) }),
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

const authMock = {
  userCan: vi.fn(() => false),
  currentTenantId: 'tenant-1',
  currentTenant: { name: 'Acme' },
}
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authMock,
}))

// ── AppDataTable stub mirrors EmployeesListView.test.ts attrs ─────────────────

vi.mock('@/core/shared/components/DataTable/AppDataTable.vue', () => ({
  default: {
    name: 'AppDataTable',
    template: `
      <div
        data-testid="app-data-table"
        :data-display-mode="displayMode"
        :data-column-visibility="String(enableColumnVisibility)"
        :data-column-pinning="JSON.stringify(columnPinning)"
        :data-error="error ? 'true' : 'false'"
        :data-error-message="errorMessage"
        :data-show-toolbar="String(showToolbar)"
        :data-page-size-options="String(pageSizeOptions)"
        :data-empty="empty"
        :data-data-length="(Array.isArray(data) ? data : []).length"
      >
        <slot name="actions" />
        <slot name="cards" />
        <div v-if="error" data-testid="table-error-state" role="alert">
          <p data-testid="error-message">{{ errorMessage }}</p>
          <button data-testid="table-error-retry" @click="$emit('refresh')">Reintentar</button>
        </div>
        <div v-else-if="(Array.isArray(data) ? data : []).length === 0" data-testid="table-empty-state">{{ empty }}</div>
        <div v-else data-testid="table-data">
          <slot />
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
      pageSizeOptions: { default: () => [5, 10, 20, 50] },
      showToolbar: { type: Boolean, default: true },
      columnPinning: { default: () => ({ left: [], right: [] }) },
      enableRowSelection: { type: Boolean, default: false },
      bulkActions: { default: () => [] },
    },
    emits: ['add', 'refresh', 'update:global-filter', 'update:pagination', 'update:column-pinning', 'update:column-visibility'],
  },
}))

vi.mock('@/features/admin/shared/components/AdminPageHeader.vue', () => ({
  default: {
    name: 'AdminPageHeader',
    template: '<div data-testid="admin-page-header" :data-title="title"><slot /></div>',
    props: ['title', 'description', 'loading', 'fallbackText'],
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

// Stub vue-router so UButton's <Link> internals don't warn about the missing
// route injection.
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {}, query: {}, name: 'admin-pending-approvals' }),
  RouterView: { name: 'RouterView', template: '<div />' },
  RouterLink: { name: 'RouterLink', template: '<a><slot /></a>' },
  createRouter: () => ({}),
  createWebHistory: () => ({}),
}))

// Stub the picker listForPicker query so the view has no employee map (names
// resolve to "—"; WU-A does not exercise the name-resolution paths).

// ── Module-scoped ViewModule ──────────────────────────────────────────────────

type ViewModuleType = typeof import('../PendingApprovalsView.vue')
let ViewModule: ViewModuleType | undefined
beforeAll(async () => {
  ViewModule = await import('../PendingApprovalsView.vue')
})

function getView(): ViewModuleType {
  if (!ViewModule) throw new Error('ViewModule not initialized — beforeAll did not run')
  return ViewModule
}

beforeEach(() => {
  localStorage.clear()
  mockPending.data.value = []
  mockPending.isLoading.value = false
  mockPending.isFetching.value = false
  mockPending.isError.value = false
  mockPending.error.value = null
  mockPending.refetch.mockClear()
  authMock.userCan.mockReset()
  authMock.userCan.mockReturnValue(false)
})

// ── REQ-5: pendingErrorMessage precedence ─────────────────────────────────────

describe('PendingApprovalsView — pendingErrorMessage precedence (REQ-5)', () => {
  it('prefers response.data.message (string) over error.message and fallback', async () => {
    mockPending.isError.value = true
    mockPending.error.value = {
      response: { data: { message: 'Falla específica del backend' } },
      message: 'Generic axios error',
    }
    const wrapper = mount(getView().default)
    await flushPromises()
    chaiExpect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'Falla específica del backend',
    )
  })

  it('prefers response.data.message[0] when the backend returns an array', async () => {
    mockPending.isError.value = true
    mockPending.error.value = {
      response: { data: { message: ['Mensaje array 0', 'Mensaje array 1'] } },
      message: 'Generic axios error',
    }
    const wrapper = mount(getView().default)
    await flushPromises()
    chaiExpect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'Mensaje array 0',
    )
  })

  it('falls back to error.message when response.data.message is missing', async () => {
    mockPending.isError.value = true
    mockPending.error.value = {
      response: { data: {} },
      message: 'Network Error',
    }
    const wrapper = mount(getView().default)
    await flushPromises()
    chaiExpect(wrapper.find('[data-testid="error-message"]').text()).toBe('Network Error')
  })

  it('falls back to the Spanish message when no error details are available', async () => {
    mockPending.isError.value = true
    mockPending.error.value = {}
    const wrapper = mount(getView().default)
    await flushPromises()
    chaiExpect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'No se pudieron cargar las solicitudes pendientes. Intenta de nuevo.',
    )
  })

  it('retry button triggers refetch', async () => {
    mockPending.isError.value = true
    mockPending.error.value = { response: { data: { message: 'Boom' } } }
    const wrapper = mount(getView().default)
    await flushPromises()
    await wrapper.find('[data-testid="table-error-retry"]').trigger('click')
    chaiExpect(mockPending.refetch).toHaveBeenCalled()
  })

  it('suppresses the empty placeholder when the request has failed', async () => {
    mockPending.isError.value = true
    mockPending.error.value = { response: { data: { message: 'Boom' } } }
    mockPending.data.value = []
    const wrapper = mount(getView().default)
    await flushPromises()
    chaiExpect(wrapper.find('[data-testid="table-error-state"]').exists()).toBe(true)
    chaiExpect(wrapper.find('[data-testid="table-empty-state"]').exists()).toBe(false)
  })
})

// ── REQ-2: displayMode + view-mode default + storage ─────────────────────────

describe('PendingApprovalsView — view-mode + displayMode (REQ-2)', () => {
  it('passes display-mode="cards" by default (default mode is "card")', async () => {
    const wrapper = mount(getView().default)
    await flushPromises()
    chaiExpect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode'),
    ).toBe('cards')
  })

  it('passes display-mode="table" when localStorage pending-approvals-view-mode is "table"', async () => {
    localStorage.setItem('pending-approvals-view-mode', 'table')
    const wrapper = mount(getView().default)
    await flushPromises()
    chaiExpect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode'),
    ).toBe('table')
  })

  it('passes display-mode="cards" when localStorage has an invalid value', async () => {
    localStorage.setItem('pending-approvals-view-mode', 'kanban')
    const wrapper = mount(getView().default)
    await flushPromises()
    chaiExpect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-display-mode'),
    ).toBe('cards')
  })
})

// ── REQ-3: column visibility + pinning ────────────────────────────────────────

describe('PendingApprovalsView — column visibility + pinning (REQ-3)', () => {
  it('passes enable-column-visibility=true to AppDataTable', async () => {
    const wrapper = mount(getView().default)
    await flushPromises()
    chaiExpect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-column-visibility'),
    ).toBe('true')
  })

  it('pins "acciones" to the right via v-model:column-pinning', async () => {
    const wrapper = mount(getView().default)
    await flushPromises()
    const attr = wrapper.find('[data-testid="app-data-table"]').attributes('data-column-pinning')
    chaiExpect(attr).toBeTruthy()
    const parsed = JSON.parse(attr ?? '{}') as { right?: string[] }
    chaiExpect(parsed.right).toContain('acciones')
  })
})

// ── REQ-1: client-side pagination + show-toolbar ─────────────────────────────

describe('PendingApprovalsView — client-side pagination + toolbar (REQ-1, REQ-4)', () => {
  it('passes :page-size-options="[10, 20, 50]" to AppDataTable', async () => {
    const wrapper = mount(getView().default)
    await flushPromises()
    chaiExpect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-page-size-options'),
    ).toBe('10,20,50')
  })

  it('shows the toolbar when the queue is non-empty', async () => {
    mockPending.data.value = [
      {
        id: 'to-1',
        employeeId: 'emp-1',
        type: 'VACATION',
        startDate: '2026-08-01',
        endDate: '2026-08-10',
        reason: 'Viaje',
        status: 'PENDING',
        createdAt: '2026-07-01T10:00:00Z',
        requestedByUserId: null,
        reviewerUserId: null,
        reviewedAt: null,
        reviewerNotes: null,
        tenantId: 'tenant-1',
        updatedAt: '2026-07-01T10:00:00Z',
      },
    ]
    const wrapper = mount(getView().default)
    await flushPromises()
    chaiExpect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-show-toolbar'),
    ).toBe('true')
  })

  it('hides the toolbar when the queue is empty (REQ-4 scenario "empty queue summary")', async () => {
    mockPending.data.value = []
    const wrapper = mount(getView().default)
    await flushPromises()
    chaiExpect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-show-toolbar'),
    ).toBe('false')
  })

  it('forwards paged.pageRows to :data on AppDataTable', async () => {
    const requests = Array.from({ length: 25 }, (_, i) => ({
      id: `to-${i + 1}`,
      employeeId: 'emp-1',
      type: 'VACATION',
      startDate: '2026-08-01',
      endDate: '2026-08-10',
      reason: 'r',
      status: 'PENDING',
      createdAt: '2026-07-01T10:00:00Z',
      requestedByUserId: null,
      reviewerUserId: null,
      reviewedAt: null,
      reviewerNotes: null,
      tenantId: 'tenant-1',
      updatedAt: '2026-07-01T10:00:00Z',
    }))
    mockPending.data.value = requests
    const wrapper = mount(getView().default)
    await flushPromises()
    // Page 1 (size 10) → 10 rows
    chaiExpect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-data-length'),
    ).toBe('10')
  })
})

// ── REQ-7: no bulk actions / no row selection ─────────────────────────────────

describe('PendingApprovalsView — no bulk affordances (REQ-7)', () => {
  it('does not pass bulkActions / enableRowSelection props to AppDataTable', async () => {
    const wrapper = mount(getView().default)
    await flushPromises()
    const table = wrapper.findComponent({ name: 'AppDataTable' })
    chaiExpect(table.exists()).toBe(true)
    chaiExpect(table.props('enableRowSelection')).toBe(false)
    chaiExpect(table.props('bulkActions')).toEqual([])
  })
})

// ── Header contract ───────────────────────────────────────────────────────────

describe('PendingApprovalsView — AdminPageHeader', () => {
  it('renders AdminPageHeader with title "Validaciones pendientes"', async () => {
    const wrapper = mount(getView().default)
    await flushPromises()
    const header = wrapper.find('[data-testid="admin-page-header"]')
    chaiExpect(header.exists()).toBe(true)
    chaiExpect(header.attributes('data-title')).toBe('Validaciones pendientes')
  })
})

// Suppress unused-import warning for `computed` (kept for symmetry with the
// other view tests; not directly used here).
void computed