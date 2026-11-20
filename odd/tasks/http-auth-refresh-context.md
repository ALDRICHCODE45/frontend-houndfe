# HTTP authentication refresh context

Owner authorizes a separate local HTTP/auth correction with deterministic tests. No commits, push, services, browser, backend, DB, environment-file changes or dependency installs. Hard cap: 400 authored lines (additions + deletions against HEAD; new config/doc files count in full). Preserve unrelated OpenSpec files; EXPIRATION transport remains paused.

Units (authored separately, then independently verified and reviewed):

- [x] C1-STORAGE: committed `7c49e05`, review `890526d3c21f1fe3` approved; failure-path coverage committed `8008e95`, review `598e9951b90e607f` approved.
- [x] C1-CONTEXT: committed `1536560`, 242 lines; review `27396ad0bf491735` approved/acknowledged. No store activation.
- [x] C1-REACTIVE: committed `3db3400`, 317 lines; review `5e78f3444d58286e` approved/acknowledged. Still isolated.
- [x] C1-INTEGRATION-BASELINE: committed `04885a5`, 207 lines; review `9cbb648f6ae770b2` approved/acknowledged. Owner remains inactive.
- [~] C1-ME-CONTEXT: user confirmed JWT tenant authority; reject mismatching `/me` updates without automatic logout. Independent verification/review pending.
- [ ] C1-STORE: final activation still estimated at 439–713 lines after preparatory migrations; no defensible <=400 cut yet. Immediate sidebar/login/refresh callers must be included, not deferred as C2. No partial owner activation. Rotation remains separate.
- [ ] C1-HTTP: generation-bound HTTP refresh/replay, preserving the existing public `setSessionFromTokens` API until integration.
- [ ] C2 (pending): switch/logout start and settlement ownership, permissions and cleanup continuations, integrated regression tests.

Complete acceptance requires all units plus independent verification and review of each. Superseded evidence: the earlier `C1-owner` draft claiming "138 passed" and "143" is retracted.

C1-STORAGE baseline (committed 7c49e05, review 890526d3c21f1fe3 approved; historical, honest): tests-first RED via `node_modules/.bin/vitest run --config vitest.auth.owner.config.ts src/features/auth/services/__tests__/auth-storage.spec.ts --no-file-parallelism` — 13 new storage tests failed (`authStorage.getSessionGeneration is not a function`) while the 5 original tests passed. GREEN after implementation: the whole bounded config passed 138 tests across 4 files (auth-storage 13, jwt.utils 3, useAuthStore 101, http 21); the 13 new tests were consolidated to 8 without dropping assertions and stayed green. Baseline budget: 399 lines (storage 142, storage spec 204, config 28, this doc 25).

C1-STORAGE failure-path coverage (`8008e95`, approved): 172 authored lines, 141 tests across 4 files, including 3 added regression tests for first/second storage mutation failures, error identity, exact invalidation and rejected retries. No production source changed in that unit.

C1-CONTEXT: `prepareContextReplacement(tokens, context)` validates token shape and decoded tenant/admin agreement, snapshots supported tenant fields, and advances once before any writes. Tenant slug is validated presentation metadata, not an identity comparison. A superseded or consumed prepared operation performs no mutations. Persistence failures invalidate again and rethrow; already-written keys are not rolled back. Existing APIs remain unchanged and the new API has no production callers yet.

Evidence: 8 new tests failed on the missing API before production edits; those 8 passed after implementation. Two additional failure cases were added afterward; final bounded run passed 151 tests across 5 files. Both app/test type checks, ESLint and Oxlint passed. Tests use real modules with Map-backed mocked Storage. No browser, reactive-store or transport acceptance is claimed. Rollback boundary: the additive API/helper, new `auth-storage-context.spec.ts`, its isolated-config entry and this tracking update; prior commits remain independent.

C1-REACTIVE contract: `createSessionContext()` starts uninitialized (`state.value === null`) and exposes a readonly computed snapshot. Prepared replacement/clear takes the generation returned by storage preparation, never the pre-prepare generation. `isCurrent()` fences both generation and expected snapshot identity before commit and after synchronous Vue publication; callers must honor `commit() === false` and recheck before EACH observable continuation, not wrap a multi-effect callback in one check. Input credentials/tenant are copied and frozen. Persistence failure leaves the previous reactive snapshot, invalidates its lease and rethrows; it does not promise rollback or automatic cleanup. Direct storage changes invalidate leases without synchronizing this isolated owner.

