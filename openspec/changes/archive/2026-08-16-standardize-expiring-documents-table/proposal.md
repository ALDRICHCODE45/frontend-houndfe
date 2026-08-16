# Proposal: Standardize Expiring Documents Table

## Intent

Bring `ExpiringDocumentsView.vue` ("Documentos por vencer") to full Fase 3 gold-standard parity. The view is already `AppDataTable`-based, but its data layer is the named gap: `useExpiringDocuments` fetches the **full server-sorted array** and paginates **client-side** (`paginateRows` + hand-rolled `page`/`pageSize`), with `show-toolbar="false"` (no search/refresh/column-visibility), no sorting, a hardcoded error message, and a secondary `listForPicker` name-resolution query capped at 100 active employees. **The backend team CONFIRMED server-side pagination/search/sort** for `GET /admin/employees-documents/expiring` — so the literal "move to server-side" goal is now unblocked (Approach A).

## Scope

### In Scope

- **G1 migrate to `useServerTable` (HIGH)**: Approach A — true server-side migration mirroring Fase 3 #1's closure-composition. `useExpiringDocuments` closes `selectedThreshold` (daysUntilExpiry) over `useServerTable`'s `queryKey`/`queryFn`. Shared `useServerTable` is NOT modified.
- **G2 sorting (MED — NOW in scope)**: `enableSorting: true` + `SortableHeader` on `vencimiento`→`expiresAt`, `restante`→`expiresAt`, `categoria`→`category`, `colaborador`→`employeeName`. `documento` stays `enableSorting: false` (no server `notes`/`title` sortBy; `createdAt`=upload-date, `category` duplicates categoria). Default `expiresAt asc` preserved.
- **G3 search (MED)**: `show-toolbar="true"` + `v-model:global-filter` → `search` (≥2 chars guard mirroring `users.api.ts`; `SEARCH_QUERY_TOO_SHORT` surfaces via the error block if ever rejected).
- **G4 column visibility (MED)**: `enable-column-visibility` + `enableHiding: true` on `categoria, colaborador, vencimiento, restante`; `documento` non-hideable (primary anchor).
- **G6 error computed (LOW)**: `backendMessage > error.message > "No se pudieron cargar los documentos. Intenta de nuevo."` via `:error`/`:error-message`.
- **G7 expiry-window selector**: move 30/60/90 into `AppDataTable`'s `#filters` slot (feeds `selectedThreshold`).
- **G8 refresh**: free via enabled toolbar.
- **Employee name inline**: drop `listForPicker`/`buildManagerMap`/`resolveManagerName` query; render item `fullName` (server-resolved) — removes the >100-cap limitation.
- **API adapter**: new `getExpiringDocumentsPaginated(params)` + `mapExpiringDocumentsPaginated` (reads `{ data, meta }`), + `EXPIRING_DOCUMENTS_SORT_MAP` (column id → sortBy).
- **`pagination.utils.ts` header**: remove `/expiring` from the "full array, NO server pagination" comment (leave `/pending-approvals` line).
- **Tests**: port `wu12b-dashboard-views.spec.ts` (spy → paginated params); drop `paginateRows` slice tests for this view; add error/search/sort/column-visibility coverage.

### Out of Scope

