import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { purchaseOrdersApi } from '../purchase-orders.api'
import type { OrderInput, PurchaseOrder, PurchaseOrderPage } from '../../interfaces/purchase-order.types'

vi.mock('@/core/shared/api/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const orderId = '33333333-3333-4333-8333-333333333333'
const input: OrderInput = {
  supplierId: '22222222-2222-4222-8222-222222222222',
  note: null,
  location: { detail: null },
  lines: [{
    lineId: '44444444-4444-4444-8444-444444444444', productId: null, variantId: null, orderedQuantity: '2.500',
    informedUnitCost: { amount: '0', currency: 'MXN', unit: null, taxBasis: null },
  }],
}
const order = {
  ...input, id: orderId, version: 1, status: 'DRAFT', createdAt: '2026-11-03T00:00:00.000Z',
  updatedAt: '2026-11-03T00:00:00.000Z', supplierDisplaySnapshot: null, lineDisplaySnapshots: [], lineSubtotals: [],
  locationSnapshot: { tenantId: 't', tenantName: 'Sucursal', detail: null }, validation: { issues: [] },
  supplierCurrentVersion: null, referenceToken: null, canConfirm: false,
  confirmedAt: null, confirmedBy: null, cancelledAt: null, cancelledBy: null,
} as PurchaseOrder

describe('purchase order transport', () => {
  beforeEach(() => vi.resetAllMocks())

  it('lists with server search, supplier filter, cursor, limit and abort signal only', async () => {
    const signal = new AbortController().signal
    const page = { items: [], nextCursor: null }
    vi.mocked(http.get).mockResolvedValue({ data: page })
    expect(await purchaseOrdersApi.list({ supplierId: input.supplierId!, search: '  nota  ', cursor: 'c', limit: 25, tenantId: 'x' } as never, signal)).toEqual(page)
    expect(http.get).toHaveBeenCalledExactlyOnceWith('/procurement/purchase-orders', {
      params: { supplierId: input.supplierId, search: '  nota  ', cursor: 'c', limit: 25 }, signal,
    })
  })

  it('passes the server list totals through untouched: one entry, two bases (never summed) or null', async () => {
    const summary = { version: 1, status: 'DRAFT' as const, supplierDisplaySnapshot: null, lineCount: 2, issueCount: 0, note: null, locationDetail: null, createdAt: '2026-11-03T00:00:00.000Z', updatedAt: '2026-11-03T00:00:00.000Z' }
    const page: PurchaseOrderPage = {
      items: [
        { ...summary, id: 'one', totals: [{ amount: '1540.00', currency: 'MXN', taxBasis: 'EXCLUDES_TAX' }] },
        { ...summary, id: 'mixed', totals: [{ amount: '1000.5000', currency: 'MXN', taxBasis: 'EXCLUDES_TAX' }, { amount: '580.00', currency: 'MXN', taxBasis: 'INCLUDES_TAX' }] },
        { ...summary, id: 'none', totals: null },
      ],
      nextCursor: null,
    }
    vi.mocked(http.get).mockResolvedValue({ data: page })
    const result = await purchaseOrdersApi.list({})
    expect(result.items.map(item => item.totals?.length ?? null)).toEqual([1, 2, null])
    expect(result.items[1]!.totals).toEqual([{ amount: '1000.5000', currency: 'MXN', taxBasis: 'EXCLUDES_TAX' }, { amount: '580.00', currency: 'MXN', taxBasis: 'INCLUDES_TAX' }])
  })

  it('sends the single status filter and omits it when absent', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { items: [], nextCursor: null } })
    await purchaseOrdersApi.list({ status: 'CONFIRMED' })
    expect(http.get).toHaveBeenLastCalledWith('/procurement/purchase-orders', {
      params: { supplierId: undefined, search: undefined, cursor: undefined, limit: undefined, status: 'CONFIRMED' }, signal: undefined,
    })
  })

  it('confirms with exactly the three server-issued expectations and the caller-owned key', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { ...order, status: 'CONFIRMED', version: 2 } })
    const signal = new AbortController().signal
    const injected = { expectedVersion: 1, expectedSupplierVersion: 4, expectedReferenceToken: 'opaque', canConfirm: true } as never
    await purchaseOrdersApi.confirm(orderId, injected, 'confirm-key', signal)
    expect(http.post).toHaveBeenCalledExactlyOnceWith('/procurement/purchase-orders/' + orderId + '/confirm',
      { expectedVersion: 1, expectedSupplierVersion: 4, expectedReferenceToken: 'opaque' },
      { headers: { 'Idempotency-Key': 'confirm-key' }, signal })
  })

  it('cancels with a closed CAS body and no reason', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { ...order, status: 'CANCELLED', version: 2 } })
    const signal = new AbortController().signal
    await purchaseOrdersApi.cancel(orderId, { expectedVersion: 1, reason: 'x' } as never, 'cancel-key', signal)
    expect(http.post).toHaveBeenCalledExactlyOnceWith('/procurement/purchase-orders/' + orderId + '/cancel',
      { expectedVersion: 1 }, { headers: { 'Idempotency-Key': 'cancel-key' }, signal })
  })

  it('reads one order by encoded id', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: order })
    const signal = new AbortController().signal
    expect(await purchaseOrdersApi.get(orderId, signal)).toEqual(order)
    expect(http.get).toHaveBeenCalledExactlyOnceWith('/procurement/purchase-orders/' + orderId, { signal })
  })

  it('creates with a closed body and the caller-owned key, keeping canonical strings untouched', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: order })
    const signal = new AbortController().signal
    const injected = { ...input, status: 'DRAFT', lines: [{ ...input.lines[0], subtotal: '1' }] } as never
    expect(await purchaseOrdersApi.create(injected, 'create-key', signal)).toEqual(order)
    expect(http.post).toHaveBeenCalledExactlyOnceWith('/procurement/purchase-orders', input,
      { headers: { 'Idempotency-Key': 'create-key' }, signal })
  })

  it('replaces the whole draft with CAS through PUT /draft', async () => {
    vi.mocked(http.put).mockResolvedValue({ data: { ...order, version: 2 } })
    const signal = new AbortController().signal
    await purchaseOrdersApi.saveDraft(orderId, { expectedVersion: 1, order: input }, 'save-key', signal)
    expect(http.put).toHaveBeenCalledExactlyOnceWith('/procurement/purchase-orders/' + orderId + '/draft',
      { expectedVersion: 1, order: input }, { headers: { 'Idempotency-Key': 'save-key' }, signal })
  })

  it('discards with DELETE and a closed CAS body', async () => {
    vi.mocked(http.delete).mockResolvedValue({ status: 204 })
    const signal = new AbortController().signal
    await purchaseOrdersApi.delete(orderId, { expectedVersion: 3 }, 'delete-key', signal)
    expect(http.delete).toHaveBeenCalledExactlyOnceWith('/procurement/purchase-orders/' + orderId, {
      data: { expectedVersion: 3 }, headers: { 'Idempotency-Key': 'delete-key' }, signal,
    })
  })
})
