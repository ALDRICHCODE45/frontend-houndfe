# Verify Report: buy-x-get-y-promotion

- **Change**: `buy-x-get-y-promotion`
- **Branch**: `feat/buy-x-get-y-promotion` (c7084e7 Slice A, 29ee0a8 Slice B, 65ea189 Slice C, 01f9785 Slice D)
- **Mode**: Strict TDD — runner `pnpm test:unit`, authoritative gate `pnpm build`
- **Scope**: RE-VERIFICATION after Slice D (draft cart line NET + reward badge + strikethrough fix). Full implementation re-validated independently; gates re-run.
- **Verdict**: **PASS WITH WARNINGS**
- **Date**: 2026-07-14

---

## Gate Results

| Gate | Command | Result |
|------|---------|--------|
| Type-check + bundle | `pnpm build` (vue-tsc --build + vite build) | ✅ **exit 0** — built in 13.80s, no type errors |
| Unit suite | `pnpm test:unit --run` | ⚠️ **exit 1** — 2503 passed / 18 failed (5 files), all 18 in the KNOWN pre-existing baseline; ZERO change-attributable |

### Test suite breakdown
- Test Files: 194 passed / 5 failed (199 total)
- Tests: **2503 passed / 18 failed** (2521 total)
- Baseline before this change: 18 failures. Delta introduced by A+B+C+D: **0**.

### The 18 baseline failures (all unrelated to this change)
| File | Area | Touches change files? |
|------|------|-----------------------|
| `src/features/auth/stores/__tests__/useAuthStore.spec.ts` | auth | No |
| `src/features/POS/promotions/composables/__tests__/usePromotionColumns.test.ts` | promotion-columns | No |
| `src/features/POS/sales/components/__tests__/DebtPaymentModal.test.ts` | debt | No |
| `src/features/POS/sales/composables/__tests__/useDebtPayment.test.ts` | debt | No |
| `src/features/POS/sales/components/__tests__/SaleDetailMetadataCard.spec.ts` | sale-metadata | No |

None of these five files is a change artifact. Failure causes are pre-existing (slideover-stub `data-testid` resolution, relative-date formatting) and were recorded as baseline in apply-progress obs #2817. No failure touches `promotion.schema.ts`, `usePromotionForm.ts`, `PromotionForm.vue`, `sale.types.ts`, `SaleItemBadges.vue`, `SaleDetailItemsList.vue`, or `SaleItemRow.vue`.

### The 8 change-affected specs (all GREEN)
| Spec file | Tests | Result |
|-----------|------:|--------|
| `promotion.schema.test.ts` | 38 | ✅ |
| `usePromotionForm.test.ts` | 88 | ✅ |
| `PromotionForm.test.ts` | 29 | ✅ |
| `sale.types.test.ts` | 68 | ✅ |
| `SaleItemBadges.test.ts` | 12 | ✅ |
| `SaleDetailItemsList.test.ts` | 13 | ✅ |
| `SaleItemRow.test.ts` | 28 | ✅ |

---

## Requirements Coverage — 9/9 PASS

### Prior requirements (regression — must still hold)

