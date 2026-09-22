# Dashboard analytics redesign

## Objective and authority

Consolidate the completed branch sales summary into the application's only Dashboard destination at `/dashboard`, remove the placeholder root route and separate Analytics route/navigation group, route authenticated users to their first permitted application destination, and redesign the aggregate dashboard to match the user-provided visual references without inventing unsupported trend data.

Authorized worktree: `/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe-branch-sales-summary`

Branch/start: `feat/branch-sales-summary` at `9770fb5`

The backend repository remains read-only. No push, PR, merge, deployment, dependency, lockfile, public-catalog, or backend mutation is authorized.

## User decisions

- `/dashboard` is the only Dashboard/Analytics destination.
- `/` must cease to exist as an application route; it is not an alias or redirect.
- The Dashboard sidebar item points to `/dashboard` and is visible only with exact `read:Analytics` permission.
- Forced `/dashboard` access without `read:Analytics` follows the existing global `/403` flow.
- After login or tenant selection, users land on the first real route they are authorized to enter; no universal placeholder route remains.
- Remove `/analytics/resumen-ventas` and the separate `Analítica → Resumen de ventas` navigation group.
- Follow the supplied visual references: centered constrained content, compact header, prominent net-sales hero, adjacent date controls, stronger card hierarchy, blue Coco accent, six sales KPIs, and two separate refund KPIs.
- Do not fabricate a line/area trend, prior-period delta, or comparison. The backend currently exposes only period aggregates.

Reference images:

- `/home/aldrich_coder45/Pictures/Screenshots/Screenshot_2026-09-21-23-01-40_5360x2520.png`
- `/home/aldrich_coder45/Pictures/Screenshots/Screenshot_2026-09-21-23-01-48_5360x2520.png`

## Verified contract and design read

Backend owner confirmed the deployed API exposes only `GET /analytics/sales/summary`, scoped to the JWT tenant/branch, with exact `from`/`to` boundaries and eight aggregate values. It exposes no time-series buckets, previous-period comparison, or multi-branch selector. A real trend chart therefore requires a future backend contract and is excluded here.

Design read: an operational single-branch dashboard with a modern, compact, high-clarity visual language. Preserve Nuxt UI semantics, the real Coco blue/neutral tokens from `vite.config.ts` and `src/assets/main.css`, light/dark parity, visible focus, 44px targets, tabular numeric alignment, and non-color debt/refund cues. Do not follow the stale amber/zinc guidance in `DESIGN.md`.

## Navigation architecture

Create one pure permission-aware landing resolver shared by login, tenant selection, and the router's authenticated-login redirect. Resolution order:

1. `/dashboard` when exact `read:Analytics` is available.
2. The first accessible child in the existing ordered navigation registry.
3. `/403` when no application route is accessible.

Keep explicit `?redirect=` destinations after login; the router remains responsible for enforcing their route permissions. Super-admin tenant-selection behavior remains unchanged.

The Dashboard navigation item becomes a single shared permissioned definition consumed by the sidebar and command palette. It must not be duplicated as an Analytics group child.

## Tasks

- [x] **D1 — Consolidate canonical routes and permission-aware landing.** Added the shared Dashboard navigation definition and pure first-accessible-route resolver; routed Dashboard at `/dashboard` with exact `read:Analytics`; removed `/` and `/analytics/resumen-ventas`; removed the Analytics group; updated sidebar, command palette, breadcrumbs, login, tenant selection, and authenticated-login redirects. After two failed writer-report cycles, the parent applied the independently specified bounded reduction and exact component-identity correction. Final independent verifier `mucbzsz6-17-dxrw` passed 105/105 focused tests, type-check, scoped Prettier, whitespace, exact scope, and the 573-addition review budget. Route: delegated writer plus bounded parent remediation.
- [ ] **D2a — Build the visual dashboard metric hierarchy.** Redesign the aggregate presentation into a prominent net-sales hero, six-card sales grid, and two-card refunds section using exact backend values, canonical MXN formatting, Coco tokens, restrained icon wells, light/dark support, and non-color obligation cues. No chart, deltas, targets, or derived aggregates. Route: delegated multi-file writer.
- [ ] **D2b — Compose the `/dashboard` experience and all query states.** Replace the placeholder dashboard home with the branch summary composition, place the date-range controls beside the hero at wide widths, preserve exact Mexico City range semantics and loading/empty/error/refetch/retry/idle behavior, remove superseded routed Analytics presentation files where safe, and update focused component/view tests. Route: delegated multi-file writer.
- [ ] **D3 — Verify responsive behavior and close the redesign.** Repoint intercepted Playwright evidence to `/dashboard`, prove the permissioned route and absence of obsolete destinations, preserve exact request/metric assertions, validate light/dark and 320/375/768/1024 widths without horizontal overflow, run the focused unit/type/build/format/whitespace matrix, reconcile evidence, and run native review. Remote live validation may now be attempted separately because backend deployment is confirmed. Route: delegated verifier.

