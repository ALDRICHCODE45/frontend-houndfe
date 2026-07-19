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
import { EMPLOYEE_STATUS_FILTER } from '../constants/employee.constants'
import type { EmployeeStatusFilterValue } from '../constants/employee.constants'
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
  TimeOffRequest,
  VacationBalance,
  EmergencyContact,
  ReviewTimeOffDto,
  CreateEmergencyContactDto,
  UpdateEmergencyContactDto,
  CreateTimeOffDto,
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

export type EmployeeStatusFilter = EmployeeStatusFilterValue

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

/**
 * Normalize backend employee payloads to the frontend Employee contract.
 *
 * Some backend responses expose firstName/lastName instead of fullName. The list
 * UI relies on fullName for avatars, links, and manager labels, so derive it
 * defensively before rows reach Vue render functions.
 */
export function normalizeEmployee(raw: Employee & {
  firstName?: string | null
  lastName?: string | null
}): Employee {
  const apiFullName = typeof raw.fullName === 'string' ? raw.fullName.trim() : ''
  const derivedFullName = [raw.firstName, raw.lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .map((part) => part.trim())
    .join(' ')

  return {
    ...raw,
    fullName: apiFullName || derivedFullName || raw.employeeNumber || 'Colaborador',
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

    if (params.status && params.status !== EMPLOYEE_STATUS_FILTER.ALL) {
      queryParams.status = params.status
    } else if (params.status === EMPLOYEE_STATUS_FILTER.ALL) {
      // 'all' means no status filter — some backends ignore it, some need it
      // Send it explicitly to communicate intent
      queryParams.status = EMPLOYEE_STATUS_FILTER.ALL
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

    return mapPaginated({
      ...data,
      data: data.data.map(normalizeEmployee),
    })
  },

  /**
   * GET /admin/employees/:id — single employee detail.
   */
  async getById(id: string): Promise<Employee> {
    const { data } = await http.get<Employee>(`/admin/employees/${id}`)
    return normalizeEmployee(data)
  },

  /**
   * GET /admin/employees — active employees for manager picker.
   * Returns raw array (no pagination needed for picker use).
   */
  async listForPicker(search: string): Promise<Employee[]> {
    const { data } = await http.get<EmployeesBackendList>('/admin/employees', {
      params: {
        status: EMPLOYEE_STATUS_FILTER.ACTIVE,
        pageSize: 100,
        ...(search.trim() ? { search: search.trim() } : {}),
      },
    })
    return data.data.map(normalizeEmployee)
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
    return normalizeEmployee(data)
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
    return normalizeEmployee(data)
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
    return normalizeEmployee(data)
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
    return normalizeEmployee(data)
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
    return data.map(normalizeEmployee)
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
    return data.map(normalizeEmployee)
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

  /**
   * GET /admin/employees-documents/expiring — Tenant-wide expiring documents
   *
   * Requires read:EmployeeDocument permission.
   * Route uses HYPHEN (employees-documents) and is NOT under /:employeeId — tenant-wide view.
   * Query param: daysUntilExpiry (parsed with parseInt server-side, default 30).
   * Returns array of EmployeeDocument sorted by expiresAt asc (soonest first).
   * NEVER send tenantId.
   */
  async getExpiringDocuments(daysUntilExpiry?: number): Promise<EmployeeDocument[]> {
    const queryParams: Record<string, unknown> = {}
    if (daysUntilExpiry !== undefined) queryParams.daysUntilExpiry = daysUntilExpiry

    const { data } = await http.get<EmployeeDocument[]>(
      '/admin/employees-documents/expiring',
      { params: queryParams },
    )
    return data
  },

  // ─── Time-off — WU-10 ────────────────────────────────────────────────────

  /**
   * GET /admin/employees/:employeeId/time-off
   *
   * Requires read:EmployeeTimeOff permission.
   * Returns paginated list of EmployeeTimeOff.
   * SICK reason is null if caller lacks read:EmployeeTimeOffMedical (Tier 3 stripping).
   * Optional filters: status (TimeOffStatus), year (number), page, pageSize.
   * NEVER send tenantId.
   */
  async getTimeOff(
    employeeId: string,
    params?: {
      status?: string
      year?: number
      page?: number
      pageSize?: number
    },
  ): Promise<{ data: TimeOffRequest[]; total: number; page: number; limit: number }> {
    const queryParams: Record<string, unknown> = {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 50,
    }
    if (params?.status) queryParams.status = params.status
    if (params?.year) queryParams.year = params.year

    const { data } = await http.get<{
      data: TimeOffRequest[]
      total: number
      page: number
      limit: number
    }>(`/admin/employees/${employeeId}/time-off`, { params: queryParams })
    return data
  },

  /**
   * GET /admin/employees/:employeeId/time-off/vacation-balance
   *
   * Requires read:EmployeeTimeOff permission.
   * Returns { year, entitlement, used, pending, remaining }.
   * Days computed server-side as (endDate - startDate) / 86400000 + 1 UTC.
   * Optional year param defaults to current UTC year.
   * NEVER send tenantId.
   */
  async getVacationBalance(
    employeeId: string,
    year?: number,
  ): Promise<VacationBalance> {
    const queryParams: Record<string, unknown> = {}
    if (year) queryParams.year = year

    const { data } = await http.get<VacationBalance>(
      `/admin/employees/${employeeId}/time-off/vacation-balance`,
      { params: queryParams },
    )
    return data
  },

  /**
   * POST /admin/employees/:employeeId/time-off
   *
   * Requires create:EmployeeTimeOff permission. Returns 201 with created EmployeeTimeOff.
   * endDate must be >= startDate (backend: TIME_OFF_INVALID_DATE_RANGE).
   * Created with status: PENDING.
   * NEVER send tenantId.
   */
  async createTimeOff(employeeId: string, dto: CreateTimeOffDto): Promise<TimeOffRequest> {
    const { data } = await http.post<TimeOffRequest>(
      `/admin/employees/${employeeId}/time-off`,
      dto,
    )
    return data
  },

  /**
   * POST /admin/employees/:employeeId/time-off/:timeOffId/cancel
   *
   * Requires update:EmployeeTimeOff permission. Returns 200 OK.
   * No request body.
   * Only PENDING or future-APPROVED rows can be cancelled.
   * Backend error: TIME_OFF_INVALID_TRANSITION if cancellation is not allowed.
   * NEVER send tenantId.
   */
  async cancelTimeOff(employeeId: string, timeOffId: string): Promise<void> {
    await http.post(
      `/admin/employees/${employeeId}/time-off/${timeOffId}/cancel`,
      {},
    )
  },

  // ─── Time-off review — WU-11 ──────────────────────────────────────────────

  /**
   * POST /admin/employees/:employeeId/time-off/:timeOffId/review
   *
   * Requires update:EmployeeTimeOff permission.
   * Only works if current status is PENDING — backend throws TIME_OFF_INVALID_TRANSITION otherwise.
   * Body: { decision: 'APPROVED' | 'REJECTED', reviewerNotes?: string }
   * Returns 200 with the updated EmployeeTimeOff.
   * NEVER send tenantId.
   */
  async reviewTimeOff(
    employeeId: string,
    timeOffId: string,
    dto: ReviewTimeOffDto,
  ): Promise<TimeOffRequest> {
    const { data } = await http.post<TimeOffRequest>(
      `/admin/employees/${employeeId}/time-off/${timeOffId}/review`,
      dto,
    )
    return data
  },

  /**
   * GET /admin/employees-time-off/pending-approvals
   *
   * Requires read:EmployeeTimeOff permission.
   *
   * Tenant-wide queue of PENDING time-off requests — the manager→subordinates
   * model was removed backend-side; any user with read:EmployeeTimeOff sees
   * the full tenant backlog.
   * - Route uses HYPHEN (employees-time-off) — NOT under /:employeeId.
   * - Ordered by startDate asc.
   * - Medical reason stripping applied server-side.
   * - NEVER send tenantId — taken from the JWT.
   */
  async getPendingApprovals(): Promise<TimeOffRequest[]> {
    const { data } = await http.get<TimeOffRequest[]>(
      '/admin/employees-time-off/pending-approvals',
    )
    return data
  },

  // ─── Emergency contacts — WU-11 ────────────────────────────────────────────

  /**
   * GET /admin/employees/:employeeId/emergency-contacts
   *
   * Requires read:EmployeeEmergencyContact permission.
   * Returns full array (no pagination — small number expected per employee).
   * First contact by createdAt asc is the primary — no isPrimary field from backend.
   * NEVER send tenantId.
   */
  async getEmergencyContacts(employeeId: string): Promise<EmergencyContact[]> {
    const { data } = await http.get<EmergencyContact[]>(
      `/admin/employees/${employeeId}/emergency-contacts`,
    )
    return data
  },

  /**
   * POST /admin/employees/:employeeId/emergency-contacts
   *
   * Requires create:EmployeeEmergencyContact permission. Returns 201 with created contact.
   * NEVER send tenantId.
   */
  async createEmergencyContact(
    employeeId: string,
    dto: CreateEmergencyContactDto,
  ): Promise<EmergencyContact> {
    const { data } = await http.post<EmergencyContact>(
      `/admin/employees/${employeeId}/emergency-contacts`,
      dto,
    )
    return data
  },

  /**
   * PATCH /admin/employees/:employeeId/emergency-contacts/:contactId
   *
   * Requires update:EmployeeEmergencyContact permission. Returns 200 with updated contact.
   * Partial update — only provided fields are changed.
   * NEVER send tenantId.
   */
  async updateEmergencyContact(
    employeeId: string,
    contactId: string,
    dto: UpdateEmergencyContactDto,
  ): Promise<EmergencyContact> {
    const { data } = await http.patch<EmergencyContact>(
      `/admin/employees/${employeeId}/emergency-contacts/${contactId}`,
      dto,
    )
    return data
  },

  /**
   * DELETE /admin/employees/:employeeId/emergency-contacts/:contactId
   *
   * Requires delete:EmployeeEmergencyContact permission. Returns 204 No Content.
   * Backend throws EMERGENCY_CONTACT_NOT_FOUND if not found or not owned by employee.
   * NEVER send tenantId.
   */
  async deleteEmergencyContact(employeeId: string, contactId: string): Promise<void> {
    await http.delete(
      `/admin/employees/${employeeId}/emergency-contacts/${contactId}`,
    )
  },

}
