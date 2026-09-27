// sellerReport.api.spec.ts — transport contract for
// GET /analytics/sales/sellers/:sellerUserId/report.
//
// Mutation-sensitive: changing the verb or path, forwarding a tenant query
// param, dropping either boundary, letting a path segment escape its URL slot,
// dropping the AbortSignal, returning the AxiosResponse envelope, or skipping
// the response validation fails at least one of these tests.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ZodError } from 'zod'
import { sellerReportApi } from '../sellerReport.api'
import { http } from '@/core/shared/api/http'
import type { SellerReportRequest } from '../../interfaces/seller-report.types'

vi.mock('@/core/shared/api/http')

const SELLER_ID = '8f14e45f-ceea-4a2b-9c3d-1a2b3c4d5e6f'
const TENANT_ID = '11111111-2222-4333-8444-555555555555'
const FROM = '2025-03-01'
const TO = '2025-04-01'

const REQUEST: SellerReportRequest = { sellerUserId: SELLER_ID, from: FROM, to: TO }

const PAYLOAD = {
  seller: { id: SELLER_ID, name: 'Ana Vendedora' },
  tenantId: TENANT_ID,
  timeZone: 'America/Mexico_City',
  from: FROM,
  to: TO,
  generatedAt: '2025-04-01T15:04:05.000Z',
  attribution: 'CURRENT_SELLER',
  balances: 'CURRENT',
  rowLimit: 1000,
  rowCount: 1,
  confirmed: {
    dateBasis: 'confirmedAt',
    summary: {
      saleCount: 1,
      netSalesCents: 116_000,
      collectedCents: 16_000,
      outstandingDebtCents: 100_000,
      averageTicketCents: 116_000,
    },
    rows: [
      {
        id: 'a1111111-1111-4111-8111-111111111111',
        folio: 'F-0001',
        confirmedAt: '2025-03-05T18:30:00.000Z',
        totalCents: 116_000,
        paidCents: 16_000,
        debtCents: 100_000,
        paymentStatus: 'PARTIAL',
      },
    ],
  },
  canceled: {
    dateBasis: 'canceledAt',
    saleCount: 0,
    rows: [],
  },
}

describe('sellerReportApi.getReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs the exact seller report path forwarding only { from, to }', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: PAYLOAD, status: 200 } as never)

    // Tenant identity comes from the JWT: a buggy caller must not widen the wire.
    const polluted = {
      ...REQUEST,
      tenantId: TENANT_ID,
      currency: 'MXN',
    } as unknown as SellerReportRequest
    await sellerReportApi.getReport(polluted, { tenantId: TENANT_ID })

    expect(http.get).toHaveBeenCalledTimes(1)
    const [path, config] = vi.mocked(http.get).mock.calls[0] ?? []
    expect(path).toBe(`/analytics/sales/sellers/${SELLER_ID}/report`)
    expect(config?.params).toEqual({ from: FROM, to: TO })
    expect(Object.keys(config?.params as object)).toEqual(['from', 'to'])
    expect(config?.signal).toBeUndefined()
  })

  it('keeps a hostile seller segment inside its own URL slot', async () => {
    // The transport stops before validation, so only the built URL is observed.
    vi.mocked(http.get).mockRejectedValue(new Error('stop'))

    await expect(
      sellerReportApi.getReport(
        { ...REQUEST, sellerUserId: 'a/../../evil?x=1' },
        { tenantId: TENANT_ID },
      ),
    ).rejects.toThrow('stop')

    const [path] = vi.mocked(http.get).mock.calls[0] ?? []
    expect(path).toBe('/analytics/sales/sellers/a%2F..%2F..%2Fevil%3Fx%3D1/report')
    expect(path).not.toContain('../../')
  })

  it('forwards the AbortSignal so a superseded request can be cancelled', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: PAYLOAD, status: 200 } as never)
    const controller = new AbortController()

    await sellerReportApi.getReport(REQUEST, { tenantId: TENANT_ID, signal: controller.signal })

    const [, config] = vi.mocked(http.get).mock.calls[0] ?? []
    expect(config?.signal).toBe(controller.signal)
  })

  it('unwraps response.data and returns the validated payload verbatim', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: PAYLOAD, status: 200 } as never)

    const report = await sellerReportApi.getReport(REQUEST, { tenantId: TENANT_ID })

    expect(report).toEqual(PAYLOAD)
    expect(report.confirmed.summary.outstandingDebtCents).toBe(100_000)
    expect(report.confirmed.rows[0]?.paymentStatus).toBe('PARTIAL')
  })

  it('rejects a payload that is not the report this request asked for', async () => {
    for (const hostile of [
      { ...PAYLOAD, tenantId: 'other-tenant' },
      { ...PAYLOAD, seller: { id: SELLER_ID, name: 'Ana Vendedora', phone: '55' } },
      { ...PAYLOAD, from: '2025-02-01' },
      { ...PAYLOAD, rowCount: 7 },
    ]) {
      vi.mocked(http.get).mockResolvedValue({ data: hostile, status: 200 } as never)
      await expect(
        sellerReportApi.getReport(REQUEST, { tenantId: TENANT_ID }),
      ).rejects.toBeInstanceOf(ZodError)
    }
  })
})
