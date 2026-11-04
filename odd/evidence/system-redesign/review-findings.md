# T4 design review findings (round 1)

Three read-only reviewers and a parent spot check looked at the contact sheets in `sheets/` and the full shots in `shots/`, named `<route>__<state>__<1440|390>__<light|dark>.png`.

Each finding is listed as `route — viewport/state — problem — probable source`. Paths are under `src/`.

## Cross-cutting copy and pattern rules

Apply these everywhere in your surfaces, not only on the screens named here.

- **Sentence case only.**
  - No Title Case in copy. Examples to fix: "Pagos Pendientes", "No Entregadas", "Nueva Venta", "Sin Stock", "Vender en Punto de Venta", "Nombre de la Promoción", "Valor del Descuento", "Condiciones Adicionales", "Recursos Humanos", "Entrega de Productos", "Venta Registrada", "Precio Unit".
  - No uppercase eyebrows or labels. Examples to fix: CLIENTE, LISTA DE PRECIOS, VENDEDOR, EXPIRA, RESUMEN, TOTAL, NOTAS, AGREGAR PROMOCIÓN, TOTAL A COBRAR, `MARCA · SKU`, FLOAT, PUBLICO.
  - Text that comes from data, such as a price-list name, is shown as stored. Only CSS `uppercase` and `tracking` are removed.
- **Neutral Mexican Spanish.**
  - Use "clic", not "click".
  - Use "Correo electrónico" as the label, not "Email".
  - Translate English jargon: FLOAT becomes "Fondo".
  - Make gender and number agree: write "Todas" for cotizaciones, "1 usuario", "1 permiso", and "Entregada" in the singular.
- **Not found is not an error.**
  - A detail route whose record does not exist (404) shows `EmptyState` kind empty, with `No encontramos <la venta|el producto|la ruta|…>` and one action to go back to the list.
  - Only a failed request shows kind error with Reintentar.
  - Never redirect away with a toast instead of showing the state.
- **Error copy.** Every error uses the shared `EmptyState kind="error"`, with a title, an optional description and Reintentar. Do not use a bold red one-line sentence, and never put "Reintenta." inside the text.
- **Skeletons.** Every loading state, including detail pages, panels and cards, is shaped like its final content: a header bar, section titles, rows or fields. A blank white box is not a skeleton.
- **Mobile detail pages.** The primary action moves to the sticky bottom bar. Titles never truncate to a few letters; let them wrap to 2 lines.
- **One primary per view.** Every other button is outline or ghost.
- **Ids.** Do not show ids or slugs as a row's secondary line. Folios are fine where they are the business identifier, but never as the main name.

## Shared (core) items

The shared table-fix writer owns items 1 to 4:

1. The raw server error title.
2. The mobile toolbar.
3. Mobile card skeletons.
4. The desktop filter on a second row, and the refresh button leaving the toolbar.

These items are for the second core pass:

5. `ToolbarSelectFilter` shows its name inside the control, for example `Estado · Todas`, everywhere. Today the tenants, employees, expiring documents, human decisions and promotions filters show only the value.
6. Table header band: some lists have a blue-tinted header (sales, customers, quotations, promotions, human-decisions, cash) and products does not. Use one neutral header style for all of them.
7. Pagination: "Mostrando 1-1 de 1" wraps at 1440 (`DataTablePagination.vue:52`). It must stay on one line.
8. Table overflow at 1440: products, employees-list and pending-approvals are clipped and the ⋮ overlaps cell text. The shared table-fix writer is investigating this.

## POS

- **pos-promotions, 1440, all states:** the 3 selects overflow and cover "Nueva promoción" (`POS/promotions/views/PromotionsView.vue:719-733`).
- **pos-promotion-create:**
  - At 390, "Aplicar automáticamente" overflows its radio card, the "Aplica a" segmented labels truncate, and the title wraps beside the header primary (`PromotionForm.vue` ~219-400).
  - There are two solid buttons, "Crear promoción" and "Agregar productos". Make "Agregar productos" outline.
