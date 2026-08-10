# Sales Screen UI Redesign — Visual Diff Report (multimodal → text)

> **Purpose**: This document is a translator artifact produced by a multimodal
> model. It captures, in plain text, every visual and structural difference
> between the **current** sales creation screen (Image 1) and the **reference**
> screen (Image 2). It is intended to be consumed by a non-multimodal coding
> model that will plan and implement the changes.
>
> - **Image 1 (CURRENT)**: `frontend-houndfe` at `/pos/ventas/nueva` —
>  `src/features/POS/sales/views/SalesView.vue` (light theme, laptop viewport)
> - **Image 2 (REFERENCE)**: externally provided inspiration design (dark
>  theme, desktop viewport)
>
> **Scope (per user)**: desktop laptop viewports only. Mobile (FAB +
> bottom slideover) is already correct and is **out of scope**.

---

## 0. User-stated issues (verbatim from user)

1. The right-side cart card looks **too small** on laptop screens.
2. There is a **content peeking / overflow** in the price-list selector
   inside the cart header.
3. The **ratio** between the products card and the cart card should be
   re-tuned for laptops: cart **a bit larger**, products **a bit smaller**.
4. Mobile (FAB + slideover) is fine — do not touch.
5. Ultra-wide is fine — do not touch.

---

## 1. Layout & grid — current vs target

### 1.1 Current two-column split (`SalesView.vue` lines 714–758)

```
Split container:  flex-1 flex flex-col lg:flex-row w-full min-h-0
Left  column:     lg:w-[67%]  xl:w-[75%]   (catalog)
Right column:     lg:w-[33%]  xl:w-[25%]   (cart, hidden <lg)
Skeleton mirror:  SalesView.vue lines 655, 673 — same percentages
Inner card:       h-full rounded-2xl border border-default/50 overflow-hidden
Padding:          px-3 lg:px-4 pt-1.5 lg:pt-2 pb-3 lg:pb-4
```

There is **no `md:` breakpoint** on the split itself — it flips at `lg`
(1024 px). On `<lg` the cart is hidden and only reachable via the mobile FAB
+ bottom slideover (`USlideover side="bottom" h-[90vh]`).

There is also a **router test** that hard-pins these widths
(`src/features/POS/sales/views/__tests__/SalesView.test.ts` lines 874–880):

```ts
expect(html).toContain('lg:w-[67%]')
expect(html).toContain('lg:w-[33%]')
expect(html).toContain('xl:w-[75%]')
expect(html).toContain('xl:w-[25%]')
expect(html).not.toContain('lg:w-[60%]')
expect(html).not.toContain('lg:w-[40%]')
```

Any new widths must update this test or the assertion strategy must change.

### 1.2 Product card grid (inner — `ProductSearchResults.vue` line 57)

```
grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 gap-4
```

This is the catalog's inner grid. The reference (Image 2) keeps 4 columns
visible at the same breakpoint but with **larger cards** because the
catalog column itself gets narrower.

### 1.3 Target split (proposed — derived from Image 2)

The reference clearly favors a narrower catalog + wider cart on laptops.
Suggested breakpoints (do not commit yet — awaiting implementation):

```
Left  column:     lg:w-[60%] xl:w-[62%] 2xl:w-[68%]
Right column:     lg:w-[40%] xl:w-[38%] 2xl:w-[32%]
```

Rationale: on a typical 1280–1440 px laptop the reference cart reads at
~460–500 px (proportional to a 4:6 split), while the current 25–33 %
split produces a ~340–420 px cart that looks cramped and leaves the
`activeDraft.items[0]` thumbnail + price column fighting for space.

> The reference is dark; the colors below are described in **relative
> terms** — the user did not ask to change the theme. Implementation should
> keep the current light theme unless explicitly told otherwise.

---

## 2. Cart header (`ActiveSalePanel.vue` lines 206–231 + `PriceListSelector.vue`)

### 2.1 Current structure

