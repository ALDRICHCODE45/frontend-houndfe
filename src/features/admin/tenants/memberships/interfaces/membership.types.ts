import { z } from 'zod'

// Validation messages
const VALIDATION_MESSAGES = {
  USER_ID_REQUIRED: 'User ID es requerido',
  ROLE_ID_REQUIRED: 'Role ID es requerido',
} as const

// Zod schema for creating membership
export const createMembershipSchema = z.object({
  userId: z.string().min(1, VALIDATION_MESSAGES.USER_ID_REQUIRED),
  roleId: z.string().min(1, VALIDATION_MESSAGES.ROLE_ID_REQUIRED),
})

// Zod schema for updating membership (role only)
export const updateMembershipSchema = z.object({
  roleId: z.string().min(1, VALIDATION_MESSAGES.ROLE_ID_REQUIRED),
})

export type CreateMembershipFormValues = z.infer<typeof createMembershipSchema>
export type UpdateMembershipFormValues = z.infer<typeof updateMembershipSchema>

// Backend response (flat membership, no user/role labels)
export interface MembershipResponse {
  id: string
  userId: string
  tenantId: string
  roleId: string
}

// Enriched row for table display (includes resolved user/role names)
export interface MembershipTableRow extends MembershipResponse {
  userName: string
  userEmail: string
  roleName: string
}

// Create request (POST /admin/tenants/:tenantId/members)
export interface CreateMembershipRequest {
  userId: string
  roleId: string
}

// Update request (PATCH /admin/tenants/:tenantId/members/:membershipId)
export interface UpdateMembershipRequest {
  roleId: string
}
