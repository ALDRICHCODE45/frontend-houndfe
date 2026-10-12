# Sales-entry visual redesign — v0 brief

Copy the prompt below into v0 and attach the screenshots listed afterward. Do not attach repository artifacts, credentials or real customer/payment data. This brief does not authorize a v0 API call or implementation in Houndfe.

## Copy-ready prompt

Design a complete, high-fidelity **new-sale / point-of-sale workspace for Houndfe**, a retail business application. I am attaching screenshots of our existing UI. We like our current application-wide visual identity, but this specialized sale-creation workspace deserves a more intentional composition.

**This is a UI/UX design task, NOT a functional implementation task.** The functionality described below is context so that you can design the correct controls, information hierarchy and states. Do not implement it.

### 1. Scope and non-negotiable boundaries

- Redesign sale creation: product discovery, simultaneous sale drafts, cart, customer/address assignment, discounts, promotions, checkout/payment and the reached overlays.
- Treat screenshots as evidence of existing capabilities, terminology and content, **not as a layout you must reproduce exactly**. Improve grouping, density, hierarchy and ergonomics without deleting capabilities.
- Keep the established application shell as context. Do not redesign the sidebar/navigation, Sales listing/detail, Customers module/history, quotations or cash-register management. Existing shared customer/address forms remain visually consistent with their already-approved module.
- Do not invent receipt printing, tax configuration, shipping charges, payment-terminal integrations, hardware barcode scanning or extra POS/business features. Barcode is a supported search term, not an integrated device flow.
- The “Pedido” mode is currently disabled. Preserve it only as unavailable context if useful; do not turn it into a working feature. Do not expose dormant functionality.
- Use fictional, hardcoded data. Supply all totals, discounts, balances, change, stock and statuses as predefined display values. **Do not calculate them.**
- No backend, APIs, fetch calls, database, authentication, authorization engine, storage/localStorage, real customer creation, inventory operations, promotion engine or payment processing. Do not request credentials or connect external services.
- Presentation-only interactions are allowed: switch between predefined visual examples, open/close sheets/dialogs, switch tabs and themes, expand sections and display a selected mock state. Do not implement stock validation, repricing, debt rules, financial math or real state persistence.
- Our production application is Vue 3 with Nuxt UI. A v0 preview may use its usual UI stack, but this is a disposable **visual reference**, not a request to migrate the application or produce production integration code.

### 2. Visual direction

Build an operational workspace for a cashier who needs to find products, review a sale and charge quickly. Not a marketing page, dashboard of KPI cards or generic SaaS template.

- Preserve Houndfe's approved foundation: **Manrope**, restrained blue primary actions, a small gold accent, calm neutral surfaces, clear borders and purposeful icons.
- Light: page `#f5f6f8`, surface `#ffffff`, primary action `#2442f6` with white text.
- Dark: page `#0e1520`, surface `#192332`, primary action `#91b0ff` with `#132344` text.
- Gold accent: `#f6bb13`. It is not the default paint for every action or section.
- Foundation radii: 12px for cards/surfaces, 6px for controls. Keep typography and spacing aligned with the screenshots; avoid unnecessary gradients, heavy shadows, decorative panels and excessive pill badges.
- Body and controls must remain legible in BOTH themes, including overlays, dropdowns, tooltips and error/warning states. Keep primary, secondary, destructive and unavailable actions visually distinct.
- UI language: Spanish, using established labels. Currency: **MXN**, displayed in Mexican format such as `$1,250.00`. Use tabular numerals and strong alignment for money.
- Prefer purposeful density to giant empty cards. Make the product/cart relationship and the final charge action the main visual hierarchy.
- Accessible keyboard focus, clear labels and tooltips for icon-only actions, non-color-only status cues, comfortable touch targets and reduced-motion-friendly presentation.

### 3. Main workspace and simultaneous sales

Design a coherent catalog + cart workspace for desktop, with a compact strip of concurrent drafts (“Venta 1”, “Venta 2”…), item-count badges, active state, close controls and a trailing create-sale `+` action. Include close-sale confirmation examples for an empty draft and a draft with products.

Desktop can retain a two-pane composition or improve its proportions; do not turn the cart into a cramped afterthought. Search, cart review, customer assignment, totals and “Cobrar” should have obvious priority. Long content scrolls without pushing crucial totals/actions out of reach.

Tablet and mobile must be deliberately designed, not merely compressed desktop. The existing mobile flow uses a catalog-first view, persistent bottom cart affordance with item count and total, then a cart drawer. Checkout follows after the cart drawer closes: avoid overlapping full-screen cart/payment panels. Design that progression coherently.

The application already supports `Ctrl+K` / `⌘K` for search and `F8` for payment. Optional subtle hints may represent those existing shortcuts; no shortcut engine is needed.

### 4. Catalog and product discovery

Include:

