# Owner ideas batch — new sale from the customer page, bulk actions, toggle-chip filters, page size on the customer page, full table state in the URL

## Specs
- S1 Owner (2026-11-27, verbatim): «despues de eso, revisamos las ideas que dejamos para despues.» Choices (structured question): «"Nueva venta" desde la ficha del cliente», «Acciones masivas en Clientes», «Filtros con etiquetas tocables», «Cantidad por página en la ficha»; URL: «Sí, que quede todo en la URL».
- S2 «Nueva venta» desde la ficha del cliente: «Botón en la ficha que abre una venta nueva con ese cliente ya elegido. Hoy no existe esa preselección; es un flujo nuevo.»
- S3 Acciones masivas en Clientes: «Seleccionar varios clientes → «Estados de cuenta PDF» y «Exportar CSV». Seguramente necesita algo del backend para el PDF masivo.» (design: design/customers-module/01-tabla-y-filtros.html shows the selection bulk bar).
- S4 Filtros con etiquetas tocables: «Los filtros de opciones (especie, tamaño, zona…) como etiquetas en lugar de menús desplegables. Cambia el componente compartido: aplica a Ventas, Clientes y Cotizaciones.» (design/system.md `HfToggleChips`; docs/design-system.md: filters are toggle chips, aria-pressed).
- S5 Cantidad por página en la ficha: «Selector 5–50 recordado en Ventas, Cotizaciones y Cobros de la ficha del cliente (hoy fijos en 10, 10 y 50).» Same shared options and memory as odd/tasks/page-size-memory.md.
- S6 URL: «Un enlace compartido abre la tabla exactamente igual (filtros, orden, página, búsqueda). Ahora es seguro gracias al arreglo del adaptador.» Applies to Ventas, Clientes, Cotizaciones (today `urlSync: false`; adapter fixed in style-cleanup U7). Saved views must keep working (customers-module L15 race must not come back).

## Tasks
- [ ] T1 S6 urlSync back on for Sales, Customers, Quotations with saved views clean — worker A
- [ ] T2 S4 Toggle chips in the shared filters component — worker B
- [ ] T3 S5 Page size selector + memory on the customer page pagers — worker C
- [ ] T4 S2 «Nueva venta» from the customer page (preselected customer) — worker D (map first; stop if backend needed)
- [ ] T5 S3 Bulk actions: backend contract (batch statements PDF, CSV export of the filter) → implementation — parent ↔ backend, then worker
- [ ] T6 Full suite, preview, owner check, merge — parent

## Log
- L1 Owner choices (2026-11-27) S1. Small pending merged to main first.
- L2 T4 map (explore mwzjmujw-r-w1jb): no query param and no backend change; reuse the quotation-to-sale handoff (`useConvertQuotationToSale.ts:189-212`: seed `saleQueryKeys.drafts` with the sale, write `POS_ACTIVE_TAB_STORAGE_KEY`, `router.push('/pos/ventas/nueva')`; SalesView opens the requested tab, `SalesView.vue:310-372`). Flow: `POST /sales/drafts` → `PUT /sales/drafts/:id/customer {customerId}`. Backend answers (session 01a217ad-71d6): POST needs create:Sale (sales.controller.ts:56-61), PUT customer needs update:Sale (:152-161); assigning the customer applies its globalPriceListId when no explicit list was set (sales.service.ts ~:2984-2996) — a fresh draft gets the customer's list; DELETE /sales/drafts/:id (204) needs delete:Sale (:140-150). Decision (parent): button for read+create+update:Sale; if assignment fails after create → delete the empty draft when the user has delete:Sale, otherwise leave it (it shows in the POS tabs) and say so; stay on the customer page with the mapped Spanish error.
