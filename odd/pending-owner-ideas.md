# Pending owner ideas (to do later)

Noted 2026-11-26 while testing «Cobrar todo». Not started; each needs its own task when the owner picks it up.

1. **Richer customers table.** The customers table should be as complete as the sales or products tables (columns, sorting, actions, density). Do this first.
2. **More customer filters.** The customers module keeps growing (pets, history, debt, collections). Today a customer is found one by one. Owner wants filters such as «qué cliente tiene deuda, de cuánto y de cuándo» (has debt, debt amount range, debt age / oldest due date). Likely needs backend filters on `GET /customers`.
3. **Sales history with more room.** The customer sales history is big enough for its own page, or at least a wider slideover. Owner feels «encerrado» in the current slideover.
4. **Cash register list says «Disponible para abrir» for a register with an unreleased session.** Opening then fails with `CASH_REGISTER_UNRELEASED_SESSION` («Esa caja ya tiene una sesión sin liberar…»). Seen 2026-11-26: Caja Express and Caja nueva ui (SUBMITTED), Caja Mostrador 2 and Caja Principal (OPEN), all sessions from 2026-11-04/05 by cashier@houndfe.com — the picker showed all four as available; only Caja QA rediseño T6 could really open. The picker should show the register as busy and point to the session that blocks it.
5. **Bulk actions on customers** (owner 2026-11-26: «Después»): select customers → «Estados de cuenta PDF» and «Exportar CSV».
6. **Audit table for customer exports** (owner 2026-11-27: «Por ahora no, pero dejalo anotado para platicarlo despues»): who/when/filter/rows of each CSV export, stored in the DB (today only the backend structured log).
