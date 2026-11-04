# HoundFe global design rules

Use the accepted Caja visual language as the shared foundation, standardize table-based screens first, and use v0 for carefully scoped design exploration. Preserve existing behavior throughout migration. This document defines the design contract; it does not implement or approve a system-wide code rollout.

## Current application rollout

The complete HF audit is now explicitly authorized; track implementation and
coverage in [`hf-ui-complete-audit.md`](../odd/tasks/hf-ui-complete-audit.md).
`App.vue` installs `hf-theme hf-ui hf-app` on `body`, so routed content and
body-targeted teleports inherit the same semantic defaults. Cleanup removes only
markers installed by that App. Importing the stylesheet outside App still does
not activate it. Nuxt cards and dashboard panels use semantic surface defaults.
Legacy surface/text roles are rebound to HF at `.hf-ui`, where the referenced
variables actually exist. Referenced Coco shade scales remain until their
consumers migrate. Legacy actions with forced black foreground retain their HF
gold background temporarily; feature-owned blue actions keep the matching
`--hf-on-action` foreground. Do not flatten status colors into the action color.

This supersedes the historical opt-in-only rollout restrictions below, not their
feature-composition or behavioral contracts. Feature markers still own layout,
spacing and specialized variants; a global boundary does not override literal
child colors or prove nested-overlay coverage. Isolated consumers still need an
explicit boundary. Preserve destructive/status semantics and existing handlers.

Current evidence: 74 tests across eight focused suites, full `pnpm build` and
`git diff --check` passed. Actual product-editor category/SAT menus were checked
at 390/1440px in light/dark: 44px triggers, 2px focus and horizontal containment.
This is not all-route, all-state, contrast or slideover acceptance. Build warnings
for generated `env(...)` CSS and chunks over 500kB remain recorded.

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
| Danger              | `--hf-danger`: `#b42318` (+ `-soft`, `-border`)        | `#ffb4ab`                  | Destructive actions, danger status, errors; see Patrones     |

Destructive and error states use `--hf-danger`, with `-soft` and `-border` for status surfaces (AA pinned in both themes); informational states keep their existing roles until a complete mapping is defined. Do not invent their palette in individual screens.

Light and dark modes are designed as a pair. Never fix one mode by making the other unreadable. Menus, tooltips, dialogs, sheets, and other teleported content need an explicit theme boundary; ancestor-scoped tokens alone do not prove coverage.

## 2. Typography, spacing, and geometry

