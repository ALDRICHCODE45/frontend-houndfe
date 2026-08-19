```yaml
schema: gentle-ai.archive-result/v1
archive_date: 2026-08-18
change: sale-detail-redesign
mode: openspec
branch: feat/sale-detail-redesign
head: cf0e26384bbc3199b2e0c3a9fe03c86ac7155faa
target: main
status: success
verdict: pass_with_warnings

blockers: 0
critical_findings: 0
warnings: 2
suggestions: 2

requirements_synced: 8
scenarios_synced: 19
modified_requirements: 0
removed_requirements: 0
renamed_requirements: 0
modified_deferred: 1   # MODIFIED HST-REQ-008 (depends on sales-history-coco)

test_command: pnpm test:unit --run
test_exit_code: 0
build_command: pnpm build
build_exit_code: 0

delta_path_applied: openspec/changes/sale-detail-redesign/specs/sales/spec.md
canonical_spec_path: openspec/specs/sales/spec.md
sync_strategy: Path B
sync_strategy_reason: canonical sales/spec.md did not contain HST-REQ-001..008 at archive time; sales-history-coco is in-flight (folder never moved to openspec/changes/archive/). MODIFIED HST-REQ-008 carve-out deferred to that change's archive.
```

# Archive Report: sale-detail-redesign

## Summary

`feat/sale-detail-redesign` is closed. The 4-WU `UTabs`-removal + flat-grid redesign landed on the branch (commits `befc69a`, `645667d`, `75bf03b`, `cf0e263`); the final test suite is 4369/4369 green (`pnpm test:unit --run`, exit 0) and `pnpm build` is clean. 8 new ADDED requirements (REQ-LAYOUT-001..008) were appended to canonical `openspec/specs/sales/spec.md`; the MODIFIED HST-REQ-008 carve-out was deferred because the in-flight `sales-history-coco` change has not yet archived its HST-REQ-001..008 block. The change folder was moved to `openspec/changes/archive/2026-08-18-sale-detail-redesign/` with a byte-identical `diff -r` readback.

## Final State (per Final-State Authority)

Ranked sources — most authoritative first:

1. Orchestrator's launch prompt (pre-resolved final-state facts, post-`verify-report` account).
2. The persisted tasks artifact at archive time (after the mechanical reconciliation below).
3. `verify-report` engram #3582 (intermediate snapshot, 2026-08-18 18:06:06) and `apply-progress` engram #3580 (2026-08-18 16:26:38).

| Metric | Value | Source rank |
|---|---|---|
| Branch | `feat/sale-detail-redesign` (not merged, not pushed) | orchestrator prompt |
| HEAD | `cf0e26384bbc3199b2e0c3a9fe03c86ac7155faa` (post `verify-report`, no new commits) | `git rev-parse HEAD` at archive time |
| Verdict | `pass_with_warnings` (0 CRITICAL, 2 WARN, 2 SUGGEST) | verify-report #3582 |
| Build | `pnpm build` exit 0 (vue-tsc + vite build) | verify-report #3582 |
| Tests | 4369/4369 PASS, 294 test files, 0 skipped | verify-report #3582 |
| Requirements covered | 9/9 (8 REQ-LAYOUT + 1 MODIFIED HST-REQ-008) | verify-report #3582 |
| Scenarios covered | 19/19 | verify-report #3582 |
| WUs landed | 4/4 (all conventional-commits, no AI attribution) | apply-progress #3580 |
| `sale-detail-tabs` removed | 0 matches in `src/**` (per `git grep`) | verify-report #3582 |
| `sm:hidden` removed from view | 0 matches in `SaleDetailView.vue` | verify-report #3582 |
| `productApi` removed from view | 0 matches in `SaleDetailView.vue` | verify-report #3582 |
| HST-REQ-002/003/004/006/007 class strings | byte-identical at named call sites | verify-report #3582 |
| 8 untouched components | zero diff | apply-progress #3580 |

## Lineage (commit SHAs)

| WU | SHA | Message |
|---|---|---|
| WU-A | `befc69a` | `feat(sales): add SaleDetailSalesDataCard component` |
| WU-B | `645667d` | `feat(sales): add SaleDetailHistoryCard wrapper` |
| WU-C | `75bf03b` | `refactor(sales): flatten sale detail view, drop UTabs, label Comprobante trigger` |
| WU-D | `cf0e263` | `test(sales): update sale detail view tests for flat layout` |
| (this commit) | _to be assigned by `git commit`_ | `docs(sales): archive sale-detail-redesign change folder artifacts` |

The four WUs are linear and dependent: WU-A + WU-B (foundational, independent) → WU-C (mounts both) → WU-D (test-contract pin). TDD was strict per init envelope #778.

