import { readFileSync } from 'node:fs'
import path from 'node:path'
import { defineComponent, h, ref } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductsView from '../ProductsView.vue'
import type { Product } from '../../interfaces/product.types'

const tableMocks = vi.hoisted(() => ({ refresh: vi.fn() }))

const push = vi.fn()
const invalidateQueries = vi.fn()
const refetchQueries = vi.fn()
const setMode = vi.fn()
const userCan = vi.fn(() => true)
const viewMode = ref<'table' | 'card'>('table')

const serverData = [
  {
    id: 'prod-1',
    name: 'Alpha',
    type: 'PRODUCT',
    sku: 'ALPHA',
    barcode: null,
    categoryId: 'cat-1',
    categoryName: 'Food',
    brandId: 'brand-1',
    brandName: 'Brand',
    priceCents: 1299,
    quantity: 5,
    minQuantity: 1,
    useStock: true,
    hasVariants: false,
    useLotsAndExpirations: false,
    sellInPos: true,
    includeInOnlineCatalog: true,
    requiresPrescription: false,
    chargeProductTaxes: true,
    variantStockTotal: null,
    variantCount: null,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
] satisfies Product[]

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@tanstack/vue-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }),
  useQuery: () => ({ data: ref([]) }),
  useQueryClient: () => ({ invalidateQueries, refetchQueries }),
}))

vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: () => ({
    pagination: ref({ pageIndex: 0, pageSize: 10 }),
    sorting: ref([]),
    globalFilter: ref(''),
    rowSelection: ref({}),
    columnPinning: ref({ left: [], right: ['actions'] }),
    columnVisibility: ref({}),
    data: serverData,
    totalCount: 1,
    pageCount: 1,
    isLoading: false,
    isFetching: false,
    isError: ref(false),
    error: ref(null),
    refresh: tableMocks.refresh,
    pageSizeOptions: [10],
    showingFrom: 1,
    showingTo: 1,
  }),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
    userCan,
  }),
}))

vi.mock('../../api/product.api', () => ({
  productApi: {
    create: vi.fn(),
    createBrand: vi.fn(),
    createCategory: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getById: vi.fn(),
    getCategories: vi.fn(),
    getBrands: vi.fn(),
    getPaginated: vi.fn(),
  },
}))

vi.mock('../../composables/useProductColumns', () => ({
  useProductColumns: () => ({
    columns: [
      { id: 'select' },
      { id: 'type' },
      { accessorKey: 'name' },
      { accessorKey: 'sku' },
      { accessorKey: 'categoryName' },
      { accessorKey: 'brandName' },
      { accessorKey: 'priceCents' },
      { accessorKey: 'quantity' },
      { accessorKey: 'status' },
      { id: 'actions' },
    ],
    currencyFormatter: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
  }),
}))

vi.mock('../../composables/useProductViewMode', () => ({
  useProductViewMode: () => ({
    viewMode,
    setMode: setMode.mockImplementation((mode: 'table' | 'card') => {
      viewMode.value = mode
    }),
    toggleViewMode: vi.fn(),
  }),
  isProductViewMode: (value: string) => value === 'table' || value === 'card',
}))

const AppDataTableStub = defineComponent({
  name: 'AppDataTable',
  props: [
    'columns',
    'data',
    'displayMode',
    'columnPinning',
    'totalCount',
    'portalClass',
    'error',
    'loading',
  ],
  emits: ['add', 'refresh'],
  setup(props, { slots, emit }) {
    const row = { original: serverData[0] }
    const cell = (name: string) => slots[name]?.({ row, column: {}, table: {} })
    return () =>
      h(
        'div',
        {
          'data-testid': 'app-data-table',
          'data-display-mode': props.displayMode,
          'data-column-count': String((props.columns as unknown[]).length),
          'data-column-pinning-right': (
            (props.columnPinning as { right?: string[] } | undefined)?.right ?? []
          ).join(','),
          'data-total-count': String(props.totalCount),
          'data-portal-class': props.portalClass ?? '',
          'data-error': String(props.error ?? false),
          'data-loading': String(props.loading ?? false),
        },
        [
          h('div', { 'data-testid': 'app-data-table-filters' }, [slots.filters?.()]),
          h('div', { 'data-testid': 'app-data-table-actions' }, [slots.actions?.()]),
          // Exercise the real #type/#quantity/#status cell factories so the
          // badge presentation hooks stay observable in the test DOM.
          cell('type-cell'),
          cell('quantity-cell'),
          cell('status-cell'),
          // Exercise the real #actions-cell column factory slot so the row
          // menu presentation contract stays observable in the test DOM.
          cell('actions-cell'),
          props.displayMode === 'cards' ? slots.cards?.() : null,
          h('div', { 'data-testid': 'app-data-table-empty' }, [slots.empty?.()]),
          h('button', {
            'data-testid': 'emit-refresh',
            onClick: () => emit('refresh'),
          }),
        ],
      )
  },
})

