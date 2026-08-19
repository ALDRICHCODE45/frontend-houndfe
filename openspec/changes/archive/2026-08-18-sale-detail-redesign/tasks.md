# Tasks: sale-detail-redesign

> Single-PR delivery: 4 conventional commits on `feat/sale-detail-redesign` → `main`. Pre-PR build (`pnpm build`) is authoritative.

## Goal

Replace the `UTabs` workbench in `SaleDetailView` with a flat two-column layout (left: PRODUCTOS + DATOS DE LA VENTA + HISTORIAL; right: TOTALES + PAGOS REGISTRADOS), extracting DATOS into `SaleDetailSalesDataCard` and HISTORIAL into `SaleDetailHistoryCard`, relabeling the PDF dropdown trigger to "Comprobante", and dropping the `sm:hidden` mobile total duplicate — without regressing HST-REQ-001..007 Coco-token constraints.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~510 (additions + deletions, incl. 4 new files + 2 modified files) |
| 400-line budget risk | **High** |
| Chained PRs recommended | No |
| Suggested split | Single PR with 4 conventional commits |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |
| Decision needed before apply | **Yes** — orchestrator records accepted `size:exception` before launching `sdd-apply` |
| Size:exception required | **Yes** — single coherent redesign; chained PRs would force half-baked layout (UTabs + SalesDataCard coexisting without wiring) |
| Strict TDD | **Active** per init envelope #778 — every WU follows RED → GREEN → REFACTOR locally |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

### Work-unit line forecast

| WU | Commit | Authored (adds + dels) | Net | Cumulative |
|----|--------|------------------------|-----|------------|
| A | `feat(sales): add SaleDetailSalesDataCard component` | ~195 | +195 | 195 |
| B | `feat(sales): add SaleDetailHistoryCard wrapper` | ~100 | +100 | 295 |
| C | `refactor(sales): flatten sale detail view, drop UTabs, label Comprobante trigger` | ~172 | -96 | 467 |
| D | `test(sales): update sale detail view tests for flat layout` | ~45 | +0 (modifies) | ~512 |

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| A | New SalesDataCard component + test, no view changes | PR 1 (single-pr) | `pnpm test:unit src/features/POS/sales/components/__tests__/SaleDetailSalesDataCard.test.ts` | N/A — pure component add; verify in view test (C) and Storybook/manual | Delete `SaleDetailSalesDataCard.vue` + its test; no consumer yet |
| B | New HistoryCard wrapper + test, no view changes | PR 1 (single-pr) | `pnpm test:unit src/features/POS/sales/components/__tests__/SaleDetailHistoryCard.test.ts` | N/A — pure component add; verify in view test (C) | Delete `SaleDetailHistoryCard.vue` + its test; no consumer yet |
| C | View rewrite: drop UTabs/tabItems/inline datos/sm:hidden; add grid + mounts + Comprobante label | PR 1 (single-pr) | `pnpm test:unit src/features/POS/sales/views/__tests__/SaleDetailView.test.ts` | Manual: open `/pos/ventas/:id` → flat grid renders, DATOS + HISTORIAL cards visible, header "Comprobante" label on CONFIRMED sale | Revert view only — SalesDataCard + HistoryCard remain unused, no impact |
| D | View-test contract: retitle 2 tests, add layout/order/no-tabs/Comprobante assertions, mock productApi | PR 1 (single-pr) | `pnpm test:unit src/features/POS/sales/views/__tests__/SaleDetailView.test.ts` | N/A — test-only commit | Revert test file only; requires WU-C to also revert for green suite |

## Work Units

### WU-A — `feat(sales): add SaleDetailSalesDataCard component` (~195 lines)

**Files**: create `src/features/POS/sales/components/SaleDetailSalesDataCard.vue` (~95) + `src/features/POS/sales/components/__tests__/SaleDetailSalesDataCard.test.ts` (~100).

**Sub-tasks (strict TDD)**:
- [x] A.1 RED: write `SaleDetailSalesDataCard.test.ts` covering — 5 testids (`sidebar-data-reflow`, `reflow-{cajero,vendedor,cliente,price-list,payment-methods}`); `productApi.getGlobalPriceLists()` invoked exactly once on mount; `priceListName` returns `'PUBLICO'`/`'...'`/name/raw id per state; `uniquePaymentMethods` dedupes case-sensitively; `assign-seller` emit fires from click/Enter/Space; HST-REQ-002 class assertions on all 5 cards.
- [x] A.2 GREEN: implement `SaleDetailSalesDataCard.vue` (`<script setup lang="ts">`): props `{ sale: SaleDetail }`, emits `'assign-seller'`; own `productApi.getGlobalPriceLists()` `onMounted` fetch (silent catch); own `priceListName` + `uniquePaymentMethods` computeds; root `<section data-testid="sidebar-data-reflow">` + 5 reflow cards with byte-identical HST-REQ-002 class strings (`bg-coco-neutral-50 dark:bg-coco-neutral-950 border border-default p-3`).
- [x] A.3 REFACTOR: extract the 4 identical card wrappers into a local `<DatosCard>` template fragment if it cleans up without losing readability.