- **pos-sale-detail:**
  - Empty and error redirect with a toast (`sales/composables/useSaleDetail.ts:44-47`). Show the states in place.
  - Loading is shapeless, and at 390 the header is missing (`SaleDetailView.vue:405`).
  - "Datos de la venta" uses tinted blue boxes. Make it a neutral read-only `<dl>`.
  - Fix "click para asignar" (`SaleDetailSalesDataCard.vue:78`); make it a real link or button "Asignar vendedor".
  - The status badge says "Entregados"; use the singular.
  - Use sentence case in the history labels.
  - The desktop title is about 17px; use 22px per the Detail header rule.
  - The products table on mobile is cramped (~11px). Show the lines as compact rows.
- **pos-sales-list:**
  - Title Case in the tabs and statuses (`SalesListTabs.vue:60,78`, `saleStatus.utils.ts:30`, `SalesListView.vue:247`).
  - The quick-filter tabs have no visible active state.
  - The counts "(4)" stay visible in the empty state.
  - The mobile payment-method chips are icon-only and need labels.
  - "Mostrando" wraps.
- **pos-sales-new:**
  - Uppercase "TOTAL A COBRAR" (`SaleTotalsFooter.vue:129`, `PaymentModal.vue:632`).
  - Uppercase brand line (`ProductSearchResultItem.vue:208-211`).
  - The "Buscar producto" label duplicates the placeholder.
  - The CTRL K hint shows on mobile; hide it.
  - The empty catalog has no description line.
  - In dark, the product image placeholders are bright grey tiles; use `--hf-surface-muted`.
  - At 390 the placeholder text is clipped, and the tab strip clips its "+" tab.
  - Cut the subtitle "Todo listo para tu próxima venta." (L21).
  - Use a single "Nuevo cliente" button in the customer search step (L21).
- **pos-cash-register:**
  - At 390 the task strip clips "Recepciones" (`cash-register/composables/useCashWorkspace.ts:50,92`, `CashRegisterView.vue:414`). Make it scrollable with a fade, or shorten the labels.
  - The "Tu turno" card is identical in all 4 states; give it a skeleton and an error state.
  - The error is a bold-red one-liner.
  - Drop the help paragraph "Elige una caja activa…" (`CashOpenSessionForm.vue:125-130`).
  - The h1 "Abrir un turno" does not match the breadcrumb "Caja".
  - The inline create form hangs under the table.
- **pos-cash-reception:**
  - FLOAT jargon (`CashCustodyDiscovery.vue:239`, `CashReceptionView.vue:131`).
  - The error repeats its title in the description.
  - At 1440 the summary card labels wrap.
  - The breadcrumb and the h1 differ.
  - Loading is shapeless.
- **pos-product-detail and pos-product-create:**
  - A 404 shows the error design, and "Guardar cambios" stays enabled during empty and error.
  - The mobile header reads only "Producto".
  - "Sin Stock" is Title Case and sits as a tiny eyebrow above the title. Show it as a StatusBadge in the meta line.
  - "Vender en Punto de Venta".
  - The Código de barras and SKU inputs fill only half their grid cell.
  - The summary says "0/3" but lists 4 items.
  - On mobile the primary stays in the header and the summary falls below the form.
- **pos-product-editorial:**
  - The 404 shows the error.
  - Loading is shapeless and shows an "Actualizando…" button.
  - The error is a bold red paragraph.
  - The dev copy "Publicación pendiente de habilitación del backend" is visible.
  - There is no product name and no back control.
  - An h1 "Espacio editorial" sits over an h2 "Contenido editorial" that has a subtitle.
  - Sources: `EditorialPublication.vue:109`, `EditorialWorkspace.vue:91,101,137`, `views/ProductEditorialView.vue:12`.
  - The "Iniciar borrador" panel (L18).
- **pos-products, 390:**
  - Card names are one line; the rule is a 2-line clamp.
  - The "$249.00 · 24 unidades en 2 variantes" line wraps to 3 lines; shorten it.
  - At 1440 the table overflows (shared item 8).
