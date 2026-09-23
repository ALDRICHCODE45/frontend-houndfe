// useBranchSalesTimeseries.spec.ts — query identity, guards, prior-data flags,
// signal forwarding and guarded manual retry for the daily series.
//
// Mutation-sensitive: changing the key shape, sending tenant identity to the
// API, hardcoding boundaries instead of tracking them, enabling invalid ranges,
// dropping placeholderData/staleTime, adding automatic retries, ignoring the
// TanStack signal, coupling the query to the summary slot, or removing the
// in-flight retry guard fails these tests.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { analyticsQueryKeys } from '@/core/shared/constants/query-keys'
import { analyticsApi } from '../../api/analytics.api'
import { useBranchSalesTimeseries } from '../useBranchSalesTimeseries'
import type { BranchSalesTimeseriesResponse } from '../../interfaces/branch-sales-timeseries.types'

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return { ...actual, useQuery: vi.fn() }
})

vi.mock('../../api/analytics.api', () => ({
  analyticsApi: {
    getBranchSalesTimeseries: vi.fn(),
    getBranchSalesSummary: vi.fn(),
  },
}))

const FROM = '2025-03-01'
const TO = '2025-03-04'
const INTERVAL = 'day' as const

const PAYLOAD: BranchSalesTimeseriesResponse = {
  timeZone: 'America/Mexico_City',
  from: FROM,
  to: TO,
  interval: INTERVAL,
  points: [
    {
      date: FROM,
      grossSalesCents: 125_000,
      netSalesCents: 100_000,
      collectedCents: 80_000,
      outstandingDebtCents: 20_000,
      saleCount: 3,
      averageTicketCents: 33_333,
    },
    {
      date: '2025-03-02',
      grossSalesCents: 0,
      netSalesCents: 0,
      collectedCents: 0,
      outstandingDebtCents: 0,
      saleCount: 0,
      averageTicketCents: 0,
    },
    {
      date: '2025-03-03',
      grossSalesCents: 250_000,
      netSalesCents: 200_000,
      collectedCents: 150_000,
      outstandingDebtCents: 50_000,
      saleCount: 4,
      averageTicketCents: 50_000,
    },
  ],
}

interface CapturedQueryOptions {
  queryKey: { value: unknown }
  queryFn: (context: { signal: AbortSignal }) => Promise<unknown>
  enabled: { value: boolean }
  staleTime: number
  placeholderData: unknown
  retry: unknown
}

function setupQueryResult() {
  const result = {
    data: ref<BranchSalesTimeseriesResponse | undefined>(undefined),
    isLoading: ref(false),
    isFetching: ref(false),
    isError: ref(false),
    error: ref<unknown>(null),
    refetch: vi.fn().mockResolvedValue(undefined),
  }
  vi.mocked(useQuery).mockReturnValue(result as never)
  return result
}

function capturedOptions(): CapturedQueryOptions {
  const calls = vi.mocked(useQuery).mock.calls
  const call = calls[calls.length - 1]
  if (!call) throw new Error('useQuery was not called')
  return call[0] as unknown as CapturedQueryOptions
}

