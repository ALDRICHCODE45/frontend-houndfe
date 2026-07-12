# Apply Progress — variant-level-promotion-targeting

**Change**: variant-level-promotion-targeting
**Branch**: feat/variant-level-promotion-targeting
**Mode**: Strict TDD
**Date**: 2026-07-12

## Status

All 7 phases complete. Slice implemented end-to-end. **REQ-1 second scenario gap corrected in scoped fix** (commit `006bce3`) — VARIANTS is now scoped to PRODUCT_DISCOUNT.

## Commits (6 code commits + 1 gate + 1 scoped fix)

| SHA | Message |
|-----|---------|
| `75b2070` | feat(promotions): add VARIANTS target type |
| `0b40029` | test(promotions): assert VARIANTS payload shape |
| `82ffc8a` | feat(promotions): add ProductVariantSelector |
| `a99a8b0` | feat(promotions): wire VARIANTS branch into target section |
| `71ff445` | feat(promotions): resolve VARIANTS names in edit mode |
| `0e8b973` | feat(promotions): map INVALID_TARGET to targetItems error |
| `006bce3` | **fix(promotions): restrict VARIANTS target type to PRODUCT_DISCOUNT** (scoped correction — REQ-1 second scenario) |

(Phase 7 is the final verification gate — no code change, no commit.)

## TDD Cycle Evidence

| Task | Test File | Layer | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|-----|-------|-------------|----------|
| 1.1 | `usePromotionForm.test.ts` | Unit | ✅ Written (failed) | ✅ Passed | ➖ Single (option-array assertion) | ✅ Clean |
| 2.1 | `usePromotionForm.test.ts` | Unit | ✅ Written | ✅ Passed (toCreatePayload already strips extras) | ✅ 3 cases (shape + JSON-string invariants) | ✅ Clean |
| 3.1–3.3 | `ProductVariantSelector.test.ts` (new) | Unit (mountWithUApp) | ✅ Written (failed — import error) | ✅ Passed | ✅ 8 cases (empty state, filter, getVariants call, add shape, multi-product, remove, dedup, chip label) | ✅ Clean |
| 4.1 | `PromotionTargetItemsSection.test.ts` | Unit | ✅ Written (failed — selector not rendered) | ✅ Passed | ✅ 5 cases (render VARIANTS, not-render on PRODUCTS, switch clears, forward emit, chip label) | ✅ Clean |
| 5.1 | `usePromotionTargetNames.test.ts` | Unit | ✅ Written | ✅ Passed | ✅ 7 cases (resolves, batches, no-productId, mixed, throws, id-not-in-list, idempotent) | ✅ Clean |
| 6.1 | `usePromotionForm.test.ts` | Unit | ✅ Written (failed) | ✅ Passed | ➖ Single (field-error shape assertion) | ✅ Clean |

## Verification

| Check | Result |
|-------|--------|
| `pnpm test:unit` | 2388 passed / 18 failed (after `006bce3`) — same 18 pre-existing failures, **0 new failures** vs baseline of 2385 passed before the fix (+3 new passes from the 3 new tests) |
| `pnpm build` (vue-tsc full project references + vite build) | ✅ green |
| REQ-7 invariant (`git diff main..HEAD -- src/features/POS/sales/`) | ✅ empty — no POS-side discount math touched |
| Line budget (forecast ~350, actual ~910 insertions / 3 deletions but mostly tests, +56/-1 for the scoped fix) | Production code only: ~350 lines + 16 lines for the fix. Test code: ~560 lines + 41 lines for the fix. The scoped fix adds ~56 net lines (well under any chained-PR threshold). |

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `interfaces/promotion.types.ts` | Modified | +11/-1 (add VARIANTS union + optional productId/productName) |
| `composables/usePromotionForm.ts` | Modified | +17 (VARIANTS option + INVALID_TARGET branch) |
| `composables/__tests__/usePromotionForm.test.ts` | Modified | +48 (VARIANTS option test + payload invariant + INVALID_TARGET test) |
| `components/PromotionTargetItemsSection.vue` | Modified | +24/-3 + +15/-1 (VARIANTS radio, selector render, chip label helper, placeholder/typeMap updates, allowVariants prop + computed options) |
| `components/__tests__/PromotionTargetItemsSection.test.ts` | Modified | +104 + +41 (VARIANTS branch tests + REQ-1 second-scenario allowVariants tests) |
| `components/PromotionForm.vue` | Modified | +0 + +1 (`:allow-variants="true"` only on the PRODUCT_DISCOUNT instance) |
| `components/ProductVariantSelector.vue` | **Created** | +219 (two-step product→variant picker, UQuery, chips) |
| `components/__tests__/ProductVariantSelector.test.ts` | **Created** | +300 (8 cases via UApp + QueryClient mount) |
| `composables/usePromotionTargetNames.ts` | Modified | +82 (VARIANTS case + resolveVariants helper + query key) |
| `composables/__tests__/usePromotionTargetNames.test.ts` | Modified | +108 (7 VARIANTS cases) |

