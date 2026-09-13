# Apply Progress — public-catalog-anonymous-bootstrap (P0.1)

## Session
- Date: apply session following planning baseline `c0c30ee`
- Work unit: `adopt-existing-p01-runtime-candidate` (attempt token `sha256:2fbdbde8330f09a8bf595941bab32d2c7574f05da6969ccdda9e9d054addcfdc`, parent-acquired `proceed`; parent owns settlement)
- Mode: STRICT TDD (adoption of pre-existing uncommitted candidate — historical RED not fabricated; diff inspected before any edit)
- Scope honored: edits restricted to the 6 allowed surfaces; `openspec/changes/online-catalog-publishing/.gentle-ai-instance` untouched; no commit/push/sync/archive; no backend/tooling or native-state repair.

## Adopted candidate (uncommitted, verified against spec)
- `src/app/router/index.ts` (+2): guard early-returns `true` for route name `public-catalog` **before** `useAuthStore()` acquisition — `/catalogo` and `/catalogo/:branchSlug` share that name. All other guard logic (hydration, `fetchMe`, tenant selection, permissions, login redirect with `fullPath`, `/403`, superadmin/permission checks) unchanged below the early return.
- `src/main.ts` (+6/−7): removed startup `authStore.hydrateFromStorage()`; expiry handler keeps store reference and always calls `clearSession()`, suppressing the login redirect only when `currentRoute.name === 'public-catalog'` (login no-redirect behavior preserved, protected redirect preserves `fullPath` as query); mount now happens inside `router.isReady().then(...)`.
- `src/app/router/__tests__/router.spec.ts` (+79): `useAuthStore` converted to a `vi.fn()` mock so guard store acquisition is observable; new tests: anonymous entry for both URL forms (zero auth calls, no diversion), non-catalog public routes (`/403`, `/missing-route`) still hydrate once, protected route initializes auth (hydrate/fetchMe/fetchPermissions once each), authenticated `/login` redirect retained.
- `src/main.spec.ts` (new, 108 lines): deferred `isReady()` prevents mount and resolution mounts exactly once with no hydration; catalog expiry clears session without redirect; protected expiry clears session and redirects to `/login` with `redirect: fullPath` query.

## Requirement/scenario mapping (3 REQ / 5 scenarios)
| Requirement / scenario | Evidence |
|---|---|
| CATB-001 / anonymous entry both URL forms | Router spec `resolves unauthenticated catalog entry /catalogo` + `/catalogo/centro` — route resolves to `public-catalog`, `useAuthStore` never called, no hydrate/fetchMe/fetchPermissions/userCan/clearSession |
| CATB-001 / stale stored credentials | Guard returns before any store acquisition/hydration, so stale tokens cannot trigger profile/permission/ability/tenant work or login diversion; same zero-call assertions cover the stale case (hydrating mock was available and never invoked) |
| CATB-002 / readiness without startup hydration | `src/main.spec.ts` "does not hydrate auth and waits for the initial route before mounting" — mount blocked until `isReady()` resolves, `hydrateFromStorage` never called |
| CATB-003 / expiry cleanup + catalog redirect suppression | `src/main.spec.ts` "clears an expired catalog session without redirecting to login" — `clearSession` called once, `router.replace` not called |
| CATB-003 / protected/login/error/tenant guard retention | Router spec: `/403` and `/missing-route` hydrate once; `/pos/orders` initializes auth; `/login` redirects authenticated users to `/`; main spec: protected expiry redirects with preserved path+query; responsive Playwright spec confirms catalog entry renders inert P0 shell with no catalog API interception |

## TDD cycle evidence (adoption mode)
| Phase | Evidence | Result |
|---|---|---|
| RED (historical, pre-existing) | Candidate tests existed uncommitted; not fabricated as a fresh RED run. Adoption inspection confirmed tests assert behavior absent from the committed baseline (e.g., no `public-catalog` early return at `c0c30ee`, `hydrateFromStorage` ran at startup) | RED status inferred from baseline diff, honestly labeled historical |
| GREEN | Focused command below passes the pre-existing implementation against the tests | ✅ 21/21 |
| TRIANGULATE | Slug form (`/catalogo/centro`), stale-credential zero-call assertions, protected/login/error/tenant regression cases, and responsive 375×667 + 1280×800 Playwright specs | ✅ all pass |
| REFACTOR | Diff reviewed for guard/bootstrap ordering: early return is minimal and placed before store acquisition; expiry handler reordered to compute route facts before cleanup, preserving `clearSession`-always semantics. No further changes needed; types unchanged | ✅ no drift introduced |

