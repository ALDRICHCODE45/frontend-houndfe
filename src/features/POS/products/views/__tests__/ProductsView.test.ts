import { defineComponent, h, ref } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductsView from '../ProductsView.vue'
import type { Product } from '../../interfaces/product.types'

const push = vi.fn()
const invalidateQueries = vi.fn()
const refetchQueries = vi.fn()
const setMode = vi.fn()
const viewMode = ref<'table' | 'card'>('table')

const serverData = [
  {
    id: 'prod-1',
    name: 'Alpha',
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
    refresh: vi.fn(),
    pageSizeOptions: [10],
    showingFrom: 1,
    showingTo: 1,
  }),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
    userCan: () => true,
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
  props: ['columns', 'data', 'displayMode'],
  setup(props, { slots }) {
    return () =>
      h('div', {
        'data-testid': 'app-data-table',
        'data-display-mode': props.displayMode,
        'data-column-count': String((props.columns as unknown[]).length),
      }, [
        slots.actions?.(),
        props.displayMode === 'cards' ? slots.cards?.() : null,
      ])
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

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

function mountView() {
  return shallowMount(ProductsView, {
    global: {
      stubs: {
        AppDataTable: AppDataTableStub,
        ViewToggle: ViewToggleStub,
        ProductCardGrid: ProductCardGridStub,
        UCard: { template: '<div><slot name="header" /><slot /></div>' },
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
        TableHeaderDescription: { template: '<div />' },
        SortableHeader: true,
        SelectColumn: true,
        StatusDotBadge: { template: '<span><slot /></span>' },
        DotBadge: { template: '<span><slot /></span>' },
      },
    },
  })
}

describe('ProductsView cards integration', () => {
  beforeEach(() => {
    push.mockReset()
    invalidateQueries.mockReset()
    refetchQueries.mockReset()
    setMode.mockClear()
    viewMode.value = 'table'
  })

  it('switches from table to cards using the same current server-table data', async () => {
    const wrapper = mountView()
    const table = wrapper.getComponent(AppDataTableStub)

    expect(table.props('displayMode')).toBe('table')
    expect(table.props('data')).toBe(serverData)
    expect(table.props('columns')).toHaveLength(9)

    await wrapper.get('[data-testid="toggle-card"]').trigger('click')

    const grid = wrapper.getComponent(ProductCardGridStub)
    expect(setMode).toHaveBeenCalledWith('card')
    expect(wrapper.get('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe('cards')
    expect(grid.props('products')).toBe(serverData)
    expect(wrapper.get('[data-testid="product-card-name"]').text()).toBe('Alpha')
  })

  it('routes card clicks to the product detail path', async () => {
    const wrapper = mountView()

    await wrapper.get('[data-testid="toggle-card"]').trigger('click')
    await wrapper.get('[data-testid="emit-card-click"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/pos/products/prod-1')
  })

  it('keeps the 9-column table contract when switching back to table mode', async () => {
    const wrapper = mountView()

    await wrapper.get('[data-testid="toggle-card"]').trigger('click')
    await wrapper.get('[data-testid="toggle-table"]').trigger('click')

    expect(wrapper.get('[data-testid="app-data-table"]').attributes('data-display-mode')).toBe('table')
    expect(wrapper.get('[data-testid="app-data-table"]').attributes('data-column-count')).toBe('9')
    expect(wrapper.find('[data-testid="product-card-grid"]').exists()).toBe(false)
  })
})
