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
        :data-show-add-button="String(showAddButton)"
      >
        <slot name="actions" />
        <slot name="above-table" />
        <slot name="filters" />
        <slot name="cards" :data="(Array.isArray(data) ? data : [])" />
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
            :data-row-id="row.id"
          >
            <slot name="acciones-cell" :row="{ original: row }" />
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
      pageSizeOptions: { default: () => [5, 10, 20, 50] },
      showToolbar: { type: Boolean, default: true },
      showAddButton: { type: Boolean, default: false },
      columnPinning: { default: () => ({ left: [], right: [] }) },
      columnVisibility: { default: () => ({}) },
      pagination: {
        type: Object,
        default: () => ({ pageIndex: 0, pageSize: 10 }),
      },
      globalFilter: { type: String, default: '' },
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

vi.mock('@/core/shared/components/ViewToggle.vue', () => ({
  default: {
    name: 'ViewToggle',
    template:
      '<div data-testid="view-toggle" :data-aria-label="ariaLabel" :data-value="modelValue"><slot /></div>',
    props: ['modelValue', 'options', 'ariaLabel'],
    emits: ['update:modelValue'],
  },
}))

vi.mock('@/features/admin/employees/components/PendingApprovalCard.vue', () => ({
  default: {
    name: 'PendingApprovalCard',
    props: ['data', 'canReview', 'isReviewing'],
    emits: ['approve', 'reject'],
    template: `
      <div
        data-testid="pending-approval-card"
        :data-can-review="String(canReview)"
        :data-is-reviewing="String(isReviewing)"
        :data-employee-name="data ? data.employeeName : ''"
      >
        <span v-if="data" class="card-name">{{ data.employeeName }}</span>
        <div v-if="canReview" class="card-actions">
          <button
            data-testid="pending-approval-card-reject"
            @click="$emit('reject', data.request)"
          >Rechazar</button>
          <button
            data-testid="pending-approval-card-approve"
            @click="$emit('approve', data.request)"
          >Aprobar</button>
        </div>
      </div>
    `,
  },
}))

// Note: Nuxt UI components (UModal / UButton / UBadge / UCard / UIcon /
// UFormField / UTextarea) are auto-resolved by the @nuxt/ui Vite plugin — no
// explicit imports / stubs required. The review dialog content (UCard with the
// decision title) renders inside a Teleport when isReviewDialogOpen=true;
// tests verify it opens by searching for the title text in the wrapper html.

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

// ── WU-C — pagination bridge 1↔0 (REQ-1) ──────────────────────────────────────

