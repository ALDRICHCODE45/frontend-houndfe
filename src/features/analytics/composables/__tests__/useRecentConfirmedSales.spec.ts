// useRecentConfirmedSales.spec.ts — public wrapper pinning the exact fixed
// dashboard-recent request and its disjoint tenant-scoped key
// (ODD dashboard-operational-insights OI-5B2 S1).
//
// The shared security/state transition matrix (tenant/permission masking, guarded
// refetch, late A→B results) is proven once in useDashboardConfirmedSales.spec.ts.
// This spec owns the RECENT-specific contract: the exact key namespace, the exact
// fixed request and the signal identity.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { saleApi } from '@/features/POS/sales/api/sale.api'
import { useRecentConfirmedSales } from '../useRecentConfirmedSales'
import type { ConfirmedSalesListResponse } from '@/features/POS/sales/interfaces/sale.types'

const queryMockState = vi.hoisted(() => ({ capturedResult: null as unknown }))

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return { ...actual, useQuery: vi.fn(() => queryMockState.capturedResult) }
})

vi.mock('@/features/POS/sales/api/sale.api', () => ({
  saleApi: { listConfirmed: vi.fn() },
}))

const PAYLOAD: ConfirmedSalesListResponse = {
  data: [],
  pagination: { page: 1, limit: 5, total: 0, totalPages: 0 },
  counts: { all: 0, pendingPayments: 0, notDelivered: 0 },
  summary: { salesCount: 0, totalSoldCents: 0, outstandingDebtCents: 0 },
}

interface CapturedQueryOptions {
  queryKey: { value: unknown }
  queryFn: (context: { signal: AbortSignal }) => Promise<unknown>
  enabled: { value: boolean }
}

function setupQueryResult() {
  const result = {
    data: ref<ConfirmedSalesListResponse | undefined>(undefined),
    isLoading: ref(false),
    isFetching: ref(false),
    isError: ref(false),
    error: ref<unknown>(null),
    refetch: vi.fn().mockResolvedValue(undefined),
  }
  queryMockState.capturedResult = result
  return result
}

function capturedOptions(): CapturedQueryOptions {
  const calls = vi.mocked(useQuery).mock.calls
  const call = calls[calls.length - 1]
  if (!call) throw new Error('useQuery was not called')
  return call[0] as unknown as CapturedQueryOptions
}

const PUBLIC_SURFACE = [
  'data',
  'items',
  'isEmpty',
  'isInitialLoading',
  'isRefetching',
  'isFetching',
  'isError',
  'error',
  'refetch',
  'retry',
]

const RECENT_REQUEST = {
  page: 1,
  limit: 5,
  status: ['CONFIRMED'],
  sortBy: 'confirmedAt',
  sortOrder: 'desc',
}

describe('useRecentConfirmedSales (ODD dashboard-operational-insights OI-5B2 S1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupQueryResult()
  })

  it('pins the exact fixed dashboard-recent key and tracks tenant changes', () => {
    const tenant = ref('tenant-1')
    useRecentConfirmedSales({ tenantId: () => tenant.value, enabled: true })
    const options = capturedOptions()

    expect(options.queryKey.value).toEqual(['sales', 'tenant-1', 'dashboard-recent'])
    tenant.value = 'tenant-2'
    expect(options.queryKey.value).toEqual(saleQueryKeys.dashboardRecent('tenant-2'))
  })

  it('sends exactly the fixed recent request and forwards the AbortSignal', async () => {
    vi.mocked(saleApi.listConfirmed).mockResolvedValue(PAYLOAD)
    const controller = new AbortController()

    useRecentConfirmedSales({ tenantId: 'tenant-1', enabled: true })
    await capturedOptions().queryFn({ signal: controller.signal })

    const [params, opts] = vi.mocked(saleApi.listConfirmed).mock.calls[0] ?? []
    expect(params).toEqual(RECENT_REQUEST)
    expect(Object.keys(params as object)).toEqual([
      'page',
      'limit',
      'status',
      'sortBy',
      'sortOrder',
    ])
    expect(opts?.signal).toBe(controller.signal)
  })

  it('never sends the tenant identity onto the wire', async () => {
    vi.mocked(saleApi.listConfirmed).mockResolvedValue(PAYLOAD)

    useRecentConfirmedSales({ tenantId: 'tenant-secret', enabled: true })
    await capturedOptions().queryFn({ signal: new AbortController().signal })

    const [params] = vi.mocked(saleApi.listConfirmed).mock.calls[0] ?? []
    expect(params).not.toHaveProperty('tenantId')
    expect(params).not.toHaveProperty('branchId')
    expect(JSON.stringify(params)).not.toContain('tenant-secret')
  })

  it('enables only with a non-empty trimmed tenant AND the caller permission flag', () => {
    const cases: Array<{ label: string; tenant: string; enabled: boolean; expected: boolean }> = [
      { label: 'tenant + permission', tenant: 'tenant-1', enabled: true, expected: true },
      { label: 'empty tenant', tenant: '', enabled: true, expected: false },
      { label: 'whitespace tenant', tenant: '   ', enabled: true, expected: false },
      { label: 'permission denied', tenant: 'tenant-1', enabled: false, expected: false },
    ]

    for (const testCase of cases) {
      setupQueryResult()
      useRecentConfirmedSales({ tenantId: testCase.tenant, enabled: testCase.enabled })
      expect(capturedOptions().enabled.value, testCase.label).toBe(testCase.expected)
    }
  })

  it('exposes exactly the reviewed surface with one guarded refetch/retry returning void', async () => {
    const result = setupQueryResult()
    const api = useRecentConfirmedSales({ tenantId: 'tenant-1', enabled: true })

    expect(new Set(Object.keys(api))).toEqual(new Set(PUBLIC_SURFACE))
    expect(api.refetch).toBe(api.retry)

    result.isFetching.value = true
    await api.refetch()
    expect(result.refetch).not.toHaveBeenCalled()

    result.isFetching.value = false
    await expect(api.refetch()).resolves.toBeUndefined()
    expect(result.refetch).toHaveBeenCalledTimes(1)
  })
})
