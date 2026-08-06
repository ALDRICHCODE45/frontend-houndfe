# Design: Quotations List — Advanced Filters, Column Visibility & Header Consistency

## Technical Approach

Mirror the Sales pattern end-to-end: backend uses shared `@CsvEnum`/`@CsvUuid`/`@NumericRange`/`@DateRange` decorators (proven in `ListSalesQueryDto`); frontend adopts `useServerTable` + `defineFiltersSchema` + `useFiltersUrlAdapter`. Satisfies all 16 REQ-QAF specs.

## Architecture Decisions

### Decision: Backend multi-value CSV decorators over manual ParsePipe

| option | tradeoff | decision |
|--------|----------|----------|
| `@CsvEnum`/`@CsvUuid` decorators (mirror Sales) | requires importing shared listing module | **Chosen** — 0 new code, proven |
| Custom `@Transform` + manual validation | more code, different error shapes | Rejected |

### Decision: `useServerTable` with 0↔1 adapter (mirror `useConfirmedSales`)

| option | tradeoff | decision |
|--------|----------|----------|
| Keep `useQuotationsList` + raw `useQuery` | must hand-build URL sync, column visibility, debounce | Rejected |
| `useServerTable` wrapper + filters adapter | 0↔1 indirection, ~120 lines | **Chosen** — aligns with platform identity |

### Decision: Remove `QuotationsSearchInput.vue`

| option | tradeoff | decision |
|--------|----------|----------|
| Keep standalone input alongside toolbar | two search surfaces fighting, test complexity | Rejected |
| Remove; toolbar `v-model:global-filter` replaces it | one less component, testid cleanup | **Chosen** |

## Data Flow

```
User action (tab/slideover/search)
  → filtersCtl.state / setStatusFilter ref
    → useFiltersUrlAdapter.write → URL query
  → filtersCtl.backendParams (canonical filter values)
    → useQuotationsListTable.queryFn(params)
      → mapServerTableParams(pageIndex+1→page, merge filters)
        → quotationApi.list(params) → GET /quotations?status=DRAFT,SENT&search=juan&...
          → Backend: DTO validation → Service → Repo (Prisma AND/OR compose)
            → Response { data, pagination: { page, limit, total, totalPages } }
  → response mapper (page→pageIndex-1)
    → useServerTable data/pagination
      → AppDataTable renders rows
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `houndfe-backend/src/quotations/dto/quotation-query.dto.ts` | Modify | Add `search`, `status` (CsvEnum), `customerId` (CsvUuid), `expiresFrom`/`expiresTo` (DateRange), `minTotalCents`/`maxTotalCents` (NumericRange) |
| `houndfe-backend/src/quotations/domain/quotation.repository.ts` | Modify | Widen `QuotationFindAllInput` + `QuotationFindAllQuery` with 5 new optional fields |
| `houndfe-backend/src/quotations/infrastructure/prisma-quotation.repository.ts` | Modify | `status: { in: }`, `customerId: { in: }`, `expiresAt: { gte/lte }`, `totalCents: { gte/lte }`, search OR on `customer.firstName`/`lastName` (contains, insensitive) — same `where` for findMany AND count |
| `src/features/POS/quotations/config/quotationFiltersSchema.ts` | **Create** | `defineFiltersSchema` with 5 filters: status (multi-enum, 5 values), customerId (multi-async), createdAt (date-range), expiresAt (date-range), totalCents (numeric-range, step 100) |
| `src/features/POS/quotations/composables/useQuotationsListTable.ts` | **Create** | Wraps `useServerTable`; queryFn maps `pageIndex+1→page` + merges `filtersCtl.backendParams`; response maps `page→pageIndex-1`; wraps `setStatusFilter` for tab/slideover coexistence |
| `src/features/POS/quotations/composables/useQuotationsList.ts` | **Delete** | Replaced by `useQuotationsListTable` |
| `src/features/POS/quotations/views/QuotationsListView.vue` | Modify | `<UCard>` body bg + `TableHeaderDescription`; `DataTableFilters` slideover + chips; `AppDataTable` with `showToolbar`, `enableColumnVisibility`, `v-model:global-filter`; delete flow untouched |
| `src/features/POS/quotations/components/QuotationsSearchInput.vue` | **Delete** | Toolbar search replaces it |
| `src/features/POS/quotations/interfaces/quotation.types.ts` | Modify | Widen `QuotationListParams` with `expiresFrom`/`expiresTo`, `minTotalCents`/`maxTotalCents`, `sortBy`/`sortOrder` |

## Interfaces / Contracts

**Backend DTO additions** — mirror `ListSalesQueryDto` decorators exactly:
- `search?: string` — `@IsOptional() @IsString()`
- `status?: MultiValue<QuotationStatus>` — `@CsvEnum(ListQuotationsStatusEnum, { max: 50, field: 'status' })`
- `customerId?: MultiValue<string>` — `@CsvUuid({ max: 200, field: 'customerId' })`
- `expiresFrom?: Date`, `expiresTo?: Date` — `@DateRange` with peer cross-validation
- `minTotalCents?: number`, `maxTotalCents?: number` — `@NumericRange` with `min≤max` validation

**Frontend schema** — 5 fields, 3 sections:
- `status`: multi-enum, param=`status`, section=`Estado`
- `customerId`: multi-async, param=`customerId`, section=`Personas` (options loaded via `customerApi.getPaginated`)
- `createdAt`: date-range, fromParam=`createdFrom`, toParam=`createdTo`, section=`Fechas`
- `expiresAt`: date-range, fromParam=`expiresFrom`, toParam=`expiresTo`, section=`Fechas`
- `totalCents`: numeric-range, minParam=`minTotalCents`, maxParam=`maxTotalCents`, section=`Montos`

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| BE DTO | CSV enum/UUID/date-range/numeric validation, empty CSV → no filter, invalid → 400 | vitest decorator unit tests |
| BE Repo | search OR composition, multi-status `in:`, range `gte/lte`, count parity | Integration spec |
| FE Schema | serialize round-trip, defaults, activeChips | vitest |
| FE Composable | 0↔1 page math, query-key scoping, filter→page reset, response mapper | vitest |
| FE View | UCard rendered, testids preserved, status tabs + slideover coexistence, delete flow | vitest |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Backend changes are additive (new optional params default absent). Rollback: `git revert` BE commit then FE commit.

**Work units**: Commit 1 = backend (~160L), Commit 2 = frontend (~350L). Both under 400-line review budget.

## Open Questions

None — all design decisions resolved through Sales pattern mirroring.
