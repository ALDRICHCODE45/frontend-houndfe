# Design: Contained mobile density for the three dashboard lists

## Decision summary

Products, Customers, and Colaboradores will become the only pilot consumers of a single mobile-gutter convention: the existing `UDashboardPanel` body remains the outer gutter owner, and those three route roots stop adding horizontal padding below `md`. Shared components receive only backward-compatible shrink containment and breakpoint corrections; pilot-only density remains in the three route views, grids, and cards. No new wrapper component or public prop is introduced.

The installed Nuxt UI table is not wrapped or redesigned. In `@nuxt/ui` 4.6.0, `Table.vue` renders a `Primitive[data-slot="root"]`; its shipped table theme gives that same element `relative overflow-auto`. The child `<table data-slot="base">` has `min-w-full`, pinned `th`/`td` cells receive `position: sticky`, and TanStack supplies their `right` offsets. `AppDataTable`'s existing `data-testid="table-view"` lands on this root. Therefore that Nuxt UI root remains the sole table horizontal scroller and receives only width/shrink constraints.

## Goals and invariants

- At 360, 412, and 740 CSS px, neither display mode widens the page.
- Card mode has no horizontal scroll container and no surface/card clipping workaround.
- Table mode keeps Nuxt UI's existing local `overflow-auto`, sticky header, `columnPinning`, and fixed right `actions` column exactly.
- `DataTableToolbar` keeps search, wrapping actions, and optional Filters as its three canonical mobile regions; its bottom filter sheet remains unchanged.
- `ViewToggle` keeps the visible `Tabla` and `Tarjetas` labels, existing model event, keyboard activation, focus visibility, and at least 44×44 CSS px actionable targets.
- Existing Coco/Nuxt semantic tokens, rounded surfaces, borders, shadows, and light/dark behavior remain.
- APIs, DTOs, Zod schemas, query keys, mutations, pagination data, routing, and authorization do not change.

## Architecture and containment flow

```text
UDashboardPanel body
  p-4 / sm:p-6 outer gutter (existing, sole mobile owner)
    pilot route root
      no horizontal padding below md; min-w-0 + w-full
        UCard list surface
          existing rounded/token surface and overflow-hidden
            compact inner body padding
              AppDataTable root (w-full/min-w-0/max-w-full)
                DataTableToolbar
                table mode -> UTable[data-slot=root] (existing overflow-auto scroller)
                           -> table + sticky/pinned cells (untouched)
                card mode  -> pilot *CardGrid available-width tracks
                           -> shrinkable pilot cards/descendants
                DataTablePagination contained footer
```

Containment is established at every flex/grid item that can otherwise preserve min-content width. The dashboard body's existing `overflow-x-hidden` is not treated as evidence of success and is not removed in this pilot because changing that global shell behavior would expose every dashboard route. Manual verification must additionally prove the dashboard body and each pilot surface have `scrollWidth <= clientWidth`; that demonstrates the clipping ancestor is not masking pilot overflow.

## Detailed decisions

### 1. Gutter and surface ownership

The existing dashboard body padding configured in `vite.config.ts` (`p-4 sm:p-6`) remains the sole mobile outer gutter. The three route roots change as follows:

- Products and Customers: replace unconditional `px-10` with `w-full min-w-0 md:px-10`.
- Colaboradores: retain `py-3`, remove horizontal padding below `md`, and restore the existing desktop progression with `w-full min-w-0 md:px-6 lg:px-8`.
- Their `UCard` list surfaces gain `w-full min-w-0 max-w-full`; existing Coco body classes and rounded/overflow treatment remain.
- Their inner list bodies converge on compact pilot spacing such as `w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4`. This is inner surface padding, not an outer page gutter.

`DashboardLayout.vue` and `vite.config.ts` are inspected sources of the contract but require no production change. This avoids a global shell rollout while making ownership explicit through the pilot route roots.

### 2. Shared `AppDataTable` containment

`AppDataTable` gets globally safe structural classes only:

- Root: `w-full min-w-0 max-w-full` in addition to its existing flex/gap classes.
- `UTable`: `w-full min-w-0 max-w-full flex-1` while leaving `sticky`, all models, slots, and Nuxt UI `overflow-auto` untouched.
- Card/error/empty and adjacent slot regions receive `min-w-0 max-w-full` only where needed to prevent a slot root from becoming the flex item's automatic minimum.

There is no responsive-density prop. These constraints cannot alter table state or create scrolling; they only allow the component to honor its parent's available width. This is the backward-compatible global part of the change.

