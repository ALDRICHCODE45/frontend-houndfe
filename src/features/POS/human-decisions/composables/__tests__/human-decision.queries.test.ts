/**
 * HD2B — human-decision read query layer: tenant-scoped keys, the pure
 * ServerTable→list-params mapper, the list-table wiring and the lazy detail.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { defineComponent, h, reactive, ref } from 'vue'
import { humanDecisionQueryKeys } from '@/core/shared/constants/query-keys'
import {
  mapServerTableParamsToHumanDecisionListParams,
  useHumanDecisionsListTable,
} from '../useHumanDecisionsListTable'
import { useHumanDecisionDetail } from '../useHumanDecisionDetail'
import { humanDecisionApi } from '../../api/human-decision.api'
import type {
  HumanDecisionListParams,
  PendingHumanDecision,
  ResolvedHumanDecision,
} from '../../interfaces/human-decision.types'

vi.mock('../../api/human-decision.api', () => ({
  humanDecisionApi: { list: vi.fn(), getById: vi.fn() },
}))

const auth = reactive({ currentTenantId: 'tenant-1' })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
beforeEach(() => {
  auth.currentTenantId = 'tenant-1'
})

const pending: PendingHumanDecision = {
  id: 'hd-1',
  type: 'RESTOCK',
  title: 'Reposición solicitada',
  sanitizedSummary: 'Kibble 15kg',
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'PENDING',
  version: 1,
  resolution: null,
  allowedActions: [],
  snapshot: {
    branchId: 'branch-1',
    branchName: null,
    productId: 'product-1',
    productName: 'Kibble 15kg',
    variantId: null,
    sku: 'KIB-15',
    requestedQuantity: 2,
    observedStockAtRequest: 0,
    stockObservedAt: '2026-01-01T00:00:00.000Z',
  },
}

const page = {
  data: [pending],
  pagination: { pageIndex: 2, pageSize: 20, totalCount: 41, pageCount: 3 },
}

const listParams = (
  overrides: { page?: number; search?: string } = {},
): HumanDecisionListParams => ({
  status: 'ALL',
  page: 1,
  limit: 20,
  ...overrides,
})

function mountComposable<T>(composable: () => T) {
  let result: T | undefined
  const TestComponent = defineComponent({
    setup() {
      result = composable()
      return () => h('div')
    },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = mount(TestComponent, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { result: result!, queryClient, wrapper }
}

describe('HD2B · humanDecisionQueryKeys', () => {
  it('isolates tenants and keeps the list/detail slots separate', () => {
    const listA = humanDecisionQueryKeys.list('tenant-a', listParams({ page: 1 }))
    const listB = humanDecisionQueryKeys.list('tenant-b', listParams({ page: 1 }))

    expect(humanDecisionQueryKeys.all('tenant-a')).toEqual(['human-decisions', 'tenant-a'])
    expect(listA).not.toEqual(listB)
    expect(listA.slice(0, 3)).toEqual(['human-decisions', 'tenant-a', 'list'])
    expect(humanDecisionQueryKeys.detail('tenant-a', 'hd-1')).toEqual([
      'human-decisions',
      'tenant-a',
      'detail',
      'hd-1',
    ])
  })

  it('prefix-matches every list page/search slot but never the detail slot', () => {
    const prefix = humanDecisionQueryKeys.listPrefix('tenant-a')
    const slots = [
      humanDecisionQueryKeys.list('tenant-a', listParams({ page: 1 })),
      humanDecisionQueryKeys.list('tenant-a', listParams({ page: 2, search: 'kibble' })),
    ]

    for (const slot of slots) expect(slot.slice(0, 3)).toEqual([...prefix])
    expect(humanDecisionQueryKeys.detail('tenant-a', 'hd-1').slice(0, 3)).not.toEqual([...prefix])
  })
})

describe('HD2B · mapServerTableParamsToHumanDecisionListParams', () => {
  it('maps zero-based page to one-based and keeps limit 50 when selected', () => {
    expect(
      mapServerTableParamsToHumanDecisionListParams({
        pageIndex: 2,
        pageSize: 50,
        globalFilter: 'kibble',
        sorting: [{ id: 'createdAt', desc: false }],
      }),
    ).toEqual({
      status: 'ALL',
      page: 3,
      limit: 50,
      search: 'kibble',
    })
  })

  it('defaults to ALL and limit 20, omitting empty search and both sort fields', () => {
    const mapped = mapServerTableParamsToHumanDecisionListParams({
      pageIndex: 0,
      pageSize: 20,
      sorting: [{ id: 'title', desc: true }],
      globalFilter: '',
    })

    expect(mapped).toEqual({ status: 'ALL', page: 1, limit: 20 })
    expect('search' in mapped).toBe(false)
    expect(JSON.stringify(mapped)).not.toContain('RESOLVED')
  })

  it.each([
    ['PENDING', 'createdAt', 'asc'],
    ['RESOLVED', 'resolvedAt', 'desc'],
  ] as const)('preserves the %s single-state contract', (status, sortBy, sortOrder) => {
    expect(
      mapServerTableParamsToHumanDecisionListParams({ pageIndex: 2, pageSize: 50 }, status),
    ).toEqual({ status, page: 3, limit: 50, sortBy, sortOrder })
  })

  it('normalizes Unicode and clamps unsupported page sizes for resolved requests', () => {
    expect(
      mapServerTableParamsToHumanDecisionListParams(
        {
          pageIndex: 2,
          pageSize: 10,
          globalFilter: '  cafe\u0301   alimento ',
          sorting: [{ id: 'title', desc: false }],
        },
        'RESOLVED',
      ),
    ).toEqual({
      status: 'RESOLVED',
      page: 3,
      limit: 20,
      search: 'café alimento',
      sortBy: 'resolvedAt',
      sortOrder: 'desc',
    })
  })

  it('normalizes search whitespace and omits an explicit blank', () => {
    const base = { pageIndex: 0, pageSize: 20, sorting: [] }
    expect(
      mapServerTableParamsToHumanDecisionListParams({
        ...base,
        globalFilter: '  alimento   premium  ',
      }).search,
    ).toBe('alimento premium')
    expect(
      mapServerTableParamsToHumanDecisionListParams({ ...base, globalFilter: '   ' }),
    ).not.toHaveProperty('search')
  })
})

describe('HD2B · useHumanDecisionsListTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(humanDecisionApi.list).mockResolvedValue(page)
  })

  it('calls one ALL request without sorting and surfaces server pagination untouched', async () => {
    const { result, queryClient, wrapper } = mountComposable(() => useHumanDecisionsListTable())

    await vi.waitFor(() => expect(humanDecisionApi.list).toHaveBeenCalled())
    expect(humanDecisionApi.list).toHaveBeenCalledExactlyOnceWith({
      status: 'ALL',
      page: 1,
      limit: 20,
    })
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => [...query.queryKey]),
    ).toContainEqual(expect.arrayContaining(['human-decisions', 'tenant-1', 'list']))

    await vi.waitFor(() => expect(result.data.value).toEqual([pending]))
    expect(result.totalCount.value).toBe(41)
    expect(result.pageCount.value).toBe(3)
    expect(result.pageSizeOptions).toEqual([20, 50])
    wrapper.unmount()
  })
})

describe('unified filter state', () => {
  it('isolates tenant/page/search keys and refreshes the selected status on demand', async () => {
    vi.mocked(humanDecisionApi.list).mockClear().mockResolvedValue(page)
    const { result, queryClient, wrapper } = mountComposable(useHumanDecisionsListTable)
    queryClient.setQueryDefaults(humanDecisionQueryKeys.listPrefix('tenant-1'), {
      gcTime: Infinity,
    })
    result.setStatusFilter('RESOLVED')
    await vi.waitFor(() => expect(result.totalCount.value).toBe(41))
    result.pagination.value = { pageIndex: 1, pageSize: 50 }
    await vi.waitFor(() =>
      expect(humanDecisionApi.list).toHaveBeenLastCalledWith({
        status: 'RESOLVED',
        page: 2,
        limit: 50,
        sortBy: 'resolvedAt',
        sortOrder: 'desc',
      }),
    )
    result.globalFilter.value = ' alimento '
    await vi.waitFor(() =>
      expect(humanDecisionApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'RESOLVED', page: 1, search: 'alimento' }),
      ),
    )
    const calls = vi.mocked(humanDecisionApi.list).mock.calls.length
    result.refresh()
    await vi.waitFor(() => expect(humanDecisionApi.list).toHaveBeenCalledTimes(calls + 1))
    auth.currentTenantId = 'tenant-2'
    await vi.waitFor(() =>
      expect(
        queryClient
          .getQueryCache()
          .findAll({ queryKey: humanDecisionQueryKeys.filteredListPrefix('tenant-2', 'RESOLVED') }),
      ).toHaveLength(1),
    )
    expect(
      queryClient
        .getQueryCache()
        .findAll({ queryKey: humanDecisionQueryKeys.filteredListPrefix('tenant-1', 'RESOLVED') })
        .length,
    ).toBeGreaterThan(1)
    wrapper.unmount()
    queryClient.clear()
  })
  it('resets page before fetching a new status and isolates all filters below the invalidation prefix', async () => {
    vi.mocked(humanDecisionApi.list).mockClear().mockResolvedValue(page)
    const { result, queryClient, wrapper } = mountComposable(useHumanDecisionsListTable)
    queryClient.setQueryDefaults(humanDecisionQueryKeys.listPrefix('tenant-1'), {
      gcTime: Infinity,
    })
    await vi.waitFor(() => expect(result.data.value).toEqual([pending]))
    result.pagination.value = { pageIndex: 2, pageSize: 50 }
    await vi.waitFor(() =>
      expect(humanDecisionApi.list).toHaveBeenLastCalledWith({ status: 'ALL', page: 3, limit: 50 }),
    )
    for (const status of ['RESOLVED', 'PENDING', 'ALL'] as const) {
      result.setStatusFilter(status)
      expect(result.pagination.value.pageIndex).toBe(0)
      await vi.waitFor(() =>
        expect(humanDecisionApi.list).toHaveBeenLastCalledWith(
          expect.objectContaining({ status, page: 1, limit: 50 }),
        ),
      )
    }
    expect(
      vi
        .mocked(humanDecisionApi.list)
        .mock.calls.some(([params]) => params.status !== 'ALL' && params.page === 3),
    ).toBe(false)
    const keys = queryClient
      .getQueryCache()
      .findAll({ queryKey: humanDecisionQueryKeys.listPrefix('tenant-1') })
      .map((query) => query.queryKey)
    for (const status of ['ALL', 'PENDING', 'RESOLVED'])
      expect(keys.some((key) => key[3] === status)).toBe(true)
    await queryClient.invalidateQueries({
      queryKey: humanDecisionQueryKeys.listPrefix('tenant-1'),
      refetchType: 'none',
    })
    expect(
      queryClient
        .getQueryCache()
        .findAll({ queryKey: humanDecisionQueryKeys.listPrefix('tenant-1') })
        .every((query) => query.state.isInvalidated),
    ).toBe(true)
    wrapper.unmount()
  })

  it('preserves mixed rows, response metadata, server ordering and the single total without a client cutoff', async () => {
    const resolved: ResolvedHumanDecision = {
      ...pending,
      id: 'resolved',
      status: 'RESOLVED',
      version: 2,
      allowedActions: [],
      resolution: {
        action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
        resolvedAt: '2000-01-01T00:00:00Z',
        resolvedBy: { id: 'reviewer', displayName: 'Ana' },
      },
    }
    const rows = [resolved, pending]
    vi.mocked(humanDecisionApi.list).mockResolvedValue({ ...page, data: rows })
    const { result, wrapper } = mountComposable(useHumanDecisionsListTable)
    await vi.waitFor(() => expect(result.data.value).toEqual(rows))
    expect(result.totalCount.value).toBe(41)
    expect(result.pageCount.value).toBe(3)
    wrapper.unmount()
  })
})

describe('HD2B · useHumanDecisionDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(humanDecisionApi.getById).mockResolvedValue(pending)
  })

  it('stays disabled while the id is null, then fetches once it is set', async () => {
    const id = ref<string | null>(null)
    const { result, queryClient, wrapper } = mountComposable(() => useHumanDecisionDetail(id))

    await vi.waitFor(() => expect(result.fetchStatus.value).toBe('idle'))
    expect(humanDecisionApi.getById).not.toHaveBeenCalled()

    id.value = 'hd-1'
    await vi.waitFor(() => expect(humanDecisionApi.getById).toHaveBeenCalledWith('hd-1'))
    await vi.waitFor(() => expect(result.data.value).toEqual(pending))
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => [...query.queryKey]),
    ).toContainEqual(['human-decisions', 'tenant-1', 'detail', 'hd-1'])
    wrapper.unmount()
  })
})
