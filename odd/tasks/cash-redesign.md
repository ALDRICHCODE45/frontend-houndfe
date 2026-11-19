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
