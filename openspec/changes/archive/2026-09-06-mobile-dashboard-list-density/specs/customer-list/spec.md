# Delta for Customer List

## Purpose

Improve responsive density and width containment for the Customers pilot while preserving customer actions, data behavior, permissions, persisted display mode, and existing table/card semantics.

## ADDED Requirements

### Requirement: REQ-CL-001 — Dashboard-owned Customers mobile gutter

The Customers pilot SHALL use the dashboard layout as the sole owner of its outer mobile gutter. The Customers route surface SHALL NOT add a second outer horizontal gutter that compounds the dashboard gutter. Necessary inner surface spacing MAY remain when it does not create a second outer page gutter.

#### Scenario: Customers uses one outer gutter

- GIVEN the Customers list renders at 360, 412, or 740 CSS px
- WHEN the route surface is measured
- THEN the outer mobile content begins within the dashboard-owned gutter without a duplicated route-level outer gutter
- AND the list surface remains sized to its available content width

### Requirement: REQ-CL-002 — Customers has no page-level horizontal overflow

At 360, 412, and 740 CSS px, the Customers page SHALL have no page-level horizontal overflow in either table mode or card mode. Containment SHALL be established by the participating list surface and its content regions rather than by masking overflow at an unrelated ancestor.

#### Scenario: Customers page fits target widths

- GIVEN Customers is rendered with representative data at one of 360, 412, or 740 CSS px
- WHEN the user views either display mode
- THEN the document does not acquire horizontal page scrolling
- AND the toolbar, list surface, cards, and pagination remain within the available page content width

### Requirement: REQ-CL-003 — Customers card mode contains long content

In card mode, the Customers pilot SHALL render cards without clipping, card-level horizontal scrolling, or page-level horizontal scrolling. Long representative customer names, email addresses, phone values, price-list names, dates, badges, and action controls SHALL wrap or truncate within the card boundary while remaining readable and actionable.

#### Scenario: Long customer values stay inside cards

- GIVEN card mode contains a customer with a long name, email, phone, price-list name, or date value
- WHEN the card renders at 360, 412, or 740 CSS px
- THEN the value is wrapped or truncated within the card boundary
- AND no card content, badge, kebab, or pagination control is clipped
- IF the value exceeds the available inline width
- THEN the card does not become a horizontal scroll container

### Requirement: REQ-CL-004 — Customers table scroll and actions remain local

In table mode, the Customers pilot SHALL preserve the existing internal horizontal scrolling behavior of the rendered table region. The right actions column SHALL remain aligned with the table region's right edge, visible, and actionable at both the leftmost and rightmost horizontal scroll positions. Page-level scrolling SHALL NOT replace the table region's scroll behavior.

#### Scenario: Customers table scrolls only inside its region

- GIVEN the Customers table is wider than its available content region
- WHEN the user scrolls horizontally
- THEN horizontal movement occurs within the table region
- AND the page itself does not become the horizontal scroll owner
- IF the table is at either horizontal scroll extreme
- THEN the right actions column remains aligned, visible, and actionable

### Requirement: REQ-CL-005 — Width-aware CustomerCardGrid and visual fidelity

The Customers card grid SHALL choose its arrangement from the available list content width, not from viewport width alone, and SHALL never create a track wider than that available width. The grid MAY retain equivalent one-, two-, three-, five-, or seven-column outcomes when the available width permits, but SHALL NOT force a fixed viewport-based ladder that overflows the nested list surface. The pilot SHALL retain the existing Coco/Nuxt UI semantic surfaces, rounded treatment, borders, typography contrast, and light/dark behavior.

#### Scenario: Grid responds to nested content width

- GIVEN the Customers list surface has less usable width than the viewport because of its dashboard gutter and inner spacing
- WHEN card mode renders
- THEN the grid arrangement responds to the usable list content width
- AND no grid track forces horizontal overflow at 360, 412, or 740 CSS px

#### Scenario: Light and dark Customer surfaces remain faithful

- GIVEN Customers renders in light mode or dark mode
- WHEN the toolbar, cards, pagination, and table surface render
- THEN existing Coco/Nuxt UI semantic tokens and visual treatment remain recognizable
- AND no theme-specific raw styling is required by the responsive behavior

### Requirement: REQ-CL-006 — CustomerCard behavior and responsive containment

`CustomerCard` SHALL continue to render its existing article content, actions, emitted interactions, and permission-gated kebab while its root and descendants remain shrinkable within the available card width. Card click, edit, delete, history access, and other existing customer actions SHALL remain actionable after density changes.

#### Scenario: Card interactions remain available

- GIVEN a customer card is rendered for a user with the applicable permissions
- WHEN the user clicks the card or opens its action menu
- THEN the existing card-click, edit, delete, and history behaviors remain available according to permission
- AND long content does not intercept or displace the actionable controls

### Requirement: REQ-CL-007 — Customers behavior and pilot boundary do not regress

The Customers delta SHALL preserve existing loading, error, empty, pagination, display-mode persistence, permissions, filters, batch actions where present, sorting/search behavior, customer data behavior, and table action behavior. This responsive delta SHALL remain limited to Products, Customers, and Employees/Colaboradores and SHALL NOT change APIs, DTOs, routes, authorization subjects, or business data behavior.

#### Scenario: Existing Customers state behavior remains intact

- GIVEN Customers is loading, failed, empty, paginated, filtered, persisted in a display mode, or rendered for a restricted user
- WHEN the responsive layout is exercised
- THEN the existing state, permissions, filters, pagination, persistence, and customer data behavior remain unchanged
- AND IF the user switches between table and card modes
- THEN the existing mode selection behavior remains intact

#### Scenario: Pilot boundary is enforced

- GIVEN the responsive density change ships
- WHEN a non-pilot list view is rendered
- THEN it is not required to adopt the Customers responsive layout contract
- AND no backend, API, route, permission, or data migration is implied

## MODIFIED Requirements

### Requirement: REQ-CL-008 — Card rendering and width-aware grid

`CustomerCard` SHALL render an `article` with `EntityAvatar`, `fullName`, chip row, dashed divider, and 2-col body (`email`, `phone`, `globalPriceListName`, `createdAt`) — no RFC/fiscal (on `CustomerDetail`). It SHALL emit `edit`/`delete`/`click`; kebab stops propagation and is gated. `CustomerCardGrid` SHALL choose columns from available content width, preserving the existing one-, two-, three-, five-, or seven-column outcomes where they fit, with skeleton/empty states and forwarded card events. It SHALL NOT force a column track wider than its containing list surface.

(Previously: `CustomerCardGrid` used the Employee ladder (1/2/3/5/7) as a viewport-oriented card arrangement.)

#### Scenario: Card click opens editor

- GIVEN a card with update permission
- WHEN the user clicks it
- THEN `card-click` fires and the edit slideover opens

#### Scenario: Grid uses available content width

- GIVEN card mode with rows and a nested list surface narrower than the viewport
- WHEN the grid renders
- THEN cards fill only the number of columns supported by the available content width
- AND no grid track creates page-level horizontal overflow at 360, 412, or 740 CSS px

#### Scenario: Loading / empty

- GIVEN card mode
- WHEN the list is loading or has no rows
- THEN skeletons show while loading and the empty message shows when no rows
- AND neither state creates horizontal clipping or card-mode horizontal scrolling

## Evidence Note

Supplied screenshots are visual evidence for the Customers density problem and light/dark fidelity; they are not an exact DOM, selector, class, or component-API contract.