| Topic            | Rule                                                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typeface         | Geist (Google Fonts, OFL) through `--hf-font`, with the existing system fallback; `--shell-font` and `--font-sans` follow it. Manrope and Inter are retired. Loading failure must leave the interface usable. Weights: 400 body, 500 medium labels, 600 names, titles and badges; 700 is not used for names or titles. |
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
- **Badges:** communicate status with text and color. Selection and financial status must not become visually interchangeable. New work uses `StatusBadge` (dot + tinted background, `urgent` variant); see Patrones.
- **Dialogs and sheets:** keep existing close, submit, keyboard, focus-restoration, and unsaved-change behavior. Visual restyling must not replace accessible primitives with static markup. Apply the feature's theme marker to the actual teleported dialog content, not only its trigger or positioning wrapper. Shared wrappers must use an existing explicit public opt-in; a missing boundary is a migration gap, not permission to change every consumer.
- **Nested popups:** each select, filter menu, row menu and page-size menu needs its own owned content/listbox boundary. A themed dialog or toolbar does not prove coverage of its nested teleports. Verify the installed primitive's prop/attribute path as well as the public contract; stubs and selector fixtures alone do not establish root ownership.
- **Shared presentation opt-ins:** when an existing wrapper needs a theme boundary, an optional `portalClass` may forward to its native `ui.content`. Omission must preserve the previous `ui` value and all native defaults; do not substitute a new empty object. Keep existing width, mobile-sheet geometry, loading, focus and event behavior. Intermediate wrappers must forward to the real teleport owner. Test both opt-in and absent-opt-in behavior before adopting the option in a feature.
- **Responsive drawers:** inspect both breakpoint branches of a wrapper. Theme the native dialog content, not just an inner slot container, while preserving each branch's height, inset, radius, reduced-motion classes and prior `ui` defaults. Keep lifecycle event forwarding intact: a mobile cart closing before a payment sheet opens is workflow sequencing, not a styling detail.
- **Independent nested forms:** a reused form that already owns an accepted theme boundary keeps that boundary. Do not silently repaint another module's form or merge its validation/state to make an enclosing workspace look uniform; any distinct redesign needs its own authorization.
- **Effective child colors:** a portal marker supplies roles but does not replace literal child utilities. Inspect the reached header, active controls and their count badges, prices and secondary labels. Pair solid action backgrounds with `--hf-on-action`, including dark-mode and nested badges; preserve stock/error semantics. Use a feature-owned child boundary so the correction cannot repaint other consumers.
- **Global card theme:** the app-wide `UCard` theme in `vite.config.ts` paints literal `bg-white dark:bg-coco-neutral-900` roots that no semantic alias reaches. Every card in a migrated form or workspace needs a feature-owned section hook (for example `clients-form-section`, `promotions-form-section`) that paints `--hf-surface` and the border role; table pages escape only because `hf-table-surface` repaints its card. Check dark mode, where the legacy tint is most visible.
- **Legacy forced paint:** an important legacy utility cannot be repaired with ordinary scoped CSS. When a shared control explicitly opts into the new theme, select its semantic presentation conditionally while omission keeps the old classes. Do not add blanket important overrides or recolor unreachable workflow steps merely because their source appears nearby.
- **Toolbar select filter:** a single-choice list filter (status, type) is `ToolbarSelectFilter` (`src/core/shared/components/DataTable/ToolbarSelectFilter.vue`), never a native `<select>` or a bare `<label>`. It is a `USelect` (size `sm`, `aria-label` = its title, 44px trigger) inside `FilterSectionCard`, so mobile gets a titled section in the Filtros sheet and desktop (md+) sits inline beside the search on the same row, as in Products. Pass `portal-class` with the feature's HF hook so the listbox is themed, and `test-id` for specs. The view owns the value and the default: wire `active-filter-count` (1 only away from the default) and `@clear-filters` (reset to the default) on the table or toolbar. Do not add feature CSS that moves `.hf-toolbar-filters` onto a second row. The inline layout is a class contract of `DataTableToolbar` and the select: the search (`w-full sm:max-w-sm`) and `.hf-toolbar-filters` (`min-w-0 flex-1`) share one `sm:flex-row` region, the actions are its sibling on the right (`md:flex-row md:justify-between`), the section card is `md:contents`, and the select is `md:w-44 md:shrink-0`, so it can never be squeezed out of the card. Specs pin it (`ToolbarSelectFilter.layout.spec.ts`); the real-browser check is that the filter's box lies inside the table card and refresh and the primary action sit on the search row. References: `PurchaseOrderView.vue`, `SupplierView.vue`; specs `ToolbarSelectFilter.spec.ts`.
- **Editor overlay width:** a create/edit slideover is a right-side `USlideover` whose `ui.content` carries `hf-theme hf-ui hf-form-overlay <feature>-portal`. Nuxt UI caps it at `max-w-md`; a form that needs line cards or a wide table widens that cap explicitly with one `max-w-*` class on the same `ui.content` (purchase orders: `max-w-3xl`, 48rem), never above `max-w-4xl` (56rem). A record with lines or sections is a *record workspace* and takes the 48rem width as its standard (see Patrones, Wide record-workspace slideover). Content must never stretch to the viewport: line length stays scannable and a label stays near its value. A width class that exists only in a `.vue` file is generated by Tailwind's source scan, so verify the width in a real browser at 1440 (see **Evidence servers**).
- **Transition action bar:** actions that move a record between states (confirm, cancel) live in one bar at the top of the editor body, before the form or read-only block: a `<section aria-label="Acciones de la orden" class="order-transition-bar">` (12px radius, `--hf-border`, `--hf-surface-muted`) with the buttons first, left-aligned, and the explanation directly under them as a `role="status"` paragraph. The explanation is always present and says the most useful thing: what is missing (`order-help`), unsaved changes (`order-warning`), or what the action does. Drafts (with the form) and read-only orders share the same bar and the same `data-testid`s; it is absent when no transition is available. Reference: `PurchaseOrderView.vue` (`order-transition-bar`).
- **Evidence servers:** `@tailwindcss/vite` scans for utilities from the Vite root. A throwaway dev server whose root is not the project (`odd/evidence/**/start-runtime-server.mjs`) must add `@source` for `src/` (a pre plugin appends `@source "../";` to `src/assets/main.css`); otherwise every utility that only appears in a `.vue` file (`md:flex-row`, `sm:max-w-sm`, `max-w-3xl`) is missing and the screenshots show a broken layout that production does not have. Before blaming a component, compare the screenshot with the production build.
- **Read-only description lists:** a record shown without edit rights (closed, frozen or permission-limited) is a `<dl>`, not the form with disabled controls. Group label/value pairs in rows; when a record can be shown read-only in more than one state (draft, confirmed, cancelled), one component renders all of them, status included, and server diagnostics appear as readable warnings routed to the field or line they belong to (never raw codes or ids). A read-only view has no buttons, inputs or selects of its own. Lay the pairs out as groups (`<div class="order-detail"><dt/><dd/></div>`, valid inside a `<dl>`): label above value on mobile, two columns from md, with long values (record, location, note) spanning the row (`order-detail-wide`). Line figures are a compact grid (`max-content` label column plus a value column capped at 14rem, right-aligned), never `justify-content: space-between` across the whole width. References: `PurchaseOrderReadonly.vue`, `SupplierView.vue` (`supplier-readonly`).
- **Money in read-only views:** show server decimal strings through `formatDecimalMoney(amount, currency)` (`src/core/shared/utils/currency.utils.ts`): es-MX, **exactly 2 fraction digits** on screen (extra precision rounds half-up for display: `128.125` reads `$128.13`), an unparseable value returned unchanged. The exact value stays available: `decimalMoneyTitle(amount, currency)` returns it (`$128.125`) for the element's `title` **only where the displayed amount was rounded** (`formatDecimalMoneyExact` gives the same text without that condition). It is display-only: never recalculate, and keep the wire string for any request and in data. Money cells are right-aligned with `font-variant-numeric: tabular-nums` (`order-money`); an absent amount reads `—`. Use `formatCentsMXN` only for integer cents.
- **Disabled primary control:** `.hf-primary-control:disabled` (and `[aria-disabled='true']`) is styled once in `houndfe-ui.css` with muted tokens (`--hf-surface-muted`, `--hf-muted`, `--hf-border`), opacity pinned to 1 and `cursor: not-allowed`. Do not fade the primary with `opacity`: it drags the light dark-mode action and its label toward the dark surface (about 3.6:1 at 0.6) and Nuxt UI already applies `disabled:opacity-75`. Feature CSS must not set its own disabled opacity on primaries; a variant background (for example a destructive confirm) is scoped with `:not(:disabled)` so a disabled variant falls back to this treatment. Reference: `purchase-orders-visual.css`.
- **Confirmation summaries:** a dialog that confirms a state transition (confirm, cancel) shows what is affected in a compact `<dl>`: counterpart, location, line count and up to 5 lines as `product · variant — quantity unit`, then `y N renglones más`. It uses readable names only (no ids) and never computes totals; amounts, if any, come from the server. Keep the existing footer, retry on an uncertain result and focus restoration. Reference: `PurchaseOrderSummary.vue`.
- **Feedback:** distinguish initial loading, background refresh, empty data, no filter matches, failure, and success. Do not invent a new retry or operation merely to fill a visual state.
- **Motion:** optional, restrained, and compatible with reduced motion. No animation may delay an operational action.