| Req | Verdict | Code evidence | Test evidence |
|-----|---------|---------------|---------------|
| **REQ-8** BXGY getDiscountPercent 0..100, Gratis→100 | ✅ PASS | `promotion.schema.ts:213` bound `< 0 || > 100`, msg `'…entre 0 y 100 (100 = gratis)'`; `usePromotionForm.ts:69-75` `DISCOUNT_PERCENT_OPTIONS` = 19 stepped + `{label:'Gratis',value:100}`, no `value:0` | `promotion.schema.test.ts:178` accepts 100; `:183` rejects 101; `usePromotionForm.test.ts:161` has 100→Gratis, `:167` no value:0, `:180` length 20 |
| **REQ-9** ADVANCED still rejects 100 (0..99) | ✅ PASS | `promotion.schema.ts:258` ADVANCED branch bound `< 0 || > 99`, untouched | `promotion.schema.test.ts:322` REGRESSION: ADVANCED still rejects 100 |
| **REQ-10** locked presets 2x1/3x2/Segundo | ✅ PASS | `usePromotionForm.ts:78-82` `BUY_X_GET_Y_PRESETS` = 1/1/100, 2/1/100, 1/1/50 | `usePromotionForm.test.ts:124,132,140` per-preset locks; `:148` exactly three presets |
| **REQ-11** BXGY target guard (appliesTo + ≥1 matching target) | ✅ PASS | `promotion.schema.ts:10` `BXGY_ALLOWED_APPLIES_TO`, `:163` appliesTo guard, `:171` empty targetItems guard; scoped to BXGY branch only | `promotion.schema.test.ts:221,231,244` negatives; `:254,264,274` accepts PRODUCTS/VARIANTS/BRANDS |
| **REQ-12** error mapping case-insensitive + FORBIDDEN/INVALID_FIELD_CHANGE | ✅ PASS | `usePromotionForm.ts:359` `.toUpperCase()` canonicalize; `:438` FORBIDDEN_FIELD toast; `:448` INVALID_FIELD_CHANGE toast | `usePromotionForm.test.ts:1187` lowercase duplicate_target parity; `:1197` FORBIDDEN_FIELD; `:1205` INVALID_FIELD_CHANGE |
| **REQ-1 MODIFIED** (promotions) VARIANTS for PRODUCT_DISCOUNT + BXGY, not ADVANCED | ✅ PASS | `PromotionForm.vue:316` PRODUCT_DISCOUNT card `:allow-variants="true"`, `:422` BXGY card `:allow-variants="true"`; `usePromotionForm.ts:53-58` TARGET_TYPE_OPTIONS includes VARIANTS | `PromotionForm.test.ts:276` BXGY passes allow-variants=true; `:283` PRODUCT_DISCOUNT parity |
| **Sales REQ-1** ApplicablePromotion.type includes BUY_X_GET_Y | ✅ PASS | `sale.types.ts:393` union `… | 'BUY_X_GET_Y'` | `sale.types.test.ts` (68 pass) union-acceptance case |
| **Sales REQ-2** confirmed SaleDetailItem rewardKind→GRATIS, NET verbatim | ✅ PASS | `sale.types.ts:79` `rewardKind?`; `SaleItemBadges.vue:84` isReward, `:157-163` GRATIS AppBadge; `SaleDetailItemsList.vue:95` `:reward-kind` forwarded | `SaleItemBadges.test.ts:154` GRATIS on buy_x_get_y, `:168/:181` absent on null/omitted; `SaleDetailItemsList.test.ts` (13 pass) forwarding |

### NEW — Slice D (Sales REQ-3)

| Req | Verdict | Code evidence | Test evidence |
|-----|---------|---------------|---------------|
| **Sales REQ-3** draft SaleItem carries `subtotalCents?` + `rewardKind?` | ✅ PASS | `sale.types.ts:294` `subtotalCents?: number \| null`, `:299` `rewardKind?: 'buy_x_get_y' \| null` (optional + nullable, pre-deploy compat) | `sale.types.test.ts` (68 pass) 3 REQ-3 cases |
| REQ-3 bold line = `subtotalCents ?? grossLine` | ✅ PASS | `SaleItemRow.vue:124-130` `lineDisplay` (grossPerUnit/grossLine/netLine); `:242` bold uses `lineDisplay.netLine`, testid `sale-item-line-net` | see canonical scenarios below |
| REQ-3 struck gross only when `net < gross` | ✅ PASS | `SaleItemRow.vue:128` `showStruckGross = netLine < grossLine`; `:244-250` struck rendered only under `v-if`, testid `sale-item-line-gross-strike` | canonical scenarios below |
| REQ-3 unit-price strikethrough only when unit actually dropped | ✅ PASS | `SaleItemRow.vue:104-115` `showPriceOrigin` requires `originalPriceCents > unitPriceCents`; `showDiscountOrigin` requires `prePriceCentsBeforeDiscount > unitPriceCents` (`>` not presence). BXGY (unit === prePrice) ⇒ both false | canonical scenarios below |
| REQ-3 `:reward-kind` forwarded to SaleItemBadges | ✅ PASS | `SaleItemRow.vue:218` `:reward-kind="item.rewardKind"` | `SaleItemRow.test.ts:468` GRATIS badge present on BXGY line |

