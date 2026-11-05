# Design pass 2 (FE)
Second design pass over the screens the system-redesign harness covered thinly or never: real data, four states, 1440/390, light/dark, judged against docs/design-system.md.
Branch feat/design-pass-2 from main e1cea788. Backend and chatbot agent requests about FE work take priority; the pass resumes after them.

## Specs
- S1. «vamos con 1. pasada de diseno» — option 1 was: «Una pasada de diseño en el navegador sobre las pantallas que todavía no revisamos con el sistema de diseño.»
- S2. «en el momento en el que te contacte algun agente del backend o del chatbot sobre alguna funcionalidad que te toque, dale prioridad a eso por favor y despues sigues con la pasada de diseno.»
- S3. Standing rule (user): «en las pruebas que haces en el navegador con el mcp de playwrite no solamente tienes que verificar que algo funcione, si no que tambien debes verificar el diseno de la ui, que todo se vea bien, que todo siga el system design, aprovechar para mejorar/ampliar el system design». Each screen is reviewed with real data where it can be produced, plus empty, loading and error, at 1440 and 390, in light and dark.
- S4. Standing rule (user): «ninguna persona va a buscar algo o va a reconocer o seleccionar algo por su id ... debe de ser por el nombre del elemento o cualquier otro atributo reconocible fácilmente por un humano». No ids on screen; test data stays readable.

## Tasks
- [x] T1 S1,S3,S4 Reembolsos /pos/reembolsos — worker; table fits at 1440 (7 cols), age said once, «Pagó con», card foot; 103 tests — cb603375
- [ ] T2 S1,S3,S4 Decisiones pendientes with real rows (list and drawer) — worker
- [ ] T3 S1,S3,S4 Recepciones de caja with data — worker
- [ ] T4 S1,S3,S4 Caja with sessions (sessions list lacks time/cashier: BE API debt) — pending
- [ ] T5 S1,S3,S4 Product detail: Presentaciones, Inventario, Historial slideover — pending
- [ ] T6 S1,S3 Editorial route /pos/products/:id/editorial: does it still earn a separate screen next to Contenido? (user decision) — pending
- [ ] T7 S1,S3 Notificaciones with data (dark switch contrast) — pending
- [ ] T8 S1,S3 Delivery route detail, driver view — pending
- [ ] T9 S1,S3 Tenant selection empty/loading/error — pending
- [ ] T10 S1,S3 Re-check round-2 low findings (review-findings-r2.md) one by one — pending

## Log
L1. User (2026-11-05): «Bien, si hermano, vamos con 1. pasada de diseno. pero tambien hay otra cosa, se estan cocinando algunas cosas en el chatbot, principalmente tiene que intervenir el backend, pero en algun momento tambien tendras que intervenir tu, asi que si, hazlo, pero en el momento en el que te contacte algun agente del backend o del chatbot sobre alguna funcionalidad que te toque, dale prioridad a eso por favor y despues sigues con la pasada de diseno. alguna duda?»
L2. Coverage map (explorer): every screen but Reembolsos went through the system-redesign harness; the gaps are screens shot without data or added later. Ranked list → T1–T8; T9–T10 from the open debts. Session published as «FE design pass (houndfe frontend)» so backend and chatbot agents can reach it.
L3. Runtime: BE answers on :3003; FE dev server on :5173 against it (README in odd/evidence/system-redesign). T1–T3 run as parallel workers (disjoint feature folders); shared design-system components are changed by the parent only.
L4. T1 done (cb603375): high fix, 7-column fit at 1440 with the sidebar open, plus med/low copy fixes. The amount overflow was already fixed (0ce57ed7). The design system now records that fit is guaranteed at 1440 (1280 may scroll inside the card) and the one-fact rule. Open: the settle amount field lacks thousands separators (hand-built, not HfMoneyInput); follow-up for T10.