```html
<section data-testid="cart-header"
         class="shrink-0 flex flex-col md:flex-row md:items-center md:gap-2 md:px-2 md:py-2">
  <div class="...md:shrink-0">              <!-- Group 1: Venta/Pedido UTabs -->
    <UTabs :items="[{key:'venta',label:'Venta',icon:'i-lucide-shopping-bag',content:false},
                    {key:'pedido',label:'Pedido',icon:'i-lucide-clipboard-list',content:false,disabled:true}]"
           :model-value="'venta'" class="w-auto" />
  </div>
  <div class="hidden md:block md:flex-1" aria-hidden="true">  <!-- spacer -->
  <div class="...md:shrink-0">              <!-- Group 2: PriceListSelector -->
    <PriceListSelector ... />
  </div>
</section>
```

### 2.2 Price-list selector (the content-peeking bug)

`PriceListSelector.vue` lines 128–164 renders:

```html
<div class="flex items-center gap-2" data-testid="price-list-selector">
  <div data-testid="price-list-active-label"
       class="flex items-center gap-1 text-xs text-muted shrink-0 whitespace-nowrap">
    <UIcon name="i-lucide-tags" class="size-3.5" />
    <span>Lista: <strong>{{ activeListName }}</strong></span>
  </div>
  <UInputMenu :items="menuItems" placeholder="Cambiar lista" value-key="value"
              data-testid="price-list-menu" @update:model-value="handleUpdate" />
</div>
```

**Visible bug** (matches user description):
- The label block uses `shrink-0 whitespace-nowrap` (correct), but the
  `UInputMenu` next to it has **no `shrink-0` / `max-w` / width constraints**.
- When the cart column is narrow (≤25–33 % of a laptop viewport), the
  `<UInputMenu>` triggers the dropdown's trigger to expand horizontally
  past the visible area, and the visible trigger text shows the **bound
  value** (`PUBLICO`) instead of the placeholder (`Cambiar lista`), which
  reads as text leaking outside the field — the "content peeking".
- Image 1 shows the trigger literally rendering `PUBLIC` (truncated label of
  the selected sentinel value) clipped against the right edge of the cart.

**Fix candidates**:
- Wrap the two children in a layout that lets the dropdown shrink (`flex-1
  min-w-0` on the menu + `shrink-0` on the label).
- Or unify the label + dropdown into a single pill component (Image 2
  pattern: a bordered pill showing `PUBLICO` + a chevron, opening the same
  menu on click).
- Or give the `UInputMenu` a fixed `min-w-[140px] max-w-[180px]` so it
  stops competing with the label for horizontal space.

### 2.3 Reference structure (Image 2 — cart header)

- Single bordered pill on the right: `<icon tags /> PUBLICO ▾` — the
  *label* and the *dropdown trigger* are merged into one bordered control.
- The trash icon sits flush-right inside the same header row.
- The `Venta / Pedido` tab toggle is rendered as a solid filled pill
  (`Venta` selected in primary blue) on the left, with `Pedido` shown as
  an outlined pill next to it — visually different from the current
  `UTabs` underline-render.

### 2.4 Tab toggle differences

| Aspect | Current (`UTabs`) | Reference (Image 2) |
|---|---|---|
| Render style | Underline tabs (Nuxt UI default) | Filled pill (selected) + outline pill (unselected) |
| Selected color | Primary underline | Solid primary background, white text |
| Pedido state | `disabled: true` (visually dimmed) | Same — but the icon still visible, not greyed |
| Mounting | Inside `ActiveSalePanel`, in `cart-header` | Same position |

---

## 3. Cart body — items (`SaleItemRow.vue`)

### 3.1 Current row layout (lines 204–348)

```
┌──────────────────────────────────────────────────────────────┐
│ [thumb 48px]  productName (bold, truncate)         $unit  │
│               variant · $strike $price c/u        desc%  │
│               [qty] [trash] [⋮]                    net$   │
│               [BADGES inline]                     $strike  │
└──────────────────────────────────────────────────────────────┘
mx-3 mb-2 rounded-xl border border-default hover:bg-elevated/40
px-3 py-2
```

Three columns: thumbnail (left, `h-12 w-12` ~48 px square), center stack
(name → specs line → qty row → optional badge row), right stack (unit →
discount → net → optional struck gross). The right column is
`min-w-[64px]`.

