# Tasks: Products Catalog Coco

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~170 |
| Estimated files | 17 (10 components + 7 tests) |
| Estimated commits | 8 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Eight commits; manual merge |
| Delivery strategy | single-pr (no PRs) |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Work Units
T1–T8; threat matrix N/A. Build: `pnpm build`.

## Tasks

### [x] T1 — `feat(products): coco-ize ProductCard hover + surface`
- **Files**: `src/features/POS/products/components/ProductCard.vue`
- **Change/REQ**: Coco-neutral surface/border and gold `/30` hover — PRD-REQ-001 (partial), 004, 005.
- **Verify**: `pnpm test:unit --run -- src/features/POS/products/components/__tests__/ProductCard.test.ts`; `/pos/products` hover.
- **Revert/deps**: `git revert <T1-sha>`; none.

### [x] T2 — `feat(products): coco-ize ProductCardGrid skeleton`
- **Files**: `src/features/POS/products/components/ProductCardGrid.vue`
- **Change/REQ**: Coco-neutral 100/900 skeleton and 200/800 border — PRD-REQ-001 (partial), 005.
- **Verify**: `pnpm test:unit --run -- src/features/POS/products/components/__tests__/ProductCardGrid.test.ts`; loading grid.
- **Revert/deps**: `git revert <T2-sha>`; T1.

## Visual review checkpoint
STOP after T2; approve light/dark surface + hover before T3. Adjust T2/T3 first.

### [x] T3 — `feat(products): coco-ize ProductUpsertSlideover + CategorySelect + SatKeySelect`
- **Files**: `src/features/POS/products/components/ProductUpsertSlideover.vue`, `src/features/POS/products/components/CategorySelect.vue`, `src/features/POS/products/components/SatKeySelect.vue`
- **Change/REQ**: Cobrar submit, AA-safe gold links/actions, checkmarks, focus rings — PRD-REQ-001 (partial), 003, 004, 006.
- **Verify**: `pnpm test:unit --run -- src/features/POS/products/components/__tests__/SatKeySelect.test.ts`; slideover/selectors.
- **Revert/deps**: `git revert <T3-sha>`; T2 + visual approval.

### [x] T4 — `feat(products): coco-ize ProductImageGallery dropzone + star buttons`
- **Files**: `src/features/POS/products/components/ProductImageGallery.vue`
- **Change/REQ**: Gold dropzone/upload accents, rings, badge, scope tab, three Cobrar stars — PRD-REQ-001 (partial), 003, 004, 006.
- **Verify**: `pnpm test:unit --run -- src/features/POS/products/components/__tests__/ProductImageGallery.test.ts`; idle/drag/upload.
- **Revert/deps**: `git revert <T4-sha>`; T3.

### [x] T5 — `feat(products): coco-ize VariantImagePickerModal + PriceListSection`
- **Files**: `src/features/POS/products/components/VariantImagePickerModal.vue`, `src/features/POS/products/components/PriceListSection.vue`
- **Change/REQ**: Gold dropzone/ring/star, AA-safe price link, two Cobrar saves — PRD-REQ-001 (partial), 003, 004, 006.
- **Verify**: `pnpm test:unit --run -- src/features/POS/products/components/__tests__/VariantImagePickerModal.test.ts`; picker/price modals.
- **Revert/deps**: `git revert <T5-sha>`; T4.

### [x] T6 — `feat(products): coco-ize ProductDetailView hex migration + CTAs`
- **Files**: `src/features/POS/products/views/ProductDetailView.vue`
- **Change/REQ**: Remove 12 hexes; migrate four surfaces, stripe, progress, links, submit, seven modal saves — PRD-REQ-001 (partial), 002–006.
- **Verify**: `pnpm test:unit --run -- src/features/POS/products/views/__tests__/ProductDetailView.test.ts`; light/dark; paper-mode all 6 UCards.
- **Revert/deps**: `git revert <T6-sha>`; T5.

### [x] T7 — `feat(products): coco-ize ProductsView section + modal Guardar`
- **Files**: `src/features/POS/products/views/ProductsView.vue`
- **Change/REQ**: Coco-neutral section/header and Cobrar two modal saves; defer shared `AppDataTable` “Nuevo Producto” — PRD-REQ-001 (partial), 003, 005, 007.
- **Verify**: `pnpm test:unit --run -- src/features/POS/products/views/__tests__/ProductsView.test.ts src/features/POS/products/views/__tests__/ProductsView.satKeyError.test.ts`; section and modals.
- **Revert/deps**: `git revert <T7-sha>`; T6.

### [x] T8 — `test(products): pin coco tokens + rename dropzone suite`
- **Files**: `src/features/POS/products/components/__tests__/ProductImageGallery.test.ts`, `src/features/POS/products/components/__tests__/ProductCard.test.ts`, `src/features/POS/products/components/__tests__/ProductCardGrid.test.ts`, `src/features/POS/products/components/__tests__/VariantImagePickerModal.test.ts`, `src/features/POS/products/components/__tests__/SatKeySelect.test.ts`, `src/features/POS/products/views/__tests__/ProductDetailView.test.ts`, `src/features/POS/products/views/__tests__/ProductsView.test.ts`
- **Change/REQ**: Add design pins, rename dropzone suite, assert `border-coco-gold-500`, forward gallery attrs — PRD-REQ-001 (test), 003–005, 008.
- **Verify**: `pnpm test:unit --run -- src/features/POS/products`; `pnpm test:unit --run`. Runtime: N/A (selector tests).
- **Revert/deps**: `git revert <T8-sha>`; T7.

## Dependency Graph
`T1 → T2 → [VISUAL REVIEW] → T3 → T4 → T5 → T6 → T7 → T8`
