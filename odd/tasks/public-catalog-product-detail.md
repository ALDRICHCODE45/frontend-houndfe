# Public catalog — real product detail

## Objective and authority

Elevate the working anonymous `/catalogo/:branchSlug` browse flow so selecting a real product opens an accessible product-detail modal backed only by the verified public backend contract. Preserve the completed minimum-browse behavior and all existing hidden/null price and stock semantics.

This is a new ODD slice explicitly authorized by the user after the minimum public catalog was live-validated. It is not a continuation, reset, archive, or remediation of historical OpenSpec work. No backend mutation, restart, branch, test, or source inspection is authorized from this frontend session; backend contract needs go through intercom to the backend owner.

No commit, staging, push, PR, destructive Git operation, or unrelated cleanup is authorized. Preserve the dirty working tree, `stash@{0}`, historical OpenSpec artifacts, and prior native review lineages.

## Design read

Read this as an anonymous public storefront for practical retail buyers, preserving the existing clean and direct catalog language. The detail experience should feel like a calm extension of the product grid: accessible, responsive, image-led where real media exists, and explicit about unavailable price or stock without inventing commerce behavior.

Design dials: variance 5, motion 3, density 4. Reuse the project's established component library, tokens, radius system, icon family, and modal conventions. Motion is limited to functional open/close feedback and must honor reduced motion.

## Problem and why

The minimum catalog deliberately stops at real product cards. The current production flow has no trusted detail DTO, fetch boundary, composable, or card interaction. Legacy `catalog.api.ts`, mock data, store, modal, and cart surfaces are disconnected references and cannot establish the production contract.

The list response already returns `priceContext.priceListId`, but `CatalogView.vue` currently discards the response object. Product detail must carry the resolved list price context consistently and must not guess whether the route-selected slug is a tenant slug or branch slug.

## Scope

Included:

- verify the exact anonymous public product-detail backend contract through the backend owner;
- add a strict frontend DTO/parser and isolated anonymous fetch boundary;
- add abort-safe, identity-safe detail query state keyed by every contract identity;
- make a real product card keyboard- and pointer-operable;
- open a responsive accessible detail modal with loading, populated, unavailable, rate-limit, server, network, and retry states;
- preserve price/stock/image nullability and hidden presentation rules;
- prove grid/view/modal wiring and responsive behavior.

Excluded:

- search, categories, sort, pagination, variants selection unless the verified detail contract makes read-only variant display inseparable from detail;
- cart, quantities, checkout, WhatsApp, authentication, shared router redesign, mock fallback, or Pinia catalog migration;
- backend changes from this session;
- unrelated catalog-settings, POS editor, or OpenSpec changes.

## Verified backend contract

Backend-owner read-only evidence confirms the current source contract:

- Request: anonymous `GET /public/catalog/:tenantSlug/products/:productId?priceListId=<UUID>` with no global prefix, JWT, authorization header, tenant header, or body.
- `tenantSlug` is `Tenant.slug`. `/public/catalog/branches` exposes published active tenants as branch-shaped records, so `selectedBranch.slug` is the correct path identity; there is no separate Branch identity in this contract.
- `productId` is a UUID. `priceListId` is an optional UUID query parameter. Passing the list response's resolved `priceContext.priceListId` preserves the exact list context; explicit unavailable/unlinked context fails without fallback.
- Unknown, repeated, or non-UUID query values and invalid product UUIDs are 400 responses. Tenant/context/product ineligibility is 404, including unpublished/inactive tenant, wrong tenant product, service, unpublished product, all variants OFF, or no eligible context price. Public browse is throttled and may return 429.
- Response is the unwrapped detail DTO recorded in the contract attachment: nullable description/category/brand, zero-or-more images and variants, strict price objects, selected-tenant-only variant availability, resolved stock presentation, response price context, and reserved literal-null/zero fields.
- Hidden price means `priceCents: null` and `hidden: true` for the product and every variant. Never substitute zero or another price list.
- HIDDEN stock means `availability`, `status`, and quantity presentation remain null as documented. `customQuantity` is presentation-only for CUSTOM_QUANTITY, may be zero, and is not operational inventory.
- Cache contract is `Cache-Control: public, max-age=60`.

Evidence came from the backend owner inspecting the public catalog controller, guard, request DTO, mapper, use case, repository, exception filter, throttle module, and existing contract tests. The endpoint's availability in the currently running live backend remains unverified and is not required to invent frontend behavior.

