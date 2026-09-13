# Proposal: Public catalog branch discovery

## Intent

Let anonymous visitors to `/catalogo` discover real published branches through an explicit chooser while preserving the existing public catalog shell. This is the first post-bootstrap catalog behavior: it establishes discovery only, not branch selection or product browsing.

## Scope

- Fetch `GET ${API_BASE}/public/catalog/branches` through an isolated anonymous request boundary, without authenticated interceptor behavior, credentials, request body, or query parameters.
- Validate the documented bare-array response proportionally and reuse `PublicBranchDto` when it matches `{ id, name, slug, address, phone }`.
- Render every returned branch as an explicit choice, including when exactly one branch is returned; never auto-select a branch.
- Provide first-class loading, empty, rate-limited (429), server failure (5xx), network failure, retry-pending, retry, and populated chooser states.
- Preserve the `/catalogo/:branchSlug?` route and preserve a pre-existing slug without redirect, fallback, or a claim that a branch is selected.
- Keep the existing catalog header/main/footer topology and visual language. Adapt only the existing branch affordance and neutral discovery treatment needed for the chooser.
- Ensure discovery does not request or render products, and capture focused API/composable/view coverage plus responsive evidence.
- Mechanically reconcile `openspec/changes/online-catalog-publishing/delivery-map.md` planning history: record P0.1 as delivered at `aa2b204` and replace its obsolete combined-D1 forecast with this discovery slice and deferred follow-on slices, without changing native verification evidence.

## Non-goals and deferred work

- No `router.push`, canonical slug selection, query/hash preservation, selected-branch landing, or selected name/address presentation.
- No advanced invalid-slug recovery, back/forward synchronization, disappearing-branch behavior, navigation-failure handling, or race triangulation.
- No products, search, categories, details, variants, cart, prices, stock, or authenticated catalog administration.
- No redesign, new branding, phone/WhatsApp workflow, route change, or production/deployment claim.

## Affected areas

- `src/features/catalog/api/` for the isolated public branches request and response validation.
- `src/features/catalog/composables/` for discovery lifecycle, retry, and stale-request safety.
- `src/features/catalog/views/CatalogView.vue` for discovery-state orchestration without product requests.
- `src/features/catalog/components/CatalogHeader.vue` and, only if needed to keep the existing shell focused, one small chooser component or neutral-state updates in `CatalogProductGrid.vue`.
- Focused co-located API, composable, and view tests; router and app-entry regression reads/tests without planned runtime edits.
- `openspec/changes/online-catalog-publishing/delivery-map.md` for the required historical planning reconciliation.

## Risks and controls

- **Review-budget risk:** Planning, discovery core, and error/resilience extension are separate review units. Each unit counts its own docs, runtime, tests, and responsive evidence against its immediate parent and must retain margin below the absolute 400-line cap; cumulative change size never authorizes an oversized unit.
- **Anonymous-boundary risk:** Reusing the authenticated HTTP client could attach authorization, trigger refresh behavior, or alter cache semantics. Use a deliberately isolated request boundary and assert observed request behavior in focused tests.
- **Selection leakage risk:** Existing mocks and store behavior select the first branch or fall back to `centro`. Do not reuse those runtime paths; one branch remains a visible choice, not an implicit selection.
- **State ambiguity risk:** 429 must remain distinguishable from generic server and network failures. Model loading, retry-pending, empty, populated, and recoverable errors explicitly.
- **Shell-regression risk:** Limit UI work to the current header and neutral catalog treatment, with narrow and wide responsive evidence.

## Rollback

Revert this change as a single bounded discovery slice. The existing anonymous route bootstrap and catalog shell remain intact; no route migration, persisted selection, product data path, or backend contract migration is introduced by this proposal.

## Success criteria

1. An anonymous `/catalogo` visit issues exactly the documented public branches request through an isolated unauthenticated boundary.
2. A valid response with zero, one, or many branches renders the corresponding discovery state, and a single result is never auto-selected.
3. Loading, empty, 429, 5xx, network failure, retry-pending, and retry behavior are visible and covered by focused tests.
4. A supplied `:branchSlug` remains unchanged, no branch is represented as selected, and chooser interaction does not navigate in this slice.
5. No product request or product UI behavior is added, while the existing catalog shell remains visually intact at narrow and wide layouts.
6. The historical delivery map records the delivered P0.1 commit and superseded combined-D1 estimate without altering native verification history.
7. Detailed tasks keep every review unit below the absolute 400-line cap with explicit comparison bases, and the user approves the proposed chain under `ask-on-risk` before implementation.
