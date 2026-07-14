# Proposal: BUY_X_GET_Y promotion frontend alignment

## Intent

The POS backend now evaluates `BUY_X_GET_Y` (BXGY) promotions live. The 2026-04 frontend BXGY form was authored speculatively against an assumed contract and the `getDiscountPercent` semantics drifted. Today every "2x1 / lleva gratis" promo serializes `getDiscountPercent: 0`, the engine applies 0% off, and the customer receives nothing. This proposal realigns the frontend to the live contract — not a rebuild, surgical edits only.

## Motivation

- **CRITICAL — flagship case broken.** `getDiscountPercent` = % off on "get" units; `100` = free. Frontend rejects 100 (Zod bound `0..99`), max option is 95, presets ship 0. Form cannot express "free". Live impact: every "2x1" charges full price.
- **No reward signal on the sale line.** Backend returns `rewardKind: 'buy_x_get_y' | null` per line and `type: 'BUY_X_GET_Y'` in `applicable-promotions`. Frontend unions miss both; cashier sees no GRATIS badge.
- **Validation gaps.** BXGY schema does not guard `appliesTo` / empty `targetItems` (→ `400 INVALID_TARGET`). `mapApiErrorToFields` does not recognize `FORBIDDEN_FIELD` / `INVALID_FIELD_CHANGE`; `DUPLICATE_TARGET` matched uppercase only (casing unverified).

## Scope

### In Scope
- **Discount semantics.** BXGY Zod range `0..100` (accept 100); ADVANCED branch untouched at `0..99`. `DISCOUNT_PERCENT_OPTIONS` exposes 100 labeled "Gratis". Locked preset table: `2x1` → buy 1 / get 1 / 100; `3x2` → buy 2 / get 1 / 100; "Segundo al 50%" → buy 1 / get 1 / 50.
- **Type/contract additions.** `ApplicablePromotion.type` gains `'BUY_X_GET_Y'`. `SaleDetailItem` gains `rewardKind?: 'buy_x_get_y' | null`.
- **Reward badge.** `SaleItemBadges` / `SaleDetailItemsList` render GRATIS badge when `rewardKind === 'buy_x_get_y'`. `line.subtotalCents` stays NET — no math change.
- **Validation hardening.** BXGY schema guard: `appliesTo` present + ≥1 `targetItems`. `mapApiErrorToFields`: add `FORBIDDEN_FIELD`, `INVALID_FIELD_CHANGE`; case-insensitive code matching.
- **VARIANTS for BXGY.** Pass `:allow-variants="true"` on the BXGY `PromotionTargetItemsSection` (parity with PRODUCT_DISCOUNT card and backend).

### Out of Scope
- ADVANCED promotion type (disabled; `0..99` bound preserved).
- The opt-in flow in sales (built + tested; only the type union addition touches it).
- Any backend change or new round-trip. Frontend-only alignment.
- POS sale-line "applied promo precedence" UI (not requested).

## Approach

Payload builder (`toCreatePayload` / `toUpdatePayload` BXGY branch) already sends `getDiscountPercent` raw and omits forbidden fields — no serialization change. Only edit Zod bound, `DISCOUNT_PERCENT_OPTIONS`, presets, unions, badge prop, schema guards, error mapper, and one prop on the BXGY card. Existing TDD spec files updated RED-first per project strict-TDD rules.

## Affected Areas

| Area | Impact | Evidence |
|------|--------|----------|
| `src/features/POS/promotions/interfaces/promotion.schema.ts` | Modified (BXGY bound `0..100`; new `appliesTo`/`targetItems` guard) | `:181-186`, `:146-188` |
| `src/features/POS/promotions/composables/usePromotionForm.ts` | Modified (corrected presets; `DISCOUNT_PERCENT_OPTIONS` includes 100; new error mappings) | `:60-64`, `:22-28`, `:336-425` |
| `src/features/POS/promotions/components/PromotionForm.vue` | Modified (BXGY select includes 100; `:allow-variants` on BXGY card) | `:411-419`, `:426-432` |
| `src/features/POS/sales/interfaces/sale.types.ts` | Modified (union + `rewardKind` field) | `:377`, `:56-75` |
| `src/features/POS/sales/components/SaleItemBadges.vue` | Modified (reward/GRATIS badge) | `:64-145` |
| `src/features/POS/sales/components/SaleDetailItemsList.vue` | Modified (passes `rewardKind`) | `:86-95` |

## Capabilities

### New Capabilities
- `sales`: POS sale-detail line reward badge (`rewardKind === 'buy_x_get_y'` → GRATIS badge); union widening for `ApplicablePromotion.type`; field addition for `SaleDetailItem.rewardKind`.

### Modified Capabilities
- `promotions`: amend REQ-1 to allow `VARIANTS` for BXGY in addition to PRODUCT_DISCOUNT (backend parity); new requirements for BXGY discount bound (`0..100`), locked preset table, schema guards, error mappings (`FORBIDDEN_FIELD`, `INVALID_FIELD_CHANGE`, case-insensitive `duplicate_target`).

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing `duplicate_target` casing mismatch | Low | Case-insensitive matching covers both casings; confirm backend casing during `sdd-verify` |
| Regression on ADVANCED form | Low | Test pins ADVANCED bound at `0..99`; `DISCOUNT_PERCENT_OPTIONS` is label-only, not bound |
| Promotions REQ-1 contradiction (currently forbids VARIANTS for BXGY) | Med | Delta `MODIFIED` for REQ-1 in `promotions`; superseded requirement made explicit |
| Spanish copy drift | Low | Reuse existing strings; new copy in neutral Spanish, identifiers English |

## Rollback Plan

Revert the branch (`git revert` per work-unit commit or `git reset` to the pre-change merge base). No backend coupling, no migrations, no feature flags. Reverted state returns to the (broken) pre-alignment BXGY form; live engine behavior is unchanged.

## Success Criteria

- [ ] RED-first: 6 existing spec files (see exploration §"Strict-TDD Implications") updated GREEN; new cases cover `getDiscountPercent: 100`, locked presets, `rewardKind`, error mappings, `VARIANTS`-for-BXGY.
- [ ] `pnpm test:unit` and `pnpm build` pass.
- [ ] Manual: `2x1` BXGY submission emits `getDiscountPercent: 100`; applicable sale line shows GRATIS badge.
- [ ] Branch `feat/buy-x-get-y-promotion` merged to `main` with work-unit commits under 400 changed lines/slice.

## Dependencies

None. Backend contract is already live; this is frontend-only alignment.
