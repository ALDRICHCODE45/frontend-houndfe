# Exploration: Quotations List — Advanced Filters, Column Visibility & Header Consistency

## 1. Sales Pattern Anatomy (the target reference)

**File**: `src/features/POS/sales/views/SalesListView.vue`

### Exact template skeleton

```vue
<template>
  <div class="flex flex-col gap-6 px-10">
    <UCard :ui="{ body: 'p-0 sm:p-0 bg-coco-neutral-50 dark:bg-coco-neutral-950' }">
      <template #header>
        <TableHeaderDescription title="Ventas" description="Listado de ventas confirmadas" />
      </template>

      <div class="px-6 py-5 space-y-4">
        <!-- FILTERS BUTTON + SLIDEOVER -->
        <div class="overflow-x-auto">
          <DataTableFilters
            v-model:state="filtersState"
            :schema="salesFiltersSchema"
            :errors="filterErrors"
          />
        </div>
        <div v-if="activeExtendedFiltersCount > 0" class="text-xs text-muted">
          Filtros activos: {{ activeExtendedFiltersCount }} · Limpiar
        </div>

        <!-- TABLE -->
        <AppDataTable
          v-model:sorting="sorting"
          v-model:pagination="pagination"
          v-model:global-filter="globalFilter"
          v-model:column-pinning="columnPinning"
          v-model:column-visibility="columnVisibility"
          v-model:row-selection="rowSelection"
          :columns="columns"
          :data="data"
          :loading="isLoading"
          :fetching="isFetching"
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          :enable-row-selection="false"
          mobile-render="cards"
          enable-column-visibility
          search-placeholder="Buscar ventas..."
          empty="No hay ventas todavía"
          @refresh="refresh"
        >
          <template #filters>
            <SalesListTabs />
            <USelect v-model="sortValue" />
          </template>
          <template #actions>
            <UButton>Nueva Venta</UButton>
          </template>
          <!-- cell templates... -->
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>
```

### Header-vs-body color split mechanism

The split is achieved by a **single class** on the UCard body only:

```
:ui="{ body: 'p-0 sm:p-0 bg-coco-neutral-50 dark:bg-coco-neutral-950' }"
```

- **Header slot** (`#header`): Renders with UCard's **default body background** (typically `bg-default` / white in light mode).
- **Body slot** (the `<div class="px-6 py-5 ...">`): Gets `bg-coco-neutral-50` (gray-50) / `dark:bg-coco-neutral-950`.

This is the **only** list view in the repo that achieves this distinct header/body color split. All others:

| View | Container | bg on body? | Has split? |
|------|-----------|-------------|------------|
| **SalesListView** | `UCard` | `bg-coco-neutral-50` on body | **YES** |
| **PromotionsView** (`PromotionsView.vue:581`) | `UCard` | `body: 'p-0 sm:p-0'` (no bg) | NO |
| **ProductsView** (`ProductsView.vue:631`) | `<section>` with `bg-coco-neutral-50` on whole section | N/A (section-level) | NO (uniform) |
| **EmployeesListView** (`EmployeesListView.vue:345`) | `<section>` with `bg-default` | N/A | NO |
| **QuotationsListView** (`QuotationsListView.vue:341`) | `<section>` with `bg-default` | N/A | NO (uniform) |

**The user's request**: Make QuotationsListView match Sales. This means migrating from `<section>` to `<UCard>` with the `:ui` body override, and using `TableHeaderDescription` in the `#header` slot.

---

## 2. DataTableFilters v2 Contract

### Schema kinds available

**File**: `src/core/shared/data-table-filters/schema/types.ts` (lines 1-89)

| Kind | State shape | Backend serialization | use case |
|------|-----------|-----------------------|----------|
| `multi-enum` | `string[]` | `?param=val1,val2` (CSV) | Static option list (status, payment method) |
| `multi-async` | `string[]` | `?param=val1,val2` (CSV) | Dynamic options loaded via query (customer, cashier) |
| `multi-text` | `string[]` | `?param=val1,val2` (CSV) | Free text tags (folio numbers, IDs) |
| `numeric-range` | `{min?, max?}` | `?minParam=100&maxParam=500` | Price/money range (total, debt) |
| `date-range` | `{from?, to?}` | `?fromParam=2025-01-01&toParam=2025-12-31` | Date filtering with presets |

