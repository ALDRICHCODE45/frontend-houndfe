# UI polish leftovers

Five pre-existing design defects found during the address design-gap check (odd/tasks/sale-address-change-notice.md L10), fixed in one pass against design/system.md, verified with Playwright in light and dark, 1440 and 390.

## Specs
- S1 «Crear ruta de entrega» (EligibleSalesPicker) shows sale dates in the app's short style («6 nov»), not «06/11/2026».
- S2 The driver field in the route create/edit slideover shows the chosen driver's name once.
- S3 The «Seleccionado» badge in the POS customer picker is legible (design-system badge size).
- S4 A disabled primary button («Guardar cambios» in the customer editor, and any primary button sharing that style) looks disabled in dark mode too.
- S5 Warning text across the app uses the design-system warning token, never the UI library's default yellow (about 14 places; rule recorded in design/system.md L10).

## Tasks
- [x] T1 S1-S5 Fix the five defects with tests where behaviour changes, before/after screenshots — worker

## Log
- L1 User (2026-11-06): «Si hermano, por favor. Adelante.» — to fixing, in a separate pass: «En «Crear ruta» las fechas salen como 06/11/2026 en vez de «6 nov». El campo de repartidor muestra el nombre dos veces. El badge «Seleccionado» es muy chico. En modo oscuro, el botón deshabilitado «Guardar cambios» parece habilitado. Hay unos 14 avisos más con el amarillo de la librería.»
- L2 T1 done (worker). S1 EligibleSalesPicker shows confirmedAt with formatShortDateTime («6 nov, 12:17»); a sale with only a due date keeps dd/mm/yyyy. S2 DriverPicker's chip with ✕ repeated the selected name; removed (driver is required on create, edit cannot unassign). S3 «Seleccionado» is now the shared StatusBadge (info tone, 24px, 12px/600) with aria-label «Cliente seleccionado»; feature colour override removed. S4 finding: «Guardar cambios» in the customer editor is never disabled (only loading disables it), so it looked enabled because it is; the shared disabled primary, however, was nearly identical to the outline button in dark mode → dark-only rule dims the label (~4:1); light unchanged. S5 cause: `.hf-ui` bound primary and error to tokens but left `--ui-warning` on the library yellow; one binding `--ui-warning: var(--hf-warning)` (same pattern as 441f71e0) moves every text-warning / color="warning" / bg-warning/N to the token (light #805511, dark #f2cb71); new guard hf-warning-token.spec.ts (binding, AA contrast both themes, no text-yellow-*/text-amber-*); the two older guards stop forbidding the warning binding as they did for error. No dev data writes (the S3 draft PUT was answered in the browser). 1042 related tests, 521 CSS/test-id specs, type-check 0; 44 before/after screenshots in odd/evidence/ui-polish-leftovers/ (PNGs locally excluded). Open: whether «Guardar cambios» should stay disabled until something changes (behaviour change, not made).
- L3 Close: full suite 830 files / 14578 tests, build 0. Merged to local main.