- **pos-quotation-detail:**
  - Error, empty and loading show the header "Nueva cotización" with "Previsualizar PDF" (`QuotationDetailView.vue:94`).
  - Uppercase eyebrows (`QuotationDetailView.vue:886,912,944,1065,1090,1117,1217`, `QuotationExpiryPicker.vue:143`, `QuotationTotalsFooter.vue:190,257`).
  - "Sin expiración" appears twice.
  - The title is about 17px; use 22px.
  - On mobile the text is tiny and there is no sticky Enviar bar.
- **pos-quotations-list:**
  - "Todos" should be "Todas" (`QuotationsListView.vue:126`).
  - The mobile status tabs wrap onto 2 rows.
  - There are two filter systems, the tabs and Filtros.
- **pos-customers:**
  - The avatar and name are blue-tinted; make them neutral (`CustomersView.vue:615`).
  - Mobile has a Filtros button but desktop has none; drop it if the list has no filters.
  - The phone is unformatted; format it with the existing util if there is one.
- **pos-human-decisions:**
  - The error is a bold red line.
  - The select needs its Estado prefix (shared item 5).
  - Remove the ⋮ that holds only "Ver detalle" (L14).
  - Check that the Solicitud column identifies the request (L14).

## Admin and HR

- **admin-employees-list, 1440:**
  - The table overflows (Modalidad and Fecha de ingreso are clipped, the ⋮ overlaps) (`admin/employees/composables/useEmployeeColumns.ts`). Cap it at 8 columns and move the rest to the detail.
  - The content sits about 8px off from other routes (`EmployeesListView.vue` ~332).
- **admin-employees-pending-approvals:**
  - The Solicitada column is clipped (`usePendingApprovalsColumns.ts:71`).
  - The toolbar disappears in empty, loading and error (`PendingApprovalsView.vue:333 :show-toolbar="queueNonEmpty"`). Keep it.
  - The skeleton has the wrong column count.
  - Dates repeat the current year with a zero-padded day, and a same-day range shows twice. Use `formatShortDateTime` and collapse same-day ranges (`useEmployeeColumns.ts:96-101` `formatTimeOffDate`).
- **admin-employee-detail, 390:**
  - The header is broken: the job line is cut to "D", the title is cut, and the primary sits in the header.
  - The tabs are clipped with no affordance (`components/EmployeeDetailHeader.vue:61-77`, `views/EmployeeDetailView.vue:208`).
  - The stat cards leave an orphan third card, and the figures are right-aligned (`components/ResumenPanel.vue:54`).
  - The empty 404 shows a connection-error message (`EmployeeDetailView.vue:188`).
- **admin-employees-expiring-documents:**
  - "Vencido" is shown in the warning tone; make it danger with urgent.
  - The title "Documentos por vencer" disagrees with the navigation "Vencimientos". Align them on one name: "Documentos por vencer" everywhere.
  - Dates repeat the year.
- **admin-payment-details:** the "Sin cuenta activa" banner sits above the page title, so the title jumps between states, and it repeats the empty state (`AdminPaymentDetailsView.vue:221`). Move it inside the surface, and hide it when the list is empty (L20).
- **admin-roles:**
  - "1 usuarios" and "1 permisos" need plural agreement (`AdminRolesView.vue:351`).
  - The mobile Filtros button does nothing when there are no filters; hide it.
- **admin-tenants:**
  - The slug is the secondary line (an id-like value) (`AdminTenantsView.vue:315,359`). Use the address or phone, or nothing.
  - The mobile footer starts with a lone "—".
- **admin-tenant-members:**
  - The mobile footer repeats the role and the name.
  - The page has no context for the tenant: give it a back link to Sucursales and the tenant name in the title (`AdminTenantMembersView.vue:217,360`).
- **admin-users:** the avatar shows one initial for a single-word name. That is acceptable.

## Shell, dashboard and others

