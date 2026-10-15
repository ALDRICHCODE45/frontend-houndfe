# HoundFe global design rules

Use the accepted Caja visual language as the shared foundation, standardize table-based screens first, and use v0 for carefully scoped design exploration. Preserve existing behavior throughout migration. This document defines the design contract; it does not implement or approve a system-wide code rollout.

## Quick path

1. Classify the screen: table-based workspace or specialized workflow.
2. Record its existing behavior and choose only the table capabilities it already uses.
3. Design against the shared rules below; use v0 to explore representative compositions when useful.
4. Obtain user visual acceptance before applying the reference to application code.
5. Implement a bounded presentation change and verify the preserved contracts.

## Authority and boundaries

- The user-approved retail direction and existing `--hf-*` foundation are the starting point. Do not reintroduce older conflicting color roles from historical redesigns. For migrated surfaces, this document governs over the historical amber/zinc/Outfit defaults in root `DESIGN.md`.
- Adapting an already accepted composition is not a redesign. Preserve its sections, ordering, density and interactions while updating semantic tokens and controls. A new v0 proposal is needed only when a separate composition redesign is requested; do not generate one merely to migrate the palette.
- Caja is a visual reference, not a dependency for other features. Do not import `cash-visual.css` into unrelated screens or copy its financial context rail everywhere.
- The rules apply to future migrated surfaces. Existing screens are not compliant merely because this document exists.
- Numeric guidance marked **target** is a proposed shared standard, not a claim that every current component already implements it. Validate it on representative screens before broad rollout.
- Most screens should share table composition. Venta and Dashboard need specialized composition, not a forced table layout.
- No new library, blanket Nuxt UI removal, API change, business-state rewrite, publication, or global theme switch is authorized by this document.
- User-facing application copy remains neutral Mexican Spanish. Keep established domain terminology.

## 1. Visual foundation

The existing opt-in foundation is [`houndfe-theme.css`](../src/core/shared/design-system/houndfe-theme.css). Components use semantic roles rather than local palette literals.

| Role                | Existing light value                                   | Existing dark value        | Rule                                                         |
| ------------------- | ------------------------------------------------------ | -------------------------- | ------------------------------------------------------------ |
| Page                | `--hf-page`: `#f5f6f8`                                 | `#0e1520`                  | Quiet canvas behind content                                  |
| Surface             | `--hf-surface`: `#ffffff`                              | `#192332`                  | Consistent panels, cards, and tables                         |
| Muted surface       | `--hf-surface-muted`: `#e7eef7`                        | `#202e43`                  | Secondary grouping, not arbitrary accent backgrounds         |
| Main text           | `--hf-ink`: `#24313d`                                  | `#edf2fa`                  | Body and operational data                                    |
| Heading             | `--hf-heading`: `#173968`                              | `#edf2fa`                  | Clear hierarchy                                              |
| Supporting text     | `--hf-muted`: `#576574`                                | `#adbcd0`                  | Readable explanations and metadata                           |
| Border              | `--hf-border`: `#dce2e8`                               | `#354459`                  | Quiet separation                                             |
| Action / foreground | `--hf-action`: `#2442f6` / `--hf-on-action`: `#ffffff` | `#91b0ff` / `#132344`      | Always use the matching foreground                           |
| Selection           | `--hf-active` / `--hf-active-soft`                     | Theme-specific equivalents | Persistent selection, distinct from hover                    |
| Field               | `--hf-field` / `--hf-field-border`                     | Theme-specific equivalents | One visible control boundary                                 |
| Focus               | `--hf-focus`                                           | Theme-specific equivalent  | Visible keyboard focus                                       |
| Gold                | `--hf-gold` / `--hf-gold-soft` / `--hf-gold-ink`       | Theme-specific equivalents | Restrained brand accent, not a default status color          |
| Warning             | `--hf-warning` / `--hf-warning-soft`                   | Theme-specific equivalents | Semantic warning; do not use decorative gold as warning text |
| Success             | `--hf-success`                                         | Theme-specific equivalent  | Semantic success accompanied by text                         |

