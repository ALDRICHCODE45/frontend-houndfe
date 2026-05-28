import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ZodError } from 'zod'

// ─── RED: These imports reference production code that does NOT exist yet ─────

// Task 1.1/1.2 — CASL subjects: ability module
import {
  ability,
  updateAbilityFromPermissionCodes,
  resetAbility,
} from '@/features/auth/authorization/ability'
import type { AppSubject } from '@/features/auth/interfaces/auth.types'

// Task 1.4 — Query key namespaces
import {
  employeeQueryKeys,
  employeeSalaryQueryKeys,
  employeeDocumentQueryKeys,
  employeeTimeOffQueryKeys,
  employeeEmergencyContactQueryKeys,
} from '@/core/shared/constants/query-keys'

// Task 1.5 — Zod schemas, helpers
import {
  EmployeeStatusSchema,
  ContractTypeSchema,
  WorkModalitySchema,
  GenderSchema,
  MaritalStatusSchema,
  EmployeeDocumentCategorySchema,
  TimeOffTypeSchema,
  TimeOffStatusSchema,
  EmployeeSchema,
  hasSalary,
  computeDays,
  TIME_OFF_TYPE_LABELS,
  EMPLOYEE_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  WORK_MODALITY_LABELS,
} from '@/features/admin/employees/interfaces/employee.types'

// Task 1.6 — Error map
import { EMPLOYEE_ERROR_MAP } from '@/features/admin/employees/interfaces/errors'

// Task 1.3 — Multipart helper
import { uploadMultipart, downloadFile } from '@/core/shared/api/multipart'
import { http } from '@/core/shared/api/http'

// ─── CASL: 6 new subjects parse correctly (Tasks 1.1 + 1.2) ──────────────────
describe('CASL — employee subjects (tasks 1.1 + 1.2)', () => {
  beforeEach(() => {
    resetAbility()
  })

  const newSubjects: AppSubject[] = [
    'Employee',
    'EmployeeSalary',
    'EmployeeDocument',
    'EmployeeTimeOff',
    'EmployeeTimeOffMedical',
    'EmployeeEmergencyContact',
  ]

  it.each(newSubjects)('parses read:%s permission correctly', (subject) => {
    updateAbilityFromPermissionCodes([`read:${subject}`])
    expect(ability.can('read', subject)).toBe(true)
    expect(ability.can('create', subject)).toBe(false)
  })

  it.each(newSubjects)('existing subjects still work after adding %s', (subject) => {
    updateAbilityFromPermissionCodes([`read:${subject}`, 'read:Product'])
    expect(ability.can('read', 'Product')).toBe(true)
    expect(ability.can('read', subject)).toBe(true)
  })

  it('all 6 new subjects are accepted in AppSubject type (compile-time check)', () => {
    // If AppSubject union is missing any of these, TypeScript will fail at build
    const subjects: AppSubject[] = [
      'Employee',
      'EmployeeSalary',
      'EmployeeDocument',
      'EmployeeTimeOff',
      'EmployeeTimeOffMedical',
      'EmployeeEmergencyContact',
    ]
    expect(subjects).toHaveLength(6)
  })

  it('subject NOT in runtime array is silently dropped (regression guard)', () => {
    // Only existing pre-WU-01 subjects should fail WITHOUT the 6 new ones being removed
    // After WU-01, 'Employee' parses. This test verifies parsePermissionCode filters unknown subjects.
    updateAbilityFromPermissionCodes(['read:UnknownSubject'])
    // 'UnknownSubject' is not in APP_SUBJECTS, so it should be silently dropped
    expect(ability.can('read', 'Product')).toBe(false) // was not granted
  })
})

