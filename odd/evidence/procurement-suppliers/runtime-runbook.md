# Parent-run disposable integration checks (current correction awaits MCP execution)

## Server

Started by the preparatory worker: PID **1716749**, PPID 1, command
`node odd/evidence/procurement-suppliers/start-runtime-server.mjs`.
Socket inspection confirmed that PID owns **127.0.0.1:43179**; the port was free before startup. Do not kill unrelated processes. Verify ownership again before using/restarting.

- Frontend: `http://127.0.0.1:43179`
- Backend: `http://127.0.0.1:43859`
- `VITE_API_BASE_URL` is set in the server process, not an env file.
- `envDir: false` prevents Vite reading env files.
- Root/cache/generated Nuxt UI templates are confined to `runtime-server/` under this evidence directory. That directory and the server log are locally ignored.
- The server imports the real `vite.config.ts`, uses its plugins/theme, and serves the **real production index/main/router/components**, via an evidence-only Vite root and `/src` alias. This is not an isolated replacement feature UI. Root placement is different from normal development solely to confine generated writes.
- HTTP readiness checks returned 200 for `/`, `/src/main.ts`, `SupplierView.vue`, and `http.ts`. The transformed HTTP module defines the disposable API origin. These are not browser execution or backend health proofs.

No restart is needed for the current script-only correction. Process lifecycle belongs to the parent; this child must not stop/restart any process. The existing command and PID above identify the server, not authorization to change its lifecycle.

## MCP execution — parent only

Invoke `mcp__playwright__browser_run_code_unsafe` with `filename` equal to each **absolute** file path below. Each file is a self-contained async `(page) => ...` expression; it requires no VM-side `import()`, `require`, `process` or filesystem module. Application ESM imports remain inside browser `page.evaluate` callbacks. Do not paste credential values into tool arguments.

1. `/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/odd/evidence/procurement-suppliers/mcp-runtime-manager.js`
2. After reviewing stage 1, `/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/odd/evidence/procurement-suppliers/mcp-runtime-permissions.js`

Each stage creates its own ephemeral browser context and a separate blank credential page with a file input. `setInputFiles()` selects **only the exact human-authorized credentials.json path** embedded in the script. The page blocks all network requests, has no upload form or remote scripts, and reads the selected File using `files[0].text()`. Only the required credential fields cross the internal evaluate bridge into ephemeral script memory; no values are emitted in tool arguments/results. The blank page closes in `finally` before any screenshots. This uses documented Playwright file selection, not a sandbox escape or Node filesystem import.

The stage then authenticates through the real auth store/password transport and closes its browser context in `finally`. Credentials, tokens, request headers/bodies, raw exceptions, console messages, storage state, traces and videos are never persisted or included in external reports. Real auth storage exists only in the ephemeral browser context. Returned JSON is sanitized. Do not enable tracing/video or credential-bearing console logging externally. Opaque idempotency keys use browser `crypto.getRandomValues()` with UUID-v4 formatting.

**Stop if `verdict` is `stopped`**. Inspect `blocker`, `failureCheck`, sanitized method/path/status/error tuples and `outsideScope`. Do not interpret an incomplete stage as acceptance or silently weaken assertions. A credential-selection/read failure closes the blank page/context and stops before application login or screenshots. The child has not executed either browser script.

The original wrapper failed with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`; this was a harness compatibility error, **not unavailable MCP**. Parent separately proved the file-input mechanism using a non-sensitive runbook file. That capability proof is not supplier E2E or proof that the corrected scripts pass.

To regenerate the two self-contained expressions after editing their canonical source:

```sh
node odd/evidence/procurement-suppliers/generate-runtime-mcp.mjs
```

The generator reads only `runtime-checks.mjs`, writes the two adjacent wrappers, and parses them in an empty Node VM without invoking them. It permits only the three canonical browser import URLs verified against this running server's transformed main/SupplierView. Do not edit generated wrappers independently.

### Mounted module identity correction

Parent subsequently verified file-selection compatibility and real auth (login/permissions/me all 200), but the supplier search never appeared: a second router reported supplier navigation while the mounted app still showed login. See [module-identity-diagnosis.md](./module-identity-diagnosis.md) for source lines and served URLs. This is an evidence-harness failure, not supplier acceptance or a confirmed product defect.

The scripts now import the exact `/@fs/.../src/` module URLs used by the production entry, compare the imported router to the installed mounted router, and call `useAuthStore()` with the mounted Pinia explicitly. Heading/search visibility is required before mutations; all prior assertions remain. The mounted-app reference is read only, without dumping or replacing state. No config change or restart is required.

## Intended checks

Manager: unique `FEProbe-*` UI create/list/search, null clearing, reload persistence, real competing CAS update, conflict buffer preservation and explicit reload, archive/reactivate with reloads, explicit uncertain-result replay. The uncertainty probe forwards one real PATCH with `route.fetch()`, verifies success, intentionally drops its browser response, then checks explicit replay reuses the identical payload/key and does not increment the version twice. No fake supplier response is ever fulfilled.

Visual/interaction: 1440/390 light/dark canonical table/cards, edit and cancel-only archive overlays, 390 filter sheets, focus trap, Escape restoration, bounds/overflow, empty state, delayed real GET loading, intentionally aborted GET error and recovery. Screenshots have `runtime-manager-*` names and cannot overwrite the earlier fixture evidence. **Parent must open and visually inspect screenshots**; script assertions do not certify visual quality.

Permissions: separate unique manager-created fixture, reader route/read-only detail and absent mutation UI, noaccess real router `/403`, direct real GET/list denial for noaccess, and POST/PATCH denial for both restricted users. Role screenshots use `runtime-permissions-*` names.

Every mutation targets newly unique records; existing RuntimeProbe records remain untouched. Successful fixture records are retained (there is no authorized delete). Each stage is a fresh run, not a resume/retry of prior evidence. No broad suite/independent verifier is invoked.

## Explicit gaps and limits

- The current correction is prepared code, not a passing E2E result. Earlier parent MCP auth and the subsequent routing failure are recorded separately; the main verification report is deliberately unchanged.
- Login uses the real auth store and transport programmatically, not form-entry UX or OTP coverage.
- Requests outside the authorized API scope/approved asset origins are aborted and reported. Such a required shell dependency is a **scope limitation**, not a supplier product defect. Stop and report it; do not mock it. No isolated feature fallback has been needed or prepared without an observed shell blocker.
- Loading/error probes introduce transport delay/failure; they do not prove a natural server 500 or production network reliability.
- Backend audit/history has no public endpoint here and is not verified by these scripts. Orders, selections and confirmations remain outside this supplier-state slice.
- Native assessment, independent backend review, test-suite acceptance, human design approval and tracker closure are not supplied by these scripts.

## Preparation validation

The original failing browser behavior was observed by the parent: login remained rendered after the harness router claimed supplier navigation. This evidence-only correction has no meaningful standalone unit RED for the mounted application; syntax/empty-VM checks and exact served-module URL comparisons validate preparation only. Meaningful browser GREEN remains the parent's actual corrected Playwright MCP run. The child made read-only frontend GETs, no credential reread/backend calls, and reconfirmed server ownership without restarting it. No acceptance is inferred from static checks.