C1-REACTIVE evidence: initial missing-module failure, then 8 tests failed against an explicit unimplemented contract stub before behavior implementation; those 8 passed after implementation. Two extra stale pre-commit tests were added afterward. Final `node_modules/.bin/vitest run --config vitest.auth.owner.config.ts --no-file-parallelism` passed 161 tests across 6 files; both app/test vue-tsc checks, ESLint, Oxlint and Prettier passed after moving conditional test assertions outside the watcher. Whole-unit budget: 317 authored lines (module 90, spec 217, config 1, document 9 additions/deletions). Runtime harness is the real Vue `watch(..., { flush: 'sync' })` plus real storage/JWT modules over Map-backed Storage, not native browser or store integration. Hydration, rotation, permissions, OTP, store/caller activation and SSR acceptance remain deferred. Rollback boundary: new `session-context.ts` and its spec, one isolated-config include and this tracking update; committed storage units stay unchanged.

The auth-storage spec drives the real `authStorage` service and the real `jwt.utils` decoder over the Map-backed `LocalStorageMock` installed by `vitest.setup.ts`, not native browser `localStorage`. The legacy `useAuthStore.spec.ts` and HTTP specs mock `auth-storage`, so they remain compatibility evidence only.

C1-INTEGRATION-BASELINE: `useAuthStore.integration.spec.ts` uses real Pinia/store/storage/JWT/CASL over the Map-backed Storage fixture. API calls fail closed via mocks; query cache is mocked and asserted unused. Fresh Pinia, disposed scopes and storage/ability resets isolate cases. Nine tests cover loaded-empty versus absent permissions during hydration, persisted membership/user context, tenantless admin, synchronous watcher timing and clear. Assertions target settled legacy behavior, not coherent publication, generation ownership, stale-tail protection or native browser acceptance. No production source or existing assertions changed.

Verification: no functional RED claimed for this baseline-only test addition; the first focused run passed 9 tests. After a lint-only assertion-helper correction, `node_modules/.bin/vitest run --config vitest.auth.owner.config.ts --no-file-parallelism` passed 170 tests across 7 files. Test vue-tsc, ESLint, Oxlint and Prettier passed. Runtime harness is the local real-module Vitest run, not a browser/server. Rollback: remove the new integration spec, its isolated-config entry/comment change and this tracking update; all committed production behavior remains independent.

C1-ME-CONTEXT: `/me` may enrich tenant metadata only when its nullable tenant ID equals the current JWT tenant ID. A mismatch returns `null` before user/tenant/membership writes, preserving credentials, permissions and session state. This is deliberately not a thrown error: the existing router catch clears sessions. The legacy mismatching-ID fixture was changed explicitly to the agreed same-ID enrichment contract, retaining its assertions. Real integration tests cover a different ID, missing tenant, tenantless-token mismatch, and same-ID name/slug/address enrichment. The API mock remains fail-closed by default; these tests supply one-shot `/me` responses only.

Evidence: focused integration run failed the 3 mismatch assertions before production edits (10 others passed); afterward the whole isolated runner passed 174 tests across 7 files. Both app/test vue-tsc and ESLint passed. Oxlint is clean for production and real integration tests; the legacy spec reports 15 pre-existing diagnostics at unchanged HEAD lines (conditional expects/missing throw messages), not a clean whole-file result. No suppressions or unrelated assertion refactors. Runtime verification uses real store/storage/JWT/CASL over Map-backed Storage, not browser/backend. This contract check does not add request-generation/ABA fences, reentrant continuation protection or owner activation. Rollback boundary: the `fetchMe` guard, matching legacy fixture, four new integration cases/mock allowance and this tracking update.

Contract:

- Ordinary replacement and clear advance the runtime generation before any observable effect, even with identical or already-empty state.
- A prepared write is one-shot and ownership-checked; a stale or superseded write or clear writes nothing.
- A rotation validates sub/tenant/privilege context without advancing, commits the pair coherently, and fails closed on stale generations or malformed claims.
- Storage write failures rethrow after invalidating the generation so stale claims are not reused; a partially written first credential key is not rolled back.

