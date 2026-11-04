/**
 * DeliveryRoutesListView — the four S10 states against the REAL AppDataTable.
 *
 * Only the data sources (`useDeliveryRoutesTable`, `useDriverActiveRoutes`), the
 * role and the toolbar/pagination chrome are mocked: empty, loading, data and
 * error (plus no-match) are asserted through what the shared table renders, for
 * both roles.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import DeliveryRoutesListView from '../DeliveryRoutesListView.vue'
import ToolbarSelectFilter from '@/core/shared/components/DataTable/ToolbarSelectFilter.vue'
import { DELIVERY_ROUTE_COPY } from '../../copy'
import type { DeliveryRouteResponseDto } from '../../interfaces/delivery-route.types'

const isBelowBreakpoint = ref(false)

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})

const role = {
  isManager: ref(true),
  isDriver: ref(false),
  canCreate: ref(true),
  canUpdate: ref(true),
  canDelete: ref(true),
  canRead: ref(true),
}
vi.mock('../../composables/useDeliveryRouteRole', () => ({ useDeliveryRouteRole: () => role }))

const state = {
  globalFilter: ref(''),
  statusFilter: ref<string>('ALL'),
  data: ref<DeliveryRouteResponseDto[]>([]),
  isLoading: ref(false),
  isFetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refresh: vi.fn(),
}

vi.mock('../../composables/useDeliveryRoutesTable', () => ({
  useDeliveryRoutesTable: () => ({
    pagination: ref({ pageIndex: 0, pageSize: 10 }),
    sorting: ref([]),
    globalFilter: state.globalFilter,
    columnPinning: ref({ left: [], right: ['actions'] }),
    columnVisibility: ref({}),
    data: computed(() => state.data.value),
    totalCount: computed(() => state.data.value.length),
    pageCount: computed(() => (state.data.value.length ? 1 : 0)),
    isLoading: computed(() => state.isLoading.value),
    isFetching: computed(() => state.isFetching.value),
    isError: computed(() => state.isError.value),
    error: computed(() => state.error.value),
    pageSizeOptions: [10, 20, 50],
    showingFrom: computed(() => 0),
    showingTo: computed(() => 0),
    refresh: state.refresh,
    statusFilter: state.statusFilter,
    statusCounts: ref({ ALL: 0, DRAFT: 0, ACTIVE: 0, COMPLETED: 0, CANCELLED: 0 }),
  }),
}))

const driver = {
  data: ref<DeliveryRouteResponseDto[]>([]),
  isLoading: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refetch: vi.fn(),
}
vi.mock('../../composables/useDriverActiveRoutes', () => ({ useDriverActiveRoutes: () => driver }))

const authMock = { userCan: vi.fn(() => true), currentTenantId: 'tenant-1' }
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

const routerPush = vi.fn()
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: routerPush, replace: vi.fn() }),
    useRoute: () => ({ query: {}, params: {}, path: '/pos/rutas-de-entrega' }),
  }
})

function makeRoute(id: string, overrides: Partial<DeliveryRouteResponseDto> = {}): DeliveryRouteResponseDto {
  return {
    id,
    status: 'DRAFT',
    driver: { id: 'd1', name: 'Juan Pérez', email: 'j@x.mx' },
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    notes: null,
    stops: [
      {
        id: `${id}-s1`,
        saleId: 'sale-1',
        saleFolio: 'V-1',
        sortOrder: 0,
        status: 'PENDING',
        checkedInAt: null,
        completedAt: null,
        customer: { id: 'c1', name: 'Cliente Uno', email: null },
        shippingAddress: null,
      },
    ],
    timeline: [{ type: 'ROUTE_CREATED', at: '2026-10-13T15:00:00', actor: null }],
    ...overrides,
  }
}

function mountView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return mount(DeliveryRoutesListView, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar"><slot name="filters" /></div>' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
        DataTableFilters: true,
        ToolbarSelectFilter: true,
        ConfirmModal: true,
        DeliveryRouteUpsertSlideover: true,
        DriverRouteCard: { template: '<div data-testid="driver-route-card-stub" />' },
      },
    },
  })
}

beforeEach(() => {
  isBelowBreakpoint.value = false
  role.isManager.value = true
  role.isDriver.value = false
  role.canCreate.value = true
  role.canUpdate.value = true
  role.canDelete.value = true
  state.globalFilter.value = ''
  state.statusFilter.value = 'ALL'
  state.data.value = []
  state.isLoading.value = false
  state.isFetching.value = false
  state.isError.value = false
  state.error.value = null
  state.refresh.mockReset()
  driver.data.value = []
  driver.isLoading.value = false
  driver.isError.value = false
  driver.error.value = null
  driver.refetch.mockReset()
  routerPush.mockReset()
})

describe('DeliveryRoutesListView states — empty', () => {
  it('shows "Aún no hay rutas" with the create action when allowed', () => {
    const wrapper = mountView()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Aún no hay rutas')
    expect(empty.get('button').text()).toContain('Nueva ruta')
  })

  it('drops the create action without permission', () => {
    role.canCreate.value = false
    const wrapper = mountView()
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('Aún no hay rutas')
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

  it('shows no-match, not first-use, when only the Estado filter is active', async () => {
    state.statusFilter.value = 'ACTIVE'
    const wrapper = mountView()
    expect(wrapper.get('.hf-empty-state').attributes('data-kind')).toBe('no-match')
    await wrapper.get('.hf-empty-state button').trigger('click')
    expect(state.statusFilter.value).toBe('ALL')
  })
})

describe('DeliveryRoutesListView states — toolbar and layout (round 2)', () => {
  const labels = (wrapper: ReturnType<typeof mountView>) =>
    (wrapper.findComponent(ToolbarSelectFilter).props('items') as unknown as Array<{ label: string }>).map((item) => item.label)

  it.each([
    ['loading', () => { state.isLoading.value = true }],
    ['error', () => { state.isError.value = true }],
  ])('keeps counts out of the Estado options while %s (no "Todas (0)")', (_name, setup) => {
    setup()
    const wrapper = mountView()
    expect(labels(wrapper)).toEqual(['Todas', 'Borrador', 'Activa', 'Completada', 'Cancelada'])
  })

  it('shows the counts once the list loaded', () => {
    state.data.value = [makeRoute('r1')]
    const wrapper = mountView()
    expect(labels(wrapper)[0]).toBe('Todas (0)')
  })

  it('keeps the search placeholder short enough for a 390px field', () => {
    expect(DELIVERY_ROUTE_COPY.list.searchPlaceholder.length).toBeLessThanOrEqual(24)
  })

  it('uses the shared 40px page gutter on the manager root and no inner inset', () => {
    const source = readFileSync('src/features/delivery-routes/views/DeliveryRoutesListView.vue', 'utf8')
    expect(source).toMatch(/delivery-routes-visual flex w-full min-w-0 flex-col gap-6 md:px-10"/)
  })
})

describe('DeliveryRoutesListView states — loading', () => {
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

describe('DeliveryRoutesListView states — data', () => {
  it('renders rows with a StatusBadge and the ⋮ menu named after the route, with no state chrome', () => {
    state.data.value = [makeRoute('r1'), makeRoute('r2', { status: 'ACTIVE' })]
    const wrapper = mountView()
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.findAll('.hf-status-badge')).toHaveLength(2)
    expect(
      wrapper.findAll('[aria-label="Acciones de la ruta del 13 oct de Juan Pérez, borrador"]'),
    ).toHaveLength(1)
    expect(
      wrapper.findAll('[aria-label="Acciones de la ruta del 13 oct de Juan Pérez, activa"]'),
    ).toHaveLength(1)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
  })

  it('opens the detail when the row is clicked', async () => {
    state.data.value = [makeRoute('r1')]
    const wrapper = mountView()
    await wrapper.get('tbody tr').trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/pos/rutas-de-entrega/r1')
  })

  it('draws no ⋮ on a closed route, since "Ver detalle" only repeats the row click', () => {
    state.data.value = [makeRoute('r1', { status: 'COMPLETED' })]
    const wrapper = mountView()
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.find('[aria-label^="Acciones de"]').exists()).toBe(false)
  })

  it('renders one card per row on mobile, with the ⋮ and the same status badge', () => {
    isBelowBreakpoint.value = true
    state.data.value = [makeRoute('r1')]
    const wrapper = mountView()
    const cards = wrapper.findAll('[data-testid="delivery-route-card"]')
    expect(cards).toHaveLength(1)
    expect(cards[0]!.find('.hf-status-badge').exists()).toBe(true)
    expect(cards[0]!.find('[aria-label^="Acciones de la ruta"]').exists()).toBe(true)
    expect(wrapper.find('tbody').exists()).toBe(false)
  })
})

describe('DeliveryRoutesListView states — error', () => {
  it('renders the table error state with Reintentar that refetches', async () => {
    state.isError.value = true
    const wrapper = mountView()
    const error = wrapper.get('[data-testid="table-error-state"]')
    expect(error.attributes('role')).toBe('alert')
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(state.refresh).toHaveBeenCalledTimes(1)
  })

  it('renders the card error state on mobile', () => {
    isBelowBreakpoint.value = true
    state.isError.value = true
    const wrapper = mountView()
    expect(wrapper.get('[data-testid="cards-error-state"]').attributes('role')).toBe('alert')
  })
})

describe('DeliveryRoutesListView driver states', () => {
  beforeEach(() => {
    role.isManager.value = false
    role.isDriver.value = true
  })

  it('empty: names what will appear, without a create action', () => {
    const wrapper = mountView()
    const empty = wrapper.get('[data-testid="driver-list-empty"] .hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('No tienes rutas activas')
    expect(empty.find('button').exists()).toBe(false)
  })

  it('loading: card-shaped skeleton marked busy', () => {
    driver.isLoading.value = true
    const wrapper = mountView()
    const skeleton = wrapper.get('[data-testid="driver-list-loading"]')
    expect(skeleton.attributes('aria-busy')).toBe('true')
    expect(skeleton.findAll('.animate-pulse')).toHaveLength(3)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('data: one card per route and no state chrome', () => {
    driver.data.value = [makeRoute('r1', { status: 'ACTIVE' }), makeRoute('r2', { status: 'ACTIVE' })]
    const wrapper = mountView()
    expect(wrapper.findAll('[data-testid="driver-route-card-stub"]')).toHaveLength(2)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('error: the shared error state with Reintentar that refetches', async () => {
    driver.isError.value = true
    const wrapper = mountView()
    const error = wrapper.get('[data-testid="driver-list-error"] .hf-empty-state')
    expect(error.attributes('data-kind')).toBe('error')
    expect(error.attributes('role')).toBe('alert')
    await wrapper.get('[data-testid="driver-list-retry"]').trigger('click')
    expect(driver.refetch).toHaveBeenCalledTimes(1)
  })
})
