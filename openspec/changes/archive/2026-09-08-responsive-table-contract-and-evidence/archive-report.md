# Archive Report — `responsive-table-contract-and-evidence`

> Phase: `sdd-archive` · Store: `openspec` · Change id: `responsive-table-contract-and-evidence`
> Archive path: `openspec/changes/archive/2026-09-08-responsive-table-contract-and-evidence/`
> Branch: `fix/responsive-contract-c4` · Archive HEAD: `fc89d2f402207df549d0cea8a78f6c97bc6a7ecd`
> Disposition: **archived with documented RED/warnings** (parent-authorized non-PASS partial archive)
> Archived: 2026-09-08

---

## Verdict

**Archived under explicit warning-bearing disposition.** The evidence contract passed independent final verification (`pass_with_warnings`, 21/21 requirements, 40/40 scenarios, zero blockers, zero critical findings), but product UI conformance is intentionally **RED by design** and is **not** claimed green. The user explicitly authorized archive mutation while requiring the archive record to make the warning/product-RED posture unmistakable. This is not a clean PASS archive; it is a `pass_with_warnings` archive with preserved product-surface RED, preserved 25-surface inventory exclusions, deferred advisories, and a missing `openspec validate --strict` capability. No commit, staging, push, PR, sync, or implementation edit was performed.

---

## Quick path

1. Archive folder created at `openspec/changes/archive/2026-09-08-responsive-table-contract-and-evidence/`.
2. Active `openspec/changes/responsive-table-contract-and-evidence/` no longer exists.
3. All eight artifacts (`proposal.md`, `design.md`, `tasks.md`, `verify-report.md`, `apply-progress.md`, and three delta specs) are present in the archive target. Their pre-move byte hashes remain recorded below; `tasks.md` later received one whitespace-only hygiene correction documented in the post-archive addendum.
4. The C4 implementation commit `fc89d2f402207df549d0cea8a78f6c97bc6a7ecd` remains the working-tree HEAD.
5. `git diff --check` exits 0 on the working tree.
6. No canonical OpenSpec spec was overwritten, edited, or removed; canonical sync was deliberately not performed (see `Sync results`).
7. No commit, stage, push, PR, sync, install, or runtime process was created or modified.

---

## Disposition (parent-authorized RED/warnings archive)

The parent prompt explicitly selected **"archive with documented RED/warnings."** This authorizes the archive mutation but mandates the following preserved disposition language, all of which is restated here and in `verify-report.md`:

- **Evidence-contract verdict: PASS WITH WARNINGS.** C1–C4 contract, discovery, strict failure classification, evidence records, coverage honesty, TDD lifecycle, and final gates are independently verified.
- **Product conformance verdict: RED by design and NOT claimed green.** The 114 classified product-surface failures across both final conformance and headed runs are intentionally preserved RED; the accepted strict subsets (DT-01 `semantic-or-name` ×4, HY-04 `state-usability` ×4, HY-04 `target-size` ×4) remain unsuppressed.
- **25 non-representative inventory surfaces remain explicitly `unverified`.** Representative evidence covers DT-01 and HY-04 only; the remaining 25 logical repeated-record surfaces (of the 27-surface inventory) are not exercised by this change and are not claimed compliant.
- **`openspec validate ... --strict` was unavailable** (exit 127, `openspec: command not found`). Recorded as warning only; no installation attempted.
- **Deferred C3 advisories `R3-bounded-verify-timeout` and `R3-error-readiness-race` remain outside C4** and unresolved. They are non-blocking for this archive.
- **Advisory `R3-raw-source-manifest-discovery`** is non-blocking and deferred as separate future work.
- **Old review `review-09056a726968064f`** remains terminal escalated and untouched.
- **OpenSpec artifacts and `test-results/` were excluded** from both implementation reviews and commits; they remain untracked in the working tree and are not archived (they live outside the change folder).
- **Effect on this archive:** the parent disposition authorizes the move to archive without resolving any of the RED/warning items above. Future remediation, native-table execution, representative overlay focus-trap evidence, the missing `openspec` CLI, and the 25-surface coverage gap remain explicit follow-up work that must be tracked as new SDD changes.

