# Public catalog pagination

## Browse pages

Below a successful listing, use **Anterior** / **Siguiente**. The status
**Página N de M** comes from that listing's server metadata, not visible card
count or category facets. Controls have native disabled boundaries and 44px
minimum targets. Loading, errors and invalid routes expose no pager.

The URL owns the committed page and browser history. Returning to page 1 removes
`page`; navigation preserves category, price list, unrelated query values and
hash. A rejected navigation leaves the current page unchanged. `q` is currently
only an unrelated preserved query: this slice does not implement search.

## Recover a page outside the available range

A successful response with `page > max(1, totalPages)` displays **Página fuera de
rango**, without claiming that the catalog has no products. Nothing redirects or
rewrites history automatically. **Ir a la última página disponible** requests the
last server-reported page, or removes `page` when there are zero pages.

A zero-result first page keeps the ordinary empty state and has no pager; it never
shows “Página 1 de 0”. Malformed pages retain the existing **Restablecer página**
action. Category recovery remains separate.

## Scope and verification

The existing products API, query identities, cancellation, unfiltered baseline
facets, price readiness and detail-close watcher are unchanged. DOM tests cover
metadata boundaries with small fixtures, URL preservation, history, rejected and
aborted navigation, loading/error/retry, empty success and manual range recovery.

Verification: focused69 tests and catalog/layout402 tests across17 files passed,
excluding historical `.worktrees/` copies. Application/responsive types, build,
formatting and diff-check passed. Build retains existing CSS/chunk-size warnings;
LSP clean confirmation was inconclusive, so vue-tsc is the type evidence.

Native review `review-6a8cec80c35fd865` approved three lenses and was acknowledged.
Parent then used real Playwright MCP on preview4173/API3000: PUBLICO pages returned
20/20/12 cards, with disabled first/last boundaries. At320/390/768/1440, controls
measured44px with no horizontal overflow; parent inspected
`artifacts/catalog-pagination/pager-{320,390,768,1440}.png`. Keyboard navigation
returned to1 without `page`; Back restored2. Explicit Online price, query and hash
survived page99 recovery to3 (13 cards). An unknown valid category recovered from
page3 to the truthful zero-result first page without a pager. No mocking, DB
writes or server restarts. Search and Safari/backoffice acceptance are outside
this slice; screenshot checks do not claim human approval of the whole catalog.
