import { describe, it, expect, vi, beforeEach } from 'vitest'
import { productApi } from '../product.api'
import { http } from '@/core/shared/api/http'
import type {
  ProductImage,
  ProductBackendResponse,
  ProductBackendListResponse,
} from '../../interfaces/product.types'

vi.mock('@/core/shared/api/http', () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('productApi - Image Upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('uploadProductImage', () => {
    it('should POST multipart FormData to /products/:id/images/upload with field name "file"', async () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      const mockResponse: ProductImage = {
        id: 'img-1',
        productId: 'prod-1',
        variantId: null,
        url: 'https://cdn.example.com/img-1.jpg',
        isMain: false,
        sortOrder: 0,
        createdAt: '2026-04-23T10:00:00Z',
        fileId: 'file-123',
      }

      vi.mocked(http.post).mockResolvedValue({ data: mockResponse })

      const result = await productApi.uploadProductImage('prod-1', mockFile)

      expect(http.post).toHaveBeenCalledWith(
        '/products/prod-1/images/upload',
        expect.any(FormData),
      )

      const calls = vi.mocked(http.post).mock.calls
      const formData = calls[0]?.[1]
      expect(formData).toBeInstanceOf(FormData)
      expect((formData as FormData).get('file')).toBe(mockFile)
      expect(result).toEqual(mockResponse)
    })

    it('should handle uploads with different file types', async () => {
      const mockFile = new File(['content'], 'test.png', { type: 'image/png' })
      const mockResponse: ProductImage = {
        id: 'img-2',
        productId: 'prod-1',
        variantId: null,
        url: 'https://cdn.example.com/img-2.png',
        isMain: false,
        sortOrder: 1,
        createdAt: '2026-04-23T11:00:00Z',
        fileId: 'file-456',
      }

      vi.mocked(http.post).mockResolvedValue({ data: mockResponse })

      const result = await productApi.uploadProductImage('prod-1', mockFile)

      const calls = vi.mocked(http.post).mock.calls
      const formData = calls[0]?.[1]
      expect((formData as FormData).get('file')).toBe(mockFile)
      expect(result.fileId).toBe('file-456')
    })
  })

  describe('uploadVariantImage', () => {
    it('should POST multipart FormData to /products/:id/variants/:variantId/images/upload with field name "file"', async () => {
      const mockFile = new File(['content'], 'variant.jpg', { type: 'image/jpeg' })
      const mockResponse: ProductImage = {
        id: 'img-3',
        productId: 'prod-1',
        variantId: 'var-1',
        url: 'https://cdn.example.com/img-3.jpg',
        isMain: false,
        sortOrder: 0,
        createdAt: '2026-04-23T12:00:00Z',
        fileId: 'file-789',
      }

      vi.mocked(http.post).mockResolvedValue({ data: mockResponse })

      const result = await productApi.uploadVariantImage('prod-1', 'var-1', mockFile)

      expect(http.post).toHaveBeenCalledWith(
        '/products/prod-1/variants/var-1/images/upload',
        expect.any(FormData),
      )

      const calls = vi.mocked(http.post).mock.calls
      const formData = calls[0]?.[1]
      expect(formData).toBeInstanceOf(FormData)
      expect((formData as FormData).get('file')).toBe(mockFile)
      expect(result).toEqual(mockResponse)
    })

    it('should handle variant uploads with different products and variants', async () => {
      const mockFile = new File(['content'], 'variant2.webp', { type: 'image/webp' })
      const mockResponse: ProductImage = {
        id: 'img-4',
        productId: 'prod-2',
        variantId: 'var-2',
        url: 'https://cdn.example.com/img-4.webp',
        isMain: true,
        sortOrder: 0,
        createdAt: '2026-04-23T13:00:00Z',
        fileId: 'file-999',
      }

      vi.mocked(http.post).mockResolvedValue({ data: mockResponse })

      const result = await productApi.uploadVariantImage('prod-2', 'var-2', mockFile)

      expect(http.post).toHaveBeenCalledWith(
        '/products/prod-2/variants/var-2/images/upload',
        expect.any(FormData),
      )
      expect(result.variantId).toBe('var-2')
      expect(result.fileId).toBe('file-999')
    })
  })
})

