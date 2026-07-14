# Proposal: BXGY Promotion Follow-ups (F-1 + F-2)

## Intent

Two surgical, frontend-only follow-ups to the merged `buy-x-get-y-promotion` work. Backend
contracts already shipped; the UI is not yet consuming them. Goal: align the frontend so
cashiers see (a) why a BXGY promo is or isn't applicable, and (b) which promo drove a
confirmed sale line. Alignment change, not a rebuild.

## Motivation

Today, every applicable promo row in `PromocionesDisponiblesAccordion.vue` exposes an
unconditional "Aplicar" button — even BXGY promos that can't fire yet because the cart
doesn't have enough units. Cashiers click, the request fails, frustration. Separately,
confirmed-sale lines (`SaleDetailItemsList.vue`) never show the promotion that produced
their `discountTitle`, so post-sale traceability is opaque. Both gaps are one type
extension + one template binding each.

## Scope

### SLICE 1 — F-1: eligibility UX in PromocionesDisponiblesAccordion

Extend `ApplicablePromotion` (`src/features/POS/sales/interfaces/sale.types.ts:390`)
with **5 OPTIONAL** fields: `eligible?: boolean`, `buyQuantity?: number | null`,
`getQuantity?: number | null`, `unitsNeeded?: number`, `method?: 'MANUAL'`. Optional +
nullable to preserve backward compat with every existing fixture (see Risks).

Wire the accordion (`PromocionesDisponiblesAccordion.vue:155-163`):
- Bind `:disabled="!eligible"` on the Aplicar `UButton`.
- Render a dynamic Spanish hint `2x1 · requiere N unidad(es) más` when `unitsNeeded`
  is present, under the title. New stable testid: `promo-hint-${id}`.
- Genericity: gate on the `eligible` field itself, not on `type === 'BUY_X_GET_Y'`. Any
  future promo type the backend marks ineligible will disable cleanly. The
  `unitsNeeded` hint only renders when that datum is present (BXGY provides it).

### SLICE 2 — F-2: promotion id on confirmed sale line

Add `promotionId?: string | null` to `SaleDetailItem`
(`src/features/POS/sales/interfaces/sale.types.ts:56`). Forward it from
`SaleDetailItemsList.vue:86-96` via `:promotion-id="item.promotionId"`. No change to
`SaleItemBadges.vue` — its existing chip gate (`hasPromotion`, line 82) and the
`discountTitle` chip render rule already do the right thing.

## Accepted Decisions (from user question round)

1. Hint copy = `"2x1 · requiere N unidad(es) más"`, with correct singular/plural on N.
2. Aplicar button DISABLED when `!eligible`.
3. Gate is GENERIC on `eligible` field (not BXGY-specific). `unitsNeeded` hint renders
   only when present; types that don't carry it just disable without hint.
4. NO auto-bump of cart quantity (explicitly rejected). Promo stays visible, apply disabled.
5. F-2 chip renders only when `discountTitle` has text. Empty `discountTitle` even with
   `promotionId` → no chip (matches existing `SaleItemBadges` gate).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `sales`: extend `ApplicablePromotion` with eligibility fields, extend `SaleDetailItem`
  with `promotionId?`, update accordion + detail-list rendering rules.

## Approach

Type-only delta + 2 template bindings. API/composable already pure-passthrough
(`sale.api.ts:229-234` returns `data` verbatim), so new fields flow automatically — no
composable/API edits. RED-first Vitest suites already exist for all four surfaces.

## Affected Areas

| Area | Impact | Notes |
|---|---|---|
| `src/features/POS/sales/interfaces/sale.types.ts` | Modified | L390 `ApplicablePromotion` +5 fields; L56 `SaleDetailItem` +1 field |
| `src/features/POS/sales/components/PromocionesDisponiblesAccordion.vue` | Modified | Hint + `:disabled` on Aplicar; new `promo-hint-${id}` testid |
| `src/features/POS/sales/components/SaleDetailItemsList.vue` | Modified | L86-96 forward `:promotion-id` |
| `__tests__/sale.types.test.ts`, `PromocionesDisponiblesAccordion.test.ts`, `SaleDetailItemsList.test.ts` | Modified | RED-first coverage per explore §"RED-First Test Surfaces" |
| `SaleItemBadges.vue`, `sale.api.ts`, `useApplicablePromotions.ts`, `ActiveSalePanel.vue` | None | Already correct; do not touch |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| New `ApplicablePromotion` fields made REQUIRED would break 5+ test fixtures and the repo's optional+nullable convention | Med | Decision (this proposal): all 5 fields optional (`?`); numeric pair nullable. Mirrors `SaleDetailItem.rewardKind` precedent. |
| Wrong singular/plural in hint copy | Low | Template uses computed helper; covered by Vitest with N=1 and N=2 cases. |
| Generic `eligible` gate leaks BXGY-specific phrasing to non-BXGY promos | Low | Hint gated on `unitsNeeded != null`; only BXGY emits it today. |

## Out of Scope / Non-Goals

- Auto-bumping cart quantity to satisfy `unitsNeeded`.
- Rewriting `SaleItemBadges.vue` or any other component.
- Backend work (contracts already shipped).
- E2E / Playwright (slice is pure type+template; covered by component + type tests).

## Rollback Plan

Revert the 3 source edits and the test additions. No data migration, no API contract
change — every new field is additive and optional. Existing promotions keep rendering
identically because all new fields default to `undefined`.

## Success Criteria

- [ ] `pnpm test` green: type tests cover 5 new `ApplicablePromotion` fields + `SaleDetailItem.promotionId`; component tests cover disabled-Aplicar, hint copy (singular + plural), and forwarded `promotion-id` chip on confirmed line.
- [ ] No change to non-BXGY promo rendering (regression-safe).
- [ ] `vue-tsc` clean.