## Commands run (exact)
| Command | Result |
|---|---|
| `pnpm test:unit --run src/app/router/__tests__/router.spec.ts src/main.spec.ts src/features/catalog/views/__tests__/CatalogView.spec.ts` | 3 files, 21 tests passed (2.92s) |
| `pnpm type-check:responsive` | passed |
| `pnpm type-check` (vue-tsc --build) | passed |
| `pnpm build` | ✓ built in 12.16s (pre-existing >500 kB chunk warnings only, historical) |
| `pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/catalog-entry-disabled.spec.ts` | 2 passed (6.1s) — mobile 375×667 and desktop 1280×800 |

Whole unit suite intentionally not run (not required by the artifact; per-task guidance allows recording inherited issues as historical).

## Files changed (since baseline `c0c30ee`, exact Git numstat)
- `src/app/router/index.ts` (modified, 2A)
- `src/main.ts` (modified, 8A/5D)
- `src/app/router/__tests__/router.spec.ts` (modified, 78A/1D)
- `src/main.spec.ts` (new, 108A)
- `openspec/changes/public-catalog-anonymous-bootstrap/tasks.md` (4 checkbox flips 4A/4D + corrective prose rewrites, counted in the exact total below)
- `openspec/changes/public-catalog-anonymous-bootstrap/apply-progress.md` (this file, all added lines counted in the exact total below)

## Diff accounting vs. 400-line budget (exact, Git numstat since `c0c30ee`, `.gentle-ai-instance` excluded)
- Runtime/tests: `src/app/router/index.ts` 2A, `src/main.ts` 8A/5D, `src/app/router/__tests__/router.spec.ts` 78A/1D, `src/main.spec.ts` (new) 108A → **196A+6D = 202**
- Task checkbox flips in `tasks.md`: **4A+4D = 8**
- Documentation: this file (75A, untracked, 0D) + all tasks.md doc edits (9A/9D: 4A/4D flips + 5A/5D corrective prose) → docs total **93** (84A/9D)
- Total since `c0c30ee`: exact Git numstat total **295** (280A+15D) — under the absolute 400 budget; exact remaining margin: **400 − 295 = 105**. No size exception requested or granted.

## Task completion (persisted in tasks.md)
- [x] RED — pre-existing failing-capable cases adopted; historical RED not fabricated
- [x] GREEN — focused unit command passes
- [x] TRIANGULATE — slug, stale credentials, cross-route regressions, responsive e2e pass
- [x] REFACTOR — reviewed; no behavior/type drift; no edits required

## Deviations from design
None. Guard bypass is by route name `public-catalog` only (not all public routes); `clearSession` always runs on expiry; mount deferred behind `router.isReady()`; no recovery handler added for readiness rejection (rejection simply prevents mount, per design).

## Risks / follow-ups
- Router tests rely on shared module-level mock store; the `beforeEach` re-primes `useAuthStore.mockReturnValue` after `vi.clearAllMocks()` — correct but worth knowing when extending.
- Build's >500 kB chunk warnings are pre-existing/inherited, unrelated to this change.
- Verify phase must independently map all 3 requirements / 5 scenarios; historical exploration evidence is not fresh proof.

## Boundary / settlement
- Planning baseline was separately committed as `c0c30ee` (authorized). Since then, no runtime commit, push, sync, or archive has been performed and none is authorized; the working tree holds the adopted candidate + tasks/progress docs on top of `c0c30ee`.
- Stop point after this corrective documentation rerun: before any runtime commit, push, sync, or archive (archive also stays blocked until a verify report resolves).
- Rollback boundary: `git reset`/checkout of the four source/test files restores the `c0c30ee` behavior (hydrated startup, guard without catalog bypass); per design, route withdrawal remains a separately authorized forward-fix, never a blind revert to hydrated public startup.
- Parent should settle attempt `sha256:2fbdbde8330f09a8bf595941bab32d2c7574f05da6969ccdda9e9d054addcfdc` as **passed** with the post-apply diff revision as evidence revision; apply state: all 4/4 tasks complete → verify becomes the next phase.
