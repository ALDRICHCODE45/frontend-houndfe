# Apply Progress: mobile-dashboard-list-density

## Status

- **Current slice:** S2 — Products pilot route, grid, card, and tests — **COMPLETE** (S1 previously complete)
- **Branch:** `feat/mobile-dashboard-list-density-s2-products` (created from S1 green commit `a2dba8e`)
- **Commit:** `41fb63b` — `feat(products): contain responsive list density pilot` (evidence revision `sha256:d15fd35681c4d29beeacd9c9208861489d37e59ed79bf64ed1b9d071e23b6653`, over the full commit hash `41fb63b651e4a72a0b0fddb63aac980d6c270d76`)
- **Delivery route:** stacked-to-main chained slice 2 of 4 (parent-resolved); no push, no merge, S3/S4 not started.
- **Strict TDD:** active (`openspec/config.yaml`), runner `pnpm test:unit --run` (vitest 4, jsdom).

## S2 TDD Cycle Evidence

| Step | Command | Result |
|---|---|---|
| RED | `pnpm test:unit --run src/features/POS/products/views/__tests__/ProductsView.test.ts src/features/POS/products/components/__tests__/ProductCardGrid.test.ts src/features/POS/products/components/__tests__/ProductCard.test.ts` | **6 failed / 13 passed** (19 total). All 6 failures are exactly the S2 contract assertions: ProductsView route-gutter ×1 + surface/body containment ×1, ProductCardGrid available-width grid ×1 + empty-state containment ×1, ProductCard shrinkable root ×1 + truncation ×1. The two preservation guards (type selector + pinned actions) pass at RED by design. RED was achieved purely by adding test assertions first; production files were untouched. |
| GREEN | Same focused command | **3 files passed, 19/19 tests passed**. Minimum implementation: route root `px-10` → `w-full min-w-0 md:px-10`; UCard + `w-full min-w-0 max-w-full`; inner body `px-5 py-4` → `w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4`; grid skeleton/data roots → `grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))]` + containment (ladder retired); empty root containment; card root `w-full min-w-0 max-w-full`; SKU `truncate`. |
| TRIANGULATE | Same focused command | **3 files passed, 28/28 tests passed** (9 new): long product name/SKU/brand strings render inside contained surfaces without `overflow-x-auto`; background-fetching grid stays contained; custom empty message renders; persisted card mode renders immediately; both modes keep pinned-actions (`right: ['actions']`) + 10-column contract; restricted user loses add action but keeps selector/pinning; card-mode route root free of scroll classes; kebab stays absolutely pinned (`absolute right-3 top-3 z-10`) with propagation guard beside long content; SKU/brand/price/date field-specific truncation retained. |
| REFACTOR | Same focused command | Consolidated the twice-duplicated grid class string in `ProductCardGrid.vue` into a single script constant (`gridClasses`) with the no-shared-wrapper rationale documented inline. One intermediate edit error (dropped `>` on the skeleton root) was caught by the lint hook and fixed before testing. **3 files passed, 28/28** — behavior unchanged. |

## S2 Verification

- Focused S2 suite: `pnpm test:unit --run <3 focused test files>` → **3 files, 28/28 passed**.
- Full suite: `pnpm test:unit --run` → **371 files passed, 5982/5983 tests passed**; the single failure is `ProductDetailView.serviceType.test.ts` timing out at 5s under full-suite load — that file is untouched by S2, has no import overlap with the six S2 files, and **passes 3/3 in isolation**, confirming a pre-existing load flake, not an S2 regression.
- Build gate: `pnpm build` (vue-tsc --build + vite build) → **success**, `✓ built in 12.76s` (pre-existing chunk-size warning only).
- Runtime harness: **N/A** — jsdom cannot prove rendered geometry; no fake geometry claims were made. The 360/412/740 browser matrix, `scrollWidth <= clientWidth` checks, and sticky-action extremes belong to the later verify boundary per tasks.md.

## S2 Authored line count

| Files | Lines |
|---|---|
| 6 modified files (3 production + 3 test files) | 242 additions + 51 deletions = 293 |
| **Total authored S2** | **293 ≤ 400 budget** |

## S2 Rollback boundary

Revert exactly the six S2 files on `feat/mobile-dashboard-list-density-s2-products` (commit `41fb63b`): `ProductsView.vue`, `ProductCardGrid.vue`, `ProductCard.vue` plus their three co-located test files. The commit touches only these files; reverting removes the Products containment pilot without touching S1 shared primitives, S3/S4 pilots, APIs, routes, permissions, or table models.

## S2 Files changed (all within allowed surfaces)

- `src/features/POS/products/views/ProductsView.vue` (M)
- `src/features/POS/products/views/__tests__/ProductsView.test.ts` (M)
- `src/features/POS/products/components/ProductCardGrid.vue` (M)
- `src/features/POS/products/components/__tests__/ProductCardGrid.test.ts` (M)
- `src/features/POS/products/components/ProductCard.vue` (M)
- `src/features/POS/products/components/__tests__/ProductCard.test.ts` (M)

## S2 Invariants preserved (asserted in tests)

- Product type selector (`aria-label="Filtrar por tipo"`), search/sort/pagination wiring, persisted display mode (immediate card render), permission-gated add action, card click → detail routing, and kebab propagation guards are all covered by passing assertions.
- Table models unchanged: `columnPinning` right `['actions']` and the 10-column product-service-type contract hold in both display modes.
- Card mode introduces no horizontal-scroll class anywhere (route root, grid, empty state, cards — all asserted negative for `overflow-x-auto`); table scrolling remains owned by the rendered Nuxt UI table region from S1.
- No geometry claims from jsdom; the viewport ladder was intentionally replaced with the available-width `auto-fit/minmax` contract per design §4 and tasks.md S2 TRIANGULATE.