**Acceptance**:
- [x] `pnpm test:unit src/features/POS/sales/components/__tests__/SaleDetailSalesDataCard.test.ts` green
- [x] `pnpm type-check` green (SalesDataCard exports cleanly, no consumer yet)
- [x] `grep -n "productApi\|GlobalPriceList" src/features/POS/sales/views/SaleDetailView.vue` still returns matches (intentional — WU-C removes them)
- [x] HST-REQ-002 class strings byte-identical: `bg-coco-neutral-50 dark:bg-coco-neutral-950` on all 5 cards

**Focused test command**: `pnpm test:unit src/features/POS/sales/components/__tests__/SaleDetailSalesDataCard.test.ts`
**Runtime harness**: N/A — pure component addition; manual verification deferred to WU-C integration
**Rollback boundary**: Delete the 2 new files; view is untouched, so build remains green

**Depends on**: None (foundational).

---

### WU-B — `feat(sales): add SaleDetailHistoryCard wrapper` (~100 lines)

**Files**: create `src/features/POS/sales/components/SaleDetailHistoryCard.vue` (~45) + `src/features/POS/sales/components/__tests__/SaleDetailHistoryCard.test.ts` (~55).

**Sub-tasks (strict TDD)**:
- [x] B.1 RED: write `SaleDetailHistoryCard.test.ts` covering — `UCard` title is `"HISTORIAL"`; `SaleDetailTimeline` mounts in card body (`timeline-event` testids present); `SaleCommentInput` mounts in card footer (`sale-comment-input` present); empty-timeline case (card shell + composer still render); keyboard focus order body→footer.
- [x] B.2 GREEN: implement `SaleDetailHistoryCard.vue` (`<script setup lang="ts">`): props mirror children contracts (`timeline: SaleTimelineEvent[]`, `currentUserId?: string | null`, `commentsPending?: boolean`, `onUpdateComment`, `onDeleteComment`, `onSubmitComment`); `UCard` with `#header` title `"HISTORIAL"`, `#body` slot mounting `SaleDetailTimeline`, `#footer` slot mounting `SaleCommentInput`; no new emits; pass-through prop forwarding only.
- [x] B.3 REFACTOR: confirm no excess prop drilling; `UCard` `ui.body`/`ui.footer` padding matches adjacent components.

**Acceptance**:
- [x] `pnpm test:unit src/features/POS/sales/components/__tests__/SaleDetailHistoryCard.test.ts` green
- [x] `pnpm type-check` green (HistoryCard exports cleanly, no consumer yet)
- [x] `timeline-*` and `comment-*` testids remain on the child components (HST-REQ-007)

**Focused test command**: `pnpm test:unit src/features/POS/sales/components/__tests__/SaleDetailHistoryCard.test.ts`
**Runtime harness**: N/A — pure component addition; manual verification deferred to WU-C integration
**Rollback boundary**: Delete the 2 new files; view is untouched, so build remains green

**Depends on**: None (independent of WU-A).

---

### WU-C — `refactor(sales): flatten sale detail view, drop UTabs, label Comprobante trigger` (~172 lines churn, net -96)

**Files**: modify `src/features/POS/sales/views/SaleDetailView.vue`.

**Sub-tasks (strict TDD — pair with WU-D test changes)**:
- [x] C.1 DELETE imports (lines 18, 25): `import { productApi }`; `import type { GlobalPriceList }`.
- [x] C.2 DELETE priceLists fetch block (lines 84–98, ~15 lines): `priceLists`, `priceListsLoading`, `onMounted` async fetch.
- [x] C.3 DELETE `priceListName` computed (lines 100–105, 6 lines) and `uniquePaymentMethods` computed (lines 107–118, 12 lines).
- [x] C.4 DELETE `tabItems` computed (lines 175–190, 16 lines including comment).
- [x] C.5 DELETE `sm:hidden` mobile total `<p>` (lines 343–345, 3 lines).
- [x] C.6 DELETE entire `UTabs` block (lines 402–490, ~89 lines) including the 4 `<template #slot>` panels.
- [x] C.7 ADD grid wrapper (lines 402-replacement, ~30 lines): `<div class="grid gap-6 lg:grid-cols-[1fr_360px]" data-testid="sale-detail-layout-body">` with left column `<div class="space-y-6 order-2 lg:order-1">` and right column `<div class="space-y-6 order-1 lg:order-2">`.
- [x] C.8 ADD `<SaleDetailSalesDataCard :sale="sale" @assign-seller="sellerSlideoverOpen = true" />` mount in left column.
- [x] C.9 ADD `<SaleDetailHistoryCard :timeline="sale.timeline" :current-user-id="authStore.user?.id ?? null" :comments-pending="commentsPending" :on-update-comment="updateComment" :on-delete-comment="deleteComment" :on-submit-comment="addComment" />` mount in left column.
- [x] C.10 ADD Comprobante label to trigger `v-else` branch (line 366–373): visible `"Comprobante"` text + `aria-label="Comprobante"`; DRAFT branch (lines 357–365) keeps icon-only + tooltip, aria-label also `"Comprobante"`.
- [x] C.11 UPDATE THESIS/OWN-WORLD/STORY/FIRST VIEWPORT/FORM comment block (lines 1–7) to reflect flat-grid model.

