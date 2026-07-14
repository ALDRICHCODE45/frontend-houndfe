# Delta Spec for `sales` — `bxgy-reward-badge-label`

Purpose: tighten the BXGY reward-badge label so it is percent-aware (no more
hardcoded `"GRATIS"` on partial-discount reward lines), and add an optional
`rewardDiscountPercent?: number | null` field to both `SaleItem` and
`SaleDetailItem` so the label can be computed deterministically from a
backend-provided discriminator. Pre-deploy payloads (field absent) MUST fall
back to NO reward badge — never to the legacy `"GRATIS"`.

Out of scope: backend contract (already shipped in main), tone/icon/testid on
the reward badge (unchanged), the `DESCUENTO` badge (unchanged), the
`sale-item-remove-promo` button (unchanged), the 18 unrelated pre-existing
test failures.

## MODIFIED Requirements

### REQ-2 Confirmed Sale Reward Badge

The confirmed-sale reward badge label MUST be driven by the reward's
`getDiscountPercent` (exposed as the optional field `rewardDiscountPercent`),
never hardcoded. Four cases:
- `rewardKind !== 'buy_x_get_y'` → no reward badge.
- `rewardKind === 'buy_x_get_y'` AND `rewardDiscountPercent === 100` → badge label `"GRATIS"`.
- `rewardKind === 'buy_x_get_y'` AND `rewardDiscountPercent != null` AND `!== 100` → badge label `"-{pct}%"` (e.g. `50` → `"-50%"`).
- `rewardKind === 'buy_x_get_y'` AND `rewardDiscountPercent == null` (pre-deploy) → no reward badge (defensive).

When rendered, the badge keeps the existing green `success` tone, `i-lucide-gift`
icon, and `data-testid="sale-item-reward-badge"`; only the label text changes.
The line MUST still render its backend-provided NET `subtotalCents` verbatim
(client MUST NOT recompute).

(Previously: badge always rendered hardcoded `"GRATIS"` whenever
`rewardKind === 'buy_x_get_y'`.)

#### Scenario: confirmed BXGY reward at 100% renders GRATIS badge
- GIVEN a confirmed-sale detail line has `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: 100`
- WHEN the detail line renders
- THEN a reward badge labeled `GRATIS` with `data-testid="sale-item-reward-badge"` is visible
- AND the line uses its provided `subtotalCents`

#### Scenario: confirmed BXGY reward at partial percent renders `-N%` badge
- GIVEN a confirmed-sale detail line has `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: 50`
- WHEN the detail line renders
- THEN a reward badge labeled `"-50%"` is visible
- AND no badge labeled `GRATIS` is visible

#### Scenario: confirmed BXGY reward with null percent renders no reward badge (defensive)
- GIVEN a confirmed-sale detail line has `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: null` (pre-deploy payload)
- WHEN the detail line renders
- THEN no `GRATIS` badge and no `-50%` badge is visible
- AND the line renders without throwing

#### Scenario: non-reward line has no reward badge
- GIVEN a confirmed-sale detail line has `rewardKind: null` (or omitted)
- WHEN the detail line renders
- THEN no BXGY reward badge is visible

#### Scenario: NET subtotal is rendered without client calculation
- GIVEN the backend provides a line `subtotalCents` already reflecting the BXGY reward
- WHEN the confirmed-sale detail renders
- THEN the displayed line subtotal equals the provided `subtotalCents`
- AND no client-side discount calculation changes it

### REQ-3 Draft Cart Line NET Display + Reward Badge + Strikethrough Fix

The draft cart row (`SaleItemRow`) MUST render the line total and the unit-price
strikethrough using a single, unified contract that works for BXGY promotions,
cashier line discounts, and no-discount lines. `SaleItem` MUST accept
`subtotalCents?: number | null`, `rewardKind?: 'buy_x_get_y' | null`, AND
`rewardDiscountPercent?: number | null` — all optional + nullable for
backward compat with pre-deploy draft responses.

The display rules are:
- `grossPerUnit = item.prePriceCentsBeforeDiscount ?? item.unitPriceCents`
- `grossLine = lineCents(grossPerUnit, item.quantity)`
- `netLine = item.subtotalCents ?? grossLine` — backend NET wins; fall back to gross for pre-deploy drafts.
- The bold line total renders `netLine`.
- The struck-through gross line renders `grossLine` ONLY when `netLine < grossLine`. It MUST NOT render when they are equal.
- The unit-price strikethrough (`showPriceOrigin` / `showDiscountOrigin`) MUST tighten so a strikethrough only appears when the unit price ACTUALLY dropped:
  - `showPriceOrigin`: require `originalPriceCents != null && unitPriceCents < originalPriceCents` (plus the existing `priceSource ∈ {price_list, custom}` check).
  - `showDiscountOrigin`: require `discountType != null && prePriceCentsBeforeDiscount != null && unitPriceCents < prePriceCentsBeforeDiscount`.
