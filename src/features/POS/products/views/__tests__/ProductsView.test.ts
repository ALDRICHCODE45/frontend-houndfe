import { readFileSync } from 'node:fs'
import path from 'node:path'
import { defineComponent, h, ref } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductsView from '../ProductsView.vue'
import type { Product } from '../../interfaces/product.types'

const tableMocks = vi.hoisted(() => ({ refresh: vi.fn(), resetLayout: vi.fn() }))
// The layout refs the last useServerTable call returned (premium tables T9).
const layoutRefs = vi.hoisted(() => ({
  current: {} as { columnOrder?: { value: unknown }; columnSizing?: { value: unknown }; density?: { value: unknown } },
}))

// Mutable server-table state so each spec drives one of the four screen states.
const tableState = vi.hoisted(() => ({
  data: [] as unknown[],
  isLoading: false,
  isError: false,
  error: null as unknown,
  globalFilter: '',
}))

const push = vi.fn()
const invalidateQueries = vi.fn()
const refetchQueries = vi.fn()
const userCan = vi.fn((_action: string) => true)

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
  useServerTable: () => {
    layoutRefs.current = {
      columnOrder: ref([]),
      columnSizing: ref({}),
      density: ref('comfortable'),
    }
    return {
    ...layoutRefs.current,
    resetLayout: tableMocks.resetLayout,
    pagination: ref({ pageIndex: 0, pageSize: 10 }),
    sorting: ref([]),
    globalFilter: ref(tableState.globalFilter),
    rowSelection: ref({}),
    columnPinning: ref({ left: [], right: ['actions'] }),
    columnVisibility: ref({}),
    data: tableState.data,
    totalCount: tableState.data.length,
    pageCount: 1,
    isLoading: tableState.isLoading,
    isFetching: false,
    isError: tableState.isError,
    error: ref(tableState.error),
    refresh: tableMocks.refresh,
    pageSizeOptions: [10],
    showingFrom: 1,
    showingTo: 1,
    }
  },
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


// The list is stubbed: its own four states are pinned in ProductList.spec.ts.
// Here the stub exposes what the view feeds it and re-emits what it receives.
const ProductListStub = defineComponent({
  name: 'ProductList',
  props: [
    'items',
    'canRead',
    'canUpdate',
    'canDelete',
    'canCreate',
    'loading',
    'error',
    'errorMessage',
    'filtered',
    'searchTerm',
    'activeFilterCount',
    'totalCount',
    'columnPinning',
    'columnOrder',
    'columnSizing',
    'density',
    'persistLayout',
  ],
  emits: [
    'open',
    'edit',
    'delete',
    'add',
    'refresh',
    'clear-filters',
    'reset-columns',
    'update:columnOrder',
    'update:columnSizing',
    'update:density',
  ],
  setup(props, { slots, emit }) {
    return () =>
      h('div', { 'data-testid': 'product-list', class: 'hf-data-table' }, [
        h('div', { 'data-testid': 'product-list-filters' }, [slots.filters?.()]),
        h('button', { 'data-testid': 'emit-open', onClick: () => emit('open', props.items?.[0]) }),
        h('button', { 'data-testid': 'emit-refresh', onClick: () => emit('refresh') }),
        h('button', { 'data-testid': 'emit-clear', onClick: () => emit('clear-filters') }),
      ])
  },
})

const ToolbarSelectFilterStub = defineComponent({
  name: 'ToolbarSelectFilter',
  props: ['modelValue', 'items', 'label', 'portalClass', 'testId'],
  emits: ['update:modelValue'],
  template: `<select :aria-label="label" :data-testid="testId" :value="modelValue"
    @change="$emit('update:modelValue', $event.target.value)"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option></select>`,
})

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

function mountView() {
  return shallowMount(ProductsView, {
    global: {
      stubs: {
        ProductList: ProductListStub,
        ToolbarSelectFilter: ToolbarSelectFilterStub,
        UCard: { template: '<div><slot name="header" /><slot /></div>' },
        Card: { template: '<div><slot name="header" /><slot /></div>' },
        UModal: { template: '<div />' },
        UForm: { template: '<form><slot /></form>' },
        UFormField: { template: '<div><slot /></div>' },
        UInput: { template: '<input />' },
        UButton: { template: '<button><slot /></button>' },
        ConfirmModal: { template: '<div />' },
        ProductUpsertSlideover: { template: '<div />' },
      },
    },
  })
}

