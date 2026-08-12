# Proposal: Standardize Sales List Table

## Why

`SalesListView.vue` is the daily-use history surface for cashiers but diverges from the Products gold standard in six ways. The most damaging: **a failed `/sales/confirmed` request silently renders "No hay ventas todavía"** because `isError`/`error` from `useConfirmedSales` is never destructured or wired to `AppDataTable` — the user thinks the day is empty when it is actually broken. Second: sorting is a hardcoded `USelect` dropdown (3 options) while columns already declare `enableSorting: true` on 8 of 13 — the data model can sort, the UI hides it. Third: there is no manual card/table toggle or localStorage persistence; cards only appear below `md` and the user has no agency. The fourth and fifth gaps (custom `#actions` slot for "Nueva Venta" instead of `show-add-button`, and an extra `DataTableFilters` row outside `#filters`) make the toolbar a 3-row layout instead of Products' single row. Sixth: "Limpiar" is plain text instead of a button.

## What Changes

Standardize `SalesListView.vue` and its composables to the Products pattern without touching domain features (SalesListTabs, SaleCard, PaymentMethodPills, slideover filter schema).

| # | File | Change |
|---|------|--------|
| 1 | `views/SalesListView.vue` | Destructure `isError`/`error`; pass `:error` + `:error-message` to `AppDataTable`. Replace `#actions` slot button with `show-add-button="canCreateSale"` + `add-button-text="Nueva Venta"`. Move `DataTableFilters` into `#filters` slot above `SalesListTabs`. Render `ViewToggle` in `#actions` (when `actions` slot still used for other things) or alongside. Replace `USelect` sort dropdown with header slots. Make "Limpiar" a `UButton variant="link"`. |
| 2 | `composables/useConfirmedSales.ts` | Already exposes `...table` (incl. `isError`/`error`) via `useServerTable`; no contract change needed. Confirm `useServerTable` returns `isError`/`error`. |
| 3 | `composables/useSalesColumns.ts` | Add `enableSorting: true` only where the column already declares it. Mark sort-disabled columns (`paymentMethods`, `dueDate`, `channel`, `invoice`) explicitly. Keep accessorKeys stable for header slots. |
| 4 | `composables/useSalesViewMode.ts` *(new)* | Wrap `useViewMode('pos-sales-view-mode', ['table','card'] as const, 'table')` with `isSalesViewMode` guard. Mirrors `useProductViewMode`. |
| 5 | `views/__tests__/SalesListView.test.ts` | Add tests: error-state renders when `isError=true`; sort dropdown gone; `#actions` no longer carries the New button; ViewToggle renders when `display-mode` is `table`. |
| 6 | `composables/__tests__/useSalesViewMode.test.ts` *(new)* | Pin localStorage roundtrip + default + invalid fallback. |

### Sortable column map

| Column | Sortable? | Backend `sortBy` supported |
|--------|-----------|----------------------------|
| `venta` (folio) | yes | yes |
| `confirmedAt` | yes | yes |
| `customer` | yes | yes |
| `paymentStatus` | yes | yes |
| `totalCents` | yes | yes |
| `debtCents` | yes | yes |
| `deliveryStatus` | yes | yes |
| `cashier` | yes | yes |
| `seller` | yes | yes |
| `paymentMethods` | no (chip list) | n/a |
| `dueDate` | no (date col, off by default) | n/a |
| `channel`, `invoice` | no (static) | n/a |

## Non-Goals

- No new design tokens, no `main.css`/`vite.config.ts` changes, no API changes.
- No change to `SalesListTabs`, `SaleCard`, `PaymentMethodPills`, the slideover `salesFiltersSchema`, or the `#<col>-cell` template slots (data shape stays).
- Bulk selection (`enable-row-selection="false"` stays) — out of scope for this slice.
- Coco-brand token work (`coco-gold-*`, `coco-neutral-*`) is already complete in `sales-history-coco`; not touched here.

## Approach

