# T4 design review findings: round 2

Round 2 recapture (594 shots) and the review that followed. Round 1 is in review-findings.md; its cross-cutting rules still apply. Most of round 1 is FIXED. These are the findings that remain or are new.

Each item is `route — viewport/state — problem — source`. Paths are under `src/`.

T10 re-check (design pass 2, 2026-11-05): each item was checked again in the browser against BE :3003 (admin, Sucursal Centro; shots in odd/evidence/design-pass-2/t10/shots, git-ignored) and carries its status in bold. «Still open» items lie outside the T10 edit surfaces and are listed in the T10 return.

## Shared (core)

- **C1. Name column width.** At 1440, tables split width evenly (`houndfe-ui.css:213-215`, `max-width: 0`), so names are cut while other columns have room. This affects products, employees, pending approvals, expiring documents and promotions. Give the primary (name) column priority with an opt-in. The default is the first data column after select; `meta: { primary: true }` overrides it. That column gets `min-width: 16rem`, and the other columns shrink first. A status badge cell never truncates. **T10 (2026-11-05): Already fixed (L39, hf-col-primary). Seen on products 1440. Still open on Ventas 1440: the primary column falls on «Venta» (#17, ~330px) while client names clip to «Sergio Quint…»; `useSalesColumns.ts` needs `meta.primary` on Cliente (sales feature, outside T10).**
- **C2. Table skeleton.** It sits in an inner bordered box with 5 rows and no header, so the surface is taller than the data and the layout jumps. In dark the bars are faint. The skeleton should keep the real header row, show `min(pageSize, 5)` rows with no inner border, and use readable bar contrast in dark. **T10 (2026-11-05): Already fixed (L39). Products loading, 1440 dark: real header, 5 rows, no inner border, visible bars.**
- **C3. `.hf-ui .hf-figure { text-align: right }`** (`houndfe-ui.css:308`) also right-aligns figures in stat cards. Scope the right alignment to table cells and keep it out of cards. **T10 (2026-11-05): Already fixed (L39). Employee Resumen stat cards are left-aligned.**
- **C4. Status tones.** "Borrador" is warm on purchase orders and blue on quotations. Drafts are neutral everywhere. Payment-method chips (Efectivo green, Transferencia amber) are neutral, because they are not states. Add a guard spec. Mapping utils that map a draft to anything but neutral fail it. **T10 (2026-11-05): Already fixed (L39). PO and quotation «Borrador» are neutral; sales payment chips are neutral.**

## POS (sales, cash, customers)

- sale-detail, loading: still blank white boxes, and the header band is empty at 1440 and 390 (`POS/sales/views/SaleDetailView.vue:302`). Make the header and sections skeleton-shaped. **T10 (2026-11-05): Already fixed. Sale detail loading (1440, 390) has a shaped header band and section skeletons.**
- sale-detail, 390: Totales comes before Productos. Show Productos first. **T10 (2026-11-05): Already fixed. Productos comes first at 390.**
- sales-list, loading and error: the counts "(0)" still show (`SalesListTabs.vue:53,84`). Hide them unless there is data. **T10 (2026-11-05): Already fixed. No «(0)» while loading or on error.**
- sales-list, 1440: a blank select column of about 130px with no bulk actions (`useSalesColumns.ts:32`). Remove it when there are no bulk actions, or make it a 40px checkbox. Client names and the "No entregada" badge are clipped (C1). **T10 (2026-11-05): Select column removed and the badge fits. Still open: client names clip (see C1, sales feature).**
- sales-list, 390: the payment chips are colored (C4). **T10 (2026-11-05): Already fixed. Neutral outline chips.**
- cash-register, 390: the task strip sits after the content and has no fade. Put it at the top with a fade. **T10 (2026-11-05): Already fixed. Apertura · Sesiones · Recepciones lead at 390.**
- cash-register: the "Tu turno" card is identical in all 4 states. `CashWorkspaceShiftCard.vue:81-100` supports loading and error, but the view does not pass them. Its no-selection state reads "Elige una caja para abrir tu turno" (L33). **T10 (2026-11-05): Already fixed. «Aún no hay un turno en foco · Elige una caja para abrir tu turno».**
- cash-reception: subtitle, section heading and empty title stack three text levels. Keep one. **T10 (2026-11-05): Already fixed (T3). The empty page shows the page title and one empty state.**

## POS (products, promotions, quotations)

- product-detail, 390: "Guardar cambios" appears twice, solid in the header and in the bottom bar (`ProductDetailView.vue:2030` and `:2611`). On mobile only the bottom bar keeps it. The title is cut to "Croquetas…"; let it wrap. **T10 (2026-11-05): Already fixed. One bottom «Guardar» at 390, and the title wraps. New, still open: on a saved product with no edits, the 1440 header «Guardar cambios» is a solid enabled primary (products view, outside T10).**
- quotation-detail, 1440: the mobile action bar shows on desktop, so there are two solid "Enviar cotización" buttons. The scoped `.quotation-action-bar { display: grid }` overrides `lg:hidden` (`QuotationDetailView.vue:1278`, `:1468`). **T10 (2026-11-05): Already fixed. One «Enviar cotización» at 1440.**
- quotation-detail: "Sin expiración" still appears twice (`QuotationExpiryPicker.vue:67,94,154`). **T10 (2026-11-05): Already fixed. «Sin expiración» appears once. New, still open: the expiry date is said four times (header «Expira…», the date field, the text beside «Quitar expiración», «Válida hasta…»); quotations feature, outside T10.**
- quotation-detail, 390: "Enviar cotización" wraps in the bar. Shorten it to "Enviar" or let the bar fit. **T10 (2026-11-05): Already fixed. «Enviar», one line, 44px.**
- quotations-list: "Borrador" is blue (C4). **T10 (2026-11-05): Already fixed. Neutral.**
- product-editorial, empty (404): still the error design. `ProductEditorialView.vue` has no not-found branch. **T10 (2026-11-05): Already fixed. A bad id shows «No encontramos el producto» with «Volver a productos».**
- product-editorial:
  - The dev line "Ciclo editorial: Sin iniciar · Sin borrador" (`EditorialWorkspace.vue:162`) is still there. **T10 (2026-11-05): Already fixed. The dev line is gone (T8 redesign).**
  - h1 over h2 (`:96`). **T10 (2026-11-05): Already fixed. h1 is the product name, h2 is «Contenido».**
  - The content is capped at 1100px and centered, so it starts about 47px right of other pages (`:203`). Align it with the page column. **T10 (2026-11-05): Already fixed. No 1100px cap; the content follows the page column.**
  - "Consultar y cargar borrador" stays visible beside Reintentar in the error state. **T10 (2026-11-05): Already fixed. The error shows only «Reintentar» (that button no longer exists after T8).**
- products, 1440: the stock badge is cut ("24 unidades en 2 va…") (`productStatusConfig.utils.ts:57`). Shorten it to "24 · 2 variantes". **T10 (2026-11-05): Already fixed. Short stock badges; nothing clipped at 1440.**
- promotions:
  - Name column (C1). **T10 (2026-11-05): Already fixed (name has priority). New, still open: at 1440 «Creada» clips to «4 no» and the plural reads «Quedan 1 unidades» (promotions, outside T10).**
  - Dates read "1 de sep 2026" with the current year (`promotionDate.utils.ts:21`). Use the short format. **T10 (2026-11-05): Already fixed. «6 ago», «13 nov».**
  - The "Sin límite" badge on every row is noise; show only limits. **T10 (2026-11-05): Already fixed. «—» when there is no limit.**
  - The select-all checkbox column has no bulk actions; remove it. **T10 (2026-11-05): Still open by decision (L42). The column backs bulk delete for users who can delete; hiding it without that permission is the open follow-up (promotions).**
- promotion-create:
  - Permanent italic help lines ("Elige los productos…", "La promoción deja de aplicarse…") go against the text diet. Move them to the field or cut them. **T10 (2026-11-05): Already fixed. The permanent italic help lines are gone.**
  - The chatbot availability error is plain text; make it an inline error with retry. **T10 (2026-11-05): Already fixed in code (L42, inline alert in PromotionForm). Not reproduced in the browser.**
- product create and detail, 390: the tab labels "Presentaciones" and "Contenido" touch. **T10 (2026-11-05): Already fixed. The tabs are spaced and the strip scrolls at 390.**

## Admin and HR

- employee-detail, 390: the tab strip still cuts "Compen…". Make the strip scrollable, with padding at its end and a fade. **T10 (2026-11-05): Already fixed. A scrollable strip with an end fade.**
- employee-detail: the stat figures are right-aligned in their cards (C3, `ResumenPanel.vue:55,66,72`). **T10 (2026-11-05): Already fixed (C3).**
- employee-detail error, and 5 other detail views: "Revisa tu conexión e inténtalo de nuevo" assumes a cause (`EmployeeDetailView.vue:264`). Use a neutral line. **T10 (2026-11-05): Already fixed. «No pudimos obtener los datos del colaborador.»**
- expiring-documents: "Vencido" carries no measure. Show "Vencido hace 142 días" (`useExpiringDocuments.ts:59`). On mobile the card title should clamp to 2 lines (`ExpiringDocumentsView.vue:231-246`). **T10 (2026-11-05): Already fixed. «Vencido hace 144 días», and 2-line titles.**
- pending-approvals:
  - On mobile the footer "5 jun · 1 día" sits beside "9 oct, 13:16" with no label. Label them as "Solicitada 9 oct, 13:16", or keep only one. **T10 (2026-11-05): Already fixed. «Solicitada 4 nov, 14:56».**
  - The Estado column repeats "Pendiente" on every row of an all-pending queue. Hide it (`usePendingApprovalsColumns.ts`). **T10 (2026-11-05): Already fixed (L40).**
- payment-details, 390: an unlabeled 18-digit CLABE, and the legal name repeated on every card (`AdminPaymentDetailsView.vue:372`). Label it "CLABE ···· 1234" (masked) and drop the repeated holder. **T10 (2026-11-05): Fixed with a correction (L40). It is labelled «CLABE» and shown in full, because read-only roles must read it; the repeated holder is gone.**
- tenants, 1440: Dirección and Teléfono are "—" on every row (`AdminTenantsView.vue:321-326`). Hide columns that are empty for every row. **T10 (2026-11-05): Already fixed. The columns show because the branches now have data; the empty-column rule is in place (L40).**
- tenants, mobile: the footer is a lone date with an empty left side. **T10 (2026-11-05): Already fixed. The phone shows on the left when present, and «Creada …» on the right.**

## Shell, dashboard and others

- dashboard, error: still 5 red boxes when everything fails. When the summary fails, show ONE page-level error and do not render the trend and panels at all. Only when the summary loads and a panel fails does that panel show its compact inline error. Remove "Reintenta en unos segundos" from the text. **T10 (2026-11-05): Already fixed. One page-level error with «Reintentar» when the summary fails.**
- dashboard, 390: the 3 panels sit in a 2-column grid with an orphan card; use one column. In the empty state the tab strip sits over "Sin movimiento"; hide the tabs when there is no data. **T10 (2026-11-05): Already fixed. One column at 390; with no data the metric tabs are hidden. New, still open: at 390 the range control's white pill sits on «Últimos 7 días» while «Este mes» is the active text (dashboard, outside T10).**
- public-catalog and branch, dark error: dark maroon with dark-red text, nearly unreadable. The light rebind does not set `--hf-danger-soft` and `--hf-danger-border` (`catalog/styles/catalog.css:111-123`). **T10 (2026-11-05): Already fixed in code (catalog.css rebinds --hf-danger-soft and --hf-danger-border). The public catalog did not take the stored dark theme in the T10 harness, so dark was not reproduced.**
- public-catalog-branch, 390: the price-list select has lost its "Lista de precios" name (`CatalogPriceContextSelector.vue:53,75`). **T10 (2026-11-05): Already fixed. It reads «Lista · PUB…» with its name (the value truncates at 390).**
- public-catalog-branch, empty: the "Todas 0" chip, the "0 productos" badge and the search show over an empty list. **T10 (2026-11-05): Already fixed in code (the chips render only when `!catalogEmpty`). The empty catalog was not reproduced in the browser.**
- public-catalog, 390: the logo is still large, and the footer lines are far apart. **T10 (2026-11-05): Already fixed. A smaller logo; the footer is tighter.**
- routes list and detail, 1440: content inset about 20px more than other lists (`DeliveryRoutesListView.vue:423`, `DeliveryRouteDetailView.vue:386`, `md:px-10`). Align it with the shared page gutter. **T10 (2026-11-05): Already fixed (L43). The title aligns at 320 like other lists. New, still open: at 1440 «Progreso» clips to «0/» and «Inicio» to «5 nov, 17:2» (delivery-routes, outside T10).**
- routes list, loading and error: the toolbar loses "Columnas", and the Estado filter shows "Todas (0)" (`DeliveryRoutesListView.vue:116`). **T10 (2026-11-05): Already fixed. «Columnas» stays; «Estado · Todas» has no «(0)».**
- routes list, 390: the search placeholder is cut to "folio o no…". **T10 (2026-11-05): Already fixed. «Buscar rutas…».**
- routes detail:
  - At 1440 the "← Rutas de entrega" back link duplicates the breadcrumb; remove it from md up. **T10 (2026-11-05): Already fixed. No back link at 1440 (it stays at 390).**
  - The activity timeline repeats the year ("14 oct 2026 · 13:56") (`DeliveryRouteTimeline.vue`). **T10 (2026-11-05): Already fixed. «5 nov, 17:23».**
  - At 390 the meta line leaves a dangling "·". **T10 (2026-11-05): Already fixed. «Activa  Creada 17:23  Iniciada 17:23».**
- procurement-purchase-orders: "8 avisos" counts sub-fields. Count one per issue family, as in the checklist (`PurchaseOrderList.vue:77,103`, `utils/order-presentation.ts:10`). "Borrador" is warm (C4). **T10 (2026-11-05): Already fixed. «N avisos» counts issue families (BE checklistItemCount, L50), and «Borrador» is neutral.**
- procurement-suppliers, 390: the name is on one line; clamp it to 2 (`SupplierList.vue:88`). **T10 (2026-11-05): Already fixed. 2-line names.**
- sistema-notification-config, dark: the off switches are almost invisible, which fails non-text contrast (`MasterToggle.vue:54`, `ActionRow.vue`). **T10 (2026-11-05): Fixed here (T10). The off switch now lives in core for every .hf-ui switch (houndfe-ui.css, hf-switch-off.spec), and the notifications copy is removed. Checked in dark on Notificaciones, and on Productos (Ocultar precios, Mayoreo, Requerir receta).**
- system-catalog-settings:
  - On an untouched form, the helper "Sin listas públicas…" and a red banner say the same thing (`CatalogSettingsForm.vue:97`). Keep one. **T10 (2026-11-05): Not reproduced: the dev data has two public lists, so the form shows no banner; the no-list case was not produced (it would need a save).**
  - The decorative blue-tinted panels ("Publicado", the stock explanation) break balanced color; make them neutral. **T10 (2026-11-05): Already fixed. Neutral panels.**
  - At 390 the "Lista predeterminada" label is lighter than its siblings. **T10 (2026-11-05): Already fixed. Same weight as its siblings.**
- 403/404: "Volver" is about 32px tall next to the 44px "Ir al inicio". Match the heights (`ForbiddenView.vue:26-37`, `NotFoundView.vue`). **T10 (2026-11-05): Already fixed. Both buttons are 44px on 403 and 404.**
- login, error: the banner floats below the card; put it inside the card, above the button. **T10 (2026-11-05): Already fixed. The banner sits inside the card, above «Ingresar» (checked with a mocked 401).**

## Not defects

- The bright sales-new image tiles are seeded image files with baked-in text.
- Two status filters on quotations-list: a user question (L32).
- No human-decisions rows are seeded.
- The select-tenant empty, loading and error states are not captured.
