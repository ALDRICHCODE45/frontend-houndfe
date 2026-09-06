# Archive Report — customer-sales-history

> Phase: archive · Store: `openspec` · Action context: `repo-local` (authoritative effective worktree)
> Authoritative worktree: `frontend-houndfe-worktrees/customer-sales-history-tdd-rebuild`
> Archive date (ISO): **2026-09-06**
> Archived path: `openspec/changes/archive/2026-09-06-customer-sales-history/`
> Source path moved: `openspec/changes/customer-sales-history/` → **absent** after move
> HEAD at archive time: `13292f4` (`docs(openspec): sync customer sales history specs`)
> No push performed. Delivery is **not** authorized by this archive phase.

## Status

- **Archive verdict:** PASS.
- **Verify verdict:** PASS WITH WARNINGS — `pass_with_warnings`, 0 blockers, 0 critical findings.
- **Tests/build:** focused 14-file suite **PASS** (436/436, 22.81s); clean full unit rerun **PASS** (368/368 files, 5,873/5,873 tests, 83.05s); `pnpm build` **PASS** (2,427 modules); 25-file no-fix ESLint scope **PASS**; `git diff --check` **PASS**.
- **Requirements/scenarios:** 11/11 PASS, 22/22 PASS.
- **Canonical sync:** completed in commit `13292f4` (`d7704e4` normalization; the parser-mismatch surface from earlier tooling was resolved by `d7704e4` before this archive).
- **No blockers:** the only open items are non-critical warnings (see §Warnings). The two `sdd-owner: parent` rows in `tasks.md` remain unchecked but are explicitly not implementation work; ownership passes the Final Task Completion Gate.

## Artifacts read

- `openspec/changes/customer-sales-history/proposal.md` (read; SHA-256 `76f60a98…426d7791`)
- `openspec/changes/customer-sales-history/design.md` (read; SHA-256 `2f265dbe…6b80ee9d`)
- `openspec/changes/customer-sales-history/tasks.md` (read; SHA-256 `f76b5ae4…f5f31a1`; 22 rows, 20 implementation tasks checked, 2 parent lifecycle rows unchecked)
- `openspec/changes/customer-sales-history/apply-progress.md` (read; SHA-256 `1b284049…a4f157b`)
- `openspec/changes/customer-sales-history/verify-report.md` (read; SHA-256 `842e4296…79e0b6`; evidence revision `sha256:c86b5ef41cc00e54c11c5aa4eed57aed0384bcfde71d20c7dfb14127bd471261`)
- `openspec/changes/customer-sales-history/sync-report.md` (read; SHA-256 `c91cfa1a…a44435`)
- `openspec/changes/customer-sales-history/specs/customer-entry/spec.md`
- `openspec/changes/customer-sales-history/specs/history-surface/spec.md`
- `openspec/changes/customer-sales-history/specs/summary-contract/spec.md`
- `openspec/specs/customer-entry/spec.md`, `openspec/specs/history-surface/spec.md`, `openspec/specs/summary-contract/spec.md` (read-only verification inputs)

## Implementation commit ranges (main..HEAD = 39 commits, 26 non-`openspec/`)

| Slice | Audit | Durable RED → GREEN → TRIANGULATE / extras | A+D | Result |
| --- | --- | --- | ---: | --- |
| S1 — Contract | audited | `5de64dd` RED → `7bbf4e3` GREEN → `28cb5c0` TRIANGULATE → `a12bd66` page-key correction | 331 | PASS |
| S2 — Query | audited | `6e9fe48` RED → `c7bc581` GREEN → `6e9ced2` TRIANGULATE | 373 | PASS |
| S3a — Presentation | audited | `4fc5795` RED → `87b26b1` GREEN → `9017ebc` TRIANGULATE → `17d9233` type hygiene | 292 | PASS |
| S3b — Slideover | audited | `25782fe` RED → `0cc5317` GREEN → `e4dadaa` TRIANGULATE | 382 | PASS |
| S4a — Card actions | audited | `9e75d42` RED → `c3876fc` GREEN → `3f42b9d` TRIANGULATE | 240 | PASS |
| **S4b redo** | **supersedes** | `6e3406f` prep → `d66a37d` tests-only RED → `6629c83` production-only GREEN → `22c093c` tests-only TRIANGULATE → `fd113a3` evidence | 250 | **PASS** |

