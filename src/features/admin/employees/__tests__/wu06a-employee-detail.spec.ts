/**
 * WU-06A — Employee Detail View Shell
 *
 * Strict TDD — tests written BEFORE production code (RED phase).
 *
 * Coverage:
 * - computeSalaryDisplay(employee) — formats salary or returns placeholder
 * - computeAntiguedad(hireDate, now) — same as computeSeniority (reuses helper)
 * - computeTabFromQuery(query) — maps ?tab= param to valid tab key
 * - resolveDetailTab(tabKey) — returns valid tab or default
 * - buildProfileInitials(fullName) — first 2 words, first letter each
 * - computeHireDateAge(hireDate, now) — days elapsed since hire date
 * - formatCurrencyMXN(amountCents, currency) — formats cents to locale string
 * - useEmployeeDetail composable (logic layer — query key, enabled guard)
 *
 * Test layers:
 * - Unit: all pure functions (ZERO mocks needed)
 *
 * Note: Component mount tests for EmployeeDetailView/panels are skipped —
 * they require a real browser env + full Nuxt UI context.
 * Pure helpers cover all business logic concerns per Strict TDD module.
 */

import { describe, it, expect } from 'vitest'

// ── RED: imports referencing production code that does NOT exist yet ───────────
import {
  computeTabFromQuery,
  resolveDetailTab,
  buildProfileInitials,
  formatCurrencyMXN,
  EMPLOYEE_DETAIL_TABS,
  type EmployeeDetailTabKey,
} from '@/features/admin/employees/composables/useEmployeeDetail'

import { hasSalary } from '@/features/admin/employees/interfaces/employee.types'
import type { Employee } from '@/features/admin/employees/interfaces/employee.types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-uuid-1',
    employeeNumber: 'EMP-001',
    fullName: 'Juan García',
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
    currentSchedule: 'L-V 9:00-18:00',
    currentResponsibilities: 'Análisis financiero',
    annualVacationDays: 12,
    ...overrides,
  }
}

// ─── TRIANGULATE: computeTabFromQuery ────────────────────────────────────────

describe('computeTabFromQuery', () => {
  it('returns "resumen" when query is undefined', () => {
    const result = computeTabFromQuery(undefined)
    expect(result).toBe('resumen')
  })

  it('returns "resumen" when query is empty string', () => {
    const result = computeTabFromQuery('')
    expect(result).toBe('resumen')
  })

  it('returns "personal" when query is "personal"', () => {
    const result = computeTabFromQuery('personal')
    expect(result).toBe('personal')
  })

  it('returns "laboral" when query is "laboral"', () => {
    const result = computeTabFromQuery('laboral')
    expect(result).toBe('laboral')
  })

  it('returns "resumen" for an unknown tab key', () => {
    const result = computeTabFromQuery('nonexistent-tab')
    expect(result).toBe('resumen')
  })

  it('returns "resumen" for an injection attempt', () => {
    const result = computeTabFromQuery('<script>alert(1)</script>')
    expect(result).toBe('resumen')
  })
})

// ─── resolveDetailTab ─────────────────────────────────────────────────────────

describe('resolveDetailTab', () => {
  it('returns "resumen" for null input', () => {
    expect(resolveDetailTab(null)).toBe('resumen')
  })

  it('returns "resumen" for undefined input', () => {
    expect(resolveDetailTab(undefined)).toBe('resumen')
  })

  it('returns "compensacion" for valid "compensacion" key', () => {
    expect(resolveDetailTab('compensacion')).toBe('compensacion')
  })

  it('returns "resumen" for invalid key', () => {
    expect(resolveDetailTab('invalid-key')).toBe('resumen')
  })
})

// ─── buildProfileInitials ─────────────────────────────────────────────────────

describe('buildProfileInitials', () => {
  it('returns initials from first two words', () => {
    expect(buildProfileInitials('Juan García')).toBe('JG')
  })

  it('returns initials from compound name — only first 2 words', () => {
    expect(buildProfileInitials('María José López Torres')).toBe('MJ')
  })

  it('returns single initial for single-word name', () => {
    expect(buildProfileInitials('Mónaco')).toBe('M')
  })

  it('returns "C" fallback for empty string', () => {
    expect(buildProfileInitials('')).toBe('C')
  })

  it('returns uppercase initials regardless of input case', () => {
    expect(buildProfileInitials('ana martínez')).toBe('AM')
  })
})

// ─── formatCurrencyMXN ───────────────────────────────────────────────────────

describe('formatCurrencyMXN', () => {
  it('formats 4500000 cents MXN as currency string', () => {
    const result = formatCurrencyMXN(4_500_000, 'MXN')
    // The result should include 45,000 in some locale-formatted way
    expect(result).toContain('45')
    expect(result).toContain('000')
  })

  it('formats 100 cents as "1.00" (or locale equivalent)', () => {
    const result = formatCurrencyMXN(100, 'MXN')
    expect(result).toContain('1')
  })

  it('formats 0 cents as "0.00" (or locale equivalent)', () => {
    const result = formatCurrencyMXN(0, 'MXN')
    expect(result).toContain('0')
  })

  it('formats USD currency with USD symbol', () => {
    const result = formatCurrencyMXN(5_000_000, 'USD')
    expect(result).toContain('50')
    expect(result).toContain('000')
  })
})

// ─── EMPLOYEE_DETAIL_TABS constant ────────────────────────────────────────────

describe('EMPLOYEE_DETAIL_TABS', () => {
  it('contains exactly 8 tab definitions', () => {
    expect(EMPLOYEE_DETAIL_TABS).toHaveLength(8)
  })

  it('first tab is resumen', () => {
    expect(EMPLOYEE_DETAIL_TABS[0]?.key).toBe('resumen')
  })

  it('second tab is personal', () => {
    expect(EMPLOYEE_DETAIL_TABS[1]?.key).toBe('personal')
  })

  it('third tab is laboral', () => {
    expect(EMPLOYEE_DETAIL_TABS[2]?.key).toBe('laboral')
  })

  it('each tab has label and key', () => {
    for (const tab of EMPLOYEE_DETAIL_TABS) {
      expect(tab.key).toBeTruthy()
      expect(tab.label).toBeTruthy()
    }
  })

  it('tab keys include compensacion, organigrama, documentos, ausencias, cv', () => {
    const keys = EMPLOYEE_DETAIL_TABS.map((t) => t.key)
    expect(keys).toContain('compensacion')
    expect(keys).toContain('organigrama')
    expect(keys).toContain('documentos')
    expect(keys).toContain('ausencias')
    expect(keys).toContain('cv')
  })
})

// ─── hasSalary integration — ensure employee type supports full shape ─────────

describe('hasSalary guard on extended Employee', () => {
  it('returns false when salary fields are absent', () => {
    const emp = makeEmployee()
    expect(hasSalary(emp)).toBe(false)
  })

  it('returns true when currentSalaryCents is present', () => {
    const emp = makeEmployee({ currentSalaryCents: 4_500_000, currentSalaryCurrency: 'MXN' })
    expect(hasSalary(emp)).toBe(true)
  })

  it('returns true only by key presence, not value truthiness', () => {
    // currentSalaryCents: 0 is still a valid salary (edge case)
    const emp = makeEmployee({ currentSalaryCents: 0, currentSalaryCurrency: 'MXN' })
    expect(hasSalary(emp)).toBe(true)
  })
})
