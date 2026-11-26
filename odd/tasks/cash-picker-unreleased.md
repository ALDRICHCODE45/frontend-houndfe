# Cash picker: a register with an unreleased session is shown as available

## Specs
- S1 Owner (2026-11-26, verbatim): «cuando quiero abrir una caja, me dice que esta "disponible para abrir" pero cuando confirmo el monto de fondo inicial, y presiono "Abrir caja" me salta este mensaje: Revisa antes de abrir · Esa caja ya tiene una sesión sin liberar. Libera el cajón antes de abrir otra. y no se como solucionarlo. y eso si me esta frenando para avanzar.»
- S2 Backend rule (houndfe-backend `src/cash-register/infrastructure/cash-adapter-opening.ts` ~L100): opening fails with `CASH_REGISTER_UNRELEASED_SESSION` when ANY session of that register has `drawerReleasedAt = null` (OPEN, COUNTING, SUBMITTED… not only OPEN). Seen 2026-11-26: Caja Express and Caja nueva ui (SUBMITTED), Caja Mostrador 2 and Caja Principal (OPEN), sessions from 2026-11-04/05 by cashier@houndfe.com; the picker showed all as «Disponible para abrir».
- S3 Expected: the «Abrir caja» picker never offers a register that the backend will refuse; it shows it as busy with who/since and a way to reach the blocking session (verify/close/release, per the user's permissions), and the error message after a refused open points to that session too.

## Tasks
- [ ] T1 S1-S3 Fix availability in the opening picker + actionable message — worker
- [ ] T2 Full suite, preview check, owner check, merge — parent

## Log
- L1 Owner report S1 with screenshots (Caja Express «Disponible para abrir» → refused). DB check by parent: 4 of 5 active registers held unreleased sessions.