- `rewardKind` AND `rewardDiscountPercent` MUST be forwarded to `SaleItemBadges` so the percent-aware reward badge appears on draft cart lines that are BXGY rewards; the rendered label MUST match the confirmed-detail surface for the same `(rewardKind, rewardDiscountPercent)` pair.

(Previously: only `rewardKind` was forwarded and the badge label was hardcoded
`GRATIS`; `rewardDiscountPercent` was not part of the `SaleItem` contract.)

#### Scenario: BXGY draft line at 100% renders NET + struck gross + GRATIS badge, NO unit strikethrough
- GIVEN a draft line with `unitPriceCents: 20000`, `quantity: 2`, `prePriceCentsBeforeDiscount: 20000`, `discountAmountCents: 20000`, `subtotalCents: 20000`, `rewardKind: 'buy_x_get_y'`, `rewardDiscountPercent: 100`
- WHEN the draft cart row renders
- THEN the bold line total displays `$200.00`
- AND a struck-through gross line displays `$400.00`
- AND no unit-price strikethrough appears
- AND the `GRATIS` reward badge is visible via `SaleItemBadges`

#### Scenario: cashier line discount renders NET + struck gross + unit-price strikethrough
- GIVEN a draft line with `unitPriceCents: 8000`, `prePriceCentsBeforeDiscount: 9600`, `quantity: 1`, `discountType: 'percentage'`, `subtotalCents: 8000`
- WHEN the draft cart row renders
- THEN the bold line total displays `$80.00`
- AND a struck-through gross line displays `$96.00`
- AND the pre-discount unit price strikethrough is visible

#### Scenario: no-discount line renders NET with no struck line and no unit strikethrough
- GIVEN a draft line with `unitPriceCents: 5000`, `quantity: 2`, `subtotalCents: 10000`, no `prePriceCentsBeforeDiscount`, no `originalPriceCents`
- WHEN the draft cart row renders
- THEN the bold line total displays `$100.00`
- AND no struck-through gross line is shown
- AND no unit-price strikethrough is shown

#### Scenario: pre-deploy draft falls back to gross when subtotalCents is absent
- GIVEN a draft line with `subtotalCents` absent and no discounts
- WHEN the draft cart row renders
- THEN the bold line total displays `unitPriceCents × quantity` (the gross fallback)
- AND no struck-through gross line is shown
- AND `rewardKind` is treated as absent (no reward badge)

#### Scenario: unit-price strikethrough is suppressed when the unit price did not drop
- GIVEN a line with `unitPriceCents === prePriceCentsBeforeDiscount` (BXGY shape, reward is line-level)
- WHEN the draft cart row renders
- THEN `showDiscountOrigin` is `false`
- AND no pre-discount unit-price strikethrough is rendered

## ADDED Requirements

### REQ-9 SaleItem + SaleDetailItem Accept Optional `rewardDiscountPercent`

`SaleItem` (draft line) and `SaleDetailItem` (confirmed line) MUST both accept
`rewardDiscountPercent?: number | null` — optional + nullable, mirroring the
existing `rewardKind?: 'buy_x_get_y' | null` shape. Field values: 0..100;
`100` = true free, partial numbers = partial discount, `null` or omitted =
defensive no-badge. The two interfaces MUST stay in lock-step (mirrored change)
so the surfaces never drift.

#### Scenario: SaleItem accepts a concrete percent
- GIVEN `rewardDiscountPercent: 50` on a `SaleItem` literal
- WHEN the literal is type-checked
- THEN it is accepted

#### Scenario: SaleItem accepts null `rewardDiscountPercent`
- GIVEN `rewardDiscountPercent: null` on a `SaleItem` literal
- WHEN the literal is type-checked
- THEN it is accepted

#### Scenario: SaleItem `rewardDiscountPercent` is omittable for legacy fixtures
- GIVEN a `SaleItem` literal omits `rewardDiscountPercent`
- WHEN the literal is type-checked
- THEN it is accepted

#### Scenario: SaleDetailItem accepts a concrete percent
- GIVEN `rewardDiscountPercent: 50` on a `SaleDetailItem` literal
- WHEN the literal is type-checked
- THEN it is accepted

#### Scenario: SaleDetailItem accepts null `rewardDiscountPercent`
- GIVEN `rewardDiscountPercent: null` on a `SaleDetailItem` literal
- WHEN the literal is type-checked
- THEN it is accepted

#### Scenario: SaleDetailItem `rewardDiscountPercent` is omittable for legacy fixtures
- GIVEN a `SaleDetailItem` literal omits `rewardDiscountPercent`
- WHEN the literal is type-checked
- THEN it is accepted

