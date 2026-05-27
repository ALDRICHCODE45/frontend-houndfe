/**
 * useEmployeeViewMode — WU-03
 *
 * Composable + pure helpers for the Tabla / Tarjetas view mode toggle.
 *
 * Design decision (from design.md):
 *   View toggle persists in localStorage via the `useTablePreferences` storage key pattern.
 *   The storage key is separate from column preferences so they don't conflict.
 *
 * Exports:
 * - VIEW_MODE_STORAGE_KEY  — stable key for localStorage
 * - getViewMode()          — reads persisted mode or returns 'table' default
 * - setViewMode(mode)      — writes to localStorage
 * - computeSeniority()     — pure; converts hireDate → "< 1 año" / "N año(s)" string
 * - buildCardData()        — pure; assembles EmployeeCardData from Employee (NO salary exposed)
 * - useEmployeeViewMode()  — reactive composable for Vue components
 */

import { ref, watch } from 'vue'
import type { Employee } from '../interfaces/employee.types'

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
 */
export const VIEW_MODE_STORAGE_KEY = 'employee-view-mode'

const VALID_MODES: EmployeeViewMode[] = ['table', 'card']

// ─── Pure helpers (exported for unit testing) ─────────────────────────────────

/**
 * Read the persisted view mode from localStorage.
 * Falls back to 'table' if not set or invalid.
 * Pure (depends only on localStorage state, no Vue reactivity).
 */
export function getViewMode(): EmployeeViewMode {
  if (typeof window === 'undefined') return 'table'
  try {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY)
    if (stored && (VALID_MODES as string[]).includes(stored)) {
      return stored as EmployeeViewMode
    }
  } catch {
    // Storage unavailable
  }
  return 'table'
}

/**
 * Persist the view mode to localStorage.
 * Pure (no Vue reactivity — composable wraps this for reactive use).
 */
export function setViewMode(mode: EmployeeViewMode): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
  } catch {
    // Storage unavailable
  }
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
 * Reads initial state from localStorage and persists changes back.
 * Used by EmployeesListView to drive the Tabla/Tarjetas toggle.
 */
export function useEmployeeViewMode() {
  const viewMode = ref<EmployeeViewMode>(getViewMode())

  // Persist changes to localStorage
  watch(viewMode, (mode) => {
    setViewMode(mode)
  })

  function toggleViewMode() {
    viewMode.value = viewMode.value === 'table' ? 'card' : 'table'
  }

  function setMode(mode: EmployeeViewMode) {
    viewMode.value = mode
  }

  return {
    viewMode,
    toggleViewMode,
    setMode,
  }
}