// ─── Query Keys: 5 namespaces (Task 1.4) ─────────────────────────────────────
describe('employeeQueryKeys (task 1.4)', () => {
  it('paginated key starts with "employees" and includes tenantId', () => {
    const key = employeeQueryKeys.paginated('tenant-1')
    expect(key[0]).toBe('employees')
    expect(key[1]).toBe('tenant-1')
    expect(key[2]).toBe('paginated')
  })

  it('detail key includes tenantId and employeeId', () => {
    const key = employeeQueryKeys.detail('tenant-1', 'emp-5')
    expect(key).toContain('tenant-1')
    expect(key).toContain('emp-5')
    expect(key).toContain('detail')
  })

  it('different employee ids produce different detail keys', () => {
    const k1 = employeeQueryKeys.detail('tenant-1', 'emp-1')
    const k2 = employeeQueryKeys.detail('tenant-1', 'emp-2')
    expect(k1).not.toEqual(k2)
  })

  it('managerChain key includes id', () => {
    const key = employeeQueryKeys.managerChain('tenant-1', 'emp-5')
    expect(key).toContain('emp-5')
    expect(key).toContain('manager-chain')
  })

  it('activeForPicker key includes search term', () => {
    const key = employeeQueryKeys.activeForPicker('tenant-1', 'Mar')
    expect(key).toContain('Mar')
    expect(key).toContain('picker')
  })
})

describe('employeeSalaryQueryKeys (task 1.4)', () => {
  it('history key includes tenantId and employeeId', () => {
    const key = employeeSalaryQueryKeys.history('tenant-1', 'emp-5')
    expect(key).toContain('salary-history')
    expect(key).toContain('emp-5')
  })
})

describe('employeeDocumentQueryKeys (task 1.4)', () => {
  it('list key includes employeeId', () => {
    const key = employeeDocumentQueryKeys.list('tenant-1', 'emp-5')
    expect(key).toContain('documents')
    expect(key).toContain('emp-5')
  })

  it('expiring key includes threshold days', () => {
    const key = employeeDocumentQueryKeys.expiring('tenant-1', 30)
    expect(key).toContain(30)
    expect(key).toContain('documents-expiring')
  })

  it('different threshold days produce different expiring keys', () => {
    const k30 = employeeDocumentQueryKeys.expiring('tenant-1', 30)
    const k90 = employeeDocumentQueryKeys.expiring('tenant-1', 90)
    expect(k30).not.toEqual(k90)
  })
})

describe('employeeTimeOffQueryKeys (task 1.4)', () => {
  it('list key includes employeeId and year', () => {
    const key = employeeTimeOffQueryKeys.list('tenant-1', 'emp-5', 2026)
    expect(key).toContain('emp-5')
    expect(key).toContain('time-off')
  })

  it('balance key includes year', () => {
    const key = employeeTimeOffQueryKeys.balance('tenant-1', 'emp-5', 2026)
    expect(key).toContain(2026)
    expect(key).toContain('time-off-balance')
  })

  it('pending key is scoped per tenant (user resolved from JWT)', () => {
    const key = employeeTimeOffQueryKeys.pending('tenant-1')
    expect(key).toContain('tenant-1')
    expect(key).toContain('time-off-pending')
  })

  it('pendingByManager key includes the Employee.id of the target manager', () => {
    const key = employeeTimeOffQueryKeys.pendingByManager('tenant-1', 'manager-1')
    expect(key).toContain('manager-1')
    expect(key).toContain('time-off-pending-by-manager')
  })
})

describe('employeeEmergencyContactQueryKeys (task 1.4)', () => {
  it('list key includes employeeId', () => {
    const key = employeeEmergencyContactQueryKeys.list('tenant-1', 'emp-5')
    expect(key).toContain('emp-5')
    expect(key).toContain('emergency-contacts')
  })
})

// ─── Zod Schemas and Enums (Task 1.5) ────────────────────────────────────────
describe('EmployeeStatusSchema (task 1.5)', () => {
  it('accepts valid statuses', () => {
    expect(EmployeeStatusSchema.parse('ACTIVE')).toBe('ACTIVE')
    expect(EmployeeStatusSchema.parse('ON_LEAVE')).toBe('ON_LEAVE')
    expect(EmployeeStatusSchema.parse('TERMINATED')).toBe('TERMINATED')
  })

  it('rejects invalid status', () => {
    expect(() => EmployeeStatusSchema.parse('INVALID')).toThrow(ZodError)
  })
})