## Acceptance contract

- `/dashboard` is the sole Dashboard/Analytics route and has `meta.permission = ['read', 'Analytics']`.
- `/` and `/analytics/resumen-ventas` do not resolve as application routes.
- Dashboard appears in sidebar and command palette only with exact `read:Analytics`; no `Analítica` group remains.
- Direct `/dashboard` access without permission reaches `/403`.
- Default post-login, post-tenant-selection, and authenticated `/login` navigation resolves to the first permitted destination without hardcoding `/`.
- Explicit safe login redirect destinations remain supported and are enforced by the router.
- The dashboard sends only exact `from` and `to` query parameters and never sends tenant, branch, currency, or invented dimensions.
- All eight aggregates render one-to-one; sales and refunds stay separate; global empty requires every metric to be zero.
- No trend line, comparison badge, percentage change, or derived financial total appears.
- The visual hierarchy matches the reference direction: prominent net-sales hero, adjacent range controls, six sales cards, two refund cards, consistent Coco-blue accent, soft elevated surfaces, restrained shadows, and clear section rhythm.
- Loading, invalid range, no-data error, retained-data refresh/error, empty, refund-only, and retry states remain accessible.
- Layout has no horizontal overflow at 320×568, 375×667, 768×1024, and 1024×768; controls retain visible focus and at least 44×44px targets.
- Existing sale/debt-payment Analytics cache invalidation remains intact.
- No backend, public-catalog, dependency, or lockfile changes.

## Authorized edit surfaces

- `odd/tasks/dashboard-analytics-redesign.md`
- `src/app/navigation/navigation.registry.ts`
- `src/app/navigation/navigation.access.ts`
- `src/app/navigation/navigation.types.ts` only if the shared Dashboard definition needs an existing type adjustment
- focused files under `src/app/navigation/__tests__/`
- `src/app/router/index.ts`
- focused files under `src/app/router/__tests__/`
- `src/app/composables/useSidebar.ts`
- `src/app/composables/useDashboard.ts`
- `src/app/composables/useBreadcrumb.ts`
- their focused existing/new specs
- `src/features/auth/login/views/LoginView.vue`
- `src/features/auth/login/views/__tests__/LoginView.spec.ts`
- `src/features/auth/tenant-selection/composables/useTenantSelection.ts`
- `src/features/auth/tenant-selection/composables/__tests__/useTenantSelection.spec.ts`
- a pure shared landing resolver under `src/app/navigation/`
- `src/features/dashboard/**`
- `src/features/analytics/components/**`
- `src/features/analytics/views/**`
- focused Analytics/dashboard tests only
- `e2e/responsive/specs/branch-sales-summary.spec.ts`

Explicitly excluded: Analytics API/composable/wire contract/date helpers unless a verified regression requires a minimal correction; all backend paths; all public-catalog paths; package manifests/lockfiles; generated artifacts; deployment/configuration; broad historical formatting.

## Verification contract

Per work unit:

```sh
pnpm test:unit --run <focused specs>
pnpm type-check
pnpm exec prettier --check <changed source/spec paths>
git diff --check
```

Final minimum matrix:

```sh
pnpm test:unit --run src/features/analytics src/features/dashboard src/features/auth/login src/features/auth/tenant-selection src/app/navigation src/app/router src/features/POS/sales
pnpm type-check
pnpm build
pnpm exec prettier --check <all redesign-owned files>
git diff --check
pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/branch-sales-summary.spec.ts
```

## Current status

Exploration is complete. Backend deployment is confirmed, but its payload remains aggregate-only. D1 behavior and evidence are complete and independently verified; native review and the D1 work-unit commit are next, followed by D2a.