## 4. Canonical table workspace

Use one recognizable composition, with capabilities selected by the feature rather than enabled everywhere:

**All table pages follow the Products composition:** put the title and subtitle on the page background, outside and above the separate data-workspace surface. Use the shared `hf-page-header`, `hf-page-title` and `hf-page-subtitle` roles, a consistent left alignment, and the same header-to-surface spacing (`gap-6`). Do not wrap both the page heading and table in one card or add another enclosing card. The `hf-table-surface` contains the existing toolbar, feature context, table/card data and footer; preserve each feature's control order and capabilities. This rule applies to table and alternate card modes, not creation/detail forms. Adopt it as modules are changed; it does not authorize an immediate global repaint.

1. **Page header:** title, at most one short subtitle, and existing page-level actions, outside the data surface. Do not duplicate the same primary action in the header and toolbar.
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
- Keep row-action locations consistent: the Acciones column is last and holds only the ⋮ `RowActionsMenu` when a row has more than one action. Moving an action into the menu must not remove required access or change its meaning (see Patrones, Row actions menu).
- Preserve column visibility and pinning capabilities where present; do not add them to every table.
- Keep failure distinct from empty results in table and card modes. Background refresh is not an initial empty loading screen.
- On narrow screens, contain wide-table scrolling inside the data region rather than overflowing the page. Retain the current table/card choice unless a separate interaction change is approved.
- Table and card modes must preserve the same values, eligible actions, permissions, status meanings and failure/empty distinctions. Preserve the existing mode persistence, breakpoint behavior and filter/query ownership; changing presentation is not permission to reset saved preferences or fetch a different data set.
- Targets: readable 14px table text, comfortable vertical padding, and 44px touch hit areas. Validate compact layouts with actual content, long labels, selection controls, and row actions.