- **Card view (G5) — OUT**: read-only dashboard, no per-row actions, no `ExpiringDocumentCard` exists. No `ViewToggle`/`useExpiringDocumentsViewMode`/`displayMode`. (Follow-up if product wants cards.)
- No backend change (contract is provided evidence); no `EmployeeDocument` core type change (add a dedicated `ExpiringDocumentItem` response type); no `PendingApprovalsView` work (Fase 3 #3).
- `createdAt` backend sortBy remains unused (no column maps to it).

### Already in Place (do NOT redo)

- `AppDataTable` + `#cell` slots, `AdminPageHeader`, `UCard` shell ✅.
- `formatDaysRemaining`/`computeExpiringDocumentRow`/`formatTimeOffDate` pure helpers ✅.
- Category/days-remaining badge color helpers ✅.

## Capabilities

### New

- `admin-expiring-documents` — source-of-truth spec for the tenant-wide expiring-documents dashboard: `useServerTable`-driven server-side pagination/search/sort (`daysUntilExpiry` closure ref), sortable columns (`expiresAt`/`category`/`employeeName`), `documento` non-sortable, column visibility (4 hideable, `documento` non-hideable), toolbar search (≥2 chars), `backendMessage > error.message > fallback` error block, expiry-window selector in `#filters`, server-resolved `fullName`/`employeeNumber` (no `listForPicker`), default `expiresAt asc`.

> No existing `admin-expiring-documents` capability in `openspec/specs/`. Whole capability is `ADDED`; the original view pre-dates the spec system.

### Modified

None.

## Approach

**Approach A (true server-side)**. `employeesApi.getExpiringDocumentsPaginated(params: ServerTableParams, daysUntilExpiry)` builds `{ daysUntilExpiry, page = pageIndex+1, limit = pageSize, search (≥2), sortBy, sortOrder }` and maps `{ data, meta: { total, page, limit, totalPages } }` → `PaginatedResponse` via `mapExpiringDocumentsPaginated` (mirrors `users.api.ts` meta reader / `customer.api.ts mapPagination`). `useExpiringDocuments` composes `useServerTable<ExpiringDocumentRow>` with `selectedThreshold` closing `queryKey`/`queryFn`; `EXPIRING_DOCUMENTS_SORT_MAP` translates `sorting[0].id` → backend `sortBy`. Columns gain `enableSorting`/`enableHiding` + `SortableHeader` slots; view wires `v-model:sorting`/`global-filter`/`column-visibility`/`pagination`, `show-toolbar`, `enable-column-visibility`, `:error-message`, `#filters` slot. `staleTime 30_000` + `refetchOnWindowFocus: false` preserved (useServerTable defaults). `defaultSorting: [{ id: 'vencimiento', desc: false }]`, `persistKey: 'admin-expiring-documents'`, `urlSync: false`, `defaultPageSize: 10`, `pageSizeOptions: [10, 20, 50]`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/admin/employees/api/employees.api.ts` | Modified | `getExpiringDocuments` → `getExpiringDocumentsPaginated(ServerTableParams, daysUntilExpiry)`; add `mapExpiringDocumentsPaginated` + `EXPIRING_DOCUMENTS_SORT_MAP` + `ExpiringDocumentItem` type (`EmployeeDocument & { fullName; employeeNumber }`). |
| `src/features/admin/employees/composables/useExpiringDocuments.ts` | Modified | Compose `useServerTable`; `selectedThreshold` closure; map rows (add `fullName`/`employeeNumber`); drop `paginateRows` re-export if unused here. |
| `src/features/admin/employees/views/ExpiringDocumentsView.vue` | Modified | `show-toolbar`, `v-model:sorting/global-filter/column-visibility/pagination`, `enable-column-visibility`, `SortableHeader` slots, `:error-message` computed, `#filters` slot for threshold selector, drop `listForPicker` query + client pagination refs. |
| `src/features/admin/employees/composables/useEmployeeColumns.ts` | Unchanged | `formatTimeOffDate` reused by row mapper. |
| `src/core/shared/utils/pagination.utils.ts` | Modified | Header comment: `/expiring` no longer "full array" (now server-paginated); `/pending-approvals` line unchanged. |
| Tests: `wu12b-dashboard-views.spec.ts`, new `useExpiringDocuments`/adapter/view specs | Modified/New | Spy → paginated params; drop `paginateRows` slice tests; add sort-map/adapter/error/search/column-visibility coverage. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Response-shape drift (`{ data, meta }` vs flat `mapPaginated`) | Med | Dedicated `mapExpiringDocumentsPaginated`; confirm shape against backend answer before apply. |
| Column-id → sortBy mismatch (Spanish ids vs English backend fields) | Med | Explicit `EXPIRING_DOCUMENTS_SORT_MAP` + whitelist; unit-test the mapping. |
| `defaultSorting`/`manualSorting` trap (useServerTable forces manual) | Low | `AppDataTable` + `useServerTable` already `manualSorting: true`; sort rides the server param. |
| Search <2 chars rejects (`SEARCH_QUERY_TOO_SHORT`) | Low | Client-side guard omits `search` <2 chars (users pattern); error computed surfaces any backend rejection. |
| Name-resolution regression (dropping `listForPicker`) | Low | `fullName`/`employeeNumber` now server-resolved; `colaborador` renders `fullName`, avatar seed stays `employeeId`. |
| `wu12b` spec pins the old full-array contract | Med | Port/strip per Fase 3 #1 WU-C precedent; do not just add new specs. |
| Migration WU overrun (Fase 3 #1 WU-A actual 1658) | High | Budget realistically; keep spec port in WU-C, not WU-A. |

## Rollback Plan

Revert the merge commit. The API change (`getExpiringDocuments` → `getExpiringDocumentsPaginated`) is the only non-additive step; the prior full-array contract is pinned in `wu12b-dashboard-views.spec.ts` + git history. Error computed is additive (falls back to current message when `error` null). Column visibility is opt-in. Threshold selector relocation into `#filters` is reversible by restoring the header `USelect`. `listForPicker` query removal restores the `buildManagerMap`/`resolveManagerName` block from git history. `pagination.utils.ts` comment revert is a one-line doc change. Tests live beside the code they pin.

## Dependencies

`useServerTable` (already surfaces `sorting`/`globalFilter`/`columnVisibility`/`isError`/`error`/`refresh`/`pagination`); `AppDataTable` (`v-model:sorting`, `v-model:global-filter`, `v-model:column-visibility`, `enable-column-visibility`, `#filters`, `:error`/`:error-message`); `SortableHeader`; `AdminPageHeader`; `employeeDocumentQueryKeys.expiring` (extend for params or keep threshold in key); `PaginatedResponse`/`ServerTableParams`. Backend contract `GET /admin/employees-documents/expiring` (evidence, not code). **No `houndfe-backend` access** (frontend-only — folder forbidden).

## Open Questions (backend team — relay to orchestrator)

1. **`createdAt` sortBy**: confirmed available but no column maps to it — leave latent, or wire `documento` to `createdAt` later?
2. **`meta.limit` vs `pageSize` authority**: confirm `limit` is the page size and `totalPages` is `ceil(total/limit)` (assumed from the users pattern).

## Success Criteria

- [ ] `useExpiringDocuments` composes `useServerTable`; no hand-rolled `page`/`pageSize`/`paginateRows` in the view.
- [ ] Server-side pagination/search/sort round-trips with `daysUntilExpiry`, `page`, `limit`, `search` (≥2), `sortBy`, `sortOrder`.
- [ ] `vencimiento`/`restante` (expiresAt), `categoria` (category), `colaborador` (employeeName) sortable; `documento` non-sortable; default `expiresAt asc` preserved.
- [ ] Column visibility: 4 data columns hideable, `documento` non-hideable.
- [ ] Toolbar search works; failed requests render `backendMessage > error.message > fallback`; empty placeholder only on empty success.
- [ ] Expiry-window selector (30/60/90) lives in `#filters` slot; changing it refetches + resets to page 1.
- [ ] `colaborador` renders server `fullName`; `listForPicker`/`buildManagerMap`/`resolveManagerName` query removed; no >100-cap note.
- [ ] `pagination.utils.ts` header no longer lists `/expiring` as "full array"; `/pending-approvals` line unchanged.
- [ ] No card view / `ViewToggle` / `displayMode` introduced.
- [ ] `pnpm test:unit --run` green (ported + new specs); `pnpm build` clean.
- [ ] No backend change; shared `useServerTable` untouched.

## Work Units (forecast)

- **WU-A — `useServerTable` migration + API adapter + columns + error + view wiring (~220-280 lines)**: `getExpiringDocumentsPaginated` + `mapExpiringDocumentsPaginated` + `EXPIRING_DOCUMENTS_SORT_MAP` + `ExpiringDocumentItem` type; `useExpiringDocuments` compose; `ExpiringDocumentsView` toolbar/sorting/search/column-visibility/`#filters`/error-message; drop client pagination + `listForPicker`. **WU-B (view wiring) is FOLDED into WU-A** — no separate card view or view-mode composable to split out; the view wiring is inseparable from the composable's sort/column contract.
- **WU-C — tests (~250-300 lines)**: port `wu12b-dashboard-views.spec.ts` (spy → paginated params, `toHaveBeenCalledWith` → param object; drop `paginateRows` slice tests for this view); add `mapExpiringDocumentsPaginated`, `EXPIRING_DOCUMENTS_SORT_MAP`, error/search/sort/column-visibility coverage.

Review Workload Forecast: `Decision needed before apply: No`, `Chained PRs recommended: No` (NO PRs — conventional commits on branch, manual merge to main), `400-line budget risk: Medium-High` — WU-A heaviest (migration + adapter + view), forecast conservatively given Fase 3 #1 WU-A overrun precedent; spec port stays in WU-C.