**Acceptance**:
- [x] `pnpm type-check` green (no `productApi` import; all computeds referenced from the view are gone)
- [x] `pnpm test:unit src/features/POS/sales/views/__tests__/SaleDetailView.test.ts` may FAIL (expected — WU-D lands the test contract); other suites green
- [x] `grep -n "UTabs\|tabItems\|sale-detail-tabs" src/features/POS/sales/views/SaleDetailView.vue` returns ZERO matches
- [x] `grep -n "sm:hidden" src/features/POS/sales/views/SaleDetailView.vue` returns ZERO matches
- [x] `grep -n "reflow-\|sidebar-data-reflow\|sale-detail-layout-body" src/features/POS/sales/views/SaleDetailView.vue` returns expected mount counts
- [x] HST-REQ-002 class strings byte-identical: `bg-coco-neutral-50/90 dark:bg-coco-neutral-950/90` on header (untouched); Cobrar `!bg-(--brand-action) !text-black` (untouched)
- [x] Manual: open `/pos/ventas/:id` for a CONFIRMED sale → flat grid renders with both columns at `lg`, DATOS + HISTORIAL cards visible, header shows visible "Comprobante" label

**Focused test command**: `pnpm test:unit src/features/POS/sales/views/__tests__/SaleDetailView.test.ts` (expect partial fail until WU-D lands; `pnpm build` is the authoritative gate at end of PR)
**Runtime harness**: Manual in browser — navigate to `/pos/ventas/:id` for a CONFIRMED sale; verify grid renders, DATOS card shows 5 sub-cards, HISTORIAL card shows timeline + composer, header "Comprobante" label is visible, dropdown opens
**Rollback boundary**: Revert `SaleDetailView.vue` only — UTabs + inline datos + sm:hidden restored; the new components (WU-A, WU-B) remain in the tree but are unused (no consumer)

**Depends on**: WU-A + WU-B (mounts reference the new components).

---

### WU-D — `test(sales): update sale detail view tests for flat layout` (~45 lines churn)

**Files**: modify `src/features/POS/sales/views/__tests__/SaleDetailView.test.ts`.