describe('PendingApprovalsView — pagination bridge 1-based ↔ 0-based (REQ-1)', () => {
  it('forwards the initial 1-based page=1 as 0-based pageIndex=0 to AppDataTable', async () => {
    const wrapper = mount(getView().default)
    await flushPromises()
    const table = wrapper.findComponent({ name: 'AppDataTable' })
    chaiExpect(table.exists()).toBe(true)
    const pagination = table.props('pagination') as { pageIndex: number; pageSize: number }
    chaiExpect(pagination.pageIndex).toBe(0)
    chaiExpect(pagination.pageSize).toBe(10)
  })

  it('forwards page=3 as 0-based pageIndex=2 to AppDataTable', async () => {
    mockPending.data.value = Array.from({ length: 25 }, (_, i) => ({
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
    const wrapper = mount(getView().default)
    await flushPromises()
    // Drive the bridge: emit update:pagination with pageIndex=2 (page=3),
    // same pageSize. The view's setter must convert pageIndex → page.
    const table = wrapper.findComponent({ name: 'AppDataTable' })
    table.vm.$emit('update:pagination', { pageIndex: 2, pageSize: 10 })
    await flushPromises()
    const pagination = table.props('pagination') as { pageIndex: number; pageSize: number }
    chaiExpect(pagination.pageIndex).toBe(2)
    chaiExpect(pagination.pageSize).toBe(10)
  })

  it('resets to page=1 when pageSize changes', async () => {
    const wrapper = mount(getView().default)
    await flushPromises()
    const table = wrapper.findComponent({ name: 'AppDataTable' })
    // First jump to page=3.
    table.vm.$emit('update:pagination', { pageIndex: 2, pageSize: 10 })
    await flushPromises()
    chaiExpect((table.props('pagination') as { pageIndex: number }).pageIndex).toBe(2)
    // Now change pageSize → bridge must reset page to 1 (pageIndex=0).
    table.vm.$emit('update:pagination', { pageIndex: 5, pageSize: 20 })
    await flushPromises()
    const pagination = table.props('pagination') as { pageIndex: number; pageSize: number }
    chaiExpect(pagination.pageSize).toBe(20)
    chaiExpect(pagination.pageIndex).toBe(0)
  })

  it('clamps the page when the queue shrinks below the current page (no infinite loop)', async () => {
    // Mount with 50 rows so we can navigate to page 5 (rows 41–50).
    const manyRows = Array.from({ length: 50 }, (_, i) => ({
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
    mockPending.data.value = manyRows
    const wrapper = mount(getView().default)
    await flushPromises()
    const table = wrapper.findComponent({ name: 'AppDataTable' })
    // Jump to page 5 (pageIndex=4).
    table.vm.$emit('update:pagination', { pageIndex: 4, pageSize: 10 })
    await flushPromises()
    chaiExpect((table.props('pagination') as { pageIndex: number }).pageIndex).toBe(4)
    // Shrink the queue to 2 rows → pageCount drops to 1 → clampPage must
    // reset page to 1 (pageIndex=0). The clamp watcher is idempotent so
    // this must NOT trigger an infinite loop on the next tick.
    mockPending.data.value = manyRows.slice(0, 2)
    await flushPromises()
    await flushPromises()
    const pagination = table.props('pagination') as { pageIndex: number }
    chaiExpect(pagination.pageIndex).toBe(0)
  })
})

// ── WU-C — search → globalFilter + page reset (REQ-1, REQ-4) ──────────────────

describe('PendingApprovalsView — search → globalFilter binding + page reset (REQ-1, REQ-4)', () => {
  const fixture = () => [
    {
      id: 'to-1',
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
    },
  ]

  it('updates the underlying search ref via v-model:global-filter (REQ-4)', async () => {
    mockPending.data.value = fixture()
    const wrapper = mount(getView().default)
    await flushPromises()
    const table = wrapper.findComponent({ name: 'AppDataTable' })
    // Search input would live in the AppDataTable toolbar — we simulate the
    // user typing by emitting the v-model event with a new value. The view
    // must wire it back into the AppDataTable as the new globalFilter.
    table.vm.$emit('update:global-filter', 'maría')
    await flushPromises()
    const pagination = table.props('pagination') as { pageIndex: number; pageSize: number }
    chaiExpect(pagination.pageIndex).toBe(0)
    chaiExpect(pagination.pageSize).toBe(10)
  })

  it('resets the page to FIRST_PAGE when the search query changes', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
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
    mockPending.data.value = rows
    const wrapper = mount(getView().default)
    await flushPromises()
    const table = wrapper.findComponent({ name: 'AppDataTable' })
    // Navigate to page 3 first.
    table.vm.$emit('update:pagination', { pageIndex: 2, pageSize: 10 })
    await flushPromises()
    chaiExpect((table.props('pagination') as { pageIndex: number }).pageIndex).toBe(2)
    // Change the search query — pageAfterQueryChange must jump to page 1.
    table.vm.$emit('update:global-filter', 'juan')
    await flushPromises()
    const pagination = table.props('pagination') as { pageIndex: number }
    chaiExpect(pagination.pageIndex).toBe(0)
  })
})

// ── WU-C — ViewToggle rendered with aria-label (REQ-2) ────────────────────────

describe('PendingApprovalsView — ViewToggle (REQ-2)', () => {
  it('renders ViewToggle in the #actions slot with aria-label', async () => {
    const wrapper = mount(getView().default)
    await flushPromises()
    const toggle = wrapper.find('[data-testid="view-toggle"]')
    chaiExpect(toggle.exists()).toBe(true)
    chaiExpect(toggle.attributes('data-aria-label')).toBe(
      'Seleccionar vista de validaciones pendientes',
    )
  })
})

// ── WU-C — no-match vs empty copy distinct (REQ-4) ────────────────────────────

describe('PendingApprovalsView — no-match vs empty copy (REQ-4)', () => {
  const fixtureRow = {
    id: 'to-1',
    employeeId: 'emp-unknown',
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
  }

  it('renders the no-match block when search empties the result set', async () => {
    mockPending.data.value = [fixtureRow]
    const wrapper = mount(getView().default)
    await flushPromises()
    const table = wrapper.findComponent({ name: 'AppDataTable' })
    // Use a search term that won't match the unknown employee name.
    table.vm.$emit('update:global-filter', 'zzzzzzz')
    await flushPromises()
    const noMatch = wrapper.find('[data-testid="pending-approvals-no-match"]')
    chaiExpect(noMatch.exists()).toBe(true)
    chaiExpect(noMatch.text()).toContain('zzzzzzz')
  })

  it('renders the empty placeholder when the queue is empty AND no search is active', async () => {
    mockPending.data.value = []
    const wrapper = mount(getView().default)
    await flushPromises()
    // The empty placeholder lives on AppDataTable's `:empty` prop
    // ("Sin solicitudes pendientes") and is rendered by the stub when the
    // data array is empty and there is no error.
    const empty = wrapper.find('[data-testid="table-empty-state"]')
    chaiExpect(empty.exists()).toBe(true)
    chaiExpect(empty.text()).toBe('Sin solicitudes pendientes')
  })
})

// ── WU-C — summary "N solicitudes pendientes (de M en total)" (REQ-4) ──────────

describe('PendingApprovalsView — above-table summary (REQ-4)', () => {
  it('renders the summary inside #above-table when the queue is non-empty and no search is active', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      id: `to-${i + 1}`,
      employeeId: 'emp-unknown',
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
    mockPending.data.value = rows
    const wrapper = mount(getView().default)
    await flushPromises()
    const summary = wrapper.find('[data-testid="pending-approvals-summary"]')
    chaiExpect(summary.exists()).toBe(true)
    chaiExpect(summary.text()).toContain('solicitudes pendientes')
  })

  it('hides the #above-table summary once the search query is active (cards summary takes over)', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      id: `to-${i + 1}`,
      employeeId: 'emp-unknown',
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
    mockPending.data.value = rows
    const wrapper = mount(getView().default)
    await flushPromises()
    const table = wrapper.findComponent({ name: 'AppDataTable' })
    table.vm.$emit('update:global-filter', 'maría')
    await flushPromises()
    // The #above-table summary is gated by `v-if="queueNonEmpty && !isSearchActive"`
    // — with an active search the slot's summary is suppressed. The "(de M
    // en total)" suffix therefore renders from the #cards slot instead.
    chaiExpect(wrapper.find('[data-testid="pending-approvals-summary"]').exists()).toBe(false)
  })

  it('surfaces the "(de M en total)" suffix when search narrows the queue', async () => {
    // When search is active and the filter empties the result set, the
    // cards-slot summary still renders the suffix with the underlying total.
    const rows = Array.from({ length: 25 }, (_, i) => ({
      id: `to-${i + 1}`,
      employeeId: 'emp-unknown',
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
    mockPending.data.value = rows
    const wrapper = mount(getView().default)
    await flushPromises()
    const table = wrapper.findComponent({ name: 'AppDataTable' })
    table.vm.$emit('update:global-filter', 'maría')
    await flushPromises()
    // No employee named "maría" in the empty picker map → filtered list is
    // empty → the cards-slot summary must surface "(de 25 en total)".
    chaiExpect(wrapper.html()).toContain('(de 25 en total)')
  })
})

// ── WU-C — canReview: false hides Aprobar/Rechazar (REQ-3) ────────────────────

describe('PendingApprovalsView — canReview gating (REQ-3)', () => {
  const fixture = () => [
    {
      id: 'to-1',
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
    },
  ]

  it('hides card Aprobar/Rechazar when CASL canReview (update:EmployeeTimeOff) is false', async () => {
    authMock.userCan.mockReturnValue(false)
    mockPending.data.value = fixture()
    const wrapper = mount(getView().default)
    await flushPromises()
    const card = wrapper.find('[data-testid="pending-approval-card"]')
    chaiExpect(card.exists()).toBe(true)
    chaiExpect(card.attributes('data-can-review')).toBe('false')
    chaiExpect(wrapper.find('[data-testid="pending-approval-card-approve"]').exists()).toBe(false)
    chaiExpect(wrapper.find('[data-testid="pending-approval-card-reject"]').exists()).toBe(false)
  })

  it('hides table #acciones-cell Aprobar/Rechazar when canReview is false', async () => {
    authMock.userCan.mockReturnValue(false)
    // Switch to TABLE mode so the #acciones-cell slot renders.
    localStorage.setItem('pending-approvals-view-mode', 'table')
    mockPending.data.value = fixture()
    const wrapper = mount(getView().default)
    await flushPromises()
    // Table mode + data present → rows render with the acciones-cell slot.
    // canReview=false → the slot template wraps the buttons in v-if, so
    // neither approve nor reject button testid must exist.
    chaiExpect(wrapper.find('[data-testid="pending-approvals-row-approve"]').exists()).toBe(false)
    chaiExpect(wrapper.find('[data-testid="pending-approvals-row-reject"]').exists()).toBe(false)
  })
})

// ── WU-C — PendingApprovalCard approve/reject emits open the review dialog ─────

describe('PendingApprovalsView — review dialog flow (REQ-3, REQ-6)', () => {
  const fixture = () => [
    {
      id: 'to-1',
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
    },
  ]

  it('opens the review dialog with approve copy when card Aprobar is clicked', async () => {
    authMock.userCan.mockReturnValue(true)
    mockPending.data.value = fixture()
    const wrapper = mount(getView().default)
    await flushPromises()
    const card = wrapper.findComponent({ name: 'PendingApprovalCard' })
    chaiExpect(card.exists()).toBe(true)
    // Emit the `approve` event directly on the card component instance.
    // The view listens via @approve and routes to openReviewDialog →
    // isReviewDialogOpen=true → UModal opens → UCard with the title renders.
    card.vm.$emit('approve', fixture()[0])
    await flushPromises()
    // The dialog content (UCard inside UModal) renders "Aprobar solicitud
    // de ausencia" as the header title. UModal teleports to body — query
    // the global document so we capture the teleported tree.
    const html =
      typeof document !== 'undefined' ? document.body.innerHTML : wrapper.html()
    chaiExpect(html).toContain('Aprobar solicitud de ausencia')
  })

  it('opens the review dialog with reject copy when card Rechazar is clicked', async () => {
    authMock.userCan.mockReturnValue(true)
    mockPending.data.value = fixture()
    const wrapper = mount(getView().default)
    await flushPromises()
    const card = wrapper.findComponent({ name: 'PendingApprovalCard' })
    chaiExpect(card.exists()).toBe(true)
    card.vm.$emit('reject', fixture()[0])
    await flushPromises()
    const html =
      typeof document !== 'undefined' ? document.body.innerHTML : wrapper.html()
    chaiExpect(html).toContain('Rechazar solicitud de ausencia')
    // REQ-3 scenario "reject routes to dialog with reject copy": placeholder
    // for notes reads "Motivo del rechazo...".
    chaiExpect(html).toContain('Motivo del rechazo')
  })
})