## S2 Deviations from design

None. Implementation matches design.md §1 (Products root `w-full min-w-0 md:px-10`, compact inner body spacing), §4 (available-width grid, ladder retired, no shared wrapper), and §5 (shrinkable card root, field-specific truncation, kebab stays pinned).

## Remaining tasks

- S3 Customers pilot: `- [ ] RED: Add failing Customers assertions…` / GREEN / TRIANGULATE / REFACTOR (tasks.md)
- S4 Employees pilot: `- [ ] RED: Add failing Employees assertions…` / GREEN / TRIANGULATE / REFACTOR (tasks.md)
- Later verify boundary: rendered/manual geometry matrix (not apply work)

## S2 Cleanup/process evidence

- `git status` after commit: only the untracked `openspec/changes/mobile-dashboard-list-density/` directory remains (evolving artifacts, deliberately not committed per instruction); zero stray modified files.
- No temporary files created during S2 (no RED-reconstruction patch needed — RED was authored first, before any production edit).
- OpenSpec artifacts (`tasks.md` S2 checkboxes, this progress file) updated but left untracked/evolving.
- Commit authored exactly once (`41fb63b`), message matches tasks.md commit metadata verbatim; no push, no merge, no PR, no S3/S4 files touched.

## Structured status (S2)

## S1 historical record: corrective continuation after worker timeout

The first apply worker timed out mid-REFACTOR (while compressing/refining tests) and left uncommitted partial work: 4 modified production files, 2 modified test files, 2 new test files, no commit, no apply-progress. This rerun inspected all diffs first, preserved every scoped partial change, and reconstructed durable RED evidence without discarding anything. This is the single allowed rerun.

## TDD Cycle Evidence

| Step | Command | Result |
|---|---|---|
| RED (reconstructed) | Isolate the four production-file diffs to `/tmp/s1-red-reconstruction/s1-production.patch` (sha256 `74bf29e542c00568fa1b10992952fef48e4138b391a73b42795ab445b8608264`), `git checkout --` the four production files only, then `pnpm test:unit --run <4 focused spec files>` | **12 failed / 57 passed** (69 total). All 12 failures are exactly the S1 contract assertions (AppDataTable containment ×4, DataTableToolbar containment/breakpoint ×3, DataTablePagination containment ×3, ViewToggle a11y/containment ×2). Planning artifacts and tests were never reverted. |
| Restore | `git apply /tmp/s1-red-reconstruction/s1-production.patch`, patch sha256 re-verified identical before deletion, temp dir removed | Working tree byte-identical to pre-reconstruction state (14/8/8/5-line diffs reproduced exactly) |
| GREEN | `pnpm test:unit --run src/core/shared/components/DataTable/__tests__/AppDataTable.spec.ts src/core/shared/components/DataTable/__tests__/DataTableToolbar.spec.ts src/core/shared/components/DataTable/__tests__/DataTablePagination.spec.ts src/core/shared/components/__tests__/ViewToggle.spec.ts` | **4 files passed, 69/69 tests passed** (2.36s) |
| TRIANGULATE | Same focused command | Covered by the preserved test surface: table+card modes, loading/error/empty paths, with/without filters/actions, 640–767px `sm:flex-row` removal intent, pagination zero/one-based emission, custom toggle options, keyboard click activation, desktop `md:flex-row` preservation, explicit no-`overflow-x-auto` assertions in card mode and pagination list. All 69 green. |
| REFACTOR | Manual cleanup, then same focused command | Fixed mis-indented `pagination-controls` block in `DataTablePagination.vue` (whitespace only), removed the duplicated inner `expectRegionContainment` helper in `DataTableToolbar.spec.ts` (outer helper reused), removed 3 stray blank lines in `AppDataTable.spec.ts`. **4 files passed, 69/69** (2.27s) |

## Verification

- Focused S1 suite: `pnpm test:unit --run <4 focused spec files>` → **4 files, 69/69 passed**.
- Build gate: `pnpm build` (vue-tsc --build + vite build) → **success**, `✓ built in 12.42s` (pre-existing chunk-size warning only).
- Runtime harness: **N/A** — jsdom cannot prove rendered geometry; the 360/412/740 browser matrix, sticky-action extremes, and `scrollWidth <= clientWidth` checks belong to the later verify boundary per tasks.md.

## Authored line count

| Files | Lines |
|---|---|
| 6 modified files (4 production + 2 test files) | 184 additions + 15 deletions = 199 |
| 2 new test files (DataTablePagination.spec.ts 97, ViewToggle.spec.ts 89) | 186 |
| **Total authored S1** | **385 ≤ 400 budget** |

## Rollback boundary

Revert exactly the eight S1 files: `AppDataTable.vue`, `DataTableToolbar.vue`, `DataTablePagination.vue`, `ViewToggle.vue` (shared primitive classes/attributes only) plus their four co-located spec files. No unrelated work is coupled: the commit touches only these files; reverting removes the mobile containment/a11y corrections without affecting S2–S4 or any other slice.

## Files changed (all within allowed surfaces)

- `src/core/shared/components/DataTable/AppDataTable.vue` (M)
- `src/core/shared/components/DataTable/DataTableToolbar.vue` (M)
- `src/core/shared/components/DataTable/DataTablePagination.vue` (M)
- `src/core/shared/components/ViewToggle.vue` (M)
- `src/core/shared/components/DataTable/__tests__/AppDataTable.spec.ts` (M)
- `src/core/shared/components/DataTable/__tests__/DataTableToolbar.spec.ts` (M)
- `src/core/shared/components/DataTable/__tests__/DataTablePagination.spec.ts` (NEW)
- `src/core/shared/components/__tests__/ViewToggle.spec.ts` (NEW)

