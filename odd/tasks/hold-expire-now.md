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
- L2 Chatbot session: the backend emits feed items sale.pickup_reminder / sale.pickup_extended / sale.pickup_expired and the bot writes to the customer (pay-in-store-copy.ts). Expired+cancelled already sends «Su pedido {folio} se canceló porque venció el plazo para recogerlo y pagarlo en tienda. Si todavía lo quiere, con gusto le ayudo a pedirlo de nuevo.» (a manual expiry with HOLD_EXPIRED gets the same). Expired with a payment: no customer message today; proposed «El plazo de su pedido {folio} venció. Como tiene un pago registrado, alguien del equipo le va a contactar para cerrarlo.» (needs a new backend feed item). sale.pickup_extended says «ampliamos» even when shortened — told the chatbot the POS allows shortening (flag or neutral text, to agree with the backend). No Meta templates: free text only within the 24 h window, so expiry notices usually drop (WINDOW_CLOSED); chatbot will propose utility templates (~0.0085 USD each) to the owner. Nothing shown in the POS.
- L3 Chatbot: asked the backend for previousHoldUntil (or direction) on sale.pickup_extended; bot says «Le ampliamos…» when later, «Actualizamos el plazo de su pedido {folio}: ahora puede recogerlo y pagarlo hasta el {fecha y hora}.» when earlier or unknown. Owner approved Meta templates. No FE change.
- L4 S3 done (worker mwmqnfqr-19-8y3b) + owner bug: sort select blank → «Más recientes» default, «Orden personalizado» placeholder, «Ordenar:» label; sales 2070 tests. Waiting for the backend expire endpoint.
