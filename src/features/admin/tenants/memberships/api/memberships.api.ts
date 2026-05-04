import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import { http } from '@/core/shared/api/http'
import type { RoleWithUserCountResponse } from '@/features/admin/shared/interfaces/rbac.types'
import type { UsersBackendListResponse } from '@/features/admin/users/interfaces/user.types'
import type {
  MembershipResponse,
  MembershipTableRow,
  CreateMembershipRequest,
  UpdateMembershipRequest,
} from '../interfaces/membership.types'

type MembershipApiRow = MembershipResponse & {
  userName?: string
  userEmail?: string
  roleName?: string
  user?: {
    id?: string
    name?: string
    email?: string
  }
  role?: {
    id?: string
    name?: string
  }
}

const MEMBERSHIP_ERROR_MAP: Record<string, string> = {
  ROLE_TENANT_MISMATCH: 'El rol seleccionado no pertenece a esta sucursal',
  TENANT_MEMBERSHIP_EXISTS: 'El usuario ya es miembro de esta sucursal',
  TENANT_MEMBERSHIP_NOT_FOUND: 'Membresía no encontrada',
  TENANT_ACCESS_DENIED: 'No tenés permisos para gestionar esta sucursal',
  TENANT_NOT_FOUND: 'Sucursal no encontrada',
}

const FALLBACK_ERROR_MESSAGE = 'Ocurrió un error inesperado'
const UNKNOWN_USER_LABEL = 'Usuario desconocido'
const UNKNOWN_ROLE_LABEL = 'Rol desconocido'
const UNKNOWN_EMAIL_LABEL = '-'
const USERS_PAGE_SIZE = 100

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

function needsCatalogEnrichment(row: MembershipApiRow): boolean {
  return !row.userName && !row.user?.name && !row.roleName && !row.role?.name
}

async function loadUsersCatalog() {
  const usersById = new Map<string, { name: string; email: string }>()
  let page = 1

  while (true) {
    const { data } = await http.get<UsersBackendListResponse>('/admin/users', {
      params: { page, limit: USERS_PAGE_SIZE },
    })

    for (const user of data.data) {
      usersById.set(user.id, { name: user.name, email: user.email })
    }

    if (page >= data.meta.totalPages) {
      break
    }

    page += 1
  }

  return usersById
}

async function loadRolesCatalog() {
  const { data } = await http.get<RoleWithUserCountResponse[]>('/admin/roles')
  const rolesById = new Map<string, string>()

  for (const row of data) {
    rolesById.set(row.role.id, row.role.name)
  }

  return rolesById
}

function normalizeMembershipRow(
  row: MembershipApiRow,
  usersById?: Map<string, { name: string; email: string }>,
  rolesById?: Map<string, string>,
): MembershipTableRow {
  const catalogUser = usersById?.get(row.userId)
  const safeUserName = row.userName ?? row.user?.name ?? catalogUser?.name ?? UNKNOWN_USER_LABEL
  const safeUserEmail = row.userEmail ?? row.user?.email ?? catalogUser?.email ?? UNKNOWN_EMAIL_LABEL
  const safeRoleName =
    row.roleName ?? row.role?.name ?? (row.roleId ? rolesById?.get(row.roleId) : undefined) ?? UNKNOWN_ROLE_LABEL

  return {
    ...row,
    userId: row.userId ?? row.user?.id ?? '',
    roleId: row.roleId ?? row.role?.id ?? '',
    userName: safeUserName,
    userEmail: safeUserEmail,
    roleName: safeRoleName,
  }
}

export const membershipsApi = {
  async getPaginated(
    tenantId: string,
    params: ServerTableParams,
  ): Promise<PaginatedResponse<MembershipTableRow>> {
    const { data } = await http.get<MembershipApiRow[]>(`/admin/tenants/${tenantId}/members`)

    let usersById: Map<string, { name: string; email: string }> | undefined
    let rolesById: Map<string, string> | undefined

    if (data.some(needsCatalogEnrichment)) {
      const [usersCatalog, rolesCatalog] = await Promise.allSettled([
        loadUsersCatalog(),
        loadRolesCatalog(),
      ])

      usersById = usersCatalog.status === 'fulfilled' ? usersCatalog.value : undefined
      rolesById = rolesCatalog.status === 'fulfilled' ? rolesCatalog.value : undefined
    }

    const rows: MembershipTableRow[] = data.map((row) => normalizeMembershipRow(row, usersById, rolesById))
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
