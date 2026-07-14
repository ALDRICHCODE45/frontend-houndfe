# Tasks: BXGY Reward Badge Label

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 120–160 |
| 400-line budget risk | Low |
| Implementation files C/M/D | 0 / 10 / 0 |
| Chained PRs recommended | No |
| Decision needed before apply | No |
| Delivery strategy | single-pr |
| Chain strategy | pending (not applicable) |
| Branch / review unit | `feat/bxgy-reward-badge-label` / one local PR |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Unit

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| 1 | Percent-aware BXGY label, mirrored types, both surface forwards, tests | PR 1 | One commit; gates included; revert one commit; no push |

> Contract clarification: BXGY percent `<= 0` returns `null`; this supersedes the design’s generic branch/test note (`design.md:L32,L66`) for apply and verification.

## Phase 1: RED — Contract Tests

- [x] 1.1 Add `getRewardBadgeLabel` cases (100→`GRATIS`, 50→`-50%`, non-BXGY→null, BXGY null/undefined→null, 0/-1→null) in `src/features/POS/sales/utils/__tests__/promotion.utils.test.ts:9-35`. [REQ-10]
- [x] 1.2 Add number/null/omitted literals for BOTH interfaces in `src/features/POS/sales/interfaces/__tests__/sale.types.test.ts:1017` and `:1231`. [REQ-9]
- [x] 1.3 Update the existing GRATIS case with percent 100 and add partial/no-badge plus success-tone, gift-icon, and testid parity assertions in `src/features/POS/sales/components/__tests__/SaleItemBadges.test.ts:154`. [REQ-2, REQ-10]
- [x] 1.4 Extend the BXGY boundary at `src/features/POS/sales/components/__tests__/SaleItemRow.test.ts:468,485` for 100/50/omitted percent forwarding and `GRATIS`/`-50%`/no-badge parity. [REQ-3, REQ-11]
- [x] 1.5 Update the existing GRATIS fixture with percent 100 and test 50 parity, forwarded prop, null/omitted no-badge, and unchanged NET subtotal in `src/features/POS/sales/components/__tests__/SaleDetailItemsList.test.ts:276,288`. [REQ-2, REQ-11]
- [x] 1.6 Run focused `pnpm test:unit` coverage for the five files above; record expected RED failures before production edits. [REQ-2, REQ-3, REQ-9–11]

## Phase 2: GREEN — Implementation

- [x] 2.1 Add the typed pure helper beside `buildBxgyHint` in `src/features/POS/sales/utils/promotion.utils.ts:10-13`, returning null for non-BXGY, missing, zero, or negative percent. Test: `src/features/POS/sales/utils/__tests__/promotion.utils.test.ts:9-35`. [REQ-10]
- [x] 2.2 Add `rewardDiscountPercent?: number | null` after `rewardKind` in `src/features/POS/sales/interfaces/sale.types.ts:79,304`. Test: `src/features/POS/sales/interfaces/__tests__/sale.types.test.ts:1017,1231`. [REQ-9]
- [x] 2.3 Add the prop and pure `rewardBadgeLabel` computed; rewire `hasAnyBadge` and the badge label/gate while preserving tone/icon/testid in `src/features/POS/sales/components/SaleItemBadges.vue:37,84,86-92,157-163`. Test: `src/features/POS/sales/components/__tests__/SaleItemBadges.test.ts:154`. [REQ-2, REQ-10]
- [x] 2.4 Forward `:reward-discount-percent` in `src/features/POS/sales/components/SaleItemRow.vue:218` and `src/features/POS/sales/components/SaleDetailItemsList.vue:95`. Tests: `src/features/POS/sales/components/__tests__/SaleItemRow.test.ts:468` and `src/features/POS/sales/components/__tests__/SaleDetailItemsList.test.ts:276`. [REQ-3, REQ-11]

## Phase 3: REFACTOR, Gates, Commit

- [x] 3.1 Refactor only after GREEN; keep one pure helper, one computed derivation, and explicit props-down flow. Re-run affected tests. [REQ-2, REQ-3, REQ-9–11]
- [x] 3.2 Gate: run `pnpm test:unit`; require green and record the exact result before commit.
- [x] 3.3 Gate: run `pnpm build`; require green and record the exact result before commit.
- [x] 3.4 Inspect diff/stat and recent commit style; if gates pass and authored change remains under 400 lines, create ONE conventional commit (suggested: `feat(sales): make BXGY reward badge percent-aware`). No AI attribution; no push.
