# Design: Products Catalog Coco

## Technical Approach

Pure class-level token substitution across ten products-catalog components. No structural, prop, emit, computed, routing, or API changes. Reuse the `SaleTotalsFooter.vue` Cobrar button class for every submit/next-action CTA ("Crear producto", "Guardar cambios", all modal "Guardar" buttons, "Guardar lote", "Guardar variante", image star buttons); swap `primary` tints/text/borders to the `coco-gold` scale for inline accents (dropzones, checkmarks, links, completion-bar fill, scope-tab active, focus rings); replace raw hex + `bg-white`/`bg-default`/`bg-elevated` surfaces with explicit `coco-neutral-*` tokens. Spec: PRD-REQ-001…009.

## Architecture Overview

```
/pos/products          → ProductsView                 (ProductsView.test.ts, ProductsView.satKeyError.test.ts)
   └─ <AppDataTable> (shared, OUT OF SCOPE — renders "Nuevo Producto" add button; PRD-REQ-007)
        └─ #cards → <ProductCardGrid>                 (ProductCardGrid.test.ts)
                       └─ <ProductCard>               (ProductCard.test.ts)
   └─ <ProductUpsertSlideover> (create/edit)          (no test file)
        └─ <CategorySelect>, <SatKeySelect>           (SatKeySelect.test.ts; CategorySelect — no test)
   └─ UModal "Nueva categoría" / "Nueva marca" → "Guardar" (implicit-primary → Cobrar)

/pos/products/:id      → ProductDetailView            (ProductDetailView.test.ts — UButton stub forwards data-testid, NOT class)
/pos/products/new      → ProductDetailView (create mode)
   ├─ sticky header [bg-[#f7f7f5] dark:bg-[#0a0a0b]]  → coco-neutral-50/950
   ├─ main submit "Crear producto"/"Guardar cambios" [bg-[#f0954a]]  → Cobrar
   ├─ <UForm> fieldset
   │    ├─ <UCard> Datos / Precio compra / Impuestos / Inventario / Variantes / Lotes / Precios (create)
   │    ├─ <PriceListSection>  (edit mode)            (no test file)
   │    └─ <ProductImageGallery> (edit mode)          (ProductImageGallery.test.ts — pins border-primary; PRD-REQ-008)
   ├─ <aside> preview card [bg-white dark:bg-[#131316]] + striped placeholder [#f7f7f5/#eeeeea dark:#18181c/#1f1f24]
   │    └─ checklist card [bg-white dark:bg-[#131316]] + completion bar [bg-[#f0954a] on bg-[#ebebe8] dark:bg-[#1f1f24]]
   └─ 6 UModals (tier/variant-detail/variant-tier/category/brand/lot/variant) — each "Guardar" → Cobrar
   └─ <VariantImagePickerModal>                       (VariantImagePickerModal.test.ts)
```

**Cross-feature usage**: `ProductCard` is consumed only by `ProductCardGrid` (POS catalog). It is NOT currently re-used by the salesperson's new-sale search panel — that panel uses its own item-row components (SDD-3/4 surface). The proposal's "primary search panel during a sale" framing is conceptual (the catalog is where the salesperson browses between sales); no shared-component refactor is implied.

**Why purely class-level**: every target is presentational, driven by props/emits and TanStack Query. Props, emits, `data-testid`, `aria-label`, focus order, validation, computed state, mutation wiring are identical pre/post (PRD-REQ-001/007/009). The change swaps `class` attribute strings and, for `color="primary"` CTAs, appends the `!bg-(--brand-action)` override (retaining `color="primary"` as semantic fallback per the Cobrar precedent).

**Independence from SDD-3/4/5/6**: the 10 target files live under `src/features/POS/products/` — a different feature surface from the sales workspace (SDD-3/4), payment modals (SDD-5), and sales history (SDD-6). Zero file overlap with those change sets. The 13 SDD-6-merged sales files, `src/features/catalog/` (public, non-POS), `main.css`, `vite.config.ts`, and `AppDataTable` are all untouched (PRD-REQ-007).

## Token Substitution Table

