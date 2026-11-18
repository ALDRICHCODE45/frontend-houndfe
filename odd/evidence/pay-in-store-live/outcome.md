# Pay-in-store hold live check (T4), 2026-11-18

**Setup.** I served FE branch `feat/pay-in-store-hold` at `8c676fa3` with `pnpm exec vite --host 127.0.0.1 --port 5193 --strictPort`. I stopped my own Vite at the end, and port 5193 is free again.

**Backend.** DEV `:3003` on BE main b0732658, «Sucursal Centro». Every app API call in the logs went to `127.0.0.1:3003` or `localhost:3003`, so the FE targets :3003. No non-local origins were contacted (`FOREIGN []` in every run). `:3000` was never touched.

**Harness.** Headless Playwright, es-MX, America/Mexico_City, light theme, 1440×900 (390×844 for the cards). Login goes through the real `/login` form. The scripts read the seed passwords at runtime. They were never printed, and no storage state was written.

**Redaction.** The logs keep `METHOD path → status`. Mutation bodies show only their keys, plus `expiresAt`, `expectedVersion`, `method`, `amountCents` and `cashSessionId`. Token grep found nothing.

## Results

| Step | Result | Evidence |
|---|---|---|
| 1 List | **PASS** | `step1-list.log`, `shots/01-list-1440.png`, `01a-column-menu.png`, `02-list-390.png`, `02-card-77-390.png`, `02-card-78-390.png` |
| 2 Cambiar plazo | **PASS** (see D1 for the input defect) | `step2-hold.log`, `shots/03`–`08`, plus earlier attempts in `attempt1/` and `attempt2/` |
| 3 Notification | **PASS** (see G1) | `step3-notif.log`, `shots/10-bell-panel.png`, `11-sale-78-from-notification.png` |
| 4 Cash charge | Block **PASS**; charge **PASS as cashier@**. The manager cannot open a till (D2). | `step4a-block.log`, `step4b-open-till.log`, `step4c-charge-cash.log`, `shots/12`–`18` |
| 4 opt. Card 000078 | **PASS** | `step4d-card-78.log`, `shots/19`–`21` |

**Step 1: sales list**
- I showed «Canal» through «Columnas» → «Mostrar Canal», since it is hidden by default.
- #77: «Apartado · pagar en tienda · vence jue 19 nov, 15:47», Canal «En línea».
- #78: «Apartado vencido · revisar», «En línea».
- #76 and other POS rows: «Punto de venta».
- At 390 both cards show the same lines, with no horizontal overflow.
- Minor: at 1440 the hold line under «Cliente» is truncated («…vence jue 19 nov, 15:47» becomes «ven…»). The full text is only in `title`.

**Step 2: Cambiar plazo on #77**
- The «Apartado» card and its «Cambiar plazo» button work.
- Past date (18 nov 08:15): the field shows «Elige una fecha y hora en el futuro.» and no request is sent (client-side check).
- Future date (20 nov 01:30): `PATCH /sales/:id/hold → 200` with body `{expiresAt:"2026-11-20T01:30:00-06:00", expectedVersion:4}`. The response hold has version 5 and stage 0. The toast «Fecha límite actualizada» appeared, and the card shows «vence vie 20 nov, 01:30».
- The hold card at 390 is fine.

**Step 3: notification**
- The bell reads «Notificaciones, 45 sin leer».
- The panel row reads «Apartado vencido: revisa la venta · Venta A-202611-000078 · Tiene un pago registrado · Apartado vencido».
- Its href is `/pos/ventas/c146d74e-06bc-486d-8fbf-8f3a06a0e6ae`. A click sent `POST /notifications/:id/read → 200` and opened that URL.

