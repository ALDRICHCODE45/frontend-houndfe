```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:e04aa82de4b8f3fe7852a12b4b3968377c8aff170e353b1ea9298cc218b37a00
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 21/21
scenarios: 40/40
test_command: pnpm test:unit --run
test_exit_code: 0
test_output_hash: sha256:422632aac9cc2fee9a4cf92dd21ddc71147816fff7a8fe73bdf3c231ef9bdd6e
build_command: pnpm type-check:responsive
build_exit_code: 0
build_output_hash: sha256:46e0558ab68885c648904132ef1d196ad9cd49d70684e05805d2aef38718307b
```

# Final Verification Report: responsive-table-contract-and-evidence

## Executive summary

**PASS WITH WARNINGS — the C1–C4 evidence contract is independently verified and is ready for parent-owned native settlement; product conformance is intentionally RED and is not claimed green.** The final conformance and headed runs both completed all 64 cases, produced 508 validated records, and exited 1 only for classified rendered-surface defects. There were zero setup failures, reporter errors, duplicate identities, skipped cases, suppression modifiers, or swallowed violations. The historical failed report has been replaced; its prior hash was `sha256:3461e672dc574a4033dcbef240fd63e1c1308656a43b77c2e1147daf61c296ef`.

## Scope and immutable candidate identity

- Worktree: `/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe-responsive-table-contract`
- Branch: `fix/responsive-contract-c4`
- Base/current HEAD: `932e8bb57feb5babce3b330c115e632c9be1586d`
- Candidate: exactly 3 tracked files, 77 changed lines (56 additions, 21 deletions).
- Recomputed patch: `git diff --no-ext-diff --binary -- e2e/` → `sha256:5ecb3d36ed59f4b396d15e6119f7fd46cb6e09ead7442cffdb53f4c23f206ae3`.
- Changed paths: `e2e/responsive/fixtures/test.ts`, `e2e/responsive/specs/dt01-products.spec.ts`, `e2e/responsive/specs/harness.spec.ts`.
- C4 remains uncommitted; no commit, staging, push, PR, sync, archive, review-authority, or implementation edit was performed.

## Structured status and action context

The parent-provided native status is accepted as authoritative: change `responsive-table-contract-and-evidence`, OpenSpec store, apply `all_done`, verify `ready`, 24/24 tasks complete, repo-local mode, and the mandatory worktree as the sole allowed root. The C4 objective was active and authenticated before runtime work; the initial acquire retry was rejected by the native inventory-size guard, but the already-running parent-authorized attempt remained active. No settlement was performed.

## Verification commands and evidence

| Required command | Outcome | Evidence |
|---|---:|---|
| `pnpm test:unit --run` | **0**; 370/370 files, 5948/5948 tests | `test-results/sdd-final-verify/unit-output.log`; SHA-256 `422632aac9cc2fee9a4cf92dd21ddc71147816fff7a8fe73bdf3c231ef9bdd6e` |
| `pnpm type-check:responsive` | **0** | `test-results/sdd-final-verify/typecheck-output.log`; SHA-256 `46e0558ab68885c648904132ef1d196ad9cd49d70684e05805d2aef38718307b` |
| `RESPONSIVE_RUN_ID=sdd-final-verify-harness pnpm test:responsive:harness` | **0**; 49/49 | `artifacts/responsive/sdd-final-verify-harness/`; evidence JSONL is empty by design (`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`), summary `fd7e6cbf58756b1935bdf08daceee91ae1080dea8248c25455242a18757005fa`, coverage `c24747570ab0dbb7c6c9a677f75d90160b9f5bb41d744494f339bd8bbcd4c92a` |
| `RESPONSIVE_RUN_ID=sdd-final-verify-conformance pnpm test:responsive:conformance` | **1**, 64 total / 35 passed / 29 failed; 508 records = 362 pass / 114 fail / 32 excluded | `artifacts/responsive/sdd-final-verify-conformance/evidence/`; JSONL `67db5e31d50d399d27204cd13ffada94f578aca744bb8c5b3a9885f02edcd6bc`, summary `75d0eca2dd5e4298056b783f9f3ebdea29769b6b6c1d9b746fa2a13315ee0328`, coverage `8e245e843048eee82a8a3f1bcc258d73392d3d0a1c1a4cfb73a948c3f6d67b67` |
| `RESPONSIVE_RUN_ID=sdd-final-verify-headed pnpm test:responsive:headed` | **1**, same 64/35/29 and 508/362/114/32 outcome | `artifacts/responsive/sdd-final-verify-headed/evidence/`; JSONL `17d5a8b5055d82ddb88c5d2865e0ac3375245087f6a0d0fd7605e2b17d419809`, summary `b9086b85cd4a6eb4a88576cd4898abd1776a8e961fdc79cb227cbdd22dbabfce`, coverage `8e245e843048eee82a8a3f1bcc258d73392d3d0a1c1a4cfb73a948c3f6d67b67` |
| `pnpm exec eslint e2e/responsive playwright.responsive.config.ts --no-cache` | **0**, zero output/findings | `test-results/sdd-final-verify/eslint-output.log`; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `pnpm exec oxlint e2e/responsive playwright.responsive.config.ts` | **0**, 0 warnings / 0 errors | `test-results/sdd-final-verify/oxlint-output.log`; SHA-256 `883e4cd25cd814b3bb975f716195d387aaf4f188e0cc654f631ab28e6cb5ee11` |
| `git diff --check` | **0**, clean | `test-results/sdd-final-verify/diff-check-output.log`; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `openspec validate responsive-table-contract-and-evidence --strict` | **127**, unavailable (`openspec: command not found`) | `test-results/sdd-final-verify/openspec-output.log`; warning only, no installation attempted |
| `gentle-ai sdd-verify-validate --input openspec/changes/responsive-table-contract-and-evidence/verify-report.md --requirements 21 --scenarios 40` | **0**, valid `pass_with_warnings` | `test-results/sdd-final-verify/report-validation-output.log`; SHA-256 `bd6ea1079e57b510db1813dc3a9a7d9358c6d9b6906c8809a2532e68cd86aeae` |