| Component | Element (line) | Before | After | Why |
|---|---|---|---|---|
| ProductsView | `<section>` wrapper (L627) | `border border-default bg-default shadow-sm` | `border-coco-neutral-200 dark:border-coco-neutral-800 bg-coco-neutral-50 dark:bg-coco-neutral-950 shadow-sm` | PRD-REQ-005 surface; drop `bg-default`/`border-default` aliases for explicit tokens |
| ProductsView | header div (L628) | `border-b border-default` | `border-b border-coco-neutral-200 dark:border-coco-neutral-800` | PRD-REQ-005 |
| ProductsView | category modal "Guardar" (L562-567) | no `color`, no class | `color="primary" class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"` | PRD-REQ-003 Cobrar |
| ProductsView | brand modal "Guardar" (L607-612) | no `color`, no class | (identical Cobrar class) | PRD-REQ-003 |
| ProductsView | "Nuevo Producto" add button | rendered by `AppDataTable` (shared, out of scope) | **DEFERRED** — cannot Cobrar-ize without modifying `AppDataTable`; PRD-REQ-007 forbids | Scope boundary (see Risks) |
| ProductCard | `<article>` (L63) | `border border-default bg-default ... hover:border-primary/30` | `border-coco-neutral-200 dark:border-coco-neutral-800 bg-coco-neutral-50 dark:bg-coco-neutral-950 ... hover:border-coco-gold-500/30` | PRD-REQ-005 + PRD-REQ-004; hover border = Open Q3 → `/30` |
| ProductCardGrid | skeleton (L31) | `border border-default bg-elevated` | `border-coco-neutral-200 dark:border-coco-neutral-800 bg-coco-neutral-100 dark:bg-coco-neutral-900` | PRD-REQ-005 skeleton |
| ProductDetailView | page bg (L1643) | `bg-[#f7f7f5] dark:bg-[#0a0a0b]` | `bg-coco-neutral-50 dark:bg-coco-neutral-950` | PRD-REQ-002/005 |
| ProductDetailView | sticky header (L1644) | `bg-white/95 dark:bg-[#131316]/95` | `bg-coco-neutral-50/95 dark:bg-coco-neutral-950/95` | PRD-REQ-005; keep `/95` for sticky blur |
| ProductDetailView | h1 (L1655) | `text-[#111316] dark:text-white` | `text-coco-neutral-950 dark:text-white` | PRD-REQ-002 |
| ProductDetailView | main submit (L1666-1674) | `class="bg-[#f0954a] hover:bg-[#e88835]"` | `color="primary" class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"` | PRD-REQ-003 Cobrar; eliminates `#f0954a` + `#e88835` |
| ProductDetailView | "Agregar" price-list (L2301-2307) | `color="primary"` | `color="primary" class="!bg-coco-gold-500/15 !text-coco-gold-800 dark:!text-coco-gold-300 hover:!bg-coco-gold-500/25"` | PRD-REQ-001; secondary add → soft gold tint (not CTA-prominent) |
| ProductDetailView | "Agregar Lista de Precios" ghost (L2396-2405) | `color="neutral" variant="ghost" class="text-primary"` | `color="neutral" variant="ghost" class="text-coco-gold-800 dark:text-coco-gold-400"` | PRD-REQ-001/004; 14px link → gold-800 |
| ProductDetailView | preview card (L2429) | `bg-white dark:bg-[#131316]` | `bg-coco-neutral-50 dark:bg-coco-neutral-950` | PRD-REQ-005 |
| ProductDetailView | striped placeholder (L2430) | `bg-[repeating-linear-gradient(45deg,#f7f7f5_0,#f7f7f5_10px,#eeeeea_10px,#eeeeea_20px)] dark:bg-[repeating-linear-gradient(45deg,#18181c_0,#18181c_10px,#1f1f24_10px,#1f1f24_20px)]` | `bg-[repeating-linear-gradient(45deg,var(--color-coco-neutral-50)_0,var(--color-coco-neutral-50)_10px,var(--color-coco-neutral-100)_10px,var(--color-coco-neutral-100)_20px)] dark:bg-[repeating-linear-gradient(45deg,var(--color-coco-neutral-950)_0,var(--color-coco-neutral-950)_10px,var(--color-coco-neutral-900)_10px,var(--color-coco-neutral-900)_20px)]` | PRD-REQ-002; eliminates `#f7f7f5`,`#eeeeea`,`#18181c`,`#1f1f24`; 2-tone stripe preserved in both modes |
| ProductDetailView | preview h2/price/cost/h3 (L2446,2465,2471,2496) | `text-[#111316] dark:text-white` | `text-coco-neutral-950 dark:text-white` | PRD-REQ-002 |
| ProductDetailView | preview stock (L2486) | `text-[#d97a2a]` | `text-coco-gold-700 dark:text-coco-gold-400` | PRD-REQ-004 (spec-mandated); 18px bold = large text → 3:1 satisfied |
| ProductDetailView | checklist card (L2494) | `bg-white dark:bg-[#131316]` | `bg-coco-neutral-50 dark:bg-coco-neutral-950` | PRD-REQ-005 |
| ProductDetailView | checklist count (L2497) | `text-[#d97a2a]` | `text-coco-gold-800 dark:text-coco-gold-400` | PRD-REQ-006; 14px text → gold-800 (AA) |
| ProductDetailView | progress track (L2502) | `bg-[#ebebe8] dark:bg-[#1f1f24]` | `bg-coco-neutral-100 dark:bg-coco-neutral-900` | PRD-REQ-002 |
| ProductDetailView | completion-bar fill (L2503) | `bg-[#f0954a]` | `bg-coco-gold-500` | PRD-REQ-004 (spec-mandated); Open Q1 → gold-500 |
| ProductDetailView | checklist item text (L2511) | `text-[#4b5563] dark:text-gray-300` | `text-coco-neutral-700 dark:text-coco-neutral-300` | PRD-REQ-002 |
| ProductDetailView | checklist undone bg (L2515) | `border-default bg-[#f3f3f1] dark:bg-[#1f1f24]` | `border-coco-neutral-200 dark:border-coco-neutral-800 bg-coco-neutral-100 dark:bg-coco-neutral-900` | PRD-REQ-002; done emerald state UNCHANGED |
| ProductDetailView | 6 modal "Guardar" + "Guardar lote" + variant submit (L2583,2717,2793,2866,2907,2959,3043) | no `color`, no class | (identical Cobrar class) | PRD-REQ-001/003 |
| ProductUpsertSlideover | "ir al editor completo" link (L276) | `font-medium text-primary hover:underline` | `font-medium text-coco-gold-800 dark:text-coco-gold-400 hover:underline` | PRD-REQ-004; 14px link → gold-800 |
| ProductUpsertSlideover | footer submit (L289-294) | no `color`, no class | (Cobrar class) | PRD-REQ-003 |
| ProductImageGallery | scope tab active (L225) | `:color="... ? 'primary' : 'neutral'"` | `:color="... ? 'primary' : 'neutral'" :class="activeScope===opt.value ? '!bg-coco-gold-500/15 !text-coco-gold-800 dark:!text-coco-gold-300' : ''"` | PRD-REQ-001; filter toggle → soft gold (not CTA) |
| ProductImageGallery | dropzone idle hover (L245) | `hover:border-primary/50 hover:bg-primary/5` | `hover:border-coco-gold-500/20 hover:bg-coco-gold-500/5` | PRD-REQ-004 (spec-mandated) |
| ProductImageGallery | dropzone drag-over (L244) | `border-solid border-primary bg-primary/10` | `border-solid border-coco-gold-500 bg-coco-gold-500/10` | PRD-REQ-004 (spec-mandated) |
| ProductImageGallery | dropzone idle base (L245) | `border-dashed border-default bg-default` | (KEEP — resolves to coco-neutral via theme; PRD-REQ-005 surface list does not include dropzone) | Minimal-scope interpretation |
| ProductImageGallery | drag-over icon (L255) | `text-primary` | `text-coco-gold-700 dark:text-coco-gold-400` | PRD-REQ-004 |
| ProductImageGallery | "Subiendo a:" pill bg (L261) | `bg-primary/10` | `bg-coco-gold-500/10` | PRD-REQ-004 |
| ProductImageGallery | "Subiendo a:" icon (L262) | `text-primary` | `text-coco-gold-700 dark:text-coco-gold-400` | PRD-REQ-004 (icon) |
| ProductImageGallery | "Subiendo a:" text (L263) | `text-primary` | `text-coco-gold-800 dark:text-coco-gold-400` | PRD-REQ-006; 12px text → gold-800 |
| ProductImageGallery | spinners (L274, L282) | `text-primary` | `text-coco-gold-700 dark:text-coco-gold-400` | PRD-REQ-004; graphical, gold-700 passes 3:1 on light |
| ProductImageGallery | image card hover (L311) | `hover:border-primary/30` | `hover:border-coco-gold-500/30` | PRD-REQ-004; matches ProductCard hover |
| ProductImageGallery | main-image ring (L312) | `ring-primary` | `ring-coco-gold-500` | PRD-REQ-001/004 |
| ProductImageGallery | "Principal" badge (L317-320) | `bg-primary ... text-white` | `bg-coco-gold-500 ... text-black` | Cobrar precedent; white on gold-500 fails contrast, black passes |
| ProductImageGallery | star buttons ×3 (L358,370,445) | `color="warning" variant="solid/ghost"` | `color="primary" class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"` (keep `size`/`variant`/`icon`/`:loading`/`disabled`) | PRD-REQ-003 Cobrar |
| CategorySelect | trigger focus ring (L127) | `focus:ring-primary` | `focus:ring-coco-gold-500` | PRD-REQ-001 (primary-family token) |
| CategorySelect | action item "Crear categoría" (L182) | `text-primary` | `text-coco-gold-800 dark:text-coco-gold-400` | PRD-REQ-004; 14px → gold-800 |
| CategorySelect | checkmark (L206) | `text-primary` | `text-coco-gold-700 dark:text-coco-gold-400` | PRD-REQ-004 (spec-mandated); 20px icon → graphical 3:1 |
| SatKeySelect | trigger focus ring (L160) | `focus:ring-primary` | `focus:ring-coco-gold-500` | PRD-REQ-001 |
| SatKeySelect | checkmark (L261) | `text-primary` | `text-coco-gold-700 dark:text-coco-gold-400` | PRD-REQ-004 |
| PriceListSection | "Agregar Lista de Precios" link (L583-591) | `color="primary" variant="link"` | `variant="link" class="text-coco-gold-800 dark:text-coco-gold-400"` (drop `color`) | PRD-REQ-001; 14px link → gold-800 |
| PriceListSection | modal submit "Guardar cambios"/"Crear lista" (L696-701) | no `color`, no class | (Cobrar class) | PRD-REQ-003 |
| PriceListSection | tier modal "Guardar" (L779-784) | no `color`, no class | (Cobrar class) | PRD-REQ-003 |
| VariantImagePickerModal | dropzone idle (L190) | `border-dashed border-default bg-default` | (KEEP — coco-neutral via theme) | Minimal scope |
| VariantImagePickerModal | dropzone drag-over (L189) | `border-solid border-primary bg-primary/10` | `border-solid border-coco-gold-500 bg-coco-gold-500/10` | PRD-REQ-004 |
| VariantImagePickerModal | drag-over icon (L200) | `text-primary` | `text-coco-gold-700 dark:text-coco-gold-400` | PRD-REQ-004 |
| VariantImagePickerModal | spinner (L213) | `text-primary` | `text-coco-gold-700 dark:text-coco-gold-400` | PRD-REQ-004 |
| VariantImagePickerModal | main-image ring (L237) | `ring-primary` | `ring-coco-gold-500` | PRD-REQ-001/004 |
| VariantImagePickerModal | star button (L272) | `color="warning" variant="ghost"` | `color="primary" class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"` | PRD-REQ-003 Cobrar |
| VariantImagePickerModal | variant-name footer (L264) | `text-xs text-muted` | (KEEP `text-muted` — already coco-neutral; Open Q4 → neutral) | Minimal scope; lets chooser card carry brand |

