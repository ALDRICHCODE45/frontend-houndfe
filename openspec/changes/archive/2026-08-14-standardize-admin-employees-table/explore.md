# Exploration: Standardize Admin Employees Table (Fase 3 #1)

> Date: 2026-08-14
> Change: `standardize-admin-employees-table`
> Scope: `EmployeesListView.vue` only (the Empleados list). `ExpiringDocumentsView.vue` (candidate #2) and `PendingApprovalsView.vue` (candidate #3) are noted as context, NOT designed here.
> Frontend-only: `houndfe-backend` is forbidden. Backend questions are listed for the orchestrator to relay — no backend code was read.

## Executive Summary

`EmployeesListView.vue` is NOT a blank slate — it already uses `AppDataTable`, a shared `ViewToggle`, a `useEmployeeViewMode` composable wrapping `useViewMode`, and an `EmployeeCard`/`EmployeeCardGrid` pair. The core gap that makes it a Fase 3 candidate is that its data layer is a **custom composable (`useEmployeesList`) with hand-rolled `page`/`pageSize`/`search`/`statusTab` refs**, not the shared `useServerTable`. Consequence gaps vs the Fase 2 gold standard: **no error surfacing** (no `isError`/`error` destructure, `:error`/`:error-message` never passed — a failed request renders as "No se encontraron colaboradores"), a **custom inline header instead of `AdminPageHeader`**, **no sorting** (all columns `enableSorting: false`, disabled "Más recientes" select), **no column visibility** (no `enable-column-visibility`, columns lack `enableHiding`), and a **card view implemented OUTSIDE `AppDataTable`** (a separate `v-else` branch with duplicated prev/next pagination) rather than the `#cards` slot + `:display-mode` bridge. The backend already supports server-side **search + status filter + pagination** (`GET /admin/employees?page&pageSize&status&search&managerId`); server-side **sort is unproven** (no sort param in `employees.api.ts`, sort dropdown disabled) — an open question for the backend team.

---

## 1. Current State

### 1.1 Data layer — `useEmployeesList.ts` (custom, NOT `useServerTable`)

- Owns local refs: `statusTab`, `search`, `managerId`, `page`, `pageSize`.
- Debounced search via `refDebounced(search, 300)`.
- `queryKey = [...employeeQueryKeys.paginated(tenantId), queryParams]`; `useQuery` with `keepPreviousData`, `staleTime: 30_000`, `refetchOnWindowFocus: false`, `enabled: !!tenantId`.
- Destructures only `isLoading, isFetching, refetch` — **no `isError`/`error`**.
- Row selection (`rowSelection`, `selectedEmployees`, `clearSelection`) added in WU-12; **index-based** (`rowSelection[String(index)]`), matching `useServerTable.selectedRows` semantics.
- A code comment (`:18-22`) explicitly states "migrating to useServerTable is out of scope for this SDD" — this change IS that migration.

### 1.2 API layer — `employees.api.ts`

- `list(params)` → `GET /admin/employees` with `page` (1-indexed), `pageSize`, `status` (lowercase `active|terminated|all`), `search`, `managerId`. **No sort param.**
- Response shape `EmployeesBackendList = { data, total, page, limit, pageSize }` — **no `totalPages`**; `mapPaginated` computes `pageCount = ceil(total/pageSize)` and maps `page-1 → pageIndex`.
- `normalizeEmployee` derives `fullName` from `firstName`/`lastName` defensively.
- Contrast with gold standard `users.api.ts.getPaginated`: that sends `page`, `limit`, `search` (min 2 chars), `sortBy`/`sortOrder` (whitelist `name|email|createdAt`) and reads a `meta` object (`totalPages` included).

### 1.3 View — `EmployeesListView.vue`

- Custom inline header (`<h1>Colaboradores</h1>` + description) with **disabled** Importar/Exportar buttons and a `Nuevo colaborador` button gated by `canCreate`.
- A dead toolbar row: disabled "Filtros" button + disabled "Todos los departamentos" + "Cualquier modalidad" selects.
- `EmployeeFilters` (search + status tabs Todos/Activos/Bajas) + a disabled "Más recientes" sort `USelect` + refresh + `ViewToggle` — all in a filter row **outside** `AppDataTable`.
- `AppDataTable` bound with a manual `pagination` computed (`pageIndex = page-1`, `pageSize`), `rowSelection`, custom column/cell slots, and `SelectColumn` slots for bulk selection. **No** `v-model:sorting`, **no** `v-model:global-filter`, **no** `v-model:column-visibility`, **no** `:error`, **no** `:error-message`, **no** `:display-mode`, **no** `enable-column-visibility`.
- Card view is a sibling `v-else` branch rendering `EmployeeCardGrid` plus a hand-rolled prev/next pagination block (`:586-611`) — duplicating pagination that `AppDataTable`/`DataTablePagination` already provides.
- Bulk actions (`BATCH_OPS_CAP = 100`) via `AppDataTable.bulkActions` + `ConfirmModal` / `BatchTerminateModal`, gated by CASL `batch_delete`/`update` on `Employee`. **No Fase 2 admin module has bulk ops** — this is an employees-only differentiator that must be preserved.

### 1.4 Columns — `useEmployeeColumns.ts`

- 8 columns: `colaborador, cargo, departamento, jefedirecto, fechaIngreso, modalidad, estado, actions`. **All `enableSorting: false`**, only `actions` has `enableHiding: false`; the 7 data columns have no `enableHiding` flag at all (so column visibility would be dead even if enabled).
- No `SortableHeader` anywhere; `createSimpleHeader` used for `colaborador`/`jefedirecto`/`actions`.
- Salary column intentionally absent (design: salary lives in Compensación detail tab).

### 1.5 View mode — `useEmployeeViewMode.ts`

- Wraps shared `useViewMode(VIEW_MODE_STORAGE_KEY = 'employee-view-mode', ['table','card'], 'table')`.
- **Missing** the Fase 2 `displayMode` bridge (`card → 'cards'`) and an `isEmployeeViewMode` type guard (gold standard `useUserViewMode`/`useMembershipViewMode` both have these).
- Also exports `computeSeniority` + `buildCardData` (no-salary card slice) — keep.

### 1.6 Cards — `EmployeeCard.vue` + `EmployeeCardGrid.vue`

- **High quality, already match the Fase 2 card pattern**: `article` root, `EntityAvatar(name, seed=id, show-dot, lg)`, name + position/employeeNumber, `DotBadge(department)` + `StatusDotBadge(status)`, dashed divider, 2-col body (Jefe directo / Fecha de ingreso / Modalidad / Antigüedad).
- **Two divergences from the gold-standard card contract**:
  1. **Has a kebab** (edit/terminate/reactivate, gated by `canUpdate`) — Fase 2 cards (`UserCard`, `MemberCard`) have **no kebab**; destructive actions stay on the table row.
  2. **Card click → `router.push` to `admin-employee-detail`** (`navigateToDetail`) — Fase 2 cards click → `openEdit` slideover (guarded, no `router.push`, no detail route). Employees has a real detail route, so `card-click → navigateToDetail` may be intentional; must be an explicit decision in the proposal, not an accident.
- `EmployeeCardGrid`: ladder grid `sm:2 lg:3 xl:5 2xl:7`, 8 skeletons, `i-lucide-users` empty icon, forwards edit/terminate/reactivate/card-click.

### 1.7 Manager resolution — `useManagerResolution.ts`

- Batch `useQueries` per unique `managerId` (cached 60s), `resolveManagerName`/`resolveManagerEmail` pure helpers. Already N+1-safe; untouched by this change.

### 1.8 Tests (current coverage)

- `__tests__/useEmployeesList.spec.ts` (435 lines): pure `mapPaginated`, `normalizeEmployee`, `buildEmployeesQueryParams`, API spy (no tenantId, lowercase status), badge-tone maps, `formatHireDate`, column-id set (no `salario`). **No `useServerTable` interaction, no `isError`/`error` assertion.**
- `__tests__/wu03-card-view.spec.ts`: view-mode persistence, manager resolution, no-salary card data, seniority.
- `views/__tests__/EmployeesListView.batch.spec.ts`: CASL gates, row selection, SelectColumn slots, bulk modals, lifecycle dialogs — lightweight (`expect(...).toBeDefined()`-style, per the grep).
- **Missing**: error-surfacing spec, column-visibility spec, sorting spec, a `useEmployeeViewMode` `displayMode` bridge spec.

---

## 2. Gaps vs Gold Standard (Fase 2 parity)

| # | Gap | Severity | Notes |
|---|-----|----------|-------|
| G1 | Custom `useEmployeesList` instead of `useServerTable` | **HIGH** | The named reason for this change. |
| G2 | No error surfacing (`isError`/`error`, `:error`, `:error-message`) | **HIGH** | Failed request renders as "No se encontraron colaboradores". |
| G3 | Custom inline header (not `AdminPageHeader`) | MED | Also: Importar/Exportar disabled, dead "Filtros"/department/modality/sort controls. |
| G4 | No sorting (columns `enableSorting:false`, no `SortableHeader`, disabled sort select) | MED | **Blocked on backend sort support** (open question). |
| G5 | No column visibility (`enable-column-visibility`, `enableHiding` on data columns) | MED | Mirrors tenants/roles/users gap. |
| G6 | Card view outside `AppDataTable` (separate `v-else` + duplicated pagination) | MED | Should use `#cards` slot + `:display-mode` bridge. |
| G7 | `useEmployeeViewMode` lacks `displayMode` bridge + `isEmployeeViewMode` guard | LOW | Needed for G6. |
| G8 | Card kebab + card-click→detail diverges from Fase 2 card contract | LOW | Deliberate decision required (employees has a detail route). |
| G9 | Dead UI: "Filtros", "Todos los departamentos", "Cualquier modalidad", "Más recientes", Importar/Exportar | LOW | Either wire (needs backend params) or remove to match gold standard. |

---

## 3. Affected Areas

| Area | Why |
|------|-----|
| `src/features/admin/employees/composables/useEmployeesList.ts` | Replace custom pagination with `useServerTable` (or compose it); expose `isError`/`error`; keep status/manager filters. |
| `src/features/admin/employees/views/EmployeesListView.vue` | `AdminPageHeader`, error wiring, `v-model:sorting/global-filter/column-visibility`, `enable-column-visibility`, `#cards` slot + `:display-mode`, remove duplicate card pagination, drop dead controls. |
| `src/features/admin/employees/composables/useEmployeeColumns.ts` | Add `enableSorting`/`enableHiding` flags + `SortableHeader` wiring (only if backend sort lands). |
| `src/features/admin/employees/composables/useEmployeeViewMode.ts` | Add `displayMode` bridge + `isEmployeeViewMode` guard. |
| `src/features/admin/employees/components/EmployeeFilters.vue` | Either fold status tabs into `AppDataTable`'s `#filters` slot or keep as-is beside the table. |
| `src/features/admin/employees/api/employees.api.ts` | Adapter may need to accept `ServerTableParams` (pageIndex 0-based, sorting) + keep `status`/`managerId` extras. |
| `src/features/admin/employees/components/EmployeeCard.vue` / `EmployeeCardGrid.vue` | Decide kebab + card-click contract (likely unchanged; confirm). |
| Tests: `useEmployeesList.spec.ts`, new `EmployeesListView.test.ts`, `useEmployeeViewMode` displayMode spec | Port + strip per Fase 2 WU-C precedent; add error/column-visibility/sort coverage. |

---

## 4. Approaches

### Approach A — Migrate fully to `useServerTable` (recommended)

Replace `useEmployeesList` internals with `useServerTable`, extending it to carry the employees-only `status` + `managerId` dimensions via `queryKey`/`queryFn` closures over extra refs (or a small `useServerTable` enhancement). Status tabs move into `AppDataTable`'s `#filters` slot; search maps to `globalFilter`; sorting/column-visibility/pagination/error come for free.

- Pros: full Fase 2 parity; removes duplicate pagination/state code; error surfacing + column visibility + sorting from the shared layer; row selection + `selectedRows` already provided.
- Cons: `useServerTable` has no `status`/`managerId` dimension today — needs either an `extraParams`/`filters` extension (shared change, more review surface) or closure-composition inside `useEmployeesList`; the status-tab + search + sort triple is richer than the single `globalFilter` box the gold modules use.
- Effort: **Medium–High** (shared-composable extension vs feature-local composition is the main fork).

### Approach B — Keep `useEmployeesList`, add error + column visibility only (minimal)

Don't touch pagination; just destructure `isError`/`error` from the existing `useQuery`, pass `:error`/`:error-message`, add `enable-column-visibility` + `enableHiding`, add `AdminPageHeader`, and add the `displayMode` bridge to reuse `#cards` slot.

- Pros: smallest diff; no shared-composable change; error masking bug fixed; preserves status-tab model untouched.
- Cons: does **not** deliver the named goal (custom pagination persists); sorting stays dead; two pagination code paths remain; fails Fase 2 parity on the core axis.
- Effort: **Low–Medium**.

### Approach C — Hybrid: `useServerTable` for table mechanics + a thin status-filter layer

Use `useServerTable` for pagination/sorting/search/error/selection, and keep `statusTab`/`managerId` as feature-local refs that feed the `queryKey`/`queryFn` closures (status tabs live in `#filters` slot). This is Approach A's "composition" variant without modifying the shared composable.

- Pros: achieves parity without changing shared code; status tabs remain first-class.
- Cons: slightly more glue in `useEmployeesList`; `queryFn` must close over `status`/`managerId` (not passed by `useServerTable`), which needs a documented pattern.
- Effort: **Medium**.

---

## 5. Recommendation

**Approach C (hybrid composition)** — migrate the table mechanics to `useServerTable` while keeping the employees-only `status` (and latent `managerId`) filter as feature-local refs feeding the `queryKey`/`queryFn` closures, with status tabs rendered via `AppDataTable`'s `#filters` slot. This delivers the named goal (drop custom pagination), fixes error masking, and unblocks column visibility — **without** modifying the shared `useServerTable` (lower review risk). Sorting is the only item that depends on backend capability: if the backend adds `sortBy`/`sortOrder` (like `/admin/users`), enable `SortableHeader` + `enableSorting`; otherwise ship sorting as a follow-up and state it as explicitly out-of-scope.

The card view must move into the `#cards` slot with the `displayMode` bridge (G6/G7). The card kebab and card-click→detail divergence (G8) should be preserved as-is **by explicit decision** (employees has a real detail route and richer per-row actions than users/roles/tenants) — flag it in the proposal rather than silently "fixing" it to the Fase 2 no-kebab contract.

---

## 6. Risks

1. **Backend sort support unknown** — `employees.api.ts` sends no sort param and the sort select is disabled. If the backend doesn't support `sortBy`/`sortOrder`, the "sortable columns" gold-standard goal is unachievable in this change and must be descoped. **Open question for backend team.**
2. **Response-shape drift** — employees returns `{ data, total, page, limit, pageSize }` (no `totalPages`, `pageSize` + `limit` both present), unlike users' `meta` shape. `useServerTable` consumes `PaginatedResponse` only, so `mapPaginated` already bridges this — but confirm `pageSize` vs `limit` semantics before rewriting the adapter.
3. **`useServerTable` lacks `status`/`managerId` dimensions** — closure-composition keeps this feature-local but is a subtle pattern; a future contributor could regress it by refactoring the composable back to a pure `ServerTableParams` function.
4. **Card kebab + bulk actions are employees-only** — a naive "mirror AdminUsersView 1:1" would delete the bulk-action bar and the card kebab. These must be explicitly preserved in scope.
5. **Status tabs are richer than gold-standard search-only filter** — mapping `statusTab` into `#filters` slot while keeping search in the toolbar's `globalFilter` box is a UX change; verify the Fase 2 `#filters` slot + `DataTableToolbar` composition holds both without visual regressions.
6. **Dead UI cleanup** — Importar/Exportar and the Filtros/department/modality/sort dropdowns are disabled placeholders. Removing them is easy but is a visible UI change; keep or wire per product decision.
7. **Test surface** — `useEmployeesList.spec.ts` pins the custom-params contract (`buildEmployeesQueryParams`, `mapPaginated`, no-tenantId). A full migration changes those contracts; WU-C must port/strip per Fase 2 precedent, not just add new specs.

---

## 7. Open Questions (backend team — frontend code evidence only)

1. **Does `GET /admin/employees` support server-side sort** (e.g. `sortBy`/`sortOrder` like `GET /admin/users`)? Frontend sends no sort param and disables the sort dropdown. This gates G4.
2. **Response shape**: is `pageSize` authoritative or `limit`? (`EmployeesBackendList` has both; `mapPaginated` uses `pageSize`.) Does the endpoint return `totalPages` anywhere?
3. **Search minimum length**: does `search` reject <2 chars (users' `SEARCH_QUERY_TOO_SHORT`)? Employees sends `search` unguarded.
4. **Manager filter**: `managerId` is a supported list param (used by `useEmployeesList`/`listForPicker`) but is not exposed in the UI — is it intended to stay latent?

---

## 8. Ready for Proposal

**Yes** — the frontend state, gold-standard deltas, and open questions are fully mapped. The proposal must: (1) decide Approach A/B/C (recommend C), (2) decide card kebab + card-click→detail preservation, (3) decide dead-UI cleanup, (4) state sorting as blocked-or-descoped pending backend answer, and (5) carry the four backend questions forward. `ExpiringDocumentsView` (client-side pagination) and `PendingApprovalsView` (non-table) remain separate candidates — not in this change's scope.
