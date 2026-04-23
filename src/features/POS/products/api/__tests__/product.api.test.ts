import { describe, it, expect, vi, beforeEach } from 'vitest'
import { productApi } from '../product.api'
import { http } from '@/core/shared/api/http'
import type { ProductImage } from '../../interfaces/product.types'

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
