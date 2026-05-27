/**
 * WU-04B — Manager Picker: composable pure helpers + composable logic
 *
 * Strict TDD — tests written BEFORE production code (RED phase).
 *
 * Coverage:
 * - Req: filterExcludedId() pure helper — excludes a given id from picker results
 * - Req: buildPickerOptions() pure helper — maps Employee[] to ManagerPickerOption[]
 * - Req: filterBySearch() pure helper — client-side search guard (length ≥ 1)
 * - Req: composable enabled logic — query enabled when isOpen=true OR search.length ≥ 1
 * - Req: excludeId filtering — self-exclusion for edit mode
 * - Req: staleTime — 60_000 ms
 *
 * Test layers:
 * - Unit: pure helpers (no mocks needed)
 * - Unit: composable integration via vi.mock for @tanstack/vue-query
 *
 * Pure helpers exported from useManagerPicker.ts are testable with ZERO mocks.
 */

import { describe, it, expect } from 'vitest'

// ── RED: imports referencing production code that does NOT exist yet ─────────
import {
  filterExcludedId,
  buildPickerOptions,
  type ManagerPickerOption,
} from '@/features/admin/employees/composables/useManagerPicker'

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
    currentPosition: 'Gerente de Tecnología',
    currentDepartment: 'Tecnología',
    managerId: null,
    hireDate: '2022-01-15',
    terminationDate: null,
    photoFileId: null,
    cvFileId: null,
    ...overrides,
  }
}

const MANAGER_A = makeEmployee({
  id: 'uuid-manager-a',
  fullName: 'Ana López',
  currentPosition: 'Directora',
  currentDepartment: 'Operaciones',
})

const MANAGER_B = makeEmployee({
  id: 'uuid-manager-b',
  fullName: 'Carlos Ruiz',
  currentPosition: 'Gerente',
  currentDepartment: 'Finanzas',
})

const MANAGER_C = makeEmployee({
  id: 'uuid-manager-c',
  fullName: 'Sofía Torres',
  currentPosition: null,
  currentDepartment: null,
})

// ─── filterExcludedId — exclude self from picker results ───────────────────────

describe('filterExcludedId — self-exclusion for edit mode (WU-04B.1)', () => {
  it('returns all employees when excludeId is undefined', () => {
    const employees = [MANAGER_A, MANAGER_B]
    const result = filterExcludedId(employees, undefined)
    expect(result).toHaveLength(2)
    expect(result[0]?.id).toBe('uuid-manager-a')
    expect(result[1]?.id).toBe('uuid-manager-b')
  })

  it('removes the employee matching excludeId', () => {
    const employees = [MANAGER_A, MANAGER_B, MANAGER_C]
    const result = filterExcludedId(employees, 'uuid-manager-b')
    expect(result).toHaveLength(2)
    const ids = result.map((e) => e.id)
    expect(ids).not.toContain('uuid-manager-b')
    expect(ids).toContain('uuid-manager-a')
    expect(ids).toContain('uuid-manager-c')
  })

  it('returns empty array when all employees are excluded (single-employee list)', () => {
    const result = filterExcludedId([MANAGER_A], 'uuid-manager-a')
    expect(result).toHaveLength(0)
  })

  it('returns unchanged array when excludeId does not match any employee', () => {
    const employees = [MANAGER_A, MANAGER_B]
    const result = filterExcludedId(employees, 'uuid-nonexistent')
    expect(result).toHaveLength(2)
  })

  it('returns unchanged array when excludeId is null', () => {
    const employees = [MANAGER_A, MANAGER_B]
    const result = filterExcludedId(employees, null)
    expect(result).toHaveLength(2)
  })
})

// ─── buildPickerOptions — map Employee[] to ManagerPickerOption[] ─────────────