describe('useBranchSalesTimeseries (ODD dashboard-operational-insights OI-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('normalizes a getter identity and refs, tracking tenant, from and to independently', () => {
    setupQueryResult()
    const tenant = ref('tenant-1')
    const from = ref(FROM)
    const to = ref(TO)

    // tenantId arrives as a GETTER while from/to are refs: a ref-only
    // implementation (options.tenantId.value) would resolve the tenant to
    // undefined and produce a different key.
    useBranchSalesTimeseries({ tenantId: () => tenant.value, from, to })
    const options = capturedOptions()

    expect(options.queryKey.value).toEqual([
      'analytics',
      'tenant-1',
      'sales-timeseries',
      FROM,
      TO,
      INTERVAL,
    ])

    tenant.value = 'tenant-2'
    expect(options.queryKey.value).toEqual(
      analyticsQueryKeys.salesTimeseries('tenant-2', { from: FROM, to: TO, interval: INTERVAL }),
    )

    from.value = '2025-03-02'
    expect(options.queryKey.value).toEqual(
      analyticsQueryKeys.salesTimeseries('tenant-2', {
        from: '2025-03-02',
        to: TO,
        interval: INTERVAL,
      }),
    )

    to.value = '2025-03-05'
    expect(options.queryKey.value).toEqual(
      analyticsQueryKeys.salesTimeseries('tenant-2', {
        from: '2025-03-02',
        to: '2025-03-05',
        interval: INTERVAL,
      }),
    )
  })

  it('enables only for a non-empty tenant and a fully valid range', () => {
    const cases: Array<{
      label: string
      tenant: string
      from: string
      to: string
      enabled: boolean
    }> = [
      { label: 'valid range', tenant: 'tenant-1', from: FROM, to: TO, enabled: true },
      // 2024 is a leap year: these boundaries are exactly 366 calendar days apart.
      {
        label: 'exactly 366 days',
        tenant: 'tenant-1',
        from: '2024-01-01',
        to: '2025-01-01',
        enabled: true,
      },
      { label: 'empty tenant', tenant: '', from: FROM, to: TO, enabled: false },
      { label: 'whitespace tenant', tenant: '   ', from: FROM, to: TO, enabled: false },
      { label: 'empty from', tenant: 'tenant-1', from: '', to: TO, enabled: false },
      { label: 'empty to', tenant: 'tenant-1', from: FROM, to: '', enabled: false },
      { label: 'equal boundaries', tenant: 'tenant-1', from: FROM, to: FROM, enabled: false },
      { label: 'inverted boundaries', tenant: 'tenant-1', from: TO, to: FROM, enabled: false },
      { label: 'impossible date', tenant: 'tenant-1', from: '2025-02-30', to: TO, enabled: false },
      {
        label: '367 days',
        tenant: 'tenant-1',
        from: '2024-01-01',
        to: '2025-01-02',
        enabled: false,
      },
    ]

    for (const testCase of cases) {
      setupQueryResult()
      useBranchSalesTimeseries({
        tenantId: testCase.tenant,
        from: testCase.from,
        to: testCase.to,
      })
      expect(capturedOptions().enabled.value, testCase.label).toBe(testCase.enabled)
    }
  })

  it('requests exactly { from, to, interval: "day" } and never the tenant identity', async () => {
    setupQueryResult()
    vi.mocked(analyticsApi.getBranchSalesTimeseries).mockResolvedValue(PAYLOAD)

    useBranchSalesTimeseries({ tenantId: 'tenant-1', from: FROM, to: TO })
    const result = await capturedOptions().queryFn({
      signal: new AbortController().signal,
    })

    expect(result).toBe(PAYLOAD)
    expect(vi.mocked(analyticsApi.getBranchSalesTimeseries)).toHaveBeenCalledTimes(1)
    const args = vi.mocked(analyticsApi.getBranchSalesTimeseries).mock.calls[0]?.[0]
    expect(args).toEqual({ from: FROM, to: TO, interval: 'day' })
    expect(Object.keys(args as object)).toEqual(['from', 'to', 'interval'])
  })

  it('forwards the TanStack AbortSignal to the transport', async () => {
    setupQueryResult()
    vi.mocked(analyticsApi.getBranchSalesTimeseries).mockResolvedValue(PAYLOAD)
    const controller = new AbortController()

    useBranchSalesTimeseries({ tenantId: 'tenant-1', from: FROM, to: TO })
    await capturedOptions().queryFn({ signal: controller.signal })

    const options = vi.mocked(analyticsApi.getBranchSalesTimeseries).mock.calls[0]?.[1]
    expect(options?.signal).toBe(controller.signal)
  })

  it('does not couple the series query to the summary query', () => {
    setupQueryResult()

    useBranchSalesTimeseries({ tenantId: 'tenant-1', from: FROM, to: TO })

    expect(useQuery).toHaveBeenCalledTimes(1)
    expect(capturedOptions().queryKey.value).toEqual([
      'analytics',
      'tenant-1',
      'sales-timeseries',
      FROM,
      TO,
      INTERVAL,
    ])
    expect(vi.mocked(analyticsApi.getBranchSalesSummary)).not.toHaveBeenCalled()
  })

  it('uses staleTime 30s, keepPreviousData and no automatic retry', () => {
    setupQueryResult()

    useBranchSalesTimeseries({ tenantId: 'tenant-1', from: FROM, to: TO })
    const options = capturedOptions()

    expect(options.staleTime).toBe(30_000)
    expect(options.placeholderData).toBe(keepPreviousData)
    expect(options.retry).toBe(false)
  })

  it('exposes the ordered points and separates initial loading from background refetch', () => {
    const result = setupQueryResult()

    const api = useBranchSalesTimeseries({ tenantId: 'tenant-1', from: FROM, to: TO })

    expect(api.points.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)

    result.data.value = PAYLOAD
    result.isFetching.value = true
    result.isLoading.value = false
    expect(api.timeseries.value).toEqual(PAYLOAD)
    expect(api.points.value).toEqual(PAYLOAD.points)
    expect(api.isEmpty.value).toBe(false)
    expect(api.isRefetching.value).toBe(true)
    expect(api.isInitialLoading.value).toBe(false)

    result.isLoading.value = true
    expect(api.isInitialLoading.value).toBe(true)
    expect(api.isRefetching.value).toBe(false)
  })

  it('surfaces error state independently without discarding prior points', () => {
    const result = setupQueryResult()
    const api = useBranchSalesTimeseries({ tenantId: 'tenant-1', from: FROM, to: TO })

    result.data.value = PAYLOAD
    const failure = new Error('contract violation')
    result.isError.value = true
    result.error.value = failure

    expect(api.isError.value).toBe(true)
    expect(api.error.value).toBe(failure)
    expect(api.timeseries.value).toEqual(PAYLOAD)
    expect(api.points.value).toHaveLength(3)
  })

  it('guards manual retry against duplicate pending refetches and disabled ranges', async () => {
    const result = setupQueryResult()
    const api = useBranchSalesTimeseries({ tenantId: 'tenant-1', from: FROM, to: TO })

    result.isFetching.value = true
    await api.retry()
    expect(result.refetch).not.toHaveBeenCalled()

    result.isFetching.value = false
    await api.retry()
    expect(result.refetch).toHaveBeenCalledTimes(1)

    const disabled = setupQueryResult()
    const disabledApi = useBranchSalesTimeseries({ tenantId: '', from: FROM, to: TO })

    await disabledApi.retry()
    expect(disabled.refetch).not.toHaveBeenCalled()
  })

  // ── Public guard surface (independent verifier LOWER finding) ─────────────
  //
  // Exposing raw `query.refetch` beside a guarded `retry` leaves a bypass: one
  // name enforces the enabled/in-flight guard while the other starts a second
  // request. Both public names must be the SAME guarded function.

  it('exposes one guarded function under both refetch and retry names', () => {
    setupQueryResult()

    const api = useBranchSalesTimeseries({ tenantId: 'tenant-1', from: FROM, to: TO })

    expect(api.refetch).toBe(api.retry)
  })

  it('guards the public refetch against in-flight requests and disabled ranges', async () => {
    const result = setupQueryResult()
    const api = useBranchSalesTimeseries({ tenantId: 'tenant-1', from: FROM, to: TO })

    result.isFetching.value = true
    await api.refetch()
    expect(result.refetch).not.toHaveBeenCalled()

    result.isFetching.value = false
    await api.refetch()
    expect(result.refetch).toHaveBeenCalledTimes(1)

    const disabled = setupQueryResult()
    const disabledApi = useBranchSalesTimeseries({ tenantId: '   ', from: TO, to: FROM })

    await disabledApi.refetch()
    expect(disabled.refetch).not.toHaveBeenCalled()
  })

  it('never starts a manual request for an invalid or missing tenant range', async () => {
    const cases: Array<{ label: string; tenant: string; from: string; to: string }> = [
      { label: 'empty tenant', tenant: '', from: FROM, to: TO },
      { label: 'equal boundaries', tenant: 'tenant-1', from: FROM, to: FROM },
      { label: 'inverted boundaries', tenant: 'tenant-1', from: TO, to: FROM },
      { label: '367 days', tenant: 'tenant-1', from: '2024-01-01', to: '2025-01-02' },
    ]

    for (const testCase of cases) {
      const result = setupQueryResult()
      const api = useBranchSalesTimeseries({
        tenantId: testCase.tenant,
        from: testCase.from,
        to: testCase.to,
      })

      await api.refetch()
      await api.retry()

      expect(result.refetch, testCase.label).not.toHaveBeenCalled()
    }
  })
})