---

## Final state (PASS WITH WARNINGS evidence, 5 chained work units)

### Verification envelope

- **`verify-report.md`** carries a valid `gentle-ai.verify-result/v1` fenced-yaml envelope:
  - `verdict: pass_with_warnings`
  - `evidence_revision: sha256:e04aa82de4b8f3fe7852a12b4b3968377c8aff170e353b1ea9298cc218b37a00`
  - `blockers: 0`
  - `critical_findings: 0`
  - `requirements: 21/21`
  - `scenarios: 40/40`
  - `test_command: pnpm test:unit --run` → exit 0, **5948/5948 tests passed (370 files)**
  - `test_output_hash: sha256:422632aac9cc2fee9a4cf92dd21ddc71147816fff7a8fe73bdf3c231ef9bdd6e`
  - `build_command: pnpm type-check:responsive` → exit 0
  - `build_output_hash: sha256:46e0558ab68885c648904132ef1d196ad9cd49d70684e05805d2aef38718307b`
  - Historical pre-correction `verify-report.md` hash (superseded): `sha256:3461e672dc574a4033dcbef240fd63e1c1308656a43b77c2e1147daf61c296ef`.

### Final-gate outcomes

| Gate | Exit | Evidence |
|---|---:|---|
| `pnpm test:unit --run` | 0; 370/370 files, 5948/5948 tests | `test-results/sdd-final-verify/unit-output.log`; SHA-256 `422632aac9cc2fee9a4cf92dd21ddc71147816fff7a8fe73bdf3c231ef9bdd6e` |
| `pnpm type-check:responsive` | 0 | `test-results/sdd-final-verify/typecheck-output.log`; SHA-256 `46e0558ab68885c648904132ef1d196ad9cd49d70684e05805d2aef38718307b` |
| `RESPONSIVE_RUN_ID=sdd-final-verify-harness pnpm test:responsive:harness` | 0; 49/49 | `artifacts/responsive/sdd-final-verify-harness/`; summary `fd7e6cbf58756b1935bdf08daceee91ae1080dea8248c25455242a18757005fa`, coverage `c24747570ab0dbb7c6c9a677f75d90160b9f5bb41d744494f339bd8bbcd4c92a` |
| `RESPONSIVE_RUN_ID=sdd-final-verify-conformance pnpm test:responsive:conformance` | 1; 64/64 tests, 35 passed / 29 failed; **508 records = 362 pass / 114 fail / 32 excluded**; 0 setup/reporter/duplicate errors | `artifacts/responsive/sdd-final-verify-conformance/evidence/`; JSONL `67db5e31d50d399d27204cd13ffada94f578aca744bb8c5b3a9885f02edcd6bc`, summary `75d0eca2dd5e4298056b783f9f3ebdea29769b6b6c1d9b746fa2a13315ee0328`, coverage `8e245e843048eee82a8a3f1bcc258d73392d3d0a1c1a4cfb73a948c3f6d67b67` |
| `RESPONSIVE_RUN_ID=sdd-final-verify-headed pnpm test:responsive:headed` | 1; identical 64/35/29 and 508/362/114/32 outcome | `artifacts/responsive/sdd-final-verify-headed/evidence/`; JSONL `17d5a8b5055d82ddb88c5d2865e0ac3375245087f6a0d0fd7605e2b17d419809`, summary `b9086b85cd4a6eb4a88576cd4898abd1776a8e961fdc79cb227cbdd22dbabfce`, coverage `8e245e843048eee82a8a3f1bcc258d73392d3d0a1c1a4cfb73a948c3f6d67b67` |
| `pnpm exec eslint e2e/responsive playwright.responsive.config.ts --no-cache` | 0; zero output/findings | `test-results/sdd-final-verify/eslint-output.log`; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `pnpm exec oxlint e2e/responsive playwright.responsive.config.ts` | 0; 0 warnings / 0 errors | `test-results/sdd-final-verify/oxlint-output.log`; SHA-256 `883e4cd25cd814b3bb975f716195d387aaf4f188e0cc654f631ab28e6cb5ee11` |
| `git diff --check` | 0; clean | `test-results/sdd-final-verify/diff-check-output.log`; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `openspec validate responsive-table-contract-and-evidence --strict` | **127 (unavailable)** | `test-results/sdd-final-verify/openspec-output.log`; warning only, no installation attempted |
| `gentle-ai sdd-verify-validate --input ... --requirements 21 --scenarios 40` | 0; valid `pass_with_warnings` | `test-results/sdd-final-verify/report-validation-output.log`; SHA-256 `bd6ea1079e57b510db1813dc3a9a7d9358c6d9b6906c8809a2532e68cd86aeae` |

