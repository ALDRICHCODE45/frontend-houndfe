# Summary Contract Specification

## Purpose

Define the frontend contract for customer-specific confirmed-sales history so that backend-authoritative summaries, tenant-scoped caching, and request parameters remain safe and stable.

## Requirements

### REQ-CSH-CON-001: Confirmed history response contract

The frontend SHALL model `ConfirmedSalesListResponse` with `summary: SaleListSummary`, where `summary` contains `salesCount`, `totalSoldCents`, and `outstandingDebtCents` as integer values. The frontend SHALL model `folio`, `paymentStatus`, and `confirmedAt` as nullable wherever the backend permits null, leaving null handling to the consuming UI.

#### Scenario: Complete backend response is accepted

#### Given

- The API returns confirmed sale rows, pagination, counts, and a summary.

#### When

- The response is decoded or assigned to `ConfirmedSalesListResponse`.

#### Then

- The response is type-safe and exposes all three summary values.
- `summary.salesCount` represents the confirmed total and is not computed by the client.

#### Scenario: Nullable row fields are accepted

#### Given

- A confirmed sale row has a null folio, payment status, or confirmation timestamp.

#### When

- The row is assigned to the response type.

#### Then

- The response remains valid and consumers can provide an explicit display fallback.

### REQ-CSH-CON-002: Customer history request parameters

The `useCustomerSalesHistory` query SHALL call the unmodified confirmed-sales API with `customerId`, the requested `page`, `limit: 10`, `sortBy: confirmedAt`, and `sortOrder: desc`. It SHALL omit `status` and SHALL never send `customerIncludeNull: true` for a specific customer history request.

#### Scenario: Default customer history request

#### Given

- A valid customer ID is selected and the history surface is open on page 1.

#### When

- The query executes.

#### Then

- The request contains the customer ID, page 1, limit 10, descending confirmed-at sorting.
- The request omits `status` and `customerIncludeNull`.

#### Scenario: Customer null-inclusion is prohibited

#### Given

- A customer history query is built for any customer ID.

#### When

- Its API parameters are inspected.

#### Then (negative)

- `customerIncludeNull` is not present and is never `true`.
- Anonymous sales cannot be mixed into the customer history.

### REQ-CSH-CON-003: Tenant-safe query identity and cache behavior

The frontend SHALL centralize `saleQueryKeys.customerHistory(tenantId, customerId, params)` with JSON-serializable parameters including the tenant and customer identity. The query SHALL use a 30-second stale time, preserve prior data while changing pages, and be disabled while the history surface is closed. Closing and reopening SHALL not invalidate the customer-history query.

#### Scenario: Tenant and customer isolate cached data

#### Given

- Two tenants or two customers use otherwise identical history parameters.

#### When

- Their query keys are generated.

#### Then

- The keys differ by tenant and customer identity.
- Cached data from one tenant or customer cannot be selected by the other query.

#### Scenario: Closed surface does not fetch or invalidate

#### Given

- The history surface is closed after a successful query.

#### When

- It is closed and later reopened within the cache freshness window.

#### Then

- No request is made while closed.
- Reopening can reuse the fresh cached result without an explicit close/reopen invalidation.

#### Scenario: Previous-customer data is guarded during transition

#### Given

- Keep-previous-data temporarily retains customer A's page while customer B becomes selected.

#### When

- The customer-history query transitions to customer B.

#### Then (negative)

- The UI consumer SHALL not present customer A's retained data as customer B's summary or list.
- Customer B's data is shown only after it is associated with B's query identity.
