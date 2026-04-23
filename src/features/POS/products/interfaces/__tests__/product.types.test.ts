import { describe, it, expect } from 'vitest'
import type { ProductImage } from '../product.types'
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES } from '../product.types'

describe('product.types - Image Upload Types', () => {
  describe('ProductImage.fileId', () => {
    it('should accept fileId as string for uploaded files', () => {
      const image: ProductImage = {
        id: 'img-1',
        productId: 'prod-1',
        variantId: null,
        url: 'https://cdn.example.com/img-1.jpg',
        isMain: false,
        sortOrder: 0,
        createdAt: '2026-04-23T10:00:00Z',
        fileId: 'file-123',
      }

      expect(image.fileId).toBe('file-123')
      expect(typeof image.fileId).toBe('string')
    })

    it('should accept fileId as null for legacy URL images', () => {
      const image: ProductImage = {
        id: 'img-2',
        productId: 'prod-1',
        variantId: null,
        url: 'https://external.com/legacy.jpg',
        isMain: true,
        sortOrder: 0,
        createdAt: '2026-04-23T10:00:00Z',
        fileId: null,
      }

      expect(image.fileId).toBeNull()
    })
  })

  describe('ALLOWED_IMAGE_MIME_TYPES', () => {
    it('should include jpeg, png, webp, and gif', () => {
      expect(ALLOWED_IMAGE_MIME_TYPES).toContain('image/jpeg')
      expect(ALLOWED_IMAGE_MIME_TYPES).toContain('image/png')
      expect(ALLOWED_IMAGE_MIME_TYPES).toContain('image/webp')
      expect(ALLOWED_IMAGE_MIME_TYPES).toContain('image/gif')
      expect(ALLOWED_IMAGE_MIME_TYPES).toHaveLength(4)
    })

    it('should be readonly tuple', () => {
      expect(Array.isArray(ALLOWED_IMAGE_MIME_TYPES)).toBe(true)
      expect(ALLOWED_IMAGE_MIME_TYPES.length).toBeGreaterThan(0)
    })
  })

  describe('MAX_IMAGE_SIZE_BYTES', () => {
    it('should be 10 MB (10 * 1024 * 1024 bytes)', () => {
      expect(MAX_IMAGE_SIZE_BYTES).toBe(10 * 1024 * 1024)
      expect(MAX_IMAGE_SIZE_BYTES).toBe(10485760)
    })
  })
})
