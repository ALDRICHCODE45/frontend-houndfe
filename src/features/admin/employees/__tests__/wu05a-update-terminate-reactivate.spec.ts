/**
 * WU-05A — Update / Terminate / Reactivate Employee
 *
 * Strict TDD — tests written BEFORE production code (RED phase).
 *
 * Coverage:
 * - UpdateEmployeeDtoSchema — partial of CreateEmployeeDto fields minus hireDate, employeeNumber optional, no tenantId
 * - TerminateEmployeeDtoSchema — terminationDate (required), terminationReason (required)
 * - employeesApi.update(id, dto) — PATCH /admin/employees/:id, returns Employee
 * - employeesApi.terminate(id, dto) — POST /admin/employees/:id/terminate, returns Employee
 * - employeesApi.reactivate(id) — POST /admin/employees/:id/reactivate (no body), returns Employee
 * - useUpdateEmployee() — mutation composable: invalidates paginated + detail; maps domain errors
 * - useTerminateEmployee() — mutation composable: same invalidation + error pattern
 * - useReactivateEmployee() — mutation composable: same pattern
 *
 * Test layers:
 * - Unit: pure Zod schema validation (no mocks)
 * - Unit (vi.spyOn): API methods — verify HTTP verb, URL, payload shape
 * - Unit: composable error mapping (reuses extractDomainErrorCode from WU-04A)
 */

import { describe, it, expect, vi, afterEach } from 'vitest'

// ── Task 1 — Zod schemas ──────────────────────────────────────────────────────
// RED: These imports reference production code that does NOT exist yet.
import {
  UpdateEmployeeDtoSchema,
  TerminateEmployeeDtoSchema,
  type UpdateEmployeeDto,
  type TerminateEmployeeDto,
  ContractTypeSchema,
  WorkModalitySchema,
} from '@/features/admin/employees/interfaces/employee.types'

// ── Task 3-5 — API methods ─────────────────────────────────────────────────────
import { employeesApi } from '@/features/admin/employees/api/employees.api'
import { http } from '@/core/shared/api/http'

// ── Supporting imports (already exist) ────────────────────────────────────────
import { EMPLOYEE_ERROR_MAP } from '@/features/admin/employees/interfaces/errors'
import { extractDomainErrorCode } from '@/features/admin/employees/composables/useCreateEmployee'
import type { Employee } from '@/features/admin/employees/interfaces/employee.types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-uuid-1',
    employeeNumber: 'EMP-001',
    fullName: 'Juan García',
    email: 'juan@empresa.com',
    status: 'ACTIVE',
    contractType: 'PERMANENT',
    workModality: 'HYBRID',
    currentPosition: 'Analista',
    currentDepartment: 'Finanzas',
    managerId: null,
    hireDate: '2026-01-15',
    terminationDate: null,
    photoFileId: null,
    cvFileId: null,
    ...overrides,
  }
}

const EMPLOYEE_ID = 'emp-uuid-1'

