# Mandatory password then email OTP

## Scope and authority

Owner confirmed password remains the first step; email OTP is mandatory for every password login, including superadmin. Backend released contract v1 on 2026-09-26. Implement a minimal real flow with focused deterministic tests; no 90-minute promise. Agents prepare local commits only. Owner exclusively pushes, deploys and performs visual acceptance. No browser, provider/email, hosted/DB, secret/config inspection, dependency installation or unrelated changes.

Branch `feat/auth-email-otp` starts at `98790b6e5d523d50cfcdc040f84d6c89999a115d` in the existing RESTOCK worktree. Preserve its two local generated declaration modifications and principal's two protected OpenSpec untracked files. No new worktree or source parallelism.

## Contract v1

- POST `/auth/login`: existing password DTO; HTTP 200 `{ requiresOtp: true, challengeId: string, expiresIn: 600, resendAfter: 60 }`. No tokens, user or tenants before proof.
- POST `/auth/login/otp/verify`: `{ challengeId, code }`; code exactly six ASCII digits as a string, preserving leading zeros; outer whitespace may be trimmed. HTTP 200 returns the existing final-session/tenant-selection login-result union.
- POST `/auth/login/otp/resend`: `{ challengeId }`; HTTP 200 returns a complete new challenge envelope and invalidates the previous handle/code. Replace the envelope atomically. Timings are seconds measured from successful response.
- HTTP 400: existing validation errors. Password HTTP 401 remains invalid credentials.
- OTP HTTP 401: `{ statusCode: 401, error: 'Unauthorized', code: 'OTP_INVALID', message }` covers wrong, expired, consumed, exhausted and unrecognized challenges. Verification shows a generic error and restart option, without attempt counts. Resend 401 requires restart.
- HTTP 429: `{ statusCode: 429, error: 'Too Many Requests', code: 'OTP_RATE_LIMITED', message, retryAfter }`; retryAfter is seconds, with Retry-After header when available. Resend 429 retains the current challenge, without assumed rotation.
- HTTP 503: `{ statusCode: 503, error: 'Service Unavailable', code: 'OTP_DELIVERY_UNAVAILABLE', message }`; no usable challenge returned. Resend 503 invalidates the previous handle and requires restart. Ambiguous resend network failure also requires fresh password, not reuse of the old handle.
- Lost verification response requires restarting with password; no idempotency or token-revocation promise. Fresh successful password supersedes previous pending challenges account-wide. Server attempt/account-window limits survive restart/resend.
- Legacy tenant-selection token 401 clears pending selection and restarts login without fallback. Existing valid final sessions remain compatible. Backend signs proof only after consumption, requires it for selection and rejects purpose-bearing JWTs as final bearer credentials. Frontend never fabricates or interprets a client-provided proof marker as authority.

Use existing HTTP response unwrapping. TTL, single use, attempt/resend limits and verification before session issuance are server responsibilities; countdowns are UX, not authorization.

## Component and state boundaries

- Existing password form/schema stays unchanged.
- `LoginOtpForm.vue`: presentational Spanish Nuxt UI code/error/loading/resend/restart controls; typed props and events, string one-time-code input.
- `LoginView.vue`: composes password/OTP stages and existing post-verification routing.
- Auth store owns transient in-memory challenge, generation and operation identity. No challenge in localStorage or new routes. Guard duplicate operations synchronously; fence stale successes/errors/finalizers and permission-loading continuations before session mutation or navigation. Cancel/edit/unmount invalidate pending operations, not existing valid sessions or server-issued tokens.
- Narrow HTTP change: existing `/auth/login` substring already excludes OTP endpoints from ordinary refresh. Ensure the earlier special 401 `Tenant context required` branch also respects auth-free requests; preserve protected-resource refresh behavior.
- Coordinator-approved amendment (2026-09-26): an explicit per-request opt-in for the verified-token GET `/auth/me/permissions` bootstrap may supply its verified token without being overwritten by persisted credentials. That opted-in request must reject failures without refresh, storage clearing or session-expiry events. Default callers keep existing behavior; do not globally preserve arbitrary Authorization headers. Rationale: the current HTTP 401 handlers mutate session state before store-level stale-result guards run. Preparing permissions with this isolated request permits an atomic current-operation session commit while preserving a previous/newer session. Waiting for permissions is an implementation choice, not an additional OTP security requirement; tokens may legally be issued after successful OTP proof.

- Coordinator-approved selection amendment: only exact/normalized POST `/auth/select-tenant` bypasses automatic 401 refresh/retry/session-expiry effects, including `Tenant context required`. Clear only the current pending selection and restart login; retain generation fencing and other valid final sessions. Do not change `/auth/switch-tenant` or ordinary protected-resource refresh.

## Test incident and offline continuation

During the initial HTTP RED run, a call-through refresh spy attempted POST `http://localhost:3000/auth/refresh`; retained output reported Axios `ERR_NETWORK` with an XMLHttpRequest and no reported HTTP response. Connection stage and server-side effects remain unknown. Current and committed test source use the same literal synthetic refresh-token fixture; this is provenance evidence, not capture of the original payload or proof of no effects. No server probes, logs or database inspection were performed to investigate.

