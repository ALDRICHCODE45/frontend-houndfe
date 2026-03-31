import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import { http } from '@/core/shared/api/http'
import type {
  PermissionGroupedResponse,
  RoleWithUserCountResponse,
} from '../../shared/interfaces/rbac.types'
import type {
  AssignPermissionsRequest,
  CreateRoleRequest,
  RoleDetail,
  RoleTableRow,
  UpdateRoleRequest,
} from '../interfaces/role.types'

function mapRoleRow(item: RoleWithUserCountResponse): RoleTableRow {
  return {
    id: item.role.id,
    name: item.role.name,
    description: item.role.description,
    isSystem: item.role.isSystem,
    permissionCount: item.role.permissions.length,
    userCount: item.userCount,
    createdAt: item.role.createdAt,
    updatedAt: item.role.updatedAt,
  }
}

function applyLocalRoleFilters(rows: RoleTableRow[], params: ServerTableParams): RoleTableRow[] {
  let filtered = [...rows]

  if (params.globalFilter) {
    const search = params.globalFilter.toLowerCase()
    filtered = filtered.filter(
      (row) =>
        row.name.toLowerCase().includes(search) ||
        (row.description ?? '').toLowerCase().includes(search),
    )
  }

  if (params.sorting && params.sorting.length > 0) {
    const sort = params.sorting[0]
    if (sort) {
      filtered.sort((a, b) => {
        const aVal = a[sort.id as keyof RoleTableRow]
        const bVal = b[sort.id as keyof RoleTableRow]

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sort.desc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal)
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sort.desc ? bVal - aVal : aVal - bVal
        }

        return 0
      })
    }
  }

  return filtered
}

export const rolesApi = {
  async getPaginated(params: ServerTableParams): Promise<PaginatedResponse<RoleTableRow>> {
    const { data } = await http.get<RoleWithUserCountResponse[]>('/admin/roles')
    const rows = data.map(mapRoleRow)
    const filteredRows = applyLocalRoleFilters(rows, params)

    const totalCount = filteredRows.length
    const pageCount = Math.ceil(totalCount / params.pageSize) || 1
    const start = params.pageIndex * params.pageSize
    const pagedRows = filteredRows.slice(start, start + params.pageSize)

    return {
      data: pagedRows,
      pagination: {
        pageIndex: params.pageIndex,
        pageSize: params.pageSize,
        totalCount,
        pageCount,
      },
    }
  },

  async getById(roleId: string) {
    const { data } = await http.get<RoleDetail>(`/admin/roles/${roleId}`)
    return data
  },

  async create(payload: CreateRoleRequest) {
    const { data } = await http.post<RoleDetail>('/admin/roles', payload)
    return data
  },

  async update(roleId: string, payload: UpdateRoleRequest) {
    const { data } = await http.patch<RoleDetail>(`/admin/roles/${roleId}`, payload)
    return data
  },

  async remove(roleId: string) {
    await http.delete(`/admin/roles/${roleId}`)
  },

  async assignPermissions(roleId: string, payload: AssignPermissionsRequest) {
    await http.patch(`/admin/roles/${roleId}/permissions`, payload)
  },

  async getPermissionsGrouped() {
    const { data } = await http.get<PermissionGroupedResponse>('/admin/permissions')
    return data
  },
}
