import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import { http } from '@/core/shared/api/http'
import type { UserWithRolesResponse } from '../../shared/interfaces/rbac.types'
import type {
  AssignRolesRequest,
  CreateUserRequest,
  UpdateUserRequest,
  UserTableRow,
  UsersBackendListResponse,
} from '../interfaces/user.types'

function applyLocalFilters(rows: UserTableRow[], params: ServerTableParams): UserTableRow[] {
  let filtered = [...rows]

  if (params.globalFilter) {
    const search = params.globalFilter.toLowerCase()
    filtered = filtered.filter(
      (row) =>
        row.name.toLowerCase().includes(search) ||
        row.email.toLowerCase().includes(search) ||
        row.roles.some((role) => role.name.toLowerCase().includes(search)),
    )
  }

  if (params.sorting && params.sorting.length > 0) {
    const sort = params.sorting[0]

    if (sort) {
      filtered.sort((a, b) => {
        const aVal = a[sort.id as keyof UserTableRow]
        const bVal = b[sort.id as keyof UserTableRow]

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sort.desc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal)
        }

        return 0
      })
    }
  }

  return filtered
}

// Cache roles per page load to avoid N+1 — cleared on invalidation
let rolesCache: Map<string, { id: string; name: string }[]> | null = null

export const usersApi = {
  clearRolesCache() {
    rolesCache = null
  },

  async getPaginated(params: ServerTableParams): Promise<PaginatedResponse<UserTableRow>> {
    const page = params.pageIndex + 1
    const limit = params.pageSize

    const { data } = await http.get<UsersBackendListResponse>('/admin/users', {
      params: {
        page,
        limit,
      },
    })

    // Batch-fetch roles for all users in one parallel round
    // Only fetch roles we haven't cached yet
    if (!rolesCache) {
      rolesCache = new Map()
    }

    const uncachedUsers = data.data.filter((user) => !rolesCache!.has(user.id))

    if (uncachedUsers.length > 0) {
      const results = await Promise.all(
        uncachedUsers.map(async (user) => {
          try {
            const detail = await http.get<UserWithRolesResponse>(`/admin/users/${user.id}`)
            return { userId: user.id, roles: detail.data.roles }
          } catch {
            return { userId: user.id, roles: [] }
          }
        }),
      )

      for (const result of results) {
        rolesCache!.set(result.userId, result.roles)
      }
    }

    const usersWithRoles: UserTableRow[] = data.data.map((user) => ({
      ...user,
      roles: rolesCache!.get(user.id) ?? [],
    }))

    const filteredRows = applyLocalFilters(usersWithRoles, params)

    return {
      data: filteredRows,
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

  async assignRoles(userId: string, payload: AssignRolesRequest) {
    await http.patch(`/admin/users/${userId}/roles`, payload)
  },

  async remove(userId: string) {
    await http.delete(`/admin/users/${userId}`)
  },
}
