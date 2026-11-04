/**
 * HumanDecisionsView — the four S10 states against the REAL list panel and
 * AppDataTable.
 *
 * Only the inbox composable and the toolbar/pagination chrome are mocked:
 * empty, no-match, loading, data and error are asserted through what the shared
 * table renders.
 */
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  HumanDecision,
  HumanDecisionListFilter,
  PendingHumanDecision,
} from '../../interfaces/human-decision.types'
import { resolvedExpiration, provideExpiration } from '../../interfaces/__tests__/expirationDecision.fixture'
import { useHumanDecisionsInbox } from '../../composables/useHumanDecisionsInbox'
import HumanDecisionsView from '../HumanDecisionsView.vue'

const isBelowBreakpoint = ref(false)

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})
vi.mock('../../composables/useHumanDecisionsInbox', () => ({ useHumanDecisionsInbox: vi.fn() }))

const pending: PendingHumanDecision = {
  id: 'decision-1',
  type: 'RESTOCK',
  title: 'Solicitud de reposición',
  sanitizedSummary: 'Se requiere una decisión humana.',
  createdAt: '2026-09-25T10:00:00.000Z',
  status: 'PENDING',
  version: 1,
  resolution: null,
  allowedActions: ['PROVIDE_RESTOCK_ESTIMATE', 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE'],
  snapshot: {
    branchId: 'branch-1',
    branchName: 'Centro',
    productId: 'product-1',
    productName: 'Alimento',
    variantId: null,
    sku: 'SKU-1',
    requestedQuantity: 2,
    observedStockAtRequest: 0,
    stockObservedAt: '2026-09-25T09:55:00.000Z',
  },
}

const state = {
  data: ref<HumanDecision[]>([]),
  globalFilter: ref(''),
  statusFilter: ref<HumanDecisionListFilter>('ALL'),
  isLoading: ref(false),
  isError: ref(false),
  refresh: vi.fn(),
  setStatusFilter: vi.fn((status: HumanDecisionListFilter) => {
    state.statusFilter.value = status
  }),
}

function stubInbox() {
  vi.mocked(useHumanDecisionsInbox).mockReturnValue({
    list: {
      data: state.data,
      pagination: ref({ pageIndex: 0, pageSize: 20 }),
      globalFilter: state.globalFilter,
      statusFilter: state.statusFilter,
      setStatusFilter: state.setStatusFilter,
      totalCount: ref(state.data.value.length),
      pageCount: ref(state.data.value.length ? 1 : 0),
      isLoading: state.isLoading,
      isFetching: ref(false),
      isError: state.isError,
      pageSizeOptions: [20, 50],
      showingFrom: ref(0),
      showingTo: ref(0),
      refresh: state.refresh,
    },
    detail: { data: ref(null), isLoading: ref(false), isError: ref(false) },
    detailOpen: ref(false),
    canUpdate: ref(true),
    resolving: ref(false),
    resolutionErrorMessage: ref(null),
    resolutionConflict: ref(false),
    expirationResolving: ref(false),
    expirationErrorMessage: ref(null),
    expirationConflict: ref(false),
    expirationRequiresReauthentication: ref(false),
    openDetail: vi.fn(),
    resolveDecision: vi.fn(),
    resolveExpirationDecision: vi.fn(),
    retryDetail: vi.fn(),
  } as unknown as ReturnType<typeof useHumanDecisionsInbox>)
}

function mountView() {
  stubInbox()
  return mount(HumanDecisionsView, {
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar"><slot name="filters" /></div>' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
        HumanDecisionDetailSlideover: true,
      },
    },
  })
}

beforeEach(() => {
  isBelowBreakpoint.value = false
  state.data.value = []
  state.globalFilter.value = ''
  state.statusFilter.value = 'ALL'
  state.isLoading.value = false
  state.isError.value = false
  state.refresh.mockReset()
  state.setStatusFilter.mockClear()
})

describe('HumanDecisionsView states — empty', () => {
  it('shows "Aún no hay solicitudes" with no create action', () => {
    const wrapper = mountView()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Aún no hay solicitudes')
    expect(empty.find('button').exists()).toBe(false)
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

  it('shows no-match when only the status filter is active and resets it to Todas', async () => {
    state.statusFilter.value = 'PENDING'
    const wrapper = mountView()
    expect(wrapper.get('.hf-empty-state').attributes('data-kind')).toBe('no-match')
    await wrapper.get('.hf-empty-state button').trigger('click')
    expect(state.setStatusFilter).toHaveBeenCalledWith('ALL')
  })
})

describe('HumanDecisionsView states — loading', () => {
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

describe('HumanDecisionsView states — data', () => {
  it('renders rows with a StatusBadge and no ⋮ menu, with no state chrome', () => {
    state.data.value = [pending, resolvedExpiration(provideExpiration)]
    const wrapper = mountView()
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.findAll('.hf-status-badge').map((badge) => badge.attributes('data-tone'))).toEqual([
      'warning',
      'success',
    ])
    expect(wrapper.findAll('button[aria-haspopup="menu"]')).toHaveLength(0)
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
  })

  it('renders one card per row on mobile, pending and answered', () => {
    isBelowBreakpoint.value = true
    state.data.value = [pending, resolvedExpiration(provideExpiration)]
    const wrapper = mountView()
    expect(wrapper.findAll('[data-testid="human-decision-card"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="resolved-human-decision-card"]')).toHaveLength(1)
  })
})

describe('HumanDecisionsView states — error', () => {
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
