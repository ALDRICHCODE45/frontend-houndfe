/**
 * customers-bulk-actions T1 (handoff 33 §1-§2): POST /customers/bulk/export (CSV) and
 * POST /customers/bulk/statements (ZIP) through the authenticated http client as Blobs, with the
 * name from Content-Disposition (or the documented fallback), AbortSignal support and a JSON error
 * inside a Blob read back so the caller can switch on the code.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const httpPost = vi.fn()
vi.mock('@/core/shared/api/http', () => ({
  http: {
    get: vi.fn(),
    post: (...args: unknown[]) => httpPost(...args),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const { customerApi } = await import('../customer.api')

const SELECTION = { mode: 'ids' as const, customerIds: ['c-1', 'c-2'] }
const csv = () => new Blob(['﻿ID cliente,Nombre\r\n'], { type: 'text/csv; charset=utf-8' })
const zip = () => new Blob(['PK\u0003\u0004'], { type: 'application/zip' })

beforeEach(() => {
  httpPost.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('customerApi.bulkExportCustomers', () => {
  it('POSTs the selection and the sort as a Blob with the signal and reads the server name', async () => {
    const blob = csv()
    httpPost.mockResolvedValue({
      status: 200,
      data: blob,
      headers: { 'content-disposition': 'attachment; filename="clientes-2026-11-27.csv"' },
    })
    const controller = new AbortController()

    const result = await customerApi.bulkExportCustomers(
      { selection: SELECTION, sortBy: 'name', sortOrder: 'asc' },
      { signal: controller.signal },
    )

    const [path, body, config] = httpPost.mock.calls[0]!
    expect(path).toBe('/customers/bulk/export')
    expect(body).toEqual({ selection: SELECTION, sortBy: 'name', sortOrder: 'asc' })
    expect(config).toMatchObject({ responseType: 'blob', signal: controller.signal })
    expect(result).toEqual({ blob, fileName: 'clientes-2026-11-27.csv' })
  })

  it('falls back to clientes-<fecha>.csv (Mexico City day) without the header', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-28T03:00:00Z')) // still the 27th in Mexico City
    httpPost.mockResolvedValue({ status: 200, data: csv(), headers: {} })
    const result = await customerApi.bulkExportCustomers({ selection: SELECTION })
    expect(result.fileName).toBe('clientes-2026-11-27.csv')
    expect(httpPost.mock.calls[0]![1]).toEqual({ selection: SELECTION })
  })

  it('reads a JSON error inside a Blob into response.data', async () => {
    const body = { statusCode: 404, code: 'BULK_CUSTOMERS_NOT_FOUND', details: { missingIds: ['c-2'] } }
    httpPost.mockRejectedValue({
      response: { status: 404, data: new Blob([JSON.stringify(body)], { type: 'application/json' }) },
    })
    await expect(customerApi.bulkExportCustomers({ selection: SELECTION })).rejects.toEqual({
      response: { status: 404, data: body },
    })
  })

  it('refuses a status other than 200 or a body that is not a Blob', async () => {
    httpPost.mockResolvedValue({ status: 204, data: csv(), headers: {} })
    await expect(customerApi.bulkExportCustomers({ selection: SELECTION })).rejects.toThrow(
      'CUSTOMER_BULK_UNEXPECTED_RESPONSE',
    )
    httpPost.mockResolvedValue({ status: 200, data: 'x', headers: {} })
    await expect(customerApi.bulkExportCustomers({ selection: SELECTION })).rejects.toThrow(
      'CUSTOMER_BULK_UNEXPECTED_RESPONSE',
    )
  })
})

describe('customerApi.bulkCustomerStatements', () => {
  const RANGE = { from: '2026-11-01', to: '2026-12-01' }
  const FILTER = { mode: 'filter' as const, filter: { city: 'Monterrey' }, excludeIds: ['c-9'] }

  it('POSTs the selection with from/to and reads the server name', async () => {
    const blob = zip()
    httpPost.mockResolvedValue({
      status: 200,
      data: blob,
      headers: { 'content-disposition': 'attachment; filename="estados-de-cuenta-2026-11-01-2026-12-01.zip"' },
    })
    const result = await customerApi.bulkCustomerStatements({ selection: FILTER, ...RANGE })
    const [path, body, config] = httpPost.mock.calls[0]!
    expect(path).toBe('/customers/bulk/statements')
    expect(body).toEqual({ selection: FILTER, from: '2026-11-01', to: '2026-12-01' })
    expect(config).toMatchObject({ responseType: 'blob' })
    expect(result).toEqual({ blob, fileName: 'estados-de-cuenta-2026-11-01-2026-12-01.zip' })
  })

  it('falls back to estados-de-cuenta-<from>-<to>.zip', async () => {
    httpPost.mockResolvedValue({ status: 200, data: zip(), headers: {} })
    const result = await customerApi.bulkCustomerStatements({ selection: SELECTION, ...RANGE })
    expect(result.fileName).toBe('estados-de-cuenta-2026-11-01-2026-12-01.zip')
  })
})