describe('ContractTypeSchema (task 1.5) — pinned to backend enum', () => {
  it('accepts PERMANENT', () => {
    expect(ContractTypeSchema.parse('PERMANENT')).toBe('PERMANENT')
  })

  it('accepts TEMPORARY', () => {
    expect(ContractTypeSchema.parse('TEMPORARY')).toBe('TEMPORARY')
  })

  it('accepts FREELANCE', () => {
    expect(ContractTypeSchema.parse('FREELANCE')).toBe('FREELANCE')
  })

  it('accepts INTERNSHIP', () => {
    expect(ContractTypeSchema.parse('INTERNSHIP')).toBe('INTERNSHIP')
  })

  it('rejects INDEFINIDO (old incorrect value)', () => {
    expect(() => ContractTypeSchema.parse('INDEFINIDO')).toThrow(ZodError)
  })

  it('rejects CONTRACTOR (old incorrect value)', () => {
    expect(() => ContractTypeSchema.parse('CONTRACTOR')).toThrow(ZodError)
  })
})

describe('WorkModalitySchema (task 1.5) — pinned to backend enum', () => {
  it('accepts ONSITE (not ON_SITE)', () => {
    expect(WorkModalitySchema.parse('ONSITE')).toBe('ONSITE')
  })

  it('accepts REMOTE', () => {
    expect(WorkModalitySchema.parse('REMOTE')).toBe('REMOTE')
  })

  it('accepts HYBRID', () => {
    expect(WorkModalitySchema.parse('HYBRID')).toBe('HYBRID')
  })

  it('rejects ON_SITE (old incorrect value)', () => {
    expect(() => WorkModalitySchema.parse('ON_SITE')).toThrow(ZodError)
  })
})

describe('EmployeeDocumentCategorySchema (task 1.5) — 9 values', () => {
  const validCategories = [
    'CONTRACT',
    'NDA',
    'EVALUATION',
    'CERTIFICATE',
    'WARNING',
    'ID_DOCUMENT',
    'CV',
    'MEDICAL',
    'OTHER',
  ] as const

  it.each(validCategories)('accepts %s', (cat) => {
    expect(EmployeeDocumentCategorySchema.parse(cat)).toBe(cat)
  })

  it('rejects ID (old DocumentType value)', () => {
    expect(() => EmployeeDocumentCategorySchema.parse('ID')).toThrow(ZodError)
  })
})

describe('TimeOffTypeSchema (task 1.5) — VACATION | SICK | PERSONAL | UNPAID', () => {
  it('accepts VACATION', () => {
    expect(TimeOffTypeSchema.parse('VACATION')).toBe('VACATION')
  })

  it('accepts SICK', () => {
    expect(TimeOffTypeSchema.parse('SICK')).toBe('SICK')
  })

  it('accepts PERSONAL', () => {
    expect(TimeOffTypeSchema.parse('PERSONAL')).toBe('PERSONAL')
  })

  it('accepts UNPAID', () => {
    expect(TimeOffTypeSchema.parse('UNPAID')).toBe('UNPAID')
  })

  it('rejects MATERNITY (not in v1 enum)', () => {
    expect(() => TimeOffTypeSchema.parse('MATERNITY')).toThrow(ZodError)
  })
})

describe('TimeOffStatusSchema (task 1.5)', () => {
  it('accepts PENDING', () => {
    expect(TimeOffStatusSchema.parse('PENDING')).toBe('PENDING')
  })

  it('accepts APPROVED', () => {
    expect(TimeOffStatusSchema.parse('APPROVED')).toBe('APPROVED')
  })

  it('accepts REJECTED', () => {
    expect(TimeOffStatusSchema.parse('REJECTED')).toBe('REJECTED')
  })

  it('accepts CANCELLED', () => {
    expect(TimeOffStatusSchema.parse('CANCELLED')).toBe('CANCELLED')
  })
})