- Search input: “Buscar por nombre, SKU o código de barras...”.
- Horizontally scrollable category filters with “Todo”, counts and an unambiguous active state.
- Responsive product cards with image/placeholder, product name, brand/SKU, MXN price, optional stock/low-stock indicator and a clear “Agregar” action.
- Products with variants show “Ver variantes” and a variant count instead of pretending every product has one directly purchasable configuration.
- A variant-picker dialog titled “Añadir {producto}”: variant search, image, name, SKU, price and optional stock for each row.
- A reached read-only “Detalle del producto” dialog: image, name/variant, category, brand, description, SKU and stored barcode; price/price-list, stock and location summaries; variant rows with active selection. Include loading, error and missing-value examples. “Ir al producto” is a visual placeholder, not a new product-editor flow.
- Catalog-loading skeleton, truly empty catalog, “Sin resultados” for a query and retry/error states where applicable. Do not make every empty state look identical.

### 5. Cart and pricing context

Provide an empty cart (“Tu venta está vacía”) and a populated cart.

Each item needs room for image/placeholder, product and variant names, unit price, original/discounted price when applicable, quantity control, line monetary information and removal. Include a discreet menu for “Ver detalles”, “Cambiar precio”, “Agregar descuento” / “Quitar descuento” and “Eliminar producto”.

Use compact, readable metadata for price origin (“Precio lista” / “Precio manual”), item discount, promotion title and reward information. Applied promotions and ordinary discounts are not interchangeable. Preserve an applied item/order promotion's reached removal action and confirmation; do not invent manual-promotion removal inside the available-promotions accordion, where it is currently inactive.

Also design:

- Current price-list selector (“Lista: PUBLICO” by default), list options and the non-empty-cart confirmation before changing pricing context.
- “Cambiar precio”: “Desde lista” versus “Personalizado” with MXN input; loading/error/retry for list choices.
- Item discount: amount versus percentage and optional title.
- Global discount: percentage versus fixed MXN amount **per product**, optional title and “Aplicar a todos”. Include an informative example when some products are skipped; do not depict it as an arbitrary order-total discount.
- “Vaciar venta” confirmation, global-discount action and “Quitar descuentos” when relevant.
- “Promociones disponibles” expandable section with count, readable promotion/reward explanation, “Aplicar” actions and loading state.
- Inline quantity/stock-error visual example such as “Stock insuficiente. Disponible: N”. Display a predefined error state; do not enforce stock rules.

The totals region should clearly distinguish article/unit counts, subtotal, conditional discounts, applied order-promotion information and **“Total a cobrar”**. “Cobrar” is the main action, with empty-cart-disabled and processing examples. Avoid secondary information competing with the amount or action.

### 6. Customer and address

Customer assignment is optional for an ordinary fully paid sale, but needed for a sale with debt and an address is needed to enable home delivery. These are design-context states, not rules to code.

Design:

- “Cliente: Sin asignar” / “Asignar cliente”.
- Assigned-customer summary with name, selected address summary, “Cambiar” and “Quitar”.
- Two-step assignment sheet: search by name/email/phone, matching customer cards, selected state and “Nuevo cliente”; then “Dirección de envío”, existing addresses, selected address and “Nueva dirección”.
- Reached nested customer-creation form, consistent with the already-approved Customers UI: “Datos Básicos” and “Datos de Facturación” tabs. Basic fields: name, surname, country-code/phone, email, optional customer price-list assignment, pending addresses and comments. Billing fields: business/legal name, fiscal postal code, RFC, fiscal regime and an optional expandable billing address. These are existing profile fields, not a new tax-configuration or invoicing workflow.
- Reached “Añadir dirección” form: street, exterior/interior numbers, postal code, neighborhood, municipality/delegation, city, state and optional “Ubicación en el mapa”. Represent the map/pin using a static placeholder or predefined demo image; no geocoder, map service, live coordinates or external integration. Keep field errors, cancel/save/loading states and nested-form context visible. Do not invent extra mandatory fields or a customer-management redesign.
- Searching/loading, no matching customers, no saved addresses and inline assignment/address errors. Keep parent selection context understandable when a nested dialog is open.

### 7. Payment / checkout sheet

Design a readable checkout surface headed “Cobrar venta” with the total prominently visible and a persistent final-action area. It must work when many conditional sections coexist, including on tablet/mobile and in dark mode.

Include:

