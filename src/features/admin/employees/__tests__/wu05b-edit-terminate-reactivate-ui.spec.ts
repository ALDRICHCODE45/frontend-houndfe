/**
 * WU-05B — Edit Employee Slideover + Terminate/Reactivate Dialogs + Row Action Menu
 *
 * Strict TDD — tests written BEFORE production code (RED phase).
 *
 * Coverage:
 * - buildEditEmployeeFormState(employee) — pure factory that pre-fills form from an Employee
 * - editFormStateToDto(state) — maps edit form state to UpdateEmployeeDto (strips unchanged/empty)
 * - canTerminate(status) — pure guard: ACTIVE | ON_LEAVE → true; TERMINATED → false
 * - canReactivate(status) — pure guard: TERMINATED → true; others → false
 * - buildTerminateFormState() — fresh TerminateEmployeeFormState
 * - getEmployeeRowActions(employee, canUpdate) — returns action items based on status + CASL
 *
 * Test layers:
 * - Unit: all pure functions (ZERO mocks needed)
 *
 * Note: Component mount tests (USlideover, UModal) require a real browser environment.
 * The pure helpers cover all business logic concerns per Strict TDD module.
 */

import { describe, it, expect } from 'vitest'

// ── RED: imports referencing production code that does NOT exist yet ───────────
import {
  buildEditEmployeeFormState,
  editFormStateToDto,
  type EditEmployeeFormState,
} from '@/features/admin/employees/composables/useEditEmployeeForm'

import {
  canTerminate,
  canReactivate,
  getEmployeeRowActions,
} from '@/features/admin/employees/composables/useEmployeeActions'

import { UpdateEmployeeDtoSchema } from '@/features/admin/employees/interfaces/employee.types'
import type { Employee, EmployeeStatus } from '@/features/admin/employees/interfaces/employee.types'

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

// ─────────────────────────────────────────────────────────────────────────────
// buildEditEmployeeFormState — pre-fills edit form from an Employee
// ─────────────────────────────────────────────────────────────────────────────

