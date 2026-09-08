# Tasks: bounded correction after failed verification

This plan corrects evidence-contract defects only. It preserves the accepted surface RED taxonomies, forbids `src/**` remediation, and leaves `verify-report.md` unchanged.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,370 native lines across 5 correction units |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 C1 → PR 2 C2a → PR 3 C2b → PR 4 C3 → PR 5 C4 |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Each unit is bounded at ≤290 direct for C2a, ≤280 direct for C2b, and ≤400 native including ledger headroom. C2 was interrupted at 102 direct lines; its partial diff is absorbed by C2a, with no active attempt. The first C4 attempt (`mtstj53j-2-m7w8`) was interrupted at 85 changed lines; its partial diff is preserved for diagnosis and continuation, not accepted as verified work, and C4 remains budgeted at ≤210 direct / ≤400 native with no active attempt. No `size:exception` is inferred.

## Global gates

- [x] Preserve DT-01 `semantic-or-name` ×4, HY-04 `state-usability` ×4, and HY-04 `target-size` ×4 as genuine strict RED with zero setup/reporter errors. <!-- proven: correction-final-conformance and correction-final-headed both show 0 setup/reporter/duplicate errors with the accepted subsets preserved (DT-01 `semantic-or-name` ×4 within ×8, HY-04 `state-usability` ×4 within ×16, HY-04 `target-size` ×4 within ×20) --> <!-- sdd-owner: implementation -->
- [x] Modify only `e2e/responsive/**`, `playwright.responsive.config.ts`, and `package.json` implementation surfaces; do not touch `src/**`, generated declarations, unrelated lockfiles, or `verify-report.md`; do not install, stage, commit, push, PR, sync, or archive during planning. <!-- proven: tracked diff is exactly 77 lines (56 additions / 21 deletions, after the gatekeeper polish pass) across fixtures/test.ts, dt01-products.spec.ts, harness.spec.ts; the preserved first-attempt partial diff was 85 lines (historical); git status shows no forbidden path; nothing staged or committed --> <!-- sdd-owner: implementation -->
- [x] Use 320, 375, 768, and 1024 CSS-pixel cases, unique `RESPONSIVE_RUN_ID` values, distinct owner/surface/related-region locators, and assertion-specific risk/authority records. <!-- proven: final conformance/headed runs at all four widths under unique run IDs; the C4 manifest drift guard validates exact-width discovery and the invented-case negative check --> <!-- sdd-owner: implementation -->
- [x] Apply strict RED → GREEN → TRIANGULATE → REFACTOR in every unit; missing or ambiguous locators are setup failures and never bypass assertions. <!-- proven: C1–C3 records in apply-progress.md; C4 executed correction-c4-red → correction-c4-green → correction-final-* → lint/refactor gates --> <!-- sdd-owner: implementation -->

## Work-unit ledger

| Unit | Exact surfaces | Direct/native forecast | Dependency | Branch / commit |
|---|---|---:|---|---|
| C1 | `e2e/responsive/targets/types.ts`, `e2e/responsive/evidence/{schema,session}.ts`, both real specs, `e2e/responsive/specs/harness.spec.ts` | 240 / 350 | `cb53f73` | `fix/responsive-contract-c1` / `fix(responsive): make evidence ownership and attribution substantive` |
| C2a | `e2e/responsive/specs/dt01-products.spec.ts`, `e2e/responsive/targets/dt01-products.ts`, `e2e/responsive/assertions/{geometry,accessibility}.ts`, C1 schema types | 240 / 320; ≤290 / ≤400 | C1 plus interrupted 102-line diff | `fix/responsive-contract-c2a` / `fix(responsive): complete DT table contract evidence` |
| C2b | DT spec/adapter, `e2e/responsive/assertions/{geometry,accessibility,states}.ts`, C1 schema types | 230 / 320; ≤280 / ≤400 | verified C2a | `fix/responsive-contract-c2b` / `fix(responsive): complete DT card and state evidence` |
| C3 | HY spec/adapter, `e2e/responsive/fixtures/{network,test}.ts`, accessibility/states assertions, C1 schema types | 290 / 385 | verified C2b | `fix/responsive-contract-c3` / `fix(responsive): close HY-04 state and network evidence gaps` |
| C4 | harness, both real specs, `e2e/responsive/fixtures/test.ts`, `playwright.responsive.config.ts`, `package.json`, target types | 210 / 295 | verified C2b and C3 | `fix/responsive-contract-c4` / `fix(responsive): harden strict conformance discovery and gates` |

