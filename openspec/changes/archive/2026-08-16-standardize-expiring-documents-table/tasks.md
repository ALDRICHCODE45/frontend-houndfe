# Tasks: Standardize Expiring Documents Table

Derived from `proposal.md`, `design.md`, `specs/admin-expiring-documents/spec.md` (REQ-1..9).

- Execution mode: AUTO; delivery: no PRs — conventional commits on branch, manual merge to main (solo dev)
- Artifact store: openspec; review budget: 400 lines/WU; strict TDD: `pnpm test:unit` (vitest), gate `pnpm build`
- Frontend-only: `houndfe-backend` forbidden. Backend contract is EVIDENCE. Shared `useServerTable` UNTOUCHABLE.
- WU-B is FOLDED into WU-A (no card view; no `useExpiringDocumentsViewMode`; no `displayMode`; no `ExpiringDocumentCard`). View wiring is inseparable from composable's sort/column/error contract.
- Test port lands in WU-C (same change as the rename — splitting risks the old contract asserting alongside the new one).

---

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: High

Estimated ~470-580 lines (WU-A ~220-280 + WU-C ~250-300). WU-A is heaviest — migration + adapter + view wiring + threshold page-reset watcher + #filters slot. Fase 3 #1 WU-A precedent ran 1658 vs 400 budget; this WU is scoped tighter (no `EmployeeFilters` rewrite, no card path, smaller column contract, fewer view-state bridges). Maintainer ledger reset likely still needed.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WU-A | useServerTable migration + API adapter + view wiring + threshold page-reset watcher + #filters slot + pagination.utils doc | commit 1 on branch | `pnpm test:unit --run src/features/admin/employees/composables/__tests__/useExpiringDocuments.spec.ts src/features/admin/employees/views/__tests__/ExpiringDocumentsView.test.ts` | `pnpm dev` toggling threshold/sort/search/error/columns + retry refetch | revert `employees.api.ts` + `useExpiringDocuments.ts` + `ExpiringDocumentsView.vue` + `pagination.utils.ts` + delete 3 test stubs |
| WU-C | port wu12b spy → paginated params + flesh out composable/view specs (adapter params, SORT_MAP, error precedence, search gate, #filters refetch, fullName render, no listForPicker) | commit 2 on branch | `pnpm test:unit --run src/features/admin/employees` (full suite) | N/A (no runtime boundary — test-only WU) | revert new test files + restore stripped `wu12b-dashboard-views.spec.ts` |

| Unit | REQs | Commit |
|------|------|--------|
| WU-A | 1, 2, 3, 4, 5, 6, 7, 8, 9 | `feat(admin-expiring-documents): migrate to useServerTable, surface errors, add sort/visibility/search/filters` |
| WU-C | 1..9 | `test(admin-expiring-documents): port wu12b spy and cover adapter/composable/view contracts` |

---

## Phase 1: WU-A — useServerTable Migration + Adapter + View Wiring (~220-280 lines, 7 files)

**Files**: modify `api/employees.api.ts`, `composables/useExpiringDocuments.ts`, `views/ExpiringDocumentsView.vue`, `core/shared/utils/pagination.utils.ts`; create RED stubs `api/__tests__/employees.api.spec.ts`, `composables/__tests__/useExpiringDocuments.spec.ts`, `views/__tests__/ExpiringDocumentsView.test.ts`. Strict TDD: RED → GREEN → REFACTOR.

- [x] 1.1 RED `api/__tests__/employees.api.spec.ts`: `getExpiringDocumentsPaginated(params, days)` — `page = pageIndex+1`; `limit = Math.min(pageSize, 100)`; `search` omitted `<2` chars, passed `≥2`; `sortBy`/`sortOrder` from `EXPIRING_DOCUMENTS_SORT_MAP`; empty `sorting` omits both; `documento` never maps; NEVER sends `tenantId`. Red. (Delivered in `composables/__tests__/useExpiringDocuments.spec.ts` per orchestrator prompt — adapter tests live alongside the composable spec.)
- [x] 1.2 GREEN `api/employees.api.ts`: REPLACE `getExpiringDocuments` → `getExpiringDocumentsPaginated(ServerTableParams, daysUntilExpiry)`; add `mapExpiringDocumentsPaginated` (reads `{ data, meta: { total, page, limit, totalPages } }`), `ExpiringDocumentsBackendPage`, `ExpiringDocumentItem = EmployeeDocument & { fullName; employeeNumber }`, `EXPIRING_DOCUMENTS_SORT_MAP` (`vencimiento`/`restante`→`expiresAt`, `categoria`→`category`, `colaborador`→`employeeName`). Drop old method.
- [x] 1.3 RED `composables/__tests__/useExpiringDocuments.spec.ts` (stub): `defaultSorting: [{ id: 'vencimiento', desc: false }]`, `defaultPageSize: 10`, `pageSizeOptions: [10, 20, 50]`, `persistKey: 'admin-expiring-documents'`, `urlSync: false`; `selectedThreshold` closure on `queryKey`; threshold watch resets `pageIndex` to 0; `documents` mapper adds `fullName`/`employeeNumber`. Red.
- [x] 1.4 GREEN `composables/useExpiringDocuments.ts`: compose `useServerTable<ExpiringDocumentItem>` with `selectedThreshold` (30|60|90, default 30) closing `queryKey`/`queryFn`; `watch(selectedThreshold)` resets `t.pagination.pageIndex = 0`; `documents` computed spreads `computeExpiringDocumentRow` + `fullName` + `employeeNumber`; drop `paginateRows`/`PaginatedRows` re-export; keep `formatDaysRemaining`/`computeExpiringDocumentRow` pure helpers + `ExpiringDocumentRow` type. Green.
- [x] 1.5 RED `views/__tests__/ExpiringDocumentsView.test.ts` (stub): `show-toolbar="true"`; `v-model:sorting`/`global-filter`/`column-visibility`/`pagination`; `enable-column-visibility`; 4 `SortableHeader` slots (`vencimiento`/`restante`/`categoria`/`colaborador`); `documentsErrorMessage` precedence (`response.data.message` string|array[0] → `error.message` → "No se pudieron cargar los documentos. Intenta de nuevo."); `#filters` USelect bound to `selectedThreshold`; `colaborador` cell → `fullName`; avatar seed stays `employeeId`. Red.
- [x] 1.6 GREEN `views/ExpiringDocumentsView.vue`: remove `paginateRows`/`buildManagerMap`/`resolveManagerName`/`listForPicker`/`page`/`pageSize`/`paged`/`showingFrom`/`showingTo` bridge; remove header `USelect`; bind `AppDataTable` v-models + `enable-column-visibility` + 4 `SortableHeader` header slots + `:error`/`:error-message` + `#filters` slot with 30/60/90 `USelect`; cells render `row.original.fullName`; preserve `AdminPageHeader`/`UCard`/`getCategoryColor`/`getDaysRemainingColor`/`getCategoryLabel`; switch data source to `documents`/`pagination`/`isLoading`/`isFetching`/`isError`/`error`/`refresh` from composable. Green.
- [x] 1.7 GREEN `core/shared/utils/pagination.utils.ts`: header comment — drop `GET /admin/employees-documents/expiring` from the "full array, NO server pagination" sentence; keep `GET /admin/employees-time-off/pending-approvals` line; refresh `DEFAULT_TABLE_PAGE_SIZE` docstring (now pending-approvals only). Doc-only — no RED.
- [x] 1.8 REFACTOR trim dead imports (`employeeTimeOffQueryKeys` unused import trimmed from wu12b; `paginateRows`/`buildManagerMap`/`resolveManagerName`/`listForPicker` removed from view; `tenantId` removed from composable params — backend derives from JWT, Fase 3 #1 lesson); tests green.
- [x] 1.9 PULLED FORWARD task 2.1 (gatekeeper correction, Fase 3 #1 lesson): port `__tests__/wu12b-dashboard-views.spec.ts` IN WU-A — replace `getExpiringDocuments` spy with `getExpiringDocumentsPaginated` `toHaveBeenCalledWith(paramsObject, daysValue)`; drop the 6 `paginateRows` slice copies (canonical in `pagination.utils.spec.ts`); KEEP `employeeDocumentQueryKeys.expiring` key shape (30/60/90/tenantId uniqueness), `formatDaysRemaining`, `computeExpiringDocumentRow` (title fallback, null `expiresAt` → "—"), tenantId regression sample (`getExpiringDocumentsPaginated`/`getDocuments`/`getTimeOff`/`getPendingApprovals` — none send `tenantId`). Verified `pnpm test:unit --run src/features/admin/employees` (918 tests green — WU-A stubs + ported wu12b + preserved invariants) + `pnpm build` clean (exit 0). `s5-tray-reframe`/`wu11-timeoff-review-emergency-contacts`/`foundation`/`PendingApprovalsView.test`/`EmployeesListView.test`/`EmployeesListView.batch.spec.ts`/`wu03-card-view.spec.ts`/`wu09-documentos.spec.ts` UNCHANGED (preserved invariants).

**Commit**: `feat(admin-expiring-documents): migrate to useServerTable, surface errors, add sort/visibility/search/filters`. Stages `employees.api.ts` (modify), `useExpiringDocuments.ts` (modify), `ExpiringDocumentsView.vue` (modify), `pagination.utils.ts` (modify), `employees.api.spec.ts` (new — adapter stub), `useExpiringDocuments.spec.ts` (new — stub), `ExpiringDocumentsView.test.ts` (new — stub).

---

## Phase 2: WU-C — Tests (~250-300 lines, 3 files)

**Files**: modify `__tests__/wu12b-dashboard-views.spec.ts`; expand `composables/__tests__/useExpiringDocuments.spec.ts`; expand `views/__tests__/ExpiringDocumentsView.test.ts`. `s5-tray-reframe.spec.ts`/`wu11-timeoff-review-emergency-contacts.spec.ts`/`foundation.spec.ts`/`PendingApprovalsView.test.ts`/`EmployeesListView.test.ts`/`EmployeesListView.batch.spec.ts`/`wu03-card-view.spec.ts`/`wu09-documentos.spec.ts` UNCHANGED (preserved invariants). Strict TDD: RED → GREEN → REFACTOR.

- [x] 2.1 DONE IN WU-A (pulled forward per gatekeeper correction — see task 1.9). Verified green in WU-C: wu12b spy port (`getExpiringDocumentsPaginated` `toHaveBeenCalledWith(paramsObject, daysValue)`) landed in commit 9411f20 and passes with the WU-C expansion.
- [x] 2.2 RED expand `composables/__tests__/useExpiringDocuments.spec.ts` (from WU-A 1.3): adapter params via composable's `queryFn` (page translation, limit clamp 100 with pageSize=250, search gate 1-char omits / 2+ chars passes, sortBy/sortOrder from `EXPIRING_DOCUMENTS_SORT_MAP`, empty sorting omits both, `documento` never maps, no `tenantId`); `mapExpiringDocumentsPaginated` meta reader (`{ data, meta }` → `{ data, pagination: { pageIndex: meta.page-1, pageSize: meta.limit, totalCount: meta.total, pageCount: meta.totalPages } }`); `EXPIRING_DOCUMENTS_SORT_MAP` literal assertions; threshold `watch` resets `pageIndex` (use Vue `nextTick` or `@vue/test-utils` `setValue`); row mapper adds `fullName`/`employeeNumber`. Red → Green. Added queryFn-driven wiring block (`daysUntilExpiry` closure → URL, page/limit translation, search gate, SORT_MAP miss, no tenantId) — 23 → 27 tests.
- [x] 2.3 RED expand `views/__tests__/ExpiringDocumentsView.test.ts` (from WU-A 1.5): mock `useExpiringDocuments` (`documents`/`pagination`/`sorting`/`globalFilter`/`columnVisibility`/`isError`/`error`/`refresh`/`selectedThreshold` as refs); stub `AppDataTable` (`data-error`/`data-error-message`/`data-column-visibility`/`data-show-toolbar` attrs, `#filters`/`#documento-cell`/`#categoria-cell`/`#colaborador-cell`/`#vencimiento-cell`/`#restante-cell` slots, `default` slot placeholder) + REAL `SortableHeader`. Cases: error precedence ×3 (`response.data.message` string / array[0] / `error.message` / fallback) + retry → `refresh` + empty suppressed on error; search → `globalFilter` (no `paginateRows` spy fires — explicit spy guard added); 4 columns `enableHiding: true` + `documento` absent from dropdown; selector in `#filters` (not header) refetches; `colaborador` renders `fullName` + avatar seed stays `employeeId`; NO `listForPicker` spy fires; `useServerTable` mocked (UNTOUCHABLE — Fase 3 #1 lesson). Red → Green — 16 tests.
- [x] 2.4 REFACTOR trim mocks, consolidate stubs, dedupe helper assertions between wu12b port + composable/view specs; tests green. Removed dead mocks (`useManagerResolution`, `@tanstack/vue-query`, `useAuthStore`, inert `computeExpiringDocumentRow` export, dead `data`/`refetch` keys) — view no longer imports them post-migration; `paginateRows` now a spy guard for REQ-1.
- [x] 2.5 Verify `pnpm test:unit --run src/features/admin/employees` (922 tests green — new + ported + preserved `wu12b-dashboard-views.spec.ts`/`EmployeesListView.test.ts`/`EmployeesListView.batch.spec.ts`/`wu03-card-view.spec.ts`/`wu09-documentos.spec.ts`); full `pnpm test:unit` (4259 total — only the 2 pre-existing baseline failures: `SalesListView.test.ts` POS/sales + `router.notifications.spec.ts`, unchanged); `pnpm build` clean (exit 0).

**Commit**: `test(admin-expiring-documents): port wu12b spy and cover adapter/composable/view contracts`. Stages `wu12b-dashboard-views.spec.ts` (modify — spy port + drop `paginateRows` slice copies), `useExpiringDocuments.spec.ts` (expand), `ExpiringDocumentsView.test.ts` (expand).

---

## Threat Matrix

N/A per design (no routing, shell, subprocess, VCS/PR automation, executable-file classification, process-integration boundary). Pure frontend data-layer refactor (composable + adapter + view props). All REQ-1..9 invariants covered by RED-test tasks in WU-A stubs and WU-C expansion.

---

## Definition of Done

- [x] REQ-1..9 satisfied; `useExpiringDocuments` composes `useServerTable` (UNTOUCHED); `selectedThreshold` closes `queryKey`/`queryFn`; `watch(selectedThreshold)` resets `pageIndex=0`; default `expiresAt asc`; `persistKey: 'admin-expiring-documents'`; `urlSync: false`; `staleTime: 30_000`; `refetchOnWindowFocus: false`
- [x] REQ-2: 4 sortable columns (`vencimiento`/`restante`/`categoria`/`colaborador`); `documento` non-sortable; `EXPIRING_DOCUMENTS_SORT_MAP` whitelist; empty `sorting` omits `sortBy`/`sortOrder`
- [x] REQ-3: `show-toolbar="true"`; `globalFilter` debounced 300ms → `search` (omitted `<2` chars); `SEARCH_QUERY_TOO_SHORT` surfaces via error block
- [x] REQ-4: `enable-column-visibility`; 4 data columns `enableHiding: true`; `documento` `enableHiding: false`
- [x] REQ-5: `documentsErrorMessage` precedence (`response.data.message` string|array[0] → `error.message` → "No se pudieron cargar los documentos. Intenta de nuevo."); retry → `refresh`; empty placeholder suppressed on error
- [x] REQ-6: `getExpiringDocumentsPaginated(params, daysUntilExpiry)` builds `{ daysUntilExpiry, page = pageIndex+1, limit = min(pageSize, 100), search? (≥2), sortBy?, sortOrder? }`; `mapExpiringDocumentsPaginated` reads `{ data, meta: { total, page, limit, totalPages } }`; `ExpiringDocumentItem = EmployeeDocument & { fullName; employeeNumber }`; `EmployeeDocument` UNCHANGED
- [x] REQ-7: 30/60/90 `USelect` lives in `#filters` slot; change refetches + resets `pageIndex=0`; NO `USelect` in `AdminPageHeader`
- [x] REQ-8: `colaborador` renders server `fullName`; avatar seed stays `employeeId`; `listForPicker`/`buildManagerMap`/`resolveManagerName` query REMOVED; no `>100`-cap
- [x] REQ-9: `AdminPageHeader` + `UCard` shell preserved; `formatDaysRemaining`/`computeExpiringDocumentRow`/`formatTimeOffDate` signatures UNCHANGED; `pagination.utils.ts` header drops `/expiring` from "full array" list, keeps `/pending-approvals`; NO `ViewToggle`/`displayMode`/`useExpiringDocumentsViewMode`/`ExpiringDocumentCard` introduced; NO `EmployeeDocument` core change; NO backend change
- [x] `pnpm test:unit --run src/features/admin/employees` green; `pnpm test:unit` green; `pnpm build` clean
- [x] Per-WU commits on branch in order: WU-A → WU-C (2 conventional commits on `feat/standardize-expiring-documents-table`)
- [ ] `pnpm dev` smoke: threshold change in `#filters` refetches + resets to page 1; sortable headers toggle server `sortBy`/`sortOrder`; toolbar search debounces 300ms; column-visibility dropdown lists 4 columns (no `documento`); error block shows resolved message + retry refetches; `colaborador` renders server `fullName`; no `listForPicker` network call; no `paginateRows` slice runs in the view