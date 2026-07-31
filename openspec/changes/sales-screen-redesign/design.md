# Design: Sales Screen Redesign (SDD-14)

## Technical Approach

Incremental CSS-first restructure of the POS sales surface across two phases. No backend work — every pricing, discount, and reward field already exists on `SaleItem` and `Sale`. Phase 14a shifts layout proportions and redesigns the product panel. Phase 14b rewrites the cart item template and enhances totals. Both phases are independent commits to main; either can be reverted without affecting the other.

## Architecture Decisions

| Decision | Options Considered | Rationale | Choice |
|----------|-------------------|-----------|--------|
| **Promos display** | A) Flat card list B) Styled accordion C) Slideover drawer | 25% panel is narrow; accordion toggle adds unnecessary interaction for a critical sales driver. Flat cards are always visible, scanable, and match v0.dev's compact density. Option C hides promos behind an extra click — defeats the purpose. | **Option A: Flat card list** |
| **SaleItemRow template** | A) Incremental tweaks B) Complete rewrite with preserved logic | Current vertical mini-card doesn't fit 25% panel. Complete rewrite is the only way to achieve horizontal compact layout. Preserve all script logic, props, emits, computed, and `data-testid` attrs. | **Option B: Complete template rewrite** |
| **Cart header actions** | A) Keep trash button B) Move to "More" dropdown in footer | At 25% width, every header element competes for space. Trash and ellipsis go to a `UDropdownMenu` in the cart footer toolbar, triggered by a single kebab icon. | **Option B: "More" dropdown** |
| **3-column grid** | A) Responsive auto-cols B) Fixed `grid-cols-3` | Reference demands larger cards with dominant images. Responsive columns would yield variable card sizes. Fixed 3 columns guarantees image-first layout at every viewport. | **Option B: Fixed `grid-cols-3`** |

## Data Flow

```
ProductSearchPanel ──search→ useProductSearch ──API→ /pos-catalog
       │                                              │
       ▼                                              ▼
ProductSearchResults ──grid-cols-3──→ ProductSearchResultItem (image-first card)
                                            │
                                   click ──→ SalesView.addProduct()
                                                  │
                                                  ▼
                                    useSalesDrafts.addItem(activeDraft)
                                                  │
                                                  ▼
                                  ActiveSalePanel ──reads── sale.items[]
                                       │        │
                          SaleItemRow (new)    PromocionesFlatList (new)
                          reads: item.*        reads: applicablePromotions[]
                          computes: lineDisplay
                          │
                          SaleTotalsFooter
                          computes: itemCount, unitCount
                          reads: sale.subtotalCents, discountCents, totalCents
```

**No new API calls.** All data flows through existing composables (`useProductSearch`, `useSalesDrafts`, `useApplicablePromotions`). `PromocionesFlatList` receives `ApplicablePromotion[]` via props (same contract as current accordion).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `SalesView.vue` | Modify | 75/25 grid classes, Ctrl+K handler, FAB proportions |
| `ProductSearchPanel.vue` | Modify | Dark category panel wrapper (`bg-coco-neutral-900`), search bar styling refresh |
| `ProductSearchResults.vue` | Modify | Grid → `sm:grid-cols-3 xl:grid-cols-3`, larger gap |
| `ProductSearchResultItem.vue` | Modify | Larger hero image, `#N` stock badge, cleaner text hierarchy |
| `useProductSearch.ts` | Modify | Page size: `limit: 24 → 36` (unqueried), `limit: 30 → 42` (queried) |
| `SaleItemRow.vue` | Modify | **Template rewrite**: horizontal compact card. Script unchanged. |
| `ActiveSalePanel.vue` | Modify | Cart header compaction (UTabs + PriceListSelector only), "More" dropdown in footer toolbar |
| `SaleTotalsFooter.vue` | Modify | Items/units count line, separate subtotal/discount breakdown, `text-white` total, wider Cobrar button |
| `PromocionesDisponiblesAccordion.vue` | **Replace** | Replaced by `PromocionesFlatList.vue` — flat card list, always visible |
| `PromocionesFlatList.vue` | **Create** | New component: flat promo cards with apply/remove, loading skeleton, empty-state guard |
| `__tests__/SaleItemRow.test.ts` | Modify | Selector updates for horizontal layout |
| `__tests__/SaleTotalsFooter.test.ts` | Modify | New breakdown assertions |
| `__tests__/ProductSearchResultItem.test.ts` | Modify | `#N` badge format |
| `__tests__/PromocionesFlatList.test.ts` | **Create** | Tests for new flat-list component |

