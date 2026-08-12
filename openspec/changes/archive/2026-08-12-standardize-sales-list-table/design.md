# Design: Standardize Sales List Table

## Technical Approach

Wire `useServerTable`'s error surface into `AppDataTable` first (smallest diff, biggest UX win), then replace the `USelect` sort dropdown with 9 `SortableHeader` slots (keeping the USelect as shortcut per user decision #1), add `useSalesViewMode` + `ViewToggle`, consolidate `DataTableFilters` into `#filters`, and replace the custom `#actions` UButton with `show-add-button` + `add-button-text` props. Strict TDD: all new behavior pinned via `data-testid` assertions.

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Error wiring | Destructure `isError`/`error` from `useConfirmedSales` → bind `AppDataTable :error/:error-message` | `useServerTable` already returns both as `ComputedRef` (lines 153-154). `useConfirmedSales` spreads `...table`. Only destructuring is missing. |
| USelect shortcut | KEEP alongside `SortableHeader` | User decision #1. Both update the same `sorting` ref. The existing `watch(sortValue)` already writes to `sorting.value`. |
| View mode | New `useSalesViewMode()` mirroring `useProductViewMode` | Same `useViewMode` pattern. Key `pos-sales-view-mode`, modes `['table','card']`, default `'table'`. Bridge: `computed` maps `'card'→'cards'`, `'table'→'table'`. |
| Toolbar order | `[Refresh] [Columnas] [+ Nueva Venta] [ViewToggle]` | User decision #2. `ViewToggle` in `#actions` slot (rightmost), add via built-in `show-add-button` prop. |
| "Limpiar" | `UButton variant="link"` → `filtersCtl.clearAll()` | User decision #3: only clears slideover filters state. `sorting`/`globalFilter`/view mode untouched. |
| Mobile | Respects `localStorage` preference | User decision #4. `:display-mode` bound to persisted `displayMode` computed, not responsive `mobileRender`. |

## Data Flow

```
useConfirmedSales ──isError/error──→ AppDataTable :error/:error-message
         │                                    │
         └─sorting (v-model)←──SortableHeader ─┘
              ↕ (sync via watch)
         USelect sortValue ────────────────────┘

useSalesViewMode ──displayMode──→ AppDataTable :display-mode
         │
    localStorage("pos-sales-view-mode")
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `views/SalesListView.vue` | Modify | Destructure `isError`/`error` + `canCreateSale` computed. 9 `#<col>-header` SortableHeader slots. `useSalesViewMode` + ViewToggle in `#actions`. Move `DataTableFilters` into `#filters` above `SalesListTabs`. Replace `#actions` UButton with `:show-add-button="canCreateSale"` + `:add-button-text="'Nueva Venta'"`. "Limpiar" → `UButton variant="link"` @click `filtersCtl.clearAll()`. |
| `composables/useSalesViewMode.ts` | Create | Mirror `useProductViewMode`: wrap `useViewMode('pos-sales-view-mode', ['table','card'], 'table')`, export `isSalesViewMode` guard, expose `displayMode` computed bridge. |
| `composables/useSalesColumns.ts` | Modify | Add `enableSorting: true` on 9 sortable columns; keep explicit `false` on remaining 4. |
| `composables/__tests__/useSalesViewMode.test.ts` | Create | localStorage roundtrip, invalid fallback → table, displayMode bridge. |
| `views/__tests__/SalesListView.test.ts` | Modify | Add `isError`/`error` to mock. New tests: error state renders, USelect absent, add-button-testid present, ViewToggle aria-label, Limpiar calls `clearAll`. Remove `#actions` UButton text assertion. |

## Component Tree / Slot Map

```
SalesListView.vue
├── UCard
│   └── #header: TableHeaderDescription
├── AppDataTable
│   │  :error="isError"
│   │  :show-add-button="canCreateSale"
│   │  :add-button-text="'Nueva Venta'"
│   │  :display-mode="displayMode"
│   │  @add="goToNewSale"
│   │  @refresh="refresh"
│   ├── #filters slot
│   │   ├── DataTableFilters (v-model:state, :schema, :errors)
│   │   │   └── [conditional] "Limpiar" UButton variant="link"
│   │   └── SalesListTabs (:counts, @change)
│   ├── #actions slot
│   │   └── ViewToggle (v-model="viewMode", aria-label="Seleccionar vista de ventas")
│   ├── #venta-header → SortableHeader (:column, label="Venta")
│   ├── #confirmedAt-header → SortableHeader (:column, label="Fecha")
│   ├── #customer-header → SortableHeader (:column, label="Cliente")
│   ├── #paymentStatus-header → SortableHeader (:column, label="Pago")
│   ├── #totalCents-header → SortableHeader (:column, label="Total")
│   ├── #debtCents-header → SortableHeader (:column, label="Deuda")
│   ├── #deliveryStatus-header → SortableHeader (:column, label="Productos")
│   ├── #cashier-header → SortableHeader (:column, label="Cajero")
│   ├── #seller-header → SortableHeader (:column, label="Vendedor")
│   ├── #<col>-cell slots (venta, confirmedAt, customer, paymentStatus, paymentMethods, totalCents, debtCents, dueDate, deliveryStatus, cashier, seller, channel, invoice) — unchanged
│   └── #mobile-card → SaleCard
└── UAlert (no permission)
```

## Interfaces / Contracts

- **Error binding**: `useServerTable` contract provides `isError: ComputedRef<boolean>` + `error: ComputedRef<unknown>` (verified at lines 35-36, 153-154 of `useServerTable.ts`). `AppDataTable` accepts `error?: boolean` + `errorMessage?: string`. No new contract needed.

- **SortableHeader**: slot receives `{ column }` (TanStack `Column<any>`) from UTable. `SortableHeader` props: `{ column, label }`. All 9 column IDs already match backend `sortBy` field names.

- **`useSalesViewMode` signature**:
  ```ts
  export type SalesViewMode = 'table' | 'card'
  export function isSalesViewMode(v: string): v is SalesViewMode
  export function useSalesViewMode(): {
    viewMode: Ref<SalesViewMode>
    setMode: (m: SalesViewMode) => void
    toggleViewMode: () => void
    displayMode: ComputedRef<'table' | 'cards'>
  }
  ```

- **ViewToggle binding**: `:model-value="viewMode"` / `@update:model-value="setMode"`, `:aria-label="'Seleccionar vista de ventas'"`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Composable | `useSalesViewMode` localStorage roundtrip, invalid fallback, displayMode bridge | New test, mirrors `useProductViewMode.test.ts` |
| View | Error block renders when `isError=true`; "No hay ventas todavía" absent | Add `isError: ref(true)`, assert `table-error-state` testid |
| View | USelect absent, `#<col>-header` slots render `SortableHeader` | Assert `USelect` not rendered; 9 SortableHeader components mounted |
| View | "Nueva Venta" via `add-button-testid` prop, not `#actions` slot UButton | Assert `add-button-testid="toolbar-add-button"`; remove `wrapper.text().toContain('Nueva Venta')` assertion |
| View | ViewToggle with `aria-label="Seleccionar vista de ventas"` | Assert on `role="tablist"` aria-label |
| View | "Limpiar" calls `filtersCtl.clearAll()` | Spy on `clearAll`, click link button, assert called once |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. No API or schema changes. Rollback: `git revert`.

## Open Questions

None. All 4 open questions from the proposal resolved by user decisions #1-4.
