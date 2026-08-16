# Admin Expiring Documents Specification

Domain: `admin-expiring-documents` · `ExpiringDocumentsView.vue` ("Documentos por vencer"): `useServerTable` server-side pagination/search/sort with `selectedThreshold` (30/60/90) closure; column visibility (4 hideable, `documento` anchor); toolbar search ≥2 chars; expiry selector in `#filters` slot; server-resolved `fullName` (no `listForPicker`); error `backendMessage > error.message > "No se pudieron cargar los documentos. Intenta de nuevo."`; no card view, no `ViewToggle`/`displayMode`, no `EmployeeDocument` core change, no backend change. Whole capability is `ADDED` (original view pre-dates the spec system).

## Purpose

Migrate `ExpiringDocumentsView.vue` from client-side pagination of the full server-sorted array (`paginateRows` + hand-rolled `page`/`pageSize`, `show-toolbar="false"`, all 5 columns `enableSorting:false`) to true server-side via `useServerTable` (Approach A, mirroring Fase 3 #1). Expiry-window selector moves to `#filters`; `listForPicker` name-resolution drops in favor of server `fullName`. Card view stays out. Adapter maps `{ data, meta: { total, page, limit, totalPages } }` to `PaginatedResponse<ExpiringDocumentItem>` where `ExpiringDocumentItem = EmployeeDocument & { fullName; employeeNumber }`. No backend change.

## Requirements

### REQ-1: `useServerTable` migration with `selectedThreshold` closure

`useExpiringDocuments` SHALL compose `useServerTable<ExpiringDocumentRow>` with `selectedThreshold` (`30|60|90`, default `30`) closing `queryKey`/`queryFn`. Shared `useServerTable` SHALL NOT be modified. No hand-rolled `page`/`pageSize`/`paginateRows` SHALL remain in the view. `defaultSorting: [{ id: 'vencimiento', desc: false }]`, `defaultPageSize: 10`, `pageSizeOptions: [10, 20, 50]`, `persistKey: 'admin-expiring-documents'`, `urlSync: false`, `staleTime: 30_000`, `refetchOnWindowFocus: false`.

#### Scenario: pagination round-trips via composable

- GIVEN the view is mounted
- WHEN `pageIndex` or `pageSize` changes
- THEN the request fires with `page = pageIndex+1` and `limit = pageSize`
- AND no `paginateRows` slice runs

#### Scenario: threshold change refetches and resets page

- GIVEN `selectedThreshold=60` and `pageIndex=3`
- WHEN `selectedThreshold` becomes `30`
- THEN the request fires with `daysUntilExpiry=30` and `page=1`
- AND `pageIndex` resets to 0

### REQ-2: Server-side sorting whitelist

`enableSorting: true` SHALL be set. `EXPIRING_DOCUMENTS_SORT_MAP` SHALL whitelist Spanish id → English `sortBy`: `vencimiento`/`restante`→`expiresAt`, `categoria`→`category`, `colaborador`→`employeeName`. `documento` SHALL stay `enableSorting: false` (no `createdAt`/`title`/`notes` column maps cleanly). Empty `sorting` SHALL omit `sortBy`/`sortOrder`.

#### Scenario: default `expiresAt asc` on first load

- GIVEN no user sorting interaction
- WHEN the first request fires
- THEN `sortBy=expiresAt&sortOrder=asc` rides on the URL

#### Scenario: sortable column header click

- GIVEN the user clicks `vencimiento`, `restante`, `categoria`, or `colaborador`
- WHEN the request fires
- THEN `sortBy` matches `expiresAt`/`category`/`employeeName` and `sortOrder` matches the header direction

#### Scenario: `documento` non-sortable

- GIVEN the table renders
- WHEN the user interacts with the `documento` header
- THEN no sort indicator appears and the request never carries a `documento`-derived `sortBy`

### REQ-3: Toolbar search ≥2 chars

`show-toolbar="true"` SHALL be set. `globalFilter` SHALL map to `search`. `search` SHALL be omitted when length `< 2`. A backend `SEARCH_QUERY_TOO_SHORT` rejection SHALL surface through the error block.

#### Scenario: empty / 1-char input omits search

- GIVEN the user types "" or "a"
- WHEN the debounce settles
- THEN `search` is omitted from the URL

#### Scenario: 2+ chars passes through; TOO_SHORT surfaces via error block

- GIVEN the user types "jo"
- WHEN the debounce settles
- THEN `search=jo` rides on the URL
- AND on a `SEARCH_QUERY_TOO_SHORT` rejection the error block renders, never the empty placeholder

### REQ-4: Column visibility (4 hideable, `documento` anchor)

`enable-column-visibility` SHALL be set. `categoria, colaborador, vencimiento, restante` SHALL set `enableHiding: true`. `documento` SHALL set `enableHiding: false`.

#### Scenario: dropdown lists four data columns; anchor survives all-four-hidden

- GIVEN the toolbar renders
- WHEN the user opens the visibility dropdown
- THEN each of the four data columns toggles independently and `documento` is not listed
- AND when all four data columns are hidden only `documento` remains visible

### REQ-5: Error precedence + retry + empty-vs-failed

`ExpiringDocumentsView` SHALL destructure `isError`/`error`, compute `documentsErrorMessage`, pass `:error` + `:error-message` to `AppDataTable`. Precedence SHALL be `response.data.message` (string or first array element) → `error.message` → `"No se pudieron cargar los documentos. Intenta de nuevo."`. The empty placeholder SHALL render only on empty success.

#### Scenario: failed request renders error block + retry

- GIVEN the request fails
- WHEN `AppDataTable` renders
- THEN the error block renders with the resolved message and a retry control
- AND the empty placeholder does NOT render
- AND clicking retry emits `refresh` and re-runs the request

#### Scenario: empty success vs failed empty (and message precedence)

- GIVEN the request succeeds with zero rows
- THEN the empty placeholder renders and on a failed request the error block renders instead — never the empty placeholder
- AND `response.data.message` (string or first array element) wins over `error.message` and the fallback

### REQ-6: Adapter `mapExpiringDocumentsPaginated`

`getExpiringDocumentsPaginated(ServerTableParams, daysUntilExpiry)` SHALL build `{ daysUntilExpiry, page = pageIndex+1, limit = pageSize (max 100), search? (≥2), sortBy?, sortOrder? }`. `mapExpiringDocumentsPaginated` SHALL read `{ data, meta: { total, page, limit, totalPages } }` and return a `PaginatedResponse<ExpiringDocumentItem>`. `ExpiringDocumentItem` SHALL extend `EmployeeDocument` with `fullName` + `employeeNumber`. `EmployeeDocument` SHALL NOT change.

#### Scenario: adapter maps `{ data, meta }`

- GIVEN the backend returns `{ data, meta: { total, page, limit, totalPages } }`
- WHEN `mapExpiringDocumentsPaginated` runs
- THEN it returns `{ data, pageCount, total }`

#### Scenario: 0-based pageIndex becomes 1-based page; limit clamps at 100

- GIVEN `pageIndex = 2, pageSize = 250`
- WHEN the adapter builds the URL
- THEN the request carries `page=3` and `limit=100`

### REQ-7: Expiry-window selector in `#filters` slot

The 30/60/90 `USelect` SHALL render in `AppDataTable`'s `#filters` slot. Selecting a value SHALL update `selectedThreshold`, refetch with new `daysUntilExpiry`, and reset `pageIndex` to 0. The selector SHALL NOT live in `AdminPageHeader`.

#### Scenario: selector refetches on change and resets page

- GIVEN the user picks `60`
- WHEN the change commits
- THEN `selectedThreshold = 60` and `daysUntilExpiry=60` rides on the URL
- AND `pageIndex` resets to 0
- AND no `USelect` exists in `AdminPageHeader` (one exists inside `#filters`)

### REQ-8: Server-resolved employee name (no `listForPicker`)

`colaborador` SHALL render `fullName` from `ExpiringDocumentItem`. Avatar seed SHALL stay `employeeId`. `listForPicker` / `buildManagerMap` / `resolveManagerName` SHALL be REMOVED. The `>100`-cap SHALL NOT apply.

#### Scenario: colaborador renders server fullName and no name-resolution query fires

- GIVEN a row with `fullName = "Ana López"`
- WHEN the cell renders
- THEN the cell text is "Ana López" and the avatar seed remains `employeeId`
- AND no `employeesApi.listForPicker` call fires from this view
- AND every `colaborador` resolves to its `fullName` (no `"—"` fallback beyond the first 100)

### REQ-9: Preserved invariants (no regressions, no card view)

`AdminPageHeader` + `UCard` shell, `formatDaysRemaining` / `computeExpiringDocumentRow` / `formatTimeOffDate` signatures, and category / days-remaining badge helpers SHALL be preserved. `pagination.utils.ts` header SHALL remove `/expiring` from the "full array, NO server pagination" comment and keep the `/pending-approvals` line unchanged. No `EmployeeDocument` core type change, no backend change, no `ViewToggle` / `displayMode` / `useExpiringDocumentsViewMode` / `ExpiringDocumentCard` SHALL be introduced.

#### Scenario: shell and helpers preserved

- GIVEN the standardized view renders
- THEN `AdminPageHeader` and `UCard` continue to render around the table
- AND `formatDaysRemaining` / `computeExpiringDocumentRow` / `formatTimeOffDate` exports keep their existing signatures

#### Scenario: no card view / view-mode composable / core-type change / backend change

- GIVEN the change ships
- THEN no `ViewToggle` / `displayMode` / `useExpiringDocumentsViewMode` / `ExpiringDocumentCard` exists for this view
- AND `EmployeeDocument` keeps its existing fields (no additions/removals)
- AND the backend contract for `/admin/employees-documents/expiring` is unchanged from the frontend's perspective
- AND `pagination.utils.ts` no longer lists `/expiring` as a "full array" endpoint (the `/pending-approvals` line unchanged)
