/**
 * PromotionsView — the four S10 states against the REAL AppDataTable.
 *
 * Only the data source (`useServerTable`), the auth store and the toolbar /
 * pagination chrome are mocked: empty, loading, data and error (plus no-match)
 * are asserted through what the shared table renders.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import PromotionsView from '../PromotionsView.vue'
import type { PromotionResponse } from '../../interfaces/promotion.types'

const isBelowBreakpoint = ref(false)

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})

const state = {
  globalFilter: ref(''),
  data: ref<PromotionResponse[]>([]),
  isLoading: ref(false),
  isFetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refresh: vi.fn(),
}

vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: () => ({
    pagination: ref({ pageIndex: 0, pageSize: 20 }),
    sorting: ref([]),
    globalFilter: state.globalFilter,
    rowSelection: ref({}),
    columnPinning: ref({ left: [], right: ['actions'] }),
    columnVisibility: ref({}),
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
    selectedRows: ref([]),
    clearSelection: vi.fn(),
  }),
}))

vi.mock('../../api/promotion.api', () => ({ promotionApi: {} }))

const userCanMock = vi.fn((_action: string, _subject: string) => true)
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    userCan: (action: string, subject: string) => userCanMock(action, subject),
    currentTenantId: 'tenant-1',
  }),
}))

const routerPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
  useRoute: () => ({ params: {}, query: {} }),
}))

vi.mock('@nuxt/ui/runtime/composables/useToast', () => ({ useToast: () => ({ add: vi.fn() }) }))

function makePromotion(id: string, title: string): PromotionResponse {
  return {
    id,
    title,
    botEligible: false,
    type: 'PRODUCT_DISCOUNT',
    method: 'AUTOMATIC',
    status: 'ACTIVE',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: null,
    customerScope: 'ALL',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minPurchaseAmountCents: null,
    appliesTo: 'PRODUCTS',
    buyQuantity: null,
    getQuantity: null,
    getDiscountPercent: null,
    buyTargetType: null,
    getTargetType: null,
    targetItems: [],
    customers: [],
    priceLists: [],
    daysOfWeek: [],
    maxProductUnits: null,
    consumedProductUnits: 0,
    remainingProductUnits: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function mountView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return mount(PromotionsView, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar"><slot name="filters" /></div>' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
        DataTableBulkActions: { template: '<div data-testid="bulk-actions" />' },
        PromotionTypeSelector: true,
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
  routerPush.mockReset()
  userCanMock.mockReset()
  userCanMock.mockReturnValue(true)
})

describe('PromotionsView states — empty', () => {
  it('shows "Aún no hay promociones" with the create action when allowed', async () => {
    const wrapper = mountView()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Aún no hay promociones')
    expect(empty.get('button').text()).toContain('Nueva promoción')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })

  it('drops the create action without permission', () => {
    userCanMock.mockImplementation((action: string) => action !== 'create')
    const wrapper = mountView()
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('Aún no hay promociones')
    expect(wrapper.get('.hf-empty-state').find('button').exists()).toBe(false)
  })

  it('shows no-match with Limpiar filtros when a search matched nothing, and clears it', async () => {
    state.globalFilter.value = 'zzz'
    const wrapper = mountView()
    const noMatch = wrapper.get('.hf-empty-state')
    expect(noMatch.attributes('data-kind')).toBe('no-match')
    expect(noMatch.get('.hf-empty-state__title').text()).toBe('Ningún resultado para «zzz»')
    await noMatch.get('button').trigger('click')
    expect(state.globalFilter.value).toBe('')
  })

  it('shows no-match when a filter is active', async () => {
    const wrapper = mountView()
    ;(wrapper.vm as unknown as Record<string, string>)['filterStatus'] = 'ENDED'
    await wrapper.vm.$nextTick()
    const noMatch = wrapper.get('.hf-empty-state')
    expect(noMatch.attributes('data-kind')).toBe('no-match')
    expect(noMatch.get('.hf-empty-state__title').text()).toBe('Ningún resultado')
  })
})

describe('PromotionsView states — loading', () => {
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

describe('PromotionsView states — data', () => {
  it('renders rows with a StatusBadge and the ⋮ menu, with no state chrome', () => {
    state.data.value = [makePromotion('p1', 'Oferta de verano'), makePromotion('p2', '2x1 en collares')]
    const wrapper = mountView()
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.findAll('[aria-label="Estado: Activa"]')).toHaveLength(2)
    expect(
      wrapper.findAll('[aria-label="Acciones de promoción Oferta de verano"]'),
    ).toHaveLength(1)
    expect(wrapper.text()).not.toContain('p1')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
  })

  it('renders one card per row on mobile', () => {
    isBelowBreakpoint.value = true
    state.data.value = [makePromotion('p1', 'Oferta de verano')]
    const wrapper = mountView()
    expect(wrapper.findAll('[data-testid="promotion-card"]')).toHaveLength(1)
  })
})

describe('PromotionsView states — error', () => {
  it('renders the table error state with Reintentar that refetches', async () => {
    state.isError.value = true
    const wrapper = mountView()
    const error = wrapper.get('[data-testid="table-error-state"]')
    expect(error.attributes('role')).toBe('alert')
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(state.refresh).toHaveBeenCalledTimes(1)
  })
})
