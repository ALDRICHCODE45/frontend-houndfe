# Products List Specification

Domain: `products-list` — POS products list behavior in `src/features/POS/products/`: `Product.type` on rows, `?type=` server filter with local fallback, PRODUCTO/SERVICIO/TODOS toolbar toggle with pagination reset, and an always-visible type badge column. Introduced in `product-service-type`.

## Purpose

Give the products list SERVICE parity: every row shows a type badge and the toolbar filters by type, mirroring the promotions list pattern (`?type=` param spread into the query key/query fn + pagination-reset watcher).

## Requirements

### REQ-1: `Product.type` on list rows

`Product` SHALL expose `type: 'PRODUCT' | 'SERVICE'`; `mapProduct` SHALL map `type: item.type ?? 'PRODUCT'`. Every list row and card therefore carries its type.

#### Scenario: mapProduct maps type

- GIVEN a backend row with `type: 'SERVICE'`
- WHEN `mapProduct` runs
- THEN the resulting row has `type: 'SERVICE'`
- GIVEN a row with no `type`
- THEN the resulting row has `type: 'PRODUCT'`

### REQ-2: Type server filter with local fallback

`getPaginated` SHALL accept `ProductFilters { type?: 'PRODUCT' | 'SERVICE' }` and send `type` as a query param only when set; an absent param SHALL mean both types. If the backend ignores the param and returns unfiltered rows, the client SHALL apply a local `type` filter as fallback.

#### Scenario: type param sent

- GIVEN the filter type `SERVICE`
- WHEN `getPaginated` runs
- THEN the request carries `type=SERVICE`

#### Scenario: absent type means both

- GIVEN no type filter
- WHEN `getPaginated` runs
- THEN no `type` param is sent

#### Scenario: local fallback filters mixed rows

- GIVEN `type=SERVICE` requested but the server returns mixed rows
- WHEN rows render
- THEN only SERVICE rows are shown

### REQ-3: Toolbar toggle with pagination reset

The toolbar SHALL offer PRODUCTO / SERVICIO / TODOS (D4, promotions pattern). Selecting a type SHALL add `type` to the query key (triggers refetch), reset pagination to page 0, and clear row selection.

#### Scenario: toggle filters and resets

- GIVEN the list on page 3 with rows selected
- WHEN the user selects SERVICIO
- THEN the list refetches with `type=SERVICE`
- AND pageIndex resets to 0 and selection clears

#### Scenario: TODOS restores both types

- GIVEN a type filter active
- WHEN the user selects TODOS
- THEN the list refetches with no `type` param

### REQ-4: Always-visible type badge column

The table SHALL render an always-visible type column (9→10 columns: select, type, name, sku, category, brand, price, quantity, status, actions) with an `AppBadge` cell — "Servicio" (info tone) for SERVICE, "Producto" (neutral tone) for PRODUCT. The column SHALL be non-hideable.

#### Scenario: SERVICE badge

- GIVEN a row with `type: 'SERVICE'`
- WHEN the table renders
- THEN the type cell shows the "Servicio" badge

#### Scenario: PRODUCT badge

- GIVEN a row with `type: 'PRODUCT'`
- WHEN the table renders
- THEN the type cell shows the "Producto" badge

#### Scenario: column count is 10

- GIVEN the columns render
- THEN 10 columns exist with `type` after `select`
- AND the 9-column regression pins are updated intentionally

## Mobile Dashboard List Density Pilot (mobile-dashboard-list-density)

The following requirements were added by `mobile-dashboard-list-density` (verify tip `a306f8e3c19b509286d69488be7fc767d9e69b75`, archived `2026-09-06`). They apply only to the Products list pilot composition.

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
