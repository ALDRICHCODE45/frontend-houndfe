# Catalog settings in rows and selection without checkboxes

Redesign Sistema › Catálogo online after artboard design/catalog-settings/01-ajustes-en-filas.html, and write the design-system rule «Selección sin checkboxes» (board 04).

## Specs
- S1 «el primero me gusta mucho, creo que es el que elijo» — the catalog settings screen follows artboard 01 «Ajustes en filas»: centred column (~880px), sections «Publicación», «Precios que ve el público», «Stock en el catálogo», each setting a row (label + description left, control right); publication row with a whole-row switch and an effective-status line (visible / «No visible: …» with the server warnings); one row per price list with a «Pública» switch and, on public rows, a «Predeterminada» radio (one selected, badge on the default row); stock mode as four radio cards with the exact copy and preview line, «Mostrar cantidad fija» reveals «Cantidad a mostrar»; sticky save bar «Sin cambios para guardar» / «Cambios sin guardar» / saving / «Guardado» with «Actualizado …». Mobile 390: one column, sticky bottom bar.
- S2 «la propuesta para el system design esta bien. adelante.» — docs/design-system.md and design/system.md gain the rule «Selección sin checkboxes» from board 04: switch row, radio card, selectable rows with mark, toggle chips, segmented control, table row selection (round 24px mark in a 44px area, Space selects), «Cómo elegir» and the accessibility checklist.
- S3 No classic checkbox on the catalog settings screen.
- S4 Behaviour kept: same API and save contract (catalogPublished, publicPriceListIds, catalogDefaultPriceListId, stockPresentationDefault), read-only view for users without update permission, default must be public, at least one public list warning; when the default stops being public the first other public list becomes the default with a notice (artboard decision, owner accepted the artboards).

## Tasks
- [ ] T1 S1,S3,S4 Catalog settings screen in rows — worker
- [x] T2 S2 Design-system rule «Selección sin checkboxes» — parent
- [ ] T3 S1-S4 Browser check (1440/390, light/dark), full suite, handoff implemented — parent

## Log
- L1 User: «por el momento me parece que esta bien, sin embargo quiero abordar otro tema de la ui, son dos cosas, una puntual y otra me parece interesante incluirla en el system design: [Image#3] en la imagen puedes ver el diseno actual del apartado de configuracion del "CAtalogo en linea" pero el diseno actual es muy mal, es malisimo, no me gusta nada la verdad, quisiera mejorarlo, y quiero aprovechar para agregar algo al system design que no me gusta en todo el sistema, y es el hecho de que no quiero que haya "checkboxes" tipicos porque siento que no son accesibles para el usuario, son dificiles de clickear y no me gustan nada, quiero que en su lugar haya alternativas mas modernas. te lo dejo a tu criterio, espero las propuestas para la pantalla de configuracion del catalogo en linea por favor.»
- L2 Canvas design/catalog-settings/: 01-ajustes-en-filas, 02-vista-previa-en-vivo, 03-estado-primero, 04-regla-sin-checkboxes (board).
- L3 User: «el primero me gusta mucho, creo que es el que elijo, y la propuesta para el system design esta bien. adelante.» Chosen artboard 01 (02 and 03 are alternatives); board 04 approved as the rule. Migration of the ~20 screens that still use checkboxes is not part of this feature (to be decided).
- L4 T2: docs/design-system.md section «Selección sin checkboxes» (situation→pattern table, switch row, radio card, selectable rows with mark, toggle chips, segmented, table row mark, accessibility checklist, migration note; multiple HfCombobox marked to migrate) and a design/system.md rule line.
