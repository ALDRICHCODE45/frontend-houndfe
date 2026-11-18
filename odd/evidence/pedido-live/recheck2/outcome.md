# Pedido live re-check 2, 2026-11-18

## Setup and rules
- **FE:** `feat/quotation-sale-conversion` at 4c067e74, which includes the D6 fix 84f241c4. Served by Vite on 127.0.0.1:5193. I stopped my own PIDs afterwards and port 5193 is free.
- **BE:** DEV :3003, which includes 74c74c35, the qty > 1 order-base fix.
- **Login:** manager, through the real form. The password is never printed and no storage state is saved.
- **Logs:** `METHOD path → status` only. Token grep: 0.
- **Earlier test data:** untouched.
- **One conversion, no tab clicks.** A guard refused any mutation unless the active tab (`data-sales-pos-state="active"`) was the converted draft. It never had to block.

## Results

| Step | Result | Evidence |
|---|---|---|
| POS sale (draft `e0180673`) | PASS: $558.09 (−$130.91) | `s01` |
| Sale → quotation `e60549bc` | PASS: Buen Fin dropped (−$62.01); total $620.10, IVA incluido $85.53 | `s02` |
| Convert → POS opens the NEW draft directly | PASS: converted sale.id `f6580543` = active tab = `pos:active-tab`; $620.10; accordion open; «Buen Fin · No aplicada por venir de una cotización» | `s03` |
| «Aplicar» Buen Fin | PASS: $558.09 (−$130.91); suppressed row gone | `s04` |
| Qty 2 | PASS: $1,116.18. Descuentos −$261.82, which is line $137.80 + order $124.02 | `s05-qty-2` |
| Qty 3 | PASS: order discount $186.03. Descuentos −$392.73, which is line $206.70 + $186.03; total $1,674.27 | `s05-qty-3` |
| Qty back to 1 | PASS: $558.09 | `s05-qty-1` |
| Quotation «Ver venta» | PASS: «Convertida en venta el 18 nov 2026, 2:50 p.m.»; «Ver venta» opened `/pos/ventas/nueva` with active tab `f6580543`, $558.09 | `s06`, `s07` |

**API calls:** 56 calls, all 200 or 201; no 4xx or 5xx. Mutations:
- `POST /sales/drafts` (201)
- `POST …/items` (200)
- `POST /quotations/from-sale/:id` (201)
- `POST /quotations/:id/convert-to-sale` (201)
- `POST …/manual-promotions/:id` (200)
- `PATCH …/items/:id` (200) ×3

**Console errors:** 0. **Non-local origins:** `placehold.co` only.

## Dev data created

| Kind | Id | State |
|---|---|---|
| Sale draft | `e0180673-3fe4-4a67-9bde-cd67c442ec2e` | Discarded by sale → quotation |
| Quotation | `e60549bc-8772-4aee-8799-01313936836d` | CONVERTED_TO_SALE |
| Draft | `f6580543-a921-4215-a45a-4624ab354d60` | Open; Buen Fin applied; qty 1; $558.09; not charged |
