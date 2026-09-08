# Apply Progress: responsive-table-contract-and-evidence correction

## Correction status

**Status:** C4 COMPLETE (uncommitted, parent-owned commit) — C1, C2a, C2b, C3, and C4 are complete. C4 was finished on `fix/responsive-contract-c4` by absorbing the authenticated 85-line partial diff from the interrupted first attempt (patch `sha256:e496ff4ab85687eceec8085cf018cf2df9ed30d69ce63c5719c1d6645f582de9`) and completing strict RED → GREEN → TRIANGULATE → REFACTOR; its full record is the "C4 discovery, lint, scripts, and final gates final record" section at the end of this file. Final unique-run verification (conformance + headed) shows genuine surface RED only with 0 setup/reporter/duplicate errors. Historical C3 state: committed as `932e8bb57feb5babce3b330c115e632c9be1586d` on `feat/responsive-table-contract-c3` (five reviewed files, 252 additions and 36 deletions, 288 changed lines); review `review-5fb15c27b24a989f` approved the fresh target `sha256:27d14f4b9490b59e32ba8d98eb2d00d8b34f2f38b62bd445356c65d249d7e12a`, was acknowledged, and its review authority was burned; the old review `review-09056a726968064f` remains terminal escalated and untouched. Deterministic C3 independent evidence: 204 records (130 pass / 58 fail / 16 excluded), eight classified error-state RED, zero harness/setup/reporter/duplicate errors; typecheck, harness 49/49, and lint/LSP passed. The advisory findings `R3-bounded-verify-timeout` and `R3-error-readiness-race` are deferred and were not implemented in C4. Stale-recipient recovery and the error-4xx genuine product RED remain preserved historical evidence limitations, not default C4 work. `verify-report.md` remains byte-identical and historical until future final verification; current hash: `sha256:3461e672...c296ef` (unchanged).

**Review/RDD state (post-C3):** review `review-5fb15c27b24a989f` approved the fresh C3 target `sha256:27d14f4b9490b59e32ba8d98eb2d00d8b34f2f38b62bd445356c65d249d7e12a`, was acknowledged, and its review authority was burned. The old review `review-09056a726968064f` remains terminal escalated and untouched. Historical pre-commit review references (`review-6ab12ee4e3b1e417` correction_required; candidate `27a806eb4512ea6c5475803275dfd20ee0e342f7` requesting `intended_untracked_selection_required`) described the superseded pre-C3-commit state only. PRE-reconciliation native status snapshot (not recomputed by this reconciliation): 16/24 completed, apply ready, verify/archive blocked ("failed verification evidence is incomplete; rerun SDD verification").

**Historical C2a apply scope (superseded):** during the C2a unit only, the allowed edits were the C2a surfaces (`e2e/responsive/specs/dt01-products.spec.ts`, `e2e/responsive/targets/dt01-products.ts`, `e2e/responsive/assertions/{geometry,accessibility}.ts`) plus this file and `tasks.md`. C2a and all later units through C2b are completed historical facts; this scope no longer governs current work.

**Current documentation-reconciliation scope:** the only authorized edits are `tasks.md` and `apply-progress.md` (this file). Forbidden for this reconciliation: any `src/**` or `e2e/**` edits, evidence generation or modification, any rewrite/deletion of `verify-report.md`, installs, staging or commits, tests, authority or review lifecycle mutations, and push/PR/sync/archive. Previously completed units and their commits (through C3 at `932e8bb`) remain historical facts and are not reopened. C4 and final SDD verification remain pending and require separate authorization before any execution.

## Preserved failed verification evidence

- Failed report: `openspec/changes/responsive-table-contract-and-evidence/verify-report.md`.
- Historical pre-correction evidence revision / whole-tree hash: `sha256:6213cb2147fa2f845ca5996618843fb31aab4afee29d77a9f2545698ccb7fed4` (superseded — the current `verify-report.md` hash is `sha256:3461e672dc574a4033dcbef240fd63e1c1308656a43b77c2e1147daf61c296ef`).
- Authorized run: `RESPONSIVE_RUN_ID=sdd-verify-conformance pnpm test:responsive:conformance`.
- Result: exit 1; 44 executed, 32 passed, 12 failed, 0 skipped; 168 records; 0 setup/reporter errors.
- Accepted surface RED preserved: DT-01 `semantic-or-name` ×4; HY-04 `state-usability` ×4; HY-04 `target-size` ×4.
- `pnpm type-check:responsive`: exit 0.
- OpenSpec CLI: exit 127 (`openspec: command not found`), recorded as warning only.
- Oxlint: two existing errors — empty fixture destructuring and unused `assertOverflowContract` import.

## Current implementation ancestry

The current tip is `932e8bb57feb5babce3b330c115e632c9be1586d` (`932e8bb`, the C3 commit) on `feat/responsive-table-contract-c3`; the C3 implementation is committed and no uncommitted implementation diff remains on top of it. Based on `main` `44f993b731647203dfeb3a4c1a89b9f8130fa49f`. Existing correction/C1 commits are retained:

