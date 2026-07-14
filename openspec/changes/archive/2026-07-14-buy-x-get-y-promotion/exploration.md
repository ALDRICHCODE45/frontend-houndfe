# Exploration: buy-x-get-y-promotion

> Phase: EXPLORE (analysis only — no solution design, no tasks).
> All gaps below were spot-checked against live code with file + line evidence.
> Stack: Vue 3 + `<script setup lang="ts">` + Nuxt UI v4, Vitest, strict TDD.

## Current State

The frontend already ships a BUY_X_GET_Y (BXGY) form path and a POS opt-in flow, but
that UI was authored speculatively in the 2026-04 promotions module **before** the backend
POS engine ever evaluated BXGY. The engine is now live and its `getDiscountPercent`
semantics are the **inverse** of what the form assumes. The result: every "2x1 / lleva gratis"
promo the merchant creates today serializes `getDiscountPercent: 0`, the engine applies 0% off,
and the customer receives nothing. This is a correctness (not cosmetic) defect on the flagship case.

### Relevant module layout

**Promotions module** — `src/features/POS/promotions/`
- `interfaces/promotion.schema.ts` — Zod form schema, `superRefine` per promotion type.
- `interfaces/promotion.types.ts` — form state, payload, and API response types.
- `composables/usePromotionForm.ts` — option arrays, BXGY presets, state factory,
  `promotionToFormState`, `toCreatePayload` / `toUpdatePayload`, `mapApiErrorToFields`.
- `components/PromotionForm.vue` — full-page form; per-type `UCard` sections
  (`data-testid="buy-x-get-y-section"`), `DISCOUNT_PERCENT_OPTIONS`, presets, "Aplica a".
- `components/PromotionTargetItemsSection.vue` — target picker; `allowVariants` prop (default `false`).

**Sales module** — `src/features/POS/sales/`
- `interfaces/sale.types.ts` — `SaleDetailItem`, `ApplicablePromotion`, draft/detail DTOs.
- `components/SaleDetailItemsList.vue` — confirmed-sale line renderer; delegates badges.
- `components/SaleItemBadges.vue` — shared badge group (draft + detail surfaces).
- Opt-in flow (already built + tested): `PromocionesDisponiblesAccordion.vue`, `ActiveSalePanel.vue`,
  `SalesView.vue`, `useSalesDrafts` apply/remove/veto mutations, cache invalidation, toasts.

### Backend contract (live BUY_X_GET_Y engine — reference)

- Create `POST /promotions`; Edit `PATCH /promotions/:id` (type immutable → `400 INVALID_FIELD_CHANGE`).
- BXGY body: `title`, `type:"BUY_X_GET_Y"`, `method`, `appliesTo` (`PRODUCTS|VARIANTS|CATEGORIES|BRANDS`),
  `targetItems:[{targetType,targetId}]` (side `DEFAULT`), `buyQuantity>=1`, `getQuantity>=1`,
  `getDiscountPercent` **int 0..100**, `startDate/endDate`, `customerScope`, `daysOfWeek`.
- **FORBIDDEN for BXGY** (`400` if sent): `discountType`, `discountValue`, `minPurchaseAmountCents`,
  `buyTargetType`, `getTargetType`.
- **`getDiscountPercent` = % OFF on the "get" unit(s).** `100` = FREE, `0` = no discount. BXGY range `0..100`
  (ADVANCED is `0..99` but ADVANCED is out of scope / disabled).
- Engine grouping: `floor(quantity / (buyQuantity + getQuantity))` groups **per single line**; the
  `getQuantity` cheapest units of each group get the discount. Never summed across lines. No stacking
  (best-savings promo wins per line; a cashier manual line discount blocks auto BXGY).
- `GET /sales/drafts/:id/applicable-promotions` now includes `type: 'BUY_X_GET_Y'`.
- `GET /sales/:id` line DTO gains `rewardKind: 'buy_x_get_y' | null` for a reward/GRATIS badge.
  Line `subtotalCents` is already NET (reward subtracted); order-level `subtotalCents` is gross,
  `discountCents` reconciles to `totalCents`.
- Domain error codes (`HTTP 400`): `INVALID_TARGET`, `MISSING_REQUIRED_FIELD`, `INVALID_FIELD_VALUE`,
  `FORBIDDEN_FIELD`, `INVALID_DATE_RANGE`, `INVALID_FIELD_CHANGE`, `duplicate_target` (casing unverified).

## Affected Areas (confirmed with evidence)

### (a) CRITICAL — `getDiscountPercent` semantic inversion

