# Split one amount across several payment methods — POS

Owner wants help splitting what is due across several tenders in the three charge screens. Built on `feat/customer-collection` (not merged yet). Shared pure helper + one shared control, wired into «Cobrar todo», the counter checkout and the sale debt payment.

## Specs
- S1 Owner (2026-11-26, verbatim): «en la iamgen puedes ver que estoy intentando cobrar todo pero haciendolo con distintos metodos de pago, y cuando eligo uno, automaticamente ingresa el monto total, en este caso en "efectivo" pero cuando comienzo a agregar mas metodos de pago, no tengo ninguna opcion para repartir el monto en partes iguales, para repartirlo en algun otro tipo de forma, etc.. y si creo que tendria mucho sentido y seria de mucha ayuda algo asi..»
- S2 Owner choice «Lo que falta» en cada método: «Un botón en cada monto que completa el resto pendiente (ej. efectivo 2,000 → tarjeta toma 4,076.29).»
- S3 Owner choice «Partes iguales»: «Un botón «Repartir en partes iguales» divide la deuda entre los métodos elegidos; el centavo sobrante va al último.»
- S4 Owner choice «Por porcentaje»: «Escribir % por método (ej. 50/30/20). Más flexible, más complejo de usar.»
- S5 Owner choice on adding a method: «Entra con lo que falta (Recomendado)» — «El nuevo método se carga con el restante pendiente; si ya está todo cubierto, entra en blanco sin error hasta que escribas.»
- S6 Owner choice on scope: «Los tres (Recomendado)» — «Mismo comportamiento en «Cobrar todo», cobro del mostrador y abono; se hace una vez en una pieza compartida.»
- S7 Keep every existing money rule of each screen: amounts in cents (no float drift, splits sum exactly to the target), non-cash tenders never exceed what is due (only cash can exceed and gives change), tender limits (1–5 in «Cobrar todo»), idempotency/confirm logic untouched. The design system applies (`design/system.md`, `docs/design-system.md`: 12px cards, 6px controls, no nested cards).

## Tasks
- [ ] T1 S1-S5, S7 Shared split helper (cents math: remaining, equal split with leftover cent on the last, percent split) + shared control, wired into «Cobrar todo» — worker
- [ ] T2 S6-S7 Wire the same helper/control into the counter checkout (PaymentModal) and the sale debt payment (DebtPaymentModal) — worker
- [ ] T3 Full suite, preview check vs :3003, owner browser check — parent

## Log
- L1 Owner (2026-11-26): S1 verbatim; answers S2-S6 via structured question.
