import { describe, it, expect } from 'vitest'
import {
  createMembershipSchema,
  updateMembershipSchema,
  type MembershipResponse,
  type MembershipTableRow,
  type CreateMembershipRequest,
  type UpdateMembershipRequest,
} from '../membership.types'

describe('membership.types', () => {
  describe('createMembershipSchema', () => {
    it('validates valid create payload with userId and roleId', () => {
      const validPayload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        roleId: '123e4567-e89b-12d3-a456-426614174001',
      }

      const result = createMembershipSchema.safeParse(validPayload)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.userId).toBe(validPayload.userId)
        expect(result.data.roleId).toBe(validPayload.roleId)
      }
    })

    it('fails validation when userId is missing', () => {
      const invalidPayload = {
        roleId: '123e4567-e89b-12d3-a456-426614174001',
      }

      const result = createMembershipSchema.safeParse(invalidPayload)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors.some((e) => e.path.includes('userId'))).toBe(true)
      }
    })

    it('fails validation when roleId is missing', () => {
      const invalidPayload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = createMembershipSchema.safeParse(invalidPayload)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors.some((e) => e.path.includes('roleId'))).toBe(true)
      }
    })

    it('fails validation when userId is empty string', () => {
      const invalidPayload = {
        userId: '',
        roleId: '123e4567-e89b-12d3-a456-426614174001',
      }

      const result = createMembershipSchema.safeParse(invalidPayload)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0]?.message).toBe('Seleccioná un usuario')
      }
    })

    it('fails validation when roleId is empty string', () => {
      const invalidPayload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        roleId: '',
      }

      const result = createMembershipSchema.safeParse(invalidPayload)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0]?.message).toBe('Seleccioná un rol')
      }
    })
  })

  describe('updateMembershipSchema', () => {
    it('validates valid update payload with roleId only', () => {
      const validPayload = {
        roleId: '123e4567-e89b-12d3-a456-426614174002',
      }

      const result = updateMembershipSchema.safeParse(validPayload)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.roleId).toBe(validPayload.roleId)
      }
    })

    it('fails validation when roleId is missing', () => {
      const invalidPayload = {}

      const result = updateMembershipSchema.safeParse(invalidPayload)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors.some((e) => e.path.includes('roleId'))).toBe(true)
      }
    })

    it('fails validation when roleId is empty string', () => {
      const invalidPayload = {
        roleId: '',
      }

      const result = updateMembershipSchema.safeParse(invalidPayload)

      expect(result.success).toBe(false)
    })
  })

  describe('TypeScript interfaces', () => {
    it('MembershipResponse has correct shape', () => {
      const response: MembershipResponse = {
        id: 'membership-id',
        userId: 'user-id',
        tenantId: 'tenant-id',
        roleId: 'role-id',
      }

      expect(response.id).toBe('membership-id')
      expect(response.userId).toBe('user-id')
      expect(response.tenantId).toBe('tenant-id')
      expect(response.roleId).toBe('role-id')
    })

    it('MembershipTableRow includes enriched user and role data', () => {
      const row: MembershipTableRow = {
        id: 'membership-id',
        userId: 'user-id',
        tenantId: 'tenant-id',
        roleId: 'role-id',
        userName: 'John Doe',
        userEmail: 'john@example.com',
        roleName: 'Manager',
      }

      expect(row.userName).toBe('John Doe')
      expect(row.userEmail).toBe('john@example.com')
      expect(row.roleName).toBe('Manager')
    })

    it('CreateMembershipRequest has userId and roleId', () => {
      const request: CreateMembershipRequest = {
        userId: 'user-id',
        roleId: 'role-id',
      }

      expect(request.userId).toBe('user-id')
      expect(request.roleId).toBe('role-id')
    })

    it('UpdateMembershipRequest has only roleId', () => {
      const request: UpdateMembershipRequest = {
        roleId: 'new-role-id',
      }

      expect(request.roleId).toBe('new-role-id')
    })
  })
})
