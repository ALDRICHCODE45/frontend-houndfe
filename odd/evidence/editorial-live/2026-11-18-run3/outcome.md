# editorial-live run 3 — 2026-11-18 (runId run-20261118-3)

Backend http://127.0.0.1:35549 (pinned resource deaad4a9-…), FE Vite 127.0.0.1:4191 owned by Playwright
(stopped at exit; port free). Ran once, retries 0, serial. Exit 0: **4 passed**.

Rule change: every request ≥400 still fails, except GET answering exactly 404 on three exact paths
(query dropped): /sales/refunds/pending, /delivery-zone-validations, /notifications/unread-count. Each hit
is recorded as «unserved by the isolated backend». 16 unit tests cover the allowlist.

| actor | result | initialize | PUT /draft | discard | allowlisted 404s | other ≥400 |
|---|---|---|---|---|---|---|
| superadmin-global | PASS | 201 | 200 | 200 | none | none |
| superadmin-tenant | PASS | 201 | 200 | 200 | refunds/pending, delivery-zone-validations, notifications/unread-count | none |
| manage-all | PASS | 201 | 200 | 200 | same 3 | none |
| editorial-only | PASS | 201 | 200 | 200 | notifications/unread-count | none |

- Title: the three publishers got the product name from GET /products/:id (200). Editorial-only showed
  «Producto» and made no GET /products/:id.
- Save bar: publishers settled on the publish bar; editorial-only showed «Guardado».
- Tenant traces 0, publication requests 0, third-party origins 0 for every actor.
- Backend draft clean at the end: each actor's last mutation was POST /draft/discard -> 200, and the UI
  went back to «initialize».

Files: evidence.json (per-step HTTP logs), console.log, last-run.json. Token grep eyJ|bearer|authorization: 0.