Each kind supports `section` grouping, `includeNull` (checkbox to include null values), `transform.toBackend`/`.fromBackend` hooks, and error display via `props.errors`.

### How a consumer builds a schema

**Sales example** (`src/features/POS/sales/config/salesFiltersSchema.ts`):

```ts
export function createSalesFiltersSchema(sources: SalesFilterSchemaSources) {
  return defineFiltersSchema([
    filter.multiText({ id: 'folio', label: 'Folio', param: 'folio', ... }),
    filter.multiEnum({ id: 'status', section: 'Estado', label: 'Estado', param: 'status', options: [...] }),
    filter.multiAsync({ id: 'customerId', section: 'Personas', label: 'Cliente', param: 'customerId',
      options: sources.customerOptions, loading: sources.customerLoading }),
    filter.numericRange({ id: 'totalCents', section: 'Montos', label: 'Total',
      minParam: 'totalMin', maxParam: 'totalMax', unit: '$', formatAs: 'currency' }),
    filter.dateRange({ id: 'confirmedAt', section: 'Fechas', label: 'Fecha de venta',
      fromParam: 'confirmedFrom', toParam: 'confirmedTo', presets: true }),
  ])
}
```

### State → backend params flow

1. `useDataTableFilters` exposes `backendParams` (computed: `schema.serialize(state)`)
2. The SalesListView passes `filtersCtl.backendParams` directly into `useConfirmedSales(filtersCtl.backendParams)` as the `filters` ref.
3. `useConfirmedSales` merges these into the query key and query function call.
4. `schema.serialize()` iterates `fields[]` and calls the per-kind serializer (e.g., `multiEnumSerializer.toQuery(value, field)`), producing `Record<string, string>` compatible with Axios `params`.

### Slideover UI

**File**: `src/core/shared/data-table-filters/components/DataTableFilters.vue` (lines 102-208)

- Trigger: `UButton variant="outline"` with icon `i-lucide-sliders-horizontal` + label "Filtros" + badge showing active count.
- Slideover: `USlideover` with `side="right"` (desktop) / `side="bottom"` (mobile).
- Body: Sections grouped by `field.section`, each field rendered by its kind-specific component (`MultiSelectEnumFilter`, `MultiSelectAsyncFilter`, `NumericRangeFilter`, `DateRangeFilter`, `MultiTextInputFilter`).
- Footer: "Cerrar" button.
- Active chips: `DataTableFiltersChips` shown below the trigger button, each chip display `label: displayValue` with an `X` to clear.

---

## 3. Feasible Advanced Filters for Quotations

Based on `QuotationResponseDto` fields (`quotation.types.ts:93-126`) and the backend `QuotationQueryDto` (`quotation-query.dto.ts:51-88`) plus repository implementation (`prisma-quotation.repository.ts:189-235`):

### Ranked filter feasibility table

| # | Filter name | Kind | Backend param(s) | Backend supported today? | Needs backend work? |
|---|-----------|------|-----------------|------------------------|---------------------|
| 1 | **Status** | multi-enum | `status` (CSV) | **NO** — backend only accepts SINGLE `status` value (`@IsEnum`) | **YES** — change `@IsEnum` to accept CSV/array; change repository `where.status` from equality to `in:` |
| 2 | **Customer** | multi-async | `customerId` (CSV) | **NO** — backend only accepts SINGLE `customerId` UUID | **YES** — change to accept CSV UUIDs; repository `where.customerId` → `in:` |
| 3 | **Created date range** | date-range | `createdFrom`, `createdTo` | **YES** — DTO has `createdFrom`/`createdTo`, repository filters `where.createdAt.gte/lte` | None |
| 4 | **Expiry date range** | date-range | `expiresFrom`, `expiresTo` | **NO** — no expiry filter in DTO/service/repo | **YES** — add `expiresFrom`/`expiresTo` to DTO, interface, service, repository `where.expiresAt.gte/lte` |
| 5 | **Total range** | numeric-range | `totalMin`, `totalMax` (in pesos or cents?) | **NO** — no total filter | **YES** — add `minTotalCents`/`maxTotalCents` to DTO+repo |
| 6 | **Tax rate** | multi-enum | `taxRate` | **NO** | **YES** — add `taxRate` filter |
| 7 | **ID search** | multi-text | `ids` (UUID CSV) | **NO** | **YES** — add `ids` filter to DTO+repo |
| 8 | **Price list** | multi-async | `priceListId` | **NO** | **YES** — requires price lists endpoint first |
| 9 | **Global search** | (AppDataTable search) | `search` / `q` | **NO** — frontend sends `search` but backend DTO has no such field; it is silently ignored | **YES** — add `search` to backend to filter by customer name |

