import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import { http } from '@/core/shared/api/http'
import type { UserWithRolesResponse } from '../../shared/interfaces/rbac.types'
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserTableRow,
  UsersBackendListItem,
  UsersBackendListResponse,
} from '../interfaces/user.types'

// Backend whitelist for `sortBy` on GET /admin/users — the table may sort by
// other columns, so only map the ids the backend accepts.
const USER_SORT_WHITELIST = ['name', 'email', 'createdAt'] as const

function isAllowedSortField(value: string | undefined): value is (typeof USER_SORT_WHITELIST)[number] {
  return USER_SORT_WHITELIST.includes(value as (typeof USER_SORT_WHITELIST)[number])
}

function toUserTableRow(user: UsersBackendListItem): UserTableRow {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isActive: user.isActive,
    createdAt: user.createdAt,
    roles: user.roles,
  }
}

export const usersApi = {
  async getPaginated(params: ServerTableParams): Promise<PaginatedResponse<UserTableRow>> {
    const requestParams: Record<string, string | number> = {
      page: params.pageIndex + 1,
      limit: params.pageSize,
    }

    // Server rejects searches shorter than 2 chars (SEARCH_QUERY_TOO_SHORT);
    // omit `search` to keep the list unfiltered.
    if (params.globalFilter && params.globalFilter.length >= 2) {
      requestParams.search = params.globalFilter
    }

    const sort = params.sorting?.[0]
    if (sort && isAllowedSortField(sort.id)) {
      requestParams.sortBy = sort.id
      requestParams.sortOrder = sort.desc ? 'desc' : 'asc'
    }

    const { data } = await http.get<UsersBackendListResponse>('/admin/users', {
      params: requestParams,
    })

    // Search/sort/pagination are all server-side; `meta` reflects the filtered
    // total. Each list item already carries its roles (no N+1 needed).
    return {
      data: data.data.map(toUserTableRow),
      pagination: {
        pageIndex: data.meta.page - 1,
        pageSize: data.meta.limit,
        totalCount: data.meta.total,
        pageCount: data.meta.totalPages,
      },
    }
  },

  async getById(userId: string) {
    const { data } = await http.get<UserWithRolesResponse>(`/admin/users/${userId}`)
    return data
  },

  async create(payload: CreateUserRequest) {
    const { data } = await http.post('/admin/users', payload)
    return data
  },

  async update(userId: string, payload: UpdateUserRequest) {
    const { data } = await http.patch(`/admin/users/${userId}`, payload)
    return data
  },

  async remove(userId: string) {
    await http.delete(`/admin/users/${userId}`)
  },
}
