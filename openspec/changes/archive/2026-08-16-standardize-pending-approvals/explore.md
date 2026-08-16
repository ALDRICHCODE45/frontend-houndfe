# Exploration: Standardize Pending Approvals (Fase 3 #3)

> Date: 2026-08-15
> Change: `standardize-pending-approvals`
> Scope: `PendingApprovalsView.vue` ("Validaciones pendientes") only. This is the LAST of the three Fase 3 candidates (employees #1 merged, expiring-documents #2 paused on a backend answer).
> Frontend-only: `houndfe-backend` is forbidden. Backend questions are listed for the orchestrator to relay — no backend code was read.

## Executive Summary

`PendingApprovalsView.vue` is **NOT a table at all** — it is a **hand-rolled card list** (499 lines) rendering the tenant-wide PENDING time-off queue with per-card **Aprobar / Rechazar** actions and a confirmation dialog. It already uses `AdminPageHeader`, client-side name search, loading/error/empty states, and client-side pagination — but it does **not** use `AppDataTable`, `useServerTable`, `ViewToggle`, `#cards`, column visibility, or a `backendMessage > error.message > fallback` error computed. Its data layer (`usePendingApprovals`) calls `GET /admin/employees-time-off/pending-approvals`, which returns the **FULL server-sorted array (NO pagination/search/sort params)** — the *same* "full array, no server pagination" contract as the expiring-documents endpoint, and explicitly documented as such in `pagination.utils.ts`. `useServerTable` is therefore **NOT a fit** (it assumes a server `PaginatedResponse`), exactly as in Fase 3 #2.

**The core decision — standardize as table vs keep as cards — resolves to a HYBRID (ViewToggle + `AppDataTable` with a `#cards` slot)**, mirroring the expiring-documents "client-side gold-standard parity" (Approach B) precedent, because: (1) the card list is a **deliberate, time-sensitive "easy scanning" UX** that should be preserved, not deleted; (2) every Fase 2 gold module is a table+cards hybrid via `ViewToggle`, so a table-only or cards-only outcome would both deviate from the standard; (3) `AppDataTable` fully supports client-side data (`:data` + manual `v-model:pagination`), the `#cards` slot, `:display-mode`, the `#filters` slot, the toolbar search/refresh, column visibility, and error surfacing — so the view can reach gold-standard **visual** parity without any backend change; and (4) the per-row approve/reject actions map cleanly to BOTH a table `#actions-cell` column AND the existing card actions, so no affordance is lost. There is **no bulk approve/reject** today and no backend batch-review endpoint — bulk review is out of scope (and would be a NEW backend dependency).

---

## 1. Current State

### 1.1 Data layer — `usePendingApprovals()` (`useReviewTimeOff.ts:144-159`)

- `useQuery<TimeOffRequest[]>` with `queryKey = employeeTimeOffQueryKeys.pending(tenantId)`, `queryFn: () => employeesApi.getPendingApprovals()`, `enabled: !!tenantId`, `staleTime: 30_000`, **`refetchOnWindowFocus: true`** (approvals are time-sensitive — deliberate, unlike the employees/expiring views' `false`).
- Returns the **raw full array** — no pagination, no search, no sort params (backend sorts `startDate asc, id asc`).
- **Not** a `useServerTable` consumer (and cannot be trivially — endpoint is unpaginated; same conclusion as Fase 3 #2).
- `useReviewTimeOff(employeeId)` (same file) is the mutation: `POST /admin/employees/:employeeId/time-off/:timeOffId/review`, body `{ decision: 'APPROVED'|'REJECTED', reviewerNotes? }`. On success invalidates the pending tray + the employee's time-off list + vacation balance, then toasts "Ausencia aprobada/rechazada". On error routes through `normalizeApiError` + `resolveDomainErrorMessage` (409 `TIME_OFF_INVALID_TRANSITION` → voseo toast).

### 1.2 API layer — `employeesApi.getPendingApprovals` (`employees.api.ts:566-571`)

- `GET /admin/employees-time-off/pending-approvals` (HYPHEN route, NOT under `/:employeeId`) → `TimeOffRequest[]` (full array). **No params** — never `tenantId`, `managerId`, `page`, `pageSize`, `search`, `sortBy`, `sortOrder`.
- Contrast: the employees `list()` supports `page`/`pageSize`/`status`/`search`/`managerId`; `users.api.ts.getPaginated` supports `page`/`limit`/`search`(≥2)/`sortBy`/`sortOrder` + `meta`; the per-employee `getTimeOff()` supports `status`/`year`/`page`/`pageSize`. **The tenant-wide pending-approvals endpoint has none of these** — identical to `getExpiringDocuments` (full-array, `daysUntilExpiry` only).

### 1.3 Data model — `TimeOffRequest` (`employee.types.ts:283-299`)

- `{ id, employeeId, type (VACATION|SICK|PERSONAL|UNPAID), startDate, endDate, reason (nullable), status, createdAt, requestedByUserId (nullable), reviewerUserId (nullable), reviewedAt (nullable), reviewerNotes (nullable), tenantId, updatedAt }`.
- **No embedded employee name** — hence the secondary `listForPicker` name-resolution query (below). Maps naturally to table columns: `Colaborador` (resolved name), `Tipo`, `Fechas` (range), `Días`, `Motivo` (SICK-guarded), `Estado`, `Solicitada` (createdAt), `Acciones`.

### 1.4 View — `PendingApprovalsView.vue` (499 lines, card list only)

- `UCard` + `#header` → `AdminPageHeader` ("Validaciones pendientes" / tenant-wide description) + a manual "Actualizar" refresh button (icon, `:loading="isLoading"`, `@click="refetch"`).
- **Loading**: 3× `USkeleton`. **Error**: custom inline block with hardcoded message `"No se pudo cargar las solicitudes pendientes. Intenta de nuevo."` (NOT `AppDataTable`'s `:error`/`:error-message`, NOT a `backendMessage > error.message > fallback` computed). **Empty**: success-check icon + "Sin solicitudes pendientes" + "No hay solicitudes de ausencia esperando validación en la organización.".
- **Search**: a raw `UInput` (`data-testid="pending-search-input"`) bound to `searchQuery`, filtering by **resolved employee name** via pure `filterPendingBySearch(requests, employeeMap, query)`. A "no-match" sub-state shows "No hay coincidencias para «…»". A summary line shows "N solicitudes pendientes (de M en total)".
- **Card rows** (per request): avatar initials (AVATAR_PALETTE-seeded by `employeeId`), resolved name, type badge (color per type), date range + day count, reason (SICK+null → "Motivo médico reservado"), status chip ("Pendiente") + "Solicitada el …" (createdAt). **Per-card actions**: `Rechazar` (error/soft) + `Aprobar` (success/soft), gated by `canReview` (`update:EmployeeTimeOff`), disabled while `isReviewing`.
- **Review dialog** (`UModal` + `UCard`): summary (type + date range + days), `UTextarea` reviewer notes (optional), footer Cancelar / "Confirmar aprobación|rechazo".
- **Client-side pagination**: `page`/`pageSize` (pageSize = shared `DEFAULT_TABLE_PAGE_SIZE = 10`), `paged = paginateRows(filteredRequests, clampPage(page, pageCount), pageSize)`, `showingFrom`/`showingTo`, `UPagination` (shown only when `pageCount > 1`). Watchers reset page on search change and clamp on queue shrink (post-review refetch).
- **Name resolution**: ONE cached `useQuery` (`employeesApi.listForPicker('')`, key `activeForPicker`, `staleTime: 60_000`, `retry: 1`) → `buildManagerMap` → `getEmployeeName`/`getEmployeeInitials`. **KNOWN LIMITATION (documented in-code)**: picker caps at `pageSize: 100` active employees — a queue owner beyond the first 100 active resolves to "—".

### 1.5 View mode

- **None.** No `ViewToggle`, no `usePendingApprovalsViewMode`, no `displayMode` bridge, no `#cards` slot, no `AppDataTable` at all. (Gold modules all have `useXViewMode` + `displayMode` + `#cards`.)

### 1.6 Tests (current coverage)

- `__tests__/s5-tray-reframe.spec.ts` (317 lines, pure helpers — no mount): `buildManagerMap` (3 cases), `filterPendingBySearch` (9 cases incl. ordering-preservation, unknown-id fallback), `resolveSickReason` (6 cases), `resolveDomainErrorMessage` (6 cases).
- `__tests__/wu11-timeoff-review-emergency-contacts.spec.ts`: `employeeTimeOffQueryKeys.pending` shape + per-tenant uniqueness; `employeesApi` spies for `reviewTimeOff` and `getPendingApprovals` (called with no args — backend reads JWT).
- `__tests__/wu12b-dashboard-views.spec.ts:283-288`: `getPendingApprovals` hits `/admin/employees-time-off/pending-approvals` with no query params (tenantId regression).
- `__tests__/foundation.spec.ts:174-177`: pending key shape (redundant).
- **Missing**: no `PendingApprovalsView` mount test; no error-surfacing spec; no pagination-reset spec (the `pageAfterQueryChange`/`clampPage` seams exist in `pagination.utils.ts` but are not exercised from this view); no view-mode/displayMode spec; no sort/column-visibility spec (table-only, currently N/A).

---

## 2. Gaps vs Gold Standard (Fase 2/3 parity)

| # | Gap | Severity | Notes |
|---|-----|----------|-------|
| G1 | **Not `AppDataTable`** — hand-rolled card list + custom `UInput` search + custom `UPagination` | **HIGH (the named goal)** | "isn't even a table" per handoff. Endpoint is full-array, so this must be client-side `AppDataTable` (Approach B), NOT `useServerTable`. |
| G2 | **Hardcoded error message** (vs `backendMessage > error.message > fallback` computed) | MED | `isError` is already destructured from `usePendingApprovals` but the message is inline. Gold modules derive from `error.response.data.message`. |
| G3 | **No ViewToggle / no table+cards hybrid** | MED | Card list is deliberate but is the ONLY mode; every gold module offers both. |
| G4 | **No column visibility** (`enable-column-visibility` + `enableHiding`) | MED | Table-only concern; requires a table view to exist first. |
| G5 | **No sorting** | LOW–MED | Client-side sort is feasible (full array in memory), but `AppDataTable` forces `manualSorting: true` — the view must own the sort computation. Currently N/A (no table). |
| G6 | **Search outside the toolbar** (`UInput` not `AppDataTable`'s `globalFilter`) | LOW | Search is name-resolved (employeeId→name), so it must stay a view-owned filter; it can be *bound* to `globalFilter` but cannot use the shared toolbar box verbatim without a name-resolution bridge. |
| G7 | **Name resolution `listForPicker` >100-cap** | LOW | Pre-existing, documented; unrelated to table mechanics but adjacent. |
| G8 | **No bulk approve/reject** | N/A (not a gap) | Deliberate — no backend batch-review endpoint; review is per-employee `POST /:employeeId/time-off/:timeOffId/review`. Bulk would be NEW backend work. |

---

## 3. Affected Areas

| Area | Why |
|------|-----|
| `src/features/admin/employees/views/PendingApprovalsView.vue` | Core change: adopt `AppDataTable` with client-side `:data` + manual `v-model:pagination`, move search to `globalFilter` (or keep name-resolved filter in `#filters`), add `ViewToggle` + `#cards` slot, add `enable-column-visibility` + `enableHiding`, error-message computed. |
| `src/features/admin/employees/composables/usePendingApprovals.ts` (NEW — split from `useReviewTimeOff.ts`) | Optional: extract the query into its own file for symmetry with `useExpiringDocuments.ts`; keep the full-array fetch (no `useServerTable`). |
| `src/features/admin/employees/composables/useReviewTimeOff.ts` | Keep `useReviewTimeOff` mutation as-is; possibly move `usePendingApprovals` out. No behavior change. |
| `src/features/admin/employees/composables/useEmployeeColumns.ts` | Add `formatTimeOffDateRange` reuse (already imported by the view) if a table needs a `Fechas`/`Días` cell; otherwise untouched. |
| NEW `usePendingApprovalsViewMode.ts` (or generic `useViewMode`) | Add `displayMode` bridge + type guard (mirrors `useEmployeeViewMode` / `useUserViewMode`). |
| NEW `PendingApprovalCard.vue` / grid (optional) | If the card list is refactored into the `#cards` slot as a reusable card component (currently inline in the view). |
| `src/core/shared/utils/pagination.utils.ts` | Header already names this endpoint as "full array, NO server pagination" — **no change needed** (stay client-side). |
| Tests: `s5-tray-reframe.spec.ts` (extend), NEW `PendingApprovalsView.test.ts` or pure sort/filter helper specs | Port/strip per Fase 2 WU-C precedent; add error-surfacing, pagination-reset, view-mode, and (if table) sort/column-visibility coverage. |

---

## 4. Approaches

### Approach A — Convert to a table ONLY (drop cards)

Render the queue as `AppDataTable` columns (`Colaborador`, `Tipo`, `Fechas`, `Días`, `Motivo`, `Estado`, `Solicitada`, `Acciones`) with per-row `#actions-cell` (Aprobar/Rechazar buttons), client-side pagination/search/column-visibility/error.

- Pros: literal "make it a table" handoff; consistent column-scanning; toolbar search/refresh/column-visibility for free.
- Cons: **deletes the deliberate card UX** (the view header comment explicitly chose "Card-based list for easy scanning"); loses the visual richness of type badges + date-range + reason in a compact card; table cells get cramped for reason text + date range + days + status all in one row; deviates from the gold-standard hybrid (no ViewToggle).
- Effort: **Medium**.

### Approach B — Keep cards ONLY (gold-standard polish, no table)

Keep the card list but bring it to gold-standard *visual* parity: hardcoded error → `backendMessage > error.message > fallback` computed; optional `AppDataTable` `#cards` slot + `displayMode: 'cards'` to reuse the shared toolbar/pagination/error; keep the name-resolved search as a view-owned filter.

- Pros: smallest diff; preserves the deliberate card UX; the queue is a time-sensitive tray where cards are arguably superior.
- Cons: **does not deliver the "standardize as a table" handoff**; no ViewToggle (deviates from the Fase 2 hybrid standard); leaves sorting/column-visibility permanently N/A.
- Effort: **Low**.

### Approach C — Hybrid: `ViewToggle` + `AppDataTable` (`#cards` slot + table view) — **recommended**

`AppDataTable` receives the client-side-sliced rows (`:data`, manual `v-model:pagination`, `v-model:global-filter` bound to a name-resolved filter) with `enable-column-visibility`, `:error`/`:error-message` computed, a `#filters` slot (if any filter beyond search), a table column set (via `usePendingApprovalsColumns` or inline), and the existing card markup moved into the `#cards` slot via `ViewToggle` + a new `usePendingApprovalsViewMode` (`displayMode` bridge). Per-row approve/reject lives in BOTH the table `#actions-cell` AND the card actions.

- Pros: matches the gold-standard hybrid exactly; preserves the deliberate card UX **and** adds a sortable/column-toggling table; reuses `AppDataTable`'s toolbar (search/refresh/column-visibility), pagination, and error block; per-row actions map to both modes with no affordance loss; no backend dependency.
- Cons: largest frontend diff of the three (new view-mode composable, new column defs, `#cards` extraction); the name-resolved search must be wired as a view-owned filter feeding `globalFilter` (the shared toolbar box is a raw string — the view applies `filterPendingBySearch`); client-side sort must be owned by the view (`manualSorting: true`).
- Effort: **Medium–High** (but still frontend-only, smaller than employees' `useServerTable` migration).

---

## 5. Recommendation

**Approach C — hybrid (ViewToggle + `AppDataTable` with `#cards` slot + client-side table).** This is the only outcome that satisfies the literal handoff ("decide whether to standardize it as a table or leave it as a card list") while honoring both the deliberate card UX and the Fase 2 gold-standard hybrid precedent. Concretely:

1. **Stay client-side** — the endpoint returns a full server-sorted array with no pagination/search/sort params (same documented contract as expiring-documents). Do **NOT** attempt `useServerTable`; use the client-side `AppDataTable` pattern (Fase 3 #2 Approach B): `:data="pagedRows"` + manual `v-model:pagination` bridged from the existing `paginateRows` slice.
2. **Preserve the card list as the `#cards` slot** (default view mode can stay `card`, given the tray's time-sensitive scanning nature — flag the default as a product decision in the proposal), and add a **table view** with columns `Colaborador / Tipo / Fechas / Días / Motivo / Estado / Acciones`, per-row Aprobar/Rechazar in `#actions-cell`, and `enable-column-visibility`.
3. **Wire the name-resolved search into the toolbar** — bind `globalFilter` to `searchQuery` and keep `filterPendingBySearch` as the view-owned filter (the shared box is a raw string; `AppDataTable` does not filter client-side). This is the one place the view deviates from a naive "search box just works" assumption.
4. **Fix the error message** to the `backendMessage > error.message > fallback` computed (G2), surfacing via `AppDataTable`'s `:error`/`:error-message` (which also covers the `#cards` branch per its built-in error block).
5. **Descope bulk approve/reject** — there is no backend batch-review endpoint (review is per-employee). `AppDataTable` *can* do `bulkActions` + `enableRowSelection`, but wiring it would require N sequential mutations plus a backend batch route. State it explicitly out of scope.

If the team judges the tray is too small/time-sensitive to warrant a table at all, **Approach B (keep cards, gold-standard polish)** is the acceptable fallback — but it should be an explicit product decision, not a default.

---

## 6. Risks

1. **`AppDataTable` forces `manualSorting: true`** — even for client-side sorting, the view must own the sort computation; enabling `enableSorting: true` on a column does NOT sort for it. Same trap as Fase 3 #2 risk #2.
2. **Name-resolved search is a view-owned filter** — the shared toolbar search box is a raw string and `AppDataTable` does no client-side filtering; an implementer who assumes `globalFilter` "just works" will silently break the `employeeId → name` resolution (search must keep going through `filterPendingBySearch`).
3. **Card default vs table default** — the gold standard defaults to `table`, but this tray was deliberately cards. The proposal must pick a default (recommend `card`) and it must be persisted in `localStorage` via a new storage key.
4. **`refetchOnWindowFocus: true` is deliberate** — a naive "mirror employees view" rewrite could flip it to `false` (employees/expiring both use `false`); approvals are time-sensitive and must keep `true`.
5. **No bulk review endpoint** — any future bulk approve/reject is blocked on backend work; do not scaffold `bulkActions` now.
6. **`listForPicker` >100-cap name-resolution ceiling** — unrelated to table mechanics but adjacent; any rewrite must not regress or silently drop the documented limitation.
7. **Test surface** — `s5-tray-reframe.spec.ts` pins the pure helpers (filter/format/map); a view refactor must preserve those seams and add view-level coverage (error, pagination-reset, view-mode) per the Fase 2 WU-C precedent, not just add new specs.
8. **Sibling precedent** — this is the third and last Fase 3 candidate; the expiring-documents decision (client-side vs server-side, pending backend) sets the pattern. If the backend later paginates `/expiring`, it may prompt a symmetric question for `/pending-approvals` — surface that to the backend team together.

---

## 7. Open Questions (backend team — frontend code evidence only)

1. **Does `GET /admin/employees-time-off/pending-approvals` support (or will it add) server-side pagination / `search` / `sortBy`/`sortOrder`?** Frontend sends no params and treats the response as a full server-sorted array. (Identical to Fase 3 #2 Open Question #1 — worth asking both endpoints in one message.)
2. **Is there (or will there be) a batch review endpoint** (e.g. `POST /admin/employees-time-off/review-batch`)? Today review is per-employee `POST /admin/employees/:employeeId/time-off/:timeOffId/review`. This gates any future bulk approve/reject.
3. **Can the pending payload inline a resolved `employeeName` (server-side join)?** The frontend resolves names via a cached `listForPicker` capped at 100 active employees — requests owned by employees beyond the first 100 active resolve to "—". Inlining the name would remove the cap.

---

## 8. Ready for Proposal

**Yes** — the frontend state, gold-standard deltas, and the table-vs-cards decision are fully mapped with no hard blocker. The proposal must: (1) pick **Approach C (hybrid)** vs the **Approach B (cards-only)** fallback as an explicit product decision, (2) decide the **default view mode** (recommend `card` for the tray), (3) keep `refetchOnWindowFocus: true` and the client-side full-array pagination as deliberate, (4) state **bulk approve/reject as out of scope** (no backend batch endpoint), and (5) carry the three backend questions forward (grouping #1 with the pending expiring-documents question).
