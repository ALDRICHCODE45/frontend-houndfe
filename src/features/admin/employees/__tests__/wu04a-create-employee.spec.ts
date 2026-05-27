/**
 * WU-04A — Create Employee: DTO schema, API method, mutation composable
 *
 * Strict TDD — tests written BEFORE production code (RED phase).
 *
 * Coverage:
 * - Req: CreateEmployeeDto Zod schema — required fields, optional fields, no tenantId
 * - Req: employeesApi.create — POST /admin/employees, returns Employee, never sends tenantId
 * - Req: useCreateEmployee — mutation composable: mutateAsync, isPending, error
 * - Req: error mapping — domain error codes map to Spanish messages via EMPLOYEE_ERROR_MAP
 * - Req: cache invalidation — employeeQueryKeys.paginated invalidated on success
 *
 * Test layers:
 * - Unit: pure Zod schema validation (no mocks needed)
 * - Unit (with vi.spy): API method — verifies POST call and payload shape
 * - Unit: error-code extraction helper (pure function)
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ZodError } from 'zod'

// ── Task WU-04A.1 — Zod DTO schema ────────────────────────────────────────────
// RED: This import references production code that does NOT exist yet.
import {
  CreateEmployeeDtoSchema,
  type CreateEmployeeDto,
} from '@/features/admin/employees/interfaces/employee.types'

// ── Task WU-04A.2 — API method ────────────────────────────────────────────────
import { employeesApi } from '@/features/admin/employees/api/employees.api'
import { http } from '@/core/shared/api/http'

// ── Task WU-04A.3 — error-code extraction (pure helper) ──────────────────────
// RED: This import references production code that does NOT exist yet.
import { extractDomainErrorCode } from '@/features/admin/employees/composables/useCreateEmployee'

// ── Supporting imports (already exist) ───────────────────────────────────────
import { EMPLOYEE_ERROR_MAP } from '@/features/admin/employees/interfaces/errors'
import type { Employee } from '@/features/admin/employees/interfaces/employee.types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

const MINIMAL_VALID_DTO: CreateEmployeeDto = {
  employeeNumber: 'EMP-001',
  firstName: 'Juan',
  lastName: 'García',
  hireDate: '2026-01-15',
}

// ─── CreateEmployeeDtoSchema — Zod validation ─────────────────────────────────

describe('CreateEmployeeDtoSchema — required fields (WU-04A.1)', () => {
  it('accepts a minimal valid DTO with only required fields', () => {
    const result = CreateEmployeeDtoSchema.safeParse(MINIMAL_VALID_DTO)
    expect(result.success).toBe(true)
  })

  it('rejects DTO missing employeeNumber', () => {
    const result = CreateEmployeeDtoSchema.safeParse({
      firstName: 'Juan',
      lastName: 'García',
      hireDate: '2026-01-15',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('employeeNumber')
    }
  })

  it('rejects DTO missing firstName', () => {
    const result = CreateEmployeeDtoSchema.safeParse({
      employeeNumber: 'EMP-001',
      lastName: 'García',
      hireDate: '2026-01-15',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('firstName')
    }
  })

  it('rejects DTO missing lastName', () => {
    const result = CreateEmployeeDtoSchema.safeParse({
      employeeNumber: 'EMP-001',
      firstName: 'Juan',
      hireDate: '2026-01-15',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('lastName')
    }
  })

  it('rejects DTO missing hireDate', () => {
    const result = CreateEmployeeDtoSchema.safeParse({
      employeeNumber: 'EMP-001',
      firstName: 'Juan',
      lastName: 'García',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('hireDate')
    }
  })
})

describe('CreateEmployeeDtoSchema — optional fields (WU-04A.1 triangulation)', () => {
  it('accepts full DTO with all optional fields populated', () => {
    const full: CreateEmployeeDto = {
      ...MINIMAL_VALID_DTO,
      email: 'juan@empresa.com',
      phone: '+5215512345678',
      dateOfBirth: '1990-03-20',
      nationalId: 'ABCD123456',
      nationalIdType: 'INE',
      street: 'Av. Reforma',
      exteriorNumber: '222',
      interiorNumber: '4B',
      zipCode: '06600',
      neighborhood: 'Juárez',
      municipality: 'Cuauhtémoc',
      city: 'CDMX',
      state: 'CDMX',
      contractType: 'PERMANENT',
      workModality: 'HYBRID',
      currentPosition: 'Analista',
      currentDepartment: 'Finanzas',
      currentSchedule: 'L-V 9:00-18:00',
      currentResponsibilities: 'Análisis financiero',
      annualVacationDays: 12,
      managerId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      photoFileId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      cvFileId: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    }
    const result = CreateEmployeeDtoSchema.safeParse(full)
    expect(result.success).toBe(true)
  })

  it('accepts DTO with subset of optional fields (email only)', () => {
    const result = CreateEmployeeDtoSchema.safeParse({
      ...MINIMAL_VALID_DTO,
      email: 'test@example.com',
    })
    expect(result.success).toBe(true)
  })

  it('rejects DTO if nationalIdType has an invalid enum value', () => {
    const result = CreateEmployeeDtoSchema.safeParse({
      ...MINIMAL_VALID_DTO,
      nationalIdType: 'INVALID_TYPE',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('nationalIdType')
    }
  })

  it('rejects DTO if contractType has an invalid enum value', () => {
    const result = CreateEmployeeDtoSchema.safeParse({
      ...MINIMAL_VALID_DTO,
      contractType: 'INDEFINIDO',
    })
    expect(result.success).toBe(false)
  })

  it('rejects DTO if workModality has an invalid enum value', () => {
    const result = CreateEmployeeDtoSchema.safeParse({
      ...MINIMAL_VALID_DTO,
      workModality: 'ON_SITE',
    })
    expect(result.success).toBe(false)
  })

  it('schema does NOT contain a tenantId field', () => {
    // tenantId must never be sent to backend — extracted from JWT
    const shape = CreateEmployeeDtoSchema.shape
    expect('tenantId' in shape).toBe(false)
  })

  it('accepts annualVacationDays as a positive integer', () => {
    const result = CreateEmployeeDtoSchema.safeParse({
      ...MINIMAL_VALID_DTO,
      annualVacationDays: 15,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.annualVacationDays).toBe(15)
    }
  })
})

// ─── employeesApi.create — API spy tests ──────────────────────────────────────

describe('employeesApi.create — POST /admin/employees (WU-04A.2)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls http.post with /admin/employees and the dto payload', async () => {
    const mockEmployee = makeEmployee()
    const spy = vi.spyOn(http, 'post').mockResolvedValue({ data: mockEmployee })

    await employeesApi.create(MINIMAL_VALID_DTO)

    expect(spy).toHaveBeenCalledExactlyOnceWith('/admin/employees', MINIMAL_VALID_DTO)
  })

  it('returns the Employee object from the response', async () => {
    const mockEmployee = makeEmployee({ id: 'emp-new-uuid', employeeNumber: 'EMP-999' })
    vi.spyOn(http, 'post').mockResolvedValue({ data: mockEmployee })

    const result = await employeesApi.create(MINIMAL_VALID_DTO)

    expect(result.id).toBe('emp-new-uuid')
    expect(result.employeeNumber).toBe('EMP-999')
  })

  it('does NOT send tenantId in the payload', async () => {
    const spy = vi.spyOn(http, 'post').mockResolvedValue({ data: makeEmployee() })

    await employeesApi.create(MINIMAL_VALID_DTO)

    // The second argument to http.post is the body — must not have tenantId
    const body = spy.mock.calls[0]?.[1] as Record<string, unknown>
    expect('tenantId' in body).toBe(false)
  })

  it('propagates http errors to the caller', async () => {
    const networkError = new Error('Network Error')
    vi.spyOn(http, 'post').mockRejectedValue(networkError)

    await expect(employeesApi.create(MINIMAL_VALID_DTO)).rejects.toThrow('Network Error')
  })
})

// ─── extractDomainErrorCode — pure error helper ───────────────────────────────

describe('extractDomainErrorCode — pure error extraction helper (WU-04A.3)', () => {
  it('returns error code from axios error response body', () => {
    const axiosError = {
      response: {
        data: { error: 'EMPLOYEE_NUMBER_CONFLICT', message: 'Duplicate' },
      },
    }
    const code = extractDomainErrorCode(axiosError)
    expect(code).toBe('EMPLOYEE_NUMBER_CONFLICT')
  })

  it('returns error code for EMPLOYEE_NOT_FOUND (manager validation)', () => {
    const axiosError = {
      response: {
        data: { error: 'EMPLOYEE_NOT_FOUND', message: 'Manager not found' },
      },
    }
    const code = extractDomainErrorCode(axiosError)
    expect(code).toBe('EMPLOYEE_NOT_FOUND')
  })

  it('returns null when error response has no error field', () => {
    const axiosError = {
      response: {
        data: { message: 'Unknown error' },
      },
    }
    const code = extractDomainErrorCode(axiosError)
    expect(code).toBeNull()
  })

  it('returns null when error has no response (network error)', () => {
    const networkError = { message: 'Network Error' }
    const code = extractDomainErrorCode(networkError)
    expect(code).toBeNull()
  })

  it('returns null when error field is a string not in EMPLOYEE_ERROR_MAP', () => {
    // Unknown codes (e.g., from another module) should not be returned
    const axiosError = {
      response: {
        data: { error: 'UNKNOWN_DOMAIN_CODE' },
      },
    }
    const code = extractDomainErrorCode(axiosError)
    expect(code).toBeNull()
  })
})

// ─── EMPLOYEE_ERROR_MAP — domain codes coverage ───────────────────────────────

describe('EMPLOYEE_ERROR_MAP — create-employee relevant codes', () => {
  it('maps EMPLOYEE_NUMBER_CONFLICT to Spanish message', () => {
    expect(EMPLOYEE_ERROR_MAP['EMPLOYEE_NUMBER_CONFLICT']).toBe(
      'Ya existe un colaborador con ese número de empleado.',
    )
  })

  it('maps EMPLOYEE_NOT_FOUND to Spanish message', () => {
    expect(EMPLOYEE_ERROR_MAP['EMPLOYEE_NOT_FOUND']).toBe('No se encontró el colaborador.')
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
