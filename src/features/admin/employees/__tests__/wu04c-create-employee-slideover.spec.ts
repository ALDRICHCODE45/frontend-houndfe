/**
 * WU-04C — Create Employee Slideover: pure form logic
 *
 * Strict TDD — tests written BEFORE production code (RED phase).
 *
 * Coverage:
 * - Req: buildCreateEmployeeFormState() — initial state factory (all required empty, optionals undefined)
 * - Req: formStateToDto() — maps form state to CreateEmployeeDto (trims strings, coerces vacationDays)
 * - Req: DTO produced by formStateToDto() is valid per CreateEmployeeDtoSchema
 * - Req: formStateToDto() strips empty optional strings (not sent to backend)
 * - Req: formStateToDto() maps managerId from string|null correctly
 * - Req: formStateToDto() casts annualVacationDays string → number integer
 *
 * Test layers:
 * - Unit: pure functions (ZERO mocks needed)
 *
 * Note: Component mount tests (USlideover) require a real browser environment and
 * are deferred to E2E. The pure helpers cover all business logic concerns.
 */

import { describe, it, expect } from 'vitest'

// ── RED: imports referencing production code that does NOT exist yet ───────────
import {
  buildCreateEmployeeFormState,
  formStateToDto,
  type CreateEmployeeFormState,
} from '@/features/admin/employees/composables/useCreateEmployeeForm'

import { CreateEmployeeDtoSchema } from '@/features/admin/employees/interfaces/employee.types'

// ─── buildCreateEmployeeFormState — initial state factory ─────────────────────

describe('buildCreateEmployeeFormState — initial state (WU-04C.1)', () => {
  it('returns an object with required fields as empty strings', () => {
    const state = buildCreateEmployeeFormState()
    expect(state.employeeNumber).toBe('')
    expect(state.firstName).toBe('')
    expect(state.lastName).toBe('')
    expect(state.hireDate).toBe('')
  })

  it('returns an object with optional fields as empty string or undefined', () => {
    const state = buildCreateEmployeeFormState()
    // email and phone are optional — initial value is ''
    expect(state.email).toBe('')
    expect(state.phone).toBe('')
    // Selects default to empty string (renders "Seleccionar" placeholder)
    expect(state.contractType).toBe('')
    expect(state.workModality).toBe('')
    // managerId starts as null (no manager selected)
    expect(state.managerId).toBeNull()
    // annualVacationDays starts as empty string (renders empty input)
    expect(state.annualVacationDays).toBe('')
  })

  it('returns a fresh object on each call (not a shared reference)', () => {
    const stateA = buildCreateEmployeeFormState()
    const stateB = buildCreateEmployeeFormState()
    stateA.firstName = 'Modified'
    expect(stateB.firstName).toBe('')
  })

  it('has all fields declared by CreateEmployeeFormState (structural check)', () => {
    const state = buildCreateEmployeeFormState()
    const keys = Object.keys(state)
    expect(keys).toContain('employeeNumber')
    expect(keys).toContain('firstName')
    expect(keys).toContain('lastName')
    expect(keys).toContain('hireDate')
    expect(keys).toContain('email')
    expect(keys).toContain('phone')
    expect(keys).toContain('contractType')
    expect(keys).toContain('workModality')
    expect(keys).toContain('currentPosition')
    expect(keys).toContain('currentDepartment')
    expect(keys).toContain('annualVacationDays')
    expect(keys).toContain('managerId')
  })
})

// ─── formStateToDto — maps form state to CreateEmployeeDto ────────────────────

