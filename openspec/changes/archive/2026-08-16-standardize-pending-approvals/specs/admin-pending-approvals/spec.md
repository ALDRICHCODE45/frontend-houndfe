# Admin Pending Approvals Specification

Domain: `admin-pending-approvals` · POS admin tenant-wide pending time-off tray ("Validaciones pendientes"): client-side `AppDataTable` over the full server-sorted array (NO `useServerTable`); `ViewToggle` + `#cards` slot + `displayMode` bridge persisted in `localStorage` under `pending-approvals-view-mode` defaulting to `card`; 8 table columns (`Colaborador/Tipo/Fechas/Días/Motivo/Estado/Solicitada/Acciones`) with `enable-column-visibility` on the 7 data columns (non-hideable `acciones`); per-row Aprobar/Rechazar in `#actions-cell` (CASL `canReview` + `UModal` confirmation); name-resolved search via `filterPendingBySearch` bound to `globalFilter`; surfaced backend errors (`backendMessage > error.message > fallback`); preserved `refetchOnWindowFocus: true` and client-side full-array pagination; documented `listForPicker` >100-active-cap limitation. The original `PendingApprovalsView` pre-dates the spec system, so the whole capability is `ADDED` (no `MODIFIED` block). Auth, `AdminPageHeader`, `AppDataTable` internals, `useReviewTimeOff` internals, the name-resolution `listForPicker` cache, and backend changes are not duplicated here. Employee detail, ausencias panel, and upsert slideovers are governed elsewhere.

## Purpose

Bring `PendingApprovalsView.vue` to Fase 3 parity with the Fase 2 gold-standard hybrid (table + cards via `ViewToggle`): migrate the hand-rolled `UInput`/`UPagination`/card-list to `AppDataTable` in **client-side** mode (the endpoint `GET /admin/employees-time-off/pending-approvals` returns the full server-sorted array with NO pagination/search/sort params — `useServerTable` is NOT a fit); preserve the deliberate card tray UX as the **default view mode**; fix the hardcoded error to a `backendMessage > error.message > fallback` computed surfaced via `AppDataTable`'s `:error`/`:error-message` (covers BOTH `#cards` and table); add column visibility; route per-row Aprobar/Rechazar through `#actions-cell` AND card affordances (both CASL-gated + `UModal`); bind name-resolved search to `globalFilter`. Keep `refetchOnWindowFocus: true` and client-side pagination UNCHANGED. Bulk approve/reject out of scope (no backend batch endpoint). No `TimeOffRequest` type change, no new route, no backend change; `useReviewTimeOff` and `pagination.utils.ts` header stay untouched.

## Requirements

### REQ-1: Client-side `AppDataTable` over the full server-sorted array

`PendingApprovalsView` SHALL render `AppDataTable` with `:data="pagedRows"` (1-based `page` ref + `paginateRows` slice from `pagination.utils.ts`) and a manual `v-model:pagination` bridge between `AppDataTable`'s 0-based `{ pageIndex, pageSize }` and the view's 1-based `page`. Page size SHALL be the shared `DEFAULT_TABLE_PAGE_SIZE = 10`. The view SHALL NOT use `useServerTable` (the endpoint returns a flat array, not `PaginatedResponse`). `usePendingApprovals` query SHALL keep `refetchOnWindowFocus: true` and `staleTime: 30_000`.

#### Scenario: client-side pagination drives AppDataTable

- GIVEN the queue has 25 rows and `page = 3`, `pageSize = 10`
- WHEN `AppDataTable` renders
- THEN `:data` receives the 3rd slice (rows 21–25)
- AND the pagination component reflects `pageIndex: 2`

#### Scenario: page resets to 1 on search change

- GIVEN `searchQuery` changes from "" to "juan"
- WHEN the watcher fires
- THEN `page` becomes `FIRST_PAGE` (`pageAfterQueryChange`)
- AND the next slice recomputes from the new filtered set

#### Scenario: page clamps when the queue shrinks

- GIVEN `page = 5` and a successful review refetch drops the queue below the current page
- WHEN `paged.pageCount` updates
- THEN `clampPage` resets `page` to a valid page
- AND no infinite watcher loop fires (idempotent)

#### Scenario: no useServerTable, full-array endpoint

- GIVEN the standardized view renders
- WHEN the diff is reviewed
- THEN `useServerTable` is NOT imported in this view
- AND `usePendingApprovals` keeps `refetchOnWindowFocus: true`

### REQ-2: View mode hybrid with `displayMode` bridge (default `card`)

`usePendingApprovalsViewMode` SHALL wrap `useViewMode` (key `pending-approvals-view-mode`, modes `['table','card']`, default `card`), expose `isPendingApprovalsViewMode`, and return `{ viewMode, setMode, toggleViewMode, displayMode }` bridging `card`→`cards`. `PendingApprovalsView` SHALL render `ViewToggle` in `AppDataTable`'s `#actions` slot, pass `:display-mode="displayMode"`, and move the existing card markup into the `#cards` slot. The choice SHALL persist across reloads via `localStorage`; an invalid stored value SHALL fall back to `card`.

