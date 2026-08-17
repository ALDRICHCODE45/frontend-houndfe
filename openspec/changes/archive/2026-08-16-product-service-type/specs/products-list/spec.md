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
