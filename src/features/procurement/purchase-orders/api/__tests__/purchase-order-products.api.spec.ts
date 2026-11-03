import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { purchaseOrderProductsApi } from '../purchase-order-products.api'
vi.mock('@/core/shared/api/http', () => ({ http: { get: vi.fn() } }))
beforeEach(() => vi.resetAllMocks())
describe('purchase order product adapter', () => {
  it('sends PRODUCT filter to the server and projects only picker fields from the plain array', async () => {
    const product = { id: 'p', name: 'Arroz', type: 'PRODUCT', unit: 'KILOGRAMO', hasVariants: true, useStock: false }
    vi.mocked(http.get).mockResolvedValue({ data: [{ ...product, price: '123', privateField: 'omit' }] })
    const signal = new AbortController().signal
    expect(await purchaseOrderProductsApi.list({ search: ' arroz ', page: 2, limit: 25 }, signal)).toEqual([product])
    expect(http.get).toHaveBeenCalledExactlyOnceWith('/products', { params: { search: ' arroz ', type: 'PRODUCT', page: 2, limit: 25 }, signal })
  })
  it('reads encoded product variants as a plain array without filtering', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: [{ id: 'v', name: 'Grande', active: false, catalogPublishMode: 'HIDDEN' }, { id: 'w', name: 'Chico', archived: true }] })
    const signal = new AbortController().signal
    expect(await purchaseOrderProductsApi.variants('p/a', signal)).toEqual([{ id: 'v', name: 'Grande' }, { id: 'w', name: 'Chico' }])
    expect(http.get).toHaveBeenCalledExactlyOnceWith('/products/p%2Fa/variants', { signal })
  })
})