## Invariants preserved

- The real Nuxt UI `UTable` root (`data-testid="table-view"`, shipped `overflow-auto`) remains the sole table horizontal scroller; no overflow wrapper was added anywhere.
- `columnPinning`, sticky/pinned right `actions` column, all props/emits/slots/models, pagination zero/one-based bridge, and filter-sheet behavior are untouched.
- Card mode introduces no horizontal-scroll class (asserted in tests).

## Deviations from design

None. Implementation matches design.md §2–§4 exactly (root/UTable containment classes, toolbar `sm:flex-row` → `md:flex-row` breakpoint alignment, ViewToggle `type="button"` + `min-h-11 min-w-11` + focus-visible outline, pagination mobile column/`sm` row + max-width-safe list).

## Remaining tasks (S1 record, superseded by S2 status above)

- ~~S2 Products pilot~~ — complete (commit `41fb63b`)
- S3 Customers pilot: `- [ ] RED: Add failing Customers assertions…` / GREEN / TRIANGULATE / REFACTOR (tasks.md lines ~113–116)
- S4 Employees pilot: `- [ ] RED: Add failing Employees assertions…` / GREEN / TRIANGULATE / REFACTOR (tasks.md lines ~133–136)
- Later verify boundary: rendered/manual geometry matrix (not apply work)

## Cleanup evidence

`/tmp/s1-red-reconstruction/s1-production.patch` was applied, its sha256 re-verified identical (`74bf29e5…608264`), then the patch and its directory were deleted (`rm` + `rmdir`, verified). No temporary files remain.

## Structured status (S1 record)

- Action context: corrective continuation, native attempt authority returned `proceed`; allowed edit surfaces honored — `git status` confirms zero changes outside the eight S1 files plus the two openspec artifacts.
- Workload forecast guard: `Decision needed before apply: Yes` / `Chained PRs recommended: Yes` / `400-line budget risk: High` — resolved by the parent's explicit single-slice assignment (`auto-chain` slice boundary: S1 only, PR 1 of 4; no `size:exception` needed, S1 is 385 lines).
- No commits made for prior progress; this is the first and only S1 commit.

## S2 structured status (current)

- Action context: parent-delegated S2-only assignment under the approved `stacked-to-main` chain (slice 2 of 4); native attempt authority `proceed`; allowed edit surfaces honored — `git status` confirms zero changes outside the six S2 files, with the openspec artifacts directory untracked/evolving.
- Workload forecast guard: resolved by the parent's explicit slice assignment (`stacked-to-main`, S2 only, PR 2 boundary); no `size:exception` needed, S2 authored diff is 293 lines ≤ 400.
- Workload gate inputs observed in tasks.md: `Decision needed before apply: Yes` / `Chained PRs recommended: Yes` / `Chain strategy: pending` → resolved by the parent prompt's approved `stacked-to-main` chain, so apply proceeded under that resolved delivery path only.
- Commit: exactly one, `41fb63b` (`feat(products): contain responsive list density pilot`); evidence revision `sha256:d15fd35681c4d29beeacd9c9208861489d37e59ed79bf64ed1b9d071e23b6653`; no push/merge/PR/S3/S4.

## S3 historical record: corrective evidence-only continuation after worker stall

The S3 apply worker completed its full strict-TDD cycle and committed, but its live stream established the facts below before the subagent stalled and its final phase envelope was lost. Independent verification then accepted the commit as-is (six-file scope, 274 changed lines, 55/55 focused tests, green build). This rerun was therefore **evidence-only**: no source diff, no new commit, no S4 work. Its single durable blocker was the missing S3 documentation in this file, which this section supplies. Prior S1/S2 records above are preserved verbatim.

### Prior worker live-stream facts (not re-executed, reported as established)

- RED was authored first, before any production change (tests-only edit), per strict TDD.
- GREEN passed **52/52** focused tests after the minimum Customers containment implementation.
- TRIANGULATE extended to **55/55** focused tests; REFACTOR then consolidated local duplication within the Customers files only; all green.
- Exactly one commit was authored: `62e2a3b` — `feat(customers): contain responsive list density pilot` (full hash `62e2a3b2eb1f4200a31f7e1801d771a2d5723639`), evidence revision `sha256:b6baf964946f2c33835d061b729cdab3869228159b96fc98d3780511b48c93d2` (sha256 over the full commit hash, same formula as S1/S2).
- The final phase envelope was lost when the subagent stalled post-commit; the commit itself was intact.

### Independent verifier recovery evidence (accepted, not amended)

- Commit scope: exactly six files (3 production + 3 co-located test files), **257 additions + 17 deletions = 274 changed lines** ≤ 400 budget.
- Focused S3 suite and build were independently confirmed green before this continuation.
- The commit was NOT changed, amended, rebased, or reverted; `git log`/`git show --stat` re-confirmed it at HEAD.

### Reconstructed RED evidence (durably reproduced in this continuation — clearly labeled as reconstruction, not fabrication)

Method: checksum + patch-save the three S3 production files at HEAD, temporarily restore **only those three production files** to `62e2a3b^` (`git checkout 62e2a3b^ -- <3 paths>`), keep the current committed S3 tests untouched, run the exact focused S3 command, then restore the three production files byte-identically to HEAD and prove the worktree clean.

