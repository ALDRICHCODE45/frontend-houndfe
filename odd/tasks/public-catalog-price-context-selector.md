# Public catalog price-context selector

## Outcome and authority

Let anonymous catalog visitors choose one tenant-published price context, such as PUBLICO or Mayoreo, and keep that exact context consistent across the catalog URL, product list, and product detail. The backend remains authoritative: the URL proposes one `priceListId`; the server resolves or rejects it without silent fallback, private-list disclosure, mixed contexts, or invented prices.

The user explicitly authorized implementation after the existing behavior was explained. This is ODD, not SDD. Backend work must stay in a separate backend worktree/branch from image-fallback commit `0edff48e`. No merge, push, deployment, destructive Git operation, or cross-repository direct edit is authorized. Frontend changes remain unstaged and uncommitted unless the user separately authorizes delivery.

## Product contract

- Exactly one price context is active per catalog visit/request.
- An absent `priceListId` means the backend catalog default; an explicitly unknown, private, disabled, or unrelated id is unavailable and must never fall back silently.
- Anonymous discovery uses `GET /public/catalog/:tenantSlug/price-contexts` with a direct JSON array response. It exposes only tenant-published contexts and only the minimal public fields: `priceListId`, `name`, and `isCatalogDefault`.
- Context discovery is tenant/branch scoped and ordered default-first, then by name and id. Current backend schema makes price-list names globally unique, but `priceListId` remains the stable identity. Discovery may return `[]`; it never invents a default in an inconsistent zero-default state. It does not expose product allowlists or private/global price-list inventory.
- Changing branch clears the prior branch's `priceListId`; changing context closes stale product detail and refetches the list under a disjoint query key.
- Product detail must use the exact context resolved by the current list response.
- Product-level supported-context rules and positive-price requirements remain backend-owned; selecting Mayoreo may legitimately produce a smaller or empty catalog.
- The current cart surface is disabled and not mounted. This task must not revive legacy/mock cart UI. Existing backend cart validation remains single-context; any future cart UI must bind the active context before it is enabled.
- Anonymous requests use `credentials: 'omit'`. No authenticated backoffice endpoint, hardcoded UUID, client-authored price, or N+1 request is allowed.

## Allowed frontend edit surfaces

- `src/features/catalog/api/catalog-price-contexts.api.ts` (new)
- `src/features/catalog/api/catalog-products.api.ts`
- `src/features/catalog/api/__tests__/catalog-price-contexts.api.spec.ts` (new)
- `src/features/catalog/api/__tests__/catalog-products.api.spec.ts`
- `src/features/catalog/composables/useCatalogPriceContexts.ts` (new)
- `src/features/catalog/composables/useCatalogProducts.ts`
- `src/features/catalog/composables/__tests__/useCatalogPriceContexts.spec.ts` (new)
- `src/features/catalog/composables/__tests__/useCatalogProducts.spec.ts`
- `src/features/catalog/components/CatalogPriceContextSelector.vue` (new, if separation keeps the header focused)
- `src/features/catalog/components/CatalogHeader.vue`
- directly related selector/header component specs
- `src/features/catalog/interfaces/public-catalog-price-context.types.ts` (new)
- `src/features/catalog/interfaces/public-catalog-products.types.ts`
- `src/features/catalog/interfaces/public-catalog-product-detail.types.ts` only if the shared context type is deduplicated safely
- `src/features/catalog/views/CatalogView.vue`
- `src/features/catalog/views/__tests__/CatalogView.spec.ts`
- `src/features/catalog/components/CatalogProductGrid.vue` and its direct spec only if an explicit context-unavailable state cannot remain localized to the selector/view
- `e2e/responsive/specs/public-catalog-products.spec.ts`
- `e2e/responsive/specs/public-catalog-product-detail.spec.ts`
- this task document

## Tasks