const list = (wrapper: ReturnType<typeof mountView>) => wrapper.getComponent(ProductListStub)
const source = () => readFileSync(path.resolve(__dirname, '../ProductsView.vue'), 'utf8')

beforeEach(() => {
  push.mockReset()
  tableMocks.refresh.mockReset()
  userCan.mockReset()
  userCan.mockReturnValue(true)
  tableState.data = serverData
  tableState.isLoading = false
  tableState.isError = false
  tableState.error = null
  tableState.globalFilter = ''
})

describe('ProductsView layout', () => {
  it('keeps the theme boundary and drops the duplicate mobile gutter', () => {
    const wrapper = mountView()
    const rootClasses = Array.from(wrapper.element.classList)

    expect(rootClasses).toEqual(
      expect.arrayContaining(['hf-theme', 'hf-ui', 'products-visual', 'w-full', 'min-w-0', 'md:px-10']),
    )
    expect(rootClasses).not.toContain('px-10')
    expect(rootClasses).not.toContain('hf-shell-products-portal')
  })

  it('renders the title alone outside the table surface: no subtitle, eyebrow or counts', () => {
    const wrapper = mountView()
    const header = wrapper.get('.hf-page-header')

    expect(wrapper.get('.hf-page-title').text()).toBe('Productos')
    expect(header.find('.hf-page-subtitle').exists()).toBe(false)
    expect(header.findAll('[class*="eyebrow"]')).toHaveLength(0)
    expect(wrapper.get('.hf-table-surface').element.contains(header.element)).toBe(false)
  })

  it('contains the list surface and body to the available width', () => {
    const wrapper = mountView()
    const surface = wrapper.get('.hf-table-surface')
    const content = wrapper.get('.hf-table-content')

    expect(surface.element.contains(content.element)).toBe(true)
    expect(Array.from(surface.element.classList)).toEqual(
      expect.arrayContaining(['w-full', 'min-w-0', 'max-w-full', 'overflow-hidden', 'shadow-sm']),
    )
    expect(Array.from(content.element.classList)).toEqual(
      expect.arrayContaining(['w-full', 'min-w-0', 'px-3', 'py-3', 'sm:px-4', 'sm:py-4']),
    )
    expect(content.element.contains(wrapper.get('[data-testid="product-list"]').element)).toBe(true)
  })

  it('has a single list layout: no view toggle, card grid or legacy badges', () => {
    const text = source()

    expect(text).not.toMatch(/ViewToggle|ProductCardGrid|useProductViewMode|ProductsEmptyState/)
    expect(text).not.toMatch(/StatusDotBadge|DotBadge|AppBadge|UDropdownMenu/)
    expect(text).not.toMatch(/bg-coco-neutral-|text-error|font-bold/)
  })

  it('scopes every teleported portal and overlay to the products theme boundary', () => {
    const text = source()
    const portalStrings = text.match(/(?:content:|portal-class=)\s*["']hf-theme hf-ui[^"']*["']/g) ?? []

    expect(portalStrings.length).toBeGreaterThanOrEqual(4)
    for (const portalString of portalStrings) {
      expect(portalString).toContain('hf-shell-products-portal')
    }
    expect(text).toMatch(/class="hf-theme hf-ui products-visual[^"]*"/)
  })
})

describe('ProductsView list wiring', () => {
  it('feeds the list the server rows, the permissions and the pinned actions', () => {
    const wrapper = mountView()

    expect(list(wrapper).props('items')).toBe(serverData)
    expect(list(wrapper).props('totalCount')).toBe(1)
    expect(list(wrapper).props('columnPinning')).toEqual({ left: [], right: ['actions'] })
    expect(list(wrapper).props()).toMatchObject({
      canRead: true,
      canUpdate: true,
      canDelete: true,
      canCreate: true,
    })
  })

  it('passes a restricted role through so the list hides create and row actions', () => {
    userCan.mockReturnValue(false)
    const wrapper = mountView()

    expect(list(wrapper).props()).toMatchObject({
      canRead: false,
      canUpdate: false,
      canDelete: false,
      canCreate: false,
    })
    expect(wrapper.find('[aria-label="Tipo"]').exists()).toBe(true)
  })

  it('opens the product details and refreshes from the list events', async () => {
    const wrapper = mountView()

    await wrapper.get('[data-testid="emit-open"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/pos/products/prod-1')

    await wrapper.get('[data-testid="emit-refresh"]').trigger('click')
    expect(tableMocks.refresh).toHaveBeenCalledTimes(1)
  })

  it('does not open the details without read permission', async () => {
    userCan.mockImplementation((action: string) => action !== 'read')
    const wrapper = mountView()

    await wrapper.get('[data-testid="emit-open"]').trigger('click')
    expect(push).not.toHaveBeenCalled()
  })
})

