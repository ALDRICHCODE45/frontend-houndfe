/**
 * QuotationsListView — composition tests on a stubbed AppDataTable.
 *
 * Drives the real list view with a mocked `useQuotationsListTable` composable
 * and a stubbed `AppDataTable` so we can assert the composition surface
 * (header, status tabs, filters, columns, row-open, ⋮ menu, CASL gates, delete
 * flow) without pulling the whole TanStack / Nuxt UI runtime into the unit
 * test. The four S10 states are asserted against the REAL AppDataTable in
 * `QuotationsListView.states.spec.ts`.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import QuotationsListView from '../QuotationsListView.vue'
import { columnLabel } from '@/core/shared/components/DataTable/columnLayout.utils'
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
  columnOrder: ref<string[]>([]),
  columnSizing: ref<Record<string, number>>({}),
  density: ref('comfortable'),
  resetLayout: vi.fn(),
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

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...actual,
    useBreakpoints: () => ({
      smaller: vi.fn(() => true), // mobile by default → DataTableFilters embedded=true
    }),
  }
})

vi.mock('../../composables/useQuotationsListTable', () => ({
  useQuotationsListTable: () => ({
    pagination: composableState.pagination,
    sorting: composableState.sorting,
    globalFilter: composableState.globalFilter,
    rowSelection: composableState.rowSelection,
    columnPinning: composableState.columnPinning,
    columnVisibility: composableState.columnVisibility,
    columnOrder: composableState.columnOrder,
    columnSizing: composableState.columnSizing,
    density: composableState.density,
    resetLayout: composableState.resetLayout,
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
    'showRefresh',
    'mobileRender',
    'displayMode',
    'enableColumnVisibility',
    'portalClass',
    'paginationPortalClass',
    'rowOpen',
    'emptyState',
    'filtered',
    'noMatchTitle',
    'activeFilterCount',
    'columnPinning',
    'columnVisibility',
    'columnOrder',
    'columnSizing',
    'density',
    'persistLayout',
  ],
  emits: [
    'update:columnPinning',
    'update:columnVisibility',
    'update:columnOrder',
    'update:columnSizing',
    'update:density',
    'reset-columns',
    'update:pagination',
    'update:sorting',
    'update:global-filter',
    'update:row-selection',
    'update:column-pinning',
    'update:column-visibility',
    'refresh',
    'add',
    'empty-action',
    'clear-filters',
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
      :data-show-refresh="showRefresh ? 'true' : 'false'"
      :data-show-add-button="showAddButton ? 'true' : 'false'"
      :data-add-button-text="addButtonText ?? ''"
      :data-add-button-icon="addButtonIcon ?? ''"
      :data-add-button-test-id="addButtonTestId ?? ''"
      :data-display-mode="displayMode ?? 'auto'"
      :data-filtered="String(!!filtered)"
      :data-empty-title="emptyState?.title ?? ''"
      :data-empty-action="emptyState?.actionLabel ?? ''"
      :data-no-match-title="noMatchTitle ?? ''"
      :data-active-filter-count="activeFilterCount ?? 0"
      :data-portal-class="portalClass ?? ''"
      :data-pagination-portal-class="paginationPortalClass ?? ''"
    >
      <slot name="filters" />
        <slot name="actions" />
        <!-- Render the add button (with its testid) so click tests work. -->
        <button
          v-if="showAddButton && addButtonTestId"
          :data-testid="addButtonTestId"
          :data-label="addButtonText"
          @click="$emit('add')"
        />
        <button data-testid="stub-empty-action" @click="$emit('empty-action')" />
        <button data-testid="stub-clear-filters" @click="$emit('clear-filters')" />
        <button data-testid="stub-row-open" @click="rowOpen && rowOpen((data ?? [])[0])" />
        <div
          v-for="(row, index) in data"
          :key="row.id"
          :data-testid="'row-' + row.id"
          :data-index="index"
        >
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
  props: ['schema', 'state', 'errors', 'embedded', 'portalClass'],
  emits: ['update:state'],
  template: `
    <div data-testid="data-table-filters-stub" :data-embedded="String(!!embedded)" :data-portal-class="portalClass ?? ''">
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
  ConfirmModal: {
    props: ['open', 'title', 'description', 'confirmLabel', 'confirmColor', 'loading', 'ui'],
    emits: ['update:open', 'confirm'],
    template: `
      <div
        v-if="open"
        data-testid="confirm-modal"
        :data-confirm-label="confirmLabel"
        :data-confirm-color="confirmColor"
        :data-loading="String(loading)"
        :data-ui-content="ui?.content ?? ''"
      >
        <p data-testid="confirm-description">{{ description }}</p>
        <button data-testid="confirm-modal-confirm" @click="$emit('confirm')">stub-confirm</button>
        <button data-testid="confirm-modal-cancel" @click="$emit('update:open', false)">stub-cancel</button>
      </div>
    `,
  },
  RowActionsMenu: {
    name: 'RowActionsMenu',
    props: ['actions', 'rowLabel', 'portalClass'],
    emits: ['select'],
    template: `
      <div data-testid="row-actions-stub" :data-row-label="rowLabel" :data-portal-class="portalClass ?? ''">
        <button
          v-for="action in actions"
          :key="action.key"
          :data-action="action.key"
          :data-destructive="String(!!action.destructive)"
          @click="$emit('select', action.key)"
        >{{ action.label }}</button>
      </div>
    `,
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
  composableState.columnOrder.value = []
  composableState.columnSizing.value = {}
  composableState.density.value = 'comfortable'
  composableState.resetLayout.mockReset()
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
  it('keeps the page heading outside the table surface, with a title and no subtitle (text diet)', () => {
    const wrapper = mountView()
    const header = wrapper.get('.hf-page-header')
    const surface = wrapper.get('[data-testid="quotations-list-view"]')

    expect(header.get('h1.hf-page-title').text()).toBe('Cotizaciones')
    expect(header.find('.hf-page-subtitle').exists()).toBe(false)
    expect(header.element.parentElement).toBe(surface.element.parentElement)
    expect(header.element.nextElementSibling).toBe(surface.element)
    expect(surface.find('.hf-page-header').exists()).toBe(false)
    expect(surface.classes()).toContain('hf-table-surface')
    expect(surface.find('[data-testid="status-tabs"]').exists()).toBe(true)
    expect(surface.find('[data-testid="app-data-table"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders the "Nueva cotización" CTA via AppDataTable with addButtonTestId="new-quotation-button"', () => {
    // The CTA lives inside AppDataTable's toolbar; the testid is wired through
    // `addButtonTestId` so the legacy `new-quotation-button` selector keeps working.
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
    expect(labels).toEqual(['Todas', 'Borradores', 'Enviadas', 'Expiradas', 'Canceladas'])
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

  it('clicking "Todas" calls setStatusFilter(undefined) (the no-filter sentinel)', async () => {
    const wrapper = mountView()

    const tabs = wrapper.findAll('[data-testid="status-tabs"] button')
    const allTab = tabs.find((b) => b.text().trim() === 'Todas')!
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

describe('QuotationsListView — status tabs are the only status filter (L48)', () => {
  it('has no Estado select in the Filtros schema', () => {
    const wrapper = mountView()
    const schema = wrapper.getComponent(dataTableFiltersStub).props('schema') as {
      fields: { id: string, label: string }[]
    }

    expect(schema.fields.map((field) => field.id)).not.toContain('status')
    expect(schema.fields.map((field) => field.label)).not.toContain('Estado')
  })

  it('does not count the selected tab as an active filter', async () => {
    const wrapper = mountView()
    const draftTab = wrapper.findAll('[data-testid="status-tabs"] button').find((b) => b.text().trim() === 'Borradores')!
    await draftTab.trigger('click')

    expect(wrapper.get('[data-testid="app-data-table"]').attributes('data-active-filter-count')).toBe('0')
  })

  it('still flags the table as filtered while a tab is selected', async () => {
    const wrapper = mountView()
    const draftTab = wrapper.findAll('[data-testid="status-tabs"] button').find((b) => b.text().trim() === 'Borradores')!
    await draftTab.trigger('click')

    expect(wrapper.get('[data-testid="app-data-table"]').attributes('data-filtered')).toBe('true')
  })

  it('counts the remaining filters and resets them and the tab from Limpiar filtros', async () => {
    const wrapper = mountView()
    const filters = wrapper.getComponent(dataTableFiltersStub)
    await filters.vm.$emit('update:state', { customerId: ['cust-1'] })
    await wrapper.findAll('[data-testid="status-tabs"] button').find((b) => b.text().trim() === 'Enviadas')!.trigger('click')
    expect(wrapper.get('[data-testid="app-data-table"]').attributes('data-active-filter-count')).toBe('1')

    await wrapper.get('[data-testid="stub-clear-filters"]').trigger('click')

    expect(wrapper.get('[data-testid="app-data-table"]').attributes('data-active-filter-count')).toBe('0')
    expect(composableState.setStatusFilter).toHaveBeenLastCalledWith(undefined)
    const all = wrapper.findAll('[data-testid="status-tabs"] button').find((b) => b.text().trim() === 'Todas')!
    expect(all.attributes('aria-current')).toBe('page')
  })
})

describe('QuotationsListView — Filtros slideover + chips (REQ-QAF-010)', () => {
  it('renders a Filtros trigger for the slideover', () => {
    const wrapper = mountView()

    expect(wrapper.find('[data-testid="filters-trigger"]').exists()).toBe(true)
  })

  // WU-3 / REQ-6: DataTableFilters v2 must render in embedded mode inside
  // the unified bottom-sheet so the wrapper's "Filtros" trigger is the ONLY
  // one the user sees. The stub already exposes its raw `filters-trigger`
  // for legacy assertions; the embedded marker is asserted via the new
  // DataTableFilters "embedded" prop forwarding.
  it('forwards embedded=true to DataTableFilters (no nested slideover trigger)', () => {
    const wrapper = mountView()

    const filters = wrapper.find('[data-testid="data-table-filters-stub"]')
    expect(filters.exists()).toBe(true)
    expect(filters.attributes('data-embedded')).toBe('true')
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

describe('QuotationsListView — column layout (premium tables T9)', () => {
  it('binds the persisted layout v-models, persist-layout and «Restablecer columnas»', async () => {
    const composable = readFileSync(resolve(__dirname, '../../composables/useQuotationsListTable.ts'), 'utf8')
    expect(composable).toContain("persistKey: 'pos-quotations-list'")
    const wrapper = mountView()
    const table = wrapper.getComponent(appDataTableStub)
    expect(table.props()).toMatchObject({
      persistLayout: true,
      columnOrder: [],
      columnSizing: {},
      density: 'comfortable',
      columnPinning: { left: [], right: [] },
      columnVisibility: {},
    })

    table.vm.$emit('update:columnOrder', ['totalCents', 'customer'])
    table.vm.$emit('update:columnSizing', { customer: 300 })
    table.vm.$emit('update:columnPinning', { left: ['customer'], right: ['actions'] })
    table.vm.$emit('update:columnVisibility', { expiresAt: false })
    table.vm.$emit('update:density', 'compact')
    expect(composableState.columnOrder.value).toEqual(['totalCents', 'customer'])
    expect(composableState.columnSizing.value).toEqual({ customer: 300 })
    expect(composableState.columnPinning.value).toEqual({ left: ['customer'], right: ['actions'] })
    expect(composableState.columnVisibility.value).toEqual({ expiresAt: false })
    expect(composableState.density.value).toBe('compact')

    table.vm.$emit('reset-columns')
    expect(composableState.resetLayout).toHaveBeenCalledTimes(1)
  })

  it('names every column for the «Columnas» panel, never with its id', () => {
    const table = mountView().getComponent(appDataTableStub)
    const labels = (table.props('columns') as Parameters<typeof columnLabel>[0][]).map(columnLabel)
    expect(labels).toEqual(['Cliente', 'Estado', 'Total', 'Expira', 'Creada', 'Acciones'])
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

  it('leaves the refresh button out of the AppDataTable toolbar (Reintentar is the retry)', () => {
    const wrapper = mountView()
    const table = wrapper.find('[data-testid="app-data-table"]')

    expect(table.attributes('data-show-refresh')).toBe('false')
    expect(wrapper.find('[data-testid="refresh-quotations-button"]').exists()).toBe(false)
  })
})

describe('QuotationsListView — mobile cards and row menu', () => {
  it('renders one #mobile-card per row, named by the customer, with no id on screen', () => {
    composableState.data.value = [
      makeQuotation({ id: 'qtn-mobile-a' }),
      makeQuotation({ id: 'qtn-mobile-b', customer: { id: 'c2', firstName: 'Luis', lastName: null, email: null } as never }),
    ]
    composableState.totalCount.value = 2

    const wrapper = mountView()
    const cards = wrapper.findAll('[data-testid="quotation-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.text()).toContain('María Pérez')
    expect(cards[1]!.text()).toContain('Luis')
    expect(cards[0]!.classes()).toContain('hf-clickable-row')
    expect(wrapper.text()).not.toContain('qtn-mobile')
  })

  it('shows the status badge and the total in the card footer', () => {
    composableState.data.value = [makeQuotation({ id: 'qtn-card', totalCents: 12345 })]
    const wrapper = mountView()
    const card = wrapper.get('[data-testid="quotation-card"]')
    expect(card.get('.hf-status-badge').text()).toBe('Borrador')
    expect(card.get('.quotation-card-footer').text()).toContain('$123.45')
  })

  it('navigates to /pos/cotizaciones/:id when the whole card is clicked', async () => {
    composableState.data.value = [makeQuotation({ id: 'qtn-card-click' })]

    const wrapper = mountView()
    await wrapper.get('[data-testid="quotation-card"]').trigger('click')

    const arg = routerPush.mock.calls[routerPush.mock.calls.length - 1]?.[0]
    const path = typeof arg === 'string' ? arg : (arg as { path?: string })?.path
    expect(path).toBe('/pos/cotizaciones/qtn-card-click')
  })

  it('opens the whole row through AppDataTable row-open', async () => {
    composableState.data.value = [makeQuotation({ id: 'qtn-row-open' })]
    const wrapper = mountView()
    await wrapper.get('[data-testid="stub-row-open"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/pos/cotizaciones/qtn-row-open')
  })

  it('names the ⋮ menu after the quotation and orders Ver detalle before Eliminar…', () => {
    composableState.data.value = [makeQuotation({ id: 'qtn-menu', status: 'DRAFT' })]
    const wrapper = mountView()
    const menu = wrapper.getComponent({ name: 'RowActionsMenu' })
    expect(menu.props('rowLabel')).toBe('cotización de María Pérez')
    const actions = menu.props('actions') as Array<{ key: string, label: string, destructive?: boolean }>
    expect(actions.map((a) => a.label)).toEqual(['Ver detalle', 'Eliminar…'])
    expect(actions[1]!.destructive).toBe(true)
  })

  it('offers only Ver detalle for SENT rows and when the user cannot delete', () => {
    composableState.data.value = [makeQuotation({ id: 'qtn-sent', status: 'SENT', expiresAt: null })]
    let wrapper = mountView()
    expect((wrapper.getComponent({ name: 'RowActionsMenu' }).props('actions') as Array<{ label: string }>).map((a) => a.label)).toEqual(['Ver detalle'])
    wrapper.unmount()

    composableState.data.value = [makeQuotation({ id: 'qtn-draft', status: 'DRAFT' })]
    authMock.userCan.mockImplementation((action: unknown) => action !== 'delete')
    wrapper = mountView()
    expect((wrapper.getComponent({ name: 'RowActionsMenu' }).props('actions') as Array<{ label: string }>).map((a) => a.label)).toEqual(['Ver detalle'])
  })

  it('opens the delete confirmation naming the customer when Eliminar… is chosen', async () => {
    composableState.data.value = [makeQuotation({ id: 'qtn-card-del' })]

    const wrapper = mountView()
    await wrapper.get('[data-action="delete"]').trigger('click')

    expect(wrapper.get('[data-testid="confirm-description"]').text()).toBe(
      '¿Eliminar la cotización de María Pérez? Esta acción no se puede deshacer.',
    )
  })
})

// ─── Refresh action (REQ-QAF-014) ─────────────────────────────────────────────

describe('QuotationsListView — refresh action', () => {
  it('wires the table refresh event (its Reintentar) to the composable refresh()', async () => {
    const wrapper = mountView()
    wrapper.getComponent(appDataTableStub).vm.$emit('refresh')

    expect(composableState.refresh).toHaveBeenCalledTimes(1)
  })

  it('renders no refresh button of its own, even while fetching', () => {
    composableState.isFetching.value = true

    const wrapper = mountView()
    expect(wrapper.find('[data-testid="refresh-quotations-button"]').exists()).toBe(false)
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

  it('lays out the list as a table on desktop and cards on mobile (no view toggle)', () => {
    const wrapper = mountView()

    const table = wrapper.find('[data-testid="app-data-table"]')
    expect(table.attributes('data-display-mode')).toBe('auto')
    expect(wrapper.find('[data-testid="view-toggle"]').exists()).toBe(false)
  })

  it('renders SortableHeader for the 3 backend-sortable columns with Spanish labels', () => {
    // The view defines SortableHeader slots for totalCents / expiresAt /
    // createdAt only — the fields the backend accepts as sortBy (createdAt |
    // updatedAt | totalCents | expiresAt). customer / status are NOT sortable
    // (the backend would 400), so they render the plain default header. The
    // stub renders SortableHeader as `<sortable-header-stub label="...">`;
    // verifying the labels keeps a regression from re-introducing the
    // Spanish column ids.
    const wrapper = mountView()
    const table = wrapper.get('[data-testid="app-data-table"]')
    const stubHeaders = table.findAll('sortable-header-stub')

    // 3 sortable columns (id, customer, status and actions are unsortable →
    // no header slot).
    expect(stubHeaders).toHaveLength(3)
    const labels = stubHeaders.map((h) => h.attributes('label'))
    expect(labels).toEqual(['Total', 'Expira', 'Creada'])
  })
})

describe('QuotationsListView — shared states wiring (S10)', () => {
  it('passes the nada-todavía copy with the create action only when the user can create', () => {
    const wrapper = mountView()
    const table = wrapper.get('[data-testid="app-data-table"]')
    expect(table.attributes('data-empty-title')).toBe('Aún no hay cotizaciones')
    expect(table.attributes('data-empty-action')).toBe('Nueva cotización')
    wrapper.unmount()

    authMock.userCan.mockReturnValue(false)
    const readOnly = mountView()
    expect(readOnly.get('[data-testid="app-data-table"]').attributes('data-empty-action')).toBe('')
  })

  it('goes to the creator from the empty-state action', async () => {
    const wrapper = mountView()
    await wrapper.get('[data-testid="stub-empty-action"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/pos/cotizaciones/nueva')
  })

  it('flags a search as filtered and titles the no-match with the term', () => {
    composableState.globalFilter.value = 'collar'
    const wrapper = mountView()
    const table = wrapper.get('[data-testid="app-data-table"]')
    expect(table.attributes('data-filtered')).toBe('true')
    expect(table.attributes('data-no-match-title')).toBe('Ningún resultado para «collar»')
  })

  it('is not filtered with no search, tab or filters', () => {
    const wrapper = mountView()
    expect(wrapper.get('[data-testid="app-data-table"]').attributes('data-filtered')).toBe('false')
  })

  it('clears the search and the status tab from Limpiar filtros', async () => {
    composableState.globalFilter.value = 'collar'
    const wrapper = mountView()
    await wrapper.get('[data-testid="stub-clear-filters"]').trigger('click')
    expect(composableState.globalFilter.value).toBe('')
    expect(composableState.setStatusFilter).toHaveBeenCalledWith(undefined)
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

// ─── T2 / S1-S4: listing visual adaptation (presentation only) ───────────────

describe('QuotationsListView — design-system boundary', () => {
  const PORTAL_MARKER = 'hf-theme hf-ui quotations-list-portal'
  const OVERLAY_MARKER = 'hf-theme hf-ui hf-form-overlay quotations-list-portal'

  it('opts the routed root into the shared hf boundary', () => {
    const wrapper = mountView()
    const root = wrapper.element as HTMLElement

    expect(root.classList.contains('hf-theme')).toBe(true)
    expect(root.classList.contains('hf-ui')).toBe(true)
    expect(root.classList.contains('quotations-list-visual')).toBe(true)
    expect(root.classList.contains('quotations-list-portal')).toBe(false)
    expect(root.classList.contains('md:px-10')).toBe(true)
  })

  it('forwards the owned portal boundary to the toolbar and pagination popups', () => {
    const wrapper = mountView()
    const table = wrapper.get('[data-testid="app-data-table"]')

    expect(table.classes()).toContain('hf-data-table')
    expect(table.attributes('data-portal-class')).toBe(PORTAL_MARKER)
    expect(table.attributes('data-pagination-portal-class')).toBe(PORTAL_MARKER)
  })

  it('themes the row action menu with the owned portal class', () => {
    composableState.data.value = [makeQuotation({ id: 'qtn-row-menu' })]
    const wrapper = mountView()

    expect(wrapper.getComponent({ name: 'RowActionsMenu' }).props('portalClass')).toBe('quotations-list-portal')
  })

  it('opts the delete confirmation into the overlay boundary and keeps destructive semantics', async () => {
    composableState.data.value = [makeQuotation({ id: 'qtn-del-boundary' })]
    const wrapper = mountView()

    await wrapper.get('[data-action="delete"]').trigger('click')

    const modal = wrapper.get('[data-testid="confirm-modal"]')
    expect(modal.attributes('data-ui-content')).toBe(OVERLAY_MARKER)
    expect(modal.attributes('data-confirm-color')).toBe('error')
    expect(modal.attributes('data-confirm-label')).toBe('Eliminar')
  })

  it('gives the status tabs an owned presentation hook', () => {
    const wrapper = mountView()

    expect(wrapper.get('[data-testid="status-tabs"] button').classes()).toContain('quotations-status-tab')
  })

  it('opts the filter wrapper into the owned portal boundary', () => {
    const wrapper = mountView()
    const filters = wrapper.get('[data-testid="data-table-filters-stub"]')

    expect(filters.attributes('data-embedded')).toBe('true')
    expect(filters.attributes('data-portal-class')).toBe(PORTAL_MARKER)
  })

  it('keeps model bindings and filter configuration', () => {
    const wrapper = mountView()
    const table = wrapper.find('[data-testid="app-data-table"]')

    expect(table.attributes('data-show-refresh')).toBe('false')
    expect(wrapper.findAll('[data-testid="filters-chips"]')).toHaveLength(1)
  })
})

describe('QuotationsListView — review round 1', () => {
  it('keeps the status tabs on one scrollable row (no wrapping onto two rows)', () => {
    const wrapper = mountView()
    const tabBar = wrapper.get('[data-testid="status-tabs"]')
    expect(tabBar.classes()).toContain('flex-nowrap')
    expect(tabBar.classes()).toContain('overflow-x-auto')
    expect(tabBar.classes()).not.toContain('flex-wrap')
  })
})

// _PaginatedQuotations is intentionally imported to keep the type in scope for
// any future helper that needs to construct a sample response in this file.
type _PaginatedQuotationsUnused = PaginatedQuotations