### Critical discovery: `search` is broken today

The frontend `QuotationListParams` (line 130-138) includes `search?: string`. The composable `buildQuotationsQueryParams` (line 57-76) sends it as `params.search`. The Axios call sends it as `?search=foo`. BUT:

- `QuotationQueryDto` has **no** `search` field (lines 51-88)
- `QuotationFindAllQuery`/`QuotationFindAllInput` has **no** `search` field
- `PrismaQuotationRepository.findAll()` has **no** `search` in its `where` clause

**Verdict**: The current search input in QuotationsListView (`QuotationsSearchInput`) passes text to `setSearch()`, which debounces and sends it as `params.search` — but the **backend ignores it entirely**. The search feature is effectively non-functional. This must be fixed as part of this change.

---

## 4. Backend Gap List — Precise Changes Needed

### 4.1 DTO (`quotation-query.dto.ts`)

```diff
+ @IsOptional()
+ search?: string;  // customer name search

- @IsOptional()
- @IsEnum(['DRAFT', 'SENT', 'EXPIRED', 'CANCELLED'])
- status?: 'DRAFT' | 'SENT' | 'EXPIRED' | 'CANCELLED';
+ @IsOptional()
+ @Transform(...) // accept CSV or array
+ status?: string | string[];  // multi-status filter

- @IsOptional()
- @IsUUID()
- customerId?: string;
+ @IsOptional()
+ customerId?: string | string[];  // multi-customer filter

+ @IsOptional()
+ @Transform(({ value }) => coerceOptionalDate(value))
+ expiresFrom?: Date;

+ @IsOptional()
+ @Transform(({ value }) => coerceOptionalDate(value))
+ expiresTo?: Date;

+ @IsOptional()
+ @Type(() => Number)
+ @IsInt()
+ minTotalCents?: number;

+ @IsOptional()
+ @Type(() => Number)
+ @IsInt()
+ maxTotalCents?: number;
```

### 4.2 Domain interface (`quotation.repository.ts:30-39`)

```diff
export interface QuotationFindAllInput {
  page: number;
  limit: number;
- status?: QuotationStatus;
+ status?: QuotationStatus | QuotationStatus[];
- customerId?: string;
+ customerId?: string | string[];
  createdFrom?: Date;
  createdTo?: Date;
+ search?: string;
+ expiresFrom?: Date;
+ expiresTo?: Date;
+ minTotalCents?: number;
+ maxTotalCents?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'totalCents' | 'expiresAt';
  sortOrder?: 'asc' | 'desc';
}
```

### 4.3 Repository (`prisma-quotation.repository.ts:189-235`)

The `where` clause must be extended:

```diff
+ if (search) {
+   where.OR = [
+     { customer: { firstName: { contains: search, mode: 'insensitive' } } },
+     { customer: { lastName: { contains: search, mode: 'insensitive' } } },
+   ];
+ }
+ if (Array.isArray(status)) {
+   where.status = { in: status };
+ } else if (status) {
+   where.status = status;
+ }
+ if (Array.isArray(customerId)) {
+   where.customerId = { in: customerId };
+ }
+ if (expiresFrom || expiresTo) {
+   where.expiresAt = {};
+   if (expiresFrom) where.expiresAt.gte = expiresFrom;
+   if (expiresTo) where.expiresAt.lte = expiresTo;
+ }
+ if (minTotalCents || maxTotalCents) {
+   where.totalCents = {};
+   if (minTotalCents) where.totalCents.gte = minTotalCents;
+   if (maxTotalCents) where.totalCents.lte = maxTotalCents;
+ }
```

