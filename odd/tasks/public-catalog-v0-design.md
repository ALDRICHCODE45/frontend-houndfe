# Public catalog v0 design implementation
Objective: implement the approved canvas design `design/public-catalog-v0/` (artboards 01–05) in the public catalog. Branch `design/public-catalog-v0` from FE main 38ba2467 (name matches BE handoff 15). Backend contract: `../houndfe-backend-public-catalog` branch `feat/public-catalog-v0`, `docs/frontend-handoff/15-public-catalog-v0.md` (not merged, not deployed).
Delivery: local work-unit commits only; no push, PR or merge.

## Specs
S1. User: «Bien hermano, me gusta, podemos avanzar con el diseno que propones, recuerda revisar el diseno real con el mcp de playwrhite por favor.» Implement the design as drawn in `design/public-catalog-v0/` (design.json lists each artboard and its tradeoff). Earlier approval of the improvements: «Si hermano, estoy completamente de acuerdo, adelante.»
S2. Listing (artboards 01, 02): full hero on the unfiltered first page, hero shrunk to a bar when filtered or past page 1; «Categorías» menu with counts; price-list selector only when there is more than one list (otherwise «Precios en MXN»); «Mostrando a–b de N»; numbered pager on desktop; active-filter chips with «Limpiar todo»; quiet card; footer with the branch.
S3. Filters (01, 02): desktop sidebar of filter groups (categories and attribute facets, «Ver más» after 5); recipient tiles from the `animal.target` facet, rendered only when that facet is present («Todos» = `meta.total`); mobile «Filtros» bottom sheet with draft changes and «Ver N productos» counted by a `/products` probe.
S4. Detail as a page (03, 04): route `/catalogo/:branchSlug/p/:productId` (the path the BE share redirect uses); the card becomes a link; breadcrumb back to the listing; gallery follows the selected presentation image; out-of-stock presentations stay selectable; characteristics of the selected presentation by section; share (copy link on desktop, native share on mobile); a 404 product reads as «ya no está».
S5. v0 backend extras (handoff 15), each rendered only when its field is present: sort (Novedades, Precio menor, Precio mayor; never «Relevancia»); «Pedir por WhatsApp» / «Preguntar» on card and detail with a prefilled message, plus the mobile sticky bar (price, «Cambiar», WhatsApp) from `whatsappNumber`; branch block and footer address/hours/«Abierto hoy» from `GET /public/catalog/:slug/branch`; «Quedan N» from `stockPresentation.exactQuantity`; unit price and «Ahorras N %» computed from a number attribute with a unit, only when every compared presentation shares the unit.
S6. States (05): loading, no results (search shown, ways out), error, branch without catalog.
S7. Standing owner rule: Playwright MCP checks verify the UI design (that it looks right and follows the design system), not only function. Compare the real app with the artboards at 390 and 1440.
S8. Prior rule (public-catalog-v0-fidelity): no fake controls or invented data. Sample data in the artboards (WhatsApp number, address, hours, «Quedan 3», per-kg prices, «Relevancia», Marca filter, «Más para perros», tile counts) never ships as literals.

## Tasks
- T0 | S1 | parent | commit design boards and this document
- T1 | S2, S5 (sort), S6 | worker | listing chrome
- T2 | S4 | worker | detail page and route (Risk item 2: public route auth bypass)
- T3 | S3 | pending | filter sidebar, recipient tiles, mobile sheet
- T4 | S5 | pending | WhatsApp, branch block, exact stock, unit price, share preview URL
- T5 | S1, S7 | parent | Playwright MCP design check vs artboards at 390/1440

## Log
- L1 User 2026-11-11: «Bien hermano, me gusta, podemos avanzar con el diseno que propones, recuerda revisar el diseno real con el mcp de playwrhite por favor.»
- L2 Explorer gap map (task mwcj34z1-1-asaa): the current FE has hero, category bar, chips facets, card→modal detail, prev/next pager, skeletons; it lacks sort, sidebar, sheet, detail page, WhatsApp, branch card. The tests forbid WhatsApp today (`CatalogView.spec.ts:302`, `CatalogProductDetailModal.spec.ts:707,1185,1915`); those change on purpose in T4. No backend has a brand facet, card presentation names, card unit price or related products, so those stay out. `animal.target` is a locked editorial vocabulary code (BE `editorial-production-vocabulary-catalog.ts:39`).
- L3 Decisions taken without asking (within the approved design, no invented data): recipient tiles use the `animal.target` facet; unit price only when all presentations share the unit of one number attribute; the v0 extras are built against handoff 15 and stay hidden on a backend without them.
