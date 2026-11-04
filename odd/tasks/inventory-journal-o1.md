# O1 inventory journal (frontend)

Implement the backend O1 contract from houndfe-backend/.tmp/inventory-journal-o1/docs/frontend-handoff/ (README, 01-inventory-journal.md; the BE branch is feat/inventory-journal-o1, not merged yet).
The work goes on the FE branch feat/system-redesign, after T4 of odd/tasks/system-redesign.md. The design system is the source of truth.

## Specs

S1. Read-only quantity. User decision P2 A: "Bloquear (recomendado)". Stock changes only through an adjustment with a reason, through sales, and later through receipts.
- Edit forms show quantity read-only for products, variants and lots. Creation stays editable and is recorded as INITIAL.
- No edit PATCH sends `quantity`. If one does, the backend answers 400 STOCK_QUANTITY_READ_ONLY.

S2. Adjustment reasons. User decision P3 A: a fixed list.
- PHYSICAL_COUNT Conteo físico
- DAMAGE Merma/daño
- EXPIRED Caducado
- THEFT_LOSS Robo/pérdida
- DATA_ENTRY_CORRECTION Corrección de captura
- OTHER Otro, which requires a note (at most 500 characters).

S3. No negative stock. User decision P4 A: no ajuste puede dejar el stock en negativo. The backend answers 409 INSUFFICIENT_STOCK and the UI explains it next to the field.

S4. Opening balance. User decision P1 A: the backend already migrated the current stock into OPENING movements. The FE only shows them in the kardex, with "Sistema" as the actor.

S5. Branch scope. User decision S1 A: each branch is a tenant, as today, so stock is per branch and there are no branch fields.

S6. FEFO. User decision P7 B: sales deduct from the lot that expires first. A sale appears in the kardex as one row per bucket it consumed, grouped by `group.id`. Expired lots are shown as "Vencido" and are never sold.

S7. Contract (handoff 01).
- `GET /inventory/products/:productId/stock`
- `GET /inventory/movements?productId&variantId|lotId&cursor&limit`: cursor Page, newest first.
- `POST /inventory/adjustments`:
  - Requires the Idempotency-Key header.
  - The body is closed: `{target{productId, lotId?|variantId?}, expectedVersion, delta, reason, note?}`.
  - Returns `201 {movement, stock}`.
- Errors come in the envelope `{statusCode, error}`:
  - 400 MALFORMED
  - 403
  - 404
  - 409 STOCK_VERSION_CONFLICT: reload, then retry with a new key.
  - 409 INSUFFICIENT_STOCK
  - 409 STOCK_NOT_TRACKED
  - 409 IDEMPOTENCY_KEY_CONFLICT
  - 409 IDEMPOTENCY_KEY_IN_FLIGHT: same key, uncertain result.
  - 500
- Changed product endpoints:
  - 409 STOCK_TRACKING_HAS_STOCK, when turning `useStock` off with stock.
  - 409 LOT_HAS_STOCK, when deleting a lot with stock.
  - 422 PRODUCT_TYPE_CHANGE_BLOCKED.
  - Creating the first variant on a product with stock zeroes it (REMOVAL FIRST_VARIANT_ZEROING).
- Sales:
  - 409 STOCK_INSUFFICIENT_AT_CONFIRM, already mapped.
  - 422 SALE_STOCK_UNAVAILABLE: a generic error with no retry.

S8. Permissions.
- `InventoryJournal:read` covers stock and kardex.
- `InventoryAdjustment:create` covers adjusting, and also needs read.
- No other subject inherits them.

S9. Four states (system-redesign S10) for the stock panel, the kardex and the dialog.

## Parent design decisions

Delegated by the user ("esa tarea te la quedas tu"):

