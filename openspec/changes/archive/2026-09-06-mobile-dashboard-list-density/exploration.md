# Exploration — `mobile-dashboard-list-density`

Date: 2026-09-07 · SDD preflight: execution=auto, artifact store=openspec, delivery strategy=ask-on-risk, review budget=400 lines, external research lane=unselected.

## 1. Problem statement

The Products, Customers, and Colaboradores list pages already share `AppDataTable`, `DataTableToolbar`, `ViewToggle`, card-grid conventions, Nuxt UI surfaces, and persisted table/card modes. Their mobile density problem is cumulative rather than isolated: `UDashboardPanel` supplies responsive body padding, each page adds another gutter, each `UCard` clips overflow globally, and each page adds another padded body wrapper around `AppDataTable`. At narrow widths this leaves too little usable content width, while the dashboard-level `overflow-x-hidden` masks descendants that exceed their containing block.

The supplied captures show this in dark mode: narrow centered list cards, tall multi-row toolbars, and card content cut off at the right edge. The intended change is a responsive foundation piloted on these three pages, not a system redesign. Table horizontal scrolling and the sticky right actions column are explicit invariants.

## 2. Rendered width diagnosis

Assuming the default 16px root size and ignoring borders, current horizontal budgets are:

| CSS viewport | Dashboard body | Products list / table region | Customers list / table region | Employees list / table region |
|---|---:|---:|---:|---:|
| 360px | `p-4` → 328px | page `px-10` → 248px / inner `px-5` → **208px** | page `px-10` → 248px / inner `px-6` → **200px** | page `px-4` → 296px / inner `px-5` → **256px** |
| 412px | `p-4` → 380px | 300px / **260px** | 300px / **252px** | 348px / **308px** |
| 740px | `sm:p-6` → 692px | 612px / **572px** | 612px / **564px** | `sm:px-6` → 644px / **604px** |

This explains why Products/Customers are visibly narrower than Employees in the screenshots. At all three target widths, `DataTableToolbar` takes its mobile branch because its boundary is `< md` (768px). At 740px, however, all three card grids take their `sm:grid-cols-2` branch, so toolbar and card-grid responsive decisions are based on different thresholds and the grid does not account for the actual nested content width.

`vite.config.ts` globally configures `UCard.root` with `overflow-hidden`; Products and Employees also add `overflow-hidden` directly. `DashboardLayout.vue` sets `UDashboardPanel.ui.body` to `overflow-x-hidden`. These clipping layers can conceal both intentional table overflow and accidental card overflow, so visual absence of a page scrollbar is not proof of correct containment.

## 3. Layer and ownership map

### Shared layers

| Layer | Source | Current control / diagnosis |
|---|---|---|
| Dashboard page body | `src/app/layouts/DashboardLayout.vue`, `vite.config.ts` | Nuxt UI dashboard body owns `p-4 sm:p-6`; local `:ui.body` adds `overflow-x-hidden`. This is the first gutter and outer clipping authority. |
| Surface | Global `card` config in `vite.config.ts`; each pilot view's `UCard` | Root is rounded, themed, shadowed, and `overflow-hidden`. Header uses Nuxt UI defaults; body padding is disabled through `body: 'p-0 sm:p-0 ...'`. Coco light/dark surfaces are already tokenized and should be preserved. |
| Data composition | `src/core/shared/components/DataTable/AppDataTable.vue` | Root is `flex flex-col gap-4` but lacks `w-full min-w-0`. Chooses table/cards without changing data, pagination, or toolbar ownership. |
| Toolbar | `src/core/shared/components/DataTable/DataTableToolbar.vue` | Below 768px intentionally renders search, wrapping actions, and filters as three regions. Density can be improved inside this contract; collapsing it back to one rigid row would regress the canonical mobile-toolbar spec. Root/actions and slotted controls need explicit shrink/width containment. |
| View selector | `src/core/shared/components/ViewToggle.vue` | Intrinsic two-label segmented control uses `px-3 py-1.5`; it has no compact/mobile contract and no `min-w-0`, wrapping, or label-hiding behavior. It is inserted through the toolbar `#actions` slot. |
| Table | `AppDataTable.vue` → Nuxt UI `UTable sticky` | Existing table path and Nuxt UI's internal overflow behavior are the table scrolling mechanism. `columnPinning` is forwarded unchanged. This path must remain horizontally scrollable within its region. |
| Pagination | `DataTablePagination.vue` | Mobile root stacks, but the controls row is non-wrapping (`flex items-center gap-4`) and has no `min-w-0`; it is an adjacent narrow-width risk even though it is not visible in the supplied captures. |
| Card grids | Three pilot `*CardGrid.vue` files | Repeated `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7` for loading and data. Grid items/tracks lack explicit `min-w-0`; the viewport-based `sm` switch occurs while usable list width is substantially smaller than viewport width. |
| Representative cards | `ProductCard.vue`, `CustomerCard.vue`, `EmployeeCard.vue` | Coco/Nuxt tokenized surfaces and compact 2-column metadata are already aligned. Descendant text wrappers often have `min-w-0`, but card roots and grid tracks do not. Unbroken SKU/email/phone content can therefore contribute min-content width before descendants truncate. Customer/Employee headers stack avatar above identity, increasing height; Product is horizontal. |

