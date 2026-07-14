# Proposal: bxgy-reward-badge-label

## Intent

Replace the POS BXGY reward badge hardcoded GRATIS with a percent-aware label driven by the backend new rewardDiscountPercent field, so partial-discount rewards (Segundo al 50%) stop rendering the contradictory GRATIS chip alongside DESCUENTO.

## Motivation

SaleItemBadges.vue L157-163 hardcodes label=GRATIS behind rewardKind === buy_x_get_y. It lies on any non-free preset. Client-side inference from discountAmountCents / unitPriceCents is provably ambiguous (multi-group collision, unknown reward-unit count, combined discounts, rounding) — see explore.md Q1.

Backend has JUST SHIPPED (in main, deploys next push) an additive optional persisted field on the reward line: rewardDiscountPercent: number | null (0..100; 100=free, 50=half-price; null on non-reward lines). Appears on BOTH surfaces: SaleItem (draft cart, GET /sales/drafts + every draft mutation) and SaleDetailItem (confirmed detail, GET /sales/:id). Optional + nullable, mirroring the rewardKind precedent for pre-deploy backward compat.

## Scope (frontend-only; backend done)

**In scope** — Add rewardDiscountPercent?: number | null to SaleItem + SaleDetailItem in sale.types.ts (mirror rewardKind shape exactly so the two surfaces never drift). Replace hardcoded GRATIS in SaleItemBadges.vue with a computed reward-label from rewardKind + rewardDiscountPercent; badge renders only when label non-null. Pure helper (Extract-Before-Mock). Forward :reward-discount-percent from SaleItemRow.vue + SaleDetailItemsList.vue. Extend existing reward-badge tests for the four cases (null / 100 / partial / null-but-rewardKind).

**Out of scope / Non-goals** — Backend (done). Visual: tone (success), color, icon (i-lucide-gift), testid (sale-item-reward-badge) unchanged. DESCUENTO badge unchanged. The 18 unrelated pre-existing test failures (do not touch). New i18n keys, design tokens, testids.

## Accepted Decisions (verbatim)

1. **Label logic** (pure, unit-testable):
   - rewardKind !== 'buy_x_get_y' → NO reward badge.
   - rewardDiscountPercent === 100 → "GRATIS".
   - rewardDiscountPercent != null && !== 100 → "-${pct}%" (e.g. "-50%").
   - rewardDiscountPercent == null BUT rewardKind === 'buy_x_get_y' (pre-deploy drafts + legacy confirmed sales) → NO reward badge. Never assume free. Never show GRATIS defensively.
2. **Same visual style** for both GRATIS and partial: keep the existing green success AppBadge + i-lucide-gift gift icon. ONLY the text changes.
3. **Parity**: identical behavior in the live cart (SaleItemRow → SaleItemBadges) and the confirmed-sale detail (SaleDetailItemsList → SaleItemBadges). Null-guarded so pre-deploy does not break (falls back to no-badge, not to old GRATIS).

## Capabilities

### Modified
- sales: SaleItemBadges reward-badge label rule becomes percent-aware; SaleItem + SaleDetailItem accept rewardDiscountPercent?: number | null.

### New
None.

## Affected Areas

- sale.types.ts:79,304 — add field (mirrored).
- SaleItemBadges.vue — replace hardcoded label with helper output; gate badge on it.
- SaleItemRow.vue:218 + SaleDetailItemsList.vue:95 — forward :reward-discount-percent.
- SaleItemBadges.test.ts — extend reward-badge cases.
- sale.types.test.ts — parsing + backward-compat for both interfaces.

## Risks

- Null/legacy fallback regresses to old GRATIS on pre-deploy data (Med): Decision 1.4 explicit; helper returns null; test asserts no-badge.
- Drift between SaleItem and SaleDetailItem field shape (Med): single-file mirror change; tests cover both.
- Stale confirmed-sale fixtures show old GRATIS one deploy before backend propagates (Low): defensive fallback is no-badge (matches missing-data). Brief UX gap, accepted.
- Sales/promotions domains grow implicit coupling (Low): field stays in sales types only; no cross-domain import.

## Rollback

Revert the three type additions + helper + two forwarding lines. Hardcoded GRATIS returns immediately. No backend rollback (field optional + additive). No data migration.

## Dependencies

rewardDiscountPercent must be live in QA. Local testing against pre-deploy backend renders null+rewardKind (no badge) — by design.

## Success Criteria

- SaleItem + SaleDetailItem accept rewardDiscountPercent?: number | null; pre-deploy fixtures type-check.
- Badge renders GRATIS only when rewardKind === buy_x_get_y AND rewardDiscountPercent === 100.
- Badge renders -50% style label when rewardKind === buy_x_get_y AND rewardDiscountPercent is a non-100 number.
- Badge renders nothing when rewardKind is null/absent OR rewardKind === buy_x_get_y but rewardDiscountPercent is null.
- Same behavior on SaleItemRow (cart) and SaleDetailItemsList (detail).
- Tone, icon, testid unchanged.
- Existing 18 unrelated test failures unchanged.