## VERIFY-DURING-APPLY result

**PromotionDetailView.vue:120-125**: confirmed `handleMutationError` extracts `error.response?.data.error` and passes it to `mapApiErrorToFields`. Same mechanism that handles `DUPLICATE_TARGET` will handle `INVALID_TARGET` — **no upstream contract drift**.

## Deviations from Design

None — implementation matches design.md decisions:
- ✅ `hasVariants` filter is CLIENT-SIDE on the product list
- ✅ Query keys `['promotions','variants-by-product',productId]` with `staleTime: 60_000`
- ✅ `INVALID_TARGET` mapped via `mapApiErrorToFields` to `path: 'targetItems'` field error
- ✅ Optional `productId` / `productName` on `PromotionTargetItemFormEntry` (session-only)
- ✅ Honest fallback: entries without productId returned unchanged by resolver
- ✅ Container/presentational: `ProductVariantSelector.vue` is a focused child component with single responsibility

## Risks / Notes for Verify Phase

1. **Spec REQ-1 second scenario — RESOLVED** (commit `006bce3`): VARIANTS no longer leaks into BUY_X_GET_Y or ADVANCED instances. The fix introduces an explicit `allowVariants?: boolean` prop on `PromotionTargetItemsSection` (default false). The section computes its radio options from `TARGET_TYPE_OPTIONS` and filters VARIANTS out unless the parent opts in. `PromotionForm.vue` passes `:allow-variants="true"` only on the PRODUCT_DISCOUNT instance; the BUY_X_GET_Y and ADVANCED instances keep the default (false). The global `TARGET_TYPE_OPTIONS` constant is unchanged (still lists all four) so the existing `usePromotionForm.test.ts` assertion that the constant includes VARIANTS still holds; the filtering is per-instance, in the component.

2. **Manual smoke (Phase 7.4) deferred** — no stub backend in this slice.

3. **`productName` falls back to `targetId`** when `name` is empty in the chip label. For VARIANTS loaded fresh from backend (no productName), chips show the variant UUID. This is intentional per design Q(b) "honest fallback" — to be confirmed with verify.

4. **`mountWithUApp` could not `setProps` on inner components** — the new selector tests use a small UApp parent wrapper that owns the items ref so `setProps` works at the parent level. This is documented in the test file header.

## Next Recommended

`sdd-verify`

## Scoped Correction (commit `006bce3`)

**Problem**: Spec REQ-1 second scenario — VARIANTS must NOT render in the target-type radio under BUY_X_GET_Y or ADVANCED promotion types. The main slice added VARIANTS to the global `TARGET_TYPE_OPTIONS`, which the section binds unconditionally to its URadioGroup.

**Approach chosen (option A from the orchestrator brief)**: an explicit boolean prop `allowVariants?: boolean` on `PromotionTargetItemsSection` (default false). A computed `targetTypeOptions` returns `TARGET_TYPE_OPTIONS` when `allowVariants` is true, otherwise filters out VARIANTS. `PromotionForm.vue` passes `:allow-variants="true"` ONLY on the PRODUCT_DISCOUNT instance (line 320). BUY_X_GET_Y (line 425) and ADVANCED (lines 449, 483) instances are untouched and default to false.

**Why this over option B (helper `getTargetTypeOptions(promotionType)`)**: the boolean is the smallest, most explicit, and keeps the section decoupled from `PromotionType` semantics. The default `false` makes BUY_X_GET_Y / ADVANCED correct without any change to those call sites — a single point of truth for "where is VARIANTS allowed".

**TDD evidence**:

| Phase | Result |
|-------|--------|
| RED (before fix) | 2 of 3 new tests failed: "no VARIANTS when allowVariants omitted" + "no VARIANTS when allowVariants=false"; 1 passed trivially ("VARIANTS when allowVariants=true" — leaked because the bug let it through) |
| GREEN (after fix) | All 3 new tests passed; all 15 pre-existing tests still passed |
| Refactor | None needed — the compute is one line, the prop default is the smallest correct value |

**Verification**:

| Check | Before fix | After fix |
|-------|------------|-----------|
| `pnpm test:unit PromotionTargetItemsSection` | 15/15 passed (gap not covered) | 18/18 passed (3 new RED tests) |
| `pnpm test:unit` (full suite) | 2385 passed / 18 failed | 2388 passed / 18 failed — same 18 pre-existing failures, 0 new failures |
| `pnpm build` | ✅ green | ✅ green |