**Sub-tasks (strict TDD — GREEN phase for WU-C's assertions)**:
- [x] D.1 RETITLE test at line 187: `"renders tabbed workbench layout with header title"` → `"renders flat two-column layout with header title"`.
- [x] D.2 UPDATE comment block at lines 184–186 to describe flat-grid + 2-column structure; remove `unmount-on-hide=false` reference.
- [x] D.3 ADD `vi.mock('@/features/POS/products/api/product.api', () => ({ productApi: { getGlobalPriceLists: vi.fn().mockResolvedValue([]) } }))` near the existing `vi.mock` cluster (line 11+) — keeps `priceListName` at `'PUBLICO'` for the real SalesDataCard mount.
- [x] D.4 ADD new test `"renders flat two-column grid with correct column order"` asserting: `[data-testid="sale-detail-layout-body"]` exists; left column root has `order-2 lg:order-1`; right column root has `order-1 lg:order-2`; both columns exist.
- [x] D.5 ADD new test `"removes the UTabs workbench"` asserting: `[data-testid="sale-detail-tabs"]` does NOT exist; the 4 body stubs (items, totals, timeline, comment-input) still coexist.
- [x] D.6 ADD new test `"labels Comprobante trigger for CONFIRMED sale"` asserting: visible `"Comprobante"` text in trigger; `aria-label="Comprobante"`; dropdown opens on click.
- [x] D.7 ADD new test `"keeps icon-only DRAFT trigger with tooltip"` asserting: trigger disabled; DRAFT tooltip text renders; no visible `"Comprobante"` text.
- [x] D.8 ADD new test `"renders no sm:hidden mobile header total"` asserting: no `sm:hidden` element renders the total in the header (only right-column `totals-total-value` carries the total at all sizes).

**Acceptance**:
- [x] `pnpm test:unit src/features/POS/sales/views/__tests__/SaleDetailView.test.ts` green (after WU-C also lands)
- [x] `pnpm test:unit` green project-wide (no regressions)
- [x] HST-REQ-002 class assertions at lines 217–230 still pass on the redesigned view (class strings copied verbatim)
- [x] HST-REQ-003 `register-payment-header` Cobrar class assertion still passes (line 237+)

**Focused test command**: `pnpm test:unit src/features/POS/sales/views/__tests__/SaleDetailView.test.ts`
**Runtime harness**: N/A — test-only commit
**Rollback boundary**: Revert this test file alone requires also reverting WU-C's view changes for the suite to remain green; treat WU-C + WU-D as a coupled rollback unit in the PR body

**Depends on**: WU-C.

---

## Dependency Graph

```
WU-A (add SalesDataCard) ─┐
                          ├─► WU-C (flatten view) ─► WU-D (update view tests)
WU-B (add HistoryCard) ───┘
```

Commit order: WU-A → WU-B → WU-C → WU-D (WU-A and WU-B may be reordered — both independent).

## Acceptance for the full change

- [x] All 4 WUs land as conventional commits on `feat/sale-detail-redesign`
- [x] `pnpm test:unit --run` green (zero skipped)
- [x] `pnpm build` clean (authoritative — `vue-tsc --build` + `vite build`)
- [x] `pnpm lint` green
- [x] All 8 REQ-LAYOUT scenarios + MODIFIED HST-REQ-008 scenario covered by tests
- [x] All preserved testids verified: `grep -rn 'data-testid="' src/features/POS/sales/views/SaleDetailView.vue src/features/POS/sales/components/SaleDetailSalesDataCard.vue` returns expected counts
- [x] HST-REQ-002/003/007 class strings verified byte-identical via grep (`bg-coco-neutral-50/90`, `bg-coco-neutral-50`, `!bg-(--brand-action)`)
- [x] `sale-detail-tabs` removed (grep returns zero matches outside this tasks file)
- [x] `productApi` removed from SaleDetailView (grep returns zero matches)
- [x] Single commit chain, conventional-commits only, no AI attribution in commit messages

## Rollback

Single `git revert` of the merge commit. Pure structural + class change; no API or data-shape impact. Reverting restores the `UTabs` workbench, inline datos block, and icon-only "Más acciones" trigger with all original testids.

## Notes

- **Strict TDD active** (per init envelope #778): each WU implements RED → GREEN → REFACTOR locally even though the commit boundary is the WU. The implementer MAY split WU-C + WU-D into finer-grained commits if TDD observability requires it; the WU count and line forecast in this tasks.md feed `sdd-attempt acquire` inputs.
- **`size:exception` protocol**: under `single-pr` delivery strategy, the orchestrator must record an accepted `size:exception` before launching `sdd-apply` because the cumulative authored forecast (~512 lines) exceeds the 400-line review budget. The exception is justified by the coherent single-PR nature of the change — chained PRs would force half-baked layout (UTabs + SalesDataCard + HistoryCard coexisting without wiring).
- **8 untouched components** stay verbatim: `SaleDetailItemsList`, `SaleDetailTotalsCard`, `PaymentsListSection`, `SaleDetailTimeline`, `SaleCommentInput`, `SaleCommentSlideover`, `DebtPaymentModal`, `AssignSellerSlideover`. Their test suites must NOT be modified.
- **Archive ordering carry-forward** (from `sales-history-coco/tasks.md`): the in-flight `sales-history-coco` change carries HST-REQ-001..008 — archive it BEFORE this change's sdd-archive phase to avoid merge-order conflict on `openspec/specs/sales/spec.md`. The MODIFIED HST-REQ-008 carve-out in this change's delta spec is already in place.
- **`openspec/config.yaml` does not exist** in this repo (per stale init envelope note #3577); no `rules.tasks` constraints apply.
- **Testid disposition**: `sale-detail-tabs` is removed (verified — no test/e2e consumer references it today); `sale-detail-layout-body` is added on the grid root.
- **Comprobante aria-label release**: the MODIFIED HST-REQ-008 carve-out releases the `aria-label="Más acciones"` pin; the new `aria-label="Comprobante"` is permitted on both the CONFIRMED (with label) and DRAFT (icon-only) branches.
- **PR body must include**: (1) headline reframe — flat two-column layout replaces UTabs workbench; (2) HST-REQ-002/003/007 byte-identical class guarantees; (3) `size:exception` justification (~512 lines, 4 new files + 2 modified files, single coherent redesign); (4) manual smoke checklist (CONFIRMED + DRAFT + CANCELED sales; mobile stacking order); (5) rollback = `git revert` of the merge commit.