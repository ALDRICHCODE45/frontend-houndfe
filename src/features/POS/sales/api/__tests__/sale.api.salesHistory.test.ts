/**
 * Sales history backend data T1 (handoff 28 §2.3, §4): `overdue` travels as the string "true" only
 * when set, and GET /customers/:customerId/sales-monthly is validated before it reaches the chart.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saleApi } from '../sale.api'
import { http } from '@/core/shared/api/http'
import { csvParamsSerializer } from '@/core/shared/api/paramsSerializer'

vi.mock('@/core/shared/api/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const listBody = {
  data: [],
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  counts: { all: 0, pendingPayments: 0, notDelivered: 0, overdue: 0 },
  summary: { salesCount: 0, totalSoldCents: 0, outstandingDebtCents: 0 },
}

describe('saleApi.listConfirmed — overdue', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends overdue=true on the wire when set', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: listBody })
    await saleApi.listConfirmed({ customerId: ['c-1'], page: 1, overdue: true })
    const params = vi.mocked(http.get).mock.calls[0]![1]!.params as Record<string, unknown>
    expect(csvParamsSerializer(params)).toBe('customerId=c-1&page=1&overdue=true')
  })

  it('never sends overdue=false or an empty overdue', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: listBody })
    await saleApi.listConfirmed({ customerId: ['c-1'], page: 1, overdue: false })
    const params = vi.mocked(http.get).mock.calls[0]![1]!.params as Record<string, unknown>
    expect(params).not.toHaveProperty('overdue')
    expect(csvParamsSerializer(params)).toBe('customerId=c-1&page=1')
  })

  it('leaves the params untouched without overdue', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: listBody })
    const input = { customerId: ['c-1'], page: 2, paymentStatus: ['PARTIAL' as const] }
    await saleApi.listConfirmed(input)
    expect(vi.mocked(http.get).mock.calls[0]![1]!.params).toEqual(input)
  })
})

describe('saleApi.getCustomerSalesMonthly', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GETs /customers/:customerId/sales-monthly with months and returns the months', async () => {
    const body = {
      customerId: 'c-1',
      timeZone: 'America/Mexico_City',
      months: [
        { month: '2026-10', saleCount: 0, totalCents: 0 },
        { month: '2026-11', saleCount: 3, totalCents: 125_000 },
      ],
    }
    vi.mocked(http.get).mockResolvedValue({ data: body })
    const signal = new AbortController().signal
    await expect(saleApi.getCustomerSalesMonthly('c-1', 2, { signal })).resolves.toEqual(body)
    expect(http.get).toHaveBeenCalledWith('/customers/c-1/sales-monthly', {
      params: { months: 2 },
      signal,
    })
  })

  it('encodes the customer id', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: { customerId: 'a/b', timeZone: 'America/Mexico_City', months: [] },
    })
    await saleApi.getCustomerSalesMonthly('a/b', 12)
    expect(vi.mocked(http.get).mock.calls[0]![0]).toBe('/customers/a%2Fb/sales-monthly')
  })

  it('rejects a body that is not the monthly contract', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { months: [{ month: 'x', saleCount: 'a' }] } })
    await expect(saleApi.getCustomerSalesMonthly('c-1', 12)).rejects.toThrow()
  })
})