### 3. Toolbar and labeled view selection

`DataTableToolbar` keeps its existing component API and mobile branch. The root's CSS breakpoint is aligned with the JavaScript branch: use a column layout through `< md` and switch to the historical row layout at `md`, rather than applying `sm:flex-row` to markup that is still the mobile three-region branch between 640 and 767 px. Root and region wrappers gain `w-full/min-w-0/max-w-full`; the actions region retains `flex-wrap` and fixed add → refresh → Columnas → actions-slot order. The filter trigger, slideover, sticky header/footer, scrollable body, filter slot lifetime, and `clear-filters` event remain unchanged.

Pilot action-slot controls use local containment (`max-w-full`, shrinkable wrappers, and a narrower-but-labeled Product type selector where needed). They may wrap onto another line but may not reorder.

`ViewToggle` receives a backward-compatible accessibility/containment correction without a new prop:

- Keep `role="tablist"`, every `role="tab"`, visible option text, icons, and `update:modelValue`.
- Add root `max-w-full min-w-0`; each button remains flex content and gets `type="button"`, `min-h-11 min-w-11`, compact horizontal padding, and an explicit semantic `focus-visible` outline.
- Keep both default labels and accessible names. No icon-only mode, label hiding, hover dependency, watcher, or new reactive state is added.

### 4. Available-width card grids

Each pilot grid uses the same small, local CSS-grid convention for both skeleton and data states:

```css
grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
```

This can be expressed as the equivalent Tailwind arbitrary grid-template class. `w-full min-w-0 max-w-full` is present on loading, empty, and populated roots. The nested list width—not viewport breakpoints—therefore decides the column count, and `min(100%, 14rem)` guarantees a single track cannot exceed a very narrow container. The prior exact `sm/lg/xl/2xl` ladder is intentionally retired for these three grids.

No shared grid abstraction is added: only three components duplicate the one layout declaration, while their props, state rendering, event sets, and contents differ materially. A wrapper would add indirection without removing orchestration duplication.

### 5. Card shrink containment

`ProductCard`, `CustomerCard`, and `EmployeeCard` gain `w-full min-w-0 max-w-full` at the article root. Header identity blocks, chip rows, and two-column metadata grids remain shrinkable. Content policy is field-specific:

- Product name remains line-clamped; SKU, brand, price, stock, and date truncate within their cells.
- Customer name/email/phone/date truncate; the price-list badge is constrained to the card and its label truncates rather than widening the badge.
- Employee name/position/manager/date/modality/seniority stay within shrinkable cells; long department/status chips are constrained or truncate without moving the kebab.

Kebab wrappers stay absolutely pinned at the top-right and keep propagation guards. Existing card-click and permission behavior is untouched. Truncation with an ellipsis is allowed; clipping a card, badge shell, kebab, or action is not.

### 6. Pagination containment is required

The installed `UPagination` uses a non-wrapping flex list and this component requests first/previous/items/next/last controls. Alongside the page-size selector, that intrinsic row can exceed the approximately 304 px pilot content width at 360 px. Pagination is therefore in scope.

`DataTablePagination` keeps the same zero-based/one-based computed bridge and emits. Its mobile controls become a `w-full min-w-0` column and return to the existing row layout at `sm`; `UPagination` uses the existing `sm` visual size and a max-width-safe list. If representative page counts still require it, the pagination list may wrap in DOM order rather than scroll horizontally. `show-edges`, `sibling-count`, disabled/fetching behavior, labels, page-size options, and emitted values do not change. This is a backward-compatible responsive containment fix for all consumers, with no pilot API.

## Component map and prop/event impact

| Component | One-sentence responsibility | Prop/event impact |
|---|---|---|
| `DashboardLayout` / `UDashboardPanel` | Owns the dashboard body's outer responsive gutter and existing clipping boundary. | No prop, event, or source change. |
| Three pilot route views | Compose existing data/state/actions into one contained pilot list surface. | No public contract change; existing `v-model`s and handlers remain. |
| `AppDataTable` | Selects table/card state and composes toolbar, one data region, pagination, and bulk actions. | No new prop/event; all models, slots, defaults, and emits remain. |
| `DataTableToolbar` | Renders desktop controls or the canonical mobile search/actions/filters regions and filter sheet. | No prop/slot/event change; breakpoint/class correction only. |
| `ViewToggle` | Emits selection for a labeled two-choice segmented control. | `modelValue`, `options`, `ariaLabel`, and `update:modelValue` are unchanged. |
| `DataTablePagination` | Translates page controls into the existing zero-based page and page-size events. | All props and both update events remain unchanged. |
| Three pilot card grids | Render loading, empty, or cards and forward domain events. | Existing props/emits remain unchanged; layout only. |
| Three pilot cards | Present one entity and forward its existing card/kebab interactions. | Existing props/emits and permission gates remain unchanged. |

