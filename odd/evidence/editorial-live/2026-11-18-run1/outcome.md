# editorial-live run 1 — 2026-11-18 (runId run-20261118-1)

Backend: http://127.0.0.1:35549, resourceId deaad4a9-e4b1-47b9-876f-4c9bd305a815 (pinned). FE: Playwright-owned
Vite on 127.0.0.1:4191 (stopped by Playwright at exit; port free afterwards). Ran once, retries 0, serial.

## Result: FAILED at superadmin-global:save; the other 3 actors did not run (serial)

| actor | result | steps |
|---|---|---|
| superadmin-global | FAIL | preflight pass · open pass (GET /products/:id 200, GET /editorial 200, route kept, «Volver a sucursales») · initialize pass (POST …/draft/initialize **201**) · **save fail** (underlying error suppressed by design) |
| superadmin-tenant | not run | — |
| manage-all | not run | — |
| editorial-only | not run | — |

HTTP seen (from evidence): GET /products/:id 200, GET /products/:id/editorial 200, POST /draft/initialize 201.
PUT /draft and POST /draft/discard: statuses not captured (the journey suppressed the error; no exchange log on failure in run 1).
Network step (tenant leakage, ≥400, third-party origins) not reached for any actor.

## Diagnosis (static, no retry)

Most likely a harness defect, not an FE defect: after a successful save the harness waited for
`.hf-save-bar__status` to read /Guardado/. For publishers (Super Admin, manage:all) the FE replaces
HfSaveBar with EditorialPublishBar once nothing is pending (EditorialWorkspace.vue:287-290,
EditorialPublishBar.vue:25-32), whose status reads «Revisando qué falta para publicar…» / «Listo para
publicar» / «Completa lo pendiente para publicar», never «Guardado». Not confirmed: the PUT status
itself was not recorded.

## Backend state left behind

The superadmin-global initialize (201) created a draft on the disposable product; discard did not run.
Whether the PUT landed is unknown. The next run handles an existing draft (initialize skipped), or the
backend can discard it.

## Harness changes after run 1 (for run 2, not yet run)

- e2e/editorial-live/support/actor-expectations.ts: per-actor save-bar expectation (publish bar for
  publishers, «Guardado» otherwise); title expectation («Producto» without read:Product).
- On failure the spec now also records the redacted backend exchange log (METHOD /path -> status).
- Ownership pin moved to e2e/editorial-live/support/ownership-pin.ts (filled).

Files: evidence.json, console.log, last-run.json (token grep eyJ|bearer|authorization: 0 hits).
