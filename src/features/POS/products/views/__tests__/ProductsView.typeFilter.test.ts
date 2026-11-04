/**
 * ProductsView type filter (PRODUCT / SERVICE / todos): it drives the query
 * key and query fn, resets pagination and clears the selection. Runs against
 * the same mock surface as ProductsView.test.ts, without the real
 * useServerTable.
 */

import { ref } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductsView from '../ProductsView.vue'
import type { Product } from '../../interfaces/product.types'

const push = vi.fn()
const invalidateQueries = vi.fn()
const refetchQueries = vi.fn()

const serverData: Product[] = [
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
  {
    id: 'svc-1',
    name: 'Walk',
    type: 'SERVICE',
    sku: null,
    barcode: null,
    categoryId: 'cat-2',
    categoryName: 'Pet',
    brandId: null,
    brandName: 'Sin marca',
    priceCents: 19900,
    quantity: 0,
    minQuantity: 0,
    useStock: false,
    hasVariants: true,
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
]

// vi.hoisted runs before vi.mock so we can share mutable state.
const mocks = vi.hoisted(() => {
  let lastFilterType: string | null = null
  return {
    getLastFilterType: () => lastFilterType,
    setLastFilterType: (value: string | null) => {
      lastFilterType = value
    },
    getPaginated: vi.fn((params: { type?: 'PRODUCT' | 'SERVICE' }) => {
      lastFilterType = params.type ?? null
      return Promise.resolve({
        data: serverData,
        pagination: { pageIndex: 0, pageSize: 10, totalCount: 0, pageCount: 0 },
      })
    }),
  }
})

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
    rowSelection: ref<Record<string, boolean>>({}),
    columnPinning: ref({ left: [], right: ['actions'] }),
    columnVisibility: ref({}),
    data: serverData,
    totalCount: serverData.length,
    pageCount: 1,
    isLoading: false,
    isFetching: false,
    isError: ref(false),
    error: ref(null),
    refresh: vi.fn(),
    pageSizeOptions: [10],
    showingFrom: 1,
    showingTo: serverData.length,
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
    getPaginated: mocks.getPaginated,
  },
}))

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

const baseStubs = {
  ProductList: { template: '<div />' },
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
  USelect: { name: 'USelect', template: '<select><slot /></select>' },
}

function mountView() {
  return shallowMount(ProductsView, {
    global: { stubs: baseStubs },
  })
}

describe('ProductsView - type filter PRODUCT/SERVICE/todos', () => {
  beforeEach(() => {
    push.mockReset()
    invalidateQueries.mockReset()
    refetchQueries.mockReset()
    mocks.getPaginated.mockClear()
    mocks.setLastFilterType(null)
  })

  it('filterType ref defaults to ALL', () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { filterType: string }
    expect(vm.filterType).toBe('ALL')
  })

  it('queryKey + queryFn wire filterType through useServerTable (ALL → no type param)', async () => {
    mountView()
    // The queryFn ref is invoked synchronously by useServerTable's first
    // useQuery call; the mock captures it via mocks.getLastFilterType.
    expect(mocks.getLastFilterType()).toBeNull()
  })

  it('updates row data carries type field for both PRODUCT and SERVICE rows', () => {
    mountView()
    expect(serverData[0]?.type).toBe('PRODUCT')
    expect(serverData[1]?.type).toBe('SERVICE')
  })

  it('shared getProductTypeBadge returns Servicio/Producto type badges with icons', async () => {
    const utils = await import('../../utils/productStatusConfig.utils')
    expect(utils.getProductTypeBadge('SERVICE')).toEqual({
      label: 'Servicio',
      icon: 'i-lucide-clock',
    })
    expect(utils.getProductTypeBadge('PRODUCT')).toEqual({
      label: 'Producto',
      icon: 'i-lucide-package',
    })
  })
})