**Deliberate non-changes** (decorative/semantic, NOT brand leaks, no PRD-REQ covers them): `ProductCard` category dot `bg-violet-500` (L105, DotBadge dot-class); `ProductDetailView` type/POS/Online badges `bg-gray-*`/`bg-emerald-*`/`bg-blue-*` (L2450-2456, status tags); checklist `done` emerald state (L2515, PRD-REQ-002 explicitly preserves); `ProductUpsertSlideover` "Más Opciones" box `bg-elevated/30` (L270, resolves to coco-neutral).

## Hex-to-Coco Mapping (ProductDetailView)

| Hex | Coco token | Visual context | Rationale |
|---|---|---|---|
| `#f7f7f5` | `coco-neutral-50` | page bg (L1643), stripe light tone A (L2430) | Lightest warm gray → lightest coco-neutral |
| `#0a0a0b` | `coco-neutral-950` | page bg dark (L1643) | Near-black → darkest coco-neutral |
| `#131316` | `coco-neutral-950` | sticky header dark (L1644), preview card dark (L2429), checklist card dark (L2494) | Near-black surface → coco-neutral-950 (consistent with dashboardPanel body) |
| `#111316` | `coco-neutral-950` | h1/h2/price/cost/h3 text (L1655,2446,2465,2471,2496) | Near-black text → darkest text token; `dark:text-white` retained |
| `#f0954a` | Cobrar `--brand-action` / `coco-gold-500` | main submit button (L1673), completion-bar fill (L2503) | Button → Cobrar precedent; fill → spec-mandated gold-500 (graphical object) |
| `#d97a2a` | `coco-gold-700` (stock) / `coco-gold-800` (count) | preview stock (L2486), checklist count (L2497) | Stock = 18px bold large text → gold-700 (spec-mandated, 3:1); count = 14px → gold-800 (PRD-REQ-006 AA) |
| `#ebebe8` | `coco-neutral-100` | progress track light (L2502) | Light gray track → coco-neutral-100 |
| `#1f1f24` | `coco-neutral-900` | stripe dark tone B (L2430), track dark (L2502), undone bg dark (L2515) | Mid-dark surface → coco-neutral-900 |
| `#f3f3f1` | `coco-neutral-100` | undone checklist bg light (L2515) | Light gray → coco-neutral-100 |
| `#4b5563` | `coco-neutral-700` | checklist item text (L2511) | Mid slate gray → coco-neutral-700 |
| `#18181c` | `coco-neutral-950` | stripe dark tone A (L2430) | Darkest stripe tone → coco-neutral-950 (paired with 900 for 2-tone) |
| `#eeeeea` | `coco-neutral-100` | stripe light tone B (L2430) | Light gray stripe → coco-neutral-100 (paired with 50 for 2-tone) |
| `#e88835` (not in forbidden-12) | eliminated by Cobrar | main submit hover (L1673) | Replaced wholesale by `hover:!brightness-110` |

