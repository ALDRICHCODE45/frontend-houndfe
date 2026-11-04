# T4 design review findings: round 2

Round 2 recapture (594 shots) and the review that followed. Round 1 is in review-findings.md; its cross-cutting rules still apply. Most of round 1 is FIXED. These are the findings that remain or are new.

Each item is `route — viewport/state — problem — source`. Paths are under `src/`.

## Shared (core)

- **C1. Name column width.** At 1440, tables split width evenly (`houndfe-ui.css:213-215`, `max-width: 0`), so names are cut while other columns have room. This affects products, employees, pending approvals, expiring documents and promotions. Give the primary (name) column priority with an opt-in. The default is the first data column after select; `meta: { primary: true }` overrides it. That column gets `min-width: 16rem`, and the other columns shrink first. A status badge cell never truncates.
- **C2. Table skeleton.** It sits in an inner bordered box with 5 rows and no header, so the surface is taller than the data and the layout jumps. In dark the bars are faint. The skeleton should keep the real header row, show `min(pageSize, 5)` rows with no inner border, and use readable bar contrast in dark.
- **C3. `.hf-ui .hf-figure { text-align: right }`** (`houndfe-ui.css:308`) also right-aligns figures in stat cards. Scope the right alignment to table cells and keep it out of cards.
- **C4. Status tones.** "Borrador" is warm on purchase orders and blue on quotations. Drafts are neutral everywhere. Payment-method chips (Efectivo green, Transferencia amber) are neutral, because they are not states. Add a guard spec. Mapping utils that map a draft to anything but neutral fail it.

## POS (sales, cash, customers)

- sale-detail, loading: still blank white boxes, and the header band is empty at 1440 and 390 (`POS/sales/views/SaleDetailView.vue:302`). Make the header and sections skeleton-shaped.
- sale-detail, 390: Totales comes before Productos. Show Productos first.
- sales-list, loading and error: the counts "(0)" still show (`SalesListTabs.vue:53,84`). Hide them unless there is data.
- sales-list, 1440: a blank select column of about 130px with no bulk actions (`useSalesColumns.ts:32`). Remove it when there are no bulk actions, or make it a 40px checkbox. Client names and the "No entregada" badge are clipped (C1).
- sales-list, 390: the payment chips are colored (C4).
- cash-register, 390: the task strip sits after the content and has no fade. Put it at the top with a fade.
- cash-register: the "Tu turno" card is identical in all 4 states. `CashWorkspaceShiftCard.vue:81-100` supports loading and error, but the view does not pass them. Its no-selection state reads "Elige una caja para abrir tu turno" (L33).
- cash-reception: subtitle, section heading and empty title stack three text levels. Keep one.

## POS (products, promotions, quotations)

- product-detail, 390: "Guardar cambios" appears twice, solid in the header and in the bottom bar (`ProductDetailView.vue:2030` and `:2611`). On mobile only the bottom bar keeps it. The title is cut to "Croquetas…"; let it wrap.
- quotation-detail, 1440: the mobile action bar shows on desktop, so there are two solid "Enviar cotización" buttons. The scoped `.quotation-action-bar { display: grid }` overrides `lg:hidden` (`QuotationDetailView.vue:1278`, `:1468`).
- quotation-detail: "Sin expiración" still appears twice (`QuotationExpiryPicker.vue:67,94,154`).
- quotation-detail, 390: "Enviar cotización" wraps in the bar. Shorten it to "Enviar" or let the bar fit.
- quotations-list: "Borrador" is blue (C4).
- product-editorial, empty (404): still the error design. `ProductEditorialView.vue` has no not-found branch.
- product-editorial:
  - The dev line "Ciclo editorial: Sin iniciar · Sin borrador" (`EditorialWorkspace.vue:162`) is still there.
  - h1 over h2 (`:96`).
  - The content is capped at 1100px and centered, so it starts about 47px right of other pages (`:203`). Align it with the page column.
  - "Consultar y cargar borrador" stays visible beside Reintentar in the error state.
- products, 1440: the stock badge is cut ("24 unidades en 2 va…") (`productStatusConfig.utils.ts:57`). Shorten it to "24 · 2 variantes".
- promotions:
  - Name column (C1).
  - Dates read "1 de sep 2026" with the current year (`promotionDate.utils.ts:21`). Use the short format.
  - The "Sin límite" badge on every row is noise; show only limits.
  - The select-all checkbox column has no bulk actions; remove it.
- promotion-create:
  - Permanent italic help lines ("Elige los productos…", "La promoción deja de aplicarse…") go against the text diet. Move them to the field or cut them.
  - The chatbot availability error is plain text; make it an inline error with retry.