## Component map

- `CatalogView.vue`: route-level composition only; owns selected product identity and exact invoking control, passes the verified catalog identity and list `priceContext`, and closes/resets detail selection with safe focus restoration.
- `CatalogProductGrid.vue`: renders list state and relays a typed `open-detail(productId, invoker)` event without owning modal or network state.
- `CatalogProductCard.vue`: renders one product and emits its stable product identity plus exact native button from a keyboard-operable control.
- `useCatalogProductDetail.ts`: owns query state keyed by tenant slug, product UUID, and resolved price-list UUID; forwards aborts, prevents stale detail, and exposes guarded manual retry.
- `catalog-product-detail.api.ts`: builds the exact anonymous request and strictly validates the documented response.
- `CatalogProductDetailModal.vue`: presentational dialog with props down and typed `close`/`retry` events up; no fetch, store, cart, or mock ownership.

## TDD and verification mode

TDD is **off by current evidence**: no task/session user instruction or repository-level configuration enables strict TDD for this slice. Existing tests do not enable TDD by themselves. Use ordinary behavior-first implementation checks and retain honest execution evidence. Runner: `pnpm test:unit --run`.

Receipt-driven development state is not inferred here. After the bounded writer returns, use native `gentle_review assess` on the actual diff and follow its returned verification plan.

## Delivery and workload

Delivery strategy: `ask-on-risk` (default). No commit is currently authorized, so no work-unit commit or PR boundary will be created without a separate explicit user request.

Forecast: approximately 450–650 authored changed lines across strict transport validation, query state, modal interaction, unit tests, and responsive evidence. This exceeds the advisory 400-line planning heuristic because the coherent behavior requires transport, state, accessible UI, and regression proof; split implementation into bounded tasks rather than omitting tests or weakening validation.

## Tasks

- [x] **D1 — Confirm and record the public detail contract.** Backend-owner evidence confirmed the anonymous detail route, Tenant.slug identity, optional explicit price-list query, complete response shape, null/hidden rules, validation failures, ineligibility semantics, caching, and throttle behavior. No backend file or runtime was touched from this session.
- [x] **D2 — Add the strict anonymous detail boundary.** Added the exact anonymous detail DTO/parser/fetch boundary and three-identity abort-safe query composable. After two bounded test-only corrections, final independent verifier `mu5qmki4-7-u9vl` closed every DTO, cancellation, refetch, remount, query-key, stale-data, and MaybeRefOrGetter regression gap. Writer, parent, and verifier observed 59/59 focused tests; typecheck, Prettier, and whitespace checks pass. No production defect, commit, staging, push, or backend operation occurred.
- [x] **D3 — Add accessible card-to-modal interaction.** Added native card activation with exact invoker propagation, typed grid relay, guarded list-context detail orchestration, deterministic user-close focus restoration, branch/context reset safety, responsive read-only modal states, and semantic variant rendering. After one bounded correction, independent re-verification passed all three prior focus/context/selected-tenant blockers. Writer, parent, and verifier observed 40/40 focused tests; typecheck, Prettier, and whitespace checks pass. Browser UModal focus trap, Escape, and viewport proof remain for D4.
- [x] **D4 — Verify the complete detail slice.** Added the single strict-network responsive Playwright spec and closed every independent finding through layered unit/browser evidence. Final verification passed 178 catalog unit tests, typecheck, production build, responsive typecheck, 26 browser cases across the four public catalog specs, Prettier, and whitespace checks. Parent spot-check repeated the 9 detail browser cases successfully.

## Authorized implementation surfaces

Expected existing files:

- `src/features/catalog/views/CatalogView.vue`
- `src/features/catalog/views/__tests__/CatalogView.spec.ts`
- `src/features/catalog/components/CatalogProductGrid.vue`
- `src/features/catalog/components/CatalogProductCard.vue`
- `src/features/catalog/components/__tests__/CatalogProductCard.spec.ts`
- `src/features/catalog/interfaces/public-catalog-products.types.ts`
- `e2e/responsive/specs/public-catalog-products.spec.ts`
- this task document

Expected new files or narrowly scoped directories:

- `src/features/catalog/interfaces/` for the verified detail DTO only
- `src/features/catalog/api/` for the verified detail transport and focused tests only
- `src/features/catalog/composables/` for the verified detail query and focused tests only
- `src/features/catalog/components/` for the detail modal and focused tests only
- `e2e/responsive/specs/` for detail-specific responsive evidence only if extending the existing product spec would blur responsibilities

Explicitly excluded: `src/features/catalog/api/catalog.api.ts`, `src/features/catalog/stores/useCatalogStore.ts`, mock catalog sources, `CatalogCartDrawer.vue`, `useCatalogCart.ts`, authenticated HTTP clients, backend paths, and unrelated dirty files.

## Acceptance criteria

- A pointer or keyboard activation on a real list card opens the matching product's real detail.
- The detail request is anonymous, exact, abortable, and keyed by every backend-required identity.
- `response.priceContext.priceListId` from the selected list response reaches detail exactly as the backend contract requires.
- Rapid product/branch changes cannot expose stale detail or leave an old modal associated with a new catalog identity.
- Modal loading, content, not-found/unavailable, 429, server, network, and retry states are contextual and accessible.
- Escape closes the modal, focus is contained while open, and focus returns to the invoking product control.
- Null/hidden price never renders as zero; hidden/unknown stock never becomes an out-of-stock claim.
- Real images have stable reserved space and a safe fallback; no mock or invented media is introduced.
- No cart, quantity selection, checkout, auth, search, filter, or speculative variant action appears.
- Desktop, 375 px, and 320 px have no horizontal overflow or unreachable dialog actions.

## Verification contract

Minimum commands after implementation:

```sh
pnpm test:unit --run src/features/catalog
pnpm type-check
pnpm build
git diff --check
```

Responsive evidence must prove exact anonymous network behavior, pointer and keyboard opening, close/focus behavior, content/error/retry states, semantic price/stock rendering, and no horizontal overflow at desktop, 375 px, and 320 px.

## Verification evidence

D2 writer implementation changed only the five authorized new files and reported 35/35 focused tests, typecheck, Prettier, and whitespace checks passing. Parent repeated the 35-test command successfully. Native risk assessment was unavailable because native assess returned empty output, so the risk-gated plan required independent high-risk verification.

Independent verifier `mu5pr8qy-3-odkg` returned FAIL despite correct inspected runtime behavior because the regression suite could remain green after removing material validation/cancellation/key-isolation safeguards. No runtime defect was identified.

The first bounded correction changed only the two focused specs. It added nullable-valid and malformed DTO branch coverage, actual signal-abort assertions for identity changes and unmount, hostile TanStack defaults for retry/focus/reconnect/mount safeguards, valid-to-valid transitions for all three identities, and plain/getter input coverage. Writer and parent spot-checks passed 51/51 focused tests.

Independent re-verifier `mu5qa654-5-87k3` still returned FAIL with five deterministic mutation gaps: category name, image id/url, and nested variant-image URL validation were not independently challenged; `retryOnMount:false` was not exercised by remounting an errored cached query; and getter normalization was proven only for product ID rather than independently for tenant slug and price-list ID. All other prior blockers closed, production behavior remained correct, and all commands passed.

The second surgical correction again changed only the two specs. It added isolated malformed cases for all four nested DTO branches, an observable errored-cache remount check under hostile `retryOnMount` defaults, and one-getter-at-a-time behavioral cases for tenant, product, and price-list identities. Writer and parent spot-checks passed 59/59 focused tests.

Final independent verifier `mu5qmki4-7-u9vl` returned PASS. It confirmed all five remaining mutation gaps closed, every prior safeguard retained, and focused tests, typecheck, Prettier, and whitespace checks passing. D2 is complete.

D3 writer `mu5qvgdb-8-yrxq` implemented the authorized eight-file card/grid/modal/view slice. Its first run passed 39/39 focused tests, typecheck, and whitespace checks but failed Prettier. Follow-up `mu5rcu22-9-s3iz` formatted only those eight files and reran every D3 check successfully; parent repeated the 39-test command successfully.

Native assessment then returned unavailable because the native command produced empty output. The risk-gated plan treated D3 as high risk. Independent verifier `mu5rh45k-a-662b` returned FAIL despite all commands passing: card events carried only product ID, so pointer invocation could not deterministically restore the actual button unless it was already focused; no absent-context activation test protected the price-context guard; and the modal fixture's single availability entry could not detect replacing selected-tenant lookup with first-entry lookup. Other card, grid, view, modal, semantic, isolation, and test-quality checks passed.