The first foreground conformance attempt reached the tool timeout at 170 seconds and was not accepted as evidence. It was not blindly reused: the exact command was rerun once detached, observed in bounded intervals, completed in approximately 3.9 minutes, and produced the final evidence above. Headed execution was launched detached and observed in bounded intervals, completed in approximately 4.3 minutes, and produced the final headed evidence above. Post-run process inspection found no Playwright, Vite, Vitest, or responsive test process.

Both final evidence summaries have `errors: []`, `totals.setupFailures: 0`, 114/114 summary failure entries with `setupFailure: false`, and no failed test without records. Python audit found 508/508 unique evidence identities in each run and exact fail-record/failure-entry coupling (114 = 114). Counts and failure taxonomies match between conformance and headed runs; their bytes are not asserted identical because run IDs and diagnostics are run-specific.

Failure taxonomy across both final runs: `target-size` 48, `state-usability` 16, `focus-obscured` 13, `semantic-or-name` 12, `focus-order` 8, `missing-scroll-discoverability` 4, `essential-content-loss` 4, `keyboard-activation` 4, `unexpected-local-overflow` 3, `surface-outside-owner` 1, and `long-data-clipping` 1. Every non-passing result is classified rendered-surface evidence, not setup/harness/reporter evidence.

## Requirements audit

Completed here means the **evidence contract and harness requirement** is verified. It does not mean the product surfaces pass responsive conformance.

