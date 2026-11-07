# Premium tables

Upgrade every data table in the system: drag-and-drop column reordering, pin any column left or right, resizable column widths, and an overall more premium feel. Design directions come first on the canvas; implementation follows the chosen direction.

## Specs
- S1 Columns can be reordered by drag and drop: whole header drags with a live drop line; keyboard Alt+Shift+←/→ and «Mover a la izquierda / derecha» in the column menu; moves announced in Spanish («Columna Total movida a la posición 3 de 10»).
- S2 Any column can be pinned left or right and unpinned from its ⋯ menu or the «Columnas» panel; pinned columns stay sticky with offsets from current widths; the pinned edge shows a divider and shadow only while scrolled; the selection and Acciones columns are locked at the edges and cannot be moved.
- S3 Column widths change by dragging the header's right edge (8px handle, min/max per column, width tooltip while dragging), double-click autofits, Alt+←/→ resizes, and the menu has «Ajustar ancho al contenido» and «Restablecer ancho».
- S4 Premium feel, from artboard 01: grip and ⋯ appear on header hover/focus; the ⋯ menu has Ordenar ascendente/descendente, Fijar a la izquierda/derecha or Desfijar, Mover, Ajustar ancho, Restablecer ancho, Ocultar columna; a «Columnas» panel with «Fijadas a la izquierda», «Columnas», «Fijadas a la derecha», draggable rows, pin buttons, visibility switches and «Restablecer columnas»; density Compacta 40 / Normal 48 / Cómoda 64; layout saved automatically per user and table with «Guardado en tu vista»; bulk bar when rows are selected.
- S5 Totals row (from 02) on money tables (Ventas, Compras, Caja, Reembolsos): fixed at the bottom with the count and the sums, switching to the selected rows when there is a selection.
- S6 Saved views as tabs (from 02): per table, personal (stored in the browser) with «Guardar vista» and «Restablecer»; Ventas ships «Todas», «Cobranza», «Entregas».
- S7 Scope: the 26 AppDataTable lists get everything; hand-written tables that are data lists migrate to AppDataTable; small tables inside forms or details stay simple with the same premium styling.
- S8 Mobile (390): cards as today, no drag/resize on touch; «Columnas» opens a sheet with visibility switches that also drive the card fields.
- S9 The design system (design/system.md, docs/design-system.md) and its guard specs are updated to the new rules: user-set widths, pinning/density/columns panel on every list, horizontal scroll when the layout exceeds the surface.

## Tasks
- [x] T1 Map the current table stack and inventory; research premium table UX patterns — explorers
- [x] T2 Design directions on the canvas and agree one — parent — 57fb885d; chosen 01 + totals and views from 02 (L6)
- [ ] T3 S2,S3,S9 Foundation in AppDataTable: versioned persisted layout {order, pinning, sizing, visibility, density} per persistKey, fixed layout widths, resize handle/autofit/keyboard, pinned edge shadow, locked select/actions — worker
- [ ] T4 S1,S4 Header renderer: grip + ⋯ column menu, drag reorder with drop line, keyboard paths, live announcements — worker
- [ ] T5 S2,S4,S8 «Columnas» panel (three groups, drag, pin, visibility, reset) and mobile sheet — worker
- [ ] T6 S4 Density control, «Guardado en tu vista», bulk bar polish — worker
- [ ] T7 S5 Totals row API in AppDataTable; Ventas, Compras, Caja, Reembolsos — worker
- [ ] T8 S6 Saved views tabs; Ventas first — worker
- [ ] T9 S7 Roll out to every list (persistKey for all, actions id), migrate list-like plain tables, restyle small ones — workers
- [ ] T10 S9 Design system docs and guards, browser checks (light/dark, 1440/390), full suite — parent + workers

## Log
- L1 User (2026-11-07): «Bien hermano, ahora.. no estoy en casa, ya me meti al sistema y me gusta todo, me gusta mucho la ui, pero quiero llevar las tablas al siguiente nivel, todas las tablas del sistema quiero que sean mucho mejores, quiero que sean drag and drop, que pueda pinear cualquier columna a la derecha o a la izquierda, que pueda cambiar el ancho de las columnas, en general, que las tablas se sientan muchoo mas "premium" me sigues?? y quiero dejarte haciendo eso por favor. me ayudas?? revisa ejemplos, patrones de ux/ui, todo lo que te pueda servir, dame opciones en el canvas y conversamos, vale?»
- L2 Explorer map: 26 lists on AppDataTable (UTable 4.6, TanStack 8.21.3) + 11 hand-written <table>s. UTable already takes columnOrder, columnPinning, columnSizing (+ options) and styles pinned offsets with data-pinned, but never applies column widths and has no resize handler (Nuxt UI issue #6715). AppDataTable passes pinning/visibility only; useTablePreferences persists {pinning, visibility} per persistKey (about 15 tables). Conflicts with current rules: auto-layout fit (max-width:0, 7rem floor, 40% name column, hf-data-table-fit.spec.ts), docs/design-system.md:159 «do not add [visibility/pinning] to every table», :88 no density toggle. 11 plain tables and ~11 lists without persistKey.
- L3 Research (sources in the explorer result): header drag is an accelerator (NN/g), keyboard path via header menu / columns panel; MUI X: pinned columns reorder only by repin; pinned edge border + shadow on scroll; resize handle on separator hover, double-click autofit, Alt+←/→; Linear-style personal layouts saved automatically with «Restablecer»; density presets 40/48/56; mobile: cards for lookup, pinned identifier + horizontal scroll for comparison; TanStack columnOrder applies to centre columns only.
- L4 Canvas design/premium-tables/: 01-menus-refinados (Linear-like, header ⋯ menu + Columnas panel), 02-grid-de-poder (Airtable/AG Grid, views, totals, autosize), 03-manipulacion-directa (Notion-like, drag headers and freeze bars).
- L5 Artboards written by three workers (01 and 02 stalled once generating one huge file and were resumed writing in parts); all three smoke-tested headless (drag, pin left/right, resize, keyboard paths, theme, 390 view, no console errors, no network) and checked by the parent in light/dark. Canvas opened; waiting for the user's choice.
- L6 User: «Si, creo que la 1 sumandole lo mejor de la dos es la mejor opcion hermano.» Then chose from 02: «Fila de totales (Recomendado), Vistas guardadas en pestañas (Recomendado)»; for the 11 hand-written tables: «Migrar las listas, dejar las chicas simples (Recomendado)». Artboard 01 is the visual spec; 02 contributes the totals row and the view tabs; 03 is an alternative.
