# Public catalog search

Choose a published branch and available price context, then use **Buscar productos o marcas** above the category controls. Type a query and press **Buscar** (or Enter); typing alone sends no request. **Limpiar búsqueda** removes the committed search. Both actions return to page 1, preserving category, price context, unrelated URL parameters and the hash.

Search is server-backed: `q` matches product name, brand and eligible variant name/option/value. It does **not** search category, description, SKU or species. Category and search combine before server pagination; the client does not filter or sort returned cards.

## URL and recovery

- `/catalogo/centro?q=croqueta&categoryId=<uuid>&page=2` restores the combined listing. Back/Forward restores the input from the committed URL, not an abandoned draft.
- Absent `q` and scalar `q=` mean no search and share the baseline request identity. All other scalar strings, including whitespace, are preserved exactly; there is no invented trimming or length limit.
- Null `?q` and repeated `?q=a&q=b` suppress the listing with **Búsqueda no válida.** Use **Limpiar búsqueda** to remove only `q` and `page`.
- Rejected or aborted submission/clear navigation restores the committed draft and never fetches a proposed search. Category changes reset page but preserve search; pager actions preserve search and category.

## Data and interaction guarantees

The context-scoped baseline always requests the unfiltered first page (no `q`, category or page), independently of searched cards and result totals. Category counts stay baseline-owned; mismatched resolved price contexts still withhold those facets. Only the successful current listing metadata authorizes pagination, including existing manual out-of-range recovery.

Changing search identity closes detail without restoring focus to an old card; late requests cannot reopen it. Normal detail close still restores focus. Readiness gates, anonymous credentials omission, cancellation, stale-response suppression and explicit manual retries are unchanged. The labelled native search input and buttons have 44px minimum height and wrap on narrow screens. No header/cart/sort changes are included.

## Verification

- RED: 8 failures/147 passes before implementation (one composable hook timeout). GREEN: 156 focused tests and 528 catalog/layout tests, excluding historical `.worktrees/` copies. Both type checks, build, scoped formatting and diff-check passed. Existing CSS `env(...)`/chunk warnings remain. LSP confirmed one file clean; three were inconclusive, with vue-tsc providing type evidence.
- Native review `review-856e2e0652935500` approved resilience, readability and reliability; exact acknowledgement consumed authority.
- Real parent Playwright MCP against existing preview4173/API3000 observed no product request while typing, then `croqueta` returned18 with stable baseline52. Combining dog-food category returned11; clearing retained category and returned16; Back restored query/draft and11. Online `correa` returned4 after page99 recovery, preserving price/context/query/hash. Repeated `q` recovered to52 without `q`/`page`; Enter-submitted `gato` returned18.
- Screenshots `artifacts/catalog-search/search-{320,390,768,1440}.png` were individually inspected: no horizontal overflow, search controls44–46px, usable wrapping and visible input focus. Synthetic product placeholders are DEV data, not final imagery.
- An initial browser category selector timed out because its accessible name differs from visible count text. DOM inspection supplied the correct `Categoría Alimento para perro` name; the interaction then passed. Navigation rejection, cancellation and detail invalidation were covered by automated tests, not live fault injection. No mocks, DB writes or server restarts; Safari and backoffice were not tested in this slice.
