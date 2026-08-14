/**
 * useEmployeeViewMode — WU-03 / WU-A (REQ-6)
 *
 * Composable + pure helpers for the Tabla / Tarjetas view mode toggle.
 *
 * Design decision (from design.md):
 *   View toggle persists in localStorage via the `useTablePreferences` storage key pattern.
 *   The storage key is separate from column preferences so they don't conflict.
 *
 * Exports:
 * - VIEW_MODE_STORAGE_KEY          — legacy stable key for localStorage (preserved)
 * - EMPLOYEE_VIEW_MODE_STORAGE_KEY — canonical stable key for localStorage (alias)
 * - EmployeeViewMode               — 'table' | 'card' union
 * - isEmployeeViewMode             — type guard for EmployeeViewMode
 * - getViewMode()                  — reads persisted mode (delegates to shared readViewMode)
 * - setViewMode(mode)              — writes persisted mode (delegates to shared writeViewMode)
 * - computeSeniority()             — pure; converts hireDate → "< 1 año" / "N año(s)" string
 * - buildCardData()                — pure; assembles EmployeeCardData from Employee (NO salary exposed)
 * - useEmployeeViewMode()          — reactive composable (delegates to shared useViewMode)
 *                                    Returns: { viewMode, setMode, toggleViewMode, displayMode }
 *                                    `displayMode` bridges 'card' → 'cards' for AppDataTable.
 */

import { computed } from 'vue'
import type { Employee } from '../interfaces/employee.types'
import { useViewMode, readViewMode, writeViewMode } from '@/core/shared/composables/useViewMode'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type EmployeeViewMode = 'table' | 'card'

/**
 * Card data shape — intentionally excludes salary fields.
 *
 * Salary belongs in the Compensación detail tab (WU-06+).
 * This type makes the "no salary" contract explicit at the type level.
 */
export interface EmployeeCardData {
  id: string
  employeeNumber: string
  fullName: string
  email: string | null
  status: Employee['status']
  contractType: Employee['contractType']
  workModality: Employee['workModality']
  currentPosition: string
  currentDepartment: string
  managerId: string | null
  managerDisplay: string
  hireDate: string
  terminationDate: string | null
  photoFileId: string | null
  // NOTE: currentSalaryCents and currentSalaryCurrency are intentionally OMITTED.
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * localStorage key for view mode preference.
 * Distinct from table-preferences-* keys to avoid conflicts.
 * Alias kept as `VIEW_MODE_STORAGE_KEY` for the WU-03 tests that imported it.
 */
export const VIEW_MODE_STORAGE_KEY = 'employee-view-mode'

/**
 * Canonical localStorage key for view mode preference (used by WU-A tests).
 * Same value as VIEW_MODE_STORAGE_KEY — exported under a stable alias so
 * downstream consumers can rename without breaking older test imports.
 */
export const EMPLOYEE_VIEW_MODE_STORAGE_KEY = VIEW_MODE_STORAGE_KEY

const VALID_MODES = ['table', 'card'] as const

/**
 * Type guard so callers can validate untyped input instead of casting blindly.
 * Accepts ONLY the internal 'table' | 'card' union — NOT 'cards' (AppDataTable shape).
 */
export function isEmployeeViewMode(value: string): value is EmployeeViewMode {
  return (VALID_MODES as readonly string[]).includes(value)
}

// ─── Pure helpers (exported for unit testing) ─────────────────────────────────

/**
 * Read the persisted view mode from localStorage.
 * Falls back to 'table' if not set or invalid.
 * Delegates to the shared readViewMode helper (single source of truth).
 */
export function getViewMode(): EmployeeViewMode {
  return readViewMode(VIEW_MODE_STORAGE_KEY, VALID_MODES, 'table')
}

/**
 * Persist the view mode to localStorage.
 * Delegates to the shared writeViewMode helper (single source of truth).
 */
export function setViewMode(mode: EmployeeViewMode): void {
  writeViewMode(VIEW_MODE_STORAGE_KEY, mode)
}

/**
 * Compute a human-readable seniority string from a hireDate ISO string.
 *
 * Pure function — accepts an optional reference date for deterministic testing.
 *
 * Examples:
 *   computeSeniority('2026-03-01') → '< 1 año'  (if called from May 2026)
 *   computeSeniority('2025-05-27') → '1 año'    (if called from May 27 2026)
 *   computeSeniority('2024-01-01') → '2 años'   (if called from May 2026)
 */
export function computeSeniority(hireDate: string, referenceDate: Date = new Date()): string {
  const start = new Date(hireDate)
  const refYear = referenceDate.getFullYear()
  const refMonth = referenceDate.getMonth()
  const refDay = referenceDate.getDate()

  const startYear = start.getFullYear()
  const startMonth = start.getMonth()
  const startDay = start.getDate()

  // Calculate full years elapsed
  let years = refYear - startYear

  // Subtract 1 if the anniversary hasn't happened yet this year
  if (refMonth < startMonth || (refMonth === startMonth && refDay < startDay)) {
    years -= 1
  }

  if (years < 1) return '< 1 año'
  if (years === 1) return '1 año'
  return `${years} años`
}

/**
 * Assemble EmployeeCardData from an Employee object and a resolved manager name.
 *
 * SECURITY: This function intentionally never copies salary fields (currentSalaryCents,
 * currentSalaryCurrency) into the card data output. Salary belongs in the Compensación
 * detail tab only. The type-level omission makes this contract enforceable by TypeScript.
 *
 * @param employee — full Employee object from the list API
 * @param managerDisplay — resolved manager name (or "—" if unavailable)
 */
export function buildCardData(employee: Employee, managerDisplay: string): EmployeeCardData {
  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    fullName: employee.fullName,
    email: employee.email,
    status: employee.status,
    contractType: employee.contractType,
    workModality: employee.workModality,
    currentPosition: employee.currentPosition ?? '—',
    currentDepartment: employee.currentDepartment ?? '—',
    managerId: employee.managerId,
    managerDisplay,
    hireDate: employee.hireDate,
    terminationDate: employee.terminationDate,
    photoFileId: employee.photoFileId,
    // currentSalaryCents and currentSalaryCurrency: intentionally omitted
  }
}

// ─── Reactive composable ──────────────────────────────────────────────────────

/**
 * useEmployeeViewMode — reactive wrapper for view mode state.
 *
 * Thin wrapper around the generic useViewMode composable that binds
 * VIEW_MODE_STORAGE_KEY and the employee-specific mode union type.
 *
 * Returns:
 *  - viewMode         — reactive ref<'table' | 'card'>
 *  - setMode          — write mode + persist
 *  - toggleViewMode   — cycle table ↔ card
 *  - displayMode      — bridge to AppDataTable ('table' | 'cards'); maps 'card' → 'cards'
 *
 * Pure helper functions (getViewMode, setViewMode, computeSeniority, buildCardData)
 * remain in this file so existing tests and callers keep working without changes.
 */
export function useEmployeeViewMode() {
  const { viewMode, setMode, toggleMode } = useViewMode(
    VIEW_MODE_STORAGE_KEY,
    ['table', 'card'] as const,
    'table',
  )

  /**
   * Bridge to AppDataTable's `displayMode` prop. AppDataTable expects
   * `'table' | 'cards' | 'auto'` — we map our internal singular `card`
   * to the plural `cards` form the table uses.
   */
  const displayMode = computed<'table' | 'cards'>(() =>
    viewMode.value === 'card' ? 'cards' : 'table',
  )

  return {
    viewMode,
    toggleViewMode: toggleMode,
    setMode,
    displayMode,
  }
}