describe('formStateToDto — maps form state to dto (WU-04C.2)', () => {
  const VALID_STATE: CreateEmployeeFormState = {
    employeeNumber: 'EMP-042',
    firstName: 'Lucía',
    lastName: 'Martínez',
    hireDate: '2026-03-01',
    email: '',
    phone: '',
    contractType: '',
    workModality: '',
    currentPosition: '',
    currentDepartment: '',
    annualVacationDays: '',
    managerId: null,
  }

  it('maps required fields to dto correctly', () => {
    const dto = formStateToDto(VALID_STATE)
    expect(dto.employeeNumber).toBe('EMP-042')
    expect(dto.firstName).toBe('Lucía')
    expect(dto.lastName).toBe('Martínez')
    expect(dto.hireDate).toBe('2026-03-01')
  })

  it('trims whitespace from string fields', () => {
    const dto = formStateToDto({
      ...VALID_STATE,
      firstName: '  Lucía  ',
      lastName: '  Martínez  ',
      employeeNumber: ' EMP-042 ',
    })
    expect(dto.firstName).toBe('Lucía')
    expect(dto.lastName).toBe('Martínez')
    expect(dto.employeeNumber).toBe('EMP-042')
  })

  it('omits email from dto when form email is empty string', () => {
    const dto = formStateToDto({ ...VALID_STATE, email: '' })
    expect('email' in dto).toBe(false)
  })

  it('includes email in dto when form email is non-empty', () => {
    const dto = formStateToDto({ ...VALID_STATE, email: 'lucia@empresa.com' })
    expect(dto.email).toBe('lucia@empresa.com')
  })

  it('omits phone from dto when form phone is empty string', () => {
    const dto = formStateToDto({ ...VALID_STATE, phone: '' })
    expect('phone' in dto).toBe(false)
  })

  it('includes phone in dto when non-empty', () => {
    const dto = formStateToDto({ ...VALID_STATE, phone: '+5215555555555' })
    expect(dto.phone).toBe('+5215555555555')
  })

  it('omits contractType from dto when empty string (no selection)', () => {
    const dto = formStateToDto({ ...VALID_STATE, contractType: '' })
    expect('contractType' in dto).toBe(false)
  })

  it('includes contractType in dto when a valid value is selected', () => {
    const dto = formStateToDto({ ...VALID_STATE, contractType: 'PERMANENT' })
    expect(dto.contractType).toBe('PERMANENT')
  })

  it('omits workModality from dto when empty string (no selection)', () => {
    const dto = formStateToDto({ ...VALID_STATE, workModality: '' })
    expect('workModality' in dto).toBe(false)
  })

  it('includes workModality in dto when a valid value is selected', () => {
    const dto = formStateToDto({ ...VALID_STATE, workModality: 'REMOTE' })
    expect(dto.workModality).toBe('REMOTE')
  })

  it('omits currentPosition from dto when empty string', () => {
    const dto = formStateToDto({ ...VALID_STATE, currentPosition: '' })
    expect('currentPosition' in dto).toBe(false)
  })

  it('includes currentPosition in dto when non-empty', () => {
    const dto = formStateToDto({ ...VALID_STATE, currentPosition: 'Analista de Datos' })
    expect(dto.currentPosition).toBe('Analista de Datos')
  })

  it('omits currentDepartment from dto when empty string', () => {
    const dto = formStateToDto({ ...VALID_STATE, currentDepartment: '' })
    expect('currentDepartment' in dto).toBe(false)
  })

  it('sets managerId in dto when provided as UUID string', () => {
    const uuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    const dto = formStateToDto({ ...VALID_STATE, managerId: uuid })
    expect(dto.managerId).toBe(uuid)
  })

  it('omits managerId from dto when null (no manager selected)', () => {
    const dto = formStateToDto({ ...VALID_STATE, managerId: null })
    expect('managerId' in dto).toBe(false)
  })

  it('omits annualVacationDays from dto when form value is empty string', () => {
    const dto = formStateToDto({ ...VALID_STATE, annualVacationDays: '' })
    expect('annualVacationDays' in dto).toBe(false)
  })

  it('casts annualVacationDays to integer when a string number is provided', () => {
    const dto = formStateToDto({ ...VALID_STATE, annualVacationDays: '15' })
    expect(dto.annualVacationDays).toBe(15)
    expect(Number.isInteger(dto.annualVacationDays)).toBe(true)
  })

  it('produces a DTO that passes CreateEmployeeDtoSchema validation (minimal)', () => {
    const dto = formStateToDto(VALID_STATE)
    const result = CreateEmployeeDtoSchema.safeParse(dto)
    expect(result.success).toBe(true)
  })

  it('produces a DTO that passes CreateEmployeeDtoSchema validation (full optional fields)', () => {
    const fullState: CreateEmployeeFormState = {
      employeeNumber: 'EMP-099',
      firstName: 'Roberto',
      lastName: 'Sánchez',
      hireDate: '2025-06-01',
      email: 'roberto@empresa.com',
      phone: '+5215500000001',
      contractType: 'TEMPORARY',
      workModality: 'HYBRID',
      currentPosition: 'Director Comercial',
      currentDepartment: 'Ventas',
      annualVacationDays: '20',
      managerId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    }
    const dto = formStateToDto(fullState)
    const result = CreateEmployeeDtoSchema.safeParse(dto)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.annualVacationDays).toBe(20)
      expect(result.data.managerId).toBe('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22')
    }
  })

  it('does NOT include tenantId in the produced dto', () => {
    const dto = formStateToDto(VALID_STATE)
    expect('tenantId' in dto).toBe(false)
  })
})
