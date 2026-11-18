# POS «Pagar en tienda»: apartado de pedidos del bot (FE)

Front end of the backend pay-in-store hold (BE handoff 24): show the hold on sales, edit its deadline, charge online sales at the counter, show the automatic HOLD_EXPIRED cancellation and the new SALE_HOLD_REVIEW notification.

## Specs
- S1 Contract: /home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend/docs/frontend-handoff/24-pay-in-store-hold.md (read it whole).
- S2 (backend message, verbatim facts): `hold: {paymentIntent, expiresAt, reminderAt, stage, version} | null` on GET /sales/:id and GET /sales rows → show «Apartado · pagar en tienda · vence {fecha}».
- S3 Change the deadline with PATCH /sales/:id/hold {expiresAt, expectedVersion} (update:Sale); HOLD_VERSION_CONFLICT 409, HOLD_EXPIRY_NOT_FUTURE 422, SALE_NOT_PAY_IN_STORE / SALE_HOLD_NOT_EDITABLE 409.
- S4 Staff with update:Sale can now charge ONLINE sales with POST /sales/:id/payments (it used to 404).
- S5 New cancellation reason HOLD_EXPIRED with canceledBy null → show «Sistema».
- S6 New notification SALE_HOLD_REVIEW (a sale with a partial payment or a pending receipt at the deadline) and `saleId` on notifications (null on request notifications).

## Tasks
- T1 | S1–S6 | worker | done — data layer: types, parsers, PATCH hold API + error decoding, notification type + saleId
- T2 | S2–S5 | worker | done — sales list + sale detail: hold badge/line, edit deadline dialog, charge online sales, HOLD_EXPIRED «Sistema»
- T3 | S6 | worker | done — notifications: SALE_HOLD_REVIEW copy and link to the sale
- T2b | S2, S4, S5 | worker | list rows use channel + cancelReason; CASH counter payments send the open cash session or warn
- T4 | S1–S6 | parent | full suite, build, live check when dev is up, merge

## Log
- L1 Backend 2026-11-18: «Pagar en tienda» complete on BE local main (owner pushes); contract docs/frontend-handoff/24-pay-in-store-hold.md; both migrations applied on the dev DB :5434.
- L2 T1 done (worker mwmlyf4s-13-vl3k): exports updateHold, isSaleHoldLive, saleHoldLine, decodeSaleHoldError/saleHoldErrorMessage/saleHoldErrorNeedsReload, saleCancelReasonLabel, saleCanceledByLabel, notificationMeta SALE_HOLD_REVIEW («Apartado vencido»), notificationTargetPath; 673 + 2392 related tests. S4 UI needs: canRegisterPayment must check update:Sale; SalesListView channel cell hardcodes «Punto de venta»; payments may send optional cashSessionId. Notes: contract example weekday wrong (19 nov 2026 is jueves); expired stage-2 CREDIT hold has no «venció» wording; list rows not parsed (hold typed only).
- L3 T3 done (worker mwmmet2s-15-mjo5): notifications 158 tests; useNotificationAlerts onOpen(path); no per-type preference exists (only email/sound), none added; parent updated the panel description to «Tus avisos de solicitudes del chatbot y de ventas».
- L4 T2 done (worker mwmmet2o-14-ecqj): sales 2036 tests; SaleHoldDeadlineDialog (Mexico City, ISO with offset), SaleDetailHoldCard, useSaleHoldDeadline (toast «Fecha límite actualizada»), canRegisterPayment requires update:Sale. Gaps: GET /sales rows carry no channel or cancelReason → «Canal» shows «En línea» for holds and «—» otherwise (was a hardcoded «Punto de venta»), list cannot show «Apartado vencido»; DebtPaymentModal has no cash-session picker (no cashSessionId sent); expired-but-not-cancelled hold still reads «vence <pasado>». Asked the backend for channel/cancelReason on list rows and dev data for a live check.
- L5 Backend: adding channel (POS|ONLINE) and cancelReason to GET /sales rows (doc to follow); agrees with «Apartado vencido · revisar» for stage 2 + still CREDIT/PARTIAL (adds it to handoff 24, tells the owner); checking cashSessionId in code; building a dev scenario script (live hold + expired hold with a partial payment in the manager branch).
- L6 Full suite on the branch: 1038 files / 17639 tests, eslint 0, build 0. Then «Apartado vencido · revisar» for stage 2 + CREDIT/PARTIAL (saleHoldLine; sales 2037 tests). Waiting: BE channel/cancelReason on list rows, cashSessionId answer, dev scenario data.
- L7 Backend (BE main b0732658, DEV :3003 up, Sucursal Centro): A-202611-000077 (6e64f7bc-…) ONLINE PICKUP CREDIT $189.00, live hold until 2026-11-19T21:47Z stage 0; A-202611-000078 (c146d74e-…) partial $94.50, expired hold stage 2 not cancelled, 3 SALE_HOLD_REVIEW notifications (manager included). GET /sales rows now carry channel (POS|ONLINE) and cancelReason. cashSessionId (S8, from the code): without it the payment updates the sale but is outside every till (no cash movement, cash-out shows the cash as surplus); no open till required. Recommendation: CASH counter payments send the user's OPEN cash session; with none, warn before charging; card/transfer may go without a till.
