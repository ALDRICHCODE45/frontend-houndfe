import type {
  AdminRole,
  GroupedPermission,
  PermissionGroupedResponse,
} from '../../shared/interfaces/rbac.types'

export interface RoleTableRow {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissionCount: number
  userCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateRoleRequest {
  name: string
  description?: string
}

export interface UpdateRoleRequest {
  name?: string
  description?: string
}

export interface AssignPermissionsRequest {
  permissionIds: string[]
}

export interface PermissionModule {
  subject: string
  permissions: GroupedPermission[]
}

export type GroupedPermissions = PermissionGroupedResponse

export type RoleDetail = AdminRole
