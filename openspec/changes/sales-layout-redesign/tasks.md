# Tasks: Sales Layout Redesign

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 220–310 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Lift strip + partition cart + mini-card rows + selector sync | PR 1 | `pnpm test:unit -- src/features/POS/sales/components/__tests__/SaleItemRow.test.ts` | `pnpm build`; manual light/dark on `/sales` (desktop + mobile) | `git revert` of PR — restores pre-change layout, no contract changes |

## Tasks

### [x] T1 — `chore(pos): strip cart-internal chrome from SalesTabsStrip`

- **Description**: Drop `border-b border-default` and `no-scrollbar` so the strip no longer assumes it's a child of a card. Pure styling cleanup; no logic change.
- **Files**: `src/features/POS/sales/components/SalesTabsStrip.vue`
- **Acceptance**: `pnpm build` passes; visual change invisible until T2 (strip still inside `ActiveSalePanel`).
- **Depends on**: —
- **Diff size**: ~5 lines
- **Test updates**: None (visual change inside cart card is invisible).

### [x] T2 — `feat(pos): lift SalesTabsStrip to view level`

- **Description**: Mount strip ONCE at view level in `SalesView.vue` so both desktop right panel and mobile slideover share the same active tab. Remove the inline strip from `ActiveSalePanel.vue`. Same props/emits/helpers — purely a parent move.
- **Files**: `src/features/POS/sales/views/SalesView.vue`, `src/features/POS/sales/components/ActiveSalePanel.vue`
- **Acceptance**: `pnpm build` passes; one tab strip in DOM at view level (above catalog/cart split); desktop + mobile share it; no behavior change.
- **Depends on**: T1
- **Diff size**: ~30–50 lines
- **Test updates**: None (structural change; behavior preserved).

### T3 — `refactor(pos): partition ActiveSalePanel into header/body/footer`

- **Description**: Wrap type-toggle row, items list, and footer block (customer + manual-promo accordion + totals) in three `<section>` wrappers with `data-testid="cart-header"`, `cart-body`, `cart-footer`. No visual or behavior change.
- **Files**: `src/features/POS/sales/components/ActiveSalePanel.vue`
- **Acceptance**: `pnpm build` passes; three regions visible; sections stay transparent (SDD-3 doble-fondo rule: rely on `UDashboardPanel` body bg `bg-(--light-surface-page) dark:bg-coco-neutral-950`).
- **Depends on**: T2
- **Diff size**: ~30–50 lines
- **Test updates**: None (no `ActiveSalePanel` test exists; structural only).

### T4 — `feat(pos): redesign SaleItemRow as vertical mini-card + sync tests`

- **Description**: Desktop: switch from horizontal single-row to vertical mini-card — top row = thumbnail (left) · info (center) · qty/price controls + actions dropdown (right); bottom row = `<SaleItemBadges>` on its own visually subordinate line. Mobile: keep stacked, only reposition the dropdown inline with the qty/price row. Preserve every existing `data-testid`. Same props, same emits, same `SaleItem` payload.
- **Files**: `src/features/POS/sales/components/SaleItemRow.vue`, `src/features/POS/sales/components/__tests__/SaleItemRow.test.ts`
- **Acceptance**: `pnpm test:unit -- src/features/POS/sales/components/__tests__/SaleItemRow.test.ts` passes (all 800+ lines); `pnpm build` passes; light + dark parity; no new Coco tokens.
- **Depends on**: — (parallel to T3; no shared files)
- **Diff size**: ~150–200 lines
- **Test updates**: INCLUDED — selector audit (every existing `data-testid` lookup must still find its element) + one new test asserting the badges live on their own line below the top row.

### T5 — `chore(pos): verify sales layout end-to-end`

- **Description**: Run the full build + test suite, then a manual visual check on `/sales` for desktop + mobile × light + dark. Confirms the layout shift lands cleanly with no doble fondo, no broken strip, no cascading rows.
- **Files**: none
- **Acceptance**: `pnpm build` 0 errors; `pnpm test:unit` 100% pass; visual parity confirmed.
- **Depends on**: T3, T4
- **Diff size**: 0 lines
- **Test updates**: None.

## Risks

- **T2 mobile strip**: strip at view level may compete with the mobile FAB on narrow screens. Mitigation: `hidden lg:flex` on the strip wrapper — deferred follow-up if review surfaces it.
- **T3 doble fondo**: `<section>` wrappers must stay transparent. Mitigation: NO `bg-*` classes on the sections; rely on `UDashboardPanel` body bg.
- **T4 layout shift**: desktop qty/total position moves significantly. If the user finds it worse, rollback is `git revert` of the PR — no API/contract changes.
- **T4 test brittleness**: 800+ lines of selector-bound assertions in `SaleItemRow.test.ts` are sensitive to DOM restructuring. The selector audit in T4.3 must be exhaustive (every `data-testid` lookup re-verified).

## Rollback

Single `git revert` of the merge commit. Pure structural/visual change — no API, no `SaleItem` payload, no emit changes. Restoring pre-merge code restores pre-merge layout exactly.
