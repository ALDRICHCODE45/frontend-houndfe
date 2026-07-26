# Delta for Products — Products Catalog Coco

## ADDED Requirements

### Requirement: PRD-REQ-001 No Primary-Blue Survival

The 10 target files MUST NOT render `text-primary`, `bg-primary`, `/border-primary\//`, or implicit-primary/`color="primary"` UButton without `!bg-` override. Props, emits, validation, computed logic, `data-testid`, `aria-label`, focus order MUST stay identical.

#### Scenario: zero primary tokens, behavior unchanged
- GIVEN the 10 targets mounted
- WHEN DOM inspected for `text-primary`, `bg-primary`, `/border-primary\//`, implicit-primary UButton
- THEN none found
- AND all emit payloads, labels, computed states, `data-testid` anchors match pre-change

### Requirement: PRD-REQ-002 No Raw Hex in ProductDetailView

`ProductDetailView.vue` MUST NOT contain: `#f7f7f5`, `#0a0a0b`, `#131316`, `#111316`, `#f0954a`, `#d97a2a`, `#ebebe8`, `#1f1f24`, `#f3f3f1`, `#4b5563`, `#18181c`, `#eeeeea`. Each MUST map to a Coco token. Emeralds on checklist `done` items MUST remain.

#### Scenario: zero raw hex, emeralds preserved
- GIVEN `ProductDetailView.vue` after change
- WHEN `grep` for the 12 hex values
- THEN none found; emerald checklist classes unchanged

### Requirement: PRD-REQ-003 Cobrar Action Button Pattern

"Crear producto"/"Guardar cambios" in `ProductDetailView.vue` and `ProductUpsertSlideover.vue`, modal "Guardar" in `ProductsView.vue`, and `color="warning"` star buttons in `ProductImageGallery.vue`/`VariantImagePickerModal.vue` MUST use `!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm`.

#### Scenario: Cobrar buttons render gold, no hex/primary/warning
- GIVEN action buttons mounted in all 4 components
- WHEN "Crear producto"/"Guardar cambios"/"Guardar"/star buttons render
- THEN class list includes `!bg-(--brand-action)` and `!text-black`
- AND no `bg-[#f0954a]`, `hover:bg-[#e88835]`, implicit-primary, or `color="warning"`

### Requirement: PRD-REQ-004 Coco Gold Inline Accents

Dropzones MUST use `border-coco-gold-500/20 bg-coco-gold-500/5` (idle), `border-coco-gold-500 bg-coco-gold-500/10` (drag-over). Checkmarks, "ir al editor completo" link, completion-bar fill, preview stock, "Subiendo a:" badge MUST use coco-gold tokens instead of primary/hex.

#### Scenario: dropzone, checkmarks, accents use coco gold
- GIVEN `ProductImageGallery`/`VariantImagePickerModal`, `CategorySelect`, `SatKeySelect`, `ProductUpsertSlideover`, `ProductDetailView` mounted
- WHEN idle, `[data-dropzone]` includes `hover:border-coco-gold-500/20 hover:bg-coco-gold-500/5`
- WHEN drag-over, includes `border-coco-gold-500 bg-coco-gold-500/10`, icon is `text-coco-gold-700`
- WHEN checkmark/link render, includes `text-coco-gold-700 dark:text-coco-gold-400`
- WHEN completion-bar fill renders, includes `bg-coco-gold-500`
- WHEN preview stock renders, includes `text-coco-gold-700 dark:text-coco-gold-400`
- AND no `border-primary`, `bg-primary/*`, `text-primary`, `bg-[#f0954a]`, `text-[#d97a2a]`

### Requirement: PRD-REQ-005 Coco Surface Treatment

`ProductDetailView` page bg, sticky header, preview card, checklist card, image placeholder MUST use `bg-coco-neutral-50 dark:bg-coco-neutral-950`. `ProductsView` section wrapper same. `ProductCard` MUST use `bg-coco-neutral-50 dark:bg-coco-neutral-950 border-coco-neutral-200 dark:border-coco-neutral-800`. Skeletons MUST use `bg-coco-neutral-100 dark:bg-coco-neutral-900`.

#### Scenario: coco-neutral surfaces everywhere
- GIVEN all target components mounted
- WHEN `ProductDetailView` header, cards, `ProductsView` section, `ProductCard` article, and skeletons are inspected
- THEN classes include coco-neutral tokens
- AND no `bg-white`, `bg-[#f7f7f5]`, `dark:bg-[#0a0a0b]`, `dark:bg-[#131316]`, `bg-default`, `bg-elevated`

### Requirement: PRD-REQ-006 Dark-First and Light-Mode Readability

Gold text on dark MUST use `text-coco-gold-400`. Gold on light MUST use `text-coco-gold-700`. `coco-gold-800` only for 14px text on `coco-neutral-50`. Cobrar buttons readable both modes.

#### Scenario: contrast in both modes
- GIVEN dark mode: gold text uses `text-coco-gold-400`
- GIVEN light mode: gold text uses `text-coco-gold-700`, Cobrar buttons have `!text-black`

### Requirement: PRD-REQ-007 No-Token / No-Logic / No-Regression Guard

No new `@theme` entries. `vite.config.ts` unchanged. Props/emits/computed identical. 13 SDD-6 files, `main.css`, `vite.config.ts`, `src/features/catalog/` diff empty. `pnpm test:unit --run` passes all behavior tests.

#### Scenario: no leaks
- GIVEN change applied
- WHEN diffing config files, SDD-6 sales files, and `src/features/catalog/`
- THEN each diff empty; all behavior tests pass

### Requirement: PRD-REQ-008 Test Selector Updates

`ProductImageGallery.test.ts` "Dropzone primary affordance" → "Dropzone coco gold affordance". `border-primary` assertion → `border-coco-gold-500`. All other assertions pass.

#### Scenario: test updated, rest pass
- GIVEN updated `ProductImageGallery.test.ts`
- WHEN `pnpm test:unit --run` executes
- THEN no `border-primary` assertions; drag-over uses `border-coco-gold-500`; all other tests in 6 component suites pass

### Requirement: PRD-REQ-009 Accessibility Preservation

`data-testid`, `aria-label`, focus order, Nuxt UI shell semantics unchanged. Dropzones retain `role="button"`, `tabindex="0"`, `cursor-pointer`, keyboard handlers. Color not sole indicator.

#### Scenario: accessibility intact
- GIVEN all 10 targets mounted
- WHEN `data-testid`, `aria-label`, focus order inspected
- THEN all match pre-change; dropzones retain interactive semantics