**NOT modified:** `SaleItemBadges.vue` (shared with `SaleDetailItemsList`), `SaleDetailItemsList.vue`, all modals.

## Visual Design Direction

### Product Panel (75%)
- **Search bar**: pill-shaped (`rounded-xl`), prominent search icon, KBD indicator on the right (existing `UKbd` pattern preserved)
- **Category chips**: wrapped in a `bg-coco-neutral-900` dark container below search with rounded corners and inner padding. Chips: compact pill buttons (`rounded-xl`, `text-xs`, `font-semibold`) with count badges
- **Product cards**: `rounded-2xl`, `aspect-square` hero image filling the card top, stock badge (`#N`) absolute top-right with `bg-default/80` backdrop. Card body: brand (`text-[10px] uppercase`), name (`text-[13px] font-medium line-clamp-2`), price (`text-sm font-bold text-(--brand-accent)`)
- **Grid**: 3 columns, `gap-4`, no responsive breakpoint variation

### Cart Panel (25%)
- **Header**: compact (`py-2 px-4`), only UTabs + PriceListSelector. Kebab menu icon at the right edge opens a "More" dropdown (global discount, clear items, close tab)
- **Item row**: horizontal card. Left: 48px square thumbnail (`rounded-lg`). Center column: product name (`text-sm font-medium truncate`), specs line (`text-xs text-muted`), qty stepper (`flex items-center gap-1`) + trash icon. Right column: multi-line pricing stack (unit price `text-xs text-muted`, discount line `text-xs text-primary`, subtotal `text-sm font-semibold text-highlighted tabular-nums`)
- **Promos section**: flat card list below items, each card shows promo title (`text-xs font-medium`), discount badge (`AppBadge tone="info"`), "Aplicar" button (`UButton size="xs"`). Applied promos show a green left border and X remove button.
- **Totals footer**: items/units count (`text-xs text-muted`), subtotal line, discount line (`text-sm text-primary`), separator, total row with `TOTAL A COBRAR` label (`text-xs uppercase font-semibold text-muted`) and amount (`text-2xl font-extrabold text-white tabular-nums`), Cobrar button (`block w-full`, brand-action bg, `rounded-xl`, `font-semibold`, F8 KBD trailing)

### Responsive
- **Desktop (≥1024px)**: 75/25 fixed split, both panels visible
- **Mobile (<1024px)**: Product panel full-width, cart in FAB-triggered slideover (existing pattern preserved, proportions updated)

## Promos Redesign — Detailed Design

### Choice: Option A — Flat Card List

**Rationale**: The 25% cart panel is narrow. An accordion hides promos behind a toggle — they're a key sales driver and should be always visible. Per-item inline links in the cart row (current design mentions "Promociones disponibles" link) are a separate concern for future per-item promo discovery. The global promo list should be permanently visible as compact cards.

### Component Contract: `PromocionesFlatList.vue`

**Props** (same as current accordion):
- `promotions: ApplicablePromotion[]` (required)
- `loading?: boolean` (default `false`)
- `appliedIds?: string[]` (default `[]`)

**Emits** (same as current accordion):
- `apply: [promotionId: string]`
- `remove: [promotionId: string]`

### Visual Layout