Error, destructive, and informational states retain their existing semantic roles until a complete theme-specific mapping is defined and checked. Do not invent their palette in individual screens.

Light and dark modes are designed as a pair. Never fix one mode by making the other unreadable. Menus, tooltips, dialogs, sheets, and other teleported content need an explicit theme boundary; ancestor-scoped tokens alone do not prove coverage.

## 2. Typography, spacing, and geometry

| Topic            | Rule                                                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typeface         | Manrope with the existing system fallback. Loading failure must leave the interface usable. Global application requires a separate implementation step.           |
| Page title       | Target: 28–32px, weight 600, line-height around 1.25. One dominant heading per workspace.                                                                         |
| Section title    | Target: 16–18px, weight 600. Do not imitate a second page title.                                                                                                  |
| Operational text | Target: 14–16px. Table text must remain readable at normal zoom.                                                                                                  |
| Supporting text  | Target: 12–14px; never use tiny text to squeeze important information into a layout.                                                                              |
| Spacing          | Target scale: 4, 8, 12, 16, 24, 32px. Related controls use smaller gaps; separate tasks use larger gaps.                                                          |
| Cards / panels   | Existing foundation: 12px radius. Use border and restrained elevation rather than nested decorative cards.                                                        |
| Controls         | Existing foundation: 6px radius and 44px minimum height. A wrapper must not create a second input box.                                                            |
| Density          | Standard density by default; compact tables may reduce whitespace, not hide content or shrink touch targets. Do not add a density toggle unless already required. |
| Icons            | Contextual Lucide icons, consistent sizing. Decorative icons are not additional actions. Icon-only controls need accessible names.                                |

Page width follows the task: data-heavy tables may use available width; forms may use a readable bounded column. Caja's 1320px page limit and 280px rail are local composition choices, not global constraints.

## 3. Shared component rules