The thumbnail has two visual states:
- `imageUrl` exists + not broken → `bg-elevated border border-default` +
  `<img object-cover>`.
- `imageUrl` missing or `imageBroken` → `bg-primary/8 border
  border-primary/15` + `<UIcon i-lucide-package />`.

In Image 1, the `Croqueta` row renders the memoji thumbnail at large size
because the variant image is wide. In Image 2 the thumbnail is small and
the visual emphasis is on the **badges** below the name.

### 3.2 Reference row layout (Image 2)

```
┌──────────────────────────────────────────────────────────────┐
│ [thumb  small]  Ibuprofeno 400mg                  $100.00  │
│                 Rojo · $100.00 c/u                  $90.00  │
│                 [chip: Descuento -10%]  [chip: Promo chica] │
│                                          [− 1 +]            │
└──────────────────────────────────────────────────────────────┘
```

Differences:
- Thumbnail is smaller (~36–40 px), less dominant.
- **Badges are rendered as colored chips** (`Descuento -10%`,
  `Promo chica`) with success-tone borders. The current implementation
  uses `AppBadge` (success tone) inside an inline flex-wrap — same shape,
  but the reference makes them more visually present (visible by default
  for any line that has a discount OR an applied promotion).
- Stepper position: in current it sits in the **center column** under the
  specs line; in the reference it sits at the **right side**, aligned with
  the price stack.
- Struck-through original price is rendered in a **subtle muted grey**
  above the net price (Image 2) vs. the current implementation, which
  renders the gross strike only when `lineDisplay.showStruckGross` is
  true and at the bottom of the right stack — order of magnitude is the
  same but visual weight differs.

### 3.3 qty stepper (`SaleItemRow.vue` lines 252–271)

Current:

```html
<UInputNumber v-model="localQty" size="xs" :min="1" :disabled="isUpdating"
              @blur="handleQtyCommit" @change="handleQtyCommit" />
<UButton icon="i-lucide-trash-2" size="xs" color="neutral" variant="ghost"
         @click="void props.onRemoveItem?.(props.item.id)" />
<UDropdownMenu :items="itemActions">
  <UButton size="xs" color="neutral" variant="ghost"
           icon="i-lucide-ellipsis-vertical" />
</UDropdownMenu>
```

These three controls sit in the **center column** under the specs line.
Reference moves them to the **right column** (or to a new bottom row that
spans the full width). The trash icon stays inline.

### 3.4 Inline badges (`SaleItemRow.vue` lines 274–320)

Current renders inline when `inlineHasAnyBadge` is true. The four badge
types computed are:
- `inlinePriceSourceBadge` (info/warning tone)
- Promotion badge (info tone, with `x` to remove via `remove-promo` emit)
- Discount badge (success tone, with optional `UTooltip`)
- Reward badge (success tone)

Reference image shows **two** badges (Descuento -10% + Promo chica) in
the same row, with success-tone border + transparent fill (not the
current solid `AppBadge` style). The reference may be using a Nuxt UI
`UBadge color="success" variant="subtle"` rather than the custom
`AppBadge` — `AppBadge` source would need to be inspected to confirm
whether it currently supports a `subtle` / outlined variant.

---

## 4. Cart footer (`ActiveSalePanel.vue` lines 277–379 + `SaleTotalsFooter.vue`)

### 4.1 Customer slot (lines 279–328)

Current when no customer:

```html
<span class="text-muted">Cliente:</span>
<span class="text-muted">Sin asignar</span>
<UButton data-testid="assign-customer-trigger" variant="link" color="primary"
         size="xs" label="Asignar cliente" @click="emit('open-customer-assignment')" />
```

Reference (Image 2):

```
Cliente                              Sin asignar    [Asignar]
─────────────────────────────────────────────────────────────
```

The reference uses a **bordered row** (`Cliente | Sin asignar | [Asignar]`)
with the `Asignar` rendered as a **solid dark primary button**, not a
link. This is more visually prominent and matches a POS cashier's mental
model (assign customer = primary action when missing).

Current when customer is assigned uses `text-sm font-medium` name +
`text-xs text-muted` address line + `Cambiar` / `Quitar` link buttons
aligned right — visually correct, no change needed.

