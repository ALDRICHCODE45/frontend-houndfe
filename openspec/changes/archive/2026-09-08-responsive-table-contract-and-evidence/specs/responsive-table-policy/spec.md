# Responsive Table Policy Specification

## Purpose

Define one responsive contract for the 27 inventoried repeated-record surfaces, while preserving domain-specific presentation choices. The policy applies to shared `AppDataTable` surfaces (`DT-01`–`DT-15`), native tables (`NT-01`–`NT-07`), and list/matrix hybrids (`HY-01`–`HY-05`). It addresses audit root-cause families `R1`–`R7`; rendered proof is governed by the browser evidence capability and `R8`.

## Requirements

### Requirement: RT-REQ-001 Exact Responsive Evaluation Matrix

Every applicable surface MUST pass the policy at exactly **320, 375, 768, and 1024 CSS px**. The effective strategy MAY differ by domain and archetype, but the invariants in this matrix MUST hold.

| Viewport | Required policy outcome |
|---|---|
| 320 CSS px | The document MUST NOT overflow horizontally. A wide table MAY use one contained, discoverable local scroll region; a card, list, or stacked row MUST NOT create horizontal scrolling. Essential identity, status/value, and primary action content MUST be visible or predictably reachable. Toolbar, filters, pagination, bulk actions, states, focus, and overlays MUST remain usable within their owning container. |
| 375 CSS px | The same no-document-overflow and local-scroll rules MUST hold under long and dense data. Primary information and actions MUST remain visible or predictably reachable, and all actionable targets MUST meet the target and keyboard requirements. |
| 768 CSS px | The `md` boundary MUST be evaluated as an exact viewport, not inferred from a nearby width. Desktop or intermediate rendering MAY begin here, but every table, adjacent control, shell gutter, sticky element, and overlay MUST remain contained and usable. |
| 1024 CSS px | The `lg`/shell transition MUST be evaluated exactly. Sidebar, navbar, card, modal/slideover, sticky-footer, pinned-column, and viewport-height behavior MUST remain aligned without document overflow or obscured controls. |

#### Scenario: Exact matrix is executed

#### Given

- A surface is in scope under `DT`, `NT`, or `HY`.
- The evaluation set contains 320, 375, 768, and 1024 CSS px.

#### When

- The surface is evaluated at each listed width.

#### Then

- A result exists for every listed width and every applicable policy invariant.
- The result identifies the surface's selected strategy and container owner.

#### Then (negative)

- A result at 360, 412, or an unrecorded approximate width MUST NOT be presented as proof for the exact matrix.

### Requirement: RT-REQ-002 Domain-Aware Rendering and Mode Compatibility

The effective responsive strategy MUST be selected per domain/archetype and available container, not by a universal table-to-card rule. Generic CRUD, transaction history, exception queues, operational dispatch, embedded editable pricing, transaction details, live POS cart, settings matrices, and ordered lists MAY use different table, card, list, stacked-row, or hybrid renderings. The policy MUST NOT require all tables to become cards and MUST NOT hide columns generically.

Persisted `displayMode`, column visibility, and pinning preferences MUST remain backward-compatible. A persisted explicit table mode MUST NOT exempt a surface from responsive validation (`R1`); it MAY continue to render a table only when that table strategy satisfies this policy. If the effective policy requires another supported rendering, the fallback MUST be documented per surface, MUST preserve the stored preference for later compatible contexts, and MUST NOT silently delete or rewrite the stored preference. Persisted column settings MUST NOT hide domain-essential fields, and API sort identifiers MUST remain stable.

#### Scenario: Explicit table preference remains a valid narrow strategy

#### Given

- A `DT` surface has persisted `displayMode: table`.
- Its domain policy permits a wide table at 320 CSS px.

#### When

- The surface renders at 320 CSS px.

#### Then

- The table MAY remain active inside its owned local scroll region.
- The stored mode and column preference values remain available after the render.
- Essential fields and actions remain visible or predictably reachable.

#### Scenario: Explicit table preference cannot bypass policy

#### Given

- A `DT`, `NT`, or `HY` surface has a persisted wide-mode preference.
- That mode would cause document overflow, inaccessible clipping, or loss of an essential field at 375 CSS px.

#### When

- The surface selects its effective responsive presentation.

#### Then

- The surface uses a documented compatible strategy, such as contained table scrolling or an equivalent domain-specific substitution.
- The persisted preference is preserved for a compatible context or explicit user change.