| Step | Evidence |
|---|---|
| HEAD checksums saved | `CustomersView.vue a8142baaa962360b89c9ee5ce7564b97f9935e8e423ea2ca7c152fcd5a260072`, `CustomerCardGrid.vue 9d2d2494ea19b1a9032666f6dc7b48b9726f1840c7ab999b385a046deb8f8afb`, `CustomerCard.vue 3a2d402793f7414add808506746f61487e6c3c83e1f46f9da8dcd43bae097809` |
| Production patch saved | `/tmp/s3-red-reconstruction/s3-production.patch` — 128 lines, sha256 `e3255fe5db3d9ff57cda6916d938a1815e0c3241413738bc1d77bdc6e3bd8cd1` |
| RED command | `pnpm test:unit --run src/features/POS/customers/views/__tests__/CustomersView.test.ts src/features/POS/customers/components/__tests__/CustomerCardGrid.spec.ts src/features/POS/customers/components/__tests__/CustomerCard.spec.ts` |
| RED result | **6 failed / 49 passed (55 total)**, 3 test files failed — exactly the six S3 contract assertions: CustomersView route root removes duplicate mobile outer gutter while retaining desktop padding (legacy `px-10` root lacks `w-full min-w-0 md:px-10`) ×1; surface/inner-body containment ×1; CustomerCardGrid available-width auto-fit grid on skeleton and card states ×1; empty-state containment without horizontal scroll class ×1; CustomerCard shrinkable root within grid track ×1; price-list chip row constrained + badge label truncation ×1. All 49 non-S3 assertions (table scroll/pinned-action contracts, permissions, routing, kebab propagation, pagination, persistence) still passed at RED by design. Planning artifacts, tests, and commit history were never touched. |
| Restoration | `git checkout HEAD -- <3 production paths>`; post-restore sha256sums diff-compared against the saved HEAD checksums → **BYTE-IDENTICAL ✓** |
| Worktree clean | `git status --porcelain` → only the untracked `openspec/changes/mobile-dashboard-list-density/` directory; zero modified files |

### Post-restoration final results (re-run in this continuation)

- Focused S3 suite (same exact command): **3 files passed, 55/55 tests passed** (2.34s; repeat run confirmed `Tests 55 passed (55)`).
- Build gate: `pnpm build` (vue-tsc --build + vite build) → **success**, `✓ built in 12.98s` (pre-existing chunk-size warning only).
- Full suite: **not run** — the parent explicitly scoped this corrective continuation to the focused S3 suite only.

### S3 Authored line count

| Files | Lines (+add / −del) |
|---|---|
| `CustomersView.vue` | 6 + / 3 − |
| `CustomersView.test.ts` | 84 + / 1 − |
| `CustomerCardGrid.vue` | 15 + / 9 − |
| `CustomerCardGrid.spec.ts` | 60 + / 0 − |
| `CustomerCard.vue` | 5 + / 4 − |
| `CustomerCard.spec.ts` | 87 + / 0 − |
| **Total authored S3** | **257 + 17 = 274 ≤ 400 budget** |

### S3 Rollback boundary

Revert exactly the six S3 files on commit `62e2a3b2eb1f4200a31f7e1801d771a2d5723639`: `CustomersView.vue`, `CustomerCardGrid.vue`, `CustomerCard.vue` plus their three co-located test files. The commit touches only these files; reverting removes the Customers containment pilot without touching S1 shared primitives, the S2 Products pilot, S4, APIs, routes, permissions, or table models.

### S3 Files changed (all within allowed surfaces)

- `src/features/POS/customers/views/CustomersView.vue` (M)
- `src/features/POS/customers/views/__tests__/CustomersView.test.ts` (M)
- `src/features/POS/customers/components/CustomerCardGrid.vue` (M)
- `src/features/POS/customers/components/__tests__/CustomerCardGrid.spec.ts` (M — extended in commit)
- `src/features/POS/customers/components/CustomerCard.vue` (M)
- `src/features/POS/customers/components/__tests__/CustomerCard.spec.ts` (NEW in commit)

### S3 Invariants preserved (asserted in the 55 green tests)

- Table scrolling remains owned by the rendered Nuxt UI table region from S1; card mode introduces no horizontal-scroll class anywhere (route root, grid, empty state, cards) — asserted negative for `overflow-x-auto`.
- Sticky/pinned right `actions` column and existing table action contracts hold in both display modes; customer data, route, and permission behavior unchanged.
- **No Filters slot was invented** — the S3 GREEN task constraint was honored; toolbar/search/sort/pagination wiring untouched.
- Card mode is overflow-free by containment (`w-full min-w-0 max-w-full` root, shrinkable grid tracks, truncated badge/long-name/email/phone/date/price-list labels); kebab stays actionable beside long content with propagation guards; semantic light/dark surface classes and rounded treatment preserved; no cross-pilot abstraction introduced.

### S3 Runtime / manual geometry

Runtime harness: **N/A** — jsdom cannot prove rendered geometry; no fake geometry claims were made. The 360/412/740 browser matrix, `scrollWidth <= clientWidth` checks, and sticky-action extremes are **deferred to the later verify boundary** per tasks.md, matching S1/S2 precedent.

### S3 Deviations from design

None reported by the prior worker's live stream; the committed tests assert the design-mandated contracts (dashboard-owned mobile gutter with retained desktop padding, available-width `auto-fit/minmax` grid, shrinkable card roots, no Filters slot, no cross-pilot abstraction), and independent verification accepted the implementation.

### S3 TDD Cycle Evidence (consolidated)

| Step | Source | Result |
|---|---|---|
| RED (authored) | Prior worker live stream | Tests authored first; production untouched |
| RED (reconstructed, durable) | This continuation | **6 failed / 49 passed (55 total)** — exactly the six S3 contract assertions |
| GREEN | Prior worker live stream | **52/52** focused tests passed |
| TRIANGULATE | Prior worker live stream | **55/55** focused tests passed (long names/email/phone/dates/price-list labels, loading/error/empty/pagination/persistence, card click + kebab propagation, edit/delete/history permissions, table actions, no card-mode horizontal-scroll workaround) |
| REFACTOR | Prior worker live stream | Local Customers-only duplication cleanup; behavior unchanged; all green |
| Post-restoration GREEN re-check | This continuation | **3 files, 55/55 passed** (byte-identical HEAD restore) |
| Build | This continuation | `pnpm build` success, `✓ built in 12.98s` |