The invalid earlier S4b sequence `fee13ac → e3ce205 → 83d57c3` receives no credit. The redo is the authoritative S4b TDD trail.

## S4b superseding redo (detail)

- **Why redo:** the original S4b sequence (`fee13ac → e3ce205 → 83d57c3`) failed strict TDD ordering because the GREEN step was not gated to leave the RED test blob unchanged.
- **Replacement:** preparation commit `6e3406f` reset the slice; the redo is RED-only on tests (`d66a37d`), GREEN-only on production (`6629c83`), TRIANGULATE-only on tests (`22c093c`), and the evidence commit `fd113a3`.
- **Verification:** ancestry checks all return success; RED leaves `CustomersView.vue` unchanged; GREEN changes only `CustomersView.vue` and leaves the RED test blob unchanged; TRIANGULATE changes only the test file. The redo source and test blobs equal the prior functional final.

## Verify verdict and evidence

- Source verdict: `pass_with_warnings` from `verify-report.md` evidence revision `sha256:c86b5ef41cc00e54c11c5aa4eed57aed0384bcfde71d20c7dfb14127bd471261`.
- Verify report SHA-256 (raw): `842e42966b51c9f3c1c8f0e2c7afd45ebcc8fc7e0b7fc4b8d59e2fcd2b79e0b6` — **preserved unchanged** through the move (re-confirmed post-move).
- All 14 reported feature test files exist and pass now. Initial transient full-suite cleanup flake was reproduced and recovered by an unchanged-tree rerun.

## Test / build / lint totals

| Command | Exit | Counts | Output SHA-256 |
| --- | ---: | --- | --- |
| `pnpm test:unit --run` (initial) | 1 (transient flake) | 368/368 files, 5,873/5,873 assertions | `37a541596bc4fd3001a6e0a5dcfc68d0af7cad139f507ab667c125c3d94433d9` |
| `pnpm test:unit --run` (clean rerun) | 0 | 368/368 files, 5,873/5,873 tests, 83.05s | `42546e03031b90dc158f879391c72736dd499a0ff810771dd423772dca117b8f` |
| Focused 14-file suite | 0 | 14/14 files, 436/436 tests, 22.81s | `d2da6c46d1efbc68b6a4f48bb8ff4fe4cc9daf3317ee5a56d140900e8cd117b0` |
| `pnpm build` | 0 | 2,427 modules transformed | `dca2e15bf2c0474df4e6268d3925a5f17eb971bc8e96c9ed0f6e5e3cbf885631` |
| 25-file no-fix ESLint scope | 0 | 25 paths | `b788c057e55e19265ff6ccac47d2bf1473c557494bb1f75c455dc267fdeef0ba` |
| `git diff --check main..HEAD` | 0 | empty | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

Requirements: **11/11 PASS** (REQ-CSH-ENT-001..004, REQ-CSH-SUR-001..004, REQ-CSH-CON-001..003). Scenarios: **22/22 PASS**. TDD compliance: evidence 6/6; feature test files 14/14; ordered RED-before-production 6/6; GREEN confirmed by focused/full rerun; triangulation 6/6; explicit refactor disposition 6/6; slice budget 6/6. No `size:exception`.

## Sync commit and hash map

- Sync commit: `13292f4` (`docs(openspec): sync customer sales history specs`).
- Normalization commit (parser mismatch resolved here): `d7704e4` (`docs(openspec): normalize customer history requirement headings`).

