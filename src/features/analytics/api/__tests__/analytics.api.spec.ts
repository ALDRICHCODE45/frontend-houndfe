// analytics.api.spec.ts — transport contract for GET /analytics/sales/summary.
//
// Mutation-sensitive: changing the verb or path, forwarding extra query params,
// dropping either boundary, returning the AxiosResponse envelope, or altering any
// payload field fails at least one of these tests.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ZodError } from 'zod'
import { analyticsApi } from '../analytics.api'
import { http } from '@/core/shared/api/http'
import type {
  BranchSalesSummaryQuery,
  BranchSalesSummaryResponse,
} from '../../interfaces/branch-sales-summary.types'
import type {
  BranchSalesTimeseriesQuery,
  BranchSalesTimeseriesResponse,
} from '../../interfaces/branch-sales-timeseries.types'

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

// ── GET /analytics/sales/timeseries (ODD dashboard-operational-insights OI-4) ─
//
// The response is UNTRUSTED input: it crosses a network boundary the frontend
// does not control. These tests lock the exact request surface AND every
// rejection the boundary must perform, because the browser is forbidden from
// repairing a malformed payload (no filling, sorting, aggregating or deriving).

const TS_FROM = '2025-03-01'
const TS_TO = '2025-03-04'
const TS_REQUEST: BranchSalesTimeseriesQuery = { from: TS_FROM, to: TS_TO, interval: 'day' }

