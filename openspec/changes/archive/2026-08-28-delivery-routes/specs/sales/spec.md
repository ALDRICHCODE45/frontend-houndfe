# Delta for Sales — `SHIPPED` Delivery Status

Extends `openspec/specs/sales/spec.md` with the `SHIPPED` delivery-status value across the constant, the derived type, the badge map, and the filter schema. Anchored on `openspec/changes/delivery-routes/design.md` §5.2 (the three-value-level edits), §6.2 (eligible-sales picker driven by `{PENDING, SHIPPED}`), and the S1 mandatory-gap-fix in the proposal. No existing REQ-* is modified — `SHIPPED` is purely additive: zero `SHIPPED` matches currently exist in `src/`, so without this delta every `SHIPPED` sale renders "Desconocido" and the eligible-sales picker cannot request `{PENDING, SHIPPED}`.

## ADDED Requirements

### REQ-SALES-001: `SALE_DELIVERY_STATUS` constant includes `SHIPPED`

`SALE_DELIVERY_STATUS` (in `src/features/POS/sales/constants/sale.constants.ts`) SHALL include `SHIPPED: 'SHIPPED'` as a value alongside `PENDING`, `DELIVERED`, and `NOT_APPLICABLE`. As a result, `SaleDeliveryStatus` (derived as `(typeof SALE_DELIVERY_STATUS)[keyof typeof SALE_DELIVERY_STATUS]` in `sale.types.ts`) SHALL widen to include `'SHIPPED'`.

#### Scenario: SHIPPED is a value-level entry

- GIVEN the `SALE_DELIVERY_STATUS` constant
- WHEN the constant is inspected
- THEN `SALE_DELIVERY_STATUS.SHIPPED === 'SHIPPED'`
- AND the value is present alongside PENDING, DELIVERED, and NOT_APPLICABLE

#### Scenario: SaleDeliveryStatus type widens to include SHIPPED

- GIVEN `SaleDeliveryStatus` is the derived type
- WHEN code assigns `'SHIPPED'` to a `SaleDeliveryStatus`-typed value
- THEN type-checking passes

### REQ-SALES-002: `deliveryStatusBadgeMap` includes `SHIPPED`

`deliveryStatusBadgeMap` (in `src/features/POS/sales/utils/saleStatus.utils.ts`) SHALL include `SHIPPED: { label: 'Enviados', color: 'warning' }`. As a result, `SHIPPED` sales SHALL render a badge with label "Enviados" and `warning` color — never the default "Desconocido" placeholder.

#### Scenario: SHIPPED badge renders "Enviados"

- GIVEN a confirmed sale with `deliveryStatus: 'SHIPPED'`
- WHEN the sales list renders the row
- THEN the badge label is "Enviados"
- AND the badge tone is `warning`

#### Scenario: SHIPPED never renders "Desconocido"

- GIVEN any confirmed sale with `deliveryStatus: 'SHIPPED'`
- WHEN the row renders in any sales surface (list, detail, filter chip)
- THEN the visible badge label is "Enviados"
- AND no "Desconocido" placeholder renders

### REQ-SALES-003: `deliveryStatus` filter option includes `SHIPPED`

The `deliveryStatus` multi-enum in `salesFiltersSchema` (in `src/features/POS/sales/config/salesFiltersSchema.ts`) SHALL include `{ value: SALE_DELIVERY_STATUS.SHIPPED, label: 'Enviada' }` alongside the existing PENDING and DELIVERED options. The label is singular-feminine (`Enviada`) to match its siblings `Pendiente`/`Entregada`.

#### Scenario: SHIPPED is selectable in the filter

- GIVEN the filter slideover opens
- WHEN the `deliveryStatus` multi-select renders
- THEN the option "Enviada" is present alongside "Pendiente" and "Entregada"

#### Scenario: filter on SHIPPED returns only SHIPPED sales

- GIVEN the user selects "Enviada" in the `deliveryStatus` filter
- WHEN the list refreshes
- THEN only sales with `deliveryStatus === 'SHIPPED'` appear
- AND no other delivery statuses are included

### REQ-SALES-004: Eligible-sales picker can request `{PENDING, SHIPPED}`

`useConfirmedSales` / `saleApi.listConfirmed` MUST accept `deliveryStatus: ['PENDING', 'SHIPPED']` as a valid filter combination (the `SHIPPED` value type-checks against the widened `SaleDeliveryStatus`). The `useEligibleSales` composable in `delivery-route-management` SHALL pass this combination by default (no client-side filter on address).

#### Scenario: picker request type-checks

- GIVEN `useEligibleSales` invokes `saleApi.listConfirmed({ deliveryStatus: ['PENDING', 'SHIPPED'] })`
- WHEN the request is type-checked
- THEN it passes (no `unknown`-in-union error)
- AND the request fires with the filter

#### Scenario: only PENDING + SHIPPED sales come back

- GIVEN the backend returns confirmed sales with statuses `{PENDING, SHIPPED, DELIVERED}`
- WHEN `useEligibleSales` returns
- THEN every returned sale has `deliveryStatus ∈ {PENDING, SHIPPED}`
- AND DELIVERED sales are NOT returned

### REQ-SALES-005: Badge map parity across all four delivery statuses

The badge map SHALL cover every value of `SALE_DELIVERY_STATUS` without falling through to the "Desconocido" default: `PENDING: 'No Entregados' (error)`, `SHIPPED: 'Enviados' (warning)`, `DELIVERED: 'Entregados' (success)`, `NOT_APPLICABLE: 'N/A' (neutral)` (existing `NOT_APPLICABLE` mapping is preserved).

#### Scenario: all four statuses map to explicit labels

- GIVEN the `deliveryStatusBadgeMap`
- WHEN each key is inspected
- THEN `PENDING`, `SHIPPED`, `DELIVERED`, and `NOT_APPLICABLE` are all present
- AND no key falls through to "Desconocido"

#### Scenario: NOT_APPLICABLE stays untouched

- GIVEN `NOT_APPLICABLE` had a mapping before this change
- WHEN the badge map is inspected
- THEN its label and color are unchanged from the pre-change value