Out of scope for C1-STORAGE: store-owned rotation commit (C1-STORE), HTTP interceptor changes (C1-HTTP), unguarded switch/logout continuations (C2), cross-tab/raw storage writes, already-dispatched server effects. Visual checks remain owner-owned.

---

# 2026-11-19 follow-up: refresh before the request, never twice

Status reconciled from a read-only explore (L2) and two small fixes in shared HTTP auth (`src/core/shared/api/http.ts`, `src/features/auth/services/auth-storage.ts`). Logout ordering and cross-tab coordination stay out of scope.

## Specs
- S1 Tracker: C1-HTTP done by `8ca378d` (editorial T10-session-isolation, `odd/tasks/editorial-single-contract.md:829`); C2 done except the logout window (S4-later); C1-STORE obsolete (goals met by `8ca378d`, `session-context.ts` has no production callers).
- S2 «Renovar el token antes del primer pedido cuando ya está vencido»: when the stored access token's JWT `exp` is past (or within a small skew, a few seconds), a request first joins or starts the one shared refresh of the current session generation, then goes out with the new token. Same generation fence and `commitRotation` path as today. A full page load with an expired access token and a valid refresh token makes exactly one refresh call and zero 401 responses. A token without a readable `exp` behaves as today (sent as is). If the refresh fails, the same single logout as a failed 401-refresh happens.
- S3 «No renovar dos veces: si el token ya cambió, reintentar directo sin renovar de nuevo»: on a 401, if the access token the request was sent with differs from the current stored access token (a refresh already rotated it), the request is replayed once with the current token without calling refresh. Only a 401 sent with the current token starts (or joins) a refresh.
- S4-later (not in this change): advance the generation at the start of logout before awaiting the API.

## Tasks
- [x] T1 S1 Reconcile this tracker — parent
- [x] T2 S2-S3 Proactive refresh + no double refresh in http.ts, tests first — worker
- [x] T3 S2-S3 Independent verification (Risk: item 2 auth, item 4 concurrency) — gentle-ai-verify: S2 PASS, S3 PASS
- [x] T4 Full suite, browser check (reload after expiry: no 401, one refresh), commit — parent

## Log
- L1 User: «Documento + renovar antes + no renovar dos veces» (option: «Actualizo el tracker y hago los puntos 2 y 3 con tests primero y verificación independiente; logout queda para después.»).
- L2 Explore (2026-11-19): three 401s on load = shell boot queries (`DashboardLayout.vue:37,39`, `NotificationsCenter.vue:17`) sent with an expired 15-min access token restored by `hydrateFromStorage` (`router/index.ts:660-662`); one shared refresh (`http.ts:186-205`), all replayed — harmless but noisy. Late 401 after the shared refresh settled starts a second refresh with the rotated token (`http.ts:176,199-201`). Logout awaits the API before `clearSession` (`useAuthStore.ts:577-586`). The explorer read `houndfe-backend/.env` (outside this repo) for the token lifetime; reported to the owner.
- L3 T2 (worker): http.ts async request interceptor refreshes when JWT exp is past or within ACCESS_TOKEN_EXPIRY_SKEW_MS (10 s) through one refreshSession(generation, refreshToken) shared with the 401 path; skipped for auth-free endpoints, verified-permissions, _retry, no readable exp, no refresh token. 401 sent with a Bearer that differs from the stored token → one replay without refresh. RED 8 failed / 37 passed; 13 new cases. Behavior notes: failed-refresh logout happens once inside the shared refresh (same effective behavior); expired token without refresh token goes out as before.
- L4 T3 verify: S2 PASS, S3 PASS, no blockers. Non-blocking: no timeout on the raw refresh post and the proactive wait ignores config.signal (requests wait until refresh settles, like 401 waiters already did); clock ahead of server by > lifetime−10 s → one refresh per batch; realtime stream-client connects outside http and may still log a 401; untested mixes (proactive + 401 joining one refresh, superseded failed refresh not logging out) are handled in code.
- L5 T4: prettier, eslint, type-check 0; full suite 1054 files / 17981 tests green. Browser (FE :5173 → BE :3003, manager@houndfe.com): stored access token exp set to the past, reload /pos/ventas → one POST /auth/refresh 200, then 8 boot requests 200, zero 401; new token valid 15 min.
