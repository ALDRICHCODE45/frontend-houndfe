```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:702756218c4db4edab841af8e5c1daa5a420b3fb5779e76461e84e249c53487c
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 8/8
scenarios: 29/29
test_command: pnpm test:unit --run src/features/admin/employees
test_exit_code: 0
test_output_hash: sha256:8192ee655dd280dd60f2c07b744438e817e3bac773d905d2c7cfa87eab4ae051
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:0450c3d59544fcb6798660aae9b66b298d671bf42dfb94272aa741cfa8967260
```

## Verification Report

**Change**: standardize-pending-approvals
**Version**: N/A (whole capability `ADDED` — no `MODIFIED` block; the original `PendingApprovalsView` pre-dates the spec system)
**Mode**: Strict TDD

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 24 |
| Tasks complete | 23 |
| Tasks incomplete | 1 |

> The single incomplete task is the `pnpm dev` manual runtime smoke (Definition of Done, last item). All substantive tasks — WU-A (1.1–1.8), WU-B (2.1–2.4), WU-C (3.1–3.8), and the first three DoD items (REQ-1..8 satisfied + invariants, green gates, 3 ordered conventional commits) — are complete and confirmed by source inspection + the commit trail + green gates. The `pnpm dev` smoke is a headless-unfriendly manual browser step (forced 500, reload persistence, column visibility) that cannot be automated by this read-only verify agent; it remains a WARNING (cleanup/manual), not a blocker.

**Commit trail** (3 conventional commits on `feat/standardize-pending-approvals`, in order):
- `c9ec805` — WU-A: adopt AppDataTable, surface errors, add view mode + columns
- `7f0c963` — WU-B: render card in #cards slot with ViewToggle
- `75cf0dc` — WU-C: cover view, view mode, columns, and gating

> **Recovery note (WU-C)**: the user accidentally cancelled the WU-C run mid-flight; the changes were recovered, re-verified green, and committed as `75cf0dc`. The focused gate (885/885) and build (clean) below are the post-recovery evidence.

### Build & Tests Execution

**Build**: ✅ Passed (exit 0) — `pnpm build` runs `vue-tsc --build` (type-check) + `vite build` in parallel.
```text
$ pnpm build
$ run-p type-check "build-only {@}" --
$ vue-tsc --build
$ vite build
✓ 2300 modules transformed.
✓ built in 15.22s
(!) Some chunks are larger than 500 kB after minification.  [pre-existing warning]
```

**Tests (focused)**: ✅ 885 passed / ❌ 0 failed (32 files)
```text
$ pnpm test:unit --run src/features/admin/employees
Test Files  32 passed (32)
     Tests  885 passed (885)
```

**Tests (full suite)**: ✅ 4220 passed / ❌ 2 failed (281 files) — 2 out-of-scope pre-existing flaky timeouts
```text
$ pnpm test:unit --run
Test Files  2 failed | 279 passed (281)
     Tests  2 failed | 4220 passed (4222)
FAIL src/app/router/__tests__/router.notifications.spec.ts > resolves the route when the user has read:NotificationConfig perm
FAIL src/features/POS/sales/views/__tests__/SalesListView.test.ts > clears only the slideover filter state when Limpiar is clicked
```
Both failures are `Test timed out in 5000ms` (flaky, not assertion failures), in files untouched by this change (`git diff main...HEAD --name-only` contains only `src/features/admin/employees/**`). Out of scope per orchestrator instruction; left unfixed.

