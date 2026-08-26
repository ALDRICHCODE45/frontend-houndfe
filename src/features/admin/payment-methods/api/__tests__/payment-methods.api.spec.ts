import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  paymentMethodsApi,
  applyLocalPaymentMethodFilters,
  paginatePaymentMethods,
} from '../payment-methods.api'
import { http } from '@/core/shared/api/http'
import type { PaymentMethodResponse } from '../../interfaces/payment-method.types'
import type { ServerTableParams } from '@/core/shared/types/table.types'

vi.mock('@/core/shared/api/http')

function makeRow(overrides: Partial<PaymentMethodResponse> = {}): PaymentMethodResponse {
  return {
    id: 'pm-1',
    tenantId: 'tenant-1',
    name: 'Mercado Pago',
    category: 'transfer',
    subtitle: 'Link de pago',
    isActive: true,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-05-15T00:00:00.000Z',
    ...overrides,
  }
}

describe('paymentMethodsApi (sdd custom-payment-methods S2A, REQ-PM-001/002/003/004)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('list()', () => {
    it('calls GET /admin/payment-methods (flat array, no query params)', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: [] })

      await paymentMethodsApi.list()

      expect(http.get).toHaveBeenCalledWith('/admin/payment-methods')
      expect(vi.mocked(http.get).mock.calls[0]?.[1]).toBeUndefined()
    })

    it('returns the flat array from .data', async () => {
      const rows = [makeRow({ id: 'a' }), makeRow({ id: 'b' })]
      vi.mocked(http.get).mockResolvedValue({ data: rows })

      const result = await paymentMethodsApi.list()
      expect(result).toEqual(rows)
    })
  })

  describe('getById()', () => {
    it('calls GET /admin/payment-methods/:id with the id segment', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: makeRow({ id: 'pm-42' }) })

      await paymentMethodsApi.getById('pm-42')

      expect(http.get).toHaveBeenCalledWith('/admin/payment-methods/pm-42')
    })

    it('returns the unwrapped DTO from .data', async () => {
      const row = makeRow({ id: 'pm-7' })
      vi.mocked(http.get).mockResolvedValue({ data: row })

      const result = await paymentMethodsApi.getById('pm-7')
      expect(result).toEqual(row)
    })
  })

  describe('create()', () => {
    it('POSTs to /admin/payment-methods with the exact payload', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: makeRow() })

      const payload = { name: 'Mercado Pago', category: 'transfer', subtitle: 'Link' }
      await paymentMethodsApi.create(payload)

      expect(http.post).toHaveBeenCalledWith('/admin/payment-methods', payload)
    })

    // REQ-PM-002 — backend `forbidNonWhitelisted` rejects `isActive`, `id`,
    // `tenantId`, `createdAt`, `updatedAt`, `metadataJson` with 400. The
    // wire body must NEVER include those keys.
    it('never sends isActive, id, tenantId, createdAt, updatedAt, or metadataJson in the create body (REQ-PM-002 pin)', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: makeRow() })

      await paymentMethodsApi.create({
        name: 'SPEI Banorte',
        category: 'transfer',
        subtitle: 'SPEI',
        isActive: true,
        id: 'evil',
        tenantId: 'evil',
        createdAt: '2000-01-01T00:00:00.000Z',
        updatedAt: '2000-01-01T00:00:00.000Z',
        metadataJson: { evil: true },
      } as unknown as Parameters<typeof paymentMethodsApi.create>[0])

      const body = vi.mocked(http.post).mock.calls[0]?.[1] as Record<string, unknown>
      expect(body).not.toHaveProperty('isActive')
      expect(body).not.toHaveProperty('id')
      expect(body).not.toHaveProperty('tenantId')
      expect(body).not.toHaveProperty('createdAt')
      expect(body).not.toHaveProperty('updatedAt')
      expect(body).not.toHaveProperty('metadataJson')
      // Only the 3 whitelisted keys remain.
      expect(Object.keys(body).sort()).toEqual(['category', 'name', 'subtitle'])
    })

    it('omits subtitle from the wire when it is undefined', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: makeRow() })

      await paymentMethodsApi.create({
        name: 'Efectivo USD',
        category: 'cash',
      })

      const body = vi.mocked(http.post).mock.calls[0]?.[1] as Record<string, unknown>
      expect(body).not.toHaveProperty('subtitle')
      expect(Object.keys(body).sort()).toEqual(['category', 'name'])
    })

    it('omits subtitle from the wire when it is whitespace-only', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: makeRow() })

      await paymentMethodsApi.create({
        name: 'Efectivo USD',
        category: 'cash',
        subtitle: '   ',
      })

      const body = vi.mocked(http.post).mock.calls[0]?.[1] as Record<string, unknown>
      expect(body).not.toHaveProperty('subtitle')
    })
  })

  describe('update()', () => {
    it('PATCHes /admin/payment-methods/:id with the exact payload', async () => {
      vi.mocked(http.patch).mockResolvedValue({ data: makeRow({ name: 'NEW' }) })

      const payload = { name: 'NEW' }
      await paymentMethodsApi.update('pm-1', payload)

      expect(http.patch).toHaveBeenCalledWith('/admin/payment-methods/pm-1', payload)
    })

    // REQ-PM-003 REVERSAL — unlike PaymentDetail, isActive IS forwarded on update
    // so the slideover's reactivate toggle works.
    it('forwards isActive when present (REQ-PM-003 REVERSAL pin)', async () => {
      vi.mocked(http.patch).mockResolvedValue({ data: makeRow({ isActive: true }) })

      await paymentMethodsApi.update('pm-1', { isActive: true })

      const body = vi.mocked(http.patch).mock.calls[0]?.[1] as Record<string, unknown>
      expect(body).toHaveProperty('isActive', true)
    })

    it('forwards isActive: false (REQ-PM-003 deactivate path)', async () => {
      vi.mocked(http.patch).mockResolvedValue({ data: makeRow({ isActive: false }) })

      await paymentMethodsApi.update('pm-1', { isActive: false })

      const body = vi.mocked(http.patch).mock.calls[0]?.[1] as Record<string, unknown>
      expect(body).toHaveProperty('isActive', false)
    })

    // REQ-PM-002 + REO-PD-NOTE-001 — tenantId NEVER forwards, even if a buggy
    // caller (or a future setValues regression) tries to inject it.
    it('never forwards tenantId on update (REQ-PM-002 pin)', async () => {
      vi.mocked(http.patch).mockResolvedValue({ data: makeRow() })

      await paymentMethodsApi.update('pm-1', {
        name: 'NEW',
        tenantId: 'evil',
      } as unknown as Parameters<typeof paymentMethodsApi.update>[1])

      const body = vi.mocked(http.patch).mock.calls[0]?.[1] as Record<string, unknown>
      expect(body).not.toHaveProperty('tenantId')
    })

    it('never forwards id / createdAt / updatedAt / metadataJson on update', async () => {
      vi.mocked(http.patch).mockResolvedValue({ data: makeRow() })

      await paymentMethodsApi.update('pm-1', {
        name: 'NEW',
        id: 'evil',
        createdAt: '2000-01-01T00:00:00.000Z',
        updatedAt: '2000-01-01T00:00:00.000Z',
        metadataJson: { evil: true },
      } as unknown as Parameters<typeof paymentMethodsApi.update>[1])

      const body = vi.mocked(http.patch).mock.calls[0]?.[1] as Record<string, unknown>
      expect(body).not.toHaveProperty('id')
      expect(body).not.toHaveProperty('createdAt')
      expect(body).not.toHaveProperty('updatedAt')
      expect(body).not.toHaveProperty('metadataJson')
      // Only the whitelisted keys remain.
      expect(Object.keys(body).sort()).toEqual(['name'])
    })

    it('preserves the wire object exactly when no forbidden keys are present', async () => {
      vi.mocked(http.patch).mockResolvedValue({ data: makeRow() })

      await paymentMethodsApi.update('pm-1', {
        name: 'Edited',
        category: 'card_debit',
        subtitle: 'POS',
        isActive: true,
      })

      const body = vi.mocked(http.patch).mock.calls[0]?.[1] as Record<string, unknown>
      expect(body).toEqual({
        name: 'Edited',
        category: 'card_debit',
        subtitle: 'POS',
        isActive: true,
      })
    })

    it('omits subtitle from the wire when it is whitespace-only', async () => {
      vi.mocked(http.patch).mockResolvedValue({ data: makeRow() })

      await paymentMethodsApi.update('pm-1', { subtitle: '   ' })

      const body = vi.mocked(http.patch).mock.calls[0]?.[1] as Record<string, unknown>
      expect(body).not.toHaveProperty('subtitle')
    })
  })

  describe('remove()', () => {
    it('DELETEs /admin/payment-methods/:id (logical delete)', async () => {
      vi.mocked(http.delete).mockResolvedValue({})

      await paymentMethodsApi.remove('pm-1')

      expect(http.delete).toHaveBeenCalledWith('/admin/payment-methods/pm-1')
    })
  })
})