- **Buttons:** primary emphasis for the main action in a task region; secondary and tertiary actions remain visually quieter. Destructive actions retain their existing confirmations and guards.
- **Inputs:** visible label, one field surface, readable helper/error text, and a clear focus indicator. A placeholder is not a label.
- **Date fields:** use our calendar component (`UInputDate` with a `UCalendar` popover), never the browser's native `<input type="date">`. A field commits only a complete, real calendar date as its exact `YYYY-MM-DD` string through the shared `calendarPartsToDateString` (`src/core/shared/utils/mexicoCityCalendar.ts`); a cleared, partial or impossible value never commits and snaps back to the last committed date. No JS `Date` is constructed, so no time zone can shift the day. References: `SellerReportDateRangeFilter.vue`, `BranchSalesSummaryFilters.vue`.
- **Cards:** group meaningful content, not every individual label or input. All equivalent surfaces use the same semantic background in both modes.
- **Badges:** communicate status with text and color. Selection and financial status must not become visually interchangeable.
- **Dialogs and sheets:** keep existing close, submit, keyboard, focus-restoration, and unsaved-change behavior. Visual restyling must not replace accessible primitives with static markup. Apply the feature's theme marker to the actual teleported dialog content, not only its trigger or positioning wrapper. Shared wrappers must use an existing explicit public opt-in; a missing boundary is a migration gap, not permission to change every consumer.
- **Nested popups:** each select, filter menu, row menu and page-size menu needs its own owned content/listbox boundary. A themed dialog or toolbar does not prove coverage of its nested teleports. Verify the installed primitive's prop/attribute path as well as the public contract; stubs and selector fixtures alone do not establish root ownership.
- **Shared presentation opt-ins:** when an existing wrapper needs a theme boundary, an optional `portalClass` may forward to its native `ui.content`. Omission must preserve the previous `ui` value and all native defaults; do not substitute a new empty object. Keep existing width, mobile-sheet geometry, loading, focus and event behavior. Intermediate wrappers must forward to the real teleport owner. Test both opt-in and absent-opt-in behavior before adopting the option in a feature.
- **Responsive drawers:** inspect both breakpoint branches of a wrapper. Theme the native dialog content, not just an inner slot container, while preserving each branch's height, inset, radius, reduced-motion classes and prior `ui` defaults. Keep lifecycle event forwarding intact: a mobile cart closing before a payment sheet opens is workflow sequencing, not a styling detail.
- **Independent nested forms:** a reused form that already owns an accepted theme boundary keeps that boundary. Do not silently repaint another module's form or merge its validation/state to make an enclosing workspace look uniform; any distinct redesign needs its own authorization.
- **Effective child colors:** a portal marker supplies roles but does not replace literal child utilities. Inspect the reached header, active controls and their count badges, prices and secondary labels. Pair solid action backgrounds with `--hf-on-action`, including dark-mode and nested badges; preserve stock/error semantics. Use a feature-owned child boundary so the correction cannot repaint other consumers.
- **Global card theme:** the app-wide `UCard` theme in `vite.config.ts` paints literal `bg-white dark:bg-coco-neutral-900` roots that no semantic alias reaches. Every card in a migrated form or workspace needs a feature-owned section hook (for example `clients-form-section`, `promotions-form-section`) that paints `--hf-surface` and the border role; table pages escape only because `hf-table-surface` repaints its card. Check dark mode, where the legacy tint is most visible.
- **Legacy forced paint:** an important legacy utility cannot be repaired with ordinary scoped CSS. When a shared control explicitly opts into the new theme, select its semantic presentation conditionally while omission keeps the old classes. Do not add blanket important overrides or recolor unreachable workflow steps merely because their source appears nearby.
- **Feedback:** distinguish initial loading, background refresh, empty data, no filter matches, failure, and success. Do not invent a new retry or operation merely to fill a visual state.
- **Motion:** optional, restrained, and compatible with reduced motion. No animation may delay an operational action.

## 4. Canonical table workspace

Use one recognizable composition, with capabilities selected by the feature rather than enabled everywhere:

**All table pages follow the Products composition:** put the title and subtitle on the page background, outside and above the separate data-workspace surface. Use the shared `hf-page-header`, `hf-page-title` and `hf-page-subtitle` roles, a consistent left alignment, and the same header-to-surface spacing (`gap-6`). Do not wrap both the page heading and table in one card or add another enclosing card. The `hf-table-surface` contains the existing toolbar, feature context, table/card data and footer; preserve each feature's control order and capabilities. This rule applies to table and alternate card modes, not creation/detail forms. Adopt it as modules are changed; it does not authorize an immediate global repaint.

1. **Page header:** title, short useful context, and existing page-level actions, outside the data surface. Do not duplicate the same primary action in the header and toolbar.
2. **Toolbar:** search and existing filters, followed by relevant table controls and actions. Keep active filters understandable and their clearing behavior unchanged.
3. **Optional context:** existing tabs, summaries, or selection actions only when the workflow has them.
4. **Data surface:** column header, rows, state feedback, and existing row actions.
5. **Footer:** existing totals, page size, result range, and navigation; preserve their actual meaning and query ownership.

The current shared boundary is [`AppDataTable.vue`](../src/core/shared/components/DataTable/AppDataTable.vue), with [`DataTableToolbar.vue`](../src/core/shared/components/DataTable/DataTableToolbar.vue), pagination, and bulk-action components. Prefer adapting existing presentation surfaces over building a second table engine.

### Variants to validate against actual consumers

This is a coverage matrix, not a claim that every screen has been audited or that every capability should be added.

