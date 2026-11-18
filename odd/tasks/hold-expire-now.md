# Apartado: vencer ahora + venta cancelada por plazo vencido (FE)

Staff can make a pay-in-store hold expire now (same effect as the automatic expiry), a sale cancelled this way reads both «Venta cancelada» and «Plazo vencido», and the customer hears about it through the bot.

## Specs
- S1 Owner (verbatim): «Si hermano, y creo que vale la pena pensar si cuando la venta se cancela en estas condiciones, sea "venta cancelada" pero tambien "plazo vencido, me explico?? y no se si el bot le deba mandar algo al cliente en ese momento la verdad, puede ser que la mejor opcion sea que si. pero si, si necesitas algo del chatbot o del backend, coordinense entre ustedes por favor.»
- S2 Proposal accepted by the owner («Si hermano»): a «Vencer apartado ahora» action that does exactly what the automatic expiry does (backend endpoint needed), after asking the chatbot session what the bot tells the customer when the deadline changes and when it expires.
- S3 A sale cancelled by hold expiry (automatic or «Vencer apartado ahora») shows both states: «Venta cancelada» and «Plazo vencido», in the list and the detail.
- S4 The customer is told at expiry (owner leans «sí»); exact message and channel agreed with the chatbot and backend sessions.

## Tasks
- T1 | S2, S4 | coordination | chatbot: current bot messages on deadline change / expiry; backend: manual expire endpoint, permission, customer notice
- T2 | S2–S4 | worker | FE: «Vencer apartado ahora» (confirm dialog), dual state «Venta cancelada · Plazo vencido» in list and detail
- T3 | S1–S4 | parent | suite, build, live check, merge

## Log
- L1 Owner 2026-11-18: see S1 (verbatim).
