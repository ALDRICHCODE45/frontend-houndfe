/**
 * usePendingApprovalCard — WU-B (REQ-2, REQ-3, REQ-6)
 *
 * Pure card-data builder for the pending-approvals tray (`#cards` slot of
 * AppDataTable). Mirrors the existing inline card markup from the prior view
 * and lifts it into a single presentational contract so the view stays a
 * composition surface.
 *
 * Exports:
 *   - PendingApprovalCardData — flat data shape the card consumes
 *   - buildPendingApprovalCardData — PURE; assembles card data from a
 *     `TimeOffRequest` + the resolved `employeeMap`
 *
 * Design notes:
 *   - The card never sees a `TimeOffRequest` directly; everything it renders
 *     is pre-computed here (avatar class, initials, plural unit, formatted
 *     dates, SICK-guard flag, …). This keeps the component purely
 *     declarative and matches the EmployeeCard precedent (pure `buildCardData`).
 *   - The `request` is kept on the data object so the card can re-emit it
 *     verbatim on approve / reject (parent opens the dialog with the
 *     original request — no round-trip through stringified fields).
 *   - All formatting helpers are existing pure functions from `useAusencias`
 *     and `useEmployeeColumns` — no new business logic.
 */

import { TIME_OFF_TYPE } from '../constants/employee.constants'
import type { TimeOffType } from '../interfaces/employee.types'
import type { TimeOffRequest } from '../interfaces/employee.types'
import {
  formatTimeOffType,
  formatTimeOffStatus,
  computeTimeOffDays,
  resolveSickReason,
} from './useAusencias'
import { formatTimeOffDateRange } from './useEmployeeColumns'
import { AVATAR_PALETTE } from '@/app/constants/avatarPalette'
import type { ManagerInfo } from './useManagerResolution'

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Visual tone for the type badge — mirrors the inline `getTypeColor` map. */
export type PendingApprovalCardTypeColor =
  | 'primary'
  | 'warning'
  | 'error'
  | 'neutral'
  | 'success'

/**
 * Flat data shape the `PendingApprovalCard` component renders.
 *
 * The card template is purely declarative — every label, color, and visibility
 * flag is pre-computed here so the card never imports formatters or constants.
 * `request` is kept verbatim so the card can re-emit it on approve / reject.
 */
export interface PendingApprovalCardData {
  /** Original request — required so the card can emit it on approve / reject. */
  request: TimeOffRequest
  /** Resolved employee name, or `"—"` when the picker has not loaded. */
  employeeName: string
  /** Initials derived from the resolved employee name (max 2 letters). */
  employeeInitials: string
  /** Deterministic avatar background class (seeded by employeeId). */
  avatarClass: string
  /** Spanish label for the time-off type (e.g. "Vacaciones"). */
  typeLabel: string
  /** Visual tone for the type badge. */
  typeColor: PendingApprovalCardTypeColor
  /** Localized date-range label (e.g. "27 may 2026 – 1 jun 2026"). */
  dateRangeLabel: string
  /** Inclusive UTC day count. */
  days: number
  /** Pluralized day unit (e.g. "(3 días)" / "(1 día)"). */
  daysLabel: string
  /** Reason text — already SICK-guarded via `resolveSickReason`. */
  reasonLabel: string
  /** Whether to render the reason block at all (`false` when reasonLabel === "—"). */
  showReason: boolean
  /** Whether the reason is the SICK+null Tier 3 placeholder (italic muted). */
  isMedicalReserved: boolean
  /** Spanish label for the current status (e.g. "Pendiente"). */
  statusLabel: string
  /** Localized created-at label (es-MX, UTC, short date). */
  createdAtLabel: string
}

// ─── Pure helpers ──────────────────────────────────────────────────────────────

/** Map a TimeOffType enum value to the badge color used inline in the prior view. */
function resolveTypeColor(type: TimeOffType): PendingApprovalCardTypeColor {
  switch (type) {
    case TIME_OFF_TYPE.VACATION:
      return 'primary'
    case TIME_OFF_TYPE.SICK:
      return 'error'
    case TIME_OFF_TYPE.PERSONAL:
      return 'warning'
    case TIME_OFF_TYPE.UNPAID:
      return 'neutral'
    default:
      return 'neutral'
  }
}

/** Derive avatar initials (max 2) from the resolved employee name. */
function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '—'
  )
}

/** Deterministic avatar background class from a stable seed (employeeId). */
function deriveAvatarClass(seedValue: string): string {
  const seed = seedValue.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[seed % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0]!
}

/** Format the createdAt ISO string as a localized short date (es-MX, UTC). */
function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { timeZone: 'UTC' })
}

// ─── Builder ───────────────────────────────────────────────────────────────────

/**
 * buildPendingApprovalCardData — assemble the flat card data shape from a
 * single `TimeOffRequest` and the pre-resolved `employeeMap`.
 *
 * PURE — deterministic for a given `(request, employeeMap)` pair; no side
 * effects, no I/O. Every label, color, and visibility flag is computed here
 * so the card template stays declarative.
 *
 * @param request      — the time-off request to render
 * @param employeeMap  — `id → ManagerInfo` lookup produced by `buildManagerMap`
 */
export function buildPendingApprovalCardData(
  request: TimeOffRequest,
  employeeMap: Map<string, ManagerInfo>,
): PendingApprovalCardData {
  // Name resolution — REQ-4: "—" sentinel when the picker has not loaded
  // (mirrors the inline `getEmployeeName` / `getEmployeeInitials` helpers
  // from the prior view). S5 invariant: picker caps at 100 active employees;
  // a tenant with more may show "—" for some names.
  const employeeName = employeeMap.get(request.employeeId)?.fullName ?? '—'

  // Avatar seed is the employeeId (deterministic, stable across reloads).
  const initials = deriveInitials(employeeName)
  const avatarClass = deriveAvatarClass(request.employeeId)

  // Reason via the SICK guard — null + SICK → "Motivo médico reservado"
  // (REQ-3 S5 invariant). Empty / non-SICK null → "—" (block suppressed).
  const reasonLabel = resolveSickReason(request.type, request.reason)
  const showReason = reasonLabel !== '—'
  const isMedicalReserved =
    request.type === TIME_OFF_TYPE.SICK && request.reason === null

  const days = computeTimeOffDays(request.startDate, request.endDate)
  const daysLabel = `${days} ${days === 1 ? 'día' : 'días'}`

  return {
    request,
    employeeName,
    employeeInitials: initials,
    avatarClass,
    typeLabel: formatTimeOffType(request.type),
    typeColor: resolveTypeColor(request.type),
    dateRangeLabel: formatTimeOffDateRange(request.startDate, request.endDate),
    days,
    daysLabel,
    reasonLabel,
    showReason,
    isMedicalReserved,
    statusLabel: formatTimeOffStatus(request.status),
    createdAtLabel: formatCreatedAt(request.createdAt),
  }
}