# Exploration: Standardize Expiring Documents Table (Fase 3 #2)

> Date: 2026-08-15
> Change: `standardize-expiring-documents-table`
> Scope: `ExpiringDocumentsView.vue` ("Documentos por vencer") only. `PendingApprovalsView.vue` (Fase 3 #3) is noted as context, NOT designed here.
> Frontend-only: `houndfe-backend` is forbidden. Backend questions are listed for the orchestrator to relay — no backend code was read.

## Executive Summary

`ExpiringDocumentsView.vue` is **NOT** in the same state as `EmployeesListView.vue` was before Fase 3 #1. It already uses `AppDataTable` (with `#cell` slots), `AdminPageHeader`, and error surfacing (`:error="isError"` + `error-message`). Its differentiator is the **data model**: it calls `GET /admin/employees-documents/expiring?daysUntilExpiry=N`, which returns the **FULL server-sorted array (NOT paginated)** — so pagination is **CLIENT-SIDE** via the shared `paginateRows` util, driven by hand-rolled `page`/`pageSize` refs bridged into `AppDataTable`'s 0-based `pagination`. This client-side pagination is **documented and intentional** (`pagination.utils.ts` header explicitly lists this endpoint, alongside `pending-approvals`, as "full array, NO server pagination").

Gaps vs the Fase 2/3 gold standard are therefore **narrower but different in kind** than the employees gap: **no sorting** (all 5 columns `enableSorting: false`, no `SortableHeader`), **no global search** (`show-toolbar="false"` disables the toolbar entirely — so no search box, no refresh button, no column-visibility dropdown), **no column visibility** (`enable-column-visibility` not set, columns lack `enableHiding`), **no card view** (`#cards` slot / `ViewToggle` / `displayMode` bridge absent), and a **hardcoded error message** (vs the `backendMessage > error.message > Spanish fallback` computed used by gold modules). The expiry-window selector (30/60/90 days) is the one filter-like control and lives in the header, not the `#filters` slot.

**The pivotal question: does the backend support server-side pagination/search/sort for this endpoint?** From frontend code evidence alone: **NO.** `employeesApi.getExpiringDocuments(daysUntilExpiry?)` sends only `daysUntilExpiry` and the endpoint is documented to "return an array sorted by `expiresAt asc`". There is no `page`/`pageSize`/`search`/`sortBy`/`sortOrder` param for it anywhere in the frontend. This means "move to server-side" — the literal handoff goal — is **blocked on backend work**, and the change must decide between (A) a true server-side migration (needs backend), (B) client-side gold-standard parity (sort/search/column-visibility/cards, keeping the full-array fetch), or a hybrid. See §4–§5.

Test coverage is **pure-helpers + API-spy only** (`wu12b-dashboard-views.spec.ts`): query-key shape, `getExpiringDocuments` spy, `formatDaysRemaining`, `computeExpiringDocumentRow`, `paginateRows`, and tenantId regression. There is **no `ExpiringDocumentsView` mount test, no error-surfacing spec, no sorting/column-visibility spec** (the file header explicitly states "No component mount tests for views").

---

## 1. Current State

### 1.1 Data layer — `useExpiringDocuments.ts`

- `useExpiringDocuments(days: MaybeRef<30|60|90> = 30)` wraps a TanStack `useQuery<EmployeeDocument[]>` with `queryKey = employeeDocumentQueryKeys.expiring(tenantId, days)`, `enabled: !!tenantId`, `staleTime: 30_000`, `refetchOnWindowFocus: false`.
- Returns the **raw full array** — no pagination, no search, no sort params (backend sorts by `expiresAt asc`).
- Re-exports `paginateRows` / `PaginatedRows` from the shared util "so existing importers keep working unchanged".
- Pure helpers (exported for zero-mock tests): `formatDaysRemaining(days)` and `computeExpiringDocumentRow(doc, now?)` → `ExpiringDocumentRow` (`title` from `notes ?? categoryLabel`, `daysRemaining`, `daysRemainingLabel`, `expiresAtLabel` via `formatTimeOffDate`).
- **Not** a `useServerTable` consumer (and cannot be trivially, since the endpoint is unpaginated).

### 1.2 API layer — `employeesApi.getExpiringDocuments` (`employees.api.ts:428-437`)

- `GET /admin/employees-documents/expiring` (hyphenated route, NOT under `/:employeeId`), query param `daysUntilExpiry` only.
- Returns `EmployeeDocument[]` (full array). **No pagination/search/sort params exist in the frontend for this endpoint.**
- `EmployeeDocument` shape (`employee.types.ts:255-264`): `{ id, employeeId, fileId, category (9-enum), notes, expiresAt, createdAt }` — **no embedded employee name**, hence the secondary name-resolution query (below).
- Contrast: `getDocuments(employeeId, params)` (the per-employee panel) **does** support `page`/`pageSize`/`category`/`expiringWithinDays` returning `DocumentsBackendList`; `list()` (employees) supports `page`/`pageSize`/`status`/`search`/`managerId`; `users.api.ts.getPaginated` supports `page`/`limit`/`search`(≥2)/`sortBy`/`sortOrder` + a `meta` object. **The tenant-wide expiring endpoint has none of these.**

### 1.3 View — `ExpiringDocumentsView.vue` (267 lines)

- **Already gold-standard-ish**: `UCard` + `#header` → `AdminPageHeader` (title/description); `AppDataTable` with `#documento-cell`/`#categoria-cell`/`#colaborador-cell`/`#vencimiento-cell`/`#restante-cell` slots; `:error="isError"` + `error-message="No se pudo cargar los documentos. Intenta de nuevo."` (hardcoded); `:loading`/`:fetching`/`:empty` wired.
- **Client-side pagination**: `page`/`pageSize` refs → `paged = paginateRows(allRows, page, pageSize)` → `AppDataTable v-model:pagination` via a manual `pagination` computed bridge (0-based ↔ 1-based), plus `showingFrom`/`showingTo` computed from the client slice. `watch(selectedThreshold)` resets `page = 1`.
- **`show-toolbar="false"`** — disables the toolbar, so there is **no search box, no refresh button (in normal state), and no column-visibility dropdown**. `@refresh` only fires from the error-state "Reintentar" button.
- **No** `v-model:sorting`, `v-model:global-filter`, `v-model:column-visibility`, `:display-mode`, `enable-column-visibility`, `#filters` slot, or `#cards` slot.
- **Expiry-window selector** (`selectedThreshold` 30/60/90) sits in the header (next to `AdminPageHeader`), NOT in the `#filters` slot — this is the only filter control.
- **Employee name resolution**: a second `useQuery` (`employeesApi.listForPicker('')`, cached via `employeeQueryKeys.activeForPicker(tenantId, '')`, `staleTime: 60_000`) builds an id→name map (`buildManagerMap`/`resolveManagerName`). **KNOWN LIMIT (documented in-code)**: `listForPicker` caps at `pageSize: 100` active employees, so a document owned by an employee beyond the first 100 active resolves to "—".

### 1.4 Columns

- 5 columns built inline (`columns` computed): `documento`, `categoria`, `colaborador`, `vencimiento`, `restante` — all `createSimpleHeader`, **all `enableSorting: false`**, none with `enableHiding`. No `SortableHeader`, no `actions` column (this is a read-only dashboard; no row actions).

### 1.5 View mode

- **No** table/card toggle. No `useExpiringDocumentsViewMode` composable; no `displayMode` bridge. (Gold modules all have `useXViewMode` + `displayMode` + `#cards`.)

### 1.6 Tests (current coverage)

- `__tests__/wu12b-dashboard-views.spec.ts` (315 lines): `employeeDocumentQueryKeys.expiring` shape; `employeesApi.getExpiringDocuments` spy (with/without args, empty array, `toHaveBeenCalledWith(60)`); `formatDaysRemaining`; `computeExpiringDocumentRow` (title fallback, null `expiresAt` → "—"); `paginateRows` client-side slice (6 cases); tenantId regression (`getExpiringDocuments`/`getDocuments`/`getTimeOff`/`getPendingApprovals` must not send `tenantId`).
- `__tests__/wu09-documentos.spec.ts` + `foundation.spec.ts`: expiring key shape (redundant coverage for the per-employee `DocumentosPanel` path, not this view).
- **Missing**: `ExpiringDocumentsView` mount test, error-surfacing spec, sorting spec, column-visibility spec, any view-mode spec. The spec header notes the strategy is Extract-Before-Mock (pure helpers), with no component mounts for views.

---

## 2. Gaps vs Gold Standard (Fase 2/3 parity)

| # | Gap | Severity | Notes |
|---|-----|----------|-------|
| G1 | **Client-side pagination** (full-array fetch + `paginateRows`) instead of `useServerTable` server-side | **HIGH (the named goal)** | Intentional per `pagination.utils.ts`; backend endpoint is unpaginated. See open questions. |
| G2 | **No sorting** (5 columns `enableSorting:false`, no `SortableHeader`) | MED | Client-side sort is feasible (full array in memory) but `AppDataTable` forces `manualSorting: true`, so the view must sort itself. |
| G3 | **No global search** (`show-toolbar="false"`) | MED | Search would be client-side over `allRows` unless backend adds `search`. |
| G4 | **No column visibility** (`enable-column-visibility` + `enableHiding` absent) | MED | Requires `show-toolbar` true + `enableHiding: true` on data columns. |
| G5 | **No card view / `ViewToggle` / `displayMode` / `#cards`** | LOW | No card component exists for documents; read-only dashboard may not warrant cards — product decision. |
| G6 | **Hardcoded error message** (vs `backendMessage > error.message > fallback` computed) | LOW | Gold modules derive from `error.response.data.message`. |
| G7 | **Expiry-window selector in header, not `#filters` slot** | LOW | The one filter control; moving to `#filters` would need `show-toolbar` true. |
| G8 | **No refresh affordance** in normal state (`show-toolbar=false` hides it) | LOW | Only the error retry button can refetch. |

---

## 3. Affected Areas

| Area | Why |
|------|-----|
| `src/features/admin/employees/views/ExpiringDocumentsView.vue` | Core change: sorting, search, column visibility, `displayMode`/cards, error-message computed, toolbar/filters placement, pagination mechanism. |
| `src/features/admin/employees/composables/useExpiringDocuments.ts` | If server-side: replace `useQuery<EmployeeDocument[]>` with a `useServerTable`-backed composable (mirroring `useEmployeesList` Approach C) or add a paginated adapter; if client-side: add sort/filter helpers. |
| `src/features/admin/employees/api/employees.api.ts` | `getExpiringDocuments` may need a paginated sibling (`getExpiringDocumentsPaginated`) + `mapPaginated` adapter — **only if backend adds params**. |
| `src/core/shared/utils/pagination.utils.ts` | Its header comment names this endpoint as "full array, NO server pagination" — must be updated if the endpoint becomes paginated. |
| New `useExpiringDocumentsViewMode.ts` (or generic) | If cards are in scope, add `displayMode` bridge + type guard (mirrors `useUserViewMode`/`useEmployeeViewMode`). |
| New `ExpiringDocumentCard.vue` / grid | Only if card view is decided in scope (none exists today). |
| Tests: `wu12b-dashboard-views.spec.ts`, new `ExpiringDocumentsView.test.ts`, sort/filter helper specs | Port/strip per Fase 2 WU-C precedent; add error/column-visibility/sort coverage. |

---

## 4. Approaches

### Approach A — True server-side migration to `useServerTable` (full Fase 2 parity)

Backend adds `page`/`pageSize` (and optionally `search`/`sortBy`/`sortOrder`) to `GET /admin/employees-documents/expiring`, returning a paginated shape. Frontend adds `getExpiringDocumentsPaginated` → `PaginatedResponse` (via `mapPaginated`), and rewrites `useExpiringDocuments` as a `useServerTable` composable (mirroring `useEmployeesList` Approach C: the `selectedThreshold` ref closes over `queryKey`/`queryFn`). Sorting/column-visibility/globalFilter/pagination/error all come from the shared layer; the expiry-window selector moves to the `#filters` slot.

- Pros: literal gold-standard parity; scales to large tenant document sets; error/sort/search/pagination from the shared composable; drops client `paginateRows` from this view.
- Cons: **blocked on backend work** (outside this frontend-only change); larger API surface change; the dataset is bounded by a 30/60/90-day window and may be small enough that server-side is over-engineering; response-shape drift risk (`meta` vs `{data,total,page,limit,pageSize}`); the employee-name `listForPicker` >100-cap limitation persists regardless.
- Effort: **High** (crosses frontend/backend boundary; contingent on backend answer).

### Approach B — Client-side gold-standard parity (keep full-array fetch) — **recommended default**

Keep `getExpiringDocuments` returning the full array. Bring the view to *visual* gold standard using **client-side** mechanics: add `v-model:sorting` + a `sortedRows` computed (sort `allRows` by column id — `vencimiento`/`restante`/`documento`/`categoria`/`colaborador`), enable `show-toolbar` + `v-model:global-filter` + a client-side filter computed, `enable-column-visibility` + `enableHiding: true` on data columns + `v-model:column-visibility`, the `backendMessage > error.message > fallback` error computed, and (if decided) a `#cards` slot via a new `useExpiringDocumentsViewMode` + `displayMode`. Move the expiry-window selector into `#filters`.

- Pros: no backend dependency; delivers the features a user actually sees (sort, search, column visibility, refresh, error messaging); keeps the documented, intentional client-side pagination for a bounded dataset; smaller, frontend-only diff.
- Cons: does **not** literally use `useServerTable` (the shared composable assumes server-side); sorting/search/column-visibility are reimplemented client-side (a one-off pattern); fails the literal "move to server-side" handoff goal.
- Effort: **Medium**.

### Approach C — Client-side wrapper around `useServerTable` ("fake server table")

Wrap `getExpiringDocuments` so `queryFn` returns a `PaginatedResponse` produced by slicing/filtering/sorting the full array locally, then consume `useServerTable` unchanged.

- Pros: literally uses the shared composable (consistency); error state for free.
- Cons: **anti-pattern** — `useServerTable` semantics (`keepPreviousData`, debounced `globalFilter`, page-reset watchers, `ServerTableParams` query-key serialization) are designed for server round-trips, not in-memory slicing; sorting must be reimplemented inside `queryFn` anyway; confusing to future contributors; likely to fight the composable's assumptions.
- Effort: **Medium–High**, questionable value. **Not recommended.**

---

## 5. Recommendation

**Conditioned on the backend answer** — surface the decision in the proposal, not the exploration:

- **If the backend team will add pagination (+ optional `search`/`sortBy`/`sortOrder`) to `/admin/employees-documents/expiring`** → **Approach A**, mirroring the Fase 3 #1 `useEmployeesList` (Approach C) pattern: a `useExpiringDocuments` composable that closes the `selectedThreshold` ref over `useServerTable`'s `queryKey`/`queryFn`, with `mapPaginated` adapting the response and the expiry-window selector moved into `#filters`.
- **If the backend will NOT add pagination (or the answer is pending)** → **Approach B** (client-side parity): keep the full-array fetch and add client-side sort, search, column visibility, the error-message computed, and (optionally) cards. This is the pragmatic default because the endpoint's "full server-sorted array" contract is already documented as intentional, the dataset is bounded by the expiry window, and the visible gaps (G2–G8) can all be closed without touching the backend.

Regardless of A vs B, three decisions must be explicit in the proposal: (1) **card view in or out** (this is a read-only dashboard with no per-row actions — cards may be low-value; no `ExpiringDocumentCard` exists today), (2) **expiry-window selector placement** (`#filters` slot vs header — moving it to `#filters` requires enabling the toolbar), and (3) **the employee-name `listForPicker` >100-cap limitation** — note it as a known data-quality ceiling; a backend-inlined `employeeName` on the expiring payload would remove it (open question).

---

## 6. Risks

1. **Backend pagination support unknown / likely absent** — the endpoint returns a full array with only `daysUntilExpiry`; if the backend won't add params, the literal "server-side" goal is unachievable and the change must be Approach B. **Open question #1 is decisive.**
2. **`AppDataTable` forces `manualSorting: true`** — even for client-side sorting (Approach B), the view must own the sort computation; the shared component will NOT sort for it. This is a subtle trap for an implementer who assumes `enableSorting: true` "just works".
3. **`show-toolbar="false"` is doing heavy lifting today** — re-enabling the toolbar surfaces the search box, refresh button, and (with `enable-column-visibility`) the "Columnas" dropdown at once. This is a visible UI change, not a one-line toggle, and the "Columnas" dropdown only lists columns with `enableHiding`/`getCanHide()` true.
4. **`pagination.utils.ts` documents this endpoint as intentionally client-side** — a server-side migration (Approach A) must update that contract, or it will contradict the code comment and mislead the next contributor.
5. **Employee-name resolution is a known >100-cap ceiling** (`listForPicker` caps at `pageSize: 100`) — unrelated to the table mechanics but adjacent; any rewrite must not regress or silently drop this documented limitation.
6. **No view-level test today** — the spec explicitly avoids mounting views; adding sort/search/column-visibility will need a new mount test (or a clear WU-C precedent for extracting pure sort/filter helpers and testing those instead).
7. **`PendingApprovalsView` shares the same "full array, no pagination" pattern** — the decision made here sets the precedent for Fase 3 #3; an Approach A server-side contract for `/expiring` may prompt the backend to consider `/pending-approvals` symmetrically.

---

## 7. Open Questions (backend team — frontend code evidence only)

1. **Does `GET /admin/employees-documents/expiring` support (or will it add) server-side pagination** (`page`/`pageSize`) — and optionally `search` / `sortBy`/`sortOrder` (like `GET /admin/users`)? Frontend sends only `daysUntilExpiry` and treats the response as a full array. This single answer determines Approach A vs B.
2. **If paginated, what response shape?** The employees list returns `{ data, total, page, limit, pageSize }`; users returns a `meta` object (`totalPages` included). Which shape would `/expiring` return so the frontend can pick the right adapter (`mapPaginated` vs a `meta` reader)?
3. **Can the expiring payload include a resolved `employeeName` (server-side join)?** Currently the frontend resolves names via a cached `listForPicker` capped at 100 active employees — documents owned by employees beyond the first 100 active resolve to "—". Inlining the name would remove the cap.
4. **Is the full-array contract deliberate** (bounded dataset by design) — i.e., is client-side pagination acceptable and the backend has no plan to paginate this endpoint?

---

## 8. Ready for Proposal

**Yes** — the frontend state, gold-standard deltas, and the pivotal backend dependency are fully mapped. The proposal must: (1) pick Approach A vs B **based on Open Question #1** (recommend B as the no-backend default, A if pagination is confirmed), (2) decide card view in/out, (3) decide expiry-window selector placement (`#filters` vs header), (4) record the `listForPicker` >100-cap as a known limitation (or a backend ask via Open Question #3), and (5) carry the four backend questions forward. `PendingApprovalsView` (Fase 3 #3) remains a separate candidate — not in this change's scope.