| Requirement | Result | Concrete proof |
|---|---|---|
| RT-REQ-001 | PASS | Exact 320/375/768/1024 matrix in `e2e/responsive/targets/types.ts:31-36`; derived discovery and invented-case drift guard in `e2e/responsive/specs/harness.spec.ts:144-164`; final runs cover all 64 declared cases. |
| RT-REQ-002 | PASS | Domain strategy, preference keys, and exclusions in `e2e/responsive/targets/{dt01-products,hy04-notifications}.ts:15-24`; table/card preference preservation in `dt01-products.spec.ts:34-49,125-143`. |
| RT-REQ-003 | PASS | DT card collection semantics and essential fields in `dt01-products.spec.ts:137-141`; HY named controls/recipient/action semantics in `hy04-notifications.spec.ts:128-183`; product semantic RED remains unsuppressed. |
| RT-REQ-004 | PASS | Browser local-scroll/no-scroll contract measures ownership, overflow, second owners, and cue in `e2e/responsive/assertions/geometry.ts:87-127`; real DT/HY calls at `dt01-products.spec.ts:171` and `hy04-notifications.spec.ts:104`. |
| RT-REQ-005 | PASS | State contracts cover loading/fetching/empty/no-match/error/pagination in `dt01-products.spec.ts:53-71` and HY state branches in `hy04-notifications.spec.ts:79-117`; failures are classified rather than hidden. |
| RT-REQ-006 | PASS | 44px, keyboard, and focus helpers in `e2e/responsive/assertions/accessibility.ts:106-174`; DT controls in `dt01-products.spec.ts:180-207`; HY target/focus/order/activation records in `hy04-notifications.spec.ts:150-183`. |
| RT-REQ-007 | PASS | Both scroll extremes and sticky/pinned measurements in `geometry.ts:145-209`, exercised by DT long-dense at `dt01-products.spec.ts:180-207`; HY sticky-footer containment at `hy04-notifications.spec.ts:104-106`; non-applicable HY overlay/extreme cases are explicit exclusions. |
| RT-REQ-008 | PASS | The accepted 27-surface inventory and R1–R8 are declared in `targets/types.ts:5-7,61`; final coverage marks DT-01/HY-04 exercised and all other surfaces unverified, never complete. |
| BRE-REQ-001 | PASS | Stable IDs/routes/fixture/archetypes and exact widths in `targets/types.ts:5-36` and both target adapters; final coverage is representative and explicit. |
| BRE-REQ-002 | PASS | Immutable long/mixed stress tokens and 12 deterministic rows in `e2e/responsive/fixtures/stress-data.ts:1-31`; scenario catalog/state routes in `harness.spec.ts:634-650`. |
| BRE-REQ-003 | PASS | CSS geometry, document overflow, local owner, discoverability, and second-owner checks in `geometry.ts:87-127`; final records retain measurements. |
| BRE-REQ-004 | PASS | `measureScrollExtreme`, essential reachability, and sticky/pinned checks in `geometry.ts:145-209`; DT long-dense emits left/right extreme and sticky records; HY declares non-scrolling exclusions. |
| BRE-REQ-005 | PASS | `assertMinimumTargets`, keyboard activation/order, and focus-obscured helpers in `accessibility.ts:106-174`; representative specs attach target/keyboard/focus results. |
| BRE-REQ-006 | PASS | Native/collection semantics are tested in `harness.spec.ts:489-501`; DT card collection semantics are exercised at `dt01-products.spec.ts:137-141`; untested NT inventory remains unverified. |
| BRE-REQ-007 | PASS | Versioned record schema, assertion-specific authority/risk mapping, distinct regions, failure taxonomy, and duplicate rejection in `targets/types.ts:65-87` and `evidence/schema.ts:42-137`; 508 records are auditable. |
| BRE-REQ-008 | PASS | Coverage JSON explicitly reports DT-01/HY-04 exercised and remaining 25 inventory IDs unverified; final conformance/headed both cover all four widths. |
| TEB-REQ-001 | PASS | Unit suite is behavior/markup evidence only; the report does not use it as geometry proof. |
| TEB-REQ-002 | PASS | Browser geometry authority is enforced by the harness and geometry helpers; no jsdom result is used for viewport proof. |
| TEB-REQ-003 | PASS | The final decision uses structured browser records, not screenshots; screenshots/traces are diagnostics only. |
| TEB-REQ-004 | PASS | Unit behavior plus Playwright evidence are combined for DT-01/HY-04, with exact-width records and explicit exclusions. |
| TEB-REQ-005 | PASS | Records carry `authority`, assertion ID, surface, fixture, viewport, measurements, and classified failures; coverage does not claim all 27 surfaces. |

## Scenario audit

All 40 declared scenarios were independently traced to the three delta specs and the implementation/evidence lane. `PASS*` means the harness/evidence behavior is proven; a rendered product defect may still make the corresponding conformance test RED.

