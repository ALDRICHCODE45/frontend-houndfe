import { describe, it, expect } from 'vitest'
import { tenantFormSchema } from '../tenant.types'

describe('tenantFormSchema', () => {
  describe('name validation', () => {
    it('accepts valid name with min 2 chars', () => {
      const result = tenantFormSchema.safeParse({
        name: 'Mi Sucursal',
        slug: 'mi-sucursal',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty name', () => {
      const result = tenantFormSchema.safeParse({
        name: '',
        slug: 'valid-slug',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0]?.path).toContain('name')
      }
    })

    it('rejects name with only 1 character', () => {
      const result = tenantFormSchema.safeParse({
        name: 'A',
        slug: 'a',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0]?.path).toContain('name')
      }
    })
  })

  describe('slug validation', () => {
    it('accepts valid slug with lowercase, numbers, and hyphens', () => {
      const result = tenantFormSchema.safeParse({
        name: 'Sucursal Norte 2',
        slug: 'sucursal-norte-2',
      })
      expect(result.success).toBe(true)
    })

    it('rejects slug with uppercase letters', () => {
      const result = tenantFormSchema.safeParse({
        name: 'Sucursal Norte',
        slug: 'Sucursal-Norte',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const slugError = result.error.errors.find((e) => e.path.includes('slug'))
        expect(slugError).toBeDefined()
        expect(slugError?.message).toMatch(/minúsculas|números|guiones/i)
      }
    })

    it('rejects slug with special characters', () => {
      const result = tenantFormSchema.safeParse({
        name: 'Sucursal Norte',
        slug: 'sucursal-norte!',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const slugError = result.error.errors.find((e) => e.path.includes('slug'))
        expect(slugError).toBeDefined()
      }
    })

    it('rejects slug with spaces', () => {
      const result = tenantFormSchema.safeParse({
        name: 'Sucursal Norte',
        slug: 'sucursal norte',
      })
      expect(result.success).toBe(false)
    })

    it('rejects slug with leading dash', () => {
      const result = tenantFormSchema.safeParse({
        name: 'Sucursal',
        slug: '-sucursal',
      })
      expect(result.success).toBe(false)
    })

    it('rejects slug with trailing dash', () => {
      const result = tenantFormSchema.safeParse({
        name: 'Sucursal',
        slug: 'sucursal-',
      })
      expect(result.success).toBe(false)
    })

    it('rejects slug with consecutive dashes', () => {
      const result = tenantFormSchema.safeParse({
        name: 'Sucursal',
        slug: 'mi--sucursal',
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty slug', () => {
      const result = tenantFormSchema.safeParse({
        name: 'Valid Name',
        slug: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('optional fields', () => {
    it('accepts address and phone as optional', () => {
      const result = tenantFormSchema.safeParse({
        name: 'Sucursal Central',
        slug: 'central',
      })
      expect(result.success).toBe(true)
    })

    it('accepts address when provided', () => {
      const result = tenantFormSchema.safeParse({
        name: 'Sucursal Central',
        slug: 'central',
        address: 'Av. Rivadavia 1234',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.address).toBe('Av. Rivadavia 1234')
      }
    })

    it('accepts phone when provided', () => {
      const result = tenantFormSchema.safeParse({
        name: 'Sucursal Central',
        slug: 'central',
        phone: '+54 11 1234-5678',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.phone).toBe('+54 11 1234-5678')
      }
    })
  })

  describe('edit mode with isActive', () => {
    it('accepts isActive boolean in edit mode', () => {
      const editSchema = tenantFormSchema.extend({
        isActive: tenantFormSchema.shape.isActive,
      })
      const result = editSchema.safeParse({
        name: 'Sucursal Norte',
        slug: 'norte',
        isActive: false,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isActive).toBe(false)
      }
    })

    it('accepts isActive true', () => {
      const editSchema = tenantFormSchema.extend({
        isActive: tenantFormSchema.shape.isActive,
      })
      const result = editSchema.safeParse({
        name: 'Sucursal Norte',
        slug: 'norte',
        isActive: true,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isActive).toBe(true)
      }
    })
  })
})
