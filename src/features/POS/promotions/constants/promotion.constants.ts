/**
 * `promotion.constants.ts` — value-preserving logic constants for the
 * POS/promotions module.
 *
 * Convention (slice 2 of `sdd/magic-string-constants`):
 *   - Per-module `features/<module>/constants/<name>.constants.ts`.
 *   - SCREAMING_SNAKE_CASE value objects (`as const`) co-located with the
 *     matching PascalCase TYPE in `interfaces/promotion.types.ts`. The TYPE
 *     remains the canonical surface for callers — this file just gives them
 *     a typed handle to each literal value so a typo at a call site fails
 *     the build instead of silently producing a wrong runtime string.
 *   - Per-module constants, NEVER a global one — protects against
 *     cross-module homonym bugs (e.g. `'ACTIVE'` exists in employees +
 *     promotions with the same casing; `'ENDED'` could clash with sales
 *     delivery `'PENDING'`).
 *
 * Unlike the employees module (slice 1) which derives constants from
 * Zod `.enum` accessors, the promotions module's `promotion.types.ts`
 * uses plain string-union types — there is no schema to derive from. So
 * each value object here is an `as const` object, and the matching type
 * in `interfaces/promotion.types.ts` derives from it
 * (`(typeof X)[keyof typeof X]`), making the const the single source of
 * truth.
 *
 * This file is value-preserving: every literal is RELOCATED from the
 * previous inline spot — NEVER renamed. The pin tests in
 * `__tests__/promotion.constants.spec.ts` lock each value against
 * accidental drift.
 *
 * `BXGY_ALLOWED_APPLIES_TO` and `INVALID_PROMOTION_TYPE` are NOT part of
 * any union type — they live here because they are equally magic and
 * equally drift-prone.
 */

// ─── PROMOTION_TYPE (UPPERCASE, backend v1) ───────────────────────────────────
// Type: `PromotionType` from `interfaces/promotion.types` (derived from this
// const via `(typeof PROMOTION_TYPE)[keyof typeof PROMOTION_TYPE]`).

export const PROMOTION_TYPE = {
  PRODUCT_DISCOUNT: 'PRODUCT_DISCOUNT',
  ORDER_DISCOUNT: 'ORDER_DISCOUNT',
  BUY_X_GET_Y: 'BUY_X_GET_Y',
  ADVANCED: 'ADVANCED',
} as const

// ─── DISCOUNT_TYPE (UPPERCASE, backend v1) ────────────────────────────────────
// Type: `DiscountType` from `interfaces/promotion.types`.

export const DISCOUNT_TYPE = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED: 'FIXED',
} as const

// ─── PROMOTION_TARGET_TYPE (UPPERCASE, backend v1) ────────────────────────────
// IMPORTANT: `BRANDS` and `PRODUCTS` are PLURAL — no trailing 's' rename, no
// `BRAND`. Type: `PromotionTargetType` from `interfaces/promotion.types`.

export const PROMOTION_TARGET_TYPE = {
  CATEGORIES: 'CATEGORIES',
  BRANDS: 'BRANDS',
  PRODUCTS: 'PRODUCTS',
  VARIANTS: 'VARIANTS',
} as const

// ─── CUSTOMER_SCOPE (UPPERCASE, backend v1) ──────────────────────────────────
// Type: `CustomerScope` from `interfaces/promotion.types`.

export const CUSTOMER_SCOPE = {
  ALL: 'ALL',
  REGISTERED_ONLY: 'REGISTERED_ONLY',
  SPECIFIC: 'SPECIFIC',
} as const

// ─── PROMOTION_METHOD (UPPERCASE, backend v1) ─────────────────────────────────
// Type: `PromotionMethod` from `interfaces/promotion.types`.

export const PROMOTION_METHOD = {
  AUTOMATIC: 'AUTOMATIC',
  MANUAL: 'MANUAL',
} as const

// ─── TARGET_SIDE (UPPERCASE, backend v1) ──────────────────────────────────────
// Type: `TargetSide` from `interfaces/promotion.types`. Identifies which side
// of an ADVANCED promotion a target item belongs to.

export const TARGET_SIDE = {
  DEFAULT: 'DEFAULT',
  BUY: 'BUY',
  GET: 'GET',
} as const

// ─── DAY_OF_WEEK (UPPERCASE, backend v1) ──────────────────────────────────────
// Type: `DayOfWeek` from `interfaces/promotion.types`. Order intentionally
// matches Monday→Sunday (matches the form's DAY_OPTIONS iteration order).

export const DAY_OF_WEEK = {
  MONDAY: 'MONDAY',
  TUESDAY: 'TUESDAY',
  WEDNESDAY: 'WEDNESDAY',
  THURSDAY: 'THURSDAY',
  FRIDAY: 'FRIDAY',
  SATURDAY: 'SATURDAY',
  SUNDAY: 'SUNDAY',
} as const

// ─── PROMOTION_STATUS (UPPERCASE, backend v1) ────────────────────────────────
// Type: `PromotionStatus` from `interfaces/promotion.types`. The backend
// emits one of these three; the frontend never invents new statuses.
//
// IMPORTANT: this is the SAME `'ACTIVE'` value the employees module uses
// (and the `'SCHEDULED'` / `'ENDED'` set is unrelated to sales delivery's
// `'PENDING'`/`'DELIVERED'`). Keep PER-MODULE constants — the names overlap
// by accident; the contracts do not.

export const PROMOTION_STATUS = {
  ACTIVE: 'ACTIVE',
  SCHEDULED: 'SCHEDULED',
  ENDED: 'ENDED',
} as const

// ─── INVALID_PROMOTION_TYPE (route-guard sentinel, NOT a backend value) ───────
//
// PromotionDetailView.vue's route guard uses `'INVALID' as const` as a
// sentinel for "the route's `:type` param is not a valid PromotionType". It
// is intentionally excluded from the `PromotionType` union (and from the
// backend's PROMOTION_TYPE set). Keep the sentinel here so the guard stays
// one place and any future 5th promotion type can be added without forgetting
// to update the sentinel's "distinct from backend values" pin test.

export const INVALID_PROMOTION_TYPE = 'INVALID' as const

// ─── BXGY_ALLOWED_APPLIES_TO (REQ-11, schema-side catalog tuple) ──────────────
//
// The BXGY branch of the schema only accepts the four "catalog" target types
// (PRODUCTS / VARIANTS / CATEGORIES / BRANDS) — never ORDERS (which has no
// `appliesTo` semantics). The order here is purely cosmetic (matches the
// `BXGY_ALLOWED_APPLIES_TO` usage in `promotion.schema.ts`'s superRefine
// `.includes(...)` check, which is order-agnostic).

export const BXGY_ALLOWED_APPLIES_TO = [
  PROMOTION_TARGET_TYPE.PRODUCTS,
  PROMOTION_TARGET_TYPE.VARIANTS,
  PROMOTION_TARGET_TYPE.CATEGORIES,
  PROMOTION_TARGET_TYPE.BRANDS,
] as const
