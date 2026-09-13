# tasks — public-catalog-anonymous-bootstrap (P0.1, 4/4 tasks complete — apply authorized and finished; no `size:exception`)
## Review Workload Forecast
| Field | Value |
|-------|-------|
| Estimated changed lines | realized since planning baseline `c0c30ee` (exact Git numstat, `.gentle-ai-instance` excluded): runtime/tests 196A+6D=202 plus persisted docs (tasks.md flips/corrections + apply-progress.md) — final exact total and remaining 400-margin recorded in apply-progress.md; planning baseline already committed as `c0c30ee` |
| 400-line budget risk | Low (planning baseline delivered as `c0c30ee`; authorized apply finished under budget) |
| Chained PRs recommended | No |
| Suggested split | separate planning baseline; one runtime unit |
| Delivery strategy | ask-on-risk |
| Chain strategy | not applicable (no chained runtime unit recommended) |
Decision needed before apply: resolved — apply was explicitly authorized and is complete
Chained PRs recommended: No
Chain strategy: not applicable
400-line budget risk: Low
## Work Units
| # | Behavior | Focused test cmd | Runtime path | Rollback |
|---|----------|------------------|--------------|----------|
| 1 | Anonymous catalog bypass + readiness + expiry cleanup | `pnpm test:unit --run src/app/router/__tests__/router.spec.ts src/main.spec.ts src/features/catalog/views/__tests__/CatalogView.spec.ts` | `/catalogo`, `/catalogo/:branchSlug` (`public-catalog`) → inert P0; dep: early-return → `isReady()` → expiry/redirect | Forward-fix the anonymous boundary, or separately authorized route withdrawal; never blind revert to hydrated public startup |
- [x] RED: failing cases in `src/app/router/__tests__/router.spec.ts` (both URLs, zero auth calls) + `src/main.spec.ts` (deferred mount, no hydration, expiry, redirect suppression); reuse read-only `src/features/catalog/views/__tests__/CatalogView.spec.ts` + responsive spec. <!-- sdd-owner: implementation -->
- [x] GREEN: edit only `src/app/router/index.ts` (early return on `public-catalog` before `useAuthStore()`) + `src/main.ts` (`router.isReady()` await, no startup hydration, conditional redirect); tests `src/app/router/__tests__/router.spec.ts`, `src/main.spec.ts`; read-only reuse `src/features/catalog/views/__tests__/CatalogView.spec.ts`, `e2e/responsive/specs/catalog-entry-disabled.spec.ts`. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: stale-credentials, slug, protected/login/error/tenant regressions; responsive 375×667 + 1280×800 still passes. <!-- sdd-owner: implementation -->
- [x] REFACTOR: tighten guard + bootstrap ordering; behavior + types unchanged. <!-- sdd-owner: implementation -->
Verify: focused `pnpm test:unit --run src/app/router/__tests__/router.spec.ts src/main.spec.ts src/features/catalog/views/__tests__/CatalogView.spec.ts`; responsive `pnpm type-check:responsive`; `pnpm type-check`; `pnpm build`; Playwright `pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/catalog-entry-disabled.spec.ts`; whole suite may record inherited follow-up if unrelated uncaught errors recur; never hide candidate-caused failures.
Rollback/Scope: forward-fix the anonymous boundary, or separately authorized route withdrawal; never blind revert to hydrated public startup; preserve P0, legitimate cleanup, unrelated guards. Out of scope: branch discovery, products, D1, backend/tool, SFC redesign, `.gentle-ai-instance`. Planning baseline was delivered as `c0c30ee` and apply is authorized and complete. Runtime commit, push, sync, and archive remain unauthorized: stop before any of them.
