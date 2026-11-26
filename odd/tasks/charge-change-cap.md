# Counter charge: change never larger than the cash tendered

The backend found that the counter charge accepts card 1100 + cash 100 on a 1000 sale and records change 200 (more than the cash tendered). Owner: «Sí, que lo corrija aparte (Recomendado)». The backend is fixing `POST /sales/drafts/:id/charge` first (branch feat/customer-collection), then «Cobrar todo».

## Specs
- S1 Backend (2026-11-26): «si el cambio supera el efectivo entregado, el cobro se rechaza con 422 CHANGE_EXCEEDS_CASH_TENDERED (tarjeta 1100 + efectivo 100 sobre un total de 1000 → error; el cajero corrige montos)». «el POS tiene que mostrar ese error nuevo en el cobro».
- S2 POS: PaymentModal blocks the same case before sending (change due > sum of cash entries → inline error, confirm disabled), and maps the 422 `CHANGE_EXCEEDS_CASH_TENDERED` to an inline message in case the server rejects it anyway. Valid combinations (exact amounts, cash-only overpay with change ≤ cash, partial with customer) keep working exactly as today.

## Tasks
- [x] T1 S1-S2 PaymentModal client-side cap + error code mapping — worker
- [ ] T2 Full suite, merge — parent

## Log
- L1 Owner: «Bien hermano, ya pushee, adelante con los siguientes pasos recomendados por favor.» Backend message 9485e1d5 quoted in S1.
- L2 T1 (worker): PaymentModal computes the cash tendered; when the change due exceeds it, shows «El cambio no puede ser mayor que el efectivo entregado. Ajusta los montos.» under «Cambio:», disables confirm and sends nothing. 422 CHANGE_EXCEEDS_CASH_TENDERED added to ChargeDomainErrorCode and mapped `inline` with the shared CHANGE_EXCEEDS_CASH_MESSAGE. RED 3 → GREEN 125/125; related 143 files / 2707 tests; eslint, type-check clean. Card-only overpay unchanged (no cash entry → no change due).