#### Then (negative)

- The surface MUST NOT let persisted mode force page overflow, silently discard the preference, or apply generic column hiding as the only remedy.

### Requirement: RT-REQ-003 Essential Information and Semantic Equivalence

Every surface MUST identify, by domain review, its essential **primary identity**, **status/value**, and **primary action** fields. Each essential field and action MUST remain visible in the active presentation or be predictably reachable through an explicitly named interaction. Financial amounts, status, permission, operational, identity, and order-changing information MUST NOT be removed solely because the viewport is narrow.

A native table MUST retain valid table semantics, including an associated caption or accessible name, header associations, and row/cell relationships. A card, list, or stacked-row substitution MUST expose semantics appropriate to its presentation (for example, list/listitem, article, or button), accessible names, the same essential information, and equivalent action outcomes. Visual arrangement MAY change; meaning and operability MUST remain equivalent.

#### Scenario: Essential fields survive a card substitution

#### Given

- A transaction-history `DT` surface changes from table mode to cards at 320 CSS px.
- Domain review identifies folio/customer identity, payment status or total value, and open-detail as essential.

#### When

- A record card renders.

#### Then

- Those identity, status/value, and primary action affordances are visible or predictably reachable.
- The card exposes an accessible name and an action with the same outcome as the table row.

#### Scenario: Native table remains semantically navigable

#### Given

- An embedded pricing or sale-detail surface is rendered as a native table.

#### When

- The table is inspected by a semantic or accessibility assertion.

#### Then

- Its table, header, row, and cell relationships remain exposed.
- Header and action names identify the associated data and operation.

#### Then (negative)

- A substitution MUST NOT preserve pixels while omitting essential values, accessible names, table associations, or equivalent actions.

### Requirement: RT-REQ-004 Overflow Ownership and Discoverability

The document/page MUST NOT have horizontal overflow at any matrix width. Permitted wide-table scrolling MUST belong to one bounded local region whose width is contained by its shell, card, modal, slideover, or other owning container (`R2`, `R4`, `R7`). A local-scroll region MUST have a discoverable affordance or instruction that communicates additional horizontal content, without relying on a hidden scrollbar alone. Cards, lists, and stacked rows MUST not introduce horizontal scrolling.

Long unbroken names, email addresses, SKU/IDs, account numbers, CLABE, currency, dates, status chips, and multi-badge rows MUST wrap, break, scroll locally, or otherwise remain predictably reachable without widening the document or silently clipping content (`R6`).

#### Scenario: Permitted table scroll is contained and discoverable

#### Given

- A table strategy is selected for a 320 CSS px surface.
- Its columns cannot be represented without horizontal scrolling.

#### When

- The user views the table and moves through its horizontal content.

#### Then

- Only the table's named local region scrolls.
- The region is visibly or accessibly discoverable as horizontally scrollable.
- The page remains within the viewport width.

#### Scenario: Long stress values do not widen the page

#### Given

- A row contains a long unbroken email, CLABE, SKU, currency value, date, and multiple badges.

#### When

- The row renders at 320 and 375 CSS px.

#### Then

- The row remains contained and its values remain visible or predictably reachable.

#### Then (negative)

- The page MUST NOT gain horizontal overflow, and the surface MUST NOT silently clip a critical value merely to preserve a desktop width.

### Requirement: RT-REQ-005 Adjacent Controls and State Usability

Search, filters, filter sheets, view toggles, pagination, bulk actions, loading, fetching, empty, no-match, and error states MUST remain usable and contained at every matrix width (`R5`). Adjacent controls MAY wrap, stack, scroll within their own explicitly owned region, or use a domain-appropriate arrangement. State changes MUST preserve the table/card/list contract and MUST not remove retry, pagination, selection, or filter access without a documented reason.

#### Scenario: Dense toolbar remains usable at 320 CSS px

#### Given

- A `DT` surface has search, filters, a view toggle, pagination, and bulk actions.
- The viewport is 320 CSS px.

#### When

- The toolbar and table states render, including a fetching transition.

#### Then

- Search, filter access, mode selection, selection actions, and pagination remain reachable without page overflow.
- Loading and fetching feedback is distinguishable from empty, no-match, and error states.

#### Scenario: Non-success states retain useful actions

#### Given

- A surface is loading, empty, no-match, or failed at 375 CSS px.

#### When

- The corresponding state renders.

#### Then