- The kardex and stock live in a fifth task, "Inventario", in the product detail. It shows in edit mode only, with `read:InventoryJournal`. There is no global page in O1.
- Kardex paging is a "Cargar más" button (cursor), not infinite scroll.
- "Ajustar" shows only with `create:InventoryAdjustment`.
- The "Usar stock" toggle is disabled when there is stock, with a one-line reason beside it. The 409 is still mapped.
- Creating the first variant on a product with stock asks for confirmation first (ConfirmModal, destructive tone: "El stock actual pasa a 0").
- Products with variants keep hiding the lot UI. Lots on variants come in O2.
- The product list keeps "Existencias" as today. The detail stock panel shows the sellable quantity and the expired lots.

## Tasks

- T1 [S8]: auth subjects, plus nav and permission pins. High risk (permissions).
  - Done: dd19421a (subjects in AppSubject and APP_SUBJECTS; pins in ability.inventory.spec.ts; no nav entry in O1).
- T2 [S7]: inventory types, API client, and the stock and movements composables.
  - Done: 62e42f6d (src/features/POS/inventory: types, inventoryApi, useInventoryAccess/useInventoryContext, useProductStock, useStockMovements).
- T3 [S2,S3,S7]: the adjustment command (Idempotency-Key, replay, 409 mapping, physical-count delta). High risk (data integrity).
  - Done: d7029cb2 (useStockAdjustment, utils/adjustment.ts). Own commit, high risk.
- T4 [S2,S3,S9]: the adjustment dialog.
  - Done: 4acc912b (StockAdjustmentDialog; emits applied, reload).
- T5 [S4,S6,S9]: the stock panel and the kardex.
  - Done: aa1c79ba (StockKardex, utils/kardex.ts), c63376a9 (InventoryStockPanel, utils/stock.ts). Components only; T6 mounts `<InventoryStockPanel :product-id>` in the detail.
- T6 [S8]: the "Inventario" task in the product detail.
  - Done: 9ba3b837 (fifth task in ProductWorkspaceNavigation and ProductDetailView: only for a saved product with `useInventoryAccess().canRead`; `<InventoryStockPanel :product-id>` mounts the first time the task opens and stays alive, outside the UForm and the fieldset; the strip is now one scrolling strip with the fade). 9a92fa09 (fixes found by T10: kardex fit at 1440 and stock table fit at 390).
- T7 [S1]: read-only quantity on edit, with quantity stripped from every PATCH. High risk (data integrity).
  - Done: 8c6d07b4 (toUpdatePayload, productApi.update/updateVariant/updateLot strip it, update types exclude it, ReadOnlyStock in the detail, variant table, variant modals and slideover). Own commit, high risk.
- T8 [S7]: product error-code mapping and the first-variant confirmation.
  - Done: a4d9e0c2 (utils/productStockErrors.ts; detail view and slideover; "Controlar inventario"/"Usar stock" lock; first-variant ConfirmModal).
- T9 [S7]: sales pins for STOCK_INSUFFICIENT_AT_CONFIRM and SALE_STOCK_UNAVAILABLE.
  - Done: 7658b937 (salePaymentErrors.utils 'generic' action, SalesView branch, pins).
- T10 [S8,S9]: runtime check with the README §7 data, as manager and as cashier (403).
  - Done: 23 checks PASS / 0 FAIL against the real BE (odd/evidence/inventory-journal-o1/verify.mjs, report.json; shots/ is git-ignored). Two defects fixed on the way (9a92fa09); see L7.

## Log

L1. The user's original request (verbatim) is in odd/tasks/system-redesign.md L1, morning part: "en la manana, cuando tu ya hayas terminado el pulido de todo el sistema, ahora leas toda la documentacion que el backend te dejo y lo implementes". The product decisions are in system-redesign L2.

L2. Explorer mw2912o1 mapped the handoff to the FE.
- Quantity edit sites:
  - ProductDetailView.vue:2354, 1729, 1765-1777, 1901-1912 and 2463
  - ProductVariantsTable.vue:103-112
  - VariantDetailModal.vue:215-221, 278 and 375-380
  - useProductForm.ts:290-291 and 345 (toUpdatePayload)
  - ProductUpsertSlideover.vue:239-247
  - product.types.ts:371 and 407
- Subjects go in auth.types.ts:49-128 and ability.ts:6-72.
- Transport reference: purchase-orders.api.ts:20-60 and usePurchaseOrderCommands.ts:6-140.

