import { describe, it, expect, beforeEach } from 'vitest'
import { useMembershipForm } from '../useMembershipForm'
import {
  createMembershipSchema,
  updateMembershipSchema,
} from '../../interfaces/membership.types'

describe('useMembershipForm', () => {
  describe('create mode', () => {
    it('should provide createMembershipSchema for validation', () => {
      const { schema } = useMembershipForm('create')

      expect(schema.value).toBe(createMembershipSchema)
    })

    it('should initialize createState with empty userId and roleId', () => {
      const { createState } = useMembershipForm('create')

      expect(createState.userId).toBe('')
      expect(createState.roleId).toBe('')
    })

    it('should reset createState to initial values', () => {
      const { createState, resetForm } = useMembershipForm('create')

      createState.userId = 'user-123'
      createState.roleId = 'role-456'

      resetForm()

      expect(createState.userId).toBe('')
      expect(createState.roleId).toBe('')
    })
  })

  describe('edit mode', () => {
    it('should provide updateMembershipSchema for validation', () => {
      const { schema } = useMembershipForm('edit')

      expect(schema.value).toBe(updateMembershipSchema)
    })

    it('should initialize editState with empty roleId', () => {
      const { editState } = useMembershipForm('edit')

      expect(editState.roleId).toBe('')
    })

    it('should reset editState to initial values', () => {
      const { editState, resetForm } = useMembershipForm('edit')

      editState.roleId = 'role-789'

      resetForm()

      expect(editState.roleId).toBe('')
    })

    it('should prefill editState with setValues', () => {
      const { editState, setValues } = useMembershipForm('edit')

      setValues({ roleId: 'role-prefilled' })

      expect(editState.roleId).toBe('role-prefilled')
    })

    it('should reset to empty after setValues is called', () => {
      const { editState, setValues, resetForm } = useMembershipForm('edit')

      setValues({ roleId: 'role-original' })
      expect(editState.roleId).toBe('role-original')

      // Reset should clear to initial empty state
      resetForm()

      expect(editState.roleId).toBe('')
    })
  })

  describe('mode switching', () => {
    it('should provide different schemas for create vs edit', () => {
      const createForm = useMembershipForm('create')
      const editForm = useMembershipForm('edit')

      expect(createForm.schema.value).toBe(createMembershipSchema)
      expect(editForm.schema.value).toBe(updateMembershipSchema)
      expect(createForm.schema.value).not.toBe(editForm.schema.value)
    })
  })
})
