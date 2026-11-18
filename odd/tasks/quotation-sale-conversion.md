# POS «Pedido»: venta ⇄ cotización (FE)

Front end of the backend conversion (BE c25b8816): the POS «Pedido» tab turns the open sale draft into a quotation, a quotation turns into a sale draft, converted quotations show their sale, and the deprecated quotation tax-rate override goes away.

## Specs
- S1 Owner (verbatim): «Lo que sea mas completo hermano.» → both directions.
- S2 Contract: /home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend/docs/frontend-handoff/23-quotation-sale-conversion.md and docs/quotations-frontend.md (status CONVERTED_TO_SALE, saleId/convertedAt on the quotation, quotationId on the sale, status filter, tax-rate rule). Workers read both whole.
- S3 Sale → quotation (backend message, verbatim facts): needs create:Quotation + delete:Sale and an Idempotency-Key; body accepts customerNotes (≤280); discards the sale draft in the same transaction only if untouched (no payments, refunds, receipts, stock movements, route stops or promotion use); what cannot be carried (order-level or «lleva X paga Y» promotions) comes in droppedAdjustments with cents — show it to the cashier.
- S4 Quotation → sale: needs create:Sale + update:Quotation and an Idempotency-Key; converts DRAFT or SENT; opens a sale draft with quoted prices and discounts to the cent; 422 QUOTATION_EXPIRED, QUOTATION_CANCELLED, QUOTATION_ALREADY_CONVERTED (with saleId), QUOTATION_LINES_UNAVAILABLE (lines[] with each reason); IDEMPOTENCY_KEY_* → 409/400.
- S5 A converted quotation cannot be edited, sent, cancelled or deleted; its PDF still works. Opening the sale runs today's automatic promotions: the total can stay or go down, never up.
- S6 Tax-rate: do not offer the per-quotation override on new quotations; show the included IVA from the response; follow the exact rule in docs/quotations-frontend.md.

## Tasks
- T1 | S2–S5 | worker | done — API, types and error decoding for both endpoints and the new fields
- T2 | S1, S3 | worker | done — POS «Pedido» tab: sale draft → quotation (confirm with customerNotes, droppedAdjustments, open the quotation)
- T3 | S1, S4, S5 | worker | Quotations: «Convertir en venta», converted state read-only with link to the sale, status filter, rejections; sale detail «Desde cotización»
- T4 | S6 | worker | remove the tax-rate override per the doc rule
- T5 | S1–S6 | parent | full suite, build, live check when the backend is deployed, merge

## Log
- L1 Backend 2026-11-18: conversion ready on BE local main c25b8816 (independent verification); owner pushes; backend will say when deployed for a dev/prod check.
- L2 T1 done (worker mwmg6h1s-t-oba2): quotationApi.createFromSale / convertToSale, decodeQuotationConversionError (codes per handoff + SALE_* rejections, IDEMPOTENCY_KEY_*, VALIDATION, FORBIDDEN, NETWORK, RESPONSE_INVALID, UNKNOWN), DroppedAdjustment kinds, isConvertedToSale/isDeletable; 991 related tests. Open for T3: stepper index for CONVERTED_TO_SALE is -1. Notes trimmed, blank → null.
- L3 T2 done (worker mwmgjq5y-u-s2m3): button «Pasar a cotización» (not a tab), dialog «¿Pasar esta venta a cotización?», note «Nota para el cliente» N de 280, summary step «No se trasladó: Promo X (−$12.00)» with «Abrir cotización» / «Seguir vendiendo»; navigates to the quotation; sales 1929 tests. Not browser-checked yet.
