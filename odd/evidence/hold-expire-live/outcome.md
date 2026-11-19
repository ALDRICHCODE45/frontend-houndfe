# Live check: «Vencer apartado ahora» (hold-expire-now T3)

- Date: 2026-11-18, 18:00–18:10 Mexico City (00:00–00:10 UTC on 19 Nov).
- Setup: FE branch `feat/hold-expire-now` @ 3bcbeb2b. Repo-root Vite ran on 127.0.0.1:5193 against `VITE_API_BASE_URL=http://localhost:3003`, the DEV backend (BE main 75a754b3). :3000 was not touched.
- Browser: headless Chromium at 1440×900, light theme, es-MX, America/Mexico_City.
- Login: manager@ ("Manager Centro") through the real login form, tenant Sucursal Centro. The password is read from the backend seed at runtime. It was not printed or stored, and no tokens appear in any log.
- Teardown: Vite was stopped after the run, and :5193 is no longer listening.

## Results

| Step | Result | Evidence |
|---|---|---|
| 1 Sort select | **PASS** for «Ordenar:» + «Más recientes» on load. «Orden personalizado» is **not reachable from the UI**; the unit tests cover it. | `step1-sort.log`, `shots/01`, `shots/02-sort-click-*` |
| 2a #80 partial → REVIEW (done first, on the parent's instruction) | **PASS** | `step2-expire-74e6358d.log`, `shots/10–14-*74e6358d` |
| 2b #79 unpaid → CANCELLED | **PASS** | `step2-expire-9f696276.log`, `shots/10–14-*9f696276` |
| 3 List row #79 | **PASS** on content: «Cancelada» + «Plazo vencido» with an explanatory aria-label. One layout defect, D1 below. | `step3-list.log`, `shots/20`, `shots/21` |

### Step 1
- On load, the label reads «Ordenar:» and the select reads «Más recientes». The request carries `sortBy=confirmedAt&sortOrder=desc`.
- Only the «Total» and «Fecha» headers sort; they render a `SortableHeader`. Clicking them only ever produced sorts that the select has an option for:
  - Total: «Total menor a mayor», then «Total mayor a menor», then «Total menor a mayor».
  - Fecha: «Más antiguas», then «Más recientes», then «Más antiguas».
- «Deuda» declares `enableSorting: true` but has no header slot. Clicking it opens the column menu (pin, move, width, hide) and does not sort.
- The one combination with no option, `debtCents:asc`, therefore can't be reached from the UI. The parent agreed to record it as not reachable.

### Step 2: the spec target changed
- A-202611-000077 (6e64f7bc) was not testable: the earlier pay-in-store live check had already charged it $189 in cash. It is now PAID, with hold stage 0, version 5.
- Following §6, the detail shows no «Apartado» card and no expire button (`shots/10-detail-before-6e64f7bc`). That is correct behaviour.
- The backend seeded two replacements:
  - **#80** (74e6358d), partly paid:
    - Card before: «Apartado · vence mié 18 nov, 19:02 · tiene un pago registrado», with the «Vencer apartado ahora» button.
    - Dialog: «¿Vencer el apartado ahora?» with «El apartado vence y la venta queda para revisar; no se cancela porque tiene un pago registrado.» and the buttons Volver / Vencer apartado.
    - `POST /sales/:id/hold/expire → 200`. Body `{expectedVersion: 2}`, **Idempotency-Key sent** (36-char UUID). Outcome REVIEW, stage 2, status CONFIRMED.
    - Toast «Apartado vencido: la venta quedó para revisar.» The dialog closed.
    - Card after: «Apartado vencido · revisar». The sale was not cancelled and has no cancellation card.
  - **#79** (9f696276), unpaid:
    - Card before: «Apartado · pagar en tienda · vence jue 19 nov, 18:02», with «Cambiar plazo» and «Vencer apartado ahora».
    - Dialog: «¿Vencer el apartado ahora?» with «La venta se cancela como plazo vencido y el cliente recibe el aviso.»
    - `POST /sales/:id/hold/expire → 200`. Body `{expectedVersion: 1}`, **Idempotency-Key sent** (36-char UUID). Outcome CANCELLED, cancelReason HOLD_EXPIRED, canceledBy «Manager Centro», `hold.expiredAt` set.
    - Toast «Apartado vencido: la venta se canceló.» The dialog closed.
    - Header: «Venta cancelada» plus the «Plazo vencido» tag (clock icon).
    - Cancellation card:
      - Fecha: «Hoy a las 18:02»
      - Motivo: «Plazo vencido»
      - Explanation: «Cancelada porque venció el plazo del apartado sin pagarse»
      - «Venció el mié 18 nov, 18:02»
      - «Cancelada por Manager Centro» (not «Sistema»)
    - The hold card is gone.
