# Online catalog backoffice — integral verification corrections

## Outcome and authority

Resolve the bounded findings from integral verification without reopening delivered WU1–WU6. The user authorized corrections with strict TDD, reverification, and a new RDD review. A new commit still requires separate approval. Use ODD, not SDD; preserve OpenSpec as historical requirements and evidence.

Baseline: `feat/online-catalog-backoffice`, commit `06f19af4aa595d247455a31c0110344985aaa303`. WU6 review `review-574432c219d46c00` is approved and acknowledged; never reopen it.

## Problem and decisions

- Full unit suite: 6322 passed, 6 failed across three files; build/types passed. The historical reka-ui teardown exception did not recur.
- The notification sidebar mock grants unrelated catalog permission while expecting the entire Sistema group to disappear. Scope that fixture explicitly and preserve its absence assertion. The user approved correcting the mapped path to `useSidebar.notifications.spec.ts`; do not edit the already-correct catalog navigation spec.
- The service-type view mock omits the tenant identifier required by the settings query. Restore that test input, not production behavior.
- GET/PATCH settings responses bypass the existing warning-filter mapper. Reuse `parseCatalogSettingsResponse`; preserve string-schema validation, silently drop unknown string codes, and reject non-string members. Do not change schemas, mapper, or production permission rules.
- Two variant autosave tests timed out only in the full suite. An isolated run passed 13/13. Missing root unmount/query cleanup is a supported lifecycle risk, not a proven timeout cause. Instrument cleanup before claiming a fix; never inflate timeouts or add fake timers.

## Scope and constraints

Allowed implementation paths:

- `src/app/composables/__tests__/useSidebar.notifications.spec.ts`
- `src/features/POS/products/views/__tests__/ProductDetailView.serviceType.test.ts`
- `src/features/system/catalog-settings/api/catalogSettings.api.ts`
- `src/features/system/catalog-settings/api/__tests__/catalogSettings.api.spec.ts`
- `src/features/POS/products/components/__tests__/VariantDetailModal.catalog.spec.ts` (local lifecycle instrumentation and cleanup only)
- `src/features/POS/sales/views/__tests__/SalesListView.test.ts` (newly authorized local lifecycle regression and cleanup only; preserve the five existing corrections)

The parent owns this task document. No edits to OpenSpec, navigation registry, product/variant production code, type schemas, mapper, or `src/test/mountWithUApp.ts`. No dependency installs, configuration changes, SDD actions, archive, merge, push, or automatic commit. Preserve `stash@{0}` (`0a121804f963e07b4038547b5b2e3c96cfbc2893`), `/tmp/wu3b-candidate-input-20260915-113735`, and the two historical untracked OpenSpec files.

Plan approximately 45–65 deterministic correction lines plus 20–35 lifecycle diagnostic lines and this document. About 400 changed lines is an advisory planning heuristic for this follow-up, not a reason to omit tests or compress code. The committed WU6 candidate remains untouched.

## Tasks and acceptance

- [x] T1 — Reconcile findings and exact edit surfaces. Read-only mapping completed; parent corrected its erroneous sidebar path with explicit user approval.
- [x] T2 — Repair notification/service test contracts. Observe their current failures first; preserve meaningful positive and negative permission assertions and service behavior.
- [x] T3 — Cover and fix GET/PATCH warning filtering. Observe RED for mixed known/unknown strings; GREEN must preserve known codes, remove unknown strings, reject object/non-string warning members, and retain stripping/body-whitelist behavior.
- [x] T4 — Diagnose variant lifecycle cleanup locally. Validate the regression against the historical DOM-only cleanup before restoring real root unmount. Require an actually mounted dialog above the pre-mount baseline and an observable unmount callback, with no swallowed teardown errors. Query-observer checks apply only to genuine observed queries; the modal uses a mutation, so document non-applicability rather than inventing a probe. Clear the query client after unmount; no timing workarounds. Keep timeout causality explicitly unresolved unless established.
- [ ] T5 — Verify the resulting candidate. Focused tests, full unit suite, build, non-mutating lint, diff checks, and applicable mocked-browser checks must report actual exits. Failures remain blockers, not waived by isolated passes.
- [ ] T6 — Assess and review the new candidate under RDD. Follow fresh native assessment and consent/continuations; include only intended correction paths and this document, excluding historical untracked files.
- [ ] T7 — Present results and request separate commit approval. No commit until explicitly approved.
- [x] T8 — Diagnose the SalesList worker shutdown read-only. The single authorized isolated run passed 46/46 with no shutdown timeout; source inspection found 46 mounts without teardown. Causality remains unproven; prior full-suite acceptance remains blocked.
- [x] T9 — Correct SalesList test lifecycle and complete the explicitly approved prospective proof. All existing mounts use real root cleanup; the strengthened assertion directly checks mounted/unmounted state and was independently validated in source. Writer reports behavioral negative-control RED and focused 48-test GREEN. **The original strict-TDD deviation and the lack of dedicated raw execution logs for this follow-up remain disclosed, not retroactively repaired.** The sole full-suite run predates the final assertion/comment-only improvement; no full-suite claim applies to the final hash. No further suite, scope expansion, or delivery is authorized.

