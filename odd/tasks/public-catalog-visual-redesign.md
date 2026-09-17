# Public catalog visual redesign

## Objective and authority

Redesign the anonymous public catalog so its listing and product-detail surfaces closely match the user-supplied cobalt retail references while preserving the active read-only product contract.

The user selected **visual fidelity only** and authorized a local feature branch plus local work-unit commits. No push, pull request, backend mutation, commerce activation, API relaxation, destructive Git operation, stash mutation, or unrelated cleanup is authorized.

## Visual direction

The screenshots are the primary visual authority:

- a centered, compact retail shell rather than a full-width empty canvas;
- cobalt/royal-blue identity instead of the current orange accent;
- a prominent branch-selection hero with address context and clear selected state;
- category chips and result count directly above a denser four-column product grid;
- image-led cards with availability pills, stronger product hierarchy, and restrained borders/shadows;
- a wide split product-detail dialog with a tinted image gallery, concise metadata, variant cards, and a quiet footer;
- simple Swiss-style hierarchy, subtle motion only, no decorative gradients, no invented copy or data.

Design dials: variance 5/10, motion 3/10, density 5/10. Use Nuxt UI and Lucide icons already available in the project. Preserve dark-mode usability even though the supplied reference is light.

## Product boundary

This remains an anonymous, read-only storefront.

Preserve:

- `credentials: 'omit'` and strict DTO validation;
- route-owned branch selection, query/hash preservation, and browser history;
- product-detail identity through the list `priceContext.priceListId`;
- loading, empty, error, retry, stale-data, and rapid branch/product transition safeguards;
- modal focus trap, Escape dismissal, exact invoker focus restoration, and viewport containment;
- hidden/null price and stock semantics;
- real image rendering with safe fallbacks;
- the existing accessible labels used by unit and responsive contracts.

Do not enable or invent:

- ratings or featured labels;
- search, category filtering, sorting, or pagination behavior;
- selectable variants, quantities, add-to-cart, checkout, WhatsApp, authentication, or phone actions;
- mock catalog/store/cart data as a fallback.

Disabled shell controls may remain visible where the reference includes them. Category facets and branch addresses may be rendered from already available real response data, but they remain informational in this slice.

## Work units

- [x] **V1 — Lock the visual contract and data flow.** Added mutation-sensitive component/view coverage for real branch addresses and fallback, selected branch state, real facets/result totals, unknown-versus-real-zero totals, disabled-control inventory, polite announcements, contrast, product hierarchy, unsupported rating omission, and narrow-card value wrapping. Existing list response data flows through typed props only. Evidence: commit `be46443`.
- [x] **V2 — Rebuild the catalog shell and listing.** Rebuilt `CatalogLayout`, header, branch hero, category bar, product grid/cards, and footer as a compact cobalt retail surface with 4/2/1 responsive grid composition, real images/fallbacks, informational facets, and no new enabled behavior. Independent verifier passed after four bounded accessibility/data/overflow corrections. Evidence: commit `be46443`; 191/191 catalog tests, typecheck, Prettier, and whitespace checks passed.
- [x] **V3 — Rebuild the read-only product detail.** Rebuilt the active strict-DTO modal as a responsive split retail composition with a cobalt media panel, semantic hidden header, one explicit 44px close control, real metadata/price/stock, non-interactive variant cards, split loading state, guarded retries, mobile close gutter, and overflow-safe authoritative values. Independent verification passed after four low-risk polish corrections. Evidence: commit `b522fff`; 25/25 modal tests, 203/203 catalog tests, typecheck, Prettier, and whitespace checks passed.
- [x] **V4 — Verify and close the redesign.** Final independent verification passed 203/203 catalog unit tests, application typecheck, production build, responsive typecheck, all 26 strict-network Chromium catalog cases, Prettier across all 13 feature paths, and both whitespace checks. Browser assertions passed at 320×568, 375×667, and 1280×800 with no horizontal overflow. A separate light-mode screenshot smoke remains optional human evidence; the temporary mocked capture stopped before rendering its grid and changed no repository state.

## Candidate edit surfaces

Runtime:

- `src/app/layouts/CatalogLayout.vue`
- `src/features/catalog/views/CatalogView.vue`
- `src/features/catalog/components/CatalogHeader.vue`
- `src/features/catalog/components/CatalogCategoryBar.vue`
- `src/features/catalog/components/CatalogProductCard.vue`
- `src/features/catalog/components/CatalogProductGrid.vue`
- `src/features/catalog/components/CatalogProductDetailModal.vue`
- `src/features/catalog/components/CatalogFooter.vue`

