/**
 * useEmployeeColumns — WU-02 (warning fixes applied)
 *
 * Column definitions for the EmployeesListView table: the person first, then
 * the status, then the fields that describe the job, then the ⋮ column.
 *
 * Salary is intentionally NOT in the list — it belongs in the Compensación
 * detail tab (WU-06+). The `hasSalary()` guard is preserved in employee.types.
 *
 * Pure helpers (employeeStatusToBadgeTone, formatHireDate, computeSeniority)
 * are exported for unit testing without component mounting.
 */

import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { Employee } from '../interfaces/employee.types'
import { employeeStatusToBadgeTone } from '../utils/employeeBadgeConfig.utils'

// Re-export so existing call sites (table columns, tests) keep working.
// The actual definition lives in employeeBadgeConfig.utils so the status tone
// map and the badge config stay in one place.
export { employeeStatusToBadgeTone }

// ─── Pure helpers (exported for unit testing) ─────────────────────────────────

const HIRE_DATE_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

/**
 * Format an ISO date string (hireDate) to localized display.
 * Pure function — no side effects.
 */
export function formatHireDate(isoDate: string): string {
  return HIRE_DATE_FORMATTER.format(new Date(isoDate))
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

  // Full years elapsed, minus one when the anniversary hasn't happened yet this year.
  let years = referenceDate.getFullYear() - start.getFullYear()
  if (
    referenceDate.getMonth() < start.getMonth() ||
    (referenceDate.getMonth() === start.getMonth() && referenceDate.getDate() < start.getDate())
  ) {
    years -= 1
  }

  if (years < 1) return '< 1 año'
  if (years === 1) return '1 año'
  return `${years} años`
}

/**
 * Format a single ISO date or YYYY-MM-DD string as a short localized date
 * (e.g. "27 may 2026").
 *
 * Backend returns time-off dates either as full ISO strings (with time and Z
 * suffix) or as date-only `YYYY-MM-DD`. Both produce a valid Date when handed
 * to `new Date(...)`. Using UTC timezone avoids the day-shift that happens
 * when the local timezone is west of UTC.
 *
 * Pure function — no side effects.
 */
const TIME_OFF_DATE_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatTimeOffDate(isoDate: string): string {
  if (!isoDate) return '—'
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return isoDate
  return TIME_OFF_DATE_FORMATTER.format(d)
}

/**
 * Format a start/end date pair as a human-readable range.
 * Example: "27 may 2026 – 1 jun 2026".
 *
 * Pure function — no side effects.
 */
export function formatTimeOffDateRange(startIso: string, endIso: string): string {
  return `${formatTimeOffDate(startIso)} – ${formatTimeOffDate(endIso)}`
}

// ─── Column definitions ────────────────────────────────────────────────────────

export function useEmployeeColumns() {
  const authStore = useAuthStore()
  const canReadSalary = computed(() => authStore.userCan('read', 'EmployeeSalary'))

  // Hideable data columns keep their ids: the user's column visibility is persisted per id.
  const columns = computed<TableColumn<Employee>[]>(() => [
    {
      id: 'colaborador',
      header: createSimpleHeader('Colaborador'),
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: 'estado',
      accessorKey: 'status',
      header: 'Estado',
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: 'cargo',
      accessorKey: 'currentPosition',
      header: 'Cargo',
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: 'departamento',
      accessorKey: 'currentDepartment',
      header: 'Departamento',
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: 'jefedirecto',
      header: createSimpleHeader('Jefe directo'),
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: 'modalidad',
      accessorKey: 'workModality',
      header: 'Modalidad',
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: 'fechaIngreso',
      accessorKey: 'hireDate',
      header: 'Fecha de ingreso',
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: 'actions',
      header: 'Acciones',
      enableSorting: false,
      enableHiding: false,
      meta: { class: { th: 'w-16', td: 'w-16 text-right' } },
    },
  ])

  return { columns, canReadSalary }
}
