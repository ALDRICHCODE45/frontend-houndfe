/**
 * Customer pets T2 leftover (handoff 27 §4.2): a desktop row found through a pet name shows
 * «Bruno (mascota de Ana Pérez)» under the customer name, from `matchedPetName`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import CustomersView from '../CustomersView.vue'
import type { Customer } from '../../interfaces/customer.types'

const isBelowBreakpoint = ref(false)

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})

const state = {
  globalFilter: ref(''),
  pagination: ref({ pageIndex: 0, pageSize: 10 }),
  data: ref<Customer[]>([]),
  isLoading: ref(false),
  isFetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refresh: vi.fn(),
}

// customers-module T6: the filters are URL-synced (useFiltersUrlAdapter reads the route).
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ path: '/pos/customers', query: {} }),
}))

vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: () => ({
    pagination: state.pagination,
    sorting: ref([]),
    response: computed(() => undefined),
    columnPinning: ref({ left: [], right: [] }),
    columnVisibility: ref({}),
    columnOrder: ref([]),
    columnSizing: ref({}),
    density: ref('comfortable'),
    resetLayout: vi.fn(),
    globalFilter: state.globalFilter,
    data: computed(() => state.data.value),
    totalCount: computed(() => state.data.value.length),
    pageCount: computed(() => (state.data.value.length ? 1 : 0)),
    isLoading: computed(() => state.isLoading.value),
    isFetching: computed(() => state.isFetching.value),
    isError: computed(() => state.isError.value),
    error: computed(() => state.error.value),
    refresh: state.refresh,
    pageSizeOptions: [10, 20, 50],
    showingFrom: computed(() => 0),
    showingTo: computed(() => 0),
  }),
}))

const authMock = { userCan: vi.fn(() => true), currentTenantId: 'tenant-1' }
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: ref([]), isLoading: ref(false) }),
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), refetchQueries: vi.fn() }),
}))

vi.mock('../../api/customer.api', () => ({
  customerApi: { getPaginated: vi.fn(), getById: vi.fn() },
}))
vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: { getGlobalPriceLists: vi.fn().mockResolvedValue([]) },
}))

Object.assign(globalThis, { useToast: () => ({ add: vi.fn() }) })

function makeCustomer(id: string, overrides: Partial<Customer> = {}): Customer {
  return {
    id,
    firstName: 'María',
    lastName: 'Pérez',
    fullName: 'María Pérez',
    phoneCountryCode: '+52',
    phone: '5512345678',
    email: 'maria@example.com',
    globalPriceListId: null,
    globalPriceListName: 'Lista General',
    comments: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function mountView() {
  return mount(CustomersView, {
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar" />' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
        CustomerUpsertSlideover: true,
        ConfirmModal: true,
        CustomerPetsSlideover: true,
      },
    },
  })
}

beforeEach(() => {
  isBelowBreakpoint.value = false
  state.globalFilter.value = 'bruno'
  state.data.value = []
  authMock.userCan.mockReset()
  authMock.userCan.mockReturnValue(true)
})

describe('CustomersView — pet match hint (desktop)', () => {
  it('shows «Bruno (mascota de Ana Pérez)» under the name of a row matched by a pet', () => {
    state.data.value = [makeCustomer('c1', { fullName: 'Ana Pérez', matchedPetName: 'Bruno' })]
    const wrapper = mountView()
    const cell = wrapper.get('tbody tr')
    expect(cell.get('[data-testid="customer-name"]').text()).toBe('Ana Pérez')
    expect(cell.get('[data-testid="customer-pet-match"]').text()).toBe(
      'Bruno (mascota de Ana Pérez)',
    )
  })

  it.each([null, undefined])('shows no hint when matchedPetName is %s', (matchedPetName) => {
    state.data.value = [makeCustomer('c1', { matchedPetName })]
    const wrapper = mountView()
    expect(wrapper.get('tbody tr').get('[data-testid="customer-name"]').text()).toBe('María Pérez')
    expect(wrapper.find('[data-testid="customer-pet-match"]').exists()).toBe(false)
  })

  it('shows the hint for read-only roles too', () => {
    authMock.userCan.mockReturnValue(false)
    state.data.value = [makeCustomer('c1', { fullName: 'Ana Pérez', matchedPetName: 'Bruno' })]
    const wrapper = mountView()
    expect(wrapper.get('[data-testid="customer-pet-match"]').text()).toBe(
      'Bruno (mascota de Ana Pérez)',
    )
  })
})
