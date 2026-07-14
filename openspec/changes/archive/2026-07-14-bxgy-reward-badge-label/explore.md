# Exploration: bxgy-reward-badge-label

Diagnostic exploration (no code changes). Goal: determine whether the hardcoded
"GRATIS" reward badge can be corrected to distinguish a truly-free BXGY reward
(`getDiscountPercent === 100`) from a partial-discount reward ("2do al 50%",
`getDiscountPercent === 50`) — and whether that fix is frontend-only or needs
backend coordination.

## Current State

The reward badge is rendered in `SaleItemBadges.vue` and is driven by a single
boolean-ish flag `rewardKind`:

- `src/features/POS/sales/components/SaleItemBadges.vue:84` —
  `const isReward = computed(() => props.rewardKind === 'buy_x_get_y')`
- `src/features/POS/sales/components/SaleItemBadges.vue:157-163` —
  `<AppBadge v-if="isReward" ... label="GRATIS" data-testid="sale-item-reward-badge">`

The label string `"GRATIS"` is HARDCODED. It renders for ANY BXGY reward line,
regardless of the reward's actual discount percentage.

`rewardKind` is forwarded to the badge from both surfaces:
- Draft cart: `SaleItemRow.vue:218` → `:reward-kind="item.rewardKind"`
- Confirmed detail: `SaleDetailItemsList.vue:95` → `:reward-kind="item.rewardKind"`

The reward line ALSO carries a line-level discount, so the live UI renders BOTH
`DESCUENTO -$350.00` and `GRATIS` on the same consolidated line — contradictory.
The discount badge uses `discountAmountCents` / `discountValue`
(`SaleItemBadges.vue:72-80`).

## Q1 — What data does the sale line already carry to distinguish free vs partial?

Full field set on `SaleItem` (`sale.types.ts:273-305`) and `SaleDetailItem`
(`sale.types.ts:56-85`) relevant to inference:

| Field | SaleItem | SaleDetailItem | Carries reward % ? |
|-------|----------|----------------|--------------------|
| `unitPriceCents` | L280 | L60 | no (unit price) |
| `quantity` | L279 | L61 | no (consolidated qty) |
| `discountType` `'amount'\|'percentage'` | L286 | L70 | no |
| `discountValue` | L287 | L71 | no — LINE discount input, not `getDiscountPercent` |
| `discountAmountCents` | L288 | L72 | no — LINE cents off |
| `discountTitle` | L289 | L73 | no (promo title string) |
| `prePriceCentsBeforeDiscount` | L290 | L74 | no |
| `subtotalCents` (NET) | L299 | `subtotalCents` L63 | no |
| `promotionId` | L293 | L84 | no (promo id only) |
| `rewardKind` | L304 | L79 | no — boolean flag only |

Note: `SaleDetailItem` uses `discountCents` (L62, required) plus optional
`discountAmountCents` (L72); `SaleItem` uses `discountAmountCents`.

### Inference attempt and why it is FRAGILE

The only candidate signal is the ratio
`r = discountAmountCents / unitPriceCents` = "units-worth of discount on the line".

Live evidence: unit $700 (`70000`), qty 3, discount -$350 (`35000`), net $1,750.
→ `r = 35000 / 70000 = 0.5` → one half-price unit → "2do al 50%" (partial).
A true 3x2 on the same line would be `r = 70000 / 70000 = 1.0` (one full unit off).

Proposed rule "free iff `r` is a whole number" BREAKS in real cases:

1. **Multi-group collision (decisive).** Two groups of "2do al 50%" (qty 6, two
   reward units at 50%) → discount = `2 × 0.5 = 1.0` full unit → `r = 1.0`,
   an integer → MISclassified as free. `r` cannot tell "one free unit" from
   "two half-price units".
2. **Unknown reward-unit count.** The line is consolidated; nothing on it tells
   us how many reward units it contains, so we cannot normalize `r` by reward
   units to recover the per-unit percent.
3. **Combined discounts.** If a manual free-form discount or an order/product
   promo also touches the line, `discountAmountCents` blends sources and `r`
   becomes meaningless.
4. **Rounding.** 50% of an odd-cent unit price rounds at the backend; `r` is not
   guaranteed clean (e.g. `12999 → 6500/6499`), defeating an equality test.
5. **`discountValue` is the wrong number.** Even when `discountType==='percentage'`,
   `discountValue` is the LINE-level percent (`350/2100 ≈ 16.67%`), NOT the
   reward's `getDiscountPercent` (50). It never exposes the reward percentage.

Conclusion: **No reliable client-side inference exists.** The one clean signal
(`getDiscountPercent`) is a property of the PROMOTION definition, not of the
sale line, and is never propagated to the line.

## Q2 — Does any field expose `getDiscountPercent` / reward value to the sale line today?

No.

- `getDiscountPercent` exists ONLY in the `promotions` feature (promotion
  definition + form): `promotions/interfaces/promotion.types.ts:90,148,157,199`,
  `promotions/interfaces/promotion.schema.ts:33`,
  `promotions/composables/usePromotionForm.ts:79-81` (presets: 2x1→100, 3x2→100,
  "Segundo al 50%"→50). It is NOT imported or referenced anywhere under
  `features/POS/sales/`.