### 4.2 `PromocionesFlatList` (lines 334–341)

Current:

```html
<PromocionesFlatList v-if="(applicablePromotions?.length ?? 0) > 0"
                     :promotions="..." :loading="..." :applied-ids="..."
                     @apply="..." @remove="..." />
```

Reference shows the promotions row as a single **accordion trigger** with
the label `Promociones disponibles` and a numeric badge `2` on the right:

```
Promociones disponibles                                 2
```

The accordion expands to show individual promotion items. Current
implementation already uses `PromocionesFlatList` (the alternative
`PromocionesDisponiblesAccordion.vue` exists but is not the one mounted
by default — `ActiveSalePanel` chooses `PromocionesFlatList`). The
**shape** in the reference is the accordion variant.

The reference's badge `2` is rendered in a primary-tone pill aligned
right of the row label — same pattern used for category chip counts
(`Todo 5`, `Todo 6` in both images).

### 4.3 Cart actions toolbar (lines 344–368)

Current renders `trash` + `⋮` (`UDropdownMenu` → `moreMenuItems`).

Reference image does not show this toolbar in the cropped viewport, but
the same items may still be present lower in the panel. No actionable
change here.

### 4.4 `SaleTotalsFooter.vue` lines 64–141

Current order:

```
N Artic · N Unidad     ← count line
Subtotal           $800.00
[Descuentos  −$X]  ← only if hasDiscounts
USeparator
TOTAL A COBRAR   $800.00   ← 2xl extrabold white text
[order-promo row] ← only if applied
[Cobrar F8 button] ← block size xl yellow brand-action
```

Reference order (Image 2):

```
Subtotal           $100.00
[Descuentos  −$10.00]   ← success-tone row always visible when applied
─────────────────────────────────────
TOTAL A COBRAR
1 linea · 1 unidad                  $90.00
[order-promo row]   ← green row
[Cobrar F8 button]   ← yellow, with credit-card icon (not hand-coins)
```

Differences:
- Reference puts the `1 linea · 1 unidad` count **under** the `TOTAL A
  COBRAR` label, not above the subtotal. (Wording change: `1 Artic · 1
  Unidad` → `1 linea · 1 unidad`.)
- Reference always shows the descuentos row when `hasDiscounts` (current
  does the same — only difference is visual treatment).
- Cobrar button icon: current uses `i-lucide-hand-coins`, reference uses
  `i-lucide-credit-card`. Visual difference, not functional.
- Cobrar button color: reference is solid yellow; current is
  `!bg-(--brand-action) !text-black` overriding the primary color to the
  brand yellow. Same end state — no change needed.

---

## 5. Catalog (left) — current vs reference

### 5.1 `ProductSearchPanel.vue` lines 69–161

Current header structure:

```
┌─ sticky top-0 bg-(--light-surface-page)/80 ... backdrop-blur ... border-b ─┐
│ px-5 py-4 space-y-3.5                                                       │
│   [search UInput size lg, icon i-lucide-search, full-width]   [⌘K][K]      │
│   [chips: Todo, General, ALIMENTO, Ropa, Limpieza]                         │
└────────────────────────────────────────────────────────────────────────────┘
[ProductSearchResults grid below]
```

Differences:
- Search placeholder: current `"Buscar por nombre, SKU o código…"`,
  reference `"Buscar por nombre, SKU o código de barras…"`. (Spanish copy
  change; matches the project's `preferences/ui-language-mexican-neutral-tuteo`
  preference — tuteo, no voseo.)
- Search shortcut: current has `⌘K K` (two separate `UKbd`s) at the right
  of the input; reference has the same but also adds an **icon button**
  (sliders/filter) between the input and the shortcut.

  Implementation note: in Nuxt UI v4 you can pass `icon` to a `UButton`,
  or you can use `UInput` with `trailing-icon` and a `UButton` wrapper. The
  reference icon looks like `i-lucide-sliders-horizontal` or
  `i-lucide-list-filter`.