## TDD and checks

TDD: **on**, explicitly authorized by the user for this correction. Runner: `pnpm test:unit --run`. Record observed RED before implementation, GREEN, then REFACTOR. Do not use npm/watch-mode alternatives or fabricate red evidence.

Focused commands:

```sh
pnpm test:unit --run src/app/composables/__tests__/useSidebar.notifications.spec.ts src/features/POS/products/views/__tests__/ProductDetailView.serviceType.test.ts
pnpm test:unit --run src/features/system/catalog-settings/api/__tests__/catalogSettings.api.spec.ts
pnpm test:unit --run src/features/system/catalog-settings/api/__tests__/catalogSettings.api.spec.ts src/features/system/catalog-settings/utils/__tests__/catalogSettingsMappers.spec.ts
pnpm test:unit --run src/features/POS/products/components/__tests__/VariantDetailModal.catalog.spec.ts
```

Final checks:

```sh
pnpm test:unit --run
pnpm build
pnpm exec oxlint src/app/composables/__tests__/useSidebar.notifications.spec.ts src/features/POS/products/views/__tests__/ProductDetailView.serviceType.test.ts src/features/system/catalog-settings/api/catalogSettings.api.ts src/features/system/catalog-settings/api/__tests__/catalogSettings.api.spec.ts src/features/POS/products/components/__tests__/VariantDetailModal.catalog.spec.ts
git diff --check
pnpm exec playwright test --config=/tmp/online-catalog-backoffice-browser-06f19af/playwright.config.ts
```

Browser verification uses the existing temporary authenticated strict-network harness at 375×667 and 1280×800. No real backend writes. Keep new evidence distinct from baseline; preserve baseline logs/screenshots. The parent coordinates this check after writer completion.

## Evidence and progress

Baseline suite/build logs: `/tmp/online-catalog-backoffice-verification-iC3Cgc6i/`. Isolated variant PASS: `/tmp/variant-detail-modal-focused.a9uiRy/`. Baseline browser: `/tmp/online-catalog-backoffice-browser-06f19af/`, 12/12 checks passed; visual follow-up 2/2 passed after animation completion. These establish baseline facts, not proof of the forthcoming correction candidate.

REQ-19 path isolation was confirmed with both diff and per-commit history across `9e234d0..06f19af` for public catalog, publishing artifacts, and admin tenant surfaces. Browser evidence is temporary, not a committed E2E suite. Direct create/inline-builder execution coverage remains a separately recorded gap, outside this correction scope.

Incident recovery completed and independently read back by the parent: `env.d.ts` matches HEAD; two unauthorized shims are absent; the service test retains only the tenant mock addition. Reversible originals and SHA-256 manifest are in `/tmp/online-catalog-recovery-20260916141505-72w1wu`. Other intended changes and this document were preserved. The initial writer's lifecycle RED called a nonexistent method and its replacement probe could pass vacuously. Those claims are not accepted.

The located writer log `/tmp/correcciones-online-catalog-20260916-134435/test-logs/full-suite-20260916-140636.log` reports 6337 passes; its claimed earlier unhandled-error log was not located, so no cause or pre-existing attribution is established. That writer log is historical only; independent evidence below supersedes it for the current candidate.