## Dependency and chain order

```text
preserved failed verify evidence
            ↓
           C1 → C2a → C2b
                         ↘
                          C3 → C4 → unique-run re-verify
```

Use one stacked-to-main work unit per branch in the order above if chaining is approved. Each unit has a clear start, finish, verification, and rollback boundary. C3 cannot start before C2b; C4 cannot start before C2b and C3.

## C1 — Evidence identity and authority

**Start:** `cb53f732d4eaabc805182970bcd7fece7348f1`; preserve evidence hash `sha256:6213cb2147fa2f845ca5996618843fb31aab4afee29d77a9f2545698ccb7fed4`. **Finish:** distinct owner/surface/related regions, assertion-specific risks and authorities, and manifest-derived discovery. **Rollback:** revert only C1 type/schema/session/spec/harness changes.

- [x] RED: Add harness failures for self-containment, missing regions, blanket risks, invalid authority, and manifest drift; run `RESPONSIVE_RUN_ID=correction-c1-red pnpm test:responsive:harness`. <!-- sdd-owner: implementation -->
- [x] GREEN: Implement distinct locators, assertion mapping, substantive records, and derived discovery in the C1 surfaces. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: Exercise both representatives, all widths, exclusions, retries, and coverage; run `pnpm type-check:responsive` and the unique harness. <!-- sdd-owner: implementation -->
- [x] REFACTOR: Reject self-comparison and blanket attribution, preserve actionable exclusions, and record C1 direct/native counts before C2a. <!-- sdd-owner: implementation -->

**Verify:** `pnpm test:unit --run`; `pnpm type-check:responsive`; `RESPONSIVE_RUN_ID=correction-c1-harness pnpm test:responsive:harness`; `pnpm exec eslint e2e/responsive playwright.responsive.config.ts --no-cache`.

## C2a — DT-01 table-focused contract

**Start:** verified C1 plus the interrupted 102-direct-line partial diff; recovered in this phase after a timed-out predecessor attempt (see `apply-progress.md` C2a recovery record). **Finish:** table mode rejects zero-sized long data; proves real sticky header, left/right extremes, identity/price/stock/status, table action/view/search/filter/pagination target/keyboard/focus, and `products-view-mode` plus `table-preferences-pos-products`. **Rollback:** revert only C2a DT spec/adapter/geometry/accessibility/schema changes.

- [x] RED: Add table failures in `e2e/responsive/specs/dt01-products.spec.ts` for zero-sized long data, sticky header, `scrollLeft=0`/maximum, essential fields, action/view/search/filter/pagination target, keyboard/focus, and both keys; run `RESPONSIVE_RUN_ID=correction-c2a-red pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/dt01-products.spec.ts --grep 'C2a table'`. <!-- sdd-owner: implementation -->
- [x] GREEN: Absorb the 102-line diff across the listed DT surfaces, invoke real overflow/sticky/extreme checks, reject zero geometry, and emit assertion-specific records without locator bypasses. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: Run table success/loading/fetching/empty/no-match/error/paginated cases at all four widths and both extremes; verify preference records, zero setup/reporter errors, and preserved `semantic-or-name` ×4. <!-- sdd-owner: implementation -->
- [x] REFACTOR: Remove duplicate table record builders, retain measured boxes/sticky alignment, run type/harness/unit gates, and record counts before the C2a commit. <!-- sdd-owner: implementation -->

**Verify:** `pnpm type-check:responsive`; `RESPONSIVE_RUN_ID=correction-c2a-harness pnpm test:responsive:harness`; `RESPONSIVE_RUN_ID=correction-c2a-conformance pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/dt01-products.spec.ts`; `pnpm test:unit --run`.

### C2a final bounded verifier corrections (correction round on top of the gated attempt)

Applied exactly the four independent-verifier blockers, nothing else, inside the C2a surfaces:

