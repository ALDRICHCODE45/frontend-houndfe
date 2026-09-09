# Delta for Admin Employees List

## Purpose

Improve responsive density and width containment for the Employees/Colaboradores pilot while preserving employee filters, batch operations, permissions, navigation, persistence, and existing table/card behavior.

## ADDED Requirements

### Requirement: REQ-AEL-001 — Dashboard-owned Employees mobile gutter

The Employees/Colaboradores pilot SHALL use the dashboard layout as the sole owner of its outer mobile gutter. The Employees route surface SHALL NOT add a second outer horizontal gutter that compounds the dashboard gutter. Necessary inner surface spacing MAY remain when it does not create a second outer page gutter.

#### Scenario: Employees uses one outer gutter

- GIVEN the Employees/Colaboradores list renders at 360, 412, or 740 CSS px
- WHEN the route surface is measured
- THEN the outer mobile content begins within the dashboard-owned gutter without a duplicated route-level outer gutter
- AND the list surface remains sized to its available content width

### Requirement: REQ-AEL-002 — Employees has no page-level horizontal overflow

At 360, 412, and 740 CSS px, the Employees/Colaboradores page SHALL have no page-level horizontal overflow in either table mode or card mode. Containment SHALL be established by the participating list surface and its content regions rather than by masking overflow at an unrelated ancestor.

#### Scenario: Employees page fits target widths

- GIVEN Employees/Colaboradores is rendered with representative data at one of 360, 412, or 740 CSS px
- WHEN the user views either display mode
- THEN the document does not acquire horizontal page scrolling
- AND the toolbar, list surface, cards, batch actions, and pagination remain within the available page content width

### Requirement: REQ-AEL-003 — Employees card mode contains long content

In card mode, the Employees/Colaboradores pilot SHALL render cards without clipping, card-level horizontal scrolling, or page-level horizontal scrolling. Long representative employee names, departments, manager names, job titles, modality values, status badges, and action controls SHALL wrap or truncate within the card boundary while remaining readable and actionable.

#### Scenario: Long employee values stay inside cards

- GIVEN card mode contains an employee with a long name, department, manager, job title, modality, or status value
- WHEN the card renders at 360, 412, or 740 CSS px
- THEN the value is wrapped or truncated within the card boundary
- AND no card content, status badge, kebab, or pagination control is clipped
- IF the value exceeds the available inline width
- THEN the card does not become a horizontal scroll container

### Requirement: REQ-AEL-004 — Employees table scroll and actions remain local

In table mode, the Employees/Colaboradores pilot SHALL preserve the existing internal horizontal scrolling behavior of the rendered table region. The right actions column SHALL remain aligned with the table region's right edge, visible, and actionable at both the leftmost and rightmost horizontal scroll positions. Page-level scrolling SHALL NOT replace the table region's scroll behavior.

#### Scenario: Employees table scrolls only inside its region

- GIVEN the Employees table is wider than its available content region
- WHEN the user scrolls horizontally
- THEN horizontal movement occurs within the table region
- AND the page itself does not become the horizontal scroll owner
- IF the table is at either horizontal scroll extreme
- THEN the right actions column remains aligned, visible, and actionable

### Requirement: REQ-AEL-005 — Width-aware EmployeeCardGrid and visual fidelity

The Employees/Colaboradores card grid SHALL choose its arrangement from the available list content width, not from viewport width alone, and SHALL never create a track wider than that available width. The pilot SHALL retain the existing Coco/Nuxt UI semantic surfaces, rounded treatment, borders, typography contrast, and light/dark behavior; responsive density SHALL not introduce a separate visual language.

#### Scenario: Grid responds to nested content width

- GIVEN the Employees list surface has less usable width than the viewport because of its dashboard gutter and inner spacing
- WHEN card mode renders
- THEN the grid arrangement responds to the usable list content width
- AND no grid track forces horizontal overflow at 360, 412, or 740 CSS px

#### Scenario: Light and dark Employee surfaces remain faithful

- GIVEN Employees/Colaboradores renders in light mode or dark mode
- WHEN the toolbar, cards, batch actions, pagination, and table surface render
- THEN existing Coco/Nuxt UI semantic tokens and visual treatment remain recognizable
- AND no theme-specific raw styling is required by the responsive behavior

### Requirement: REQ-AEL-006 — Employees interactions and state do not regress

The Employees/Colaboradores delta SHALL preserve existing loading, error, empty, pagination, display-mode persistence, permissions, filters, batch actions, card navigation, card kebab actions, table actions, and employee data behavior. The existing status-filter sheet and three-region mobile toolbar semantics SHALL remain intact.

#### Scenario: Existing Employees behavior remains intact

- GIVEN Employees/Colaboradores is loading, failed, empty, paginated, filtered, persisted in a display mode, selected for batch action, or rendered for a restricted user
- WHEN the responsive layout is exercised
- THEN the existing state, permissions, filters, pagination, persistence, batch actions, navigation, and employee data behavior remain unchanged
- AND IF the user switches between table and card modes
- THEN the existing mode selection behavior remains intact

#### Scenario: Card navigation and actions remain separate

- GIVEN a card is rendered with the existing employee permissions
- WHEN the user clicks the card body or opens its kebab
- THEN card-click navigation and kebab actions remain distinct and actionable according to the canonical employee-list contract

### Requirement: REQ-AEL-007 — Employees pilot boundary

The responsive density delta SHALL apply only to Products, Customers, and Employees/Colaboradores. It SHALL NOT change employee APIs, DTOs, routes, authorization subjects, or business data behavior, and it SHALL NOT require non-pilot list views to adopt the new layout convention.

#### Scenario: Non-pilot views remain outside the delta

- GIVEN the responsive density change ships
- WHEN a non-pilot list view is rendered
- THEN it is not required to adopt the Employees responsive layout contract
- AND no backend, API, route, permission, or data migration is implied

#### Scenario: Employee contracts remain stable

- GIVEN the Employees/Colaboradores pilot is rendered after the responsive change
- WHEN filters, pagination, permissions, batch actions, navigation, or persisted display mode are used
- THEN their existing contracts remain the source of truth

## Evidence Note

Supplied screenshots are visual evidence for the Employees/Colaboradores density problem and light/dark fidelity; they are not an exact DOM, selector, class, or component-API contract.
