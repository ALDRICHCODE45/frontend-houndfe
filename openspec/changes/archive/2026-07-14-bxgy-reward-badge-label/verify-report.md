# Verification Report: bxgy-reward-badge-label

- **Change**: `bxgy-reward-badge-label`
- **Branch / commit**: `feat/bxgy-reward-badge-label` @ `0665ce3` (10 files, +330/-119)
- **Artifact store**: openspec
- **Mode**: Strict TDD (independent re-run — apply/orchestrator numbers NOT trusted)
- **Verdict**: **PASS** (1 non-blocking SUGGESTION)

## Completeness (tasks.md)

| Phase | Tasks | State |
|---|---|---|
| Phase 1 RED (1.1–1.6) | Contract tests | ✅ all checked, verified present in commit |
| Phase 2 GREEN (2.1–2.4) | Helper, types, badge, forwards | ✅ all checked, verified in code |
| Phase 3 (3.1–3.4) | Refactor, gates, commit | ⬜ unchecked in tasks.md, but objectively DONE (gates green + commit `0665ce3` exists) |

Note: 3.1–3.4 remain unchecked boxes in `tasks.md`, yet the underlying work is provably complete (both gates pass, conventional commit landed). Cosmetic bookkeeping gap only — not a blocker.

## Build / Tests / Coverage Evidence (independently re-run)

| Gate | Command | Result |
|---|---|---|
| Focused unit (5 change files) | `pnpm test:unit --run <5 files>` | **146/146 passed**, 5 files |
| Full suite (this branch) | `pnpm test:unit --run` | 2535 passed / **18 failed** / 2553 (18 = pre-existing baseline) |
| Full suite (`main` baseline) | `pnpm test:unit --run` | 2523 passed / **18 failed** / 2541 (identical 18 failures) |
| Build gate | `pnpm build` | **green** (`✓ built in 12.10s`), only pre-existing chunk-size warning on `index-*.js` (814 kB) |

**Regression proof**: branch and `main` both show the SAME 18 failures in the SAME 5 unrelated files
(`useAuthStore.spec.ts` ×2, `usePromotionColumns.test.ts` ×2, `useDebtPayment.test.ts` ×4,
`DebtPaymentModal.test.ts` ×9, `SaleDetailMetadataCard.spec.ts` ×1). The commit diff touches
ONLY the 10 POS/sales change-target files — none of the failing files. Branch adds **+12 net
passing tests** (2535 vs 2523) with **ZERO new failures**. Baseline noise confirmed pre-existing.

## Behavioral Compliance Matrix (from actual test results)

| Scenario | Covering test | Runtime |
|---|---|---|
| BXGY 100 → `GRATIS` (helper) | promotion.utils.test.ts | ✅ pass |
| BXGY 50 → `-50%` (helper) | promotion.utils.test.ts | ✅ pass |
| non-BXGY kind (null/undefined) → null | promotion.utils.test.ts | ✅ pass |
| BXGY missing percent (null/undefined) → null | promotion.utils.test.ts | ✅ pass |
| BXGY 0 / -1 → null (never `-0%`) | promotion.utils.test.ts | ✅ pass |
| Partial 50 renders `-50%`, NEVER `GRATIS` (badge) | SaleItemBadges.test.ts | ✅ pass |
| success tone + `i-lucide-gift` parity 100/50 | SaleItemBadges.test.ts | ✅ pass |
| null percent → no badge (badge) | SaleItemBadges.test.ts | ✅ pass |
| SaleItemRow forwards `reward-discount-percent` | SaleItemRow.test.ts | ✅ pass |
| SaleDetailItemsList forwards + parity + NET subtotal | SaleDetailItemsList.test.ts | ✅ pass |
| SaleItem/SaleDetailItem accept 50/null/omitted | sale.types.test.ts | ✅ pass |

## Per-Requirement Verdict

| REQ | Requirement | Evidence | Verdict |
|---|---|---|---|
| REQ-9 | `rewardDiscountPercent?: number \| null` on BOTH `SaleItem` (L306) + `SaleDetailItem` (L80), omittable | sale.types.ts diff + tests for 50/null/omitted on both interfaces | ✅ PASS |
| REQ-10 | Pure helper 4-case rule EXACT; badge renders via helper; tone/icon/testid unchanged; partial never `GRATIS` | promotion.utils.ts L15-25 matches authoritative rule (incl. `pct>0` guard → `<=0`→null); SaleItemBadges.vue L89-91/165-170 preserves `success`/`i-lucide-gift`/`sale-item-reward-badge` | ✅ PASS |
| REQ-11 | SaleItemRow + SaleDetailItemsList both forward `:reward-discount-percent`; parity; absent field → no badge, no throw | Both `.vue` forward `item.rewardDiscountPercent`; parity + pre-deploy null tests green | ✅ PASS |
| REQ-2 (MOD) | Confirmed surface percent-aware, not hardcoded GRATIS | SaleDetailItemsList forwards helper-driven label; old GRATIS test now passes `rewardDiscountPercent:100` (strengthened) | ✅ PASS |
| REQ-3 (MOD) | Draft surface percent-aware; `SaleItem` accepts new field; forwarded to badges | SaleItemRow forwards; SaleItem type extended; parity test green | ✅ PASS |

## Hardcoded-GRATIS Test Migration Check

Both previously-hardcoded GRATIS assertions were **strengthened, not deleted/weakened**:
- `SaleItemBadges.test.ts`: old `renders a GRATIS reward badge when rewardKind === "buy_x_get_y"` →
  `renders a percent-aware reward badge for a 100% BXGY reward` now passes `rewardDiscountPercent: 100`.
- `SaleDetailItemsList.test.ts`: GRATIS assertion retained AND now passes `rewardDiscountPercent: 100`
  plus asserts the forwarded prop. New partial (`50→-50%`, not GRATIS) and null (no badge) cases added.

## Findings

**CRITICAL**: none.

**WARNING**: none.

**SUGGESTION** (non-blocking, cosmetic — does not affect behavior, tests, or build):
- Lingering one-space over-indentation on the forwarded `<SaleItemBadges>` prop block in
  `SaleItemRow.vue` (L215-221) and `SaleDetailItemsList.vue` (L93-96). Lines have 11 leading
  spaces vs the surrounding 10. ESLint/`vue-tsc`/build accept it; purely a formatting nit that
  could be tidied in archive/cleanup.

## Verdict

**PASS** — All 5 requirements (REQ-2, REQ-3, REQ-9, REQ-10, REQ-11) satisfied against the ACTUAL
committed code. Helper matches the authoritative 4-case rule exactly (including `pct<=0 → null`,
never `-0%`, never false `GRATIS`). Both gates re-run from scratch: focused 146/146 green, build
green. The 18 baseline failures are provably pre-existing (identical on `main`) and NOT regressions.
Ready for sdd-archive.