## Files Affected (cumulative, this PR)

| File | Action | Lines |
|---|---|---|
| `src/features/POS/sales/views/SaleDetailView.vue` | modify | −156 / +49 |
| `src/features/POS/sales/views/__tests__/SaleDetailView.test.ts` | modify | +166 / −4 |
| `src/features/POS/sales/components/SaleDetailSalesDataCard.vue` | create | +102 |
| `src/features/POS/sales/components/__tests__/SaleDetailSalesDataCard.test.ts` | create | +196 |
| `src/features/POS/sales/components/SaleDetailHistoryCard.vue` | create | +38 |
| `src/features/POS/sales/components/__tests__/SaleDetailHistoryCard.test.ts` | create | +101 |
| `openspec/changes/sale-detail-redesign/*` | archive | moved to `changes/archive/2026-08-18-sale-detail-redesign/` |
| `openspec/specs/sales/spec.md` | sync | +164 / −1 (8 new REQ-LAYOUT + 1 new delta-line) |
| `openspec/changes/sale-detail-redesign/tasks.md` | reconcile | 53 sub-tasks `- [ ]` → `- [x]` (see Reconciliation) |

Implementation diff: 652 insertions / 160 deletions (812 changed lines, per verify-report #3582). The 400-line single-PR budget was exceeded by ~59% over the recorded forecast (~512). The `size:exception` was approved by the maintainer (engram #3568, 2026-08-18 15:35:45) before `sdd-apply` launched; the PR body should reference the true 812-line figure.

8 untouched components (zero diff): `SaleDetailItemsList`, `SaleDetailTotalsCard`, `PaymentsListSection`, `SaleDetailTimeline`, `SaleCommentInput`, `SaleCommentSlideover`, `DebtPaymentModal`, `AssignSellerSlideover`.

## Spec Sync (Path B)

Path A vs Path B was decided by `grep -n "HST-REQ-" openspec/specs/sales/spec.md` → 0 matches, confirming canonical did not contain HST-REQ-001..008. The in-flight `sales-history-coco` folder still has its `archive-report.md` but was never moved to `openspec/changes/archive/`, so its HST-REQ block has not landed. Per the design-phase and spec-phase flagging, the MODIFIED HST-REQ-008 carve-out is therefore **deferred**.

| Action | Count | Details |
|---|---|---|
| ADDED | 8 | REQ-LAYOUT-001..008 appended to `openspec/specs/sales/spec.md` immediately before the `---` separator and the existing delta-applied line for `sales-pos-charge`. |
| MODIFIED | 0 | HST-REQ-008 carve-out deferred — see Carry-Forward #1. |
| REMOVED | 0 | None. |
| RENAMED | 0 | None. |

Closing delta-history line appended to canonical:
> *Delta REQ-LAYOUT-001..008 applied from `sale-detail-redesign` change (HEAD `cf0e263`). MODIFIED HST-REQ-008 carve-out deferred until `sales-history-coco` archives (HST-REQ-001..008 not yet in canonical).*

The 8 new requirements are byte-identical to the delta at `openspec/changes/sale-detail-redesign/specs/sales/spec.md` (REQ-LAYOUT-001..008 verbatim) — the canonical file now reflects the flat-grid contract for the `SaleDetailView` and the two extracted card components.

## Mechanical Copy Contract — readback

The folder move was performed with a single shell transaction:

```text
snapshot_root="$(mktemp -d …/sdd-archive.XXXXXX)"
cp -R openspec/changes/sale-detail-redesign "$snapshot_root/source"
mv  openspec/changes/sale-detail-redesign openspec/changes/archive/2026-08-18-sale-detail-redesign
diff -r "$snapshot_root/source" openspec/changes/archive/2026-08-18-sale-detail-redesign
```

Verbatim `diff -r` output:

```text
(empty — no differences)
```

Pass condition met: empty `diff -r` is the only passing evidence. The folder was untracked in git (no `git mv` possible), so plain `mv` was used; both the snapshot and the destination are byte-identical across `design.md`, `exploration.md`, `proposal.md`, `specs/sales/spec.md`, `tasks.md`, and `verify-report.md`. The archive-report.md was written AFTER the move and is the additive-only file per the contract.

## Task Completion Gate — exceptional reconciliation

The persisted `tasks.md` arrived at archive with 53 unchecked sub-task checkboxes (`- [ ]`) and 0 checked. The Task Completion Gate normally blocks archive on this; the strict-vs-OpenSpec policy exception for "stale checkboxes where apply-progress + verify-report prove every unchecked task is complete" applies.

**Reconciliation proof** (corroborated by all three sources):

- `git log --oneline feat/sale-detail-redesign` shows 4 WU commits: `befc69a` (WU-A), `645667d` (WU-B), `75bf03b` (WU-C), `cf0e263` (WU-D).
- `apply-progress` engram #3580 reports `COMPLETE` — "All 4 WUs committed", `pnpm test:unit: green (4369 tests, 294 files)`, `pnpm type-check: green`, `pnpm build: green`.
- `verify-report` engram #3582 verdict `pass_with_warnings` with 9/9 requirements + 19/19 scenarios PASS at runtime; 4369/4369 tests pass; build exit 0. Two non-blocking WARNs: manual browser smoke pending + size overrun (812 > 400 budget).
- The orchestrator's launch prompt explicitly states: "All preserved testids intact", "All HST-REQ-002/003/004/006/007 class strings byte-identical", "`sale-detail-tabs` removed, `sm:hidden` removed, `productApi` import removed", "Tests: 4369/4369 passing", "Build: clean".
- The verify-report per-scenario matrix in §Requirement Coverage covers every WU-A..D sub-task claim: fetch-once, priceListName states, dedupe, assign-seller emit, HistoryCard compose, Comprobante CONFIRMED/DRAFT/CANCELED, column order, testid parity, no productApi import, no sm:hidden, totals-total-value intact.

**Mechanical reconciliation performed** (one pass, no content edits):

```bash
sed -i '' -E 's/^(\s*)- \[ \]/\1- [x]/' \
  openspec/changes/sale-detail-redesign/tasks.md
```

- Pre-reconciliation: 53 unchecked `- [ ]` boxes, 0 checked.
- Post-reconciliation: 0 unchecked, 53 checked.
- `diff` output: 53 line-pairs changed, each is a verbatim `- [ ]` → `- [x]` substitution (no content edits). The acceptance checkboxes (e.g. "HST-REQ-002 class strings byte-identical") that were intentionally forward-looking now correctly reflect their realized state.

**Result**: the archived audit trail (`openspec/changes/archive/2026-08-18-sale-detail-redesign/tasks.md`) now reflects the final state — 4 work units, all sub-tasks visible as `[x]` — instead of the stale unchecked state. The reconciliation is recorded in this section per the strict-vs-OpenSpec policy.

## Verification Results (from verify-report engram #3582)

- `pnpm build` → exit 0 (vue-tsc --build clean, vite build 2313 modules in 49.00s)
- `pnpm test:unit --run` → 4369 passed, 0 failed, 0 skipped (294 test files)
- Sale-detail-scoped tests: 3 files, 40 tests, all green
- 9/9 requirements + 19/19 scenarios compliant
- All preserved testids intact; HST-REQ-002/003/004/006/007 class strings byte-identical
- `sale-detail-tabs`, `sm:hidden`, `productApi` import all removed (zero matches per `git grep`)

Execution note from verify-report: an initial full-suite run launched in parallel with `pnpm build` surfaced 2 timeouts in the unrelated `src/features/POS/products/views/__tests__/ProductDetailView.serviceType.test.ts` (5000 ms timeouts, not assertion failures). Re-running that file in isolation passed 3/3 in 8.86s, and a full-suite re-run without parallel build passed 4369/4369. These are CPU-contention flakes, outside this change's surface.

## Carry-Forwards

1. **MODIFIED HST-REQ-008 deferred until `sales-history-coco` archives** (Path B consequence). The MODIFIED carve-out for HST-REQ-008 (release the `UTabs` clause + allow the trigger `aria-label` to change from `"Más acciones"` to `"Comprobante"`) is recorded in the delta spec at `openspec/changes/sale-detail-redesign/specs/sales/spec.md` but was NOT applied to canonical during this archive, because HST-REQ-008 is not yet in canonical — it is owned by the in-flight `sales-history-coco` change, whose folder is still in `openspec/changes/sales-history-coco/` (not `openspec/changes/archive/`).
   - **Action for the user**: when ready, archive `sales-history-coco` first (its delta carries HST-REQ-001..008 ADDED + a pre-existing HST-REQ-008; Path A applies). Then re-run this archive to apply the MODIFIED HST-REQ-008 carve-out. Alternatively, fold both archives into a single future "sales-history-and-detail-coco" change.
   - **Practical impact today**: zero functional impact. The 8 REQ-LAYOUT requirements are independently enforceable, and the MODIFIED carve-out is a clarification, not a behavior change. The "Comprobante" label is already implemented and tested; the missing piece is just the canonical-spec harmonization.
2. **Manual browser smoke pending** (WARN #1 from verify-report). The user must verify in `/pos/ventas/:id` for CONFIRMED / DRAFT / CANCELED sales + mobile (<lg) viewport, confirming: flat grid renders; 5 DATOS sub-cards; HISTORIAL timeline + composer; "Comprobante" label visible on CONFIRMED; DRAFT trigger disabled with tooltip; CANCELED icon-only; mobile stacking order has right column above left.
3. **Pre-existing folder hygiene**: `openspec/changes/` still contains 12+ unarchived changes (`sales-history-coco`, `sales-layout-redesign`, `sales-payment-coco`, `employees-batch-operations`, `pos-price-list-tiers`, `products-catalog-coco`, `promotions-batch-activate`, `promotions-batch-end`, `quotations-crud`, `quotations-ui-redesign`, `sales-view-coco-redesign`, and the recently-archived `sales-pos-charge` whose folder was left in place per repo convention). This change did NOT touch them — out of scope. The user may want a housekeeping pass to bulk-archive the in-flight ones (especially `sales-history-coco`, which is the carry-forward dependency for HST-REQ-008).

## Next Steps

1. The user pushes `feat/sale-detail-redesign` to remote (not done by this archive).
2. The user opens a PR or merges to `main` directly (their workflow).
3. **If Path B carry-forward is desired**: the user archives `sales-history-coco` (its delta is in `openspec/changes/sales-history-coco/specs/sales/spec.md` and needs to land in canonical first), then re-runs this archive to apply the MODIFIED HST-REQ-008 carve-out. Otherwise, the carve-out remains a documented design intent with no canonical reflection.
4. The user runs the manual browser smoke checklist in Carry-Forward #2.

## Archive Contents (post-move)

- `openspec/changes/archive/2026-08-18-sale-detail-redesign/proposal.md` — 99 lines
- `openspec/changes/archive/2026-08-18-sale-detail-redesign/exploration.md` — present (from sdd-explore)
- `openspec/changes/archive/2026-08-18-sale-detail-redesign/design.md` — 145 lines
- `openspec/changes/archive/2026-08-18-sale-detail-redesign/specs/sales/spec.md` — 83 lines (delta spec; not the canonical)
- `openspec/changes/archive/2026-08-18-sale-detail-redesign/tasks.md` — 191 lines (reconciled, 53/53 sub-tasks `[x]`)
- `openspec/changes/archive/2026-08-18-sale-detail-redesign/verify-report.md` — 151 lines
- `openspec/changes/archive/2026-08-18-sale-detail-redesign/archive-report.md` — this file

## Source of Truth Updated

| File | Change | Lines |
|---|---|---|
| `openspec/specs/sales/spec.md` | Appended REQ-LAYOUT-001..008 + delta-history line | +164 / −1 |

The canonical sales spec now defines the flat-grid contract for `SaleDetailView`, the two extracted card components, the "Comprobante" trigger behavior, mobile stacking order, testid parity, and the no-mobile-total-duplicate rule. HST-REQ-001..008 remain absent — they will land with the `sales-history-coco` archive.

## Engram traceability

- `sdd-init/frontend-houndfe` (#778) — init envelope, `strict_tdd=true`
- `sdd/sale-detail-redesign/explore` (#3569) — exploration
- `sdd/sale-detail-redesign/proposal` (#3573) — proposal
- `sdd/sale-detail-redesign/delta-spec` (#3575) — delta spec (REQ-LAYOUT-001..008 + MODIFIED HST-REQ-008 carve-out)
- `sdd/sale-detail-redesign/design` (#3576) — design
- `sdd/sale-detail-redesign/tasks` (#3578) — tasks plan (size:exception pre-authorized at #3568, gate at #3579)
- `sdd/sale-detail-redesign/apply-progress` (#3580) — apply complete (4 WUs green)
- `sdd/sale-detail-redesign/verify-report` (#3582) — verify verdict `pass_with_warnings`
- `sdd/sale-detail-redesign/archive-report` (this save) — archive phase complete

Adjacent context (not part of this change but relevant to the carry-forward):
- `sales-history-coco/change-is-in-flight` (#3572) — explains the un-archived `sales-history-coco` folder and its HST-REQ-001..008 block.
- `sale-detail-redesign/hst-req-008-utabs-merge-order-conflict` (#3574) — the discovery observation that flagged the MODIFIED HST-REQ-008 carve-out requirement.

## SDD Cycle Status

**CLOSED** for `feat/sale-detail-redesign`. The change folder is at `openspec/changes/archive/2026-08-18-sale-detail-redesign/`. The 4 WUs are committed on the feature branch; the merge to `main` is the user's manual step. The MODIFIED HST-REQ-008 carve-out remains a known follow-up against the `sales-history-coco` archive ordering.
