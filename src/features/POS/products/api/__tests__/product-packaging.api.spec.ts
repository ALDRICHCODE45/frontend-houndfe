import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { productPackagingApi } from '../product-packaging.api'

vi.mock('@/core/shared/api/http', () => ({
  http: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const record = { weightG: 450, lengthCm: 20.5, widthCm: 12, heightCm: 8.3, updatedAt: '2026-11-06T18:00:00.000Z' }
const body = { weightG: 450, lengthCm: 20.5, widthCm: 12, heightCm: 8.3 }

describe('productPackagingApi — product packaging (handoff §4.1)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET /products/:productId/packaging returns { productId, packaging }', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { productId: 'p1', packaging: null } })
    await expect(productPackagingApi.getProduct('p1')).resolves.toEqual({ productId: 'p1', packaging: null })
    expect(http.get).toHaveBeenCalledWith('/products/p1/packaging')
  })

  it('PUT sends exactly the four fields as the whole record', async () => {
    vi.mocked(http.put).mockResolvedValue({ data: { productId: 'p1', packaging: record } })
    const result = await productPackagingApi.putProduct('p1', { ...body, updatedAt: 'x' } as never)
    expect(http.put).toHaveBeenCalledWith('/products/p1/packaging', body)
    expect(result.packaging).toEqual(record)
  })

  it('DELETE /products/:productId/packaging resolves on 204', async () => {
    vi.mocked(http.delete).mockResolvedValue({ status: 204, data: '' })
    await expect(productPackagingApi.removeProduct('p1')).resolves.toBeUndefined()
    expect(http.delete).toHaveBeenCalledWith('/products/p1/packaging')
  })
})

describe('productPackagingApi — variant override (handoff §4.2)', () => {
  beforeEach(() => vi.clearAllMocks())

  const variantResponse = {
    productId: 'p1',
    variantId: 'v1',
    override: null,
    productPackaging: record,
    effective: record,
    source: 'PRODUCT',
  }

  it('GET /products/:productId/variants/:variantId/packaging returns the effective record and its source', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: variantResponse })
    await expect(productPackagingApi.getVariant('p1', 'v1')).resolves.toEqual(variantResponse)
    expect(http.get).toHaveBeenCalledWith('/products/p1/variants/v1/packaging')
  })

  it('PUT the variant override with the same four-field body', async () => {
    vi.mocked(http.put).mockResolvedValue({ data: { ...variantResponse, source: 'VARIANT', override: record } })
    await productPackagingApi.putVariant('p1', 'v1', body)
    expect(http.put).toHaveBeenCalledWith('/products/p1/variants/v1/packaging', body)
  })

  it('DELETE the variant override goes back to inheriting', async () => {
    vi.mocked(http.delete).mockResolvedValue({ status: 204, data: '' })
    await expect(productPackagingApi.removeVariant('p1', 'v1')).resolves.toBeUndefined()
    expect(http.delete).toHaveBeenCalledWith('/products/p1/variants/v1/packaging')
  })
})