| Domain | Source (delta) → Canonical | SHA-256 (source = destination) | Requirements | Scenarios |
| --- | --- | --- | ---: | ---: |
| `customer-entry` | `openspec/changes/.../specs/customer-entry/spec.md` → `openspec/specs/customer-entry/spec.md` | `14208838d023a1b95702fde70fb6e17eb42c2a018eb6cecece055f0f208a1439` | 4 | 7 |
| `history-surface` | `openspec/changes/.../specs/history-surface/spec.md` → `openspec/specs/history-surface/spec.md` | `85be72e9f96938cf7f8ad3b271219c8c9fae2b65a1dd2992a03957178cc3a15d` | 4 | 8 |
| `summary-contract` | `openspec/changes/.../specs/summary-contract/spec.md` → `openspec/specs/summary-contract/spec.md` | `40d8e542613f3a72dc2ced2a1eeb25df7855bfa17ba7e16793e67794a07e014a` | 3 | 7 |

All three canonical destinations are **byte-identical to the archived delta specs** (re-confirmed immediately after the move). No overwrite of MODIFIED/REMOVED requirements; no destructive merge; no legacy flat input; no active same-domain collision.

## Source → destination move inventory

10 source files (9 tracked + 1 untracked `verify-report.md`) moved into the archive preserving relative paths. Pre-move and post-move file hashes match exactly.

| # | Source path | Destination path | SHA-256 |
| ---: | --- | --- | --- |
| 1 | `apply-progress.md` | `archive/2026-09-06-customer-sales-history/apply-progress.md` | `1b2840493927c967527289f0b8ee2aac382423096db3cc6e578f66bcaa4f157b` |
| 2 | `design.md` | `archive/2026-09-06-customer-sales-history/design.md` | `2f265dbec8ba15b36235722ed4f21b7cffff5177bccad3170b6035506b80ee9d` |
| 3 | `exploration.md` | `archive/2026-09-06-customer-sales-history/exploration.md` | `6b6abef6ec16ef854bf0d1a881a05abe3f54b0e72d55a64b787ad472e742e3a5` |
| 4 | `proposal.md` | `archive/2026-09-06-customer-sales-history/proposal.md` | `76f60a985f6a7451e0490add18fea4f60f146766d05373e24f9c5c3c426d7791` |
| 5 | `specs/customer-entry/spec.md` | `archive/2026-09-06-customer-sales-history/specs/customer-entry/spec.md` | `14208838d023a1b95702fde70fb6e17eb42c2a018eb6cecece055f0f208a1439` |
| 6 | `specs/history-surface/spec.md` | `archive/2026-09-06-customer-sales-history/specs/history-surface/spec.md` | `85be72e9f96938cf7f8ad3b271219c8c9fae2b65a1dd2992a03957178cc3a15d` |
| 7 | `specs/summary-contract/spec.md` | `archive/2026-09-06-customer-sales-history/specs/summary-contract/spec.md` | `40d8e542613f3a72dc2ced2a1eeb25df7855bfa17ba7e16793e67794a07e014a` |
| 8 | `sync-report.md` | `archive/2026-09-06-customer-sales-history/sync-report.md` | `c91cfa1aa4af83e87accb4dba331fa286330a7d1415564eb59eb9df853a44435` |
| 9 | `tasks.md` | `archive/2026-09-06-customer-sales-history/tasks.md` | `f76b5ae44f7c8f17b6f94cc2b40cd9db58eb88b802b675887fd0bc1bdf5f31a1` |
| 10 | `verify-report.md` (untracked) | `archive/2026-09-06-customer-sales-history/verify-report.md` | `842e42966b51c9f3c1c8f0e2c7afd45ebcc8fc7e0b7fc4b8d59e2fcd2b79e0b6` |

Git recognized all 9 previously-tracked files as 100%-similarity renames; `verify-report.md` is added as a new tracked file. Logical changed-line total for the staged archive move is **0** (pure rename).

## Canonical spec hash equality (post-move)

| Canonical spec | Required SHA-256 | Computed SHA-256 (post-move) | Match |
| --- | --- | --- | ---: |
| `openspec/specs/customer-entry/spec.md` | `14208838d023a1b95702fde70fb6e17eb42c2a018eb6cecece055f0f208a1439` | `14208838d023a1b95702fde70fb6e17eb42c2a018eb6cecece055f0f208a1439` | ✅ |
| `openspec/specs/history-surface/spec.md` | `85be72e9f96938cf7f8ad3b271219c8c9fae2b65a1dd2992a03957178cc3a15d` | `85be72e9f96938cf7f8ad3b271219c8c9fae2b65a1dd2992a03957178cc3a15d` | ✅ |
| `openspec/specs/summary-contract/spec.md` | `40d8e542613f3a72dc2ced2a1eeb25df7855bfa17ba7e16793e67794a07e014a` | `40d8e542613f3a72dc2ced2a1eeb25df7855bfa17ba7e16793e67794a07e014a` | ✅ |

