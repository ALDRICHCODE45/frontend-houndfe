# Exploration: sales-screen-redesign

## Executive Summary

The sales screen (`SalesView.vue` + child components) needs a comprehensive visual and structural redesign based on the v0.dev reference design. This is a **HIGH-COMPLEXITY** change that touches the core layout proportions, every visible component in both the product catalog and the cart, and several shared infrastructure pieces. The previous `sales-layout-redesign` and `sales-view-coco-redesign` changes provide preparatory scaffolding (Coco tokens, header/body/footer partitioning, tab strip at view level), but the actual redesign detailed in `docs/rediseno/pantalla_venta.md` remains unimplemented.

**Key risk areas**: `SaleItemRow.vue` (complete rewrite of cart item layout — highest risk), `SalesView.vue` (proportion change from 60/40 to ~75/25 — structural), `ProductSearchResultItem.vue` (card size increase + grid change — data-density tradeoff).

---

## File Map

### 1. Layout / Structure

Files controlling the main split and proportions.

| # | File | Current Role | Redesign Impact | Change Type |
|---|------|-------------|-----------------|-------------|
| 1 | `src/features/POS/sales/views/SalesView.vue` | Main orchestrator: split layout (60/40), image hydration, tab management, all handlers | **Proportions change**: Lines 685-694 define `lg:w-[60%]` / `lg:w-[40%]` → `lg:w-[75%]` / `lg:w-[25%]`. Keyboard shortcut integration (Ctrl+K) for search focus may need new logic. Mobile FAB slideover (lines 734+) proportions may also need tweak. | **Structural** (proportion values + keyboard shortcut handler) |
| 2 | `src/app/router/index.ts` | Route definition (line 15: `SalesView` lazy import) | Unlikely to change | None |
| 3 | `src/features/POS/sales/components/SalesTabsStrip.vue` | View-level tab strip (moved here by `sales-layout-redesign`) | Spec says "integrar de forma más limpia dentro de un panel de encabezado que abarque todo el ancho". May need a wrapping header panel. | **Cosmetic** (container wrapper + integration) |

### 2. Product Panel (Left Side)

Files for product search, cards, filters, and header.