#### Scenario: card is the default on first load

- GIVEN no `pending-approvals-view-mode` in `localStorage`
- WHEN the view mounts
- THEN `viewMode` is `card`
- AND `displayMode` is `cards`
- AND the `#cards` slot renders

#### Scenario: toggle to table

- GIVEN card mode active
- WHEN the user clicks "Tabla" in `ViewToggle`
- THEN `viewMode` becomes `table`
- AND `displayMode` is `table`
- AND the table renders with the 8 columns

#### Scenario: persistence across reload

- GIVEN the user selected table
- WHEN the page reloads
- THEN `viewMode` is `table` from `localStorage`

#### Scenario: invalid stored value falls back

- GIVEN `localStorage["pending-approvals-view-mode"]` is "kanban" (invalid)
- WHEN the view loads
- THEN `viewMode` is `card`

### REQ-3: Table columns, `#actions-cell` per-row review, column visibility

`usePendingApprovalsColumns` (or inline column defs) SHALL define 8 columns in order: `colaborador, tipo, fechas, dias, motivo, estado, solicitada, acciones`. The 7 data columns SHALL set `enableHiding: true`; `acciones` SHALL set `enableHiding: false` and SHALL be right-pinned. `AppDataTable` SHALL receive `enable-column-visibility`. Per-row Aprobar/Rechazar buttons SHALL render in the `#acciones-cell` slot, gated by CASL `canReview` (`update:EmployeeTimeOff`), disabled while `isReviewing`, and routed through the `UModal` confirmation dialog ("Aprobar solicitud de ausencia" / "Rechazar solicitud de ausencia") with optional reviewer notes.

#### Scenario: table renders the 8 columns

- GIVEN the table view is active
- WHEN `AppDataTable` renders
- THEN the columns appear in order `colaborador, tipo, fechas, dias, motivo, estado, solicitada, acciones`

#### Scenario: column-visibility dropdown lists 7 data columns

- GIVEN the toolbar renders
- WHEN the user opens the visibility dropdown
- THEN `colaborador/tipo/fechas/dias/motivo/estado/solicitada` toggle independently
- AND `acciones` is NOT listed (non-hideable)

#### Scenario: per-row approve opens confirmation dialog

- GIVEN a row and `canReview` is true
- WHEN the user clicks "Aprobar"
- THEN the `UModal` opens with title "Aprobar solicitud de ausencia"
- AND Confirmar/Cancelar buttons render with `isReviewing` disabled

#### Scenario: per-row reject routes to dialog with reject copy

- GIVEN a row and `canReview` is true
- WHEN the user clicks "Rechazar"
- THEN the `UModal` opens with title "Rechazar solicitud de ausencia"
- AND the notes placeholder reads "Motivo del rechazo..."

#### Scenario: canReview false hides actions

- GIVEN `canReview` is false (no `update:EmployeeTimeOff`)
- WHEN the row renders
- THEN no Aprobar/Rechazar buttons render in `#acciones-cell`
- AND no card actions render in the `#cards` slot either

### REQ-4: Name-resolved client-side search bound to `globalFilter`

`PendingApprovalsView` SHALL bind `searchQuery` to `AppDataTable`'s `v-model:global-filter`. The actual filtering SHALL run view-owned through `filterPendingBySearch(pendingRequests, employeeMap, searchQuery)` (employeeId→resolved name). The "N de M total" summary line SHALL render below the search input. A "no matches" sub-state SHALL render when the filter yields zero rows but the underlying queue is non-empty.

#### Scenario: search filters by resolved employee name

- GIVEN the search box contains "maría"
- WHEN the view computes `filteredRequests`
- THEN only requests whose `employeeMap[employeeId].fullName` matches "maría" remain
- AND the toolbar search box shows "maría" (mirrored from `globalFilter`)

#### Scenario: no-match sub-state when search empties results

- GIVEN the search query has no matches
- WHEN the view renders
- THEN the "No hay coincidencias para «…»" block renders
- AND the empty placeholder ("Sin solicitudes pendientes") does NOT render

#### Scenario: summary line "N de M total"

- GIVEN search is active and the queue has 25 rows total but 7 match
- WHEN the summary renders
- THEN it reads "7 solicitudes pendientes (de 25 en total)"

#### Scenario: empty queue summary

- GIVEN the queue is empty (zero pending requests)
- WHEN the view renders
- THEN the "Sin solicitudes pendientes" empty placeholder renders
- AND no search or summary line renders

### REQ-5: Backend error surfacing with `backendMessage > error.message > fallback`