### 4.4 Service (`quotations.service.ts:722-735`)

Pass through new fields from `input` to `quotationRepo.findAll()`.

### 4.5 Summary of backend additions

| Param | Type | Location to add |
|-------|------|----------------|
| `search` | `string` | DTO + interface + service + repo (customer name search) |
| `status` | multi (CSV) | DTO + interface + service + repo (change from equality to `in:`) |
| `customerId` | multi (CSV) | DTO + interface + service + repo |
| `expiresFrom`/`expiresTo` | `Date` | DTO + interface + service + repo |
| `minTotalCents`/`maxTotalCents` | `number` | DTO + interface + service + repo |

---

## 5. Column Visibility + Search Wiring

### What exists today (QuotationsListView.vue:430-449)

```vue
<AppDataTable
  v-model:pagination="pagination"
  :columns="columns"
  :data="quotations"
  :loading="isLoading"
  :fetching="isFetching"
  :error="isError"
  :error-message="errorMessage"
  :page-count="totalPages"
  :total-count="total"
  :showing-from="showingFrom"
  :showing-to="showingTo"
  :page-size-options="[10, 20, 50]"
  :show-toolbar="false"          <!-- TURNS OFF search + column visibility -->
  :show-add-button="false"
  :show-refresh="false"
  empty="No hay cotizaciones"
  @refresh="refresh"
>
```

### What to change (minimal)

1. **Enable toolbar**: `:show-toolbar="true"` (or remove it — default is `true`)
2. **Enable column visibility**: `enable-column-visibility` prop
3. **Bind column visibility v-model**: `v-model:column-visibility="columnVisibility"` — requires a `columnVisibility` ref and wiring to `AppDataTable`. This comes from `useServerTable` (or a manual `ref<VisibilityState>` if not migrating to useServerTable).
4. **Add search**: `v-model:global-filter="globalFilter"` + `search-placeholder="Buscar cotizaciones..."`
5. **Column config**: Each column needs `enableHiding: true` (default) and a string `header` (not a function) for DataTableToolbar's column picker to render properly (line 77-82 of `DataTableToolbar.vue`). Currently QuotationsListView columns use string headers — they're compatible.

### Approach A: Migrate to `useServerTable` (recommended, matches Sales)

- Replace `useQuotationsList` with a new `useQuotationsListTable` (or integrate useServerTable directly).
- This gives `globalFilter`, `columnVisibility`, `sorting`, etc. for free.
- Requires adapting the 1-indexed page/limit contract — see **Risks** section below.

### Approach B: Keep `useQuotationsList` and manually wire search + column visibility

- Add `const globalFilter = ref('')`, `const columnVisibility = ref<VisibilityState>({})`.
- Bind them to AppDataTable.
- More manual work but less risk of breaking current pagination.

**Recommendation**: Approach A (useServerTable migration). See `useConfirmedSales` (`useConfirmedSales.ts:79-120`) for the exact pattern — it wraps `useServerTable` with a `queryFn` that calls the API, maps `pageIndex` → `page` (+1), `pageSize` → `limit`, transforms the response pagination back (page-1 → pageIndex).

---

## 6. Header-Color Fix

### Exact markup for QuotationsListView

Replace the current `<section>` (line 341) with:

```vue
<UCard :ui="{ body: 'p-0 sm:p-0 bg-coco-neutral-50 dark:bg-coco-neutral-950' }">
  <template #header>
    <TableHeaderDescription
      title="Cotizaciones"
      description="Listado de cotizaciones por cliente, con filtros por estado y búsqueda."
    />
  </template>

  <div class="px-6 py-5 space-y-4">
    <!-- DataTableFilters button here -->
    <!-- AppDataTable here -->
  </div>
</UCard>
```

### Other views that lack the split (repo-wide audit)

