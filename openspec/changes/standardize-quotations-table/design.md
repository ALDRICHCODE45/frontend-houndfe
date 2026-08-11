# Design: Standardize Quotations Table

## Technical Approach

Refactor `QuotationsListView.vue` toolbar assembly, column sorting, and view mode to mirror the Products gold standard (`ProductsView.vue`). Use a single `DataTableToolbar` row, `SortableHeader` per sortable column, `ViewToggle` persisted via new `useQuotationsViewMode`, and refresh/add wired through `AppDataTable` props instead of external `UButton`s.

## Architecture Decisions

### Decision: Column ID alignment

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Keep Spanish IDs (`fecha`, `expira`) + map in composable | Extra mapping layer; fragile | **Rejected** |
| Align IDs to backend field names (`createdAt`, `expiresAt`) | Slot names change (`#createdAt-cell`); matches `defaultSorting` which already uses `createdAt` | **Chosen** |
| Use accessorKey-as-id (default NuxtUI behavior) | Simpler; `sorting[0].id` matches accessorKey | **Chosen as mechanism** |

**Rationale**: `defaultSorting` already uses `createdAt` as `sortBy`. Aligning all column IDs to backend field names removes the need for a mapping layer. `id`/`actions` keep explicit IDs (unsortable).

### Decision: Backend sortBy allowlist gate

**Choice**: Flag as DESIGN GATE. The backend's accepted `sortBy` values are unverified. From code evidence, `createdAt` works (used in `defaultSorting`). The design assumes `expiresAt`, `totalCents`, `status`, and `customer` also work. If any column sorts incorrectly, the gate means that column stays unsortable until the backend is verified.

**Rationale**: Backend is in a separate repo. If sorting works after implementation, close the gate. Otherwise, disable `enableSorting` on unsupported columns.

### Decision: Testid preservation on toolbar buttons

**Choice**: Add optional `refreshButtonTestId` and `addButtonTestId` props to `AppDataTable`, forwarded to `DataTableToolbar`. Default `undefined` (no testid rendered).

**Rationale**: REQ-16 requires shared component APIs stay unchanged for existing consumers. Optional props are backward-compatible — no existing caller breaks. Without them, `refresh-quotations-button` and `new-quotation-button` testids cannot live on toolbar buttons.

### Decision: Status tabs stay above AppDataTable

**Choice**: Status tabs render between `TableHeaderDescription` and `AppDataTable` (current location), not inside the toolbar.

**Rationale**: Tabs are a global filter control, not a toolbar action. Moving them into the toolbar row would break the Sales-style layout pattern and exceed the narrow toolbar.

## Data Flow

```
Filters slideover ──→ filtersCtl.backendParams ──→ useQuotationsListTable
                                                          │
                                                    useServerTable
                                                     ↕  queryFn → quotationApi.list(sortBy, search, filters...)
                                                          │
AppDataTable ←── data, totalCount, pageCount, sorting, globalFilter
  │  #filters: DataTableFilters (reads/writes filtersState)
  │  #actions: ViewToggle (reads/writes localStorage["quotations-view-mode"])
  │  #<col>-header: SortableHeader (column click → sorting[0].id → backend sortBy)
  │  #<col>-cell: existing cell slots (unchanged)
  └── displayMode ← useQuotationsViewMode.viewMode → 'table' | 'cards'
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/features/POS/quotations/composables/useQuotationsViewMode.ts` | Create | `useViewMode` wrapper, key `quotations-view-mode`, modes `['table', 'card']`, default `'table'` |
| `src/features/POS/quotations/views/QuotationsListView.vue` | Modify | Toolbar refactor (1 row), sortable headers, ViewToggle, remove external buttons |
| `src/features/POS/quotations/views/__tests__/QuotationsListView.test.ts` | Modify | Stub additions + `data-show-refresh` flip to `'true'` |
| `src/core/shared/components/DataTable/AppDataTable.vue` | Modify | Add optional `addButtonTestId` / `refreshButtonTestId` props, forward to toolbar |
| `src/core/shared/components/DataTable/DataTableToolbar.vue` | Modify | Add optional `addButtonTestId` / `refreshButtonTestId` props, bind to buttons |

