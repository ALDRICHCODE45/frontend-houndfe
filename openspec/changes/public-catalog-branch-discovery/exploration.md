# Public catalog branch discovery — exploration

## Goal and boundary

Plan the first post-bootstrap public-catalog behavior as a dedicated change. An anonymous visitor at `/catalogo` discovers real published branches and can retry recoverable failures. This change stops at discovery and an explicit chooser; route selection, slug canonicalization, invalid-slug recovery, and selected-branch landing move to a later dedicated change because the combined D1 forecast exceeds the absolute 400-line budget.

This is planning only. It does not authorize implementation, commit, push, sync, archive, native remediation, or changes to `.gentle-ai-instance`.

## Baseline

- `main`, `HEAD`, and local `origin/main` resolve to P0.1 delivery commit `aa2b2048ec2fca884038b4d32f8343d06d7911bb`.
- `online-catalog-publishing` and `public-catalog-anonymous-bootstrap` remain native `resolve-blockers/maintainer_decision`; neither is a dependency to reopen or repair.
- P0.1 already gives `/catalogo/:branchSlug?` an anonymous auth-free bootstrap and router-ready mount.
- The only working-tree entry before planning is the preserved untracked `openspec/changes/online-catalog-publishing/.gentle-ai-instance`.

## Repository evidence

| Concern | Existing evidence | Planning consequence |
| --- | --- | --- |
| Public route | `src/app/router/index.ts` defines `/catalogo/:branchSlug?` | Keep the route unchanged in this change. |
| P0 shell | `src/features/catalog/views/CatalogView.vue` mounts header, neutral main state, and footer | Preserve topology and visual language. |
| Header | `src/features/catalog/components/CatalogHeader.vue` already owns a disabled branch affordance | Adapt only the branch affordance; keep search/cart disabled and out of behavior scope. |
| Neutral main | `src/features/catalog/components/CatalogProductGrid.vue` already renders a non-product landing state | Reuse its neutral treatment for discovery states; do not mount products. |
| Legacy mocks | `src/features/catalog/api/catalog.api.ts` returns `MOCK_BRANCHES`; `useCatalogStore.ts` selects the first branch and falls back to `centro` | Do not reuse either runtime path; both violate explicit-selection decisions. |
| DTO | `src/features/catalog/interfaces/catalog.types.ts` already defines `PublicBranchDto` | Reuse if it matches the documented response exactly; avoid a duplicate model. |
| Auth client | `src/core/shared/api/http.ts` adds authorization, no-cache headers, and 401 refresh/expiry behavior | Anonymous discovery needs an isolated public request boundary. |

## Backend contract carried forward

- `GET ${API_BASE}/public/catalog/branches` with no body, query, or authenticated session behavior.
- `200` returns a bare array of `{ id, name, slug, address: string | null, phone: string | null }`.
- Zero, one, or many published branches are valid; one result is still shown for explicit selection and is never auto-selected.
- The slug is the public URL identity. Nullable fields remain explicit.
- Rate-limit evidence requires a distinct 429 state; generic server failure covers 5xx.
- Use an anonymous client boundary (`fetch` with omitted credentials or an equivalently isolated client), not the authenticated Axios interceptor chain.

## Product decisions

- Preserve the current catalog visual language; no redesign, invented branding, phone, or WhatsApp flow.
- `/catalogo` remains unselected even when discovery returns exactly one branch.
- This change renders choices but does not change the route on click; explicit selection and canonical slug history belong to the next bounded change.
- A pre-existing `:branchSlug` is preserved without redirect or fallback. Until the later selection change, discovery may show alternatives but must not claim a selected branch.
- Empty, loading, 429, 5xx/network, retry-pending, and populated chooser states are first-class behavior.
- Products, search, categories, detail, variants, cart, prices, stock, and authenticated catalog administration are non-goals.

## Likely implementation and test surfaces

Expected runtime candidates, to be finalized by design/tasks:

- `src/features/catalog/api/catalog-branches.api.ts` — isolated anonymous request and response validation.
- `src/features/catalog/composables/useCatalogBranches.ts` — discovery lifecycle, retry, and stale-request safety.
- `src/features/catalog/views/CatalogView.vue` — state orchestration without product requests.
- `src/features/catalog/components/CatalogHeader.vue` and/or one small chooser component — explicit branch choices in the existing header language.
- `src/features/catalog/components/CatalogProductGrid.vue` — neutral loading/empty/error copy only if a dedicated chooser does not own it.
- Focused co-located API/composable/view tests plus narrow/wide responsive evidence.
- Regression reads/tests for `src/app/router/index.ts` and `src/main.ts`; no planned runtime edit there.

## Risks and open questions

1. The earlier combined D1 estimate of 220–340 lines is obsolete. Repository mapping forecasts 680–920 lines for discovery, selection, slug recovery, selected landing, and complete coverage together.
2. Even discovery-only is forecast near the ceiling. Design must minimize touched components and tasks must count planning docs, runtime, tests, and responsive evidence together.
3. If the conservative forecast exceeds 400 or leaves unsafe margin, split again before apply; no size exception is available.
4. Deployment availability is not evidence. Tests use documented fixtures and request observation rather than a production claim.
5. Response validation should remain proportional: reject malformed top-level/required keys without building product-domain infrastructure.

## Delivery split

- **This change — `public-catalog-branch-discovery`:** anonymous fetch, populated chooser, no auto-selection, loading, empty, 429, 5xx/network, retry, no product request, responsive evidence.
- **Later change — branch selection/slug landing:** explicit `router.push`, canonical slug, query/hash preservation, valid selected name/address, null-address omission.
- **Later resilience slice if needed:** invalid-slug alternatives, back/forward synchronization, disappearing branch, navigation failure, and race triangulation.

Delivery accounting is per review unit, never cumulative across the chain: the planning baseline must stay below 400; runtime WU-1 and WU-2 must each include their own tests, responsive evidence, and delivery-doc updates and compare against their immediate parent commit. The full change may exceed 400 cumulatively only through those separately reviewable units; no individual unit may reach the cap.

## Historical reconciliation required

`openspec/changes/online-catalog-publishing/delivery-map.md` still says P0.1 “Implementation remains uncommitted” and still forecasts combined D1 at 220–340 lines. Planning should mechanically reconcile P0.1 to delivered commit `aa2b204` and mark combined D1 superseded by this dedicated discovery change plus deferred selection/resilience changes. Do not rewrite or remediate historical native verification evidence.