| View | Current container | Has split? |
|------|------------------|------------|
| SalesListView | `UCard` with body bg | **YES** ✅ |
| PromotionsView | `UCard` body only `p-0` | NO ❌ |
| ProductsView | `<section>` with `bg-coco-neutral-50` | NO (uniform) ❌ |
| EmployeesListView | `<section>` with `bg-default` | NO ❌ |
| CustomersView | (UCard?) — needs check | PROBABLY NO |
| QuotationsListView | `<section>` with `bg-default` | NO ❌ |

The user's request is specifically for Quotations. A repo-wide standardization would be a separate change.

---

## 7. Risks & Unknowns

### Risk 1: useQuotationsList → useServerTable migration (1-indexed vs 0-indexed)

- `useQuotationsList` uses 1-indexed `page` / `limit` (matching the backend).
- `useServerTable` uses 0-indexed `pageIndex` / `pageSize`.
- **Mitigation**: Follow the exact pattern in `useConfirmedSales.ts` lines 85-106:
  - `queryFn`: `page: params.pageIndex + 1`, `limit: params.pageSize`
  - Response transform: `pageIndex: response.pagination.page - 1`, `pageSize: response.pagination.limit`
  - This is proven and tested (`useConfirmedSales` is well-tested).

### Risk 2: The `search` param is silently broken today

- As documented in §3, the frontend sends `search` but the backend ignores it.
- If we add a real search input (via AppDataTable's `globalFilter`), it must be plumbed to a real backend `search` param — or the search will be broken.
- **Decision needed**: Should the `search` backend gap be closed in this change or a follow-up? Without it, the search box is cosmetic.

### Risk 3: Multi-status requires backend changes

- The current backend accepts single `status` only. Changing to multi (CSV) requires modifying DTO validation and the Prisma `where` clause.
- If we release the slideover before the backend is ready, selecting multiple statuses would result in a broken filter or 400 error.
- **Recommendation**: Either coordinate FE/BE deployment, or add multi-status support to backend first.

### Risk 4: DataTableFilters v2 + useServerTable integration complexity

- The Sales module has a tight coupling between `DataTableFilters` → `useDataTableFilters` → `useConfirmedSales` → `useServerTable`.
- The Quotations module currently has a completely separate `useQuotationsList` with its own TanStack Query wiring.
- A full migration means replacing `useQuotationsList` entirely, which is a significant refactor (but the right engineering decision).

### Risk 5: Column definitions for quotations lack cell templates for ALL columns

- `DataTableToolbar`'s column visibility dropdown (`DataTableToolbar.vue:71-101`) reads `col.columnDef.header` as a string.
- The current QuotationsListView columns all have string headers — **compatible** ✅.
- However, when a column is hidden by default and then shown via the picker, it needs a corresponding cell template. The current columns (`id`, `cliente`, `estado`, `total`, `expira`, `fecha`, `actions`) all have explicit cell templates — **compatible** ✅.

### Risk 6: QuotationsListView current delete/confirm flow may break

- The view has local state (`confirmState`, `deleteMutation`, `handleDelete`, etc.) that is independent of the table wiring.
- This should survive the migration as-is, but it must be tested.

---

## Summary of Recommended Approach

1. **Backend first**: Add `search`, multi-`status`, multi-`customerId`, `expiresFrom/To`, `minTotalCents/maxTotalCents` to `QuotationQueryDto`, `QuotationFindAllInput`, service, and repository.
2. **Frontend container**: Replace `<section>` with `<UCard>` body bg pattern from Sales.
3. **Filters**: Create `src/features/POS/quotations/config/quotationFiltersSchema.ts` with status (multi-enum), customer (multi-async), created date (date-range), expiry date (date-range), total range (numeric-range). Wire through `useDataTableFilters` + URL adapter.
4. **Table composable**: Migrate from `useQuotationsList` to a new composable wrapping `useServerTable` (following `useConfirmedSales` pattern exactly).
5. **Column visibility**: Enable via `enable-column-visibility` + `v-model:column-visibility`.
6. **Header**: Use `TableHeaderDescription` with `Cotizaciones` title.