Wire `useServerTable`'s `isError`/`error` into `AppDataTable` first (gap #1) — smallest diff, biggest UX win. Then swap the `USelect` for `SortableHeader` slots using the column-map table above (gap #2). Then add `useSalesViewMode` + `ViewToggle` and switch `:display-mode` to `tableDisplayMode` (gap #3). Then consolidate `DataTableFilters` into the `#filters` slot and convert "Limpiar" to a `UButton` (gaps #5/#6). Replace the `#actions` UButton with `show-add-button` + `add-button-text` props last (gap #4) — this is the prop contract that the slot must release. Strict TDD: pin `data-testid`, the new props on `AppDataTable`, the absence of `USelect`, the ViewToggle aria-label, and the sort handler. Update selector tests that assert `actions`-slot button to assert `add-button-testid` instead.

## Affected Specs

Modified: **`sales`** — extend with list-view requirements (error propagation, sortable column set, view-mode persistence, toolbar consolidation). Delta spec: `openspec/changes/standardize-sales-list-table/specs/sales/spec.md`.

## Risks

- **Hidden sort by non-sortable columns (Med)** — backend may reject `sortBy=paymentMethods`; the column map above restricts `enableSorting: true` only to backend-supported ids.
- **View mode persistence on mobile cards (Low)** — default `table` on desktop may surprise users coming from a phone; mitigated by reading the same localStorage key in `useSalesViewMode`.
- **Filter schema already exposes 11 fields (Low)** — moving `DataTableFilters` into the `#filters` slot can change vertical rhythm; verify it still fits the toolbar at `sm`.
- **Existing tests assert `USelect` and `#actions` UButton (Med)** — both must be updated; not deleted.
- **`useServerTable` contract drift (Low)** — if `isError`/`error` are not yet returned, add them at `useServerTable` and reuse Products' typing.

## Rollback Plan

`git revert` the merge commit. UI standardization only: undoing restores the previous 3-row toolbar, `USelect` dropdown, and silent empty-state-on-error. No API or data-shape change.

## Dependencies

None. Reuses: `useServerTable`, `AppDataTable` (`error`/`errorMessage`/`display-mode`/`show-add-button`/`add-button-text` props exist), `SortableHeader`, `ViewToggle`, `useViewMode`, the existing `salesFiltersSchema` slideover, and `sales-list` / `pos-sales-view-mode` localStorage keys.

## Success Criteria

- [ ] `AppDataTable` receives `:error` + `:error-message`; failed request shows the error block + "Reintentar", never "No hay ventas todavía".
- [ ] `SortableHeader` rendered for 9 columns per the map; 4 columns explicitly `enableSorting: false`.
- [ ] `useSalesViewMode` persists view mode in `localStorage`; `ViewToggle` rendered with aria-label "Seleccionar vista de ventas".
- [ ] `#actions` slot no longer carries the "Nueva Venta" button; `show-add-button` + `add-button-text` props drive it.
- [ ] `DataTableFilters` lives inside `#filters`; toolbar is a single row (Products parity).
- [ ] "Limpiar" is a `UButton variant="link"` that calls `filtersCtl.clear()` (or equivalent reset).
- [ ] `pnpm build` clean; `pnpm test:unit --run` passes with new tests; no API or schema changes; `SalesListTabs`, `SaleCard`, `PaymentMethodPills`, `salesFiltersSchema` unchanged.

## Open Questions

1. **Sort dropdown migration scope** — drop the `USelect` entirely (let users sort by clicking headers) or keep it as a "Sort by…" shortcut for non-sortable columns (e.g. default order)?
2. **ViewToggle placement when both `ViewToggle` and `show-add-button` need the toolbar's right slot** — does `ViewToggle` go in `#actions` while `add-button` is its own prop, or vice versa?
3. **"Limpiar" reset semantics** — clear all slideover filters only, or also reset `sortValue` and `globalFilter`?
4. **Mobile default view** — keep `cards` below `md` regardless of persisted mode, or let `localStorage` win?