### REQ-10 SaleItemBadges Renders Percent-Aware Reward Label

`SaleItemBadges` MUST compute the reward badge label via a pure,
unit-testable helper (extracted in-module — no global, no composable). The
helper returns `null` when the badge MUST NOT render, or a string label.

The rule:
- `rewardKind !== 'buy_x_get_y'` → `null`.
- `rewardKind === 'buy_x_get_y'` AND `rewardDiscountPercent === 100` → `"GRATIS"`.
- `rewardKind === 'buy_x_get_y'` AND `rewardDiscountPercent != null` AND `!== 100` → `"-{pct}%"` where `pct === rewardDiscountPercent`.
- `rewardKind === 'buy_x_get_y'` AND `rewardDiscountPercent == null` → `null` (pre-deploy defensive; never assume free).

When the helper returns a non-null label, the badge renders with the existing
green `success` tone + `i-lucide-gift` icon + `data-testid="sale-item-reward-badge"`.
Only the label text changes across rendering cases.

#### Scenario: non-reward kind returns null label (no badge)
- GIVEN `rewardKind: 'other_kind'` and `rewardDiscountPercent: 100`
- WHEN the helper is invoked
- THEN it returns `null`
- AND no `data-testid="sale-item-reward-badge"` element renders

#### Scenario: rewardKind null or absent returns null label
- GIVEN `rewardKind: null` (or omitted) and any `rewardDiscountPercent`
- WHEN the helper is invoked
- THEN it returns `null`

#### Scenario: BXGY with 100 returns `"GRATIS"`
- GIVEN `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: 100`
- WHEN the helper is invoked
- THEN it returns `"GRATIS"`

#### Scenario: BXGY with partial percent returns `"-N%"`
- GIVEN `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: 50`
- WHEN the helper is invoked
- THEN it returns `"-50%"`

#### Scenario: BXGY with partial percent MUST NOT render GRATIS
- GIVEN `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: 50`
- WHEN the badge renders
- THEN the visible label is `"-50%"`
- AND the visible label is NOT `"GRATIS"`

#### Scenario: BXGY with null percent returns null label (defensive)
- GIVEN `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: null`
- WHEN the helper is invoked
- THEN it returns `null`
- AND no `GRATIS` badge is rendered

#### Scenario: tone and icon parity between GRATIS and partial
- GIVEN `rewardKind: 'buy_x_get_y'` rendered twice — once with `rewardDiscountPercent: 100`, once with `rewardDiscountPercent: 50`
- WHEN both render
- THEN both badges use the green `success` tone
- AND both display the `i-lucide-gift` icon
- AND only the label string differs

### REQ-11 SaleItemRow + SaleDetailItemsList Forward `rewardDiscountPercent`

Both surfaces MUST forward `rewardDiscountPercent` to `SaleItemBadges`. The
draft cart (`SaleItemRow`) MUST forward `item.rewardDiscountPercent`; the
confirmed detail (`SaleDetailItemsList`) MUST forward the same field on the
corresponding confirmed item. The label result MUST be identical between the
two surfaces for the same `(rewardKind, rewardDiscountPercent)` payload. When
`rewardDiscountPercent` is absent (pre-deploy), neither surface MUST throw and
NEITHER MUST fall back to the legacy hardcoded `"GRATIS"`.

#### Scenario: draft cart forwards rewardDiscountPercent on reward line
- GIVEN a draft cart item with `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: 50`
- WHEN `SaleItemRow` renders the item
- THEN `SaleItemBadges` is invoked with `reward-discount-percent="50"`

#### Scenario: confirmed detail forwards rewardDiscountPercent on reward line
- GIVEN a confirmed-sale item with `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: 50`
- WHEN `SaleDetailItemsList` renders the item
- THEN `SaleItemBadges` is invoked with `reward-discount-percent="50"`

#### Scenario: cart and detail render identical labels for the same payload
- GIVEN identical `{ rewardKind: 'buy_x_get_y', rewardDiscountPercent: 50 }` payloads on a draft row and a confirmed-detail row
- WHEN both surfaces render
- THEN the reward badge label is `"-50%"` on BOTH surfaces (parity)

#### Scenario: pre-deploy draft (field absent) does not break the view
- GIVEN a draft cart item with `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent` absent
- WHEN `SaleItemRow` renders the item
- THEN the view renders without throwing
- AND no `GRATIS` and no `-50%` badge is rendered

#### Scenario: pre-deploy confirmed sale (field absent) does not break the view
- GIVEN a confirmed-sale item with `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent` absent
- WHEN `SaleDetailItemsList` renders the item
- THEN the view renders without throwing
- AND no `GRATIS` and no `-50%` badge is rendered
