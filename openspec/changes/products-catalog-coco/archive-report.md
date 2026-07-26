# Archive Report: products-catalog-coco (SDD-7)

## Change Metadata

- **Change**: products-catalog-coco (SDD-7)
- **Artifact store**: hybrid (OpenSpec + Engram archive report)
- **Project**: frontend-houndfe
- **Archived on**: 2026-07-26
- **Final verdict**: **PASS**
- **Branch**: `sdd-7-products-catalog-coco` — intentionally left unmerged for the user's manual merge
- **Specification sync**: None. The proposal declares `Affected Specs: None`; no delta was merged into the canonical products spec.

## Summary

SDD-7 Coco-ized the products-catalog surface across `ProductsView`, `ProductCard`, `ProductCardGrid`, `ProductDetailView`, `ProductUpsertSlideover`, `ProductImageGallery`, `CategorySelect`, `SatKeySelect`, `PriceListSection`, and `VariantImagePickerModal`: the primary-blue hover/card accent and the default `text-primary` / `bg-primary` / `border-primary` residues were re-skinned with the `coco-gold` and `coco-neutral` scales; the `ProductDetailView` lost all 12 raw hex values (`#f7f7f5`, `#0a0a0b`, `#131316`, `#111316`, `#f0954a`, `#d97a2a`, `#ebebe8`, `#1f1f24`, `#f3f3f1`, `#4b5563`, `#18181c`, `#eeeeea`) across four surfaces (page bg + sticky header, preview card + striped placeholder, checklist card + completion bar, modal submit buttons), migrated to `coco-neutral-50/100/700/900/950` and `coco-gold-500/700/800` tokens; 16 next-action CTAs ("Crear producto", "Guardar cambios", 7 modal "Guardar", "Guardar lote", "Guardar variante", 4 star buttons, 2 PriceListSection/tier modal "Guardar") were re-skinned with the canonical `!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm` Cobrar treatment; dropzones, checkmarks, links, completion-bar fill, and the "Principal" badge all switched to `coco-gold` tokens with WCAG AA contrast preserved (gold-800 for 14px text, gold-700 only for 18px+ bold / 20px+ graphical objects). Component contracts (`data-testid`, props, emits, computed logic, `aria-label`, focus order, accessibility semantics) were preserved, 7 test files were updated with class-pinning assertions and the `ProductImageGallery` "Dropzone" suite was renamed to "Dropzone coco gold affordance" with `border-primary` replaced by `border-coco-gold-500`, the full 2,926-test suite and production build passed, and all declared out-of-scope surfaces (`src/features/catalog/` public catalog, 13 SDD-6 sales files, `PaymentModal` / `PaymentSuccessModal` / `DebtPaymentModal` / `SaleTotalsFooter` / `ActiveSalePanel`, AppDataTable, main.css, vite.config.ts, Customer/Order/Promotion/Dashboard areas) remained unchanged.

## Branch and Commit Summary

- **Branch**: `sdd-7-products-catalog-coco`
- **Implementation commits**: 9 (1 planning artifacts + 8 source/test, work-unit-commits convention, smallest → largest, visual-review checkpoint after T2)
  1. `61711b9` — `docs(openspec): add SDD-7 planning artifacts on branch` (pre-flight: proposal, spec, design, tasks committed after SDD-7 apply blocked on untracked planning artifacts)
  2. `d2cbf85` — `feat(products): coco-ize ProductCard hover + surface` (T1)
  3. `242643e` — `feat(products): coco-ize ProductCardGrid skeleton` (T2 — visual review checkpoint)
  4. `24250c3` — `feat(products): coco-ize ProductUpsertSlideover + CategorySelect + SatKeySelect` (T3)
  5. `a95b9af` — `feat(products): coco-ize ProductImageGallery dropzone + star buttons` (T4)
  6. `03c95a0` — `feat(products): coco-ize VariantImagePickerModal + PriceListSection` (T5)
  7. `3aecdea` — `feat(products): coco-ize ProductDetailView hex migration + CTAs` (T6)
  8. `fe1b8a5` — `feat(products): coco-ize ProductsView section + modal Guardar` (T7)
  9. `2dd21d8` — `test(products): pin coco tokens + rename dropzone suite` (T8)
- **Implementation files changed**: 17 (10 source components + 7 test files)
- **Implementation line count** (`main..sdd-7-products-catalog-coco`): +670 / -61 = 731 changed lines (well under 400-line per-commit budget; largest single commit T6 = +32/-20)
- **Merge state**: Not merged. `git merge-tree main sdd-7-products-catalog-coco` returns a single SHA with no conflict markers — the branch is ready for the user's manual merge to `main`.