| Use case                          | Shared presentation                                                           | Contract to preserve                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Simple administrative list        | Header, search, rows, existing actions                                        | Existing columns, search scope, navigation, permissions                                     |
| Filtered operational list         | Shared toolbar with feature-specific filters/tabs                             | Filter values, combination rules, reset behavior, URL/persisted state where present         |
| Server-paginated list             | Shared footer and loading feedback                                            | Query parameters, page indexing, page-size behavior, totals, debounce and sorting ownership |
| Selectable list / bulk operations | Selection indicators and contextual action region                             | Stable row identity, selection scope, cross-page semantics, eligibility and confirmations   |
| Rich cells                        | Consistent image, primary text, supporting text, status and numeric alignment | Original values, fallbacks, units, full-detail access and feature-owned formatters          |
| Expandable or grouped rows        | Clear expansion/group hierarchy                                               | Existing expansion state, nested actions, aggregate meaning and loading ownership           |
| Wide analytical table             | Legible numeric columns and contained horizontal scrolling                    | Required columns, exact precision, totals, existing pinning and visibility rules            |
| Mobile cards / alternate display  | Same hierarchy and tokens, feature-owned card content                         | Same data/actions/error states; existing display-mode and breakpoint behavior               |

Before implementation, map actual table consumers to this matrix and record exceptions. Missing cases extend the matrix with evidence; they do not justify speculative props or a universal configuration language.

### Table details

- Align names and descriptive text left; numbers and money right; use tabular numerals for comparisons.
- Preserve currency, units, precision, timezone, and existing domain formatters. Styling is not permission to recalculate values.
- Use restrained dividers and readable column headings. Make sortable columns identifiable only where sorting already exists.
- Distinguish hover, keyboard focus, selection, disabled actions, and status. Row hover alone is not selection.
- Keep identifiers, totals, and essential actions discoverable. Long notes may wrap or have a deliberate full-content path; do not silently truncate information.
- Keep row-action locations consistent. Do not move an action into an overflow menu if doing so removes required access or changes its meaning.
- Preserve column visibility and pinning capabilities where present; do not add them to every table.
- Keep failure distinct from empty results in table and card modes. Background refresh is not an initial empty loading screen.
- On narrow screens, contain wide-table scrolling inside the data region rather than overflowing the page. Retain the current table/card choice unless a separate interaction change is approved.
- Table and card modes must preserve the same values, eligible actions, permissions, status meanings and failure/empty distinctions. Preserve the existing mode persistence, breakpoint behavior and filter/query ownership; changing presentation is not permission to reset saved preferences or fetch a different data set.
- Targets: readable 14px table text, comfortable vertical padding, and 44px touch hit areas. Validate compact layouts with actual content, long labels, selection controls, and row actions.

### Existing creation/detail workspaces

When creation and detail already share a route-switched workspace, treat them as one presentation boundary and verify both routes. Preserve the existing section order, customer/product interactions, fields, validation, action eligibility and totals; do not force that workspace into the table composition or split state merely to restyle it. Keep its existing sticky regions and bounded or full-width layout according to the current task. Child dialogs and sheets remain part of the same migration inventory.

Evidence: `QuotationDetailView.vue` serves both `/pos/cotizaciones/nueva` and quotation detail; `QuotationsListView.vue` provides persisted table/card modes and feature-owned filters. These are existing contracts, not requests to add this architecture to other modules.

## 5. Using v0 without replacing application behavior

v0 is a design collaborator for the shared table reference and specialized screens. Its output is a visual proposal, not authoritative application code.

### Brief requirements

Provide the global rules, representative composition, realistic anonymized content, light/dark and narrow-screen requirements, and the existing interaction inventory. Never provide credentials, live customer data, or other sensitive records.

A brief must explicitly require:

> Preserve all existing behavior. Redesign presentation only. Do not add, remove, or reinterpret actions, permissions, validation, calculations, filters, navigation, or data states. Use the shared semantic palette and component rules. Mark any unsupported interaction as a proposal rather than implementing it.

The reference must show normal, loading, empty, error, selected, disabled, and overflow states **where applicable**. Use representative variants rather than pretending one static screenshot covers every table use case.

### Adoption boundary

