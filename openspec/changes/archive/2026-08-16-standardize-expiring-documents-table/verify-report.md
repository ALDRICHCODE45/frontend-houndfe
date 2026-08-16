```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:288e8c013cb86b57cf0b63c0877977b47f8f21a286630ec53eef1a94df1fb276
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 9/9
scenarios: 16/16
test_command: pnpm test:unit --run src/features/admin/employees
test_exit_code: 0
test_output_hash: sha256:f31a69630b3803218d0f80ac4971d02f238a212901c1bc60d9d0548f0a1dafac
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:62c6734599b3bfacab1cc39d70d97f1ce8eb6367c8bb6ee6575e6f6e3d8ecb77
```

## Verification Report

**Change**: standardize-expiring-documents-table
**Version**: N/A (whole capability `ADDED` — original view pre-dates the spec system)
**Mode**: Strict TDD

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 14 (WU-A 1.1–1.9, WU-C 2.1–2.5) + 26 DoD items |
| Tasks complete | 14/14 WU tasks; 25/26 DoD items (only `pnpm dev` manual smoke unticked) |
| Tasks incomplete | 1 (manual `pnpm dev` smoke — runtime-only, no code gate; see WARNINGS #4) |

> **Bookkeeping note**: task 2.1 (wu12b spy port) was pulled forward into WU-A per the gatekeeper correction (task 1.9) — `git show 9411f20` confirms the wu12b port landed in the WU-A commit, and WU-C (4e98ad3) only expanded the two test files. This matches the tasks.md notes.

### Build & Tests Execution

**Build**: ✅ Passed (exit 0) — `pnpm build` runs `vue-tsc --build` (type-check) + `vite build` in parallel.
```text
$ pnpm build
$ run-p type-check "build-only {@}" --
$ vue-tsc --build
...
✓ built in 15.31s
(!) Some chunks are larger than 500 kB after minification.  [pre-existing warning]
```

**Tests (focused)**: ✅ 922 passed / ❌ 0 failed (34 files)
```text
$ pnpm test:unit --run src/features/admin/employees
Test Files  34 passed (34)
     Tests  922 passed (922)
```

**Tests (full suite)**: ✅ 4257 passed / ❌ 2 failed (283 files) — 2 out-of-scope pre-existing failures
```text
$ pnpm test:unit --run
Test Files  2 failed | 281 passed (283)
     Tests  2 failed | 4257 passed (4259)
FAIL src/features/POS/sales/views/__tests__/SalesListView.test.ts > SalesListView — consolidated toolbar (REQ-14, REQ-15) > clears only the slideover filter state when Limpiar is clicked
FAIL src/app/router/__tests__/router.notifications.spec.ts > router — /sistema/configuracion/notificaciones > resolves the route when the user has read:NotificationConfig perm
```
Both failures are in files untouched by this change — `git diff main...HEAD --name-only` contains only the 7 expected files (none under `POS/sales` or `app/router`). Out of scope per orchestrator instruction; left unfixed (matches the pre-existing baseline reported in tasks.md 2.5).

**Coverage**: ➖ Not available (no `@vitest/coverage-v8` / `c8` in dependencies) — skipped per Strict-TDD module.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-1 | pagination round-trips via composable | `useExpiringDocuments.spec.ts` > "sends selectedThreshold as daysUntilExpiry and translates page/limit via queryFn" (page=3, limit=100) + adapter `getExpiringDocumentsPaginated` page/limit cases | ✅ COMPLIANT |
| REQ-1 | threshold change refetches and resets page | `useExpiringDocuments.spec.ts` > "queryKey changes when selectedThreshold changes" + "resets pageIndex to 0 when selectedThreshold changes (REQ-1/REQ-7)" | ✅ COMPLIANT |
| REQ-1 | shared composable untouched | `git diff main...HEAD -- src/core/shared/composables/useServerTable.ts` = empty (0 lines) | ✅ COMPLIANT |
| REQ-2 | default `expiresAt asc` on first load | `useExpiringDocuments.spec.ts` > "composes useServerTable with defaultSorting vencimiento asc" + "maps vencimiento asc → sortBy expiresAt / sortOrder asc" | ✅ COMPLIANT |
| REQ-2 | sortable column header click | adapter spec maps `restante desc → expiresAt desc`, `categoria → category`, `colaborador → employeeName`; view test "renders SortableHeader slots with the Spanish labels" | ✅ COMPLIANT |
| REQ-2 | `documento` non-sortable | adapter spec "omits sortBy/sortOrder when the sort id is not whitelisted (documento never maps)" + view test "keeps documento non-hideable + non-sortable" | ✅ COMPLIANT |
| REQ-3 | empty / 1-char input omits search | adapter spec "omits search when globalFilter is empty or shorter than 2 chars" + composable "omits search below 2 chars" | ✅ COMPLIANT |
| REQ-3 | 2+ chars passes through; TOO_SHORT surfaces via error block | adapter spec "passes search through when globalFilter is 2+ chars"; error-block surface covered by REQ-5 precedence tests (backend message string renders error block, never empty placeholder) | ✅ COMPLIANT |
| REQ-4 | dropdown lists four data columns; anchor survives all-four-hidden | view test "marks the 4 data columns hideable and keeps documento non-hideable" (contract-level: 4 hideable, `documento` absent) | ⚠️ PARTIAL — "only `documento` remains visible when all four hidden" render consequence is shared AppDataTable behavior (same as Fase 3 #1 precedent); the contract (`enableHiding` flags) is directly tested |
| REQ-5 | failed request renders error block + retry | view test "prefers response.data.message (string)…" + "clicking retry triggers refresh" + "suppresses the empty placeholder when the request has failed" | ✅ COMPLIANT |
| REQ-5 | empty success vs failed empty (and message precedence) | view test error precedence ×3 (`response.data.message` string / array[0] / `error.message` / fallback) + "suppresses the empty placeholder" | ✅ COMPLIANT |
| REQ-6 | adapter maps `{ data, meta }` | `mapExpiringDocumentsPaginated` spec "maps { data, meta: { total, page, limit, totalPages } } → PaginatedResponse" | ✅ COMPLIANT |
| REQ-6 | 0-based pageIndex becomes 1-based page; limit clamps at 100 | adapter spec "maps 0-based pageIndex to 1-based page, clamps limit at 100" (pageIndex 2, pageSize 250 → page 3, limit 100) | ✅ COMPLIANT |
| REQ-7 | selector refetches on change and resets page | view test "renders exactly one selector and it lives inside the #filters slot, not AdminPageHeader" + "binds the selector to selectedThreshold"; composable "resets pageIndex to 0 when selectedThreshold changes" | ✅ COMPLIANT |
| REQ-8 | colaborador renders server fullName and no name-resolution query fires | view test "renders the server fullName and keeps the avatar seed as employeeId" + "does NOT fire any listForPicker name-resolution query from this view" | ✅ COMPLIANT |
| REQ-9 | shell and helpers preserved | source inspection (`AdminPageHeader` + `UCard` in template; `formatDaysRemaining`/`computeExpiringDocumentRow` unchanged + wu12b helper tests) | ✅ COMPLIANT (source-verified) |
| REQ-9 | no card view / view-mode composable / core-type change / backend change | `git diff main...HEAD --name-only` = 7 files; `employee.types.ts` diff empty; no `ViewToggle`/`displayMode`/`useExpiringDocumentsViewMode`/`ExpiringDocumentCard` anywhere in this change's files; `pagination.utils.ts` header drops `/expiring`, keeps `/pending-approvals` | ✅ COMPLIANT (source + git diff) |

**Compliance summary**: 16/16 scenarios satisfied — 15 with dedicated passing tests, 1 presentational render consequence (REQ-4 all-hidden) verified at contract level with the shared AppDataTable consequence per the Fase 3 #1 precedent.

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ⚠️ | No `apply-progress` artifact persisted (only `explore/proposal/design/tasks/specs` exist). Evidence reconstructed from commit trail + test-file RED headers + tasks.md per-task notes. |
| All tasks have tests | ✅ | WU-A tasks 1.1/1.3/1.5 RED stubs exist as `useExpiringDocuments.spec.ts` + `ExpiringDocumentsView.test.ts`; task 1.1's adapter tests delivered inside the composable spec per orchestrator prompt (documented in tasks.md). |
| RED confirmed (tests exist) | ✅ | 2 new test files exist on disk + wu12b port in commit 9411f20. |
| GREEN confirmed (tests pass) | ✅ | focused 922 + full 4257 green on execution (2 unrelated pre-existing failures). |
| Triangulation adequate | ✅ | error precedence (4 cases), adapter params (9 cases), SORT_MAP (2), threshold watch (3), fullName/render (2). |
| Safety Net for modified files | ✅ | `wu12b-dashboard-views.spec.ts` ported (not stripped to nothing — 18 tests preserved incl. helpers + tenantId regression); `pagination.utils.spec.ts` + `employees.api.spec.ts` (Fase 3 #1) unchanged in diff. |

**TDD Compliance**: 5/6 checks passed (1 ⚠️ — apply-progress artifact not persisted; TDD process itself is evident from RED headers in both new test files + the feat→test commit interleaving).

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (adapter/mapper/composable) | 27 | 1 (`useExpiringDocuments.spec.ts`) | vitest |
| Unit (API spy + helpers + tenantId regression) | 18 | 1 (`wu12b-dashboard-views.spec.ts`, modified) | vitest |
| Component (mount + mocked deps, real SortableHeader) | 16 | 1 (`ExpiringDocumentsView.test.ts`) | vitest + @vue/test-utils |
| E2E | 0 | 0 | not installed |
| **Total (this change)** | **61** | **3** | |

(Remaining 861 focused tests live in 31 unchanged pre-existing employee spec files.)

### Changed File Coverage

Coverage analysis skipped — no coverage tool detected (`@vitest/coverage-v8` / `c8` absent).

### Assertion Quality

Scanned all 3 test files (27 + 18 + 16 tests). No tautologies (`expect(true).toBe(true)`), no ghost loops (the `for` loops over `getSpy.mock.calls` iterate a non-empty recorded array), no assertion-without-production-call (every `it` invokes the adapter, mapper, composable, or mounts the view), no orphan empty-checks (empty fixtures have companion non-empty assertions in the same describe).

- ⚠️ `wu12b-dashboard-views.spec.ts` > "can be called with an empty result set" / "returns empty data when no documents expiring in the window" overlap heavily with each other (both assert `toEqual([])` + `toHaveLength(0)` on the same mock shape). Redundant but harmless; the spy contract test ("calls getExpiringDocumentsPaginated with the params object and explicit day count") carries the real assertion. SUGGESTION.
- The view test uses `chaiExpect` (chai-style) for real value assertions (error text, seed, refresh calls) — no type-only assertions.

**Assertion quality**: ✅ All assertions verify real behavior (1 redundant-empty-assertion SUGGESTION).

### Quality Metrics

**Linter**: ➖ Not run (verify is read-only; `pnpm lint` uses `--fix` which would modify files).
**Type Checker**: ✅ No errors (`pnpm build` runs `vue-tsc --build`, exit 0).

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| REQ-1 useServerTable migration | ✅ Implemented | `useExpiringDocuments` composes `useServerTable<ExpiringDocumentItem>` (employees.api.ts:151–160): `defaultSorting [{id:'vencimiento',desc:false}]`, `defaultPageSize 10`, `pageSizeOptions [10,20,50]`, `persistKey 'admin-expiring-documents'`, `urlSync:false`; `staleTime 30_000` + `refetchOnWindowFocus:false` are useServerTable defaults (verified useServerTable.ts:62,140); `selectedThreshold` closes `queryKey`/`queryFn` (employees.api.ts:152–153); `watch(selectedThreshold)` resets `pageIndex=0` (employees.api.ts:164–166); shared composable untouched (empty diff) |
| REQ-2 sorting whitelist | ✅ Implemented | `EXPIRING_DOCUMENTS_SORT_MAP` (employees.api.ts:138–143) maps vencimiento/restante→expiresAt, categoria→category, colaborador→employeeName; `documento` miss omits both params (employees.api.ts:502–507); 4 columns `enableSorting:true`, `documento` `false` (ExpiringDocumentsView.vue:102–106) |
| REQ-3 toolbar search ≥2 | ✅ Implemented | `show-toolbar="true"` (ExpiringDocumentsView.vue:171); `globalFilter` debounced via composable (debounceMs 300) → `search` omitted `<2` chars in adapter (employees.api.ts:498–500) |
| REQ-4 column visibility | ✅ Implemented | `enable-column-visibility` (ExpiringDocumentsView.vue:172); 4 data columns `enableHiding:true`, `documento` `enableHiding:false` (ExpiringDocumentsView.vue:102–106) |
| REQ-5 error precedence + retry | ✅ Implemented | `documentsErrorMessage` precedence: `response.data.message` string → array[0] → `error.message` → "No se pudieron cargar los documentos. Intenta de nuevo." (ExpiringDocumentsView.vue:80–97); `:error`/`:error-message` + `@refresh` (ExpiringDocumentsView.vue:164–174) |
| REQ-6 adapter + mapper | ✅ Implemented | `getExpiringDocumentsPaginated(ServerTableParams, daysUntilExpiry)` builds `{ daysUntilExpiry, page=pageIndex+1, limit=min(pageSize,100), search? (≥2), sortBy?, sortOrder? }` never tenantId (employees.api.ts:486–514); `mapExpiringDocumentsPaginated` reads `{ data, meta }` → `{ pageIndex: meta.page-1, pageSize: meta.limit, totalCount, pageCount: meta.totalPages }` (employees.api.ts:167–179); `ExpiringDocumentItem = EmployeeDocument & { fullName; employeeNumber }` (employees.api.ts:150–153); `EmployeeDocument` type diff empty |
| REQ-7 threshold selector in #filters | ✅ Implemented | 30/60/90 `USelect` inside `AppDataTable` `#filters` slot (ExpiringDocumentsView.vue:177–190); `AdminPageHeader` renders title/description only (no selector); change → `selectedThreshold` → refetch + page reset |
| REQ-8 server-resolved fullName | ✅ Implemented | `colaborador-cell` renders `row.original.fullName` + `EntityAvatar :seed="row.original.employeeId"` (ExpiringDocumentsView.vue:219–230); `listForPicker`/`buildManagerMap`/`resolveManagerName` NOT imported or called by this view; row mapper adds `fullName`/`employeeNumber` (employees.api.ts:170–176) |
| REQ-9 invariants | ✅ Implemented | `AdminPageHeader` + `UCard` shell preserved (ExpiringDocumentsView.vue:146–152); pure helpers + `formatTimeOffDate` signatures unchanged; `pagination.utils.ts` header drops `/expiring` from "full array" list, keeps `/pending-approvals` line (pagination.utils.ts:3–8); no `ViewToggle`/`displayMode`/`useExpiringDocumentsViewMode`/`ExpiringDocumentCard`; no `EmployeeDocument` core change; no backend change (backend folder never accessed) |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Approach A true server-side via closure-composition (shared composable untouched) | ✅ Yes | empty diff on `useServerTable.ts` |
| `defaultSorting vencimiento asc`, `defaultPageSize 10`, `pageSizeOptions [10,20,50]`, `persistKey 'admin-expiring-documents'`, `urlSync:false` | ✅ Yes | |
| `watch(selectedThreshold)` resets `pageIndex=0` (REQ-1/7) | ✅ Yes | employees.api.ts:164–166 |
| Row mapper spreads `computeExpiringDocumentRow` + `fullName` + `employeeNumber` | ✅ Yes | |
| SORT_MAP whitelist; `documento` miss → omit `sortBy`/`sortOrder` (also empty sorting) | ✅ Yes | |
| `restante` → `expiresAt` monotonic, documented in SORT_MAP comment | ✅ Yes | |
| Meta reader (`{ data, meta }` — users precedent), not employees' flat `mapPaginated` | ✅ Yes | |
| Error fallback = spec string "No se pudieron cargar los documentos. Intenta de nuevo." | ✅ Yes | plural per spec (design noted singular vs plural; spec won) |
| Old `getExpiringDocuments` REPLACED, no dead code | ✅ Yes | only `getExpiringDocumentsPaginated` remains (employees.api.ts) |
| `paginateRows` re-export dropped from composable | ✅ Yes | spec asserts `'paginateRows' in mod === false` |
| `enabled` gate dropped (JWT-derived tenant, Fase 3 #1 lesson) | ✅ Yes | no `enabled` in composable |
| Query-key factory unchanged; days in base key | ✅ Yes | `employeeDocumentQueryKeys.expiring(tenantId, days)` (query-keys.ts:160–161) |

> **Design deviation (documented)**: design.md File Changes table listed `api/__tests__/employees.api.spec.ts` as a new WU-A file; the adapter tests were actually delivered inside `composables/__tests__/useExpiringDocuments.spec.ts` per the orchestrator prompt (explicitly documented in tasks.md task 1.1). The pre-existing `employees.api.spec.ts` (Fase 3 #1) is UNCHANGED in this diff. Functionality identical; no coverage gap. SUGGESTION only.

### Issues Found

**CRITICAL**: None
**Blockers**: None

**WARNING**:
1. **No `apply-progress` artifact persisted** — Strict-TDD evidence reconstructed from the commit trail + test-file RED headers + tasks.md rather than a persisted TDD Cycle Evidence table (same as Fase 3 #1).
2. **Full suite has 2 pre-existing unrelated failures** — `POS/sales` `SalesListView.test.ts` + `app/router` `router.notifications.spec.ts` (both files untouched by this diff — `git diff main...HEAD --name-only` confirms). Out of scope per orchestrator; left unfixed.
3. **Recovery path used for WU-A and WU-C** — the dedicated sdd-apply sub-agent returned `sdd_task_result_empty` transport failures 3 times for WU-A; the orchestrator switched to the general agent (with the sdd-apply skill loaded), which completed and committed WU-A (9411f20). WU-C was also executed via the general agent (4e98ad3). Deliverables are correct and green; this is a process/transport note, not an implementation defect.
4. **`pnpm dev` manual smoke DoD item unticked** (25/26) — runtime-only check (threshold refetch, sortable headers, debounced search, column-visibility dropdown, error retry, fullName render, no listForPicker call, no paginateRows slice). Not covered by any automated gate; flagged as a cleanup task, not a core-task CRITICAL. The equivalent behaviors ARE covered by the 16 automated view/composable/adapter tests.

**SUGGESTION**:
1. `wu12b-dashboard-views.spec.ts` has two near-duplicate "empty result set" assertions in the same describe (redundant, one could be dropped).
2. Adapter tests live inside `useExpiringDocuments.spec.ts` rather than a dedicated `api/__tests__/employees.api.spec.ts` addition — documented deviation from design.md File Changes table; consider a follow-up rename if a strict file contract is desired.
3. Have apply/archive tick the remaining `pnpm dev` smoke checkbox once the manual runtime smoke is performed, so DoD shows 26/26.

### Verdict

**PASS WITH WARNINGS**

All 14 WU tasks substantively complete; focused suite (922) green; full suite (4257 pass / 2 pre-existing unrelated failures) matches the documented baseline; build (type-check + bundle) clean; all 9 requirements implemented and verified — 15/16 scenarios with dedicated passing tests, 1 contract-level (shared AppDataTable render consequence). Warnings are process/bookkeeping (missing apply-progress, sub-agent transport recovery path, 2 out-of-scope pre-existing failures, unticked manual smoke) — none reflect an implementation defect.