Canonical specs are unchanged and remain byte-identical to the archived delta specs.

## Active same-domain warnings

- None. No other active change under `openspec/changes/*/specs/{customer-entry,history-surface,summary-contract}/spec.md` collides with this archive.

## Unchecked implementation task lines

- None. `tasks.md` contains 22 rows: 20 implementation tasks are `[x]` and 2 rows are `[ ]`. The 2 unchecked rows are explicitly `<!-- sdd-owner: parent -->` lifecycle/process markers, not implementation work:
  - *Obtain the user's chain-strategy decision (`stacked-to-main` or `feature-branch-chain`) before apply because the forecast is over budget and delivery strategy is ask-on-risk.*
  - *Start or reuse bounded review for each approved PR-sized slice, beginning with S1 and using the selected chain base/target strategy.*
- The Final Task Completion Gate is satisfied for implementation ownership; no stale-checkbox reconciliation was required.

## Non-critical partial archive approval / stale-checkbox reconciliation

- None required. No destructive sync. No legacy flat input. No stale-checkbox reconciliation. Verify-report is captured as-is (including its existing warnings) and consumed unchanged.

## Structured status and action-context findings

- `artifactStore: openspec`, mode `repo-local`, workspace root bound to this effective worktree. Allowed edit surfaces: `openspec/changes/customer-sales-history/**` (now archived) and `openspec/changes/archive/2026-09-06-customer-sales-history/**`. All writes are inside the authoritative workspace.
- Native `gentle-ai sdd-status customer-sales-history` reported a stale-report blocker and a 0/11 requirement count that conflicts with the directly observed 11 `### REQ-...` headings and 22 scenarios. This is a parser/headings-format mismatch (resolved during sync by the normalization commit `d7704e4`); the canonical validator is therefore run with the directly observed totals 11 and 22 (see §Verification).
- Action-context guard: implementation ownership and all target paths are within the authoritative worktree; the only allowed edit is this report. No parent-worktree edits.

## Destructive merge approvals or blockers

- None. No REMOVED requirements; no large MODIFIED blocks; no destructive canonical-spec changes.

## Warnings (transient / informational only — **no blockers**)

- **Transient test-cleanup flake:** initial `pnpm test:unit --run` recorded a late `ReferenceError: document is not defined` from a Reka UI toast timer in unchanged `SaleDetailView.test.ts`. An immediate unchanged-tree rerun passed cleanly (368/368, 5,873/5,873, 83.05s); warning only.
- **External browser evidence:** backend is deployed and the user manually confirmed browser behavior against it. No verifier-produced E2E claim is made.
- **CSS assertion details:** locked CSS contract assertions in `CustomerSalesHistorySlideover.spec.ts:101-102,161` and pre-existing CSS-detail assertions in touched sales tests remain. Each has a stronger behavioral companion and is not the sole behavioral evidence.
- **Vite chunk advisory:** the existing >500 kB chunk advisory from `pnpm build` remains informational; pre-existing condition, not introduced by this change.
- **Parser mismatch resolved by `d7704e4`:** the native status parser/headings-format mismatch surfaced before sync; the normalization commit `d7704e4` resolved it before `13292f4`. Validator is run with directly observed totals.
- **Two parent lifecycle rows:** both unchecked `tasks.md` rows are `<!-- sdd-owner: parent -->` lifecycle/process markers (chain-strategy and bounded-review decisions). They are not implementation work and are explicitly outside the Final Task Completion Gate for implementation ownership; they remain a delivery-process warning only.

## Verification (post-move)

