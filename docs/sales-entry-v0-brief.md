# Sales-entry visual redesign — v0 brief

Copy the complete prompt below into v0 and attach the screenshots listed afterward. It is self-contained: the external designer needs no other documents or knowledge of our application internals. Do not share credentials or real customer/payment data.

## Copy-ready prompt

Design a complete, high-fidelity **new-sale / point-of-sale workspace for Houndfe**, a retail business application. You are an external designer. All visual rules and required screen content are supplied in this brief; no other documents are available or required. I am attaching screenshots to explain the existing workflow. Redesign its composition, hierarchy and visual presentation according to the rules below.

**This is a UI/UX design task, NOT a functional implementation task.** The functionality described below is context so that you can design the correct controls, information hierarchy and states. Do not implement it.

### 1. Scope and non-negotiable boundaries

- Redesign sale creation: product discovery, simultaneous sale drafts, cart, customer/address assignment, discounts, promotions, checkout/payment and its supporting windows.
- Treat screenshots as evidence of existing capabilities, terminology and content, **not as a layout you must reproduce exactly**. Improve grouping, density, hierarchy and ergonomics without deleting capabilities.
- Keep surrounding navigation shown in screenshots as context. Do not redesign the sidebar/navigation, Sales listing/detail, standalone customer management/history, quotations or cash-register management. Customer/address forms used within sale creation follow the visual rules supplied here.
- Do not invent receipt printing, tax configuration, shipping charges, payment-terminal integrations, hardware barcode scanning or extra POS/business features. Barcode is a supported search term, not an integrated device flow.
- The “Pedido” mode is currently disabled. Preserve it only as unavailable context if useful; do not turn it into a working feature. Do not expose dormant functionality.
- Use fictional sample content and predefined totals, discounts, balances, change, stock and statuses. **Do not calculate them or implement business functionality.**
- Do not process payments, save customer records, connect external services or request credentials. The result is a visual proposal, not a working point-of-sale system.
- If useful for presenting the design, allow only simple preview interactions: open/close windows, switch between sample screens/themes and expand sections. Business rules are context for which information and states must be visible, not work to implement.
- Your deliverable is design only. Our team will handle construction and integration separately after the visual proposal is approved.

### 2. Explicit visual rules

Build an operational workspace for a cashier who needs to find products, review a sale and charge quickly. Not a marketing page, a dashboard of KPI cards or a generic SaaS template. The identity is calm, precise retail software: restrained blue actions, a small gold accent and neutral, clearly separated working surfaces.

**These written rules take precedence over legacy styling visible in screenshots.** Screenshots explain content and workflow; do not copy conflicting colors or typography from them.

#### Palette: light and dark are an equally complete pair

| Visual role               | Light     | Dark      | Use                                                             |
| ------------------------- | --------- | --------- | --------------------------------------------------------------- |
| Page background           | `#f5f6f8` | `#0e1520` | Quiet canvas behind the working areas                           |
| Main surface              | `#ffffff` | `#192332` | Catalog/cart areas, panels, forms and floating windows          |
| Secondary surface         | `#e7eef7` | `#202e43` | Quieter grouped information and supporting summaries            |
| Main text                 | `#24313d` | `#edf2fa` | Product names, labels, data and amounts                         |
| Headings                  | `#173968` | `#edf2fa` | Titles and clear hierarchy                                      |
| Supporting text           | `#576574` | `#adbcd0` | Descriptions, metadata and helper text                          |
| Borders                   | `#dce2e8` | `#354459` | Subtle separation and field outlines                            |
| Primary action background | `#2442f6` | `#91b0ff` | Main action in a task area                                      |
| Text on primary action    | `#ffffff` | `#132344` | Always paired with its matching background                      |
| Gold accent               | `#f6bb13` | `#f6bb13` | Small brand accents, not the default color for actions/statuses |

Do not paint every badge or button blue. Selection, discounts, payment status, warning, success and destructive actions must remain distinguishable. Status feedback needs explicit words/icons as well as color; decorative gold is not a substitute for a legible warning. Keep success, warning, error and information visually distinct and accessible in both themes without changing their meaning.

#### Typography and monetary information

- Typeface: **Manrope**, with a readable system sans-serif fallback.
- One dominant workspace title: 28–32px, weight 600, line-height approximately 1.25.
- Section titles: 16–18px, weight 600; do not compete with the main title.
- Operational text: 14–16px. Supporting text: 12–14px. Never shrink important amounts, labels or errors to fit more content.
- Use stronger size/weight for the final total and restrained emphasis for subtotals and metadata. Keep prices and totals aligned for quick comparison, using tabular numerals.
- UI copy: neutral Mexican Spanish, sentence case, concise and explicit. Preserve domain labels such as “Cobrar”, “Cliente”, “Descuentos” and “Total a cobrar”.
- Currency: **MXN**, displayed in Mexican format such as `$1,250.00`. Do not change the meaning or precision of the sample amounts.

#### Spacing, surfaces and controls

