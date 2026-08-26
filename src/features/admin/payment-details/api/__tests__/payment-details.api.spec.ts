import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  paymentDetailsApi,
  applyLocalPaymentDetailFilters,
  paginatePaymentDetails,
} from '../payment-details.api'
import { http } from '@/core/shared/api/http'
import type { PaymentDetailResponse } from '../../interfaces/payment-detail.types'
import type { ServerTableParams } from '@/core/shared/types/table.types'

vi.mock('@/core/shared/api/http')

function makeRow(overrides: Partial<PaymentDetailResponse> = {}): PaymentDetailResponse {
  return {
    id: 'pd-1',
    tenantId: 'tenant-1',
    bankName: 'BBVA',
    beneficiary: 'ACME SA DE CV',
    clabe: '012180001234567890',
    accountNumber: '1234567890',
    isActive: true,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-05-15T00:00:00.000Z',
    ...overrides,
  }
}

describe('paymentDetailsApi (sdd payment-details-admin S2, REQ-PD-001/002/003/004)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('list()', () => {
    it('calls GET /admin/payment-details (flat array, no query params)', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: [] })

      await paymentDetailsApi.list()

      expect(http.get).toHaveBeenCalledWith('/admin/payment-details')
      expect(vi.mocked(http.get).mock.calls[0]?.[1]).toBeUndefined()
    })

    it('returns the flat array from .data', async () => {
      const rows = [makeRow({ id: 'a' }), makeRow({ id: 'b' })]
      vi.mocked(http.get).mockResolvedValue({ data: rows })

      const result = await paymentDetailsApi.list()
      expect(result).toEqual(rows)
    })
  })

  describe('getById()', () => {
    it('calls GET /admin/payment-details/:id with the id segment', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: makeRow({ id: 'pd-42' }) })

      await paymentDetailsApi.getById('pd-42')

      expect(http.get).toHaveBeenCalledWith('/admin/payment-details/pd-42')
    })

    it('returns the unwrapped DTO from .data', async () => {
      const row = makeRow({ id: 'pd-7' })
      vi.mocked(http.get).mockResolvedValue({ data: row })

      const result = await paymentDetailsApi.getById('pd-7')
      expect(result).toEqual(row)
    })
  })

  describe('create()', () => {
    it('POSTs to /admin/payment-details with the exact payload', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: makeRow() })

      const payload = {
        bankName: 'BBVA',
        beneficiary: 'ACME SA DE CV',
        clabe: '012180001234567890',
        accountNumber: '1234567890',
      }
      await paymentDetailsApi.create(payload)

      expect(http.post).toHaveBeenCalledWith('/admin/payment-details', payload)
    })

    it('never sends isActive or tenantId in the create body (REQ-PD-002)', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: makeRow() })

      await paymentDetailsApi.create({
        bankName: 'BBVA',
        beneficiary: 'ACME',
        clabe: '012180001234567890',
        accountNumber: '1234567890',
      } as unknown as Parameters<typeof paymentDetailsApi.create>[0])

      const body = vi.mocked(http.post).mock.calls[0]?.[1] as Record<string, unknown>
      expect(body).not.toHaveProperty('isActive')
      expect(body).not.toHaveProperty('tenantId')
      expect(Object.keys(body).sort()).toEqual(['accountNumber', 'bankName', 'beneficiary', 'clabe'])
    })
  })

  describe('update()', () => {
    it('PATCHes /admin/payment-details/:id with the exact payload', async () => {
      vi.mocked(http.patch).mockResolvedValue({ data: makeRow({ beneficiary: 'NEW' }) })

      const payload = { beneficiary: 'NEW' }
      await paymentDetailsApi.update('pd-1', payload)

      expect(http.patch).toHaveBeenCalledWith('/admin/payment-details/pd-1', payload)
    })

    it('never sends isActive or tenantId in the update body (REQ-PD-003)', async () => {
      vi.mocked(http.patch).mockResolvedValue({ data: makeRow() })

      await paymentDetailsApi.update('pd-1', {
        beneficiary: 'NEW',
        isActive: true,
        tenantId: 'evil',
      } as unknown as Parameters<typeof paymentDetailsApi.update>[1])

      const body = vi.mocked(http.patch).mock.calls[0]?.[1] as Record<string, unknown>
      expect(body).not.toHaveProperty('isActive')
      expect(body).not.toHaveProperty('tenantId')
    })
  })

  describe('remove()', () => {
    it('DELETEs /admin/payment-details/:id (logical delete)', async () => {
      vi.mocked(http.delete).mockResolvedValue({})

      await paymentDetailsApi.remove('pd-1')

      expect(http.delete).toHaveBeenCalledWith('/admin/payment-details/pd-1')
    })
  })
})

