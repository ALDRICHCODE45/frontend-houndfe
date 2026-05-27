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
import { uploadMultipart } from '@/core/shared/api/multipart'
import type {
  Employee,
  EmployeesBackendList,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  TerminateEmployeeDto,
  AddSalaryChangeDto,
  AddPositionChangeDto,
  SalaryChange,
  PositionChange,
  EmployeeDocument,
} from '../interfaces/employee.types'

// ─── Document query param types ───────────────────────────────────────────────

export interface GetDocumentsParams {
  /** Filter by category */
  category?: string
  /** Documents expiring within N days */
  expiringWithinDays?: number
  /** 1-indexed page number */
  page?: number
  /** Items per page */
  pageSize?: number
}

/** Backend shape for paginated documents list */
export interface DocumentsBackendList {
  data: EmployeeDocument[]
  total: number
  page: number
  limit: number
  pageSize?: number
}

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

  /**
   * PATCH /admin/employees/:id — partial update of an employee.
   *
   * Requires update:Employee permission. Returns 200 with the updated Employee.
   * NEVER sends tenantId.
   *
   * Possible domain errors:
   * - EMPLOYEE_NOT_FOUND (404)
   * - EMPLOYEE_NUMBER_CONFLICT (409): new employeeNumber already taken
   * - MANAGER_SELF_REFERENCE (400): cannot set self as manager
   * - MANAGER_CYCLE (400): would create a cycle in the org chart
   */
  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    const { data } = await http.patch<Employee>(`/admin/employees/${id}`, dto)
    return data
  },

  /**
   * POST /admin/employees/:id/terminate — terminate (give baja to) an employee.
   *
   * Requires update:Employee permission. Returns 200 with the updated Employee.
   * Body: { terminationDate, terminationReason } — both required.
   *
   * Possible domain errors:
   * - EMPLOYEE_NOT_FOUND (404)
   * - EMPLOYEE_ALREADY_TERMINATED (409): employee status is already TERMINATED
   */
  async terminate(id: string, dto: TerminateEmployeeDto): Promise<Employee> {
    const { data } = await http.post<Employee>(`/admin/employees/${id}/terminate`, dto)
    return data
  },

  /**
   * POST /admin/employees/:id/reactivate — reactivate a terminated employee.
   *
   * Requires update:Employee permission. Returns 200 with the updated Employee.
   * No request body (backend ignores body).
   *
   * Possible domain errors:
   * - EMPLOYEE_NOT_FOUND (404)
   * - EMPLOYEE_NOT_TERMINATED (409): employee is not in TERMINATED status
   */
  async reactivate(id: string): Promise<Employee> {
    const { data } = await http.post<Employee>(`/admin/employees/${id}/reactivate`, {})
    return data
  },

  // ─── Org chart — WU-08 ────────────────────────────────────────────────────

  /**
   * GET /admin/employees/:id/subordinates
   *
   * Requires read:Employee permission.
   * Returns array of direct subordinates (NOT recursive).
   * Salary stripping applied server-side.
   * NEVER sends tenantId.
   */
  async getSubordinates(id: string): Promise<Employee[]> {
    const { data } = await http.get<Employee[]>(`/admin/employees/${id}/subordinates`)
    return data
  },

  /**
   * GET /admin/employees/:id/manager-chain
   *
   * Requires read:Employee permission.
   * Returns array of Employee from direct manager to top (max 50 levels).
   * Salary stripping applied server-side.
   * NEVER sends tenantId.
   */
  async getManagerChain(id: string): Promise<Employee[]> {
    const { data } = await http.get<Employee[]>(`/admin/employees/${id}/manager-chain`)
    return data
  },

  // ─── Salary history — WU-07 ────────────────────────────────────────────────

  /**
   * GET /admin/employees/:employeeId/salary-history
   *
   * Requires read:EmployeeSalary permission.
   * Returns array of EmployeeSalaryHistory ordered by effectiveFrom desc.
   */
  async getSalaryHistory(employeeId: string): Promise<SalaryChange[]> {
    const { data } = await http.get<SalaryChange[]>(
      `/admin/employees/${employeeId}/salary-history`,
    )
    return data
  },

  /**
   * POST /admin/employees/:employeeId/salary-history
   *
   * Requires create:EmployeeSalary permission. Returns 201 with created entry.
   * Atomic operation: creates history row AND updates currentSalaryCents + currency on Employee.
   * NEVER send tenantId.
   */
  async addSalaryChange(employeeId: string, dto: AddSalaryChangeDto): Promise<SalaryChange> {
    const { data } = await http.post<SalaryChange>(
      `/admin/employees/${employeeId}/salary-history`,
      dto,
    )
    return data
  },

  // ─── Position history — WU-07 ──────────────────────────────────────────────

  /**
   * GET /admin/employees/:employeeId/position-history
   *
   * Requires read:Employee permission.
   * Returns array of EmployeePositionHistory ordered by effectiveFrom desc.
   */
  async getPositionHistory(employeeId: string): Promise<PositionChange[]> {
    const { data } = await http.get<PositionChange[]>(
      `/admin/employees/${employeeId}/position-history`,
    )
    return data
  },

  /**
   * POST /admin/employees/:employeeId/position-history
   *
   * Requires update:Employee permission. Returns 201 with created entry.
   * Atomic operation: creates history row AND updates currentPosition + currentDepartment on Employee.
   * NEVER send tenantId.
   */
  async addPositionChange(employeeId: string, dto: AddPositionChangeDto): Promise<PositionChange> {
    const { data } = await http.post<PositionChange>(
      `/admin/employees/${employeeId}/position-history`,
      dto,
    )
    return data
  },

  // ─── Documents — WU-09 ────────────────────────────────────────────────────

  /**
   * GET /admin/employees/:employeeId/documents
   *
   * Requires read:EmployeeDocument permission.
   * Returns paginated list of EmployeeDocument.
   * Optional filters: category, expiringWithinDays, page, pageSize.
   * NEVER send tenantId.
   */
  async getDocuments(
    employeeId: string,
    params?: GetDocumentsParams,
  ): Promise<DocumentsBackendList> {
    const queryParams: Record<string, unknown> = {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
    }
    if (params?.category) queryParams.category = params.category
    if (params?.expiringWithinDays) queryParams.expiringWithinDays = params.expiringWithinDays

    const { data } = await http.get<DocumentsBackendList>(
      `/admin/employees/${employeeId}/documents`,
      { params: queryParams },
    )
    return data
  },

  /**
   * POST /admin/employees/:employeeId/documents — upload a document.
   *
   * Requires create:EmployeeDocument permission. Returns 201 with created EmployeeDocument.
   * MUST use multipart/form-data (uploadMultipart helper).
   * FormData fields: file (binary), category, expiresAt?, notes?.
   * NEVER send tenantId. NEVER manually set Content-Type.
   */
  async uploadDocument(employeeId: string, formData: FormData): Promise<EmployeeDocument> {
    return uploadMultipart<EmployeeDocument>(
      `/admin/employees/${employeeId}/documents`,
      formData,
    )
  },

  /**
   * GET /admin/employees/:employeeId/documents/:docId/download
   *
   * Requires read:EmployeeDocument permission.
   * Returns { fileId } — caller uses fileId to call downloadFile('/files/' + fileId).
   */
  async downloadDocumentInfo(
    employeeId: string,
    docId: string,
  ): Promise<{ fileId: string }> {
    const { data } = await http.get<{ fileId: string }>(
      `/admin/employees/${employeeId}/documents/${docId}/download`,
    )
    return data
  },

  /**
   * DELETE /admin/employees/:employeeId/documents/:docId
   *
   * Requires delete:EmployeeDocument permission. Returns 204 No Content.
   * Backend best-efforts blob deletion in DO Spaces — logs but does NOT
   * throw if blob delete fails.
   * NEVER send tenantId.
   */
  async deleteDocument(employeeId: string, docId: string): Promise<void> {
    await http.delete(`/admin/employees/${employeeId}/documents/${docId}`)
  },
}
