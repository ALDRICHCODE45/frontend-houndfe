# Tasks: Quotations List — Advanced Filters, Column Visibility & Header Consistency

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

**size:exception:** Solo-dev on `feature/quotations-list-advanced-filters`; each commit ≤400 lines independently; combined cross-repo larger because two repos; no PRs; commits merge to main manually after `pnpm build` + `pnpm test:unit` pass.

### Suggested Work Units

| Unit | Goal | Focused test | Runtime | Rollback |
|------|------|--------------|---------|----------|
| 1 (BE) | 5-query-param additive contract | `cd houndfe-backend && pnpm test quotation-query.dto prisma-quotation.repository` | `pnpm start:dev` + `curl 'localhost:3000/quotations?status=DRAFT,SENT&search=juan'` | Revert 4 BE files; no migration |
| 2 (FE) | Table identity + filters + URL persistence | `cd frontend-houndfe && pnpm test:unit quotationFiltersSchema useQuotationsListTable QuotationsListView` | `pnpm build` + manual smoke | Revert 4 FE files; legacy composable in git |

## Phase 1: Backend — Query Contract & Repository (REQ-QAF-001…008)

- [ ] T-BE-01 RED — `src/quotations/dto/__tests__/quotation-query.dto.spec.ts`: all 8 REQ-QAF-001…008 validation scenarios from spec.md.
- [ ] T-BE-02 GREEN — extend `src/quotations/dto/quotation-query.dto.ts`: `search?: string`; `status` → `@CsvEnum(ListQuotationsStatusEnum, { max: 50 })`; `customerId` → `@CsvUuid({ max: 200 })`; `expiresFrom/expiresTo` → `@DateRange` peer; `minTotalCents/maxTotalCents` → `@NumericRange` peer + `@Type(Number) @IsInt @Min(0)`.
- [ ] T-BE-03 — widen `QuotationFindAllInput` + `QuotationFindAllQuery` in `domain/quotation.repository.ts` with 5 optional fields.
- [ ] T-BE-04 — `QuotationsService.findAll(input)`: forward 5 fields to `quotationRepo.findAll(...)`.
- [ ] T-BE-05 RED — `src/quotations/infrastructure/__tests__/prisma-quotation.repository-findAll.spec.ts`: all REQ-QAF-007 combined-filter + count-parity scenarios.
- [ ] T-BE-06 GREEN — rebuild `where` in `prisma-quotation.repository.ts:findAll`: trim search, omit empties, share `where` between `findMany` + `count`.
- [ ] T-BE-07 DoD — `pnpm test` green; `curl 'localhost:3000/quotations?status=DRAFT,SENT&customerId=u1,u2&expiresFrom=2026-01-01&minTotalCents=100&search=juan'` returns 200 with correct `pagination.total`.

## Phase 2: Frontend — Interface & Schema (REQ-QAF-015)

- [x] T-FE-01 RED — `interfaces/__tests__/quotation.types.spec.ts`: REQ-QAF-006 backward-compat + widening.
- [x] T-FE-02 GREEN — widen `QuotationListParams` in `interfaces/quotation.types.ts`; confirm Axios serializes arrays as CSV.
- [x] T-FE-03 RED — `config/__tests__/quotationFiltersSchema.spec.ts`: REQ-QAF-015 schema round-trip scenario.
- [x] T-FE-04 GREEN — create `config/quotationFiltersSchema.ts`: `createQuotationFiltersSchema({ customerOptions, customerLoading })` using `filter.multiEnum`/`multiAsync`/`dateRange`×2/`numericRange`. Mirror `salesFiltersSchema.ts`.

## Phase 3: Frontend — Composable Migration (REQ-QAF-014)

- [x] T-FE-05 RED — `composables/__tests__/useQuotationsListTable.spec.ts`: REQ-QAF-014 page-math + query-key scoping scenarios.
- [x] T-FE-06 GREEN — create `composables/useQuotationsListTable.ts`: mirror `useConfirmedSales.ts:15-120`. `useServerTable({ queryKey: () => quotationQueryKeys.list(tenantId, { ...filters.value }), queryFn: async (params) => …, defaultPageSize: 10, persistKey: 'pos-quotations-list', defaultSorting: [{ id: 'createdAt', desc: true }], urlSync: false })`. Expose `setStatusFilter(status)` resetting pageIndex 0 and feeding status into `queryKey`.
- [x] T-FE-07 — delete `useQuotationsList.ts` + its test; update remaining importers.
- [x] T-FE-08 — delete `components/QuotationsSearchInput.vue`; update tests asserting `quotation-search-input` testid.

## Phase 4: Frontend — View Wiring (REQ-QAF-009, 010, 011, 012, 013)

- [x] T-FE-09 RED — update `views/__tests__/QuotationsListView.test.ts`: assert REQ-QAF-009…013 + REQ-QAF-016 testids and delete flow.
- [x] T-FE-10 GREEN — rewrite `views/QuotationsListView.vue`: `<UCard :ui="{ body: 'p-0 sm:p-0 bg-coco-neutral-50 dark:bg-coco-neutral-950' }">` with `.quotations-list-view` + `data-testid="quotations-list-view"` on root; `<TableHeaderDescription title="Cotizaciones" …/>` in `#header`. Wire `customerOptions` via `customerApi.getPaginated`; build `quotationFiltersSchema`; `useFiltersUrlAdapter` + `useDataTableFilters`; `<DataTableFilters v-model:state>` with `data-testid="filters-trigger"`; `<DataTableFiltersChips data-testid="filters-chips">`. Bind `AppDataTable` with `enable-column-visibility`, `v-model:global-filter`, `v-model:column-visibility`, `search-placeholder="Buscar cotizaciones…"`, `:page-size-options="[10,20,50]"`. Status tabs → `setStatusFilter`. Watch `filtersCtl.serializedState` → reset `pagination.pageIndex=0`. Keep `deleteMutation` + `ConfirmModal` + `quotation-link-*` + `row-actions-*` testids exactly.
- [x] T-FE-11 DoD — `pnpm test:unit` green for the 4 spec files; `pnpm build` green; smoke: search filters server-side, column picker survives reload, slideover multi-status sends `status=DRAFT,SENT`, tab clears slideover status, refresh works, delete intact.

## Execution Order & Dependencies

- **BE first** (Phase 1, additive). Then FE (Phase 2 → 3 → 4).
- **Coupled deletes:** T-FE-07 / T-FE-08 are coupled to T-FE-06 / T-FE-10.
- **Strict TDD** per `work-unit-commits`: RED before GREEN; tests in the same commit as the behavior.
- **Rollback independence:** BE revert = 4 files, no migration. FE revert = 4 files, legacy composable in git history.