1. Compare the v0 proposal with the recorded interaction inventory.
2. Have the user accept the visual direction; visual smoke remains user-owned.
3. Translate the accepted presentation into the existing Vue components and shared tokens.
4. Reject generated replacement stores, mock business logic, new fetch layers, dependencies, or framework migrations.
5. Preserve routes, handlers, queries, permissions, validation, calculations, and persisted state; verify them through the existing public interfaces.

Accepted v0 references so far: Venta and Dashboard (section 6). Commit an accepted reference's exported source verbatim under `docs/redesign/` as one Markdown document, not loose `.tsx` files, so the React/Next sources never enter type-checking or lint.

## 6. Specialized screens: Venta and Dashboard

Both screens inherit the same colors, typography, controls, surfaces, and accessibility rules. They may have distinct composition because their tasks differ.

| Screen    | Design focus                                                             | Before any source change                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Venta     | Product discovery, cart readability, totals and payment-action hierarchy | Inventory existing search, product/variant/quantity interactions, pricing/discount/tax calculations, payment and session flows, permission gates, navigation and recovery behavior where present |
| Dashboard | Information hierarchy, scanability, chart and summary composition        | Inventory actual metrics, date/branch filters, loading/error states, role-dependent visibility, drill-down routes and existing refresh behavior                                                  |

Inventories describe actual functionality; they are not requests to introduce these features where absent. Do not change a metric definition, amount, payment step, or action availability to fit a mockup. Any proposed interaction change must be separated from presentation and explicitly approved.

### Venta: fidelity to the accepted composition

