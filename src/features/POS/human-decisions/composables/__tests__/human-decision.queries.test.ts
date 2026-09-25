/**
 * HD2B — human-decision read query layer: tenant-scoped keys, the pure
 * ServerTable→list-params mapper, the list-table wiring and the lazy detail.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
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
} from '../../interfaces/human-decision.types'

vi.mock('../../api/human-decision.api', () => ({
  humanDecisionApi: { list: vi.fn(), getById: vi.fn() },
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1' }),
}))

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

/** Complete list-params fixture — query-key slots must carry the real DTO shape. */
const listParams = (overrides: Partial<HumanDecisionListParams> = {}): HumanDecisionListParams => ({
  status: 'PENDING',
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'asc',
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
      status: 'PENDING',
      page: 3,
      limit: 50,
      search: 'kibble',
      sortBy: 'createdAt',
      sortOrder: 'asc',
    })
  })

  it('defaults to limit 20, omits empty search and never emits RESOLVED or an arbitrary sort', () => {
    const mapped = mapServerTableParamsToHumanDecisionListParams({
      pageIndex: 0,
      pageSize: 20,
      sorting: [{ id: 'title', desc: true }],
      globalFilter: '',
    })

    expect(mapped).toEqual({
      status: 'PENDING',
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    })
    expect('search' in mapped).toBe(false)
    expect(JSON.stringify(mapped)).not.toContain('RESOLVED')
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

  it('calls the API with fixed PENDING params and surfaces the shared pagination untouched', async () => {
    const { result, queryClient, wrapper } = mountComposable(() => useHumanDecisionsListTable())

    await vi.waitFor(() => expect(humanDecisionApi.list).toHaveBeenCalled())
    expect(humanDecisionApi.list).toHaveBeenCalledWith({
      status: 'PENDING',
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'asc',
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