- Archived verify-report validated with `gentle-ai sdd-verify-validate --input openspec/changes/archive/2026-09-06-customer-sales-history/verify-report.md --requirements 11 --scenarios 22`.
- Canonical specs re-checked byte-identical to archived delta specs after the move (see §Canonical spec hash equality).
- `git diff --check` on the staged archive move: empty, exit 0.
- Scope/inventory audit: 9 tracked renames (100% similarity) + 1 untracked-add (`verify-report.md`) consumed into the archive; **0** logical changed lines for the archive move (well under the 400-line budget). `auto-imports.d.ts` and `components.d.ts` regenerated during validation were restored; final worktree is clean of generated churn.
- Parent worktree (`frontend-houndfe`) is unchanged.
- No push performed.

## Follow-up archive metadata correction

- **Follow-up commit `2d812fc` (`docs(openspec): include archived verification evidence`).** Added the previously untracked `verify-report.md` to the archive, completing the **11/11 tracked archive** (8 prior renames plus the embedded `specs/` tree and `verify-report.md`/`sync-report.md` additions, now totalling 11 tracked files). All 11 paths are tracked after `2d812fc`; source `openspec/changes/customer-sales-history/` remains absent.
- **Additive whitespace normalization in this corrective commit.** The archived `verify-report.md` had three intentional Markdown hard-break trailing-whitespace lines (lines 18-20: **Branch** / **HEAD** / **Baseline**). They were replaced with a no-trailing-whitespace three-item list form, preserving readable separation and identical prose content; no other content (verdict, evidence data, requirements/scenarios, commands, or downstream sections) was altered.
- **Verify-report raw SHA-256 (after normalization):** `6937597f11b829c08384765a120ffb45e7514623bfa6133bb46fc3af796e3de3` (was `842e42966b51c9f3c1c8f0e2c7afd45ebcc8fc7e0b7fc4b8d59e2fcd2b79e0b6` at archive time; see §Verify verdict and evidence for the original-capture record, which remains preserved as the historical fact).
- **Re-validation:** `gentle-ai sdd-verify-validate --input openspec/changes/archive/2026-09-06-customer-sales-history/verify-report.md --requirements 11 --scenarios 22` returned `valid: true, verdict: pass_with_warnings, evidence_revision: sha256:c86b5ef41cc00e54c11c5aa4eed57aed0384bcfde71d20c7dfb14127bd471261`. The evidence revision is unchanged because the YAML envelope was not modified; only the three Markdown prose lines were normalized.
- **Canonical spec hashes and byte equality re-confirmed unchanged** (post this corrective commit):
  - `openspec/specs/customer-entry/spec.md` → `14208838d023a1b95702fde70fb6e17eb42c2a018eb6cecece055f0f208a1439` (byte-equal to archived delta spec).
  - `openspec/specs/history-surface/spec.md` → `85be72e9f96938cf7f8ad3b271219c8c9fae2b65a1dd2992a03957178cc3a15d` (byte-equal to archived delta spec).
  - `openspec/specs/summary-contract/spec.md` → `40d8e542613f3a72dc2ced2a1eeb25df7855bfa17ba7e16793e67794a07e014a` (byte-equal to archived delta spec).
- **Inventory audit:** 11/11 archive files tracked; source root absent; canonical specs unchanged; no destructive merge; no active same-domain collision.
- **`git diff --check` and `git diff --check main...HEAD`:** both clean (exit 0, empty output SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`) after this corrective commit. The full branch `git diff --check main...HEAD` is **clean**, removing the prior delivery-blocking diff-check issue on the three hard-break lines.

## Final archive status

- **PASS.** Source `openspec/changes/customer-sales-history/` is **absent**. Archive `openspec/changes/archive/2026-09-06-customer-sales-history/` is complete, hashed, and tracked. Canonical specs are unchanged and remain byte-identical to archived delta specs. Verify report is preserved unchanged (raw SHA-256 `842e4296…79e0b6`) at archive time; see §Follow-up archive metadata correction for the additive whitespace normalization commit.
- Delivery is **not** authorized by this archive phase. No push performed. Follow-up commit `2d812fc` (added `verify-report.md`) plus this corrective commit finalize the archive metadata; no push performed.
