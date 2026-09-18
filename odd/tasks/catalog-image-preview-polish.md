# Catalog image preview and detail-density polish

## Goal

Make public catalog product media useful on touch-first devices: allow real product and variant images to open in a large read-only preview, give variant thumbnails more visual weight with a square modest-radius shape, and replace empty detail-panel whitespace with honest visual feedback.

## Scope and constraints

- Keep the public catalog read-only. Image preview buttons are media controls, not variant selection or commerce controls.
- Preserve anonymous requests, strict DTO validation, route/history behavior, hidden/null price-stock semantics, modal focus restoration, and exact strict-network ledgers.
- Reuse already-delivered image URLs. Do not fetch product details per listing card and do not invent media.
- The grid can only render `PublicCatalogProductDto.image`. Live Ibuprofeno listing data currently supplies `image: null` while detail supplies `images[]`; the missing grid image remains an upstream list-projection dependency.
- Mobile-first evidence is required at 320×568 and 375×667, plus 1280×800.
- Preserve the two untracked OpenSpec/native artifacts and `stash@{0}`.

## Tasks

- [x] **Z1 — Add an accessible read-only image lightbox.** Real main-product and variant images now open a sibling preview modal with an object-contained large image, meaningful labels, 44px close control, consume-once focus restoration, and honest URL-keyed preview failure fallback. Null/failed thumbnails remain non-interactive. Evidence: 227/227 catalog tests, typecheck, Prettier, whitespace, and independent verification passed.
- [ ] **Z2 — Improve variant media and empty-detail density.** Increase variant thumbnail size, use a square shape with modest radius, keep rows read-only/non-selectable, and show a calm `Sin información adicional` panel when description and variants are both absent.
- [ ] **Z3 — Prove mobile-first behavior and close.** Update exact enabled-control inventories and add unit/strict-network browser evidence for main/variant preview, keyboard/pointer open, focus/Escape/outside lifecycle, 44px close geometry, image containment/no overflow at 320/375/1280, failure fallback, empty-detail feedback, and unchanged request ledgers. Run the complete catalog matrix and record commit/review evidence.

## Allowed implementation surfaces

- `src/features/catalog/components/CatalogProductDetailModal.vue`
- `src/features/catalog/components/__tests__/CatalogProductDetailModal.spec.ts`
- `e2e/responsive/specs/public-catalog-product-detail.spec.ts`
- this task document

## Acceptance criteria

- A real main product image exposes `Ampliar imagen de <producto>` and opens a distinct labelled preview dialog.
- A real variant image exposes `Ampliar imagen de la variante <variante>`; null/failed variant media never exposes an empty button.
- The preview reuses the delivered URL, uses `object-contain`, fits the viewport, closes through its 44px control, Escape, or outside interaction, and returns focus to the invoking image button without closing the underlying detail.
- Main and variant image failures remain URL/identity keyed; preview failures render visible and accessible `Imagen no disponible` feedback.
- Variant media is at least 72×72px, square with modest radius, and never makes the row selected, pressed, or commerce-enabled.
- When both description and variants are absent, the details panel visibly explains that no additional information was published instead of leaving an unexplained blank area.
- Existing detail close/retry behavior, route-level invoker focus restoration, strict-network ledger, prices, stock, availability, and no-commerce inventory remain intact.
- No horizontal overflow occurs at 320, 375, or 1280px.

## Verification contract

```sh
pnpm test:unit --run src/features/catalog
pnpm type-check
pnpm build
pnpm type-check:responsive
pnpm exec playwright test --config playwright.responsive.config.ts e2e/responsive/specs/public-catalog-product-detail.spec.ts
pnpm exec prettier --check odd/tasks/catalog-image-preview-polish.md src/features/catalog/components/CatalogProductDetailModal.vue src/features/catalog/components/__tests__/CatalogProductDetailModal.spec.ts e2e/responsive/specs/public-catalog-product-detail.spec.ts
git diff --check
git diff f3b2a7f..HEAD --check
```

## Evidence

Baseline: `f3b2a7f` on `feat/public-catalog-visual-redesign`.

Z1 added a sibling image-preview UModal without new API/detail requests. The product image and only real variant images expose explicit zoom controls; failures remain inert. Initial independent review found duplicate focus restoration before and after the leave transition. Bounded correction moved ownership to a consume-once dismissed-trigger slot, prevents stale leave callbacks from stealing focus from a newer preview, and clears both trigger references on detail identity change. Final independent re-verification passed with 42 focused tests, 227/227 catalog tests, typecheck, formatting, and whitespace clean. Real stacked-dialog Escape/outside/geometry evidence remains assigned to Z3.
