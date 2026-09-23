// useBranchSalesSummary.spec.ts — query identity, guards, prior-data flags and
// guarded manual retry.
//
// Mutation-sensitive: changing the key shape, sending tenant identity to the
// API, enabling invalid ranges, dropping placeholderData/staleTime, adding
// automatic retries, or removing the in-flight retry guard fails these tests.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { analyticsQueryKeys } from '@/core/shared/constants/query-keys'
import { analyticsApi } from '../../api/analytics.api'
import { useBranchSalesSummary } from '../useBranchSalesSummary'
import type { BranchSalesSummaryResponse } from '../../interfaces/branch-sales-summary.types'

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return { ...actual, useQuery: vi.fn() }
})

vi.mock('../../api/analytics.api', () => ({
  analyticsApi: { getBranchSalesSummary: vi.fn() },
}))

const FROM = '2025-03-01'
const TO = '2025-03-16'

const PAYLOAD: BranchSalesSummaryResponse = {
  timeZone: 'America/Mexico_City',
  from: FROM,
  to: TO,
  grossSalesCents: 999_999,
  netSalesCents: 500_000,
  collectedCents: 400_000,
  outstandingDebtCents: 250_000,
  saleCount: 13,
  averageTicketCents: 38_461,
  settledRefundsCents: 12_300,
  pendingRefundObligationsCents: 7_700,
}

interface CapturedQueryOptions {
  queryKey: { value: unknown }
  queryFn: () => Promise<unknown>
  enabled: { value: boolean }
  staleTime: number
  placeholderData: unknown
  retry: unknown
}

function setupQueryResult() {
  const result = {
    data: ref<BranchSalesSummaryResponse | undefined>(undefined),
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

describe('useBranchSalesSummary (ODD branch-sales-summary A2)', () => {
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
    useBranchSalesSummary({ tenantId: () => tenant.value, from, to })
    const options = capturedOptions()

    expect(options.queryKey.value).toEqual(['analytics', 'tenant-1', 'sales-summary', FROM, TO])

    tenant.value = 'tenant-2'
    expect(options.queryKey.value).toEqual(
      analyticsQueryKeys.salesSummary('tenant-2', { from: FROM, to: TO }),
    )

    from.value = '2025-02-01'
    expect(options.queryKey.value).toEqual(
      analyticsQueryKeys.salesSummary('tenant-2', { from: '2025-02-01', to: TO }),
    )

    to.value = '2025-02-15'
    expect(options.queryKey.value).toEqual(
      analyticsQueryKeys.salesSummary('tenant-2', { from: '2025-02-01', to: '2025-02-15' }),
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
      useBranchSalesSummary({
        tenantId: testCase.tenant,
        from: testCase.from,
        to: testCase.to,
      })
      expect(capturedOptions().enabled.value, testCase.label).toBe(testCase.enabled)
    }
  })

  it('sends exactly { from, to } to the API and never the tenant identity', async () => {
    setupQueryResult()
    vi.mocked(analyticsApi.getBranchSalesSummary).mockResolvedValue(PAYLOAD)

    useBranchSalesSummary({ tenantId: 'tenant-1', from: FROM, to: TO })
    const result = await capturedOptions().queryFn()

    expect(result).toBe(PAYLOAD)
    expect(vi.mocked(analyticsApi.getBranchSalesSummary)).toHaveBeenCalledTimes(1)
    const args = vi.mocked(analyticsApi.getBranchSalesSummary).mock.calls[0]?.[0]
    expect(args).toEqual({ from: FROM, to: TO })
    expect(Object.keys(args as object)).toEqual(['from', 'to'])
  })

  it('uses staleTime 30s, keepPreviousData and no automatic retry', () => {
    setupQueryResult()

    useBranchSalesSummary({ tenantId: 'tenant-1', from: FROM, to: TO })
    const options = capturedOptions()

    expect(options.staleTime).toBe(30_000)
    expect(options.placeholderData).toBe(keepPreviousData)
    expect(options.retry).toBe(false)
  })

  it('exposes prior data and separates initial loading from background refetch', () => {
    const result = setupQueryResult()

    const api = useBranchSalesSummary({ tenantId: 'tenant-1', from: FROM, to: TO })

    result.data.value = PAYLOAD
    result.isFetching.value = true
    result.isLoading.value = false
    expect(api.summary.value).toEqual(PAYLOAD)
    expect(api.isRefetching.value).toBe(true)
    expect(api.isInitialLoading.value).toBe(false)

    result.isLoading.value = true
    expect(api.isInitialLoading.value).toBe(true)
    expect(api.isRefetching.value).toBe(false)
  })

  it('derives emptiness from the payload, not from the sales count alone', () => {
    const result = setupQueryResult()
    const api = useBranchSalesSummary({ tenantId: 'tenant-1', from: FROM, to: TO })

    expect(api.isEmpty.value).toBe(false)

    result.data.value = { ...PAYLOAD, saleCount: 0, settledRefundsCents: 5_000 }
    expect(api.isEmpty.value).toBe(false)

    result.data.value = {
      ...PAYLOAD,
      grossSalesCents: 0,
      netSalesCents: 0,
      collectedCents: 0,
      outstandingDebtCents: 0,
      saleCount: 0,
      averageTicketCents: 0,
      settledRefundsCents: 0,
      pendingRefundObligationsCents: 0,
    }
    expect(api.isEmpty.value).toBe(true)
  })

  it('guards manual retry against duplicate pending refetches and disabled ranges', async () => {
    const result = setupQueryResult()
    const api = useBranchSalesSummary({ tenantId: 'tenant-1', from: FROM, to: TO })

    result.isFetching.value = true
    await api.retry()
    expect(result.refetch).not.toHaveBeenCalled()

    result.isFetching.value = false
    await api.retry()
    expect(result.refetch).toHaveBeenCalledTimes(1)

    const disabled = setupQueryResult()
    const disabledApi = useBranchSalesSummary({ tenantId: '', from: FROM, to: TO })

    await disabledApi.retry()
    expect(disabled.refetch).not.toHaveBeenCalled()
  })
})
