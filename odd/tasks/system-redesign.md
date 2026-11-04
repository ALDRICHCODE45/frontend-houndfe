# System redesign and dead-code removal (overnight)

Branch feat/system-redesign from main a7aeb04d. Extend the UI clarity pass (odd/tasks/ui-clarity-pass.md) to every screen. docs/design-system.md plus the Patrones catalog are the source of truth, and we grow them as screens show new needs. After that comes the morning O1 implementation from the backend handoff (houndfe-backend/docs/frontend-handoff/).

## Specs

S1. Consistency across the whole system, verbatim: "quiero que todo el sistema quede consistente, y en las demas pantallas apareceran mas cosas que podriamos mejorar, no solamente esto, es decir, ampliar el system design en medida que vayamos avanzando con el rediseno". Every routed screen adopts the catalog patterns (row menus, StatusBadge, text diet, tokens). New needs become shared patterns documented in docs/design-system.md and Patrones.
S2. Old design and dead code, verbatim: "tambien creo que hay algunas cosas con el diseno viejo del sistema, eso ya no puede pasar, si es necesario eliminar todo el codigo viejo y que no se ocupa en ningun lado, tanto del diseno viejo como lo demas". Remove old-design remnants and any code nothing uses, with evidence (no importers, no route).
S3. Source of truth and research, verbatim: "recuerda que el sistem design debe ser tu fuente de la verdad, pero tambien debes buscar en internet ejemplos, reglas y principios de ux/ui". Researched principles are recorded in the design system doc.
S4. Browser review, verbatim: "cuando revises en el navegador, revisa principalemnte diseno, que se vea bien, que sea moderno, etc.. puedes buscar en dribble ejemplos para inspirarte". Screenshots at 1440 and 390, in light and dark, with a design critique.
S5. Scope decision: "Visual + estructura (recomendado)". This means style, hierarchy, layouts, tables and forms with the new patterns, with no business flow or field changes.
S6. Delivery decision: "Rama + merge local a main (recomendado)". Commits per screen, then a local merge to main after verification. The user pushes.
S7. Worktrees decision: "Limpiar las seguras (recomendado)". Remove only the worktrees with no uncommitted changes whose commit is reachable from a branch, and list the rest.
S8. Test DB: "la base de datos que tenemos ahora, es la base de datos de prueba y es completamente desechable". Do not build test databases.
S9. Morning: read the backend handoff docs and implement them (O1 inventory journal). This depends on the backend.

## Tasks

T1 [S2,S3] Inventory screens and dead code (explorer), research principles, and extend docs/design-system.md. Route: explore, then inline.
T2 [S2] Remove dead code and old-design remnants, with suite/tsc/build green. Route: inline or writer.
T3 [S1,S5] Migrate screens to the patterns, feature by feature. Route: writers in background on disjoint features.
T4 [S4] Runtime design review per feature, plus fixes.
T5 [S7] Clean the safe worktrees.
T6 [S6] Close: assess, merge locally to main, and record.
T7 [S9] Implement the O1 handoff (separate feature document when it starts).

## Log

L1. User request (2026-11-04), verbatim: "Bien, si, por favor, vamos por eso, pero eso es algo puramente del frontend, quiero que todo el sistema quede consistente, y en las demas pantallas apareceran mas cosas que podriamos mejorar, no solamente esto, es decir, ampliar el system design en medida que vayamos avanzando con el rediseno, y esa tarea te la quedas tu, tambien creo que hay algunas cosas con el diseno viejo del sistema, eso ya no puede pasar, si es necesario eliminar todo el codigo viejo y que no se ocupa en ningun lado, tanto del diseno viejo como lo demas, esto te lo quedas de tarea tu para hacerlo toda la noche mientras yo duermo, pero no quiero que el backend se quede sin hacer nada, lo que quiero es que antes de que comiences a realizar eso, te coordines con el backend, en lo que te tienes que coordinar sobre las siguientes funcionalidades del plan, y mientras tu trabajas en esto en la noche, el backend trabaja por su parte en las demas funcionalidades creando al mismo tiempo documentacion para ti, para que en la manana, cuando tu ya hayas terminado el pulido de todo el sistema, ahora leas toda la documentacion que el backend te dejo y lo implementes, igualmente si durante la noche el backend quiere preguntarte algo, te lo puede preguntar, le contestas y sigues en lo tuyo, recuerda que el sistem design debe ser tu fuente de la verdad, pero tambien debes buscar en internet ejemplos, reglas y principios de ux/ui, y cuando revises en el navegador, revisa principalemnte diseno, que se vea bien, que sea moderno, etc.. puedes buscar en dribble ejemplos para inspirarte o en cualquier otro lugar que quieras. recuerden tambien los dos (tu y el backend) que no es necesario estar haciendo bases de datos de prueba todo el tiempo, la base de datos que tenemos ahora, es la base de datos de prueba y es completamente desechable, no se preocupen por perdida de datos de ningun tipo. Todo esto tambien comentaselo al backend por favor, si tienen pretguntas que hacerme sobre el diseno o desiciones de productos, es ahora o nunca porque me ire a dormir despues."
L2. Backend coordination (session 01a1a538-0f2a). Plan order: O1 inventory journal, then O2 lots on variants, then O4 receipts. The user answered P1 A (automatic opening balance), P2 A (block direct quantity edit; the form fields become read-only), P3 A (fixed reasons with Otro and a required note), P4 A (no negative stock), S1 A (branch = tenant, as today), P7 B (sales deduct from the earliest-expiring lot, FEFO, already in O1), P8 A (retire the legacy /orders; the FE does not use it, confirmed by grep), and P6 A (the BE builds O1 complete tonight, plus an O2 contract on paper). The conventions follow O3: cursor Page<T>, Idempotency-Key, expectedVersion 409, new subjects InventoryJournal/InventoryAdjustment, signed quantity with balanceAfter, and the actor as displayName.