### Existing creation/detail workspaces

When creation and detail already share a route-switched workspace, treat them as one presentation boundary and verify both routes. Preserve the existing section order, customer/product interactions, fields, validation, action eligibility and totals; do not force that workspace into the table composition or split state merely to restyle it. Keep its existing sticky regions and bounded or full-width layout according to the current task. Child dialogs and sheets remain part of the same migration inventory.

Evidence: `QuotationDetailView.vue` serves both `/pos/cotizaciones/nueva` and quotation detail; `QuotationsListView.vue` provides persisted table/card modes and feature-owned filters. These are existing contracts, not requests to add this architecture to other modules.

## Patrones

Reusable UI patterns approved on the purchase-order artboards: list `02-propuesta-lista`, open order `04-propuesta-orden` and mobile `05-propuesta-movil` (`design/ui-clarity-orders/`). Each pattern says what it is, when to use it and where it lives. The artboards are the visual source of truth; the code references are the foundation delivered with them. Documentation is not evidence that a screen already follows a pattern: screens adopt them as they are changed.

### Text diet

The screen must answer "what do I read, what do I do next?" at a glance. Four rules decide what text earns its place:

1. **No permanent help paragraphs.** A paragraph that explains the screen, a state or a button does not ship. If it is needed, shorten it to a label or move it to the element it explains.
2. **Help lives next to what it blocks.** A disabled primary action is explained by the checklist right above it (see Issue checklist), a field in error by its own message. Nothing explains a thing that is not in front of the user.
3. **Counts only near the limit.** A character counter appears from 90% of the maximum (`1,850 / 2,000`, 12px, weight 600, `--hf-warning`, `--hf-danger` at the limit, `aria-live="polite"`) and is absent before that.
4. **One primary action per view.** One solid `--hf-action` button per page, slideover or card; everything else is outline, ghost or lives in a ⋮ menu. A primary is never repeated in header and toolbar.

Say each thing once: a pending item appears in the checklist, not also in a banner, a tooltip and a paragraph.

### Balanced color

Surfaces are neutral: `--hf-surface`, `--hf-surface-muted` and `--hf-border`. Color is reserved for three jobs: **status** (badge tones), **urgency** (warning/danger tints and markers) and the **single primary action**. A view with more than one solid colored element, or a decorative colored panel, has too much color. Links use `--hf-action` with an underline; gold stays a brand accent.

### Typography

Geist, through `--hf-font` (`--shell-font` and `--font-sans` follow it; Manrope and Inter are retired). Weights scale: **400** body, **500** medium UI labels and menu items, **600** names, titles, column headings, badges and money, **700 is not used for names or titles** (bold names drop one step). Figures use `font-variant-numeric: tabular-nums` (`.hf-figure`). Sizes: page title 28–32px, detail title 22px (17px on mobile), section 16px, body 14px, secondary 13px, badge and meta 12px.

### Page header