- `src/features/POS/promotions/interfaces/promotion.schema.ts:181-186` — BXGY branch validates
  `getDiscountPercent < 0 || > 99` and rejects 100 with message
  `"El descuento debe estar entre 0 y 99 (0 = gratis, 100 no permitido)"`. **Must be `0..100` for BXGY.**
  The ADVANCED branch at `:226-231` uses the same `0..99` bound and **must stay `0..99`** (ADVANCED out of scope but do not break it).
- `src/features/POS/promotions/components/PromotionForm.vue:22-28` — `DISCOUNT_PERCENT_OPTIONS`
  labels value **`0` as "Gratis"** (inverted), then generates `5..95` in steps of 5. **No `100` option exists;**
  the form literally cannot express "free". Bound to the BXGY select at `:411-419` and ADVANCED at `:473-479`.
- `src/features/POS/promotions/composables/usePromotionForm.ts:60-64` — `BUY_X_GET_Y_PRESETS`:
  - `2x1` → `buyQuantity:2, getQuantity:1, getDiscountPercent:0`
  - `3x2` → `buyQuantity:3, getQuantity:2, getDiscountPercent:0`
  - `Segundo al 50%` → `buyQuantity:2, getQuantity:1, getDiscountPercent:50`
  Both percent AND quantities are wrong under the live grouping rule (group = `buyQuantity + getQuantity`,
  cheapest `getQuantity` units discounted). See "Correct preset derivation" below.
- Serialization is **already correct**: `toCreatePayload` BXGY branch (`usePromotionForm.ts:229-246`)
  sends `getDiscountPercent` raw (no conversion) and omits all forbidden fields. **The fix is purely in
  schema bound + options list + presets — not in the payload builder.**

**Correct preset derivation (needs product confirmation — see Open Questions):**
| Preset UX label | Meaning | group = buy+get | buyQuantity | getQuantity | getDiscountPercent |
|---|---|---|---|---|---|
| 2x1 ("take 2, pay 1") | 1 free per 2 | 2 | 1 | 1 | 100 |
| 3x2 ("take 3, pay 2") | 1 free per 3 | 3 | 2 | 1 | 100 |
| Segundo al 50% | 2nd unit half off | 2 | 1 | 1 | 50 |

### (b) Type / contract additions

- `src/features/POS/sales/interfaces/sale.types.ts:377` — `ApplicablePromotion.type` is
  `'PRODUCT_DISCOUNT' | 'ORDER_DISCOUNT'`. **Missing `'BUY_X_GET_Y'`** (backend now returns it in the union).
- `src/features/POS/sales/interfaces/sale.types.ts:56-75` — `SaleDetailItem` has no
  `rewardKind` field. **Add `rewardKind?: 'buy_x_get_y' | null`** to match the new `SaleDetailItemDto`.

### (c) Ticket reward badge

- `src/features/POS/sales/components/SaleItemBadges.vue` — renders price-source, promo, and discount
  badges (`:64-145`) but has **no `rewardKind` prop and no reward/GRATIS badge**. Needs a badge keyed on
  `rewardKind === 'buy_x_get_y'`.
- `src/features/POS/sales/components/SaleDetailItemsList.vue:86-95` — passes traceability fields to
  `SaleItemBadges` but **not any reward info**. Line subtotal at `:110` uses `item.subtotalCents`,
  which is already NET per the contract — **line NET vs order-gross rendering is consistent; no change needed there.**

### (d) Validation hardening

- `promotion.schema.ts:146-188` — the BXGY branch validates quantities and percent but **does NOT
  validate `appliesTo` is present + at least one `targetItems` entry**, so an empty target reaches the
  backend and returns an avoidable `400 INVALID_TARGET`. (Compare PRODUCT_DISCOUNT at `:78-84`, which does
  guard `appliesTo`.) A client-side guard is warranted.
- `usePromotionForm.ts:336-425` (`mapApiErrorToFields`) — handles `INVALID_DATE_RANGE`,
  `MISSING_REQUIRED_FIELD`, `INVALID_FIELD_VALUE`, `DUPLICATE_TARGET`, `INVALID_TARGET`,
  `ENTITY_ALREADY_EXISTS`. **Missing `FORBIDDEN_FIELD` and `INVALID_FIELD_CHANGE` mappings.**
  `DUPLICATE_TARGET` is matched **uppercase only** (`:384`) while the backend may emit `duplicate_target`
  → consider case-insensitive matching.

### (e) Open product question — VARIANTS targeting for BXGY