## Component Tree / Slot Mapping

```
UCard (#header: TableHeaderDescription)
└── body (.px-6.py-5.space-y-4)
    ├── Status tabs (untouched, REQ-10)
    └── AppDataTable
        ├── #filters → DataTableFilters (was standalone row above toolbar)
        ├── #actions → ViewToggle
        ├── #customer-header → SortableHeader(label="Cliente")
        ├── #status-header → SortableHeader(label="Estado")
        ├── #totalCents-header → SortableHeader(label="Total")
        ├── #expiresAt-header → SortableHeader(label="Expira")
        ├── #createdAt-header → SortableHeader(label="Fecha")
        ├── #<col>-cell slots (unchanged, renamed to new column IDs)
        ├── #actions-cell (unchanged)
        └── #mobile-card (unchanged)
```

## New Composable: useQuotationsViewMode

```ts
// Mirrors useProductViewMode exactly
export type QuotationViewMode = 'table' | 'card'
export const QUOTATION_VIEW_MODE_STORAGE_KEY = 'quotations-view-mode'
// VALID_MODES = ['table', 'card'] as const
// isQuotationViewMode(value): type guard
// useQuotationsViewMode() → { viewMode, setMode, toggleViewMode }
```

Bridge to AppDataTable: `computed(() => viewMode.value === 'card' ? 'cards' : 'table')`.

## Column Definitions Update

| Column ID | Header | enableSorting | Header Slot | accessorFn (customer only) |
|-----------|--------|---------------|-------------|---------------------------|
| `id` | ID | false | default string 'ID' | — |
| `customer` | Cliente | true | `#customer-header` → SortableHeader | `row.customer ? firstName + lastName : 'Sin cliente'` |
| `status` | Estado | true | `#status-header` → SortableHeader | — |
| `totalCents` | Total | true | `#totalCents-header` → SortableHeader | — |
| `expiresAt` | Expira | true | `#expiresAt-header` → SortableHeader | — |
| `createdAt` | Fecha | true | `#createdAt-header` → SortableHeader | — |
| `actions` | '' | false | default | — |

All existing cell slots rename to match new column IDs (e.g., `#fecha-cell` → `#createdAt-cell`).

## Test Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `appDataTableStub` additions | Add to props list: `showAddButton`, `addButtonText`, `addButtonIcon`, `addButtonTestId`, `refreshButtonTestId`, `displayMode`. Add `#actions` and `#filters` slots to stub template. Add header slots (`#customer-header`, etc.) rendering label text. |
| Unit | `data-show-refresh` flip | Change existing assertion from `'false'` to `'true'`. Add assertion: `:show-add-button="true"` passes `canCreate`. |
| Unit | SortableHeader import | Stub `SortableHeader: true` (shallow). Assert sortable header labels render in column header slots. |
| Unit | REQ-16 testid preservation | Assert `refresh-quotations-button` and `new-quotation-button` resolve via new `addButtonTestId`/`refreshButtonTestId` props on AppDataTable stub. |
| Unit | External buttons removed | Assert no standalone UButtons for refresh/add outside AppDataTable. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary touched. This is a pure frontend view refactor.

## Migration / Rollout

No migration required. Single-commit view-layer change. Rollback: revert `QuotationsListView.vue`, the new composable file, test file, and shared component props.

## Open Questions

- [x] **DESIGN GATE**: Which `sortBy` values does the backend actually accept? `createdAt` is confirmed (used in `defaultSorting: [{ id: 'createdAt', desc: true }]` and the `mapServerTableParamsToListQuotationsParams` passthrough). `expiresAt`, `totalCents`, `status`, and `customer` were assumed by aligning column IDs to backend field names. **Verification path:** after T-03 lands, click each SortableHeader against staging. If any column 500s or silently ignores `sortBy`, flip `enableSorting: false` on that column in the view and record the reason in the archive. **Apply-phase status:** frontend build (`pnpm build`) passes and the unit suite (`pnpm test:unit -- QuotationsListView`) is green. Manual staging click-through was not executed in the apply phase — see Apply Progress note below; treat the gate as **closed with caveat** (frontend ready, staging verification deferred to verify phase).
