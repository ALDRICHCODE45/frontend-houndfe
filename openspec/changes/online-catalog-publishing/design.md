# D1 design — anonymous branch entry

**Planning complete; implementation remains unauthorized.** P1–P3 remain confirmed in [the final D1 spec](specs/catalog-branch-entry/spec.md); `proposal.md` is historical and unchanged. The user separately accepted a proposed preparatory P0 demo deactivation: retain the existing five-SFC composition/theme and visible-disabled controls, show a neutral unavailable-selection landing, and make mock cards/modal/drawer/WhatsApp/phone unreachable. P0 is not anonymous D1 and does not edit router, main, or auth.

## Final D1 design — future work only

Keep `/catalogo/:branchSlug?` and the existing header/main/footer visual shell. A later D1 can introduce one branch-only transport and one view-scoped composable, passing typed props down and selection/retry events up. Do not rewrite the mock API or mixed store merely to delete future-delivery behavior; disconnect their runtime import graph when D1 is explicitly authorized. This is background architecture, not the P0 implementation surface.

Read inputs: repository `openspec/config.yaml`, `DESIGN.md`, roadmap, exploration, proposal, D1 spec, actual catalog/router/bootstrap/auth source, and the read-only backend guide sections 2, 4.1 and 6. Root and parent `AGENTS.md` were absent. Injected Vue, cognitive-doc-design and work-unit-commits skills were loaded, including Vue core references; `skill_resolution: paths-injected`. No phase-specific executor skill path was supplied; this design follows the injected phase contract directly.

| Existing symbol/path | Observed constraint |
| --- | --- |
| `catalog.api.ts:catalogApi`, `useCatalogStore.ts:useCatalogStore` | Static mock imports, local products, first-branch selection and `centro` fallback; unsuitable D1 dependencies. |
| `CatalogView.vue:onMounted` | Initializes only once and mounts category, modal and cart runtime. |
| `CatalogHeader.vue:handleBranchSelect`, `branchMenuItems` | Mutates store/cart, does not push routing; search/cart and Coco claims are live. |
| `CatalogProductGrid.vue`, `CatalogFooter.vue` | Product-card import and false “Sin resultados”; footer imports mock store and makes brand/price claims. |
| `src/app/router/index.ts:beforeEach` | Hydrates/fetches profile before `isPublic`; permissions fetch can redirect a public visitor to login. |
| `src/main.ts`, `useAuthStore.ts:hydrateFromStorage` | Unconditional hydration after router installation writes/clears stored permissions and updates ability; it is not a read-only lookup. |
| `src/main.ts:onSessionExpired`, `src/App.vue:currentLayout` | Global expiry clears session and redirects regardless of catalog; mounting before route readiness can select the default dashboard layout. |

## Anonymous transport and contract

Proposed `src/features/catalog/api/catalog-branches.api.ts:getCatalogBranches(signal)` returns `Promise<PublicBranchDto[]>`. Use native `fetch` with the existing `VITE_API_BASE_URL` convention (fallback `http://localhost:3000`, normalize trailing slash) and `/public/catalog/branches`, method GET, `credentials: 'omit'`, and `signal`. No query/body, bearer header, tenant header, authenticated `http` import, interceptors, refresh, cache-buster or `Cache-Control`/`Pragma` override. Browser default HTTP caching respects the documented `public, max-age=300`; manual retry may still use valid HTTP cache and does not promise forced server freshness.

Reuse the existing type-only `interfaces/catalog.types.ts:PublicBranchDto`: required `id`, `name`, `slug` strings and required nullable `address`/`phone` strings. Add a small local Zod array/object parser in the branch API (Zod is installed); reject missing keys, non-array payloads, wrong primitives and unusable empty identity/name/slug. Do not invent UUID-version or slug-normalization rules; route using returned strings. Reject duplicate slugs to avoid ambiguous selection. Ignore extra keys, never infer publication from them, and render strings through escaped interpolation. Null phone remains data only; no contact action. Null address omits the row.

Require HTTP 200 plus a valid body; invalid JSON/schema becomes generic recoverable failure, never partial choices or an unavailable-slug conclusion. Status-only error classification: `rate-limit` (429), `server` (5xx), `network` (fetch failure), `generic` (other status/malformed response). Never render raw error bodies. No automatic retry, countdown scheduler or refresh loop; retry is explicit and disabled while pending. Cancellation is not a displayed failure.

## State and URL flow

Proposed `composables/useCatalogBranches.ts:useCatalogBranches(slugGetter)` owns the single request lifecycle; no Pinia/global persistent state is needed for this one view. Return readonly discovery state, computed selected branch/landing state, and `retry()`. TanStack Query keys/invalidation/mutations: **not applicable in D1**; browser cache plus view-local request state avoids introducing a second cache/retry policy. Later product query keys are not designed here.

