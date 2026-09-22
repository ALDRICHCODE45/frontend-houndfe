# Dashboard shell and permitted landing fallback

## Objective and authority

Expand the existing branch-sales Dashboard to use the same wide page-card shell as the Products table and fix post-authentication redirects so an unauthorized saved destination falls back to the first permitted application route instead of `/403`.

Authorized worktree: `/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe-branch-sales-summary`

Branch/start: `feat/branch-sales-summary` at `d429038`

No backend, public-catalog, dependency, lockfile, deployment, push, PR, or merge changes are authorized.

## User evidence and decisions

- The current Dashboard is too narrow and visually isolated in the center of the workspace.
- Match the established `/pos/products` page shell: wide content-area card, page header with title and descriptive subtitle, and consistent card/body spacing.
- Preserve the existing Analytics metrics, filters, states, exact Mexico City boundaries, permission gate, and no-chart constraint.
- After login, an explicit saved redirect may be used only when the authenticated identity can enter that route. Otherwise resolve the first permitted application destination.
- Direct forced access to a forbidden route still uses the existing `/403` guard.

Reference evidence:

- Current Dashboard: `/home/aldrich_coder45/Pictures/Screenshots/Screenshot_2026-09-22-13-10-54_5360x2520.png`
- Products shell: `/home/aldrich_coder45/Pictures/Screenshots/Screenshot_2026-09-22-13-12-02_5360x2520.png`

## Exploration findings

- `BranchSalesSummaryView.vue` centers and caps the screen through `mx-auto` and `lg:max-w-7xl`; `ProductsView.vue` uses an uncapped `w-full` wrapper with `md:px-10` and a full-width `UCard`.
- `ProductsView.vue` uses `TableHeaderDescription` for the card title/subtitle and a zero-padding card body with an explicit responsive inner wrapper.
- `LoginView.vue` accepts any non-catch-all `?redirect=` and relies on the router guard to enforce permissions. A non-Analytics user returning through `?redirect=/dashboard` is therefore pushed to Dashboard and then redirected to `/403`, instead of using the first permitted landing route.
- The shared landing resolver already correctly returns `/dashboard`, the first accessible registry child, or `/403`; permission loading occurs before its normal call sites.

## Tasks

- [x] **S1 — Adopt the wide Products page shell.** Removed the centered `lg:max-w-7xl` Dashboard wrapper and adopted the Products full-width `md:px-10` page-card geometry, zero-padding Coco neutral card body, explicit responsive inner padding, and shared title/subtitle header while preserving the exact range separately. All Analytics data/state composition remains unchanged. Independent verifier `mud2f849-1o-q27d` passed 30/30 view/error tests, 29/29 metric/filter tests, type-check, scoped Prettier, whitespace, and exact two-file scope. Native medium-risk review `review-12f0d627fa5c888c` approved and was acknowledged; committed as `134544f feat(dashboard): widen analytics page shell`. Route: delegated bounded writer.
- [x] **S2 — Make explicit post-auth redirects permission-aware.** Added a router-agnostic access-metadata helper and changed login to honor a saved redirect only when the authenticated identity satisfies the resolved route's permission and super-admin metadata. A non-Analytics user returning through `?redirect=/dashboard` now falls back to the first permitted registry route while direct forbidden access remains `/403`. Independent verifier `mud2y6yh-1q-jhdb` passed 55/55 navigation, login, and router tests, type-check, scoped Prettier, whitespace, and exact four-file scope. Native high-risk review `review-862567eb2883ee2e` approved and was acknowledged with one informational readability suggestion about duplicated test metadata typing; committed as `9b23de5 fix(auth): fall back from forbidden login redirects`. Route: delegated bounded writer.
- [x] **S3 — Verify and close.** Independent verifier `mud3hnds-1r-721s` passed 171/171 tests across 19 files, type-check, production build, scoped Prettier across 11 files, whitespace, source/permission cross-checks, clean-worktree audit, and 8/8 Chromium cases across 320×568, 375×667, 768×1024, and 1024×768 in light/dark mode. Browser evidence preserved exact Mexico City request boundaries, eight metrics, one filters panel, 44px controls, no overflow, and the responsive hierarchy under the wider shell. The existing Vite chunk-size warning remains non-blocking. Both source work units had already passed acknowledged native review. Route: independent verifier.

## Acceptance contract

- Dashboard outer content is not centered or capped at `lg:max-w-7xl`.
- Dashboard uses the same shell geometry as Products: full-width wrapper, `md:px-10`, full-width `UCard`, title/subtitle header, zero-padding card body, and responsive inner padding.
- The header keeps exactly one `<h1>` and exposes the exact selected range separately.
- Analytics transport, query keys, eight aggregates, formatting, filters, loading/error/empty/refetch/retry states, and no-chart behavior remain unchanged.
- A user lacking `read:Analytics` who logs in with `?redirect=/dashboard` lands on their first permitted route, not `/403`.
- An authorized explicit redirect remains honored.
- Removed/not-found redirects use the first permitted route.
- Direct navigation to a route without its permission still reaches `/403`.
- No backend, public-catalog, dependency, lockfile, or unrelated formatting changes.

## Authorized edit surfaces

- `odd/tasks/dashboard-shell-and-landing-fallback.md`
- `src/features/analytics/views/BranchSalesSummaryView.vue`
- `src/features/analytics/views/__tests__/BranchSalesSummaryView.spec.ts`
- `src/features/analytics/views/__tests__/BranchSalesSummaryView.errors.spec.ts` only if state regression coverage requires it
- `src/features/auth/login/views/LoginView.vue`
- `src/features/auth/login/views/__tests__/LoginView.spec.ts`
- `src/app/navigation/navigation.access.ts`
- `src/app/navigation/navigation.landing.ts`
- focused tests under `src/app/navigation/__tests__/`
- `src/app/router/__tests__/router.spec.ts` only for direct-guard regression coverage
- `e2e/responsive/specs/branch-sales-summary.spec.ts` only if the established shell changes require responsive evidence updates

Explicitly excluded: Analytics API/composable/date/transport contracts; metric/filter components unless a verified regression makes a minimal correction unavoidable; router production behavior; auth store/ability parsing without separate backend evidence; backend; public catalog; dependencies; lockfiles; broad formatting.

## Verification contract

Per work unit:

```sh
pnpm test:unit --run <focused specs>
pnpm type-check
pnpm exec prettier --check <changed paths>
git diff --check
```

Final minimum matrix:

```sh
pnpm test:unit --run src/features/analytics src/features/auth/login src/app/navigation src/app/router
pnpm type-check
pnpm build
pnpm exec prettier --check <all task-owned files>
git diff --check
pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/branch-sales-summary.spec.ts
```

## Current status

Exploration, implementation, independent verification, native review, and closure are complete. The Dashboard now uses the wide Products page-card shell, and post-login saved redirects fall back to the first permitted destination when unauthorized. Push, PR, merge, deployment, and backend changes remain unauthorized and unperformed.
