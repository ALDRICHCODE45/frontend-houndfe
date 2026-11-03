# O3b real disposable-backend browser harness

**Executed for T4 (see draft-order-management-verification.md and task Log L18-L20).**
The parent configured the API (40377), the authorized credentials path and the seed prefix, then ran both stages to a full pass. Fixture screenshots are not real-backend evidence.

## Parent prerequisites and human authorization

1. Obtain the backend owner's ready disposable runtime: exact ephemeral loopback API port (never 3000), seed prefix, successful disposable-only migration/probe confirmation, and the new owner-only RUN directory's exact credentials path. Do not use an existing database or reuse O3a's port/path.
2. Ask the human: **“May I read `<exact absolute credentials path>` into ephemeral browser memory solely to authenticate the disposable O3b Playwright checks?”** Await authorization for that exact path. Do not open/read the file in the terminal, editor, a tool response, or Node. Do not paste credential contents into MCP arguments or this repository.
3. Confirm credentials have O3a's shape: `apiOrigin`, shared `password`, `users.manager.email`, `users.reader.email`, `users.noaccess.email`. No credentials have been inspected to establish this. Optional `prefix` must be the non-secret synthetic seed prefix; otherwise configure `FIXTURE_PREFIX`. Confirm the prefix identifies exactly one ACTIVE and one ARCHIVED supplier, one non-variant KILOGRAMO product, one stocked non-variant UNIDAD product, one UNIDAD product with exactly two variants, a `useStock=false` PRODUCT, and one SERVICE. Prefix/catalog ambiguity stops rather than selecting an arbitrary row.
4. Confirm manager has purchase-order read/create/update/delete, supplier read/create/update/delete and Product read; reader has **only purchase-order read**; noaccess has none. No default role grants are assumed. Login must complete programmatically without OTP or tenant selection. A challenge or missing mounted auth store stops the harness, not a reason to fabricate auth state.
5. Confirm API CORS allows `http://127.0.0.1:43179`, JSON, Authorization, Idempotency-Key, GET/POST/PUT/PATCH/DELETE and preflight. Confirm there is no operational traffic on this disposable origin.

## Exact parent preparation steps (not executed here)

1. In `runtime-checks.mjs`, replace the top constants only:
   - `API = 'http://127.0.0.1:__API_PORT__'` → backend's confirmed origin.
   - `CREDENTIALS = '__CREDENTIALS_PATH__'` → exact human-authorized absolute path (not its contents).
   - `FIXTURE_PREFIX = '__FIXTURE_PREFIX__'` → backend's non-secret seed prefix, unless the owner confirms the authorized metadata contains `prefix`.
2. Regenerate the two standalone stage expressions, confined to this evidence directory:

   ```sh
   node odd/evidence/procurement-draft-orders/generate-runtime-mcp.mjs
   ```

   The source is the canonical `runtime-checks.mjs`; the prepared standalone files are bounded expansions of the same flow. The generator replaces both with the complete shared source plus a fixed stage argument. It performs **parse-only** validation, never evaluates the VM script, reads credentials, or contacts a backend. Regeneration was deliberately not executed during this static-only preparation. After regeneration use the generated files, not an independently edited stale copy. The generated permissions expression also validates the configured prefix before authentication.
3. Repeat static checks:

   ```sh
   node --check odd/evidence/procurement-draft-orders/runtime-checks.mjs
   node --check odd/evidence/procurement-draft-orders/generate-runtime-mcp.mjs
   node --check odd/evidence/procurement-draft-orders/start-runtime-server.mjs
   node -e 'const fs=require("node:fs"),vm=require("node:vm");for(const f of ["mcp-runtime-manager.js","mcp-runtime-permissions.js","mcp-runtime-delete.js"]){new vm.Script("("+fs.readFileSync("odd/evidence/procurement-draft-orders/"+f,"utf8")+")");console.log(f+": parsed, not evaluated")}'
   git diff --check
   ```

   The Node-only static checker uses Node modules; **none** occur in either MCP expression or its browser callbacks.
4. Parent owns socket/process inspection. If 43179 is occupied, identify its owner; do not kill an unrelated process or silently choose another FE origin. Once free, start the production-entry server with the confirmed API as a positional argument:

   ```sh
   node odd/evidence/procurement-draft-orders/start-runtime-server.mjs http://127.0.0.1:__API_PORT__
   ```

   Alternatively pass `VITE_API_BASE_URL` in the server environment. Positional argument wins. No env file is read (`envDir: false`). Actual index/main/router/plugins/components are served, not a replacement feature entry. Root, copied index, Nuxt UI templates and Vite cache are under `odd/evidence/procurement-draft-orders/runtime-server/`. No build/install is needed or authorized by this preparation. Parent records readiness/process ownership separately; syntax checks do not establish readiness.