Bounded correction `mu5rrfy9-b-u68q` changed only the seven authorized runtime/spec files. Card now emits product ID plus the exact native button, grid relays both arguments, and view stores it only after branch/context guards then restores only a connected enabled invoker. Missing-context activation remains disabled in a DOM-driven test, and variant rendering is tested with an unselected conflicting branch before the selected one. Writer and parent spot-checks pass 40/40 focused tests, typecheck, Prettier, and whitespace.

Independent D3 re-verification returned PASS: exact currentTarget propagation and pointer-focus restoration are mutation-sensitive, missing price context blocks modal/detail identity, conflicting unselected availability cannot replace the selected tenant, no-commerce assertions remain, and no new material finding exists. Browser-only real UModal focus trap, Escape dismissal, and desktop/375 px/320 px viewport proof move to D4.

D4 writer `mu5szf08-1-x37d` created only `e2e/responsive/specs/public-catalog-product-detail.spec.ts` and reported 9/9 focused browser cases, responsive typecheck, Prettier, and whitespace checks passing. Native assessment was unavailable again because the native command returned empty output, so D4 followed the high-risk independent-verification path.

Independent verifier `mu5tr8is-2-ds2y` returned FAIL despite all seven final-matrix commands passing: the document-level boot retry could mask a first-navigation frontend or pre-API failure without proving the claimed Vite error; anonymous headers were asserted only for detail rather than branch and list requests; absence assertions were not mutation-sensitive for filter/sort or non-link auth/commerce controls outside the dialog; and the 429 browser case proved one manual retry but not the concurrent retry guard. Observed checks were 178/178 catalog unit tests, typecheck, build, responsive typecheck, 26/26 Playwright cases, Prettier, and whitespace all passing.

Bounded correction writer `mu5u1r4s-3-ei3d` changed only the D4 spec. It removed every boot reload/recovery path, captures complete anonymous wire evidence for branch/list/detail through `allHeaders()`, asserts an exact page-wide enabled-control inventory plus the known disabled shell controls, and holds the manual 429 retry response while challenging concurrent activation. The writer reported responsive typecheck, 9/9 focused Playwright cases, Prettier, and whitespace checks passing. Native assessment remained unavailable and again required high-risk independent verification.

Independent re-verifier `mu5v0c8w-4-40wk` returned FAIL while all seven final-matrix commands again passed: 178/178 catalog unit tests, typecheck, build, responsive typecheck, 26/26 Playwright cases, Prettier, and whitespace. The boot-retry, full-request anonymity, and page-wide control-inventory findings closed. The concurrent retry finding remained because the test challenged an already-removed retry locator and pressed keys on a dialog with no retry handler; removing the composable's `query.isFetching` guard would not fail that scenario.

Final bounded writer `mu5v9iky-5-8r1l` changed only the D4 spec so the connected, enabled `Reintentar` button receives two native DOM clicks in one synchronous browser turn before Vue removes it. Focused checks again passed 9/9 plus responsive typecheck, Prettier, and whitespace. The writer also established an important evidence boundary: TanStack Query deduplicates the second pending same-query refetch in the rate-limit/no-data state before transport, so this E2E cannot distinguish removal of the local `query.isFetching` guard by network count alone. The existing focused composable test at `src/features/catalog/composables/__tests__/useCatalogProductDetail.spec.ts:206-222` provides the mutation-sensitive layer instead: after populated data, it invokes `retry()` three times while one refetch is pending and requires only one additional transport mock call plus `retry-pending`. The final matrix runs that test.

Final independent verifier `mu5vld74-6-rz2f` returned PASS with no findings. It confirmed the first three D4 findings remained closed and that the layered retry evidence is complete: the browser proves two real clicks on the same connected accessible control plus one held successful retry, while the populated-data unit test would fail if the local fetching guard were removed. The complete final matrix passed: 178/178 catalog unit tests, typecheck, production build, responsive typecheck, 26/26 Playwright cases, Prettier, and whitespace. No environmental boot failure occurred. Parent then reran the detail spec as the required spot check and observed 9/9 cases passing.

## Progress and next step

D1–D4 are complete. The anonymous public catalog product-detail slice now has strict boundary, state, accessible UI, and responsive browser evidence. No commit, staging, push, or backend operation was performed or authorized. Await a separate user instruction for any delivery action.