```
┌─────────────────────────────────┐
│ Promociones disponibles    (3)  │  ← section header, text-xs text-muted uppercase
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 🏷 2x1 en Pawfect Bites    │ │  ← promo card: title left, info badge right
│ │    Faltan 3 unidades   [✕] │ │  ← BXGY hint (if unitsNeeded), remove btn
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 🏷 Descuento 15%           │ │
│ │                  [Aplicar] │ │  ← apply button when not applied
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 🏷 Envío gratis   [Aplicar]│ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### States

| State | Visual |
|-------|--------|
| **Default** | Card with title (`text-xs font-medium truncate`), discount-type badge, "Aplicar" button (`UButton size="xs" color="primary"`) |
| **Applied** | Left border `border-l-2 border-l-success`, "Aplicar" replaced by X remove icon (`UButton size="xs" color="neutral" variant="ghost"`) |
| **Not eligible** | "Aplicar" button disabled (`:disabled="promo.eligible === false"`), card slightly muted opacity |
| **Loading** | 3 `USkeleton` cards replacing the list (`h-10 w-full rounded`) |
| **Empty** | Component does not render (`v-if="promotions.length > 0"` — same guard as current) |
| **Error** | Parent (`ActiveSalePanel`) handles error state; this component is presentational only |

### Migration from `PromocionesDisponiblesAccordion`

1. Create `PromocionesFlatList.vue` with identical props/emits contract
2. Replace import in `ActiveSalePanel.vue`: `PromocionesDisponiblesAccordion` → `PromocionesFlatList`
3. Update `ActiveSalePanel.spec.ts` selectors (`promociones-disponibles-accordion` → `promociones-flat-list`)
4. Create `__tests__/PromocionesFlatList.test.ts` with equivalent test cases
5. Delete `PromocionesDisponiblesAccordion.vue` and its test file

## Component Architecture

### What Changes
- **`SalesView.vue`**: Grid classes (2 lines), keyboard handler (~10 lines), mobile FAB width
- **`ProductSearchPanel.vue`**: Category section wrapper from `bg-elevated/50` to dedicated dark panel
- **`ProductSearchResults.vue`**: Grid col classes (4 values), gap value
- **`ProductSearchResultItem.vue`**: Stock badge format (`{{ item.stock.quantity }} u` → `#{{ item.stock.quantity }}`), image sizing, text hierarchy
- **`SaleItemRow.vue`**: Complete `<template>` block replaced. `<script>` untouched.
- **`ActiveSalePanel.vue`**: Cart header simplification, "More" dropdown, Promociones import swap
- **`SaleTotalsFooter.vue`**: New computed (`lineCount`, `totalQuantity`), new template rows, total restyling

### What's New
- **`PromocionesFlatList.vue`**: Flat promo cards, always visible

### What's Removed
- **`PromocionesDisponiblesAccordion.vue`**: Replaced by flat list

### What's Preserved (no touch)
- **`SaleItemBadges.vue`**: Shared with `SaleDetailItemsList`
- **`SaleDetailItemsList.vue`**: Confirmed-sale surface
- **All modals**: `PaymentModal`, `ItemDiscountModal`, `PriceOverrideModal`, etc.
- **All composables**: `useSalesDrafts`, `useProductSearch` (except page size), `useApplicablePromotions`
- **All API layer**: `sale.api.ts`, `product.api.ts`
- **Type definitions**: `sale.types.ts`, `product.types.ts`

## Phase Boundaries

### Phase 14a — Layout + Product Panel (commit 1)
- `SalesView.vue`: 75/25 grid, Ctrl+K handler
- `ProductSearchPanel.vue`: Dark category panel wrapper
- `ProductSearchResults.vue`: Fixed 3-col grid
- `ProductSearchResultItem.vue`: Larger image, `#N` badge, text hierarchy
- `useProductSearch.ts`: Page size tune