- Loading communicates progress, empty and no-match communicate their distinct meanings, and error exposes its permitted retry or recovery action.
- No state introduces an uncontained control cluster.

#### Then (negative)

- An empty or error result MUST NOT be mistaken for a successful empty dataset, and a bulk-action defect MUST NOT be broadened into this responsive contract.

### Requirement: RT-REQ-006 Interactive Targets, Keyboard, and Focus

Every actionable target, including row actions, switches, pagination controls, view choices, filter controls, drag alternatives, and overlay controls, MUST provide a hit area of at least **44 by 44 CSS px** in both dimensions (`R3`). The visual icon MAY be smaller when the actionable hit area is expanded. Controls MUST have accessible names, keyboard activation, visible focus, and a logical focus order matching the active visual/semantic order (`R7`). Dragging or swipe-only interaction MUST have a keyboard-operable alternative.

When a modal or slideover opens, focus MUST move into the active overlay according to its component contract; when it closes, focus MUST return to the invoking control unless that control no longer exists. Sticky headers/footers MUST NOT obscure the focused element.

#### Scenario: Row action meets target and keyboard requirements

#### Given

- A row contains a kebab, edit, delete, or primary action at 320 CSS px.

#### When

- The action is measured and activated by keyboard.

#### Then

- Its bounding hit area is at least 44 by 44 CSS px.
- It has a visible focus indicator, an accessible name, and the expected action when activated from the keyboard.

#### Scenario: Overlay focus is restored

#### Given

- A filter sheet, modal, or slideover is opened from a focused trigger.

#### When

- The user closes the overlay with its close control, Escape, or the documented completion action.

#### Then

- Focus returns to the invoking control when it remains available.
- The overlay's controls were reachable in a logical keyboard order while open.

#### Then (negative)

- Hover-only access, an icon-only unnamed action, a sub-44 hit area, or drag-only reordering MUST NOT satisfy this requirement.

### Requirement: RT-REQ-007 Sticky, Pinned, Shell, and Overlay Constraints

Sticky headers and pinned columns MUST remain aligned with their cells and usable at both the minimum and maximum horizontal-scroll positions whenever local scrolling is permitted. Shell/sidebar/navbar gutters, card boundaries, modal/slideover widths, sticky footers, and viewport-height constraints MUST be owned by their containing layout and MUST NOT mask overflow or obscure content (`R7`). Overlay surfaces MUST evaluate their available container width rather than assuming the viewport width.

#### Scenario: Sticky and pinned content works at both scroll extremes

#### Given

- A `DT` or native table has a sticky header or pinned action column.
- The table's local scroll region has additional horizontal content.

#### When

- The local region is inspected at `scrollLeft = 0` and at its maximum scroll position.

#### Then

- Sticky headers and pinned cells remain aligned, readable, and actionable at both extremes.
- No pinned element creates document overflow or covers essential content.

#### Scenario: Narrow overlay owns its table width

#### Given

- A native pricing table or POS hybrid is rendered inside a modal or slideover at 320 CSS px.

#### When

- The overlay and its repeated records render.

#### Then

- The records fit, wrap, substitute, or locally scroll within the overlay.
- Sticky footer and close/primary controls remain visible or predictably reachable.

#### Then (negative)

- `overflow-x-hidden` on an ancestor, a clipped card edge, or an overlay that renders a desktop-width child MUST NOT be treated as responsive containment.

### Requirement: RT-REQ-008 Compatibility and Scope Traceability

The policy MUST record the applicable surface IDs (`DT-01`–`DT-15`, `NT-01`–`NT-07`, `HY-01`–`HY-05`) and root-cause references (`R1`–`R8`) for each future remediation or evidence run. It MUST preserve existing feature columns, API sort identifiers, stored preferences, and unrelated behavior while this contract is consumed. Leaf remediation remains a separate change.

#### Scenario: A leaf consumes the shared policy without broadening scope

#### Given

- A future change targets one or more inventoried surfaces, such as `DT-03` or `NT-05`.

#### When

- Its responsive strategy and acceptance evidence are recorded.

#### Then

- The record cites the surface ID, archetype, applicable root causes, exact viewport results, and essential-field decision.
- Unchanged feature columns, API sort identifiers, preferences, and unrelated behavior remain outside the remediation.

#### Then (negative)

- A policy reference MUST NOT be interpreted as authorization to migrate every leaf, hide columns universally, or change backend, routing, query, authorization, or data-model behavior.