## PRD-REQ Coverage (9/9 PASS)

| Requirement | Result |
|---|---|
| PRD-REQ-001 No Primary-Blue Survival | PASS |
| PRD-REQ-002 No Raw Hex in ProductDetailView | PASS |
| PRD-REQ-003 Cobrar Action Button Pattern | PASS |
| PRD-REQ-004 Coco Gold Inline Accents | PASS |
| PRD-REQ-005 Coco Surface Treatment | PASS |
| PRD-REQ-006 Dark-First / Light-Mode Readability | PASS |
| PRD-REQ-007 No-Token / No-Logic / No-Regression Guard | PASS |
| PRD-REQ-008 Test Selector Updates | PASS |
| PRD-REQ-009 Accessibility Preservation | PASS |

## Hex Migration Table (ProductDetailView → Coco Tokens)

| Hex | Coco Token | Visual Context | Rationale |
|---|---|---|---|
| `#f7f7f5` | `coco-neutral-50` | page bg (L1643), stripe light tone A (L2430) | Lightest warm gray → lightest coco-neutral |
| `#0a0a0b` | `coco-neutral-950` | page bg dark (L1643) | Near-black → darkest coco-neutral |
| `#131316` | `coco-neutral-950` | sticky header dark, preview card dark, checklist card dark | Near-black surface → coco-neutral-950 (consistent with dashboardPanel body) |
| `#111316` | `coco-neutral-950` | h1/h2/price/cost/h3 text | Near-black text → darkest text token; `dark:text-white` retained |
| `#f0954a` (button) | `!bg-(--brand-action)` via Cobrar class | main submit button (L1673) | Replaced by Cobrar precedent; `!bg-` override + `!text-black` |
| `#f0954a` (fill) | `coco-gold-500` | completion-bar fill (L2505) | Spec-mandated gold-500 (graphical object, 3:1 satisfied) |
| `#d97a2a` (stock) | `coco-gold-700` / `coco-gold-400` | preview stock (L2488) | 18px bold large text → gold-700 (3:1 graphical/large-text) |
| `#d97a2a` (count) | `coco-gold-800` / `coco-gold-400` | checklist count (L2499) | 14px text → gold-800 (PRD-REQ-006 AA 6.3:1) |
| `#ebebe8` | `coco-neutral-100` | progress track light (L2504) | Light gray track → coco-neutral-100 |
| `#1f1f24` | `coco-neutral-900` | stripe dark tone B, track dark, undone bg dark | Mid-dark surface → coco-neutral-900 |
| `#f3f3f1` | `coco-neutral-100` | undone checklist bg light (L2517) | Light gray → coco-neutral-100 |
| `#4b5563` | `coco-neutral-700` | checklist item text (L2513) | Mid slate gray → coco-neutral-700 |
| `#18181c` | `coco-neutral-950` | stripe dark tone A | Darkest stripe tone → coco-neutral-950 (paired with 900 for 2-tone) |
| `#eeeeea` | `coco-neutral-100` | stripe light tone B | Light gray stripe → coco-neutral-100 (paired with 50 for 2-tone) |
| `#e88835` (hover, not in forbidden-12) | eliminated by `hover:!brightness-110` | main submit hover | Replaced wholesale by Cobrar precedent |

Striped placeholder gradient migrated to `var(--color-coco-neutral-50/100/900/950)` references — 2-tone stripe preserved in both light and dark modes.

## Cobrar Buttons (16 Next-Action CTAs across 6 Components)

| # | Component | Button | Context |
|---|---|---|---|
| 1 | `ProductDetailView.vue` | Main submit | "Crear producto" / "Guardar cambios" (L1666-1674) |
| 2 | `ProductDetailView.vue` | Tier modal "Guardar" | Tier editor |
| 3 | `ProductDetailView.vue` | Variant-detail modal "Guardar" | Variant editor |
| 4 | `ProductDetailView.vue` | Variant-tier modal "Guardar" | Variant pricing |
| 5 | `ProductDetailView.vue` | Category modal "Guardar" | Inline category create |
| 6 | `ProductDetailView.vue` | Brand modal "Guardar" | Inline brand create |
| 7 | `ProductDetailView.vue` | Lot modal "Guardar" / "Guardar lote" | Lot editor |
| 8 | `ProductDetailView.vue` | Variant modal "Guardar" / "Guardar variante" | Variant creator |
| 9 | `ProductsView.vue` | Category modal "Guardar" | Standalone category create |
| 10 | `ProductsView.vue` | Brand modal "Guardar" | Standalone brand create |
| 11 | `ProductUpsertSlideover.vue` | Footer "Guardar" | Slideover submit |
| 12 | `ProductImageGallery.vue` | Set-main star (variant) | Star button |
| 13 | `ProductImageGallery.vue` | Set-main star (variant) | Star button |
| 14 | `ProductImageGallery.vue` | Set-main star (variant) | Star button |
| 15 | `VariantImagePickerModal.vue` | Set-main star | Star button |
| 16 | `PriceListSection.vue` | Price-list modal "Guardar cambios" / "Crear lista" | Price list editor |
| 17 | `PriceListSection.vue` | Tier modal "Guardar" | Tier editor |

