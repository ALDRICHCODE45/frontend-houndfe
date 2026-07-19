/**
 * `employee.constants.ts` — value-preserving logic constants for the
 * admin/employees module.
 *
 * Convention (slice 1 of `sdd/magic-string-constants`):
 *   - Per-module `features/<module>/constants/<name>.constants.ts`.
 *   - Each constant is derived from the existing Zod schema's `.enum`
 *     accessor so the schema remains the SINGLE SOURCE OF TRUTH — any
 *     change to the schema is reflected automatically and the value-pin
 *     tests catch a name drift.
 *   - `EMPLOYEE_STATUS_FILTER` is a plain `as const` object because it is
 *     a lowercase API query-param value (NOT a backend enum). It is
 *     co-located here — NOT in a shared global — to keep the
 *     UPPERCASE/LOWERCASE distinction visible at the call sites that
 *     mix the two.
 *   - Per-module constants, NEVER a global one — protects against
 *     cross-module homonym bugs (e.g. time-off `'CANCELLED'` vs sales
 *     `'CANCELED'`).
 *
 * Naming split (readability): the runtime value objects are
 * SCREAMING_SNAKE_CASE (e.g. `TIME_OFF_STATUS`) so they coexist WITHOUT an
 * import alias with the matching PascalCase TYPE in
 * `interfaces/employee.types.ts` (e.g. `TimeOffStatus`) — that type is the
 * ONE canonical type per group. Groups with no type there
 * (`REVIEW_DECISION`, `EMPLOYEE_STATUS_FILTER`) export a single `*Value`
 * union type below.
 *
 * This file is value-preserving: every literal is RELOCATED from the
 * previous inline spot — NEVER renamed. The pin tests in
 * `__tests__/employee.constants.spec.ts` lock each value against
 * accidental drift.
 */

import {
  TimeOffStatusSchema,
  TimeOffTypeSchema,
  EmployeeStatusSchema,
  WorkModalitySchema,
  EmployeeDocumentCategorySchema,
  ReviewTimeOffDtoSchema,
} from '../interfaces/employee.types'

// ─── TIME_OFF_STATUS (UPPERCASE, backend v1) ──────────────────────────────────
// GUARDRAIL: 'CANCELLED' has TWO L's. sales uses 'CANCELED' (one L) in
// a separate module. Keeping this PER-MODULE prevents the homonym bug.
// Type: `TimeOffStatus` from `interfaces/employee.types`.

export const TIME_OFF_STATUS = TimeOffStatusSchema.enum

// ─── TIME_OFF_TYPE (UPPERCASE, backend v1) ────────────────────────────────────
// IMPORTANT: 'UNPAID' (not 'MATERNITY' — V2 only). See employee.types.ts.
// Type: `TimeOffType` from `interfaces/employee.types`.

export const TIME_OFF_TYPE = TimeOffTypeSchema.enum

// ─── EMPLOYEE_STATUS (UPPERCASE, backend v1) ──────────────────────────────────
// Type: `EmployeeStatus` from `interfaces/employee.types`.

export const EMPLOYEE_STATUS = EmployeeStatusSchema.enum

// ─── WORK_MODALITY (UPPERCASE, backend v1) ────────────────────────────────────
// IMPORTANT: 'ONSITE' (not 'ON_SITE'). See employee.types.ts.
// Type: `WorkModality` from `interfaces/employee.types`.

export const WORK_MODALITY = WorkModalitySchema.enum

// ─── EMPLOYEE_DOCUMENT_CATEGORY (UPPERCASE, 9 categories, backend v1) ──────────
// Type: `EmployeeDocumentCategory` from `interfaces/employee.types`.

export const EMPLOYEE_DOCUMENT_CATEGORY = EmployeeDocumentCategorySchema.enum

// ─── REVIEW_DECISION (UPPERCASE, ReviewTimeOffDto body — only 2 values) ────────
// Derived from the inline `z.enum(['APPROVED', 'REJECTED'])` inside
// ReviewTimeOffDtoSchema. The `.shape.decision.enum` accessor gives us
// the same { APPROVED, REJECTED } value object without duplicating the
// string list. No type exists in employee.types.ts → keep a `*Value` union.

export const REVIEW_DECISION = ReviewTimeOffDtoSchema.shape.decision.enum
export type ReviewDecisionValue = (typeof REVIEW_DECISION)[keyof typeof REVIEW_DECISION]

// ─── EMPLOYEE_STATUS_FILTER (LOWERCASE — API query param) ─────────────────────
// Distinct casing from EMPLOYEE_STATUS (UPPERCASE). 'all' is the third
// value the backend list endpoint accepts (no status filter applied).
// The PIN tests in the spec file assert this casing is lowercase —
// a drift here would break the backend contract silently.

export const EMPLOYEE_STATUS_FILTER = {
  ACTIVE: 'active',
  TERMINATED: 'terminated',
  ALL: 'all',
} as const

export type EmployeeStatusFilterValue =
  (typeof EMPLOYEE_STATUS_FILTER)[keyof typeof EMPLOYEE_STATUS_FILTER]