Python audit confirmed 508/508 unique evidence identities in each run and exact fail-record / failure-entry coupling (114 = 114). Failure taxonomy across both final runs: `target-size` 48, `state-usability` 16, `focus-obscured` 13, `semantic-or-name` 12, `focus-order` 8, `missing-scroll-discoverability` 4, `essential-content-loss` 4, `keyboard-activation` 4, `unexpected-local-overflow` 3, `surface-outside-owner` 1, `long-data-clipping` 1. Every non-passing result is classified rendered-surface evidence, not setup / harness / reporter evidence.

### Requirements audit (21/21 — evidence contract only)

All 21 requirements are **PASS as evidence-contract** proof. PASS* in the scenario audit means the harness/evidence behavior is proven; a rendered product defect may still make the corresponding conformance test RED. Three domains, 21 requirements:

| Domain | Requirements | Status |
|---|---|---|
| Responsive table policy | RT-REQ-001–008 (8) | PASS* as evidence contract |
| Browser responsive evidence | BRE-REQ-001–008 (8) | PASS* as evidence contract |
| Test evidence boundary | TEB-REQ-001–005 (5) | PASS* as evidence contract |

Per-requirement file:line evidence is in `verify-report.md` "Requirements audit" and "Scenario audit" sections.

### `tasks.md` completeness

- `tasks.md` has **24/24 implementation checkboxes complete** (`grep -c '^- \[x\]' = 24`; `grep -c '^- \[ \]' = 0`). No unchecked `- [ ]` implementation lines remain.
- Five chained work units (C1 → C2a → C2b → C3 → C4) are all marked complete in `tasks.md` and proven by `apply-progress.md`.

---

## Slice / commit chain

Chained-PR delivery (`stacked-to-main` under `ask-on-risk`) was followed end-to-end. HEAD stays at `fc89d2f402207df549d0cea8a78f6c97bc6a7ecd` (C4). C3 review authority was burned; C4 review authority was burned. No implementation review touched OpenSpec artifacts or `test-results/`.

