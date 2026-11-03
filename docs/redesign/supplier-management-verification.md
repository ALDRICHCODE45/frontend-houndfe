# Supplier management — O3a verification

Status: verified against a disposable backend (see the final section). Earlier sections are kept as history.

## Scope

The new `/procurement/suppliers` screen belongs to **Compras → Proveedores**. It lists suppliers with explicit Active/Archived/All filters, name search and cursor-based Previous/Next controls. It does not fabricate totals, purchase orders, stock movements, payments or accounts payable.

- Reading requires `read:ProcurementSupplier`.
- Creating additionally requires `create:ProcurementSupplier`.
- Editing, archiving and reactivating require read and update permissions.
- Archiving preserves supplier data and backend audit history. There is no delete or audit-history endpoint in this slice.
- Names preserve entered content and allow up to 200 Unicode code points; optional terms allow 4000. Clearing terms sends explicit null.

## Recovery behavior

A version conflict preserves local form changes. **Descartar cambios locales y cargar versión actual** explicitly replaces the buffer with a fresh server read; it never resubmits automatically.

An uncertain command result keeps its immutable payload and idempotency key. **Recuperar resultado** retries that same attempt explicitly. Other mutations are blocked while the result is uncertain. Authentication, tenant and permission transitions retire scoped private state; late responses cannot update the new context.

An acknowledged write remains acknowledged if refreshing the list fails. The screen offers another read rather than inviting a duplicate write. Server-side authorization, atomicity, receipts and audit remain backend responsibilities.

## Observed checks

- Transport, command ownership and scoped cursor reads: 16 tests passed after missing-module RED.
- Supplier permission registration: two assertion failures before registration; 109 tests passed including the existing ability suite and supplier data tests.
- Form: four tests passed for content preservation, Unicode limits, null clearing, disabled submit and remount after cancel.
- List: four tests passed for native detail buttons, permission-gated archive/reactivate and loading versus empty state.
- Integrated view: four tests passed with boundary-stubbed overlay components and actual feature commands/query state. Initial test harness incorrectly stubbed Nuxt's alias instead of its component name; corrected without changing runtime behavior.
- Conflict reload: one additional assertion failed while stale conflict feedback remained after reload; the owner now clears rejected feedback only outside pending/uncertain attempts. Supplier suite: 28 tests passed.
- Router/navigation: two assertions failed before registration; exact read guard and canonical entry now pass. Supplier plus route suite: 30 tests passed.
- Job16: focused foundation tests, Vue-aware test typecheck, full build and whitespace check passed before route integration. Existing bundle-size warnings remain.
- Job17: 332 tests passed, one existing navigation-order assertion failed because Compras displaced Chatbot immediately after POS. Types/build did not run. Moved Compras after Chatbot; focused existing-navigation plus supplier-route checks passed (10 tests). Job18 passed all 333 tests across 27 suites, Vue-aware test typecheck, build and whitespace check.

## Browser and independent verification