Independent read-only audit identified no transport-denial boundary and an instance adapter assignment not restored by `restoreAllMocks`. On 2026-09-26 the owner explicitly selected `continue_frontend_offline`: correct mocks, isolate future tests, preserve historical uncertainty, and do not consult the server.

Before further implementation/testing, modify only `src/core/shared/api/__tests__/http.spec.ts` to install per-test rejecting guards for direct refresh `axios.post` and the HTTP instance's default adapter, assert unexpected guards were not invoked, and restore adapters/spies even after assertion failures. Positive tests override their intended mock paths explicitly. This guard is scoped to those Axios paths, not all possible network APIs.

All subsequent test executions must use `unshare --user --map-root-user --net` network isolation in addition to mocks. If isolation is unavailable or fails, stop and report; never fall back to host-network execution. After the guard-first step, the single writer may resume the existing allowlist including the approved selection amendment. No new incident approval gate is required unless a new failure occurs. No provider, server, DB, environment/secret, browser or visual-smoke actions are authorized.

## Allowed files

Production: `src/features/auth/interfaces/auth.types.ts`, `src/features/auth/api/auth.api.ts`, `src/features/auth/stores/useAuthStore.ts`, `src/features/auth/login/views/LoginView.vue`, `src/core/shared/api/http.ts`, new `src/features/auth/login/components/LoginOtpForm.vue`.

Tests: `src/features/auth/stores/__tests__/useAuthStore.spec.ts`, `src/features/auth/login/views/__tests__/LoginView.spec.ts`, new `src/features/auth/login/components/__tests__/LoginOtpForm.spec.ts`, `src/features/auth/api/__tests__/auth.api.spec.ts`, `src/features/auth/__tests__/single-tenant-flow.spec.ts`, `src/features/auth/__tests__/multi-tenant-flow.spec.ts`, `src/core/shared/api/__tests__/http.spec.ts`.

Conditional regression-test changes only: `src/features/auth/__tests__/hydration.spec.ts`, `src/features/auth/interfaces/__tests__/auth.types.spec.ts`, `src/app/router/__tests__/router.spec.ts`. This tracker is parent-owned. Unexpected contract conflicts or production files outside this list require coordination before deviation.

## Work units and verification

- [x] OTP-F01: read-only map, confirm required second step and released API contract.
- [x] OTP-F02: behavior-first API/store/HTTP transitions, cancellation and stale-result guards; preserve existing verified selection/session completion. Independent scoped checks passed after correcting malformed-success handling.
- [x] OTP-F03: minimal OTP form and login composition; generic failure/restart/resend UX with focused tests. Independent scoped checks passed.
- [ ] OTP-F04: independent verification, ordinary review and coherent local commits; owner handoff, no push.

Tests must cover no tokens/storage/permissions/navigation before verification, rejection of legacy direct-session password responses, six-digit string handling, verification and resend error/recovery states, timers, duplicates and ABA/late responses (including permission awaits), auth-free normal/special 401 behavior, legacy pending selection rejection, and verified single/multiple-tenant/superadmin continuations. Existing final-session hydration must remain valid. Record actual RED/GREEN and commands, not proposed tests as evidence.

## Verification checkpoint and delivery strategy

- Initial independent review stopped with a HIGH finding before running checks: malformed successful login/selection responses could cause partial state changes or an undefined-token fallback to ordinary permissions requests. The correction added structural validation before bootstrap/session mutation and explicit-argument guarding; backend remains JWT/proof authority. Reported correction RED: 55 failures / 58 passes, then 113 API/store tests passed; 58 additional cases, none removed in that correction.
- Independent verifier `muir88pf-1n-c1pl` subsequently completed **191 tests across ten suites**, in one network-isolated run (5.81 seconds). App, Vitest and Node `vue-tsc --noEmit` projects, exact thirteen-file ESLint/Prettier checks and `git diff --check` passed. Source/declaration/tracker hashes and Git state were unchanged. Canvas `getContext()` produced a non-failing environment warning.
- Deleted-test audit retained core redirect/permission-aware landing, superadmin, selection failure, CASL, hydration, switching and protected-refresh coverage. Nonblocking gaps remain: explicit API returned-token assertions for selection/switching, successful-login no-stale-error assertion, dedicated same-handle resend-reset and negative HTTP method/opt-in cases. No claim of exhaustive coverage or runtime/backend/browser acceptance.
- Owner selected `feature-branch-chain`: prepare separate coherent local commits on the OTP branch; integrate into local MAIN only after the complete flow is verified/reviewed and both repositories are ready and coordinated. Owner alone pushes/deploys. Planned units: HTTP authentication-boundary isolation with its tests, followed by the complete OTP API/store/UI with tests and this record. No partial MAIN integration.
- Backend adds an OTP migration; its Docker entrypoint automatically applies migrations before startup. Owner must account for this before pushing to an auto-deployed branch. No migration, email/provider or real authentication request has been authorized as frontend verification.

Forecast: this coherent auth boundary and its regression coverage will likely exceed the 400-line advisory. Keep tests with behavior, do not minify or reconstruct unverified intermediate snapshots. Report actual size and review feasibility before local commit preparation. Conditional frontend estimate is 2–3 hours after contract agreement, not a delivery guarantee.
