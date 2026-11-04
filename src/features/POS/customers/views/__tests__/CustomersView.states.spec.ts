/**
 * CustomersView — the four S10 states against the REAL AppDataTable.
 *
 * Only the data source (`useServerTable`), the auth store, vue-query, the
 * overlays and the toolbar/pagination chrome are mocked: empty, loading, data
 * and error (plus no-match) are asserted through what the shared table renders.
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

vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: () => ({
    pagination: state.pagination,
    sorting: ref([]),
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

vi.mock('../../api/customer.api', () => ({ customerApi: { getPaginated: vi.fn(), getById: vi.fn() } }))
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
        CustomerSalesHistorySlideover: true,
        ConfirmModal: true,
      },
    },
  })
}

beforeEach(() => {
  isBelowBreakpoint.value = false
  state.globalFilter.value = ''
  state.pagination.value = { pageIndex: 0, pageSize: 10 }
  state.data.value = []
  state.isLoading.value = false
  state.isFetching.value = false
  state.isError.value = false
  state.error.value = null
  state.refresh.mockReset()
  authMock.userCan.mockReset()
  authMock.userCan.mockReturnValue(true)
})

describe('CustomersView states — empty', () => {
  it('shows "Aún no hay clientes" with the create action when allowed', () => {
    const wrapper = mountView()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Aún no hay clientes')
    expect(empty.get('button').text()).toContain('Crear cliente')
  })

  it('opens the create form from the empty action', async () => {
    const wrapper = mountView()
    await wrapper.get('.hf-empty-state button').trigger('click')
    const create = wrapper
      .findAllComponents({ name: 'CustomerUpsertSlideover' })
      .find((slideover) => slideover.props('mode') === 'create')
    expect(create?.props('open')).toBe(true)
  })

  it('drops the create action without permission', () => {
    authMock.userCan.mockReturnValue(false)
    const wrapper = mountView()
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('Aún no hay clientes')
    expect(wrapper.get('.hf-empty-state').find('button').exists()).toBe(false)
  })

  it('shows no-match with Limpiar filtros when a search matched nothing', async () => {
    state.globalFilter.value = 'zzz'
    const wrapper = mountView()
    const noMatch = wrapper.get('.hf-empty-state')
    expect(noMatch.attributes('data-kind')).toBe('no-match')
    expect(noMatch.get('.hf-empty-state__title').text()).toBe('Ningún resultado para «zzz»')
    await noMatch.get('button').trigger('click')
    expect(state.globalFilter.value).toBe('')
  })
})

describe('CustomersView states — loading', () => {
  it('renders the table skeleton and no empty state on desktop', () => {
    state.isLoading.value = true
    const wrapper = mountView()
    expect(wrapper.get('[data-testid="table-skeleton"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('renders the card skeletons on mobile', () => {
    isBelowBreakpoint.value = true
    state.isLoading.value = true
    const wrapper = mountView()
    expect(wrapper.findAll('[data-testid="mobile-card-skeleton"]')).toHaveLength(3)
  })
})

describe('CustomersView states — data', () => {
  it('renders rows with the name first and the ⋮ menu, with no state chrome', () => {
    state.data.value = [makeCustomer('c1'), makeCustomer('c2', { fullName: 'Luis Soto' })]
    const wrapper = mountView()
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.findAll('tbody tr')[0]!.get('.hf-row-primary').text()).toBe('María Pérez')
    expect(wrapper.findAll('[aria-label="Acciones de María Pérez"]')).toHaveLength(1)
    expect(wrapper.findAll('[aria-label="Acciones de Luis Soto"]')).toHaveLength(1)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
  })

  it('renders one card per row on mobile, with the same ⋮ menu', () => {
    isBelowBreakpoint.value = true
    state.data.value = [makeCustomer('c1')]
    const wrapper = mountView()
    expect(wrapper.findAll('[data-testid="customer-card"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="customer-card"] [aria-label="Acciones de María Pérez"]').exists()).toBe(true)
  })

  it('makes rows clickable for roles that can update', () => {
    state.data.value = [makeCustomer('c1')]
    const wrapper = mountView()
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
  })

  it('does not make rows clickable for read-only roles', () => {
    authMock.userCan.mockReturnValue(false)
    state.data.value = [makeCustomer('c1')]
    const wrapper = mountView()
    expect(wrapper.get('tbody tr').classes()).not.toContain('hf-clickable-row')
  })
})

describe('CustomersView states — error', () => {
  it('renders the table error state with Reintentar that refetches', async () => {
    state.isError.value = true
    const wrapper = mountView()
    const error = wrapper.get('[data-testid="table-error-state"]')
    expect(error.attributes('role')).toBe('alert')
    expect(wrapper.find('.hf-empty-state[data-kind="empty"]').exists()).toBe(false)
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(state.refresh).toHaveBeenCalledTimes(1)
  })
})