| Unit | Commit | Message |
|---|---|---|
| WU-1a | `7e20e12` | `test(responsive): establish Playwright runner bootstrap` |
| WU-1b1 | `2d7a786` | `test(responsive): add typed target policy contracts` |
| WU-1b2 | `3667b57` | `test(responsive): add evidence schema contracts` |
| WU-2 | `5876209` | `test(responsive): add geometry and overflow evidence assertions` |
| WU-3 | `b229f2e` | `test(responsive): add semantic interaction and state evidence assertions` |
| WU-4a | `c414bdd` | `test(responsive): add deterministic session and network fixtures` |
| WU-4b | `82edc4b` | `test(responsive): add responsive evidence aggregation` |
| WU-4c | `3b3bfba` | `test(responsive): add representative responsive target adapters` |
| bounded correction | `215aca4` | `fix(responsive): resolve rendered panel and external audit` |
| WU-4d | `cb53f73` | `test(responsive): add strict representative conformance specs` |
| C1 | `afb75b3`, `105a31a` | `test(responsive): enforce substantive evidence identity`; `fix(responsive): bind containment to rendered surfaces` |

C1 is complete locally. Its direct implementation diff was 142 lines, followed by a 25-line containment correction; required C1 harness/type/lint gates passed, and the pre-existing unit-test teardown issue was not a C1 failure.

## Ordered correction chain

| Order | Unit | Status | Direct ceiling | Native ceiling | Dependency | Branch / commit |
|---:|---|---|---:|---:|---|---|
| 1 | C1 evidence identity/ownership/risk/authority | COMPLETE | 240 | 400 | `cb53f73` | `fix/responsive-contract-c1` / `fix(responsive): make evidence ownership and attribution substantive` |
| 2 | C2a DT-01 table-focused contract | COMPLETE — `ac4d60b`, native settlement complete | 290 | 400 | C1 + partial C2 diff | `feat/responsive-table-contract-c2` / `fix(responsive): complete DT table contract evidence` |
| 3 | C2b DT-01 card/state contract | COMPLETE — `8a2e7ba` committed, natively settled (outcome passed) | 280 | 400 | verified C2a | `feat/responsive-table-contract-c2b` / `fix(responsive): complete DT card and state evidence` |
| 4 | C3 HY-04 state/network closure | COMPLETE — `932e8bb` committed; review `review-5fb15c27b24a989f` approved/acknowledged, authority burned | 290 | 400 | verified C2b | `feat/responsive-table-contract-c3` / `fix(responsive): close HY-04 state and network evidence gaps` |
| 5 | C4 discovery/lint/final gates | COMPLETE — uncommitted on `fix/responsive-contract-c4` (77 direct lines after the polish pass: 56 additions / 21 deletions); commit/settlement parent-owned | 210 | 400 | verified C2b + C3 | `fix/responsive-contract-c4` / `fix(responsive): harden strict conformance discovery and gates` |

The proposed correction delivery remains stacked-to-main under `ask-on-risk`; C2a is `ac4d60b`, C2b is `8a2e7ba`, and C3 is `932e8bb` on `feat/responsive-table-contract-c3`; no C4 commit has been created. The first C4 attempt (`mtstj53j-2-m7w8`) was settled `interrupted` and left the preserved 85-line partial diff (60 additions / 25 deletions) uncommitted for diagnosis and continuation.

## C2 interruption and rescaling

C2 was interrupted after **102 direct implementation lines** because the eight verified gaps require another estimated **210–250 direct lines**. The native objective was rescaled to C2a and C2b; both units completed within their direct/native ceilings and are checked complete in `tasks.md`. C2b is natively settled (outcome passed).

### Interrupted run and evidence hashes

`RESPONSIVE_RUN_ID=correction-c2-triangulate-contract pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/dt01-products.spec.ts` exited 1: 36 tests, 28 passed, 8 structured surface RED, 220 records (186 pass, 26 fail, 8 excluded), and 0 setup/reporter errors.

- JSONL: `sha256:fb846dd14837f51096e658cf1a1ba41ede15feaba34cf3973da2623c9fb90575`
- Summary: `sha256:60b87d014edab2ad14b2d98a57d27e7683c1bee9597f8e1cd2fbd159852e36fb`
- Coverage: `sha256:558da538a25edd38e8ec5b04f618aec1c1c7a9aa0fa2b1741212e38fff18e790`
- Historical verification revision: `sha256:6213cb2147fa2f845ca5996618843fb31aab4afee29d77a9f2545698ccb7fed4`

The interrupted run exposed table `missing-scroll-discoverability`, table/card `target-size` and `focus-obscured`, card `long-data-clipping`, and `surface-outside-owner`, while retaining the accepted table action RED. These are planning inputs, not completed evidence.

## C2a final bounded verifier corrections

The independent verifier blocked C2a on four defects; all four were corrected inside the C2a surfaces only, with no `src/**`, config, or `verify-report.md` changes:

1. DT long-dense final Playwright verdict now includes every `controls` result status — recorded control failures can no longer produce a false passing test.
2. Preference evidence measurements explicitly name both actual keys, `products-view-mode` and `table-preferences-pos-products`, alongside measured stored values.
3. Sticky/pinned geometry assertions fail with structured box evidence on zero-sized (width/height ≤ 0) sticky header or pinned header/body boxes, not only null.
4. Strict TDD re-run under unique `correction-c2a-fix-*` run IDs plus a verdict-coupling audit.

### Correction run commands, counts, and hashes