const TS_POINTS: BranchSalesTimeseriesResponse['points'] = [
  {
    date: '2025-03-01',
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
]

const TS_PAYLOAD: BranchSalesTimeseriesResponse = {
  timeZone: 'America/Mexico_City',
  from: TS_FROM,
  to: TS_TO,
  interval: 'day',
  points: TS_POINTS,
}

function payloadWith(mutate: (payload: Record<string, unknown>) => void): Record<string, unknown> {
  const copy = structuredClone(TS_PAYLOAD) as unknown as Record<string, unknown>
  mutate(copy)
  return copy
}

function pointWith(
  index: number,
  mutate: (point: Record<string, unknown>) => void,
): Record<string, unknown> {
  const copy = structuredClone(TS_PAYLOAD) as unknown as Record<string, unknown>
  const points = copy.points as Array<Record<string, unknown>>
  mutate(points[index] as Record<string, unknown>)
  return copy
}

function replacedPoints(points: BranchSalesTimeseriesResponse['points']): Record<string, unknown> {
  const copy = structuredClone(TS_PAYLOAD) as unknown as Record<string, unknown>
  copy.points = points
  return copy
}

async function reject(data: unknown): Promise<void> {
  vi.mocked(http.get).mockResolvedValue({ data, status: 200 } as never)
  await expect(analyticsApi.getBranchSalesTimeseries(TS_REQUEST)).rejects.toThrow()
}

async function rejectWith(request: BranchSalesTimeseriesQuery, data: unknown): Promise<void> {
  vi.mocked(http.get).mockResolvedValue({ data, status: 200 } as never)
  await expect(analyticsApi.getBranchSalesTimeseries(request)).rejects.toThrow()
}

/** Pure UTC calendar shift used only to BUILD test buckets; never production date math. */
function isoDayOffset(startIso: string, offset: number): string {
  const [year, month, day] = startIso.split('-').map(Number)
  const shifted = new Date(Date.UTC(year!, month! - 1, day! + offset))
  return shifted.toISOString().slice(0, 10)
}

function zeroBucket(date: string): BranchSalesTimeseriesResponse['points'][number] {
  return {
    date,
    grossSalesCents: 0,
    netSalesCents: 0,
    collectedCents: 0,
    outstandingDebtCents: 0,
    saleCount: 0,
    averageTicketCents: 0,
  }
}

function dailyWindowPayload(from: string, to: string, length: number): Record<string, unknown> {
  return {
    timeZone: 'America/Mexico_City',
    from,
    to,
    interval: 'day',
    points: Array.from({ length }, (_, index) => zeroBucket(isoDayOffset(from, index))),
  }
}

describe('analyticsApi.getBranchSalesTimeseries (ODD dashboard-operational-insights OI-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs the exact timeseries path forwarding only { from, to, interval } from a polluted object', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: TS_PAYLOAD, status: 200 } as never)

    // Tenant/branch identity comes from the JWT: a buggy caller must not widen the wire.
    const polluted = {
      from: TS_FROM,
      to: TS_TO,
      interval: 'day',
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      currency: 'MXN',
      productId: 'product-1',
    } as unknown as BranchSalesTimeseriesQuery

    await analyticsApi.getBranchSalesTimeseries(polluted)

    expect(http.get).toHaveBeenCalledTimes(1)
    const [path, config] = vi.mocked(http.get).mock.calls[0] ?? []
    expect(path).toBe('/analytics/sales/timeseries')
    expect(config?.params).toEqual({ from: TS_FROM, to: TS_TO, interval: 'day' })
    expect(Object.keys(config?.params as object)).toEqual(['from', 'to', 'interval'])
    expect(config?.signal).toBeUndefined()
  })

  it('forwards the AbortSignal so a superseded request can be cancelled', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: TS_PAYLOAD, status: 200 } as never)
    const controller = new AbortController()

    await analyticsApi.getBranchSalesTimeseries(TS_REQUEST, { signal: controller.signal })

    const [, config] = vi.mocked(http.get).mock.calls[0] ?? []
    expect(config?.signal).toBe(controller.signal)
  })

  it('unwraps response.data and returns the validated ordered zero-filled payload verbatim', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: TS_PAYLOAD, status: 200 } as never)

    const result = await analyticsApi.getBranchSalesTimeseries(TS_REQUEST)

    // Deep equality (not identity): the boundary returns a validated copy of the wire body.
    expect(result).toEqual({
      timeZone: 'America/Mexico_City',
      from: TS_FROM,
      to: TS_TO,
      interval: 'day',
      points: TS_POINTS,
    })
  })

  it('accepts the minimal one-day window with a single zero-filled bucket', async () => {
    const singleDayRequest: BranchSalesTimeseriesQuery = {
      from: '2025-03-01',
      to: '2025-03-02',
      interval: 'day',
    }
    const singleDayPoint = { ...TS_POINTS[1]!, date: '2025-03-01' }
    vi.mocked(http.get).mockResolvedValue({
      data: { ...TS_PAYLOAD, to: '2025-03-02', points: [singleDayPoint] },
      status: 200,
    } as never)

    const result = await analyticsApi.getBranchSalesTimeseries(singleDayRequest)

    expect(result.points).toEqual([singleDayPoint])
  })

  it('counts leap-day coverage in the America/Mexico_City calendar', async () => {
    const leapRequest: BranchSalesTimeseriesQuery = {
      from: '2024-02-28',
      to: '2024-03-01',
      interval: 'day',
    }
    const leapPoints = [
      { ...TS_POINTS[1]!, date: '2024-02-28' },
      { ...TS_POINTS[1]!, date: '2024-02-29' },
    ]

    // 2024 is a leap year: Feb 29 is a real bucket, so two points are complete.
    vi.mocked(http.get).mockResolvedValue({
      data: { ...TS_PAYLOAD, from: '2024-02-28', to: '2024-03-01', points: leapPoints },
      status: 200,
    } as never)
    await expect(analyticsApi.getBranchSalesTimeseries(leapRequest)).resolves.toEqual({
      timeZone: 'America/Mexico_City',
      from: '2024-02-28',
      to: '2024-03-01',
      interval: 'day',
      points: leapPoints,
    })

    // Dropping the leap day is an incomplete series, never a silently short chart.
    vi.mocked(http.get).mockResolvedValue({
      data: { ...TS_PAYLOAD, from: '2024-02-28', to: '2024-03-01', points: [leapPoints[0]!] },
      status: 200,
    } as never)
    await expect(analyticsApi.getBranchSalesTimeseries(leapRequest)).rejects.toThrow()
  })

  it('rejects unknown or missing keys anywhere in the envelope', async () => {
    await reject(
      payloadWith((p) => {
        p.unexpectedTotalCents = 1
      }),
    )
    await reject(
      payloadWith((p) => {
        delete p.points
      }),
    )
    await reject(
      payloadWith((p) => {
        delete p.from
      }),
    )
    await reject(
      payloadWith((p) => {
        delete p.interval
      }),
    )
    await reject(
      pointWith(0, (point) => {
        point.profitCents = 1
      }),
    )
    await reject(
      pointWith(0, (point) => {
        delete point.netSalesCents
      }),
    )
  })

  it('rejects a malformed or impossible calendar date', async () => {
    await reject(
      pointWith(0, (point) => {
        point.date = '2025-3-1'
      }),
    )
    await reject(
      pointWith(0, (point) => {
        point.date = '2025-02-30'
      }),
    )
    await reject(
      payloadWith((p) => {
        p.to = '2025-03-04T00:00:00Z'
      }),
    )
    await reject(
      payloadWith((p) => {
        p.timeZone = 'America/Mexico_City '
      }),
    )
  })

  it('rejects a wrong time zone or interval', async () => {
    await reject(
      payloadWith((p) => {
        p.timeZone = 'America/Bogota'
      }),
    )
    await reject(
      payloadWith((p) => {
        p.interval = 'hour'
      }),
    )
    await reject(
      payloadWith((p) => {
        p.interval = 'week'
      }),
    )
  })

  it.each([
    ['negative', -1],
    ['fractional', 12.5],
    ['unsafe', Number.MAX_SAFE_INTEGER + 2],
    ['string', '100'],
    ['null', null],
  ])('rejects a %s monetary metric', async (_label, value) => {
    for (const field of [
      'grossSalesCents',
      'netSalesCents',
      'collectedCents',
      'outstandingDebtCents',
      'saleCount',
      'averageTicketCents',
    ]) {
      await reject(
        pointWith(0, (point) => {
          point[field] = value
        }),
      )
    }
  })

  it('rejects unordered, duplicate and out-of-range points', async () => {
    await reject(replacedPoints([TS_POINTS[0]!, TS_POINTS[2]!, TS_POINTS[1]!]))
    await reject(replacedPoints([TS_POINTS[0]!, TS_POINTS[0]!, TS_POINTS[2]!]))
    await reject(
      replacedPoints([
        { ...TS_POINTS[0]!, date: TS_FROM },
        { ...TS_POINTS[1]!, date: '2025-02-28' },
        { ...TS_POINTS[2]!, date: '2025-03-03' },
      ]),
    )
    await reject(
      replacedPoints([
        { ...TS_POINTS[0]!, date: TS_FROM },
        { ...TS_POINTS[1]!, date: '2025-03-02' },
        // `to` is exclusive: 2025-03-04 must never be reported as a bucket.
        { ...TS_POINTS[2]!, date: TS_TO },
      ]),
    )
  })

  it('rejects points that do not cover every zero-filled day in the window', async () => {
    await reject(replacedPoints([TS_POINTS[0]!, TS_POINTS[2]!]))
    await reject(replacedPoints([]))
    await reject(
      replacedPoints([
        { ...TS_POINTS[0]!, date: '2025-03-02' },
        { ...TS_POINTS[1]!, date: '2025-03-03' },
      ]),
    )
  })

  it('rejects a response whose echoed from/to do not match the request', async () => {
    await reject(
      payloadWith((p) => {
        p.from = '2025-02-28'
      }),
    )
    await reject(
      payloadWith((p) => {
        p.to = '2025-03-05'
      }),
    )
  })

  // ── Window contract (independent verifier HIGH finding) ───────────────────
  //
  // The echoed window is validated BEFORE completeness. Otherwise a degenerate
  // window would be "satisfied" by an equally degenerate point list, and a
  // hostile (but schema-valid) multi-million-day range would be stepped day by
  // day. These are rejections, never repairs.

  it('rejects an equal or inverted echoed window even when it has zero points', async () => {
    const equalRequest: BranchSalesTimeseriesQuery = {
      from: TS_FROM,
      to: TS_FROM,
      interval: 'day',
    }
    await rejectWith(equalRequest, {
      ...TS_PAYLOAD,
      to: TS_FROM,
      points: [],
    })

    const invertedRequest: BranchSalesTimeseriesQuery = {
      from: TS_TO,
      to: TS_FROM,
      interval: 'day',
    }
    await rejectWith(invertedRequest, {
      ...TS_PAYLOAD,
      from: TS_TO,
      to: TS_FROM,
      points: [],
    })
  })

  it('rejects a fully populated 367-day window', async () => {
    const request: BranchSalesTimeseriesQuery = {
      from: '2024-01-01',
      to: '2025-01-02',
      interval: 'day',
    }

    await rejectWith(request, dailyWindowPayload(request.from, request.to, 367))
  })

  it('still accepts the exactly-366-day window (last valid boundary)', async () => {
    const request: BranchSalesTimeseriesQuery = {
      from: '2024-01-01',
      to: '2025-01-01',
      interval: 'day',
    }
    const payload = dailyWindowPayload(request.from, request.to, 366)
    vi.mocked(http.get).mockResolvedValue({ data: payload, status: 200 } as never)

    const result = await analyticsApi.getBranchSalesTimeseries(request)

    expect(result.points).toHaveLength(366)
    expect(result.points[0]?.date).toBe('2024-01-01')
    expect(result.points[365]?.date).toBe('2024-12-31')
  })

  it('rejects an extreme-year window through the capped step branch', async () => {
    // ~3.65 million local days. Only the 367-step cap keeps this cheap: the
    // assertion is on the rejection REASON, never on elapsed time.
    const request: BranchSalesTimeseriesQuery = {
      from: '0001-01-01',
      to: '9999-12-31',
      interval: 'day',
    }
    vi.mocked(http.get).mockResolvedValue({
      data: {
        timeZone: 'America/Mexico_City',
        from: request.from,
        to: request.to,
        interval: 'day',
        points: [],
      },
      status: 200,
    } as never)

    const thrown = await analyticsApi
      .getBranchSalesTimeseries(request)
      .catch((error: unknown) => error)

    expect(thrown).toBeInstanceOf(ZodError)
    expect((thrown as ZodError).issues.some((issue) => issue.message.includes('366'))).toBe(true)
  })
})
