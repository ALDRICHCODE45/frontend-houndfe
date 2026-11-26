/**
 * «Cobrar todo» T1 (S2, S3; handoff 30 §1-§7): the four routes, the `idempotency-key` header on
 * apply, a body that never carries `saleIds`, and the receipt PDF as a validated Blob.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const httpGet = vi.fn()
const httpPost = vi.fn()
vi.mock('@/core/shared/api/http', () => ({
  http: {
    get: (...args: unknown[]) => httpGet(...args),
    post: (...args: unknown[]) => httpPost(...args),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const { customerCollectionApi } = await import('../collection.api')

const pdf = () => new Blob(['%PDF-1.7\nreceipt'], { type: 'application/pdf' })

beforeEach(() => {
  httpGet.mockReset()
  httpPost.mockReset()
})

describe('customerCollectionApi', () => {
  it('previews without tenders with an empty body (no saleIds, no idempotency key)', async () => {
    httpPost.mockResolvedValue({ data: { debtCents: 1 } })
    const result = await customerCollectionApi.preview('c-1', {})
    const [path, body, config] = httpPost.mock.calls[0]!
    expect(path).toBe('/customers/c-1/collections/preview')
    expect(body).toEqual({})
    expect(config?.headers?.['idempotency-key']).toBeUndefined()
    expect(result).toEqual({ debtCents: 1 })
  })

  it('previews with the given tenders only', async () => {
    httpPost.mockResolvedValue({ data: {} })
    await customerCollectionApi.preview('c-1', { payments: [{ method: 'cash', amountCents: 500 }] })
    expect(httpPost.mock.calls[0]![1]).toEqual({ payments: [{ method: 'cash', amountCents: 500 }] })
    expect(httpPost.mock.calls[0]![1]).not.toHaveProperty('saleIds')
  })

  it('applies with the idempotency-key header and the exact body', async () => {
    httpPost.mockResolvedValue({ status: 201, data: { collectionId: 'col-1' } })
    const body = {
      payments: [{ method: 'card_debit' as const, amountCents: 1000, reference: 'R-1' }],
      cashSessionId: 'sess-1',
      expectedDebtCents: 5000,
    }
    const result = await customerCollectionApi.apply('c-1', body, 'key-1')
    const [path, sent, config] = httpPost.mock.calls[0]!
    expect(path).toBe('/customers/c-1/collections')
    expect(sent).toEqual(body)
    expect(sent).not.toHaveProperty('saleIds')
    expect(config.headers).toEqual({ 'idempotency-key': 'key-1' })
    expect(result).toEqual({ collectionId: 'col-1' })
  })

  it('encodes path ids', async () => {
    httpPost.mockResolvedValue({ data: {} })
    httpGet.mockResolvedValue({ data: {} })
    await customerCollectionApi.preview('a/b', {})
    await customerCollectionApi.read('x?y')
    expect(httpPost.mock.calls[0]![0]).toBe('/customers/a%2Fb/collections/preview')
    expect(httpGet.mock.calls[0]![0]).toBe('/collections/x%3Fy')
  })

  it('reads one collection', async () => {
    httpGet.mockResolvedValue({ data: { collectionId: 'col-1' } })
    expect(await customerCollectionApi.read('col-1')).toEqual({ collectionId: 'col-1' })
    expect(httpGet.mock.calls[0]![0]).toBe('/collections/col-1')
  })

  it('downloads the receipt as a Blob with the requested format and the backend file name', async () => {
    const blob = pdf()
    httpGet.mockResolvedValue({
      status: 200,
      data: blob,
      headers: { 'content-disposition': 'attachment; filename="comprobante-cobro-col-1.pdf"' },
    })
    const result = await customerCollectionApi.getReceiptPdf('col-1', 'a4')
    const [path, config] = httpGet.mock.calls[0]!
    expect(path).toBe('/collections/col-1/pdf')
    expect(config).toMatchObject({ params: { format: 'a4' }, responseType: 'blob' })
    expect(result).toEqual({ blob, fileName: 'comprobante-cobro-col-1.pdf' })
  })

  it('falls back to comprobante-cobro-<id>.pdf without Content-Disposition', async () => {
    httpGet.mockResolvedValue({ status: 200, data: pdf(), headers: {} })
    const result = await customerCollectionApi.getReceiptPdf('col-9', 'ticket')
    expect(httpGet.mock.calls[0]![1]).toMatchObject({ params: { format: 'ticket' } })
    expect(result.fileName).toBe('comprobante-cobro-col-9.pdf')
  })

  it('rejects a body that is not a PDF', async () => {
    httpGet.mockResolvedValue({
      status: 200,
      data: new Blob(['{}'], { type: 'application/json' }),
      headers: {},
    })
    await expect(customerCollectionApi.getReceiptPdf('col-1', 'ticket')).rejects.toThrow()
  })

  it('reads a JSON error inside a Blob so the code can be mapped', async () => {
    httpGet.mockRejectedValue({
      response: {
        status: 404,
        data: new Blob([JSON.stringify({ error: 'COLLECTION_NOT_FOUND' })], {
          type: 'application/json',
        }),
      },
    })
    await expect(customerCollectionApi.getReceiptPdf('col-1', 'ticket')).rejects.toMatchObject({
      response: { status: 404, data: { error: 'COLLECTION_NOT_FOUND' } },
    })
  })
})
