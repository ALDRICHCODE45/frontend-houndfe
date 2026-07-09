import { describe, it, expect } from 'vitest'
import { useUserForm, type CreateUserFormValues, type EditUserFormValues } from '../useUserForm'

describe('useUserForm', () => {
  describe('create mode', () => {
    it('exposes the create schema in create mode', () => {
      const { schema } = useUserForm('create')
      // Schema must be a Zod schema with a parse method — plain (non-computed)
      // to keep UForm :schema binding as-is.
      expect(schema).toBeDefined()
      expect(typeof (schema as { parse?: unknown }).parse).toBe('function')
    })

    it('initializes createState with empty roleId', () => {
      const { createState } = useUserForm('create')

      expect(createState.roleId).toBe('')
    })

    it('initializes createState with the four create fields (name, email, password, roleId)', () => {
      const { createState } = useUserForm('create')

      const expected: CreateUserFormValues = {
        name: '',
        email: '',
        password: '',
        roleId: '',
      }
      expect(createState).toEqual(expected)
    })

    it('create schema rejects an empty roleId', () => {
      const { schema } = useUserForm('create')

      const result = (schema as { safeParse: (v: unknown) => { success: boolean } }).safeParse({
        name: 'Rodrigo',
        email: 'r@test.com',
        password: 'longenough1',
        roleId: '',
      })

      expect(result.success).toBe(false)
    })

    it('create schema rejects a non-UUID roleId', () => {
      const { schema } = useUserForm('create')

      const result = (schema as { safeParse: (v: unknown) => { success: boolean } }).safeParse({
        name: 'Rodrigo',
        email: 'r@test.com',
        password: 'longenough1',
        roleId: 'not-a-uuid',
      })

      expect(result.success).toBe(false)
    })

    it('create schema accepts a valid UUID roleId', () => {
      const { schema } = useUserForm('create')

      const result = (schema as { safeParse: (v: unknown) => { success: boolean } }).safeParse({
        name: 'Rodrigo',
        email: 'r@test.com',
        password: 'longenough1',
        roleId: 'abd93355-a3dc-4ae7-8f17-877ff3986d2c',
      })

      expect(result.success).toBe(true)
    })

    it('resetForm clears createState including roleId', () => {
      const { createState, resetForm } = useUserForm('create')

      createState.roleId = 'abd93355-a3dc-4ae7-8f17-877ff3986d2c'
      createState.email = 'foo@bar.com'

      resetForm()

      expect(createState.roleId).toBe('')
      expect(createState.email).toBe('')
    })
  })

  describe('edit mode', () => {
    it('exposes the edit schema in edit mode (no roleId required — edit does not send roleId)', () => {
      const { schema } = useUserForm('edit')

      expect(schema).toBeDefined()
      expect(typeof (schema as { parse?: unknown }).parse).toBe('function')

      const result = (schema as { safeParse: (v: unknown) => { success: boolean } }).safeParse({
        name: 'Rodrigo',
      })

      expect(result.success).toBe(true)
    })

    it('initializes editState with empty name', () => {
      const { editState } = useUserForm('edit')

      const expected: EditUserFormValues = { name: '' }
      expect(editState).toEqual(expected)
    })
  })
})