# Public catalog — selector and media polish

## Objective and authority

Refine the approved cobalt public catalog after human browser review: make branch selection discreet, replace unfinished no-image surfaces, contain the category toolbar, and render real variant thumbnails already present in the strict detail DTO.

This is a continuation of the authorized public-catalog redesign on `feat/public-catalog-visual-redesign`. Local work-unit commits remain authorized. No push, pull request, merge to `main`, backend source/runtime mutation, speculative per-card detail fetching, destructive Git operation, stash mutation, or unrelated cleanup is authorized.

## Human evidence

Browser screenshots reviewed:

- `Screenshot_2026-09-17-17-36-42_3440x2520.png`: listing improved materially, but the always-visible branch hero dominates the page and image-less cards feel unfinished.
- `Screenshot_2026-09-17-17-42-19_3440x2520.png`: populated detail composition is directionally approved.
- `Screenshot_2026-09-17-17-44-06_3440x2520.png`: empty product media is a mostly blank white square with a small package icon.
- `Screenshot_2026-09-17-17-45-07_3440x2520.png`: the full-width category wrapper border creates an unwanted horizontal line.

## Confirmed image boundary

Read-only requests to the running public API established the exact issue:

- `GET /public/catalog/centro/products` returns `image: null` for all four current list items, including `Ibuprofeno 400mg`.
- The strict list DTO, validator, and `CatalogProductCard` already accept and render `product.image.url` when the endpoint supplies it.
- `GET /public/catalog/centro/products/23594087-62f3-477b-a5d3-d619928490be?priceListId=dae52cee-79b8-44e8-b5b2-8d2502f8f7e3` returns a real product image in `images[]`.
- The same detail returns `variant.image: null` for `ROJO` and a real image URL for `GRANDE`.
- The strict detail DTO/parser already accepts variant images, but `CatalogProductDetailModal` drops the field from its derived variant view model.

Therefore:

- listing-card images require the list endpoint to populate its existing `image` field; the frontend must not issue one detail request per card as an N+1 workaround;
- variant thumbnails are a bounded frontend defect and will be fixed here;
- fallbacks must remain honest and visually intentional whenever real media is absent.

## Product decisions

- Branch selector is closed by default and opened only from the existing `Explorar sucursales` header control.
- The selector is an accessible modal with clear current-branch state, loading/error/retry states, and focus restoration to its trigger.
- The no-image state includes visible `Imagen no disponible` feedback plus a restrained icon treatment; it never invents a media URL.
- The category toolbar becomes a contained surface with no full-bleed divider.
- Variant rows remain non-interactive and read-only even when a thumbnail is present.

## Tasks

- [x] **P1 — Replace the branch hero with a discreet selector modal.** Moved branch discovery into a closed-by-default labelled UModal opened by the existing header trigger. Preserved route-owned selection, query/hash/history, anonymous requests, retry states, focus restoration, outside/Escape close, exact enabled-control inventory, and responsive containment. Evidence: commit `0d1bb6a`; 205/205 catalog tests, both typechecks, fresh 30/30 four-spec Chromium run, focused 7/7 geometry rerun, Prettier, and whitespace checks passed.
- [x] **P2 — Polish category and media presentation.** Replaced the full-width divider with a contained toolbar, added visible honest no-image states to listing/detail, and rendered real variant thumbnails with isolated null/error fallbacks while preserving read-only semantics. Image failures are keyed/reset so changed URLs and identities retry. Evidence: commit `bba110f`; 216/216 catalog tests, typecheck, Prettier, whitespace, and independent verification passed.
- [x] **P3 — Update responsive behavior contracts.** Added strict-network browser coverage for contained category geometry, real/null/broken card media, real/null variant thumbnails, product-detail fallback copy, read-only variant rows, and no horizontal overflow at 320/375/1280. Evidence: commit `de0184e`; responsive typecheck and an independent fresh 24/24 Chromium run passed.
- [x] **P4 — Verify and close.** The final matrix passed 216/216 catalog tests, both typechecks, production build (2,448 modules), 12-path Prettier, and both whitespace checks. The first strict-network Chromium run passed 30/34; artifact diagnosis proved four shell-not-mounted setup failures, including one explicit Chromium `ERR_NETWORK_CHANGED`. The exact four failed cases then passed 4/4 in one bounded rerun with no workspace mutation. The unresolved backend list-image projection remains documented.

## Candidate edit surfaces

Runtime:

- `src/features/catalog/components/CatalogHeader.vue`
- `src/features/catalog/components/CatalogCategoryBar.vue`
- `src/features/catalog/components/CatalogProductCard.vue`
- `src/features/catalog/components/CatalogProductDetailModal.vue`

Tests/evidence:

- `src/features/catalog/views/__tests__/CatalogView.spec.ts`
- `src/features/catalog/components/__tests__/CatalogProductCard.spec.ts`
- `src/features/catalog/components/__tests__/CatalogProductDetailModal.spec.ts`
- `e2e/responsive/specs/public-catalog-branch-discovery.spec.ts`
- `e2e/responsive/specs/public-catalog-products.spec.ts`
- `e2e/responsive/specs/public-catalog-product-detail.spec.ts`
- this task document