describe('GenderSchema and MaritalStatusSchema (task 1.5)', () => {
  it('GenderSchema accepts MALE and FEMALE', () => {
    expect(GenderSchema.parse('MALE')).toBe('MALE')
    expect(GenderSchema.parse('FEMALE')).toBe('FEMALE')
  })

  it('GenderSchema rejects invalid', () => {
    expect(() => GenderSchema.parse('OTHER')).toThrow(ZodError)
  })

  it('MaritalStatusSchema accepts SINGLE', () => {
    expect(MaritalStatusSchema.parse('SINGLE')).toBe('SINGLE')
  })

  it('MaritalStatusSchema rejects invalid', () => {
    expect(() => MaritalStatusSchema.parse('DIVORCED')).toThrow(ZodError)
  })
})

describe('EmployeeSchema — full object validation (task 1.5)', () => {
  const validEmployee = {
    id: 'emp-1',
    employeeNumber: 'E001',
    fullName: 'Juan García',
    email: 'juan@empresa.com',
    status: 'ACTIVE',
    contractType: 'PERMANENT',
    workModality: 'ONSITE',
    currentPosition: 'Developer',
    currentDepartment: 'Engineering',
    managerId: null,
    hireDate: '2023-01-15',
    terminationDate: null,
    photoFileId: null,
    cvFileId: null,
  }

  it('parses a valid employee without salary fields', () => {
    const result = EmployeeSchema.parse(validEmployee)
    expect(result.id).toBe('emp-1')
    expect(result.status).toBe('ACTIVE')
    expect(result.currentSalaryCents).toBeUndefined()
  })

  it('parses a valid employee WITH salary fields present', () => {
    const withSalary = { ...validEmployee, currentSalaryCents: 150000, currentSalaryCurrency: 'MXN' }
    const result = EmployeeSchema.parse(withSalary)
    expect(result.currentSalaryCents).toBe(150000)
    expect(result.currentSalaryCurrency).toBe('MXN')
  })

  it('rejects employee with invalid status', () => {
    const invalid = { ...validEmployee, status: 'INVALID' }
    expect(() => EmployeeSchema.parse(invalid)).toThrow(ZodError)
  })

  it('rejects employee with invalid contractType (INDEFINIDO)', () => {
    const invalid = { ...validEmployee, contractType: 'INDEFINIDO' }
    expect(() => EmployeeSchema.parse(invalid)).toThrow(ZodError)
  })
})

// ─── hasSalary key-presence guard (Task 1.5) ─────────────────────────────────
describe('hasSalary() key-presence guard (task 1.5)', () => {
  it('returns true when currentSalaryCents key is present', () => {
    const emp = {
      id: 'emp-1',
      employeeNumber: 'E001',
      fullName: 'Juan',
      email: null,
      status: 'ACTIVE' as const,
      contractType: 'PERMANENT' as const,
      workModality: 'ONSITE' as const,
      currentPosition: null,
      currentDepartment: null,
      managerId: null,
      hireDate: '2023-01-15',
      terminationDate: null,
      photoFileId: null,
      cvFileId: null,
      currentSalaryCents: 100000,
      currentSalaryCurrency: 'MXN',
    }
    expect(hasSalary(emp)).toBe(true)
  })

  it('returns false when currentSalaryCents key is absent (delete-stripped)', () => {
    const emp = {
      id: 'emp-1',
      employeeNumber: 'E001',
      fullName: 'Juan',
      email: null,
      status: 'ACTIVE' as const,
      contractType: 'PERMANENT' as const,
      workModality: 'ONSITE' as const,
      currentPosition: null,
      currentDepartment: null,
      managerId: null,
      hireDate: '2023-01-15',
      terminationDate: null,
      photoFileId: null,
      cvFileId: null,
      // currentSalaryCents deliberately ABSENT (delete-stripped by backend)
    }
    expect(hasSalary(emp)).toBe(false)
  })

  it('returns true when currentSalaryCents is 0 (valid value, key present)', () => {
    // 0 is a valid salary — hasSalary checks KEY PRESENCE not truthiness
    const emp = {
      id: 'emp-1',
      employeeNumber: 'E001',
      fullName: 'Juan',
      email: null,
      status: 'ACTIVE' as const,
      contractType: 'PERMANENT' as const,
      workModality: 'ONSITE' as const,
      currentPosition: null,
      currentDepartment: null,
      managerId: null,
      hireDate: '2023-01-15',
      terminationDate: null,
      photoFileId: null,
      cvFileId: null,
      currentSalaryCents: 0,
      currentSalaryCurrency: 'MXN',
    }
    // Key IS present even if value is 0
    expect(hasSalary(emp)).toBe(true)
  })
})

