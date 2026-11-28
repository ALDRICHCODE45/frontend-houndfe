# Mobile tables, filters sheet and slideovers

## Specs
- S1 Owner (2026-11-28, verbatim): «note algo que no me gusto nadaa: [6 capturas] y es que la version mobile de todo esto nuevo se ve HORRIBLEE, se ve muy mal, los slideovers se ven mal, la seccion de filtros se ve mal (es la que peor se ve), el indicador de paginas (que esta hasta abajo de la tabla) se ve mal, se corta. en general la verdad es que no me gusta la ui de la tabla en mobile.»
- S2 Bugs seen in the screenshots (407×851, customers list): (a) the toolbar «Filtros» bottom sheet renders empty bordered boxes — only «Ordenar: Nombre · A–Z» appears, no filter controls, inner boxes with a broken left rounded border; (b) the pager under the table overflows to the right (« ‹ 1 2 3 4 5 … 9 › » cut, «»» clipped), the «5 por página» select stretches full width; (c) the «Nuevo cliente» slideover on mobile floats with side gaps, nested section cards (Contacto, Precios), footer buttons not full width and the panel bottom cut.
- S3 Design: the owner dislikes the mobile table UI overall (cards with the selection circle outside the card, truncated names, little information). Proposals first (design/mobile-tables/), owner chooses, then implement for the shared table infrastructure (AppDataTable mobile cards, DataTableToolbar sheets, pager) so every list benefits.

## Tasks
- [ ] T1 S2 Fix the mobile bugs (filters sheet empty, pager overflow, mobile form slideover layout) — worker
- [x] T2 S3 Mobile table design proposals — worker (design files only)
- [ ] T3 Owner chooses; implement the chosen direction — worker(s)
- [ ] T4 Full suite, preview, owner check, merge — parent

## Log
- L1 Owner S1 after approving bulk actions (merged bb565a65).
- L2 T2 design (worker mwzutpuh-10-y73y): design/mobile-tables/ — 01 A lista densa, 02 B tarjetas ricas, 03 filtros y orden + formulario en hoja, 04 estados y 360 px (390 px boards; self-checks: tokens only, ≥ 44px targets, no overflow at 360/390, safe-area footers; screenshots checked by the worker). Proposed: docked bulk bar on mobile, compact pager «‹ 1 / 9 ›», full-height filters sheet with «Ver N resultados».
