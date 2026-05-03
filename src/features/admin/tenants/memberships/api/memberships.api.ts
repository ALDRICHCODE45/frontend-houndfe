import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import { http } from '@/core/shared/api/http'
import type {
  MembershipResponse,
  MembershipTableRow,
  CreateMembershipRequest,
  UpdateMembershipRequest,
} from '../interfaces/membership.types'

const MEMBERSHIP_ERROR_MAP: Record<string, string> = {
  ROLE_TENANT_MISMATCH: 'El rol seleccionado no pertenece a esta sucursal',
  TENANT_MEMBERSHIP_EXISTS: 'El usuario ya es miembro de esta sucursal',
  TENANT_MEMBERSHIP_NOT_FOUND: 'Membresía no encontrada',
  TENANT_ACCESS_DENIED: 'No tenés permisos para gestionar esta sucursal',
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

function applyLocalMembershipFilters(
  rows: MembershipTableRow[],
  params: ServerTableParams,
): MembershipTableRow[] {
  let filtered = [...rows]

  if (params.globalFilter) {
    const search = params.globalFilter.toLowerCase()
    filtered = filtered.filter(
      (row) =>
        row.userId.toLowerCase().includes(search) || row.roleId.toLowerCase().includes(search),
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

export const membershipsApi = {
  async getPaginated(
    tenantId: string,
    params: ServerTableParams,
  ): Promise<PaginatedResponse<MembershipTableRow>> {
    const { data } = await http.get<MembershipResponse[]>(`/admin/tenants/${tenantId}/members`)

    // Backend returns flat array — cast to TableRow (enrichment happens in composable)
    const rows: MembershipTableRow[] = data as MembershipTableRow[]
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
}