### S3 No-op guarantees of this continuation

- **No new commit** — HEAD remains `62e2a3b2eb1f4200a31f7e1801d771a2d5723639`; nothing amended.
- **No source diff** — production and test files restored byte-identically (checksum-proven); `git status` clean apart from the untracked openspec artifacts.
- **No S4** — zero Employees files touched; tasks.md S4 checkboxes remain `- [ ]`.
- Tasks.md verified: S1–S3 (lines 69–72, 93–96, 117–120) `- [x]`; S4 (lines 141–144) `- [ ]` — no drift, no state change needed.

### S3 Cleanup/process evidence

- `/tmp/s3-red-reconstruction/` (patch + checksum file) deleted with `rm -rf`; removal verified (`ls` confirms absent). No temporary files remain.
- `git status` after restoration: only untracked `openspec/changes/mobile-dashboard-list-density/` (evolving artifacts, deliberately not committed per instruction).
- Evidence revision `sha256:b6baf964946f2c33835d061b729cdab3869228159b96fc98d3780511b48c93d2` computed over `62e2a3b2eb1f4200a31f7e1801d771a2d5723639` (formula validated by reproducing the S2 value `d15fd356…b6653` from `41fb63b651e4…` first).

### S3 structured status (current)

- Action context: corrective evidence-only continuation, native attempt authority returned `proceed` (parent token `sha256:eba73a271a9eaf676a960c68acedaddac8274e5e6075353b010918dc48d21eb8`); allowed edit surfaces honored — `git status` confirms zero changes outside the openspec artifacts; only `apply-progress.md` was edited in this continuation.
- Workload forecast guard: resolved by the parent's explicit evidence-only slice assignment under the approved `stacked-to-main` chain (slice 3 of 4, PR 3 boundary); commit already independently verified at 274 lines ≤ 400; no `size:exception` needed.
- Skill resolution: `paths-injected` (vue-best-practices, ui-ux-pro-max, work-unit-commits, chained-pr all loaded from injected paths).
- Status: **S3 COMPLETE** (commit `62e2a3b`, evidence `sha256:b6baf964…c93d2`). Remaining: S4 Employees pilot (untouched) and the later verify boundary for the manual geometry matrix.

## S4 historical record: maintainer-approved S4a/S4b split after original S4 exceeded budget

The original S4 plan (six files, ~620 lines) exceeded the 400-line review budget. The maintainer approved splitting it into **S4a** (Employees route surface + card grid, ~333 lines) and **S4b** (EmployeeCard + spec, ~290 lines) **without `size:exception`**. A prior S4 apply worker timed out, leaving uncommitted partial changes in all six S4 files on branch `feat/mobile-dashboard-list-density-s4-employees`. This continuation performed the branch surgery, completed S4a strict TDD, committed S4a, and restored the S4b partials onto a stacked child branch.

### Branch topology performed

| Step | Evidence |
|---|---|
| 1. Branch rename | `git branch -m feat/mobile-dashboard-list-density-s4a-employees-surface` — verified via `git branch --show-current` |
| 2. S4b isolation | `git stash push -u -m "s4b-employee-card-partial" -- <EmployeeCard.vue> <__tests__/EmployeeCard.spec.ts>`. Pre-stash checksums recorded: `EmployeeCard.vue sha256:11763cfe6ee55dcf7f0edc9adf758e21502edc63a1202726cf64066e631e0720`, `EmployeeCard.spec.ts sha256:7d37cdfe4ce450b8a33d251fad371cc65f50a6fdb2a8445dbdf85b8f5d11059e` (saved to `/tmp/s4b-isolation/pre-stash-checksums.txt`). Post-stash `git status --porcelain` showed only the four S4a files; stash@{0} confirmed. |
| 3. S4a commit | `81a8c29` — `feat(employees): contain responsive list surface and grid` — exactly 4 files, 327 additions + 6 deletions = **333 changed lines ≤ 400** |
| 4. S4b child branch | `git checkout -b feat/mobile-dashboard-list-density-s4b-employee-card` from the S4a commit, then `git stash pop` |
| 5. Restoration proof | Post-pop checksums byte-identical to pre-stash checksums (diff-compared ✓); `EmployeeCard.vue` modified + `EmployeeCard.spec.ts` untracked, **uncommitted** as intended; stash entry dropped |
| 6. Cleanup | `/tmp/s4b-isolation/` removed; `/tmp/s4a-red-reconstruction/` removed after byte-identical restoration was proven. Final state: on `feat/mobile-dashboard-list-density-s4b-employee-card` with only the two S4b files + untracked openspec artifacts in `git status`. No push, no merge, no PR. |

### S4a TDD Cycle Evidence (RED reconstructed truthfully after worker timeout)

