# Design: Public catalog branch discovery

## Boundary and decisions
- Inputs: this change's exploration, proposal, and corrected spec (REQ-CAT-BD-001–006); baseline `aa2b204`.
- Implement discovery only in `src/features/catalog`; preserve header/category bar/main/footer, existing colors, typography, spacing, and theme toggle. No dependencies, global client changes, or product requests.
- Use existing Vue Composition API and `@tanstack/vue-query`; avoid Pinia, mock API/store paths, generic client infrastructure, and a second DTO.
- The chooser lists available branches but explicitly says selection is not yet available. No selected value, initial selection, links, router imports, slug watcher, push, replace, or redirect; even one matching branch stays unselected.

## Exact candidate files and responsibilities
| File | Planned responsibility |
| --- | --- |
| `src/features/catalog/api/catalog-branches.api.ts` (new) | Export anonymous request, proportional DTO parser, and small typed discovery error. |
| `src/features/catalog/composables/useCatalogBranches.ts` (new) | Own the single query, derived state, and guarded manual retry. |
| `src/features/catalog/views/CatalogView.vue` | Call composable once; pass state/branches into header and forward retry; retain other shell children unchanged. |
| `src/features/catalog/components/CatalogHeader.vue` | Adapt existing branch affordance into an expandable discovery panel; render state, names, and retry via typed props/emits. |
| `src/features/catalog/api/__tests__/catalog-branches.api.spec.ts` (new) | Request isolation, DTO, and error classification fixtures. |
| `src/features/catalog/composables/__tests__/useCatalogBranches.spec.ts` (new) | Query lifecycle and manual retry coverage with isolated QueryClient. |
| `src/features/catalog/views/__tests__/CatalogView.spec.ts` | Extend real-shell regression tests for discovery, no selection/navigation, and forbidden requests. |
| `e2e/responsive/specs/public-catalog-branch-discovery.spec.ts` (new) | Narrow/wide discovery evidence through existing Playwright configuration. |
| `openspec/changes/online-catalog-publishing/delivery-map.md` (planning reconciliation) | Completed prose-only P0.1/combined-D1 reconciliation; native verification evidence remains untouched. |
- Reuse `src/features/catalog/interfaces/catalog.types.ts` unchanged. Keep `CatalogProductGrid.vue` neutral selection-unavailable message unchanged; discovery status lives only in header, avoiding duplicate announcements or another component.
- Read-only regression surfaces: `src/app/router/index.ts`, `src/main.ts`, `src/core/shared/api/http.ts`, and `src/core/shared/api/queryClient.ts`; never import authenticated HTTP from the new boundary.

## Request and parsing contract (001, 005)
- Resolve base from `import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'`, remove trailing slash, append `/public/catalog/branches`; support the responsive harness's relative `/__e2e-api` base.
- `fetchCatalogBranches(signal?: AbortSignal): Promise<PublicBranchDto[]>` uses native fetch with `method: 'GET'`, `credentials: 'omit'`, optional signal, and no Authorization/custom cache headers, body, or query; no auth-storage reads or refresh/session side effects.
- Accept only HTTP 200. Classify 429 as `rate-limit`; 5xx and other unexpected statuses (including 401/403) as `server`, without login redirects; fetch/body transport rejection, including AbortError, as `network`.
- Parse JSON as unknown: require an array of non-null objects with string `id`, `name`, `slug` and present `address`/`phone` each string or null. Missing nullable keys, wrong types, non-array, and invalid JSON become `server` (invalid response).
- Preserve response order and string values verbatim; ignore extra keys, retain explicit nulls, reject the entire malformed payload, and never coerce, normalize slugs, filter bad rows, or substitute mocks. Do not impose undocumented UUID/nonempty constraints.
- Keep typed error taxonomy to `rate-limit | server | network` (optional HTTP status for assertions); never expose backend bodies to visitors. No schema library or retry scheduler is needed.