| # | Slice | Branch / commit | Approx lines | Outcome |
|---|---|---|---:|---|
| WU-1a | Playwright runner bootstrap | `test(responsive): establish Playwright runner bootstrap` · `7e20e12` | historical | historical |
| WU-1b1 | Typed target policy contracts | `test(responsive): add typed target policy contracts` · `2d7a786` | historical | historical |
| WU-1b2 | Evidence schema contracts | `test(responsive): add evidence schema contracts` · `3667b57` | historical | historical |
| WU-2 | Geometry / overflow assertions | `test(responsive): add geometry and overflow evidence assertions` · `5876209` | historical | historical |
| WU-3 | Semantic interaction / state | `test(responsive): add semantic interaction and state evidence assertions` · `b229f2e` | historical | historical |
| WU-4a | Session / network fixtures | `test(responsive): add deterministic session and network fixtures` · `c414bdd` | historical | historical |
| WU-4b | Evidence aggregation | `test(responsive): add responsive evidence aggregation` · `82edc4b` | historical | historical |
| WU-4c | Representative target adapters | `test(responsive): add representative responsive target adapters` · `3b3bfba` | historical | historical |
| bounded | Rendered panel + external audit | `fix(responsive): resolve rendered panel and external audit` · `215aca4` | historical | historical |
| WU-4d | Strict representative conformance specs | `test(responsive): add strict representative conformance specs` · `cb53f73` | historical | historical |
| C1 | Evidence identity / ownership / risk / authority | `fix/responsive-contract-c1` · `afb75b3` + `105a31a` | 142 + 25 = 167 direct | focused green |
| C2a | DT-01 table contract | `feat/responsive-table-contract-c2` · `ac4d60b` | ≤290 direct / ≤400 native (actual 196 / 163+/33−) | focused green + 4 independent-verifier corrections |
| C2b | DT-01 card / state contract | `feat/responsive-table-contract-c2b` · `8a2e7ba` | ≤280 direct / ≤400 native | committed, natively settled (outcome passed) |
| C3 | HY-04 state / network closure | `feat/responsive-table-contract-c3` · `932e8bb` | 252+/36− = 288 changed (5 files) | committed, review `review-5fb15c27b24a989f` approved/acknowledged/authority burned; deterministic 204 records (130/58/16), 0 errors; old review `review-09056a726968064f` terminal escalated untouched |
| C4 | Discovery / lint / final gates | `fix/responsive-contract-c4` · `fc89d2f` | 77 direct / 56+/21− (3 files); patch SHA-256 `5ecb3d36ed59f4b396d15e6119f7fd46cb6e09ead7442cffdb53f4c23f206ae3`; native review `review-d38e04741cfaf4ce` approved/acknowledged/authority burned against target SHA-256 `48398d7289b9536be146c630b32037dfd99a91fcf0c01b392e0b1b761222062f` | focused green (unit/type/harness/eslint/oxlint all clean) + final conformance/headed RED preserved by design |

C4's first attempt (`sdd-apply` task `mtstj53j-2-m7w8`) was interrupted after four stalled minutes; its preserved 85-line partial diff (patch SHA-256 `e496ff4ab85687eceec8085cf018cf2df9ed30d69ce63c5719c1d6645f582de9`, historical) was absorbed by the authenticated continuation that produced the final 77-line C4 commit.

---

## Archived artifact inventory

All artifacts are present at `openspec/changes/archive/2026-09-08-responsive-table-contract-and-evidence/`. SHA-256 hashes are pre-move (captured before `rm -rf` of the active change folder) and re-verified after the copy.

| Artifact | Bytes (pre-move SHA-256) | Re-verified after copy |
|---|---|---|
| `proposal.md` | `sha256:82f3f7cb7db29fe3066f1619b1e57db059225c87d4c86b5d681f371655515411` | Yes (byte-identical) |
| `design.md` | `sha256:5ab0571f85eea3223fc1f99483971944374d67d20278ddbfac09662ffd74186b` | Yes (byte-identical) |
| `tasks.md` | `sha256:af9243384b3f33268a1faa4e6d387d620905592d48d5aadca348898bb0d06deb` | Yes (byte-identical) |
| `verify-report.md` | `sha256:d6b3ab336ad99476913c0d694ed977fc0ff609f0e33970b29b5f8d0b8817b89f` | Yes (byte-identical) |
| `apply-progress.md` | `sha256:db76d9227d72a42f536b1e4f706beecaa2ceaca7fabbdf9cea0734535df0dfb9` | Yes (byte-identical) |
| `specs/responsive-table-policy/spec.md` | `sha256:d85e397568319918262b7e9249d7f22c1b5b67d4d80fa0abf8cebe63e3790c2c` | Yes (byte-identical) |
| `specs/browser-responsive-evidence/spec.md` | `sha256:b700526407cee8a237af7a69321786102b539c4093df785c07646532a3ec9526` | Yes (byte-identical) |
| `specs/test-evidence-boundary/spec.md` | `sha256:6132565aa6310b8834e555be797224e4586b618983fcb958276ef7aec5f4bbc7` | Yes (byte-identical) |
| `archive-report.md` (this file) | written at archive time | n/a |