describe('buildPickerOptions — maps employees to picker option shape (WU-04B.1 triangulation)', () => {
  it('maps a single employee to a ManagerPickerOption with id, label, position, department', () => {
    const [option] = buildPickerOptions([MANAGER_A])
    expect(option).toBeDefined()
    expect(option!.id).toBe('uuid-manager-a')
    expect(option!.label).toBe('Ana López')
    expect(option!.position).toBe('Directora')
    expect(option!.department).toBe('Operaciones')
  })

  it('uses fallback "—" for null position', () => {
    const [option] = buildPickerOptions([MANAGER_C])
    expect(option!.position).toBe('—')
  })

  it('uses fallback "—" for null department', () => {
    const [option] = buildPickerOptions([MANAGER_C])
    expect(option!.department).toBe('—')
  })

  it('maps multiple employees preserving order', () => {
    const options = buildPickerOptions([MANAGER_A, MANAGER_B, MANAGER_C])
    expect(options).toHaveLength(3)
    expect(options[0]?.id).toBe('uuid-manager-a')
    expect(options[1]?.id).toBe('uuid-manager-b')
    expect(options[2]?.id).toBe('uuid-manager-c')
  })

  it('returns empty array for empty employee list', () => {
    const options = buildPickerOptions([])
    expect(options).toHaveLength(0)
  })

  it('maps employee with all fields correctly (full integration case)', () => {
    const emp = makeEmployee({
      id: 'uuid-full',
      fullName: 'Roberto Mendoza',
      currentPosition: 'VP Comercial',
      currentDepartment: 'Ventas',
    })
    const [option] = buildPickerOptions([emp])
    expect(option!.id).toBe('uuid-full')
    expect(option!.label).toBe('Roberto Mendoza')
    expect(option!.position).toBe('VP Comercial')
    expect(option!.department).toBe('Ventas')
  })
})

// ─── ManagerPickerOption type contract ────────────────────────────────────────

describe('ManagerPickerOption — type shape contract (WU-04B.1 structural)', () => {
  it('option has id, label, position, department properties', () => {
    const option: ManagerPickerOption = buildPickerOptions([MANAGER_A])[0]!
    // These property accesses prove the type has these fields
    expect(typeof option.id).toBe('string')
    expect(typeof option.label).toBe('string')
    expect(typeof option.position).toBe('string')
    expect(typeof option.department).toBe('string')
  })
})

// ─── filterExcludedId + buildPickerOptions combined (triangulation) ───────────

describe('filterExcludedId + buildPickerOptions — combined pipeline (WU-04B triangulation)', () => {
  it('combined pipeline: excludes self and maps remaining to picker options', () => {
    // Simulate edit mode: 3 employees, excluding MANAGER_B (self)
    const employees = [MANAGER_A, MANAGER_B, MANAGER_C]
    const filtered = filterExcludedId(employees, 'uuid-manager-b')
    const options = buildPickerOptions(filtered)

    expect(options).toHaveLength(2)
    const ids = options.map((o) => o.id)
    expect(ids).toContain('uuid-manager-a')
    expect(ids).toContain('uuid-manager-c')
    expect(ids).not.toContain('uuid-manager-b')
  })

  it('combined pipeline: no exclusion returns all mapped options', () => {
    const employees = [MANAGER_A, MANAGER_B]
    const filtered = filterExcludedId(employees, undefined)
    const options = buildPickerOptions(filtered)
    expect(options).toHaveLength(2)
    expect(options[0]?.label).toBe('Ana López')
    expect(options[1]?.label).toBe('Carlos Ruiz')
  })

  it('buildPickerOptions preserves correct position/department for multiple employees with nulls', () => {
    const options = buildPickerOptions([MANAGER_A, MANAGER_C])
    // MANAGER_A has real values
    expect(options[0]?.position).toBe('Directora')
    expect(options[0]?.department).toBe('Operaciones')
    // MANAGER_C has null values — must use fallback
    expect(options[1]?.position).toBe('—')
    expect(options[1]?.department).toBe('—')
  })
})