- `RESPONSIVE_RUN_ID=correction-c2a-fix-red pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/dt01-products.spec.ts` — exit 1 (genuine surface RED only): 36 tests, 28 passed / 8 failed; 280 records (226 pass / 46 fail / 8 excluded); 0 setup/reporter errors; 16 attached long-dense control `target-size` fail records whose statuses the pre-fix final verdict omitted. JSONL `sha256:7cf26d30d36fe007e987ce11f3490b0536a23d2bf0314627272d238fec04100c`, summary `sha256:7ac25750ec9cce79fbe7a1ed96cea0ab9fa6ba074c397c2341f189eeb716f742`, coverage `sha256:558da538a25edd38e8ec5b04f618aec1c1c7a9aa0fa2b1741212e38fff18e790`. Path: `artifacts/responsive/correction-c2a-fix-red/evidence/`.
- `RESPONSIVE_RUN_ID=correction-c2a-fix-green pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/dt01-products.spec.ts` — exit 1 with the same 8 genuine surface RED preserved and identical taxonomy distribution, 0 setup/reporter errors. JSONL `sha256:feb9d897a166d8f1077f08c4c154ee80542ae16ebcd0996eafc1f877e166436d`, summary `sha256:48fa5709014200246512aaf01711f36fd4a560c5557437b51042e91e79ec18ae`, coverage `sha256:558da538a25edd38e8ec5b04f618aec1c1c7a9aa0fa2b1741212e38fff18e790`. Path: `artifacts/responsive/correction-c2a-fix-green/evidence/`.
- `RESPONSIVE_RUN_ID=correction-c2a-fix-harness pnpm test:responsive:harness` — 49/49 passed, exit 0.
- `pnpm type-check:responsive` — exit 0. `pnpm exec eslint e2e/responsive playwright.responsive.config.ts --no-cache` — exit 0.
- `pnpm test:unit --run` — 5948/5948 tests passed (370 files). Run 1 exited 1 with 3 pre-existing flaky reka-ui teardown unhandled errors (`document is not defined` in `SaleDetailView.test.ts` toast timers, documented since C1, unrelated to C2a e2e surfaces); rerun exited 0.

### Verdict-coupling audit and budget

- 46 fail records = 46 verdict failure entries; 0 failure entries map to a passed test; every long-dense control fail record is inside the final `expect` that decides the test verdict.
- Blocker-3 RED is a narrowly justified exception: a zero-sized pinned/sticky box cannot be manufactured in the real app DOM without injection that violates the suite's strict locator conventions; the guard is exercised by the unchanged genuine RED/GREEN runs, type-check, and harness.
- Commit `ac4d60b` contains 196 changed lines (163 additions / 33 deletions) from `105a31a` across the four C2a tracked surfaces — within the ≤290 direct / ≤400 native budget. Historical record: this text predates C2a's native settlement (outcome passed); staging was clean at the time of the record.

The interrupted run's planning hashes and the accepted-taxonomy REDs above remain the preserved planning inputs.

## C2b card/state contract final record

**Scope applied:** DT spec (`e2e/responsive/specs/dt01-products.spec.ts`), adapter exclusions (`e2e/responsive/targets/dt01-products.ts`), collection-semantics field measurement (`e2e/responsive/assertions/accessibility.ts`), and state/recovery contracts (`e2e/responsive/assertions/states.ts`). No `src/**`, config, or `verify-report.md` changes. Historical record: staging was untouched at the time of this snapshot; C2b is now committed as `8a2e7ba` and natively settled (outcome passed).

### Strict TDD lifecycle

- **RED** — `RESPONSIVE_RUN_ID=correction-c2b-red pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/dt01-products.spec.ts --grep 'C2b card|C2b state'`: exit 1; 32 executed (28 passed / 4 failed), 204 records (144 pass / 44 fail / 16 excluded), 0 setup/reporter errors. JSONL `sha256:0d845462adddd7a4128381eab146051d6a3d9b42cf5a932b6b40989ccbff1e6b`, summary `sha256:eb2ce7d4fd27654d8256e56f4bf0f60d5bf410bf4b9e826edbb59f40ec3de455`, coverage `sha256:558da538a25edd38e8ec5b04f618aec1c1c7a9aa0fa2b1741212e38fff18e790`.
- **GREEN** — `RESPONSIVE_RUN_ID=correction-c2b-fix-green pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/dt01-products.spec.ts`: exit 1; all 40 tests discovered, 36 completed with 20 fail records (16 genuine surface RED + 4 no-match request-count setup failures), 208 records, 16 excluded. Its predecessor `correction-c2b-fix-red` (36 completed, 33 fail, 4 setup failures; JSONL `sha256:784b7b7d1366ad0d2ca9f8ddcefda53318391b34c9bddd161e70ac8073ce5b88`, summary `sha256:586533427220a39a742c09b6f0d560d9ca8ed419b8f603f9f47eb018adc9d403`) is retained as intermediate evidence.
- **Deterministic diagnosis** — `RESPONSIVE_RUN_ID=correction-c2b-diagnose-nomatch`: no-match at all four widths passes every attached record (20/20) and fails only the request-count expect, proving the no-match path issues exactly 4 requests (initial products/categories/brands + recovery search; reset is local and still verified visible). Coverage `sha256:1db4e1f9bb6e6c48a9409ee45e844f12fb433c910545fd95c00be563dc0795a5`.
- **Contract correction** — `EXPECTED_REQUESTS['no-match']` aligned from 5 to the observed/contractual 4; measurement/recovery/reset evidence preserved unchanged.
- **Harness regression correction** — the C2b no-short-circuit collection measurement stalled the harness `BAD_CARDS_PAGE` case (declared item locator absent): the pre-C2b code short-circuited on the list-role defect before resolving items, while the new code resolved items first. Fixed with a no-wait `count() !== 1` guard that records a genuine `semantic-or-name` fail and never bypasses the assertion. RED observed as a 30s timeout at `accessibility.ts:69`; GREEN observed with `harness.spec.ts:457` passing.
- **Final run** — `RESPONSIVE_RUN_ID=correction-c2b-final-green pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/dt01-products.spec.ts` (exit 1, genuine surface RED only), then re-run as `correction-c2b-final-green-r2` after the harness guard so the shipped code and evidence match. JSONL `sha256:fb9ebff7764206b4f87a88efb289d6196c98f82999bd8858c2f2cb0960549411`, summary `sha256:8d2a27046c598486adee0b8ef96c4ab59dcf7b7ad8a228ec0bd033e7494bfb17`, coverage `sha256:558da538a25edd38e8ec5b04f618aec1c1c7a9aa0fa2b1741212e38fff18e790`. Path: `artifacts/responsive/correction-c2b-final-green-r2/evidence/`.