Focused tests/evidence:

- `src/features/catalog/views/__tests__/CatalogView.spec.ts`
- `src/features/catalog/components/__tests__/CatalogProductCard.spec.ts`
- `src/features/catalog/components/__tests__/CatalogProductGrid.spec.ts`
- `src/features/catalog/components/__tests__/CatalogProductDetailModal.spec.ts`
- `e2e/responsive/specs/catalog-entry-disabled.spec.ts`
- `e2e/responsive/specs/public-catalog-branch-discovery.spec.ts`
- `e2e/responsive/specs/public-catalog-products.spec.ts`
- `e2e/responsive/specs/public-catalog-product-detail.spec.ts`
- this task document

Explicitly excluded: strict API/parser files, query composables, DTO interfaces, legacy mock store/cart/modal files, backend paths, the two preserved untracked OpenSpec artifacts, and unrelated application features.

## Verification contract

```sh
pnpm test:unit --run src/features/catalog
pnpm type-check
pnpm build
pnpm type-check:responsive
pnpm exec playwright test --config playwright.responsive.config.ts e2e/responsive/specs/catalog-entry-disabled.spec.ts e2e/responsive/specs/public-catalog-branch-discovery.spec.ts e2e/responsive/specs/public-catalog-products.spec.ts e2e/responsive/specs/public-catalog-product-detail.spec.ts
pnpm exec prettier --check <changed paths>
git diff --check
```

## Evidence

The repository began on local `main` at `f44bbda` with only the two preserved untracked OpenSpec/native artifacts. Work proceeds on `feat/public-catalog-visual-redesign`; no push or PR is authorized.

V1/V2 writer delivery initially passed 186/186 catalog tests, typecheck, Prettier, and whitespace checks. Native assessment was unavailable, so the required independent high-risk verifier reviewed the full listing diff and found four blockers: an invented zero total before response, low-contrast small hero copy, missing branch live announcements, and a potential narrow-card price/quantity overflow. Bounded corrections made totals nullable until real response data exists, restored `aria-live="polite"`, raised direct and composited text contrast (including the unselected address to `text-white/95`), and made authoritative values wrap without truncation. Final independent re-verification passed with 191/191 tests, zero type errors, clean formatting/whitespace, and calculated 5.12:1 unselected-address contrast. Work-unit commit: `be46443 feat(catalog): redesign public product listing`.

Native ordinary review inspection could not bind the requested `f44bbda..be46443` committed candidate: the explicit START was rejected before lineage creation with `candidate-target-projection-drift`. No review lineage or native mutation was created. The independent verifier therefore remains the review evidence for this work unit.

V3 writer delivery passed 21/21 modal tests and 199/199 catalog tests. Native assessment was again unavailable, so an independent high-risk verifier reviewed the complete two-file modal change and passed it with four low findings: potential mobile brand/close collision, missing explicit numeric wrap protection, a sub-44px retry target, and no independent dismissal-event test. Bounded polish reserved the mobile close gutter for long brands, made variant prices/quantities wrap without truncation, raised retry to `min-h-11`, and separately exercised `update:open(false)`. Final independent re-verification passed with 25/25 modal tests, 203/203 catalog tests, zero type errors, clean formatting/whitespace, and no remaining static findings. Work-unit commit: `b522fff feat(catalog): redesign public product detail`.

Native ordinary START for V3 was rejected before lineage creation with `identity-mismatch`; no native review mutation occurred. Independent high-risk verification is the review evidence for this work unit.

V4 final independent verification passed the complete catalog matrix: 10 files / 203 tests, application `vue-tsc`, production build (2,448 modules), responsive typecheck, and 26/26 strict-network Chromium cases in 56.5 seconds without retry. The browser matrix covered entry guardrails, branch discovery, product listing/history/recovery, and detail behavior across 320×568, 375×667, and 1280×800 with no horizontal overflow. All 13 feature/task paths pass Prettier; working-tree and `f44bbda..HEAD` whitespace checks pass. Baseline/final status, branch, HEAD, and both preserved artifact hashes remained identical. Build reported only the existing informational 888.23 kB bundle-size warning.

An optional disposable light-mode screenshot harness under `/tmp` was attempted after the authoritative matrix. Its preview lifecycle was cleaned up, but the mocked fixture did not reach `[data-testid="catalog-product-grid"]` within 30 seconds, so no screenshot evidence was admitted. Repository status remained byte-identical and port 4177 was closed. Human light-mode aesthetic sign-off therefore remains the only pending non-blocking check; Firefox/WebKit were not configured or run.
