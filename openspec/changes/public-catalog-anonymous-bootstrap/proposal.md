# Public catalog anonymous bootstrap — P0.1

## Why
Anonymous catalog entry must reach the delivered inert P0 shell without authentication side effects; separate its acceptance boundary from broad D1.
## What Changes
Document the already-implemented, uncommitted P0.1 candidate described in [exploration](exploration.md); this proposal grants planning authority only, not implementation approval or verification credit.
## Out of Scope
Discovery, products, D1, backend/tool changes, catalog-SFC or responsive redesign, and source/test edits; no apply, verify, commit, push, archive, or `.gentle-ai-instance` changes.
## Capabilities
New specification capability: `public-catalog-anonymous-bootstrap` (future `openspec/specs/public-catalog-anonymous-bootstrap/spec.md`); anonymous bootstrap only, dependent on delivered P0. Modified capabilities: none.
## Approach
Bypass the guard before auth-store acquisition only for `/catalogo` and `/catalogo/:branchSlug`; mount after `router.isReady()` without startup auth hydration. Keep expiry `clearSession` cleanup; suppress only catalog login redirection.
## Impact
Candidate areas: router guard, application bootstrap/session-expiry handling, and existing focused tests; reuse the P0 shell and existing non-catalog guard behavior without new APIs, permissions, or dependencies.
## Risks / Unknowns
Overbroad auth bypass, lost cleanup, or premature mounting could regress protected routes; exploration evidence is historical, not freshly verified. Product scope is confirmed; research is unselected.
## First Slice Scope
P0.1 only: anonymous entry, readiness, expiry, and non-catalog regression boundaries. Final planning-state accounting is 346 lines (340A + 6D), leaving 54 under the hard 400 limit; stop before 350, deliver planning separately, then seek apply authorization.
## Rollback Plan
If later authorized, forward-fix the anonymous boundary while retaining P0, legitimate cleanup, and unrelated routes; route withdrawal requires separate authorization rather than restoring hydrated public startup.
## Success Criteria
Both anonymous URLs render P0 without hydration/profile/permissions/tenant work or login diversion; mounting waits for readiness; expiry clears sessions; protected/login/error/tenant behavior remains unchanged. Later verify must assess this small bootstrap spec, not broad D1 discovery/product requirements.