- [x] **PC1 — Lock and implement the anonymous backend discovery contract.** Completed as an uncommitted isolated backend diff in `/home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend-public-price-contexts`, branch `feat/public-catalog-price-contexts`, base `8439db23e34beeff49080fa359d6840a4964e093`: 10 modified + 5 untracked scoped files, no stage/commit/merge/push/deploy. Exact contract: direct-array `GET /public/catalog/:tenantSlug/price-contexts`, exact three-field rows, default/name/id ordering, 60-second public cache, `public-browse` 60/min, 200 empty array, and generic 404 for unavailable tenants or valid-but-unavailable contexts. Writer and independent read-only verifier passed 21 suites / 323 public unit tests, 25/25 real PostgreSQL integration tests, build, scoped ESLint/Prettier, and diff checks. Native review was unavailable because its consent binding expired before invocation (`lineage_created:false`, no mutation or receipt).
- [x] **PC2 — Implement strict frontend discovery and context-keyed list transport.** Added exact-shape anonymous discovery, unique/nonblank context validation, unavailable classification, tenant/context-disjoint TanStack keys, exact optional `priceListId` serialization, response-context mismatch rejection, and current-identity-safe data adoption. Focused PC2 evidence passed 4 files / 110 tests, type-check, and diff check after independent findings were corrected.
- [x] **PC3 — Add the responsive selector and URL authority.** Added a controlled responsive `USelectMenu`, exact URL proposal parsing, absent-query default semantics, invalid/private-equivalent no-fallback states, branch query clearing, unrelated query/hash preservation, response-authoritative detail identity, Spanish actionable states, stale-detail closure, and 320px-safe header composition. Cumulative PC2+PC3 focused evidence passed 7 files / 188 tests, type-check, and diff check after all four independent selector findings were corrected.
- [x] **PC4 — Verify interaction and responsive behavior.** Final serialized independent evidence is clean: 7 focused unit files / 190 tests; Vue type-check; production build with only the existing >500 kB chunk warning; responsive type-check; 37/37 strict Playwright cases in one run with zero retries; all 22 candidate paths pass Prettier; and `git diff --check` passes. The browser matrix includes six dedicated selector cases at 320×568, 375×667, and 1280×800 in light/dark mode, exact branches → contexts → default list → Mayoreo list traffic, 44px targets, overflow containment, URL query/hash preservation, and prior-context data removal. Before/after Git status was identical, including protected and unrelated paths.
- [x] **PC5 — Close evidence and integration guidance.** Frontend native inspect was attempted once after normalization and was unavailable because the verified package-local binary is missing (`package-local-binary-missing`); it created no lineage and performed no mutation. No install/recovery command was run. Backend native review was separately unavailable after consent expired before invocation; it also created no lineage or receipt. Both sides still have independent verifier evidence but no native approval. Frontend remains unstaged/uncommitted on `feat/public-catalog-visual-redesign` (HEAD `bb29560`); backend remains unstaged/uncommitted in `/home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend-public-price-contexts`. The serving backend must integrate and deploy the backend discovery diff before this frontend selector can operate; integrating, committing, pushing, merging, and deploying remain explicit user decisions.

## Verification contract

Minimum frontend checks:

```sh
pnpm test:unit --run \
  src/features/catalog/api/__tests__/catalog-price-contexts.api.spec.ts \
  src/features/catalog/api/__tests__/catalog-products.api.spec.ts \
  src/features/catalog/composables/__tests__/useCatalogPriceContexts.spec.ts \
  src/features/catalog/composables/__tests__/useCatalogProducts.spec.ts \
  src/features/catalog/views/__tests__/CatalogView.spec.ts
pnpm type-check
pnpm build
git diff --check
```

Responsive evidence must include desktop, 375px, and 320px, in light and dark mode where the existing public-catalog Playwright harness supports it. Backend verification and native review remain owned by the isolated backend session.

## Delivery authorization

The user explicitly authorized local commits and integration into `main` for only this price-context capability. Push, PR, and deployment remain unauthorized. The frontend feature branch is 11 pre-existing visual-redesign commits ahead of `main`, so merging or fast-forwarding that branch would violate the requested scope. Delivery therefore uses two reviewable forms: a focused source-branch commit containing only the 22 selector/API/test/evidence paths, followed by a semantic port into an isolated temporary `main` worktree that preserves main's existing catalog UI and excludes all visual-redesign commits. Only that temporary frontend worktree may be removed afterward; every pre-existing worktree must remain untouched.

Backend integration was delegated as requested and completed locally on backend `main` at `a69d852b12fb83dc445311ef3f2f47eeb003c3e9`, with scoped commits `07a3400598937bf7f0faa648b6b8f59e097fbe98` and `a69d852b12fb83dc445311ef3f2f47eeb003c3e9`. Its dedicated price-context worktree alone was removed; the image-fix worktree and every other worktree remain intact. No backend push or deployment occurred.

## Review workload guard

Do not expand into checkout, cart activation, search, pagination, authenticated settings, product editing, image fallback integration, or simultaneous multi-price rendering. Stop before any backend integration, frontend commit, push, PR, or deployment unless the user explicitly authorizes that separate action.
