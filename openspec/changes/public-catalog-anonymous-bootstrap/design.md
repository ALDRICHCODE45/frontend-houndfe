# P0.1 anonymous bootstrap design
Document the existing uncommitted candidate only; this phase writes only this file and grants no implementation or verification authority.
## Responsibilities and flow
- `src/app/router/index.ts`: return `true` for route name `public-catalog` before `useAuthStore()`; `/catalogo` and `/catalogo/:branchSlug` share that name. Do not generalize the bypass to all public routes.
- All other guards retain hydration, profile/permission resolution, tenant selection, authorization, login redirects, and error handling unchanged.
- `src/main.ts`: retain plugin wiring and the store reference for expiry cleanup, but perform no global startup hydration; call `router.isReady()` before `app.mount('#app')`.
- On expiry, always invoke `clearSession()`; suppress the login redirect for `public-catalog`, retain the existing login no-redirect behavior, and preserve protected-route redirects with `fullPath`.
- Catalog entry → named-route early return → router readiness → delivered inert P0 shell; stale stored credentials must not initiate profile, permissions, ability construction, tenant work, or login diversion.
## Contracts and side-effect boundary
- No new API, DTO, query, cache, or permission requirement; existing plugin installation is not catalog authorization work. No branch discovery, products, backend, or SFC changes.
- Store acquisition is forbidden in the catalog guard, not globally: bootstrap still holds the cleanup reference. Cleanup is never bypassed to keep catalog public.
- Non-catalog fetch failures retain existing cleanup/redirect semantics. Readiness rejection does not mount; the candidate adds no recovery handler or fallback navigation.
## Regression matrix and test ownership
| Requirement / scenario | Existing test responsibility / later acceptance |
| --- | --- |
| CATB-001 / anonymous and stale credentials | `src/app/router/__tests__/router.spec.ts`: both URL forms, zero guard store acquisition/auth calls or diversion; explicitly establish stale-credential coverage during later authorized verification. |
| CATB-002 / readiness | `src/main.spec.ts`: deferred readiness prevents mount, resolution mounts once, no startup hydration. |
| CATB-003 / expiry | `src/main.spec.ts`: cleanup on catalog and protected routes, catalog redirect suppression, protected redirect preserves query; later acceptance also checks slug and existing login behavior. |
| CATB-003 / other guards | Router tests retain protected initialization, login, forbidden/not-found, and tenant-selection regressions; no catalog bypass leakage. |
| Reused P0 presentation | `src/features/catalog/views/__tests__/CatalogView.spec.ts`: inert controls, no catalog-store initialization, theme toggle; `e2e/responsive/specs/catalog-entry-disabled.spec.ts`: direct entry at 375×667 and 1280×800, no overflow/demo UI or intercepted catalog API requests. |
## Delivery, verification, and rollback
Later verification must map all three requirements and five scenarios in `specs/public-catalog-anonymous-bootstrap/spec.md`; reused P0 evidence is supporting only, historical results are not fresh proof, and whole-D1 discovery/products acceptance stays separate.
Deliver planning separately before runtime verification so each delivery remains <400 authored changed lines; stop/split before 350 per proposal, without combining planning and runtime evidence. No commit, apply, verify, push, archive, backend/tool repair, or `.gentle-ai-instance` access is authorized now.
Rollback means a separately authorized forward-fix preserving anonymous entry, readiness, legitimate cleanup, delivered P0, and unrelated guards—not a blind restoration of auth bootstrap. Route withdrawal requires separate authorization; no migration or feature flag is introduced.