### Page-specific layers

| Pilot | View gutter | Card-body wrapper | Toolbar differences | Card-specific observations |
|---|---|---|---|---|
| Products | unconditional `px-10` | `px-5 py-4` | add + refresh + type `USelect w-36` + columns in table mode + `ViewToggle` | Most crowded action set. Product SKU is monospaced but not truncated; root has `min-h-[220px]`. |
| Customers | unconditional `px-10` | `px-6 py-5` | add + refresh + columns in table mode + `ViewToggle`; no actual `#filters` slot in current source | `CustomerCard` has no root `min-w-0`; email and two-column phone/date content match the visible right-edge clipping. The screenshot's “Filtros” control does not match current source/canonical spec, so the capture may predate the checked-in toolbar behavior. |
| Employees / Colaboradores | responsive `px-4 py-3 sm:px-6 lg:px-8` | `px-5 py-4` | add + columns in table mode + `ViewToggle`; status filter opens the mobile sheet; refresh hidden | Less severe outer gutter, but toolbar remains tall. Card has no root `min-w-0`; employee filter behavior is canonical and should remain. Batch actions exist only in table mode. |

## 4. Preserved contracts and reusable foundations

1. Preserve `DataTableToolbar`'s mobile three-region order and bottom-sheet filter behavior from `openspec/specs/data-table-toolbar/spec.md`; improve spacing and control compactness without reverting the structure.
2. Preserve `AppDataTable`'s `displayMode` bridge, loading/error/empty behavior, one pagination owner, and slot contracts.
3. Preserve table mode exactly at the behavior boundary: `UTable sticky`, internal horizontal scrolling, column visibility, sorting/search/pagination, and all `columnPinning` models.
4. Preserve right action pinning: Products and Customers configure `defaultPinning: { left: [], right: ['actions'] }`; Employees does the same in `useEmployeesList.ts`. Existing specs explicitly protect this behavior.
5. Preserve Coco/Nuxt UI language: semantic `bg-default`, `bg-elevated`, `border-default`, `text-*`, Coco neutral surface tokens, rounded cards, and both color modes. No new palette or visual system is needed.
6. Reuse the responsive gutter precedent already present on list/detail pages (`px-4 sm:px-6 lg:px-10`) as evidence that unconditional mobile `px-10` is not a repository-wide requirement. The later design should choose one gutter authority rather than stacking shell and page gutters.
7. Treat `min-w-0`/`w-full` containment as a shared foundation through the list surface, `AppDataTable`, toolbar slots, card-grid, and card root; do not “fix” card clipping by enabling horizontal scrolling in card mode.

## 5. Capability impact

| Canonical capability | Relationship |
|---|---|
| `data-table-toolbar` | **Modified:** retain its three-region mobile contract while adding a denser, contained presentation. |
| `products-list` | **Modified:** responsive page/surface/card layout only; product type filter, persisted mode, and table contracts remain. |
| `customer-list` | **Modified:** responsive page/surface/card layout only; card actions/history and table invariants remain. |
| `admin-employees-list` | **Modified:** responsive page/surface/card layout only; filters, batch actions, permissions, and navigation remain. |
| Dashboard shell / design tokens | Existing shared foundations are consumed; no navigation, visual-language, or color-token redesign is indicated. Whether the shell's `overflow-x-hidden` changes is a design decision, because table overflow must stay locally contained. |