const ViewToggleStub = defineComponent({
  name: 'ViewToggle',
  emits: ['update:model-value'],
  template: `
    <div>
      <button data-testid="toggle-card" @click="$emit('update:model-value', 'card')" />
      <button data-testid="toggle-table" @click="$emit('update:model-value', 'table')" />
    </div>
  `,
})

const ProductCardGridStub = defineComponent({
  name: 'ProductCardGrid',
  props: ['products'],
  emits: ['card-click'],
  template: `
    <div data-testid="product-card-grid">
      <span data-testid="product-card-name">{{ products[0]?.name }}</span>
      <button data-testid="emit-card-click" @click="$emit('card-click', products[0])" />
    </div>
  `,
})

const ProductsEmptyStateStub = defineComponent({
  name: 'ProductsEmptyState',
  props: ['message'],
  template: `
    <div data-testid="products-empty-state">
      <p class="products-empty-title">{{ message }}</p>
    </div>
  `,
})

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

function mountView() {
  return shallowMount(ProductsView, {
    global: {
      stubs: {
        AppDataTable: AppDataTableStub,
        ViewToggle: ViewToggleStub,
        ProductCardGrid: ProductCardGridStub,
        ProductsEmptyState: ProductsEmptyStateStub,
        UCard: {
          props: ['ui'],
          template:
            '<div data-testid="products-list-card" :data-body-class="(ui && ui.body) || \'\'"><slot name="header" /><slot /></div>',
        },
        Card: { template: '<div><slot name="header" /><slot /></div>' },
        UModal: { template: '<div />' },
        Modal: { template: '<div />' },
        UForm: { template: '<form><slot /></form>' },
        UFormField: { template: '<div><slot /></div>' },
        UInput: { template: '<input />' },
        UButton: { template: '<button><slot /></button>' },
        Button: { template: '<button><slot /></button>' },
        ConfirmModal: { template: '<div />' },
        ProductUpsertSlideover: { template: '<div />' },
        AppBadge: { template: '<span><slot /></span>' },
        // Nuxt UI components (USelect / UDropdownMenu) are globally registered,
        // so shallowMount auto-stubs them; their `ui` prop is read via
        // findComponent({ name }) in the presentation contracts below.
        TableHeaderDescription: { template: '<div />' },
        SortableHeader: true,
        SelectColumn: true,
        StatusDotBadge: { template: '<span><slot /></span>' },
        DotBadge: { template: '<span><slot /></span>' },
      },
    },
  })
}