describe('buildEditEmployeeFormState — pre-fills form from Employee (WU-05B.1)', () => {
  it('maps employeeNumber from the employee', () => {
    const emp = makeEmployee({ employeeNumber: 'EMP-042' })
    const state = buildEditEmployeeFormState(emp)
    expect(state.employeeNumber).toBe('EMP-042')
  })

  it('maps firstName and lastName by splitting fullName', () => {
    const emp = makeEmployee({ fullName: 'Lucía Martínez' })
    const state = buildEditEmployeeFormState(emp)
    expect(state.firstName).toBe('Lucía')
    expect(state.lastName).toBe('Martínez')
  })

  it('maps fullName with multiple parts: first word → firstName, rest → lastName', () => {
    const emp = makeEmployee({ fullName: 'María José López Torres' })
    const state = buildEditEmployeeFormState(emp)
    expect(state.firstName).toBe('María')
    expect(state.lastName).toBe('José López Torres')
  })

  it('maps email to empty string when email is null', () => {
    const emp = makeEmployee({ email: null })
    const state = buildEditEmployeeFormState(emp)
    expect(state.email).toBe('')
  })

  it('maps email correctly when it exists', () => {
    const emp = makeEmployee({ email: 'juan@empresa.com' })
    const state = buildEditEmployeeFormState(emp)
    expect(state.email).toBe('juan@empresa.com')
  })

  it('maps contractType to the employee contractType enum value', () => {
    const emp = makeEmployee({ contractType: 'TEMPORARY' })
    const state = buildEditEmployeeFormState(emp)
    expect(state.contractType).toBe('TEMPORARY')
  })

  it('maps workModality to the employee workModality enum value', () => {
    const emp = makeEmployee({ workModality: 'REMOTE' })
    const state = buildEditEmployeeFormState(emp)
    expect(state.workModality).toBe('REMOTE')
  })

  it('maps currentPosition to empty string when null', () => {
    const emp = makeEmployee({ currentPosition: null })
    const state = buildEditEmployeeFormState(emp)
    expect(state.currentPosition).toBe('')
  })

  it('maps currentDepartment to empty string when null', () => {
    const emp = makeEmployee({ currentDepartment: null })
    const state = buildEditEmployeeFormState(emp)
    expect(state.currentDepartment).toBe('')
  })

  it('maps managerId when set, preserving the UUID string', () => {
    const uuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    const emp = makeEmployee({ managerId: uuid })
    const state = buildEditEmployeeFormState(emp)
    expect(state.managerId).toBe(uuid)
  })

  it('maps managerId to empty string when null (no manager)', () => {
    const emp = makeEmployee({ managerId: null })
    const state = buildEditEmployeeFormState(emp)
    expect(state.managerId).toBe('')
  })

  it('does NOT include hireDate in the state (not editable)', () => {
    const emp = makeEmployee({ hireDate: '2026-01-15' })
    const state = buildEditEmployeeFormState(emp)
    expect('hireDate' in state).toBe(false)
  })

  it('returns a fresh object on each call (not a shared reference)', () => {
    const emp = makeEmployee()
    const stateA = buildEditEmployeeFormState(emp)
    const stateB = buildEditEmployeeFormState(emp)
    stateA.employeeNumber = 'MODIFIED'
    expect(stateB.employeeNumber).toBe('EMP-001')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// editFormStateToDto — maps edit form state to UpdateEmployeeDto
// ─────────────────────────────────────────────────────────────────────────────

describe('editFormStateToDto — maps edit state to UpdateEmployeeDto (WU-05B.2)', () => {
  const BASE_STATE: EditEmployeeFormState = {
    employeeNumber: 'EMP-001',
    firstName: 'Juan',
    lastName: 'García',
    email: 'juan@empresa.com',
    phone: '',
    dateOfBirth: '',
    nationalId: '',
    nationalIdType: '',
    street: '',
    exteriorNumber: '',
    interiorNumber: '',
    zipCode: '',
    neighborhood: '',
    municipality: '',
    city: '',
    state: '',
    contractType: 'PERMANENT',
    workModality: 'HYBRID',
    currentPosition: 'Analista',
    currentDepartment: 'Finanzas',
    currentSchedule: '',
    currentResponsibilities: '',
    annualVacationDays: null,
    managerId: '',
  }

  it('includes required editable fields in the dto', () => {
    const dto = editFormStateToDto(BASE_STATE)
    expect(dto.employeeNumber).toBe('EMP-001')
    expect(dto.firstName).toBe('Juan')
    expect(dto.lastName).toBe('García')
  })

  it('trims whitespace from string fields', () => {
    const dto = editFormStateToDto({ ...BASE_STATE, firstName: '  Carlos  ', lastName: '  López  ' })
    expect(dto.firstName).toBe('Carlos')
    expect(dto.lastName).toBe('López')
  })

  it('omits email from dto when empty string', () => {
    const dto = editFormStateToDto({ ...BASE_STATE, email: '' })
    expect('email' in dto).toBe(false)
  })

  it('includes email in dto when non-empty', () => {
    const dto = editFormStateToDto({ ...BASE_STATE, email: 'updated@empresa.com' })
    expect(dto.email).toBe('updated@empresa.com')
  })

  it('omits phone from dto when empty string', () => {
    const dto = editFormStateToDto({ ...BASE_STATE, phone: '' })
    expect('phone' in dto).toBe(false)
  })

  it('includes phone in dto when non-empty', () => {
    const dto = editFormStateToDto({ ...BASE_STATE, phone: '+5215555555555' })
    expect(dto.phone).toBe('+5215555555555')
  })

  it('prefills phone, personal document, address, schedule and responsibilities fields', () => {
    const emp = makeEmployee({
      phone: '+52 55 1234 5678',
      dateOfBirth: '1990-05-20',
      nationalId: 'ABC123456',
      nationalIdType: 'INE',
      street: 'Av. Reforma',
      exteriorNumber: '123',
      interiorNumber: '4B',
      zipCode: '06600',
      neighborhood: 'Juárez',
      municipality: 'Cuauhtémoc',
      city: 'Ciudad de México',
      state: 'CDMX',
      currentSchedule: 'Lunes a viernes 9:00–18:00',
      currentResponsibilities: 'Coordinar operación diaria',
    })
    const state = buildEditEmployeeFormState(emp)

    expect(state.phone).toBe('+52 55 1234 5678')
    expect(state.dateOfBirth).toBe('1990-05-20')
    expect(state.nationalId).toBe('ABC123456')
    expect(state.nationalIdType).toBe('INE')
    expect(state.street).toBe('Av. Reforma')
    expect(state.exteriorNumber).toBe('123')
    expect(state.interiorNumber).toBe('4B')
    expect(state.zipCode).toBe('06600')
    expect(state.neighborhood).toBe('Juárez')
    expect(state.municipality).toBe('Cuauhtémoc')
    expect(state.city).toBe('Ciudad de México')
    expect(state.state).toBe('CDMX')
    expect(state.currentSchedule).toBe('Lunes a viernes 9:00–18:00')
    expect(state.currentResponsibilities).toBe('Coordinar operación diaria')
  })

  it('includes visible personal, address and labor fields in dto when provided', () => {
    const dto = editFormStateToDto({
      ...BASE_STATE,
      dateOfBirth: '1990-05-20',
      nationalId: 'ABC123456',
      nationalIdType: 'PASSPORT',
      street: 'Av. Reforma',
      exteriorNumber: '123',
      zipCode: '06600',
      city: 'Ciudad de México',
      currentSchedule: 'Lunes a viernes 9:00–18:00',
      currentResponsibilities: 'Coordinar operación diaria',
    })

    expect(dto.dateOfBirth).toBe('1990-05-20')
    expect(dto.nationalId).toBe('ABC123456')
    expect(dto.nationalIdType).toBe('PASSPORT')
    expect(dto.street).toBe('Av. Reforma')
    expect(dto.exteriorNumber).toBe('123')
    expect(dto.zipCode).toBe('06600')
    expect(dto.city).toBe('Ciudad de México')
    expect(dto.currentSchedule).toBe('Lunes a viernes 9:00–18:00')
    expect(dto.currentResponsibilities).toBe('Coordinar operación diaria')
  })

  it('includes contractType from enum value', () => {
    const dto = editFormStateToDto({ ...BASE_STATE, contractType: 'TEMPORARY' })
    expect(dto.contractType).toBe('TEMPORARY')
  })

  it('omits contractType when empty string (no selection)', () => {
    const dto = editFormStateToDto({ ...BASE_STATE, contractType: '' })
    expect('contractType' in dto).toBe(false)
  })

  it('includes workModality from enum value', () => {
    const dto = editFormStateToDto({ ...BASE_STATE, workModality: 'REMOTE' })
    expect(dto.workModality).toBe('REMOTE')
  })

  it('omits managerId when empty string', () => {
    const dto = editFormStateToDto({ ...BASE_STATE, managerId: '' })
    expect('managerId' in dto).toBe(false)
  })

  it('includes managerId when a UUID is provided', () => {
    const uuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    const dto = editFormStateToDto({ ...BASE_STATE, managerId: uuid })
    expect(dto.managerId).toBe(uuid)
  })

  it('omits annualVacationDays when null', () => {
    const dto = editFormStateToDto({ ...BASE_STATE, annualVacationDays: null })
    expect('annualVacationDays' in dto).toBe(false)
  })

  it('includes annualVacationDays when provided as number', () => {
    const dto = editFormStateToDto({ ...BASE_STATE, annualVacationDays: 15 })
    expect(dto.annualVacationDays).toBe(15)
  })

  it('does NOT include hireDate in the dto (not patchable)', () => {
    const dto = editFormStateToDto(BASE_STATE)
    expect('hireDate' in dto).toBe(false)
  })

  it('does NOT include tenantId in the dto', () => {
    const dto = editFormStateToDto(BASE_STATE)
    expect('tenantId' in dto).toBe(false)
  })

  it('produces a dto that passes UpdateEmployeeDtoSchema validation', () => {
    const dto = editFormStateToDto(BASE_STATE)
    const result = UpdateEmployeeDtoSchema.safeParse(dto)
    expect(result.success).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// canTerminate — ACTIVE | ON_LEAVE → true; TERMINATED → false
// ─────────────────────────────────────────────────────────────────────────────

describe('canTerminate — status guard (WU-05B.3)', () => {
  it('returns true for ACTIVE employee', () => {
    expect(canTerminate('ACTIVE')).toBe(true)
  })

  it('returns true for ON_LEAVE employee', () => {
    expect(canTerminate('ON_LEAVE')).toBe(true)
  })

  it('returns false for TERMINATED employee', () => {
    expect(canTerminate('TERMINATED')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// canReactivate — TERMINATED → true; ACTIVE | ON_LEAVE → false
// ─────────────────────────────────────────────────────────────────────────────

describe('canReactivate — status guard (WU-05B.4)', () => {
  it('returns true for TERMINATED employee', () => {
    expect(canReactivate('TERMINATED')).toBe(true)
  })

  it('returns false for ACTIVE employee', () => {
    expect(canReactivate('ACTIVE')).toBe(false)
  })

  it('returns false for ON_LEAVE employee', () => {
    expect(canReactivate('ON_LEAVE')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getEmployeeRowActions — row action items based on status + CASL canUpdate
// ─────────────────────────────────────────────────────────────────────────────

describe('getEmployeeRowActions — row action menu items (WU-05B.5)', () => {
  it('returns empty array when canUpdate is false (no permission)', () => {
    const emp = makeEmployee({ status: 'ACTIVE' })
    const actions = getEmployeeRowActions(emp, false)
    expect(actions).toEqual([])
  })

  it('includes Editar action when canUpdate is true', () => {
    const emp = makeEmployee({ status: 'ACTIVE' })
    const actions = getEmployeeRowActions(emp, true)
    const labels = actions.map((a) => a.label)
    expect(labels).toContain('Editar')
  })

  it('includes Dar de baja action for ACTIVE employee when canUpdate is true', () => {
    const emp = makeEmployee({ status: 'ACTIVE' })
    const actions = getEmployeeRowActions(emp, true)
    const labels = actions.map((a) => a.label)
    expect(labels).toContain('Dar de baja')
  })

  it('includes Dar de baja action for ON_LEAVE employee when canUpdate is true', () => {
    const emp = makeEmployee({ status: 'ON_LEAVE' })
    const actions = getEmployeeRowActions(emp, true)
    const labels = actions.map((a) => a.label)
    expect(labels).toContain('Dar de baja')
  })

  it('does NOT include Dar de baja for TERMINATED employee', () => {
    const emp = makeEmployee({ status: 'TERMINATED' })
    const actions = getEmployeeRowActions(emp, true)
    const labels = actions.map((a) => a.label)
    expect(labels).not.toContain('Dar de baja')
  })

  it('includes Reactivar action for TERMINATED employee when canUpdate is true', () => {
    const emp = makeEmployee({ status: 'TERMINATED' })
    const actions = getEmployeeRowActions(emp, true)
    const labels = actions.map((a) => a.label)
    expect(labels).toContain('Reactivar')
  })

  it('does NOT include Reactivar for ACTIVE employee', () => {
    const emp = makeEmployee({ status: 'ACTIVE' })
    const actions = getEmployeeRowActions(emp, true)
    const labels = actions.map((a) => a.label)
    expect(labels).not.toContain('Reactivar')
  })

  it('does NOT include Reactivar for ON_LEAVE employee', () => {
    const emp = makeEmployee({ status: 'ON_LEAVE' })
    const actions = getEmployeeRowActions(emp, true)
    const labels = actions.map((a) => a.label)
    expect(labels).not.toContain('Reactivar')
  })

  it('each action item has a label string and an onSelect function', () => {
    const emp = makeEmployee({ status: 'ACTIVE' })
    const actions = getEmployeeRowActions(emp, true)
    for (const action of actions) {
      expect(typeof action.label).toBe('string')
      expect(typeof action.onSelect).toBe('function')
    }
  })

  it('Dar de baja action has color error for visual distinction', () => {
    const emp = makeEmployee({ status: 'ACTIVE' })
    const actions = getEmployeeRowActions(emp, true)
    const terminate = actions.find((a) => a.label === 'Dar de baja')
    expect(terminate?.color).toBe('error')
  })

  it('ACTIVE employee with canUpdate has exactly 2 actions: Editar + Dar de baja', () => {
    const emp = makeEmployee({ status: 'ACTIVE' })
    const actions = getEmployeeRowActions(emp, true)
    expect(actions).toHaveLength(2)
  })

  it('TERMINATED employee with canUpdate has exactly 2 actions: Editar + Reactivar', () => {
    const emp = makeEmployee({ status: 'TERMINATED' })
    const actions = getEmployeeRowActions(emp, true)
    expect(actions).toHaveLength(2)
  })
})