#### Slice D canonical scenarios (SaleItemRow.test.ts)
| Scenario | Expected | Test | Result |
|----------|----------|------|--------|
| BXGY line | NET $200, struck $400, NO unit-strike, GRATIS badge | `:468` | ✅ |
| Cashier discount | NET $80, struck $96, unit-strike present, no GRATIS | `:526` | ✅ |
| No-discount | NET $100, no struck line, no unit-strike | `:578` | ✅ |
| Pre-deploy fallback | gross renders when `subtotalCents` missing | `:616` | ✅ |

#### Regression — payload builder omits forbidden BXGY fields
✅ PASS. `usePromotionForm.ts:247-264` BUY_X_GET_Y branch spreads only `base` + `type` + `buyQuantity` + `getQuantity` + `getDiscountPercent` + (conditional) `appliesTo`/`targetItems`. `buildBasePayload` (`:296-312`) emits only title/method/dates/customerScope/customerIds/priceListIds/daysOfWeek. NONE of `discountType`, `discountValue`, `minPurchaseAmountCents`, `buyTargetType`, `getTargetType` reach the BXGY payload.

---

## Strict TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | apply-progress obs #2817 (rev 4) documents RED→GREEN per slice A–D |
| All tasks have tests | ✅ | 8/8 change specs exist and are GREEN |
| RED confirmed (tests exist) | ✅ | All 8 spec files present in codebase |
| GREEN confirmed (tests pass) | ✅ | 8/8 change specs pass on independent re-run |
| Triangulation adequate | ✅ | REQ-3 has 4 distinct scenarios asserting DIFFERENT values ($200/$80/$100/gross); REQ-11 has 6 (3 neg + 3 pos); REQ-12 3 cases |
| Safety Net for modified files | ✅ | Pre-existing specs modified with valid-base defaults updated alongside new guards (schema helper, badge stubs) |

**Assertion quality**: ✅ No trivial/tautological assertions found in the 8 change specs. REQ-3 tests use `data-testid` value assertions (`$200.00`, `$400.00`, badge presence/absence) — real behavior, not smoke. Type-only assertions in `sale.types.test.ts` are gated by `pnpm build` (vue-tsc) as documented in apply-progress; not a gap.

**Test Layer Distribution**: Unit (schema, composable, types) + Integration (component mount via @vue/test-utils for SaleItemRow/SaleItemBadges/SaleDetailItemsList/PromotionForm). No E2E — consistent with repo capabilities.

---

## Findings

### CRITICAL
None.

### WARNING
- **W-1 (carried forward, non-blocking)**: Backend error-code casing is unverified against the live API. Frontend mitigates fully via `.toUpperCase()` canonicalization (`usePromotionForm.ts:359`), so any casing maps correctly — but the actual backend emission casing for `FORBIDDEN_FIELD` / `INVALID_FIELD_CHANGE` / `duplicate_target` should be confirmed during integration. No code change required.
- **W-2 (Slice D pre-deploy fallback, documented, non-blocking)**: `netLine = subtotalCents ?? grossLine` (`SaleItemRow.vue:127`) means a draft line returned by a pre-deploy backend (no `subtotalCents`) renders GROSS as the bold total. This is a deliberate, spec-documented UX choice (Sales REQ-3 scenario "pre-deploy draft falls back to gross") — prefer backend NET > gross fallback (visual overcharge, no info loss) > no fallback. Resolves automatically once the additive backend fields ship. Covered by `SaleItemRow.test.ts:616`.

### SUGGESTION
None.

---

## Manual verification (V.3) — not executed here
End-to-end 2x1 BXGY (payload emits `getDiscountPercent: 100`; confirmed sale line shows GRATIS; draft cart line shows NET + struck gross without unit-price strikethrough) remains a manual pre-merge check. All constituent behaviors are unit/integration-covered above.

---

## Summary
- **Status**: complete
- **Verdict**: **PASS WITH WARNINGS**
- **Blockers**: none
- **Critical findings**: none
- **Requirements coverage**: 9/9 PASS
- **Gate results**: `pnpm build` exit 0 ✅ · `pnpm test:unit` 2503 pass / 18 baseline fail (0 change-attributable) ✅
- **Warnings**: W-1 (backend error casing, non-blocking) · W-2 (Slice D pre-deploy gross fallback, documented)
- **Next recommended**: sdd-archive (sync delta specs to source-of-truth) → merge `feat/buy-x-get-y-promotion` → main after manual V.3 spot-check.