### Final run counts, coupling, and audit

- 40/40 tests completed (12 failed / 28 passed), 0 setup failures, 0 reporter errors, no stalls, no retries (`retries: 0` locally, 1.9m wall clock).
- 304 records: 232 pass / 56 fail / 16 excluded. Fail taxonomy: `target-size` ×28, `semantic-or-name` ×8 (4 accepted table action RED preserved + 4 new genuine card collection role RED with all identity/SKU/price/stock/status/action fields still measured), `focus-obscured` ×8, `missing-scroll-discoverability` ×4, `essential-content-loss` ×4, `unexpected-local-overflow` ×2, `long-data-clipping` ×1, `surface-outside-owner` ×1 — no `harness-or-fixture`, no `state-usability`.
- Fail-verdict coupling: 56 fail records = 56 verdict failure entries; 0 failure entries map to a passed test; every recorded status feeds the test's final `expect`.
- C2b audit at 320/375/768/1024: card no-scroll ownership plus honest `scroll-extremes`/`sticky-pinned-alignment` card exclusions (8 excluded records); collection equivalence with every declared field measured despite the genuine role failure; loading/fetching in-flight request proof (state `inFlightRequests` + `fetching-cards` `fetchRequests: 1`); empty/no-match/error/paginated feedback with no-match recovery (search) and reset (local clear) both applied and verified; strict-network afterEach clean on every path; C1 mapping assertion-specific (distinct authority/riskIds per assertionId, no blanket attribution).
- Budget: 199 direct changed lines (159 additions / 40 deletions) across the four C2b tracked surfaces — within the ≤280 direct / ≤400 native ceiling.

### C2b gates

- `pnpm type-check:responsive` — exit 0.
- `RESPONSIVE_RUN_ID=correction-c2b-final-harness-r2 pnpm test:responsive:harness` — 49/49 passed, exit 0 (summary `sha256:56db7a40ec36646e990693682d80037b659104bdab4fb6f958cf87bd5670ac5e`).
- `pnpm exec eslint e2e/responsive playwright.responsive.config.ts --no-cache` — exit 0.
- `pnpm test:unit --run` — 5948/5948 tests passed (370 files), exit 0, single run.
- Generated declarations (`auto-imports.d.ts`, `components.d.ts`) remained byte-identical after all runs; nothing to restore.

Commit `8a2e7ba` contains the C2b implementation; C3 may start only after the parent settles the active C2b native attempt.

## C3 HY-04 state/network closure final record (r2 continuation) — HISTORICAL, superseded by r4

**Historical record (r2):** preserved as a snapshot only; earlier r1/r2/r3 runs must not substitute the definitive r4 record below. The C3 bytes current at r4 differ from the hashes recorded in this r2 section (the spec was later corrected from `ab3f6319...73168` to the current `aa43aa34...bec9`; target `244264a4...6b6444`, accessibility `ce09051c...de515`, and network `d413c024...b38c9` are unchanged), and its 264-line diff and 114/66 record counts describe r2, not the current state.

**Status (historical r2 snapshot, superseded by r4):** C3 implementation was present with selected r2 gates passed, uncommitted. A prior writer session produced the C3 diff (261 direct lines at HEAD `8a2e7ba`); this continuation session (only active writer, isolated worktree `frontend-houndfe-responsive-table-contract`) applied the four independently confirmed current-byte corrections.

### Strict TDD lifecycle