T4 parent correction now has observed behavioral evidence in `/tmp/online-catalog-t4-parent-LfxZrs/`: the historical DOM-only negative control failed because the real `onUnmounted` callback ran zero times instead of once (13 other cases passed); attempting delayed unmount after DOM destruction also exposed a `nextSibling` teardown error. Restoring root-unmount-before-DOM cleanup passed 14/14. The regression invokes the same cleanup function as `afterEach`, asserts an actually mounted dialog, and cannot pass on DOM removal alone. No timeout cause is inferred. Five-file oxlint and diff check passed; the other four file hashes remained unchanged.

The active TypeScript LSP reports Vue import resolution diagnostics in the two SFC test files (three diagnostics, plus one inconclusive file); no clean-LSP claim is made. No shims/configuration changes were used. Independent build passed with the root `vue-tsc --build`: `tsconfig.json` references both app and Vitest projects, and `tsconfig.vitest.json` includes the tests with an empty exclusion list. Thus the root build includes test type-checking even though the app-only project excludes tests.

Independent verification of the recovered candidate: focused 5 files / 80 tests passed; build, five-file oxlint (0 warnings/errors), and diff check passed. T2/T3 semantics and T4 non-vacuity were independently confirmed; hashes and protected state stayed unchanged. Logs: `/tmp/online-catalog-independent-verify-BrUpfY82/`. A preliminary timing wrapper exited 127 before invoking pnpm because `/usr/bin/time` was absent; the focused command itself ran once.

Historical T5 blocker before T9: the full suite ran once and exited 0 with 396 files / 6337 tests passing, but `full-suite.log:14` reports `[vitest-pool]: Timeout terminating forks worker` for `SalesListView.test.ts`, alongside six JSDOM navigation notices. All assertions passing does not establish clean worker shutdown. No cause, prior existence, or connection to these corrections is established. Do not retry to obtain green or modify sales tests outside the authorized scope.

Corrected-candidate browser reverification passed once: 12/12 scenarios, 31.1 seconds, no retries, at 375×667 and 1280×800. Evidence and stable screenshots: `/tmp/online-catalog-browser-corrected-wXoDTjAm/`. Strict networking recorded zero violations and no unexpected console/page errors; expected blocked external font/icon requests are separately recorded. All five source hashes and protected artifacts remained unchanged. This completes the browser check, not the blocked full-suite acceptance.

Read-only native assessment was `unassessable` because package-local binary validation failed. No reinstall or configuration change is authorized; no new review lineage has been started. The current correction candidate remains uncommitted; broader fixes and commit still require separate approval.

T8 completed read-only after reconciling disk, mirror 8295, and summary 8330. The exact isolated SalesList command ran once: 46/46 passed, exit 0, 24.95 seconds Vitest / 25.969 seconds elapsed; no shutdown timeout, navigation notices, or other errors. Evidence: `/tmp/online-catalog-saleslist-t8-Niavn00s/`; parent read the complete log, timing metadata, and identical-state comparison. All protected state stayed unchanged. Source diagnosis found 46 mounted Vue roots without explicit or automatic unmount, shared reactive fixtures, and component/composable watchers. Retained effects are a supported lifecycle risk, not a proven cause of the full-suite timeout; timer survival and prior navigation notice attribution remain unproven. Memory 8343 and summary 8344 record this completed diagnosis.

The user subsequently explicitly selected **focused verification plus one full-suite run** for a single-file SalesList lifecycle correction with strict TDD (authority memory 8359). This supersedes only the earlier read-only/no-suite restriction for T9; all other preservation constraints remain. Parent updates this ODD document and its full mirror before source writes. The writer may change only `SalesListView.test.ts`, run the focused command during RED/GREEN and the final full suite once, and run non-mutating file lint/diff checks. Commands: `pnpm test:unit --run src/features/POS/sales/views/__tests__/SalesListView.test.ts`, `pnpm test:unit --run`, `pnpm exec oxlint src/features/POS/sales/views/__tests__/SalesListView.test.ts`, `git diff --check`. Run the full suite only after the focused regression is GREEN. New failure means stop and report, not broaden or retry. No browser rerun is required for test-only cleanup; prior browser/build evidence remains historical and must not be relabeled as newly executed. After checks, reassess the current candidate under RDD and follow native consent/continuations if available. No automatic commit, archive, merge, or push.

