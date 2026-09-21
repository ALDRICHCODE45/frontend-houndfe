// analytics.api.spec.ts — transport contract for GET /analytics/sales/summary.
//
// Mutation-sensitive: changing the verb or path, forwarding extra query params,
// dropping either boundary, returning the AxiosResponse envelope, or altering any
// payload field fails at least one of these tests.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyticsApi } from '../analytics.api'
import { http } from '@/core/shared/api/http'
import type {
  BranchSalesSummaryQuery,
  BranchSalesSummaryResponse,
} from '../../interfaces/branch-sales-summary.types'

vi.mock('@/core/shared/api/http')

const FROM = '2025-01-01'
const TO = '2025-02-01'

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

describe('analyticsApi.getBranchSalesSummary (ODD branch-sales-summary A1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs the exact summary path forwarding only { from, to } from a polluted object', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: PAYLOAD, status: 200 } as never)

    // Tenant/branch identity comes from the JWT: a buggy caller must not widen the wire.
    const polluted = {
      from: FROM,
      to: TO,
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      currency: 'MXN',
      page: 1,
    } as unknown as BranchSalesSummaryQuery

    await analyticsApi.getBranchSalesSummary(polluted)

    expect(http.get).toHaveBeenCalledTimes(1)
    expect(http.get).toHaveBeenCalledWith('/analytics/sales/summary', {
      params: { from: FROM, to: TO },
    })
  })

  it('unwraps response.data and returns the authoritative 11-field payload verbatim', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: PAYLOAD, status: 200 } as never)

    const result = await analyticsApi.getBranchSalesSummary({ from: FROM, to: TO })

    // Identity proves the envelope was destructured; the exact literal proves every
    // authoritative field is forwarded unchanged and no aggregate was invented.
    expect(result).toBe(PAYLOAD)
    expect(result).toEqual({
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
    })
  })
})
