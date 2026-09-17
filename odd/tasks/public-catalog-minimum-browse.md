# Public catalog — minimum usable browse

## Outcome and authority

Make `/catalogo` minimally usable after tenant publication: an anonymous visitor explicitly selects a discovered published branch, the URL becomes `/catalogo/:branchSlug`, and the selected tenant's first real product page renders from the public backend contract.

This is an ODD implementation explicitly authorized by the user's **Catálogo mínimo usable** selection. It is not a continuation, reset, archive, or remediation of the historical OpenSpec changes. Preserve all existing OpenSpec artifacts and native review history unchanged.

No backend mutation, restart, worktree, branch, test, or live-data operation is authorized from this frontend session. The backend repository remains strictly read-only and backend needs must go through intercom. No commit, staging, push, PR, destructive Git operation, or unrelated cleanup is authorized.

## Product constraints

- Branch selection is always explicit; never auto-select the only branch.
- Selection is route-owned: a valid discovered slug at `/catalogo/:branchSlug` determines the selected branch.
- Clicking a branch pushes `/catalogo/:branchSlug`; direct URLs and browser back/forward remain synchronized.
- Preserve an unknown slug without redirect or fallback and do not request products for it.
- Fetch `GET ${API_BASE}/public/catalog/:tenantSlug/products` anonymously with no auth, credentials, body, or query for the initial backend-default page.
- Do not send the legacy mock `branchId` or speculative `priceListId`, search, category, sort, page, or limit parameters.
- Validate the documented response before rendering it. Malformed responses are server failures, never mock fallbacks.
- Render real first-page cards with safe nullable image, hidden/null price, category/brand, and nullable stock semantics. Never turn hidden/null price into `$0`, and never turn unknown stock into out-of-stock.
- Provide first-class selected loading, populated, empty, rate-limit, server, network, and manual-retry states. No automatic retry.
- Keep search, category, sort, detail, variants, cart, WhatsApp, and checkout disabled and out of scope.
- Preserve the existing catalog header/main/footer visual language and support desktop, 375 px, and 320 px without horizontal overflow.

## Allowed implementation surfaces

- `src/features/catalog/interfaces/public-catalog-products.types.ts` (new)
- `src/features/catalog/api/catalog-products.api.ts` (new)
- `src/features/catalog/api/__tests__/catalog-products.api.spec.ts` (new)
- `src/features/catalog/composables/useCatalogProducts.ts` (new)
- `src/features/catalog/composables/__tests__/useCatalogProducts.spec.ts` (new)
- `src/features/catalog/views/CatalogView.vue`
- `src/features/catalog/views/__tests__/CatalogView.spec.ts`
- `src/features/catalog/components/CatalogHeader.vue`
- `src/features/catalog/components/CatalogProductGrid.vue`
- `src/features/catalog/components/CatalogProductCard.vue`
- `src/features/catalog/components/__tests__/CatalogProductCard.spec.ts` (new)
- `e2e/responsive/specs/public-catalog-branch-discovery.spec.ts`
- `e2e/responsive/specs/catalog-entry-disabled.spec.ts`
- `e2e/responsive/specs/public-catalog-products.spec.ts` (new)
- this task document

Explicitly excluded: `src/features/catalog/api/catalog.api.ts`, `useCatalogStore.ts`, `mock-catalog.ts`, product modal, cart drawer/composable, shared router structure, authenticated HTTP client, every backend path, and all unrelated uncommitted catalog-settings/product-editor redesign files.

## Tasks

- [x] **C1 — Audit the current public route and contracts.** Confirmed that branch discovery is real but intentionally inert, product requests are absent, existing mock/store/detail/cart code is disconnected, and the backend list contract is available for an anonymous tenant-slug request.
- [x] **C2 — Add the anonymous product-list boundary.** Added validated product-list DTOs, an isolated anonymous fetch, tenant-specific TanStack Query state, abort forwarding, guarded manual retry, and stale-data protection for slug changes/clearing. Independent verification passed with 24/24 focused tests and explicit whitespace checks across all five new untracked files.
- [x] **C3 — Wire explicit branch selection and real first-page rendering.** Branch choices now push the slug route while preserving query/hash; selection is derived only from discovered branches plus the reactive route; direct URLs and history stay synchronized; invalid/no selection makes no product request; the grid and real cards cover all first-page states without enabling deferred commerce controls. Independent verification passed with 12/12 focused tests and explicit whitespace checks.
- [x] **C4 — Verify the complete minimum browse flow.** Final independent verification passed with 93/93 catalog unit tests, authoritative typecheck, production build, responsive typecheck, 17/17 strict-network Playwright cases across desktop/375 px/320 px, and whitespace checks. Native review `review-8dc37d735922a7ab` approved after one bounded selector correction and was acknowledged/burned. The user completed live smoke at `/catalogo/centro` and confirmed real products, prices, stock states, branch selection, and responsive layout render correctly. No commit or push was performed.

## Verification contract

Minimum automated checks:

```sh
pnpm test:unit --run src/features/catalog
pnpm type-check
pnpm build
git diff --check
```

Responsive evidence must prove:

- `/catalogo` requests branches only until explicit selection;
- clicking a returned branch navigates to `/catalogo/:slug` and requests exactly the anonymous product-list endpoint;
- a direct valid slug and browser back/forward stay synchronized;
- invalid slugs issue no product request;
- populated, empty, loading, 429, server, network, and retry states are usable;
- hidden/null price, image fallback, and nullable stock remain neutral;
- no detail, variant, cart, search, category, or authenticated request is introduced;
- no horizontal overflow at desktop, 375 px, or 320 px.

## Review workload guard

This feature spans transport, reactive state, routing interaction, cards, and responsive evidence. Keep it to the two runtime units above plus verification. Stop and ask before enabling search, filters, pagination controls, details, variants, cart, checkout, WhatsApp, shared router changes, authenticated-client changes, backend work, or any unrelated redesign surface.
