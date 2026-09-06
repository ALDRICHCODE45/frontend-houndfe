# Proposal: Mobile Dashboard List Density

## Why

The Products, Customers, and Employees/Colaboradores list views lose usable width on mobile because dashboard padding, page gutters, and inner surface padding accumulate. Their toolbars then consume multiple rows, while card roots and grid tracks can preserve min-content width. Global and surface clipping can hide the resulting overflow instead of containing it correctly.

This makes list content harder to scan and can cut off card content at the right edge. The change is worthwhile now because the three views share the same `AppDataTable`, toolbar, view-mode, card-grid, and persisted-mode patterns, making them a focused pilot for a reusable responsive-density foundation without redesigning the dashboard.

## What Changes

- Establish one owner for the outer mobile gutter: `DashboardLayout`. Pilot route views will not add a second outer horizontal gutter.
- Retain responsive inner surface padding where useful, with ownership made explicit rather than duplicated.
- Improve mobile density and width containment across the shared list composition, including `AppDataTable`, toolbar regions, view selection, card grids, card roots, and pagination where required.
- Keep the `DataTableToolbar` mobile three-region structure and filter-sheet behavior, while making its controls fit and remain usable at narrow widths.
- Keep both `ViewToggle` labels for discoverability, with compact spacing and placement while preserving accessible names, keyboard behavior, and practical 44px touch targets.
- Prefer a width-aware card-grid strategy based on available container width, such as safe auto-fit/minmax behavior or an equivalent approach, rather than viewport breakpoints alone.
- Preserve the real Nuxt UI table scroller and place containment around the rendered table region after inspecting the installed implementation.
- Ensure table mode scrolls only within its table region and card mode neither clips nor horizontally scrolls.
- Include `DataTablePagination` containment in the pilot when necessary to prevent page-level or card-mode overflow, without changing pagination behavior.
- Preserve Coco/Nuxt UI surfaces, semantic tokens, rounded treatment, and light/dark modes.

The first slice is limited to the three-pilot boundary: Products, Customers, and Employees/Colaboradores. It is a responsive density foundation pilot, not a broad list migration.

## Out of Scope

- Backend, API, DTO, query, mutation, or pagination-data changes.
- Router, sidebar, route-name, CASL subject, permission, or authorization changes.
- Redesigning table columns, table interactions, sorting, searching, loading/error/empty behavior, or the table visual language.
- Removing table horizontal scrolling or changing the sticky/fixed right actions-column behavior.
- Enabling horizontal scrolling or clipping as a workaround in card mode.
- Migrating non-pilot list views or introducing a broad new design system.
- Replacing the labeled `ViewToggle` with unexplained icon-only controls.
- Treating supplied screenshots as an exact deployed-DOM contract; they remain visual evidence.
- Adding a browser automation dependency in this change.

## Capabilities New / Modified

### New

None. This change establishes no new business capability or data capability.

### Modified

Scoped to `openspec/specs` capabilities represented by the pilot:

- **`data-table-toolbar`** — Modify responsive density and containment while preserving the mobile three-region order, filter behavior, slot contract, accessible controls, and desktop/mobile semantics.
- **`products-list`** — Modify responsive list-surface, toolbar, table/card layout, and product-card containment only; preserve product filters, persisted display mode, permissions, and table actions.
- **`customer-list`** — Modify responsive list-surface, toolbar, table/card layout, and customer-card containment only; preserve customer actions, history access, persisted display mode, permissions, and table actions.
- **`admin-employees-list`** — Modify responsive list-surface, toolbar, table/card layout, and employee-card containment only; preserve employee filters, batch actions, navigation, permissions, and persisted display mode.

Shared dashboard and data-table primitives are implementation foundations for these modifications, not newly exposed product capabilities.

## Approach

1. **Make gutter ownership explicit.** Treat `DashboardLayout` as the sole outer mobile gutter authority. Remove or narrow only the pilot-level duplicate outer gutter; retain necessary inner surface padding under one clearly owned convention.
2. **Build containment from the outside inward.** Ensure the list surface, `AppDataTable`, toolbar slots, grid tracks, cards, and pagination can shrink to their available width. Avoid relying on ancestor `overflow-x-hidden` to conceal invalid overflow.
3. **Preserve table behavior at its boundary.** Inspect the actual Nuxt UI table DOM and computed overflow in the installed version. Keep the existing internal horizontal scroller, sticky table behavior, `columnPinning`, and right actions column unchanged; apply containment around the real scroller rather than changing table internals by assumption.
4. **Densify without collapsing semantics.** Keep the toolbar's canonical mobile regions and filter sheet. Compact spacing and control layout only where it improves narrow-width use. Keep labeled `ViewToggle` controls and practical touch sizing.
5. **Use available-width card layout.** Choose a width-aware grid strategy that responds to the pilot surface's actual container width, with card and descendant min-width containment so long names, SKU, email, phone, department, manager, and currency content can wrap or truncate without clipping.
6. **Verify the three pilots in both modes and themes.** Validate at 360, 412, and 740 CSS px in Products, Customers, and Colaboradores, in light and dark modes. Confirm card mode has no horizontal overflow and table mode has exactly the intended local table scrolling with pinned actions still aligned and clickable.
7. **Keep the implementation opt-in or backward-compatible.** Shared changes should support the three pilots without forcing a broad migration; exact component APIs, classes, and test changes belong to design and later phases.

