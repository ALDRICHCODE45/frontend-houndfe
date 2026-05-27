/**
 * useEmployeeActions — WU-05B
 *
 * Pure status guards + action menu builder for employee row actions.
 *
 * Design decisions:
 * - Status guards (canTerminate, canReactivate) are pure functions exported for unit testing.
 * - getEmployeeRowActions is a pure function that returns a flat array of action items.
 *   It is intentionally NOT reactive — callers should call it inside a computed() or template expression.
 * - Action items follow the UDropdownMenu items shape: { label, color?, onSelect }.
 * - CASL gate: actions are only returned when canUpdate === true (update:Employee permission).
 * - onSelect callbacks are empty no-ops in this helper; callers inject real handlers via
 *   the composable useEmployeeRowActions() which closes over the correct open-dialog functions.
 *
 * Rules enforced:
 * - Terminate is only available for ACTIVE or ON_LEAVE employees.
 * - Reactivate is only available for TERMINATED employees.
 * - Both require update:Employee CASL permission.
 */

import type { Employee, EmployeeStatus } from '../interfaces/employee.types'

// ─── Status guards (PURE) ─────────────────────────────────────────────────────

/**
 * Returns true when the employee can be terminated.
 * ACTIVE and ON_LEAVE employees can be terminated.
 * TERMINATED employees cannot (backend returns EMPLOYEE_ALREADY_TERMINATED).
 *
 * PURE — deterministic, no side effects.
 */
export function canTerminate(status: EmployeeStatus): boolean {
  return status === 'ACTIVE' || status === 'ON_LEAVE'
}

/**
 * Returns true when the employee can be reactivated.
 * Only TERMINATED employees can be reactivated.
 * Backend returns EMPLOYEE_NOT_TERMINATED for other statuses.
 *
 * PURE — deterministic, no side effects.
 */
export function canReactivate(status: EmployeeStatus): boolean {
  return status === 'TERMINATED'
}

// ─── Action item shape ────────────────────────────────────────────────────────

export interface EmployeeRowAction {
  label: string
  color?: 'error'
  onSelect: () => void
}

// ─── Action menu builder (PURE) ──────────────────────────────────────────────

/**
 * Build the flat list of row action items for a given employee.
 *
 * Returns an empty array when canUpdate is false (no update:Employee CASL permission).
 * Callers should wrap in computed() to react to permission changes.
 *
 * onSelect callbacks are no-ops — callers compose real handlers using the
 * useEmployeeRowActions() composable which passes open-dialog functions.
 *
 * PURE — no side effects, deterministic output.
 */
export function getEmployeeRowActions(
  employee: Employee,
  canUpdate: boolean,
  handlers?: {
    onEdit?: () => void
    onTerminate?: () => void
    onReactivate?: () => void
  },
): EmployeeRowAction[] {
  if (!canUpdate) return []

  const actions: EmployeeRowAction[] = []

  actions.push({
    label: 'Editar',
    onSelect: handlers?.onEdit ?? (() => undefined),
  })

  if (canTerminate(employee.status)) {
    actions.push({
      label: 'Dar de baja',
      color: 'error',
      onSelect: handlers?.onTerminate ?? (() => undefined),
    })
  }

  if (canReactivate(employee.status)) {
    actions.push({
      label: 'Reactivar',
      onSelect: handlers?.onReactivate ?? (() => undefined),
    })
  }

  return actions
}