`mount → discovery → validated branches + current route slug → landing`; `select(returned slug) → router.push({ name: 'public-catalog', params: { branchSlug: slug } }) → computed selection`. No speculative selection assignment, local-storage preference or first-branch fallback. Selecting the already selected slug is a no-op; other explicit selections push history. Preserve existing query/hash when changing only the slug. Handle navigation rejection without changing selection and show neutral navigation feedback. Back/Forward, direct param changes and reload resolve against the current URL without requiring remount or refetching global discovery on each slug change.

| Current discovery / URL | Rendered state |
| --- | --- |
| Pending, any URL | Skeleton/status; no current selected identity or choices. |
| Success `[]`, no slug | “No hay sucursales disponibles”. |
| Success with choices, no slug | “Selecciona una sucursal”, including exactly one choice. |
| Success with matching slug | Returned name and non-null address; neutral “Sucursal seleccionada”, no product count or promise. |
| Success without matching supplied slug, including `[]` | “Sucursal no disponible”; URL unchanged, discovered choices remain available when any exist. No cause inference. |
| Error, any URL | Safe category-appropriate message and “Reintentar”; never imply slug invalidity. |

Use a discriminated request state so pending/error do not expose retained data as current success. Initial load and explicit retry clear prior current data/error. Pending retry is single-flight. An AbortController and monotonically increasing request generation protect commits of success, failure and finalization; increment/abort on disposal or replacement, and ignore obsolete completion even if a mock/server ignores abort. Route changes during discovery need no new global request: completion reads the current slug, never a captured selection. A later accepted discovery missing the slug immediately removes its landing.

## Smallest component/file surfaces

All catalog paths below are under `src/features/catalog/`; SFCs retain Composition API and `<script setup lang="ts">`.

| Proposed file change | Single responsibility / contract |
| --- | --- |
| New `api/catalog-branches.api.ts` | Anonymous validated discovery and safe typed failures only. |
| New `composables/useCatalogBranches.ts` | Request lifecycle and derived URL-based branch state only. |
| Modify `views/CatalogView.vue` | Thin composition: call composable, own router push/error handling, wire props/events, remove imports/mounts of cart/category/modal. |
| Modify `components/CatalogHeader.vue` | Props `branches`, `selectedBranch`, `pending`; emit `select(slug)`. Keep dropdown/theme control and sticky spacing, remove store/cart/search and branded identity. |
| Modify `components/CatalogProductGrid.vue` | Reuse main container as D1 landing/state renderer: typed `state`, `selectedBranch`, `navigationError`; emit `retry`. Remove card/store imports; do not fabricate a grid. |
| Modify `components/CatalogFooter.vue` | Static neutral “Catálogo en línea” footer; remove store, Coco/paw identity, price/count claims. |
| Modify `src/app/router/index.ts`, `src/main.ts` (conditional recommendation below) | Coordinate catalog-only guard bypass, startup hydration ownership and route-ready mount; protect existing non-catalog auth behavior with regression tests. |

Keep `CatalogLayout.vue` background/theme, max-width/padding, sticky translucent header, existing Nuxt UI primitives and restrained orange accents. Replace the demo paw/wordmark with a neutral catalog icon/functional label, not new branding. Retain the theme toggle with an accessible Spanish name. Dropdown choices keep full branch names and wrap long addresses; trigger may wrap, must not force page overflow. Use `role=status`/`aria-busy` for pending and polite status updates, accessible error/retry feedback and visible focus. No hidden keyboard-reachable future controls.

Existing mixed API/store, mock data, category/card/modal/drawer/cart files remain untouched and unreachable from the D1 route. Leaving those files preserves their compilation contracts, not authorization to use their behavior. Confirm transitive runtime imports from view/header/grid/footer contain no mock modules; type-only DTO imports are safe. No compatibility stubs or fake product API methods are added. Global deletion/migration of dead demo files is not D1.

## Public boundary — requires coordinated review, not a claim of current safety

An isolated GET alone **does not satisfy REQ-CBE-001 today**. Recommend a narrowly named `public-catalog` early return at the very start of `beforeEach`, before obtaining/hydrating auth state. Do not early-return every `meta.public` route: `/login` currently redirects authenticated users and must retain that behavior. Permission matrix: catalog discovery/selection = anonymous, no CASL action; all existing protected route checks remain unchanged.

For direct catalog startup, remove redundant unconditional `main.ts` hydration and let the existing non-catalog guard own hydration; mount only after `router.isReady()` so `App.vue` cannot transiently mount DashboardLayout. This avoids editing auth-store/session storage implementations or adding an alternate app entry. Test protected startup and catalog-to-protected navigation, including temporary tenant-selection tokens, before adopting it. `App.vue` then needs no source change.

Two expiry cases must not be conflated: D1 discovery must never emit session-expired events; a pre-existing authenticated request from a previous dashboard can still expire while the visitor is on catalog. Safe narrow option: preserve legitimate session cleanup but suppress only login diversion when the resolved current route is `public-catalog`. That does **not** promise zero session mutation from unrelated pre-existing work. Suppressing cleanup wholesale would change security/session semantics and is not silently approved. If REQ-CBE-001 is intended to prohibit even unrelated in-flight operator cleanup, stop for a security-scope decision; a catalog guard cannot enforce that alone. No spec change to REQ-CBE-001 is made in this phase.

