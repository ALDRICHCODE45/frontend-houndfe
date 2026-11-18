# Pedido live re-check, 2026-11-18

## Setup and rules
- **FE:** `feat/quotation-sale-conversion` at e4e2c902, which includes df2de9dd with the D1, D3, D4 and D5 fixes. Served by Vite on 127.0.0.1:5193. I stopped my own PIDs afterwards and port 5193 is free.
- **BE:** DEV :3003, which includes 3c2e5bfc, the D2 fix.
- **Login:** manager, through the real form. The password is read from the seed at runtime and never printed. No storage state is written to disk.
- **Logs:** `METHOD path → status` only. Token grep finds no values; the only hit is the redaction regex in `lib.mjs`.
- **Earlier test data:** drafts `06d4e33b` and `b9b3665b` and quotations `b91f6c33` and `f52f1262` were not modified. Their totals are still 62010 and 55120. The POS did *show* `b9b3665b` once, by mistake (see D6); nothing was mutated on it.

## Attempts
1. **`attempt1/`:** after «Convertir en venta», the POS displayed the older draft `b9b3665b` ($551.20) instead of the new draft `6188c0cd`. My script stopped before any mutation.
2. **`attempt2/`:** the same defect. `pos:active-tab` held the new draft `a5b2d86b`, but the screen showed `6188c0cd`. My script stopped before any mutation.
3. **Final run (top level):** the defect happened again: `pos:active-tab` held `9da07727`, but the screen showed `a5b2d86b`. My script then selected the tab of the new draft and ran every check. A guard refuses any mutation unless the draft on screen is the new one.

## Results (final run)

| Check | Result | Evidence |
|---|---|---|
| POS sale with both promotions | PASS: $558.09 (subtotal $689.00, descuentos −$130.91) | `r01` |
| Dialog description (D5) | PASS: «La venta en curso se descarta…» appears once; `aria-describedby` points to it | `r02` |
| Sale → quotation | PASS: dropped «Buen Fin (−$62.01)»; quotation `d8290dec` total $620.10, IVA incluido $85.53 | `r03`, `r04` |
| Convert: POS opens the new draft | **FAIL (D6)**: the POS shows the previous draft; the right one only after clicking its tab | `r05a`, attempts 1–2 |
| Converted draft total | PASS: exactly $620.10; the line badge «10% en croquetas Hill's» shows (promotionId set) | `r05` |
| Accordion open without a click (D1) | PASS: `aria-expanded=true`; «Buen Fin: 10% en toda tu compra · No aplicada por venir de una cotización · Aplicar» | `r05` |
| «Aplicar» (D2) | PASS: $558.09 (−$130.91); the suppressed row is gone | `r06` |
| Quantity 2 | $1,109.29 (subtotal $1,378.00, descuentos −$268.71). A fresh, non-converted sale at qty 2 gives the same $1,109.29 | `r07-qty-2`, `b01` |
| Quantity back to 1 | PASS: $558.09 | `r07-qty-1` |
| Quotation detail at 390 (D3) | PASS: scroller scrollWidth 390 = clientWidth 390; 0 elements past the viewport | `r09`, `r10` |
| List badge (D4) | PASS: «Convertida en venta» in full at 1440 | `r08` |

**API calls:** every call returned 200, 201 or 204. Mutations in the final run plus the baseline:
- `POST /sales/drafts` (201) ×2
- `POST …/items` (200) ×2
- `POST /quotations/from-sale/:id` (201)
- `POST /quotations/:id/convert-to-sale` (201)
- `POST …/manual-promotions/:id` (200)
- `PATCH …/items/:id` (200) ×3
- `DELETE /sales/drafts/:id` (204): the baseline draft only

**Console errors:** none. **Non-local origins:** `placehold.co` only.

## Defects
- **D6 (FE, new, high): after «Convertir en venta», the POS can open the wrong draft.** It happened in all three runs today. The cashier can end up adjusting or charging another sale.
  - The convert flow sets `pos:active-tab` to the new sale id and navigates (`src/features/POS/quotations/composables/useConvertQuotationToSale.ts:188-192`). The drafts query is only *invalidated* there, not refetched.
  - On mount, `src/features/POS/sales/views/SalesView.vue:319-323` checks the stored id against the *stale cached* drafts list. The new draft is not in it yet, so it falls back to `currentDrafts[0]`, the previous draft.
  - The `watch(activeTabId)` at `:335-339` is registered after that immediate watcher, so localStorage keeps the new id while the screen shows the old draft.
  - When the refetch arrives, the active id is still valid, so the screen is never corrected. The suppressed promotions stored for the new draft are also invisible until the cashier finds its tab.
  - Fix: in the composable, put the new sale in the cache before `router.push`: `queryClient.setQueryData(saleQueryKeys.drafts(t), (old) => [response.sale, ...(old ?? []).filter(d => d.id !== response.sale.id)])`, or `await queryClient.refetchQueries(...)`. Do the same for the DRAFT branch of `useOpenQuotationSale.ts:78-79`.
  - Hardening in SalesView: when the stored id is missing while the drafts query is fetching or stale, wait for the fresh list before falling back.
  - Test: mount SalesView with a cached list that lacks the stored id, then resolve a refetch that includes it; the stored id must become active.
- **Observation (BE, not conversion-specific): Buen Fin at qty 2 does not match the rule seen at qty 1.** At qty 2 the order discount is $130.91, which is 10% of $1,309.10. The line-discounted base is $1,240.20, which would give $124.02 → $1,116.18. A fresh sale returns the same $1,109.29, so this is the general backend promotion calculation, not the conversion. Worth a backend look.

## Dev data created (all mine)

| Kind | Id | State |
|---|---|---|
| Quotation | `7bbba4dc-14fa-42b0-ab44-fa1254b6e90f` | Converted → draft `6188c0cd-f4ed-4156-866a-51417fecb276` ($620.10, untouched) |
| Quotation | `eb30cec1-be8a-4b21-be4f-82ac1671de84` | Converted → draft `a5b2d86b-8342-4edf-94c5-fc3f37d15c01` ($620.10, untouched) |
| Quotation | `d8290dec-3db3-4036-a5fc-a36f87f39ee2` | Converted → draft `9da07727-340d-408a-bfa4-f000fcad8fe6` ($558.09, Buen Fin applied, qty back to 1) |
| Sale drafts | `b93b9ab4`, `1acb4a8c`, `95a46f54` | Discarded by sale → quotation |
| Baseline draft | `2b643849-aeeb-4fac-91f8-43fae0b27ee3` | Created and deleted |

## Files
- **Scripts:** `recheck.mjs`, `baseline-qty2.mjs`, `r390.mjs`, `probe.mjs` (read-only), `lib.mjs`.
- **Logs and records:** `*.log` and `*.json`, plus `attempt1/` and `attempt2/`.
- **Screenshots:** `shots/`.
- **Vite:** `vite.log`, `vite.pid`.