| Step | Command / action | Result |
|---|---|---|
| RED (reconstructed) | Checksummed the two S4a production files (`EmployeesListView.vue sha256:4d1b52d8…, EmployeeCardGrid.vue sha256:9e893b09…`), patch-saved their diff (`/tmp/s4a-red-reconstruction/s4a-production.patch`, 76 lines, sha256 `0f00877b0c00b897dde84a110ed719095fa8b14ab88920f7184832baa024ad21`), `git checkout HEAD --` both files (S3 base `62e2a3b`) while keeping the S4a tests and S4b isolated, then ran `pnpm test:unit --run src/features/admin/employees/views/__tests__/EmployeesListView.test.ts src/features/admin/employees/components/__tests__/EmployeeCardGrid.spec.ts` | **8 failed / 45 passed (53 total)**. All 8 failures are S4a production-contract failures in the two S4a test files: grid available-width auto-fit contract (skeleton+cards) ×1, empty-state containment ×1, long-name grid containment ×1, skeleton testid placeholders ×3 (new testids absent from reverted production), view route-root gutter ×1, view surface/body containment ×1. Tests and planning artifacts were never reverted; S4b files were already stashed away. |
| Restore | `git apply /tmp/s4a-red-reconstruction/s4a-production.patch`; post-restore sha256 diff-compared against pre-RED checksums | **BYTE-IDENTICAL ✓**; temp dir deleted and verified absent |
| GREEN | Same focused two-file command | **2 files passed, 53/53 tests passed** (2.98s) |
| TRIANGULATE | Same focused command (coverage verified present in the preserved test surface) | Long employee names, skeleton/data/empty grid states, persisted card mode, permission-flag forwarding, pinned-actions contract, status filter sheet, negative `overflow-x-auto` assertions on route root/grid/empty state; table scroll extremes stay contract-level (`columnPinning` right `['actions']`), no jsdom geometry. **53/53 green.** |
| REFACTOR | Manual inspection + lint hook | Grid class string already consolidated into the `gridClasses` script constant in `EmployeeCardGrid.vue` (no-shared-wrapper rationale documented inline); no other duplication within the four S4a files. Behavior unchanged; **53/53 still green** (GREEN re-run is the identical suite). |

### S4a Verification

- Focused S4a suite: `pnpm test:unit --run <EmployeesListView.test.ts + EmployeeCardGrid.spec.ts>` → **2 files, 53/53 passed**.
- Existing Employees list/card-view coverage not requiring S4b: `pnpm test:unit --run src/features/admin/employees/views/__tests__/EmployeesListView.batch.spec.ts src/features/admin/employees/__tests__/wu03-card-view.spec.ts src/features/admin/employees/composables/__tests__/useEmployeeViewMode.test.ts src/features/admin/employees/composables/__tests__/useEmployeeColumns.test.ts` → **4 files, 59/59 passed**.
- Build gate (run while S4b changes were isolated): `pnpm build` (vue-tsc --build + vite build) → **success**, `✓ built in 12.94s` (pre-existing chunk-size warning only).
- Full suite: **not run** — final sdd-verify owns it per the delegated task.
- Runtime harness: **N/A** — jsdom cannot prove rendered geometry; no geometry claims made. The 360/412/740 browser matrix, `scrollWidth <= clientWidth` checks, and sticky-action extremes remain in the later verify boundary.

### S4a Authored line count

| Files | Lines |
|---|---|
| `EmployeesListView.vue` | 6 + / 6 − (net 0-class swap within template) |
| `EmployeesListView.test.ts` | 90 + / 0 − |
| `EmployeeCardGrid.vue` | 16 + / 6 − |
| `EmployeeCardGrid.spec.ts` (NEW) | 221 + / 0 − |
| **Total authored S4a (commit `81a8c29`)** | **327 additions + 6 deletions = 333 ≤ 400 budget** |

### S4a Rollback boundary

Revert exactly the four S4a files on commit `81a8c29d79a1a95c357d71d0fcd79b0449552000`: `EmployeesListView.vue`, `EmployeesListView.test.ts`, `EmployeeCardGrid.vue`, `EmployeeCardGrid.spec.ts`. The commit touches only these files; reverting removes the Employees route-surface/grid containment without touching S1 shared primitives, S2/S3 pilots, the S4b card slice (which lives as uncommitted changes on its own child branch), APIs, routes, permissions, or table models.

### S4a Invariants preserved (asserted in the 53 green tests)

- Dashboard-owned mobile outer gutter: route root drops `px-4 sm:px-6` and carries `py-3 md:px-6 lg:px-8` + `w-full min-w-0` (asserted positive and negative).
- Contained surface (`w-full min-w-0 max-w-full overflow-hidden shadow-sm`) and inner body (`px-3 py-3 sm:px-4 sm:py-4` compact spacing).
- Available-width `auto-fit/minmax` grid on skeleton, data, and empty states; viewport ladder (`sm:grid-cols-2 … 2xl:grid-cols-7`) intentionally retired for this grid.
- Status filter sheet (FilterSectionCard "Estado" + `employee-filters`), three mobile toolbar regions, batch selection, card-click → detail navigation (never edit), permission gating (`canUpdate`/`canCreate` forwarding), persisted card mode, and pagination/table models all covered by passing pre-existing + new assertions.
- Table scrolling remains owned by the rendered Nuxt UI table region; `columnPinning` right `['actions']` holds in both modes; card mode and route root asserted free of `overflow-x-auto`.
- No jsdom geometry claim anywhere; no card-mode horizontal-scroll workaround introduced.

### S4a Deviations from design

None beyond the maintainer-approved split itself: S4a contains only the route-surface and grid portions of the original S4 design; the card containment portion is deferred to S4b by that decision. Implementation matches design §1 (gutter removal, retained `py-3`/desktop progression) and §4 (available-width grid, no shared wrapper).

### Remaining tasks

- **S4b** Employee card + tests: `- [ ] RED/GREEN/TRIANGULATE/REFACTOR` under **S4b** in tasks.md (partial changes restored uncommitted on `feat/mobile-dashboard-list-density-s4b-employee-card`; `EmployeeCard.spec.ts` carries a known pi-lens TS2307 to resolve in that unit).
- Later verify boundary: rendered/manual geometry matrix (not apply work).

### S4a Structured status

