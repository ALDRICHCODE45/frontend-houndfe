export interface BackendPaginatedMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface AdminUser {
  id: string
  email: string
  name: string
  isActive: boolean
  createdAt: string
}

export interface RolePermission {
  id?: string
  subject: string
  action: string
  description: string | null
}

export interface AdminRole {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: RolePermission[]
  createdAt: string
  updatedAt: string
}

export interface RoleSummary {
  id: string
  name: string
}

export interface UserWithRolesResponse {
  user: AdminUser
  roles: RoleSummary[]
}

export interface RoleWithUserCountResponse {
  role: AdminRole
  userCount: number
}

export interface GroupedPermission {
  id: string
  action: string
  description: string | null
}

export type PermissionGroupedResponse = Record<string, GroupedPermission[]>
