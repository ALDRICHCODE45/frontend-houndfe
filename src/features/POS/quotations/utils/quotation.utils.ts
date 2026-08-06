/**
 * Quotation utility helpers — pure functions only, no Vue imports.
 *
 * Keep this module dependency-free so it stays trivially unit-testable and
 * importable from any layer (composables, views, badge components).
 */

import type { QuotationResponseDto, QuotationStatus } from '../interfaces/quotation.types'
import {
  QUOTATION_STATUS_LABEL,
  QUOTATION_STATUS_TONE,
  type QuotationStatusTone,
} from '../constants/quotation.constants'

/**
 * Lazy expiry check (client-side mirror of the backend's lazy SENT→EXPIRED
 * transition — see backend §7.4). Returns true when `expiresAt` is set and
 * strictly before now.
 *
 * The strict-less-than means an exact-now `expiresAt` is NOT expired; only
 * past timestamps flip the boolean. This avoids a one-millisecond UI flicker
 * on the expiry boundary.
 */
export function isExpired(quotation: Pick<QuotationResponseDto, 'expiresAt'>): boolean {
  if (!quotation.expiresAt) return false
  return new Date(quotation.expiresAt).getTime() < Date.now()
}

/** Map a status to its `AppBadge` tone. */
export function statusToTone(status: QuotationStatus): QuotationStatusTone {
  return QUOTATION_STATUS_TONE[status]
}

/** Map a status to its localized Spanish label. */
export function statusToLabel(status: QuotationStatus): string {
  return QUOTATION_STATUS_LABEL[status]
}

/** Editable-state predicate. Only DRAFT permits mutations. */
export function isDraft(status: QuotationStatus): boolean {
  return status === 'DRAFT'
}

/**
 * Cancellable predicate. Only DRAFT can be cancelled — SENT/EXPIRED/CANCELLED
 * are terminal (the backend enforces this with `409 Quotation is not DRAFT`,
 * the UI gate keeps the button hidden).
 */
export function isCancellable(status: QuotationStatus): boolean {
  return status === 'DRAFT'
}

/**
 * T-UI-08 — REQ-UI-003 status→step index mapping for the 3-state progress
 * stepper (BORRADOR → ENVIADA → EXPIRADA/CANCELADA).
 *
 * Kept in this module on purpose: it's a pure data lookup with no Vue
 * dependency, so it's directly unit-testable and reusable from any layer.
 * The component (`QuotationProgressStepper.vue`) consumes the index to
 * decide which node is "active" vs "completed" vs "future".
 *
 * Returns:
 *   - 0 → DRAFT (BORRADOR active)
 *   - 1 → SENT  (ENVIADA active)
 *   - 2 → EXPIRED | CANCELLED (final step active)
 *   - -1 → unknown status (forward-compat for ACEPTADA/PEDIDO; the
 *          component treats -1 as "no step to highlight" and renders
 *          all three as future). The helper NEVER throws so the
 *          computed `currentIndex` in the component stays pure.
 */
export function stepperIndexFromStatus(status: QuotationStatus): number {
  switch (status) {
    case 'DRAFT':
      return 0
    case 'SENT':
      return 1
    case 'EXPIRED':
    case 'CANCELLED':
      return 2
    default:
      return -1
  }
}

/**
 * T-UI-12/13 — REQ-UI-009 client-side IVA 16% computation.
 *
 * Used as fallback when backend doesn't expose taxCents. The backend now
 * stamps `taxCents` + `taxRate` on the quotation response, so the
 * RESUMEN sidebar reads both directly from the DTO (`QuotationTotalsFooter`
 * only renders the row when both fields are non-null). This util is kept
 * available for any caller that still needs a local estimate — e.g. legacy
 * PDF rendering, exported CSVs, or unit tests that wire the helper
 * directly. New callers SHOULD prefer the backend values.
 *
 * Rounding: `Math.round` follows standard half-away-from-zero semantics,
 * which matches the es-MX currency convention (no fractional cents on
 * invoices).
 *
 * Negative inputs: clamped at 0. A negative `totalCents` would be a
 * backend bug; we keep the tax non-negative so the summary card never
 * shows a "−$X.XX" tax line.
 */
export function computeIva16(totalCents: number): number {
  if (!Number.isFinite(totalCents) || totalCents <= 0) return 0
  return Math.round(totalCents * 0.16)
}