## Dark/Light Mode Strategy

- **Dark surface**: `coco-neutral-950` (`#16121a`); **Light surface**: `coco-neutral-50` (`#f5f4f6`) — both in `main.css` `@theme` (L21, L31). Light-first base + `dark:` override (project convention, matches `SaleTotalsFooter`).
- **SDD-5 WCAG AA lesson applied**: `coco-gold-700` (`#aa7e0d`) on `coco-neutral-50` = **3.40:1** — fails AA 4.5:1 for normal text.
  - **14px text** (checklist count L2497, "ir al editor completo" link L276, CategorySelect action item L182, "Subiendo a:" badge text L263, PriceListSection "Agregar" link L587) → **`text-coco-gold-800`** (`#745609`, ≈6.3:1 on light, passes AA). Dark side: `text-coco-gold-400`.
  - **≥18px bold or 20px+ graphical objects** (preview stock L2486 18px bold = large text 3:1; checkmark icons 20px; spinners; completion-bar fill) → **`text-coco-gold-700`** / `bg-coco-gold-500` (3:1 non-text contrast 1.4.11 satisfied). Dark side: `text-coco-gold-400`.
  - Spec PRD-REQ-004 explicitly mandates `text-coco-gold-700 dark:text-coco-gold-400` for checkmarks and preview stock — followed verbatim (both are graphical/large, AA-safe).
  - Spec PRD-REQ-006 mandates gold-800 "only for 14px text" — followed for every 14px gold text instance above.
