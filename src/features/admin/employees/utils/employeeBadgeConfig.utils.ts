import {
  EMPLOYEE_STATUS_LABELS,
  type EmployeeStatus,
} from '../interfaces/employee.types'

/** Tones of the shared StatusBadge that an employee status can take. */
export type EmployeeStatusTone = 'success' | 'info' | 'neutral'

/**
 * employeeStatusConfig — single source of truth for the employee status badge.
 *
 * The `tone` feeds StatusBadge and the `label` is the user-facing text, already
 * localized in EMPLOYEE_STATUS_LABELS. Active is success and a leave in progress
 * is info; a termination is a closed state, not an error, so it stays neutral.
 *
 * Mirrors the productStatusConfig pattern: one typed const map, no switches
 * in the templates.
 */
export const employeeStatusConfig = {
  ACTIVE: { tone: 'success', label: EMPLOYEE_STATUS_LABELS.ACTIVE },
  ON_LEAVE: { tone: 'info', label: EMPLOYEE_STATUS_LABELS.ON_LEAVE },
  TERMINATED: { tone: 'neutral', label: EMPLOYEE_STATUS_LABELS.TERMINATED },
} as const satisfies Record<EmployeeStatus, { tone: EmployeeStatusTone; label: string }>

/**
 * Map EmployeeStatus → StatusBadge tone.
 *
 * Re-exported from the badge config so existing call sites (table columns,
 * tests) keep working without a code change. Pure function.
 */
export function employeeStatusToBadgeTone(status: EmployeeStatus): EmployeeStatusTone {
  return employeeStatusConfig[status].tone
}