describe('applyLocalPaymentMethodFilters (sdd custom-payment-methods S2A, REQ-PM-001)', () => {
  const rows: PaymentMethodResponse[] = [
    makeRow({ id: 'a', name: 'Mercado Pago', category: 'transfer', isActive: true }),
    makeRow({ id: 'b', name: 'SPEI Banorte', category: 'transfer', isActive: false }),
    makeRow({ id: 'c', name: 'Visa Débito', category: 'card_debit', isActive: true }),
  ]

  const baseParams: ServerTableParams = { pageIndex: 0, pageSize: 10 }

  it('returns all rows when no global filter is provided', () => {
    const out = applyLocalPaymentMethodFilters(rows, baseParams)
    expect(out).toHaveLength(3)
  })

  it('matches case-insensitively on name (search is name-only per exploration §9.9)', () => {
    const out = applyLocalPaymentMethodFilters(rows, { ...baseParams, globalFilter: 'mercado' })
    expect(out.map((r) => r.id)).toEqual(['a'])
  })

  it('does NOT match against subtitle (search is name-only, REQ-PM-001 + exploration §9.9)', () => {
    const out = applyLocalPaymentMethodFilters(
      [{ ...rows[0]!, subtitle: 'UNIQUE-SUBTITLE-STRING' }],
      { ...baseParams, globalFilter: 'unique-subtitle' },
    )
    expect(out).toEqual([])
  })

  it('preserves every row when global filter is empty/whitespace', () => {
    const out = applyLocalPaymentMethodFilters(rows, { ...baseParams, globalFilter: '   ' })
    expect(out).toHaveLength(3)
  })

  it('sorts by updatedAt desc (canonical backend order, REQ-PM-001)', () => {
    const dated: PaymentMethodResponse[] = [
      makeRow({ id: 'a', updatedAt: '2024-01-01T00:00:00.000Z' }),
      makeRow({ id: 'b', updatedAt: '2024-06-01T00:00:00.000Z' }),
      makeRow({ id: 'c', updatedAt: '2024-03-01T00:00:00.000Z' }),
    ]
    const out = applyLocalPaymentMethodFilters(dated, {
      ...baseParams,
      sorting: [{ id: 'updatedAt', desc: true }],
    })
    expect(out.map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('sorts by category using the lowercase wire value (canonical key, REQ-PM-001)', () => {
    const out = applyLocalPaymentMethodFilters(rows, {
      ...baseParams,
      sorting: [{ id: 'category', desc: false }],
    })
    // Sorted categories (asc, case-sensitive): card_debit < transfer (a) < transfer (b)
    expect(out.map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })

  it('does not mutate the input array', () => {
    const input = [...rows]
    applyLocalPaymentMethodFilters(input, baseParams)
    expect(input).toEqual(rows)
  })
})

describe('paginatePaymentMethods (sdd custom-payment-methods S2A, REQ-PM-001)', () => {
  const rows: PaymentMethodResponse[] = Array.from({ length: 25 }, (_, i) =>
    makeRow({ id: `pm-${i + 1}`, name: `Method ${String(i + 1).padStart(2, '0')}` }),
  )

  it('returns the correct slice for page 0 pageSize 10', () => {
    const out = paginatePaymentMethods(rows, { pageIndex: 0, pageSize: 10 })
    expect(out.data).toHaveLength(10)
    expect(out.data[0]!.id).toBe('pm-1')
    expect(out.data[9]!.id).toBe('pm-10')
    expect(out.pagination.totalCount).toBe(25)
    expect(out.pagination.pageCount).toBe(3)
    expect(out.pagination.pageIndex).toBe(0)
    expect(out.pagination.pageSize).toBe(10)
  })

  it('returns the correct slice for page 2 pageSize 10 (last partial page)', () => {
    const out = paginatePaymentMethods(rows, { pageIndex: 2, pageSize: 10 })
    expect(out.data).toHaveLength(5)
    expect(out.data[0]!.id).toBe('pm-21')
  })

  // Edge case: empty dataset must NOT divide by zero (REO-PD-NOTE-002 pattern).
  it('returns pageCount=1 and the empty list for an empty dataset', () => {
    const out = paginatePaymentMethods([], { pageIndex: 0, pageSize: 10 })
    expect(out.data).toEqual([])
    expect(out.pagination.totalCount).toBe(0)
    expect(out.pagination.pageCount).toBe(1)
  })

  it('applies globalFilter BEFORE pagination so totalCount reflects it', () => {
    const out = paginatePaymentMethods(rows, {
      pageIndex: 0,
      pageSize: 10,
      globalFilter: 'Method 01',
    })
    expect(out.data).toHaveLength(1)
    expect(out.pagination.totalCount).toBe(1)
    expect(out.pagination.pageCount).toBe(1)
  })
})