## 6. Likely component boundary for later design

This is reconnaissance, not a committed implementation design. The smallest coherent boundary appears to be:

- a shared list-density/containment convention applied by the three route views and `AppDataTable`;
- a compact responsive behavior in `DataTableToolbar` and `ViewToggle` that keeps their existing props/events and three-region semantics;
- pilot-specific card-grid/card containment and density adjustments, because the three card contents differ;
- no changes to data composables, query contracts, table columns, permissions, routes, or APIs.

A new wrapper component is not yet justified: the three pages differ in header components, filters, action sets, bulk actions, and card events. Shared utility-class conventions or narrowly scoped shared component props may be lower risk than moving orchestration into a new abstraction.

## 7. Existing test map

| Area | Existing coverage | Gap relevant to this change |
|---|---|---|
| `AppDataTable` | `src/core/shared/components/DataTable/__tests__/AppDataTable.spec.ts` covers table/card selection, breakpoints, slot/error/loading/empty/pagination behavior, toolbar forwarding, and toolbar suppression. | No real browser layout, table scroll geometry, or sticky-column position assertions. |
| Toolbar | `DataTableToolbar.spec.ts` covers mobile row order, `flex-wrap`, action order, filter sheet, active counts, and desktop/mobile branching. | The “nothing clips at 360px” test only asserts classes; jsdom does not calculate rendered geometry. |
| ViewToggle | Indirectly stubbed in all three route-view suites. | No direct test for semantics, touch target, compact responsive presentation, intrinsic width, or keyboard behavior. |
| Products | `ProductsView.test.ts` covers display-mode wiring and list surface body class; `ProductCardGrid.test.ts` pins the exact 1/2/3/5/7 ladder; `ProductCard.test.ts` covers tokens, permissions, and keyboard activation. | Exact ladder assertion must be deliberately revised if the responsive strategy changes; no overflow geometry test. |
| Customers | `CustomersView.test.ts`, `CustomerCardGrid.spec.ts`, and `CustomerCard.spec.ts` cover mode, card rendering/events/permissions/content. | Grid ladder is required by canonical spec but not class-asserted in its grid suite; no overflow geometry or card keyboard semantics coverage. |
| Employees | `EmployeesListView.test.ts`, `wu03-card-view.spec.ts`, and adjacent batch/view-mode suites cover mode, pinning, filters, cards, permissions, and batch behavior. | No focused `EmployeeCardGrid`/`EmployeeCard` layout suite and no rendered geometry coverage. |
| Dashboard shell | `src/app/layouts/__tests__/DashboardLayout.test.ts` uses source assertions for Coco bindings and shell controls. | No assertion protects or challenges `overflow-x-hidden`; no browser-level containment test. |

Canonical unit gate is `pnpm test:unit --run`; type/build gate is `pnpm build`. Vitest runs in jsdom and excludes `e2e/**`, and the repository has no Playwright/Cypress dependency, so true geometry cannot be proven by current unit infrastructure alone.

## 8. Practical rendered/browser geometry verification

Use the existing Vite app (`pnpm dev --host`) with authenticated representative data and browser responsive emulation at **360, 412, and 740 CSS px** (set device scale factor/DPR independently; verify `window.innerWidth`, not screenshot pixels). Exercise Products, Customers, and Colaboradores in table and card modes, in light and dark modes.

For each width/page:

- **Outer containment:** `document.documentElement.scrollWidth === document.documentElement.clientWidth`; no page-level horizontal movement.
- **Card mode:** list surface, toolbar, grid, every card, kebab, badge row, and pagination bounding rectangles remain within the content region; grid/card `scrollWidth <= clientWidth`; long names, SKU, email, phone, department, manager, and currency fixtures do not create horizontal clipping.
- **Table mode:** identify the Nuxt UI table scroll element by computed `overflow-x` plus `scrollWidth > clientWidth`; confirm it alone scrolls horizontally. Do not accept dashboard `overflow-x-hidden` merely masking a wide table.
- **Pinned actions:** at `scrollLeft = 0` and `scrollLeft = scrollWidth - clientWidth`, record the actions header/cell `getBoundingClientRect().right`; it remains aligned with the table region's right edge and actions remain clickable. This directly protects the confirmed valued behavior.
- **Toolbar:** at 360/412, all action controls remain visible, reachable, and at least practically touchable; Products is the stress case. At 740, confirm the toolbar still uses its `<md` structure while the chosen card-grid layout does not over-pack the nested content region.
- **Theme:** repeat representative table/card states under light and dark color modes; inspect semantic token surfaces/borders/text rather than introducing mode-specific raw colors.