describe('applyLocalPaymentDetailFilters (sdd payment-details-admin S2, REQ-PD-001)', () => {
  const rows: PaymentDetailResponse[] = [
    makeRow({ id: 'a', bankName: 'BBVA', beneficiary: 'Acme SA', clabe: '111180001111111110', accountNumber: '1111111111' }),
    makeRow({ id: 'b', bankName: 'Banorte', beneficiary: 'Banorte SA', clabe: '222280002222222220', accountNumber: '2222222222' }),
    makeRow({ id: 'c', bankName: 'Santander', beneficiary: 'Santander SA', clabe: '333380003333333330', accountNumber: '3333333333', isActive: false }),
  ]

  const baseParams: ServerTableParams = { pageIndex: 0, pageSize: 10 }

  it('returns all rows when no global filter is provided', () => {
    const out = applyLocalPaymentDetailFilters(rows, baseParams)
    expect(out).toHaveLength(3)
  })

  it('matches case-insensitively on bankName (one of the four search fields)', () => {
    const out = applyLocalPaymentDetailFilters(rows, { ...baseParams, globalFilter: 'bbva' })
    expect(out.map((r) => r.id)).toEqual(['a'])
  })

  it('matches on beneficiary case-insensitively', () => {
    const out = applyLocalPaymentDetailFilters(rows, { ...baseParams, globalFilter: 'BANORTE' })
    expect(out.map((r) => r.id)).toEqual(['b'])
  })

  it('matches on clabe (digits)', () => {
    const out = applyLocalPaymentDetailFilters(rows, { ...baseParams, globalFilter: '2222' })
    expect(out.map((r) => r.id)).toEqual(['b'])
  })

  it('matches on accountNumber (digits)', () => {
    const out = applyLocalPaymentDetailFilters(rows, { ...baseParams, globalFilter: '3333333333' })
    expect(out.map((r) => r.id)).toEqual(['c'])
  })

  it('preserves every row when global filter is empty/whitespace', () => {
    const out = applyLocalPaymentDetailFilters(rows, { ...baseParams, globalFilter: '   ' })
    expect(out).toHaveLength(3)
  })

  it('sorts by a string column (bankName) ascending', () => {
    const out = applyLocalPaymentDetailFilters(rows, {
      ...baseParams,
      sorting: [{ id: 'bankName', desc: false }],
    })
    expect(out.map((r) => r.bankName)).toEqual(['BBVA', 'Banorte', 'Santander'])
  })

  it('sorts by a string column (bankName) descending', () => {
    const out = applyLocalPaymentDetailFilters(rows, {
      ...baseParams,
      sorting: [{ id: 'bankName', desc: true }],
    })
    expect(out.map((r) => r.bankName)).toEqual(['Santander', 'Banorte', 'BBVA'])
  })

  it('sorts by updatedAt string desc (canonical backend order)', () => {
    const dated: PaymentDetailResponse[] = [
      makeRow({ id: 'a', updatedAt: '2024-01-01T00:00:00.000Z' }),
      makeRow({ id: 'b', updatedAt: '2024-06-01T00:00:00.000Z' }),
      makeRow({ id: 'c', updatedAt: '2024-03-01T00:00:00.000Z' }),
    ]
    const out = applyLocalPaymentDetailFilters(dated, {
      ...baseParams,
      sorting: [{ id: 'updatedAt', desc: true }],
    })
    expect(out.map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('does not mutate the input array', () => {
    const input = [...rows]
    applyLocalPaymentDetailFilters(input, baseParams)
    expect(input).toEqual(rows)
  })
})

describe('paginatePaymentDetails (sdd payment-details-admin S2, REQ-PD-001)', () => {
  const rows: PaymentDetailResponse[] = Array.from({ length: 25 }, (_, i) =>
    makeRow({ id: `pd-${i + 1}`, bankName: `Bank ${String(i + 1).padStart(2, '0')}` }),
  )

  it('returns the correct slice for page 0 pageSize 10', () => {
    const out = paginatePaymentDetails(rows, { pageIndex: 0, pageSize: 10 })
    expect(out.data).toHaveLength(10)
    expect(out.data[0]!.id).toBe('pd-1')
    expect(out.data[9]!.id).toBe('pd-10')
    expect(out.pagination.totalCount).toBe(25)
    expect(out.pagination.pageCount).toBe(3)
    expect(out.pagination.pageIndex).toBe(0)
    expect(out.pagination.pageSize).toBe(10)
  })

  it('returns the correct slice for page 2 pageSize 10 (last partial page)', () => {
    const out = paginatePaymentDetails(rows, { pageIndex: 2, pageSize: 10 })
    expect(out.data).toHaveLength(5)
    expect(out.data[0]!.id).toBe('pd-21')
  })

  it('returns pageCount=1 and the empty list for an empty dataset', () => {
    const out = paginatePaymentDetails([], { pageIndex: 0, pageSize: 10 })
    expect(out.data).toEqual([])
    expect(out.pagination.totalCount).toBe(0)
    expect(out.pagination.pageCount).toBe(1)
  })

  it('returns pageCount=1 for a single-page dataset', () => {
    const tiny = rows.slice(0, 3)
    const out = paginatePaymentDetails(tiny, { pageIndex: 0, pageSize: 10 })
    expect(out.data).toHaveLength(3)
    expect(out.pagination.pageCount).toBe(1)
  })

  it('applies globalFilter BEFORE pagination so totalCount reflects it', () => {
    const out = paginatePaymentDetails(rows, {
      pageIndex: 0,
      pageSize: 10,
      globalFilter: 'Bank 01',
    })
    // 'Bank 01' matches pd-1 only (BankName: 'Bank 01').
    expect(out.data).toHaveLength(1)
    expect(out.pagination.totalCount).toBe(1)
    expect(out.pagination.pageCount).toBe(1)
  })

  it('returns an empty slice for an out-of-range pageIndex', () => {
    const out = paginatePaymentDetails(rows, { pageIndex: 99, pageSize: 10 })
    expect(out.data).toEqual([])
    expect(out.pagination.pageCount).toBe(3)
    expect(out.pagination.totalCount).toBe(25)
  })
})
