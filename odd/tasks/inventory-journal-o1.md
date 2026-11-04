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
- T2 [S7]: inventory types, API client, and the stock and movements composables.
- T3 [S2,S3,S7]: the adjustment command (Idempotency-Key, replay, 409 mapping, physical-count delta). High risk (data integrity).
- T4 [S2,S3,S9]: the adjustment dialog.
- T5 [S4,S6,S9]: the stock panel and the kardex.
- T6 [S8]: the "Inventario" task in the product detail.
- T7 [S1]: read-only quantity on edit, with quantity stripped from every PATCH. High risk (data integrity).
- T8 [S7]: product error-code mapping and the first-variant confirmation.
- T9 [S7]: sales pins for STOCK_INSUFFICIENT_AT_CONFIRM and SALE_STOCK_UNAVAILABLE.
- T10 [S8,S9]: runtime check with the README §7 data, as manager and as cashier (403).

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