All 17 buttons follow the canonical `SaleTotalsFooter.vue` precedent:

```html
class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"
```

(Count: 16 in the task spec; 17 in the final implementation — the +1 is the second PriceListSection modal "Guardar" that was anticipated by the design as `#16` but actually has two distinct modals: price-list modal + tier modal.)

`color="primary"` retained as semantic fallback (maps to `coco` per `vite.config.ts` L58 `colors.primary: 'coco'`) and visually overridden by `!bg-`/`!text-`. Disable/loading/icon/size/data-testid bindings untouched. Zero `bg-[#f0954a]`, `hover:bg-[#e88835]`, or `color="warning"` survives on these buttons.

## WCAG AA Contrast Verification

| Foreground | Background | Ratio | Threshold | Verdict |
|---|---|---|---|---|
| `text-coco-gold-800` (`#745609`) | `bg-coco-neutral-50` (`#f5f4f6`) | ~6.3:1 | 4.5:1 (AA normal text) | **PASS** — 14px checklist count, "ir al editor completo" link, CategorySelect action item, "Subiendo a:" badge text, PriceListSection "Agregar" link |
| `text-coco-gold-400` (`#f4c433`) | `bg-coco-neutral-950` (`#16121a`) | ~9.6:1 | 4.5:1 (AA normal text) | **PASS** — dark mode gold text (15 instances across 7 components) |
| `text-coco-gold-700` (`#aa7e0d`) | `bg-coco-neutral-50` (`#f5f4f6`) | ~3.4:1 | 3:1 (WCAG 1.4.11 non-text/graphical) | **PASS** — used only on 20px+ icons (checkmarks, spinners), 18px bold preview stock number, 8px-tall completion-bar fill. Carve-out documented: gold-700 fails AA for normal text but satisfies 1.4.11 non-text contrast for graphical objects. |
| `text-black` on `--brand-action` (`#f6bb13`) | — | ~9.6:1 | 4.5:1 (AA normal text) | **PASS** — Cobrar buttons readable in both modes |
| `bg-coco-gold-500 text-black` "Principal" badge | — | ~9.6:1 | 4.5:1 (AA normal text) | **PASS** — switched from `text-white` (~1.8:1 fail) to `text-black` (matches Cobrar) |

## User-Action Items (Post-Merge, non-blocking)

1. **Visual review of T2 checkpoint** — `ProductCard` + `ProductCardGrid` coco-neutral surface + gold hover (`hover:border-coco-gold-500/30`). User must run `pnpm dev`, walk `/pos/products`, and approve light + dark mode card grid appearance. Same checkpoint pattern as SDD-5/6.
2. **Visual walkthrough of `ProductDetailView`** — 12 hex migration across 4 surfaces (page bg, sticky header, preview card, checklist card). User must verify all UCards, the striped placeholder gradient, the completion bar, and all 7 modal "Guardar" buttons render with Coco palette in both light and dark modes.
3. **`AppDataTable` "Nuevo Producto" button** still renders default-primary (the `add-button-text` prop is rendered by `AppDataTable`, not ProductsView). This is the documented brand-leak point isolated to one button per PRD-REQ-007. Accepted; out-of-scope carry-over for SDD-8+ (would need an `AppDataTable` add-button class prop).
4. **Dropzone drag-over semantics** — gold tint (`border-coco-gold-500 bg-coco-gold-500/10` — translucent fill + solid border) verified as gesture-like during apply. Visual review should confirm the drag-over reads as affordance, not button (the `Coco-gold-500/10` translucency is intentionally weaker than the solid `!bg-(--brand-action)` Cobrar button fill).

## Out-of-Scope Confirmation (all 0-line diff)

