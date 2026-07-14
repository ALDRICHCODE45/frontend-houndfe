# Tasks: BXGY Promotion Follow-ups (F-1 + F-2)

## Review Workload Forecast

| Slice | Est. changed lines | 400-line budget risk | Files (C/M/D) | Decision needed before apply |
|-------|-------------------:|----------------------|----------------|------------------------------|
| F-1 — eligibility UX | ~180 | Low | **C** `utils/promotion.utils.ts`, `utils/__tests__/promotion.utils.test.ts`; **M** `interfaces/sale.types.ts` (ApplicablePromotion), `components/PromocionesDisponiblesAccordion.vue`, `interfaces/__tests__/sale.types.test.ts`, `components/__tests__/PromocionesDisponiblesAccordion.test.ts`; **D** none | No |
| F-2 — promotionId forward | ~60 | Low | **C** none; **M** `interfaces/sale.types.ts` (SaleDetailItem), `components/SaleDetailItemsList.vue`, `interfaces/__tests__/sale.types.test.ts`, `components/__tests__/SaleDetailItemsList.test.ts`; **D** none | No |
| **Total** | **~240** | **Low** | one PR (`feat/bxgy-promotion-followups` → `main`) | **No** |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| F-1 | Wire backend eligibility + units-needed hint into accordion | PR 1 (solo) | `pnpm test:unit src/features/POS/sales/utils/__tests__/promotion.utils.test.ts src/features/POS/sales/components/__tests__/PromocionesDisponiblesAccordion.test.ts src/features/POS/sales/interfaces/__tests__/sale.types.test.ts` | `pnpm build` (type-check + Vite build) | Revert F-1 commit; remove +5 fields, helper, accordion bindings. F-2 untouched. |
| F-2 | Forward promotionId through confirmed-sale list | PR 1 (same) | `pnpm test:unit src/features/POS/sales/components/__tests__/SaleDetailItemsList.test.ts src/features/POS/sales/interfaces/__tests__/sale.types.test.ts` | `pnpm build` | Revert F-2 commit; remove `:promotion-id` binding + `SaleDetailItem.promotionId`. |

Both slices fit the 400-line budget. Single PR (`single-pr` strategy) confirmed — no chain split needed.

## Phase 1: Slice F-1 — Eligibility UX (commit 1)

### RED — write failing tests first
- [x] 1.1 Baseline: `pnpm test:unit src/features/POS/sales/interfaces/__tests__/sale.types.test.ts src/features/POS/sales/components/__tests__/PromocionesDisponiblesAccordion.test.ts` — capture existing passing count. REQ-4 + REQ-5 + REQ-6.
- [x] 1.2 Append to `interfaces/__tests__/sale.types.test.ts` inside `describe('ApplicablePromotion type', …)` (~L1141-1174): 3 RED type-only cases — fields accept values, `buyQuantity`+`getQuantity` accept null, all 5 omitted type-check. REQ-4.
- [x] 1.3 Create `utils/__tests__/promotion.utils.test.ts` with RED cases — `buildBxgyHint(1)` ⇒ `"…1 unidad más"`; `buildBxgyHint(2)` ⇒ `"…2 unidades más"`; `buildBxgyHint(3)` ⇒ `"…3 unidades más"`. REQ-6.
- [x] 1.4 Append to `components/__tests__/PromocionesDisponiblesAccordion.test.ts`: 4 disable RED cases — `eligible:false` ⇒ Aplicar `disabled`, click no `apply`; `eligible:true` ⇒ enabled, click emits; omit ⇒ enabled (legacy); empty `promotions` + loading variant unaffected. REQ-5.
- [x] 1.5 Append same file: 3 hint RED cases — N=1 singular; N=2 plural; absent/null ⇒ no `promo-hint-${id}` element. REQ-6.
- [x] 1.6 Confirm RED via `pnpm test:unit` for the 3 target files — ONLY new cases fail.

