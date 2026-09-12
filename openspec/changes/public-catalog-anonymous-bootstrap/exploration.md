# Anonymous catalog bootstrap — P0.1 exploration

> Dedicated, already-implemented, uncommitted P0.1 unit separated from broader `online-catalog-publishing` D1; source candidate remains unchanged.

## Implemented behavior (uncommitted)
- Direct anonymous `/catalogo` and optional `/catalogo/:branchSlug` resolve the delivered inert P0 shell.
- The catalog-only guard bypasses before auth-store acquisition: no hydration, profile, permissions, tenant, or login diversion.
- Bootstrap mounts only after `router.isReady()`; it performs no startup auth hydration.
- Session expiry still clears the session, suppressing only the catalog login redirect.
- Protected, login, error, and tenant behavior remains on its existing guard path.

## Boundary and evidence
- No branch discovery, products, backend work, catalog-SFC redesign, or responsive redesign belongs here; research is unselected because repository evidence is sufficient and scope is confirmed.
- `router.spec.ts` covers both anonymous entries and protected/login/error/tenant regressions; `main.spec.ts` covers readiness and expiry; `CatalogView.spec.ts` confirms the unchanged P0 shell.
- Recorded focused evidence is 21/21 plus type/build checks; `catalog-entry-disabled.spec.ts` records direct-entry responsive evidence at 375×667 and 1280×800 (2/2).

## Verification scope
- The broad D1 spec caused false whole-change verification scope: assess this unit only against the bootstrap boundary, not deferred discovery/product requirements.
