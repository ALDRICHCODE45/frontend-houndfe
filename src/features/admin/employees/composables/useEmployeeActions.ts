/**
 * useEmployeeActions — WU-05B
 *
 * Pure status guards + action menu builder for employee row actions.
 *
 * Design decisions:
 * - Status guards (canTerminate, canReactivate) are pure functions exported for unit testing.
 * - getEmployeeRowActions is a pure function that returns the RowActionsMenu actions
 *   ({ key, label, icon?, destructive? }). It is intentionally NOT reactive — callers
 *   should call it inside a computed() or template expression and handle the selected key.
 * - CASL gate: actions are only returned when canUpdate === true (update:Employee permission).
 *
 * Rules enforced:
 * - Terminate is only available for ACTIVE or ON_LEAVE employees.
 * - Reactivate is only available for TERMINATED employees.
 * - Both require update:Employee CASL permission.
 */

import type { RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import { EMPLOYEE_STATUS } from '../constants/employee.constants'
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
  return status === EMPLOYEE_STATUS.ACTIVE || status === EMPLOYEE_STATUS.ON_LEAVE
}

/**
 * Returns true when the employee can be reactivated.
 * Only TERMINATED employees can be reactivated.
 * Backend returns EMPLOYEE_NOT_TERMINATED for other statuses.
 *
 * PURE — deterministic, no side effects.
 */
export function canReactivate(status: EmployeeStatus): boolean {
  return status === EMPLOYEE_STATUS.TERMINATED
}

// ─── Action menu builder (PURE) ──────────────────────────────────────────────

/** Keys emitted by the ⋮ menu (`RowActionsMenu` `select`). */
export type EmployeeRowActionKey = 'edit' | 'terminate' | 'reactivate'

/**
 * Build the row actions for a given employee, in menu order: the frequent
 * ones first, then the destructive one last. Items that open a confirmation
 * end in `…`.
 *
 * Returns an empty array when canUpdate is false (no update:Employee CASL permission),
 * so the row shows no ⋮ at all. Callers handle the selected `key` themselves.
 *
 * PURE — no side effects, deterministic output.
 */
export function getEmployeeRowActions(employee: Employee, canUpdate: boolean): RowAction[] {
  if (!canUpdate) return []

  const actions: RowAction[] = [{ key: 'edit', label: 'Editar', icon: 'i-lucide-pencil' }]

  if (canReactivate(employee.status)) {
    actions.push({ key: 'reactivate', label: 'Reactivar…', icon: 'i-lucide-user-check' })
  }

  if (canTerminate(employee.status)) {
    actions.push({
      key: 'terminate',
      label: 'Dar de baja…',
      icon: 'i-lucide-user-x',
      destructive: true,
    })
  }

  return actions
}