**Step 4: cash charge on #77**
- As manager, CASH shows «Abre tu caja para cobrar en efectivo. / Tarjeta y transferencia se pueden cobrar sin caja. / Ir a Caja», and «Confirmar cobro» is disabled.
- «Ir a Caja» leads to `/pos/caja`, but the manager has no `create:CashSession`, so no register offers «Abrir caja» (`probe-permissions.log`).
- With the parent's approval I charged as cashier@ (Cajero Centro), who has two OPEN sessions:
  - The picker appears with «Elige la caja donde entra el efectivo.», and the confirm button stays disabled until I picked one.
  - I picked session d3d46b66 on «Caja Principal».
  - `POST /sales/:id/payments → 201` with `cashSessionId` present (`d3d46b66-…`), `Idempotency-Key` present and `{method:cash, amountCents:18900}`.
  - Result: PAID, debt 0. The hold card is gone, and the list row has no hold line.

**Optional: card charge on #78**
- As manager, Tarjeta débito for $94.50 (reference typed): no cash-session section appeared.
- `POST /sales/:id/payments → 201` with no `cashSessionId`. The sale is now PAID.

**API.** Every call returned 2xx. Mutations:
- `PATCH /sales/:id/hold → 200` (×1 in the final run, ×4 including the attempts)
- `POST /sales/:id/payments → 201` (×2)
- `POST /notifications/:id/read → 200`

The full list is in `step*.log`.

**Console errors.** None.

## Defects (src not edited)

- **D1, hold deadline input.** `src/features/POS/sales/components/SaleHoldDeadlineDialog.vue:181-200`
  - What happens: `UPopover` wraps the whole `UInputDate`. Every other click on a segment opens the calendar, which moves focus to «Mes siguiente», so the digits the user types are lost. In attempts 1 and 2 this saved unintended times (19 nov 10:47, 08:47 and 18:47, all still in the future). `probe-segments.log` proves it.
  - Fix: trigger the calendar from a dedicated icon button in `UInputDate`'s `#trailing` slot, not from the field itself.
  - The same pattern exists in `SettleRefundSlideover.vue:456`.
- **D2, «Ir a Caja» dead end.** `src/features/POS/sales/components/DebtPaymentModal.vue:448-465`, with the button at `:96` and `:456`.
  - What happens: a user without `create:CashSession` (the manager on dev) is sent to Caja but cannot open a till there.
  - Fix: read `useCashAccess().canOpenSession`. When it is false, hide «Ir a Caja» and show «No puedes abrir caja. Pide a un cajero que cobre en efectivo o cobra con tarjeta o transferencia.»
- **D3, session picker shows raw ids.** `src/features/POS/sales/components/CashSaleSessionPicker.vue:51` (and `:59`)
  - What happens: the options are raw session UUIDs.
  - Fix: label each one with the register name and opening time (map `registerId` via the cash-registers query), e.g. «Caja Principal · abierta 18 nov, 09:00».
  - Also `:77` «Sin caja (legacy)» and `:85` «…o cobra sin vincular» contradict the L9 rule in the debt flow. Pass a prop, or use copy that does not offer charging without a till.
- **G1, no hold context on the detail of an expired hold.** `src/features/POS/sales/views/SaleDetailView.vue:99` and `:614`
  - What happens: the card renders only when `liveHold` is set, so #78, opened from the notice, says nothing about the expired hold, although the list says «Apartado vencido · revisar».
  - Fix: render `SaleDetailHoldCard` when `saleHoldLine(sale)` is not null. Allow «Cambiar plazo» only when `paymentStatus === 'CREDIT'` (§2: a PARTIAL sale gets `SALE_HOLD_NOT_EDITABLE`).

## Dev data changed

- #77 (6e64f7bc): the hold deadline was PATCHed 4 times, ending at 2026-11-20T01:30-06:00 (version 5). Each PATCH notifies the customer over WhatsApp, per the BE handoff. It was then charged $189.00 cash into session d3d46b66 (Caja Principal, Cajero Centro) and is now PAID.
- #78 (c146d74e): charged $94.50 by debit card (reference «LIVE-T4», no till) and is now PAID. One SALE_HOLD_REVIEW notification was marked read for the manager.
- No till was opened and no cash register was changed.