Vue implementation remains Vue 3 Composition API with `<script setup lang="ts">`, props-down/events-up, pure `computed` derivations, and no layout watcher/composable. CSS Grid resolves available width declaratively, so a resize observer or new composable is not justified.

## Data, query, error, and permission contracts

### Data and server state

There are no new Zod schemas or DTO shapes. Existing `Product`, `Customer`, and `Employee` types pass through unchanged. Query keys, request parameters, `useServerTable`, cache invalidation, mutations, persisted display-mode keys, sorting, searching, filtering, selection, and pagination semantics are untouched.

### Existing state rendering

| State | Preserved owner and behavior |
|---|---|
| Loading/fetching | `AppDataTable` and each existing card-grid skeleton path; only grid containment changes. |
| Error | Existing table/cards alert wins over empty state and keeps retry behavior. |
| Empty | Existing table empty slot or card-grid empty message remains; only width containment changes. |
| Paginated | The one existing `DataTablePagination` remains below either mode. |
| Filtered | Products type filter and Employee filter sheet/state remain unchanged; Customers still has no invented filter slot. |

### Permission matrix

| Surface/action | Existing CASL contract | Change |
|---|---|---|
| Product list/detail/create/edit/delete | `read/create/update/delete:Product` | None. |
| Customer create/edit/delete | `create/update/delete:Customer` | None. |
| Customer sales history | `read:Sale` | None. |
| Employee route/create/edit/terminate/reactivate | `read/create/update:Employee` | None. |
| Employee batch delete | `batch_delete:Employee` | None. |

No route metadata, subjects, router entries, or navigation registry changes are required.

## Exact likely file changes

### Global, provably backward-compatible containment

- `src/core/shared/components/DataTable/AppDataTable.vue`
- `src/core/shared/components/DataTable/__tests__/AppDataTable.spec.ts`
- `src/core/shared/components/DataTable/DataTableToolbar.vue`
- `src/core/shared/components/DataTable/__tests__/DataTableToolbar.spec.ts`
- `src/core/shared/components/DataTable/DataTablePagination.vue`
- `src/core/shared/components/DataTable/__tests__/DataTablePagination.spec.ts` (new)
- `src/core/shared/components/ViewToggle.vue`
- `src/core/shared/components/__tests__/ViewToggle.spec.ts` (new)

### Pilot-only opt-ins

- `src/features/POS/products/views/ProductsView.vue`
- `src/features/POS/products/views/__tests__/ProductsView.test.ts`
- `src/features/POS/products/components/ProductCardGrid.vue`
- `src/features/POS/products/components/__tests__/ProductCardGrid.test.ts`
- `src/features/POS/products/components/ProductCard.vue`
- `src/features/POS/products/components/__tests__/ProductCard.test.ts`
- `src/features/POS/customers/views/CustomersView.vue`
- `src/features/POS/customers/views/__tests__/CustomersView.test.ts`
- `src/features/POS/customers/components/CustomerCardGrid.vue`
- `src/features/POS/customers/components/__tests__/CustomerCardGrid.spec.ts`
- `src/features/POS/customers/components/CustomerCard.vue`
- `src/features/POS/customers/components/__tests__/CustomerCard.spec.ts`
- `src/features/admin/employees/views/EmployeesListView.vue`
- `src/features/admin/employees/views/__tests__/EmployeesListView.test.ts`
- `src/features/admin/employees/components/EmployeeCardGrid.vue`
- `src/features/admin/employees/components/__tests__/EmployeeCardGrid.spec.ts` (new)
- `src/features/admin/employees/components/EmployeeCard.vue`
- `src/features/admin/employees/components/__tests__/EmployeeCard.spec.ts` (new)

`DashboardLayout.vue`, `vite.config.ts`, all APIs/composables/query-key files, column definitions, router/auth files, and non-pilot views are explicitly unchanged.

## Strict TDD strategy

Every implementation group follows RED → GREEN → TRIANGULATE → REFACTOR; jsdom tests assert classes, DOM order, labels, props, and emits, never pretend to prove geometry.