describe('ProductsView mobile density containment (S2)', () => {
  it('route root removes the duplicate mobile outer gutter while retaining desktop padding', () => {
    const wrapper = mountView()
    const rootClasses = Array.from(wrapper.element.classList)

    // Design §1: Products replaces unconditional `px-10` with
    // `w-full min-w-0 md:px-10`; the dashboard body stays the sole
    // mobile outer gutter. Class-level contract only — jsdom never
    // proves rendered geometry.
    expect(rootClasses).toEqual(expect.arrayContaining(['w-full', 'min-w-0', 'md:px-10']))
    expect(rootClasses).not.toContain('px-10')
  })

  it('contains the list surface and inner body to the available width', () => {
    const wrapper = mountView()

    // The manual UCard stub is dropped under shallowMount (same
    // constraint as the legacy surface test below), so the surface is
    // reached by traversing from the table stub: table -> inner body ->
    // UCard stub root (fallthrough classes land on it).
    const tableEl = wrapper.get('[data-testid="app-data-table"]').element as HTMLElement
    const body = tableEl.parentElement as HTMLElement
    const surface = body.parentElement as HTMLElement

    expect(Array.from(surface.classList)).toEqual(
      expect.arrayContaining(['w-full', 'min-w-0', 'max-w-full', 'overflow-hidden', 'shadow-sm']),
    )

    const bodyClasses = Array.from(body.classList)
    expect(bodyClasses).toEqual(
      expect.arrayContaining(['w-full', 'min-w-0', 'px-3', 'py-3', 'sm:px-4', 'sm:py-4']),
    )
    expect(bodyClasses).not.toContain('px-5')
  })

  it('keeps the product type selector and table-mode pinned actions contract intact', () => {
    const wrapper = mountView()

    expect(wrapper.find('[aria-label="Filtrar por tipo"]').exists()).toBe(true)
    expect(
      wrapper.get('[data-testid="app-data-table"]').attributes('data-column-pinning-right'),
    ).toBe('actions')
  })

  it('renders the persisted card mode immediately without user interaction', () => {
    viewMode.value = 'card'
    const wrapper = mountView()

    expect(wrapper.get('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe(
      'cards',
    )
    expect(wrapper.find('[data-testid="product-card-grid"]').exists()).toBe(true)
  })

  it('keeps both display modes on the same pinned-actions and column contract', async () => {
    const wrapper = mountView()
    const table = wrapper.get('[data-testid="app-data-table"]')

    await wrapper.get('[data-testid="toggle-card"]').trigger('click')
    await wrapper.get('[data-testid="toggle-table"]').trigger('click')

    expect(table.attributes('data-column-pinning-right')).toBe('actions')
    expect(table.attributes('data-column-count')).toBe('10')
  })

  it('hides the add action for a restricted user while keeping filters and pinned actions', () => {
    userCan.mockReturnValue(false)
    const wrapper = mountView()
    const table = wrapper.get('[data-testid="app-data-table"]')

    expect(table.attributes('show-add-button')).toBe('false')
    expect(wrapper.find('[aria-label="Filtrar por tipo"]').exists()).toBe(true)
    expect(table.attributes('data-column-pinning-right')).toBe('actions')
  })

  it('keeps the route root free of horizontal-scroll classes in card mode', async () => {
    const wrapper = mountView()

    await wrapper.get('[data-testid="toggle-card"]').trigger('click')

    expect(wrapper.element.classList.contains('overflow-x-auto')).toBe(false)
  })
})

describe('ProductsView cards integration', () => {
  beforeEach(() => {
    push.mockReset()
    invalidateQueries.mockReset()
    refetchQueries.mockReset()
    setMode.mockClear()
    userCan.mockReset()
    userCan.mockReturnValue(true)
    viewMode.value = 'table'
  })

  it('switches from table to cards using the same current server-table data', async () => {
    const wrapper = mountView()
    const table = wrapper.getComponent(AppDataTableStub)

    expect(table.props('displayMode')).toBe('table')
    expect(table.props('data')).toBe(serverData)
    // product-service-type: 9 → 10 cols (select + type + name + sku +
    // categoryName + brandName + priceCents + quantity + status + actions)
    expect(table.props('columns')).toHaveLength(10)

    await wrapper.get('[data-testid="toggle-card"]').trigger('click')

    const grid = wrapper.getComponent(ProductCardGridStub)
    expect(setMode).toHaveBeenCalledWith('card')
    expect(wrapper.get('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe(
      'cards',
    )
    expect(grid.props('products')).toBe(serverData)
    expect(wrapper.get('[data-testid="product-card-name"]').text()).toBe('Alpha')
  })

  it('routes card clicks to the product detail path', async () => {
    const wrapper = mountView()

    await wrapper.get('[data-testid="toggle-card"]').trigger('click')
    await wrapper.get('[data-testid="emit-card-click"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/pos/products/prod-1')
  })

  it('keeps the 10-column table contract when switching back to table mode', async () => {
    const wrapper = mountView()

    await wrapper.get('[data-testid="toggle-card"]').trigger('click')
    await wrapper.get('[data-testid="toggle-table"]').trigger('click')

    expect(wrapper.get('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe(
      'table',
    )
    // product-service-type (R-201): 9 → 10 columns (R-201 intentional update)
    expect(wrapper.get('[data-testid="app-data-table"]').attributes('data-column-count')).toBe('10')
    expect(wrapper.find('[data-testid="product-card-grid"]').exists()).toBe(false)
  })

  it('does not force a Coco neutral background onto the table body (S4)', () => {
    // Presentation pilot: the fixed Coco body override is replaced by the
    // opt-in `.hf-table-surface` / `.hf-table-content` hooks. shallowMount
    // drops the manual UCard stub and never renders `:ui` classes, so assert
    // against the component source — this is a deterministic contract check,
    // not rendered visual proof.
    const source = readFileSync(path.resolve(__dirname, '../ProductsView.vue'), 'utf8')
    expect(source).not.toMatch(/bg-coco-neutral-/)
    expect(source).toMatch(/hf-table-surface/)
    expect(source).toMatch(/hf-table-content/)
    expect(source).toMatch(/hf-data-table/)
  })
})

describe('ProductsView presentation pilot (S1-S4)', () => {
  beforeEach(() => {
    push.mockReset()
    invalidateQueries.mockReset()
    refetchQueries.mockReset()
    setMode.mockClear()
    tableMocks.refresh.mockReset()
    userCan.mockReset()
    userCan.mockReturnValue(true)
    viewMode.value = 'table'
  })

  it('root carries the opt-in theme boundary while preserving the existing layout classes', () => {
    const wrapper = mountView()
    const rootClasses = Array.from(wrapper.element.classList)

    expect(rootClasses).toEqual(expect.arrayContaining(['hf-theme', 'hf-ui', 'products-visual']))
    expect(rootClasses).toEqual(expect.arrayContaining(['w-full', 'min-w-0', 'md:px-10']))
    // The routed view root is not a teleported portal: it keeps the inert
    // products-visual marker and never the standalone portal hook.
    expect(rootClasses).not.toContain('hf-shell-products-portal')
  })

  it('renders the exact page heading outside the table surface, with no eyebrow or counts', () => {
    const wrapper = mountView()
    const header = wrapper.get('.hf-page-header')
    const surface = wrapper.get('.hf-table-surface')

    expect(wrapper.get('.hf-page-title').text()).toBe('Productos')
    expect(wrapper.get('.hf-page-subtitle').text()).toBe(
      'Gestión de inventario y catálogo de productos',
    )
    expect(header.findAll('[class*="eyebrow"]')).toHaveLength(0)
    // The heading must not be nested inside the table panel.
    expect(surface.element.contains(header.element)).toBe(false)
  })

  it('nests the table content hook inside the table surface hook', () => {
    const wrapper = mountView()
    const surface = wrapper.get('.hf-table-surface')
    const content = wrapper.get('.hf-table-content')

    expect(surface.element.contains(content.element)).toBe(true)
    expect(Array.from(content.element.classList)).toEqual(
      expect.arrayContaining(['w-full', 'min-w-0', 'px-3', 'py-3', 'sm:px-4', 'sm:py-4']),
    )
  })

  it('puts the shared data table on the hf-data-table hook and forwards the portal boundary', () => {
    const wrapper = mountView()
    const table = wrapper.get('[data-testid="app-data-table"]')

    expect(table.classes()).toContain('hf-data-table')
    expect(table.attributes('data-portal-class')).toBe(
      'hf-theme hf-ui hf-shell-products-portal',
    )
  })

  it('scopes the type-filter and row-action portals to the theme boundary', () => {
    const wrapper = mountView()

    const typeFilter = wrapper.findComponent({ name: 'Select' })
    const rowMenu = wrapper.findComponent({ name: 'DropdownMenu' })

    expect(typeFilter.exists()).toBe(true)
    expect(typeFilter.props('ui')).toEqual({
      content: 'hf-theme hf-ui hf-shell-products-portal',
    })
    expect(rowMenu.exists()).toBe(true)
    expect(rowMenu.props('ui')).toEqual({
      content: 'hf-theme hf-ui hf-shell-products-portal',
    })
  })

  it('adds the products portal hook to every teleported portal string without touching the root', () => {
    const source = readFileSync(path.resolve(__dirname, '../ProductsView.vue'), 'utf8')
    const portalStrings = source.match(/'hf-theme hf-ui[^']*'/g) ?? []

    // Category + brand UModal, ConfirmModal, AppDataTable portal-class, the
    // type-filter USelect and the row-action UDropdownMenu.
    expect(portalStrings.length).toBeGreaterThanOrEqual(6)
    for (const portalString of portalStrings) {
      expect(portalString).toContain('hf-shell-products-portal')
    }

    // The routed view root keeps only the inert products-visual marker.
    expect(source).toMatch(/class="hf-theme hf-ui products-visual[^"]*"/)
    expect(source).not.toMatch(/class="hf-theme hf-ui products-visual[^"]*hf-shell-products-portal/)
  })

  it('preserves the table model bindings and the refresh event wiring', async () => {
    const wrapper = mountView()
    const table = wrapper.get('[data-testid="app-data-table"]')

    expect(table.attributes('data-column-count')).toBe('10')
    expect(table.attributes('data-column-pinning-right')).toBe('actions')
    expect(table.attributes('data-total-count')).toBe('1')

    await wrapper.get('[data-testid="emit-refresh"]').trigger('click')
    expect(tableMocks.refresh).toHaveBeenCalledTimes(1)
  })

  it('keeps the inline create modals and the delete confirm on the overlay theme boundary', () => {
    const source = readFileSync(path.resolve(__dirname, '../ProductsView.vue'), 'utf8')
    const overlayMatches = source.match(/hf-form-overlay/g) ?? []

    // Category + brand UModal content roots and the ConfirmModal ui payload.
    expect(overlayMatches.length).toBeGreaterThanOrEqual(3)
    // Each overlay portal also carries the standalone Products portal hook.
    const overlayPortalMatches = source.match(/hf-form-overlay hf-shell-products-portal/g) ?? []
    expect(overlayPortalMatches.length).toBe(overlayMatches.length)
    expect(source).not.toMatch(/!bg-\(--brand-action\)/)
    expect(source).not.toMatch(/rounded-xl font-semibold shadow-sm/)
  })
})

// ─── Products visual corrections (T2 / S2-S3) ────────────────────────────────
// The type filter moves intact into the shared #filters region, the toggle
// keeps its #actions slot plus an inert products-view-toggle hook, every
// Products badge call carries the inert products-badge hook, and the shared
// #empty slot forwards the new ProductsEmptyState with the primary copy.

describe('ProductsView visual corrections (T2 / S2-S3)', () => {
  beforeEach(() => {
    push.mockReset()
    setMode.mockClear()
    tableMocks.refresh.mockReset()
    userCan.mockReset()
    userCan.mockReturnValue(true)
    viewMode.value = 'table'
  })

  it('moves the intact type filter into the shared #filters region and keeps the toggle in #actions', () => {
    const wrapper = mountView()

    const filtersRegion = wrapper.get('[data-testid="app-data-table-filters"]')
    const actionsRegion = wrapper.get('[data-testid="app-data-table-actions"]')

    expect(filtersRegion.find('[aria-label="Filtrar por tipo"]').exists()).toBe(true)
    expect(actionsRegion.find('[aria-label="Filtrar por tipo"]').exists()).toBe(false)

    // The table/cards toggle stays in the actions region.
    expect(actionsRegion.find('[data-testid="toggle-card"]').exists()).toBe(true)
    expect(filtersRegion.find('[data-testid="toggle-card"]').exists()).toBe(false)
  })

  it('carries the products-view-toggle hook on the shared ViewToggle and keeps its events', async () => {
    const wrapper = mountView()

    expect(wrapper.find('.products-view-toggle').exists()).toBe(true)

    await wrapper.get('[data-testid="toggle-card"]').trigger('click')
    expect(setMode).toHaveBeenCalledWith('card')
  })

  it('marks the Products badge calls with the inert products-badge hook', () => {
    const wrapper = mountView()

    // Type (AppBadge) + stock (DotBadge) + status (StatusDotBadge).
    expect(wrapper.findAll('.products-badge').length).toBeGreaterThanOrEqual(3)
  })

  it('provides the table empty presentation through the shared #empty slot with the primary copy', () => {
    const wrapper = mountView()

    const empty = wrapper.get('[data-testid="app-data-table-empty"]')
    expect(empty.find('[data-testid="products-empty-state"]').exists()).toBe(true)
    expect(empty.get('.products-empty-title').text()).toBe('No se encontraron productos')
  })

  it('keeps the server error and loading flags bound to the shared table contract', () => {
    const wrapper = mountView()
    const table = wrapper.get('[data-testid="app-data-table"]')

    expect(table.attributes('data-error')).toBe('false')
    expect(table.attributes('data-loading')).toBe('false')
  })
})
