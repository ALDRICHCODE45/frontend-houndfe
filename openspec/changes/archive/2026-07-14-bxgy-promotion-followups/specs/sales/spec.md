# Delta for Sales

## ADDED Requirements

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