// ─── getPaginated ─────────────────────────────────────────────────────────────
// As of this change, GET /products uses a strict whitelist on the backend and
// rejects sortBy/sortOrder with HTTP 400. The client must therefore:
//   - NEVER send sortBy / sortOrder / page / limit (the latter two would
//     trigger server-side pagination on a non-server-paginated endpoint)
//   - apply sorting client-side from the returned flat array
//   - paginate client-side from the returned flat array
// Search is server-side: search/q are accepted by the whitelist and are kept.

const buildProductBackendRow = (overrides: Partial<ProductBackendResponse>): ProductBackendResponse => ({
  id: 'p',
  name: 'Placeholder',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('productApi.getPaginated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does NOT send sortBy, sortOrder, page, or limit to /products', async () => {
    const flat = [buildProductBackendRow({ id: 'p1', name: 'Alpha' })]
    vi.mocked(http.get).mockResolvedValue({ data: flat })

    await productApi.getPaginated({
      pageIndex: 0,
      pageSize: 10,
      sorting: [{ id: 'name', desc: false }],
    })

    const calls = vi.mocked(http.get).mock.calls
    expect(calls[0]?.[0]).toBe('/products')
    const params = calls[0]?.[1]?.params as Record<string, unknown> | undefined
    expect(params).toBeDefined()
    expect(params).not.toHaveProperty('sortBy')
    expect(params).not.toHaveProperty('sortOrder')
    expect(params).not.toHaveProperty('page')
    expect(params).not.toHaveProperty('limit')
  })

  it('sends search and q (both aliases) when globalFilter is provided', async () => {
    const flat = [buildProductBackendRow({ id: 'p1', name: 'Alpha' })]
    vi.mocked(http.get).mockResolvedValue({ data: flat })

    await productApi.getPaginated({
      pageIndex: 0,
      pageSize: 10,
      globalFilter: 'alpha',
    })

    const calls = vi.mocked(http.get).mock.calls
    const params = calls[0]?.[1]?.params as Record<string, unknown> | undefined
    expect(params).toBeDefined()
    expect(params).toEqual({ search: 'alpha', q: 'alpha' })
  })

  it('applies local sorting to the returned flat array (no server sort)', async () => {
    const flat = [
      buildProductBackendRow({ id: 'p1', name: 'Banana' }),
      buildProductBackendRow({ id: 'p2', name: 'Apple' }),
    ]
    vi.mocked(http.get).mockResolvedValue({ data: flat })

    const result = await productApi.getPaginated({
      pageIndex: 0,
      pageSize: 10,
      sorting: [{ id: 'name', desc: true }],
    })

    expect(result.data.map((r) => r.name)).toEqual(['Banana', 'Apple'])
    expect(result.pagination.totalCount).toBe(2)
  })

  it('applies local sorting and pagination to a {data:[...]} envelope without server pagination meta', async () => {
    // The {data:[...]} envelope shape is what the backend returns when it
    // does NOT paginate server-side. We must still apply client-side sort
    // and slice; otherwise we'd either skip sorting (wrong order) or apply
    // no pagination (too many rows).
    const envelope: { data: ProductBackendResponse[] } = {
      data: [
        buildProductBackendRow({ id: 'p1', name: 'Banana' }),
        buildProductBackendRow({ id: 'p2', name: 'Apple' }),
        buildProductBackendRow({ id: 'p3', name: 'Cherry' }),
      ],
    }
    vi.mocked(http.get).mockResolvedValue({ data: envelope })

    const result = await productApi.getPaginated({
      pageIndex: 0,
      pageSize: 2,
      sorting: [{ id: 'name', desc: false }],
    })

    // Sorted asc by name, then paginated to first 2.
    expect(result.data.map((r) => r.name)).toEqual(['Apple', 'Banana'])
    expect(result.pagination.totalCount).toBe(3)
    expect(result.pagination.pageCount).toBe(2)
  })
})