- Spacing scale: **4, 8, 12, 16, 24, 32px**. Use small gaps for related elements and larger gaps between different tasks.
- Surface/card corner radius: **12px**. Control corner radius: **6px**.
- Controls should have a **44px minimum height or touch area**. Compact icons may be visually smaller without making their hit areas difficult to use.
- Group meaningful tasks, not every label in its own card. Avoid excessive nesting, giant empty panels, gradients, heavy shadows and decorative badges.
- Fields need a visible label, a single clear outline/surface, readable helper/error text and obvious focus. A placeholder is not a substitute for a label.
- Give the main action in each task area the strongest emphasis; supporting actions stay quieter. Destructive actions require explicit wording and a distinct confirmation design.
- Use one consistent family of simple outline icons, with consistent weight and sizing. Explain icon-only actions with accessible names/tooltips; no decorative icons pretending to be actions.

#### States, responsiveness and accessibility

- Clearly distinguish normal, hover, keyboard focus, persistent selection, disabled and processing states. Hover alone must not imply selection.
- Distinguish initial loading, background updating, empty data, no search matches, failure and success. Include realistic long names, multiple cart items and overflowing content.
- Apply this same visual language to every window, dropdown, date selector, menu and tooltip, including nested windows. Dark mode must not leave light-only or legacy-colored content behind.
- Keep totals and charge/confirmation actions visible while long content scrolls. On narrow screens, fit the workflow without page-level horizontal overflow or hiding essential information.
- Target contrast: **4.5:1 for normal text**, **3:1 for large text and necessary non-text indicators**. Choosing a palette alone does not demonstrate compliance.
- Keep keyboard focus visible, labels understandable and statuses readable without color alone. Motion is optional, restrained and must not delay a cashier's action; respect reduced-motion preferences.
- Sale creation needs its own purposeful composition. Do not force it into a generic data-table layout or invent a dashboard/context rail.

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
- An in-sale read-only “Detalle del producto” dialog: image, name/variant, category, brand, description, SKU and stored barcode; price/price-list, stock and location summaries; variant rows with active selection. Include loading, error and missing-value examples. “Ir al producto” is a visual placeholder, not a new product-editor flow.
- Catalog-loading skeleton, truly empty catalog, “Sin resultados” for a query and retry/error states where applicable. Do not make every empty state look identical.

### 5. Cart and pricing context

Provide an empty cart (“Tu venta está vacía”) and a populated cart.

Each item needs room for image/placeholder, product and variant names, unit price, original/discounted price when applicable, quantity control, line monetary information and removal. Include a discreet menu for “Ver detalles”, “Cambiar precio”, “Agregar descuento” / “Quitar descuento” and “Eliminar producto”.

Use compact, readable metadata for price origin (“Precio lista” / “Precio manual”), item discount, promotion title and reward information. Applied promotions and ordinary discounts are not interchangeable. Show the existing removal action/confirmation for applied item/order promotions; do not invent a removal action in the available-promotions section, where only “Aplicar” is currently available.

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
- A customer-creation form following the same visual rules supplied in this brief: “Datos Básicos” and “Datos de Facturación” tabs. Basic fields: name, surname, country-code/phone, email, optional customer price-list assignment, pending addresses and comments. Billing fields: business/legal name, fiscal postal code, RFC, fiscal regime and an optional expandable billing address. These are existing profile fields, not a new tax-configuration or invoicing workflow.
- An “Añadir dirección” form: street, exterior/interior numbers, postal code, neighborhood, municipality/delegation, city, state and optional “Ubicación en el mapa”. Represent the map/pin using a static placeholder or predefined demo image; no geocoder, map service, live coordinates or external integration. Keep field errors, cancel/save/loading states and nested-form context visible. Do not invent extra mandatory fields or a customer-management redesign.
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
- Fully paid, mixed payment, cash with change, partial payment with debt and no-payment credit examples. When a debt example has no customer, show “Asigna un cliente para registrar una venta con deuda” with its assignment action. Represent permitted/blocked states using predefined visual examples; do not implement the rules.
- Clear pending/processing and disabled-action visuals, without simulated real payment calls.

### 8. Re-quote, confirmations and success

- A promotion-capacity change dialog: “Actualizamos los totales de tu venta”, explanation that a promotion's availability changed, revised subtotal/discount/total and “Promociones que ya no aplican”. Accepting revised values must visibly return to deliberate checkout confirmation, **never appear to charge automatically**. It is a required decision rather than a dismissible decorative toast.
- Clear remove-promotion, empty-sale and close-draft confirmations. Visually separate cancellation and destructive actions.
- “Cobro confirmado”: sale folio, total, paid amount, conditional change, conditional debt, “Pagado” / “Parcial” / “Crédito” state, confirmation date and “Cerrar”. This is feedback for creation, not the full Sale detail page. Do not add unrequested PDF/print actions.

### 9. Deliverable

Produce one coherent visual redesign covering the main workspace and all described windows, with representative predefined states easy to inspect. A separate clearly labeled **demo-state selector**, outside production navigation, is acceptable.

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

Do not invoke real checkout, create real customer/address records or force a live promotion race just to obtain screenshots. Use safe previews with fictional sample content or let v0 illustrate missing states from this brief. Clearly label which screenshots are references and which examples are desired mock states.
