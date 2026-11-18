# Pedido live check (T5), 2026-11-18

**Setup.** FE branch `feat/quotation-sale-conversion` at `5a68b8a1`, served by `pnpm exec vite --host 127.0.0.1 --port 5193 --strictPort`. I stopped my own Vite PIDs (3708967 and 3709249) at the end, and port 5193 is free.

**Backend.** Local DEV `:3003` on BE main a7577338. The browser called it as `http://localhost:3003` (observed in the network log), so the FE does target :3003.

**Login and harness.** I logged in through the real `/login` form as manager@houndfe.com, tenant «Sucursal Centro». The scripts read the dev password from the backend seed at runtime. It was never printed, and no storage state was written to disk. The scripts are headless Playwright, 1440×900, light theme, es-MX, America/Mexico_City.

**Redaction.** Logs keep only `METHOD path → status`. Token grep (`eyJ|bearer|authorization|accessToken|tempToken`) finds no values in any log or JSON. The only hits are code identifiers in `api.mjs` and `lib.mjs`.

**Run 1.** The first attempt is kept in `run1/`. It converted quotation b91f6c33. My script then failed to click «Aplicar» because the promotions accordion loads collapsed (see D1). Because suppressedPromotions live in localStorage per browser context, I repeated steps 2–4 in a single context (run 2, the files at the top level).

## Results (run 2)

| Step | Result | Evidence |
|---|---|---|
| 1 Promoción | PASS. No promotion was created. The existing active AUTOMATIC PRODUCT_DISCOUNT «10% en croquetas Hill's» (`1db4a2b1-688f-4f6c-a72a-da651c87582b`, 2026-10-01 → 2027-01-01) targets «Croqueta Hill's Science Diet Gato Adulto 1.8 kg» (simple product, stock 9, $689.00). The other active automatic promotion that applies is the order-level «Buen Fin: 10% en toda tu compra» (`f215710f-…`). | `shots/01-promociones-list.png` |
| 2 Venta → cotización | PASS. Results below the table. | `02`–`06b` |
| 3 Cotización → venta | PASS. Results below the table. | `07`, `08`, `09`, `09b` |
| 4 Aplicar | PASS in the UI, but the backend total is questionable (D2). | `10-pos-after-apply.png` |
| 5 Convertida | PASS. Results below the table. | `11`, `13`, `14`, `15` |
| 6 Cobro | SKIPPED. The manager has no open till of their own: the «Sesión de caja» picker shows its empty notice (`cash-session-empty`). The two OPEN sessions in the tenant belong to other registers or users. Not charged, so the «Ver venta → detalle» and «Desde cotización · Ver cotización» checks after charging were not exercised live. | `16-checkout-modal.png` |
| 390 pass | The POS dialog PASSES. The quotation detail shows horizontal clipping (D3). | `20`–`25` |

**Step 2 details**
- The POS added the product with the automatic line promo (-10%) plus Buen Fin. Total **$558.09** (subtotal $689.00, descuentos −$130.91).
- Dialog copy: «¿Pasar esta venta a cotización?» · «La venta en curso se descarta y queda guardada como cotización.» · «Se lleva el producto. Si alguna promoción no aplica en cotizaciones, te la mostramos al terminar.» · «Nota para el cliente», «0 de 280».
- I added a note and confirmed. `POST /quotations/from-sale/:id → 201`.
- The summary showed droppedAdjustments: «No se trasladó: Buen Fin: 10% en toda tu compra (−$62.01)». «Abrir cotización» opened the quotation, status Borrador.
- Quotation: line $620.10 (−$68.90). Subtotal $689.00, Descuentos −$68.90, **IVA incluido $85.53**, **Total $620.10**. The note was saved.

**Step 3 details**
- The DRAFT quotation was kept, so «Convertir en venta…» came from the ⋮ menu, which also lists Cancelar and Eliminar.
- Dialog: «¿Convertir en venta?» · «Se abre una venta con los precios y descuentos cotizados. Después puedes ajustarla en el punto de venta.» · Volver / Convertir en venta.
- `POST /quotations/:id/convert-to-sale → 201`, then the POS opened the new draft `b9b3665b`.
- Total **$620.10**, exactly the quoted total. The line kept «DESCUENTO −10%», and no new automatic promotion was applied.
- «Promociones disponibles 1» shows «Buen Fin: 10% en toda tu compra · No aplicada por venir de una cotización · Aplicar». This row only appears after expanding the accordion (D1).

**Step 4 details**
- `POST /sales/drafts/:id/manual-promotions/f215710f-… → 200`. The suppressed row disappeared and no suppressed notes remain.
- The total went to **$551.20** (descuentos −$137.80), not the $558.09 the same promotion gave in a fresh sale (D2).

**Step 5 details**
- Badge «Convertida en venta». The stepper shows all three steps done.
- Banner «Convertida en venta el 18 nov 2026, 2:00 p.m.» with «Ver venta», plus «Solo lectura. Esta cotización ya no admite cambios.»
- No ⋮ menu, no «Enviar», no «Agregar producto», and the notes field is not editable.
- «Previsualizar PDF» → `GET /quotations/:id/pdf → 200`.
- «Ver venta» (saleStatus DRAFT) opened `/pos/ventas/nueva` on the draft ($551.20).
- The «Convertidas» tab lists both converted quotations. The row ⋮ menu offers «Ver detalle · Ver venta».