// ─────────────────────────────────────────────────────────────────────────────
// Task 1: UpdateEmployeeDtoSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('UpdateEmployeeDtoSchema — all fields optional, no hireDate, no tenantId (Task 1)', () => {
  it('accepts an empty object (fully partial update)', () => {
    const result = UpdateEmployeeDtoSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts a single-field update (firstName only)', () => {
    const result = UpdateEmployeeDtoSchema.safeParse({ firstName: 'Carlos' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.firstName).toBe('Carlos')
    }
  })

  it('accepts employeeNumber as optional string', () => {
    const result = UpdateEmployeeDtoSchema.safeParse({ employeeNumber: 'EMP-002' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.employeeNumber).toBe('EMP-002')
    }
  })

  it('does NOT have a hireDate field in its shape', () => {
    const shape = UpdateEmployeeDtoSchema.shape
    expect('hireDate' in shape).toBe(false)
  })

  it('does NOT have a tenantId field in its shape', () => {
    const shape = UpdateEmployeeDtoSchema.shape
    expect('tenantId' in shape).toBe(false)
  })

  it('rejects invalid contractType enum value', () => {
    const result = UpdateEmployeeDtoSchema.safeParse({ contractType: 'INDEFINIDO' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('contractType')
    }
  })

  it('rejects invalid workModality enum value (ON_SITE is wrong — must be ONSITE)', () => {
    const result = UpdateEmployeeDtoSchema.safeParse({ workModality: 'ON_SITE' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('workModality')
    }
  })

  it('accepts a full update with all supported fields', () => {
    const full: UpdateEmployeeDto = {
      employeeNumber: 'EMP-002',
      firstName: 'Ana',
      lastName: 'López',
      email: 'ana@empresa.com',
      phone: '+5215512345678',
      contractType: 'TEMPORARY',
      workModality: 'REMOTE',
      currentPosition: 'Coordinadora',
      currentDepartment: 'Marketing',
      annualVacationDays: 20,
      managerId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    }
    const result = UpdateEmployeeDtoSchema.safeParse(full)
    expect(result.success).toBe(true)
  })

  it('accepts managerId as optional UUID', () => {
    const result = UpdateEmployeeDtoSchema.safeParse({
      managerId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    })
    expect(result.success).toBe(true)
  })

  it('rejects managerId that is not a valid UUID', () => {
    const result = UpdateEmployeeDtoSchema.safeParse({ managerId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 2: TerminateEmployeeDtoSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('TerminateEmployeeDtoSchema — terminationDate + terminationReason required (Task 2)', () => {
  it('accepts a valid terminate DTO with both required fields', () => {
    const dto: TerminateEmployeeDto = {
      terminationDate: '2026-05-27',
      terminationReason: 'Renuncia voluntaria',
    }
    const result = TerminateEmployeeDtoSchema.safeParse(dto)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.terminationDate).toBe('2026-05-27')
      expect(result.data.terminationReason).toBe('Renuncia voluntaria')
    }
  })

  it('rejects DTO missing terminationDate', () => {
    const result = TerminateEmployeeDtoSchema.safeParse({ terminationReason: 'Renuncia' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('terminationDate')
    }
  })

  it('rejects DTO missing terminationReason', () => {
    const result = TerminateEmployeeDtoSchema.safeParse({ terminationDate: '2026-05-27' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('terminationReason')
    }
  })

  it('rejects empty string terminationDate (min(1) validation)', () => {
    const result = TerminateEmployeeDtoSchema.safeParse({
      terminationDate: '',
      terminationReason: 'Renuncia',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty string terminationReason (min(1) validation)', () => {
    const result = TerminateEmployeeDtoSchema.safeParse({
      terminationDate: '2026-05-27',
      terminationReason: '',
    })
    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 3: employeesApi.update — PATCH /admin/employees/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('employeesApi.update — PATCH /admin/employees/:id (Task 3)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls http.patch with the correct URL and dto payload', async () => {
    const updated = makeEmployee({ firstName: 'Ana' } as Partial<Employee>)
    const spy = vi.spyOn(http, 'patch').mockResolvedValue({ data: updated })
    const dto: UpdateEmployeeDto = { firstName: 'Ana' }

    await employeesApi.update(EMPLOYEE_ID, dto)

    expect(spy).toHaveBeenCalledExactlyOnceWith(`/admin/employees/${EMPLOYEE_ID}`, dto)
  })

  it('returns the updated Employee object', async () => {
    const updated = makeEmployee({ currentPosition: 'Senior Analista' })
    vi.spyOn(http, 'patch').mockResolvedValue({ data: updated })

    const result = await employeesApi.update(EMPLOYEE_ID, { currentPosition: 'Senior Analista' })

    expect(result.currentPosition).toBe('Senior Analista')
  })

  it('does NOT include tenantId in the request body', async () => {
    const spy = vi.spyOn(http, 'patch').mockResolvedValue({ data: makeEmployee() })
    const dto: UpdateEmployeeDto = { firstName: 'Carlos' }

    await employeesApi.update(EMPLOYEE_ID, dto)

    const body = spy.mock.calls[0]?.[1] as Record<string, unknown>
    expect('tenantId' in body).toBe(false)
  })

  it('propagates HTTP errors to the caller', async () => {
    vi.spyOn(http, 'patch').mockRejectedValue(new Error('Network Error'))

    await expect(employeesApi.update(EMPLOYEE_ID, {})).rejects.toThrow('Network Error')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 4: employeesApi.terminate — POST /admin/employees/:id/terminate
// ─────────────────────────────────────────────────────────────────────────────

describe('employeesApi.terminate — POST /admin/employees/:id/terminate (Task 4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const TERMINATE_DTO: TerminateEmployeeDto = {
    terminationDate: '2026-05-27',
    terminationReason: 'Renuncia voluntaria',
  }

  it('calls http.post with the correct URL and body', async () => {
    const terminated = makeEmployee({ status: 'TERMINATED', terminationDate: '2026-05-27' })
    const spy = vi.spyOn(http, 'post').mockResolvedValue({ data: terminated })

    await employeesApi.terminate(EMPLOYEE_ID, TERMINATE_DTO)

    expect(spy).toHaveBeenCalledExactlyOnceWith(
      `/admin/employees/${EMPLOYEE_ID}/terminate`,
      TERMINATE_DTO,
    )
  })

  it('returns the terminated Employee with status TERMINATED', async () => {
    const terminated = makeEmployee({ status: 'TERMINATED', terminationDate: '2026-05-27' })
    vi.spyOn(http, 'post').mockResolvedValue({ data: terminated })

    const result = await employeesApi.terminate(EMPLOYEE_ID, TERMINATE_DTO)

    expect(result.status).toBe('TERMINATED')
    expect(result.terminationDate).toBe('2026-05-27')
  })

  it('propagates HTTP errors (EMPLOYEE_ALREADY_TERMINATED 409)', async () => {
    vi.spyOn(http, 'post').mockRejectedValue(new Error('Conflict'))

    await expect(employeesApi.terminate(EMPLOYEE_ID, TERMINATE_DTO)).rejects.toThrow('Conflict')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 5: employeesApi.reactivate — POST /admin/employees/:id/reactivate
// ─────────────────────────────────────────────────────────────────────────────

describe('employeesApi.reactivate — POST /admin/employees/:id/reactivate (Task 5)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls http.post with the correct URL and no body (empty object)', async () => {
    const reactivated = makeEmployee({ status: 'ACTIVE', terminationDate: null })
    const spy = vi.spyOn(http, 'post').mockResolvedValue({ data: reactivated })

    await employeesApi.reactivate(EMPLOYEE_ID)

    expect(spy).toHaveBeenCalledExactlyOnceWith(
      `/admin/employees/${EMPLOYEE_ID}/reactivate`,
      {},
    )
  })

  it('returns the reactivated Employee with status ACTIVE', async () => {
    const reactivated = makeEmployee({ status: 'ACTIVE', terminationDate: null })
    vi.spyOn(http, 'post').mockResolvedValue({ data: reactivated })

    const result = await employeesApi.reactivate(EMPLOYEE_ID)

    expect(result.status).toBe('ACTIVE')
    expect(result.terminationDate).toBeNull()
  })

  it('propagates HTTP errors (EMPLOYEE_NOT_TERMINATED 409)', async () => {
    vi.spyOn(http, 'post').mockRejectedValue(new Error('Conflict'))

    await expect(employeesApi.reactivate(EMPLOYEE_ID)).rejects.toThrow('Conflict')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tasks 6-8: Domain error mapping — extractDomainErrorCode (reused from WU-04A)
// Tests confirm the shared helper covers terminate/reactivate error codes
// ─────────────────────────────────────────────────────────────────────────────

describe('extractDomainErrorCode — WU-05A error codes (Tasks 6-8)', () => {
  it('returns EMPLOYEE_ALREADY_TERMINATED for terminate on already-terminated employee', () => {
    const axiosError = {
      response: { data: { error: 'EMPLOYEE_ALREADY_TERMINATED' } },
    }
    expect(extractDomainErrorCode(axiosError)).toBe('EMPLOYEE_ALREADY_TERMINATED')
  })

  it('returns EMPLOYEE_NOT_TERMINATED for reactivate on non-terminated employee', () => {
    const axiosError = {
      response: { data: { error: 'EMPLOYEE_NOT_TERMINATED' } },
    }
    expect(extractDomainErrorCode(axiosError)).toBe('EMPLOYEE_NOT_TERMINATED')
  })

  it('returns MANAGER_CYCLE for update with circular manager assignment', () => {
    const axiosError = {
      response: { data: { error: 'MANAGER_CYCLE' } },
    }
    expect(extractDomainErrorCode(axiosError)).toBe('MANAGER_CYCLE')
  })

  it('returns MANAGER_SELF_REFERENCE for update where employee sets themselves as manager', () => {
    const axiosError = {
      response: { data: { error: 'MANAGER_SELF_REFERENCE' } },
    }
    expect(extractDomainErrorCode(axiosError)).toBe('MANAGER_SELF_REFERENCE')
  })

  it('returns EMPLOYEE_NUMBER_CONFLICT for update with duplicate employee number', () => {
    const axiosError = {
      response: { data: { error: 'EMPLOYEE_NUMBER_CONFLICT' } },
    }
    expect(extractDomainErrorCode(axiosError)).toBe('EMPLOYEE_NUMBER_CONFLICT')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE_ERROR_MAP — WU-05A relevant codes (verify map completeness)
// ─────────────────────────────────────────────────────────────────────────────

describe('EMPLOYEE_ERROR_MAP — WU-05A relevant domain error codes', () => {
  it('maps EMPLOYEE_ALREADY_TERMINATED to Spanish message', () => {
    expect(EMPLOYEE_ERROR_MAP['EMPLOYEE_ALREADY_TERMINATED']).toBe(
      'El colaborador ya se encuentra dado de baja.',
    )
  })

  it('maps EMPLOYEE_NOT_TERMINATED to Spanish message', () => {
    expect(EMPLOYEE_ERROR_MAP['EMPLOYEE_NOT_TERMINATED']).toBe(
      'El colaborador no está dado de baja.',
    )
  })

  it('maps MANAGER_CYCLE to Spanish message', () => {
    expect(EMPLOYEE_ERROR_MAP['MANAGER_CYCLE']).toBe(
      'No se puede asignar ese jefe directo porque crearía un ciclo en el organigrama.',
    )
  })

  it('maps MANAGER_SELF_REFERENCE to Spanish message', () => {
    expect(EMPLOYEE_ERROR_MAP['MANAGER_SELF_REFERENCE']).toBe(
      'Un colaborador no puede ser su propio jefe directo.',
    )
  })
})