**Gate**: Cart panel renders in its CURRENT layout at 25% width (ugly but functional). Cart items overflow — accepted risk until 14b lands.

### Phase 14b — Cart Items + Totals (commit 2)
- `SaleItemRow.vue`: Template rewrite
- `ActiveSalePanel.vue`: Header compaction, "More" dropdown, Promociones swap
- `SaleTotalsFooter.vue`: Enhanced breakdown
- `PromocionesFlatList.vue`: New flat card component
- All test files: selector/assertion updates

**Gate**: All unit tests pass. `pnpm build` clean. `SaleDetailItemsList` renders correctly with new `SaleItemRow`.

## Migration Strategy

### Confirmed-Sale Surface Protection
`SaleItemRow` is used by `ActiveSalePanel` (draft cart) with `isDraft=true` and by `SaleDetailItemsList` (confirmed sale view) with `isDraft=false`. The template rewrite must:

1. **Preserve** all `data-testid` attributes (`sale-item-unit-strike-*`, `sale-item-line-net`, `sale-item-line-gross-strike`, `sale-item-badge-group`)
2. **Preserve** the `isDraft` gating — qty stepper, trash icon, price/discount modals render ONLY when `isDraft=true`
3. **Preserve** `SaleItemBadges` usage for the confirmed surface, but render discount/promo info INLINE (not via `SaleItemBadges`) for the draft surface
4. **Preserve** all props, emits, computed properties exactly

### Commit Strategy
Each phase is a single direct-to-main commit. Phase 14a can ship and be validated independently. Phase 14b can be reverted independently of 14a.

## Edge Cases

| Section | State | Handling |
|---------|-------|----------|
| **Product grid** | Empty search results | Existing empty state (`isEmpty`), no change |
| **Product grid** | Image fails to load | Existing fallback: `UIcon name="i-lucide-package"`, preserved |
| **Product grid** | No stock data | `v-if="item.stock != null"` guards badge; card renders without it |
| **Product grid** | Low stock | Badge turns danger color (existing `isLowStock` logic preserved) |
| **Cart items** | Empty cart (no items) | Existing guard: `v-if` on `activeDraft` + items length |
| **Cart items** | Image fails to load | Existing `imageBroken` ref + fallback icon, preserved |
| **Cart items** | Long product name | `truncate` class on name; specs line also `truncate` |
| **Cart items** | No discount | Right column shows only unit price + subtotal (single line) |
| **Cart items** | BXGY reward line | `rewardKind` badge rendered inline via computed, not via `SaleItemBadges` (draft surface) |
| **Promos** | No applicable promos | Component does not render (`v-if` guard) |
| **Promos** | Loading | 3 skeleton cards instead of current 1 full-width skeleton |
| **Promos** | All promos applied | All cards show applied state with X remove |
| **Totals** | No discounts | Discount line hidden (`v-if="hasDiscounts"`) |
| **Totals** | Order-level promo applied | Green promo row between breakdown and total (existing pattern, preserved) |
| **Mobile** | Cart slideover | Existing FAB + slideover pattern, proportions updated for 75/25 |
| **Keyboard** | Non-Mac vs Mac | Existing `isMac` computed (`⌘` vs `Ctrl`), preserved |

## Threat Matrix

N/A — no routing, shell commands, subprocesses, VCS/PR automation, executable-file classification, or process-integration boundary. This change is purely visual/structural, operating entirely within the Vue template layer.

## Open Questions

- [ ] **"Pedido" tab**: Spec says it stays disabled. Is there a future timeline for order functionality, or should we consider removing the disabled tab entirely?
- [ ] **"More" dropdown placement**: In cart footer toolbar vs. inline in cart header. Footer toolbar is less discoverable but saves header space. Confirm with stakeholders.
- [ ] **Per-item "Promociones disponibles" link**: Spec mentions this in the cart item right column. Deferred to separate change — confirm this is acceptable.
