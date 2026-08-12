import type {
  AdminUser,
  BackendPaginatedMeta,
  RoleSummary,
} from '../../shared/interfaces/rbac.types'

export interface UsersBackendListItem extends AdminUser {
  roles: RoleSummary[]
}

export interface UsersBackendListResponse {
  data: UsersBackendListItem[]
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