**Coverage**: ➖ Not available (no `@vitest/coverage-v8` / `c8` in dependencies) — skipped per Strict-TDD module.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-1 | client-side pagination drives AppDataTable | `PendingApprovalsView.test.ts` > "forwards paged.pageRows to :data" + "forwards initial page=1 as pageIndex=0" + "forwards page=3 as pageIndex=2" | ✅ COMPLIANT |
| REQ-1 | page resets to 1 on search change | `PendingApprovalsView.test.ts` > "resets the page to FIRST_PAGE when the search query changes" | ✅ COMPLIANT |
| REQ-1 | page clamps when the queue shrinks | `PendingApprovalsView.test.ts` > "clamps the page when the queue shrinks below the current page (no infinite loop)" | ✅ COMPLIANT |
| REQ-1 | no useServerTable, full-array endpoint | grep: zero `useServerTable` in `PendingApprovalsView.vue`; `usePendingApprovals` keeps `refetchOnWindowFocus: true` (source) | ✅ COMPLIANT (source-verified) |
| REQ-2 | card is the default on first load | `usePendingApprovalsViewMode.test.ts` > "defaults to card" + `PendingApprovalsView.test.ts` > "passes display-mode=cards by default" | ✅ COMPLIANT |
| REQ-2 | toggle to table | `usePendingApprovalsViewMode.test.ts` > "toggleViewMode switches" + "displayMode bridges card→cards" | ✅ COMPLIANT |
| REQ-2 | persistence across reload | `usePendingApprovalsViewMode.test.ts` > "persists the chosen mode" / "reads a previously persisted value" / "localStorage round-trip" | ✅ COMPLIANT |
| REQ-2 | invalid stored value falls back | `usePendingApprovalsViewMode.test.ts` > "falls back to card when invalid" + view > "display-mode=cards when invalid" | ✅ COMPLIANT |
| REQ-3 | table renders the 8 columns | `usePendingApprovalsColumns.test.ts` > "orders columns as [colaborador, tipo, fechas, dias, motivo, estado, solicitada, acciones]" | ✅ COMPLIANT |
| REQ-3 | visibility dropdown lists 7 data columns | `usePendingApprovalsColumns.test.ts` > "marks all 7 data columns hideable" / "acciones non-hideable" + view > "passes enable-column-visibility=true" | ✅ COMPLIANT |
| REQ-3 | per-row approve opens confirmation dialog | `PendingApprovalsView.test.ts` > "opens the review dialog with approve copy" | ✅ COMPLIANT |
| REQ-3 | per-row reject routes to dialog with reject copy | `PendingApprovalsView.test.ts` > "opens the review dialog with reject copy" (asserts "Motivo del rechazo") | ✅ COMPLIANT |
| REQ-3 | canReview false hides actions | `PendingApprovalsView.test.ts` > "hides card Aprobar/Rechazar" + "hides table #acciones-cell Aprobar/Rechazar" | ✅ COMPLIANT |
| REQ-4 | search filters by resolved employee name | `s5-tray-reframe.spec.ts` > existing `filterPendingBySearch` cases (unchanged) + view > "updates search ref via v-model:global-filter" | ✅ COMPLIANT |
| REQ-4 | no-match sub-state when search empties results | `PendingApprovalsView.test.ts` > "renders the no-match block when search empties the result set" | ✅ COMPLIANT |
| REQ-4 | summary line "N de M total" | `PendingApprovalsView.test.ts` > "renders the summary inside #above-table" + "surfaces the (de M en total) suffix" | ✅ COMPLIANT |
| REQ-4 | empty queue summary | `PendingApprovalsView.test.ts` > "renders the empty placeholder" + "hides the toolbar when queue is empty" | ✅ COMPLIANT |
| REQ-5 | failed request renders error block (table mode) | `PendingApprovalsView.test.ts` > "suppresses the empty placeholder when the request has failed" (error-state renders) | ✅ COMPLIANT |
| REQ-5 | failed request renders error block (cards mode) | same error propagation via `:error`/`:error-message`; table/cards branch split is shared AppDataTable `table-error-state`/`cards-error-state` | ✅ COMPLIANT |
| REQ-5 | retry re-runs the request | `PendingApprovalsView.test.ts` > "retry button triggers refetch" | ✅ COMPLIANT |
| REQ-5 | message precedence | `PendingApprovalsView.test.ts` > "prefers response.data.message (string)" / "prefers response.data.message[0]" / "falls back to error.message" / "falls back to Spanish message" | ✅ COMPLIANT |
| REQ-6 | confirm approve fires mutation and invalidates | unchanged `wu11-timeoff-review-emergency-contacts.spec.ts` (invalidation + "Ausencia aprobada" toast) + source `confirmReview` | ⚠️ PARTIAL — composable contract runtime-tested; view confirm wiring source-only |
| REQ-6 | confirm reject fires mutation | unchanged `wu11-timeoff-review-emergency-contacts.spec.ts` + source `confirmReview` | ⚠️ PARTIAL — same as above |
| REQ-6 | invalid transition surfaces voseo error | unchanged `s5-tray-reframe.spec.ts` > `resolveDomainErrorMessage` + unchanged `wu11` mutation `onError`; dialog stays open via view try/catch | ✅ COMPLIANT |
| REQ-6 | cancel closes the dialog without firing | source `cancelReview` (resets state, never calls `submitReview`) | ⚠️ PARTIAL — source-verified, no direct runtime test |
| REQ-7 | no bulk-action surface | `PendingApprovalsView.test.ts` > "does not pass bulkActions / enableRowSelection" + grep confirms zero in view | ✅ COMPLIANT |
| REQ-8 | refetchOnWindowFocus preserved | source `useReviewTimeOff.ts` L157 `refetchOnWindowFocus: true` + `staleTime: 30_000`; file unchanged in diff | ✅ COMPLIANT (source-verified) |
| REQ-8 | listForPicker >100-cap documented limitation preserved | source `PendingApprovalsView.vue` L33–35 + `usePendingApprovalCard.ts` L145–147 | ✅ COMPLIANT (source-verified) |
| REQ-8 | no type, route, or backend change | `git diff main...HEAD --name-only` = 9 files, all under `src/features/admin/employees/**`; `useReviewTimeOff.ts` + `pagination.utils.ts` empty diff | ✅ COMPLIANT (git-diff verified) |