- API mapping is a PURE PASSTHROUGH — `sale.api.ts` deserializes the backend JSON
  directly into `Sale` / `SaleDetail` with NO mapper/composable enrichment
  (`getById` L193-196, `addItem` L56-59, etc.). So the frontend line fields are
  exactly what the backend sends. The backend, per current types, sends on a
  BXGY reward line: `rewardKind: 'buy_x_get_y'` plus the standard discount fields
  (`discountType`, `discountValue`, `discountAmountCents`/`discountCents`,
  `prePriceCentsBeforeDiscount`, `subtotalCents`) — but NO reward-percentage or
  reward-is-free field.

## Q3 — Fix options and tradeoffs

### (a) Pure client-side inference from existing fields
- Fields: `discountAmountCents`, `unitPriceCents` (+ `quantity`).
- Rule: `rewardIsFree = discountAmountCents === k × unitPriceCents` for integer k.
- Failure modes: multi-group collision (case 1), unknown reward-unit count
  (case 2), combined discounts (case 3), rounding (case 4). **Not reliable.**
- Verdict: reject as the correctness mechanism. At best a fragile heuristic.

### (b) New backend field (RECOMMENDED contract)
Minimal additive, backward-compatible contract on the reward line
(both draft `SaleItem` and confirmed `SaleDetailItem`):

- Preferred: `rewardDiscountPercent?: number | null` — the reward's
  `getDiscountPercent` (0..100). Frontend renders `GRATIS` iff `=== 100`,
  otherwise a percent-aware label.
- Or simplest: `rewardIsFree?: boolean | null` — pre-computed by the backend
  (which already knows `getDiscountPercent`). Frontend just switches the label.

`rewardDiscountPercent` is strictly more expressive (enables a "2do -50%" label);
`rewardIsFree` is the smallest change if only GRATIS-suppression is wanted.
Both must be optional + nullable to keep pre-deploy payloads parsing (same
pattern already used for `rewardKind`, `subtotalCents`).

### (c) Label strategy (UX)
Recommended: **`GRATIS` only when the reward is 100%; otherwise show a
percent-aware reward badge (e.g. "2do -50%") and rely on the existing DESCUENTO
badge for the amount.** Rationale:
- "GRATIS" on a line that also shows `DESCUENTO -$350` is actively misleading —
  it claims free while charging half. Suppressing/replacing it removes the
  contradiction.
- A percent label communicates the promo semantics ("second at 50%") that the
  amount badge alone does not.
- This requires option (b)'s field to know the percent. Without it, the only
  safe frontend-only move is to SUPPRESS "GRATIS" whenever a line-level discount
  amount is also present (defensive), but that is a blunt mitigation, not a
  correct label, and still cannot render the true percent.

## Q4 — Fix surfaces + RED-first test surfaces

Frontend fix surfaces (files + lines a future change would touch):
- `src/features/POS/sales/components/SaleItemBadges.vue:37` — add reward-percent
  prop to `defineProps`.
- `src/features/POS/sales/components/SaleItemBadges.vue:84` — reward derivation.
- `src/features/POS/sales/components/SaleItemBadges.vue:157-163` — label logic.
- `src/features/POS/sales/interfaces/sale.types.ts:79` (`SaleDetailItem`) and
  `:304` (`SaleItem`) — add the new optional reward field.
- `src/features/POS/sales/components/SaleItemRow.vue:218` — forward new prop.
- `src/features/POS/sales/components/SaleDetailItemsList.vue:95` — forward new prop.

RED-first test surfaces:
- `components/__tests__/SaleItemBadges.test.ts:152-189` — reward badge cases
  (extend: 100 → GRATIS, 50 → percent/suppressed).
- `components/__tests__/SaleItemRow.test.ts:461-649` — reward forwarding cases.
- `components/__tests__/SaleDetailItemsList.test.ts:274-345` — reward forwarding.
- `interfaces/__tests__/sale.types.test.ts:1017-1073` (SaleItem) and
  `:1231-1277` (SaleDetailItem) — new optional field parsing + backward compat.

## Q5 — Verdict: frontend-only vs needs backend

**NEEDS BACKEND COORDINATION.** Decisive because:
1. The clean discriminator (`getDiscountPercent`) lives only in the promotions
   domain and is never propagated to the sale line (Q2).
2. The API layer is a pure passthrough with no place to enrich the line (Q2).
3. Client-side inference from `discountAmountCents / unitPriceCents` is provably
   ambiguous on the consolidated, multi-group, combined-discount, and rounding
   cases (Q1). A correct label is impossible without the reward percentage.

Frontend-only interim mitigation is possible ONLY as a blunt correctness patch
(suppress "GRATIS" when a line-level discount amount coexists), which removes the
contradiction but cannot show the true "2do -50%" semantics. The proper fix is
additive backend field `rewardDiscountPercent` (preferred) or `rewardIsFree`,
after which the frontend change is small and testable.

## Ready for Proposal
Yes — but gate the proposal on the backend adding `rewardDiscountPercent`
(or `rewardIsFree`) to the reward line. Ask the backend owner to confirm that
contract before writing the spec; the frontend delta is otherwise trivial.