A repeatable browser-console helper can collect `clientWidth`, `scrollWidth`, `getBoundingClientRect()`, and computed overflow for stable `data-testid` targets. If automation is desired later, adding a browser runner is a separate design/dependency decision; it is not present today and is not selected during exploration.

## 9. Screenshot evidence log

| Evidence | Observation |
|---|---|
| `WhatsApp Image 2026-09-03 at 7.34.59 PM.jpeg` | Products, dark mode: very narrow surface caused by shell + `px-10`; toolbar consumes multiple rows; product card begins below and its dense metadata has little usable width. |
| `WhatsApp Image 2026-09-03 at 7.35.18 PM.jpeg` | Customers, dark mode: card right-side phone/date content is visibly cut; surface and toolbar are narrow. The shown Filters control differs from current checked-in Customers source. |
| `WhatsApp Image 2026-09-03 at 7.36.04 PM.jpeg` | Colaboradores, dark mode: wider than POS pilots due responsive page gutter, but toolbar remains tall and table shows only early columns; this is acceptable only if the table region scrolls and pinned actions remain reachable. |

## 10. CASL, router, sidebar, and API surface

- **CASL subjects:** none new. Existing `Product`, `Customer`, `Sale` history access, and `Employee` permissions remain unchanged.
- **Router:** no route names or paths change.
- **Sidebar/navigation:** no registry changes. `DashboardLayout` is relevant only as a padding/overflow ancestor.
- **API:** no endpoint, DTO, query key, or mutation change. Existing list APIs and server pagination remain untouched.

## 11. Open questions / unknowns

| # | Question | Why it matters |
|---|---|---|
| Q1 | Should the dashboard body remain the sole mobile gutter authority, or should pilot pages retain a smaller nested gutter? | Determines whether the responsive convention is shell-owned or page-owned and prevents another stacked-padding variant. |
| Q2 | Should compact `ViewToggle` keep both labels at 360px, use icons with accessible names, or accept a shared compact prop? | Products' action set is the width stress case; accessibility and discoverability must be retained. |
| Q3 | Should card grids remain viewport-breakpoint based with a later two-column threshold, or use width-aware `minmax()`/container behavior? | At 740px the viewport is `sm`, but the current nested content region is only 564–604px. |
| Q4 | Which exact Nuxt UI descendant is the real horizontal scroller for `UTable` in the installed `@nuxt/ui` version? | The design must place containment without changing table scrolling or sticky pinning. Confirm in rendered DOM. |
| Q5 | Is `DataTablePagination` included in the first pilot slice or only guarded by geometry verification? | Its non-wrapping controls can become the next overflow source after the main surface is widened. |
| Q6 | Are the supplied screenshots from the same deployed revision as this repository? | Customers shows a Filters affordance absent from current source, so screenshots are visual evidence rather than exact DOM truth. |

## 12. Risks and out of scope

| Risk | Mitigation direction |
|---|---|
| Broad shared CSS alters non-pilot list pages | Keep initial shared contracts opt-in or backward-compatible and verify the three pilots before migration. |
| Removing clipping exposes table width at page level | Establish `min-w-0` through ancestors and preserve a dedicated internal table scroll container before reconsidering outer overflow. |
| Changing grid breakpoints breaks canonical ladder tests/spec text | Treat any ladder change as an explicit capability modification with intentional test/spec updates. |
| Density work reduces touch targets or dark-mode clarity | Keep accessible names, focus behavior, semantic tokens, and practical touch sizing in verification. |
| Sticky actions regress while widths improve | Pin browser geometry checks to both scroll extremes and retain all `columnPinning` contracts unchanged. |

Out of scope for this phase and change direction: source implementation, proposal/spec/design/tasks artifacts, backend work, new routes/permissions, broad migration beyond the three pilots, table redesign, removal of horizontal table scrolling, removal/change of sticky actions, and optional external research.