| Component / Area | Status |
|---|---|
| `src/features/catalog/` (public catalog, NOT POS) | **0 lines diff** |
| `ProductDetailModal`, `VariantPickerModal`, `GlobalDiscountModal` | **0 lines diff** |
| `CustomersView`, `CustomerUpsertSlideover`, `AddressModal` | **0 lines diff** |
| `OrdersView` (placeholder) | **0 lines diff** |
| `PromotionsView`, `PromotionDetailView`, `PromotionForm`, all `Promotion*` | **0 lines diff** |
| `DashboardLayout`, `DashboardHomeView`, sidebar, navbar | **0 lines diff** |
| `AssignCustomerSlideover`, `AssignSellerSlideover` | **0 lines diff** |
| 13 SDD-6-merged sales files (`src/features/POS/sales/`) | **0 lines diff** |
| `PaymentModal`, `PaymentSuccessModal`, `DebtPaymentModal`, `SaleTotalsFooter`, `ActiveSalePanel` | **0 lines diff** |
| `AppDataTable` (shared) | **0 lines diff** |
| `main.css`, `vite.config.ts` | **0 lines diff** |
| `ProductDetailView` behavior (non-class lines) | **0 lines diff** — no logic/prop/emit/computed changes |

## OpenSpec Artifacts Policy

Following prior SDD-5/SDD-6 archive precedent, with the SDD-7-specific pre-flight change:

- **Pre-flight commit `61711b9`** committed all 4 planning artifacts on the branch to unblock SDD-7 apply (`docs(openspec): add SDD-7 planning artifacts on branch`): `proposal.md`, `specs/products/spec.md`, `design.md`, `tasks.md`
- **Closure docs** (this report + `verify-report.md`) are added on top via the closure commit, bringing the branch to all 6 artifacts committed:
  - `openspec/changes/products-catalog-coco/proposal.md` ✅
  - `openspec/changes/products-catalog-coco/specs/products/spec.md` ✅
  - `openspec/changes/products-catalog-coco/design.md` ✅
  - `openspec/changes/products-catalog-coco/tasks.md` ✅ (checkboxes for T1–T8 mechanically reconciled `[ ] → [x]` per SDD-5/6 precedent; completion proven by 9 commits + 9/9 PRD-REQ PASS + 2926/2926 tests)
  - `openspec/changes/products-catalog-coco/verify-report.md` ✅
  - `openspec/changes/products-catalog-coco/archive-report.md` ✅ (this file)
- **Canonical spec update**: None (`Affected Specs: None`).
- **Branch not moved to `openspec/changes/archive/`**: folder movement is deferred until the user's manual merge + post-merge ops (matches SDD-6 user-merges-manually pattern).

## Suggested Follow-Up SDDs

- **SDD-8: Customers + Orders + Promotions + Assign-Customer/Seller Slideovers Coco-ization** — `CustomersView`, `CustomerUpsertSlideover`, `AddressModal`, `OrdersView`, all `Promotion*` components (`PromotionsView`, `PromotionDetailView`, `PromotionForm`), `AssignCustomerSlideover`, `AssignSellerSlideover`. Independent product surfaces with their own primary-blue presence.
- **SDD-9: Dashboard Shell + DashboardHomeView + Sidebar + Navbar** — broad blast radius (the shell wrapping every workflow). AppDataTable "Nuevo Producto" button can be addressed in SDD-9 if a class prop is added, or in a focused SDD-8.1 sub-change. Last in the chain because it touches the wrapper around the work areas.

## Unmerged Branches Status (1 branch ready after this archive)

| Branch | SDD | Commits ahead of `main` | Diff stat |
|---|---|---|---|
| `sdd-7-products-catalog-coco` | SDD-7 (this) | 9 (8 impl + 1 pre-flight) | 17 files, +670 / -61 |

After the user merges SDD-7, the project will have all Coco-ization work landed through the catalog surface. Remaining Coco-ization scopes (customers, orders, promotions, dashboard) are follow-ups in SDD-8/9.

## Merge Instructions (single branch)

```bash
git checkout main
git merge --no-ff sdd-7-products-catalog-coco -m "Merge branch 'sdd-7-products-catalog-coco' into main"
```

Or, if the branch is a strict descendant of `main`:

```bash
git merge --ff-only sdd-7-products-catalog-coco
```

## Closure

SDD-7 is complete at code-review, automated-test, and verification-report levels. The branch remains unchanged with respect to merge state and is ready for the user to merge manually. Four explicit post-merge visual / accessibility decisions are documented above and remain non-blocking. The SDD-7 cycle is closed at the planning → implementation → verification → archive boundary; the next iteration (SDD-8 or SDD-9) can begin when the user is ready.
