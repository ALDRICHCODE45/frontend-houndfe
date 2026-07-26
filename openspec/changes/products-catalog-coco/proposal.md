# Proposal: Products Catalog Coco

## Why

The new-sale workspace, payment moment, sale history, and sale detail are all Coco — Cobrar/Confirmar/Cerrar gold, cart card, item rows, timeline and totals all speak the brand. The moment a salesperson opens the catalog (either the management list `ProductsView.vue`, the action-card grid `ProductCardGrid.vue` / `ProductCard.vue`, or the detail/edit `ProductDetailView.vue`), the brand breaks. `ProductCard` uses `hover:border-primary/30` (default Nuxt UI blue). `ProductsView` modal save buttons default to primary. `ProductDetailView` is the worst offender: hardcoded hex values (`#f7f7f5`, `#0a0a0b`, `#131316`, `#111316`, `#f0954a`, `#d97a2a`, plus `#ebebe8`/`#1f1f24`/`#f3f3f1`/`#4b5563`/`#18181c`/`#eeeeea`) approximate warm Coco styling but bypass the token system entirely. The catalog is the product-browsing moment — the salesperson's primary search panel during a sale and the management surface between sales — so the brand discontinuity reads louder here than the remaining areas.

## What Changes

Coco-ize the products catalog surface in `src/features/POS/products/`:

| # | File | Swap |
|---|------|------|
| 1 | `views/ProductsView.vue` | `color="primary"` defaults on "Nuevo Producto" / modal "Guardar" → Coco gold (`--brand-action`); section surface → Coco-neutral. |
| 2 | `components/ProductCard.vue` | `hover:border-primary/30` → Coco gold tint; ensure `bg-default` / `border-default` resolve to Coco-neutral. |
| 3 | `components/ProductCardGrid.vue` | `bg-elevated` skeleton + `border-default` → Coco-neutral tokens. |
| 4 | `views/ProductDetailView.vue` | Migrate all hardcoded hex (`#f7f7f5`, `#0a0a0b`, `#131316`, `#111316`, `#f0954a`, `#d97a2a`, `#ebebe8`, `#1f1f24`, `#f3f3f1`, `#4b5563`, `#18181c`, `#eeeeea`) → `coco-neutral-*` / `coco-gold-*` tokens; `color="primary"` "Editar producto" / "Guardar" → Cobrar gold. |