## Data flow, cache, and retry (002–005)
- Route mount → CatalogView → useCatalogBranches → isolated GET → parse → query result → computed state → CatalogHeader props; header emits only `retry`, flowing back to composable.
- Local exported key: `['public-catalog', 'branches', API_BASE] as const`; slug/auth/tenant are not request dependencies and never enter the key. No product prefetch or dependent queries.
- One observer per mounted view; `staleTime: 0`, `gcTime: 0`, `refetchOnMount: 'always'` provide a new request on each fresh visit, not durable cached discovery. Concurrent same-key work is deduplicated by Query.
- Set `retry: false`, `retryOnMount: false`, `refetchOnWindowFocus: false`, `refetchOnReconnect: false`, `refetchInterval: false`, and `networkMode: 'always'`; offline attempts surface network errors instead of indefinite paused loading. No initial/placeholder data or persistence.
- Expose `{ branches, state, retry }` as refs/computed plus function; state union is `loading | retry-pending | populated | empty | rate-limit | server | network`. Derive branches from successful data, otherwise an empty list, without making errors look empty.
- One local `retryRequested` boolean distinguishes manual work; retry sets it before refetch and clears it in finally. Guard while fetching; rapid clicks cause no overlapping request or cancel/restart. Loading offers disabled retry; empty/errors offer enabled retry.
- Forward Query's AbortSignal to fetch. Query cancellation on unmount discards late results without updating destroyed UI; an actual request AbortError while observed maps to network. Do not add generation counters or advanced route-race machinery.

## Explicit presentation mapping
| State | Header panel content and action |
| --- | --- |
| loading | “Cargando sucursales…”; busy status, disabled retry. |
| retry-pending | “Reintentando…”; busy status, disabled retry; hide previous error/list. |
| populated | “Sucursales disponibles”; names in response order, including one result; selection-unavailable explanation. |
| empty | “No hay sucursales publicadas”; enabled “Reintentar”. |
| rate-limit (429) | “Demasiadas solicitudes. Intenta de nuevo más tarde.”; enabled “Reintentar”; no timer/automatic retry. |
| server (5xx/invalid response) | “No pudimos cargar las sucursales.”; enabled “Reintentar”. |
| network | “No se pudo conectar. Revisa tu conexión.”; enabled “Reintentar”. |
- Precedence: active manual request → initial fetching → error → successful zero/nonzero result; retained data must not mask a failed retry.
- Header accepts typed `branches` and `state` props and emits `retry: []`; only panel expansion is local UI state. Use a button with `aria-expanded`/`aria-controls`, initially expanded so discovery states are visible; render panel below the existing header row.
- Render branch choices as named disabled buttons in a semantic list, with no selected/pressed attributes or handlers, rather than misleading actionable links; expansion/retry remain keyboard operable. No address/phone landing or contact action.
- Use a polite live status and busy indication, visible focus for enabled controls, wrapping branch names, viewport-bounded panel width and scroll height. Preserve disabled search/cart/category/sort; no new motion or visual redesign.

## Verification seams and evidence
- API tests stub global fetch, assert exact URL/options including omitted credentials and absent headers/body, and table-test 0/1/many, nullable/missing/wrong fields, malformed JSON, 429/503/401, rejection, and abort; assert no refresh call.
- Composable tests use VueQueryPlugin with a fresh QueryClient and deferred promises: initial single GET, error/empty → manual pending → success, repeated-click guard, no timed/focus/reconnect retry, remount fresh request, and cancellation discarding late completion.
- View tests retain real SFCs and existing lightweight UI stubs, inject QueryClient, and observe fetch. Retain theme/neutral-main assertions, replace only obsolete disabled-branch expectation; cover each state and response order, and keep the legacy store trap.
- Mount at `/catalogo` and supplied matching/nonmatching slug with a memory router; assert unchanged fullPath and no push/replace after mount, expansion, branch interaction, or retry, including exactly one result. Assert the only application API URL is branches.
- Existing Playwright harness: run the new spec explicitly with `playwright.responsive.config.ts`; intercept `/__e2e-api/public/catalog/branches`, use anonymous storage, 375×812 and 1440×900, long-name fixtures, and all presentation states. Record screenshots and request log under existing `artifacts/responsive/<run-id>/`; verify shell order, no horizontal overflow, panel scrolling, focus, and disabled commerce controls. Evidence is planned, not yet captured.

## Rollout, budget, and deferred work
- Planning only here: no runtime/tests. The complete planning baseline is one review unit against `aa2b204`; WU-1 compares against that future accepted baseline, and WU-2 compares against the WU-1 parent. Every unit counts its own docs, tests, and evidence.
- Treat apply as budget-risk gated: recount each unit independently, pause for `ask-on-risk`, and split before overflow; never drop acceptance coverage or infer a size exception.
- After approval, use focused RED/GREEN tests, type-check, and responsive run before delivery; no deployment claim or new feature flag. Rollback reverts this discovery slice, restoring disabled branch affordance while retaining P0.1 anonymous bootstrap and shell.
- Defer explicit selection/router.push, canonical slug/history/query/hash handling, selected name/address landing, invalid-slug recovery, back/forward sync, disappearing branches, navigation races, and every product/commerce request to separately bounded changes.