L3. User question for the morning (not decided): the kardex today shows stock movements. Should the product list "Existencias" also say how much is sellable, given that it excludes expired lots?
L4. Implementation started after system-redesign T4 closed (c613573a). Two parallel writers on disjoint surfaces:
- Stream A builds the inventory module (O1 T1-T5) in src/features/POS/inventory and src/features/auth.
- Stream B covers products and sales (O1 T7-T9).
The parent wires the "Inventario" task in the product detail (T6) and runs T10 after both finish. The BE API runs from the O1 worktree on :3000.

L5. Stream A done (T1-T5), all in src/features/POS/inventory and src/features/auth. The parent owns T6 and T10.
- Entry point for T6: `InventoryStockPanel` (prop `productId`). It reads the context itself, shows "Sin acceso" without `read:InventoryJournal`, and shows "Ajustar" only with `create:InventoryAdjustment`. `useInventoryAccess()` returns `{ canRead, canAdjust }` for gating the task itself.
- Decisions taken without asking:
  - The dialog is a UModal. Its default mode is Sumar. "Conteo físico" preselects the reason PHYSICAL_COUNT, which stays editable. A count equal to the shown stock is refused next to the field.
  - Local validation runs before sending (no negative result, OTHER needs a note, note at most 500). The 409 codes are still mapped.
  - After a version conflict or a "Revisar stock", the panel re-reads the stock and hands the open dialog the new quantity and version. After an uncertain result the fields stay locked and only "Reintentar" replays the same key and body.
  - The kardex folds consecutive SALE rows with the same `group.id` into one expandable row. The sum of the deltas is a client sum of integers. A sale and its cancellation are never merged.
  - A single-row sale is a plain row. No ids are shown.
  - The kardex has no whole-row click, because only grouped rows expand.
- Open: `Idempotency-Key` conflict copy says to reopen the dialog. Check it against the real BE in T10.

L6. Stream B done (T7-T9), in src/features/POS/products and src/features/POS/sales. Suite of both dirs: 210 files, 4644 tests green; `pnpm type-check` clean.
- Decisions taken without asking:
  - Quantity is stripped in three places (toUpdatePayload, the types, and `withoutQuantity` in the API client), so a stray caller cannot send it. Saved variants lose the inline stock input and the VariantDetailModal blur autosave; `ReadOnlyStock` shows the figure with "Se ajusta desde Inventario".
  - In the detail the toggle is "Controlar inventario" (the slideover says "Usar stock"). Both lock while the product (or its variants) has stock, with "Hay existencias: ajusta el stock a 0 para desactivarlo."
  - The four stock codes show inline copy at their field AND keep the failure toast, with the same human copy. The toast stays because the field can sit in another task of the detail. The copy for PRODUCT_TYPE_CHANGE_BLOCKED changed from "ventas o movimientos" to "existencias o lotes", per the handoff; one old test was updated.
  - The error also switches the detail to the task that holds the field (identity for the type, presentations for the rest).
  - First variant: ConfirmModal "¿Crear la primera variante?" / "El stock actual pasa a 0.", confirm "Crear variante" in the destructive tone. It only shows when the product has quantity > 0 and no variants.
  - SALE_STOCK_UNAVAILABLE is a new `generic` action: error toast with fixed copy, no inline error, no reload, no retry. It never shows the server wording.
- Notes for T6/T10:
  - Both T7 and T8 touch ProductDetailView.vue (the inventory card and the lots card), so T6 should rebase mentally on a4d9e0c2 before mounting `InventoryStockPanel`.
  - SalesView.test.ts now routes `useToast` through `@nuxt/ui/composables/useToast` too, so toasts can be asserted. Earlier specs in that file leave the shared draft with no items; the new tests seed their own.
  - The compact slideover has no "Tipo" field, so PRODUCT_TYPE_CHANGE_BLOCKED there is a toast only.
- Open: the product list "Existencias" (L3) is untouched. `pnpm exec eslint` reports one old unused `error` in ProductsView.vue:73 (not mine).

