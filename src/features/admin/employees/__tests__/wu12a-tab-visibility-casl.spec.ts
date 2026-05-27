/**
 * WU-12A — CASL-gated tab visibility in Employee Detail
 *
 * Strict TDD — RED phase: tests written BEFORE production code.
 *
 * Coverage:
 * - `filterVisibleTabs(tabs, can)` — pure function that accepts the full
 *   EMPLOYEE_DETAIL_TABS array and a `can(action, subject)` predicate,
 *   and returns only the tabs the current user is allowed to see.
 * - Tab permission config: compensacion requires read:EmployeeSalary,
 *   documentos requires read:EmployeeDocument, ausencias requires
 *   read:EmployeeTimeOff. Others are always visible.
 * - `resolveActiveTabWithFallback(activeTab, visibleTabs)` — pure helper
 *   that falls back to 'resumen' when the current activeTab is not in
 *   visibleTabs (handles the "URL points to a hidden tab" scenario).
 *
 * Test layer: Unit — ZERO mocks needed (pure functions).
 *
 * Scenarios (per WU-12A spec):
 *   - All permissions → 8 tabs visible
 *   - No salary → 7 tabs (compensacion hidden)
 *   - No docs → 7 tabs (documentos hidden)
 *   - No timeoff → 7 tabs (ausencias hidden)
 *   - No salary + no docs → 6 tabs
 *   - No salary + no docs + no timeoff → 5 tabs
 *   - Active tab is hidden → falls back to 'resumen'
 *   - Active tab is visible → unchanged
 */

import { describe, it, expect } from 'vitest'

// ── RED: These imports reference production exports that do NOT exist yet ──────
import {
  filterVisibleTabs,
  resolveActiveTabWithFallback,
  EMPLOYEE_DETAIL_TABS,
  type EmployeeDetailTab,
  type EmployeeDetailTabKey,
} from '@/features/admin/employees/composables/useEmployeeDetail'

// ─── Helpers ──────────────────────────────────────────name────────────────────

/** Build a `can()` predicate from an explicit allowlist of subjects */
function makeCan(
  allowed: string[],
): (action: string, subject: string) => boolean {
  return (_action, subject) => allowed.includes(subject)
}

/** All-access predicate */
const canAll = makeCan([
  'Employee',
  'EmployeeSalary',
  'EmployeeDocument',
  'EmployeeTimeOff',
])

/** No salary */
const canNoSalary = makeCan(['Employee', 'EmployeeDocument', 'EmployeeTimeOff'])

/** No docs */
const canNoDocs = makeCan(['Employee', 'EmployeeSalary', 'EmployeeTimeOff'])

/** No timeoff */
const canNoTimeOff = makeCan(['Employee', 'EmployeeSalary', 'EmployeeDocument'])

/** No salary + no docs */
const canNoSalaryNoDocs = makeCan(['Employee', 'EmployeeTimeOff'])

/** No salary + no docs + no timeoff */
const canNoSalaryNoDocsNoTimeOff = makeCan(['Employee'])

// ─── filterVisibleTabs ────────────────────────────────────────────────────────

describe('filterVisibleTabs — CASL permission filtering', () => {
  it('returns all 8 tabs when user has all permissions', () => {
    const visible = filterVisibleTabs(EMPLOYEE_DETAIL_TABS, canAll)
    expect(visible).toHaveLength(8)
  })

  it('includes compensacion when user can read EmployeeSalary', () => {
    const visible = filterVisibleTabs(EMPLOYEE_DETAIL_TABS, canAll)
    const keys = visible.map((t) => t.key)
    expect(keys).toContain('compensacion')
  })

  it('hides compensacion when user cannot read EmployeeSalary', () => {
    const visible = filterVisibleTabs(EMPLOYEE_DETAIL_TABS, canNoSalary)
    const keys = visible.map((t) => t.key)
    expect(keys).not.toContain('compensacion')
    expect(visible).toHaveLength(7)
  })

  it('hides documentos when user cannot read EmployeeDocument', () => {
    const visible = filterVisibleTabs(EMPLOYEE_DETAIL_TABS, canNoDocs)
    const keys = visible.map((t) => t.key)
    expect(keys).not.toContain('documentos')
    expect(visible).toHaveLength(7)
  })

  it('hides ausencias when user cannot read EmployeeTimeOff', () => {
    const visible = filterVisibleTabs(EMPLOYEE_DETAIL_TABS, canNoTimeOff)
    const keys = visible.map((t) => t.key)
    expect(keys).not.toContain('ausencias')
    expect(visible).toHaveLength(7)
  })

  it('hides compensacion and documentos when user has neither salary nor docs', () => {
    const visible = filterVisibleTabs(EMPLOYEE_DETAIL_TABS, canNoSalaryNoDocs)
    const keys = visible.map((t) => t.key)
    expect(keys).not.toContain('compensacion')
    expect(keys).not.toContain('documentos')
    expect(visible).toHaveLength(6)
  })

  it('hides compensacion, documentos, and ausencias when user has none of the three', () => {
    const visible = filterVisibleTabs(
      EMPLOYEE_DETAIL_TABS,
      canNoSalaryNoDocsNoTimeOff,
    )
    const keys = visible.map((t) => t.key)
    expect(keys).not.toContain('compensacion')
    expect(keys).not.toContain('documentos')
    expect(keys).not.toContain('ausencias')
    expect(visible).toHaveLength(5)
  })

  it('always includes resumen, personal, laboral, organigrama, cv regardless of permissions', () => {
    const visible = filterVisibleTabs(
      EMPLOYEE_DETAIL_TABS,
      canNoSalaryNoDocsNoTimeOff,
    )
    const keys = visible.map((t) => t.key)
    expect(keys).toContain('resumen')
    expect(keys).toContain('personal')
    expect(keys).toContain('laboral')
    expect(keys).toContain('organigrama')
    expect(keys).toContain('cv')
  })

  it('preserves original tab order when filtering', () => {
    const visible = filterVisibleTabs(EMPLOYEE_DETAIL_TABS, canNoSalaryNoDocs)
    // order: resumen, personal, laboral, organigrama, ausencias, cv
    expect(visible[0]?.key).toBe('resumen')
    expect(visible[1]?.key).toBe('personal')
    expect(visible[2]?.key).toBe('laboral')
  })

  it('returns the same array content when called with identical args (deterministic)', () => {
    const visible1 = filterVisibleTabs(EMPLOYEE_DETAIL_TABS, canNoSalary)
    const visible2 = filterVisibleTabs(EMPLOYEE_DETAIL_TABS, canNoSalary)
    expect(visible1.map((t) => t.key)).toEqual(visible2.map((t) => t.key))
  })
})