- **Cobrar buttons**: `!text-black` on `--brand-action` (`#f6bb13`) ≈ **9.6:1** — passes AA in both modes. Identical class in light and dark (no `dark:` variant needed).
- **"Principal" badge** (ProductImageGallery L317): `text-white` on gold-500 ≈ 1.8:1 FAILS → switched to `text-black` (matches Cobrar, ≈9.6:1).

## Cobrar Precedent — Verbatim Copy

From `SaleTotalsFooter.vue` L126 (canonical):

```html
<UButton color="primary" block size="xl" :loading="isChargePending" :disabled="isChargeDisabled"
  class="relative !bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"
  @click="emit('charge-click')">
```

Static class string (copied verbatim by every target next-action button; `relative` is Cobrar-specific for its absolute trailing `UKbd` and is OMITTED):

```
!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm
```

`SaleTotalsFooter` uses NO dynamic `:class` on the Cobrar button — the static `class` above is the full override. `color="primary"` is retained as semantic fallback (maps to `coco` per `vite.config.ts` L58 `colors.primary: 'coco'`) and visually overridden by `!bg-`/`!text-`. Each target button keeps its own `:disabled` / `:loading` / `type` / `form` / `icon` / `size` / `data-testid` / `@click` bindings untouched — those props are independent of the class override. The star buttons (ProductImageGallery, VariantImagePickerModal) additionally retain `icon` and drop `color="warning"` (replaced by `color="primary"` + Cobrar class per PRD-REQ-003).

## Round-Trip Test Selector Updates

Test stub audit (which `UButton` stubs forward `$attrs` → class assertions work):