| # | File | Current Role | Redesign Impact | Change Type |
|---|------|-------------|-----------------|-------------|
| 4 | `src/features/POS/sales/components/ProductSearchPanel.vue` | Layout wrapper with sticky header, search input + KBD indicator, category filter chips | **Search bar redesign**: Already has KBD shortcut indicator (UKbd with Ctrl/⌘), but needs styling update. **Category filters**: Currently rendered as scrollable horizontal chip bar with `bg-elevated/50`. Spec demands "compactos y agrupados dentro de un panel oscuro dedicado debajo de la búsqueda" — needs a dark panel wrapper (`bg-coco-neutral-900` or similar) with compact pill-style chips. | **Structural + Cosmetic** (category filter panel wrapper, search bar styling) |
| 5 | `src/features/POS/sales/components/ProductSearchResults.vue` | Grid layout for product cards with loading skeleton, empty state, and results grid | **Grid change**: Lines 26, 56-57 define `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5` → needs to become `grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-3` (3-column fixed grid) with larger card spacing. The "3x2" in the spec refers to visible density, not literal CSS grid — fewer columns, bigger cards. Also needs larger gap values to accommodate bigger cards. | **Structural** (column count + spacing) |
| 6 | `src/features/POS/sales/components/ProductSearchResultItem.vue` | Individual product card: aspect-square image, stock badge, brand, name, price, variant count | **Significant card redesign**: Image must be larger and more prominent (currently `aspect-square`, good). Stock indicator format changed: currently `{{ item.stock.quantity }} u` → should show `#{{ item.stock.quantity }}` in top-right corner per reference. Card body needs cleaner hierarchy. | **Structural + Cosmetic** (image sizing, stock badge format, typography hierarchy) |
| 7 | `src/features/POS/sales/components/VariantPickerModal.vue` | Variant picker modal for products with variants | Unlikely to change structurally | **Cosmetic** (token updates only) |
| 8 | `src/features/POS/sales/components/ProductSearchResultItem.vue` | (listed above at #6) | — | — |
| 9 | `src/features/POS/sales/composables/useProductSearch.ts` | Product search logic: query, debounce, category filters, pagination | Grid limit: currently `limit: 24` (no query) / `limit: 30` (with query). With 3-column grid, visual card count drops. May need to adjust limit for smooth scrolling. | **Minor logic** (page size tuning) |

### 3. Cart Panel (Right Side)

Files for cart wrapper, items, totals, and promotions.

| # | File | Current Role | Redesign Impact | Change Type |
|---|------|-------------|-----------------|-------------|
| 10 | `src/features/POS/sales/components/ActiveSalePanel.vue` | Cart wrapper with cart-header (type toggle + trash + price list), cart-body (item list), cart-footer (customer + promos + totals) | **Cart header**: Spec wants "botones 'Venta' y 'Pedido' y la opción 'PUBLICO' deben estar más integrados y limpios dentro de un encabezado superior más pequeño y compacto". The current header is already structured but needs compaction for the narrower ~25% panel. **Cart body/footer**: Need to accommodate the new SaleItemRow layout and the redesigned totals section. The existing `data-testid` structure (cart-header, cart-body, cart-footer) should be preserved. | **Structural + Cosmetic** (header compacting for narrower panel) |
| 11 | `src/features/POS/sales/components/SaleItemRow.vue` | ⚠️ **HIGHEST RISK** — Cart item row: mini-card with 3-row vertical layout (thumb+info+actions, qty+chips+price, badges) across mobile and desktop | **Complete redesign**: Spec demands a horizontal compact card with:
- Left: larger thumbnail (not 40px icon)
- Center-top: product name
- Center-middle: specs ("Rojo - Caja de 30 cpr")
- Center-bottom: quantity selector (+/-/count) + trash icon
- Right: multi-line pricing (unit price, discount lines, "Promociones disponibles" link)

This is a fundamentally different layout from the current mini-card. The existing `lineDisplay` computed (NET/gross logic), `showPriceOrigin`/`showDiscountOrigin`, and emit contracts must be preserved but rendered in the new layout. Props and emits should stay mostly unchanged. | **Structural** (complete template rewrite) |
| 12 | `src/features/POS/sales/components/SaleTotalsFooter.vue` | Totals section: subtotal, discounts, total, order promo row, Cobrar button | **Enhanced totals**: Spec demands:
- Items/units count display ("1 Artic - 1 Unidad")
- Separate subtotal and discounts lines
- More prominent total ("grande y con el monto en blanco")
- Wider Cobrar button ("más amplio y estructurado")

Currently `subtotalCents` and `discountCents` come from backend; may need additional `itemCount`/`unitCount` fields or compute them from `sale.items`. The "total in white" suggests `text-white` token usage. | **Structural + Cosmetic** (new breakdown rows, total styling, button sizing) |
| 13 | `src/features/POS/sales/components/PromocionesDisponiblesAccordion.vue` | Promotions accordion: UAccordion with apply/remove buttons per promotion | Spec says "Global accordion redesigned (not per-item, not the current accordion)". The current component is already global (order-level, not per-item) and uses UAccordion. The user's intent is unclear — possibly wants a flat list instead of accordion, or a different disclosure pattern. Needs clarification. | **Unclear** (requires user clarification) |
| 14 | `src/features/POS/sales/components/SaleItemBadges.vue` | Presentational badges: price source, promotion, discount, reward. Shared between draft and confirmed surfaces. | The spec mentions discount details ("Descuento +25%", "+ Descuento extra") in the cart item's multi-line pricing section. These might be rendered inline rather than as badges now, or the badge component may need to be extended. However, `SaleItemBadges` is also used in `SaleDetailItemsList` (confirmed sale view) which is NOT part of this redesign scope. Any change here must not break the confirmed-sale surface. | **Potential structural** (if discount display moves to inline) |
| 15 | `src/features/POS/sales/components/GlobalDiscountModal.vue` | Global discount modal | Unlikely to change structurally | None |
| 16 | `src/features/POS/sales/components/PriceListSelector.vue` | Price list tier selector | Unlikely to change. Already in cart header. | None |

### 4. Modals / Slideovers (Indirectly Affected)

These components are triggered from the cart but unlikely to need structural changes. They may need Coco token / visual consistency updates.

| # | File | Role | Change Type |
|---|------|------|-------------|
| 17 | `PaymentModal.vue` | Payment flow (triggered by Cobrar / F8) | **Cosmetic** (token consistency) |
| 18 | `PaymentSuccessModal.vue` | Post-payment success | None |
| 19 | `AssignCustomerSlideover.vue` | Customer assignment | **Cosmetic** (may need narrower panel awareness) |
| 20 | `ItemDiscountModal.vue` | Per-item discount modal | **Cosmetic** (token consistency) |
| 21 | `PriceOverrideModal.vue` | Price override modal | None |
| 22 | `ProductDetailModal.vue` | Product detail modal | None |
| 23 | `DebtPaymentModal.vue` | Debt payment modal | None |
| 24 | `DueDateEditModal.vue` | Due date editor | None |

### 5. Shared / Infrastructure

Files used across panels that may need changes.

| # | File | Current Role | Redesign Impact | Change Type |
|---|------|-------------|-----------------|-------------|
| 25 | `src/features/POS/sales/interfaces/sale.types.ts` | All type definitions: `Sale`, `SaleItem`, `PosCatalogItem`, `ApplicablePromotion`, etc. | The `PosCatalogItem` interface may need a richer `stock` field if the reference design shows stock numbers differently. `Sale` totals may need `itemCount`/`unitCount` if the backend provides them (or compute on frontend). `SaleItem` may need spec fields if the multi-line pricing needs new backend data. | **Potential structural** (new optional fields — must be backward-compatible) |
| 26 | `src/features/POS/sales/composables/useProductSearch.ts` | Product search query, debounce, categories, pagination | Page size tuning for 3-column grid | **Minor logic** |
| 27 | `src/features/POS/sales/composables/useSalesDrafts.ts` | Draft CRUD: create, add/update/remove items, charge | Unlikely to change unless new totals computation needed client-side | **Minor** (possibly) |
| 28 | `src/features/POS/sales/composables/useApplicablePromotions.ts` | Promotions query for active draft | Unlikely to change | None |
| 29 | `src/features/POS/sales/utils/currency.utils.ts` | `formatCentsMXN`, `lineCents` | Unlikely to change | None |
| 30 | `src/features/POS/sales/utils/promotion.utils.ts` | `buildBxgyHint`, `getRewardBadgeLabel` | Unlikely to change | None |
| 31 | `src/features/POS/sales/api/sale.api.ts` | API layer: `searchPosCatalog`, draft operations, product detail | Unlikely to change unless catalog API needs richer stock data | **Minor** (possibly) |
| 32 | `src/features/POS/sales/constants/sale.constants.ts` | Status/payment enums, storage keys | Unlikely to change | None |

### 6. Test Files

All affected components have corresponding tests that will need updates.

| # | Test File | Impact |
|---|-----------|--------|
| 33 | `__tests__/SaleItemRow.test.ts` | **HIGH** — Template selectors will break with layout rewrite |
| 34 | `__tests__/SaleTotalsFooter.test.ts` | **MEDIUM** — New breakdown rows need new assertions |
| 35 | `__tests__/ProductSearchResultItem.test.ts` | **MEDIUM** — Stock badge format, card structure changes |
| 36 | `__tests__/ProductSearchResults.test.ts` | **LOW** — Grid class assertions may need update |
| 37 | `__tests__/ActiveSalePanel.spec.ts` | **LOW** — Header/footer testid selectors should still work |
| 38 | `__tests__/SalesView.test.ts` | **LOW** — Proportion change may affect viewport-dependent tests |
| 39 | `__tests__/SaleItemBadges.test.ts` | **MEDIUM** — If discount display moves inline |
| 40 | `__tests__/PromocionesDisponiblesAccordion.test.ts` | **MEDIUM** — If accordion pattern changes |

---

## Risk Assessment

### 🔴 HIGH RISK

| File | Risk | Mitigation |
|------|------|------------|
| `SaleItemRow.vue` | Complete template rewrite. Has complex computed logic (`lineDisplay`, `showPriceOrigin`, `showDiscountOrigin`, `itemActions`) that must be preserved. Two responsive layouts (mobile/desktop). Many `data-testid` selectors that tests depend on. Used by both ActiveSalePanel (draft) and SaleDetailItemsList (confirmed) — need to verify confirmed view is unaffected. | Write the new template first with preserved props/emits/computed. Run existing tests to verify no regressions. Keep both mobile and desktop layouts. Preserve all `data-testid` attributes. |
| `SalesView.vue` | Proportion change from 60/40 to 75/25 is simple in CSS but needs testing across: desktop split layout, mobile FAB slideover, and responsive breakpoints. The keyboard shortcut (Ctrl+K) integration needs new logic. | Isolate CSS proportion change from keyboard shortcut work. Test on multiple viewport sizes. |
| `ProductSearchPanel.vue` | Dark panel for category filters could clash with existing Coco token system. Category chip layout must remain functional at the narrower width of the cart panel. | Use existing Coco dark tokens (`coco-neutral-900`, `coco-neutral-800`). Test overflow behavior with many categories. |

### 🟡 MEDIUM RISK

| File | Risk | Mitigation |
|------|------|------------|
| `ProductSearchResultItem.vue` | Stock badge format change. Card size increase affects grid density. Must maintain click-to-add and variant detection. | Incremental changes: badge first, then image sizing. Verify touch targets remain adequate. |
| `ProductSearchResults.vue` | Grid column change from responsive 5→3 columns reduces information density. Skeleton and empty state grids must match. | Use `sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3` for consistent 3-col layout. |
| `ActiveSalePanel.vue` | Header compacting for ~25% panel width. PriceListSelector may overflow. | Test at minimum panel width. Consider responsive stacking. |
| `PromocionesDisponiblesAccordion.vue` | User intent unclear — "not per-item, not the current accordion". Current implementation IS already not-per-item. | **Requires user clarification** before design phase. |

### 🟢 LOW RISK

| Files | Notes |
|-------|-------|
| `SaleTotalsFooter.vue` | Additive changes (new breakdown rows). Existing structure preserved. Backend totals source unchanged. |
| `SaleItemBadges.vue` | May need new discount display variants. Must not break `SaleDetailItemsList` usage. |
| Modals (PaymentModal, AssignCustomerSlideover, etc.) | Cosmetic token updates only. |
| Test files (most) | Selector updates, not behavior changes. |
| `interfaces/sale.types.ts` | Additive fields only (optional). Backward compatible per existing patterns. |

---

## Estimated Complexity Per Category

| Category | Complexity | Rationale |
|----------|-----------|-----------|
| Layout / Structure | **Medium** | Proportion change is 2 CSS class values. Keyboard shortcut needs new handler (~10 lines). Tab strip integration is cosmetic. |
| Product Panel | **Medium** | Grid change is ~4 CSS class values. Card redesign is incremental (image sizing, badge format). Dark category panel is a wrapper div. |
| Cart Panel | **High** | `SaleItemRow.vue` is a complete template rewrite with preserved logic (~200 lines of template). `SaleTotalsFooter.vue` adds 3+ new breakdown rows. Promotions redesign needs clarification first. |
| Shared / Infrastructure | **Low** | Mostly additive optional fields. Page size tuning is a constant. |
| Tests | **Medium** | `SaleItemRow.test.ts` needs the most updates. Others are selector/assertion tweaks. |

---

## Clarification Needed

1. **Promotions accordion**: The spec says "Global accordion redesigned (not per-item, not the current accordion)". The current implementation IS already global (order-level) and uses a UAccordion. What is the desired alternative pattern? Flat exposed list? Expandable panel without accordion UX? Different visual style of the current accordion?

2. **"PUBLICO" reference**: The spec mentions "la opción 'PUBLICO'" in the cart header. Currently the cart header has Venta/Pedido tabs and a customer slot ("Cliente: Sin asignar"). Is "PUBLICO" meant to be a new toggle or a rename of an existing element?

3. **Multi-line pricing on cart items**: The spec describes "Línea 1: Precio unitario o subtotal del item. Líneas 2 y 3: Detalles específicos de descuentos (ej: 'Descuento +25%', '+ Descuento extra') y el total del descuento. Línea 4: Un enlace de texto para 'Promociones disponibles'." — Are these static template labels or do they need to be driven by backend data (e.g., individual discount line items)?

4. **"Promociones disponibles" link per item**: The spec mentions a per-item link in the multi-line pricing section vs. the global accordion. Should both coexist or is the per-item link replacing the global accordion?

---

## OpenSpec Status

- **Active specs**: `sales` (promotion-driven rendering), `sales-view-coco-redesign` (Coco tokens), `design-tokens` (token definitions)
- **Related archived changes**: `sales-layout-redesign` (tab strip + cart partitioning — COMPLETED), `sales-view-coco-redesign` (Coco token application — COMPLETED)
- **This change** will create new delta specs for the redesigned layout, may supersede or extend `sales-view-coco-redesign` for layout aspects
- **New change directory**: `openspec/changes/sales-screen-redesign/`

## Ready for Proposal

**Yes**, pending clarification on the 4 questions above. The file map is comprehensive and risk assessment is grounded in real code inspection. Recommend proceeding to `sdd-propose` after user addresses the clarifications.
