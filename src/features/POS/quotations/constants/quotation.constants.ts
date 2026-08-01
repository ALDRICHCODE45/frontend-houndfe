/**
 * `quotation.constants.ts` — value-preserving logic constants for the
 * POS/quotations module.
 *
 * Convention (per-module, NOT global):
 *   - Per-module `features/<module>/constants/<name>.constants.ts`.
 *   - SCREAMING_SNAKE_CASE value objects (`as const`) co-located with the
 *     matching PascalCase TYPE in `interfaces/quotation.types.ts`. The TYPE
 *     remains the canonical surface for callers — this file just gives them
 *     a typed handle to each literal value so a typo at a call site fails
 *     the build instead of silently producing a wrong runtime string.
 *   - PER-MODULE constants, NEVER a global one — protects against
 *     cross-module homonym bugs:
 *       - quotations uses 'CANCELLED' (TWO L's).
 *       - sales uses 'CANCELED' (ONE L).
 *     Two distinct backend contracts. Sharing would silently break one.
 *
 * This file is value-preserving: every literal is pinned by the contract
 * tests in `__tests__/quotation.constants.spec.ts`. Never edit a value.
 */

// ─── QUOTATION_STATUS (UPPERCASE, backend v1) ─────────────────────────────────
// Type: `QuotationStatus` from `interfaces/quotation.types` (derived from this
// const via `(typeof QUOTATION_STATUS)[keyof typeof QUOTATION_STATUS]`).
//
// GUARDRAIL: 'CANCELLED' uses TWO L's. sales uses 'CANCELED' (ONE L). They are
// distinct backend contracts. Keep this PER-MODULE.

export const QUOTATION_STATUS = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const

// ─── CANCEL_REASONS (UPPERCASE, backend v1) ───────────────────────────────────
// Type: `CancelReason` from `interfaces/quotation.types`.
//
// Source: backend §3.15 — required body of POST /quotations/drafts/:id/cancel.

export const CANCEL_REASONS = {
  CUSTOMER_REQUEST: 'CUSTOMER_REQUEST',
  PRICE_OBJECTION: 'PRICE_OBJECTION',
  EXPIRED: 'EXPIRED',
  OTHER: 'OTHER',
} as const

// ─── QUOTATION_STATUS_TONE (status → badge tone) ──────────────────────────────
//
// Used by the list view's status column and the detail view's header badge.
// Mapping follows the same pattern as sales (`SaleStatusBadge`) and employees:
//   DRAFT      → info    (the editable, neutral state)
//   SENT       → success (committed / delivered)
//   EXPIRED    → warning (lazy transition, no longer active)
//   CANCELLED  → error   (terminal, rejected)

export const QUOTATION_STATUS_TONE = {
  DRAFT: 'info',
  SENT: 'success',
  EXPIRED: 'warning',
  CANCELLED: 'error',
} as const

export type QuotationStatusTone =
  (typeof QUOTATION_STATUS_TONE)[keyof typeof QUOTATION_STATUS_TONE]

// ─── QUOTATION_STATUS_LABEL (status → localized Spanish label) ────────────────

export const QUOTATION_STATUS_LABEL = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  EXPIRED: 'Expirada',
  CANCELLED: 'Cancelada',
} as const

// ─── CANCEL_REASON_LABEL (reason → localized Spanish label) ──────────────────
//
// Used by the cancel dialog and the cancelled-detail surface.

export const CANCEL_REASON_LABEL = {
  CUSTOMER_REQUEST: 'El cliente pidió cancelar',
  PRICE_OBJECTION: 'El cliente rechazó por precio',
  EXPIRED: 'La cotización expiró sin respuesta',
  OTHER: 'Otro motivo',
} as const