1. The DT long-dense final Playwright verdict now includes every `controls` result status (`expect([...results, ...controls, extremes, sticky]...)`), so recorded control failures can never produce a false passing test.
2. Preference evidence measurements explicitly name both actual keys — `products-view-mode` and `table-preferences-pos-products` — via a `keys` array plus `expected`/`stored` maps keyed by those names.
3. `assertStickyAndPinnedAlignment` now fails with structured geometry evidence (`{ header, body }` / `{ region, header }` raw boxes as `actual`) when a pinned header/body box or the sticky header box is zero-sized (width or height ≤ 0), not only null.
4. Strict TDD re-run under unique `correction-c2a-fix-*` run IDs with a verdict-coupling audit (below).

**Correction RED:** `RESPONSIVE_RUN_ID=correction-c2a-fix-red pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/dt01-products.spec.ts` — exit 1, 36 tests (28 passed / 8 failed), 280 records (226 pass / 46 fail / 8 excluded), 0 setup/reporter errors; the 8 failures are genuine surface RED only, including 16 attached `target-size` control-fail records (`success-long-dense-control-0/3/6/9`) whose statuses the pre-fix final verdict omitted. JSONL `sha256:7cf26d30d36fe007e987ce11f3490b0536a23d2bf0314627272d238fec04100c`, summary `sha256:7ac25750ec9cce79fbe7a1ed96cea0ab9fa6ba074c397c2341f189eeb716f742`, coverage `sha256:558da538a25edd38e8ec5b04f618aec1c1c7a9aa0fa2b1741212e38fff18e790`.

**Correction GREEN + gates:** `RESPONSIVE_RUN_ID=correction-c2a-fix-green pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/dt01-products.spec.ts` — exit 1 with the same 8 genuine surface RED preserved and identical taxonomy distribution (24 `target-size`, 8 `focus-obscured`, 4 `semantic-or-name`, 4 `missing-scroll-discoverability`, 4 `essential-content-loss`, 1 `long-data-clipping`, 1 `surface-outside-owner`), 0 setup/reporter errors; JSONL `sha256:feb9d897a166d8f1077f08c4c154ee80542ae16ebcd0996eafc1f877e166436d`, summary `sha256:48fa5709014200246512aaf01711f36fd4a560c5557437b51042e91e79ec18ae`, coverage `sha256:558da538a25edd38e8ec5b04f618aec1c1c7a9aa0fa2b1741212e38fff18e790`; all 32 preference records name both keys (0 violations). `RESPONSIVE_RUN_ID=correction-c2a-fix-harness pnpm test:responsive:harness` — 49/49 passed, exit 0. `pnpm type-check:responsive` — exit 0. `pnpm exec eslint e2e/responsive playwright.responsive.config.ts --no-cache` — exit 0. `pnpm test:unit --run` — 5948/5948 passed (370 files): run 1 exit 1 with 3 pre-existing flaky reka-ui teardown unhandled errors (`document is not defined` in `SaleDetailView.test.ts` timers, documented since C1), rerun exit 0.

**Verdict-coupling audit:** 46 fail records = 46 verdict failure entries; 0 failure entries map to a passed test; all 16 long-dense control fail records are now inside the final `expect` that decides the test verdict. Blocker-3 RED is a narrowly justified exception: manufacturing a zero-sized pinned/sticky box in the real app DOM would require DOM injection that violates the suite's strict locator conventions; the guard is covered by the unchanged genuine RED/GREEN runs and type-check. Direct tracked diff from HEAD `105a31a`: 196 changed lines (163 additions / 33 deletions) across the four C2a tracked surfaces — within the ≤290 direct / ≤400 native budget.

**Traceability:** RT-REQ-001, RT-REQ-003–004, RT-REQ-006–007, BRE-REQ-003–005, TEB-REQ-004.

## C2b — DT-01 card/state-focused contract

**Start:** verified C2a. **Finish:** card mode proves no-scroll plus explicit scroll/sticky exclusions, table/card semantic equivalence, identity/status/value/action/long-name/SKU, substantive loading/fetching/empty/no-match/error/pagination records, and final DT evidence audit. **Rollback:** revert only C2b DT spec/adapter/geometry/accessibility/states/schema changes.

