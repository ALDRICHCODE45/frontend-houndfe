# UI polish leftovers

Five pre-existing design defects found during the address design-gap check (odd/tasks/sale-address-change-notice.md L10), fixed in one pass against design/system.md, verified with Playwright in light and dark, 1440 and 390.

## Specs
- S1 «Crear ruta de entrega» (EligibleSalesPicker) shows sale dates in the app's short style («6 nov»), not «06/11/2026».
- S2 The driver field in the route create/edit slideover shows the chosen driver's name once.
- S3 The «Seleccionado» badge in the POS customer picker is legible (design-system badge size).
- S4 A disabled primary button («Guardar cambios» in the customer editor, and any primary button sharing that style) looks disabled in dark mode too.
- S5 Warning text across the app uses the design-system warning token, never the UI library's default yellow (about 14 places; rule recorded in design/system.md L10).

## Tasks
- [ ] T1 S1-S5 Fix the five defects with tests where behaviour changes, before/after screenshots — worker

## Log
- L1 User (2026-11-06): «Si hermano, por favor. Adelante.» — to fixing, in a separate pass: «En «Crear ruta» las fechas salen como 06/11/2026 en vez de «6 nov». El campo de repartidor muestra el nombre dos veces. El badge «Seleccionado» es muy chico. En modo oscuro, el botón deshabilitado «Guardar cambios» parece habilitado. Hay unos 14 avisos más con el amarillo de la librería.»