**API:** every call returned 200 or 201, with no 4xx or 5xx. Mutations:
- `POST /sales/drafts → 201`
- `POST /sales/drafts/:id/items → 200`
- `POST /quotations/from-sale/:id → 201`
- `POST /quotations/:id/convert-to-sale → 201`
- `POST /sales/drafts/:id/manual-promotions/:id → 200`

The full per-call list is in `phase-*.log`.

**Console errors:** none in phase A, B, C or 390. One earlier phase-B attempt hit Chromium `net::ERR_NETWORK_CHANGED`, a host network blip during login before any app call. I reran it.

**Non-local origins:** `https://placehold.co` only (seed product images).

## Defects

These were found live. src/ was not edited.
- **D1 (FE, pre-existing since 42757816): the «Promociones disponibles» accordion loads collapsed.** The comment says «default-open», but `aria-expanded=false` on load. As a result the suppressed «No aplicada por venir de una cotización» row is hidden until the cashier expands it.
  - Where: `src/features/POS/sales/components/PromocionesDisponiblesAccordion.vue:97`, `:default-value="[ACCORDION_VALUE]"` with `type="single"`.
  - Fix: pass a string, `:default-value="ACCORDION_VALUE"`, and add a test that the rows render without a click.
- **D2 (BE, needs backend triage): the order promotion uses the wrong base after reactivation on a converted draft.** In a fresh sale, Buen Fin 10% took −$62.01, computed on the post-line-discount amount $620.10. After «Aplicar» on the converted draft, the backend returns `discountCents 13780`, `totalCents 55120`: −$68.90, computed on the gross subtotal $689.00. The converted line is `priceSource custom`, `discountType percentage 10`, `promotionId null`.
  - Fix suggestion: compute the order-level base from the line `subtotalCents` (after line discounts) as for normal drafts. Expected $558.09.
  - The FE shows what the backend returns.
- **D3 (FE, pre-existing layout, visible in this flow): the quotation detail clips content horizontally at 390.** The scroller is 390 wide but its content is 570 wide on the converted quotation (527 on SENT, 748 on CANCELLED). Cards are cut at the right edge.
  - Where: `src/features/POS/quotations/views/QuotationDetailView.vue:993-995`. The `grid lg:grid-cols-3` and the inner grid have no mobile track, so the auto track grows to the min-content of nowrap children.
  - Fix: `grid grid-cols-1 lg:grid-cols-3` on both grids, plus `min-w-0` on `quotation-detail-main`, the sidebar and the inner sections.
- **D4 (FE, minor visual): the status badge «Convertida en venta» is truncated to «Convertida…» in the list at 1440.**
  - Where: `src/features/POS/quotations/views/QuotationsListView.vue:307`, status column `th: 'w-32'`.
  - Fix: widen it to `w-44`, or let the badge avoid truncation for that status.
- **D5 (FE, a11y minor): the sale-to-quotation dialog reads «La venta en curso se descarta y queda guardada como cotización.» twice.** Once as the sr-only description and once as the visible paragraph.
  - Where: `src/features/POS/sales/components/SaleToQuotationModal.vue:11-13` and `:40-42`.
  - Fix: make the sr-only description different, e.g. the item summary, or drop it and point `aria-describedby` at the visible paragraph.
- Observation, not a defect per L5: the stepper marks «Enviada» done for a quotation converted straight from Borrador.

## Dev data created

| Kind | Id | State |
|---|---|---|
| Promotion | none | Existing `1db4a2b1` used |
| Sale draft | `b428d8ee-216d-434c-b855-7c231afa02e2` | Discarded by sale → quotation (run 1) |
| Quotation | `b91f6c33-1bf0-4169-9ca7-0a2c13954e66` | CONVERTED_TO_SALE → draft `06d4e33b-4309-4640-b558-719952251af1` (open, untouched, $620.10) |
| Sale draft | `d5527ae3-1cc8-4957-b6af-22a13f99b4c1` | Discarded by sale → quotation (run 2) |
| Quotation | `f52f1262-792d-4eb0-984c-e8c10405b191` | CONVERTED_TO_SALE, saleStatus DRAFT → draft `b9b3665b-678f-4e1b-a314-7f517a9168cb` (open, Buen Fin applied, $551.20, not charged) |

The 390 pass only opened and cancelled the dialog on draft `06d4e33b`, so it made no mutation.

## Files
- **Scripts:** `lib.mjs`, `api.mjs`, `phase-a.mjs`, `phase-b.mjs`, `phase-c.mjs`, `phase-390.mjs`, `overflow-390.mjs`, `explore.mjs`, `probe*.mjs`. The probes are read-only API reads.
- **Logs and records:** `*.log` and `*.json` per phase. `vite.log` has the startup lines only. `vite.pid` is the stopped PID.
- **Screenshots:** in `shots/`. `phase-*-error.png` are the harness failures that were fixed and rerun.
