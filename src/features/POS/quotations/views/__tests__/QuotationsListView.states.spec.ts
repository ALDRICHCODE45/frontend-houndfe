/**
 * QuotationsListView — the four S10 states against the REAL AppDataTable.
 *
 * Only the data source (`useQuotationsListTable`), the auth store and the
 * toolbar/pagination chrome are mocked: empty, loading, data and error (plus
 * no-match) are asserted through what the shared table renders.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import QuotationsListView from '../QuotationsListView.vue'
import type { QuotationResponseDto } from '../../interfaces/quotation.types'

const isBelowBreakpoint = ref(false)

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})

const state = {
  globalFilter: ref(''),
  data: ref<QuotationResponseDto[]>([]),
  isLoading: ref(false),
  isFetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refresh: vi.fn(),
  setStatusFilter: vi.fn(),
}

vi.mock('../../composables/useQuotationsListTable', () => ({
  useQuotationsListTable: () => ({
    pagination: ref({ pageIndex: 0, pageSize: 10 }),
    sorting: ref([]),
    globalFilter: state.globalFilter,
    rowSelection: ref({}),
    columnPinning: ref({ left: [], right: [] }),
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
    setStatusFilter: state.setStatusFilter,
  }),
}))

const authMock = { userCan: vi.fn(() => true), currentTenantId: 'tenant-1' }
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

vi.mock('@/features/POS/customers/api/customer.api', () => ({
  customerApi: { getPaginated: vi.fn().mockResolvedValue({ data: [] }) },
}))

const routerPush = vi.fn()
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: routerPush, replace: vi.fn() }),
    useRoute: () => ({ query: {}, params: {}, path: '/pos/cotizaciones' }),
  }
})

function makeQuotation(id: string, status: QuotationResponseDto['status']): QuotationResponseDto {
  return {
    id,
    customerId: null,
    customer: { id: 'c1', firstName: 'María', lastName: 'Pérez', email: 'm@example.com' },
    status,
    expiresAt: '2099-09-01T00:00:00.000Z',
    totalCents: 10000,
    createdAt: '2026-08-01T00:00:00.000Z',
  } as QuotationResponseDto
}

function mountView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return mount(QuotationsListView, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar"><slot name="filters" /></div>' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
        DataTableFilters: true,
        ConfirmModal: true,
      },
    },
  })
}

beforeEach(() => {
  isBelowBreakpoint.value = false
  state.globalFilter.value = ''
  state.data.value = []
  state.isLoading.value = false
  state.isFetching.value = false
  state.isError.value = false
  state.error.value = null
  state.refresh.mockReset()
  authMock.userCan.mockReset()
  authMock.userCan.mockReturnValue(true)
})

describe('QuotationsListView states — empty', () => {
  it('shows "Aún no hay cotizaciones" with the create action when allowed', () => {
    const wrapper = mountView()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Aún no hay cotizaciones')
    expect(empty.get('button').text()).toContain('Nueva cotización')
  })

  it('drops the create action without permission', () => {
    authMock.userCan.mockReturnValue(false)
    const wrapper = mountView()
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('Aún no hay cotizaciones')
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

describe('QuotationsListView states — loading', () => {
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

describe('QuotationsListView states — data', () => {
  it('renders rows with a StatusBadge and the ⋮ menu, with no state chrome', () => {
    state.data.value = [makeQuotation('q1', 'DRAFT'), makeQuotation('q2', 'SENT')]
    const wrapper = mountView()
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.findAll('.hf-status-badge').length).toBe(2)
    expect(wrapper.findAll('[aria-label^="Acciones de cotización de María Pérez"]')).toHaveLength(2)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
  })

  it('renders one card per row on mobile', () => {
    isBelowBreakpoint.value = true
    state.data.value = [makeQuotation('q1', 'DRAFT')]
    const wrapper = mountView()
    expect(wrapper.findAll('[data-testid="quotation-card"]')).toHaveLength(1)
  })
})

describe('QuotationsListView states — error', () => {
  it('renders the table error state with Reintentar that refetches', async () => {
    state.isError.value = true
    const wrapper = mountView()
    const error = wrapper.get('[data-testid="table-error-state"]')
    expect(error.attributes('role')).toBe('alert')
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(state.refresh).toHaveBeenCalledTimes(1)
  })
})
