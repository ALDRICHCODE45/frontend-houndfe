# Proposal: Quotations List — Advanced Filters, Column Visibility & Header Consistency

## Problem

The quotations list (`QuotationsListView`) lacks the system "table identity" the platform is converging toward: header-color split, multi-select advanced filters, column visibility, working global search. Today the search box is **silently broken** — the frontend sends `?search=foo`, but the backend DTO/repository have no `search` field, so the param is dropped. Backend `GET /quotations` also accepts only single `status`/`customerId`, blocking any multi-select filter UX. Sales has the pattern; Quotations does not.

## Intent

Bring Quotations to parity with Sales: working global search, multi-enum/async/range/date filters in a slideover with active chips, URL-persisted filter state, column visibility, and the UCard body-bg header split. Cover the first slice end-to-end (FE + BE).

## Scope

### In Scope
- **Frontend** (`frontend-houndfe` repo): replace `<section>` with `<UCard>` + body bg + `TableHeaderDescription` in `QuotationsListView`; add `DataTableFilters` slideover + chips; enable `enable-column-visibility` + `v-model:global-filter`. New `config/quotationFiltersSchema.ts` (status multi-enum, customer multi-async, created/expires date-range, total numeric-range). Migrate `useQuotationsList` → new `useQuotationsListTable` wrapping `useServerTable` (Sales 0↔1 pagination pattern). Wire `useFiltersUrlAdapter` for URL persistence. Keep visible status tabs + local `deleteMutation` intact.
- **Backend** (`houndfe-backend` repo — **separate repository, change spans both**): extend `GET /quotations` with `search`, multi-`status`, multi-`customerId`, `expiresFrom`/`expiresTo`, `minTotalCents`/`maxTotalCents`. Touch DTO, interface, service, repository.

### Out of Scope
- Header-color alignment of other tables (products, employees, promotions) — future change.
- Quotation detail view features, PDF generation.
- Tax-rate / price-list / multi-`ids` filters — deferred.

### Non-Goals
- Touching the delete-quotation flow.
- Changing the quotation detail view.
- Backend data-model changes beyond the GET query.

## Capabilities

### New Capabilities
- `quotations-list`: Multi-select advanced filters (status, customer, created/expires ranges, total range), URL-persisted filter state, working global search by customer name, column visibility, and UCard header-color split for the quotations list view.

### Modified Capabilities
- None.

## Approach