## Exact MCP execution — parent only

Disable tracing, video, HAR, storage-state export, console dumping and request/header/body logging in the runner. Use **`browser_run_code_unsafe` with `filename`**, never paste expanded source plus credentials into tool arguments:

1. `filename: /home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/odd/evidence/procurement-draft-orders/mcp-runtime-manager.js`
2. Inspect the sanitized report and all screenshots. Stop on `verdict: stopped`, a failureCheck, runtime error, or any outsideScope request. Do not silently weaken an assertion or label a shell dependency a product defect.
3. Only after manager review, use `filename: /home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/odd/evidence/procurement-draft-orders/mcp-runtime-permissions.js`.
4. Save only the returned redacted report as `runtime-manager-final.json` / `runtime-permissions-final.json` **if fully passed**; use an attempt filename for stopped evidence. No raw exceptions, login bodies, emails, keys, tokens or credentials in evidence.
5. Open each `runtime-manager-{list,editor,discard-confirm}-{390,1440}-{light,dark}.png` (12 total), the supplier-restriction screenshot, and the two permission screenshots. Review canonical table/cards, layout, typography, clipping, contrast, readable diagnostics, subtotal copy and destructive affordance. Geometry assertions are not design acceptance. Record parent observations in the verification report.
6. Afterward parent owns stopping only its own server/runtime and disposable database lifecycle. No lifecycle action is supplied by this harness. Independent risk-based verification remains separate.

`mcp-runtime-delete.js` is an intentional non-executing compatibility notice, **not a third acceptance stage**. O3a split deletion separately; O3b's requested manager flow necessarily checks supplier restriction while the draft exists, then discards it and proves 204/row removal/404. Running another deletion stage against a now-missing draft would be misleading.

## Runtime behavior and boundaries

- Each stage creates/closes its own ephemeral browser context. The competitor uses a genuinely separate context, authenticates independently, and performs a real PUT. No copied storage state and no forged auth.
- Credentials are selected only with `locator.setInputFiles(CREDENTIALS)` on a blank, network-blocked page, read with `File.text()` in browser memory and closed in `finally` before any screenshot. The main page uses its **already mounted** `$pinia._s.get('auth')` and `$router`, avoiding O3a's duplicate-module/router failure. There is no import, dynamic module loading, require, host runtime access, or evaluation of file contents as code in the MCP expressions.
- Login/fetchMe/logout use real mounted auth-store actions, not login-form/OTP coverage. Direct competing/permission/detail/catalog probes use browser `fetch` with the current token inside `page.evaluate`; tokens never leave that callback. UI writes still use the application's real command/HTTP stack.
- L15 API allowlist: auth login/logout/refresh/me/permissions; supplier list/create/detail/PATCH/DELETE; order list/create/detail/PUT-draft/DELETE; GET products (search/type/page/limit), GET product variants. Preflight only for those paths. No tenant/menu/admin/stock/money/audit endpoint is allowed. Query text/bodies/headers are never retained in reports.
- Only the exact FE origin, the exact API origin and, as in O3a, public GET font/icon hosts (Google Fonts, Iconify) are allowed, so screenshots show the real UI (parent decision, L16). Any other host is aborted and recorded in outsideScope.
- Unapproved URL paths and origins are redacted in outsideScope because arbitrary paths can contain personal data. Approved API evidence contains method/path/status and allowlisted uppercase error codes only.
- Screenshots are never taken on credential/login pages; shell email text and email/password inputs are masked. Records are synthetic; parent must confirm seed names/notes contain no real personal data. No automatic failure screenshot is taken.
- The uncertain-result probe forwards a real PUT with `route.fetch()`, observes 200, intentionally aborts its browser response, then presses **Reintentar**. It compares the immutable key/body only in memory and proves exactly one version increment. No response is fabricated. A backend error is not treated as a successful uncertainty experiment.
- Manager creates only a unique FEProbe draft, never updates seeded suppliers/products, attempts supplier DELETE only while the persisted draft references it (expected 409), then deletes only its own draft. Permissions creates a second unique draft and retains it as a target for denied commands; it intentionally performs no privileged cleanup afterward. Failed runs may retain unique drafts. Do not retry by deleting arbitrary seeded records.

## Interpretation

Static checks establish syntax only. No browser GREEN, persisted state, CORS support, runtime host availability, successful migration, visual approval or independent verification is claimed. See [draft-order-management-verification.md](./draft-order-management-verification.md) for the pending acceptance ledger and the T4 task log for ownership.