- Actual MCP isolated fixture run passed settled list/form/archive-confirmation geometry at 390/1440 in light/dark, cancel without writes, clean form on reopen, and four fixture creates with idempotency keys. Evidence: `odd/evidence/procurement-suppliers/`. Initial transitional captures were replaced by settled captures. Four representative images visually reviewed. External font/icon requests were blocked; full shell asset fidelity is not certified. No real backend requests were sent.
- Extended MCP script reached keyboard focus trapping, preserved CAS conflict buffer, explicit reload, null clearing and archive, then timed out selecting the exact label `Estado`. This run is incomplete; selector versus accessible-name cause remains unresolved. No claim of completed reactivate/search/error recovery from that run.
- Independent verifier `mvz0r3db-i-6hgs` is BLOCKED. Scratch `/tmp/supplier-final-verify.dRZ4Pa` setup was followed by `pnpm exec vitest ...`, which failed with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` before any tests ran. Independent typecheck was not run. No retry, cleanup or installation authorized/performed. No confirmed severe finding. Unconfirmed concern: read cache retirement across permission/readiness disable/re-enable needs a regression probe; not established as a defect.
- User authorized setup repair: "Si, adelante." Follow-up verifier `mvzm5dnq-j-rkrm` bypassed the pnpm v10/v11 store mismatch by invoking the installed Vitest binary directly. All nine suites failed before collection because the original scratch copy omitted `vitest.setup.ts`; zero tests executed. Typecheck and cache probe remain unrun. No installation or original dependency changes. Independent proof is still unavailable; follow-up stopped without another relaunch.
- Browser diagnosis confirmed accessible combobox name `Estado`; label text included all option text. Updated the test to role plus exact accessible name, without changing UI. Subsequent run reached archive/reactivate, then timed out because its empty-state expectation differed from the source copy. Corrected that fixture expectation to `No hay proveedores para esta búsqueda.` but have not rerun it; full browser pass is not claimed.

## Required remaining proof

- Actual Playwright MCP screenshots and settled geometry at 390/1440, light/dark, including overlay focus, keyboard, clipping, loading/error/empty states.
- Disposable-backend create/edit/archive/reactivate, conflict and retry integration. No existing database migrations or operational writes.
- Independent risk-based verification (permissions and asynchronous context ownership). Prior A16 verification exception does not apply.
- Native assessment currently unavailable because untracked scope requires declaration; no native approval is claimed.
- Active LSP reports Vue-module resolution diagnostics; successful Vue-aware compilation is recorded separately, not called LSP clean.

## Latest candidate evidence

Canonical AppDataTable desktop/mobile-card, HF surface and shared toolbar replaced rejected list. Job19:202tests PASS; test-only generic selector corrected. Job20:5focused/types/build/diff PASS. Latest actual MCP fixtures passed390/1440light/dark with fonts/icons allowed, zero blocked assets/runtime errors. Mobile filters, focus trap, conflict/reload, null clear, archive/reactivate, search empty and GET failure recovery passed. Four list images and dark filter image reviewed. No real backend calls.

Independent mvzml51f-l-8v0k:124tests9suites/types PASS, two extra probes FAIL same-principal read retirement across ready/canRead disable-reenable. Not a cross-principal leak. Parent reproduced RED2 then added accessGeneration query-key dimension: GREEN5. Targeted independent recheck mvzmsc8j-m-d80p and expanded job21 running. No final approval; backend E2E pending. Earlier browser/setup failures above are historical, not the latest candidate result.

### Post-correction parent checks

Job21 exited 0: 204 tests across 13 suites, Vue-aware test typecheck, production build and `git diff --check` passed after the access-generation correction. Existing large-chunk warnings remain. Targeted independent recheck and disposable-backend integration are still pending; this is not final/native approval.

### Independent correction closure

Targeted verifier `mvzmsc8j-m-d80p` ran seven tests (five repository regressions plus both original independent probes) in the isolated candidate: all passed. Vue-aware typecheck exited 0. The confirmed P2 is resolved for readiness/read-permission disable-reenable; fresh responses render normally and tenant/filter/cursor/refresh-denial checks still pass. Parent spot check independently reran the five repository read tests: passed. No broader claim about cross-principal leaks, native approval or real backend persistence is made. Backend owner notified; disposable integration remains the external prerequisite.

### Current real-integration attempt (blocked)

The parent confirmed the owned frontend socket at127.0.0.1:43179. The actual Playwright MCP manager wrapper failed before executing its imported module: `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`. A harmless capability probe confirmed `require` and `process` are unavailable. No credentials were read, no backend requests or screenshots were produced by this attempt. Prepared script syntax and frontend readiness are not E2E proof. Native assessment remains unassessable because untracked scope is undeclared; no approval is claimed. Real integration is blocked pending a credential-safe supported runner decision; no sandbox escape or alternate runner was attempted.

## Real disposable-backend verification (final)

Runtime: backend-owned disposable API `http://127.0.0.1:43859` (no existing database, port 3000 untouched) and the real production entry/router/shell served at `http://127.0.0.1:43179`. Executed with Playwright MCP by the parent. Credentials were read from the human-authorized file into ephemeral browser memory only; reports contain no credentials, tokens or emails. Login is programmatic through the real auth store and transport, not login-form/OTP coverage.

**Defects found by this run and fixed (T3 reopened):**
- Desktop toolbar: the search stretched to 1094px and the `Estado` select overflowed the card's right edge (1399–1514 vs 1415), with actions wrapping. Fixed by adopting the canonical payment-details desktop grid (`suppliers-visual.css`), with no shared component changes.
- Escape left focus on `<body>` while the triggering row stayed connected. Fixed by capturing the invoker before the async read disables it and restoring it after close (Catalog/DriverRouteCockpit pattern).
- Both observed RED then GREEN through component tests. Supplier/shared table/auth/route set: 213 tests across 13 suites passed; Vue-aware test typecheck, `vue-tsc --build` and production build exited 0 (existing large-chunk warning).

