/**
 * S10: the four list states of the sales list (empty, loading, data, error)
 * plus no-match, against the real view and the real AppDataTable. Only the
 * data sources (confirmed sales, filter options, auth, router) are mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { computed, ref } from 'vue'
import SalesListView from '../SalesListView.vue'
import type { ConfirmedSaleRow } from '../../interfaces/sale.types'

const isMobile = ref(false)

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isMobile }) }
})

vi.mock('@tanstack/vue-query', () => ({
  useQuery: vi.fn(() => ({ data: computed(() => undefined), isLoading: computed(() => false) })),
}))

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useRoute: () => ({ query: {}, path: '/pos/ventas' }),
}))

const authMock = { userCan: vi.fn((_action: string) => true), currentTenantId: 'tenant-1' }
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

const row: ConfirmedSaleRow = {
  id: 'sale-1',
  folio: 'A-202605-000012',
  status: 'CONFIRMED',
  confirmedAt: '2026-05-06T14:43:00.000Z',
  dueDate: null,
  customer: { id: 'c-1', name: 'Ada Lovelace' },
  paymentStatus: 'PARTIAL',
  totalCents: 127000,
  debtCents: 5000,
  deliveryStatus: 'PENDING',
  cashier: { id: 'cash-1', name: 'César' },
  seller: null,
  paymentMethods: [],
}

const state = {
  data: ref<ConfirmedSaleRow[]>([]),
  isLoading: ref(false),
  isFetching: ref(false),
  isError: ref(false),
  globalFilter: ref(''),
  refresh: vi.fn(),
  setTabFilter: vi.fn(),
}

vi.mock('../../composables/useConfirmedSales', () => ({
  useConfirmedSales: () => ({
    pagination: ref({ pageIndex: 0, pageSize: 20 }),
    sorting: ref([{ id: 'confirmedAt', desc: true }]),
    globalFilter: state.globalFilter,
    rowSelection: ref({}),
    columnPinning: ref({ left: [], right: [] }),
    columnVisibility: ref<Record<string, boolean>>({ paymentMethods: false, dueDate: false }),
    data: computed(() => state.data.value),
    totalCount: computed(() => state.data.value.length),
    pageCount: computed(() => (state.data.value.length ? 1 : 0)),
    isLoading: computed(() => state.isLoading.value),
    isFetching: computed(() => state.isFetching.value),
    isError: computed(() => state.isError.value),
    error: computed(() => null),
    refresh: state.refresh,
    pageSizeOptions: [10, 20, 50],
    showingFrom: computed(() => 1),
    showingTo: computed(() => state.data.value.length),
    counts: computed(() => ({ all: state.data.value.length, pendingPayments: 0, notDelivered: 0 })),
    setTabFilter: state.setTabFilter,
    filterErrors: computed(() => ({})),
  }),
}))

const mounted: VueWrapper[] = []
function mountList() {
  const wrapper = mount(SalesListView, {
    attachTo: document.body,
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar" />' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
        DataTableFilters: true,
        SalesListTabs: true,
      },
    },
  })
  mounted.push(wrapper)
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  isMobile.value = false
  authMock.userCan.mockReturnValue(true)
  state.data.value = []
  state.isLoading.value = false
  state.isFetching.value = false
  state.isError.value = false
  state.globalFilter.value = ''
})

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('SalesListView states — empty', () => {
  it('shows the "Aún no hay ventas" empty state with the create action when allowed', async () => {
    const wrapper = mountList()
    await flushPromises()

    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.text()).toContain('Aún no hay ventas')

    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/pos/ventas/nueva')
  })

  it('offers no create action without permission', async () => {
    authMock.userCan.mockImplementation((action: string) => action !== 'create')
    const wrapper = mountList()
    await flushPromises()

    expect(wrapper.get('.hf-empty-state').text()).toContain('Aún no hay ventas')
    expect(wrapper.find('[data-testid="empty-state-action"]').exists()).toBe(false)
  })
})

describe('SalesListView states — no match', () => {
  it('names the search and offers Limpiar filtros, never the first-use message', async () => {
    state.globalFilter.value = 'ada'
    const wrapper = mountList()
    await flushPromises()

    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('no-match')
    expect(empty.text()).toContain('Ninguna venta para «ada»')
    expect(empty.text()).not.toContain('Aún no hay ventas')

    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    expect(state.globalFilter.value).toBe('')
  })
})

describe('SalesListView states — loading', () => {
  it('shows the table skeleton and no rows on desktop', async () => {
    state.isLoading.value = true
    const wrapper = mountList()
    await flushPromises()

    expect(wrapper.get('[data-testid="table-skeleton"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[data-testid="sale-link-sale-1"]').exists()).toBe(false)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('shows card skeletons on mobile', async () => {
    isMobile.value = true
    state.isLoading.value = true
    const wrapper = mountList()
    await flushPromises()

    expect(wrapper.findAll('[data-testid="mobile-card-skeleton"]').length).toBeGreaterThan(0)
  })
})

describe('SalesListView states — data', () => {
  beforeEach(() => {
    state.data.value = [row]
  })

  it('renders the sale row with status badges, right-aligned money and no ⋮ menu', async () => {
    const wrapper = mountList()
    await flushPromises()

    expect(wrapper.get('[data-testid="sale-link-sale-1"]').text()).toBe('#12')
    expect(wrapper.get('[data-testid="sale-customer"]').text()).toBe('Ada Lovelace')
    expect(wrapper.get('[data-testid="sale-payment-status"]').attributes('data-tone')).toBe('warning')
    expect(wrapper.get('[data-testid="sale-delivery-status"]').attributes('data-tone')).toBe('danger')
    expect(wrapper.get('.sale-total').text()).toBe('$1,270.00')
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
    // The only possible item would be "Ver venta", which the row click already does.
    expect(wrapper.find('button[aria-haspopup="menu"]').exists()).toBe(false)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
  })

  it('keeps the rows while a background refresh runs', async () => {
    state.isFetching.value = true
    const wrapper = mountList()
    await flushPromises()

    expect(wrapper.find('[data-testid="sale-link-sale-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
  })

  it('renders sale cards on mobile', async () => {
    isMobile.value = true
    const wrapper = mountList()
    await flushPromises()

    expect(wrapper.findAll('[data-testid="sale-card"]')).toHaveLength(1)
    expect(wrapper.find('table').exists()).toBe(false)
  })
})

describe('SalesListView states — error', () => {
  it('shows the error state with Reintentar that refetches, never the empty design', async () => {
    state.isError.value = true
    const wrapper = mountList()
    await flushPromises()

    const error = wrapper.get('[data-testid="table-error-state"]')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('No se pudieron cargar las ventas')
    expect(wrapper.find('[data-kind="empty"]').exists()).toBe(false)

    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(state.refresh).toHaveBeenCalledTimes(1)
  })
})

describe('SalesListView states — forbidden', () => {
  it('shows the forbidden state when the role cannot read sales', async () => {
    authMock.userCan.mockImplementation((action: string) => action !== 'read')
    const wrapper = mountList()
    await flushPromises()

    expect(wrapper.get('.hf-empty-state').attributes('data-kind')).toBe('forbidden')
    expect(wrapper.find('table').exists()).toBe(false)
  })
})
