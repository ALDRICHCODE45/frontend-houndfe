/**
 * Backend response types for `GET /admin/tenants/:tenantId/eligible-users`.
 *
 * Returns users of the platform that are NOT already members of the target
 * tenant — the source for the "Agregar miembro" picker.
 *
 * Backend contract: see `houndfe-backend/docs/backend-requests/
 * tenant-members-api-enrichment-frontend-implementation.md` section 3.
 */

export interface EligibleUser {
  id: string
  email: string
  name: string
  isActive: boolean
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface EligibleUsersList {
  data: EligibleUser[]
  meta: PaginationMeta
}

export interface GetEligibleUsersParams {
  search?: string
  page?: number
  limit?: number
  includeInactive?: boolean
}