| Test file | UButton stub | Class assertions on UButton? |
|---|---|---|
| ProductImageGallery.test.ts | `<button class="u-button"><slot/></button>` (no `$attrs`) | FAIL — upgrade to `v-bind="$attrs"` |
| ProductDetailView.test.ts | forwards `data-testid` only, NOT `class` (L123) | FAIL — use `wrapper.html()` substring OR upgrade stub |
| ProductCard.test.ts | `<button><slot/></button>` (no `$attrs`) | FAIL — N/A (no Cobrar button in ProductCard) |
| ProductsView.test.ts | `<button><slot/></button>` (no `$attrs`) | FAIL — use `wrapper.html()` substring for modal "Guardar" |
| ProductsView.satKeyError.test.ts | same | FAIL — N/A (sat-key path, no class pin) |
| VariantImagePickerModal.test.ts | (verify on apply) | use `wrapper.html()` substring for star button |
| SatKeySelect.test.ts | (verify on apply) | checkmark is plain `<UIcon>` inside `<button>` — assert via `wrapper.html()` contains `text-coco-gold-700` |

**Mandatory selector rewrites (PRD-REQ-008)** — `ProductImageGallery.test.ts`:
- L55 `describe('Dropzone primary affordance', ...)` → **`describe('Dropzone coco gold affordance', ...)`**
- L99 `it('should apply border-solid and border-primary on drag-over state', ...)` → **`it('should apply border-solid and border-coco-gold-500 on drag-over state', ...)`**; replace the placeholder body (L107 `expect(dropzone.html()).toBeTruthy()`) with a real assertion: drive `isOverDropZone=true` via the `useImageUpload` mock (or assert the rendered class binding contains `border-coco-gold-500` in `wrapper.html()`).
- L62-63 idle assertions (`border-dashed`, `border-default`, `bg-default`) — UNCHANGED (idle base kept; PRD-REQ-004 hover tokens are `hover:`-prefixed, present in class list).
- All other behavior assertions (props, emits, URL-input-removed, no-drag-reorder, empty state, placeholders) — UNCHANGED.

**New class-pinning assertions (PRD-REQ-003/004)** — minimal, one per component, via `wrapper.html()` substring (robust against stub non-forwarding) or `.classes()` on plain elements:

| Test file | New assertion |
|---|---|
| ProductImageGallery.test.ts | `[data-dropzone]` `.classes()` contains `hover:border-coco-gold-500/20`; star button `wrapper.html()` contains `bg-(--brand-action)` |
| ProductCard.test.ts | `<article>` `.classes()` contains `bg-coco-neutral-50` and `hover:border-coco-gold-500/30` |
| ProductCardGrid.test.ts | skeleton `.classes()` contains `bg-coco-neutral-100` |
| ProductsView.test.ts | section `.classes()` contains `bg-coco-neutral-50`; modal "Guardar" `wrapper.html()` contains `bg-(--brand-action)` |
| ProductDetailView.test.ts | page bg `.classes()` contains `bg-coco-neutral-50`; completion bar `wrapper.html()` contains `bg-coco-gold-500`; main submit `wrapper.html()` contains `bg-(--brand-action)` |
| VariantImagePickerModal.test.ts | dropzone `wrapper.html()` contains `border-coco-gold-500`; star button `wrapper.html()` contains `bg-(--brand-action)` |
| SatKeySelect.test.ts | checkmark `wrapper.html()` contains `text-coco-gold-700` |

All existing behavior assertions (props, emits, computed state, `data-testid`, `aria-label`, focus order, mutation wiring) unchanged across all suites.

## Rollout & Work-Unit Commit Plan

Single branch, no PRs (per user — merge to main manually at end). 7 commits, each independently buildable and revertible. `pnpm build` + `pnpm test:unit --run` after each.

