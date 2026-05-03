import { describe, it, expect, beforeEach } from 'vitest'
import { useTenantForm } from '../useTenantForm'

describe('useTenantForm', () => {
  describe('create mode', () => {
    it('should auto-generate slug from name when slug has not been manually edited', () => {
      const { createState, updateName, isSlugManuallyEdited } = useTenantForm('create')

      updateName('Sucursal Poniente')

      expect(createState.slug).toBe('sucursal-poniente')
      expect(isSlugManuallyEdited.value).toBe(false)
    })

    it('should auto-generate normalized slug with multiple consecutive spaces and special chars', () => {
      const { createState, updateName } = useTenantForm('create')

      updateName('Sucursal   Norte  -  2024!')

      expect(createState.slug).toBe('sucursal-norte-2024')
    })

    it('should persist manual slug override when name changes', () => {
      const { createState, updateName, updateSlug } = useTenantForm('create')

      updateName('Sucursal Norte')
      expect(createState.slug).toBe('sucursal-norte')

      updateSlug('custom-slug')
      expect(createState.slug).toBe('custom-slug')

      updateName('Another Name')
      expect(createState.slug).toBe('custom-slug')
    })

    it('should mark slug as manually edited after updateSlug is called', () => {
      const { updateSlug, isSlugManuallyEdited } = useTenantForm('create')

      expect(isSlugManuallyEdited.value).toBe(false)

      updateSlug('manual-override')

      expect(isSlugManuallyEdited.value).toBe(true)
    })

    it('should initialize with empty create state', () => {
      const { createState } = useTenantForm('create')

      expect(createState.name).toBe('')
      expect(createState.slug).toBe('')
      expect(createState.address).toBe('')
      expect(createState.phone).toBe('')
    })

    it('should reset to empty state on resetForm', () => {
      const { createState, updateName, updateSlug, resetForm } = useTenantForm('create')

      updateName('Sucursal Centro')
      updateSlug('custom')

      resetForm()

      expect(createState.name).toBe('')
      expect(createState.slug).toBe('')
      expect(createState.address).toBe('')
      expect(createState.phone).toBe('')
    })

    it('should reset isSlugManuallyEdited flag on resetForm', () => {
      const { updateSlug, resetForm, isSlugManuallyEdited } = useTenantForm('create')

      updateSlug('manual')
      expect(isSlugManuallyEdited.value).toBe(true)

      resetForm()

      expect(isSlugManuallyEdited.value).toBe(false)
    })
  })

  describe('edit mode', () => {
    it('should prefill form state from setValues', () => {
      const { editState, setValues } = useTenantForm('edit')

      setValues({
        name: 'Sucursal Centro',
        slug: 'centro',
        address: 'Av. Principal 123',
        phone: '555-1234',
        isActive: true,
      })

      expect(editState.name).toBe('Sucursal Centro')
      expect(editState.slug).toBe('centro')
      expect(editState.address).toBe('Av. Principal 123')
      expect(editState.phone).toBe('555-1234')
      expect(editState.isActive).toBe(true)
    })

    it('should handle partial setValues for optional fields', () => {
      const { editState, setValues } = useTenantForm('edit')

      setValues({
        name: 'Norte',
        slug: 'norte',
      })

      expect(editState.name).toBe('Norte')
      expect(editState.slug).toBe('norte')
      expect(editState.address).toBe('')
      expect(editState.phone).toBe('')
    })

    it('should initialize with empty edit state', () => {
      const { editState } = useTenantForm('edit')

      expect(editState.name).toBe('')
      expect(editState.slug).toBe('')
      expect(editState.address).toBe('')
      expect(editState.phone).toBe('')
      expect(editState.isActive).toBe(undefined)
    })

    it('should return editTenantSchema with isActive field', () => {
      const { schema } = useTenantForm('edit')

      const validPayload = {
        name: 'Centro',
        slug: 'centro',
        address: 'Av. 1',
        phone: '555',
        isActive: false,
      }

      const result = schema.value.safeParse(validPayload)

      expect(result.success).toBe(true)
      if (result.success && 'isActive' in result.data) {
        expect(result.data.isActive).toBe(false)
      }
    })
  })

  describe('validation schema', () => {
    describe('create mode', () => {
      let schema: ReturnType<typeof useTenantForm>['schema']

      beforeEach(() => {
        const form = useTenantForm('create')
        schema = form.schema
      })

      it('should reject empty name', () => {
        const result = schema.value.safeParse({ name: '', slug: 'valid-slug' })

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0]?.path).toEqual(['name'])
        }
      })

      it('should reject name shorter than 2 chars', () => {
        const result = schema.value.safeParse({ name: 'A', slug: 'valid' })

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('2 caracteres')
        }
      })

      it('should accept valid slug with lowercase, numbers, and hyphens', () => {
        const result = schema.value.safeParse({
          name: 'Valid',
          slug: 'sucursal-norte-2',
        })

        expect(result.success).toBe(true)
      })

      it('should reject slug with uppercase letters', () => {
        const result = schema.value.safeParse({
          name: 'Valid',
          slug: 'Sucursal-Norte',
        })

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0]?.message).toMatch(/minúsculas.*números.*guiones/i)
        }
      })

      it('should reject slug with special characters', () => {
        const result = schema.value.safeParse({
          name: 'Valid',
          slug: 'sucursal_norte!',
        })

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0]?.message).toMatch(/minúsculas.*números.*guiones/i)
        }
      })

      it('should reject slug with leading dash', () => {
        const result = schema.value.safeParse({
          name: 'Valid',
          slug: '-leading',
        })

        expect(result.success).toBe(false)
      })

      it('should reject slug with trailing dash', () => {
        const result = schema.value.safeParse({
          name: 'Valid',
          slug: 'trailing-',
        })

        expect(result.success).toBe(false)
      })

      it('should reject slug with consecutive dashes', () => {
        const result = schema.value.safeParse({
          name: 'Valid',
          slug: 'double--dash',
        })

        expect(result.success).toBe(false)
      })

      it('should accept optional address field', () => {
        const result = schema.value.safeParse({
          name: 'Valid',
          slug: 'valid',
          address: 'Av. Principal 123',
        })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.address).toBe('Av. Principal 123')
        }
      })

      it('should accept optional phone field', () => {
        const result = schema.value.safeParse({
          name: 'Valid',
          slug: 'valid',
          phone: '555-1234',
        })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.phone).toBe('555-1234')
        }
      })
    })
  })
})
