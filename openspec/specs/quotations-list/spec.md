# Quotations List Specification

Domain: `quotations-list` · POS quotations list view behavior, advanced filters,
URL persistence, column visibility, global search, and the UCard header-color
split. Cross-repo behavior covers the additive `GET /quotations` query contract
on the backend. The quotations detail view, quotation deletion flow, sales
module, and PDF generation are governed by other capabilities and are not
duplicated here.

## Purpose

Bring the quotations list to parity with the platform's "table identity":
working global search (which was silently broken before this change), a
multi-select advanced-filter slideover with active chips (status, customer,
date ranges, total range), URL-persisted filter state, column visibility, and
the UCard header-color split. Cross-repo, the backend's `GET /quotations`
endpoint gains 5 additive query params (`search`, multi-`status`, multi-`customerId`,
`expiresFrom`/`expiresTo`, `minTotalCents`/`maxTotalCents`) so the new FE filters
round-trip through the wire. Behavior of the detail view, the sales module,
PDF, and the shared table/filter component APIs is unchanged.

## Requirements

### REQ-1: `GET /quotations` `search` param (customer name)

The backend SHALL accept `search?: string` on `GET /quotations` (DTO → `QuotationFindAllInput`/`QuotationFindAllQuery` → repository). Semantics: trimmed; empty after trim = no filter; case-insensitive `contains` on `customer.firstName` OR `customer.lastName`. Customer `id`/`folio` search is deferred.

#### Scenario: matches either name part
- GIVEN quotations for customers "Juan Perez" and "Maria Lopez"
- WHEN `GET /quotations?search=perez`
- THEN only the Juan Perez quotation returns.

#### Scenario: case-insensitive
- GIVEN a customer "juan perez"
- WHEN `GET /quotations?search=JUAN`
- THEN the row matches.

#### Scenario: empty/whitespace ignored
- GIVEN `search=` or `search=%20%20`
- WHEN the list is fetched
- THEN no search filter is applied (all rows per remaining filters).

### REQ-2: multi-`status` filter (OR)

`status` SHALL accept a comma-separated CSV string or a repeated array, normalized to `QuotationStatus[]`; values MUST validate against the enum (`DRAFT | SENT | EXPIRED | CANCELLED`); OR semantics within the set; empty/absent = no filter (NOT a 400).

#### Scenario: CSV multi-select
- GIVEN `?status=DRAFT,SENT`
- WHEN fetched
- THEN rows match DRAFT OR SENT.

#### Scenario: single value keeps working
- GIVEN `?status=EXPIRED`
- WHEN fetched
- THEN only EXPIRED rows return (unchanged legacy path).

#### Scenario: empty CSV
- GIVEN `?status=`
- WHEN fetched
- THEN no status filter is applied.

#### Scenario: invalid enum value
- GIVEN `?status=DRAFT,FOO`
- WHEN fetched
- THEN 400 with a message naming the invalid value.

### REQ-3: multi-`customerId` filter (OR)

`customerId` SHALL accept CSV or repeated array of UUIDs, normalized to `string[]`; OR semantics; each element MUST be a valid UUID; empty/absent = no filter.

#### Scenario: CSV multi-customer
- GIVEN `?customerId=u1,u2`
- WHEN fetched
- THEN rows for u1 OR u2 return.

#### Scenario: invalid UUID
- GIVEN `?customerId=u1,not-a-uuid`
- WHEN fetched
- THEN 400 with a clear message.

### REQ-4: `expiresFrom` / `expiresTo` range (inclusive)

SHALL accept ISO dates on `expiresAt`, inclusive `gte`/`lte`; partial ranges allowed (from-only or to-only); absent/invalid-date values: absent = no filter, invalid = 400.

#### Scenario: bounded range
- GIVEN `?expiresFrom=2026-01-01&expiresTo=2026-01-31`
- WHEN fetched
- THEN rows whose `expiresAt` falls inclusively inside return.

#### Scenario: from-only
- GIVEN `?expiresFrom=2026-06-01`
- WHEN fetched
- THEN rows expiring on/after that date return.

#### Scenario: invalid date
- GIVEN `?expiresTo=not-a-date`
- WHEN fetched
- THEN 400.

### REQ-5: `minTotalCents` / `maxTotalCents` range

SHALL accept non-negative integers (`@IsInt` + `@Min(0)`); inclusive `gte`/`lte` on `totalCents`; `min ≤ max` MUST be validated (400 with clear message otherwise); `0` MUST be accepted (no 400).

#### Scenario: bounded range
- GIVEN `?minTotalCents=1000&maxTotalCents=5000`
- WHEN fetched
- THEN rows with total in [1000, 5000] return.

#### Scenario: min > max rejected
- GIVEN `?minTotalCents=5000&maxTotalCents=1000`
- WHEN fetched
- THEN 400 explaining the constraint.

#### Scenario: zero lower bound
- GIVEN `?minTotalCents=0`
- WHEN fetched
- THEN 200 and all totals qualify (no error).