- Action context: parent-delegated S4a-only assignment with native attempt authority `proceed` (parent token `sha256:e3d92c2b1c2c9a71cdee2bd1f2a57e50f305d825b42f03f9eba6690dcdbfbd05`); allowed edit surfaces honored — `git status` at commit time showed exactly the four S4a files staged, with S4b files isolated and openspec artifacts untracked/evolving (never committed).
- Workload gate inputs observed in tasks.md: `Decision needed before apply: Yes` / `Chained PRs recommended: Yes` / `400-line budget risk: High` — resolved by the maintainer-approved split delivered in the parent prompt (`chained` mode: S4a slice on its own branch, S4b stacked child branch; no `size:exception` needed, S4a is 333 lines).
- Skill resolution: `paths-injected` (vue-best-practices, ui-ux-pro-max, work-unit-commits, chained-pr loaded from injected paths).
- Status: **S4a COMPLETE** — commit `81a8c29` (`feat(employees): contain responsive list surface and grid`), evidence revision `sha256:91ce0903b7254696bb4a25d86e8adb4fe7575aa37e64bae5d4096c065c5de6d4` (sha256 over the full commit hash, same formula as S1–S3). Currently on `feat/mobile-dashboard-list-density-s4b-employee-card` with S4b partials restored uncommitted for the next work unit.

## S4b record: employee card containment (child branch, stacked on S4a) — COMPLETE

Continuation applying only split work unit S4b on branch `feat/mobile-dashboard-list-density-s4b-employee-card` (based on green S4a commit `81a8c29`). The two S4b files arrived as preserved uncommitted partials from the timed-out original S4 worker; pre-work checksums matched the S4a-era pre-stash record byte-for-byte (`EmployeeCard.vue sha256:11763cfe6ee55dcf7f0edc9adf758e21502edc63a1202726cf64066e631e0720`, `EmployeeCard.spec.ts sha256:7d37cdfe4ce450b8a33d251fad371cc65f50a6fdb2a8445dbdf85b8f5d11059e`), proving the partials were intact before any edit.

### TS2307 disposition (resolved: stale pi-lens, not a real path/config issue)

The reported TS2307 in `EmployeeCard.spec.ts` did **not** reproduce. Verification: `@nuxt/ui@4.6.0`'s package exports map contains `"./components/*" → "./dist/runtime/components/*"`, and `DropdownMenu.vue`, `Button.vue`, and `Icon.vue` all exist under `node_modules/@nuxt/ui/dist/runtime/components/` (checked on disk). The identical mock-path pattern is already committed and green in `CustomerCard.spec.ts` and `EmployeeCardGrid.spec.ts`. `pnpm build` (vue-tsc --build + vite build) passed with no TS errors, proving TypeScript resolves all three imports. Conclusion: the error was a stale pi-lens TS server state, not a repository problem. No test or config change was made for it.

### S4b TDD Cycle Evidence (RED reconstructed truthfully after worker timeout)

| Step | Command / action | Result |
|---|---|---|
| RED (reconstructed) | Checksummed both S4b files (values above), patch-saved the `EmployeeCard.vue` diff (`/tmp/s4b-red-reconstruction/s4b-production.patch`, 41 lines, sha256 `ff358efb8232bfad53e34126c4c2b28b3acee276e9179a0772e8304322daca00`), `git checkout HEAD --` only `EmployeeCard.vue` (S4a state) while keeping `EmployeeCard.spec.ts`, then ran `pnpm test:unit --run src/features/admin/employees/components/__tests__/EmployeeCard.spec.ts` | **7 failed / 11 passed (18 total)**. All 7 failures are exactly the S4b contract assertions: card-root `w-full min-w-0 max-w-full` ×1, chip-row testid + containment ×2, modality/seniority `truncate` ×1, kebab-wrapper testid/truncation contracts ×1, long-content triangulation ×1, kebab propagation via testid ×1. The 11 passes are pre-existing behavior tests (rendering, avatar seed, status label, click emit, kebab visibility/actions). Tests and planning artifacts were never reverted. |
| Restore | `git apply /tmp/s4b-red-reconstruction/s4b-production.patch`; post-restore sha256 diff-compared against the pre-RED checksum | **BYTE-IDENTICAL ✓** (`11763cfe…e0720` reproduced exactly); 5+/5− diff restored |
| GREEN | Same focused command | **1 file passed, 18/18 tests passed** (2.05s) |
| TRIANGULATE | Same focused command (coverage verified present in the preserved test surface) | Long name/position/department/manager/modality values render inside the shrinkable card without `overflow-x-auto` (never jsdom geometry); DotBadge `truncate`/`compact` props constrain the department label inside the contained chip row; seniority + em-dash manager fallback render without breaking containment; kebab stays absolutely pinned and propagation-guarded beside long content; permission-gated kebab items (Editar + Dar de baja / Reactivar, no error color, canUpdate gating). **18/18 green.** |
| REFACTOR | Manual inspection of both S4b files, then same focused command | No edit required: the production diff is 5 class-only lines with no duplication; the spec already factors `makeEmployee`/`mountCard`/`getKebabItems` helpers, and the 4 repeated `overflow-x-auto` negative assertions are distinct intentional contract assertions in different contexts (root, chip row, long content, fallback), not extractable duplication. Semantic theme tokens (`border-default`, `bg-default`, `text-highlighted`, `text-muted`, `text-default`) and rounded treatment preserved. **18/18 still green** (1.94s). |

### S4b Verification