describe('ProductsView column layout (premium tables T9)', () => {
  it('persists the layout under pos-products and binds every layout v-model to the list', async () => {
    tableMocks.resetLayout.mockClear()
    expect(source()).toContain("persistKey: 'pos-products'")
    const wrapper = mountView()
    const stub = list(wrapper)
    expect(stub.props()).toMatchObject({
      persistLayout: true,
      columnOrder: [],
      columnSizing: {},
      density: 'comfortable',
      columnPinning: { left: [], right: ['actions'] },
    })

    stub.vm.$emit('update:columnOrder', ['brandName', 'name'])
    stub.vm.$emit('update:columnSizing', { name: 300 })
    stub.vm.$emit('update:density', 'compact')
    expect(layoutRefs.current.columnOrder?.value).toEqual(['brandName', 'name'])
    expect(layoutRefs.current.columnSizing?.value).toEqual({ name: 300 })
    expect(layoutRefs.current.density?.value).toBe('compact')

    stub.vm.$emit('reset-columns')
    expect(tableMocks.resetLayout).toHaveBeenCalledTimes(1)
  })
})

describe('ProductsView four states (S10)', () => {
  it('data: the list gets the rows and no state flags', () => {
    const props = list(mountView()).props()

    expect(props.items).toHaveLength(1)
    expect(props.loading).toBe(false)
    expect(props.error).toBe(false)
    expect(props.filtered).toBe(false)
  })

  it('empty: an empty, unfiltered list reads as "nothing yet", not as no-match', () => {
    tableState.data = []
    const props = list(mountView()).props()

    expect(props.items).toEqual([])
    expect(props.filtered).toBe(false)
    expect(props.activeFilterCount).toBe(0)
  })

  it('loading: forwards the loading flag so the list renders its skeleton', () => {
    tableState.data = []
    tableState.isLoading = true

    expect(list(mountView()).props('loading')).toBe(true)
  })

  it('error: forwards the flag with a human title, never the backend message', () => {
    tableState.data = []
    tableState.isError = true
    tableState.error = { response: { data: { message: 'Filtro inválido' } } }
    expect(list(mountView()).props()).toMatchObject({
      error: true,
      errorMessage: 'No se pudieron cargar los productos',
    })

    tableState.error = null
    expect(list(mountView()).props('errorMessage')).toBe('No se pudieron cargar los productos')
  })

  it('no-match: a search names itself in the list, and clearing resets it', async () => {
    tableState.data = []
    tableState.globalFilter = 'collar'
    const wrapper = mountView()

    expect(list(wrapper).props()).toMatchObject({ filtered: true, searchTerm: 'collar' })

    await wrapper.get('[data-testid="emit-clear"]').trigger('click')
    expect(list(wrapper).props()).toMatchObject({ filtered: false, searchTerm: '' })
  })
})

describe('ProductsView type filter', () => {
  it('lives in the list #filters region as the "Tipo" select with the portal boundary', () => {
    const wrapper = mountView()
    const region = wrapper.get('[data-testid="product-list-filters"]')
    const filter = region.getComponent(ToolbarSelectFilterStub)

    expect(filter.props('label')).toBe('Tipo')
    expect(filter.props('portalClass')).toBe('hf-theme hf-ui hf-shell-products-portal')
    expect(filter.props('items')).toEqual([
      { label: 'Todos', value: 'ALL' },
      { label: 'Producto', value: 'PRODUCT' },
      { label: 'Servicio', value: 'SERVICE' },
    ])
  })

  it('marks the list as filtered with one active filter, and "Limpiar filtros" resets it', async () => {
    tableState.data = []
    const wrapper = mountView()

    await wrapper.get('[data-testid="product-type-filter"]').setValue('SERVICE')
    expect(list(wrapper).props()).toMatchObject({ filtered: true, activeFilterCount: 1 })

    await wrapper.get('[data-testid="emit-clear"]').trigger('click')
    expect(list(wrapper).props()).toMatchObject({ filtered: false, activeFilterCount: 0 })
  })
})
