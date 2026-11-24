# Sales history redesign — customer history and seller report (direction A)

Owner asked to redesign the customer sales history (`CustomerSalesHistorySlideover`) and the seller sales report (`src/features/admin/users/seller-report`). Design: `design/sales-history/` (commits dc5de98b, e4ca4167); the owner handed off direction A from the canvas. B, C are alternatives; 04 is the mobile/states board for A.

## Specs
- S1 Owner: «lo que te quiero pedir es un rediseno de la parte del historial de ventas con el cliente y de la parte del historial de ventas con un colaborador». Pains chosen: «Se ve viejo o distinto al resto», «Cuesta leer la información», «Faltan datos o acciones», «Se ve mal en el celular». Colaborador = «Sí, ese reporte del vendedor».
- S2 Handoff: «Implement the design artboard design/sales-history/01-tabla-expandible.html» — «A · Tabla con detalle expandible (recomendada)»: «Igual que la lista de Ventas: franja de métricas, filtros junto a la lista y columnas alineadas que comparan montos rápido; la fila se abre con datos y productos (una petición GET /sales/:id por fila abierta).» «Use the artboard as the visual spec: map its parts to the project's existing components and styles, and do not copy the artboard HTML verbatim. Take colors, typography, spacing, radius and shadows from design/system.md».
- S3 Mobile: `design/sales-history/04-movil-y-estados.html` — at 390 rows become cards, no sideways scroll, 44 px targets, states (loading, empty, pet without sales, pet deleted, error with retry, customer with debt, long names, period without sales, row-limit error, invalid date range, updating, PDF download failed).
- S4 Only data the frontend already receives. Every artboard item tagged «requiere backend» is NOT built (no placeholder, no tag in production); the list goes to the backend separately. Seller report keeps its contract: no sums, re-sorting or reclassifying in the browser; every money total comes from the backend.
- S5 Keep existing behavior: customer pet filter chips and KPIs customer-wide (odd/tasks/customer-pets.md S6), seller date range and PDF download, current payment-status labels of each screen (unifying them is an open owner decision).

## Tasks
- [ ] T1 S1-S5 Customer sales history redesign (panel width, metric strip, filters by the list, aligned table, expandable row with GET /sales/:id detail and products/pet per line, «Abrir venta» / «Cobrar», mobile cards and states) + shared expandable sale detail — worker A
- [ ] T2 S1-S5 Seller report redesign with the same pattern (reuses T1's row detail) — worker B (after T1)
- [ ] T3 Verification, full suite, browser 390/1440, merge — parent

## Log
- L1 Owner (2026-11-24) answers: pains (all four), «Sí, ese reporte del vendedor», «Propuestas de diseño primero (Recomendado)»; then handed off 01-tabla-expandible.html from the canvas.
- L2 Asked the backend whether GET /sales combines paymentStatus/deliveryStatus with customerId (+petId) and which aggregates narrow.