T9 writer changed only `SalesListView.test.ts`: all 46 existing mounts use a registered helper and `afterEach` calls real root unmount. Writer GREEN: 48 tests; lint and diff check passed. Full suite executed once: log shows 396 files / 6339 tests passing in 92.58 seconds, six navigation notices, and no worker-termination timeout. Exit 0 is writer-reported; the saved full-suite log does not independently retain the raw process exit. Logs: `/tmp/online-catalog-saleslist-t9-20260916154906/`. No causal claim about the historical timeout follows from this pass.

Fresh native assessment returned `unassessable` (native command returned empty output), requiring independent verification. Independent verifier `mu4n896z-3-e4ti` returned **PARTIAL**: focused test executed once, 48/48 passed, exit 0, 5.01 seconds Vitest / 5967 ms elapsed, clean stdout/stderr; protected pre/post state identical. Evidence: `/tmp/online-catalog-saleslist-t9-independent-20260916160101-2377966/`. Parent separately confirmed the five prior correction hashes, file lint, and diff check. Active LSP still reports two Vue import-resolution errors in SalesList; no clean-LSP or fresh-build claim is made.

T9 acceptance gap: baseline 46 passed, helper 46 passed, first unmount probe 47 passed, RED-v2 failed a registration-count assertion with an additional unhandled TooltipProvider rejection, then GREEN 48 passed. The real-unmount probe never demonstrated RED. The two current tests meaningfully cover registration and real cleanup indirectly, but do not establish test-first implementation of unmount behavior; this history cannot be retroactively repaired. Probe comments incorrectly claim `mountSalesList()` while directly mounting/registering `CleanupProbe`. T5/T9 remain unaccepted pending disposition; T6 review has not started and T7 commit is not approved. Memory 8377 records the independent finding. Proposed next scope, requiring fresh approval: strengthen direct SalesList-wrapper unmount proof and correct misleading regression comments in this same file, with a focused behavioral negative control and GREEN verification. Record that as new evidence, not reconstructed historical TDD; no automatic full-suite rerun, broader fixes, or delivery.

The user explicitly authorized **Complete the proof** (memory 8381): improve the direct SalesList-wrapper unmount assertion and misleading comments in this file, run a focused behavioral negative control and GREEN, retain the original TDD gap honestly, and do not run another full suite or commit. The negative control may temporarily omit only the real `root.unmount()` call while retaining registry clearing, proving that an empty registry alone cannot pass. Run only the named SalesList cleanup regression for this RED control to avoid accumulation from the other 46 cases; restore real unmount before running the complete SalesList file GREEN. Preserve snapshots and actual exit metadata for both runs. No production, helper-call-site, import workaround, configuration, or other file changes.

Approved proof follow-up completed: the SalesList regression asserts `wrapper.exists()` before cleanup and false afterward, alongside an exact registration increment and empty registry. Misleading probe comments were corrected; the root-unmount implementation and all 46 original helper call sites stayed byte-unchanged. Pre-edit snapshot is the regular file `/tmp/online-catalog-t9-negative-control-baseline-20260916160955`. Final SalesList SHA-256: `060734aa1f02dcd5a0e63d40cca5cae3262112382d91e0f99336e27b4c751b00`.

The writer reports one filtered negative control: omitting only `root.unmount()` while clearing the registry caused the direct unmounted assertion to fail (received true, expected false), exit 1, one failed / 47 skipped; a Vue `loading` warning also appeared, without established attribution. Restored cleanup then passed 48/48, exit 0, 6.48 seconds, clean stderr. No separate logs or exit metadata were saved despite the instruction; these executions remain worker/tool-transcript reported. This is a disclosed evidence limitation, not independently captured raw proof. No new full-suite run occurred.

Final independent read-only validation `mu4nshi3-6-awdy`: functional regression quality **PASS**, scope/protected state **PASS**, execution-evidence provenance **PARTIAL**; no new functional defect. Only the regression block changed from the previous candidate. The original strict-TDD historical deviation remains recorded. Parent repeated file lint and diff checks successfully. Memory 8391 records these results and the preservation checks.

T6 next: native assessment again returned empty output, so its high-risk fallback required the independent validation above. Native `inspect` now responds and requests intended-untracked selection before a new ordinary review. Include only this ODD document plus the six intended source paths; exclude the two historical untracked files and never reopen WU6. Present native candidate consent and follow exact continuations. Freeze this document before starting review; store subsequent authority results in Engram/session evidence without changing the reviewed candidate. No commit approval or delivery is implied.