Total: 1 proposal + 1 design + 1 tasks + 1 verify-report + 1 apply-progress + 3 delta specs + 1 archive report = 9 files (8 preserved + 1 generated). `sync-report.md` was not produced by this change and is not present (see "Sync results" below).

---

## Sync results (canonical OpenSpec specs)

**Canonical sync was deliberately not performed during archive.** This is recorded explicitly because the parent prompt did not include explicit approval for archive-time sync fallback, and there is no pre-existing `sync-report.md`:

- The change introduces three **new** canonical domains — `responsive-table-policy`, `browser-responsive-evidence`, and `test-evidence-boundary` — none of which currently exist under `openspec/specs/`. If sync were performed, each delta spec would be copied verbatim as the new full canonical spec (no ADDED / MODIFIED / REMOVED headers required for fresh domains).
- Per the installed archive contract, `openspec` file-backed archive requires either a successful pre-existing `sync-report.md` or explicit parent authorization for archive-time sync fallback. **Neither is present in this archive.** The parent prompt authorized archive mutation with a documented RED/warnings disposition but did not include the explicit "archive-time sync fallback" approval required to sync canonical OpenSpec specs.
- Destructive merge is not in scope (no MODIFIED/REMOVED on existing canonical specs), but the parent explicitly forbids broadening scope ("never overwrite unrelated canonical specs or broaden scope"). Synchronizing three new domains into `openspec/specs/` would expand canonical coverage by three domains, which is a scope decision reserved to a parent that explicitly approved sync.
- No canonical `openspec/specs/*.md` file was opened, read for editing, written, or otherwise modified by this archive phase.

ADDED/MODIFIED/REMOVED requirement summary (for traceability only — not applied):

| Domain | ADDED | MODIFIED | REMOVED |
|---|---|---|---|
| `responsive-table-policy` | RT-REQ-001, RT-REQ-002, RT-REQ-003, RT-REQ-004, RT-REQ-005, RT-REQ-006, RT-REQ-007, RT-REQ-008 (all 8) | — | — |
| `browser-responsive-evidence` | BRE-REQ-001, BRE-REQ-002, BRE-REQ-003, BRE-REQ-004, BRE-REQ-005, BRE-REQ-006, BRE-REQ-007, BRE-REQ-008 (all 8) | — | — |
| `test-evidence-boundary` | TEB-REQ-001, TEB-REQ-002, TEB-REQ-003, TEB-REQ-004, TEB-REQ-005 (all 5) | — | — |
| **Total** | **21 (matches verify envelope `21/21`)** | **0** | **0** |

Same-domain active-change warning: **none.** No other active change under `openspec/changes/*/specs/{responsive-table-policy,browser-responsive-evidence,test-evidence-boundary}/spec.md` exists or touches these domains.

Future canonical sync must be a separate SDD phase (`sdd-sync` or a follow-up SDD change) explicitly authorized by the parent. The delta specs are preserved verbatim in the archive so any future sync can use this archive as the source of truth.

---

## Risks preserved (non-blocking, unchanged by archive)

1. **Product conformance is RED.** All 114 final-run failures are intentionally preserved product-surface RED, including the accepted subsets DT-01 `semantic-or-name` ×4, HY-04 `state-usability` ×4, and HY-04 `target-size` ×4. This archive does **not** claim UI remediation.
2. **25 non-representative inventory surfaces are explicitly `unverified`** out of the 27-surface repeated-record inventory; representative evidence covers DT-01 and HY-04 only.
3. **`openspec validate ... --strict` was unavailable** (exit 127) and is warning-only.
4. **Deferred advisories `R3-bounded-verify-timeout` and `R3-error-readiness-race`** are unresolved and remain outside C4.
5. **Advisory `R3-raw-source-manifest-discovery`** is non-blocking and deferred as separate future work.
6. **HY-04 target exclusion follow-up** still says `WU-4d overlay coverage` at `e2e/responsive/targets/hy04-notifications.ts:23`; the exclusion is explicit and valid, but the wording is stale relative to completed C4. It was outside the three-file C4 candidate and was not edited.
7. **Representative native-table execution** and **real representative overlay focus-trap/containment** remain exclusions, with reasons / follow-ups recorded in the target declarations and coverage output.
8. **Stale-recipient recovery evidence limitation** (first PUT only, no toast; no fulfillment-rejection injection proof) and **error-4xx genuine product RED** remain preserved historical evidence; any product remediation requires separate authorization.
9. **Canonical sync was not performed** (see "Sync results"). The three new capability specs live only in the archive until a parent-authorized sync step lands.
10. **Old review `review-09056a726968064f`** remains terminal escalated and untouched.