1. **`feat(products): coco-ize ProductCard hover + surface`** — `ProductCard.vue` only. Article `bg-coco-neutral-50/950 border-coco-neutral-200/800`, hover `border-coco-gold-500/30` (Open Q3). Smallest, anchors the card pattern.
2. **`feat(products): coco-ize ProductCardGrid skeleton`** — `ProductCardGrid.vue` only. Skeleton `bg-coco-neutral-100/900 border-coco-neutral-200/800`. Depends on commit 1's card visual. **VISUAL REVIEW CHECKPOINT here** (light + dark, card grid) — same pattern as SDD-5/6.
3. **`feat(products): coco-ize ProductUpsertSlideover + CategorySelect + SatKeySelect`** — 3 small form components. "ir al editor completo" link gold-800, footer submit Cobrar, checkmarks gold-700/400, focus rings gold-500, action item gold-800. Form-pattern batch.
4. **`feat(products): coco-ize ProductImageGallery dropzone + star buttons`** — `ProductImageGallery.vue` only (heaviest dropzone). Dropzone gold affordance, "Subiendo a:" pill, spinners, ring, "Principal" badge text-black, 3 star buttons Cobrar, scope-tab soft gold. Self-contained blast radius.
5. **`feat(products): coco-ize VariantImagePickerModal + PriceListSection`** — 2 variant/price components. Dropzone gold, star button Cobrar, price-list link gold-800, 2 modal "Guardar" Cobrar.
6. **`feat(products): coco-ize ProductDetailView hex migration + CTAs`** — `ProductDetailView.vue` only (largest, last). 12 hexes → coco tokens across 4 surfaces (page/header/preview/checklist), striped placeholder gradient vars, completion-bar fill gold-500, 8 Cobrar buttons (main submit + 7 modal "Guardar"), "Agregar" soft gold, "Agregar Lista" gold link. Blast radius isolated to one commit so a revert restores the entire detail view at once.
7. **`feat(products): coco-ize ProductsView section + modal Guardar`** — `ProductsView.vue` only. Section surface coco-neutral, header border, 2 modal "Guardar" Cobrar. ("Nuevo Producto" deferred — AppDataTable out of scope.)
8. **`test(products): pin coco tokens + rename dropzone suite`** — 7 test files. Mandatory `ProductImageGallery.test.ts` rename (PRD-REQ-008) + `border-coco-gold-500` assertion + UButton stub `v-bind="$attrs"` upgrade; add class-pinning assertions per table above. Tests land after the code they guard; one commit makes the regression contract reviewable as a unit.

**Order rationale**: smallest→largest, visual-review checkpoint after the card pair (commit 2) before the form/dropzone/detail blast radius; ProductDetailView (commit 6) isolated as the single biggest brand-leak risk; ProductsView (commit 7) last among components because its only class changes are the section wrapper + 2 modal buttons (low risk, quick); test contract (commit 8) last so RED→GREEN is observable per the work-unit-commits convention.

## Risk Mitigation

- **Light-mode coco-gold-700 (3.4:1 AA fail)** — resolved: `coco-gold-800` for every 14px gold text (checklist count, "ir al editor" link, CategorySelect action item, "Subiendo a:" badge text, PriceListSection link); gold-700 only for 18px+ bold / 20px+ graphical objects (stock number, checkmark icons, spinners). Documented in §4. Spec PRD-REQ-004/006 followed verbatim.
- **ProductDetailView blast radius (12 hexes across 4 surfaces)** — isolated to commit 6; a single missed swap = brand leak. Mitigation: commit 8 test contract pins `bg-coco-neutral-50` on page bg, `bg-coco-gold-500` on completion bar, `bg-(--brand-action)` on main submit; visual review after commit 6 walks all 4 surfaces (header, preview card, checklist card, striped placeholder) in light + dark.
- **Dropzone drag-over semantics** — gold drag-over tint must read as gesture, not CTA. Mitigation: drag-over uses `border-coco-gold-500 bg-coco-gold-500/10` (translucent tint + border), NOT the solid Cobrar `--brand-action` fill. The Cobrar solid gold is reserved for buttons only. Visual review verifies the dropzone doesn't look like a gold button on drag-over.
- **Test selector fragility** — pin stable tokens (`bg-(--brand-action)`, `bg-coco-neutral-50`, `border-coco-gold-500`, `text-coco-gold-700`) via `.toContain(...)` or `wrapper.html()` substring; never full class strings or opacity-suffixed combinations Tailwind may reorder. The `border-coco-gold-500/20` hover assertion uses `.toContain` on the class list (the `/20` is part of the token, stable).
- **Visual regression of daily-use area** — ProductsView list + ProductCard grid are reopened many times/shift. Visual review after commit 2 (light + dark) before proceeding. Rollback = `git revert` (visual-only, no API/data-shape changes).
- **AppDataTable "Nuevo Producto" button (shared, out of scope)** — PRD-REQ-007 forbids touching `AppDataTable`. The "Nuevo Producto" CTA is rendered by `AppDataTable` via the `add-button-text` prop (ProductsView L657), NOT by ProductsView itself. **Deferred**: cannot Cobrar-ize without an `AppDataTable` change (separate SDD). If `AppDataTable` exposes an add-button class prop, a future task could pass the Cobrar class from ProductsView without modifying the shared component — verify during apply; otherwise leave as-is and document. This is a known, accepted brand-leak point isolated to one button.
- **Public catalog (`src/features/catalog/`) NOT POS** — explicitly untouched (PRD-REQ-007). Separate customer-facing light-first design; SDD-8+ candidate. No change.
- **SDD-6 sales files (13), `main.css`, `vite.config.ts`** — diff empty (PRD-REQ-007).
- **"Editar producto" / "Publicar" literal labels not found** — the proposal names these Cobrar targets, but the actual edit-mode submit label is "Guardar cambios" (ProductUpsertSlideover L290, ProductDetailView L1668), and no "Publicar" button exists in the 10 target files. The Cobrar treatment applies to the actual submit buttons present ("Crear producto", "Guardar cambios", all modal "Guardar", "Guardar lote", "Guardar variante"). No action skipped — the proposal's labels were loose; the spec PRD-REQ-003 (authoritative) names "Crear producto"/"Guardar cambios"/"Guardar"/star buttons, all covered.

