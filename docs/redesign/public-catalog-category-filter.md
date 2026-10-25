# Public catalog category filter

## Usage

Select a published branch and price list, then choose a category in the catalog toolbar. **Todas** or **Limpiar categoría** removes the category filter. Selection is URL-owned: reload, Back and Forward restore it. A rejected navigation leaves the current selection unchanged.

- `categoryId`: one exact UUID; absence means all categories. Unknown valid UUIDs are sent to the server and may return an empty list.
- `page`: positive safe decimal integer; absence means page 1. No pagination controls are introduced.
- Selecting/clearing a category removes `page`, preserving `priceListId`, other query parameters and the hash.
- Invalid category proposals suppress the listing; clearing removes category and page. Invalid pages suppress the listing; **Restablecer página** deletes only page.

## Data and failure boundaries

Two `useCatalogProducts` observers share the existing anonymous endpoint. The unfiltered first-page observer supplies stable category facets and the **Todas** count from `meta.total`, not the sum of facets (uncategorized products can make those differ). The route-filtered observer alone supplies cards, result total and authoritative detail price context. Initial identical keys deduplicate; category/page changes have isolated keys and cancellation signals. Default and explicit price-list identities remain distinct.

Both observers retain published-branch and price-discovery readiness gates. When baseline and filtered responses resolve different price-list IDs, baseline category options and **Todas** count are withheld. An explicit mismatch status retains clear and manual **Reintentar categorías** recovery; filtered cards/detail remain authoritative. No automatic retries are introduced. Failed baseline requests offer **Reintentar categorías** rather than invented zero counts; failed filtered requests never fall back to baseline cards. Clear stays reachable for selected empty, error and unknown-category states.

Category/page route changes close pending/open detail without restoring the previous card's focus; cancelled late responses cannot reopen it. Unrelated query/hash changes do not close detail. Normal close still restores focus.

## Verification evidence

Behavior tests cover API serialization/anonymous signals, key deduplication/cancellation/stale results, DOM category selection/clear/history/rejected navigation, baseline retry, total-versus-facet counts, invalid input/recovery, unknown UUID empty states, cross-context facets and detail cancellation/focus.

Initial RED: the DOM category-selection test could not find `Categoría Café`. Parent readback then exposed a resolved-default mismatch: an extended DOM test observed A's category while the filtered response resolved B (RED: 139 passed/1 failed). The mismatch gate made the focused suite green (140 tests), including manual baseline recovery and filtered detail identity.

Parent independently verified `pnpm exec vitest run src/features/catalog src/app/layouts/__tests__/CatalogLayout.spec.ts --exclude '**/.worktrees/**'` before this fix: 395 tests/17 files, exit 0. The same command passed after the mismatch fix and scoped formatting: 395 tests/17 files, exit 0; both application and responsive type checks also passed. Excluding historical `.worktrees/` copies keeps checkout validation isolated; those copies remain untouched. Initial type checks and production build passed (build reports generated-CSS `env(...)` and chunk-size warnings).

Parent rebuilt the corrected candidate successfully. Native review `review-ba533be85e7e8fcd` approved resilience/readability/reliability and its exact acknowledgement consumed authority before browser checks.

Parent used actual Playwright MCP on the existing preview/API, without interception or DB writes. At 320/390/768/1440, Acuario selection returned 2 cards, retained six category options, and clear restored PUBLICO total52; no horizontal overflow. The initial listing contains20 cards and category counts sum51, while **Todas** correctly shows52. Online (dev) navigation preserved its explicit priceListId, unrelated query and hash, removed page, and Back/Forward restored the prior page/category URLs. Detail Escape restored invoker focus; category history navigation closed an open detail. Keyboard Enter selected a category; measured filter buttons were44px high. Malformed category and page recovered via the displayed actions.

Screenshots inspected: `artifacts/catalog-category-filter/{mobile-320,mobile-390,tablet-768,desktop-1440}.png`. Compared390 with `.playwright-review/home-390.png`: existing brand/hero/card styling retained; wrapping category buttons intentionally replace neither v0's species strip nor its filter modal/sidebar. This bounded unit does not claim full v0 feature parity or human visual approval. Observed Tetra placeholder loaded; the AquaClear card showed the no-image fallback. External placeholder availability was not exhaustively audited and placeholders are not product photographs.

Limits/failures: the delegated verifier had no MCP tools and performed no checks; parent performed browser acceptance. One parent browser assertion timed out because it incorrectly expected16 dog-food products in Online (dev); direct observation showed17 and total53 in that context. The category navigation itself succeeded; subsequent separate history/detail checks passed. Initial unexcluded test commands failed on historical worktree copies; isolated checkout suite passed as above. Safari and authenticated backoffice were not checked. No servers were restarted.
