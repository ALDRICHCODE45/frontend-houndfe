# Delta for Sales

## ADDED Requirements

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