- **Responsive policy (14/14):**
  - RT-REQ-001 `Exact matrix is executed` — PASS* (`targets/types.ts:31-36`, `harness.spec.ts:144-164`).
  - RT-REQ-002 `Explicit table preference remains a valid narrow strategy` — PASS* (`dt01-products.spec.ts:34-49,166-207`).
  - RT-REQ-002 `Explicit table preference cannot bypass policy` — PASS* (`dt01-products.spec.ts:125-143,166-207`).
  - RT-REQ-003 `Essential fields survive a card substitution` — PASS* (`dt01-products.spec.ts:125-141`; any action/name RED is retained).
  - RT-REQ-003 `Native table remains semantically navigable` — PASS* as a contract/harness semantic path; NT inventory execution remains unverified (`harness.spec.ts:489-501`).
  - RT-REQ-004 `Permitted table scroll is contained and discoverable` — PASS* (`geometry.ts:87-113`; `dt01-products.spec.ts:171`).
  - RT-REQ-004 `Long stress values do not widen the page` — PASS* (`stress-data.ts:1-31`; `dt01-products.spec.ts:137-141,199`).
  - RT-REQ-005 `Dense toolbar remains usable at 320 CSS px` — PASS* (`dt01-products.spec.ts:180-207`; target failures remain classified).
  - RT-REQ-005 `Non-success states retain useful actions` — PASS* (`dt01-products.spec.ts:53-71`; HY error recovery RED is preserved).
  - RT-REQ-006 `Row action meets target and keyboard requirements` — PASS* evidence path (`dt01-products.spec.ts:180-207`).
  - RT-REQ-006 `Overlay focus is restored` — PASS* in target-independent harness (`harness.spec.ts:536-560`); representative overlay lifecycle is explicitly excluded.
  - RT-REQ-007 `Sticky and pinned content works at both scroll extremes` — PASS* evidence path (`geometry.ts:145-209`; DT emits both extremes).
  - RT-REQ-007 `Narrow overlay owns its table width` — PASS* as target-independent overlay contract; no NT overlay representative is claimed.
  - RT-REQ-008 `A leaf consumes the shared policy without broadening scope` — PASS* (`targets/types.ts:5-7`; coverage reports 25 unverified surfaces).
- **Browser evidence (16/16):**
  - BRE-REQ-001 `Shared table target is identified` — PASS* (`targets/dt01-products.ts:15-52`).
  - BRE-REQ-001 `Native or hybrid target is identified` — PASS* for HY adapter (`targets/hy04-notifications.ts:15-56`); NT execution unverified.
  - BRE-REQ-002 `Long-data stress fixture is repeatable` — PASS* (`fixtures/stress-data.ts:1-31`).
  - BRE-REQ-002 `Non-success states are covered` — PASS* (`dt01-products.spec.ts:53-71`; `hy04-notifications.spec.ts:79-117`).
  - BRE-REQ-003 `Page-level overflow is rejected` — PASS* (`geometry.ts:70-82`; representative calls in both specs).
  - BRE-REQ-003 `Local table scrolling is accepted only when owned` — PASS* (`geometry.ts:87-113`; `dt01-products.spec.ts:171`).
  - BRE-REQ-004 `Left and right extremes are verified` — PASS* evidence path (`geometry.ts:145-174`; DT long-dense records both sides).
  - BRE-REQ-004 `Non-scrolling surface declares the exception` — PASS* (`targets/hy04-notifications.ts:17-19`; HY coverage has excluded records).
  - BRE-REQ-005 `Target floor and keyboard action are proven` — PASS* evidence path (`accessibility.ts:106-174`; both real specs).
  - BRE-REQ-005 `Overlay focus lifecycle is proven` — PASS* synthetically (`harness.spec.ts:536-545`); representative overlay is excluded.
  - BRE-REQ-006 `Native table semantics are checked` — PASS* contract path (`harness.spec.ts:489-501`); NT surfaces remain unverified.
  - BRE-REQ-006 `Card substitution has equivalent semantics` — PASS* (`dt01-products.spec.ts:125-141`).
  - BRE-REQ-007 `Passing evidence is auditable` — PASS* (`evidence/schema.ts:42-137`; 508 records).
  - BRE-REQ-007 `Failure identifies the defect class` — PASS* (114 classified fail records; summary `errors: []`).
  - BRE-REQ-008 `Shared and bypass paths are distinguished` — PASS* (`coverage.json` lists DT-01/HY-04 only as exercised).
  - BRE-REQ-008 `Coverage limitations are recorded` — PASS* (`coverage.json` lists all remaining inventory IDs as unverified).
- **Test evidence boundary (10/10):**
  - TEB-REQ-001 `jsdom verifies mode state` — PASS as boundary; unit suite remains behavior-only.
  - TEB-REQ-001 `jsdom verifies non-success behavior` — PASS as boundary; unit suite remains behavior-only.
  - TEB-REQ-002 `Unit test is insufficient for overflow` — PASS (`geometry.ts:70-127` is browser-only authority).
  - TEB-REQ-002 `Unit test is insufficient for target size` — PASS (`accessibility.ts:106-114` measures browser boxes).
  - TEB-REQ-003 `Screenshot accompanies browser measurements` — PASS as reporting boundary; screenshots are diagnostics.
  - TEB-REQ-003 `Screenshot suggests clipping` — PASS as reporting boundary; structured long-data records are authoritative.
  - TEB-REQ-004 `Combined evidence accepts a shared table` — PASS for DT-01 evidence lane.
  - TEB-REQ-004 `Native or hybrid behavior is not inferred from shared tests` — PASS; HY has its own route/fixture and NT remains unverified.
  - TEB-REQ-005 `Evidence report labels authority` — PASS (`ASSERTION_EVIDENCE_RULES`, `schema.ts:65-87`).
  - TEB-REQ-005 `Unmeasured coverage is transparent` — PASS (`coverage.json` explicitly marks untested surfaces unverified).