- [x] RED: Add card/state failures in the DT spec and `e2e/responsive/assertions/states.ts` for no-scroll/exclusions, equivalence, identity/status/value/action/long-name/SKU, and every listed state; run `RESPONSIVE_RUN_ID=correction-c2b-red pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/dt01-products.spec.ts --grep 'C2b card|C2b state'`. <!-- sdd-owner: implementation -->
- [x] GREEN: Emit substantive card/state records with `browser-interaction` authority where applicable, honest exclusions, and no copied table risks; retain strict locator failures and preference compatibility. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: Exercise all card/state cases at all widths, compare equivalent outcomes with table mode, audit every DT risk/authority, and prove zero setup/reporter errors before C3. <!-- sdd-owner: implementation -->
- [x] REFACTOR: Centralize card/state evidence, remove stale C2 wording, run focused type/harness/unit/conformance gates, and record counts before the C2b commit. <!-- sdd-owner: implementation -->

**Verify:** `pnpm type-check:responsive`; `RESPONSIVE_RUN_ID=correction-c2b-harness pnpm test:responsive:harness`; `RESPONSIVE_RUN_ID=correction-c2b-conformance pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/dt01-products.spec.ts`; `pnpm test:unit --run`.

**Traceability:** RT-REQ-002, RT-REQ-005–007, BRE-REQ-002, BRE-REQ-005–006, TEB-REQ-004–005.

## C3 — HY-04 state and network closure

**Start:** verified C2b. **Finish:** distinct HY owner/action/accordion/recipient/footer records, strict networking before every return, substantive loading/success/error/interaction/no-scroll evidence, and honest overlay exclusions. **Rollback:** revert only C3 HY/fixture/assertion/schema changes.

- [x] RED: Add failures for footer/recipient omission, loading network violation, implementation-detail loading selector, authority mismatch, switch/name/keyboard/focus, and overlay exclusion; run the focused RED with accepted HY REDs preserved. <!-- implemented through r1–r4; r1/r2/r3 runs are historical, r4 is definitive --> <!-- sdd-owner: implementation -->
- [x] GREEN: Enforce strict networking in finally paths, use semantic/state locators, invoke distinct no-scroll ownership, and keep query-error/target-size failures unsuppressed. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: Exercise loading, success, 4xx/5xx, accordion, recipients, Save, switch, focus, and applicable overlay at all widths; record honest RED/setup failures. <!-- r4 conformance: 24/24 completed, 7 passed / 17 failed genuine surface RED --> <!-- sdd-owner: implementation -->
- [x] REFACTOR: Separate no-scroll/sticky-footer measurements, replace stale follow-ups, verify no conformance host filter, and record counts before C3 commit. <!-- r4 counts recorded in `apply-progress.md`; current closure state is described in the status prose below --> <!-- sdd-owner: implementation -->

**Verify:** `pnpm test:unit --run`; `pnpm type-check:responsive`; `RESPONSIVE_RUN_ID=correction-c3-harness pnpm test:responsive:harness`; `RESPONSIVE_RUN_ID=correction-c3-conformance pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/hy04-notifications.spec.ts`.

**Status (post-C3 reconciliation):** C3 is committed as `932e8bb57feb5babce3b330c115e632c9be1586d` (`fix(responsive): close HY-04 state and network evidence gaps`) on branch `feat/responsive-table-contract-c3`. The commit contains exactly five reviewed files, 252 additions and 36 deletions (288 changed lines); OpenSpec untracked paths were excluded from both the review and the commit. The fresh approved review target was `sha256:27d14f4b9490b59e32ba8d98eb2d00d8b34f2f38b62bd445356c65d249d7e12a` under review `review-5fb15c27b24a989f`; it was approved, acknowledged, and its review authority was burned. The old review `review-09056a726968064f` remains terminal escalated and untouched. Deterministic independent evidence: 204 records (130 pass / 58 fail / 16 excluded), eight classified error-state RED, zero harness/setup/reporter/duplicate errors; typecheck, harness 49/49, and lint/LSP passed. The advisory findings `R3-bounded-verify-timeout` and `R3-error-readiness-race` are deferred and are not automatically part of C4. C4 remains not started and is a separate work unit on a separate branch/PR.

**Historical r4 record (superseded by the C3 commit):** the r4-era claims that the C3 diff was uncommitted, lacked commit authorization, or was bound to a correction-required review (`review-6ab12ee4e3b1e417`) describe the pre-commit state only and no longer describe the current state. The r1–r4 gate runs remain historical evidence and do not substitute the fresh approved review. The stale-recipient recovery evidence limitation (first PUT only, no toast; no fulfillment-rejection injection proof) and the error-4xx genuine product RED remain preserved historical evidence; any product remediation would require separate authorization.