Page background, outside the data surface: the title, and **at most one short subtitle** (`hf-page-header`, `hf-page-title`, `hf-page-subtitle`). If the title says it, there is no subtitle. No eyebrow, no explanation, no design notes. Reference: artboard 02, `houndfe-ui.css`.

### Toolbar

One row inside the table surface: search (360px on desktop, full width on mobile), then the filters, then the primary action at the far right. A single-choice filter shows its name inside the control (`Estado` prefix) instead of a separate label. The refresh button leaves the toolbar (artboard 02); background refresh still shows in the table. Mobile: search on its own row, then filter plus primary action. Reference: `DataTableToolbar`, `ToolbarSelectFilter` (see Toolbar select filter above), artboards 02 and 05.

### Table row

| Part | Rule |
| ---- | ---- |
| Primary text | The record's name, weight 600, `--hf-heading`, one line with ellipsis (`.hf-row-primary`). Held by a real `<button>` or link so assistive tech has a target. It is a **text button, not a 44px control**: `.hf-row-primary` sets `min-height: 0` and no box or padding, because the hit area is the whole row (clickable row), and it keeps a 2px `--hf-focus` ring since it is the row's tab stop. A feature must not give it the 44px control height. |
| Secondary line | One line under the primary, 13px `--hf-muted` (`.hf-row-secondary`): the note or description, never a second name. |
| Clickable row | The whole row opens the primary target on click and Enter (`useClickableRow`, `.hf-clickable-row`); hover is a 45% muted tint and focus a 2px inset ring. |
| Figures | Right-aligned, tabular (`.hf-figure`); absent amount reads `—`. |
| Dates | Short and muted (see Money and dates). |
| Acciones column | Last, 64px, header visible only to assistive tech, **only** the ⋮ menu (`RowActionsMenu`). Never two buttons in this column. |
| Height | 64px rows with a secondary line (cell padding 10px vertical, so a two-line cell is about 64px, never 90px+); 40px column headings in muted 13px/600. |

The clickable-row contract: a click or Enter from an **interactive child** (the ⋮ menu, a link, a checkbox, an input, anything marked `data-row-ignore`) never opens the row; neither do secondary clicks, modifier clicks or a click that ends a text selection. Enter opens only when the row itself has focus. When the primary cell holds its own button, pass `{ focusable: false }` so the row is not a second tab stop. Wiring: `v-bind="rowProps(item)"` on a `<tr>` or card, or `onClick`/`onKeydown` from the composable inside UTable's `@select`. Reference: `useClickableRow.ts`, artboards 02 and 05.

### Status badge

`StatusBadge`: a dot on the left, a tinted soft background and a 600 label, 24px high, 6px radius (artboard 02). Tones: **neutral** (draft/archived/cancelled), **info**, **success** (confirmed/active), **warning**, **danger**. Colors are token pairs defined once in `houndfe-ui.css` and pinned for AA contrast in both themes. Never invent a per-feature color for a state: map the domain state to a tone in the feature.

`urgent` draws more attention without shouting: a deeper tint, a border and an icon in place of the dot (no motion, no solid fill). It is spoken too (`Estado: Vencida, urgente`). Use it for states that need action now; if everything is urgent, nothing is. Next to the badge, an inline marker (`⚠ 1 aviso`: warning icon plus 12px/600 `--hf-warning` text) says there are pending items without a second badge. Selection and financial status never share a tone vocabulary by accident. Legacy `AppBadge` and `StatusDotBadge` stay for unmigrated screens.

### Row actions menu

`RowActionsMenu`: the ⋮ icon button (44px, ghost) opens a menu; every action is an item with an icon and a label. Rules:

- More than one action on a row, card or line goes in the menu; a single frequent action may also surface, but the menu still exists for the rest.
- The `aria-label` names the row: `Acciones de la orden de Distribuidora Veterinaria del Norte, borrador`.
- Order by frequency, then **destructive last, after a separator**, in `--hf-danger` (`Descartar borrador`). Items that need confirmation end in `…` (`Confirmar…`, `Cancelar…`) and open a confirmation; destructive ones keep their confirm dialog.
- Items vary by state (draft: Continuar, Confirmar…, Cancelar…, Descartar borrador; confirmed: Ver orden, Cancelar…). A state with no action shows no ⋮.
- Keyboard: Enter/Space/ArrowDown on the button opens, arrows move, Escape closes and returns focus. Clicks and keys stop at the menu so a clickable row never opens from it.
- The teleported menu carries `hf-theme hf-ui` (plus the feature's `portalClass`).

Reference: `RowActionsMenu.vue`, artboards 02, 04 and 05.

### Money and dates

Money: server decimal strings through `formatDecimalMoney`, **2 decimals on screen, exact on hover and in data** (`title` from `decimalMoneyTitle` where rounding happened; the wire string is never changed), right-aligned, tabular, `—` when absent; the FE never sums amounts (totals come from the server). Dates in lists and meta lines are short and display-only: `formatShortDateTime` gives `3 nov, 20:43` in es-MX, and the year only when it differs from the current one (`3 nov 2025, 20:43`). Keep the wire value for requests and the full date for detail views and tooltips. Never render ids. Reference: `dateTime.utils.ts`, `currency.utils.ts`.

### Detail header

Top of the record workspace (artboard 04), in this order:

1. **Meta line** (13px muted, wraps): status badge, then `location · guardada 3 nov, 20:43`. The date part never breaks inside (`white-space: nowrap`, `.order-header-when`); the location gives way first (`.order-header-where`: ellipsis).
2. **Title** (22px/600, `--hf-heading`, tracking -0.02em, one line with ellipsis): the record's name.
3. **Actions** on the right: **one** primary button (`Confirmar orden`), the ⋮ menu for the rest (`Más acciones de la orden`, destructive last: `Descartar borrador`) and the close button. No loose secondary buttons.
4. **Step strip** underneath when the record has a flow.

On mobile the header is a bar: close, meta plus title, ⋮; the primary moves to the sticky action bar.

### Step strip

`Completar → Guardar → Confirmar`, an `<ol aria-label="Pasos para confirmar">`. Each step is a 22px circle (20px mobile) plus a 13px/600 label, joined by a 24px hairline. States: **done** (`--hf-success` fill, check), **current** (`--hf-action` fill), **upcoming** (outline, muted). The current step is derived from the record: pending items, then unsaved changes, then ready. A count rides on the step it belongs to (`Completar · 1 pendiente`, `(1)` on mobile, `--hf-warning` weight 500). It shows where you are; it is not navigation and does not block.

### Issue checklist

One panel (`--hf-surface-muted`, 12px radius, `--hf-border`, 13px) titled for assistive tech (`aria-label="Pendientes para confirmar"`) above the form, listing **each pending item once**, grouped by **issue family**, never by field: every cost sub-field of a line (amount, currency, unit, taxes) is one `Falta el costo`; the same goes for quantity and for product/variant references. A family spanning several lines is one item (`Falta el costo en 3 renglones`) that links to the first line; order-level issues (supplier, lines) stay single items. An item is an icon, the label and one link (`Falta el costo` + `Ir a Collar ajustable`; `Ver renglón` on mobile). The exact field is marked inside the open line editor, where it is outlined. The link expands the line if needed and focuses the field. States, in priority: pending (`--hf-warning` 600), blocked-by-save (`Guarda el borrador para validar el costo`, muted), all clear (`Lista para confirmar`, `--hf-success`). The disabled primary points at it with `aria-disabled="true"` and `aria-describedby`, so the checklist is the only explanation of why the button is off. The field itself shows `aria-invalid` with a `--hf-danger` border and ring; no repeated message.

### Wide record-workspace slideover

A right-side slideover for editing a record that has **lines or sections** (an order, a route, a quotation). Desktop width is **48rem**: one `max-w-3xl` on the same `ui.content` that carries `hf-theme hf-ui hf-form-overlay <feature>-portal`, `max-width: 100%`, over a dimmed scrim (page at 78% surface). Structure: a fixed header (Detail header), a scrolling body (20px/24px padding) and a fixed footer (Footer save state). On mobile it becomes a full screen with its own top bar and a sticky bottom action bar.

This **refines the Editor overlay width rule**, it does not replace it: a plain create/edit form keeps Nuxt UI's `max-w-md`; a record workspace uses `max-w-3xl` (48rem); nothing exceeds `max-w-4xl`. Content never stretches to the viewport. Use it when the user edits a record with lines or sections, not for a four-field form. Reference: artboard 04, `PurchaseOrderView.vue`.

### Urgency tones

Urgency is shown where the problem is, in the warm tones, and always with text:

- A row or line with a pending issue gets the **`--hf-warning-soft` row tint** (artboards 04, 05).
- The missing value is replaced by **one `Falta` marker**: triangle icon plus `--hf-warning` 600 text in the cell that lacks it (`Falta` instead of the cost). The missing part is a description, not a second visible line: `title` plus an assistive-tech-only span (`.order-missing-part`) on desktop, plain text on the mobile card (`Falta el costo`). The subtotal stays `—`.
- In a list, `1 aviso` beside the status badge; urgent states use `StatusBadge urgent`.
- `--hf-danger` is for what is wrong or destructive: a field in error, the limit reached, the destructive item. Pending is warning, never danger.

### Inline line editing

Lines are **compact rows** (product with variant under it, quantity with unit, unit cost, subtotal right-aligned and tabular, ⋮), not forms. Activating a row (click or Enter, never from the ⋮) expands an **edit row** under it on a muted tint with labeled fields in one grid (quantity · cost · taxes · `Listo`; two columns with the last field full width on mobile). The product button carries `aria-expanded`, `aria-controls` and an `aria-label` that names the line (`Editar renglón 2: Collar ajustable, Chico · Azul`). `Listo` (outline) collapses it and returns focus to the line. A line with an issue opens straight from the checklist link. Per-line actions (`Quitar renglón`, destructive) live in the line's ⋮, never as a trash button on the row. `Agregar renglón` is an outline button in the section heading (`Renglones · 3`).

### Footer save state

The footer of the workspace (border-top, `--hf-surface`) holds the **save state** on the left and the **secondary save action** on the right: `Guardado · 3 nov, 20:43` (word in `--hf-success`, date muted) or `● Cambios sin guardar` (`--hf-warning` dot), `aria-live="polite"`, and `Guardar borrador` as an outline button. The primary action stays in the header, so saving never competes with confirming. Operational save and publication remain distinct (see Component rules).

### Sticky mobile action bar

On mobile the workspace's actions live in a bar pinned to the bottom of the screen (artboard 05): `--hf-surface`, border-top, 12px/16px padding, 8px gap, 44px buttons; the secondary (`Guardar`, outline) and the primary (`Confirmar orden`) have **equal widths** (a grid of equal columns: `display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr)`; not `flex: 1 1 0`, which keeps each control's own padding and leaves mixed buttons unequal) and **centered labels**. The body scrolls under it. It replaces the footer and the header primary on small screens, and never holds more than one primary.

