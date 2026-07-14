# Sales Specification

Domain: `sales` · POS sale-detail and draft-cart rendering of promotion-driven state. This capability covers the union widening of `ApplicablePromotion.type` to include `BUY_X_GET_Y`, the rendering of the `GRATIS` reward badge on confirmed sale lines whose backend-marked `rewardKind === 'buy_x_get_y'`, the `subtotalCents` (NET) rendering rule for confirmed-sale lines, and the unified draft-cart line display contract (`subtotalCents` + `rewardKind` + tightened unit-strikethrough rules).

## Purpose

When the backend evaluates a `BUY_X_GET_Y` promotion, it now reports per-line metadata (`rewardKind`, `subtotalCents`) on both confirmed `SaleDetailItem` and draft `SaleItem` payloads. The frontend must accept those fields, render a `GRATIS` badge where the reward applies, show the backend-provided NET amount without recomputation, and never strike through a unit price that did not actually drop. All copy is neutral Spanish; identifiers remain English.

## Requirements

### REQ-1 Applicable Promotions Include BUY_X_GET_Y
The sales `ApplicablePromotion.type` contract MUST include `'BUY_X_GET_Y'` alongside the existing promotion types, so applicable-promotion responses containing BXGY are accepted and represented without type errors.

#### Scenario: BXGY applicable promotion is accepted
- GIVEN the applicable-promotions response contains `type: 'BUY_X_GET_Y'`
- WHEN the sales flow parses and renders the response
- THEN the promotion is accepted as a valid applicable promotion

### REQ-2 Confirmed Sale Reward Badge
A confirmed-sale detail line with `rewardKind === 'buy_x_get_y'` MUST render a reward badge labeled `GRATIS`. When `rewardKind` is `null` or absent, the line MUST NOT render that badge. The line MUST display `subtotalCents` as the backend-provided NET amount; the client MUST NOT recompute it.

#### Scenario: BXGY reward line shows GRATIS
- GIVEN a confirmed-sale detail line has `rewardKind: 'buy_x_get_y'`
- WHEN the detail line renders
- THEN a reward badge labeled `GRATIS` is visible
- AND the line uses its provided `subtotalCents`

#### Scenario: non-reward line has no reward badge
- GIVEN a confirmed-sale detail line has `rewardKind: null` or no `rewardKind` field
- WHEN the detail line renders
- THEN no BXGY reward or `GRATIS` badge is visible

#### Scenario: NET subtotal is rendered without client calculation
- GIVEN the backend provides a line `subtotalCents` that already reflects the BXGY reward
- WHEN the confirmed-sale detail renders
- THEN the displayed line subtotal equals the provided `subtotalCents`
- AND no client-side discount calculation changes it

### REQ-3 Draft Cart Line NET Display + Reward Badge + Strikethrough Fix
The draft cart row (`SaleItemRow`) MUST render the line total and the unit-price strikethrough using a single, unified contract that works for BXGY promotions, cashier line discounts, and no-discount lines. Both `subtotalCents` (NET per line) and `rewardKind` MUST be accepted on `SaleItem` (optional + nullable for backward compat with pre-deploy draft responses).

The display rules are:
- `grossPerUnit = item.prePriceCentsBeforeDiscount ?? item.unitPriceCents`
- `grossLine = lineCents(grossPerUnit, item.quantity)`
- `netLine = item.subtotalCents ?? grossLine` — backend NET wins; fall back to gross for pre-deploy drafts.
- The bold line total renders `netLine`.
- The struck-through gross line renders `grossLine` ONLY when `netLine < grossLine`. It MUST NOT render when they are equal.
- The unit-price strikethrough (`showPriceOrigin` / `showDiscountOrigin`) MUST tighten so a strikethrough only appears when the unit price ACTUALLY dropped:
  - `showPriceOrigin`: require `originalPriceCents != null && unitPriceCents < originalPriceCents` (plus the existing `priceSource ∈ {price_list, custom}` check).
  - `showDiscountOrigin`: require `discountType != null && prePriceCentsBeforeDiscount != null && unitPriceCents < prePriceCentsBeforeDiscount`.
- `rewardKind` MUST be forwarded to `SaleItemBadges` so the `GRATIS` badge appears on draft cart lines that are BXGY rewards (parity with the confirmed-sale surface).

