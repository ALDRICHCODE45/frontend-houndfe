# Public Catalog Anonymous Bootstrap
## Purpose
Specify the anonymous-entry bootstrap that lets `/catalogo` and `/catalogo/:branchSlug` render the delivered inert P0 shell without auth-store acquisition, profile, permissions, ability, tenant, or login work — even with stale stored credentials. Expiry still cleans up and suppresses only the catalog login redirect; protected, login, error, and tenant routes keep their existing guard.
## Requirements
### REQ-CATB-001: Catalog routes bypass auth before store acquisition
The router guard SHALL treat `/catalogo` and `/catalogo/:branchSlug` as public, bypassing before the auth store is acquired and SHALL NOT trigger profile hydration, permission resolution, ability construction, tenant selection, or login diversion, regardless of stale stored credentials.
#### Scenario: anonymous catalog entry renders the inert P0 shell
- GIVEN a session with no active authentication
- WHEN a visitor navigates to `/catalogo` or `/catalogo/:branchSlug`
- THEN the delivered inert P0 shell renders responsively with no profile, permissions, ability, tenant, or login work
#### Scenario: stale stored credentials do not divert the catalog
- GIVEN stored credentials are stale
- WHEN a visitor reaches `/catalogo` or `/catalogo/:branchSlug`
- THEN the inert P0 shell still renders with no login, tenant, or ability side-effect
### REQ-CATB-002: Bootstrap mounts after router readiness without global hydration
The application bootstrap SHALL wait for `router.isReady()` before mounting and SHALL NOT perform startup auth hydration for any route.
#### Scenario: mounting waits for readiness with no startup hydration
- GIVEN the application is starting
- WHEN bootstrap reaches the mount step
- THEN it awaits `router.isReady()` with no auth hydration, profile, permission, or ability work at startup
### REQ-CATB-003: Session expiry and non-catalog guard behavior
Session expiry SHALL always invoke the existing cleanup; the catalog SHALL suppress only the login redirect. Protected, login, error, and tenant routes SHALL retain their existing guard behavior.
#### Scenario: expiry invokes cleanup and suppresses only the catalog login redirect
- GIVEN an authenticated session on a catalog route
- WHEN the session expires
- THEN the existing cleanup runs and no login redirect is performed for the catalog
#### Scenario: protected, login, error, and tenant routes retain their guard
- GIVEN a visitor reaches a protected, login, error, or tenant route
- WHEN the guard evaluates the route
- THEN the existing redirect, tenant, and error handling still apply with no catalog-bypass leaking