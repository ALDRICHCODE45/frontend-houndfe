import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import { http } from '@/core/shared/api/http'
import type {
  TenantResponse,
  TenantTableRow,
  CreateTenantRequest,
  UpdateTenantRequest,
} from '../interfaces/tenant.types'

const TENANT_ERROR_MAP: Record<string, string> = {
  TENANT_ALREADY_EXISTS: 'Ya existe una sucursal con ese slug o nombre',
  TENANT_NOT_FOUND: 'Sucursal no encontrada',
  SUPER_ADMIN_REQUIRED: 'Se requieren permisos de super administrador',
  TENANT_INACTIVE: 'La sucursal está desactivada',
  GLOBAL_CONTEXT_REQUIRED: 'Operación requiere contexto global. Salí de la sucursal actual.',
}

const FALLBACK_ERROR_MESSAGE = 'Ocurrió un error inesperado'

export function mapTenantError(codeOrMessage: string): string {
  if (!codeOrMessage) {
    return FALLBACK_ERROR_MESSAGE
  }

  const normalizedCode = codeOrMessage.toUpperCase()
  return TENANT_ERROR_MAP[normalizedCode] ?? FALLBACK_ERROR_MESSAGE
}

function applyLocalTenantFilters(
  rows: TenantTableRow[],
  params: ServerTableParams,
): TenantTableRow[] {
  let filtered = [...rows]

  if (params.globalFilter) {
    const search = params.globalFilter.toLowerCase()
    filtered = filtered.filter(
      (row) => row.name.toLowerCase().includes(search) || row.slug.toLowerCase().includes(search),
    )
  }

  if (params.sorting && params.sorting.length > 0) {
    const sort = params.sorting[0]
    if (sort) {
      filtered.sort((a, b) => {
        const aVal = a[sort.id as keyof TenantTableRow]
        const bVal = b[sort.id as keyof TenantTableRow]

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

export const tenantsApi = {
  async getPaginated(
    params: ServerTableParams,
    includeInactive: boolean,
  ): Promise<PaginatedResponse<TenantTableRow>> {
    const { data } = await http.get<TenantResponse[]>('/admin/tenants', {
      params: { includeInactive },
    })

    const rows: TenantTableRow[] = data
    const filteredRows = applyLocalTenantFilters(rows, params)

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

  async getById(tenantId: string) {
    const { data } = await http.get<TenantResponse>(`/admin/tenants/${tenantId}`)
    return data
  },

  async create(payload: CreateTenantRequest) {
    const { data } = await http.post<TenantResponse>('/admin/tenants', payload)
    return data
  },

  async update(tenantId: string, payload: UpdateTenantRequest) {
    const { data } = await http.patch<TenantResponse>(`/admin/tenants/${tenantId}`, payload)
    return data
  },

  async deactivate(tenantId: string) {
    await http.delete(`/admin/tenants/${tenantId}`)
  },
}
