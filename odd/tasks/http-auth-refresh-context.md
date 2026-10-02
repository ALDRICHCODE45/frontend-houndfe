# HTTP authentication refresh context

Owner authorizes a separate local HTTP/auth correction with deterministic tests. No commits, push, services, browser, backend, DB, environment-file changes or dependency installs. Hard cap: 400 authored lines (additions + deletions against HEAD; new config/doc files count in full). Preserve unrelated OpenSpec files; EXPIRATION transport remains paused.

Units (authored separately, then independently verified and reviewed):

- [~] C1-STORAGE (committed 7c49e05; review 890526d3c21f1fe3 approved; followup failure-path coverage in progress, verification pending): storage-owned runtime session generation plus `prepareReplacement`/`prepareClear`/`commitRotation`.
- [ ] C1-STORE (pending): store-owned guarded rotation. Prepares a replacement BEFORE `cancelLogin` and commits it without a second `setTokens`, on the same generation.
- [ ] C1-HTTP (pending): generation-bound HTTP refresh/replay on the storage surface, keeping the existing HTTP `applySessionTokens` path compatible.
- [ ] C2 (pending): switch/logout start and settlement ownership, permissions and cleanup continuations, integrated regression tests.

Complete acceptance requires all units plus independent verification and review of each. Superseded evidence: the earlier `C1-owner` draft claiming "138 passed" and "143" is retracted.

C1-STORAGE baseline (committed 7c49e05, review 890526d3c21f1fe3 approved; historical, honest): tests-first RED via `node_modules/.bin/vitest run --config vitest.auth.owner.config.ts src/features/auth/services/__tests__/auth-storage.spec.ts --no-file-parallelism` — 13 new storage tests failed (`authStorage.getSessionGeneration is not a function`) while the 5 original tests passed. GREEN after implementation: the whole bounded config passed 138 tests across 4 files (auth-storage 13, jwt.utils 3, useAuthStore 101, http 21); the 13 new tests were consolidated to 8 without dropping assertions and stayed green. Baseline budget: 399 lines (storage 142, storage spec 204, config 28, this doc 25).

C1-STORAGE followup failure-path coverage (uncommitted, verification pending): adds 3 storage-failure tests for `commitRotation` and `prepareClear` over the real service — second credential write/removal failure keeps the partial persist, bumps the generation exactly once and rejects the stale retry with zero further mutations; a first-mutation failure stays untouched with one bump. No production source changed. Baseline-relative whole-unit counts for this followup are recorded by its own run; independent verification and review remain pending.

The auth-storage spec drives the real `authStorage` service and the real `jwt.utils` decoder over the Map-backed `LocalStorageMock` installed by `vitest.setup.ts`, not native browser `localStorage`. The store and HTTP specs `vi.mock` the `auth-storage` module, so they are compatibility evidence only, not storage integration evidence.

Contract:

- Ordinary replacement and clear advance the runtime generation before any observable effect, even with identical or already-empty state.
- A prepared write is one-shot and ownership-checked; a stale or superseded write or clear writes nothing.
- A rotation validates sub/tenant/privilege context without advancing, commits the pair coherently, and fails closed on stale generations or malformed claims.
- Storage write failures rethrow after invalidating the generation so stale claims are not reused; a partially written first credential key is not rolled back.

Out of scope for C1-STORAGE: store-owned rotation commit (C1-STORE), HTTP interceptor changes (C1-HTTP), unguarded switch/logout continuations (C2), cross-tab/raw storage writes, already-dispatched server effects. Visual checks remain owner-owned.