`PendingApprovalsView` SHALL destructure `isError`/`error` from `usePendingApprovals`, compute `pendingErrorMessage` (preference: `error.response.data.message` as string OR first element if array → `error.message` → "No se pudieron cargar las solicitudes pendientes. Intenta de nuevo."), and pass `:error="isError"` + `:error-message="pendingErrorMessage"` to `AppDataTable`. The error block MUST render in BOTH the table and `#cards` branches (via `AppDataTable`'s built-in `table-error-state` / `cards-error-state`). Clicking retry SHALL call `refetch()`.

#### Scenario: failed request renders error block in table mode

- GIVEN `isError` is true and table mode active
- WHEN `AppDataTable` renders
- THEN the `table-error-state` block shows the error message
- AND the empty placeholder is NOT rendered

#### Scenario: failed request renders error block in cards mode

- GIVEN `isError` is true and card mode active
- WHEN `AppDataTable` renders
- THEN the `cards-error-state` block shows the error message
- AND the `#cards` slot is NOT rendered

#### Scenario: retry re-runs the request

- GIVEN the error block is visible
- WHEN the user clicks "Reintentar"
- THEN `refetch()` fires
- AND the next render reflects the new state (table/cards/error)

#### Scenario: message precedence

- GIVEN `error.response.data.message` exists as a string
- THEN it wins over `error.message` and the fallback
- GIVEN `error.response.data.message` exists as an array
- THEN its first element wins over `error.message` and the fallback
- GIVEN neither exists
- THEN the fallback "No se pudieron cargar las solicitudes pendientes. Intenta de nuevo." renders

### REQ-6: Approve / Reject flow (mutation invalidation preserved)

Approving or rejecting SHALL call `useReviewTimeOff(employeeId)`'s `submitReview({ timeOffId, dto })`. The mutation SHALL keep its current invalidations (`employeeTimeOffQueryKeys.pending`, `employeeTimeOffQueryKeys.list`, `employeeTimeOffQueryKeys.balance`) and toast ("Ausencia aprobada" / "Ausencia rechazada"). On error it SHALL keep routing through `normalizeApiError` + `resolveDomainErrorMessage` (e.g. 409 `TIME_OFF_INVALID_TRANSITION` → voseo toast). The `UModal` SHALL close on success and `reviewingRequest` SHALL reset.

#### Scenario: confirm approve fires mutation and invalidates

- GIVEN the dialog is open with `decision: APPROVED`
- WHEN the user clicks "Confirmar aprobación"
- THEN `submitReview` fires
- AND on success the pending tray refetches (the approved row disappears)
- AND "Ausencia aprobada" toast renders
- AND the dialog closes

#### Scenario: confirm reject fires mutation

- GIVEN the dialog is open with `decision: REJECTED`
- WHEN the user clicks "Confirmar rechazo"
- THEN `submitReview` fires
- AND on success "Ausencia rechazada" toast renders
- AND the dialog closes

#### Scenario: invalid transition surfaces voseo error

- GIVEN the backend responds 409 `TIME_OFF_INVALID_TRANSITION`
- WHEN the mutation fails
- THEN the error toast renders the voseo domain message (not a generic)
- AND the dialog stays open so the user can retry/cancel

#### Scenario: cancel closes the dialog without firing

- GIVEN the dialog is open
- WHEN the user clicks "Cancelar"
- THEN `submitReview` does NOT fire
- AND `reviewingRequest`, `reviewDecision`, `reviewerNotes` reset

### REQ-7: Bulk approve/reject OUT OF SCOPE

`PendingApprovalsView` SHALL NOT scaffold `bulkActions` or `enableRowSelection` on `AppDataTable`. There is no backend batch-review endpoint; review stays per-employee `POST /admin/employees/:employeeId/time-off/:timeOffId/review`. No checkbox column SHALL render on the table; no bulk-action bar SHALL appear.

#### Scenario: no bulk-action surface

- GIVEN the standardized view renders
- WHEN the diff is reviewed
- THEN `bulkActions` is not wired and `enableRowSelection` is false
- AND no checkbox column or bulk-action bar renders

### REQ-8: Preserved invariants (no regressions)

`PendingApprovalsView` SHALL preserve: `refetchOnWindowFocus: true` (time-sensitive tray MUST NOT flip), client-side full-array pagination via `paginateRows`/`clampPage`/`pageAfterQueryChange`, the documented `listForPicker` >100-active-cap name-resolution ceiling (no attempt to silently "fix"), card affordances (Aprobar/Rechazar CASL-gated + `UModal` confirmation + `isReviewing` disable), the per-employee `POST /:employeeId/time-off/:timeOffId/review` route, and the `pagination.utils.ts` header comment naming this endpoint. `useReviewTimeOff` internals SHALL NOT change. No `TimeOffRequest` field add/remove, no new route registration, no backend change.

#### Scenario: refetchOnWindowFocus preserved

- GIVEN the standardized query options are configured
- WHEN the diff is reviewed
- THEN `refetchOnWindowFocus: true` is set (NOT `false`)
- AND `staleTime: 30_000` is preserved

#### Scenario: listForPicker >100-cap documented limitation preserved

- GIVEN the name-resolution `useQuery` uses `employeesApi.listForPicker('')`
- WHEN the diff is reviewed
- THEN the >100-active-cap limitation is still documented in-code
- AND no silent attempt to replace it with a per-row `getById`

#### Scenario: no type, route, or backend change

- GIVEN the change ships
- THEN no `TimeOffRequest` field is added/removed
- AND no new route is registered
- AND `useReviewTimeOff` and `pagination.utils.ts` are unchanged in the diff