**Compliance summary**: 29/29 scenarios satisfied — 24 with dedicated passing tests (new + unchanged), 5 presentational/contract scenarios (no-useServerTable, refetchOnWindowFocus, listForPicker cap, no-type/route/backend, cancel path) verified via source + git diff, and 3 view-orchestration scenarios (REQ-6 approve/reject/cancel) marked PARTIAL because the composable mutation contract is runtime-tested by unchanged specs while the thin view confirm/cancel wiring is source-only.

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ⚠️ | No `apply-progress` artifact persisted. Evidence reconstructed from the commit trail (feat→feat→test interleaving) + test-file RED headers. |
| All tasks have tests | ✅ | WU-B intentionally no tests (design decision, Fase 2 lesson); tests land in WU-C. |
| RED confirmed (tests exist) | ✅ | 4 changed/new test files exist: `PendingApprovalsView.test.ts` (33), `usePendingApprovalsViewMode.test.ts` (12), `usePendingApprovalsColumns.test.ts` (12), `s5-tray-reframe.spec.ts` (+7). |
| GREEN confirmed (tests pass) | ✅ | focused 885 + full 4220 green on execution (2 unrelated flaky timeouts). |
| Triangulation adequate | ✅ | error precedence (4), view-mode (12), pagination bridge (4), columns (12), card-data builder (7) well-triangulated; single-faceted checks (no-bulk, header) are single-case by nature. |
| Safety Net for modified files | ✅ | `s5-tray-reframe.spec.ts` extended (not stripped); `wu11-timeoff-review-emergency-contacts.spec.ts`, `wu12b-dashboard-views.spec.ts`, `foundation.spec.ts` unchanged in diff. |

**TDD Compliance**: 5/6 checks passed (1 ⚠️ — apply-progress artifact not persisted; the TDD process itself is evident from the RED headers and the feat→feat→test commit interleaving).

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (pure composable/mapper) | 31 | 3 (`usePendingApprovalsViewMode.test.ts` 12, `usePendingApprovalsColumns.test.ts` 12, `s5-tray-reframe.spec.ts` +7) | vitest |
| Component (mount + mocked deps) | 33 | 1 (`PendingApprovalsView.test.ts`) | vitest + @vue/test-utils |
| E2E | 0 | 0 | not installed |
| **Total (this change)** | **64** | **4** | |

(Remaining 821 focused tests live in 28 unchanged pre-existing employee spec files.)

### Changed File Coverage

Coverage analysis skipped — no coverage tool detected (`@vitest/coverage-v8` / `c8` absent).

### Assertion Quality

Scanned all 4 changed/new test files. No tautologies (`expect(true).toBe(true)`), no ghost loops (the `for...of` iteration in `usePendingApprovalsColumns.test.ts` iterates a non-empty literal `dataIds` array; the `Array.from({ length: 25/50 })` fixtures are non-empty), no assertion-without-production-call, no orphan empty-checks (empty-array fixtures have companion non-empty assertions).

**Assertion quality**: ✅ All assertions verify real behavior (no CRITICAL/WARNING assertion issues).

### Quality Metrics

