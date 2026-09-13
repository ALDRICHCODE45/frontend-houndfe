# Public Catalog Branch Discovery Specification

## Purpose

Define bounded discovery for anonymous `/catalogo` visits: one isolated public branches GET, an explicit chooser that never auto-selects, distinguishable recovery states, and a preserved shell. Out of scope: branch selection, slug canonicalization, selected landing, invalid-slug recovery, back/forward sync, race triangulation, and all product/commerce behavior.

## Requirements

### REQ-CAT-BD-001: Isolated anonymous branches request with validated response

The catalog feature SHALL issue exactly one `GET ${API_BASE}/public/catalog/branches` per anonymous `/catalogo` visit through an isolated anonymous boundary; the request SHALL NOT include `Authorization`, credentials, body, or query. A `200` SHALL be validated against `PublicBranchDto` `{ id, name, slug, address: string|null, phone: string|null }`; non-array bodies or items missing required keys SHALL render the generic server-failure state and SHALL NOT fall back to mocks or a hardcoded `centro` branch.

- GIVEN an anonymous visitor opens `/catalogo` with no prior branches response
- WHEN the view mounts and discovery runs
- THEN exactly one `GET /public/catalog/branches` is observed with no `Authorization`, body, or query string and does not use the authenticated Axios chain
- AND a `200` array matching the DTO is accepted; non-array or malformed items render server-failure state, not a mock or `centro` fallback

### REQ-CAT-BD-002: Zero, one, many — never auto-select

Zero, one, and many published branches SHALL each render the correct discovery state. Exactly one branch SHALL be shown as an explicit choice and SHALL NOT be auto-selected, marked as selected, or used as a canonical claim.

- GIVEN discovery returns 0, 1, or N≥2 branches
- WHEN discovery completes
- THEN empty state, single explicit choice, or populated chooser in response order is rendered respectively
- AND no branch is highlighted, marked selected, or claimed canonical, even when only one branch is returned

### REQ-CAT-BD-003: Pre-existing slug preserved, no navigation

When `/catalogo/:branchSlug` is supplied, the slice SHALL preserve that slug verbatim, SHALL NOT redirect/rewrite/fall back, and SHALL NOT navigate, push, replace, or claim a selected branch on chooser interaction.

- GIVEN a visitor opens `/catalogo/some-slug` and discovery returns branches
- WHEN discovery completes and the user interacts with the chooser
- THEN the URL still shows `/catalogo/some-slug` with no router push/replace/redirect running
- AND no branch is presented as selected and no `centro` fallback occurs, matching or not

### REQ-CAT-BD-004: Loading, manual retry, retry-pending; no auto-retry

The first request SHALL render the loading state. A user-triggered retry SHALL set retry-pending and reissue the same isolated anonymous request. Retries SHALL NOT run automatically and SHALL NOT navigate or select a branch.

- GIVEN the initial request is pending, or an empty/recoverable-error state is visible
- WHEN pending continues, the user retries from an enabled state, or time passes without action
- THEN pending disables retry and cannot issue another request; enabled manual retry shows retry-pending and reissues the same isolated GET without navigation or selection
- AND without eligible user action, no additional request is issued and the current state remains visible

### REQ-CAT-BD-005: 429, 5xx, and network failures are distinguishable and recoverable

A `429` SHALL render the rate-limit state; any `5xx` SHALL render the generic server-failure state; a fetch rejection or abort SHALL render the network-failure state. The three states SHALL be distinguishable copy, SHALL remain recoverable via the manual retry in REQ-CAT-BD-004, and SHALL NOT auto-retry.

- GIVEN the server returns 429, an HTTP 5xx, or the request fails without an HTTP response
- WHEN discovery completes
- THEN rate-limit, generic server-failure, or network-failure copy is rendered respectively, each visibly different
- AND the manual retry is available for all three and no auto-retry runs

### REQ-CAT-BD-006: No product request and existing shell/responsive layout preserved

Discovery SHALL NOT issue product, variant, cart, search, category, or stock requests and SHALL NOT mount product, variant, search, or cart UI. The catalog header/main/footer topology and visual language SHALL remain visually intact at narrow and wide layouts; the existing branch affordance hosts the chooser while search/cart affordances stay disabled.

- GIVEN an anonymous visitor opens `/catalogo` at narrow and wide viewports
- WHEN discovery renders any state
- THEN the only observed requests are `GET /public/catalog/branches` plus manual retries; no product, search, category, variant, or cart request is observed
- AND header/main/footer mount in order with no overflow or horizontal scroll at either width, search/cart stay disabled, and no product/variant/search/cart UI is rendered