The [accepted v0 reference](https://v0.app/bdps-projects/chat/houndfe-pos-design-kJv5cfVx4pL) governs the sale-creation composition, not just its palette. Compare the complete workspace, catalog and cart separately. A token-based repaint is not a faithful adaptation when section ordering, surfaces, density or alignment still differ.

| Region | Composition contract |
| ------ | -------------------- |
| Workspace heading | Place `PUNTO DE VENTA` above `Nueva venta` on the page canvas, before the draft strip. Preserve the existing application navigation; do not replace it with the demo sidebar. |
| Workspace geometry | Keep the catalog and cart in one centered, bounded workspace. The reference bounds the workspace at 1900px and uses a 420px desktop cart above 1500px. Measure the visible cart surface, not a wrapper that includes extra padding. These are Venta-local reference dimensions, not global page limits. |
| Catalog controls | A separate 12px-radius surface contains `Catálogo de productos`, the real result count, the `Buscar producto` label, search field and category controls. Do not wrap the controls and the entire product grid inside one tall decorative card. |
| Product grid | Preserve the reference's spacious three-column desktop composition instead of adding more columns just because the viewport is wider. Its narrower desktop variant uses two columns; mobile stays within the accepted responsive workflow. Loading and loaded states share the same geometry. |
| Product cards | Use the existing 12px card radius, bordered surface, proportional media and a distinct information region. Preserve name, details, price, stock and the existing add/variant affordance. Do not shrink typography or omit actions to increase density. |
| Cart surface boundary | The desktop pane and mobile portal are layout hosts, not additional decorative cards. Let the cart own one 12px-radius surface and apply its local presentation through the same exact Venta opt-in on both hosts. Preserve omitted and unrelated opt-ins; do not use a truthy portal class as permission to activate the new composition. |
| Cart heading and pricing | Keep `Tu venta`, its real count and supporting context above a separate price-list band. Existing sale/order controls and menu actions must remain accessible, even when absent from the prototype. |
| Cart rows | Use image-led rows separated by dividers, not an extra rounded card around each item. Keep product identity, details, unit-price context, quantity and line total in the reference hierarchy. Preserve actual discount/promotion/error states and all quantity, removal and menu actions. |
| Cart summary | Preserve the sequence of eligible promotions, customer/address context, item/unit summary and clear action, subtotal/discount breakdown, dominant total and full-width `Cobrar` action. Existing availability guards and workflow sequencing remain authoritative. |
| Promotion scroll ownership | In the accepted Venta composition, eligible promotions follow the items inside the scrolling body and precede customer context. Keep customer, totals and payment controls in the fixed footer; a growing promotion list must not consume that footer. Apply this ordering only to the explicit Venta variant and preserve legacy placement and callbacks elsewhere. |
| Adapter cascade | Prove an owned declaration against the inherited adapters it competes with, in both stylesheet orders. Match actual production root/hooks and increase narrowly scoped specificity where needed; do not rely on import order, `!important`, or selectors that repaint a protected adapter. An isolated stylesheet assertion is insufficient when a legacy selector wins the combined cascade. |
| Shell-aware gutters | The dashboard shell body already pads routed pages (16px, 24px from `sm`). The prototype has no such host, so its 32px workspace gutter is the TOTAL: Venta adds only the remainder (0 below `lg`, 8px from `lg`). Never stack the reference gutter on top of the shell padding; doubled gutters squeeze the content and read as cramped. |
| One shared edge | Heading, draft strip, catalog controls and product grid start and end on the same edge; panes and the results grid add no inward inset. Declare the shared padding for all edge owners together, before their media blocks: a later equal-specificity base rule silently defeats a breakpoint and produces a stepped ("escalonada") layout. |
| Cart divider rhythm | Inside the cart, rules are either the full-bleed heading/price-list bands or inset to the 20px content edge — never alternating. Keep sale options (`···`) in the heading and the single `Vaciar` action in the summary; do not add a separate full-bleed toolbar row between customer and totals. |
| Row interaction paint | Divider rows have no horizontal padding, so a hover background hugs the content and looks broken. Do not paint row hover backgrounds in the Venta cart; interaction feedback belongs to the row's own controls. |
| Checkout paint | The Venta checkout maps Nuxt `--ui-warning`/`--ui-primary` to `--hf-warning`/`--hf-action` on its owned `.sales-pos-checkout` marker, so alerts, badges and links never fall back to the legacy gold or the bright yellow that is unreadable on white. Method tiles follow v0: one horizontal line (muted icon · label · count), blue selection, neutral total panel, plain received/remaining rows. Shared consumers (sale detail) keep their tested defaults because they never receive the marker. |
| Catalog card actions | In Venta the card follows v0: media and name are buttons that open the product detail, and the visible full-width action (`Agregar`, or `Ver variantes` in the action color) is the only add path. The whole card is not a click target. Show identity (`MARCA · SKU`), a detail line only from a real description or the variant count (`N presentaciones`), the price or `Desde` lowest variant price, and stock only under the existing `useStock` gate (low stock in warning ink). Keep the media at the v0 1.42 ratio without a height ceiling. Other consumers (quotations) keep the whole-card select. |
| Product detail | The Venta detail uses a v0 hero (image, `MARCA · CATEGORÍA` eyebrow, name with the selected variant, description, dominant price and `Precio lista · <lista>`), a neutral fact sheet (SKU, Código de barras, Stock, Ubicación, Marca) and variants as 64px selectable choices. Opened from a catalog card, the first variant is preselected instead of an empty product price. Missing facts read `No registrado`, `Sin ubicación` or `Sin marca`; never invent them. Keep the existing footer actions. |
| Exact opt-in token | Detect the Venta opt-in only through `hasSalesEntryToken()` (`src/features/POS/sales/utils/salesEntryPortal.ts`), which matches the whole `sales-entry-portal` class token. Never test it with a substring `includes`: a class such as `not-sales-entry-portal` would receive the Venta paint. |
| Single component root | A presentation variant switched with `v-if`/`v-else` must keep one root element: place explanatory comments inside the element. A comment before the root turns the component into a fragment and silently drops inherited attributes and classes for every consumer. |
| Production detail lines | Map reference detail lines only to fields the production contract actually exposes. A cart item currently has `variantName`, not a product-description field: show the variant when available and omit unavailable description text. Do not invent a description or change the data contract to fill a demo's visual space. |

Reference geometry must be translated through the shared semantic foundation: 12px surfaces, 6px controls, readable operational/supporting text and 44px hit targets still apply. Do not copy the prototype's miniature labels, static quantities, invented stock, calculated demo totals, sample images or demo-only state selectors. Missing product imagery uses the existing production fallback; zero prices or empty promotions must not be replaced with demo data to make a screenshot match.

Scope every new presentation rule to Venta's explicit owned boundary. Reused catalog/cart components, omitted opt-ins, other modules and existing nested forms retain their defaults. Error/destructive roles must not inherit the generic action foreground. Both themes need the same hierarchy; do not introduce local palette literals or blanket overrides.

### Dashboard: fidelity to the accepted composition

The [accepted v0 reference](https://v0.app/bdps-projects/chat/ps6ftjVkTIL), exported verbatim to [`dashboard-v0-reference.md`](redesign/dashboard-v0-reference.md), governs the `/dashboard` composition and motion. Feature record: [`odd/tasks/dashboard-visual.md`](../odd/tasks/dashboard-visual.md).

| Region | Composition contract |
| ------ | -------------------- |
| Page frame | The header sits on the page canvas, never inside a card: gold-square eyebrow `CONTROL DE VENTAS`, `Resumen de ventas`, its subtitle, and the period block on the right. Content is a centered 1320px column of independent 12px panels with 24px gaps, closed by the page footer. No single card wraps the whole page. |
| Shell-aware gutters | Same rule as Venta: the shell body pads routed pages (`p-4 sm:p-6`) and paints the page plane. The reference's 52/40/76px gutter is the TOTAL, so the dashboard root is transparent and adds only the remainder (12/0/14px, 28/16/52px from `sm`). Painting a page background on the root draws a seam inside the shell padding. |
| Period controls | Four presets in a segmented control with a sliding indicator. The indicator moves by `translateX(index * 100%)`, which is only correct over equal-width tracks, so the presets sit in an equal-column grid. The custom range opens a popover holding two calendar fields (see **Date fields**); each field's calendar is a nested popover inside the range popover, and picking a day must not dismiss the outer one. |
| Metrics | A hero for `Ventas netas`, then five cards, then a separate refunds band (different accounting meaning, no sparkline). `Cantidad de ventas` is a count, never currency. The six sparklines read the already-fetched daily series, one backend field each, in backend order with the array index as X; a missing series renders no sparkline rather than a flat line. |
| Charts | Keep `@unovis/vue`. Its dark mode only detects its own selectors, and the app uses `html.dark`, so the `.dark` overrides are required. A Y accessor must get a new identity per metric or Unovis skips the re-render. Axis ticks are compact and rounded (`formatBranchSalesTimeseriesAxisTick`): a tick is whatever the library picks, so an unrounded label prints a cents tail. Exact values live in the tooltip and the `Ver datos en tabla` table. Build tooltip content with `textContent`, never HTML strings. |
| Motion | CSS plus `@vueuse/core` `useTransition` for number tweens; framer-motion and recharts are not dependencies. Entry is staggered once per mount; refresh dims content to 0.6 instead of blanking it. Every feature stylesheet carries a `prefers-reduced-motion` branch that removes tweens, draw-ins, staggers and slides. |
| Independent states | Summary, trend and each operational panel load, refresh and fail independently; one failure never hides a sibling. Skeletons render inside the final geometry, never synthetic numbers. |
| Panel grid | The column count follows the granted panels (`read:Sale` → two, `read:SaleRefund` → one). `repeat()` takes a literal integer: browsers drop a declaration whose track count is `min()`/`calc()`, silently keeping the wider layout. Narrow tiers select on the rendered `data-panel-count` attribute instead. |
| Stylesheet ownership | One stylesheet per block (`dashboard-visual`, `-metrics`, `-trend`, `-panels`.css) so separate work units stay disjoint and individually reviewable. |

**Evidence rule:** screenshots establish reported visual differences; the reference source establishes declared dimensions and section structure. Cropping, zoom and browser chrome can change apparent sizes, so do not infer exact CSS pixels from a screenshot alone. Public regression tests and source contracts establish bounded behavior, not rendered fidelity. The user owns real-browser flow and visual smoke checks, and a reported visual mismatch reopens acceptance even when tests pass.

**Evolving rules:** as a migrated interface exposes a recurring composition or boundary problem, add a concise rule here with its reference and applicability. Keep feature-specific dimensions in the specialized-screen section; promote a rule globally only when actual consumers justify it. Documentation is not evidence that the application already implements the rule.

## 7. Maintainability and migration

- Keep shared visual roles in the design foundation; keep feature data, queries, rules, and state in their existing owners.
- Keep Nuxt UI-specific mappings at an owned presentation boundary. Do not scatter alias overrides or palette literals across views.
- During bounded migration, an existing feature token vocabulary may remain as compatibility aliases to `--hf-*` roles inside an explicit feature opt-in. Keep legacy selectors and unmigrated consumers unchanged; do not replace a historical token layer globally. Give teleported content the same owned alias boundary, and preserve semantic error/warning/info roles rather than mapping every accent to the primary action color.
- Reuse the current DataTable components and slots when they fit. Extract a primitive only for demonstrated repeated presentation; do not create wrappers that only rename props.
- Do not copy Caja-prefixed classes into unrelated features. Promote genuinely shared styles deliberately, preserving existing consumers.
- Never turn presentation migration into an unrelated component cleanup, state rewrite, or library replacement.
- A change to a shared component can affect unmigrated consumers. Scope or gate the new presentation and verify the existing contract before broad adoption.

Recommended sequence:

1. Map existing table variants and choose representative screens.
2. Explore and accept a shared table reference with v0 against this document.
3. Implement that reference in a bounded pilot and check existing behavior.
4. Roll out by coherent module using the same pattern; record only justified exceptions.
5. Redesign Venta and Dashboard as separate bounded deliverables using v0 and explicit behavior inventories, in a user-selected order.

This sequence is a recommendation, not an implementation checklist. Venta and Dashboard have both since been redesigned from accepted v0 references; their composition contracts are in section 6.

## Acceptance checklist for each future migration

- [ ] Uses shared semantic roles in both themes, including teleported overlays.
- [ ] Uses the same typography, spacing, radii, control, and table hierarchy.
- [ ] Supports keyboard focus, accessible names, and readable status feedback.
- [ ] Checks contrast targets: 4.5:1 for normal text, 3:1 for large text and required non-text UI indicators. Token presence alone is not proof.
- [ ] Handles long text, narrow layouts, zoom, and applicable data states without losing actions or information.
- [ ] Preserves routes, events, API/query contracts, permissions, calculations, validation, persistence and selection semantics.
- [ ] Keeps existing functionality checks; adds focused regression coverage where presentation changes touch shared behavior.
- [ ] Obtains user visual acceptance; automated tests do not establish visual fidelity.
- [ ] Records any proposed behavior change separately rather than silently implementing it.

## Evidence and related documents

- [Caja pilot](houndfe-caja-pilot.md): existing opt-in foundation, adapter boundaries, font fallback and overlay limitations.
- [Nuxt UI Table reference](NuxtUI/Table.md): component documentation, not an inventory of application consumers.
- `AppDataTable.vue`: existing sorting, pagination, filters, pinning, visibility, selection models; add/refresh/clear events; table/card modes and feature slots.
- `DataTableToolbar.vue`: existing responsive filter handling and feature-owned active-filter counts.

Evidence is bounded to the shared interfaces and accepted Caja foundation. A system-wide consumer audit, v0 reference generation, source migration, browser verification, and behavior changes are not part of this document-only delivery.