Adjacent sub-components (touch only what's needed for visual coherence):

| # | File | Swap |
|---|------|------|
| 5 | `components/ProductUpsertSlideover.vue` | `text-primary` link + no-color "Guardar" (defaults to primary) → Coco gold. |
| 6 | `components/ProductImageGallery.vue` | `border-primary / bg-primary/10 / text-primary` dropzone affordance → `coco-gold-*`; `color="warning"` confirm buttons → gold (Cobrar precedent). |
| 7 | `components/CategorySelect.vue` | `text-primary` on selected item + checkmark icon → Coco gold tint. |
| 8 | `components/SatKeySelect.vue` | `text-primary` checkmark icon → Coco gold tint. |
| 9 | `components/PriceListSection.vue` | `color="primary"` save button → gold. |
| 10 | `components/VariantImagePickerModal.vue` | `border-primary / bg-primary/10 / text-primary` dropzone + `color="warning"` confirm → Coco gold. |

## Non-Goals

Each gets its own brand-redesign SDD: customers (`CustomersView`, `CustomerUpsertSlideover`, `AddressModal`); `OrdersView` (placeholder); promotions (`PromotionsView`, `PromotionDetailView`, `PromotionForm`, all `Promotion*`); dashboard shell (`DashboardLayout`, `DashboardHomeView`, sidebar, navbar); `AssignCustomerSlideover`, `AssignSellerSlideover`; `ProductDetailModal`, `VariantPickerModal`, `GlobalDiscountModal`. **`src/features/catalog/` is the customer-facing public catalog with its own light-first design — out of scope for the POS brand redesign.** No new design tokens, no `main.css`/`vite.config.ts` changes, no business-logic / prop / emit / validation / API changes, no new components or splits, no new routes, no navigation changes. `AppDataTable` and core/shared components stay as-is (only consumed via `ProductsView`).

## Approach

Reuse the Cobrar precedent (`color="primary"` + `class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"`) for every "next action" button: "Nuevo Producto", "Editar producto", "Guardar", "Guardar cambios", "Publicar", "Confirmar" in the image/variant picker modals. Use `coco-gold` scale for non-action accents (dropzone affordance, selected-item highlight, "Ver detalle" links, icons, completion-bar fill): `border-coco-gold-500/20 bg-coco-gold-500/5` for surfaces, `text-coco-gold-400` (dark) / `text-coco-gold-700` (light) for icons/links, `text-coco-gold-800` for 14px text on `coco-neutral-50` (WCAG AA 6.22:1 — resolved SDD-5 lesson). Use `coco-gold-700` only for 20px+ graphical objects (the completion-bar fill in `ProductDetailView`). Use `bg-coco-neutral-50 dark:bg-coco-neutral-950` for sticky header and data cards; `border-coco-neutral-200 dark:border-coco-neutral-800` for borders. `ProductDetailView` hex migration: each `#xxxxxx` becomes the equivalent Coco token — `#f7f7f5`/`#f3f3f1`/`#ebebe8`/`#eeeeea` → `coco-neutral-50`/`coco-neutral-100`; `#0a0a0b`/`#131316`/`#111316` → `coco-neutral-950`; `#1f1f24`/`#18181c` → `coco-neutral-900`; the striped-pattern accent stays literal-gradient syntax but uses `coco-neutral-50`/`coco-neutral-100` (dark) / `coco-neutral-900`/`coco-neutral-800` (light); `#f0954a`/`#d97a2a` → `coco-gold-500`/`coco-gold-700`. Strict TDD: pin `data-testid`, prop/emits, computed-state names, and the new class tokens (`bg-coco-gold-*`, `bg-(--brand-action)`, `text-coco-gold-*`, `bg-coco-neutral-*`); update selectors that currently assert `border-primary` / `bg-primary` / `text-primary` to the new tokens; `ProductImageGallery.test.ts` "Dropzone primary affordance" test name and `border-primary` assertion need updating. Dark-first; **visual review checkpoint after T2** (after `ProductCard` + `ProductCardGrid` is the natural cut — same pattern as SDD-5/6).

## Affected Specs

None. No requirement in `openspec/specs/products/spec.md` covers color tokens. New: None. Modified: None.

## Risks

- **Visual regression on a daily-use area (Med)** — iterate visually after T1, like SDD-3/4/5/6.
- **`ProductDetailView` heavy hex migration (Med)** — ~12 hex values across 4 surfaces; a single missed swap will feel like a brand leak.
- **Dropzone affordance semantics (Low)** — gold drag-over on the image gallery/variant picker could read as "CTA"; verify it stays gesture-like, not button-like.
- **Test selector breakage (Med)** — `ProductImageGallery.test.ts` pins `border-primary`; rename to Coco-gold equivalents.
- **Public catalog confusion (Low)** — `src/features/catalog/` (NOT POS) is a separate customer-facing surface with light-first styling; explicitly NOT touched. SDD-8+ candidate if it's ever brought into the brand redesign.
- **`ProductDetailView` completion-bar fill / checklist emerald stays (Med)** — `border-emerald-500 bg-emerald-100` on `done` items are semantic (success state for the publication checklist) — keep, but verify it doesn't read as "off-brand green" against the Coco palette.

## Rollback Plan

`git revert` the merge commit. Visual-only token substitution; undoing restores default Nuxt UI primary plus the original hardcoded hex values with no API or data-shape changes.

## Dependencies

None. Nuxt UI 4 + Tailwind v4 + Coco tokens from SDD-1 + payment modals from SDD-5 + sale history from SDD-6.

## Success Criteria

- [ ] No `text-primary`, `bg-primary`, `border-primary/*`, or unoverridden `color="primary"` / no-color CTA in the ten target files.
- [ ] No raw hex values (`#f7f7f5`, `#0a0a0b`, `#131316`, `#111316`, `#f0954a`, `#d97a2a`, `#ebebe8`, `#1f1f24`, `#f3f3f1`, `#4b5563`, `#18181c`, `#eeeeea`) anywhere in `ProductDetailView.vue`.
- [ ] "Nuevo Producto", "Editar producto", "Guardar", "Guardar cambios", "Publicar", "Confirmar" follow the Cobrar precedent (`!bg-(--brand-action) !text-black`).
- [ ] Dropzone affordance, selected-item highlight, completion-bar fill, and icon links use `coco-gold-*` tokens.
- [ ] Dark-first treatment: gold accents readable on `coco-neutral-950`; light-mode readable on `coco-neutral-50`.
- [ ] `pnpm build` clean; `pnpm test:unit --run` passes after selector updates; no new Coco tokens introduced; `src/features/catalog/` unchanged.

## Open Questions

1. **`ProductDetailView` completion-bar fill** — `coco-gold-500` (brand-as-progress, matches Cobrar) or `coco-gold-600` (slightly darker, more "filled" feel)?
2. **Dropzone drag-over gold tint** — `coco-gold-500/10` (matches list-item hover) or `coco-gold-500/20` (more emphatic, gesture-like)?
3. **`ProductCard` hover border** — `coco-gold-500/30` (matches row-folio link precedent) or `coco-gold-500/50` (more visible on dim `coco-neutral-950`)?
4. **`VariantImagePickerModal` variant-name font-mono color** — `coco-gold-700` (warm accent) or `coco-neutral-100` (neutral, lets the chooser card carry the brand color)?
