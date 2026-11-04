/**
 * O1 S1 — the transport is the last line of defence: even if a caller forces
 * `quantity` into an edit payload, no PATCH carries it. Creates keep it.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { productApi } from '../product.api'

vi.mock('@/core/shared/api/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const forced = <T extends object>(payload: T) => payload as never

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(http.patch).mockResolvedValue({
    data: { id: 'x', name: 'x', createdAt: '', updatedAt: '' },
  })
  vi.mocked(http.post).mockResolvedValue({
    data: { id: 'x', name: 'x', createdAt: '', updatedAt: '' },
  })
})

describe('productApi edit PATCHes strip quantity', () => {
  it('PATCH /products/:id', async () => {
    await productApi.update('p1', forced({ name: 'A', quantity: 9, minQuantity: 1 }))
    expect(http.patch).toHaveBeenCalledWith('/products/p1', { name: 'A', minQuantity: 1 })
  })

  it('PATCH /products/:id/variants/:variantId', async () => {
    await productApi.updateVariant('p1', 'v1', forced({ sku: 'S', quantity: 0 }))
    expect(http.patch).toHaveBeenCalledWith('/products/p1/variants/v1', { sku: 'S' })
  })

  it('PATCH /products/:id/lots/:lotId', async () => {
    await productApi.updateLot('p1', 'l1', forced({ lotNumber: 'L', quantity: 3 }))
    expect(http.patch).toHaveBeenCalledWith('/products/p1/lots/l1', { lotNumber: 'L' })
  })

  it('strips quantity null as well (the backend rejects the key, not the value)', async () => {
    await productApi.update('p1', forced({ name: 'A', quantity: null }))
    expect(vi.mocked(http.patch).mock.calls[0]![1]).not.toHaveProperty('quantity')
  })
})

describe('productApi creates keep quantity', () => {
  it('POST /products', async () => {
    await productApi.create({ name: 'A', quantity: 7 } as never)
    expect(http.post).toHaveBeenCalledWith('/products', { name: 'A', quantity: 7 })
  })

  it('POST /products/:id/variants', async () => {
    await productApi.createVariant('p1', { option: 'Talla', value: 'M', quantity: 4 })
    expect(http.post).toHaveBeenCalledWith('/products/p1/variants', {
      option: 'Talla',
      value: 'M',
      quantity: 4,
    })
  })

  it('POST /products/:id/lots', async () => {
    const lot = { lotNumber: 'L1', quantity: 10, expirationDate: '2027-01-01' }
    await productApi.createLot('p1', lot)
    expect(http.post).toHaveBeenCalledWith('/products/p1/lots', lot)
  })
})