- product create and detail, 390: the tab labels "Presentaciones" and "Contenido" touch.

## Admin and HR

- employee-detail, 390: the tab strip still cuts "Compen…". Make the strip scrollable, with padding at its end and a fade.
- employee-detail: the stat figures are right-aligned in their cards (C3, `ResumenPanel.vue:55,66,72`).
- employee-detail error, and 5 other detail views: "Revisa tu conexión e inténtalo de nuevo" assumes a cause (`EmployeeDetailView.vue:264`). Use a neutral line.
- expiring-documents: "Vencido" carries no measure. Show "Vencido hace 142 días" (`useExpiringDocuments.ts:59`). On mobile the card title should clamp to 2 lines (`ExpiringDocumentsView.vue:231-246`).
- pending-approvals:
  - On mobile the footer "5 jun · 1 día" sits beside "9 oct, 13:16" with no label. Label them as "Solicitada 9 oct, 13:16", or keep only one.
  - The Estado column repeats "Pendiente" on every row of an all-pending queue. Hide it (`usePendingApprovalsColumns.ts`).
- payment-details, 390: an unlabeled 18-digit CLABE, and the legal name repeated on every card (`AdminPaymentDetailsView.vue:372`). Label it "CLABE ···· 1234" (masked) and drop the repeated holder.
- tenants, 1440: Dirección and Teléfono are "—" on every row (`AdminTenantsView.vue:321-326`). Hide columns that are empty for every row.
- tenants, mobile: the footer is a lone date with an empty left side.

## Shell, dashboard and others

- dashboard, error: still 5 red boxes when everything fails. When the summary fails, show ONE page-level error and do not render the trend and panels at all. Only when the summary loads and a panel fails does that panel show its compact inline error. Remove "Reintenta en unos segundos" from the text.
- dashboard, 390: the 3 panels sit in a 2-column grid with an orphan card; use one column. In the empty state the tab strip sits over "Sin movimiento"; hide the tabs when there is no data.
- public-catalog and branch, dark error: dark maroon with dark-red text, nearly unreadable. The light rebind does not set `--hf-danger-soft` and `--hf-danger-border` (`catalog/styles/catalog.css:111-123`).
- public-catalog-branch, 390: the price-list select has lost its "Lista de precios" name (`CatalogPriceContextSelector.vue:53,75`).
- public-catalog-branch, empty: the "Todas 0" chip, the "0 productos" badge and the search show over an empty list.
- public-catalog, 390: the logo is still large, and the footer lines are far apart.
- routes list and detail, 1440: content inset about 20px more than other lists (`DeliveryRoutesListView.vue:423`, `DeliveryRouteDetailView.vue:386`, `md:px-10`). Align it with the shared page gutter.
- routes list, loading and error: the toolbar loses "Columnas", and the Estado filter shows "Todas (0)" (`DeliveryRoutesListView.vue:116`).
- routes list, 390: the search placeholder is cut to "folio o no…".
- routes detail:
  - At 1440 the "← Rutas de entrega" back link duplicates the breadcrumb; remove it from md up.
  - The activity timeline repeats the year ("14 oct 2026 · 13:56") (`DeliveryRouteTimeline.vue`).
  - At 390 the meta line leaves a dangling "·".
- procurement-purchase-orders: "8 avisos" counts sub-fields. Count one per issue family, as in the checklist (`PurchaseOrderList.vue:77,103`, `utils/order-presentation.ts:10`). "Borrador" is warm (C4).
- procurement-suppliers, 390: the name is on one line; clamp it to 2 (`SupplierList.vue:88`).
- sistema-notification-config, dark: the off switches are almost invisible, which fails non-text contrast (`MasterToggle.vue:54`, `ActionRow.vue`).
- system-catalog-settings:
  - On an untouched form, the helper "Sin listas públicas…" and a red banner say the same thing (`CatalogSettingsForm.vue:97`). Keep one.
  - The decorative blue-tinted panels ("Publicado", the stock explanation) break balanced color; make them neutral.
  - At 390 the "Lista predeterminada" label is lighter than its siblings.
- 403/404: "Volver" is about 32px tall next to the 44px "Ir al inicio". Match the heights (`ForbiddenView.vue:26-37`, `NotFoundView.vue`).
- login, error: the banner floats below the card; put it inside the card, above the button.

## Not defects

- The bright sales-new image tiles are seeded image files with baked-in text.
- Two status filters on quotations-list: a user question (L32).
- No human-decisions rows are seeded.
- The select-tenant empty, loading and error states are not captured.