1. **Shared containment RED:** add failing assertions for `AppDataTable` shrink classes on its root and on the real `UTable` boundary; toolbar root staying column-based through `<md`; mobile region order/wrapping; pagination mobile stack; and `ViewToggle` labels, names, 44 px classes, focus class, and unchanged emit.
2. **Shared GREEN:** add only the minimum classes/attributes needed for those contracts without touching table models, slots, or Nuxt UI internals.
3. **Shared TRIANGULATE:** cover table and cards paths, with/without filters/actions, 640–767 breakpoint intent via class contracts, pagination value emission, custom toggle options, keyboard activation, and desktop class preservation.
4. **Pilot RED:** add failing view assertions for no horizontal route padding below `md`, retained desktop padding, compact inner surface containment, and no new props; add grid assertions for the available-width template in both skeleton/data states and card assertions for shrink/truncation contracts.
5. **Pilot GREEN:** change only the three route surfaces, grids, and cards.
6. **Pilot TRIANGULATE:** use representative long product/customer/employee strings; prove all existing card events, kebab propagation, permissions, loading, and empty contracts still pass while exact old breakpoint-ladder assertions are deliberately replaced.
7. **REFACTOR:** remove repeated class fragments only within a component; do not create a wrapper or composable for static layout. Run the target test after each step, then `pnpm test:unit --run` and `pnpm build`.

## Manual rendered-geometry evidence

No browser runner is installed, and none will be added. After unit/type/build gates are green:

1. Run the existing app with `pnpm dev --host`, sign in, and use representative rows containing long unbroken SKU/email/phone values plus long names, brands, departments, managers, positions, badges, and currency.
2. In browser responsive mode set `window.innerWidth` to 360, 412, then 740 CSS px (DPR is independent). Visit Products, Customers, and Colaboradores in table/cards and light/dark modes.
3. For every case record: `document.documentElement.scrollWidth === clientWidth`; dashboard body, route root, `UCard`, `AppDataTable`, toolbar, card grid/cards, and pagination each have `scrollWidth <= clientWidth` in card mode. Bounding rectangles for cards, badge shells, kebabs, and pagination must stay inside the list content rectangle.
4. In table mode locate `[data-testid="table-view"][data-slot="root"]`; confirm computed `overflow-x` is `auto`/`scroll`, `scrollWidth > clientWidth` for wide data, and all outer ancestors have `scrollWidth <= clientWidth`. This proves the installed Nuxt UI root alone owns horizontal movement.
5. At `scrollLeft = 0` and maximum scroll, compare each right-pinned actions header/cell rectangle with the table scroller's right edge, then click the kebab at both extremes. Record screenshots and console measurements.
6. Confirm toolbar order, action wrapping, Filters sheet scrolling/state, both visible ViewToggle labels, visible keyboard focus, and measured toggle targets of at least 44×44 CSS px. Products is the narrow stress case; Employees additionally exercises filters and batch actions.

A small pasted DevTools console snippet may collect `clientWidth`, `scrollWidth`, rectangles, computed overflow, and scroll extremes from these stable selectors. It is manual evidence, not a checked-in dependency or automated test substitute.

## Rollout and rollback

Ship as one bounded pilot after the full rendered matrix passes. Non-pilot pages receive only the shared shrink/breakpoint/accessibility corrections and require a smoke check at desktop plus one narrow width. If a non-pilot regression appears, revert the relevant shared class correction and keep the pilot-specific work pending rather than adding a broad exception API.

If table scrolling or pinned actions regress, revert the `UTable` containment change first; do not move overflow to a new wrapper or to the page. If one card domain regresses, revert only that route/grid/card set. No data migration, backend rollback, feature flag, dependency, or API rollback is needed.

## Requirement-to-evidence map

| Requirement group | Unit evidence | Rendered evidence |
|---|---|---|
| DTT-001–004 | Region order, wrap/classes, filter sheet, labels/focus/touch classes, unchanged API | Reachability, 44 px targets, sheet scrolling, theme fidelity. |
| PL-001–006 | Route/surface classes, grid template, card containment, preserved events/state | 360/412/740 page fit, card content, local table scroll, pinned actions. |
| CL-001–008 | Same plus customer badge/content and history/edit/delete forwarding | Long email/phone/price list, actions, both modes/themes. |
| AEL-001–007 | Same plus filters, batch and employee action/navigation preservation | Long HR fields, filter sheet, batch bar, pinned actions, both themes. |