### REQ-6: backward compatibility of the existing query contract

Existing single `status`, single `customerId`, `createdFrom`/`createdTo`, `page`/`limit`, `sortBy`/`sortOrder` MUST behave exactly as today. FE `QuotationListParams` types SHALL be widened (single | CSV string | array) without changing emitted URLs for legacy single-value usage.

#### Scenario: legacy requests unchanged
- GIVEN a request with only `page=2&limit=10&status=DRAFT&customerId=u1&createdFrom=...`
- WHEN fetched
- THEN identical results to the pre-change backend.

#### Scenario: defaults preserved
- GIVEN no query params
- THEN page=1, limit=20, sort `createdAt desc` apply as today.

### REQ-7: combined filters AND across groups + pagination stability

All active filter groups SHALL AND together (search × status × customerId × created × expires × total). `findMany` and `count` MUST share the same combined `where`, so `total`/`totalPages` reflect the filtered set; page beyond range returns empty `data`.

#### Scenario: full combo
- GIVEN `search=juan&status=DRAFT,SENT&customerId=u1&expiresFrom=2026-01-01&minTotalCents=1000`
- WHEN fetched
- THEN only rows satisfying every group return.

#### Scenario: no rows
- GIVEN filters matching nothing on page 3
- THEN 200, `data: []`, pagination with filtered `total` and `totalPages`.

#### Scenario: count parity
- GIVEN a filtered query
- THEN `pagination.total` equals the number of returned-plus-remainder rows (same where).

### REQ-8: validation errors (400, clear message)

Every DTO validation failure (bad enum, bad UUID, bad date, negative/`min>max` total) MUST return HTTP 400 with a message identifying the offending param; unknown/unsupported params MUST be ignored (NestJS DTO drop — never 500).

#### Scenario: bad param identified
- GIVEN `?status=FOO`
- WHEN fetched
- THEN 400 whose message references `status`.

#### Scenario: unsupported param ignored
- GIVEN `?taxRate=0.16` (future param)
- WHEN fetched
- THEN 200 — the param is dropped, no error.

### REQ-9: header-color split chrome (Sales pattern)

`QuotationsListView` SHALL render `<UCard :ui="{ body: 'p-0 sm:p-0 bg-coco-neutral-50 dark:bg-coco-neutral-950' }">` with `<TableHeaderDescription title="Cotizaciones" ...>` in the `#header` slot. The `.quotations-list-view` class and `data-testid="quotations-list-view"` MUST remain on the card root so the `coco-quotations` token scope (`--coco-primary`) still resolves.

#### Scenario: split rendered
- GIVEN the list route renders
- THEN the header area keeps UCard default bg while the body zone renders `bg-coco-neutral-50` (light) / `bg-coco-neutral-950` (dark).

#### Scenario: token scope preserved
- GIVEN the view renders
- THEN `new-quotation-button` (data-testid) still resolves `--coco-primary` via `.quotations-list-view` ancestry.

### REQ-10: status tabs + Filtros slideover + chips

The visible status tabs (Todos/Borradores/Enviadas/Expiradas/Canceladas, `data-testid="status-tabs"`) SHALL remain functional as quick access. A `DataTableFilters` slideover (`data-testid="filters-trigger"` + count badge) with active chips (`data-testid="filters-chips"`) SHALL coexist. Status is a single source of truth over one `status` param: the slideover multi-status selection SHALL take precedence over the tab (Sales `resolveDeliveryStatus` rule); selecting a tab SHALL clear the slideover status selection; changing either SHALL reset page to 1.

#### Scenario: tab quick filter
- GIVEN the cashier clicks `Enviadas`
- THEN the request carries `status=SENT` and the tab shows selected.

#### Scenario: slideover wins
- GIVEN slideover selects `DRAFT,SENT`
- WHEN the tab bar renders
- THEN no tab shows selected and the request carries `status=DRAFT,SENT`.

#### Scenario: tab clears slideover
- GIVEN slideover statuses set
- WHEN `Borradores` is clicked
- THEN status becomes `DRAFT` (slideover status cleared).

#### Scenario: chips reflect filters
- GIVEN statuses/customer/range set
- THEN `filters-chips` shows one chip per active filter with `chip-clear-{filterId}` removing it.

### REQ-11: column visibility + global search + page-size options

`AppDataTable` SHALL run with `enable-column-visibility` + `v-model:column-visibility` and toolbar global search bound to `v-model:global-filter` (placeholder "Buscar cotizaciones…") wired to the backend `search` param; page-size options SHALL render (default `[10, 20, 50]`). The `quotationFiltersSchema` SHALL define the 5 first-slice filters: `status` (multi-enum), `customerId` (multi-async), `createdAt` (date-range `createdFrom`/`createdTo`), `expiresAt` (date-range `expiresFrom`/`expiresTo`), `totalCents` (numeric-range `minTotalCents`/`maxTotalCents`).

#### Scenario: global search filters server-side
- GIVEN the cashier types `juan` in the toolbar search
- WHEN debounce elapses
- THEN a request with `search=juan` fires and rows narrow (no longer silently dropped).