### Mobile cards

On mobile a list row becomes a card (artboard 05): 12px radius, 16px padding. Top: the primary text as the stretched link (the whole card is the target through a `::after` overlay) and the ⋮ at the top-right (-8px margin so the 44px target stays aligned). Under it the secondary line, then the status badge and `aviso` marker, then a separated footer row with `3 renglones · $12,946.00` on the left and the short date on the right. Same data, same actions and same states as the table; use `useClickableRow` or the stretched link, not both. In the order, a line card is two rows on a three-column grid: row 1 is the name (wraps to 2 lines, clamped, never cut to a few letters) with the ⋮ at the top-right; row 2 is `12 Bolsa × $780.50` (or `12 Bolsa × ⚠ Falta el costo`) on the left and the bold subtotal or `—` on the right. The warning tint stays; the tax basis is shown only in the open editor. Secondary fields collapse into a `<details>` row with a one-line summary (`Nota y ubicación · Bodega principal, andén 3`).

### Danger color

`--hf-danger` (light `#b42318`, dark `#ffb4ab`, with `--hf-danger-soft` and `--hf-danger-border` for status surfaces) is the one red. Uses: the destructive menu item, the danger status badge, a field in error, a limit reached, a destructive confirm. Never alone (always text and, for actions, an icon), never as a fill for a primary action, and never for "pending". Contrast over every surface it sits on is pinned at AA in both themes (`hf-danger-token.spec.ts`). It replaces the ad hoc reds (`text-red-*`, `--coco-red`) as screens migrate.

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