// ─── resolveActiveTabWithFallback ─────────────────────────────────────────────

describe('resolveActiveTabWithFallback — hidden tab fallback to resumen', () => {
  const allTabs = EMPLOYEE_DETAIL_TABS

  it('returns resumen when activeTab is in a now-hidden set (compensacion hidden)', () => {
    const visibleTabs = filterVisibleTabs(EMPLOYEE_DETAIL_TABS, canNoSalary)
    const result = resolveActiveTabWithFallback('compensacion', visibleTabs)
    expect(result).toBe('resumen')
  })

  it('returns the same tab when activeTab is visible', () => {
    const visibleTabs = filterVisibleTabs(EMPLOYEE_DETAIL_TABS, canNoSalary)
    const result = resolveActiveTabWithFallback('laboral', visibleTabs)
    expect(result).toBe('laboral')
  })

  it('returns resumen when activeTab is documentos and docs are hidden', () => {
    const visibleTabs = filterVisibleTabs(EMPLOYEE_DETAIL_TABS, canNoDocs)
    const result = resolveActiveTabWithFallback('documentos', visibleTabs)
    expect(result).toBe('resumen')
  })

  it('returns resumen when activeTab is ausencias and timeoff is hidden', () => {
    const visibleTabs = filterVisibleTabs(EMPLOYEE_DETAIL_TABS, canNoTimeOff)
    const result = resolveActiveTabWithFallback('ausencias', visibleTabs)
    expect(result).toBe('resumen')
  })

  it('returns resumen when activeTab is resumen (always in visible)', () => {
    const visibleTabs = filterVisibleTabs(
      EMPLOYEE_DETAIL_TABS,
      canNoSalaryNoDocsNoTimeOff,
    )
    const result = resolveActiveTabWithFallback('resumen', visibleTabs)
    expect(result).toBe('resumen')
  })

  it('returns the activeTab unchanged when all permissions are granted and tab is valid', () => {
    const visibleTabs = filterVisibleTabs(EMPLOYEE_DETAIL_TABS, canAll)
    const result = resolveActiveTabWithFallback('compensacion', visibleTabs)
    expect(result).toBe('compensacion')
  })
})

// ─── EmployeeDetailTab shape — permission field ───────────────────────────────

describe('EMPLOYEE_DETAIL_TABS — permission field on gated tabs', () => {
  it('compensacion tab has a permission field', () => {
    const tab = EMPLOYEE_DETAIL_TABS.find((t) => t.key === 'compensacion')
    expect(tab).toBeDefined()
    expect(tab?.permission).toBeDefined()
  })

  it('documentos tab has a permission field', () => {
    const tab = EMPLOYEE_DETAIL_TABS.find((t) => t.key === 'documentos')
    expect(tab).toBeDefined()
    expect(tab?.permission).toBeDefined()
  })

  it('ausencias tab has a permission field', () => {
    const tab = EMPLOYEE_DETAIL_TABS.find((t) => t.key === 'ausencias')
    expect(tab).toBeDefined()
    expect(tab?.permission).toBeDefined()
  })

  it('resumen tab has NO permission field (always visible)', () => {
    const tab = EMPLOYEE_DETAIL_TABS.find((t) => t.key === 'resumen')
    expect(tab).toBeDefined()
    expect(tab?.permission).toBeUndefined()
  })

  it('personal tab has NO permission field (always visible)', () => {
    const tab = EMPLOYEE_DETAIL_TABS.find((t) => t.key === 'personal')
    expect(tab).toBeDefined()
    expect(tab?.permission).toBeUndefined()
  })

  it('compensacion permission is ["read", "EmployeeSalary"]', () => {
    const tab = EMPLOYEE_DETAIL_TABS.find((t) => t.key === 'compensacion')
    expect(tab?.permission).toEqual(['read', 'EmployeeSalary'])
  })

  it('documentos permission is ["read", "EmployeeDocument"]', () => {
    const tab = EMPLOYEE_DETAIL_TABS.find((t) => t.key === 'documentos')
    expect(tab?.permission).toEqual(['read', 'EmployeeDocument'])
  })

  it('ausencias permission is ["read", "EmployeeTimeOff"]', () => {
    const tab = EMPLOYEE_DETAIL_TABS.find((t) => t.key === 'ausencias')
    expect(tab?.permission).toEqual(['read', 'EmployeeTimeOff'])
  })
})