## Impact

| Area | Impact |
|---|---|
| Dashboard shell | Clarifies mobile gutter and overflow responsibility; no navigation or shell visual redesign. |
| Shared data-table components | Responsive containment and density adjustments; existing data, slots, modes, pagination ownership, and state behavior remain. |
| View toggle and toolbar | More compact narrow-width presentation while preserving labels, accessibility, order, and filter behavior. |
| Pilot route views and cards | Remove duplicated outer width pressure and add responsive card/grid containment specific to each pilot's content. |
| Table UX | No intended behavior change; internal horizontal scrolling and sticky/fixed actions remain required. |
| Theme and visual language | Reuses existing Coco/Nuxt UI semantic tokens and light/dark surfaces. |
| Testing and verification | Existing class/contract tests may need deliberate updates for the chosen width-aware grid strategy; browser-level geometry checks are required because jsdom does not calculate layout. |
| Backend and operations | No API, query, permission, routing, or operational process impact. |

## Risks / Unknowns

- The installed Nuxt UI version's actual table scroller must be confirmed in rendered DOM; changing the wrong ancestor could break sticky actions or expose page-level overflow.
- Removing duplicate gutters or global clipping may reveal previously hidden width problems in shared components. Mitigate with explicit `min-w-0`/width containment and browser geometry checks.
- A width-aware grid may intentionally replace the current exact viewport breakpoint ladder, requiring capability test/spec updates rather than silently preserving outdated class assertions.
- Compact toolbar and view-toggle treatment could reduce discoverability or touchability. Preserve labels, accessible names, keyboard focus, and practical 44px targets.
- The pagination controls may become the next narrow-width overflow source; include them in the pilot if geometry shows they need containment.
- Existing screenshots may represent a different revision, particularly the Customers filter affordance. Use them as visual evidence, not as a source-of-truth DOM contract.
- Browser geometry is not covered by current jsdom tests. Verification must use the running app and representative data, with any automation addition treated as a separate decision.

## First Slice Scope

The first slice is the responsive mobile-density foundation pilot for exactly these three views:

1. Products list.
2. Customers list.
3. Employees/Colaboradores list.

It includes the shared containment and responsive-density touch points needed by those views: `DashboardLayout` gutter ownership, the pilot list surfaces, `AppDataTable`, `DataTableToolbar`, `ViewToggle`, pilot card grids/cards, and `DataTablePagination` if required to guarantee containment. It includes preservation checks for table-region scrolling and the sticky/fixed right actions column.

It excludes all non-pilot list pages and all data, permission, routing, API, and backend work. Exact component APIs, class choices, DOM selectors, and test implementation are deferred to design/spec/tasks.

## Rollback Plan

Revert the pilot changes as one bounded change set, restoring the prior route-view gutters, responsive grid behavior, and shared density/containment behavior. Keep no data migration or backend rollback step because no persistent data or service contract changes are proposed.

If table scrolling or pinned actions regress during rollout, immediately revert the table-containment portion while retaining no partial workaround that permits page-level overflow. If only one pilot exhibits a content-specific regression, disable that pilot's new layout convention and return it to its prior behavior while investigating the shared foundation.

## Success Criteria

- At 360, 412, and 740 CSS px, the Products, Customers, and Employees/Colaboradores pages have no page-level horizontal overflow in either display mode.
- Card mode does not clip cards, card content, badges, kebabs, or pagination and does not horizontally scroll.
- Table mode retains horizontal scrolling only inside the actual table region; page-level clipping is not used as a substitute.
- The sticky/fixed right actions column remains aligned with the table region and clickable at both horizontal scroll extremes.
- The three pilot views share one dashboard-owned outer mobile gutter without stacked duplicate route gutters.
- Toolbar controls remain reachable and understandable; the mobile three-region contract and filter behavior remain intact, and `ViewToggle` keeps both labels with accessible names and practical touch targets.
- Long representative product, customer, and employee content wraps or truncates within its card without widening the page.
- Existing loading, error, empty, pagination, display-mode persistence, permissions, filters, batch actions, and table data behavior remain unchanged.
- Light and dark modes retain the existing Coco/Nuxt UI visual language and semantic token treatment.
- Existing unit/type/build gates pass, and browser-based responsive geometry evidence covers the three pilots and both modes.
