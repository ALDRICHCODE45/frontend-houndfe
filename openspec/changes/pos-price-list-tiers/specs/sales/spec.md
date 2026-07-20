# Delta for Sales

## ADDED Requirements

### Requirement: Sale Type Includes globalPriceListId
The `Sale` interface SHALL accept `globalPriceListId?: string | null` — an optional nullable field identifying the active global price list on a draft sale. The field SHALL be present on responses from `GET /sales/drafts`, `GET /sales/drafts/:id`, and any mutation that returns a draft (including `PUT /sales/drafts/:id/price-list`). Fixtures omitting the field SHALL still type-check for backward compatibility with pre-deploy payloads.

#### Scenario: draft response with globalPriceListId is accepted
- GIVEN a `GET /sales/drafts/:id` response includes `globalPriceListId: "uuid-mayoreo"`
- WHEN the response is typed as `Sale`
- THEN TypeScript accepts the field without error

#### Scenario: draft response with null globalPriceListId is accepted
- GIVEN a `GET /sales/drafts/:id` response includes `globalPriceListId: null`
- WHEN the response is typed as `Sale`
- THEN TypeScript accepts the null value without error

#### Scenario: pre-deploy payload without globalPriceListId still type-checks
- GIVEN a legacy draft response omits `globalPriceListId`
- WHEN the response is typed as `Sale`
- THEN TypeScript accepts the payload without error (field is optional)