- Method tiles for “Efectivo”, credit/debit cards, transfer and configurable custom methods. Selected methods may have count badges.
- “Pagos agregados”: up to five payment-entry cards, including mixed methods and repeated entries. Each shows method, “Monto recibido”, removal and optional reference for card/transfer (“Referencia (opcional)”).
- No-method-selected state, input/error presentation and processing state.
- A conditional “Sesión de caja” selector for users who have access. Choosing an eligible own open session is explicit, not automatically imposed. Include loading/error/empty selection and an unlinked legacy option. If a previously selected session becomes unavailable, show a clear warning and explicit choose-another / “Cobrar sin vincular (legacy)” decision. Hide the normal selector for no-access examples without losing the binding-warning presentation. Use fictional session IDs, with “Anterior” / “Siguiente” and page/count information when several pages exist; do not invent session-management or search controls.
- Optional collapsed “Agregar fecha de vencimiento”, expanded date field and clear/reset affordance for resulting debt. This is the checkout date surface, not a new standalone debt editor.
- “Entrega a domicilio” toggle. Without assigned customer/address, show an unavailable state, explanation and “Asignar cliente” action; with an address, show the available/on state. No shipping-charge field.
- Footer summaries: “Recibido”, “Restante”, conditional “Cambio”, conditional “Deuda a generar”, inline errors and “Cancelar” / “Confirmar cobro”.
- Fully paid, mixed payment, cash with change, partial payment with debt and no-payment credit examples. When a debt example has no customer, show “Asigna un cliente para registrar una venta con deuda” with its assignment action. Represent permitted/blocked states using fixtures, not a rules engine.
- Clear pending/processing and disabled-action visuals, without simulated real payment calls.

### 8. Re-quote, confirmations and success

- A promotion-capacity change dialog: “Actualizamos los totales de tu venta”, explanation that a promotion's availability changed, revised subtotal/discount/total and “Promociones que ya no aplican”. Accepting revised values must visibly return to deliberate checkout confirmation, **never appear to charge automatically**. It is a required decision rather than a dismissible decorative toast.
- Clear remove-promotion, empty-sale and close-draft confirmations. Visually separate cancellation and destructive actions.
- “Cobro confirmado”: sale folio, total, paid amount, conditional change, conditional debt, “Pagado” / “Parcial” / “Crédito” state, confirmation date and “Cerrar”. This is feedback for creation, not the full Sale detail page. Do not add unrequested PDF/print actions.

### 9. Deliverable

Produce one coherent visual prototype covering the main workspace and all reached overlays, with representative predefined states easy to inspect. A separate clearly labeled **demo-state selector**, outside production navigation, is acceptable.

Prioritize: (1) populated desktop catalog/cart, (2) desktop checkout, (3) mobile catalog/cart/checkout, (4) nested dialogs and edge states. Show both light and dark variants, with a realistic dense example rather than only an ideal empty screen.

Keep data entirely fictional and static. **The result is a design reference. Do not implement any of the business functionality described above.**

## Screenshots to attach

Use fake/demo data or redact names, addresses, phone numbers, tokens, folios and transaction references before sharing.

Minimum useful set:

1. Desktop main workspace with populated catalog/cart, variants, price/discount/promotion metadata and totals; light and dark.
2. Desktop payment sheet with multiple methods and its footer; light and dark.
3. Mobile catalog with bottom cart affordance, cart drawer and payment sheet as separate images.
4. Customer assignment's two steps and variant-picker dialog.

Additional references when available:

- Empty cart versus empty catalog/search result; active category and low-stock product.
- Global/item discount and price-override dialogs; price-list confirmation.
- Available-promotions section, promotion removal confirmation and revised-totals dialog.
- Read-only product detail and nested customer/address forms.
- Payment: cash/change, partial debt/credit, missing customer/address, expanded due date, session selection/lost-binding warning and disabled/processing state.
- Paid and partial-debt success dialogs.

Do not invoke real checkout, create real customer/address records or force a live promotion race just to obtain screenshots. Use existing safe fixtures/previews or let v0 compose the missing states from this brief. Clearly label which screenshots are references and which examples are desired mock states.

## Repository evidence (not necessary to paste into v0)

- Foundation: `docs/design-system.md`, `src/core/shared/design-system/houndfe-theme.css`.
- Composition/drafts/mobile/shortcuts/re-quote: `src/features/POS/sales/views/SalesView.vue`, `components/SalesTabsStrip.vue`.
- Catalog: shared `ProductSearchPanel.vue`, `ProductSearchResults.vue`, `ProductSearchResultItem.vue`, `VariantPickerModal.vue`.
- Cart/discounts: Sales `ActiveSalePanel.vue`, `SaleItemRow.vue`, `SaleTotalsFooter.vue`, `SaleItemBadges.vue`, `PromocionesDisponiblesAccordion.vue`, `GlobalDiscountModal.vue`, `ItemDiscountModal.vue`, `PriceOverrideModal.vue`, `ProductDetailModal.vue`.
- Customer/address: `AssignCustomerSlideover.vue` and its reached shared forms.
- Checkout: `PaymentModal.vue`, reached `CashSaleSessionPicker.vue` and `DateFieldPopover.vue`, `PromotionCapacityRequoteModal.vue`, `PaymentSuccessModal.vue`.

Only visuals are proposed; existing production behavior and accepted shared components remain unchanged.