#### Scenario: BXGY draft line renders NET + struck gross + GRATIS badge, NO unit strikethrough
- GIVEN a draft line with `unitPriceCents: 20000`, `quantity: 2`, `prePriceCentsBeforeDiscount: 20000`, `discountAmountCents: 20000`, `subtotalCents: 20000`, `rewardKind: 'buy_x_get_y'` (2x1 promotion: buy 2 get 1 free)
- WHEN the draft cart row renders
- THEN the bold line total displays `$200.00` (the backend NET)
- AND a struck-through gross line displays `$400.00`
- AND no unit-price strikethrough appears (unit price did not drop — the reward is line-level)
- AND the `GRATIS` reward badge is visible via `SaleItemBadges`

#### Scenario: cashier line discount renders NET + struck gross + unit-price strikethrough
- GIVEN a draft line with `unitPriceCents: 8000`, `prePriceCentsBeforeDiscount: 9600`, `quantity: 1`, `discountType: 'percentage'`, `subtotalCents: 8000`
- WHEN the draft cart row renders
- THEN the bold line total displays `$80.00` (backend NET)
- AND a struck-through gross line displays `$96.00`
- AND the pre-discount unit price strikethrough is visible (unit dropped)

#### Scenario: no-discount line renders NET with no struck line and no unit strikethrough
- GIVEN a draft line with `unitPriceCents: 5000`, `quantity: 2`, `subtotalCents: 10000`, no `prePriceCentsBeforeDiscount`, no `originalPriceCents`
- WHEN the draft cart row renders
- THEN the bold line total displays `$100.00`
- AND no struck-through gross line is shown (NET === GROSS)
- AND no unit-price strikethrough is shown

#### Scenario: pre-deploy draft falls back to gross when subtotalCents is absent
- GIVEN a draft line with `subtotalCents` absent and no discounts
- WHEN the draft cart row renders
- THEN the bold line total displays `unitPriceCents × quantity` (the gross fallback)
- AND no struck-through gross line is shown
- AND `rewardKind` is treated as absent (no `GRATIS` badge)

#### Scenario: unit-price strikethrough is suppressed when the unit price did not drop
- GIVEN a line with `unitPriceCents === prePriceCentsBeforeDiscount` (BXGY shape, reward is line-level)
- WHEN the draft cart row renders
- THEN `showDiscountOrigin` is `false`
- AND no pre-discount unit-price strikethrough is rendered
- AND the current unit price still renders unchanged

### REQ-4 ApplicablePromotion Eligibility Fields Are Optional + Nullable

`ApplicablePromotion` MUST accept five OPTIONAL + nullable fields: `eligible?: boolean`, `buyQuantity?: number | null`, `getQuantity?: number | null`, `unitsNeeded?: number`, `method?: 'MANUAL'`. Fixtures omitting all five MUST still type-check.

#### Scenario: all eligibility fields accept concrete values
- GIVEN `eligible: true, buyQuantity: 2, getQuantity: 1, unitsNeeded: 1, method: 'MANUAL'`
- WHEN the literal is type-checked
- THEN the literal is accepted

#### Scenario: `buyQuantity` and `getQuantity` accept null
- GIVEN `buyQuantity: null, getQuantity: null`
- WHEN the literal is type-checked
- THEN the literal is accepted

#### Scenario: eligibility fields are omittable for legacy fixtures
- GIVEN all five fields are omitted
- WHEN the literal is type-checked
- THEN the literal is accepted

### REQ-5 Aplicar Button Honors Generic `eligible` Gate

The accordion MUST bind `:disabled="promo.eligible === false"` on the `Aplicar` `UButton` (testid `promo-apply-${id}`). The STRICT `=== false` comparison is required so that only an explicit `false` disables the button; `undefined` (legacy rows omitting `eligible`) and `true` MUST remain enabled — a loose `!eligible` would wrongly disable legacy rows. When `eligible === false`, the button renders disabled and clicking MUST NOT emit `apply`. When `eligible === true` or `undefined`, the button MUST remain enabled. The gate is GENERIC on `eligible`; it MUST NOT branch on `promo.type`.

#### Scenario: `eligible: false` disables Aplicar
- GIVEN a row has `eligible: false`
- WHEN the accordion renders the row
- THEN `promo-apply-${id}` is rendered with `disabled` and clicking does not emit `apply`