## Planned verification — never executed here

Keep tests with their behavior; use existing Vitest/jsdom and `src/test/mountWithUApp.ts` for Nuxt UI provider-dependent components. Proposed files: `api/catalog-branches.api.test.ts`, `composables/useCatalogBranches.test.ts`, `views/CatalogView.test.ts`, `src/app/router/catalog-entry.test.ts`, and `e2e/responsive/specs/catalog-branch-entry.spec.ts`. Bootstrap behavior needs integration coverage against actual `main.ts`, not only a mocked route guard.

Cover zero/one/many, nullable required fields, missing keys/malformed JSON/body, duplicates, credentials omission including same-origin cookies and stale local tokens, no auth/no-cache headers, no product calls, HTTP errors/manual retry/single-flight, ignored abort/obsolete completion/disposal, invalid/absent/valid slug, disappearing branch, failed navigation, Back/Forward and return to entry. Assert no mock import path or excluded control; protected/login/tenant-selection behavior remains intact. Fresh browser contexts with no credentials and expired stored operator credentials must both reach catalog without auth calls or storage mutation caused by startup.

Responsive evidence uses documented local fixtures, not deployment: standalone Playwright spec using the existing responsive config/base URL `/__e2e-api`, without the authenticated fixture seed. Intercept discovery, record/fail unexpected API calls and block external fixture dependencies; use 375×667 and 1280×800. Capture header/main/footer for pending, choices, selected long metadata, null address, empty, invalid slug, 429, 5xx and network failure/retry. Assert document width, readable identity, named controls, keyboard dropdown/selection/retry, focus visibility and absence of product/contact controls; attach screenshots and request assertions. Do not claim existing table-target conformance inventory covers catalog or alter harness registration/tooling for that claim.

Planned commands (authorization required): `pnpm test:unit --run src/features/catalog src/app/router/catalog-entry.test.ts`; `pnpm type-check`; `pnpm build`; `pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/catalog-branch-entry.spec.ts`. Apply strict RED/GREEN/TRIANGULATE/REFACTOR later. No tests, browser runs, build or lint were run by this design phase.

## Review budget and stop recommendation (rejected subdivision status)

Fresh readonly accounting is **387 authored planning lines**: `exploration.md` is +51 tracked lines, while `delivery-map.md` (44), `design.md` (98), `spec.md` (142), and `tasks.md` (52) are full untracked files. This counts every planning document once and has no source/test diff. The planning-only package is below 400 but has only 13 lines of margin; it is **NOT delivered or committed**. A future P0 runtime estimate starts only after explicit acceptance and delivery of this package, never by combining implementation with this in-progress candidate.

**Rejected boundaries remain historical.** The D1.A–D responsive-only/oversize subdivision and the inline replacement-shell candidate remain rejected. The accepted P0 direction instead adapts the existing five SFCs in place, keeps product-dependent controls visible-disabled, and carries its own unit plus browser evidence. It deliberately leaves router, `main.ts`, auth, transport, and final D1 behavior untouched; the future D1 architecture below is not P0 scope.

### Security/scope clarification (retained, deferred to next unit)

REQ-CBE-001 cannot be met by suppressing session cleanup wholesale — that would change unrelated auth/session semantics. The narrow distinction remains correct: the catalog route never **emits** a session-expired event, and the global `onSessionExpired` handler in `src/main.ts` continues to clear the session (legitimate cleanup of unrelated authenticated work) but suppresses the `router.replace('/login')` diversion only when the resolved current route name is `public-catalog`. The router `beforeEach` early-returns before auth hydration/profile/permission fetches when `to.name === 'public-catalog'`, but `/login`, `/forbidden` and `/not-found` keep their existing behavior. This is an eventual security requirement, not an accepted next unit; nothing is applied here.

### Docs-package forecast (retained, awaiting parent measurement)

The current planning candidate is **NOT delivered or committed**. Git presently counts `exploration.md` as +51 tracked lines and treats the other planning artifacts as full untracked files; all must be remeasured together before review. A future P0 runtime budget begins only after this planning package is explicitly accepted and delivered, so it cannot borrow undocumented headroom from this candidate or claim the combined working-tree diff is below 400.

## Rollout and rollback

No deployment is established by the backend guide or mocks. Eventual release requires normal approved frontend delivery plus target-environment confirmation of discovery/CORS and published branches; no backend/config changes or production probe is authorized here. Revert the new branch modules, shell wiring and coordinated startup changes together if needed, keeping `/catalogo` public and an honest unavailable landing rather than reactivating mock products/contact controls. No persistence migration, feature-flag system or product/settings rollout is required. This design and `tasks.md` record proposed work only; neither authorizes implementation.