1. **Backend** (`houndfe-backend`): extend DTO + `QuotationFindAllInput` + service + repository. `status`/`customerId` switch equality → `in:`. `search` adds OR on `customer.firstName`/`lastName` (`mode: 'insensitive'`). New range params follow existing `createdFrom`/`createdTo` pattern.
2. **Composable**: new `useQuotationsListTable.ts` wraps `useServerTable` mirroring `useConfirmedSales.ts:79-120` — `queryFn` maps `pageIndex+1 → page`, response maps `page-1 → pageIndex`.
3. **Schema**: `defineFiltersSchema` with sections Estado, Personas, Fechas, Montos.
4. **URL adapter**: `useFiltersUrlAdapter` writes active keys to `useRoute().query`; hydrate on mount.
5. **Chrome**: `<UCard :ui="{ body: 'p-0 sm:p-0 bg-coco-neutral-50 dark:bg-coco-neutral-950' }">` with `<TableHeaderDescription title="Cotizaciones" ...>` in `#header`.
6. **Tests** (vitest, `pnpm test:unit`): schema serialize round-trip; pagination adapter; URL persistence; BE DTO validation.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/POS/quotations/views/QuotationsListView.vue` | Modified | UCard header + slideover + column visibility + global filter |
| `src/features/POS/quotations/composables/useQuotationsList.ts` | Removed | Replaced by `useQuotationsListTable` |
| `src/features/POS/quotations/composables/useQuotationsListTable.ts` | New | `useServerTable` wrapper, 0↔1 pagination adapter |
| `src/features/POS/quotations/config/quotationFiltersSchema.ts` | New | `defineFiltersSchema` for 5 filter kinds |
| **Cross-repo** `houndfe-backend/src/quotations/dto/quotation-query.dto.ts` | Modified | Add 5 new query fields |
| **Cross-repo** `houndfe-backend/src/quotations/application/quotations.service.ts` | Modified | Pass-through new fields |
| **Cross-repo** `houndfe-backend/src/quotations/infrastructure/prisma-quotation.repository.ts` | Modified | OR-search, `in:` for multi, `gte/lte` for ranges |
| **Cross-repo** `houndfe-backend/src/quotations/domain/quotation.repository.ts` | Modified | Extend `QuotationFindAllInput` |

## Backend Work — 5 Query-Param Additions

| Param | Type | Backend location |
|-------|------|-----------------|
| `search` | `string` | DTO + interface + service + repo (`customer.firstName`/`lastName`, `insensitive` contains) |
| `status` | `QuotationStatus \| QuotationStatus[]` (CSV) | DTO `@Transform`; repo `where.status: { in: [...] }` (OR) |
| `customerId` | `string \| string[]` (CSV UUIDs) | DTO + repo `where.customerId: { in: [...] }` |
| `expiresFrom`/`expiresTo` | `Date` | DTO + repo `where.expiresAt.gte/lte` |
| `minTotalCents`/`maxTotalCents` | `number` (cents) | DTO `@Type(() => Number)` + repo `where.totalCents.gte/lte` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **FE/BE coupling** — multi-status/filter UX breaks if BE not deployed | Med | Deploy BE first (additive: new params default absent). FE no-op on unknown params (NestJS DTO drops); smoke-test CSV-array edge cases |
| **Search semantics** — customer name only, or also `id`/`folio`? | Med | Default: customer name only. Defer `id`/`folio` to a later change |
| **Multi-status semantics** | Low | OR within `status`; AND across filter kinds (standard) |
| **`deleteMutation` survival** during migration | Low | Keep `handleDelete`/`confirmState`/`deleteMutation` in view untouched; manual smoke + test |
| **Review budget >400 lines** (BE DTO+repo + FE composable+schema+view) | Med | `sdd-tasks` forecasts. `exception-ok` delivery → no PRs; feature branch + 2 conventional commits (BE then FE), each independently under budget when the other side sits on `main`. Do NOT propose chained PRs. |
| **Pagination adapter** mismatch shifts rows | Low | Follow proven `useConfirmedSales` pattern exactly; covered by tests |
| **CSV-array DTO edge cases** (empty `?status=`) | Low | Test empty arrays return no filter, not 400 |

## Rollback Plan

- **Frontend**: `git revert` the FE commit on `QuotationsListView`/`useQuotationsListTable`/`quotationFiltersSchema`. Legacy `useQuotationsList` preserved in git history.
- **Backend**: `git revert` DTO+service+repo changes. No data migration touched.
- **Coordinated**: deploy BE first, then FE. If FE ships first, only over-current-capability filters fail; search returns to silent no-op (current broken behavior — not worse).

## Dependencies

- `core/shared/data-table-filters/` v2 schema + slideover + chips (existing).
- `core/composables/useServerTable.ts` (existing).
- `useFiltersUrlAdapter` pattern from `features/POS/sales/` (existing).
- **External repo** `houndfe-backend` (same workspace, no version coupling).

## Success Criteria

Mapped to the 4 user decisions:

- [ ] **Header-color split** (decision 1): `QuotationsListView` renders `<UCard>` body `bg-coco-neutral-50 dark:bg-coco-neutral-950` + `TableHeaderDescription` in `#header` — matches Sales.
- [ ] **Visible status tabs preserved + slideover added** (decision 2): Todos/Borradores/Enviadas/Expiradas/Canceladas tabs functional AND new `Filtros` slideover + chips coexist.
- [ ] **All 5 first-slice filters work** (decision 3): status (multi-enum), customer (multi-async), created range (date-range), expires range (date-range), total range (numeric-range) — each round-trips through the slideover, the URL, and the backend.
- [ ] **Global search works** (decision 3 fix): typing in `AppDataTable` search filters by customer name; no longer silently dropped.
- [ ] **Filters persist in URL** (decision 4): applying a filter writes the param; refreshing re-hydrates; shareable links work.
- [ ] **Backend accepts all 5 new query params**: `GET /quotations?status=DRAFT,SENT&customerId=u1,u2&expiresFrom=…&minTotalCents=100&search=juan` returns the correct filtered page.
- [ ] **`pnpm build` and `pnpm test:unit` pass** (strict TDD gate).