## Migration / Rollout

No migration. No feature flags. Single-branch merge to main per user preference (no PRs, no chained PRs — solo dev). Rollback = `git revert` the merge commit. Visual-only token substitution; no API or data-shape changes.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Pure class-level Vue SFC edits.

## Open Questions (Resolved)

### Q1: ProductDetailView completion-bar fill — `coco-gold-500` or `coco-gold-600`?
**Recommendation: `coco-gold-500`** (`#f6bb13` = `--brand-action`).
Why: spec PRD-REQ-004 mandates `bg-coco-gold-500` verbatim. `coco-gold-500` ties the progress bar to the same brand color as the Cobrar CTA — "brand-as-progress" reads as "you're advancing toward a Cobrar action". `coco-gold-600` (`#d6a010`) would introduce a second gold shade not used elsewhere in the surface and diverge from the Cobrar anchor. The bar is a 20px+ graphical object (8px-tall fill, `h-2`) → WCAG 1.4.11 non-text 3:1 applies, not text 4.5:1; gold-500 on coco-neutral-100 track satisfies 3:1.
Implementation: `ProductDetailView.vue` L2503 `bg-[#f0954a]` → `bg-coco-gold-500`.

### Q2: Dropzone drag-over gold tint — `coco-gold-500/10` or `coco-gold-500/20`?
**Recommendation: `coco-gold-500/10`** (translucent fill) + **`border-coco-gold-500`** (solid border).
Why: spec PRD-REQ-004 mandates `border-coco-gold-500 bg-coco-gold-500/10` for drag-over verbatim. `/10` matches the list-item hover translucency (gesture-like, not CTA-like — see Risk Mitigation); `/20` would approach the solid Cobrar button fill and risk reading as a gold CTA. The solid `border-coco-gold-500` carries the affordance signal; the `/10` fill is the gesture tint.
Implementation: `ProductImageGallery.vue` L244 + `VariantImagePickerModal.vue` L189 → `border-solid border-coco-gold-500 bg-coco-gold-500/10`.

### Q3: ProductCard hover border — `coco-gold-500/30` or `coco-gold-500/50`?
**Recommendation: `coco-gold-500/30`**.
Why: matches the row-folio link precedent (SDD-6 `hover:border-primary/30` → `hover:border-coco-gold-500/30` equivalence) and the ProductImageGallery image-card hover (L311, kept consistent). `/50` would make every card in a 4-column grid glow brightly on hover — visually noisy on the daily-use list. `/30` is a perceptible-but-subtle gesture. On `coco-neutral-950` dark, `/30` of gold-500 remains visible (gold-500 is high-luminance `#f6bb13`); verified during the commit-2 visual checkpoint.
Implementation: `ProductCard.vue` L63 `hover:border-primary/30` → `hover:border-coco-gold-500/30`.

### Q4: VariantImagePickerModal variant-name font-mono color — `coco-gold-700` or `coco-neutral-100`?
**Recommendation: `coco-neutral-100` (neutral — KEEP `text-muted`)**.
Why: the variant name (L264 `text-xs text-muted`) is a metadata label, not an affordance. Making it gold would double-up brand color inside a modal that already carries gold on the dropzone, the star button (Cobrar), and the main-image ring — gold fatigue. Letting the chooser card (image + badge) carry the brand color while the name stays neutral preserves hierarchy. `text-muted` already resolves to coco-neutral-500/400 (AA-safe). This also avoids a 12px gold text AA problem (would need gold-800, further muddying the palette).
Implementation: no change to L264 — `text-xs text-muted` retained. (Listed in the substitution table as a deliberate KEEP.)

## Open Questions

None remaining — all four proposal open questions resolved above with a committed recommendation and implementation path. User will visually iterate post-apply; the design commits to ONE choice per question as required.