---

## Guardrails and approvals

- **Active change selection:** unambiguous (`responsive-table-contract-and-evidence`); the only OpenSpec change with this name in the working tree, identified by the parent prompt and `actionContext`.
- **`actionContext.mode: repo-local`**; `allowedEditRoots` = `[/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe-responsive-table-contract]`. All archive paths and the destination folder are inside that root.
- **`openspec/config.yaml` was read** at `openspec/config.yaml`; no `rules.archive` override was present.
- **Destructive merge approval:** not required (no MODIFIED / REMOVED requirements).
- **Receipt-driven review:** unmanaged for this archive; the C3 and C4 reviews recorded in the verify report were implementation reviews, not archive reviews.
- **Stale-checkbox reconciliation:** not applicable; `tasks.md` has 24/24 complete and zero unchecked `- [ ]` implementation lines.
- **No commit, no stage, no push, no PR, no sync, no install, no test run, no native tokens persisted.**

---

## Structured status and action context

```yaml
schema: gentle-ai.sdd-status@2
artifactStore: openspec
changeRoot: /home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe-responsive-table-contract/openspec/changes/responsive-table-contract-and-evidence
archivePath: /home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe-responsive-table-contract/openspec/changes/archive/2026-09-08-responsive-table-contract-and-evidence
taskProgress: 24/24 complete
uncheckedImplementationLines: 0
dependencies:
  apply: all_done
  verify: all_done
  sync: not_performed_no_parent_approval
  archive: done
verifyReport:
  exists: true
  verdict: pass_with_warnings
  requirements: 21/21
  scenarios: 40/40
  evidence_revision: sha256:e04aa82de4b8f3fe7852a12b4b3968377c8aff170e353b1ea9298cc218b37a00
syncReport:
  exists: false
  status: not_performed
  reason: "Parent prompt did not include explicit approval for archive-time sync fallback; no pre-existing sync-report.md; canonical sync deferred to a future parent-authorized sdd-sync step."
  domains_pending: [responsive-table-policy, browser-responsive-evidence, test-evidence-boundary]
actionContext:
  mode: repo-local
  workspaceRoot: /home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe-responsive-table-contract
  allowedEditRoots:
    - /home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe-responsive-table-contract
disposition:
  archive_authorized: true
  disposition_class: warning_bearing_pass_with_product_red
  product_conformance_claimed_green: false
  inventory_surfaces_verified: 2/27
  inventory_surfaces_unverified: 25/27
findings:
  activeChange: unambiguous
  canonicalPathsAuthorized: true
  sameDomainCollisions: none
  destructiveMerge: not_required
  noCommitNoPush: true
  noInstall: true
  noTestRun: true
  noRuntimeProcess: true
git:
  head: fc89d2f402207df549d0cea8a78f6c97bc6a7ecd
  c4_commit: fc89d2f402207df549d0cea8a78f6c97bc6a7ecd
  c4_patch_sha256: 5ecb3d36ed59f4b396d15e6119f7fd46cb6e09ead7442cffdb53f4c23f206ae3
  c3_commit: 932e8bb57feb5babce3b330c115e632c9be1586d
  c2b_commit: 8a2e7ba
  c2a_commit: ac4d60b
  c1_commits: [afb75b3, 105a31a]
  diffCheck: pass
  untracked_changes_touched_by_archive: none
nextRecommended: post-archive housekeeping only — future canonical sync (three new domains) requires a separate parent-authorized sdd-sync step; deferred advisories (R3-bounded-verify-timeout, R3-error-readiness-race, R3-raw-source-manifest-discovery) and product remediation remain follow-up work for new SDD changes
```