- Chip count: current has 5 chips (Todo 5, General 2, ALIMENTO 1, Ropa 1,
  Limpieza 1) driven by `useProductSearch().categories` + `totalUnfiltered`.
  Reference has 3 chips (Todo 6, General 4, Alimentos 2). The number of
  chips depends on data, not on layout — no code change needed here, but
  worth noting the reference chips use a *rounder* pill shape (more
  rounded corners) than the current `rounded-lg`.

### 5.2 `ProductSearchResults.vue` lines 54–65

Current grid:

```html
<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 gap-4">
```

Reference keeps 4 visible columns on laptop viewports but the **cards**
inside are larger relative to the catalog column width. No code change in
this file needed if the catalog column shrinks (the cards will simply
expand to fill).

### 5.3 `ProductSearchResultItem.vue` (the catalog card)

Differences visible in the images:

| Aspect | Current (Image 1) | Reference (Image 2) |
|---|---|---|
| Image area | `aspect-[4/3]` | `aspect-square` (or larger) |
| Image fallback | `bg-default` + `i-lucide-package` icon | Same, but icon is centered and more visible |
| Brand label | `CRO32`, `SIN MARCA`, `ADIDAS`, `MAESTRO LIMPIO` — small caps muted | `SIN MARCA`, `VITAL PET` — small caps muted, with **SKU line below** (`IBU-400`, `ALT-PEQ-11`, `PAR-500`, `SHA-MAS-10`) |
| Name | `Croqueta`, `Ibuprofeno 400mg`, etc. — medium weight | Same weight, slightly larger |
| Variants hint | `Ver variantes >` + `2 variantes` (two lines) | Badge `2 variantes` next to the price (single line) |
| Stock badge | Top-right pill with `#N` (looks like a position/ID, not stock) | Top-right pill with `N u` (units) or `Sin stock` (red) |
| Price | `$200.00`, `$400.00`, etc. — small bold blue | `$100.00`, `$300.00` — large bold primary-tone monospace |
| Hover state | Probably `Agregar` button reveal (not visible in static image) | Same |

The stock badge semantic difference (`#26` vs `24 u`) suggests the
current implementation might be using `productId`/`variantId` suffix
instead of `stock` units. Implementation: verify which field the
`<UBadge>` is bound to in `ProductSearchResultItem.vue` and align with
`product.stock` / `variant.stock`.

The variants-hint difference suggests the current implementation might
have separate lines for `Ver variantes` and the count — reference
consolidates them into one badge next to the price. Verify the current
markup in `ProductSearchResultItem.vue`.

---

## 6. Top tab strip (`SalesTabsStrip.vue`)

Image 1 shows the tab strip **below** the global top bar (Coco + theme
switcher), with two open tabs `Venta 1` (selected, with a small `1` badge
showing items count) + `Venta 2` + a `+` button.

Image 2 shows the tab strip **at the top of the content area**, with one
tab `Venta 1` + `+` button. No second tab visible.

The current `SalesTabsStrip` is rendered at `SalesView.vue` lines 705–712
as a sibling of the two-column split. Both designs put it at the top of
the content area — no difference.

Note: the count badge on the tab (`Venta 1` has a small `1` chip in both
images) is already wired. No code change needed for this strip.

---

## 7. Sidebar + global chrome (low priority)

- Image 1 has a left sidebar (`S`, search, grid, plus, cart, person,
  shield, gear, `SA` at bottom). The icons are vertical, full-height.
  This sidebar is rendered at the app-shell level, **not** in `SalesView`.
  It is present in both images but only visible in Image 1 because Image 2
  was cropped to the catalog/cart area without the sidebar.
- Image 1 has a global top bar (`Coco` + search + bell + theme switcher).
  Image 2 does not show one (likely cropped). No change required.

---

## 8. Specific files to touch (per the diff above)

Implementation will need to change at least:

1. **`src/features/POS/sales/views/SalesView.vue`** — lines 714–758
   (two-column split widths) + lines 655–673 (skeleton mirror) +
   the router test in `src/features/POS/sales/views/__tests__/SalesView.test.ts`
   (lines 874–880) to match the new widths.

2. **`src/features/POS/sales/components/ActiveSalePanel.vue`** — lines
   206–231 (cart-header structure: UTabs → pill tabs + unified
   price-list pill) and lines 277–328 (customer slot → bordered row with
   solid `Asignar` button).

