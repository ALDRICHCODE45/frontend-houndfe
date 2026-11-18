# editorial-live run 2 — 2026-11-18 (runId run-20261118-2)

Backend http://127.0.0.1:35549 (pinned resource deaad4a9-…), FE Vite 127.0.0.1:4191 owned by Playwright
(stopped at exit; port free). Ran once, retries 0, serial.

Harness changes before the run: the save step proves persistence with the PUT 200 (response and network
audit), then checks the bar per actor. Publishers must reach EditorialPublishBar's settled text («Listo
para publicar» or «Completa lo pendiente para publicar»); everyone else must show «Guardado». Every step
records its HTTP log (METHOD /path -> status). An existing draft skips initialize and still goes through
save and discard.

## Result: 1 passed, 1 failed, 2 did not run

| actor | result | initialize | PUT /draft | discard |
|---|---|---|---|---|
| superadmin-global | PASS | skipped (draft left by run 1) | 200 | 200 |
| superadmin-tenant | FAIL at network step | 201 | 200 | 200 |
| manage-all | not run (serial) | — | — | — |
| editorial-only | not run (serial) | — | — | — |

The superadmin-tenant editorial cycle itself passed (open, initialize, save with the publish bar settled,
discard). The network step failed only on non-editorial requests ≥400, sent by the tenant app shell:
- GET /sales/refunds/pending -> 404
- GET /delivery-zone-validations -> 404
- GET /notifications/unread-count -> 404

The pinned backend does not serve those routes. Global mode does not load them.
No tenant traces (0), no publication requests, no third-party origins (0).

## Backend draft at the end

Clean as far as the FE can tell: the last mutation was superadmin-tenant POST /draft/discard -> 200, and
the UI went back to «initialize». The run-1 draft was discarded by superadmin-global (discard 200).

Files: evidence.json (per-step HTTP logs), console.log, last-run.json. Token grep eyJ|bearer|authorization: 0.