- `PromotionForm.vue:426-432` — the BXGY `PromotionTargetItemsSection` does **not** pass `:allow-variants`,
  so it defaults to `false` (`PromotionTargetItemsSection.vue:28`) and hides VARIANTS as a BXGY target.
  The PRODUCT_DISCOUNT card at `:323` **does** pass `:allow-variants="true"`. The backend allows
  `appliesTo=VARIANTS` for BXGY. This is a **product decision**, not an obvious bug — flag it, do not decide.

## Gap Summary (grouped)

| # | Category | Evidence | Severity |
|---|---|---|---|
| 1 | (a) Critical fix | schema `:181-186`, form `:22-28`, presets `:60-64` | CRITICAL |
| 2 | (b) Types | `sale.types.ts:377` `ApplicablePromotion.type` missing `BUY_X_GET_Y` | High |
| 3 | (b) Types | `sale.types.ts:56-75` `SaleDetailItem.rewardKind` missing | High |
| 4 | (c) Badge | `SaleItemBadges.vue` / `SaleDetailItemsList.vue` no reward/GRATIS badge | Medium |
| 5 | (d) Validation | BXGY schema branch missing `appliesTo`/`targetItems` guard (`:146-188`) | Medium |
| 6 | (d) Validation | `mapApiErrorToFields` missing `FORBIDDEN_FIELD`, `INVALID_FIELD_CHANGE`; `DUPLICATE_TARGET` uppercase-only (`:336-425`) | Medium |
| 7 | (e) Open question | BXGY card no `allow-variants` (`PromotionForm.vue:426-432`) | Decision |

## Already DONE (verified — scope OUT)

- BXGY form card renders with quantities, presets, and "Aplica a" (`PromotionForm.vue:378-435`). ✅
- `toCreatePayload` BXGY branch omits all forbidden fields and sends `getDiscountPercent` raw
  (`usePromotionForm.ts:229-246`). ✅ (semantics fix lives upstream in schema/options/presets)
- Opt-in flow (accordion, apply/remove/veto mutations, cache invalidation, toasts) built + tested. ✅

## Strict-TDD Implications (existing spec files to update — RED first)

- `src/features/POS/promotions/interfaces/__tests__/promotion.schema.test.ts` — BXGY `0..100` (accept 100),
  ADVANCED stays `0..99`, new `appliesTo`/`targetItems` BXGY guard.
- `src/features/POS/promotions/components/__tests__/PromotionForm.test.ts` — `DISCOUNT_PERCENT_OPTIONS`
  includes a `100`/"Gratis" option with corrected labeling; BXGY select can express 100; (possibly) `allow-variants`.
- `src/features/POS/promotions/composables/__tests__/usePromotionForm.test.ts` — corrected `BUY_X_GET_Y_PRESETS`
  values; `mapApiErrorToFields` for `FORBIDDEN_FIELD`, `INVALID_FIELD_CHANGE`, case-insensitive `duplicate_target`.
- `src/features/POS/sales/interfaces/__tests__/sale.types.test.ts` — `ApplicablePromotion.type` union includes
  `BUY_X_GET_Y`; `SaleDetailItem.rewardKind` type.
- `src/features/POS/sales/components/__tests__/SaleDetailItemsList.test.ts` — passes `rewardKind` through;
  reward line renders.
- `src/features/POS/sales/components/__tests__/SaleItemBadges.test.ts` — GRATIS/reward badge on
  `rewardKind === 'buy_x_get_y'`.

## Risks

- **Preset semantics need product sign-off.** Correcting quantities changes what "2x1"/"3x2" emit; if product's
  intended meaning differs from the grouping-derived table, presets will still be wrong. Confirm before coding.
- **Error-code casing unverified.** `duplicate_target` vs `DUPLICATE_TARGET` — case-insensitive matching is the
  safe hedge, but confirm the actual backend casing to avoid dead branches.
- **Copy language.** Existing form strings are Spanish (project convention); corrected labels/messages should
  follow the existing Spanish UI convention, while new code/identifiers stay English.
- **No new backend round-trips.** All changes are type/schema/option/presentation; do not introduce new fetches.

## Open Questions (do NOT decide in this phase)

1. **Preset quantities/percent** — confirm product intent for "2x1", "3x2", "Segundo al 50%" against the
   grouping-derived table above.
2. **VARIANTS as a BXGY target** — should the BXGY card pass `:allow-variants="true"` (backend allows it)?
3. **`duplicate_target` casing** — exact casing the backend emits, to decide case-insensitive vs exact match.

## Ready for Proposal

**Yes.** The CRITICAL correctness fix (a) plus type additions (b) and badge (c) are well-scoped against
verified evidence. Validation hardening (d) is low-risk and additive. The three open questions (e / presets /
casing) should be surfaced to the user in the proposal but do not block starting the critical fix.
