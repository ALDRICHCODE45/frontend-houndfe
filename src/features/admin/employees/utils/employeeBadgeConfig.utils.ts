import type { AppBadgeTone } from '@/core/shared/utils/badge.utils'
import {
  EMPLOYEE_STATUS_LABELS,
  type EmployeeStatus,
} from '../interfaces/employee.types'

// ─── Department dot color SUPERSET ────────────────────────────────────────────

/**
 * Department keyword → dot color map.
 *
 * The order matters: `includes()` is matched in declaration order and the
 * first match wins, so the more specific keys (e.g. "recursos" for
 * "Recursos Humanos") sit above broader fallbacks. The trailing "tienda" key
 * is the only one that uses the same color as the global fallback (emerald)
 * — kept explicit so the 9-key set reads cleanly in code review.
 *
 * `ingen` and `tecnolog` both map to indigo-500 because "Ingeniería" and
 * "Tecnología" (and "Tecnológico") are domain synonyms in v1.
 */
const DEPARTMENT_DOT_BY_KEYWORD: ReadonlyArray<readonly [string, string]> = [
  ['producto', 'bg-violet-500'],
  ['diseño', 'bg-pink-500'],
  ['finanzas', 'bg-blue-500'],
  ['recursos', 'bg-cyan-500'],
  ['operaciones', 'bg-amber-500'],
  ['legal', 'bg-slate-500'],
  ['almac', 'bg-orange-500'],
  ['ingen', 'bg-indigo-500'],
  ['tecnolog', 'bg-indigo-500'],
  ['tienda', 'bg-emerald-500'],
]

const DEPARTMENT_DOT_FALLBACK = 'bg-emerald-500'

/**
 * Resolve the colored-dot class for a department name.
 *
 * Matching is case-insensitive `includes()` against the ordered keyword list
 * above. The first match wins; if no keyword matches (or the input is
 * null/undefined/empty) the emerald fallback is returned.
 *
 * Pure function — no side effects. Shared by the list view, the card view and
 * the profile card so the department palette never drifts between surfaces.
 */
export function getDepartmentDotClass(department: string | null | undefined): string {
  const value = department?.toLowerCase() ?? ''
  if (!value) return DEPARTMENT_DOT_FALLBACK
  for (const [keyword, dotClass] of DEPARTMENT_DOT_BY_KEYWORD) {
    if (value.includes(keyword)) return dotClass
  }
  return DEPARTMENT_DOT_FALLBACK
}

// ─── Employee status badge config ────────────────────────────────────────────

/**
 * employeeStatusConfig — single source of truth for the employee status badge.
 *
 * The `tone` is consumed by StatusDotBadge (which maps tone -> dot + shell
 * classes with dark mode). The `label` is the user-facing text, already
 * localized in EMPLOYEE_STATUS_LABELS.
 *
 * Mirrors the productStatusConfig pattern: one typed const map, no switches
 * in the templates.
 */
export const employeeStatusConfig = {
  ACTIVE: { tone: 'success', label: EMPLOYEE_STATUS_LABELS.ACTIVE },
  ON_LEAVE: { tone: 'warning', label: EMPLOYEE_STATUS_LABELS.ON_LEAVE },
  TERMINATED: { tone: 'error', label: EMPLOYEE_STATUS_LABELS.TERMINATED },
} as const satisfies Record<EmployeeStatus, { tone: AppBadgeTone; label: string }>

/**
 * Map EmployeeStatus → AppBadgeTone.
 *
 * Re-exported from the badge config so existing call sites (table columns,
 * tests) keep working without a code change. Pure function.
 */
export function employeeStatusToBadgeTone(status: EmployeeStatus): AppBadgeTone {
  return employeeStatusConfig[status].tone
}
