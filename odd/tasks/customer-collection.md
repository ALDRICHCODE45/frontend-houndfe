# «Cobrar todo» — POS side

The backend built «Cobrar todo» (one payment for several sales of a customer) with the owner's decisions; dev :3003 serves it. API source of truth: `odd/handoff/30-customer-collection.md` (verbatim copy) — workers read it in full.

## Specs
- S1 Owner decisions (2026-11-26, answered in this session): Q1 «Vencimiento más viejo primero»; Q2 «En orden; la última queda parcial»; Q3 «Sí, solo hasta el efectivo entregado»; Q4 «Cualquiera con permiso, toda venta»; Q5 «Un "Comprobante de cobro" general»; Q6 «Uno por cobro»; Q7 «Sí, obligatorio». Frontend F3: the POS v1 never sends `saleIds` (always «todas las que tienen deuda»).
- S2 Handoff §9 flow: open «Cobrar todo» from the customer history → preview without tenders (list in order, overdue marks, `debtCents`); while typing amounts, preview debounced (~300 ms) showing `appliedCents` per sale (0 = pending), `changeDueCents`, `remainingCustomerDebtCents`; 422s inline and confirm off while the last preview failed; confirm with the same `payments`, the open `cashSessionId`, `expectedDebtCents` = last preview `debtCents`, a new `idempotency-key` (network retry reuses key AND body); success → result + «Imprimir comprobante» (ticket or A4 PDF); `409 COLLECTION_DEBT_CHANGED` → «La deuda del cliente cambió», replace with `body.preview`, confirm again with a new key; `IDEMPOTENCY_KEY_IN_FLIGHT` → wait and retry same key/body; other 422 → refresh preview.
- S3 Handoff §2, §8: tenders 1–5 (`cash`, `card_credit`, `card_debit`, `transfer`; optional catalog `paymentMethodId`, `reference` ≤ 120), cash session required (pick the open own session like the counter charge does), «Switch on `error`» except `IDEMPOTENCY_KEY_REQUIRED` / `INVALID_FORMAT` whose code is in `message`; `CASH_SESSION_NOT_OWNED` is 422; never show the English `message` of `CASH_*`.
- S4 Handoff §1: `update:Sale` to collect, `read:Sale` to read/print; hide «Cobrar todo» without `update:Sale` or when the customer has no open debt. Due day from the first 10 characters of `dueDate`, no timezone conversion.
- S5 After a successful collection the customer history, its metrics and the sales lists refresh (paid/debt changed).

## Tasks
- [ ] T1 S1-S5 «Cobrar todo» in the customer history: API, types, error mapping, slideover/modal with live preview, tenders, cash session, confirm with idempotency, 409 refresh, result + receipt PDF — worker
- [ ] T2 Independent verification (Risk: item 1 money writes / idempotency) + native review — parent
- [ ] T3 Full suite, browser check vs :3003, merge — parent

## Log
- L1 Owner (2026-11-26): «Como lo recomiendes.» (pending items) after approving the contract decisions above; backend: «"Cobrar todo" ya está implementado, verificado … y mergeado en main local del backend (8fcbaff8 …). Dev :3003 ya lo sirve, con la migración aplicada».
