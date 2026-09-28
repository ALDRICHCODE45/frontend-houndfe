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
import {
  parseSellerReportFailure,
  type SellerReportRequest,
} from '../../interfaces/seller-report.types'

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

// ── PDF transport ──────────────────────────────────────────────────────────
//
// Mutation-sensitive: changing the /report/pdf path or verb, forwarding a
// tenant param, dropping a boundary or the AbortSignal, omitting
// `responseType: 'blob'`, returning a JSON/HTML body as a PDF, or failing to
// normalize a binary domain error fails at least one of these tests.

function pdfBlob(): Blob {
  return new Blob(['%PDF-1.7\nreport body'], { type: 'application/pdf' })
}

function pdfResponse(headers: Record<string, string> = {}): unknown {
  return {
    data: pdfBlob(),
    status: 200,
    headers: { 'content-disposition': 'attachment; filename="reporte-ana.pdf"', ...headers },
  }
}

function blobError(status: number, body: unknown): unknown {
  return {
    response: {
      status,
      data: new Blob([JSON.stringify(body)], { type: 'application/json' }),
    },
  }
}

/** Await a promise and return whatever it rejected with (or `null` on success). */
async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
    return null
  } catch (error) {
    return error
  }
}

describe('sellerReportApi.getReportPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs the exact /report/pdf path with responseType blob, only { from, to } and the signal', async () => {
    vi.mocked(http.get).mockResolvedValue(pdfResponse() as never)
    const controller = new AbortController()

    const result = await sellerReportApi.getReportPdf(REQUEST, {
      tenantId: TENANT_ID,
      signal: controller.signal,
    })

    const [path, config] = vi.mocked(http.get).mock.calls[0] ?? []
    expect(path).toBe(`/analytics/sales/sellers/${SELLER_ID}/report/pdf`)
    expect(config?.params).toEqual({ from: FROM, to: TO })
    expect(Object.keys(config?.params as object)).toEqual(['from', 'to'])
    expect(config?.responseType).toBe('blob')
    expect(config?.signal).toBe(controller.signal)
    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.fileName).toBe('reporte-ana.pdf')
  })

  it('returns a safe fallback file name when the disposition header is absent', async () => {
    vi.mocked(http.get).mockResolvedValue(pdfResponse({ 'content-disposition': '' }) as never)

    const result = await sellerReportApi.getReportPdf(REQUEST, { tenantId: TENANT_ID })

    expect(result.fileName).toBe('reporte-ventas.pdf')
  })

  it('refuses any non-200 status even when the bytes look like a real PDF', async () => {
    // The backend contract for this endpoint is 200 only. A 206 (or any other
    // 2xx/carried status) with a valid %PDF- prefix must never be downloaded.
    for (const status of [206, 201, 202, 204, 203]) {
      vi.mocked(http.get).mockResolvedValue({
        data: pdfBlob(),
        status,
        headers: { 'content-disposition': 'attachment; filename="reporte-ana.pdf"' },
      } as never)

      await expect(
        sellerReportApi.getReportPdf(REQUEST, { tenantId: TENANT_ID }),
      ).rejects.toBeTruthy()
    }
  })

  it('keeps a hostile seller segment inside its own /report/pdf slot', async () => {
    vi.mocked(http.get).mockRejectedValue(new Error('stop'))

    await expect(
      sellerReportApi.getReportPdf(
        { ...REQUEST, sellerUserId: 'a/../../evil?x=1' },
        { tenantId: TENANT_ID },
      ),
    ).rejects.toThrow('stop')

    const [path] = vi.mocked(http.get).mock.calls[0] ?? []
    expect(path).toBe('/analytics/sales/sellers/a%2F..%2F..%2Fevil%3Fx%3D1/report/pdf')
    expect(path).not.toContain('../../')
  })

  it('never returns a JSON, HTML or unsigned body as a PDF', async () => {
    for (const hostile of [
      new Blob([JSON.stringify({ error: 'SELLER_NOT_FOUND' })], { type: 'application/json' }),
      new Blob(['<html>error</html>'], { type: 'text/html' }),
      new Blob(['not a pdf'], { type: 'application/pdf' }),
    ]) {
      vi.mocked(http.get).mockResolvedValue({ data: hostile, status: 200, headers: {} } as never)
      await expect(
        sellerReportApi.getReportPdf(REQUEST, { tenantId: TENANT_ID }),
      ).rejects.toBeTruthy()
    }
  })

  it('normalizes a binary domain error into the shared failure contract', async () => {
    const cases: Array<{ status: number; body: unknown; kind: string }> = [
      { status: 404, body: { error: 'SELLER_NOT_FOUND' }, kind: 'seller-not-found' },
      {
        status: 422,
        body: { error: 'SELLER_REPORT_ROW_LIMIT_EXCEEDED', rowLimit: 1000, rowCount: 1500 },
        kind: 'row-limit-exceeded',
      },
      { status: 500, body: { error: 'PDF_GENERATION_FAILED' }, kind: 'pdf-generation-failed' },
      { status: 403, body: { message: 'Forbidden' }, kind: 'forbidden' },
      { status: 401, body: {}, kind: 'unauthorized' },
      { status: 400, body: {}, kind: 'invalid-request' },
    ]

    for (const testCase of cases) {
      vi.mocked(http.get).mockRejectedValue(blobError(testCase.status, testCase.body))
      const thrown = await rejectionOf(
        sellerReportApi.getReportPdf(REQUEST, { tenantId: TENANT_ID }),
      )
      expect(parseSellerReportFailure(thrown).kind).toBe(testCase.kind)
    }
  })

  it('rethrows the original transport error when the error blob is not JSON', async () => {
    vi.mocked(http.get).mockRejectedValue({
      response: { status: 500, data: new Blob(['<html>oops</html>'], { type: 'text/html' }) },
    })

    const thrown = await rejectionOf(sellerReportApi.getReportPdf(REQUEST, { tenantId: TENANT_ID }))

    expect(parseSellerReportFailure(thrown).kind).toBe('unknown')
    expect(parseSellerReportFailure(thrown).status).toBe(500)
  })
})
