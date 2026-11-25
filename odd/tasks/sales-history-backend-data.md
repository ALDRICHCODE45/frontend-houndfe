# Sales history — backend data (handoff 28) in the POS

Follow-up of `odd/tasks/sales-history-redesign.md`: the items the design tagged «requiere backend». Backend contract v1 approved 2026-11-25; implemented on backend main 06dc0097 (dev :3003). API source of truth: `odd/handoff/28-sales-history-redesign.md` (verbatim copy) — workers read it in full.

## Specs
- S1 Owner (2026-11-25): «has todo lo que no dependa o espere alguna decision mia hermano, por favor, es decir, todo excepto lo primero de la lista cierto?? coordinate con el backend y a darle.» Owner answers: Q1 «Sí, también en el PDF (Recomendado)»; Q2 «Sí, después de lo demás (Recomendado)»; Q3 «Propuesta aparte, más adelante (Recomendado)». The statement PDF and «Cobrar todo» are NOT in this batch (handoff §7).
- S2 Handoff §2.1: every `GET /sales` row has `itemsPreview` (≤ 3 `{productName, variantName, quantity}`) and `itemsCount` (lines) — «Show «+2 más» as `itemsCount - itemsPreview.length` when it is > 0.» Shown in the customer history rows/cards without opening the row.
- S3 Handoff §2.2–§3: `summary.averageTicketCents` (customer metric «Ticket promedio»), `counts.overdue`, `summary.overdueDebtCents`, `summary.oldestOverdueDueDate`; «the customer card shows «2 vencidas · $610.00 · la más antigua el 10/11» … tapping it reloads the same list with `&overdue=true`». `overdue` accepts only `true`/`false`; extended filter (narrows data/pagination/filterSummary, never summary/counts). «`summary.oldestOverdueDueDate` is the same date string the row shows … Format it the same way as the row's due date, never through a timezone conversion.» Overdue = CONFIRMED + open debt > 0 + UTC date of `dueDate` before today in America/Mexico_City (§3 examples).
- S4 Handoff §4: `GET /customers/:customerId/sales-monthly?months=1..24` (default 12, `read:Sale`) — exactly `months` entries oldest first, zero months included, «for the chart in the customer card»; `404 CUSTOMER_NOT_FOUND` code-only.
- S5 Handoff §5.1: seller report rows (`confirmed.rows[]`, `canceled.rows[]`) carry `customer: {id, name} | null` — «`null` = público en general … Show «Público en general».»
- S6 Handoff §5.2: `topProducts` (≤ 5, order by quantity) — «Label the amount column «antes de descuentos de la venta» and never present it as part of the seller's total.»
- S7 Handoff §5.3: `dailyTotals`, one entry per local day including zero days — per-day chart for the seller.
- S8 Handoff §5.4: `previousPeriod` — «Use it for «+12% vs. período anterior»; guard the percentage when `previousPeriod.netSalesCents` is `0`.»
- S9 Keep: seller report contract (no client-side sums, re-sorting or reclassifying of rows; money totals from the backend), customer history KPIs customer-wide, existing pet/status filters, the redesigned look (design/sales-history/01 and 04, which show these items with «requiere backend» tags — now build them without the tags).

## Tasks
- [x] T1 S2-S4, S9 Customer history: items preview in rows/cards, «Ticket promedio» metric, overdue warning + «Vencidas» filter (overdue=true), monthly chart from sales-monthly — worker A
- [x] T2 S5-S9 Seller report: customer per row, top products, daily totals chart, previous period comparison — worker B
- [ ] T3 Full suite, browser check vs :3003, merge — parent

## Log
- L1 Owner (2026-11-25): «has todo lo que no dependa o espere alguna decision mia …»; Q1/Q2/Q3 answered as above; owner OK relayed to the backend (and given directly in its session).
- L2 Backend (2026-11-25): «El rediseño de historiales ya está implementado, verificado y mergeado en main local del backend (06dc0097 …). Dev :3003 corre ese main (sin migraciones).» Change vs v0: «el día de vencimiento es la fecha UTC de dueDate, o sea la misma que ya mostrás en la fila».
- L3 T1 (worker A, 6d607bfc) S2-S4, S9: product preview in rows/cards («+N más»), «Ticket promedio», overdue warning («N vencidas · $X · la más antigua el dd/mm/aaaa», formatSaleDueDate, no timezone shift) → «Vencidas» chip sending overdue=true (combines with petId; KPIs unchanged), merged with the debt banner on mobile; 12-month chart from GET /customers/:id/sales-monthly (read:Sale; quiet retry on error). New fields optional (hidden when absent). 53 files / 573 focused tests incl. design guards; eslint, type-check clean.
- L4 T2 (worker B) S5-S9: seller report parser accepts optional `customer`, `topProducts`, `dailyTotals` (exactly one per local day of [from,to)), `previousPeriod` (ends at from, same length), strict when present; customer line under the folio (confirmed + canceled, «Público en general» for null/blank); «Más vendidos» with «Importes antes de descuentos de la venta; no suman a las ventas netas»; «Ventas por día» CSS chart (scrolls inside its own box past ~60/120 days); «±N% vs. período anterior» on Ventas netas («Sin ventas en el período anterior» when 0). PDF unchanged (backend). seller-report 207/207, related 402/402, guards 57/57; eslint, type-check clean.
- L5 RDD assess: T1 6d607bfc medium (1,527 lines) and T2 032cebf5 medium (1,030 lines), reviewDue false (under_budget). Risk: none (additive read-only fields; no permissions, money writes or shared contracts changed).
