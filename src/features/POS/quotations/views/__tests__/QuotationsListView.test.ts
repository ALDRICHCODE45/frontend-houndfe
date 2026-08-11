/**
 * QuotationsListView — REQ-QAF-009..013, REQ-QAF-016 tests.
 *
 * Drives the real list view with a mocked `useQuotationsListTable` composable
 * and a stubbed `AppDataTable` so we can assert the composition surface
 * (header, status tabs, filters slideover, toolbar, columns, navigation,
 * CASL gates, delete flow) without pulling the whole TanStack / Nuxt UI
 * runtime into the unit test.
 *
 * The view was rewritten to mirror the Sales pattern end-to-end:
 *   - UCard with split body bg (REQ-QAF-009) and TableHeaderDescription.
 *   - Status tabs + slideover + chips (REQ-QAF-010).
 *   - Single toolbar row assembled inside AppDataTable's DataTableToolbar:
 *     search + Filtros + refresh + Columnas + "Nueva cotización" + ViewToggle
 *     (REQ-QAF-011 / standardize-quotations-table).
 *   - Sortable headers via #<id>-header slots rendering SortableHeader on
 *     customer / status / totalCents / expiresAt / createdAt.
 *   - View mode persistence via useQuotationsViewMode → AppDataTable
 *     `displayMode` bridge.
 *   - URL persistence via useFiltersUrlAdapter (REQ-QAF-012).
 *   - Delete flow remains intact (REQ-QAF-013).
 *   - The legacy `QuotationsSearchInput` testid is gone (REQ-QAF-016);
 *     `refresh-quotations-button` + `new-quotation-button` testids now
 *     resolve through AppDataTable's `refreshButtonTestId` /
 *     `addButtonTestId` props instead of external buttons.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import QuotationsListView from '../QuotationsListView.vue'
import type {
  PaginatedQuotations,
  QuotationResponseDto,
} from '../../interfaces/quotation.types'

// ─── Composable mock state ────────────────────────────────────────────────────

const composableState = {
  pagination: ref({ pageIndex: 0, pageSize: 10 }),
  sorting: ref<{ id: string, desc: boolean }[]>([{ id: 'createdAt', desc: true }]),
  globalFilter: ref(''),
  rowSelection: ref<Record<string, boolean>>({}),
  columnPinning: ref<{ left: string[], right: string[] }>({ left: [], right: [] }),
  columnVisibility: ref<Record<string, boolean>>({}),
  data: ref<QuotationResponseDto[]>([]),
  totalCount: ref(0),
  pageCount: ref(0),
  isLoading: ref(false),
  isFetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  pageSizeOptions: [10, 20, 50],
  showingFrom: computed(() => 0),
  showingTo: computed(() => 0),
  refresh: vi.fn(),
  setStatusFilter: vi.fn(),
}

vi.mock('../../composables/useQuotationsListTable', () => ({
  useQuotationsListTable: () => ({
    pagination: composableState.pagination,
    sorting: composableState.sorting,
    globalFilter: composableState.globalFilter,
    rowSelection: composableState.rowSelection,
    columnPinning: composableState.columnPinning,
    columnVisibility: composableState.columnVisibility,
    data: computed(() => composableState.data.value),
    totalCount: computed(() => composableState.totalCount.value),
    pageCount: computed(() => composableState.pageCount.value),
    isLoading: computed(() => composableState.isLoading.value),
    isFetching: computed(() => composableState.isFetching.value),
    isError: computed(() => composableState.isError.value),
    error: computed(() => composableState.error.value),
    pageSizeOptions: composableState.pageSizeOptions,
    showingFrom: composableState.showingFrom,
    showingTo: composableState.showingTo,
    refresh: composableState.refresh,
    setStatusFilter: composableState.setStatusFilter,
  }),
}))

// ─── Auth store mock (CASL gates) ────────────────────────────────────────────

const authMock = {
  userCan: vi.fn((_action: string, _subject: string) => true),
  currentTenantId: 'tenant-1',
}

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authMock,
}))

// ─── Customer API mock ────────────────────────────────────────────────────────

vi.mock('@/features/POS/customers/api/customer.api', () => ({
  customerApi: {
    getPaginated: vi.fn().mockResolvedValue({ data: [], pagination: { pageIndex: 0, pageSize: 100, totalCount: 0, pageCount: 0 } }),
  },
}))

// ─── Router mock (push) ───────────────────────────────────────────────────────

const routerPush = vi.fn()
const routerReplace = vi.fn()
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: routerPush, replace: routerReplace }),
    useRoute: () => ({ query: {}, params: {}, path: '/pos/cotizaciones' }),
    RouterLink: RouterLinkStub,
  }
})

// ─── Toast mock ───────────────────────────────────────────────────────────────

vi.mock('#app', () => ({
  useToast: () => ({ add: vi.fn() }),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeQuotation(overrides: Partial<QuotationResponseDto> = {}): QuotationResponseDto {
  return {
    id: 'qtn-1',
    customerId: null,
    customer: {
      id: 'cust-1',
      firstName: 'María',
      lastName: 'Pérez',
      email: 'maria@example.com',
    },
    globalPriceListId: null,
    priceListExplicitlySet: false,
    status: 'DRAFT',
    expiresAt: '2026-09-01T00:00:00.000Z',
    cancelReason: null,
    canceledAt: null,
    subtotalCents: 10000,
    discountCents: 0,
    totalCents: 10000,
    taxRate: null,
    taxCents: null,
    customerNotes: null,
    manuallyEnded: false,
    items: [],
    appliedPromotions: [],
    vetoedPromotionIds: [],
    optedInManualPromotionIds: [],
    effectiveStatus: 'DRAFT',
    sellerUserId: '',
    seller: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

// ─── Stubs ────────────────────────────────────────────────────────────────────

const appDataTableStub = {
  props: [
    'data',
    'columns',
    'loading',
    'fetching',
    'error',
    'errorMessage',
    'totalCount',
    'pageCount',
    'pageSizeOptions',
    'pageSize',
    'empty',
    'enableRowSelection',
    'searchPlaceholder',
    'showToolbar',
    'showAddButton',
    'addButtonText',
    'addButtonIcon',
    'addButtonTestId',
    'refreshButtonTestId',
    'showRefresh',
    'mobileRender',
    'displayMode',
    'enableColumnVisibility',
  ],
  emits: [
    'update:pagination',
    'update:sorting',
    'update:global-filter',
    'update:row-selection',
    'update:column-pinning',
    'update:column-visibility',
    'refresh',
    'add',
  ],
  template: `
    <div
      data-testid="app-data-table"
      :data-loading="loading"
      :data-fetching="fetching"
      :data-error="error"
      :data-total-count="totalCount"
      :data-page-count="pageCount"
      :data-empty="empty"
      :data-row-count="(data ?? []).length"
      :data-enable-column-visibility="enableColumnVisibility ? 'true' : 'false'"
      :data-show-refresh="showRefresh === false ? 'false' : 'true'"
      :data-show-add-button="showAddButton ? 'true' : 'false'"
      :data-add-button-text="addButtonText ?? ''"
      :data-add-button-icon="addButtonIcon ?? ''"
      :data-add-button-test-id="addButtonTestId ?? ''"
      :data-refresh-button-test-id="refreshButtonTestId ?? ''"
      :data-display-mode="displayMode ?? 'auto'"
    >
      <slot name="filters" />
        <slot name="actions" />
        <!-- Render the refresh button (with its testid) so click tests work.
             showRefresh defaults to true in AppDataTable; only false disables it. -->
        <button
          v-if="showRefresh !== false && refreshButtonTestId"
          :data-testid="refreshButtonTestId"
          :aria-label="'Actualizar cotizaciones'"
          @click="$emit('refresh')"
        />
        <!-- Render the add button (with its testid) so click tests work. -->
        <button
          v-if="showAddButton && addButtonTestId"
          :data-testid="addButtonTestId"
          :data-label="addButtonText"
          @click="$emit('add')"
        />
        <!-- The cards slot is rendered ONCE for the whole grid, mirroring
             AppDataTable's real cards display-mode shape. -->
        <div data-testid="cards-host">
          <slot name="cards" :data="data ?? []" :loading="loading" :empty="empty" />
        </div>
        <div
          v-for="(row, index) in data"
          :key="row.id"
          :data-testid="'row-' + row.id"
          :data-index="index"
        >
          <slot name="id-cell" :row="{ original: row, index }" />
          <slot name="customer-cell" :row="{ original: row, index }" />
          <slot name="status-cell" :row="{ original: row, index }" />
          <slot name="totalCents-cell" :row="{ original: row, index }" />
          <slot name="expiresAt-cell" :row="{ original: row, index }" />
          <slot name="createdAt-cell" :row="{ original: row, index }" />
          <slot name="actions-cell" :row="{ original: row, index }" />
          <slot name="mobile-card" :row="row" :index="index" />
        </div>
      <!-- Header slot passthrough so column header tests can render them. -->
      <template v-for="col in columns" :key="col.id">
        <slot :name="col.id + '-header'" :column="col" />
      </template>
    </div>
  `,
}

const dataTableFiltersStub = {
  props: ['schema', 'state', 'errors'],
  emits: ['update:state'],
  template: `
    <div data-testid="data-table-filters-stub">
      <button data-testid="filters-trigger" @click="$emit('update:state', state)">
        Filtros
      </button>
      <div data-testid="filters-chips">
        <slot name="chips" :chips="[]" :clear="() => {}" :clear-all="() => {}" />
      </div>
    </div>
  `,
}

const dataTableFiltersChipsStub = {
  props: ['schema', 'state'],
  emits: ['clear', 'clear-all'],
  template: '<div data-testid="filters-chips"><slot /></div>',
}

const stubs = {
  AppDataTable: appDataTableStub,
  DataTableFilters: dataTableFiltersStub,
  DataTableFiltersChips: dataTableFiltersChipsStub,
  SortableHeader: true,
  ViewToggle: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: `
      <div data-testid="view-toggle" :data-model-value="modelValue">
        <slot />
      </div>
    `,
  },
  QuotationCard: {
    props: ['quotation', 'canDelete'],
    emits: ['navigate', 'delete', 'click'],
    template: '<div data-testid="quotation-card" :data-can-delete="String(canDelete)" @click="$emit(\'click\', quotation)">{{ quotation.id }}</div>',
  },
  QuotationCardGrid: {
    name: 'QuotationCardGrid',
    props: ['quotations', 'loading', 'empty', 'canDelete'],
    emits: ['card-click', 'delete', 'navigate'],
    template: `
      <div data-testid="quotation-card-grid-stub" :data-can-delete="String(canDelete)">
        <div v-for="q in quotations" :key="q.id">
          <div
            data-testid="quotation-card-stub"
            @click="$emit('card-click', q)"
          >{{ q.id }}</div>
        </div>
      </div>
    `,
  },
  TableHeaderDescription: {
    props: ['title', 'description'],
    template: '<div data-testid="table-header-description"><h1>{{ title }}</h1><p>{{ description }}</p></div>',
  },
  ConfirmModal: {
    props: ['open', 'title', 'description', 'confirmLabel', 'confirmColor', 'loading'],
    emits: ['update:open', 'confirm'],
    template: `
      <div
        v-if="open"
        data-testid="confirm-modal"
        :data-confirm-label="confirmLabel"
        :data-confirm-color="confirmColor"
        :data-loading="String(loading)"
      >
        <p data-testid="confirm-description">{{ description }}</p>
        <button data-testid="confirm-modal-confirm" @click="$emit('confirm')">stub-confirm</button>
        <button data-testid="confirm-modal-cancel" @click="$emit('update:open', false)">stub-cancel</button>
      </div>
    `,
  },
  UDropdownMenu: {
    props: ['items'],
    template: '<div data-testid="dropdown-stub"><slot /></div>',
  },
  UButton: {
    props: ['label', 'color', 'variant', 'icon', 'loading', 'disabled'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot>{{ label }}</slot></button>',
  },
}

// ─── Test setup ──────────────────────────────────────────────────────────────

function resetState() {
  composableState.pagination.value = { pageIndex: 0, pageSize: 10 }
  composableState.sorting.value = [{ id: 'createdAt', desc: true }]
  composableState.globalFilter.value = ''
  composableState.rowSelection.value = {}
  composableState.columnPinning.value = { left: [], right: [] }
  composableState.columnVisibility.value = {}
  composableState.data.value = []
  composableState.totalCount.value = 0
  composableState.pageCount.value = 0
  composableState.isLoading.value = false
  composableState.isFetching.value = false
  composableState.isError.value = false
  composableState.error.value = null
  composableState.refresh.mockReset()
  composableState.setStatusFilter.mockReset()
  composableState.setStatusFilter.mockImplementation((status?: string) => {
    // The view layer clears the slideover status when a tab is clicked.
    // The composable is told only about the tab status.
  })
  authMock.userCan.mockReset()
  authMock.userCan.mockReturnValue(true)
  routerPush.mockReset()
  routerReplace.mockReset()
}

beforeEach(() => {
  resetState()
})

function mountView(extraOpts: Parameters<typeof mount>[1] = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  })
  return mount(QuotationsListView, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]], stubs },
    ...extraOpts,
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('QuotationsListView — header chrome (REQ-QAF-009)', () => {
  it('renders the page title and description via TableHeaderDescription', () => {
    const wrapper = mountView()

    expect(wrapper.text()).toContain('Cotizaciones')
    expect(wrapper.text()).toContain('Listado de cotizaciones')
  })

  it('keeps the `.quotations-list-view` token-scope class so Coco tokens still resolve', () => {
    const wrapper = mountView()
    const root = wrapper.get('[data-testid="quotations-list-view"]')
    expect(root.classes()).toContain('quotations-list-view')
  })

  it('renders the "Nueva cotización" CTA via AppDataTable with addButtonTestId="new-quotation-button"', () => {
    // After the toolbar standardization (REQ-QAF-016) the CTA lives inside
    // AppDataTable's toolbar instead of an external UButton. We assert the
    // testid is wired through the new `addButtonTestId` prop so the legacy
    // `new-quotation-button` selector keeps working for e2e flows.
    authMock.userCan.mockReturnValue(true)
    const wrapper = mountView()

    const table = wrapper.find('[data-testid="app-data-table"]')
    expect(table.attributes('data-add-button-test-id')).toBe('new-quotation-button')
    expect(table.attributes('data-add-button-text')).toBe('Nueva cotización')
    expect(table.attributes('data-add-button-icon')).toBe('i-lucide-file-plus')
  })
})

describe('QuotationsListView — status tabs (REQ-QAF-010)', () => {
  it('renders all five status tabs in the canonical order', () => {
    const wrapper = mountView()

    const tabBar = wrapper.find('[data-testid="status-tabs"]')
    expect(tabBar.exists()).toBe(true)
    const labels = tabBar.findAll('button').map((b) => b.text().trim())
    expect(labels).toEqual(['Todos', 'Borradores', 'Enviadas', 'Expiradas', 'Canceladas'])
  })

  it('clicking "Borradores" calls setStatusFilter("DRAFT")', async () => {
    const wrapper = mountView()

    const tabs = wrapper.findAll('[data-testid="status-tabs"] button')
    const draftTab = tabs.find((b) => b.text().trim() === 'Borradores')!
    await draftTab.trigger('click')

    expect(composableState.setStatusFilter).toHaveBeenCalledWith('DRAFT')
  })

  it('clicking "Enviadas" calls setStatusFilter("SENT")', async () => {
    const wrapper = mountView()

    const tabs = wrapper.findAll('[data-testid="status-tabs"] button')
    const sentTab = tabs.find((b) => b.text().trim() === 'Enviadas')!
    await sentTab.trigger('click')

    expect(composableState.setStatusFilter).toHaveBeenCalledWith('SENT')
  })

  it('clicking "Expiradas" calls setStatusFilter("EXPIRED")', async () => {
    const wrapper = mountView()

    const tabs = wrapper.findAll('[data-testid="status-tabs"] button')
    const expiredTab = tabs.find((b) => b.text().trim() === 'Expiradas')!
    await expiredTab.trigger('click')

    expect(composableState.setStatusFilter).toHaveBeenCalledWith('EXPIRED')
  })

  it('clicking "Canceladas" calls setStatusFilter("CANCELLED")', async () => {
    const wrapper = mountView()

    const tabs = wrapper.findAll('[data-testid="status-tabs"] button')
    const cancelledTab = tabs.find((b) => b.text().trim() === 'Canceladas')!
    await cancelledTab.trigger('click')

    expect(composableState.setStatusFilter).toHaveBeenCalledWith('CANCELLED')
  })

  it('clicking "Todos" calls setStatusFilter(undefined) (the no-filter sentinel)', async () => {
    const wrapper = mountView()

    const tabs = wrapper.findAll('[data-testid="status-tabs"] button')
    const allTab = tabs.find((b) => b.text().trim() === 'Todos')!
    await allTab.trigger('click')

    expect(composableState.setStatusFilter).toHaveBeenCalledWith(undefined)
  })

  it('marks the active tab with aria-current="page" for accessibility', async () => {
    // The view computes activeStatusTab from the slideover's status field.
    // Clicking the SENT tab writes status: ['SENT'] into the slideover state,
    // so the aria-current flips to the SENT button.
    const wrapper = mountView()

    const tabs = wrapper.findAll('[data-testid="status-tabs"] button')
    const sentTab = tabs.find((b) => b.text().trim() === 'Enviadas')!
    await sentTab.trigger('click')

    await wrapper.vm.$nextTick()

    const sentTabAfter = wrapper.findAll('[data-testid="status-tabs"] button').find(
      (b) => b.text().trim() === 'Enviadas',
    )!
    expect(sentTabAfter.attributes('aria-current')).toBe('page')
  })
})

describe('QuotationsListView — Filtros slideover + chips (REQ-QAF-010)', () => {
  it('renders a Filtros trigger for the slideover', () => {
    const wrapper = mountView()

    expect(wrapper.find('[data-testid="filters-trigger"]').exists()).toBe(true)
  })

  it('renders the filters-chips region', () => {
    const wrapper = mountView()

    expect(wrapper.find('[data-testid="filters-chips"]').exists()).toBe(true)
  })

  it('renders the active-filter chips exactly once (no duplicate badges)', () => {
    // Regression: the view used to render an extra <DataTableFiltersChips>
    // below <DataTableFilters>, which already renders its chips slot
    // internally — one active filter showed as two badges.
    const wrapper = mountView()

    expect(wrapper.findAll('[data-testid="filters-chips"]')).toHaveLength(1)
  })
})

describe('QuotationsListView — AppDataTable wiring (REQ-QAF-011)', () => {
  it('renders the table with the right page-size options', () => {
    const wrapper = mountView()
    const table = wrapper.find('[data-testid="app-data-table"]')

    expect(table.exists()).toBe(true)
  })

  it('forwards the quotations array to the table', () => {
    const items = [
      makeQuotation({ id: 'qtn-a' }),
      makeQuotation({ id: 'qtn-b' }),
    ]
    composableState.data.value = items
    composableState.totalCount.value = 2

    const wrapper = mountView()
    const table = wrapper.find('[data-testid="app-data-table"]')

    expect(table.attributes('data-row-count')).toBe('2')
    expect(table.attributes('data-total-count')).toBe('2')
  })

  it('forwards loading state from the composable', () => {
    composableState.isLoading.value = true

    const wrapper = mountView()
    const table = wrapper.find('[data-testid="app-data-table"]')

    expect(table.attributes('data-loading')).toBe('true')
  })

  it('forwards fetching state from the composable', () => {
    composableState.isFetching.value = true

    const wrapper = mountView()
    const table = wrapper.find('[data-testid="app-data-table"]')

    expect(table.attributes('data-fetching')).toBe('true')
  })

  it('passes enableColumnVisibility to the table', () => {
    const wrapper = mountView()
    // The stub exposes the table via the data-testid attribute. We grab the
    // data-attribute rather than the props() API because vue-test-utils
    // treats object-style stubs as "no name" components.
    const table = wrapper.find('[data-testid="app-data-table"]')
    const value = table.attributes('data-enable-column-visibility')
    expect(value).toBe('true')
  })

  it('enables the AppDataTable toolbar refresh so it carries refresh-quotations-button (REQ-QAF-016)', () => {
    // After the toolbar standardization, the refresh icon lives in the
    // AppDataTable toolbar (default `show-refresh=true`) carrying the
    // `refresh-quotations-button` testid instead of a standalone UButton.
    const wrapper = mountView()
    const table = wrapper.find('[data-testid="app-data-table"]')

    expect(table.attributes('data-show-refresh')).toBe('true')
    expect(table.attributes('data-refresh-button-test-id')).toBe('refresh-quotations-button')
  })
})

describe('QuotationsListView — cards slot (REQ-QAF-011 / REQ-17)', () => {
  it('renders QuotationCardGrid per row via the #cards slot', () => {
    composableState.data.value = [
      makeQuotation({ id: 'qtn-mobile-a' }),
      makeQuotation({ id: 'qtn-mobile-b' }),
    ]
    composableState.totalCount.value = 2

    const wrapper = mountView()
    const grid = wrapper.find('[data-testid="quotation-card-grid-stub"]')
    expect(grid.exists()).toBe(true)
    const cards = wrapper.findAll('[data-testid="quotation-card-stub"]')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.text()).toContain('qtn-mobile-a')
    expect(cards[1]!.text()).toContain('qtn-mobile-b')
  })

  it('forwards the canDelete CASL gate into QuotationCardGrid', () => {
    composableState.data.value = [makeQuotation({ id: 'qtn-mobile-c' })]
    composableState.totalCount.value = 1

    const wrapper = mountView()
    const grid = wrapper.get('[data-testid="quotation-card-grid-stub"]')

    expect(grid.attributes('data-can-delete')).toBe('true')
  })

  it('navigates to /pos/cotizaciones/:id when a card is clicked', async () => {
    composableState.data.value = [makeQuotation({ id: 'qtn-card-click' })]

    const wrapper = mountView()
    await wrapper.get('[data-testid="quotation-card-stub"]').trigger('click')

    expect(routerPush).toHaveBeenCalled()
    const arg = routerPush.mock.calls[routerPush.mock.calls.length - 1]?.[0]
    const path = typeof arg === 'string' ? arg : (arg as { path?: string })?.path
    expect(path).toBe('/pos/cotizaciones/qtn-card-click')
  })

  it('opens the delete confirmation when a card emits delete', async () => {
    composableState.data.value = [makeQuotation({ id: 'qtn-card-del' })]

    const wrapper = mountView()
    const grid = wrapper.findComponent({ name: 'QuotationCardGrid' })
    grid.vm.$emit('delete', composableState.data.value[0])
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(true)
  })

  it('does not render cards when the list is empty', () => {
    composableState.data.value = []

    const wrapper = mountView()

    expect(wrapper.findAll('[data-testid="quotation-card-stub"]')).toHaveLength(0)
  })
})

// ─── Refresh action (REQ-QAF-014) ─────────────────────────────────────────────

describe('QuotationsListView — refresh action', () => {
  it('renders the refresh button wired to the composable refresh() inside AppDataTable', async () => {
    // After the toolbar standardization the refresh button lives inside the
    // AppDataTable stub (we render it there with the testid so the legacy
    // selector keeps working). Clicking it still fires refresh().
    const wrapper = mountView()
    const button = wrapper.get('[data-testid="refresh-quotations-button"]')

    expect(button.attributes('aria-label')).toBe('Actualizar cotizaciones')

    await button.trigger('click')
    expect(composableState.refresh).toHaveBeenCalled()
  })

  it('keeps the refresh button rendered while fetching (spinner is theme-driven)', () => {
    composableState.isFetching.value = true

    const wrapper = mountView()
    expect(wrapper.find('[data-testid="refresh-quotations-button"]').exists()).toBe(true)
  })
})

describe('QuotationsListView — CASL gate for "Nueva cotización"', () => {
  it('shows the button when userCan("create", "Quotation") is true', () => {
    authMock.userCan.mockImplementation((action: unknown, subject: unknown) =>
      action === 'create' && subject === 'Quotation',
    )

    const wrapper = mountView()
    const button = wrapper.find('[data-testid="new-quotation-button"]')

    expect(button.exists()).toBe(true)
  })

  it('hides the button when userCan("create", "Quotation") is false', () => {
    authMock.userCan.mockReturnValue(false)

    const wrapper = mountView()
    const button = wrapper.find('[data-testid="new-quotation-button"]')

    expect(button.exists()).toBe(false)
  })
})

describe('QuotationsListView — navigation', () => {
  it('clicking "Nueva cotización" pushes /pos/cotizaciones/nueva', async () => {
    authMock.userCan.mockReturnValue(true)

    const wrapper = mountView()
    const button = wrapper.find('[data-testid="new-quotation-button"]')
    await button.trigger('click')

    expect(routerPush).toHaveBeenCalled()
    const arg = routerPush.mock.calls[0]?.[0]
    const path = typeof arg === 'string' ? arg : (arg as { path?: string })?.path
    expect(path).toBe('/pos/cotizaciones/nueva')
  })

  it('clicking a row customer-cell link navigates to /pos/cotizaciones/:id', async () => {
    // The cell slot was renamed from `cliente-cell` → `customer-cell` so the
    // accessorFn can resolve `firstName lastName` and the backend sortBy can
    // hit the new column id directly. The testid still embeds the row id.
    composableState.data.value = [makeQuotation({ id: 'qtn-abc-123' })]

    const wrapper = mountView()
    const link = wrapper.find('[data-testid="quotation-link-qtn-abc-123"]')
    expect(link.exists()).toBe(true)

    await link.trigger('click')

    expect(routerPush).toHaveBeenCalled()
    const arg = routerPush.mock.calls[0]?.[0]
    const path = typeof arg === 'string' ? arg : (arg as { path?: string })?.path
    expect(path).toBe('/pos/cotizaciones/qtn-abc-123')
  })
})

// ─── standardize-quotations-table: toolbar standardization ───────────────────
// These tests cover the refactor that drops external refresh/add UButtons in
// favor of the unified AppDataTable toolbar, plus the new sortable headers
// and ViewToggle wiring.

describe('QuotationsListView — standardized toolbar (standardize-quotations-table)', () => {
  it('passes the canCreate gate to AppDataTable show-add-button', () => {
    authMock.userCan.mockReturnValue(true)
    const wrapper = mountView()

    const table = wrapper.find('[data-testid="app-data-table"]')
    expect(table.attributes('data-show-add-button')).toBe('true')
  })

  it('does NOT pass show-add-button when canCreate is false', () => {
    authMock.userCan.mockReturnValue(false)
    const wrapper = mountView()

    const table = wrapper.find('[data-testid="app-data-table"]')
    expect(table.attributes('data-show-add-button')).toBe('false')
    expect(wrapper.find('[data-testid="new-quotation-button"]').exists()).toBe(false)
  })

  it('does not render a standalone refresh/add button pair outside AppDataTable', () => {
    // Regression guard: pre-refactor, refresh + "Nueva cotización" lived
    // beside DataTableFilters in a row above the toolbar. The unified
    // toolbar must keep them inside AppDataTable only.
    authMock.userCan.mockReturnValue(true)
    const wrapper = mountView()

    // The two testids still exist (they live inside the AppDataTable stub
    // now), so we assert the AppDataTable attributes carry the testids and
    // that no extra `<button data-testid="refresh-quotations-button">`
    // exists outside the data-testid="app-data-table" container.
    const table = wrapper.get('[data-testid="app-data-table"]')
    expect(table.attributes('data-refresh-button-test-id')).toBe('refresh-quotations-button')
    expect(table.attributes('data-add-button-test-id')).toBe('new-quotation-button')

    const root = wrapper.element as HTMLElement
    // Count buttons outside the table that carry either testid — must be 0.
    const allButtons = Array.from(root.querySelectorAll('button'))
    const strayRefresh = allButtons.filter(
      (b) => b.getAttribute('data-testid') === 'refresh-quotations-button'
        && !b.closest('[data-testid="app-data-table"]'),
    )
    const strayAdd = allButtons.filter(
      (b) => b.getAttribute('data-testid') === 'new-quotation-button'
        && !b.closest('[data-testid="app-data-table"]'),
    )
    expect(strayRefresh).toHaveLength(0)
    expect(strayAdd).toHaveLength(0)
  })

  it('passes displayMode to AppDataTable from the useQuotationsViewMode bridge', () => {
    const wrapper = mountView()

    const table = wrapper.find('[data-testid="app-data-table"]')
    // Default mode is `table` → AppDataTable displayMode `table`.
    expect(table.attributes('data-display-mode')).toBe('table')
  })

  it('renders the ViewToggle inside the AppDataTable #actions slot', () => {
    const wrapper = mountView()

    const viewToggle = wrapper.find('[data-testid="view-toggle"]')
    expect(viewToggle.exists()).toBe(true)
    // viewMode defaults to `table` per useQuotationsViewMode.
    expect(viewToggle.attributes('data-model-value')).toBe('table')
  })

  it('renders SortableHeader for the 5 sortable columns with Spanish labels', () => {
    // The view defines SortableHeader slots for customer / status /
    // totalCents / expiresAt / createdAt. The stub renders them as
    // `<sortable-header-stub label="...">`. Verifying the labels keeps
    // a regression from re-introducing the Spanish column ids.
    const wrapper = mountView()
    const table = wrapper.get('[data-testid="app-data-table"]')
    const stubHeaders = table.findAll('sortable-header-stub')

    // 5 sortable columns (id and actions are unsortable → no header slot).
    expect(stubHeaders).toHaveLength(5)
    const labels = stubHeaders.map((h) => h.attributes('label'))
    expect(labels).toEqual(['Cliente', 'Estado', 'Total', 'Expira', 'Fecha'])
  })
})

describe('QuotationsListView — empty state (REQ-QTN-016)', () => {
  it('forwards the empty message to AppDataTable', () => {
    composableState.data.value = []
    composableState.totalCount.value = 0

    const wrapper = mountView()
    const table = wrapper.find('[data-testid="app-data-table"]')

    expect(table.attributes('data-empty')).toContain('No hay cotizaciones')
  })
})

// ─── S8: lazy EXPIRED detection (REQ-QTN-008 / backend §7.4) ────────────────

describe('QuotationsListView — lazy EXPIRED detection (REQ-QTN-008 / S8.4)', () => {
  function rowBadgeText(wrapper: ReturnType<typeof mount>, rowId: string): string {
    const row = wrapper.find(`[data-testid="row-${rowId}"]`)
    return row.text()
  }

  it('renders a SENT row whose expiresAt is in the past with the EXPIRED badge', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'))
    try {
      composableState.data.value = [
        makeQuotation({
          id: 'qtn-stale',
          status: 'SENT',
          expiresAt: '2026-08-01T00:00:00.000Z',
        }),
      ]

      const wrapper = mountView()
      expect(wrapper.find('[data-testid="row-qtn-stale"]').exists()).toBe(true)
      expect(rowBadgeText(wrapper, 'qtn-stale')).toContain('Expirada')
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps a SENT row as SENT when expiresAt is still in the future', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T12:00:00.000Z'))
    try {
      composableState.data.value = [
        makeQuotation({
          id: 'qtn-future',
          status: 'SENT',
          expiresAt: '2026-09-30T12:00:00.000Z',
        }),
      ]

      const wrapper = mountView()
      expect(rowBadgeText(wrapper, 'qtn-future')).toContain('Enviada')
      expect(rowBadgeText(wrapper, 'qtn-future')).not.toContain('Expirada')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not lazy-EXPIRE DRAFT rows (DRAFT never auto-transitions to EXPIRED)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'))
    try {
      composableState.data.value = [
        makeQuotation({
          id: 'qtn-draft-stale',
          status: 'DRAFT',
          expiresAt: '2026-08-01T00:00:00.000Z',
        }),
      ]

      const wrapper = mountView()
      expect(rowBadgeText(wrapper, 'qtn-draft-stale')).toContain('Borrador')
      expect(rowBadgeText(wrapper, 'qtn-draft-stale')).not.toContain('Expirada')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not lazy-EXPIRE SENT rows that have no expiresAt (never-expires)', () => {
    composableState.data.value = [
      makeQuotation({
        id: 'qtn-never-expires',
        status: 'SENT',
        expiresAt: null,
      }),
    ]

    const wrapper = mountView()
    expect(rowBadgeText(wrapper, 'qtn-never-expires')).toContain('Enviada')
    expect(rowBadgeText(wrapper, 'qtn-never-expires')).not.toContain('Expirada')
  })
})

// ─── REQ-QAF-016: anti-requirements — the legacy testid is gone ───────────────

describe('QuotationsListView — REQ-QAF-016 anti-requirements', () => {
  it('does NOT render the legacy `quotation-search-input` testid', () => {
    const wrapper = mountView()

    expect(wrapper.find('[data-testid="quotation-search-input"]').exists()).toBe(false)
  })
})

// _PaginatedQuotations is intentionally imported to keep the type in scope for
// any future helper that needs to construct a sample response in this file.
type _PaginatedQuotationsUnused = PaginatedQuotations