#### Scenario: column picker toggles
- GIVEN `enable-column-visibility`
- WHEN a column is hidden in the picker
- THEN its cell disappears and `columnVisibility` persists (localStorage via `persistKey`).

#### Scenario: page size change
- GIVEN 25 rows
- WHEN page size 50 is chosen
- THEN a `limit=50` request fires and pagination resets to page 1.

### REQ-12: URL persistence of filter state

`useFiltersUrlAdapter` SHALL persist slideover state AND the effective status tab value to `useRoute().query`; applying a filter SHALL write the param; refresh SHALL re-hydrate tab + slideover state; shareable links SHALL reproduce the same filtered page. Only active (non-default) params SHALL be written.

#### Scenario: filter round-trip
- GIVEN the cashier applies `status=DRAFT,SENT`
- THEN the URL contains `status=DRAFT,SENT`
- AND refreshing restores both the chips and the request.

#### Scenario: tab in URL
- GIVEN `Expiradas` tab selected
- THEN the URL carries the status param
- AND reload re-selects the tab.

#### Scenario: defaults stay out of URL
- GIVEN no filters
- THEN no owned query params appear (clean shareable URL).

### REQ-13: delete flow survives unchanged

The existing delete-confirmation flow (ConfirmModal + `deleteMutation` → `quotationApi.deleteQuotation` + `quotationQueryKeys.list(tenantId)` invalidation + CASL `delete:Quotation` gate + status-gated dropdown items for DRAFT/CANCELLED) MUST behave exactly as today. Testids `row-actions-{id}` and `confirm-modal*` MUST remain.

#### Scenario: delete still gated
- GIVEN a DRAFT row and `delete:Quotation` permission
- THEN the `Eliminar` action opens the ConfirmModal and deleting invalidates the list cache.

#### Scenario: non-deletable status
- GIVEN a SENT row
- THEN no `Eliminar` action appears in its `row-actions-{id}` dropdown.

### REQ-14: composable migration to useServerTable (0↔1 adapter)

`useQuotationsList` SHALL be replaced by `useQuotationsListTable` wrapping `useServerTable` following `useConfirmedSales`: `queryFn` maps `pageIndex+1 → page`, `pageSize → limit`; response maps `page-1 → pageIndex`, `limit → pageSize`, `total → totalCount`, `totalPages → pageCount`. Query key MUST retain the `['quotations', tenantId, 'list', params]` prefix so `quotationQueryKeys.list(tenantId)` invalidation (delete flow) still clears the cache. `refresh`, `isLoading`/`isFetching`/`isError` and empty/error passthroughs SHALL be preserved.

#### Scenario: page math is exact
- GIVEN table pageIndex 2 / pageSize 20
- WHEN a fetch fires
- THEN the request carries `page=3&limit=20` and the response maps back to pageIndex 2.

#### Scenario: filter change resets page
- GIVEN pageIndex 4
- WHEN a filter changes
- THEN pageIndex resets to 0.

#### Scenario: refresh preserved
- GIVEN `refresh-quotations-button` (data-testid) clicked
- THEN `useServerTable.refresh()` refetches the current params.

### REQ-15: strict TDD: pure functions unit-tested

Pure functions SHALL be extracted and unit-tested (vitest `pnpm test:unit`): `buildQuotationsQueryParams` (or equivalent — trims search, CSV-joins multi fields, omits empties, keeps page/limit), the 0↔1 pagination adapter, the response pagination mapper, and the filters-schema serialize round-trip. Backend DTO validation (CSV/array/enum/UUID/date/int/min≤max/empty) SHALL be covered by tests in the backend repo.

#### Scenario: params builder
- GIVEN tab `DRAFT` + search ` juan ` + customer `u1,u2`
- THEN the built params carry `status=DRAFT`, `search=juan` (trimmed), `customerId=u1,u2`, no empty keys.

#### Scenario: schema round-trip
- GIVEN a filter state with all 5 fields
- THEN `deserialize(serialize(state))` is canonical-equal to the input.

### REQ-16: anti-requirements (MUST NOT)

The change MUST NOT: modify quotation detail view, sales module, or PDF; alter the public APIs of `AppDataTable`, `DataTableFilters`, `useServerTable`, `useDataTableFilters`, `useFiltersUrlAdapter` (consumed as-is); introduce new dependencies; or remove/rename the data-testids `quotations-list-view`, `status-tabs`, `new-quotation-button`, `row-actions-*`, `quotation-link-*`, `refresh-quotations-button`, `app-data-table` (if `quotation-search-input` is removed with the standalone input, its test assertions MUST be updated in the same change; if the input is kept, the testid MUST remain).

#### Scenario: shared components untouched
- GIVEN the change is merged
- THEN no diff touches `src/core/shared/data-table-filters/` or `src/core/shared/composables/useServerTable.ts` or sales module files.

#### Scenario: testids stable
- GIVEN the list renders
- THEN the existing test suite queries by the listed testids still resolve.