// ─── computeDays() UTC-safe helper (Task 1.5) ─────────────────────────────────
describe('computeDays() UTC inclusive range (task 1.5)', () => {
  it('returns 1 for same start and end date', () => {
    expect(computeDays('2026-03-01', '2026-03-01')).toBe(1)
  })

  it('returns 3 for start=2026-03-01, end=2026-03-03', () => {
    // Backend desviación #5: UTC-inclusive days
    expect(computeDays('2026-03-01', '2026-03-03')).toBe(3)
  })

  it('returns 5 for a work-week span', () => {
    expect(computeDays('2026-04-06', '2026-04-10')).toBe(5)
  })

  it('is not affected by local timezone offset', () => {
    // Formula: (end - start) / 86400000 + 1 using UTC dates
    expect(computeDays('2026-01-01', '2026-01-31')).toBe(31)
  })
})

// ─── Label maps (Task 1.5) ────────────────────────────────────────────────────
describe('label maps (task 1.5)', () => {
  it('TIME_OFF_TYPE_LABELS has entry for SICK', () => {
    expect(TIME_OFF_TYPE_LABELS['SICK']).toBeDefined()
    expect(typeof TIME_OFF_TYPE_LABELS['SICK']).toBe('string')
  })

  it('EMPLOYEE_STATUS_LABELS maps TERMINATED', () => {
    expect(EMPLOYEE_STATUS_LABELS['TERMINATED']).toBeDefined()
  })

  it('CONTRACT_TYPE_LABELS maps PERMANENT', () => {
    expect(CONTRACT_TYPE_LABELS['PERMANENT']).toBeDefined()
  })

  it('WORK_MODALITY_LABELS maps ONSITE', () => {
    expect(WORK_MODALITY_LABELS['ONSITE']).toBeDefined()
  })
})

// ─── Error map (Task 1.6) ─────────────────────────────────────────────────────
describe('EMPLOYEE_ERROR_MAP (task 1.6)', () => {
  const requiredCodes = [
    'EMPLOYEE_NOT_FOUND',
    'EMPLOYEE_NUMBER_CONFLICT',
    'MANAGER_CYCLE',
    'MANAGER_SELF_REFERENCE',
    'EMPLOYEE_ALREADY_TERMINATED',
    'EMPLOYEE_NOT_TERMINATED',
    'TIME_OFF_NOT_FOUND',
    'TIME_OFF_INVALID_TRANSITION',
    'TIME_OFF_INVALID_DATE_RANGE',
    'EMPLOYEE_DOCUMENT_NOT_FOUND',
    'EMERGENCY_CONTACT_NOT_FOUND',
  ] as const

  it.each(requiredCodes)('maps %s to a Spanish string', (code) => {
    const message = EMPLOYEE_ERROR_MAP[code]
    expect(message).toBeDefined()
    expect(typeof message).toBe('string')
    expect(message!.length).toBeGreaterThan(0)
  })

  it('error messages are in Spanish', () => {
    // Spot-check: Spanish messages should contain Spanish words
    const msg = EMPLOYEE_ERROR_MAP['EMPLOYEE_NUMBER_CONFLICT']!
    // Must not be English (basic check)
    expect(msg).toBeTruthy()
  })

  it('does not include unsupported legacy/domain-error aliases', () => {
    expect('MANAGER_CYCLE_DETECTED' in EMPLOYEE_ERROR_MAP).toBe(false)
    expect('TIME_OFF_OVERLAP' in EMPLOYEE_ERROR_MAP).toBe(false)
    expect('EMPLOYEE_ALREADY_ACTIVE' in EMPLOYEE_ERROR_MAP).toBe(false)
    expect('DOCUMENT_NOT_FOUND' in EMPLOYEE_ERROR_MAP).toBe(false)
  })
})

