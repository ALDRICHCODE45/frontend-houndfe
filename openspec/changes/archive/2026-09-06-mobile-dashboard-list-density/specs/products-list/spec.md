# Delta for Products List

## Purpose

Improve responsive density and width containment for the Products pilot while preserving product data behavior, table behavior, permissions, and existing display-mode semantics.

## ADDED Requirements

### Requirement: REQ-PL-001 — Dashboard-owned Products mobile gutter

The Products pilot SHALL use the dashboard layout as the sole owner of its outer mobile gutter. The Products route surface SHALL NOT add a second outer horizontal gutter that compounds the dashboard gutter. Necessary inner surface spacing MAY remain when it does not create a second outer page gutter.

#### Scenario: Products uses one outer gutter

- GIVEN the Products list renders at 360, 412, or 740 CSS px
- WHEN the route surface is measured
- THEN the outer mobile content begins within the dashboard-owned gutter without a duplicated route-level outer gutter
- AND the list surface remains sized to its available content width

### Requirement: REQ-PL-002 — Products has no page-level horizontal overflow

At 360, 412, and 740 CSS px, the Products page SHALL have no page-level horizontal overflow in either table mode or card mode. Containment SHALL be established by the participating list surface and its content regions rather than by masking overflow at an unrelated ancestor.

#### Scenario: Products page fits target widths

- GIVEN Products is rendered with representative data at one of 360, 412, or 740 CSS px
- WHEN the user views either display mode
- THEN the document does not acquire horizontal page scrolling
- AND the toolbar, list surface, and pagination remain within the available page content width

### Requirement: REQ-PL-003 — Products card mode contains long content

In card mode, the Products pilot SHALL render cards without clipping, card-level horizontal scrolling, or page-level horizontal scrolling. Long representative product names, SKU values, category or brand text, badges, prices, and action controls SHALL wrap or truncate within the card boundary while remaining readable and actionable.

#### Scenario: Long product values stay inside cards

- GIVEN card mode contains a product with a long name, SKU, category, brand, or currency value
- WHEN the card renders at 360, 412, or 740 CSS px
- THEN the value is wrapped or truncated within the card boundary
- AND no card content, badge, kebab, or pagination control is clipped
- IF the value exceeds the available inline width
- THEN the card does not become a horizontal scroll container

### Requirement: REQ-PL-004 — Products table scroll and actions remain local

In table mode, the Products pilot SHALL preserve the existing internal horizontal scrolling behavior of the rendered table region. The right actions column SHALL remain aligned with the table region's right edge, visible, and actionable at both the leftmost and rightmost horizontal scroll positions. Page-level scrolling SHALL NOT replace the table region's scroll behavior.

#### Scenario: Products table scrolls only inside its region

- GIVEN the Products table is wider than its available content region
- WHEN the user scrolls horizontally
- THEN horizontal movement occurs within the table region
- AND the page itself does not become the horizontal scroll owner
- IF the table is at either horizontal scroll extreme
- THEN the right actions column remains aligned, visible, and actionable

### Requirement: REQ-PL-005 — Products width-aware grid and visual fidelity

The Products card grid SHALL choose its arrangement from the available list content width, not from viewport width alone, and SHALL never create a track wider than that available width. The pilot SHALL retain the existing Coco/Nuxt UI semantic surfaces, rounded treatment, borders, typography contrast, and light/dark behavior; responsive density SHALL not introduce a separate visual language.

#### Scenario: Grid responds to nested content width

- GIVEN the Products list surface has less usable width than the viewport because of its dashboard gutter and inner spacing
- WHEN card mode renders
- THEN the grid arrangement responds to the usable list content width
- AND no grid track forces horizontal overflow at 360, 412, or 740 CSS px

#### Scenario: Light and dark Products surfaces remain faithful

- GIVEN Products renders in light mode or dark mode
- WHEN the toolbar, cards, pagination, and table surface render
- THEN existing Coco/Nuxt UI semantic tokens and visual treatment remain recognizable
- AND no theme-specific raw styling is required by the responsive behavior

### Requirement: REQ-PL-006 — Products behavior and pilot boundary do not regress

The Products delta SHALL preserve existing loading, error, empty, pagination, display-mode persistence, permissions, filters, batch actions where present, sorting/search behavior, product type data, and table data behavior. This responsive delta SHALL remain limited to Products, Customers, and Employees/Colaboradores and SHALL NOT change APIs, DTOs, routes, authorization subjects, or business data behavior.

#### Scenario: Existing Products state behavior remains intact

- GIVEN Products is loading, failed, empty, paginated, filtered, persisted in a display mode, or rendered for a restricted user
- WHEN the responsive layout is exercised
- THEN the existing state, permissions, filters, pagination, persistence, and product data behavior remain unchanged
- AND IF the user switches between table and card modes
- THEN the existing mode selection behavior remains intact

#### Scenario: Pilot boundary is enforced

- GIVEN the responsive density change ships
- WHEN a non-pilot list view is rendered
- THEN it is not required to adopt the Products responsive layout contract
- AND no backend, API, route, permission, or data migration is implied

## Evidence Note

Supplied screenshots are visual evidence for the Products density problem and light/dark fidelity; they are not an exact DOM, selector, class, or component-API contract.