- **Navigation:** "Dashboard" is English (`app/navigation/navigation.landing.ts:22`, `app/composables/useBreadcrumb.ts:42`). Rename it to "Resumen".
- **Shell:** rebind the `--shell-*` hex palette to `--hf-*` (L24).
- **dashboard:**
  - In the error state, 5 red alerts show at once. When the summary fails, show one page-level error; the panels may show a compact inline error (`analytics/views/BranchSalesSummaryView.vue:332`).
  - The last x label of the chart is clipped, and the y ticks repeat ("$0.2k" twice) (`BranchSalesTrendChart.vue`).
  - The trend skeleton is blank.
  - The footnote shows ISO dates and "(Hasta excluyente)". Use human dates (`branchSalesTimeseries.utils.ts:224`, `BranchSalesTrendChart.vue:90`).
  - The header scatters the date range; align the title, period control and range.
  - At 390, "Ticket promedio" is an orphan card, and the trend tabs are clipped with no scroll affordance.
  - The empty state is a tall empty box with no next step, and the chart still shows "$0k" ticks.
  - Use EmptyState `actionLoading` for the retry (L22).
- **pos-delivery-route-detail:**
  - "En ruta 496 h 2 min" (`delivery-routes/utils/delivery-route-detail.utils.ts:72`). Above 24h show days, or the start date.
  - Not found shows the error design.
  - At 390 the error has the raw server subtitle (`DeliveryRouteDetailView.vue:355,412`).
  - The back link duplicates the breadcrumb.
  - At 390 the ⋮ sits alone on its own row.
  - The progress card has no visible bar.
  - The skeleton is plain boxes.
  - The cockpit's current stop goes from warning to info; add an info class (L23, L26).
- **procurement-purchase-orders and procurement-suppliers:**
  - The empty state is a plain "No hay…" line with an enabled pager, and the suppliers copy reads "para esta búsqueda" when there are no records.
  - The mobile empty state has a dashed border.
  - Fix: pass `emptyState` and `filtered`, and hide the pager when there are 0 rows (`procurement/suppliers/components/SupplierList.vue:60`, `procurement/purchase-orders/components/PurchaseOrderList.vue:56`).
  - The supplier loading refresh button shows only a spinner.
- **public-catalog and public-catalog-branch:**
  - Loading and error are bare text. Use skeleton cards and `EmptyState kind="error"`, and show one combined error instead of the two at once (`catalog/components/CatalogProductGrid.vue:49,126`, `CatalogCategoryBar.vue:79`).
  - The PUBLICO price-list select is uppercase and takes its own row on mobile (`CatalogPriceContextSelector.vue:53,75`).
  - On mobile the logo is oversized, the branch name truncates, and the footer lines are far apart (`CatalogHeader.vue:89`).
  - Show "Limpiar búsqueda" only when there is a search (L24).
- **sistema-notification-config:**
  - "Recursos Humanos" (`system/notifications/registry/action-registry.ts:42`).
  - The loading skeleton is blank boxes.
- **system-catalog-settings:**
  - The label is doubled: the heading "Listas de precios públicas" sits over "Listas visibles" (`CatalogPriceContextsField.vue:117-122`).
  - On an untouched form, the empty state shows the same validation error twice (`CatalogSettingsForm.vue:97`, `catalogSettingsMappers.ts:82-85`).
  - Loading and error keep an empty footer bar.
- **login:**
  - "Iniciar sesión" sits tight against the label.
  - The logo is left-aligned.
  - The card changes height between states.
  - In dark, the loading button text has low contrast.
  - "Email" should be "Correo electrónico" (`auth/login/views/LoginView.vue:149`, `components/LoginForm.vue`).
- **select-tenant, 390 dark:**
  - "Continuar" looks disabled.
  - The single row shows no selected state (`TenantSelectionView.vue:44`).
  - Check that removing the role pill does not lose information the user needs (L24).
- **403 and 404 at 1440:** the content floats in a huge blank canvas, there is no brand mark, and the gap between the buttons is uneven (`errors/views/ForbiddenView.vue:20`, `NotFoundView.vue`).

## Data gaps (not design defects)

These screens have no rows in the dev DB, so their data state could not be reviewed:

- suppliers and purchase orders
- payment methods and payment details
- promotions
- human decisions
- cash reception
- the turno card

The BE was asked to seed them. Recapture these screens once the data is there.
