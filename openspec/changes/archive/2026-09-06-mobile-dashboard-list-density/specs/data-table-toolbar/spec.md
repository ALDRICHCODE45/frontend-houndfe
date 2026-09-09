# Delta for Data Table Toolbar

## Purpose

Define the responsive density and containment behavior shared by the Products, Customers, and Employees/Colaboradores pilot list compositions without changing the established toolbar semantics or exposing an implementation API.

## ADDED Requirements

### Requirement: REQ-DTT-001 — Pilot toolbar containment

For the three pilot list compositions only, the mobile toolbar SHALL preserve the established three-region semantics: full-width search first, a wrapping actions region second, and the Filters trigger third when filters exist. The denser presentation SHALL keep each region within the available content width and SHALL NOT rely on page-level clipping to hide overflow. The existing mobile filter sheet, its filter state, and its scrollable content SHALL remain available.

#### Scenario: Three-region mobile toolbar remains usable

- GIVEN a Products, Customers, or Employees/Colaboradores list at 360, 412, or 740 CSS px
- WHEN the mobile toolbar renders
- THEN search remains the first region, actions remain the second region, and the Filters trigger remains the third region when a filters slot exists
- AND each region remains reachable without page-level horizontal scrolling
- IF the action controls need more than one line
- THEN the actions region wraps without clipping or changing the established order

#### Scenario: Filter sheet remains the filter owner

- GIVEN a pilot list with filter content at a mobile width
- WHEN the user opens Filters
- THEN the established bottom filter sheet opens with its header, scrollable body, and footer behavior
- AND filter values persist when the sheet closes
- IF filter content is taller than the available mobile height
- THEN the sheet body scrolls instead of clipping filter controls

### Requirement: REQ-DTT-002 — Labeled ViewToggle remains accessible and touchable

Within the three pilot toolbars, ViewToggle SHALL retain both human-readable mode labels, accessible names for both choices, keyboard operation, visible focus behavior, and a practical touch target of at least 44 CSS px in both dimensions for each actionable choice. Compact spacing MAY reduce visual density, but the control SHALL NOT become icon-only, lose a label, or become dependent on pointer hover.

#### Scenario: Both display modes remain discoverable

- GIVEN a pilot toolbar renders ViewToggle on a narrow viewport
- WHEN the user views the control
- THEN both mode labels are present and each choice has an accessible name
- AND the control remains contained within the toolbar content width

#### Scenario: Keyboard and touch interaction remain available

- GIVEN keyboard focus is placed on ViewToggle
- WHEN the user moves between choices and activates the selected choice with the keyboard
- THEN focus and selection follow the existing keyboard behavior
- AND IF a user activates either choice by touch
- THEN its actionable target is at least 44 CSS px by 44 CSS px and the display mode changes

### Requirement: REQ-DTT-003 — Toolbar behavior is pilot-scoped

The responsive density and containment delta SHALL apply only to the Products, Customers, and Employees/Colaboradores pilot compositions. It SHALL NOT require migration of non-pilot list views, change filter logic, change slot semantics, or introduce a new public component API. Existing desktop toolbar semantics SHALL remain unchanged.

#### Scenario: Non-pilot toolbar behavior is not broadened

- GIVEN a list view outside the three pilots
- WHEN the change is applied
- THEN its existing toolbar contract remains the governing behavior
- AND no pilot-only density requirement is inferred for that view

#### Scenario: Desktop semantics remain stable

- GIVEN a pilot list at the existing desktop toolbar breakpoint or wider
- WHEN the toolbar renders
- THEN its established desktop search, inline-filter, and actions semantics remain unchanged

### Requirement: REQ-DTT-004 — Visual evidence is not a DOM contract

Supplied screenshots SHALL be treated as visual evidence for density, containment, spacing, and light/dark fidelity, not as an exact deployed-DOM, selector, class, or component-API contract. The implementation MAY use any equivalent internal structure that satisfies these observable requirements.

#### Scenario: Screenshot differences do not redefine behavior

- GIVEN a supplied screenshot differs from the checked-in pilot markup
- WHEN the responsive behavior is reviewed
- THEN the review uses the screenshot to assess visual evidence only
- AND the normative contract is determined by these requirements and the canonical toolbar requirements