- Focused S4b suite: `pnpm test:unit --run src/features/admin/employees/components/__tests__/EmployeeCard.spec.ts` → **1 file, 18/18 passed**.
- Integration coverage: `pnpm test:unit --run src/features/admin/employees/views/__tests__/EmployeesListView.test.ts src/features/admin/employees/components/__tests__/EmployeeCardGrid.spec.ts src/features/admin/employees/views/__tests__/EmployeesListView.batch.spec.ts src/features/admin/employees/__tests__/wu03-card-view.spec.ts src/features/admin/employees/__tests__/wu05b-edit-terminate-reactivate-ui.spec.ts src/features/admin/employees/composables/__tests__/useEmployeeViewMode.test.ts src/features/admin/employees/composables/__tests__/useEmployeeColumns.test.ts` → **7 files, 161/161 passed** — proves S4a route/grid + batch + card-view + kebab UI + composables integrate with the S4b card changes.
- Build gate: `pnpm build` (vue-tsc --build + vite build) → **success**, `✓ built in 13.43s` (pre-existing chunk-size warning only).
- Full suite: **not run** — final sdd-verify owns it per the delegated task.
- Runtime harness: **N/A** — jsdom cannot prove rendered geometry; no geometry claims made. The 360/412/740 browser matrix, `scrollWidth <= clientWidth` checks, and sticky-action extremes remain in the later verify boundary.

### S4b Authored line count

| Files | Lines |
|---|---|
| `EmployeeCard.vue` | 5 + / 5 − (class/testid-only template diff) |
| `EmployeeCard.spec.ts` (NEW) | 280 + / 0 − |
| **Total authored S4b (commit `d4bdaf0`)** | **285 additions + 5 deletions = 290 ≤ 400 budget** |

### S4b Rollback boundary

Revert exactly the two S4b files on commit `d4bdaf056871bb10861aa84d512b6f852fd0ec5e`: `EmployeeCard.vue` and `EmployeeCard.spec.ts`. The commit touches only these files; reverting removes the EmployeeCard containment without touching S4a route/grid work, S1–S3 pilots, APIs, routes, permissions, or table models.

### S4b Invariants preserved (asserted in the 18 green tests)

- Card root carries `w-full min-w-0 max-w-full` (shrinkable within its grid track) and never gains `overflow-x-auto` (asserted negative in four contexts).
- Chip row (`data-testid="card-chip-row"`) is `min-w-0 max-w-full`; department label truncates through DotBadge `truncate`/`compact` props rather than widening the row.
- Field-specific truncation: modality and seniority `truncate` in their two-column cells (new in this unit); name `truncate`, position `line-clamp-1`, manager/date `truncate` (pre-existing contracts asserted).
- Kebab wrapper (`data-testid="kebab-wrapper"`) stays `absolute right-3 top-3 z-10` with `@click.stop` propagation guard; card click still emits `click` with the employee; kebab never triggers card navigation.
- Permissions intact: kebab hidden when `canUpdate` is false; Editar/Dar de baja/Reactivar items gated by status via `getEmployeeRowActions`.
- Semantic Coco light/dark tokens (`border-default`, `bg-default`, `text-highlighted`, `text-muted`, `text-default`, `text-highlighted`) and rounded-xl surface preserved; status department badges flow through the shared `StatusDotBadge`/`DotBadge` components.
- No table behavior changes; no jsdom geometry assertions anywhere in the spec.

### S4b Deviations from design

None in code. One planning-metadata note: the parent delegated task directed the commit message `feat(employees): contain responsive employee cards`, which supersedes the older tasks.md commit metadata string (`feat(employees): contain employee card within grid track`); tasks.md was not retro-edited for that metadata line since the authoritative instruction was the parent's.

### Remaining tasks

- **All 20 implementation tasks across S1, S2, S3, S4a, and S4b are checked** in tasks.md (verified: 0 unchecked `- [ ]` lines).
- Later verify boundary: rendered/manual geometry matrix (not apply work) — full suite, browser 360/412/740 matrix, both modes/themes, sticky-action extremes.

### S4b Cleanup/process evidence

- `/tmp/s4b-red-reconstruction/` (patch + checksum + failure-capture files) deleted with `rm -rf`; removal verified (`ls` confirms absent). No temporary files remain.
- `git status` after commit: only the untracked `openspec/changes/mobile-dashboard-list-density/` directory remains (evolving artifacts, deliberately not committed per instruction); zero stray modified files; both S4b files committed, nothing else touched.
- Commit authored exactly once (`d4bdaf0`); no amend of earlier commits, no push, no merge, no PR, no final verify, no full suite.
- Evidence revision `sha256:402514b65a5c5810afda204252f6ae688fdfb7e2261c1dc497fdb87e4bbc3ff5` computed over the full commit hash `d4bdaf056871bb10861aa84d512b6f852fd0ec5e` (same formula as S1–S4a).

### S4b structured status (current)

- Action context: parent-delegated S4b-only assignment with native attempt authority `proceed` (parent token `sha256:c745fb2b5c5e7d9bc47c8be8ae45f8b4fde0789fc6dccfbf581c83730f343482`); allowed edit surfaces honored — `git status` at commit time showed exactly the two S4b files staged, with openspec artifacts untracked/evolving (never committed).
- Workload gate inputs observed in tasks.md: `Decision needed before apply: Yes` / `Chained PRs recommended: Yes` / `400-line budget risk: High` — resolved by the parent's explicit single-slice assignment (stacked child branch S4b, PR boundary = S4b only; no `size:exception` needed, S4b is 290 lines).
- Skill resolution: `paths-injected` (vue-best-practices, ui-ux-pro-max, work-unit-commits, chained-pr loaded from injected paths).
- Status: **S4b COMPLETE** — commit `d4bdaf0` (`feat(employees): contain responsive employee cards`), evidence revision `sha256:402514b65a5c5810afda204252f6ae688fdfb7e2261c1dc497fdb87e4bbc3ff5`. All implementation slices S1–S4b done; remaining work is the later verify boundary (owned by sdd-verify).