3. **`src/features/POS/sales/components/PriceListSelector.vue`** — lines
   128–164 (replace the `Lista: PUBLICO` label + separate `UInputMenu`
   with a single bordered pill that opens the same menu).

4. **`src/features/POS/sales/components/ProductSearchPanel.vue`** — lines
   74–89 (add filter icon button between search input and shortcut) +
   line 80 (placeholder copy `código…` → `código de barras…`).

5. **`src/features/POS/sales/components/ProductSearchResultItem.vue`** —
   card layout: image area size, brand+SKU line, stock badge semantic
   (`#N` → `N u` / `Sin stock`), variants hint consolidation.

6. **`src/features/POS/sales/components/SaleItemRow.vue`** — lines
   252–271 (qty stepper position from center column to right column),
   lines 274–320 (inline badges visual treatment — verify `AppBadge`
   tone/variant matches the reference's outlined success chips).

7. **`src/features/POS/sales/components/SaleTotalsFooter.vue`** — lines
   64–141 (move count line `N Artic · N Unidad` from above subtotal to
   under `TOTAL A COBRAR`, wording `Artic · Unidad` → `linea · unidad`,
   Cobrar icon `i-lucide-hand-coins` → `i-lucide-credit-card`).

8. **`src/features/POS/sales/components/PromocionesFlatList.vue`** (or
   swap to `PromocionesDisponiblesAccordion.vue` if the accordion shape
   is preferred — see §4.2) — `ActiveSalePanel.vue` lines 334–341 mount
   `PromocionesFlatList`; the reference looks more like the accordion.

9. **Tests**: `src/features/POS/sales/views/__tests__/SalesView.test.ts`
   lines 874–880 (width assertions) and any tests that hard-pin the
   `Lista:` label / `UInputMenu` trigger structure in
   `PriceListSelector.test.ts` / `ActiveSalePanel.test.ts` /
   `SaleItemRow.test.ts` / `SaleTotalsFooter.test.ts`.

10. **No backend changes** — every diff above is presentation-only. The
    backend handoff for `seller-assignment` and `promotions-in-sale`
    is already complete; this redesign is pure FE.

---

## 9. Out of scope (do NOT touch)

- Mobile FAB + bottom slideover (`SalesView.vue` lines 767–895,
  `USlideover side="bottom" h-[90vh]`). The user explicitly confirmed
  mobile is fine.
- Ultra-wide / `2xl+` breakpoints (`xl:w-[75%] / xl:w-[25%]`). User
  confirmed ultra-wide is fine — leave the `xl` widths untouched and
  only adjust the `lg` (and possibly add an `2xl` adjustment if needed
  for very wide laptops >1600 px).
- Theme tokens (DESIGN.md, `vite.config.ts ui.colors`). User did not
  ask to switch from light to dark; reference happens to be dark.
- Backend repo (`houndfe-backend`). Hard rule, off-limits.
- The router test pin: if widths change, update the test in lockstep;
  do not silently break the assertion.

---

## 10. Open questions to confirm with the user before implementation

1. **Confirm the ratio**: the proposed `lg:w-[60%] / lg:w-[40%]` is a
   starting point. Does the user want something different (e.g.
   `lg:w-[58%] / lg:w-[42%]` for a more cart-heavy layout)?

2. **Cobrar icon swap**: `i-lucide-hand-coins` → `i-lucide-credit-card`?
   Functional impact: none. Visual impact: the reference's icon is
   more universally recognized as a payment action.

3. **Promociones row**: keep `PromocionesFlatList` (current) or swap to
   `PromocionesDisponiblesAccordion.vue` (reference shape)?

4. **Search placeholder copy**: `código…` → `código de barras…`? Both
   are valid; `de barras` is more explicit about barcode support.

5. **Filter icon button**: add `i-lucide-sliders-horizontal` between the
   search input and the ⌘K shortcut? This opens a quick-filter
   slideover that does not exist yet — would be a small additional
   feature, not a pure visual change.

6. **Customer `Asignar` button**: change from `variant="link"` (current)
   to a solid `color="primary"` button (reference)? Both work; the
   reference's solid button is more visually prominent for POS cashiers.
