# Mobile tables, filters sheet and slideovers

## Specs
- S1 Owner (2026-11-28, verbatim): «note algo que no me gusto nadaa: [6 capturas] y es que la version mobile de todo esto nuevo se ve HORRIBLEE, se ve muy mal, los slideovers se ven mal, la seccion de filtros se ve mal (es la que peor se ve), el indicador de paginas (que esta hasta abajo de la tabla) se ve mal, se corta. en general la verdad es que no me gusta la ui de la tabla en mobile.»
- S2 Bugs seen in the screenshots (407×851, customers list): (a) the toolbar «Filtros» bottom sheet renders empty bordered boxes — only «Ordenar: Nombre · A–Z» appears, no filter controls, inner boxes with a broken left rounded border; (b) the pager under the table overflows to the right (« ‹ 1 2 3 4 5 … 9 › » cut, «»» clipped), the «5 por página» select stretches full width; (c) the «Nuevo cliente» slideover on mobile floats with side gaps, nested section cards (Contacto, Precios), footer buttons not full width and the panel bottom cut.
- S3 Design: the owner dislikes the mobile table UI overall (cards with the selection circle outside the card, truncated names, little information). Proposals first (design/mobile-tables/), owner chooses, then implement for the shared table infrastructure (AppDataTable mobile cards, DataTableToolbar sheets, pager) so every list benefits.

- S4 Owner choices (2026-11-28, structured question): style «Mixto (Recomendado)» — «A · Lista densa para Clientes, Productos y Cotizaciones; B · Tarjetas ricas para Ventas (total, pagado y saldo juntos).»; dense rows «Sí, sacarlo (Recomendado)» — «Las acciones quedan en la ficha y en el modo selección; filas más limpias.»; sort «Menú corto solo de orden (Recomendado)» — «Un toque rápido para ordenar; los filtros siguen en su hoja.»; mobile default page size «10 (Recomendado)» — «Carga rápido y la paginación queda a mano.» Boards: design/mobile-tables/01 (A), 02 (B), 03 (filters sheet + form sheet), 04 (states).

## Tasks
- [x] T1 S2 Fix the mobile bugs (filters sheet empty, pager overflow, mobile form slideover layout) — worker
- [x] T2 S3 Mobile table design proposals — worker (design files only)
- [x] T3a Owner chooses (S4)
- [ ] T3 S4 Implement the chosen direction in the shared table infrastructure — worker
- [ ] T4 Full suite, preview, owner check, merge — parent

## Log
- L1 Owner S1 after approving bulk actions (merged bb565a65).
- L2 T2 design (worker mwzutpuh-10-y73y): design/mobile-tables/ — 01 A lista densa, 02 B tarjetas ricas, 03 filtros y orden + formulario en hoja, 04 estados y 360 px (390 px boards; self-checks: tokens only, ≥ 44px targets, no overflow at 360/390, safe-area footers; screenshots checked by the worker). Proposed: docked bulk bar on mobile, compact pager «‹ 1 / 9 ›», full-height filters sheet with «Ver N resultados».
- L3 T1 (worker mwzutpqv-z-03aq): reproduced in a real browser (Playwright responsive harness, mocked API, 360/390/407). (a) Filters sheet empty: views pass their desktop toolbar row (`CustomersView.vue:747`, `SalesListView.vue:344`) whose `flex-1 min-w-0 overflow-hidden` region shrank to ~20px inside the sheet → `.hf-filters-sheet__body` stacking rule (houndfe-ui.css) + embedded groups/FilterSectionCard as sections with separators (no nested cards). (b) Pager: below sm range + auto-width size on one row, numbered UPagination hidden, compact « ‹ Página N de M › » 44px nav. (c) Side inset slideovers full-screen below 640px (vite.config.ts compoundVariants), form overlay footers full-width with safe area, HfSectionCard flattened in form overlays on phones. Playwright spec RED 4/4 → GREEN 5/5 (+ desktop 1280 unchanged); jsdom 16/16; core/shared 1556, customers 831, related 4412; type-check (+responsive) clean. `test:responsive:conformance` fails on stale harness expectations (dt01 dashboard owner, undeclared /notifications/unread-count) — pre-existing, not from this change. Remaining: filters bottom sheet still inset/85vh (T3 replaces it per board 03).
