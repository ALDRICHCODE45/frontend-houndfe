# Tasks: Public Catalog Branch Discovery

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Planning baseline 342 · WU-1 180–230 · WU-2 150–200; each estimate includes that unit's tests, responsive evidence, and delivery-doc updates |
| Comparison bases | Planning vs `aa2b204`; WU-1 vs accepted planning baseline; WU-2 vs WU-1 parent |
| 400-line budget risk | High; each unit is independently gated despite cumulative size |
| Chained PRs recommended | Yes — WU-1 → WU-2 feature-branch chain (recommended, pending user approval) |
| Suggested split | Two vertical runtime units, each independently demonstrable and under 400 |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain recommended; pending user approval |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain (recommended; not yet approved)
400-line budget risk: High

No `size:exception` is available. The planning baseline is 342 changed lines. WU-1 and WU-2 each count their own runtime, tests, responsive evidence, and delivery-doc updates against the comparison bases above; combined runtime ships as two review units, never one.

## Work Units

| # | Goal | Files | TDD gate cmd | Rollback boundary |
|---|------|-------|--------------|-------------------|
| WU-0 | Planning-only mechanical reconciliation (prose diff, not runtime) | `openspec/changes/online-catalog-publishing/delivery-map.md` | prose diff only | revert doc edit; no runtime effect |
| WU-1 | Discovery core: isolated GET, DTO, loading, zero/one/many chooser, no auto-select, generic recoverable+manual retry, no product request, narrow/wide core evidence | see candidate list | `pnpm test:unit --run src/features/catalog` + responsive | remove new api/composable; revert view/header/grid edits; `/catalogo/:branchSlug?` retains anonymous shell |
| WU-2 | Distinct 429/5xx/network copy, retry-pending/guard, cancellation/remount, supplied-slug/no-navigation regression, narrow/wide error evidence | extends WU-1 files | `pnpm test:unit --run src/features/catalog` + responsive | revert error-taxonomy + retry-pending + regression extensions; WU-1 surface remains |

## Dependency Graph

```text
WU-0 (planning baseline, 342 total) ── completed against aa2b204; approval/commit still pending
WU-1 (runtime core, 180–230) ── compare against accepted planning baseline; stay <400 with margin
WU-2 (runtime extension, 150–200) ── compare against WU-1 parent; extends same vertical surface
```

Each runtime unit is independently demonstrable: WU-1 ships populated chooser + generic retry; WU-2 ships distinguishable error copy + retry-pending + slug regression. Each carries its own user-visible behavior, errors, tests, responsive evidence, rollback, and changed-line forecast.

## Implementation Order

### WU-0 — Planning reconciliation (completed; never runtime behavior)

Completed during planning: `delivery-map.md` now marks P0.1 delivered at `aa2b204`, replaces obsolete combined-D1 scope, and preserves native verification evidence. Exact prose diff: **2 additions + 2 deletions = 4 changed lines**.

### WU-1 — Discovery core (forecast 180–230, target <300 with margin)

- [x] RED: failing tests for isolated GET, DTO validation, loading, populated/empty/one rendering, no auto-select, generic server failure+manual retry, no product request. <!-- sdd-owner: implementation -->
- [x] GREEN: `fetchCatalogBranches`, `useCatalogBranches` (basic), `CatalogView`/`CatalogHeader` wiring minimum; isolated anonymous boundary. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: response-order preservation, single-result explicit choice, no-router-push/no-product assertions, narrow/wide populated/empty/loading/generic-error evidence. <!-- sdd-owner: implementation -->
- [x] REFACTOR: typed error baseline (server only at this stage), narrow query options, typed props/emits; defer distinct 429/5xx/network copy to WU-2. <!-- sdd-owner: implementation -->
- [x] Run focused unit, type-check, and responsive evidence; record results. <!-- sdd-owner: implementation -->
- [x] Recount WU-1 additions+deletions against the accepted planning-baseline parent; abort and re-plan if ≥ 380. <!-- sdd-owner: implementation -->

### WU-2 — Error taxonomy, retry-pending, slug regression (forecast 150–200, target <250 with margin)

- [ ] RED: failing tests for distinct 429/5xx/network copy, retry-pending/guard, cancellation/remount, supplied-slug/no-navigation regression. <!-- sdd-owner: implementation -->
- [ ] GREEN: split error taxonomy into `rate-limit | server | network`, add `retry-pending` state with `retryRequested` guard, forward AbortSignal to fetch, capture/preserve supplied `:branchSlug` without redirect. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: rapid-click guard, late completion discarded on unmount, supplied matching/nonmatching slug preserved at narrow/wide, narrow/wide error screenshots, no-router-push after expansion/branch interaction/retry. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: state precedence, dedupe retry wiring, finalize error copy strings. <!-- sdd-owner: implementation -->
- [ ] Run focused unit, type-check, and responsive evidence; record results. <!-- sdd-owner: implementation -->
- [ ] Recount WU-2 additions+deletions against the WU-1 parent; abort and re-plan if ≥ 380. <!-- sdd-owner: implementation -->

## Exact Candidate Files

WU-0 mod: `openspec/changes/online-catalog-publishing/delivery-map.md`. WU-1 new: `src/features/catalog/api/catalog-branches.api.ts`, `src/features/catalog/composables/useCatalogBranches.ts`, `src/features/catalog/api/__tests__/catalog-branches.api.spec.ts`, `src/features/catalog/composables/__tests__/useCatalogBranches.spec.ts`, extension to `src/features/catalog/views/__tests__/CatalogView.spec.ts`, `e2e/responsive/specs/public-catalog-branch-discovery.spec.ts` (core states). WU-1 mod: `src/features/catalog/views/CatalogView.vue`, `src/features/catalog/components/CatalogHeader.vue`, optionally `CatalogProductGrid.vue` for neutral copy. WU-2 extends the same files: distinct error copy, retry-pending/guard, AbortSignal wiring, slug-preservation assertions, narrow/wide error evidence. Read-only regression surfaces (no edits): `src/app/router/index.ts`, `src/main.ts`, `src/core/shared/api/http.ts`, `src/core/shared/api/queryClient.ts`, `src/features/catalog/interfaces/catalog.types.ts`.

## Focused Commands

- `pnpm test:unit --run` (vitest, all slices); per-file target path narrows scope.
- `pnpm build` runs `vue-tsc --build` plus vite build for type-check and bundle evidence.
- `pnpm lint` pre-commit (out of TDD gate).
- Playwright responsive: explicit run via `playwright.responsive.config.ts` against the new spec at 375×812 and 1440×900; evidence written to existing `artifacts/responsive/<run-id>/`.

## Rollback

WU-0: revert `delivery-map.md` edit; no runtime or verification history is touched. WU-1: revert new api/composable files and `CatalogView`/`CatalogHeader`/`CatalogProductGrid` edits; `/catalogo/:branchSlug?` returns to P0.1 anonymous shell with disabled branch affordance. WU-2: revert error-taxonomy + retry-pending + regression extensions only; WU-1 chooser surface remains intact.

## Commit Message Suggestion

WU-1: `feat(catalog): anonymous branch discovery core with populated chooser and manual retry`
WU-2: `feat(catalog): distinct 429/5xx/network copy, retry-pending guard, slug regression`