## Task, workload, and budget audit

- `tasks.md` has **24/24 complete** and no unchecked implementation marker (`^\s*- \[ \]`).
- The forecast required chained PRs: approximately 1,370 native lines across C1/C2a/C2b/C3/C4, high risk, `stacked-to-main`, `ask-on-risk`. C4 implemented only its assigned slice; no scope creep was found.
- C4 budget: ≤210 direct / ≤400 native; actual 77 direct changed lines. No `size:exception` was used or inferred.
- The C4 boundary matches the reconciled plan: only fixture/spec/harness files changed; package/config/target types did not drift.
- Strict TDD evidence in `apply-progress.md` records C4 RED → GREEN → TRIANGULATE → REFACTOR. The actual final run confirms GREEN for unit/type/harness/lint and preserves unsuppressed product RED for conformance/headed. Changed C4 assertions remove the literal arithmetic manifest tautology and host-substring violation filter; no new tautological, smoke-only, ghost-loop, or implementation-detail CSS assertion was found in the C4 diff.

## Candidate integrity and forbidden-path cleanup

- No `src/**`, package, lockfile, configuration, generated declaration, prior evidence, or other OpenSpec artifact was edited. Only `verify-report.md` was replaced; `tasks.md`, `design.md`, `proposal.md`, delta specs, and `apply-progress.md` remain untouched.
- `auto-imports.d.ts` SHA-256: `3510be82a441bc06f71ae72f622a1b2025d377a58e632a6cecceca58e64e4156`; `components.d.ts` SHA-256: `246b648e64948c9b231f2cfbd4046c550cf10be9326de4cd44d9f1a87b2cfef8`; no declaration diff.
- `git diff --check` is clean. No staged changes or target-associated processes remain. The only new verification output is under allowed `test-results/`; runtime evidence is under allowed `artifacts/responsive/`.
- An unrelated pre-existing untracked `openspec/changes/responsive-tables-system-audit/` directory remains untouched.

## Risks, advisories, and exclusions

1. **Product conformance is not green.** The 114 failures are intentionally preserved product-surface RED, including target-size, semantic/name, focus, overflow, long-data, and state-usability defects. The accepted subsets remain present: DT-01 `semantic-or-name` ×4, HY-04 `state-usability` ×4, and HY-04 `target-size` ×4. This report does not claim UI remediation.
2. The 25 non-representative inventory surfaces are explicitly `unverified`; representative evidence is not 27-surface compliance.
3. `openspec validate ... --strict` was unavailable and is warning-only.
4. HY-04's target exclusion follow-up still says `WU-4d overlay coverage` at `e2e/responsive/targets/hy04-notifications.ts:23`; the exclusion is explicit and valid, but the wording is stale relative to completed C4. It was outside this three-file candidate and was not edited.
5. Deferred advisories `R3-bounded-verify-timeout` and `R3-error-readiness-race` were not fixed, tested as C4 scope, or folded into this verdict.
6. Representative native-table execution and real representative overlay focus-trap/containment remain exclusions, with reasons/follow-ups recorded in the target declarations and coverage output.

## Final verdict

**Evidence-contract verdict: PASS WITH WARNINGS.** C1–C4's contract, discovery, strict failure classification, evidence records, coverage honesty, TDD lifecycle, and final gates are independently verified. **Product conformance verdict: RED by design and not accepted as green.** The final nonzero conformance/headed exits are valid only because all non-passing results are classified product-surface evidence with zero setup, harness, reporter, and duplicate-identity errors and complete record/coverage output.

## Next recommended

Parent may settle this verification attempt and let native SDD status consume `pass_with_warnings`. Do not archive until the parent applies its archive policy for a warning-bearing evidence-contract pass and separately dispositions the preserved product-surface RED. Do not fix the deferred R3 advisories in this verification.
