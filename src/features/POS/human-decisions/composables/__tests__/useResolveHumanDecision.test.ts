import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin, useQuery } from '@tanstack/vue-query'
import { defineComponent, h, nextTick } from 'vue'
import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import {
  useHumanDecisionsListTable,
  mapServerTableParamsToHumanDecisionListParams,
} from '../useHumanDecisionsListTable'
import { mount } from '@vue/test-utils'
import type { AxiosError } from 'axios'
import { humanDecisionQueryKeys } from '@/core/shared/constants/query-keys'
import { humanDecisionApi } from '../../api/human-decision.api'
import type {
  HumanDecision,
  HumanDecisionListFilter,
  HumanDecisionListParams,
  HumanDecisionErrorResponse,
  ResolvedHumanDecision,
} from '../../interfaces/human-decision.types'
import {
  createHumanDecisionResolutionAttempt,
  type HumanDecisionResolutionAttempt,
} from '../../utils/humanDecisionResolutionAttempt'
import { useResolveHumanDecision } from '../useResolveHumanDecision'

vi.mock('../../api/human-decision.api', () => ({
  humanDecisionApi: { resolve: vi.fn(), list: vi.fn() },
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1' }),
}))

const resolved: ResolvedHumanDecision = {
  id: 'decision-1',
  type: 'RESTOCK',
  title: 'Solicitud de reposición',
  sanitizedSummary: 'Se solicitó una estimación.',
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'RESOLVED',
  version: 2,
  allowedActions: [],
  resolution: {
    action: 'PROVIDE_RESTOCK_ESTIMATE',
    restockDays: 3,
    resolvedAt: '2026-01-01T01:00:00.000Z',
    resolvedBy: { id: 'user-1', displayName: 'Ana' },
  },
  snapshot: {
    branchId: 'branch-1',
    branchName: 'Centro',
    productId: 'product-1',
    productName: 'Alimento',
    variantId: null,
    sku: null,
    requestedQuantity: 2,
    observedStockAtRequest: null,
    stockObservedAt: null,
  },
}

