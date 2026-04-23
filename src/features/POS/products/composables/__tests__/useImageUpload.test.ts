import { describe, it, expect } from 'vitest'
import { validateImageFiles } from '../useImageUpload'
import { MAX_IMAGE_SIZE_BYTES } from '../../interfaces/product.types'

describe('validateImageFiles - pure validation function', () => {

  describe('invalid MIME type', () => {
    it('should reject files with invalid MIME types and include Spanish error message', () => {
      const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' })

      const result = validateImageFiles([invalidFile])

      expect(result.valid).toHaveLength(0)
      expect(result.invalid).toHaveLength(1)
      expect(result.invalid[0]?.file).toBe(invalidFile)
      expect(result.invalid[0]?.reason).toContain('Formato no soportado')
      expect(result.invalid[0]?.reason).toContain('JPG, PNG, WEBP o GIF')
    })

    it('should reject multiple invalid MIME types', () => {
      const file1 = new File(['content'], 'doc.pdf', { type: 'application/pdf' })
      const file2 = new File(['content'], 'video.mp4', { type: 'video/mp4' })

      const result = validateImageFiles([file1, file2])

      expect(result.valid).toHaveLength(0)
      expect(result.invalid).toHaveLength(2)
    })
  })

  describe('file too large', () => {
    it('should reject files larger than 10 MB with Spanish error', () => {
      const largeFile = new File(
        [new ArrayBuffer(MAX_IMAGE_SIZE_BYTES + 1)],
        'large.jpg',
        { type: 'image/jpeg' },
      )

      const result = validateImageFiles([largeFile])

      expect(result.valid).toHaveLength(0)
      expect(result.invalid).toHaveLength(1)
      expect(result.invalid[0]?.file).toBe(largeFile)
      expect(result.invalid[0]?.reason).toContain('imagen no puede pesar más de 10 MB')
    })

    it('should accept files exactly at 10 MB limit', () => {
      const exactFile = new File(
        [new ArrayBuffer(MAX_IMAGE_SIZE_BYTES)],
        'exact.jpg',
        { type: 'image/jpeg' },
      )

      const result = validateImageFiles([exactFile])

      expect(result.valid).toHaveLength(1)
      expect(result.valid[0]).toBe(exactFile)
      expect(result.invalid).toHaveLength(0)
    })
  })

  describe('mixed valid and invalid batch', () => {
    it('should separate valid and invalid files correctly', () => {
      const validFile1 = new File(['content'], 'valid1.jpg', { type: 'image/jpeg' })
      const invalidFile = new File(['content'], 'invalid.txt', { type: 'text/plain' })
      const validFile2 = new File(['content'], 'valid2.png', { type: 'image/png' })

      const result = validateImageFiles([validFile1, invalidFile, validFile2])

      expect(result.valid).toHaveLength(2)
      expect(result.valid[0]).toBe(validFile1)
      expect(result.valid[1]).toBe(validFile2)
      expect(result.invalid).toHaveLength(1)
      expect(result.invalid[0]?.file).toBe(invalidFile)
    })

    it('should validate WebP and GIF as valid formats', () => {
      const webpFile = new File(['content'], 'image.webp', { type: 'image/webp' })
      const gifFile = new File(['content'], 'animation.gif', { type: 'image/gif' })

      const result = validateImageFiles([webpFile, gifFile])

      expect(result.valid).toHaveLength(2)
      expect(result.valid[0]).toBe(webpFile)
      expect(result.valid[1]).toBe(gifFile)
      expect(result.invalid).toHaveLength(0)
    })
  })
})