- Both dialog texts appear twice in `innerText`. That is ConfirmModal's sr-only copy; only one copy is visible on screen.

### Step 3
- The default «Todas» list leaves out CANCELED sales. This is the backend default: the request has no `status`, and #79 is absent. #80 is shown with «Impaga» and «Apartado vencido · revisar».
- With `?status=CANCELED` (Filtros 1), #79 reads «Cancelada» + «Plazo vencido» with aria-label «Cancelada porque venció el plazo del apartado sin pagarse». Other cancelled rows (#50, #67, #6) have no tag.

## Defects
- **D1 (layout): the «Plazo vencido» tag is truncated and overflows the Pago column at 1440.**
  - Measured: the Pago `td` is 126px wide (x 707–833). The tag spans x 817–919, so it crosses into «Productos» and is cut to «Plazo ve…» (scrollWidth 117 > clientWidth 100). See `shots/21-list-canceled-1440.png`.
  - Where: the `paymentStatus` column in `src/features/POS/sales/composables/useSalesColumns.ts:35` has no size. The cell is in `src/features/POS/sales/views/SalesListView.vue:411-426`.
  - Fix, either:
    - give the column room, e.g. `size: 232` (the same approach as `deliveryStatus` `size: 152` on line 37); or
    - wrap both badges in `<div class="flex flex-wrap items-center gap-1">`, drop the `margin-left` / `white-space: nowrap` from `.sale-cancel-note` (`SalesListView.vue:552-553`), and let the tag sit on a second line.
  - Then check at 1440 with #79.
- Observation (not part of this change): «Deuda» is `enableSorting: true` (`useSalesColumns.ts:40`) but has no `SortableHeader` slot in `SalesListView.vue` (~379–382 has only Fecha and Total). The header can't sort, which is why `debtCents:asc`, and so «Orden personalizado», is unreachable.

## API calls (all runs; ids → :id)
- POST /auth/login → 200 (×5)
- GET /auth/me/permissions → 200
- GET /sales → 200
- GET /sales/:id → 200
- **POST /sales/:id/hold/expire → 200 (×2)**
- GET /sales/refunds/pending → 200
- GET /sales/payment-methods → 200
- GET /price-lists → 200
- GET /cash-registers → 200
- GET /cash-sessions → 200
- GET /customers → 200
- GET /users/assignable → 200
- GET /delivery-zone-validations → 200
- GET /notifications/unread-count → 200
- Read-only node probes, not in the browser: GET /auth/me, /sales, /sales?status=CANCELED → 200, and /sales?status=CANCELLED → 400 (wrong spelling). One probe also used `?search=` → 400.

No 4xx or 5xx responses in the browser, no console errors, no page errors, and no non-local origins (FOREIGN [] on every run).

## Dev data changed
- #80 (74e6358d): hold expired by Manager Centro → stage 2, REVIEW. Still CONFIRMED / PARTIAL.
- #79 (9f696276): cancelled with HOLD_EXPIRED, canceledBy Manager Centro. Per L5, the backend sends the customer expiry notice for this.
- #77 and the list sort: read only, unchanged. Header-sort clicks are client state only; no view was saved.

## Note
While pruning my own earlier screenshots in this folder, I ran `rm` on `shots/02-list-sort-after-*`, `02-header-menu-deuda.png`, `probe-deuda-menu.png` and `dom-probe*.log`. All of them were files this run had created inside `odd/evidence/hold-expire-live/`.
