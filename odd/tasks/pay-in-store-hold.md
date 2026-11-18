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
- T4 | S1–S6 | parent | full suite, build, live check when dev is up, merge

## Log
- L1 Backend 2026-11-18: «Pagar en tienda» complete on BE local main (owner pushes); contract docs/frontend-handoff/24-pay-in-store-hold.md; both migrations applied on the dev DB :5434.
- L2 T1 done (worker mwmlyf4s-13-vl3k): exports updateHold, isSaleHoldLive, saleHoldLine, decodeSaleHoldError/saleHoldErrorMessage/saleHoldErrorNeedsReload, saleCancelReasonLabel, saleCanceledByLabel, notificationMeta SALE_HOLD_REVIEW («Apartado vencido»), notificationTargetPath; 673 + 2392 related tests. S4 UI needs: canRegisterPayment must check update:Sale; SalesListView channel cell hardcodes «Punto de venta»; payments may send optional cashSessionId. Notes: contract example weekday wrong (19 nov 2026 is jueves); expired stage-2 CREDIT hold has no «venció» wording; list rows not parsed (hold typed only).
- L3 T3 done (worker mwmmet2s-15-mjo5): notifications 158 tests; useNotificationAlerts onOpen(path); no per-type preference exists (only email/sound), none added; parent updated the panel description to «Tus avisos de solicitudes del chatbot y de ventas».
- L4 T2 done (worker mwmmet2o-14-ecqj): sales 2036 tests; SaleHoldDeadlineDialog (Mexico City, ISO with offset), SaleDetailHoldCard, useSaleHoldDeadline (toast «Fecha límite actualizada»), canRegisterPayment requires update:Sale. Gaps: GET /sales rows carry no channel or cancelReason → «Canal» shows «En línea» for holds and «—» otherwise (was a hardcoded «Punto de venta»), list cannot show «Apartado vencido»; DebtPaymentModal has no cash-session picker (no cashSessionId sent); expired-but-not-cancelled hold still reads «vence <pasado>». Asked the backend for channel/cancelReason on list rows and dev data for a live check.