### GREEN — minimum code
- [x] 1.7 In `interfaces/sale.types.ts` `ApplicablePromotion` (L390-394), after `type:` at L393 append: `eligible?: boolean`, `buyQuantity?: number | null`, `getQuantity?: number | null`, `unitsNeeded?: number`, `method?: 'MANUAL'`. REQ-4.
- [x] 1.8 Create `utils/promotion.utils.ts` exporting `buildBxgyHint(unitsNeeded: number): string` exactly per design snippet (singular/plural ternary, `"2x1 ·"` static). REQ-6.
- [x] 1.9 Modify `components/PromocionesDisponiblesAccordion.vue`: (a) `import { buildBxgyHint } from '../../utils/promotion.utils'`; (b) wrap title span at L150-153 in `<div class="flex-1 min-w-0 flex flex-col">` and add `<span v-if="promo.unitsNeeded != null" :data-testid="\`promo-hint-${promo.id}\`" class="text-xs text-muted">{{ buildBxgyHint(promo.unitsNeeded) }}</span>`; (c) on Aplicar `<UButton>` L155-163 add `:disabled="promo.eligible === false"` — STRICT `=== false`, NOT `!eligible` (design drift engram #2838, spec scenario 3 demands undefined stays ENABLED). REQ-5 + REQ-6.
- [x] 1.10 GREEN gate: targeted `pnpm test:unit` for 3 test files all green (old + new).

### REFACTOR + close F-1
- [x] 1.11 Visual tidy (no logic change); rerun targeted tests.
- [x] 1.12 `pnpm build` exits 0 (type-check runs as part of `build` per `package.json`).
- [x] 1.13 Commit `feat(bxgy): surface eligibility + units-needed hint in promotions accordion`. `git diff --stat` against `main` for F-1 ≤ 200 lines.

## Phase 2: Slice F-2 — promotionId Forwarding (commit 2)

### RED — write failing tests first
- [x] 2.1 Baseline: `pnpm test:unit src/features/POS/sales/components/__tests__/SaleDetailItemsList.test.ts src/features/POS/sales/interfaces/__tests__/sale.types.test.ts` — capture existing passing count. REQ-7 + REQ-8.
- [x] 2.2 Append to `interfaces/__tests__/sale.types.test.ts` adjacent to `SaleDetailItem.rewardKind` block (~L1176-1224): 3 RED cases — `promotionId` accepts `'promo-abc'`; accepts null; omittable (legacy). REQ-7.
- [x] 2.3 Append to `components/__tests__/SaleDetailItemsList.test.ts`: 2 RED cases — (a) item `promotionId:'promo-abc'` + `discountTitle:'Black Friday 2x1'` ⇒ `SaleItemBadges` receives `promotion-id="promo-abc"` (`findComponent(props)`), `sale-item-promo-badge` chip visible, no `sale-item-remove-promo`; (b) `promotionId:'promo-abc'` + `discountTitle:''` ⇒ forwarded but no chip. REQ-8.
- [x] 2.4 Confirm RED via `pnpm test:unit` for the 2 target files — ONLY new cases fail.

### GREEN — minimum code
- [x] 2.5 In `interfaces/sale.types.ts` `SaleDetailItem` (L56-80), after `rewardKind?: 'buy_x_get_y' | null` at L79 append `promotionId?: string | null`. REQ-7.
- [x] 2.6 In `components/SaleDetailItemsList.vue` `<SaleItemBadges>` tag (L86-96), add `:promotion-id="item.promotionId"` immediately after `:reward-kind="item.rewardKind"` at L95. REQ-8.
- [x] 2.7 Verify `components/SaleItemBadges.vue` UNTOUCHED in `git status` — design confirms prop L35 + chip gate L82/L114 + remove-gate L132 already cover REQ-8. REQ-8.
- [x] 2.8 GREEN gate: targeted `pnpm test:unit` for 2 test files all green (old + new).

### Gates + close F-2
- [x] 2.9 `pnpm test:unit` (full) — all green.
- [x] 2.10 `pnpm build` exits 0.
- [x] 2.11 Commit `feat(bxgy): forward promotionId to confirmed-sale item badges`. F-2 diff ≤ 80 lines.

## Phase 3: Branch Close

- [x] 3.1 `git diff main...feat/bxgy-promotion-followups --stat` — total ≤ 250 lines.
- [x] 3.2 Push branch, open PR `feat/bxgy-promotion-followups → main` — description references REQ-4..REQ-8 and notes the `!eligible` → `=== false` drift fix per archive plan.
- [x] 3.3 Ready for `sdd-verify` then `sdd-archive` (archive must also reconcile spec REQ-5 wording: literal `:disabled="!eligible"` is wrong; fix to `=== false` per design).
