# HTTP authentication refresh context

Owner authorizes a separate local HTTP/auth correction with deterministic tests. No commits, push, services, browser, backend, DB, environment-file changes or dependency installs. Hard cap: 400 authored lines (additions + deletions against HEAD; new config/doc files count in full). Preserve unrelated OpenSpec files; EXPIRATION transport remains paused.

Units (authored separately, then independently verified and reviewed):

- [x] C1-STORAGE: committed `7c49e05`, review `890526d3c21f1fe3` approved; failure-path coverage committed `8008e95`, review `598e9951b90e607f` approved.
- [~] C1-CONTEXT: additive prepared credential/tenant/admin persistence under one generation; independent verification and review pending. No store activation.
- [ ] C1-STORE: coherent reactive publication, then ordinary store/caller integration, then store rotation; each separately bounded and verified. Prepare BEFORE observable cancellation and never adopt a subscriber's generation.
- [ ] C1-HTTP: generation-bound HTTP refresh/replay, preserving the existing public `setSessionFromTokens` API until integration.
- [ ] C2 (pending): switch/logout start and settlement ownership, permissions and cleanup continuations, integrated regression tests.

Complete acceptance requires all units plus independent verification and review of each. Superseded evidence: the earlier `C1-owner` draft claiming "138 passed" and "143" is retracted.

C1-STORAGE baseline (committed 7c49e05, review 890526d3c21f1fe3 approved; historical, honest): tests-first RED via `node_modules/.bin/vitest run --config vitest.auth.owner.config.ts src/features/auth/services/__tests__/auth-storage.spec.ts --no-file-parallelism` — 13 new storage tests failed (`authStorage.getSessionGeneration is not a function`) while the 5 original tests passed. GREEN after implementation: the whole bounded config passed 138 tests across 4 files (auth-storage 13, jwt.utils 3, useAuthStore 101, http 21); the 13 new tests were consolidated to 8 without dropping assertions and stayed green. Baseline budget: 399 lines (storage 142, storage spec 204, config 28, this doc 25).

C1-STORAGE failure-path coverage (`8008e95`, approved): 172 authored lines, 141 tests across 4 files, including 3 added regression tests for first/second storage mutation failures, error identity, exact invalidation and rejected retries. No production source changed in that unit.

C1-CONTEXT: `prepareContextReplacement(tokens, context)` validates token shape and decoded tenant/admin agreement, snapshots supported tenant fields, and advances once before any writes. Tenant slug is validated presentation metadata, not an identity comparison. A superseded or consumed prepared operation performs no mutations. Persistence failures invalidate again and rethrow; already-written keys are not rolled back. Existing APIs remain unchanged and the new API has no production callers yet.

Evidence: 8 new tests failed on the missing API before production edits; those 8 passed after implementation. Two additional failure cases were added afterward; final bounded run passed 151 tests across 5 files. Both app/test type checks, ESLint and Oxlint passed. Tests use real modules with Map-backed mocked Storage. No browser, reactive-store or transport acceptance is claimed. Rollback boundary: the additive API/helper, new `auth-storage-context.spec.ts`, its isolated-config entry and this tracking update; prior commits remain independent.

The auth-storage spec drives the real `authStorage` service and the real `jwt.utils` decoder over the Map-backed `LocalStorageMock` installed by `vitest.setup.ts`, not native browser `localStorage`. The store and HTTP specs `vi.mock` the `auth-storage` module, so they are compatibility evidence only, not storage integration evidence.

Contract:

- Ordinary replacement and clear advance the runtime generation before any observable effect, even with identical or already-empty state.
- A prepared write is one-shot and ownership-checked; a stale or superseded write or clear writes nothing.
- A rotation validates sub/tenant/privilege context without advancing, commits the pair coherently, and fails closed on stale generations or malformed claims.
- Storage write failures rethrow after invalidating the generation so stale claims are not reused; a partially written first credential key is not rolled back.

Out of scope for C1-STORAGE: store-owned rotation commit (C1-STORE), HTTP interceptor changes (C1-HTTP), unguarded switch/logout continuations (C2), cross-tab/raw storage writes, already-dispatched server effects. Visual checks remain owner-owned.
