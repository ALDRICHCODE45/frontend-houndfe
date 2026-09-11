# Catalog Branch Entry Specification — D1 only

## Purpose

Define acceptance criteria for anonymous branch discovery and a selected-branch landing at `/catalogo/:branchSlug?`, without browsing products. Planning only; this document authorizes no implementation or later delivery.

## Authority and scope

- The user-approved [delivery map](../../delivery-map.md), current [exploration reconciliation](../../exploration.md#current-reconciliation--2026-09-backend-completion-re-exploration), and explicit user clarifications override conflicting historical [proposal](../../proposal.md) assumptions. Proposal history remains unchanged; its whole initiative is not approved by this specification.
- Superseded here: the blanket planning pause, first-slice branches-plus-products/detail/cart integration, implicit first-branch/`centro` selection, visitor price selector, price sorting, and any checkout/phone interpretation. Only bounded D1 planning has resumed.
- This is a new domain specification (no canonical `catalog-branch-entry` spec exists), not a destructive replacement of historical requirements. The domain is taken from the authorized D1 boundary rather than the proposal's broad capability groupings.
- D2+ clarifications remain constraints for later planning, not D1 work: default public price context with retained resolved `priceListId`, MXN business configuration, no price sorting, nullable/zero `CUSTOM_QUANTITY` not implying out-of-stock, stateless cart validation only, separate `read/update:TenantCatalogSettings`, and variant configuration through PATCH only.

## Contract and evidence

Backend authority: `houndfe-backend/docs/backend-responses/public-online-catalog-frontend-guide.md`, sections 2, 4.1 and 6 (read-only; deployment unconfirmed).

`GET ${API_BASE}/public/catalog/branches` takes no parameters, query or body. HTTP 200 is a bare array of `{ id: string, name: string, slug: string, address: string | null, phone: string | null }`. It lists active, catalog-published tenants, with zero/one/many results. `id` is a tenant UUID; `slug` is the URL identity. Address/phone are **nullable required keys**, not documented optional keys. No logo, business branding, hours or price context is supplied. Cache guidance is `public, max-age=300`; GET rate limit is 60/min per IP.

Frontend evidence: `catalog.api.ts` and `useCatalogStore.ts` import mocks; the store selects the first branch and fetches products with a `centro` fallback. `CatalogView.vue` initializes only on mount. `CatalogHeader.vue` selects without routing and displays Coco/search/cart; `CatalogProductGrid.vue` confuses absent products with no matches. `src/core/shared/api/http.ts` injects tokens/no-cache headers and refreshes sessions. `src/app/router/index.ts` marks the route public but performs auth hydration/profile/permission work before or beyond that check.

## Requirements

### Requirement: REQ-CBE-001 — Anonymous discovery boundary

The system SHALL discover branches only through the documented public GET, without bearer tokens, cookies or other authentication credentials, authenticated tenant context, permission checks, login redirects or session-refresh side effects. It SHALL preserve public cache semantics rather than inherit authenticated no-cache headers. Stored or expired operator credentials SHALL NOT change public access or discovery results.

**Clarification (planning only, not a product change).** REQ-CBE-001 is interpreted narrowly: the catalog route never **emits** a session-expired event, and the global session-expired handler in `src/main.ts` suppresses the `router.replace('/login')` diversion only when the resolved current route name is `public-catalog`. The session-clearing side of the same handler still runs because legitimate cleanup of unrelated authenticated work must not be silently cancelled by a catalog guard. If REQ-CBE-001 is intended to prohibit even unrelated in-flight operator cleanup, that is a security-scope change flagged for human authorization in [tasks.md](../../tasks.md) and not silently implemented here. The catalog route is added to the router `beforeEach` early-return list before auth hydration/profile/permission fetches, but `/login` (which must keep redirecting authenticated users), `/forbidden` and `/not-found` are excluded from that bypass.

#### Scenario: Visitor with no session or a stale operator session
- GIVEN either no stored credentials or stale operator credentials and unloaded permissions
- WHEN the visitor opens either catalog route and discovery succeeds
- THEN published branch choices are available without authenticated API calls, credential transmission, session mutation or login/tenant-selection diversion.

### Requirement: REQ-CBE-002 — Discovery truth and loading

The system SHALL distinguish pending discovery, successful empty discovery and discovered choices. It SHALL expose only returned branches and SHALL NOT infer publication or a selected branch from fixture data, a tenant UUID or an arbitrary default.

#### Scenario: Zero, one or many published branches
- GIVEN a discovery request is pending
- WHEN it completes with an empty array, one branch or multiple branches
- THEN loading ends and the UI respectively communicates no available branches or exposes exactly the returned choices.
- THEN (negative) pending discovery is not presented as empty discovery or missing products; even one result leaves `/catalogo` as an unselected chooser; no branch is auto-selected (confirmed P1).

### Requirement: REQ-CBE-003 — Slug resolution and unavailable branches

The system SHALL resolve a supplied slug against successful discovery using the returned slug, and SHALL render only the matching branch as selected. An unmatched slug SHALL yield a distinct unavailable-branch state, without selecting a substitute or claiming why the branch is absent. With no slug, `/catalogo` SHALL show an unselected chooser even for one branch. An invalid slug SHALL stay in the URL with neutral unavailability and the discovered choices; no automatic redirect occurs (confirmed P1–P2).

#### Scenario: Valid deep link
- GIVEN discovery contains a branch whose slug matches the route
- WHEN discovery resolves on a direct visit or reload
- THEN its returned name and available address identify the selected landing.

#### Scenario: Unknown slug or discovery failure
- GIVEN a supplied slug
- WHEN successful discovery contains no match, including an empty result
- THEN no branch is selected and branch unavailability is distinguishable from global empty discovery.
- THEN (negative) a failed discovery request is not evidence of an invalid, private or unpublished branch; no fallback branch or product lookup is used.

### Requirement: REQ-CBE-004 — Selection and navigation synchronization

The system SHALL keep route slug, selected control and landing identity consistent. Explicit branch selection SHALL push a browser-history entry using the returned slug in `/catalogo/:branchSlug` (confirmed P1). Direct route changes and browser back/forward SHALL update selection without requiring a remount. Navigation failure SHALL NOT leave a landing claiming a different branch than the current route.

#### Scenario: Selection followed by history navigation
- GIVEN branch A is selected and discovery also contains B
- WHEN the visitor selects B and subsequently navigates to A through browser history or a route update
- THEN each settled route displays its matching branch in both control and landing, with no product request.

#### Scenario: Navigate to missing or unknown slug
- GIVEN a previously selected branch
- WHEN navigation removes the slug or supplies an unmatched slug
- THEN the previous branch is no longer presented as selected for that URL; the missing-slug entry shows the unselected chooser, while an unknown slug remains in the URL with unavailability and discovered choices (confirmed P1–P2).

### Requirement: REQ-CBE-005 — Honest branch metadata and D1 boundary

The landing SHALL show the returned branch name and non-null address without fabricated merchant identity. Null address/phone SHALL be tolerated without literal `null`, `undefined`, invented contact details or a broken control. Missing keys are not a documented contract variant; defensive handling SHALL NOT fabricate values. D1 SHALL make no product/list/detail/cart/settings request and SHALL expose no product data, cards, results counts, search, categories, sorting, price selectors, details, cart/add, WhatsApp or telephone action.

#### Scenario: Branch with and without contact metadata
- GIVEN a selected branch with an address, or with null address and phone
- WHEN its landing renders
- THEN its name is shown and a present address is shown; absent metadata conveys no invented address, phone, logo, hours or Coco identity.
- THEN (negative) the page does not claim zero products or search results merely because D1 never requests a listing; the null address row is omitted, and catalog/branch labels use the project's existing neutral functional Spanish tone without invented branding (confirmed P3).

#### Scenario: D1 runtime isolation
- GIVEN any D1 state, navigation or retry
- WHEN the public route runs
- THEN its runtime dependency path imports no mock catalog data, sends no product or later-delivery requests, and exposes none of the excluded controls, including keyboard-accessible hidden remnants.

### Requirement: REQ-CBE-006 — Recoverable errors and retry

The system SHALL distinguish rate limiting (429), server failure (5xx) and network failure from successful empty discovery. It SHALL offer an accessible retry action, show pending retry, prevent duplicate submissions while pending, and avoid automatic loops amplifying 429. Error presentation SHALL remain safe when the error body is missing or unexpected and SHALL NOT expose internal server details.

#### Scenario: Failure then recovery
- GIVEN discovery fails with 429, 5xx or a network error, with or without a usable error body
- WHEN the visitor retries and the request subsequently succeeds
- THEN the applicable recoverable failure gives way to pending and then the returned empty/choices/route-resolved state, with the obsolete error cleared.
- THEN (negative) repeated activation while pending does not issue duplicate discovery requests or invoke authentication recovery.

### Requirement: REQ-CBE-007 — Stale-state isolation

The system SHALL prevent obsolete requests, previous route selections and failed refreshes from masquerading as current successful discovery. A latest successful discovery that no longer contains the selected slug SHALL remove that selected landing. Retained data during pending/error states SHALL be explicitly non-current rather than an unqualified success.

#### Scenario: Route changes during discovery or retry
- GIVEN discovery or retry began for a view showing route A
- WHEN the route changes to B before completion, or an older request completes after a newer request
- THEN only the current route and current accepted discovery determine the landing; obsolete completion cannot restore A or overwrite a newer error/success.

#### Scenario: Selected branch disappears
- GIVEN the previously successful discovery included the selected branch
- WHEN the next successful discovery excludes it
- THEN the UI clears that selected identity and presents the applicable unavailable/empty state without substitution.

### Requirement: REQ-CBE-008 — Responsive and accessible existing shell

The system SHALL preserve existing catalog visual language and header/main/footer composition without redesign or mock-only claims. Branch selection and retry SHALL have accessible names, keyboard operation and visible focus; selected state SHALL not rely on color alone. Loading/errors SHALL be programmatically conveyed. Long branch names/addresses SHALL remain readable without page-level horizontal overflow or unreachable controls at narrow and wide widths.

#### Scenario: Narrow and wide state coverage
- GIVEN documented fixtures for loading, choices, selected landing, empty discovery, invalid slug and each recoverable error
- WHEN rendered at representative narrow (375px) and wide (1280px) viewports with long metadata and keyboard navigation
- THEN the existing responsive shell remains recognizable, all available controls are reachable and labeled, and status/identity remain perceivable without clipped essential content.

## Confirmed product choices

The user explicitly confirmed P1–P3 before technical design; these decisions change no broader delivery scope:

| ID | Product choice | Confirmed behavior |
| --- | --- | --- |
| P1 | Missing slug and selection history | `/catalogo` shows an unselected chooser even with one branch; explicit selection pushes browser history. |
| P2 | Unmatched slug recovery | Preserve the invalid URL with neutral unavailability and discovered choices; no automatic redirect or cause inference. |
| P3 | Missing address and neutral labels | Omit the null address row; use neutral functional catalog/branch labels in the project's existing language/tone, with no invented branding. |

Technical recommendations (not product approvals): isolate anonymous transport from authenticated interceptors; resolve selection from route plus discovery; reject/ignore obsolete async completion. Cache policy, parsing strategy, retry timing and implementation boundaries belong in the separately authorized technical design. No new backend fields or deployment assumptions are needed.

## Delivery and verification boundary

This artifact records criteria, not executed tests. Eventual D1 evidence SHALL cover the scenarios above with documented HTTP fixtures, focused tests and narrow/wide responsive evidence; fixtures are not proof of deployment. No implementation, tests, tasks, commits or subsequent phase were executed here.

The roadmap's D1 estimate of 220–340 authored changed lines is provisional. The 400-line maximum counts additions **plus deletions**, including documentation, source, tests, and responsive evidence. P0 planning is a separate, not-delivered candidate: only after it is accepted and delivered can its future runtime budget start from that explicit baseline. The parent SHALL stop on forecast risk rather than hide documentation cost or infer a size exception.

### Incremental scope note (planning only, not a final-requirement change)

The final D1 requirements above remain the target and are not weakened here. The earlier inline replacement-shell candidate remains rejected because it removes existing visual controls instead of adapting them. A separate proposed P0 unit now has a genuine unchecked TDD checklist in [tasks.md](../../tasks.md): it preserves the five-SFC shell/theme and visible-disabled controls, shows neutral branch-selection unavailability, and unmounts demo product/cart/contact behavior. P0 is **not** anonymous D1, does not edit router/main/auth, and does not assert REQ-CBE-001. Auth isolation, real discovery, selection/history and invalid-slug handling remain final D1 work; each future behavior carries its own viewport coverage. This note changes no SHALL/SHOULD above.
