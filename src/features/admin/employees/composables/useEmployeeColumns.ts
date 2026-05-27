/**
 * useEmployeeColumns — WU-02 (warning fixes applied)
 *
 * Column definitions for the EmployeesListView table.
 *
 * Design fidelity note: The Claude Design table for the employee list does NOT
 * include a salary column — salary belongs in the Compensación detail tab (WU-06+).
 * The `hasSalary()` guard is preserved in employee.types for detail/card slices.
 *
 * Pure helpers (employeeStatusToBadgeTone, workModalityToBadgeTone,
 * formatHireDate, getManagerDisplay) are exported for unit testing without
 * component mounting.
 */

import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { AppBadgeTone } from '@/core/shared/utils/badge.utils'
import type { Employee, EmployeeStatus, WorkModality } from '../interfaces/employee.types'

// ─── Pure helpers (exported for unit testing) ─────────────────────────────────

const HIRE_DATE_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

/**
 * Map EmployeeStatus → AppBadgeTone.
 * Design spec: ACTIVE→success, ON_LEAVE→warning, TERMINATED→error
 */
export function employeeStatusToBadgeTone(status: EmployeeStatus): AppBadgeTone {
  switch (status) {
    case 'ACTIVE':
      return 'success'
    case 'ON_LEAVE':
      return 'warning'
    case 'TERMINATED':
      return 'error'
  }
}

/**
 * Map WorkModality → AppBadgeTone.
 * Design spec: ONSITE→neutral, REMOTE→info, HYBRID→pending
 */
export function workModalityToBadgeTone(modality: WorkModality): AppBadgeTone {
  switch (modality) {
    case 'ONSITE':
      return 'neutral'
    case 'REMOTE':
      return 'info'
    case 'HYBRID':
      return 'pending'
  }
}

/**
 * Format an ISO date string (hireDate) to localized display.
 * Pure function — no side effects.
 */
export function formatHireDate(isoDate: string): string {
  return HIRE_DATE_FORMATTER.format(new Date(isoDate))
}

/**
 * Resolve the manager display string for a given employee.
 *
 * Pure function — returns "—" in all WU-02 scenarios:
 * - managerId is null → "—"
 * - managerId is a UUID → "—" (manager name resolution deferred to WU-03+)
 *
 * Design rationale: the list API returns only `managerId`, not the manager's
 * fullName. Rendering a truncated UUID exposes implementation detail to end
 * users. The correct UX is "—" until WU-03 adds a name lookup / join.
 */
export function getManagerDisplay(employee: Employee): string {
  if (!employee.managerId) return '—'
  // WU-02: no name resolution available on the list endpoint.
  // Return "—" until WU-03 provides manager name lookup.
  return '—'
}

// ─── Column definitions ────────────────────────────────────────────────────────

export function useEmployeeColumns() {
  const authStore = useAuthStore()
  const canReadSalary = computed(() => authStore.userCan('read', 'EmployeeSalary'))

  const columns = computed<TableColumn<Employee>[]>(() => {
    const base: TableColumn<Employee>[] = [
      {
        id: 'colaborador',
        header: createSimpleHeader('Colaborador'),
        enableSorting: false,
      },
      {
        id: 'cargo',
        accessorKey: 'currentPosition',
        header: 'Cargo',
        enableSorting: false,
      },
      {
        id: 'departamento',
        accessorKey: 'currentDepartment',
        header: 'Departamento',
        enableSorting: false,
      },
      {
        id: 'jefedirecto',
        header: createSimpleHeader('Jefe directo'),
        enableSorting: false,
      },
      {
        id: 'fechaIngreso',
        accessorKey: 'hireDate',
        header: 'Fecha de ingreso',
        enableSorting: false,
      },
      {
        id: 'modalidad',
        accessorKey: 'workModality',
        header: 'Modalidad',
        enableSorting: false,
      },
      {
        id: 'estado',
        accessorKey: 'status',
        header: 'Estado',
        enableSorting: false,
      },
      {
        id: 'actions',
        header: createSimpleHeader(''),
        enableSorting: false,
        enableHiding: false,
        meta: { class: { td: 'text-right' } },
      },
    ]

    // NOTE: salary column is intentionally NOT in the list table.
    // The Claude Design for the employee list does not include salary —
    // salary belongs in the Compensación detail tab (WU-06+).
    // hasSalary() from employee.types is preserved for card/detail slices.
    // canReadSalary is kept in return for future detail-view consumers.

    return base
  })

  return { columns, canReadSalary }
}
