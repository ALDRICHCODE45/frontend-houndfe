# Caja: rediseño completo (FE)

Redesign of the whole Caja section (registers, opening, shift workspace, movements, counts, verification, handover/custody, closing) with modern UX/UI and accessibility as the priority.

## Specs
- S1 Owner (verbatim): «vamos a hacer un rediseno de toda la seccion de "caja" por favor, no me gusta la ui actual, ten como prioridad la ux/ui moderna, accesibilidad, si quieres puedes investigar en algun lado, haz las propuestas y avanzamos.»
- S2 Proposals first (canvas directions); implementation only after the owner chooses.
- S3 Behaviour, API calls, permissions and money rules (pesos input, cents on the wire, explicit fund confirmation, open-till rule for cash) stay as they are unless the owner decides otherwise.

## Tasks
- T1 | S1, S3 | explore | map the current Caja screens, flows, states and pain points (code + earlier odd docs)
- T2 | S1, S2 | design | research modern POS cash-drawer UX + accessibility; 3 directions on the canvas + mobile/states board
- T3 | S1–S3 | workers | implement the chosen direction (after the owner chooses)
- T4 | S1–S3 | parent | browser check light/dark 1440/390, live check, suite, merge

## Log
- L1 Owner 2026-11-18: see S1 (verbatim).
- L2 Owner chose «Sí, resincronizar y diseñar (recomendado)»: re-sync design/system.md from src/assets/main.css before the directions.
- L3 T1 map (explorer mwmtavuz-1c-p7yn): routes /pos/caja (CashRegisterView + CashWorkspace: shift card, task rail Apertura/Sesiones/Movimientos/Conteo/Notas/Verificación/Custodia/Recepciones) and /pos/caja/recepciones; no «close register» step in the FE (no close endpoint in cash.api.ts; backend sets CLOSED, probably after verification — to confirm); flows: open (register → optional received float → fund → «Confirmar fondo» → «Abrir caja»), cash in/out (own OPEN shift, reason required), count («Iniciar conteo (congelar)» → per-channel pesos, denominations), verify (another person with audit), custody (FLOAT/WITHDRAWAL, recipient picker or raw UUID without read:User, «Liberar cajón»), receive (Recepciones). Pain points: no sense of next step, nothing selected by default, split opening, raw UUID recipient, scattered small red errors, icon/contrast/layout feedback, duplicated Recepciones entry. Constraints: same API, pesos input/cents wire (cash-input.ts), explicit fund confirmation, blind count window, verifier ≠ cashier, recipient-only receive, drawer release separate, permissions per action, useCashSaleSession consumers (PaymentModal, SettleRefundSlideover, DebtPaymentModal).
- L4 Backend (from code): states OPEN → COUNTING → SUBMITTED → CLOSED (advance only); drawer release = drawerReleasedAt; verification (another person) keeps the state; explicit CLOSE exists: POST /cash-sessions/:id/close {notes?} (closer ≠ cashier, drawer released, declaration + verification, notes on difference, handovers received; create:CashClosing) → closing {id, sessionId, folio, createdAt, snapshot}; GET /cash-closings/:id, PDF GET /cash-closings/:id/pdf (read:CashClosing). The FE has no close step today. Blind rule: the cashier sees no sales/expected/difference/movements from OPEN until declaring. No «my session» endpoint (GET /cash-sessions?limit=1, first with drawerReleasedAt null). No per-method totals (group movements[] client-side after the blind window). Pending: open decisions 1-9 of the cash handoff; lists filter in memory. Relayed to the design worker.
