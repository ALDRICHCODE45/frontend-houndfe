/**
 * `sale.constants.ts` — value-preserving logic constants for the POS/sales
 * module.
 *
 * Convention (slice 3 of `sdd/magic-string-constants`):
 *   - Per-module `features/<module>/constants/<name>.constants.ts`.
 *   - SCREAMING_SNAKE_CASE value objects (`as const`) co-located with the
 *     matching PascalCase TYPE in `interfaces/sale.types.ts`. The TYPE
 *     remains the canonical surface for callers — this file just gives them
 *     a typed handle to each literal value so a typo at a call site fails
 *     the build instead of silently producing a wrong runtime string.
 *   - Per-module constants, NEVER a global one — protects against
 *     cross-module homonym bugs. The most important guards in THIS module:
 *       1. `'CANCELED'` (sales, ONE L) vs `'CANCELLED'` (employees, TWO L's).
 *          Two different backend contracts. Sharing a global would silently
 *          break one of them.
 *       2. `PaymentMethod` (LOWERCASE) and `SaleDetailPaymentMethod`
 *          (UPPERCASE) are TWO DIFFERENT contracts. Kept as two separate
 *          value objects (`PAYMENT_METHOD` and `SALE_DETAIL_PAYMENT_METHOD`)
 *          so a get/set mismatch cannot cross between them.
 *       3. `POS_ACTIVE_TAB_STORAGE_KEY` is the only raw `localStorage` key
 *          left in the project. Pin tests freeze the exact string so a
 *          future get/set typo cannot silently lose the active tab.
 *
 * Like promotions (slice 2), the sales module's `sale.types.ts` uses plain
 * string-union types — there is no Zod schema to derive from. So each
 * value object here is `as const`, and the matching TYPE in
 * `interfaces/sale.types.ts` is now derived from it
 * (`(typeof X)[keyof typeof X]`), making the const the SINGLE SOURCE OF
 * TRUTH and preserving one-directional imports (types → constants, never
 * the other way).
 *
 * This file is value-preserving: every literal is RELOCATED from the
 * previous inline spot — NEVER renamed. The pin tests in
 * `__tests__/sale.constants.spec.ts` lock each value against accidental
 * drift.
 */

// ─── SALE_STATUS (UPPERCASE, backend v1) ──────────────────────────────────────
// Type: `SaleStatus` from `interfaces/sale.types` (derived from this const via
// `(typeof SALE_STATUS)[keyof typeof SALE_STATUS]`).
//
// GUARDRAIL: 'CANCELED' has ONE L. admin/employees uses 'CANCELLED' (TWO L's).
// Both spellings exist as deliberate backend contracts. Keep this
// PER-MODULE — sharing across modules would cause the exact homonym bug
// this slice exists to prevent.

export const SALE_STATUS = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  CANCELED: 'CANCELED',
} as const

// ─── SALE_PAYMENT_STATUS (UPPERCASE, backend v1) ─────────────────────────────
// Type: `SalePaymentStatus` from `interfaces/sale.types`.

export const SALE_PAYMENT_STATUS = {
  PAID: 'PAID',
  PARTIAL: 'PARTIAL',
  CREDIT: 'CREDIT',
} as const

// ─── SALE_DELIVERY_STATUS (UPPERCASE, backend v1) ────────────────────────────
// Type: `SaleDeliveryStatus` from `interfaces/sale.types`. 'NOT_APPLICABLE' is
// the value used by instant-delivery sales (e.g. take-away) — does NOT mean
// "unknown" / "null".

export const SALE_DELIVERY_STATUS = {
  PENDING: 'PENDING',
  DELIVERED: 'DELIVERED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
} as const

// ─── PAYMENT_METHOD (LOWERCASE — draft + non-detail filters) ──────────────────
// Type: `PaymentMethod` from `interfaces/sale.types`.
//
// CRITICAL: These are LOWERCASE by backend contract. They are used for the
// draft sale checkout flow (PaymentModal, DebtPaymentModal, etc.) and for
// the legacy single-payment charge path. They are DISTINCT from
// SALE_DETAIL_PAYMENT_METHOD (UPPERCASE, below) — different contracts,
// different code paths. Keep both as separate value objects.

export const PAYMENT_METHOD = {
  CASH: 'cash',
  CARD_CREDIT: 'card_credit',
  CARD_DEBIT: 'card_debit',
  TRANSFER: 'transfer',
  CREDIT: 'credit',
} as const

// ─── SALE_DETAIL_PAYMENT_METHOD (UPPERCASE — confirmed sale + filter) ────────
// Type: `SaleDetailPaymentMethod` from `interfaces/sale.types`.
//
// CRITICAL: These are UPPERCASE. They surface in `SaleDetail.payments[].method`
// (confirmed sale timeline) and the multi-pick payment-method filter on the
// confirmed-sales list. They are DISTINCT from PAYMENT_METHOD (LOWERCASE,
// above) — different contracts. Sharing one constant between the two would
// fail at runtime (the backend returns "CASH" for filter values, never "cash").

export const SALE_DETAIL_PAYMENT_METHOD = {
  CASH: 'CASH',
  CARD_CREDIT: 'CARD_CREDIT',
  CARD_DEBIT: 'CARD_DEBIT',
  TRANSFER: 'TRANSFER',
  CREDIT: 'CREDIT',
} as const

// ─── SALE_TIMELINE_EVENT_TYPE (UPPERCASE, backend v1) ────────────────────────
// Type: `SaleTimelineEvent['type']` discriminated union from
// `interfaces/sale.types`. The backend emits exactly these four `type`
// discriminators on the sale detail timeline.
//
// `COMMENT` is intentionally NOT in any other union — it carries its own
// payload shape (actor + commentId + body) distinct from the three event
// types.

export const SALE_TIMELINE_EVENT_TYPE = {
  SALE_REGISTERED: 'SALE_REGISTERED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  PRODUCTS_DELIVERED: 'PRODUCTS_DELIVERED',
  COMMENT: 'COMMENT',
} as const

// ─── POS_ACTIVE_TAB_STORAGE_KEY (single-tenant storage key freeze) ───────────
//
// The active POS tab (which draft sale is currently being edited) is the
// ONLY raw `localStorage` key left in the project. `SalesView.vue` reads
// it (L148 of the pre-refactor file) and writes it (L166). A get/set
// mismatch would silently lose the active tab on every page reload, so it
// is exported here as a single value the get site and the set site share.
//
// Auth-prefixed storage keys live in `core/auth/storage/auth-storage.ts`
// (`HOUND_AUTH_*`). The only other session-scoped viewport keys today are
// the view-mode keys (employees, products) which already have per-module
// constants. Keep this one PER-MODULE too — it is a sales-feature
// concern, not a global auth concern.

export const POS_ACTIVE_TAB_STORAGE_KEY = 'pos:active-tab'
