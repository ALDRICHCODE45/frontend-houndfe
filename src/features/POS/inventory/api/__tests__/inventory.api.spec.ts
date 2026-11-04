import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { inventoryApi } from '../inventory.api'
import type { AdjustmentInput } from '../../interfaces/inventory.types'

vi.mock('@/core/shared/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() } }))

const signal = new AbortController().signal
beforeEach(() => vi.resetAllMocks())

describe('inventory transport', () => {
  it('reads the stock of a product with an encoded id, no query string and the abort signal', async () => {
    const stock = { product: { id: 'a/b' }, lots: [], variants: [] }
    vi.mocked(http.get).mockResolvedValue({ data: stock })
    expect(await inventoryApi.getStock('a/b', signal)).toEqual(stock)
    expect(http.get).toHaveBeenCalledExactlyOnceWith('/inventory/products/a%2Fb/stock', { signal })
  })

  it('lists movements with only the contract params and drops injected ones', async () => {
    const page = { items: [], nextCursor: null }
    vi.mocked(http.get).mockResolvedValue({ data: page })
    expect(await inventoryApi.listMovements(
      { productId: 'p1', lotId: 'l1', cursor: 'c', limit: 25, tenantId: 'x' } as never, signal)).toEqual(page)
    expect(http.get).toHaveBeenCalledExactlyOnceWith('/inventory/movements', {
      params: { productId: 'p1', variantId: undefined, lotId: 'l1', cursor: 'c', limit: 25 }, signal,
    })
  })

  it('filters by variant on its own', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { items: [], nextCursor: null } })
    await inventoryApi.listMovements({ productId: 'p1', variantId: 'v1' })
    expect(vi.mocked(http.get).mock.calls[0]![1]!.params).toEqual({
      productId: 'p1', variantId: 'v1', lotId: undefined, cursor: undefined, limit: undefined,
    })
  })

  it('posts an adjustment with the Idempotency-Key header and a closed body', async () => {
    const result = { movement: { id: 'm' }, stock: { product: { id: 'p1' } } }
    vi.mocked(http.post).mockResolvedValue({ data: result })
    const input = {
      target: { productId: 'p1', lotId: 'l1', tenantId: 'x' }, expectedVersion: 3, delta: -8, reason: 'EXPIRED',
      note: 'Lote vencido', tenantId: 'x', actor: 'me',
    } as unknown as AdjustmentInput
    expect(await inventoryApi.adjust(input, 'key-1', signal)).toEqual(result)
    expect(http.post).toHaveBeenCalledExactlyOnceWith('/inventory/adjustments', {
      target: { productId: 'p1', lotId: 'l1' }, expectedVersion: 3, delta: -8, reason: 'EXPIRED', note: 'Lote vencido',
    }, { headers: { 'Idempotency-Key': 'key-1' }, signal })
  })

  it('targets the untracked bucket and a variant, and omits the note when absent', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: {} })
    await inventoryApi.adjust({ target: { productId: 'p1' }, expectedVersion: 0, delta: 5, reason: 'PHYSICAL_COUNT' }, 'k1')
    await inventoryApi.adjust({ target: { productId: 'p1', variantId: 'v1' }, expectedVersion: 1, delta: 2, reason: 'DAMAGE' }, 'k2')
    const bodies = vi.mocked(http.post).mock.calls.map(call => call[1])
    expect(bodies[0]).toStrictEqual({ target: { productId: 'p1' }, expectedVersion: 0, delta: 5, reason: 'PHYSICAL_COUNT' })
    expect(bodies[1]).toStrictEqual({
      target: { productId: 'p1', variantId: 'v1' }, expectedVersion: 1, delta: 2, reason: 'DAMAGE',
    })
  })
})
