# Public catalog price-context selector — semantic main port

## Outcome and authority

Let anonymous catalog visitors choose one tenant-published price context, such as PUBLICO or Mayoreo, and keep that exact context consistent across the catalog URL, product list, and product detail. The backend remains authoritative: the URL proposes one `priceListId`; the server resolves or rejects it without silent fallback, private-list disclosure, mixed contexts, or invented prices.

This task is the **semantic port onto `main`**. The capability was implemented and verified on the visual-redesign branch in commit `f7b418d` (`feat(catalog): add public price contexts`). `main` (`f44bbda`) intentionally lacks 11 visual-redesign commits (`be46443..bb29560`), so the redesign UI must not travel with the capability. The port keeps `main`'s existing catalog design exactly — inline/open branch chooser and the `selectedSlug` contract, `min-h-screen`, the current category bar, product card, detail modal and media behavior — and hand-ports only the price-context semantics.

The user explicitly authorized local `main` integration only. Commit `726f2d0` (`feat(catalog): add public price contexts`) records the verified semantic port. Push, deploy, OpenSpec edits, other worktree deletion, and importing visual-redesign behavior remain unauthorized. Backend `main` already carries the discovery contract at `a69d852b12fb83dc445311ef3f2f47eeb003c3e9`.

## Product contract

- Exactly one price context is active per catalog visit/request.
- An absent `priceListId` means the backend catalog default; an explicitly unknown, private, disabled, or unrelated id is unavailable and must never fall back silently.
- Anonymous discovery uses `GET /public/catalog/:tenantSlug/price-contexts` with a direct JSON array response of exact three-key rows (`priceListId`, `name`, `isCatalogDefault`).
- `priceListId` is the stable identity; discovery accepts `[]`, forbids duplicate ids, duplicate names and more than one default, and never invents a default.
- Discovery is branch-scoped and only runs once a published branch is selected. An absent or invalid branch requests only branches.
- Products transport is identity-exact: only `null`/`undefined` are the caller default; every supplied string (including malformed blanks) is explicit and its response must echo the exact requested context.
- The list response `priceContext` is authoritative for detail identity and selector display.
- Changing branch removes only the prior `priceListId` and preserves unrelated query/hash; changing context closes stale detail and refetches under a disjoint query key.
- Product detail must use the exact context resolved by the current list response.
- The cart surface stays disabled and unmounted; no fallback, commerce, or cart activation is introduced.

## Source and scope

- Source implementation: commit `f7b418d` in `/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe` (read-only).
- Target: `main` at `f44bbda` in this isolated worktree.
- Excluded redesign range: `be46443..bb29560`. Do not port `UModal` branch selection, `min-h-dvh`, redesigned category-bar props, image preview, or any other behavior from that range. `CatalogHeader.vue`, `CatalogView.vue`, `CatalogProductGrid.vue` and the existing e2e specs are hand-adapted, never copied wholesale.

## Allowed edit surfaces

- `src/features/catalog/interfaces/public-catalog-price-context.types.ts` (new)
- `src/features/catalog/interfaces/public-catalog-products.types.ts`
- `src/features/catalog/api/catalog-price-contexts.api.ts` (new)
- `src/features/catalog/api/catalog-products.api.ts`
- `src/features/catalog/api/__tests__/catalog-price-contexts.api.spec.ts` (new)
- `src/features/catalog/api/__tests__/catalog-products.api.spec.ts`
- `src/features/catalog/composables/useCatalogPriceContexts.ts` (new)
- `src/features/catalog/composables/useCatalogProducts.ts`
- `src/features/catalog/composables/__tests__/useCatalogPriceContexts.spec.ts` (new)
- `src/features/catalog/composables/__tests__/useCatalogProducts.spec.ts`
- `src/features/catalog/components/CatalogPriceContextSelector.vue` (new)
- `src/features/catalog/components/CatalogHeader.vue`
- `src/features/catalog/components/CatalogProductGrid.vue`
- `src/features/catalog/components/__tests__/CatalogPriceContextSelector.spec.ts` (new)
- `src/features/catalog/components/__tests__/CatalogProductGrid.spec.ts`
- `src/features/catalog/views/CatalogView.vue`
- `src/features/catalog/views/__tests__/CatalogView.spec.ts`
- `e2e/responsive/specs/public-catalog-products.spec.ts`
- `e2e/responsive/specs/public-catalog-product-detail.spec.ts`
- `e2e/responsive/specs/public-catalog-branch-discovery.spec.ts`
- `e2e/responsive/specs/public-catalog-price-contexts.spec.ts` (new)
- this task document

## Tasks

- [x] **PC1 — Port the anonymous discovery contract.** Added the new `public-catalog-price-context.types.ts` module, the exact-shape direct-array parser with unique/nonblank rows and max one default, `credentials: 'omit'`, and `unavailable`/`rate-limit`/`server`/`network` classification. Discovery-only requests issue no product traffic.
- [x] **PC2 — Port strict context-keyed list transport.** Added the optional explicit `priceListId` parameter with exactly one encoded query, `unavailable` 404 classification, response-context identity enforcement (an explicit id can never adopt a default response), and tenant/context-disjoint TanStack query keys that keep malformed explicit strings distinct from the caller default.
- [x] **PC3 — Port the responsive selector and URL authority.** Added the controlled, accessible, Spanish `USelectMenu` selector and wired it into `main`'s existing header without touching branch selection. Absent query means the discovered default; blank/array/unknown/padded proposals request nothing and select nothing; selecting preserves unrelated query/hash; branch changes delete only `priceListId`; the list response context owns detail identity and selector display; context/branch changes close stale detail.
- [x] **PC4 — Port the distinct catalog states.** Added discovery loading, empty, unavailable, no-default, invalid and discovery-error states that never read as a product failure, plus the products-state `unavailable` presentation, kept separate from populated/empty/rate-limit/server/network, with the cart/search/category/sort surfaces still disabled.
- [x] **PC5 — Adapt tests and record the port.** Adapted the seven focused unit specs and the four public-catalog Playwright specs to `main`'s inline branch chooser, added the dedicated price-contexts browser matrix (direct URL, so no branch dialog dependency), and recorded this tracker. The scoped port is commit `726f2d0`; no push, deploy, or OpenSpec edit occurred.

## Verification contract

Focused unit/type/diff evidence for this port:

```sh
pnpm test:unit --run \
  src/features/catalog/api/__tests__/catalog-price-contexts.api.spec.ts \
  src/features/catalog/api/__tests__/catalog-products.api.spec.ts \
  src/features/catalog/composables/__tests__/useCatalogPriceContexts.spec.ts \
  src/features/catalog/composables/__tests__/useCatalogProducts.spec.ts \
  src/features/catalog/components/__tests__/CatalogPriceContextSelector.spec.ts \
  src/features/catalog/components/__tests__/CatalogProductGrid.spec.ts \
  src/features/catalog/views/__tests__/CatalogView.spec.ts
pnpm type-check
pnpm type-check:responsive
pnpm exec prettier --check <the 22 allowed paths>
git diff --check
```

Final evidence: 181/181 focused unit tests, both type-checks, production build, all 29 public-catalog Playwright cases in one serialized no-retry run, Prettier, and `git diff --check` passed. The popup-layering correction was test-driven and preserves the inline branch chooser. Strict TDD captured pre-implementation RED and post-implementation GREEN evidence.

## Review workload guard

Do not expand into checkout, cart activation, search, pagination, authenticated settings, product editing, image-fallback integration, or simultaneous multi-price rendering. Stop before any commit, push, PR, merge, deployment, or OpenSpec change unless the user explicitly authorizes that separate action.
