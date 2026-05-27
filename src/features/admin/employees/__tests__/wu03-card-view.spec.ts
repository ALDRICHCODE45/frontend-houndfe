/**
 * WU-03 — Card view, Tabla/Tarjetas toggle, manager name resolution
 *
 * Strict TDD — tests written BEFORE production code (RED phase).
 *
 * Coverage:
 * - Req: Table and Card Views — toggle persists in localStorage
 * - Req: Manager Display — resolved name from manager map; "—" for null; "—" on miss
 * - Req: No salary in cards — hasSalary guard; card data helper omits salary fields
 * - Req: Card data helper — assembles card props from Employee without salary
 * - Req: Antigüedad (seniority) helper — computed from hireDate
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── Task 3.1 — useEmployeeViewMode ────────────────────────────────────────────
import {
  getViewMode,
  setViewMode,
  VIEW_MODE_STORAGE_KEY,
} from '@/features/admin/employees/composables/useEmployeeViewMode'

// ── Task 3.2 — Manager resolution helper ─────────────────────────────────────
import {
  resolveManagerName,
  buildManagerMap,
} from '@/features/admin/employees/composables/useManagerResolution'

// ── Task 3.3 — EmployeeCard data helper ─────────────────────────────────────
import {
  buildCardData,
  computeSeniority,
} from '@/features/admin/employees/composables/useEmployeeViewMode'

import type { Employee } from '@/features/admin/employees/interfaces/employee.types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: '1',
    employeeNumber: 'EMP-001',
    fullName: 'Ana García',
    email: 'ana@example.com',
    status: 'ACTIVE',
    contractType: 'PERMANENT',
    workModality: 'ONSITE',
    currentPosition: 'Desarrolladora',
    currentDepartment: 'Tecnología',
    managerId: null,
    hireDate: '2023-01-15',
    terminationDate: null,
    photoFileId: null,
    cvFileId: null,
    ...overrides,
  }
}

// ─── useEmployeeViewMode — view persistence ────────────────────────────────────

describe('useEmployeeViewMode — view mode persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('returns "table" as default when localStorage is empty', () => {
    const mode = getViewMode()
    expect(mode).toBe('table')
  })

  it('persists "card" to localStorage via setViewMode', () => {
    setViewMode('card')
    expect(localStorage.getItem(VIEW_MODE_STORAGE_KEY)).toBe('card')
  })

  it('persists "table" to localStorage via setViewMode', () => {
    setViewMode('table')
    expect(localStorage.getItem(VIEW_MODE_STORAGE_KEY)).toBe('table')
  })

  it('reads back "card" from localStorage via getViewMode', () => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, 'card')
    const mode = getViewMode()
    expect(mode).toBe('card')
  })

  it('reads back "table" from localStorage via getViewMode', () => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, 'table')
    const mode = getViewMode()
    expect(mode).toBe('table')
  })

  it('falls back to "table" for unknown stored values', () => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, 'unknown-value')
    const mode = getViewMode()
    expect(mode).toBe('table')
  })
})

// ─── buildManagerMap — creates id→name map from array ────────────────────────

describe('buildManagerMap — manager id to name map', () => {
  it('builds map of id → fullName from employee array', () => {
    const managers: Employee[] = [
      makeEmployee({ id: 'mgr-1', fullName: 'Carlos López' }),
      makeEmployee({ id: 'mgr-2', fullName: 'María Ruiz' }),
    ]
    const map = buildManagerMap(managers)
    expect(map.get('mgr-1')).toBe('Carlos López')
    expect(map.get('mgr-2')).toBe('María Ruiz')
  })

  it('returns empty map for empty array', () => {
    const map = buildManagerMap([])
    expect(map.size).toBe(0)
  })

  it('map has exact count matching input array length', () => {
    const managers: Employee[] = [
      makeEmployee({ id: 'a', fullName: 'A' }),
      makeEmployee({ id: 'b', fullName: 'B' }),
      makeEmployee({ id: 'c', fullName: 'C' }),
    ]
    const map = buildManagerMap(managers)
    expect(map.size).toBe(3)
  })
})

// ─── resolveManagerName — resolves name from map ──────────────────────────────

describe('resolveManagerName — manager name resolution', () => {
  it('returns "—" when managerId is null', () => {
    const map = new Map<string, string>()
    expect(resolveManagerName(null, map)).toBe('—')
  })

  it('returns "—" when managerId is undefined', () => {
    const map = new Map<string, string>()
    expect(resolveManagerName(undefined, map)).toBe('—')
  })

  it('returns "—" when manager is not found in map', () => {
    const map = new Map<string, string>([['mgr-1', 'Carlos López']])
    expect(resolveManagerName('mgr-999', map)).toBe('—')
  })

  it('returns manager fullName when found in map', () => {
    const map = new Map<string, string>([['mgr-1', 'Carlos López']])
    expect(resolveManagerName('mgr-1', map)).toBe('Carlos López')
  })

  it('returns correct name among multiple managers in map', () => {
    const map = new Map<string, string>([
      ['a', 'Alice'],
      ['b', 'Bob'],
      ['c', 'Charlie'],
    ])
    expect(resolveManagerName('b', map)).toBe('Bob')
  })
})

// ─── buildCardData — card data helper (no salary) ─────────────────────────────

describe('buildCardData — card data assembly (no salary exposed)', () => {
  it('includes employee id, fullName, status', () => {
    const emp = makeEmployee({ id: 'emp-1', fullName: 'Luisa Vargas', status: 'ACTIVE' })
    const card = buildCardData(emp, '—')
    expect(card.id).toBe('emp-1')
    expect(card.fullName).toBe('Luisa Vargas')
    expect(card.status).toBe('ACTIVE')
  })

  it('includes currentPosition when present', () => {
    const emp = makeEmployee({ currentPosition: 'Tech Lead' })
    const card = buildCardData(emp, '—')
    expect(card.currentPosition).toBe('Tech Lead')
  })

  it('uses "—" for currentPosition when null', () => {
    const emp = makeEmployee({ currentPosition: null })
    const card = buildCardData(emp, '—')
    expect(card.currentPosition).toBe('—')
  })

  it('includes currentDepartment when present', () => {
    const emp = makeEmployee({ currentDepartment: 'Ingeniería' })
    const card = buildCardData(emp, '—')
    expect(card.currentDepartment).toBe('Ingeniería')
  })

  it('uses "—" for currentDepartment when null', () => {
    const emp = makeEmployee({ currentDepartment: null })
    const card = buildCardData(emp, '—')
    expect(card.currentDepartment).toBe('—')
  })

  it('includes managerDisplay from the provided string', () => {
    const emp = makeEmployee({ managerId: 'mgr-1' })
    const card = buildCardData(emp, 'Carlos López')
    expect(card.managerDisplay).toBe('Carlos López')
  })

  it('does NOT include currentSalaryCents in card data output', () => {
    const emp = makeEmployee({ currentSalaryCents: 100_000 } as Employee & { currentSalaryCents: number })
    const card = buildCardData(emp, '—')
    expect('currentSalaryCents' in card).toBe(false)
  })

  it('does NOT include currentSalaryCurrency in card data output', () => {
    const emp = makeEmployee({ currentSalaryCurrency: 'MXN' } as Employee & { currentSalaryCurrency: string })
    const card = buildCardData(emp, '—')
    expect('currentSalaryCurrency' in card).toBe(false)
  })

  it('includes hireDate for display', () => {
    const emp = makeEmployee({ hireDate: '2022-03-10' })
    const card = buildCardData(emp, '—')
    expect(card.hireDate).toBe('2022-03-10')
  })

  it('includes workModality', () => {
    const emp = makeEmployee({ workModality: 'REMOTE' })
    const card = buildCardData(emp, '—')
    expect(card.workModality).toBe('REMOTE')
  })
})

// ─── computeSeniority — computes seniority text from hireDate ─────────────────

describe('computeSeniority — seniority from hireDate', () => {
  it('returns "< 1 año" for hire date less than 1 year ago', () => {
    // Use a fixed reference date for determinism
    const refDate = new Date('2026-05-27')
    const hireDate = '2026-03-01' // ~3 months ago
    expect(computeSeniority(hireDate, refDate)).toBe('< 1 año')
  })

  it('returns "1 año" for hire date exactly 1 year ago', () => {
    const refDate = new Date('2026-05-27')
    const hireDate = '2025-05-27'
    expect(computeSeniority(hireDate, refDate)).toBe('1 año')
  })

  it('returns "2 años" for hire date 2+ years ago', () => {
    const refDate = new Date('2026-05-27')
    const hireDate = '2024-05-01'
    expect(computeSeniority(hireDate, refDate)).toBe('2 años')
  })

  it('returns "5 años" for hire date 5+ years ago', () => {
    const refDate = new Date('2026-05-27')
    const hireDate = '2021-01-10'
    expect(computeSeniority(hireDate, refDate)).toBe('5 años')
  })

  it('returns "1 año" (singular) not "1 años"', () => {
    const refDate = new Date('2026-05-27')
    const hireDate = '2025-05-27'
    const result = computeSeniority(hireDate, refDate)
    expect(result).toBe('1 año')
    expect(result).not.toContain('años')
  })

  it('returns plural "años" for 2+', () => {
    const refDate = new Date('2026-05-27')
    const hireDate = '2024-01-01'
    const result = computeSeniority(hireDate, refDate)
    expect(result).toContain('años')
  })
})