function mountMutation(queryClient = new QueryClient()) {
  let result!: ReturnType<typeof useResolveHumanDecision>
  const Host = defineComponent({
    setup() {
      result = useResolveHumanDecision()
      return () => h('div')
    },
  })
  const wrapper = mount(Host, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { result, queryClient, wrapper }
}

function conflict(
  code: 'VERSION_CONFLICT' | 'ALREADY_RESOLVED' | 'IDEMPOTENCY_CONFLICT',
): AxiosError<HumanDecisionErrorResponse> {
  return {
    response: {
      status: 409,
      data: { statusCode: 409, code, message: 'Conflict' },
    },
  } as AxiosError<HumanDecisionErrorResponse>
}

describe('createHumanDecisionResolutionAttempt', () => {
  it('creates one positive UUID identity and exact CAS payload', () => {
    const generateId = vi.fn(() => '89c0c4de-6e6d-4e7a-8e17-8dcdca83b197')
    const attempt = createHumanDecisionResolutionAttempt(
      'decision-1',
      { action: 'PROVIDE_RESTOCK_ESTIMATE', restockDays: 3, expectedVersion: 1 },
      generateId,
    )
    expect(generateId).toHaveBeenCalledTimes(1)
    expect(attempt).toEqual({
      decisionId: 'decision-1',
      payload: {
        action: 'PROVIDE_RESTOCK_ESTIMATE',
        restockDays: 3,
        expectedVersion: 1,
        resolutionRequestId: '89c0c4de-6e6d-4e7a-8e17-8dcdca83b197',
      },
    })
  })

  it('omits restockDays from the negative attempt', () => {
    const attempt = createHumanDecisionResolutionAttempt(
      'decision-1',
      { action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE', expectedVersion: 1 },
      () => '7d4101dd-c50e-43e6-8ff8-9b4229b912f0',
    )
    expect(attempt.payload).toEqual({
      action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
      expectedVersion: 1,
      resolutionRequestId: '7d4101dd-c50e-43e6-8ff8-9b4229b912f0',
    })
    expect(attempt.payload).not.toHaveProperty('restockDays')
  })
})

describe('useResolveHumanDecision', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not update optimistically, then stores server detail and invalidates stable keys', async () => {
    let finish!: (value: ResolvedHumanDecision) => void
    vi.mocked(humanDecisionApi.resolve).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { result, queryClient, wrapper } = mountMutation()
    const setQueryData = vi.spyOn(queryClient, 'setQueryData')
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const attempt = createHumanDecisionResolutionAttempt(
      'decision-1',
      { action: 'PROVIDE_RESTOCK_ESTIMATE', restockDays: 3, expectedVersion: 1 },
      () => '89c0c4de-6e6d-4e7a-8e17-8dcdca83b197',
    )

    const request = result.mutateAsync(attempt)
    expect(setQueryData).not.toHaveBeenCalled()
    finish(resolved)
    await expect(request).resolves.toBe(resolved)

    expect(humanDecisionApi.resolve).toHaveBeenCalledWith('decision-1', attempt.payload)
    expect(setQueryData).toHaveBeenCalledWith(
      humanDecisionQueryKeys.detail('tenant-1', 'decision-1'),
      resolved,
    )
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: humanDecisionQueryKeys.listPrefix('tenant-1'),
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: humanDecisionQueryKeys.detail('tenant-1', 'decision-1'),
    })
    wrapper.unmount()
  })

  it.each(['VERSION_CONFLICT', 'ALREADY_RESOLVED'] as const)(
    'refetches list and detail on %s and keeps the attempt reusable',
    async (code) => {
      const attempt: HumanDecisionResolutionAttempt = createHumanDecisionResolutionAttempt(
        'decision-1',
        { action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE', expectedVersion: 1 },
        () => '7d4101dd-c50e-43e6-8ff8-9b4229b912f0',
      )
      vi.mocked(humanDecisionApi.resolve).mockRejectedValue(conflict(code))
      const { result, queryClient, wrapper } = mountMutation()
      const refetch = vi.spyOn(queryClient, 'refetchQueries')

      await expect(result.mutateAsync(attempt)).rejects.toBeDefined()
      expect(refetch).toHaveBeenCalledWith({
        queryKey: humanDecisionQueryKeys.listPrefix('tenant-1'),
      })
      expect(refetch).toHaveBeenCalledWith({
        queryKey: humanDecisionQueryKeys.detail('tenant-1', 'decision-1'),
      })
      expect(attempt.payload.resolutionRequestId).toBe('7d4101dd-c50e-43e6-8ff8-9b4229b912f0')
      wrapper.unmount()
    },
  )

  it.each(['success', 'VERSION_CONFLICT', 'ALREADY_RESOLVED'] as const)(
    'refreshes every live status filter for %s without optimistic insertion or another tenant refresh',
    async (outcome) => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
      const pendingPage = vi.fn().mockResolvedValue({ data: [] })
      const recentPage = vi.fn().mockResolvedValue({ data: [resolved] })
      const mixedPage = vi.fn().mockResolvedValue({ data: [resolved] })
      const otherTenant = vi.fn().mockResolvedValue({ data: [] })
      let mutation!: ReturnType<typeof useResolveHumanDecision>
      const wrapper = mount(
        defineComponent({
          setup() {
            useQuery({
              queryKey: [
                ...humanDecisionQueryKeys.filteredListPrefix('tenant-1', 'PENDING'),
                { page: 1 },
              ],
              queryFn: pendingPage,
            })
            useQuery({
              queryKey: [
                ...humanDecisionQueryKeys.filteredListPrefix('tenant-1', 'RESOLVED'),
                { page: 1 },
              ],
              queryFn: recentPage,
            })
            useQuery({
              queryKey: [
                ...humanDecisionQueryKeys.filteredListPrefix('tenant-2', 'ALL'),
                { page: 1 },
              ],
              queryFn: otherTenant,
            })
            useQuery({
              queryKey: [
                ...humanDecisionQueryKeys.filteredListPrefix('tenant-1', 'ALL'),
                { page: 2, search: 'alimento' },
              ],
              queryFn: mixedPage,
            })
            mutation = useResolveHumanDecision()
            return () => h('div')
          },
        }),
        { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
      )
      await vi.waitFor(() => expect(recentPage).toHaveBeenCalledTimes(1))
      const write = vi.spyOn(client, 'setQueryData')
      let finish!: () => void
      vi.mocked(humanDecisionApi.resolve).mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            finish = () => (outcome === 'success' ? resolve(resolved) : reject(conflict(outcome)))
          }),
      )
      const attempt = createHumanDecisionResolutionAttempt('decision-1', {
        action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
        expectedVersion: 1,
      })
      const request = mutation.mutateAsync(attempt).catch(() => undefined)
      await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
      expect(write).not.toHaveBeenCalled()
      expect(recentPage).toHaveBeenCalledTimes(1)
      finish()
      await request
      await vi.waitFor(() => {
        expect(pendingPage).toHaveBeenCalledTimes(2)
        expect(recentPage).toHaveBeenCalledTimes(2)
        expect(mixedPage).toHaveBeenCalledTimes(2)
      })
      expect(otherTenant).toHaveBeenCalledTimes(1)
      expect(write.mock.calls.every(([key]) => Array.isArray(key) && key[2] === 'detail')).toBe(
        true,
      )
      wrapper.unmount()
      client.clear()
    },
  )

  it.each(['VERSION_CONFLICT', 'ALREADY_RESOLVED'] as const)(
    'keeps visited filter/page/search caches bound to their own requests after %s',
    async (code) => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
      })
      let generation = 0
      const responseFor = (params: HumanDecisionListParams): PaginatedResponse<HumanDecision> => {
        const row: HumanDecision =
          params.status === 'RESOLVED'
            ? resolved
            : {
                ...resolved,
                status: 'PENDING',
                version: 1,
                resolution: null,
                allowedActions: ['PROVIDE_RESTOCK_ESTIMATE', 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE'],
              }
        return {
          data: [
            {
              ...row,
              id: JSON.stringify({
                status: params.status,
                page: params.page,
                limit: params.limit,
                search: params.search,
                sortBy: params.sortBy,
                sortOrder: params.sortOrder,
                generation,
              }),
            },
          ],
          pagination: {
            pageIndex: params.page - 1,
            pageSize: params.limit,
            totalCount: 200,
            pageCount: 10,
          },
        }
      }
      vi.mocked(humanDecisionApi.list).mockImplementation(async (params) => responseFor(params))
      let table!: ReturnType<typeof useHumanDecisionsListTable>
      let mutation!: ReturnType<typeof useResolveHumanDecision>
      const wrapper = mount(
        defineComponent({
          setup() {
            table = useHumanDecisionsListTable()
            mutation = useResolveHumanDecision()
            return () => h('div')
          },
        }),
        { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
      )
      try {
        await vi.waitFor(() => expect(table.data.value).toHaveLength(1))
        for (const [status, search, pageIndex] of [
          ['ALL', 'food', 1],
          ['PENDING', 'seed', 2],
          ['RESOLVED', 'hay', 3],
        ] as const) {
          table.setStatusFilter(status)
          table.globalFilter.value = search
          await vi.waitFor(() =>
            expect(humanDecisionApi.list).toHaveBeenCalledWith(
              mapServerTableParamsToHumanDecisionListParams(
                { pageIndex: 0, pageSize: 20, globalFilter: search },
                status,
              ),
              { signal: expect.any(AbortSignal) },
            ),
          )
          table.pagination.value = { pageIndex, pageSize: 50 }
          await vi.waitFor(() =>
            expect(table.data.value[0]?.id).toContain(`"page":${pageIndex + 1}`),
          )
          // Restore the standard size so each next search has an unambiguous page-reset request.
          table.pagination.value = { pageIndex, pageSize: 20 }
          await nextTick()
          await vi.waitFor(() => expect(table.isFetching.value).toBe(false))
        }
        const retained = client
          .getQueryCache()
          .findAll({ queryKey: humanDecisionQueryKeys.listPrefix('tenant-1') })
        expect(retained.filter((query) => !query.isActive()).length).toBeGreaterThan(3)
        generation = 1
        vi.mocked(humanDecisionApi.list).mockClear()
        const error = conflict(code)
        vi.mocked(humanDecisionApi.resolve).mockRejectedValue(error)
        await expect(
          mutation.mutateAsync(
            createHumanDecisionResolutionAttempt('decision-1', {
              action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
              expectedVersion: 1,
            }),
          ),
        ).rejects.toBe(error)
        for (const query of retained) {
          const key = query.queryKey
          const params = key[key.length - 1] as ServerTableParams
          const status = key[key.length - 2] as HumanDecisionListFilter
          const request = mapServerTableParamsToHumanDecisionListParams(params, status)
          expect(humanDecisionApi.list).toHaveBeenCalledWith(request, {
            signal: expect.any(AbortSignal),
          })
          expect(client.getQueryData(key)).toEqual(responseFor(request))
          if (status === 'ALL') {
            expect(request).not.toHaveProperty('sortBy')
            expect(request).not.toHaveProperty('sortOrder')
          }
        }
        const calls = vi.mocked(humanDecisionApi.list).mock.calls.length
        table.setStatusFilter('PENDING')
        table.globalFilter.value = 'seed'
        await vi.waitFor(() =>
          expect(table.data.value).toEqual(
            responseFor({
              status: 'PENDING',
              page: 1,
              limit: 20,
              search: 'seed',
              sortBy: 'createdAt',
              sortOrder: 'asc',
            }).data,
          ),
        )
        // A transient filter key may fetch before the search debounce, but the retained key is fresh.
        expect(
          vi
            .mocked(humanDecisionApi.list)
            .mock.calls.slice(calls)
            .some(
              ([params]) =>
                params.status === 'PENDING' && params.search === 'seed' && params.page === 1,
            ),
        ).toBe(false)
      } finally {
        wrapper.unmount()
        client.clear()
      }
    },
  )

  it('reuses the same UUID when the caller retries one logical attempt', async () => {
    const attempt = createHumanDecisionResolutionAttempt(
      'decision-1',
      { action: 'PROVIDE_RESTOCK_ESTIMATE', restockDays: 3, expectedVersion: 1 },
      () => '89c0c4de-6e6d-4e7a-8e17-8dcdca83b197',
    )
    vi.mocked(humanDecisionApi.resolve).mockResolvedValue(resolved)
    const { result, wrapper } = mountMutation()
    await result.mutateAsync(attempt)
    await result.mutateAsync(attempt)
    expect(humanDecisionApi.resolve).toHaveBeenNthCalledWith(1, 'decision-1', attempt.payload)
    expect(humanDecisionApi.resolve).toHaveBeenNthCalledWith(2, 'decision-1', attempt.payload)
    wrapper.unmount()
  })

  it('does not refetch current state for an idempotency conflict', async () => {
    const attempt = createHumanDecisionResolutionAttempt(
      'decision-1',
      { action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE', expectedVersion: 1 },
      () => '7d4101dd-c50e-43e6-8ff8-9b4229b912f0',
    )
    vi.mocked(humanDecisionApi.resolve).mockRejectedValue(conflict('IDEMPOTENCY_CONFLICT'))
    const { result, queryClient, wrapper } = mountMutation()
    const refetch = vi.spyOn(queryClient, 'refetchQueries')
    await expect(result.mutateAsync(attempt)).rejects.toBeDefined()
    expect(refetch).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