**Manager stage — 97 checks passed** (`runtime-manager-final.json`): UI create (POST 201), scoped list/search, clearing terms to null persisted across a fresh reload, a real competing update followed by `PATCH 409 SUPPLIER_VERSION_CONFLICT` that kept the local buffer, explicit reload clearing the conflict, archive/reactivate persisted across reloads, and an uncertain result: a real accepted PATCH (200) whose response was intentionally dropped, no automatic retry, then an explicit replay with the identical payload and idempotency key and a single version increment. 1440/390 light/dark: canonical desktop table and mobile cards, filters sheet, focus trapped in overlays with Escape restoring the trigger in all four modes, bounded overlays, no page overflow, delayed-read loading, meaningful empty state, and induced transport failure with explicit recovery (not a server-500 test). Zero out-of-scope requests and zero runtime errors.

**Permissions stage — 35 checks passed** (`runtime-permissions-final.json`): reader route admitted with a read-only detail and no mutation controls, real GET allowed, create/update `403 FORBIDDEN`; noaccess redirected to `/403` with no supplier data and GET/list/create/update `403 FORBIDDEN`.

Screenshots (`runtime-manager-*`, `runtime-permissions-*`) were inspected visually by the parent. Synthetic records created with the `FEProbe-*` prefix remain in the disposable tenant (there is no delete endpoint); `RuntimeProbe-*` backend records were not touched.

**Harness-only corrections during execution** (no product impact): Node `import()` is not available in the MCP VM, so the scripts became self-contained; credentials are read through a network-blocked file input; harness imports use the same `/@fs` module identities as the mounted app; route handlers tolerate late resolution of requests the app cancels.

**Out of scope / remaining:**
- At 390px the shared shell header breadcrumb "Proveedores" touches the search icon. Shared component; recorded as a follow-up, not changed here.
- Backend audit history has no public endpoint and is not verified from the frontend.
- No native review approval is claimed; native assessment is unassessable while untracked scope is undeclared.

## Supplier deletion (S7)

Decision: hard delete, chosen by the user ("Borrado definitivo (recomendado)"), following the Customer/Product convention. Audit history keeps the historical supplier id and snapshots; the deletion itself is audited. Backend migration was tested only on a disposable database.

Contract: `DELETE /procurement/suppliers/:id`, JSON body `{"expectedVersion": N}`, `Idempotency-Key` header, 204 empty. Requires `read` and `delete:ProcurementSupplier` (no default grants). Allowed for active and archived suppliers. `SUPPLIER_HAS_PURCHASE_ORDERS` (409) is reserved for O3b, when purchase orders exist.

UI: "Eliminar" (trash icon, error color) is the last row action on the desktop table and the mobile cards, only with read+delete. Confirmation "Eliminar proveedor" — "Se eliminará permanentemente. Su historial de auditoría se conserva." — with "Cancelar" / "Sí, eliminar". Errors are mapped by code (including 404 and a deletion-specific version-conflict message); a rejected deletion keeps the confirmation open and disabled. An uncertain result is recovered only through "Recuperar resultado" with the same key and body. After success the list is refreshed (no optimistic removal), the notice reads "Proveedor eliminado correctamente." and focus moves to the supplier search.

Replay safety: every supplier command (create, update, delete) carries its own AbortSignal, aborted when the principal, branch, readiness or permissions change. This stops the shared HTTP client from replaying a retired request after a credential refresh. A same-context replay of the same confirmed request (same body and idempotency key) is kept as transport re-authentication.

### Verification

- Test-first: commands RED 2 → GREEN; view/list RED 8 → GREEN; replay cancellation reproduced with the real shared HTTP client (RED: request sent twice; GREEN: once). Final set 266 tests across 15 suites, Vue-aware typecheck, `vue-tsc --build` and production build passed.
- Real disposable backend `http://127.0.0.1:45581` (parent-executed Playwright MCP, programmatic login; not independent, not login-form/OTP coverage): manager 97/97, permissions 35/35, deletion 55/55 — cancel sends nothing in 1440/390 light/dark with focus restored; stale deletion returns 409 `SUPPLIER_VERSION_CONFLICT` and keeps the supplier; real deletion returns 204, the row disappears and a later GET returns 404; reader and no-access users get 403 and the reader sees no "Eliminar". Zero out-of-scope requests and zero runtime errors. Evidence: `odd/evidence/procurement-suppliers/runtime-delete*-final.json`, screenshots `runtime-delete-*` reviewed by the parent.
- Visual review found the destructive button shorter than "Cancelar"; it now uses the same control as the archive confirmation.
- Independent verification: first pass blocked S5/S7 on the credential-refresh replay; after the fix, a targeted independent recheck passed S5 and S7 (93 tests, typecheck). Backend idempotency/re-authorization is a stated assumption verified on the backend side, not by the frontend verifier.