#### Scenario: `eligible: true` keeps Aplicar enabled
- GIVEN a row has `eligible: true`
- WHEN the accordion renders the row
- THEN `promo-apply-${id}` is enabled and clicking emits `apply`

#### Scenario: legacy fixture without `eligible` keeps Aplicar enabled
- GIVEN a row omits `eligible`
- WHEN the accordion renders the row
- THEN `promo-apply-${id}` is enabled (undefined is treated as eligible)

### REQ-6 `unitsNeeded` Renders Localized Hint With Singular/Plural

When a row carries `unitsNeeded != null`, the accordion MUST render a hint under the title with testid `promo-hint-${id}` and text `"2x1 · requiere N unidad(es) más"`. The noun MUST agree with `N`: `N === 1` → `"2x1 · requiere 1 unidad más"`; `N >= 2` → `"2x1 · requiere N unidades más"`. When `unitsNeeded` is absent or null, the hint MUST NOT render.

#### Scenario: N=1 renders singular hint
- GIVEN a row has `unitsNeeded: 1`
- WHEN the accordion renders the row
- THEN `promo-hint-${id}` contains `2x1 · requiere 1 unidad más`

#### Scenario: N=2 renders plural hint
- GIVEN a row has `unitsNeeded: 2`
- WHEN the accordion renders the row
- THEN `promo-hint-${id}` contains `2x1 · requiere 2 unidades más`

#### Scenario: no `unitsNeeded` renders no hint
- GIVEN a row has `unitsNeeded` absent or null
- WHEN the accordion renders the row
- THEN no element with testid `promo-hint-${id}` is rendered

### REQ-7 SaleDetailItem Carries Optional `promotionId`

`SaleDetailItem` MUST accept `promotionId?: string | null`. Fixtures omitting the field MUST still type-check.

#### Scenario: `promotionId` accepts a string value
- GIVEN `promotionId: 'promo-abc'`
- WHEN the literal is type-checked
- THEN the literal is accepted

#### Scenario: `promotionId` accepts null
- GIVEN `promotionId: null`
- WHEN the literal is type-checked
- THEN the literal is accepted

#### Scenario: `promotionId` is omittable for legacy fixtures
- GIVEN `promotionId` is omitted
- WHEN the literal is type-checked
- THEN the literal is accepted

### REQ-8 Confirmed-Sale List Forwards `promotionId` to Item Badges

`SaleDetailItemsList` MUST forward each item's `promotionId` to `SaleItemBadges` via `:promotion-id`. The promo chip is gated on `promotionId != null` (the existing `SaleItemBadges` `hasPromotion` gate): when a promotion is present the chip renders the promotion title from `discountTitle`, and when `discountTitle` is empty or null it renders a defensive `"Promoción"` fallback label. In a confirmed sale the backend always supplies `discountTitle`, so the fallback is defensive-only in practice. The confirmed-sale surface MUST NOT render the `sale-item-remove-promo` button (it never sets `removable`). `SaleItemBadges.vue` MUST NOT be modified.

#### Scenario: promotionId + non-empty discountTitle renders promo-name chip
- GIVEN a confirmed-sale item with `promotionId: 'promo-abc'` and `discountTitle: 'Black Friday 2x1'`
- WHEN `SaleDetailItemsList` renders the row
- THEN `SaleItemBadges` receives `promotion-id="promo-abc"`
- AND the `sale-item-promo-badge` chip with that title is visible
- AND no `sale-item-remove-promo` button renders

#### Scenario: promotionId with empty discountTitle renders defensive fallback chip
- GIVEN a confirmed-sale item with `promotionId: 'promo-abc'` and `discountTitle: ''` or null
- WHEN `SaleDetailItemsList` renders the row
- THEN `SaleItemBadges` receives `promotion-id="promo-abc"`
- AND the `sale-item-promo-badge` chip renders with the `"Promoción"` fallback label
- AND no `sale-item-remove-promo` button renders

## UI Copy (neutral Spanish, examples)

- Reward badge label: `GRATIS`
- BXGY units-needed hint: `2x1 · requiere N unidad(es) más` (N=1 → `"2x1 · requiere 1 unidad más"`; N≥2 → `"2x1 · requiere N unidades más"`)
- Defensive promo fallback label: `Promoción`