`CatalogView.vue`, APIs, DTOs, validators, and query composables should remain unchanged unless verification proves a direct requirement. Legacy mock/cart surfaces, backend paths, and the two preserved untracked OpenSpec/native artifacts are explicitly excluded.

## Acceptance criteria

- The catalog no longer reserves a large permanent branch hero above products.
- `Explorar sucursales` opens a labelled modal; its branch choices, loading, retry, empty, and failure states are accessible.
- Selecting a branch continues to change only route state, preserves query/hash, supports back/forward, and never claims a rejected navigation.
- Closing the branch modal restores focus to its trigger; Escape works; dialog and actions fit at 320 px.
- Category controls stay disabled/informational inside a contained rounded surface with no full-width divider.
- Card and product-detail fallbacks visibly say `Imagen no disponible`, keep the existing testids/aria labels, and do not invent media.
- A variant with `image.url` renders a meaningful thumbnail; null or failed variant media renders an honest compact fallback.
- Variant rows remain `<li>` elements with no button/input/select/link or selected state.
- Listing cards render a real image whenever the list endpoint provides `product.image`; current live image-less cards remain an upstream list-projection limitation, not a frontend N+1 workaround.
- Anonymous requests, strict validation, price/stock hidden-null semantics, product-detail focus restoration, retries, and no-commerce inventory remain intact.
- No horizontal overflow occurs at 320, 375, or 1280 px.

## Verification contract

```sh
pnpm test:unit --run src/features/catalog
pnpm type-check
pnpm build
pnpm type-check:responsive
pnpm exec playwright test --config playwright.responsive.config.ts e2e/responsive/specs/catalog-entry-disabled.spec.ts e2e/responsive/specs/public-catalog-branch-discovery.spec.ts e2e/responsive/specs/public-catalog-products.spec.ts e2e/responsive/specs/public-catalog-product-detail.spec.ts
pnpm exec prettier --check <changed paths>
git diff --check
git diff fbc3b4e..HEAD --check
```

## Evidence

Baseline is `fbc3b4e` on `feat/public-catalog-visual-redesign`; only the two preserved OpenSpec/native artifacts are untracked outside this task document.

P1 replaced the permanent branch hero with a discreet modal and updated the unit/browser contracts. The first writer browser run exposed Playwright option-shape and stale-shell assertions rather than runtime defects; bounded correction normalized `declaredRoutes: { routes }` and updated the closed-shell guardrail. Independent verification then passed a fresh 30/30 four-spec run but found the `size="sm"` trigger lacked a guaranteed 44px target. Final correction added `min-h-11` and mutation-sensitive settled-animation geometry checks for trigger, close, branch choices, and retry. Independent re-verification passed with 205/205 catalog tests, both typechecks, 7/7 branch-selector browser cases, formatting, and whitespace clean. Work-unit commit: `0d1bb6a feat(catalog): move branch selection into modal`.

Native ordinary START for P1 was rejected before lineage creation with `identity-mismatch`; no native review mutation occurred. Independent high-risk verification is the review evidence.

P2 introduced one contained category toolbar, visible honest product/card fallback copy, real variant thumbnails, isolated per-variant failed-media fallbacks, and identity resets. Initial independent verification passed the presentation and variant boundaries but found product-card and main-detail image failures latched across same-identity URL changes. Bounded correction keyed failures to exact URLs and reset them across identities; mutation-sensitive tests protect same-identity URL retry and different-identity reuse. Final independent re-verification passed with 216/216 catalog tests, typecheck, formatting, and whitespace clean. Work-unit commit: `bba110f feat(catalog): polish media and category surfaces`.

Native ordinary START for P2 was rejected before lineage creation with `identity-mismatch`; no native review mutation occurred. Independent high-risk verification is the review evidence.

P3 strengthened browser contracts without runtime changes. Product cards now have browser evidence for real data-URI media, null media, and decode failure; the category toolbar is structurally contained with no rendered full-width divider at 320/375/1280. Detail evidence covers one real and one null variant image across all three viewports, noninteractive rows, honest product-level fallback copy, and overflow containment while preserving exact strict-network ledgers. Independent verification passed the first and only authorized run: 24/24 Chromium cases, responsive typecheck, formatting, and whitespace clean. Work-unit commit: `de0184e test(catalog): cover responsive media states`.

Native ordinary START for P3 was rejected before lineage creation with `identity-mismatch`; no native review mutation occurred. Independent high-risk verification is the review evidence.

P4 ran every contracted check. Catalog tests passed 216/216 across 10 files; application and responsive typechecks passed; the production build transformed 2,448 modules; all 12 changed paths passed Prettier; `git diff --check` and `git diff fbc3b4e..HEAD --check` passed. The first full four-spec Chromium run passed 30/34. Artifact-only incident diagnosis showed all four failures occurred before the catalog shell mounted: the unconditional selector trigger was absent in three cases, while the instrumented fourth recorded HTTP 200, an empty `#app`, and Chromium `net::ERR_NETWORK_CHANGED`. The exact preserved last-failed set then passed 4/4 in one bounded 18.5s rerun with no source, task, OpenSpec, stash, staging, or worktree mutation. This is accepted as transient browser/Vite network evidence rather than a product defect; no failed or skipped checks remain.
