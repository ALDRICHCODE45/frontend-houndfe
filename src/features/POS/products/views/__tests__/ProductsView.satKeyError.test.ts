/**
 * ProductsView — SAT_KEY_NOT_FOUND field-error mapping test.
 *
 * The slideover path surfaces backend domain errors via the local
 * mapDomainError helper. The contract:
 *   400 + { error: 'SAT_KEY_NOT_FOUND', message }  →  formErrors.satKey
 *   400 + { error: 'INVALID_ARGUMENT', ... }        →  formErrors.price/quantity/minQuantity
 *                                                       (satKey stays empty)
 */
import { defineComponent, h, ref, nextTick } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosError } from 'axios'
import ProductsView from '../ProductsView.vue'
import type { Product } from '../../interfaces/product.types'
import type { DomainApiError } from '@/core/shared/utils/error.utils'

// ── Stubs ────────────────────────────────────────────────────────────────────

const push = vi.fn()
const invalidateQueries = vi.fn()
const refetchQueries = vi.fn()
const setMode = vi.fn()
const viewMode = ref<'table' | 'card'>('table')

const serverData = [] as Product[]

// Capture the useMutation options so we can invoke onError directly.
const capturedHandlers: { onError?: (err: unknown) => void }[] = []

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@tanstack/vue-query', () => ({
  useMutation: (opts: { onError?: (err: unknown) => void }) => {
    capturedHandlers.push(opts)
    return { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }
  },
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
    totalCount: 0,
    pageCount: 0,
    isLoading: false,
    isFetching: false,
    isError: ref(false),
    error: ref(null),
    refresh: vi.fn(),
    pageSizeOptions: [10],
    showingFrom: 0,
    showingTo: 0,
  }),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
    userCan: () => true,
  }),
}))

const productApiMock = {
  create: vi.fn(),
  createBrand: vi.fn(),
  createCategory: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  getById: vi.fn(),
  getCategories: vi.fn(),
  getBrands: vi.fn(),
  getPaginated: vi.fn(),
}
// NOTE: vi.mock factories are hoisted, so we cannot reference
// `productApiMock` directly inside the factory. We use a module-level
// vi.hoisted() to bind the mock BEFORE the import graph runs.
vi.hoisted(() => {
  // no-op; the mock object is mutated post-mount from the test.
})
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
    columns: [{ id: 'select' }, { accessorKey: 'name' }, { id: 'actions' }],
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

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

// A slideover stub that exposes the current `errors` prop via a ref,
// so the test can assert what the parent passed down.
const slideoverErrors = ref<Record<string, string> | undefined>(undefined)
const ProductUpsertSlideoverStub = defineComponent({
  name: 'ProductUpsertSlideover',
  props: ['errors', 'open', 'mode', 'product'],
  setup(props) {
    // Mirror the parent's `errors` prop into a local ref the test can read.
    return () => {
      slideoverErrors.value = (props.errors as Record<string, string>) ?? undefined
      return h('div', { 'data-testid': 'product-upsert-slideover' })
    }
  },
})

function mountView() {
  return shallowMount(ProductsView, {
    global: {
      stubs: {
        AppDataTable: { template: '<div><slot /></div>' },
        ViewToggle: { template: '<div />' },
        ProductCardGrid: { template: '<div />' },
        UCard: { template: '<div><slot name="header" /><slot /></div>' },
        UModal: { template: '<div />' },
        UForm: { template: '<form><slot /></form>' },
        UFormField: { template: '<div><slot /></div>' },
        UInput: { template: '<input />' },
        UButton: { template: '<button><slot /></button>' },
        ConfirmModal: { template: '<div />' },
        ProductUpsertSlideover: ProductUpsertSlideoverStub,
        TableHeaderDescription: { template: '<div />' },
        SortableHeader: true,
        SelectColumn: true,
        StatusDotBadge: { template: '<span><slot /></span>' },
        DotBadge: { template: '<span><slot /></span>' },
      },
    },
  })
}

function makeAxiosError(
  status: number,
  data: DomainApiError,
): AxiosError<DomainApiError> {
  const err = new Error('Request failed') as AxiosError<DomainApiError>
  err.isAxiosError = true
  err.response = {
    status,
    data,
    statusText: 'Bad Request',
    headers: {},
    config: {} as never,
  }
  return err
}

describe('ProductsView — SAT_KEY_NOT_FOUND field error mapping', () => {
  beforeEach(() => {
    capturedHandlers.length = 0
    slideoverErrors.value = undefined
  })

  it('maps a 400 + SAT_KEY_NOT_FOUND payload to formErrors.satKey (reaches the slideover)', async () => {
    mountView()

    // The create mutation is the first one registered.
    const createHandler = capturedHandlers.find((h) => h.onError)
    expect(createHandler).toBeDefined()

    const error = makeAxiosError(400, {
      error: 'SAT_KEY_NOT_FOUND',
      message: 'SAT key "00000000" is not in the catalog.',
    })
    createHandler!.onError!(error)
    await nextTick()

    expect(slideoverErrors.value).toBeDefined()
    expect(slideoverErrors.value?.satKey).toBe(
      'SAT key "00000000" is not in the catalog.',
    )
  })

  it('does NOT populate formErrors.satKey for a 400 with a different error code', async () => {
    mountView()
    const createHandler = capturedHandlers.find((h) => h.onError)
    expect(createHandler).toBeDefined()

    const error = makeAxiosError(400, {
      error: 'INVALID_ARGUMENT',
      message: 'price must be positive',
    })
    createHandler!.onError!(error)
    await nextTick()

    expect(slideoverErrors.value?.satKey ?? '').toBe('')
    expect(slideoverErrors.value?.price).toBe('price must be positive')
  })
})
