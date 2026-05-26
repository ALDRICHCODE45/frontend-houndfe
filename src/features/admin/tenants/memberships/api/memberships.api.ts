import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import { http } from '@/core/shared/api/http'
import type {
  MembershipResponse,
  MembershipTableRow,
  CreateMembershipRequest,
  UpdateMembershipRequest,
} from '../interfaces/membership.types'
import type {
  EligibleUsersList,
  GetEligibleUsersParams,
} from '../interfaces/eligible-user.types'

type MembershipApiRow = MembershipResponse & {
  user?: {
    id: string
    name: string
    email: string
    isActive?: boolean
  }
  role?: {
    id: string
    name: string
  }
}

const MEMBERSHIP_ERROR_MAP: Record<string, string> = {
  ROLE_TENANT_MISMATCH: 'El rol seleccionado no pertenece a esta sucursal',
  TENANT_MEMBERSHIP_EXISTS: 'El usuario ya es miembro de esta sucursal',
  TENANT_MEMBERSHIP_NOT_FOUND: 'Membresía no encontrada',
  TENANT_ACCESS_DENIED: 'No tenés permisos para gestionar esta sucursal',
  INSUFFICIENT_PERMISSIONS_IN_TARGET_TENANT: 'No tenés permisos suficientes para operar en esta sucursal',
  TENANT_NOT_FOUND: 'Sucursal no encontrada',
}

const FALLBACK_ERROR_MESSAGE = 'Ocurrió un error inesperado'

export function mapMembershipError(codeOrMessage: string): string {
  if (!codeOrMessage) {
    return FALLBACK_ERROR_MESSAGE
  }

  const normalizedCode = codeOrMessage.toUpperCase()
  return MEMBERSHIP_ERROR_MAP[normalizedCode] ?? FALLBACK_ERROR_MESSAGE
}

const ELIGIBLE_USERS_ERROR_MAP: Record<string, string> = {
  SEARCH_QUERY_TOO_SHORT: 'Escribí al menos 2 caracteres para buscar.',
}

export function mapEligibleUsersError(codeOrMessage: string): string {
  if (!codeOrMessage) {
    return FALLBACK_ERROR_MESSAGE
  }

  const normalizedCode = codeOrMessage.toUpperCase()
  return ELIGIBLE_USERS_ERROR_MAP[normalizedCode] ?? FALLBACK_ERROR_MESSAGE
}

function applyLocalMembershipFilters(
  rows: MembershipTableRow[],
  params: ServerTableParams,
): MembershipTableRow[] {
  let filtered = [...rows]

  if (params.globalFilter) {
    const search = params.globalFilter.toLowerCase()
    filtered = filtered.filter(
      (row) =>
        row.userEmail.toLowerCase().includes(search) ||
        row.userName.toLowerCase().includes(search) ||
        row.roleName.toLowerCase().includes(search),
    )
  }

  if (params.sorting && params.sorting.length > 0) {
    const sort = params.sorting[0]
    if (sort) {
      filtered.sort((a, b) => {
        const aVal = a[sort.id as keyof MembershipTableRow]
        const bVal = b[sort.id as keyof MembershipTableRow]

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

function toMembershipRow(row: MembershipApiRow): MembershipTableRow {
  return {
    id: row.id,
    userId: row.userId,
    tenantId: row.tenantId,
    roleId: row.roleId,
    createdAt: row.createdAt,
    userName: row.user?.name ?? '',
    userEmail: row.user?.email ?? '',
    roleName: row.role?.name ?? '',
    userIsActive: row.user?.isActive,
  }
}

export const membershipsApi = {
  async getPaginated(
    tenantId: string,
    params: ServerTableParams,
  ): Promise<PaginatedResponse<MembershipTableRow>> {
    const response = await http.get<{ data: MembershipApiRow[] }>(`/admin/tenants/${tenantId}/members`)
    const rows: MembershipTableRow[] = response.data.data.map(toMembershipRow)
    const filteredRows = applyLocalMembershipFilters(rows, params)

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

  async create(tenantId: string, payload: CreateMembershipRequest) {
    const { data } = await http.post<MembershipResponse>(
      `/admin/tenants/${tenantId}/members`,
      payload,
    )
    return data
  },

  async updateRole(
    tenantId: string,
    membershipId: string,
    payload: UpdateMembershipRequest,
  ): Promise<MembershipResponse> {
    const { data } = await http.patch<MembershipResponse>(
      `/admin/tenants/${tenantId}/members/${membershipId}`,
      payload,
    )
    return data
  },

  async remove(tenantId: string, membershipId: string): Promise<void> {
    await http.delete(`/admin/tenants/${tenantId}/members/${membershipId}`)
  },

  async getTenantRoles(tenantId: string): Promise<{ id: string; name: string }[]> {
    const { data } = await http.get<{ data: { id: string; name: string }[] }>(
      `/admin/tenants/${tenantId}/roles`,
    )
    return data.data
  },

  async getEligibleUsers(
    tenantId: string,
    params: GetEligibleUsersParams,
  ): Promise<EligibleUsersList> {
    // Strip undefined values so axios doesn't serialize `?search=undefined`
    const requestParams: Record<string, string | number | boolean> = {}
    if (params.search !== undefined) requestParams.search = params.search
    if (params.page !== undefined) requestParams.page = params.page
    if (params.limit !== undefined) requestParams.limit = params.limit
    if (params.includeInactive !== undefined) {
      requestParams.includeInactive = params.includeInactive
    }

    const { data } = await http.get<EligibleUsersList>(
      `/admin/tenants/${tenantId}/eligible-users`,
      { params: requestParams },
    )
    return data
  },
}
