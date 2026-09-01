# History Surface Specification

## Purpose

Define the accessible, read-only lateral customer sales-history slideover and its authoritative metrics, compact list, pagination, and state handling.

## Requirements

### REQ-CSH-SUR-001 — Authoritative summary metrics

The history surface SHALL render confirmed-sales count, total sold, and outstanding debt exclusively from the active response `summary`. It SHALL never sum paginated rows, recompute `outstandingDebtCents` or `debtCents`, or infer metrics from row values. Currency SHALL use MXN `es-MX` formatting.

#### Scenario: Metrics use the wire summary

#### Given

- The response summary contains sales count 12, total sold 125000 cents, and outstanding debt 30000 cents.
- The visible page contains only a subset of rows whose totals do not equal those values.

#### When

- The slideover renders.

#### Then

- The three metric cards display the three summary values with `formatCentsMXN`.
- Debt receives alert treatment when greater than zero.

#### Scenario: No row-derived financial calculation occurs

#### Given

- Rows have nullable or inconsistent displayed totals.

#### When

- The summary cards are rendered or the page changes.

#### Then (negative)

- No metric is derived by reducing, summing, or recalculating the rows.
- The displayed debt is exactly the response `summary.outstandingDebtCents`.

### REQ-CSH-SUR-002 — Compact list and navigation

The surface SHALL render a compact semantic sale list with folio fallback, `formatSaleDate` for confirmation date, `formatCentsMXN` for monetary values, and the existing payment-status badge utility. Each selectable row SHALL have an accessible name and SHALL navigate to the named `pos-sale-detail` route with the sale ID; the surface SHALL remain read-only.

#### Scenario: Sale row is formatted and selected

#### Given

- A response contains a sale with an ID, non-null values, and payment status.

#### When

- A user activates the sale row.

#### Then

- The row shows the established folio/date/currency/status formatting.
- Navigation uses `{ name: 'pos-sale-detail', params: { id } }`.

#### Scenario: Nullable row values have safe fallbacks

#### Given

- A sale row has null folio, payment status, or confirmed-at date.

#### When

- The row renders.

#### Then

- The UI shows explicit non-breaking fallbacks rather than blank, invalid, or crashing content.
- The row remains keyboard and screen-reader operable when it has a valid sale ID.

### REQ-CSH-SUR-003 — Stable pagination and states

The surface SHALL provide traditional pagination for available pages while keeping the active response summary stable as pages change. It SHALL distinguish loading, non-error empty, and error states. A 200 response with zero summary values and empty data SHALL render the empty state, never an error. Errors SHALL use normalized messaging and provide retry behavior, except a defensive 403 which SHALL show one toast, close the panel, and offer no retry.

#### Scenario: Pagination changes rows without changing metrics

#### Given

- Page 1 and page 2 are valid responses for the same customer with the same authoritative summary.

#### When

- The user selects page 2.

#### Then

- The list updates to page 2.
- The metric cards remain based on the response summary for the customer and do not become page totals.

#### Scenario: Tenant-safe zero response is empty

#### Given

- The backend returns HTTP 200 with empty data, zero counts, and zero summary values for a foreign-tenant customer ID or a customer with no confirmed sales.

#### When

- The history surface receives the response.

#### Then

- It displays the non-disclosing empty message `Este cliente aún no tiene ventas confirmadas.`.
- It does not display an authorization or server error.

#### Scenario: Loading and forbidden error are differentiated

#### Given

- The request is pending, or the backend defensively returns 403.

#### When

- The corresponding state is rendered.

#### Then

- Pending data shows loading skeletons.
- A 403 is shown as one toast `Sin permiso para ver ventas`, the panel closes, and no retry is offered.
- No fabricated metrics are rendered for the authorization failure.

### REQ-CSH-SUR-004 — Accessible slideover structure

The history surface SHALL be a right-side lateral slideover approximately 520px wide on desktop, with an accessible dialog name identifying the customer and accessible names for close, retry, pagination, and sale-row controls. The customer identity header SHALL be present when the surface is open.

#### Scenario: Slideover exposes named controls

#### Given

- A user opens history for a named customer.

#### When

- Assistive technology inspects the open surface.

#### Then

- The dialog identifies the customer and exposes named close and pagination controls.
- Sale rows expose meaningful names rather than anonymous clickable containers.
