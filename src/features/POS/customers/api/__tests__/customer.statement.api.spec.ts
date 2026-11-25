/**
 * Sales history backend data T4 (S1, handoff 29 §1-§2): `GET /customers/:customerId/statement/pdf`
 * with only `from`/`to` (half-open), downloaded as a Blob; only a 200 real PDF is returned, and a
 * JSON error inside a Blob is read so the caller can tell the documented failures apart.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const httpGet = vi.fn()
vi.mock('@/core/shared/api/http', () => ({
  http: {
    get: (...args: unknown[]) => httpGet(...args),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const { customerApi } = await import('../customer.api')

const RANGE = { from: '2026-11-01', to: '2026-12-01' }
const pdf = () => new Blob(['%PDF-1.7\nstatement'], { type: 'application/pdf' })

beforeEach(() => {
  httpGet.mockReset()
})

describe('customerApi.getStatementPdf', () => {
  it('requests the customer statement as a Blob with only from/to (to exclusive)', async () => {
    const blob = pdf()
    httpGet.mockResolvedValue({
      status: 200,
      data: blob,
      headers: {
        'content-disposition':
          'attachment; filename="estado-de-cuenta-c-1-2026-11-01-2026-12-01.pdf"',
      },
    })
    const controller = new AbortController()

    const result = await customerApi.getStatementPdf('c-1', RANGE, { signal: controller.signal })

    expect(httpGet).toHaveBeenCalledTimes(1)
    const [path, config] = httpGet.mock.calls[0]!
    expect(path).toBe('/customers/c-1/statement/pdf')
    expect(config).toMatchObject({
      params: { from: '2026-11-01', to: '2026-12-01' },
      responseType: 'blob',
      signal: controller.signal,
    })
    expect(Object.keys(config.params)).toEqual(['from', 'to'])
    expect(result).toEqual({ blob, fileName: 'estado-de-cuenta-c-1-2026-11-01-2026-12-01.pdf' })
  })

  it('encodes the customer id as a path segment', async () => {
    httpGet.mockResolvedValue({ status: 200, data: pdf(), headers: {} })
    await customerApi.getStatementPdf('a/../b?x=1', RANGE)
    expect(httpGet.mock.calls[0]![0]).toBe('/customers/a%2F..%2Fb%3Fx%3D1/statement/pdf')
  })

  it('falls back to estado-de-cuenta-<customerId>-<from>-<to>.pdf without the header', async () => {
    httpGet.mockResolvedValue({ status: 200, data: pdf(), headers: {} })
    const result = await customerApi.getStatementPdf('c-1', RANGE)
    expect(result.fileName).toBe('estado-de-cuenta-c-1-2026-11-01-2026-12-01.pdf')
  })

  it('refuses a body that is not a PDF or a status other than 200 (never a half file)', async () => {
    httpGet.mockResolvedValue({
      status: 200,
      data: new Blob(['{"ok":true}'], { type: 'application/json' }),
      headers: {},
    })
    await expect(customerApi.getStatementPdf('c-1', RANGE)).rejects.toThrow(
      'CUSTOMER_STATEMENT_NON_PDF_BODY',
    )

    httpGet.mockResolvedValue({ status: 206, data: pdf(), headers: {} })
    await expect(customerApi.getStatementPdf('c-1', RANGE)).rejects.toThrow(
      'CUSTOMER_STATEMENT_UNEXPECTED_STATUS',
    )
  })

  it('reads the JSON error inside a Blob (404 CUSTOMER_NOT_FOUND)', async () => {
    const body = { statusCode: 404, error: 'CUSTOMER_NOT_FOUND', message: 'CUSTOMER_NOT_FOUND' }
    httpGet.mockRejectedValue({
      response: {
        status: 404,
        data: new Blob([JSON.stringify(body)], { type: 'application/json' }),
      },
    })
    await expect(customerApi.getStatementPdf('c-1', RANGE)).rejects.toEqual({
      response: { status: 404, data: body },
    })
  })
})
