/**
 * WU-03 — Manager name resolution and seniority
 *
 * Coverage:
 * - Req: Manager Display — resolved name from manager map; "—" for null; "—" on miss
 * - Req: Antigüedad (seniority) helper — computed from hireDate
 *
 * The Tabla/Tarjetas toggle and the card data helper were retired with the card grid
 * (one list layout: table on desktop, cards on mobile).
 */

import { describe, it, expect } from 'vitest'

// ── Task 3.2 — Manager resolution helper ─────────────────────────────────────
import {
  resolveManagerName,
  buildManagerMap,
  type ManagerInfo,
} from '@/features/admin/employees/composables/useManagerResolution'

// ── Task 3.3 — seniority helper ──────────────────────────────────────────────
import { computeSeniority } from '@/features/admin/employees/composables/useEmployeeColumns'

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

describe('buildManagerMap — manager id to name map', () => {
  it('builds map of id → ManagerInfo from employee array', () => {
    const managers: Employee[] = [
      makeEmployee({ id: 'mgr-1', fullName: 'Carlos López', email: 'carlos@test.com' }),
      makeEmployee({ id: 'mgr-2', fullName: 'María Ruiz', email: 'maria@test.com' }),
    ]
    const map = buildManagerMap(managers)
    expect(map.get('mgr-1')?.fullName).toBe('Carlos López')
    expect(map.get('mgr-1')?.email).toBe('carlos@test.com')
    expect(map.get('mgr-2')?.fullName).toBe('María Ruiz')
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
  const info = (fullName: string, email: string | null = null) => ({ fullName, email, currentPosition: null, currentDepartment: null })

  it('returns "—" when managerId is null', () => {
    const map = new Map<string, ManagerInfo>()
    expect(resolveManagerName(null, map)).toBe('—')
  })

  it('returns "—" when managerId is undefined', () => {
    const map = new Map<string, ManagerInfo>()
    expect(resolveManagerName(undefined, map)).toBe('—')
  })

  it('returns "—" when manager is not found in map', () => {
    const map = new Map([['mgr-1', info('Carlos López')]])
    expect(resolveManagerName('mgr-999', map)).toBe('—')
  })

  it('returns manager fullName when found in map', () => {
    const map = new Map([['mgr-1', info('Carlos López')]])
    expect(resolveManagerName('mgr-1', map)).toBe('Carlos López')
  })

  it('returns correct name among multiple managers in map', () => {
    const map = new Map([
      ['a', info('Alice')],
      ['b', info('Bob')],
      ['c', info('Charlie')],
    ])
    expect(resolveManagerName('b', map)).toBe('Bob')
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
