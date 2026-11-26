/**
 * customers-module T5 (S4, handoff 32 §5-§6): the customer page's own routes — the sales summary,
 * the payments feed and the receipt PDF behind each event's relative `receiptPath`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import type { CustomerCollectionEvent, CustomerSalePaymentEvent } from '../../interfaces/customer.types'

const httpGet = vi.fn()
vi.mock('@/core/shared/api/http', () => ({
  http: { get: (...args: unknown[]) => httpGet(...args), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const {
  CUSTOMER_PAYMENTS_PAGE_SIZE,
  customerDetailApi,
  customerDetailQueryKeys,
  customerReceiptFormat,
  isCustomerReceiptPath,
} = await import('../customer-detail.api')

const pdf = () => new Blob(['%PDF-1.7\nreceipt'], { type: 'application/pdf' })

const collection = (overrides: Partial<CustomerCollectionEvent> = {}): CustomerCollectionEvent => ({
  kind: 'collection',
  eventId: 'col-1',
  occurredAt: '2026-11-26T18:02:11.000Z',
  amountCents: 90_000,
  tenderedCents: 90_000,
  changeDueCents: 0,
  payments: [{ method: 'cash', amountCents: 90_000, catalog: null }],
  sales: [{ saleId: 's-1', folio: 'V-000123', status: 'CONFIRMED', appliedCents: 90_000 }],
  cashier: { id: 'u-1', name: 'María' },
  receiptPath: '/collections/col-1/pdf',
  ...overrides,
})
const payment = (overrides: Partial<CustomerSalePaymentEvent> = {}): CustomerSalePaymentEvent => ({
  kind: 'payment',
  eventId: 'pay-1',
  occurredAt: '2026-11-20T19:31:02.000Z',
  method: 'cash',
  catalog: null,
  reference: null,
  amountCents: 45_000,
  tenderedCents: 50_000,
  changeCents: 5_000,
  sale: { id: 's-2', folio: 'V-000140', status: 'CONFIRMED', totalCents: 45_000 },
  cashier: { id: 'u-2', name: 'Luis' },
  receiptPath: '/sales/s-2/pdf',
  ...overrides,
})

beforeEach(() => {
  httpGet.mockReset()
})

describe('customerDetailApi.getSalesSummary', () => {
  it('reads GET /customers/:customerId/sales-summary with the id as one path segment', async () => {
    const body = { customerId: 'c-1', metrics: { openDebtCents: 0 } }
    httpGet.mockResolvedValue({ data: body })
    await expect(customerDetailApi.getSalesSummary('c-1')).resolves.toBe(body)
    expect(httpGet).toHaveBeenCalledWith('/customers/c-1/sales-summary')
    await customerDetailApi.getSalesSummary('a/../b')
    expect(httpGet.mock.calls[1]![0]).toBe('/customers/a%2F..%2Fb/sales-summary')
  })
})

describe('customerDetailApi.getPayments', () => {
  it('reads GET /customers/:customerId/payments with page and limit 50', async () => {
    const body = { data: [], pagination: { page: 2, limit: 50, total: 60, totalPages: 2 } }
    httpGet.mockResolvedValue({ data: body })
    await expect(customerDetailApi.getPayments('c-1', 2)).resolves.toBe(body)
    expect(CUSTOMER_PAYMENTS_PAGE_SIZE).toBe(50)
    expect(httpGet).toHaveBeenCalledWith('/customers/c-1/payments', { params: { page: 2, limit: 50 } })
  })
})

describe('receipt format and path', () => {
  it('a collection receipt is ticket|a4; a sale receipt is receipt-ticket|receipt-a4', () => {
    expect(customerReceiptFormat('collection', 'ticket')).toBe('ticket')
    expect(customerReceiptFormat('collection', 'a4')).toBe('a4')
    expect(customerReceiptFormat('payment', 'ticket')).toBe('receipt-ticket')
    expect(customerReceiptFormat('payment', 'a4')).toBe('receipt-a4')
  })

  it('accepts only the documented relative receipt paths', () => {
    expect(isCustomerReceiptPath('/collections/3f2a-11/pdf')).toBe(true)
    expect(isCustomerReceiptPath('/sales/3f2a-11/pdf')).toBe(true)
    for (const bad of [null, '', 'https://evil.test/sales/1/pdf', '//evil.test/x', '/sales/1/pdf?format=a4', '/users/1/pdf', '/sales/../x/pdf']) {
      expect([bad, isCustomerReceiptPath(bad)]).toEqual([bad, false])
    }
  })
})

describe('customerDetailApi.getReceiptPdf', () => {
  it('downloads the collection receipt as an authenticated Blob with ?format=', async () => {
    const blob = pdf()
    httpGet.mockResolvedValue({
      status: 200,
      data: blob,
      headers: { 'content-disposition': 'attachment; filename="cobro-col-1.pdf"' },
    })
    const result = await customerDetailApi.getReceiptPdf(collection(), 'a4')
    const [path, config] = httpGet.mock.calls[0]!
    expect(path).toBe('/collections/col-1/pdf')
    expect(config).toMatchObject({ params: { format: 'a4' }, responseType: 'blob' })
    expect(result).toEqual({ blob, fileName: 'cobro-col-1.pdf' })
  })

  it('a sale payment asks for receipt-ticket and falls back to recibo-<folio>.pdf', async () => {
    httpGet.mockResolvedValue({ status: 200, data: pdf(), headers: {} })
    const result = await customerDetailApi.getReceiptPdf(payment(), 'ticket')
    const [path, config] = httpGet.mock.calls[0]!
    expect(path).toBe('/sales/s-2/pdf')
    expect(config.params).toEqual({ format: 'receipt-ticket' })
    expect(result.fileName).toBe('recibo-V-000140.pdf')
  })

  it('never requests a null or foreign receipt path', async () => {
    await expect(customerDetailApi.getReceiptPdf(payment({ receiptPath: null }), 'a4')).rejects.toThrow(
      'CUSTOMER_RECEIPT_UNAVAILABLE',
    )
    await expect(
      customerDetailApi.getReceiptPdf(collection({ receiptPath: 'https://evil.test/x' }), 'a4'),
    ).rejects.toThrow('CUSTOMER_RECEIPT_UNAVAILABLE')
    expect(httpGet).not.toHaveBeenCalled()
  })

  it('rejects a body that is not a real PDF', async () => {
    httpGet.mockResolvedValue({ status: 200, data: new Blob(['<html>']), headers: {} })
    await expect(customerDetailApi.getReceiptPdf(collection(), 'ticket')).rejects.toThrow(
      'CUSTOMER_RECEIPT_NON_PDF_BODY',
    )
  })
})

describe('customerDetailQueryKeys', () => {
  it('sit under the customer history prefix, so every collection or debt payment refreshes them', () => {
    const prefix = saleQueryKeys.customerHistoryPrefix('t-1', 'c-1')
    expect(customerDetailQueryKeys.salesSummary('t-1', 'c-1').slice(0, prefix.length)).toEqual([...prefix])
    expect(customerDetailQueryKeys.payments('t-1', 'c-1', 3).slice(0, prefix.length)).toEqual([...prefix])
    expect(customerDetailQueryKeys.payments('t-1', 'c-1', 3)).not.toEqual(customerDetailQueryKeys.payments('t-1', 'c-1', 4))
  })
})