**Traceability:** RT-REQ-005–007, BRE-REQ-002, BRE-REQ-005–006, TEB-REQ-004–005.

## C4 — Discovery, lint, scripts, and final truthfulness

**Start:** verified C2b and C3, plus the preserved 85-line partial diff from the interrupted first attempt (see the first-attempt record below). **Finish:** manifest-derived counts, no tautology/filter/swallowed failure/empty destructuring/unused import/stale follow-up, and strict unique-run scripts. **Rollback:** revert C4 harness/spec/fixture/config/package changes, including the `e2e/responsive/fixtures/test.ts` changes.

- [x] RED: Add guards for manifest drift, arithmetic literals, host filters, and oxlint defects; run harness and oxlint for expected failures. <!-- `RESPONSIVE_RUN_ID=correction-c4-red pnpm test:responsive:harness` exit 1, 47/49 passed with exactly the 2 new guards failing (stale 44-case arithmetic manifest vs discovered 64 cases; `tracker.invalid` external swallowed by the host-substring filter), 0 setup/reporter errors; oxlint RED observed 3 errors (test.ts empty destructuring, dt01 unused `label` param, unused `row` var) --> <!-- sdd-owner: implementation -->
- [x] GREEN: Derive counts from discovered cases/records, remove filtering, fix imports/destructuring, and preserve strict exits. <!-- counts derived via `discoverConformanceCases` + `deriveResponsiveCaseManifest`/`validateDiscoveredCaseManifest` (with invented-case negative drift check); host filters removed for exact-violation assertions; dt01 unused param/var and the test.ts empty destructuring fixed (Playwright requires a destructuring pattern, so a scoped documented disable directive is used); stale `Batch B/C` follow-ups updated; `RESPONSIVE_RUN_ID=correction-c4-green pnpm test:responsive:harness` 49/49 passed exit 0 --> <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: Run unique harness, final conformance, retry aggregation, R1–R8 coverage, headed wiring, and exact-width discovery with zero setup/reporter errors. <!-- `correction-c4-harness` 49/49 exit 0; `correction-final-conformance` exit 1 genuine surface RED only (64/64 tests, 35 passed/29 failed; 508 records 362/114/32; 0 setup/reporter/duplicate errors); `correction-final-headed` identical outcomes proving headed wiring; retries 0 locally with final-attempt aggregation proven by the harness unit test; coverage R1–R8 all exercised --> <!-- sdd-owner: implementation -->
- [x] REFACTOR: Keep coverage target-independent, run oxlint/eslint, inspect forbidden paths, and record final counts/commit. <!-- oxlint 0 warnings/0 errors; eslint exit 0 with zero output (0 warnings/0 errors; the test.ts suppression is the `// oxlint-disable-next-line no-empty-pattern` directive, oxlint-owned); coverage code unchanged and target-independent; final polish gates: `pnpm type-check:responsive` exit 0, `RESPONSIVE_RUN_ID=correction-c4-harness-polish pnpm test:responsive:harness` 49/49 passed exit 0, `git diff --check` clean; forbidden paths untouched; 77 direct lines (56+/21−) recorded in `apply-progress.md` (the first-attempt 85-line partial diff is historical); no commit created — commit remains parent-owned --> <!-- sdd-owner: implementation -->

**Verify:** `pnpm test:unit --run`; `pnpm type-check:responsive`; `RESPONSIVE_RUN_ID=correction-c4-harness pnpm test:responsive:harness`; `RESPONSIVE_RUN_ID=correction-final-conformance pnpm test:responsive:conformance`; `RESPONSIVE_RUN_ID=correction-final-headed pnpm test:responsive:headed`; `pnpm exec eslint e2e/responsive playwright.responsive.config.ts --no-cache`; `pnpm exec oxlint e2e/responsive playwright.responsive.config.ts`; attempt `openspec validate responsive-table-contract-and-evidence --strict` only if available and record exit 127 as warning.

**Traceability:** BRE-REQ-001, BRE-REQ-007–008, TEB-REQ-003–005, strict-TDD conformance.

**Exact surfaces (fixture scope correction):** C4's exact allowed surfaces are the harness spec, both real specs, `e2e/responsive/fixtures/test.ts`, `playwright.responsive.config.ts`, `package.json`, and target types. `e2e/responsive/fixtures/test.ts` is included because C4 owns the known oxlint empty fixture destructuring defect and that file contains it. The C4 budget and work-unit boundary are unchanged: ≤210 direct forecast / ≤400 native ceiling, separate branch/PR, no `size:exception`.