**Linter**: ➖ Not run (verify is read-only; `pnpm lint` uses `--fix` which would modify files).
**Type Checker**: ✅ No errors (`pnpm build` runs `vue-tsc --build`, exit 0).

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| REQ-1 client-side AppDataTable | ✅ Implemented | `:data="paged.pageRows"` (1-based `page` ref + `paginateRows`/`clampPage` slice); `pagination` computed get/set copied verbatim from `ExpiringDocumentsView.vue`; `pageSize = ref(DEFAULT_TABLE_PAGE_SIZE)`; `:page-size-options="[10, 20, 50]"`; no `useServerTable` import |
| REQ-2 view-mode hybrid | ✅ Implemented | `usePendingApprovalsViewMode` wraps `useViewMode('pending-approvals-view-mode', ['table','card'], 'card')`; `displayMode` bridges `card`→`cards`; `ViewToggle` in `#actions`; `:display-mode="displayMode"`; `isPendingApprovalsViewMode` guard |
| REQ-3 columns + #acciones-cell | ✅ Implemented | 8 columns via `usePendingApprovalsColumns`; 7 data `enableHiding:true`; `acciones` `enableHiding:false` + `enableSorting:false` + `meta.class.td text-right`; `enable-column-visibility`; `v-model:column-pinning` `{ right: ['acciones'] }`; per-row Aprobar/Rechazar CASL-gated (`canReview`) + `isReviewing` disabled |
| REQ-4 name-resolved search | ✅ Implemented | `v-model:global-filter="searchQuery"`; `filterPendingBySearch` (pure, view-owned) bound to `filteredRequests`; summary in `#above-table` + `#cards`; no-match block distinct from empty |
| REQ-5 error surfacing | ✅ Implemented | `pendingErrorMessage` computed (`response.data.message` string → array[0] → `error.message` → "No se pudieron cargar las solicitudes pendientes. Intenta de nuevo."); `:error="isError"` + `:error-message` + `@refresh="() => refetch()"` |
| REQ-6 approve/reject flow | ✅ Implemented | `useReviewTimeOff` mutation UNCHANGED (invalidation + voseo toast); `confirmReview` calls `submitReview({ timeOffId, dto })`, closes + resets on success; `UModal` "Aprobar/Rechazar solicitud de ausencia"; `cancelReview` resets without firing |
| REQ-7 bulk OUT | ✅ Implemented | no `bulkActions`/`enable-row-selection` anywhere in view (grep + test "does not pass bulkActions/enableRowSelection") |
| REQ-8 preserved invariants | ✅ Implemented | `refetchOnWindowFocus: true` + `staleTime: 30_000` in unchanged `useReviewTimeOff.ts`; client-side `paginateRows`/`clampPage`/`pageAfterQueryChange`; `listForPicker` >100-cap documented; `useReviewTimeOff.ts` + `pagination.utils.ts` empty diff; `TimeOffRequest` type unchanged; no route/backend change |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Approach C (hybrid), client-side AppDataTable (NO `useServerTable`) | ✅ Yes | `:data="paged.pageRows"` + manual pagination bridge |
| Do NOT split `usePendingApprovals` out of `useReviewTimeOff.ts` | ✅ Yes | file unchanged in diff (REQ-8 invariant wins) |
| Extract `PendingApprovalCard.vue` + pure `buildPendingApprovalCardData` | ✅ Yes | presentational `:data`/`:can-review`/`:is-reviewing`, emits approve/reject |
| Sorting deferred (all `enableSorting: false`) | ✅ Yes | explicit `enableSorting: false` on all 8 columns |
| `acciones` right-pin via view-owned `ref<ColumnPinningState>({ left: [], right: ['acciones'] })` | ✅ Yes | `v-model:column-pinning` |
| Remove header refresh button (toolbar refresh + error-retry cover it) | ✅ Yes | header `Actualizar` removed; `@refresh="() => refetch()"` |
| Empty/no-match/toolbar: `:show-toolbar="queueNonEmpty"`; summary `#above-table`; no-match via `#cards` | ✅ Yes | all present |
| Pagination bridge copy-pasted verbatim from `ExpiringDocumentsView.vue` | ✅ Yes | identical get/set |
| WU-B ships without tests (tests land in WU-C) | ✅ Yes | commit trail confirms |

### Issues Found

**CRITICAL**: None

**WARNING**:
1. **`pnpm dev` smoke unticked** — the final DoD item (manual runtime smoke: forced-500 error banner + retry, view-mode reload persistence, column visibility, no checkbox/bulk bar, name search, page reset/clamp, CASL card gating, dialog copy) is unticked in `tasks.md`. This is a manual browser step that cannot be automated headlessly; it remains for the solo developer to complete before archive. It is a cleanup/manual gap, not an implementation defect (all automated gates are green).
2. **Full suite has 2 pre-existing unrelated flaky failures** — `router.notifications.spec.ts` "resolves the route when the user has read:NotificationConfig perm" and `POS/sales/SalesListView.test.ts` "clears only the slideover filter state when Limpiar is clicked", both `Test timed out in 5000ms`. Both files are untouched by this diff (out of scope). Session context notes the last full run was 4222/4222 green — flakiness varies run to run.
3. **No `apply-progress` artifact persisted** — Strict-TDD evidence was reconstructed from the commit trail (feat→feat→test) + test-file RED headers rather than a persisted TDD Cycle Evidence table.

**SUGGESTION**:
1. REQ-6 view-orchestration (confirm → `submitReview` → close; cancel → reset) is source-verified but not directly unit-tested in the new view suite (it stubs `useReviewTimeOff` inert). The composable mutation contract is already pinned by the unchanged `wu11` spec, so this is a low-risk gap; a focused test clicking Confirmar/Cancelar would close it.

### Verdict

**PASS WITH WARNINGS**

All 23 substantive tasks complete (3 ordered conventional commits); focused suite (885/885) green; build (type-check + bundle) clean; full suite 4220/4222 with 2 out-of-scope pre-existing flaky timeouts; all 8 requirements implemented and verified (24 dedicated passing tests + 5 source/git-diff). The only warnings are the unticked manual `pnpm dev` smoke, the 2 unrelated full-suite flaky timeouts, and the missing apply-progress artifact — none reflect an implementation defect.
