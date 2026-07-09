import type {
  AdminUser,
  BackendPaginatedMeta,
  RoleSummary,
} from '../../shared/interfaces/rbac.types'

export interface UsersBackendListResponse {
  data: AdminUser[]
  meta: BackendPaginatedMeta
}

export interface UserTableRow extends AdminUser {
  roles: RoleSummary[]
}

export interface CreateUserRequest {
  email: string
  password: string
  name: string
  roleId: string
}

export interface UpdateUserRequest {
  name: string
}
