# Premium tables

Upgrade every data table in the system: drag-and-drop column reordering, pin any column left or right, resizable column widths, and an overall more premium feel. Design directions come first on the canvas; implementation follows the chosen direction.

## Specs
- S1 Columns can be reordered by drag and drop (with a keyboard-accessible alternative).
- S2 Any column can be pinned to the left or to the right, and unpinned.
- S3 Column widths can be changed by the user.
- S4 Tables feel much more premium overall (details to be agreed on the canvas).
- S5 It applies to all tables in the system.

## Tasks
- [x] T1 Map the current table stack and inventory; research premium table UX patterns — explorers
- [ ] T2 Design directions on the canvas (design/premium-tables/) and agree one with the user — parent
- [ ] T3+ Implementation plan after the direction is chosen

## Log
- L1 User (2026-11-07): «Bien hermano, ahora.. no estoy en casa, ya me meti al sistema y me gusta todo, me gusta mucho la ui, pero quiero llevar las tablas al siguiente nivel, todas las tablas del sistema quiero que sean mucho mejores, quiero que sean drag and drop, que pueda pinear cualquier columna a la derecha o a la izquierda, que pueda cambiar el ancho de las columnas, en general, que las tablas se sientan muchoo mas "premium" me sigues?? y quiero dejarte haciendo eso por favor. me ayudas?? revisa ejemplos, patrones de ux/ui, todo lo que te pueda servir, dame opciones en el canvas y conversamos, vale?»
- L2 Explorer map: 26 lists on AppDataTable (UTable 4.6, TanStack 8.21.3) + 11 hand-written <table>s. UTable already takes columnOrder, columnPinning, columnSizing (+ options) and styles pinned offsets with data-pinned, but never applies column widths and has no resize handler (Nuxt UI issue #6715). AppDataTable passes pinning/visibility only; useTablePreferences persists {pinning, visibility} per persistKey (about 15 tables). Conflicts with current rules: auto-layout fit (max-width:0, 7rem floor, 40% name column, hf-data-table-fit.spec.ts), docs/design-system.md:159 «do not add [visibility/pinning] to every table», :88 no density toggle. 11 plain tables and ~11 lists without persistKey.
- L3 Research (sources in the explorer result): header drag is an accelerator (NN/g), keyboard path via header menu / columns panel; MUI X: pinned columns reorder only by repin; pinned edge border + shadow on scroll; resize handle on separator hover, double-click autofit, Alt+←/→; Linear-style personal layouts saved automatically with «Restablecer»; density presets 40/48/56; mobile: cards for lookup, pinned identifier + horizontal scroll for comparison; TanStack columnOrder applies to centre columns only.
- L4 Canvas design/premium-tables/: 01-menus-refinados (Linear-like, header ⋯ menu + Columnas panel), 02-grid-de-poder (Airtable/AG Grid, views, totals, autosize), 03-manipulacion-directa (Notion-like, drag headers and freeze bars).
- L5 Artboards written by three workers (01 and 02 stalled once generating one huge file and were resumed writing in parts); all three smoke-tested headless (drag, pin left/right, resize, keyboard paths, theme, 390 view, no console errors, no network) and checked by the parent in light/dark. Canvas opened; waiting for the user's choice.