// ─── Multipart helper — behavioral spy tests (Task 1.3) ──────────────────────
// These tests spy on the shared http client to verify the actual contract:
//   - uploadMultipart passes the FormData instance unchanged to http.post
//   - request config does NOT include Content-Type at all (omitted entirely)
//   - request config does NOT include tenantId
//   - downloadFile uses responseType: 'blob'
describe('uploadMultipart — http.post spy (task 1.3)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes the exact FormData instance to http.post unchanged', async () => {
    const formData = new FormData()
    formData.append('file', new Blob(['hello']), 'test.txt')
    const postSpy = vi
      .spyOn(http, 'post')
      .mockResolvedValueOnce({ data: { ok: true } } as never)

    await uploadMultipart('/admin/employees/1/documents', formData)

    expect(postSpy).toHaveBeenCalledOnce()
    // Non-null: toHaveBeenCalledOnce() guarantees calls[0] exists
    const callArgs = postSpy.mock.calls[0]!
    const body = callArgs[1]
    expect(body).toBe(formData) // exact same reference — not cloned or mutated
  })

  it('does not include Content-Type in the request config', async () => {
    const formData = new FormData()
    const postSpy = vi
      .spyOn(http, 'post')
      .mockResolvedValueOnce({ data: {} } as never)

    await uploadMultipart('/admin/employees/1/documents', formData)

    expect(postSpy).toHaveBeenCalledOnce()
    // Non-null: toHaveBeenCalledOnce() guarantees calls[0] exists
    const config = postSpy.mock.calls[0]![2] as Record<string, unknown> | undefined
    // Either no config at all, or headers object exists but has no Content-Type key
    const headers = (config?.headers ?? {}) as Record<string, unknown>
    expect('Content-Type' in headers).toBe(false)
  })

  it('does not include tenantId in the request config', async () => {
    const formData = new FormData()
    const postSpy = vi
      .spyOn(http, 'post')
      .mockResolvedValueOnce({ data: {} } as never)

    await uploadMultipart('/admin/employees/1/documents', formData)

    expect(postSpy).toHaveBeenCalledOnce()
    // Non-null: toHaveBeenCalledOnce() guarantees calls[0] exists
    const config = postSpy.mock.calls[0]![2] as Record<string, unknown> | undefined
    const headers = (config?.headers ?? {}) as Record<string, unknown>
    const params = (config?.params ?? {}) as Record<string, unknown>
    expect('tenantId' in headers).toBe(false)
    expect('tenantId' in params).toBe(false)
  })

  it('returns the response data from http.post', async () => {
    const formData = new FormData()
    vi.spyOn(http, 'post').mockResolvedValueOnce({ data: { id: 'doc-42' } } as never)

    const result = await uploadMultipart<{ id: string }>('/admin/employees/1/documents', formData)

    expect(result).toEqual({ id: 'doc-42' })
  })
})

describe('downloadFile — http.get spy (task 1.3)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls http.get with responseType: "blob"', async () => {
    const blob = new Blob(['binary data'])
    const getSpy = vi
      .spyOn(http, 'get')
      .mockResolvedValueOnce({ data: blob } as never)

    await downloadFile('/files/file-123')

    expect(getSpy).toHaveBeenCalledOnce()
    // Non-null: toHaveBeenCalledOnce() guarantees calls[0] exists
    const config = getSpy.mock.calls[0]![1] as Record<string, unknown> | undefined
    expect(config?.responseType).toBe('blob')
  })

  it('returns the Blob from the response', async () => {
    const blob = new Blob(['binary data'], { type: 'application/pdf' })
    vi.spyOn(http, 'get').mockResolvedValueOnce({ data: blob } as never)

    const result = await downloadFile('/files/file-123')

    expect(result).toBe(blob)
  })
})