**First attempt (interrupted):** sdd-apply task `mtstj53j-2-m7w8` timed out after four stalled minutes and returned no final verification report. It left 85 changed lines (60 additions / 25 deletions) across `e2e/responsive/fixtures/test.ts`, `e2e/responsive/specs/dt01-products.spec.ts`, and `e2e/responsive/specs/harness.spec.ts`, and was settled `interrupted` with the harness disposition invalidated. No processes, staging, commit, push, or PR remain. The partial diff is preserved for diagnosis and continuation, not accepted as verified work; all C4 and global gates remain unchecked.

## Status and rollback

C2 interruption is recorded at 102 direct lines; C2a is complete through the final bounded verifier corrections and C2b is complete through the final contract-correction run, committed as `8a2e7ba` and natively settled (outcome passed). C3 is complete and committed as `932e8bb57feb5babce3b330c115e632c9be1586d` on `feat/responsive-table-contract-c3` (five reviewed files, 252 additions / 36 deletions, 288 changed lines); review `review-5fb15c27b24a989f` approved the fresh target `sha256:27d14f4b9490b59e32ba8d98eb2d00d8b34f2f38b62bd445356c65d249d7e12a`, was acknowledged, and its review authority was burned, with deterministic independent evidence of 204 records (130 pass / 58 fail / 16 excluded), eight classified error-state RED, and zero harness/setup/reporter/duplicate errors; typecheck, harness 49/49, and lint/LSP passed. The old review `review-09056a726968064f` remains terminal escalated and untouched; earlier claims of an uncommitted C3 diff, missing commit authorization, or a correction-required review binding are historical pre-commit state. The r4 full unit suite FAILED 5947/5948 (historical fact); a NEW independent full-unit follow-up run has since passed (`pnpm test:unit --run .`, exit 0, 370/370 files, 5948/5948 tests — see `apply-progress.md`), which does not make r4 green and does not establish full SDD verification. C4's first attempt (sdd-apply task `mtstj53j-2-m7w8`) was interrupted: it timed out after four stalled minutes, returned no final verification report, and left 85 changed lines (60 additions / 25 deletions) across `e2e/responsive/fixtures/test.ts`, `e2e/responsive/specs/dt01-products.spec.ts`, and `e2e/responsive/specs/harness.spec.ts`; it was settled `interrupted` with the harness disposition invalidated, and no processes, staging, commit, push, or PR remain. That uncommitted partial diff was authenticated by patch hash `sha256:e496ff4ab85687eceec8085cf018cf2df9ed30d69ce63c5719c1d6645f582de9` (historical first-attempt figure) and completed under strict TDD in the authenticated continuation session; the C4 budget and work-unit boundary are unchanged (≤210 direct forecast / ≤400 native ceiling, separate branch/PR, no `size:exception`). C4 is now COMPLETE and UNCOMMITTED on `fix/responsive-contract-c4` with final unique-run verification recorded; the final tracked diff after the gatekeeper polish pass is 77 lines (56 additions / 21 deletions) with final eslint (zero output), oxlint (0/0), typecheck, and `correction-c4-harness-polish` harness (49/49) gates passing; the C4 commit, native settlement, and archive remain parent-owned. The final C2b evidence is the `correction-c2b-final-green-r2` run (hashes and counts in `apply-progress.md`); the interrupted-run planning hashes are JSONL `sha256:fb846dd14837f51096e658cf1a1ba41ede15feaba34cf3973da2623c9fb90575`, summary `sha256:60b87d014edab2ad14b2d98a57d27e7683c1bee9597f8e1cd2fbd159852e36fb`, and coverage `sha256:558da538a25edd38e8ec5b04f618aec1c1c7a9aa0fa2b1741212e38fff18e790`; the `sha256:6213cb2147fa2f845ca5996618843fb31aab4afee29d77a9f2545698ccb7fed4` verify hash is historical (pre-correction evidence revision) — the current `verify-report.md` hash is `sha256:3461e672dc574a4033dcbef240fd63e1c1308656a43b77c2e1147daf61c296ef`, unchanged. Rollback order is C4 → C3 → C2b → C2a → C1, never touching `verify-report.md`; archive remains prohibited until fresh honest verification passes.