L7. T6 and T10 done by a delegated writer (commits 9ba3b837 and 9a92fa09; the harness and report.json are in odd/evidence/inventory-journal-o1/).
- T6 decisions taken without asking:
  - The task strip had no scroll or fade of its own (the spec said "existing"). It is now one grid strip (`grid-auto-flow: column`, `overflow-x: auto`) with the employee-tabs fade (`data-more` / `data-less`) and the active task scrolls into view. Five tasks measure 415px in a 358px strip at 390; the Inventario button is fully visible after it opens.
  - The panel mounts the first time the task opens (no stock request on every detail load) and stays mounted, hidden with `v-show`. Losing the read grant while the task is open falls back to Identidad.
  - No Inventario task for a user without `read:InventoryJournal` and none in creation mode. The panel itself still shows "Sin acceso" if mounted without it.
- T10 against the real BE, as manager in Sucursal Centro (real login form) and as cashier. Every adjustment was reverted by an opposite one, so the showcase quantities are the README's again (Croquetas "Sin lote" 12, Collar Chico · Azul 15). The kardex of those two products now has extra ADJUSTMENT rows from the runs.
  - Croquetas: panel shows Sin lote 12 and three lots, the expired L-2026-08 with "Vencido" and "No se vende"; total 72, sellable 64. Its kardex rows are INITIAL ("Inicial"), not OPENING: the README says OPENING is only for products that existed before the journal. OPENING with "Sistema" as the actor was checked on an older product ("Suéter tejido para perro (variantes ocultas)").
  - Restar 2 · Merma/daño: 201, stock 12 → 10, total 72 → 70, the new row first (Ajuste, Merma/daño, −2, Manager Centro). Conteo físico with the original count computes "+2", sends PHYSICAL_COUNT and restores 12.
  - Going negative: refused at the field before sending ("El stock no puede quedar en negativo.", no request). The real 409 INSUFFICIENT_STOCK was provoked by rewriting the outgoing delta, and the dialog shows "No hay suficiente stock para restar esa cantidad." at the field; stock unchanged. "Otro" without a note is blocked at the Nota field, nothing sent.
  - Collar: both variants listed and adjusting Chico · Azul +1 sends a variant target. Placa: "Este producto no lleva control de stock", no Ajustar.
  - Editing: Desparasitante shows the read-only figure with "Se ajusta desde Inventario"; Croquetas (lots) and Collar (variants) have no quantity input (the lots table and the variant cells are figures). The PATCH of all three has no `quantity` key.
  - Cashier: the detail opens with four tasks and makes no inventory request; the three inventory endpoints answer 403.
  - 390 and 1440, light and dark: panel, kardex, dialog and the task strip, no page overflow.
- Defects fixed (inside src/features/POS/inventory, test first):
  - The kardex had seven columns: 928px in a 760px column next to the summary panel at 1440, so "Total del producto" and "Responsable" sat behind a scroll. It has six now (the actor under the date, "Total"), and lowers the global table floors locally (the primary column to 11rem, the numeric ones to 5rem, date and location to 9rem). The date, actor and location are no longer ellipsized.
  - At 390 the stock table was 419px in a 356px card and every "Ajustar" was behind a horizontal scroll. Below 480px the Vence column folds under the lot name.
  - Also in the harness: a first version checked the kardex while the page was on another product; the fit checks now reopen Croquetas, and "Cargar más" is clicked until the oldest rows load.
- Open, outside the O1 surfaces or needing a decision:
  - The detail header says "Sin stock" and the summary panel says "Stock 60" for Croquetas, while the journal says total 72. The product record has `quantity: 0` for a product with lots (and for Collar, which uses `variantStockTotal`), and FE `mapStatus` and the summary derive from it. The BE gives no lot total in the product record. It is the same question as L3 (what the list and header "Existencias" should say). Not changed.
  - The pi-lens notes on the new specs and the harness could not be listed (no lens tool here); eslint and `pnpm type-check` are clean.
  - The "Idempotency-Key" conflict copy from L5 was not provoked: the BE only answers it for a reused key with another body, which the UI never does.