---

## Checklist

- [x] Verify report is `pass_with_warnings` with 0 blockers and 0 critical findings (21/21 requirements, 40/40 scenarios).
- [x] All 24 implementation checkboxes are checked; no `- [ ]` implementation lines remain in `tasks.md`.
- [x] Archive path is inside the authoritative workspace and matches `openspec/changes/archive/2026-09-08-responsive-table-contract-and-evidence/`.
- [x] All eight archived artifacts (proposal, design, tasks, verify-report, apply-progress, three delta specs) plus the new archive report are byte-identical (or freshly authored) in the archive target.
- [x] `git diff --check` passes on the working tree after the move.
- [x] No implementation, `src/**`, generated declaration, lockfile, configuration, test-results, or unrelated OpenSpec change was modified during archive.
- [x] Canonical sync was deliberately not performed; no canonical `openspec/specs/*.md` file was modified.
- [x] No commit, stage, push, PR, sync, install, or runtime process was created or modified.
- [x] Product RED, 25-surface inventory exclusion, deferred advisories, and `openspec validate` warning are all preserved in this archive report and in `verify-report.md`.

---

## Next step

None required by SDD for this archive. The change is moved to `openspec/changes/archive/2026-09-08-responsive-table-contract-and-evidence/` under the parent's explicit warning-bearing disposition. Three follow-up lanes remain for separate parent authorization:

1. **Canonical sync** — a future parent-authorized `sdd-sync` (or new SDD change) that promotes the three archived delta specs into `openspec/specs/{responsive-table-policy,browser-responsive-evidence,test-evidence-boundary}/spec.md`.
2. **Product remediation** — a new SDD change that closes the 114 classified product-surface defects and the accepted subsets (DT-01 `semantic-or-name` ×4, HY-04 `state-usability` ×4, HY-04 `target-size` ×4).
3. **Inventory coverage** — a new SDD change that exercises the 25 unverified representative surfaces and removes the corresponding `unverified` markers from coverage output.

The C4 implementation commit `fc89d2f402207df549d0cea8a78f6c97bc6a7ecd` remains HEAD on `fix/responsive-contract-c4` and is not modified, amended, pushed, or merged by this archive.


---

## Post-archive canonical sync addendum — 2026-09-08

**Current state supersession (sync only):** After the separately authorized `sdd-sync` selection **“Sync OpenSpec primero”**, the three archived new-domain specifications were copied byte-identically into canonical OpenSpec: `browser-responsive-evidence`, `responsive-table-policy`, and `test-evidence-boundary`. The detailed mapping, requirement/scenario counts, hashes, and structural verification are recorded in `sync-report.md` beside this archive report.

The earlier **“Sync results”** section remains accurate as historical-at-archive context: sync had not been performed when this archive report was created because fallback approval was absent. This addendum supersedes only that former current-state statement; it does not rewrite the archive-time decision or alter the preserved warning disposition. Evidence contract status remains **pass_with_warnings**; product conformance remains **RED by design**, 25 surfaces remain unverified, and deferred advisories remain deferred.

### Post-archive documentation hygiene

Before the separately authorized documentation commit, independent staged-diff verification found one whitespace-only blank line in `tasks.md`. The blank-line spaces were removed to satisfy `git diff --cached --check`; requirement text, checkbox state, semantics, and line count remain unchanged. The archive-time pre-move hash in the artifact table is retained as historical evidence; the normalized current `tasks.md` SHA-256 is `ff73617c7280a6ac4a8f998037f39519d45845e4a36cf71396e4ddf05ca7bc45`.
