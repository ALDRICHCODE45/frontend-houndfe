/**
 * Employees API module — WU-02
 *
 * Rules:
 * - NEVER send tenantId in params/body/headers (backend reads from JWT)
 * - Status filter query params are LOWERCASE: 'active' | 'terminated' | 'all'
 * - Backend status enum in Employee objects is UPPERCASE: ACTIVE, ON_LEAVE, TERMINATED
 * - Backend response shape: { data, total, page, limit, pageSize }
 * - mapPaginated adapts to PaginatedResponse<T> consumed by useServerTable
 */

import { http } from '@/core/shared/api/http'
import type { PaginatedResponse } from '@/core/shared/types/table.types'
import type { Employee, EmployeesBackendList, CreateEmployeeDto } from '../interfaces/employee.types'

// ─── Query param types ────────────────────────────────────────────────────────

export type EmployeeStatusFilter = 'active' | 'terminated' | 'all'

export interface EmployeesListParams {
  /** Lowercase status filter — NOT the backend enum value */
  status?: EmployeeStatusFilter
  /** Free-text search against name/email/employeeNumber */
  search?: string
  /** Filter by manager UUID */
  managerId?: string
  /** 1-indexed page number */
  page?: number
  /** Number of items per page */
  pageSize?: number
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * Adapt the backend { data, total, page, limit, pageSize } shape
 * to PaginatedResponse<T> consumed by useServerTable.
 *
 * Key: pageCount = ceil(total / pageSize) — NOT provided by backend.
 * pageIndex is 0-based; backend page is 1-based.
 */
export function mapPaginated<T>(raw: {
  data: T[]
  total: number
  page: number
  limit: number
  pageSize: number
}): PaginatedResponse<T> {
  return {
    data: raw.data,
    pagination: {
      pageIndex: raw.page - 1,
      pageSize: raw.pageSize,
      totalCount: raw.total,
      pageCount: Math.ceil(raw.total / raw.pageSize),
    },
  }
}

// ─── API object ───────────────────────────────────────────────────────────────

export const employeesApi = {
  /**
   * GET /admin/employees — paginated employee list with filters.
   *
   * Only sends params that have values (no undefined keys in the request).
   * NEVER sends tenantId.
   */
  async list(params: EmployeesListParams): Promise<PaginatedResponse<Employee>> {
    // Build clean params object — omit undefined/empty values
    const queryParams: Record<string, unknown> = {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 10,
    }

    if (params.status && params.status !== 'all') {
      queryParams.status = params.status
    } else if (params.status === 'all') {
      // 'all' means no status filter — some backends ignore it, some need it
      // Send it explicitly to communicate intent
      queryParams.status = 'all'
    }

    if (params.search && params.search.trim() !== '') {
      queryParams.search = params.search.trim()
    }

    if (params.managerId) {
      queryParams.managerId = params.managerId
    }

    const { data } = await http.get<EmployeesBackendList>('/admin/employees', {
      params: queryParams,
    })

    return mapPaginated(data)
  },

  /**
   * GET /admin/employees/:id — single employee detail.
   */
  async getById(id: string): Promise<Employee> {
    const { data } = await http.get<Employee>(`/admin/employees/${id}`)
    return data
  },

  /**
   * GET /admin/employees — active employees for manager picker.
   * Returns raw array (no pagination needed for picker use).
   */
  async listForPicker(search: string): Promise<Employee[]> {
    const { data } = await http.get<EmployeesBackendList>('/admin/employees', {
      params: {
        status: 'active',
        pageSize: 100,
        ...(search.trim() ? { search: search.trim() } : {}),
      },
    })
    return data.data
  },

  /**
   * POST /admin/employees — create a new employee.
   *
   * Requires create:Employee permission. Returns 201 with the created Employee.
   * NEVER sends tenantId — extracted from JWT by TenantContextGuard.
   *
   * Possible domain errors (via EMPLOYEE_ERROR_MAP):
   * - EMPLOYEE_NUMBER_CONFLICT (409): employeeNumber already exists in tenant
   * - EMPLOYEE_NOT_FOUND (404): managerId refers to non-existent employee
   */
  async create(dto: CreateEmployeeDto): Promise<Employee> {
    const { data } = await http.post<Employee>('/admin/employees', dto)
    return data
  },
}