- **RED** — independently observed r1 failures treated as RED per parent authority, plus a fresh in-session RED confirmation: `pnpm type-check:responsive` exit 2 with `TS2345` at spec:103:11 (second `assertSurfaceState` result passed into the single-result `push` helper's `id: string` parameter) and `TS18048` at spec:105:60 (`resolved` possibly undefined in the success branch); r1 runtime `TypeError: stateId.startsWith is not a function` produced four success-state setup failures; r1 harness exit 1 at `harness.spec.ts:758/762` (HY-04 `overlay-lifecycle` `followUp` drifted from `WU-4d overlay coverage`); r1 stale-recipient recovery observed only the first PUT.
- **GREEN** — four corrections inside the four allowed C3 surfaces only: (1) the two success results attach through separate `push` calls, and `resolved` is obtained inside the success branch (its only consumer), eliminating both TS errors and the runtime crash without type assertions; (2) `overlay-lifecycle` `followUp` restored to the harness-expected `WU-4d overlay coverage` (harness untouched); (3) `success-footer` owner-containment evidence now executes and remains identity-distinct (`stateId: 'success-footer'`); (4) stale-recipient recovery builds its result from the bounded `toastVisible` probe, measured toast text, `fieldError.isVisible()`, and actual strict-network PUT bodies — an absent toast is never handed to a waiting assertion, and only an exact first+second PUT sequence with the saved toast passes.
- **TRIANGULATE/REFACTOR** — r2 conformance run exercises loading/success/error-4xx/error-5xx/interaction/save at 320/375/768/1024 with 0 setup failures; no-scroll (`overflow-contract`) and sticky-footer (`owner-containment` `success-footer`) measurements are separate records; stale follow-up replaced; no conformance host filter introduced; counts recorded below.

### Final gate commands (sequential, once, fresh IDs)

- `pnpm type-check:responsive` — exit 0.
- `RESPONSIVE_RUN_ID=c3-final-harness-20260907-r2 pnpm test:responsive:harness` — exit 0, 49/49 passed (13.6s), `.last-run.json` `{status: passed, failedTests: []}`, summary `sha256:7aa2d22f1d5d4198f6de0941fb29c8a389958e57e73892db53d33a107e03d147`, evidence.jsonl empty (sha256 `e3b0c442...b855`, harness records no JSONL).
- `RESPONSIVE_RUN_ID=c3-final-conformance-20260907-r2 pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/hy04-notifications.spec.ts` — exit 1, genuine surface RED only: 24/24 tests finished (7 passed / 17 failed), 196 records (114 pass / 66 fail / 16 excluded), `setupFailures: 0`, `errors: []` (0 reporter errors), 24 test-result dirs with 0 TimeoutError contexts. JSONL `sha256:699acc972bcd553bb8d859c96d7879fb93d776d6e482b51a706fcbfb0279cf5c`, summary `sha256:bd288b595ace45b1060ad6753f6ab225d820df1fb28e1b6fa0c847826cd6439d`, coverage `sha256:3c1ca4c6f44570dfab7e48ccb33a2d1c166a0d5451968f59f0d160813e54b639`. Path: `artifacts/responsive/c3-final-conformance-20260907-r2/evidence/`.
- `pnpm exec eslint e2e/responsive playwright.responsive.config.ts --no-cache` — exit 0.
- `pnpm test:unit --run` — exit 0, 5948/5948 tests passed (370 files), single run.

### r2 conformance audit

- **Verdict coupling:** 66 fail records ↔ 66 summary `failures` entries, every entry `setupFailure: false` joined to one of the 17 failed test ids; the spec's final `expect` compares every attached result status, so no fail record can sit inside a passed test (7 passed tests contain pass/excluded records only).
- **Duplicate identities:** 0 (identity `surfaceId|stateId|viewport|assertionId`); `success-footer` owner-containment records ×4 all pass.
- **PUT observations (actual request logs):** stale-recipient recovery observes exactly the first PUT `{"enabled":false,"recipientUserIds":["ghost-user"],"enabledActions":["LOW_STOCK"]}` (422) and no second PUT, `toastVisible: false` — recorded as measurement-dependent `state-usability` fail ×4 inside the verdict, replacing the r1 setup timeout. This recovery RED remains a genuine product/surface defect for the parent to disposition.
- **Error metadata:** error-4xx/error-5xx `state-usability` fail ×8 (`errorControls: 0, retryControls: 0`) — preserved product strict-red; guarded HR-switch `state-usability` fail ×4 (`hrSwitchCount: 0`) included in verdict; interaction surface REDs: `target-size` ×20, `focus-obscured` ×9, `focus-order` ×8, `keyboard-activation` ×8, `semantic-or-name` ×4, `unexpected-local-overflow` ×1 (success state, one viewport).
- **r1→r2 consistency:** r1's 4 setup failures became real runs — 3 success-state tests now pass, 1 fails with a genuine `unexpected-local-overflow` record; the 16 formerly failed tests remain failed (17 = 16 + 1).

### Budget and bytes

Final direct diff: **231 additions + 33 deletions = 264 lines** across the four C3 tracked surfaces (≤290 direct ceiling; native ≤400). `git diff --check` passes. Final hashes: accessibility.ts `ce09051c...de515` (unchanged from r1), network.ts `d413c024...b38c9` (unchanged), hy04-notifications.spec.ts `ab3f6319...73168`, hy04-notifications.ts `244264a4...6b6444`. `verify-report.md` remains `sha256:3461e672...c296ef`. Working tree contains only the four allowed modifications plus pre-existing untracked `openspec/changes/` directories; no stray test processes; no staging/commits performed.

## C3 r4 final record (historical, superseded by the C3 commit `932e8bb`)

**Supersede note:** this r4 record describes the pre-commit implementation state. C3 is now committed as `932e8bb57feb5babce3b330c115e632c9be1586d` on `feat/responsive-table-contract-c3` and was approved, acknowledged, and authority-burned under review `review-5fb15c27b24a989f`; the r4-era claims of a missing commit or missing authorization are historical. The gate runs below remain historical evidence.

**Status:** C3 implementation is present and the selected r4 gates passed; C3 closure is blocked. The native C3 runtime objective is already settled (complete, outcome passed); no commit exists and none is authorized by this reconciliation. Direct diff vs HEAD `8a2e7ba`: **266 lines** (233 additions / 33 deletions) across the four C3 tracked surfaces (`e2e/responsive/specs/hy04-notifications.spec.ts`, `e2e/responsive/targets/hy04-notifications.ts`, `e2e/responsive/fixtures/network.ts`, `e2e/responsive/assertions/accessibility.ts`), within the ≤290 direct / ≤400 native ceiling.

### Definitive r4 gates

- `pnpm type-check:responsive` — exit 0.
- `RESPONSIVE_RUN_ID=c3-final-harness-20260907-r4 pnpm test:responsive:harness` — exit 0, 49/49 passed. Evidence: `artifacts/responsive/c3-final-harness-20260907-r4/`.
- `pnpm exec eslint e2e/responsive playwright.responsive.config.ts --no-cache` — exit 0.
- `RESPONSIVE_RUN_ID=c3-final-conformance-20260907-r4 pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/hy04-notifications.spec.ts` — exit 1 with genuine surface RED only: 24/24 tests completed (7 passed / 17 failed), 196 records (115 pass / 65 fail / 16 excluded), 0 setup/reporter/duplicate errors, 65/65 attachment-to-fail-verdict join. Evidence: `artifacts/responsive/c3-final-conformance-20260907-r4/`.
- Current C3 file hashes: spec `sha256:aa43aa347bfbac2989851bc2b8a783d4cc5f44bb6b8c75265b8f875c017bbec9`, target `sha256:244264a4ad7379631093ee8c50ba24c99f923c2fc4f269c808d62f98576b6444`, accessibility `sha256:ce09051c00a3ee1e3e2bb724e24550c6eed1cee2c4e320436fef2df1076de515`, network `sha256:d413c024e0982abc4fc4efb020608c37c3230dcb05d6e84bfe7ec19f5b3b38c9`. `verify-report.md` remains `sha256:3461e672...c296ef`.
- Historical r1/r2/r3 conformance and harness runs are preserved as history and must not substitute r4.

### Outstanding C3 closure blockers (historical; superseded by the C3 commit and approved review `review-5fb15c27b24a989f`)

The no-commit-authorization and RDD-conflict blockers below are historical; the fresh review approved and acknowledged C3 and its authority was burned. The evidence-limitation and preserved-RED items remain historical evidence limitations, not default C4 work.

- **Full unit gate (historical r4 failure; current follow-up GREEN):** the r4 full unit run FAILED at 5947/5948 (`useProductSearch` successful retry), and a focused rerun passed 15/15 — both are historical facts. A NEW independent full-unit follow-up run has since passed (see "C3 full-unit follow-up record" below), so the full unit suite is currently green; the r4 run remains failed as history, and full SDD verification is not claimed by this follow-up.
- **No commit authorization:** the C3 diff is uncommitted; this documentation reconciliation grants no commit authorization and creates no commit.
- **RDD conflict:** the bound review `review-6ab12ee4e3b1e417` remains correction_required (not approved, no correction plan submitted; R3-001 conflicts with the user's error-4xx acceptance), and the latest bound STATUS (candidate `27a806eb4512ea6c5475803275dfd20ee0e342f7`) requests `intended_untracked_selection_required` with no selection submitted.
- **Evidence limitation:** stale-recipient recovery is an accepted measured product RED (only the first PUT, no saved toast). Successful recovery is NOT proven and no runtime fulfillment-rejection injection proof exists; this is an outstanding evidence limitation, not authorization to fix the product.
- **Preserved RED:** error-4xx genuine product RED is explicitly accepted by the user; the coverage is preserved and must not be removed or weakened.
- **PRE-reconciliation native status snapshot** (not recomputed by this reconciliation): 16/24 completed, apply ready, verify/archive blocked ("failed verification evidence is incomplete; rerun SDD verification"). C4 and final SDD verification remain pending and are not executed or closed by this reconciliation.

## C3 full-unit follow-up record (current)

A NEW independent full-unit follow-up run was executed once and passed. It supplements — it does not modify or supersede — the historical r4 records, and it does not establish full SDD verification.

- Command (executed once): `pnpm test:unit --run .` — exit 0.
- Result: 370/370 test files passed, 5948/5948 tests passed; no failures and no unhandled errors; 6 `Not implemented: navigation` warnings (Vitest navigation stubs, non-fatal).
- Timing: wall 107.944s (run duration 107944 ms); Vitest reported 100.83s.
- Context (historical at run time): HEAD `8a2e7ba5eb8fbd4298389c9ed2a608393bb9dad5` on `feat/responsive-table-contract-c3`, C3 diff uncommitted at run time, no commit created or authorized at run time; C3 has since been committed as `932e8bb57feb5babce3b330c115e632c9be1586d` and approved under review `review-5fb15c27b24a989f`.
- Evidence: `artifacts/responsive/c3-unit-followup-AJNbdiMx0W/` — `unit-output.log` sha256 `75c3420d18a623423aaa9c85bf5b1742fc81491f61cf1b1cf21bd8227be9aec1`, `exit-status.txt` sha256 `9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa`, manifest `evidence-sha256.txt`. Existing evidence was read, never altered.
- Scope: this follow-up covers the unit suite only. C4 and final SDD verification remain pending and require separate authorization; this follow-up does not by itself establish full SDD verification (the pre-commit review blockers it references are historical and were resolved by the C3 commit and approved review `review-5fb15c27b24a989f`).

## C4 first attempt interruption record

- **sdd-apply task:** `mtstj53j-2-m7w8`.
- **Outcome:** timed out after four stalled minutes; returned no final verification report.
- **Settlement:** `interrupted`; the harness disposition from the attempt is invalidated.
- **Residual diff:** 85 changed lines (60 additions / 25 deletions), uncommitted, across `e2e/responsive/fixtures/test.ts`, `e2e/responsive/specs/dt01-products.spec.ts`, and `e2e/responsive/specs/harness.spec.ts`.
- **Disposition:** the partial diff is preserved for diagnosis and continuation and is not accepted as verified work; all C4 and global gates remain unchecked; no processes, staging, commit, push, or PR remain.
- **Scope correction:** `e2e/responsive/fixtures/test.ts` is added to C4's exact allowed surfaces because C4 owns the known oxlint empty fixture destructuring defect, which lives in that file. The C4 budget and work-unit boundary are unchanged: ≤210 direct forecast / ≤400 native ceiling, separate branch/PR, no `size:exception`.

## Required apply boundaries

C2a must start with RED and absorb the partial DT spec/adapter/geometry changes, then GREEN, TRIANGULATE, and REFACTOR. C2b starts only after C2a verification and must add the card/state records and final DT audit. C3 starts only after C2b; C4 starts only after C2b and C3, and its continuation must absorb and complete the preserved partial diff with `e2e/responsive/fixtures/test.ts` now an exact C4 surface. Every unit must record exact commands, exit codes, unique run IDs, evidence paths/hashes, direct/native counts, branch/commit, and rollback boundary.

Rollback order is **C4 → C3 → C2b → C2a → C1**, returning to the current tip while preserving `verify-report.md` and all failed evidence. No rollback may touch `src/**` or install OpenSpec. Archive remains prohibited until fresh unique-run verification passes with honest coverage; a strict surface RED is acceptable only with zero setup/reporter errors.

## C4 discovery, lint, scripts, and final gates final record

**Scope applied (authenticated continuation session):** the authenticated 85-line partial diff from the interrupted first attempt was absorbed and completed across the exact C4 surfaces `e2e/responsive/specs/harness.spec.ts`, `e2e/responsive/specs/dt01-products.spec.ts`, and `e2e/responsive/fixtures/test.ts`. `package.json`, `playwright.responsive.config.ts`, and `e2e/responsive/targets/types.ts` needed no change: the unique-run conformance/headed/harness scripts already exist and the C1 manifest contract helpers were sufficient. No `src/**`, generated declarations, lockfiles, or `verify-report.md` changes; nothing staged, committed, pushed, or archived.

### Strict TDD lifecycle

- **RED** — `RESPONSIVE_RUN_ID=correction-c4-red pnpm test:responsive:harness` — exit 1: 49 tests, 47 passed / 2 failed, 0 setup/reporter errors. The 2 failures are exactly the new guards observing expected defects: (1) the manifest-drift guard — the previously locked 44-case arithmetic (`4*(7+1) + 4*3`) is stale against real discovery (64 cases: DT-01 7 states + `table and cards`/`fetching cards`/`long dense`, HY-04 4 states + `interaction`/`save recovery`, all ×4 exact widths); (2) the host-filter guard — a second induced external host (`https://tracker.invalid/pixel`) is swallowed by the pre-GREEN substring filter (`violation.includes('external.invalid')`). Oxlint RED (pre-GREEN state, recorded): 3 errors — `no-empty-pattern` at `fixtures/test.ts:21`, unused `label` parameter at `dt01-products.spec.ts:83`, unused `row` variable at `dt01-products.spec.ts:172`. Summary `sha256:fa13d00e340f635891d1a488414ffe471bbbf6221c9269a1885da55c66377913`, coverage `sha256:c24747570ab0dbb7c6c9a677f75d90160b9f5bb41d744494f339bd8bbcd4c92a`; harness runs record no JSONL (empty `evidence.jsonl`, `sha256:e3b0c442...b855`).
- **GREEN** — counts are now derived from discovered cases: `discoverConformanceCases(surfaceId, source)` parses each strict spec's declared state table and per-viewport suite suffixes, and the harness validates the declared conformance contract with `deriveResponsiveCaseManifest` + `validateDiscoveredCaseManifest` (including an invented-case negative drift check) — the tautological `expect(4 * (7 + 1) + 4 * 3).toBe(44)` is gone. Host-substring filtering is removed: startup externals are declared via `EXPECTED_BLOCKED_STARTUP_EXTERNALS`, the first network test asserts the full 7-entry violations array exactly (both external hosts included), the `violations().every(...)` swallow line is deleted, and the deferred-gate test asserts `violations()).toEqual([])`. Lint defects fixed: unused `label` parameter and `row` variable removed from the DT spec; the `test.ts` empty destructuring is resolved with a scoped documented `// oxlint-disable-next-line no-empty-pattern` directive (oxlint-owned rule) because Playwright requires the first fixture argument to be a destructuring pattern (a first GREEN attempt with a named `_fixtures` parameter was rejected by Playwright's runtime check — diagnosed via `RESPONSIVE_RUN_ID=correction-c4-green-diagnose` and corrected in-session). Stale `Batch B`/`Batch C` follow-ups in the harness were replaced with current truthful follow-ups. **GREEN gate:** `RESPONSIVE_RUN_ID=correction-c4-green pnpm test:responsive:harness` — 49/49 passed, exit 0. Summary `sha256:3d15ef05b6eb8a26c35999165875e05e5b15bdc05bf94a0c350f5835b9b0c814`.
- **TRIANGULATE** — all mandated gates under their exact unique run IDs:
  - `pnpm test:unit --run` — exit 0, single run: 370/370 files, 5948/5948 tests (114.27s).
  - `pnpm type-check:responsive` — exit 0.
  - `RESPONSIVE_RUN_ID=correction-c4-harness pnpm test:responsive:harness` — 49/49 passed, exit 0 (summary `sha256:e769105d0caa7033c92240d9d38e965327191a7a4a836704cb044778d140f103`); after the watchdog interruption the resumed tree was re-proven with `RESPONSIVE_RUN_ID=correction-c4-harness-resume` — 49/49 passed, exit 0.
  - `RESPONSIVE_RUN_ID=correction-final-conformance pnpm test:responsive:conformance` — exit 1 with genuine surface RED only: 64/64 tests (35 passed / 29 failed), 508 records (362 pass / 114 fail / 32 excluded), `setupFailures: 0`, `errors: []` (0 reporter errors), 0 duplicate-identity errors. Fail taxonomy (per surface): DT-01 `target-size` ×28, `semantic-or-name` ×8, `focus-obscured` ×8, `missing-scroll-discoverability` ×4, `essential-content-loss` ×4, `unexpected-local-overflow` ×2, `long-data-clipping` ×1, `surface-outside-owner` ×1; HY-04 `state-usability` ×16, `target-size` ×20, `semantic-or-name` ×4, `focus-obscured` ×5, `focus-order` ×8, `keyboard-activation` ×4, `unexpected-local-overflow` ×1. The accepted subsets are preserved: DT-01 `semantic-or-name` ×4 (within ×8), HY-04 `state-usability` ×4 (within ×16), HY-04 `target-size` ×4 (within ×20). Record counts reconcile exactly with C2b (304 records) + C3 (204 records). JSONL `sha256:871aac5b4b9e8a397aa8602193e6d48e4d0abc468a17cb9c7af1b44de5b080b7`, summary `sha256:ff2820fbbf37a4e9244736efd71671b1d819fa2bcaed3ddf5607004950f601da`, coverage `sha256:8e245e843048eee82a8a3f1bcc258d73392d3d0a1c1a4cfb73a948c3f6d67b67`.
  - `RESPONSIVE_RUN_ID=correction-final-headed pnpm test:responsive:headed` — exit 1 with outcomes identical to conformance (64/64 tests, 35/29, 508 records 362/114/32, 0 setup/reporter/duplicate errors, identical taxonomy) — headed wiring proven. Executed after the watchdog interruption: the run was launched detached and polled in bounded steps, the stray `vite --port 4173` server from the interrupted attempt was killed first, and the log is preserved at `artifacts/responsive/correction-final-headed/run-output.log`. JSONL `sha256:f84a9e05566b7ff6c1f7329ed412e455ce16fb04670a91827c30831eb301df50`, summary `sha256:44ba878f12006906fddf8f4271a9ca2f8aa313ea8c05b86c7f36c01c9fe3ca8f`, coverage `sha256:8e245e843048eee82a8a3f1bcc258d73392d3d0a1c1a4cfb73a948c3f6d67b67`.
  - Retry aggregation: `retries: 0` locally (`CI ? 1 : 0`); the reporter's final-attempt-only aggregation and never-upgrade-a-failure behavior remain proven by the harness unit test `retains only the final retry attempt and never upgrades a final failure`, and the conformance/headed summaries show 114 fail records = 114 verdict failure entries (verdict coupling intact).
  - R1–R8 coverage: `coverage.json` shows all eight risks `exercised` in both final runs; DT-01 and HY-04 `exercised`, all other inventory surfaces honestly `unverified`.
  - Exact-width discovery: the manifest drift guard derives and validates cases at 320/375/768/1024 and rejects an invented case; discovery found exactly the 64 declared cases.
- **REFACTOR** — coverage code unchanged and target-independent (`buildCoverage` untouched); after the gatekeeper polish pass the final gates are: `pnpm exec eslint e2e/responsive playwright.responsive.config.ts --no-cache` — exit 0 with zero output (zero warnings, zero errors; the `no-empty-pattern` suppression in `test.ts` is the `// oxlint-disable-next-line no-empty-pattern` directive, so no eslint directive remains); `pnpm exec oxlint e2e/responsive playwright.responsive.config.ts` — exit 0, 0 warnings, 0 errors; `pnpm type-check:responsive` — exit 0; `RESPONSIVE_RUN_ID=correction-c4-harness-polish pnpm test:responsive:harness` — 49/49 passed, exit 0 (final polish harness); `git diff --check` — clean. Earlier recorded eslint/oxlint observations (the temporary unused-directive warning and the pre-polish `correction-c4-harness`/`correction-c4-harness-resume` runs) are historical; forbidden paths (`src/**`, generated declarations, lockfiles, `verify-report.md`, prior evidence) — unchanged; `openspec validate responsive-table-contract-and-evidence --strict` — CLI unavailable (`command not found`), recorded as warning-only per contract.

### Budget, verdict coupling, and process hygiene

- Direct tracked diff from HEAD `932e8bb` after the gatekeeper polish pass: **77 changed lines (56 additions / 21 deletions)** — fixtures/test.ts +1/−0, dt01-products.spec.ts +5/−6, harness.spec.ts +50/−15 — within the ≤210 direct / ≤400 native C4 ceilings. Final binary patch `git diff --no-ext-diff --binary -- e2e/` sha256 `5ecb3d36ed59f4b396d15e6119f7fd46cb6e09ead7442cffdb53f4c23f206ae3`. Historical: the preserved first-attempt partial diff was 85 lines (60 additions / 25 deletions; fixtures/test.ts 1+, dt01-products.spec.ts +6/−7, harness.spec.ts +53/−18) with patch `sha256:e496ff4ab85687eceec8085cf018cf2df9ed30d69ce63c5719c1d6645f582de9`; those 85-line figures describe the interrupted first attempt only, not the current final diff.
- Verdict coupling: 114 fail records ↔ 114 summary failure entries; 0 failure entries map to a passed test; every recorded status feeds each test's final `expect`.
- Processes: no playwright/vite/vitest process remains; the stray dev server from the interrupted attempt was terminated before the headed rerun; port 4173 was free.
- No staging, commit, push, PR, sync, or archive was performed. Rollback boundary: revert the three tracked files only (C4 → C3 → ...).
