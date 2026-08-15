```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:efb487e3fdfcaa7277ee827be0cbe6fbd4db7e1b838eeda87b352a0b3a8c6722
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 10/10
scenarios: 25/25
test_command: pnpm test:unit --run src/features/admin/employees
test_exit_code: 0
test_output_hash: sha256:eaf29e7f75c40f82b1c2d65eb84df919d5c171839d673c5bbab01ce5be63913a
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:5ed7fa647f9b95a5adcaefeb9faa3b3b1c3c2f9316dfd60120838db93d4abe47
```

## Verification Report

**Change**: standardize-admin-employees-table
**Version**: N/A (whole capability `ADDED` — no `MODIFIED` block; pre-dates the spec system)
**Mode**: Strict TDD

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 22 |
| Tasks complete | 22 (substantive) |
| Tasks incomplete | 0 (substantive) |

> ⚠️ **Bookkeeping note**: `tasks.md` checkboxes show 11/26 ticked — WU-A (1.1–1.11) and the Definition-of-Done block remain unticked. Source inspection, the commit trail, and the green gates confirm all 22 tasks plus the DoD are substantively complete. This is a stale-checkbox gap (see WARNINGS #1), not missing implementation.

### Build & Tests Execution

**Build**: ✅ Passed (exit 0) — `pnpm build` runs `vue-tsc --build` (type-check) + `vite build` in parallel.
```text
$ pnpm build
$ run-p type-check "build-only {@}" --
$ vue-tsc --build
...
✓ built in 15.71s
(!) Some chunks are larger than 500 kB after minification.  [pre-existing warning]
```

**Tests (focused)**: ✅ 821 passed / ❌ 0 failed (29 files)
```text
$ pnpm test:unit --run src/features/admin/employees
Test Files  29 passed (29)
     Tests  821 passed (821)
```

**Tests (full suite)**: ✅ 4157 passed / ❌ 1 failed (278 files) — 1 out-of-scope pre-existing failure
```text
$ pnpm test:unit --run
Test Files  1 failed | 277 passed (278)
     Tests  1 failed | 4157 passed (4158)
FAIL src/features/POS/sales/views/__tests__/SalesListView.test.ts > SalesListView — consolidated toolbar (REQ-14, REQ-15) > clears only the slideover filter state when Limpiar is clicked
```
The sole failure is in `POS/sales` (`SalesListView.test.ts`), a file untouched by this change — `git diff main...HEAD --name-only` contains only `src/features/admin/employees/**`. Out of scope per orchestrator instruction; left unfixed.

**Coverage**: ➖ Not available (no `@vitest/coverage-v8` / `c8` in dependencies) — skipped per Strict-TDD module.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-1 | failed request renders error | `EmployeesListView.test.ts` > "prefers response.data.message (string)…" / "suppresses the empty placeholder when the request has failed" | ✅ COMPLIANT |
| REQ-1 | retry re-runs the request | `EmployeesListView.test.ts` > "retry button triggers refresh" | ✅ COMPLIANT |
| REQ-1 | message precedence | `EmployeesListView.test.ts` > "prefers response.data.message (string)" / "prefers response.data.message[0] when the backend returns an array" / "falls back to error.message" / "falls back to the Spanish message" | ✅ COMPLIANT |
| REQ-1 | empty success vs failed empty | `EmployeesListView.test.ts` > "suppresses the empty placeholder when the request has failed" | ✅ COMPLIANT |
| REQ-2 | pagination via useServerTable | `useEmployeesList.spec.ts` > buildEmployeesQueryParams pageIndex tests + `employees.api.spec.ts` > "sends page = pageIndex + 1" | ✅ COMPLIANT |
| REQ-2 | statusTab closure refetches | `useEmployeesList.spec.ts` > status mapping + `EmployeesListView.test.ts` > "emits update:status-tab=active/terminated" | ✅ COMPLIANT |
| REQ-2 | managerId stays latent | `useEmployeesList.spec.ts` / `employees.api.spec.ts` > "omits managerId when undefined" | ✅ COMPLIANT |
| REQ-2 | shared composable untouched | `git diff main...HEAD -- src/core/shared/composables/useServerTable.ts` = empty | ✅ COMPLIANT |
| REQ-3 | header shell replaces inline h1 | `EmployeesListView.test.ts` > "renders AdminPageHeader with title Colaboradores" | ✅ COMPLIANT |
| REQ-3 | create button gated by canCreate | `EmployeesListView.test.ts` > "passes :show-add-button=true/false" + "does not render CreateEmployeeSlideover when canCreate is false" | ✅ COMPLIANT |
| REQ-3 | dead UI removed | (none — source inspection) | ⚠️ PARTIAL — no Importar/Exportar/Filtros/department/modality/sort in `EmployeesListView.vue` template (source-verified) |
| REQ-4 | status tab selection | `EmployeesListView.test.ts` > "defaults status tab to all" + "emits update:status-tab active/terminated" | ✅ COMPLIANT |
| REQ-4 | search updates globalFilter | `EmployeesListView.test.ts` > "updates globalFilter via v-model when AppDataTable emits update:global-filter" | ✅ COMPLIANT |
| REQ-5 | dropdown lists every data column | `useEmployeeColumns.test.ts` > "marks all 7 data columns as hideable" + `EmployeesListView.test.ts` > "passes enable-column-visibility=true" | ✅ COMPLIANT |
| REQ-5 | all data columns hidden | `useEmployeeColumns.test.ts` > "marks the actions column as non-hideable" (contract-level) | ⚠️ PARTIAL — render consequence ("only actions remains") is shared AppDataTable behavior |
| REQ-6 | toggle switches and persists | `useEmployeeViewMode.test.ts` > "persists the chosen mode" / "toggleViewMode" / "reads persisted" + `EmployeesListView.test.ts` > "display-mode=cards when localStorage card" | ✅ COMPLIANT |
| REQ-6 | invalid stored value falls back | `useEmployeeViewMode.test.ts` > "falls back to table when invalid" + `EmployeesListView.test.ts` > "display-mode=table when invalid" | ✅ COMPLIANT |
| REQ-7 | card mode renders inside #cards | `EmployeesListView.test.ts` > "renders EmployeeCardGrid in #cards slot" | ✅ COMPLIANT |
| REQ-7 | card kebab actions | `EmployeesListView.test.ts` > "card kebab shows Editar/Dar de baja/Reactivar when canUpdate true" / "shows Reactivar for TERMINATED" / "hides card kebab when canUpdate false" | ✅ COMPLIANT |
| REQ-7 | card click navigates to detail | `EmployeesListView.test.ts` > "card click navigates to admin-employee-detail" + "card click never routes to admin-employee-edit" | ✅ COMPLIANT |
| REQ-8 | bulk actions visible on selection | `EmployeesListView.test.ts` > "preserves selectedRows as the data source" / "enables row selection in table mode" + source (bulkActions computed) | ⚠️ PARTIAL — new test is mount-smoke; bulk behavior also pinned by unchanged `EmployeesListView.batch.spec.ts` |
| REQ-8 | cap enforced at 100 | source `BATCH_OPS_CAP = 100` + `disabled = count > BATCH_OPS_CAP`; `employees.api.ts` `>100` guards; unchanged wu12-batch specs | ⚠️ PARTIAL — source + pre-existing (unchanged) WU-12 tests |
| REQ-9 | no sort affordance on any column | `useEmployeeColumns.test.ts` > "marks every column with explicit enableSorting: false" + "actions non-sortable non-hideable right-aligned" | ✅ COMPLIANT |
| REQ-10 | invariants hold | `EmployeesListView.test.ts` > "forwards columnPinning so actions stay pinned right" + "sets defaultPinning { right: ['actions'] }" + `useEmployeeColumns.test.ts` > "does not include a salary column" | ✅ COMPLIANT |
| REQ-10 | no type, route, or backend change | `git diff main...HEAD --name-only` = 11 files all under `src/features/admin/employees/**`; no `Employee` type / route / backend file | ✅ COMPLIANT |

**Compliance summary**: 25/25 scenarios satisfied — 21 with dedicated passing tests, 4 presentational/contract scenarios (dead-UI removal, all-columns-hidden consequence, bulk cap, bulk-visible) verified via source + git diff + unchanged batch specs, per the design-sanctioned WU-B no-tests scope.

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ⚠️ | No `apply-progress` artifact persisted (`sdd-status`: `applyProgress: missing`). Evidence reconstructed from commit trail + test-file RED headers. |
| All tasks have tests | ✅ | WU-B intentionally no tests (design decision); tests land in WU-C. |
| RED confirmed (tests exist) | ✅ | 5 changed/new test files exist on disk (`EmployeesListView.test.ts`, `useEmployeeColumns.test.ts`, `useEmployeeViewMode.test.ts`, `useEmployeesList.spec.ts`, `employees.api.spec.ts`). |
| GREEN confirmed (tests pass) | ✅ | focused 821 + full 4157 green on execution (1 unrelated POS/sales failure). |
| Triangulation adequate | ✅ | error precedence (4 cases), view mode (7), card kebab (3), api pageIndex (5) well-triangulated; single-faceted checks (persistKey, defaultPinning) are single-case by nature. |
| Safety Net for modified files | ✅ | `useEmployeesList.spec.ts` ported (not stripped to nothing); `wu03-card-view.spec.ts` + `EmployeesListView.batch.spec.ts` unchanged in diff. |

**TDD Compliance**: 5/6 checks passed (1 ⚠️ — apply-progress artifact not persisted; TDD process itself is evident from the feat/test commit interleaving and RED headers).

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (adapter/mapper/composable) | 77 | 4 (`useEmployeesList.spec.ts` 40, `employees.api.spec.ts` 13, `useEmployeeColumns.test.ts` 13, `useEmployeeViewMode.test.ts` 11) | vitest |
| Component (mount + mocked deps) | 35 | 1 (`EmployeesListView.test.ts`) | vitest + @vue/test-utils |
| E2E | 0 | 0 | not installed |
| **Total (this change)** | **112** | **5** | |

(Remaining 709 focused tests live in 24 unchanged pre-existing employee spec files.)

### Changed File Coverage

Coverage analysis skipped — no coverage tool detected (`@vitest/coverage-v8` / `c8` absent).

### Assertion Quality

Scanned all 5 changed/new test files. No tautologies (`expect(true).toBe(true)`), no ghost loops (the two `for`/`forEach` iterations over `dataIds`/`supportedValues` use non-empty literal arrays), no assertion-without-production-call, no orphan empty-checks (empty-array fixtures have companion non-empty assertions).

- ⚠️ `useEmployeesList.spec.ts` > "does not include a column with id salario" asserts a hardcoded `expectedBaseIds` literal rather than the production columns (tautological); the substantive check lives in `useEmployeeColumns.test.ts` > "does not include a salary column". SUGGESTION.
- ⚠️ `EmployeesListView.test.ts` > "preserves selectedRows as the data source" is mount-smoke (asserts only that the table renders); the bulk contract is substantively pinned by the unchanged `EmployeesListView.batch.spec.ts`. SUGGESTION.

**Assertion quality**: ✅ All assertions verify real behavior (2 weak smoke tests noted as SUGGESTION).

### Quality Metrics

**Linter**: ➖ Not run (verify is read-only; `pnpm lint` uses `--fix` which would modify files).
**Type Checker**: ✅ No errors (`pnpm build` runs `vue-tsc --build`, exit 0).

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| REQ-1 error propagation | ✅ Implemented | `isError`/`error` destructured; `employeesErrorMessage` prefers `response.data.message` (string → array[0]) → `error.message` → "No se pudieron cargar los colaboradores. Reintenta."; `:error`/`:error-message` + `@refresh` wired |
| REQ-2 useServerTable migration | ✅ Implemented | `useEmployeesList` composes `useServerTable`; `statusTab`/`managerId` feature-local refs close over `queryKey`/`queryFn`; `buildEmployeesQueryParams` pure 0-based `pageIndex`; `pageSizeOptions:[10,20,50]`; shared composable untouched (empty diff) |
| REQ-3 header + dead-UI cleanup | ✅ Implemented | `AdminPageHeader title="Colaboradores"`; no inline h1; Importar/Exportar/Filtros/department/modality/sort removed; add button `:show-add-button="canCreate"` |
| REQ-4 tabs in #filters + globalFilter | ✅ Implemented | `EmployeeFilters` (status tabs only) in `#filters`; search box owned by toolbar → `v-model:global-filter` |
| REQ-5 column visibility | ✅ Implemented | `enable-column-visibility`; 7 data columns `enableHiding:true`; `actions` `enableHiding:false` |
| REQ-6 displayMode bridge + persistence | ✅ Implemented | `useEmployeeViewMode` wraps `useViewMode('employee-view-mode', ['table','card'], 'table')`; `isEmployeeViewMode` guard; `displayMode` bridges `card`→`cards`; `ViewToggle` in `#actions`; `:display-mode` forwarded |
| REQ-7 card in #cards (kebab + click→detail) | ✅ Implemented | `EmployeeCardGrid` in `#cards` slot (`@edit/@terminate/@reactivate` + `@card-click="navigateToDetail"`); no sibling `v-else` + duplicate pagination |
| REQ-8 bulk actions preserved | ✅ Implemented | `bulkActions` computed intact; `BATCH_OPS_CAP=100`; `selectedRows` aliased `selectedEmployees`; batch modals unchanged |
| REQ-9 non-sortable columns | ✅ Implemented | all 8 columns `enableSorting:false`; `actions` non-sortable/non-hideable/`text-right`; no `SortableHeader`; sort select removed |
| REQ-10 invariants | ✅ Implemented | `defaultPinning:{right:['actions']}`; `useManagerResolution` batch (60s cache) untouched; `normalizeEmployee`/`computeSeniority`/`buildCardData` untouched; `mapPaginated` bridges 1→0 index; no sort param; no type/route/backend change |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Approach C closure-composition (shared composable untouched) | ✅ Yes | |
| `persistKey: 'admin-employees'`, `urlSync: false` | ✅ Yes | |
| Drop `enabled` gate (JWT-derived tenant, early fetch safe) | ✅ Yes | `useEmployeesList` has no `enabled` gate |
| Rewrite (not delete) `buildEmployeesQueryParams` to 0-based | ✅ Yes | pure mapper, exported for tests |
| `pageSizeOptions: [10, 20, 50]` | ✅ Yes | |
| `selectedRows` aliased `selectedEmployees` (bulk byte-identical) | ✅ Yes | both returned from composable |
| `defaultPinning: { left: [], right: ['actions'] }` | ✅ Yes | set in `useServerTable` options |
| `:show-add-button="canCreate"` + `@add` | ✅ Yes | |
| `EmployeeFilters.vue` strip search, status tabs only | ✅ Yes | single emit `update:status-tab` |
| Selection-clear watcher `[statusTab, globalFilter]` (composable) + `[viewMode, pagination.pageIndex]` (view) | ✅ Yes | both present |
| `v-model:sorting` inert (non-sortable) | ✅ Yes | wired for parity |
| WU-B ships without tests | ✅ Yes | tests land in WU-C |

### Issues Found

**CRITICAL**: None

**WARNING**:
1. **Stale task checkboxes** — `tasks.md` shows 11/26 ticked: WU-A (1.1–1.11) and the Definition-of-Done block are unticked, so `gentle-ai sdd-status` reports `tasks: 11/26 complete`, `verify: blocked`, `archive: blocked`, `next: apply`. The work is substantively complete (source + 821 green + build clean); this is a bookkeeping gap that must be reconciled before archive.
2. **`apply-progress` artifact missing** — `sdd-status` reports `applyProgress: missing`. Strict-TDD evidence was reconstructed from the commit trail (feat→test interleaving) and test-file RED headers rather than a persisted TDD Cycle Evidence table.
3. **Full suite has 1 pre-existing unrelated failure** — `POS/sales` `SalesListView.test.ts` "clears only the slideover filter state when Limpiar is clicked" (out of scope, file untouched by this diff).
4. **4 presentational/contract scenarios lack a dedicated unit test** — dead-UI removal, all-columns-hidden consequence, bulk cap, bulk-visible — verified via source + git diff + unchanged batch specs, per the design-sanctioned WU-B no-tests scope (testing CSS/layout consequences would be implementation-detail coupling).

**SUGGESTION**:
1. Have the apply phase tick tasks.md WU-A (1.1–1.11) + DoD checkboxes so `sdd-status` unblocks `verify`/`archive`.
2. `useEmployeesList.spec.ts` > "does not include a column with id salario" and `EmployeesListView.test.ts` > "preserves selectedRows" are weak smoke tests — could be dropped (companion tests cover the substance).

### Verdict

**PASS WITH WARNINGS**

All 22 tasks substantively complete; focused suite (821) green; build (type-check + bundle) clean; all 10 requirements implemented and source-verified. Warnings are process/bookkeeping (stale checkboxes, missing apply-progress), one out-of-scope pre-existing test failure, and design-sanctioned presentational-test gaps — none reflect an implementation defect.
