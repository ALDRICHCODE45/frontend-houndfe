# Apply Progress — WU1 Authorization Subjects

## Status

- Change: `online-catalog-backoffice`
- Work unit: `wu1-authorization-subjects`
- Structured status consumed: `gentle-ai.sdd-status` v2, `applyState: ready`, `actionContext.mode: repo-local`; authorized workspace is the repository root.
- Scope guard: only WU1 authorization files and its three focused test files were changed. WU2+ surfaces, routes, navigation, catalog feature files, and unrelated untracked files were not touched.

## Superseded WU2 attempt

- The original `wu2-catalog-settings-transport` implementation produced 1128 source/test lines, exceeding the 400-line review budget.
- Its native settle covered only 128 tracked lines because the new catalog-settings files were excluded as untracked; it is not valid completion evidence for the full implementation.
- The user rejected a size exception and approved replacement by `WU2A -> WU2B -> WU2C`. Those units remain unchecked and require independent bounded evidence and review.
- The existing worktree files are retained only as implementation input for the split; this record does not claim WU2 completion.

## Completed task

- [x] WU1 authorization subject registration and regression coverage. Persisted checkbox updated in `tasks.md`.
- Added typed/runtime `TenantCatalogSettings` and `GlobalPriceList` subjects.
- Added neutral Spanish `TenantCatalogSettings` subject copy with only `read` and `update` curated actions; preserved existing `GlobalPriceList` copy and visibility.
- Added tests for typed subjects, valid grants, malformed-code rejection, revocation on omission, action boundaries, and cross-subject isolation.

## TDD Cycle Evidence

| Stage | Evidence |
|---|---|
| RED | Before implementation, the exact focused Vitest command failed: 3 files failed, 5 tests failed; subjects were absent from the typed/runtime registries and Spanish copy. |
| GREEN | Registered both subjects in `auth.types.ts` and `ability.ts`, added the catalog role copy, and the exact focused command passed: 3 files, 139 tests passed. |
| TRIANGULATE | Regression cases cover `tenant_catalog_settings:read`, extra segments, omitted `GlobalPriceList` revocation, read/update-only catalog grants, no cross-subject grant, and visible Spanish copy. Focused command passed again: 3 files, 139 tests passed. |
| REFACTOR | Kept `parsePermissionCode` pure, added a concise WU1 TDD comment, and corrected targeted formatting without broad restyling. |

## Verification

- Focused Vitest (exact task command): PASS — `pnpm test:unit --run src/features/auth/authorization/__tests__/ability.test.ts src/features/auth/interfaces/__tests__/auth.types.spec.ts src/features/admin/roles/i18n/__tests__/permissions.spec.ts` — 3 files / 139 tests passed.
- Build: PASS — `pnpm build` (`vue-tsc --build` and `vite build` succeeded).
- Runtime scenario: N/A — WU1 is a pure authorization registry change; runtime UI ships with WU3A.
- Attempt token acquired and retained: `sha256:ca9e1fb9d16c3803bff2182318db6a00cefb5776458eaf07e3ac14f1e6f4d5dc`.

## Files changed

- `src/features/auth/interfaces/auth.types.ts`
- `src/features/auth/authorization/ability.ts`
- `src/features/admin/roles/i18n/permissions.ts`
- `src/features/auth/authorization/__tests__/ability.test.ts`
- `src/features/auth/interfaces/__tests__/auth.types.spec.ts`
- `src/features/admin/roles/i18n/__tests__/permissions.spec.ts`
- `openspec/changes/online-catalog-backoffice/tasks.md`
- `openspec/changes/online-catalog-backoffice/apply-progress.md`

## Workload / boundary

- Authored WU1 source/test diff: 90 changed lines (85 additions, 5 deletions); OpenSpec progress/task bookkeeping is separate.
- WU1 remains below the 150-line slice maximum and 400-line review budget.
- Rollback boundary: revert the six WU1 source/test files and the WU1 task/progress bookkeeping; unrelated untracked files remain preserved.

## Remaining tasks

All later implementation tasks remain unchecked, including the exact WU2 line:
`- [ ] Implement and verify the behavior. <!-- sdd-owner: implementation -->`

## Deviations and warnings

- No design deviation.
- Prettier check reported pre-existing style differences in large legacy test files; no broad formatter rewrite was applied. The targeted additions are syntactically valid and build/test clean.
- No commit, merge, push, dependency, backend, route, navigation, view, query, or public-catalog changes performed.

# Apply Progress — WU2A Settings Contract (Types + API + Query Key)
## Status
- Change: `online-catalog-backoffice`; WU: `wu2a-settings-contract-api-key`; `gentle-ai.sdd-status` v2, `applyState: ready`, `actionContext.mode: repo-local`; authorized workspace = repo root.
- Scope: NEW types / API / API test under `src/features/system/catalog-settings/`; MOD `query-keys.ts` (+8: `catalogSettingsQueryKeys` export + 2-line comment) and `query-keys.test.ts` (+34: import + 4-case describe block). WU2B mappers, WU2C composables, view / route / navigation, candidate enumeration, `src/features/catalog/**`, and `openspec/changes/online-catalog-publishing/**` untouched.
## Superseded WU2
- `wu2-catalog-settings-transport` produced 1128 source/test lines; native settle covered only 128 tracked lines because new catalog-settings files were untracked — not valid completion evidence.
- User rejected `size:exception`; approved `WU2A -> WU2B -> WU2C` split per `tasks.md`. Those units remain unchecked.
## Completed task
- [x] Implement and verify the WU2A behavior. Persisted checkbox updated in `tasks.md`.
## TDD Cycle Evidence
- RED: `catalogSettings.api.spec.ts` module-resolution fail; 4 `catalogSettingsQueryKeys` cases failed (registry export absent — `Cannot read properties of undefined (reading 'detail')`).
- GREEN: Zod response / patch-body / stock-default / price-context schemas; `catalogSettingsApi.get` / `patch` over `@/core/shared/api/http`; `catalogSettingsQueryKeys.detail(tenantId)`. Focused: 2 files / 108 tests passed.
- VERIFIER-FIX-1 RED: 4 cases failed — (a) forged `tenantId` via `as unknown as CatalogSettingsPatchBody` smuggle reached `http.patch`; (b) full forged response-only bag (`effectivePublication` / `priceContexts` / `warnings` / `updatedAt`) reached `http.patch`; (c) `get()` returned unknown response fields verbatim; (d) `get()` returned invalid payloads (e.g. unknown stock mode) without throwing.
- VERIFIER-FIX-1 GREEN: Added `FORBIDDEN_PATCH_KEYS` denylist + `stripForgedPatchKeys` helper at `patch` boundary; called `catalogSettingsResponseDtoSchema.parse(data)` at both `get` and `patch` boundaries (REQ-5 / REQ-7 / REQ-18 pin). 2 files / 112 tests passed.
- VERIFIER-FIX-2 RED: Forged `arbitraryUnknownField` (plus `anotherUnknownKey`, `yetAnotherForged`) reached `http.patch` — denylist only knows the five KNOWN response-only keys. Captured: 1 new case failed (assertion `expect(keys).not.toContain('arbitraryUnknownField')`).
- VERIFIER-FIX-2 GREEN: Replaced denylist with TRUE runtime whitelist — `catalogSettingsPatchBodySchema.parse(body)` at `patch` boundary (Zod default object behavior strips unknown fields). Body reaching `http.patch` contains ONLY the 4 documented whitelisted keys (`catalogPublished` / `publicPriceListIds` / `catalogDefaultPriceListId` / `stockPresentationDefault`). Response parsing at both `get` and `patch` boundaries preserved. 2 files / 113 tests passed.
- TRIANGULATE: Whitelist-body verbatim (4 keys, exact order); single-key partial (`stockPresentationDefault` only, no implicit keys injected); forged `tenantId` stripped; forged full response-only bag stripped; forged ARBITRARY unknown keys stripped by true whitelist; Zod response strips unknown fields; Zod response rejects invalid stock mode. 2 files / 113 tests passed.
- REFACTOR: Type module pure (no Vue / Nuxt UI imports); API reuses typed client + Zod schemas; single `catalogSettingsPatchBodySchema.parse(body)` call is the source of truth (no denylist set / strip helper). Co-located spec under `api/__tests__/`. The `deliveryRouteQueryKeys` describe block in `query-keys.test.ts` was restored to its prior structure so the diff contains only catalog-settings query-key additions (no unrelated churn, no test deletion).
## Verification
- Focused Vitest: PASS — `pnpm test:unit --run src/features/system/catalog-settings/api/__tests__/catalogSettings.api.spec.ts src/core/shared/constants/__tests__/query-keys.test.ts` — 2 files / 113 tests passed.
- Build: PASS — `pnpm build` (`vue-tsc --build` + `vite build`).
- Runtime: N/A — transport-boundary slice; runtime UI ships with WU3A.
- Token: `sha256:34e418f80d804316bb68a6293e19798ced914d50a625436afcb9c3e7dc73f627` (continuation of `wu2a-runtime-whitelist-fix`; re-acquire returned `proceed`, token retained).
## Files changed
- NEW (3 intended untracked): `src/features/system/catalog-settings/interfaces/catalog-settings.types.ts` (83) + `api/catalogSettings.api.ts` (52) + `api/__tests__/catalogSettings.api.spec.ts` (221) = 356 lines.
- MOD: `src/core/shared/constants/query-keys.ts` (+8) + `src/core/shared/constants/__tests__/query-keys.test.ts` (+34) + `openspec/changes/online-catalog-backoffice/tasks.md` (WU2A checkbox swap) + `apply-progress.md` (this section).
- Accounting: 356 NEW + 42 query-key + 38 progress + 2 task-checkbox = **≤438** (user-authorized one-time `size:exception` after fixes; slice is ABOVE the 399-line bound; no comments / blank lines / docs / tests deleted, compressed, or restyled).
## Rollback / preserved state
- Rollback: `git restore` the 3 NEW files + `query-keys.ts` + `query-keys.test.ts`; revert `tasks.md` + `apply-progress.md` bookkeeping. No consumer exists yet, so no other module is affected.
- Stash `stash@{0}` (oversized WU2 input) and historical untracked files (`.gentle-ai-instance`, `verify-report.md`, stale literal-`{__tests__}` directories) preserved verbatim (no pop / drop / clean).
## Remaining tasks
WU2B (mappers), WU2C (composables), WU3A (routed read-only view + route + sidebar), WU3B (editable form + confirmation + mutation + candidates), WU4–WU6 (product / variant advanced fields and modal) remain unchecked per `tasks.md`.
## Deviations and warnings
- No design deviation. PATCH-body whitelist pins at THREE levels: (1) TYPE `CatalogSettingsPatchBody` (only 4 whitelisted keys); (2) runtime `catalogSettingsPatchBodySchema.parse(body)` at `patch` API boundary (TRUE runtime whitelist — Zod default strips arbitrary forged keys the API has never seen, catches `as unknown as ...` smuggle); (3) backend `forbidNonWhitelisted` DTO. GET / PATCH responses parse via `catalogSettingsResponseDtoSchema.parse(...)` (REQ-5 / REQ-7 pin).
- Verifier fix #1: 4 new tests (response field stripping, invalid payload rejection, forged `tenantId` stripping, forged full response-only-key bag stripping); `deliveryRouteQueryKeys` describe block restored to prior structure.
- Verifier fix #2: 1 new test (forged ARBITRARY unknown PATCH keys stripped by true whitelist). Previous denylist REPLACED — Zod parse is the single source of truth; `FORBIDDEN_PATCH_KEYS` + `stripForgedPatchKeys` REMOVED (NOT preserved as belt-and-suspenders because a second denylist would be misleading documentation). `deliveryRouteQueryKeys` describe block untouched by fix #2 (no churn). No comments / blank lines / docs / tests deleted, compressed, or restyled.
- No commit / merge / push / dependency / backend / route / nav / view / query / mapper / composable / candidate enumeration / confirmation / public-catalog mutation. Stash `stash@{0}` and historical untracked preserved verbatim.

# Apply Progress — WU2B Pure Catalog-Settings Mappers (table-driven)
- Change: `online-catalog-backoffice`; WU: `wu2b-settings-mappers`; `applyState: ready`; workspace = repo root.
- Scope: NEW `utils/catalogSettingsMappers.ts` (165) + `__tests__/catalogSettingsMappers.spec.ts` (191) = 356 source+test; WU2A types/API/key, WU2C composables, views/routes/navigation, candidates, `src/features/catalog/**` untouched.
- Completed task: [x] Implement and verify WU2B. Persisted checkbox updated.
- RED: source deleted; `Failed to resolve import "../catalogSettingsMappers"` (module resolution fail).
- GREEN: reimplemented tight table-driven source; focused 1 file / 39 tests passed.
- TRIANGULATE: empty priceContexts → []+null; non-CUSTOM quantity null; CUSTOM 0 preserved; atomic-clear triple; ordinary unpublish only `{catalogPublished:false}`; rising edge `false→true`; WARNING unknown→null; `mapCatalogSettingsError` TENANT_NOT_ACTIVE/403/unknown/null. 1 file / 39 tests passed.
- REFACTOR: deduplicated test into `it.each` behavior-first table cases; per-describe describe blocks; closed-set `ERROR_COPY`/`WARNING_COPY` maps.
- Focused Vitest: PASS — `pnpm test:unit --run src/features/system/catalog-settings/utils/__tests__/catalogSettingsMappers.spec.ts` — 1 file / 39 tests passed.
- Build: PASS — `pnpm build` (`vue-tsc --build` + `vite build` exit 0).
- Runtime: N/A — pure mapper; runtime ships with WU3A.
- Stash `stash@{0}` + untracked + literal `{__tests__}` directory preserved verbatim; no pop/drop/clean.
- Accounting: 356 source+test + 36 task/progress bookkeeping = **392** candidate lines; <399 budget met after compact tasks.md checkbox repair.
- `tasks.md`: 10 implementation checkboxes total; WU1/WU2A/WU2B `[x]`, WU2C/WU3A/WU3B/WU4/WU5/WU6/Cross-Slice `[ ]`.
- REMEDIATION: replaced non-null assertion at `mapCatalogSettingsError` line 35 (`ERROR_COPY[input.code]!`) with explicit safe logic — capture into local `codeCopy`, truthy-check, then return. No behavior change; 39 tests still green; mapper grew 165→168 lines.
- No commit / merge / push / dependency / backend / route / nav / view / query / composable / candidate enumeration / confirmation / public-catalog mutation.

## WU2B.1 Review-Advisory Follow-up
- RED: simultaneous last-context removal + stock change lost `stockPresentationDefault`; 1/40 failed.
- GREEN: atomic clear now forces false/[]/null without returning before independent stock serialization; 40/40 passed.
- RELIABILITY: response-table predicates are explicit assertions; WU2B checkbox state is unchanged.
- Scope: mapper + mapper spec + this evidence only; no composable/view/route/navigation/storefront changes.

# Apply Progress — WU2C Settings Query + Mutation Composables
- Change: `online-catalog-backoffice`; WU: `wu2c-settings-query-mutation-composables`; `applyState: ready`; repo-local workspace; attempt token `sha256:7d912254fe153c5a8f9e6c644bcdc1fbe0bef4de4d4d84ad4f232a50176145c0` (continued, per instruction after a timed-out launch that produced no tool use).
- Scope: NEW `composables/useCatalogSettingsQuery.ts` (35) + `useUpdateCatalogSettingsMutation.ts` (48) + `__tests__/useCatalogSettingsQuery.spec.ts` (116) + `__tests__/useUpdateCatalogSettingsMutation.spec.ts` (134) = 333 authored lines; candidate composable, router/navigation/views, `src/features/catalog/**`, and broader invalidation keys untouched.
- Completed task: [x] WU2C build verification. Persisted checkbox updated in `tasks.md`.
- RED: both spec files failed on module resolution (`Cannot find module '../useCatalogSettingsQuery'` / `'../useUpdateCatalogSettingsMutation'`); 2 files failed, no tests ran.
- GREEN: `useCatalogSettingsQuery` (tenant-scoped reactive key; no placeholderData/initialData/select; `enabled` forwarded) + `useUpdateCatalogSettingsMutation` (pure `handleUpdateSuccess` deps handler; invalidates ONLY `catalogSettingsQueryKeys.detail(tenantId)`; no `setQueryData`). Focused: 2 files / 14 tests passed.
- TRIANGULATE: 404 propagates without synthetic fallback; forged/arbitrary PATCH keys stripped at the API boundary; invalid PATCH response rejected (Zod); failure invalidates nothing and propagates (dirty draft kept for WU3B). 16/16 passed.
- REFACTOR: compacted test scaffolding and comment headers (merged redundant cases, every contract pin retained); 2 files / 10 tests passed; `vue-tsc --build` + `vite build` exit 0.
- Accounting (SUPERSEDED by the WU2C remediation below): this settled candidate was reset after independent verification found an empty tenant left the query enabled and mocked TanStack tests did not prove runtime isolation.
- Runtime: superseded — the WU2C remediation section below owns the runtime harness evidence.
- No commit / merge / push / dependency / backend / route / nav / view / candidate enumeration / confirmation / public-catalog mutation; stash + historical untracked preserved verbatim.

## WU2C Runtime Test Remediation (verifier blockers 1 & 2)
- Change: `online-catalog-backoffice`; WU: `wu2c-runtime-test-remediation`; `applyState: ready`; repo-local workspace; continued active attempt `sha256:303959ebb5803ae5e7e512d668b0720d3733f9a7dfc88e9417389474ed16bf1c` under the user-authorized reset.
- Blocker 1 FIXED: `useCatalogSettingsQuery` now passes a computed `enabled` conjunction — non-empty `toValue(tenantId)` AND the optional caller gate (`options?.enabled ?? true`); an empty tenant id makes no GET.
- Blocker 2 FIXED: replaced ALL mocked TanStack scaffolding (useQuery/useMutation/useQueryClient mocks) with a real `QueryClient` + `VueQueryPlugin` mounted component harness; only `@/core/shared/api/http` is mocked. Query spec: empty tenant fires no GET (then fires once a tenant arrives); caller `enabled=false` blocks with a non-empty tenant; tenant A→B exposes no A data while B is pending and settles to B only; 404 becomes error without synthetic data. Mutation spec: success invalidates ONLY `catalogSettingsQueryKeys.detail(variables.tenantId)` with no overwritten/optimistic write; failure invalidates/writes nothing and propagates; pure `handleUpdateSuccess` contract pin retained.
- RED: empty-tenant test fired a GET against the old composable and the A→B test failed (also caught the deferred helper needing the `{ data }` envelope); 2 failed / 5 passed.
- GREEN: computed conjunction landed; focused 2 files / 7 tests passed. Full focused catalog-settings suite: 5 files / 160 tests passed.
- REFACTOR: removed an unused binding flagged by oxlint; lint clean (0 warnings / 0 errors, oxlint + eslint); `pnpm build` (vue-tsc + vite) exit 0; `git diff --check` clean.
- Accounting (corrected): final candidate 40 `useCatalogSettingsQuery.ts` + 48 `useUpdateCatalogSettingsMutation.ts` + 119 `useCatalogSettingsQuery.spec.ts` + 95 `useUpdateCatalogSettingsMutation.spec.ts` = **302 authored lines** (mock scaffolding replaced, no parallel coverage added; no placeholderData/initialData, no optimistic hooks); native settle recorded **passed, changed_lines 322** (finish candidate identity `sha256:a1094134ea61f4719192b58a8402acff70a888f5b486147544fdb37cdbfeadc9`, evidence revision `sha256:b886778b7a82b02fb662311484590529b756f261f4113814912954caf84554a0`) — inside the ≤360 objective bound and the 400 review budget.
- Scope: only the four WU2C composable files + this progress + tasks.md; no route/nav/view/candidate/storefront/dependency/backend edits; no commit/merge/push; stash@{0} and historical untracked preserved verbatim.

# Apply Progress — WU3A Routed Read-Only View, Route, Sidebar Entry

- Change: `online-catalog-backoffice`; WU: `wu3a-routed-readonly-view`; `gentle-ai.sdd-status` v2, `applyState: ready`, `actionContext.mode: repo-local`; repo-local workspace.
- Attempt: continued active attempt `sha256:bbc4050e7671ab79253298f7d0358f321b189c92197f89424a943f489e044ed2` (acquire returned `proceed`; settled exactly once as `passed` after the user-authorized size:exception below). Previous launch timed out before any model turn/tool call; no mutation had occurred.

## Completed task

- [x] WU3A build verification. Persisted checkbox updated in `tasks.md`.
- NEW `views/TenantCatalogSettingsView.vue` — thin composition: `useSafeTenantId` + WU2C `useCatalogSettingsQuery`; loading skeletons / GET error with `Reintentar` (no synthetic defaults, no auto-toast) / accepted read-only surface delegated to the read view.
- NEW `components/CatalogSettingsReadView.vue` — read-only accepted surface: publication + effective badges (rendered as-is, never recomputed), contexts in server order with `Predeterminada` badge, empty-contexts copy, stock default via WU2B serializer with `Mostrar 0`/`Mostrar n`, closed-set warnings via `mapCatalogSettingsWarning` (unknown codes dropped silently), `updatedAt` timestamp.
- MOD `src/app/router/index.ts` (+16): lazy `TenantCatalogSettingsView` const + route `path:'/system/catalog-settings'`, `name:'system-catalog-settings'`, `layout:'dashboard'`, `meta.permission:['read','TenantCatalogSettings']`; NO `skipTenantCheck`, NO `requiresSuperAdmin`.
- MOD `src/app/navigation/navigation.registry.ts` (+4): Sistema entry `sistema-catalog-settings` / `Catálogo online` / `i-lucide-globe` / `/system/catalog-settings` gated `['read','TenantCatalogSettings']`.

## TDD Cycle Evidence

| Stage | Evidence |
|---|---|
| RED | 4 focused spec files written first; exact focused command failed: 4 files, 6 tests failed (route absent → 403-flow resolve, nav entry absent, both SFC modules unresolvable). |
| GREEN | Implemented read view + routed view + route + nav entry; focused command: 4 files / 24 tests passed. |
| TRIANGULATE | Added cross-subject-grant route denial, filter keeps-only-accessible Sistema children, effective-helper hidden when effective=true, `Mostrar 2` positive quantity, `it.each` mode matrix (ABSTRACT_STATUS/HIDDEN). Focused: 4 files / 30 tests passed. |
| REFACTOR | Restructured the lazy-resolve test to unconditional expects (oxlint `no-conditional-expect`); oxlint on all 8 WU3A files: 0 warnings / 0 errors. |

## Verification

- Focused Vitest (exact task command): PASS — `pnpm test:unit --run src/features/system/catalog-settings/views/__tests__/TenantCatalogSettingsView.spec.ts src/features/system/catalog-settings/components/__tests__/CatalogSettingsReadView.spec.ts src/app/router/__tests__/router.catalogBackoffice.spec.ts src/app/navigation/__tests__/navigation.catalogBackoffice.spec.ts` — 4 files / 30 tests passed.
- Build: PASS — `pnpm build` (`vue-tsc --build` + `vite build`, exit 0; pre-existing chunk-size warning only).
- Runtime scenario: view state coverage verified via focused mocks (loading skeleton → accepted read-only; revoked ⇒ `/403` proven by router guard test). No real dev-tenant browser run was performed (verify phase owns the REQ-20 responsive evidence).

## Files changed

- NEW: `src/features/system/catalog-settings/views/TenantCatalogSettingsView.vue` (58), `src/features/system/catalog-settings/components/CatalogSettingsReadView.vue` (141), `src/features/system/catalog-settings/views/__tests__/TenantCatalogSettingsView.spec.ts` (123), `src/features/system/catalog-settings/components/__tests__/CatalogSettingsReadView.spec.ts` (172), `src/app/router/__tests__/router.catalogBackoffice.spec.ts` (139), `src/app/navigation/__tests__/navigation.catalogBackoffice.spec.ts` (75) = 708 lines.
- MOD: `src/app/router/index.ts` (+16), `src/app/navigation/navigation.registry.ts` (+4), `openspec/changes/online-catalog-backoffice/tasks.md` (WU3A checkbox), `apply-progress.md` (this section).

## Accounting — user-authorized one-time size:exception (777 lines)

- Complete candidate: **777 changed lines** = 708 NEW source+test + 20 route/navigation additions + 49 OpenSpec task/progress diff lines. The maintainer explicitly authorized a one-time exact-777-line WU3A `size:exception` after correcting my initial 728 figure, which had excluded the OpenSpec bookkeeping.
- Verified physically: the six new files measure 708 via `wc -l`; `git diff --numstat` shows `router/index.ts` +16 and `navigation.registry.ts` +4, `tasks.md` +1/−1 (WU3A checkbox), and this progress section +47 — 708 + 20 + 49 = 777 exactly.
- The implementation is verified green (30/30 focused + build exit 0) and cohesive (one route + nav + view + read view); the exception covers this complete candidate only and sets no precedent for later work units.
- Attempt `sha256:bbc4050e7671ab79253298f7d0358f321b189c92197f89424a943f489e044ed2` settled exactly once as `passed` with the complete-candidate evidence revision (see token line above).

## Scope guard / preserved state

- Only WU3A files + tasks.md + apply-progress.md were changed. WU3B surfaces, editable form, ConfirmModal, PATCH wiring, candidate composable, `src/features/catalog/**`, `src/features/admin/tenants/**`, and `openspec/changes/online-catalog-publishing/**` untouched.
- Stash `stash@{0}` and historical untracked files preserved verbatim (no pop/drop/clean). No commit/merge/push/dependency/backend change.
- Out-of-scope deferred: `src/features/POS/sales/components/__tests__/SaleDetailTotalsCard.test.ts` was restored to HEAD by the user's explicit authorization; it carries zero diff in this candidate, and its pre-existing committed diagnostics are session-deferred outside WU3A.
- No commit / merge / push / dependency / backend / WU3B mutation.

# Apply Progress — WU3B Oversize → Split A–F (maintainer decision `split_wu3b`)

- The single WU3B attempt (`wu3b-editable-settings-form`, token `sha256:73a890245586ad7b202b3d056b89950753508e4011dfbac2744d5eededcf4de6`) produced a verified-green complete candidate of 1505 changed lines (1457 source/tests + 48 OpenSpec bookkeeping), exceeding its explicit 380-line bound. Gates observed before the split: focused 7 files / 64 tests passed; `pnpm build` (vue-tsc + vite) exit 0; `git diff --check` clean; oxlint on 14 WU3B files 0 warnings / 0 errors. The user rejected `size:exception` and selected `split_wu3b`.
- Truthful terminal settle recorded natively: attempt ordinal 15 `failed`, provider-tracked `changed_lines: 491`, finish candidate identity `sha256:26f3e0d3dcfe4b9ac0aa4e89e3f96991879e6019a538326fb079fa197d2b9c33`, evidence revision `sha256:73a890245586ad7b202b3d056b89950753508e4011dfbac2744d5eededcf4de6`, with the diagnosis carrying the full 1505-line accounting and the green evidence. `decision_required: true`, `next_action: reset` — the runtime requires a maintainer-run audited `gentle-ai sdd-attempt reset` before ordinal 16 (WU3B-A) may open; reset was NOT executed because it requires a separate maintainer authorization and must not be inferred.
- Complete candidate preserved byte-exact outside the repo at `/tmp/wu3b-candidate-input-20260915-113735` (14 source/test paths + `tasks.md` + `apply-progress.md`, tracked patch `98f2d224d81ee5540ef3a98d33b8c1413ee2e53f7201bf39146855713811e479`, status, SHA-256 manifest `45c08c6f4c8e6afac044d8910f803b39fe791473f0c7ee30b796799999222260`; manifest verified 16/16 and byte-compared against the worktree immediately before the destructive restoration).
- The candidate was then restored to baseline `a97b708`: the 4 MOD source/test files and 2 OpenSpec files via `git restore`, the 10 NEW WU3B files removed. Worktree now shows ONLY the two historical untracked files (`openspec/changes/online-catalog-publishing/.gentle-ai-instance`, `openspec/changes/public-catalog-branch-discovery/verify-report.md`); `stash@{0}` untouched; no commit.
- `tasks.md` replanned: WU3B split into sequential WU3B-A…F (candidates+stock → contexts field → form composable → form composition → view composition+notice → rising-edge confirmation+routing), each projected complete candidate ≤ 380 including bookkeeping, with dependency order, focused commands, runtime scenarios, rollback boundaries, and separate Conventional Commit messages. All normative WU3B requirements are preserved across the six units; slices re-land the preserved candidate content under strict TDD (per-slice RED from baseline, GREEN by transplant, TRIANGULATE, REFACTOR) rather than re-authoring.
- WU3B-A is NOT checked and NOT yet implemented at the time of this note: the native reset gate must clear first.

# Apply Progress — WU3B-A Candidate Enumeration + Stock Presentation Field

- Change: `online-catalog-backoffice`; WU: `wu3b-a-candidates-and-stock-field`; attempt token `sha256:cbf8998efcc01221e95aeb4e2a4d2cb9efdadeb4f8a4f8a779140046c011aa3e` (continued after the cancelled launch produced zero mutation; branch `feat/online-catalog-backoffice` at `b56d3e2`).
- Scope: NEW 4 files only — `composables/useCatalogPriceListCandidatesQuery.ts` (42), `composables/__tests__/useCatalogPriceListCandidatesQuery.spec.ts` (64), `components/CatalogStockPresentationField.vue` (81), `components/__tests__/CatalogStockPresentationField.spec.ts` (59) = 246 lines, each byte-identical (`cmp`) to the verified backup `/tmp/wu3b-candidate-input-20260915-113735`; plus tasks.md checkbox and this section. B–F paths absent; no out-of-surface edits.
- RED: both spec files transplanted first from the verified snapshot; focused command failed — `Failed to resolve import "../useCatalogPriceListCandidatesQuery"` and `"../CatalogStockPresentationField.vue"` (2 files failed, sources absent from the clean baseline).
- GREEN: transplanted the two sources byte-identically; focused command passed — 2 files / 7 tests.
- TRIANGULATE (pinned in the transplanted specs): candidate gate matrix — no request when either `update:TenantCatalogSettings` or `read:GlobalPriceList` is missing; request fires only with both; stock mode matrix incl. non-custom ⇒ `customQuantity: null` and CUSTOM_QUANTITY `0` preserved as "Mostrar 0".
- REFACTOR: oxlint on all 4 files 0 warnings / 0 errors; `git diff --check` clean.
- Verification: focused Vitest PASS — `pnpm test:unit --run src/features/system/catalog-settings/composables/__tests__/useCatalogPriceListCandidatesQuery.spec.ts src/features/system/catalog-settings/components/__tests__/CatalogStockPresentationField.spec.ts` — 2 files / 7 tests passed. Build: PASS — `pnpm build` (vue-tsc + vite) exit 0. Runtime: N/A — runtime ships with WU3B-E/F.
- Accounting: 246 source/test + 1 checkbox swap + this section (~12) ≈ 259 complete candidate lines ≤ 380.
- Preserved: `stash@{0}` and both historical untracked files verbatim; B–F sources NOT restored; no commit/merge/push/dependency/backend change.

# Apply Progress — WU3B-B Tenant Price-Contexts Field

- Change: `online-catalog-backoffice`; WU: `wu3b-b-price-contexts-field`; attempt token `sha256:ebcb60322e6b59addac6361fffa350ad249eff786a5e1c72fc5ed7d8b4e65a0f` (ordinal 19, continued after the cancelled launch produced zero mutation; branch `feat/online-catalog-backoffice` at `ebb0452`).
- Scope: NEW 2 files only — `components/CatalogPriceContextsField.vue` (130) + `components/__tests__/CatalogPriceContextsField.spec.ts` (88) = 218 lines, each byte-identical (`cmp`) to the verified backup `/tmp/wu3b-candidate-input-20260915-113735` (patch `98f2d224…e479`, manifest `45c08c6f…2260` re-verified 16/16); plus tasks.md checkbox and this section. C–F paths absent; no out-of-surface edits.
- RED: spec transplanted first from the verified snapshot with sources absent; focused command failed — `Failed to resolve import "../CatalogPriceContextsField.vue"` (1 file failed, no tests ran).
- GREEN: transplanted the source byte-identically; focused command passed — 1 file / 6 tests.
- TRIANGULATE (pinned in the transplanted spec): rows in draft order with `Predeterminada` badge; only the NON-default row renders a set-default action; add options exclude current members (`Lista C` only); `pl_ghost`-style missing id preserved and rendered by raw id; disabled mode keeps both rows visible, disables remove, and hides add options entirely.
- REFACTOR: oxlint on both files 0 warnings / 0 errors; `git diff --check` clean; no behavior drift (source stayed byte-identical).
- Verification: focused Vitest PASS — `pnpm test:unit --run src/features/system/catalog-settings/components/__tests__/CatalogPriceContextsField.spec.ts` — 1 file / 6 tests passed. Build: PASS — `pnpm build` (vue-tsc + vite) exit 0 (pre-existing chunk-size warning only). Runtime: N/A — runtime ships with WU3B-E/F.
- Accounting: 218 source/test + 1 checkbox swap + this section (~14) ≈ 233 complete candidate lines ≤ 380.
- Preserved: `stash@{0}` and both historical untracked files verbatim; no commit/merge/push/dependency/backend change.

# Apply Progress — WU3B-C Settings Form Lifecycle Composable

- Retry after the cancelled launch (zero mutation): NEW 2 files byte-identical (`cmp`/`sha256` match to `/tmp/wu3b-candidate-input-20260915-113735`) — `composables/useCatalogSettingsForm.ts` (159) + `composables/__tests__/useCatalogSettingsForm.spec.ts` (192) = 351 lines.
- TDD: RED — spec-only transplant failed with `Failed to resolve import "../useCatalogSettingsForm"` (1 file failed, no tests). GREEN — source transplanted; 1 file / 13 tests passed. TRIANGULATE — preserved cases pin REQ-6 hydration/dirty/rising-edge, REQ-9 atomic triple without confirmation, descending-edge `{catalogPublished:false}` direct save, dirty/pending refetch suppression, PATCH-response acceptance, cancel keeps the dirty draft, tenant-id clear; no cases added or removed. REFACTOR — byte identity retained (zero edits). VERIFIER-FIX RED — new case `refetch deferred while pending cannot replace a PATCH accepted before endMutation` failed 1/14 (deferred 02-16 refetch overwrote the PATCH-accepted 02-18 after `endMutation()`). GREEN — watcher source changed to `settings` only (was `[settings, mutationPending]`, callback `([next])`→`(next)`); `mutationPending.value` stays as the hydration guard; 14/14 focused tests passed, `pnpm build` exit 0, oxlint 0/0, `git diff --check` clean.
- Verification: focused Vitest PASS (13/13); `pnpm build` exit 0; oxlint 2 files 0 warnings / 0 errors; `git diff --check` clean.
- Accounting (after verifier fix): 364 source/test (159 + 205) + 1 tasks.md checkbox + this 8-line section = 373 logical / 374 diff ≤ 380.
- Preserved: `stash@{0}` (`0a121804`), backup manifest/patch, and both historical untracked files verbatim; no commit/merge/push/dependency/backend change.

# Apply Progress — WU3B-D Editable Settings Form Composition

- Change: `online-catalog-backoffice`; WU: `wu3b-d-editable-settings-form-composition`; attempt token `sha256:440421b84d5b01120302f664e6591d7d7abd715ade48e5fafff9f050b4ce41f8` (acquire returned `proceed` after the untracked-inventory declaration was supplied as directed by the tooling); branch `feat/online-catalog-backoffice` at HEAD `0821cfd`, unchanged (no commit).
- Scope: NEW 2 files only — `components/CatalogSettingsForm.vue` (100) + `components/__tests__/CatalogSettingsForm.spec.ts` (99) = 199 lines, each byte-identical (`cmp`) to the verified backup `/tmp/wu3b-candidate-input-20260915-113735` (patch `98f2d224…e479`, manifest `45c08c6f…2260` re-verified 16/16); plus the tasks.md checkbox swap and this section. WU3B-E/F paths absent; no out-of-surface edits.
- RED: spec transplanted first from the verified snapshot with the source absent; focused command failed — `Failed to resolve import "../CatalogSettingsForm.vue"` (1 file failed, no tests ran).
- GREEN: source transplanted byte-identically; focused command passed — 1 file / 7 tests.
- TRIANGULATE (pinned in the transplanted spec, no cases added or removed): Save disabled while `saving: true`; Save gated by `canSave` (disabled without it, click emits `save` only when enabled); publication switch + stock select remain available while `canEditContexts: false` (REQ-6A availability pin); `canEditContexts` forwarded to the contexts field (locked Spanish gating copy shown); validation summary renders on errors; granular intent emission (`toggle-publish`, `add-context`, `remove-context`, `set-default`, `stock-change`, `save`) instead of prop mutation.
- REFACTOR: zero source edits needed — byte identity retained; oxlint on both files 0 warnings / 0 errors; `git diff --check` clean.
- Verification: focused Vitest PASS — `pnpm test:unit --run src/features/system/catalog-settings/components/__tests__/CatalogSettingsForm.spec.ts` — 1 file / 7 tests passed. Build: PASS — `pnpm build` (vue-tsc + vite) exit 0 (pre-existing chunk-size warning only). Runtime: N/A — runtime ships with WU3B-E/F.
- Accounting: 199 source/test + 1 tasks.md checkbox swap + this section (~15) ≈ 215 complete candidate lines ≤ 380.
- Preserved: `stash@{0}` (`0a121804`), backup patch/manifest hashes, and both historical untracked files verbatim; no commit/merge/push/dependency/backend change.
- Native settle: `state: complete` for objective `wu3b-d-editable-settings-form-composition` — outcome `passed`, evidence revision `sha256:79400527bb8f14847bbbfe4be8d2e793d244af3f249ad41f8705beda617c0f64`, untracked ruling `select` (both new files accounted); the first settle replay was rejected for reusing the acquire request-id and for an undeclared untracked ruling, then rerun per the tool's exact guidance. Next ordered work unit (WU3B-E) requires a fresh acquire with a different work-unit label; not launched here.

# Apply Progress — WU3B-E Editable View Composition + Read-Only Notice

- Change: `online-catalog-backoffice`; WU: `wu3b-e-editable-view-composition-notice`; attempt token `sha256:9d10bb37b6b04ceb307afcc14f33ec02c64b28fa40ddbdf52568b8c6fd7e80df` (untracked-scope=exclude, expected-untracked-inventory honored; prior launch timed out with zero mutation; branch `feat/online-catalog-backoffice` at HEAD `ced7be4`, no commit).
- Scope: MOD 4 files only — `views/TenantCatalogSettingsView.vue` (58→155), `views/__tests__/TenantCatalogSettingsView.spec.ts` (123→287), `components/CatalogSettingsReadView.vue` (141→155, byte-identical `cmp` to backup), `components/__tests__/CatalogSettingsReadView.spec.ts` (172→188, byte-identical) + tasks.md checkbox + this section.
- E-state derivation: view = preserved final content minus WU3B-F specifics (ConfirmModal import/block, toast declare/useToast, `onConfirm`, toast calls in `submit`, error mapper import); `onSave` = direct save (`void submit()` with beginMutation/acceptPatch/endMutation, no toasts); view spec = full preserved content minus the rising-edge describe (288 lines), plus removal of the then-unused `flushPromises` import (oxlint unused-binding; restored byte-exact by WU3B-F's full-content transplant).
- RED: E-state specs transplanted first against the WU3A sources — focused run 1 (full preserved specs): 2 files failed, 9 failed / 22 passed (notice case + 3 editable-gating + 5 rising-edge); run 2 (E-state specs): 3 failed / 23 passed — exactly the editable-gating describe against the HEAD view.
- GREEN: E-state view + byte-identical ReadView transplant; focused command PASS — 2 files / 26 tests.
- TRIANGULATE: pinned in the transplanted specs — editable form renders only with `update:TenantCatalogSettings`; `canEditContexts` data-attribute `false` without `read:GlobalPriceList` and `true` with both; locked Spanish notice `No tienes permisos para guardar cambios` on the read-only surface.
- REFACTOR: oxlint on all 4 files 0 warnings / 0 errors; `git diff --check` clean.
- Verification: focused Vitest PASS (exact task command: both view + read-view specs, 2 files / 26 tests). Build: PASS — `pnpm build` (vue-tsc + vite) exit 0 (pre-existing chunk-size warning only); standalone `npx vue-tsc --build` exit 0.
- Tooling note: the lens checker intermittently reported `Cannot find module '../TenantCatalogSettingsView.vue'` on this freshly written file — a stale false positive: the file exists on disk (6303 bytes), the relative path resolves, and vue-tsc / Vitest / oxlint all resolve it cleanly (authoritative evidence above). Decisive root-cause proof: plain `npx tsc --noEmit -p tsconfig.vitest.json` (the only resolver the lens TS check resembles; the project has no `*.vue` shim) reports TS2307 for EVERY `.vue` import in the committed, build-green codebase (e.g. `src/app/router/index.ts`, `DashboardLayout.test.ts`) — the same false-positive class; `.vue` module resolution in this repo is exclusively vue-tsc's job and vue-tsc passes.
- Accounting (measured, parent-verified): `git diff --numstat` complete candidate = 342 changed lines (324 added / 18 deleted) — routed view (119) + routed view spec (166) + read view (24) + read view spec (16) + tasks.md checkbox (2) + this progress section (15) ≤ 380.
- Native settle: `state: complete` for objective `wu3b-e-editable-view-composition-notice` — outcome `passed`, evidence revision `sha256:45ffec3c0dd05c97a8db1f65a3dd4df85a27f90315fa870c1be65ecca5241d1a` (sha256 over the complete-candidate tracked patch `git diff` at settle time), harness-disposition `reused`, no new untracked (both historical files declared excluded). Next ordered work unit (WU3B-F) requires a fresh acquire with a different work-unit label; not launched here.
- Preserved: `stash@{0}`, backup manifest/patch, both historical untracked files verbatim; WU3B-F content NOT landed (no ConfirmModal, no toasts); no commit/merge/push/dependency/backend/route/nav/storefront change; WU3A routed read-only remains for users without `update:TenantCatalogSettings`.

# Apply Progress — WU3B-F Rising-Edge Confirmation + Surgical Save Routing

- Change: `online-catalog-backoffice`; WU: `wu3b-f-rising-edge-confirmation-save-routing`; attempt token `sha256:c6e935579d1d5731db04ad3e986db4e05c342174ad4ef901c7c15adefd8f62bc` (acquire returned `proceed` with the tool-directed `--untracked-scope=exclude --expected-untracked-inventory` declaration; branch `feat/online-catalog-backoffice` at HEAD `8efe0aa`, no commit).
- Scope: MOD 2 files only — `views/TenantCatalogSettingsView.vue` (155→190) and `views/__tests__/TenantCatalogSettingsView.spec.ts` (287→372), both byte-identical (`cmp`) to the verified backup `/tmp/wu3b-candidate-input-20260915-113735` (patch `98f2d224…e479`, manifest `45c08c6f…2260` re-verified); plus tasks.md checkbox and this section. No other file touched.
- RED: WU3B-F view spec transplanted FIRST from the verified snapshot while the view was still WU3B-E state; exact focused command failed — 15 tests: 4 failed (`opens the confirm modal and sends NO PATCH before confirmation`, `confirms the publish: one whitelisted PATCH…`, `cancel closes the modal…`, `failure keeps the draft dirty…`) + 1 unhandled rejection (the failure-toast test's mocked 403 rejection) + 1 trivially passing descending-edge case (the E-state view has no confirmation modal at all, so direct save cannot be intercepted — not WU3B-F evidence).
- GREEN: candidate view transplanted byte-identically (ConfirmModal block, `onSave` → `form.requestSave()` confirm/save routing, `onConfirm` → `confirmPublish()` + `submit()`, `submit()` with `beginMutation`/`acceptPatch`/`endMutation`, success toast `Configuración de catálogo guardada`, error toast via `mapCatalogSettingsError`, `@cancel`/`@update:open` → `cancelPublish()`); exact focused command passed — 1 file / 15 tests (the 5 rising-edge tests included).
- TRIANGULATE: pinned in the transplanted spec, no cases added or removed — ascending-edge save opens the modal and sends NO PATCH before confirm; Confirm sends exactly one whitelisted PATCH `{tenantId, body}` and calls `confirmPublish`/`acceptPatch(response)`/success toast; Cancel calls `cancelPublish` with no PATCH and keeps the dirty draft; descending edge saves directly with `confirmationOpen` false; failure surfaces the mapped Spanish error toast (`No tienes permisos para guardar cambios` for 403) with `acceptPatch` NOT called and `endMutation` still run. Least-privilege contexts gating pinned by the unchanged E-state gating describe (`data-can-edit-contexts` false without `read:GlobalPriceList`).
- REFACTOR: zero source edits — byte identity retained; `npx oxlint` on both files 0 warnings / 0 errors; `git diff --check` clean.
- Verification: focused Vitest PASS — `pnpm test:unit --run src/features/system/catalog-settings/views/__tests__/TenantCatalogSettingsView.spec.ts` — 1 file / 15 tests passed. Build: PASS — `pnpm build` (vue-tsc + vite) exit 0 (pre-existing chunk-size warning only).
- Accounting (measured): `git diff --numstat` complete candidate = 39+4 (view) + 85 (spec) + 2 (tasks.md checkbox swap) + 13 (this progress section) = **143 changed lines** ≤ 380. No test/comment/blank-line deletion or restyle; both files moved only toward the preserved candidate.
- Preserved: `stash@{0}` (`0a121804f963e07b4038547b5b2e3c96cfbc2893`), backup patch/manifest hashes, and both historical untracked files verbatim; no commit/merge/push/stage/stash/clean/dependency/backend change; no WU4/WU5/WU6 or cross-slice work.
- Native settle: `state: complete` for objective `wu3b-f-rising-edge-confirmation-save-routing` — outcome `passed`, evidence revision `sha256:218037d98fa17de9af5e5e712a3f244c1d14e4e88ff9b93f8808ca0ad84cba16` (sha256 over the complete-candidate tracked patch `git diff` at settle time), harness-disposition `reused`, both historical untracked files declared `--untracked-scope=exclude` (no new untracked). With WU3B-F complete, all WU1–WU3B implementation tasks are checked; remaining tasks are WU4 → WU5 → WU6 and cross-slice verification. Next ordered work unit (WU4) requires a fresh acquire with a different work-unit label; not launched here.

## WU4 Product / Variant Typed Flat-Field Round-Trip
- Change: `online-catalog-backoffice`; WU: `wu4-product-variant-flat-field-round-trip`; attempt token `sha256:e5dfc6020c4f0745207744cc071c7004da432504797318e938665e37ee3e6cbd` (untracked-scope=exclude, both historical untracked declared; branch `feat/online-catalog-backoffice` at HEAD `3f3575b`, no commit).
- Scope: MOD 7 files only (product/variant types, api mappers, form composable + 4 co-located tests) + tasks.md checkbox + this section; no view / `src/features/catalog/**` / candidate-enumeration edits.
- RED (observed): specs first against the clean baseline; exact focused command failed — 2 files / 5 tests failed (advanced keys missing, custom `0` unpreserved, null allowlist accepted).
- GREEN (observed): types + mappers (`fromProductRawAdvancedCatalog`, `fromVariantRawCatalog`, `toProductPatchAdvancedCatalogPayload`, `toVariantPatchCatalogPayload`), Zod schema (null allowlist rejected in Spanish; `[]` valid), `toUpdatePayload` changed-only diff vs pristine (no pristine ⇒ zero advanced keys); focused PASS — 4 files / 41 tests.
- TRIANGULATE (observed): order-of-fields-independence (emitted set ⊆ whitelist), no-emit-when-unchanged, clear emits BOTH stock nulls, custom `0` literal, non-custom mode without quantity, variant create path free of catalog keys; budget compression merged two its (every pin retained); focused PASS — 4 files / 36 tests.
- REFACTOR (observed): shared `stockOverrideDiff` unit; payload builders pure; `UpdateProductPayload` extended with the advanced patch subset; oxlint 7 files 0/0; `git diff --check` clean.
- Verification: focused Vitest PASS (exact task command, 4 files / 36 tests); `pnpm build` exit 0 (vue-tsc + vite; pre-existing chunk-size warning only).
- Accounting: source+test 308 + tasks checkbox 2 + this section 9 = 319 complete-candidate changed lines (bound met). Preserved verbatim: `stash@{0}` (`0a121804`), `/tmp/wu3b-candidate-input-20260915-113735`, both historical untracked; no commit/stage/stash/push/clean/dependency/backend change; no view edits; WU5/WU6 and cross-slice NOT started.

## WU5 Forecast — STOPPED before writes (delivery decision needed)

- Change: `online-catalog-backoffice`; WU: `wu5-advanced-catalog-section`; `gentle-ai.sdd-status` v2 re-fetched read-only: `applyState: ready`, `nextRecommended: apply`, `actionContext.mode: repo-local`, allowedEditRoots = repo root; branch `feat/online-catalog-backoffice` at HEAD `9723d0c` — no attempt acquired, no runtime launch, NO source/test writes (no acquire → nothing to settle).
- Pre-write forecast per the parent's hard 380-cap rule: the coherent WU5 scope cannot land ≤ 380 without dropping normative coverage.
- Forecast (complete changed lines incl. bookkeeping): NEW `OnlineStockOverrideFields.vue` ≈ 80–89 + spec ≈ 45–50; NEW `ProductCatalogSettingsSection.vue` ≈ 70–80 + spec ≈ 55–62; MOD `ProductDetailView.vue` ≈ 70–85 (settings-read gate + settings query, catalog-only `isCatalogOnlySave` helper, toggle helper, submit/invalidation mods, template section); MOD `ProductDetailView.test.ts` ≈ 90–105 (controllable auth mock, UForm/UInput stub upgrades, `productApi.update`, 4 tests: no settings GET without read, GET+section with read, catalog-only PATCH body + detail-only invalidation, mixed save retains pre-existing invalidations); tasks.md checkbox 2; this section 16. Total ≈ **422–475** vs hard cap 380.
- Named normative pins that cannot be cut (tasks.md WU5 + spec REQ-14/15): update:Product section/PATCH gate; settings-read additionally gating only the selector + settings query (never the PATCH); locked Spanish note; response-only supportsAll indicator; clear emits BOTH stock nulls; custom `0` preserved; catalog-only ⇒ only `productQueryKeys.detail` invalidated with mixed saves retaining pre-existing invalidations; PATCH body never carries settings-only fields; compact slideover untouched; `OnlineStockOverrideFields.vue` shipped for WU6 reuse.
- Decision needed (user, `ask-on-risk`): (a) one-time WU5 `size:exception` (≈475 complete lines), or (b) maintainer-approved split mirroring `split_wu3b` — WU5-A shared override field + spec, WU5-B section + spec, WU5-C view wiring + tests, each ≤ 380 with sequential focused gating. WU6 reuse is unaffected by either path (the shared field lands first).
- Preserved verbatim: `stash@{0}` (`0a121804`), `/tmp/wu3b-candidate-input-20260915-113735`, both historical untracked files. No commit/stage/stash/push/clean/dependency/backend change; WU6 and cross-slice NOT started.
- **RESOLVED (user decision `wu5_size_exception`)**: the user explicitly chose option (a) — one-time `size:exception` for WU5 only, one cohesive unit at ≈475 complete changed lines (bookkeeping incl. the 9 forecast lines above); `exception-ok` for WU5 alone, NO split; WU6/cross-slice remain out of scope. Implementation continues below in this section.

## WU5 Implementation — verified green, candidate ABOVE the accepted 475 bound (no completion claim)

- Attempt: token `sha256:7068e0d0269c2682ae5ad7b90fffb33148010035f189c3acaf7c45343a1d7d98` (acquire `proceed`, max-attempts 2, max-changed-lines 475, untracked-scope=exclude).
- RED (observed): specs written first against the clean baseline; exact focused command failed — 3 files failed, no tests ran (module resolution: both NEW sources absent).
- GREEN (observed): `OnlineStockOverrideFields.vue` (91) + `ProductCatalogSettingsSection.vue` (110) + `ProductDetailView.vue` wiring; focused PASS 3 files / 21 tests. Harness discoveries: the committed `global.stubs` config in `ProductDetailView.test.ts` is dead (stubs never applied — real Nuxt UI components render; proven via `data-slot` markup), so view tests exercise REAL UForm/UInput (real Zod-validated submit) and the WU5 mocks are module-boundary only; `toUpdatePayload` needs the real `toProductPatchAdvancedCatalogPayload` via a partial `importOriginal` mock.
- TRIANGULATE (observed): supportsAll read-only indicator; selector disabled + locked Spanish note with hide-price/stock editable; contexts toggle emission; disabled-prop propagation; custom `0` ("Mostrar 0") preserved end-to-end; REQ-14 negative view pin (no section without `update:Product`); mixed save retains the pre-existing 4-key invalidation set. Focused PASS 23/23.
- REFACTOR (observed): removed indentation churn introduced during edits (top-level script restored to column 0, onSuccess body back to 8-space); removed pre-existing unused `serviceDetailPopulated` import and typed the two legacy `as any` reads (`!!product.value?.useStock` / `useLotsAndExpirations`); fixed the section's stock-change emit type to the real `{mode, customQuantity}` shape (was a mismatched `Pick`). No comments/tests/blank lines deleted; no existing tests edited to pass (the 4 pre-existing view tests pass unchanged).
- Verification (all exits observed): focused `pnpm test:unit --run <3 WU5 files>` PASS 23/23; `pnpm build` (vue-tsc + vite) exit 0; `pnpm exec oxlint` on the 6 WU5 files 0 warnings / 0 errors; `git diff --check` clean.
- Runtime evidence: mounted-view runtime coverage via the view spec (real Nuxt UI mount through `mountWithUApp`, module-boundary mocks): settings GET gated by `read:TenantCatalogSettings` (no request without it), advanced section present only with `update:Product`, catalog-only save PATCH body carries only `hidePriceInOnlineCatalog:true` (never `supportsAllCatalogPriceLists`/unchanged advanced keys) with invalidation of exactly `productQueryKeys.detail`, mixed save retains the pre-existing set. No real dev-tenant browser/manual run was performed (verify phase owns browser evidence) — disclosed per the work-unit discipline.
- MEASURED complete candidate (estimation vs measurement): source+test NEW 348 (91+55+110+92) + tracked adds+dels 278 (view 119, view test 153, tasks.md 6, apply-progress 10) = **636 lines**, plus the final bookkeeping section below ⇒ ≈651 complete changed lines — ABOVE the user-accepted `wu5_size_exception` bound of 475 (the ≈475 was my forecast estimate; the measured diff is ~175 larger; no tests/comments/blank lines were removed to chase it and no cosmetic compression applied).
- Per the user's explicit rule ("if genuinely requires more, report rather than silently expanding the accepted forecast") and the checkbox contract ("Persist task checkbox ONLY when all behavior/checks and exception bound met"): the WU5 checkbox in `tasks.md` is NOT marked, and this section does NOT claim WU5 completion. The candidate is preserved in the worktree at HEAD `9723d0c` + these changes; the native attempt is settled truthfully as `failed` (bound exceeded) with this accounting.
- Rollback boundary: `git restore` the 2 MOD source/test files + 2 MOD openspec files and remove the 4 NEW files; `stash@{0}` (`0a121804`), `/tmp/wu3b-candidate-input-20260915-113735`, and both historical untracked files preserved verbatim. No commit/stage/stash/push/clean/dependency/backend change; WU6 and cross-slice untouched.

## WU5 Revalidation — `wu5_700_and_audited_attempt_reset` (fresh GREEN pass)

- Authorization: the user explicitly authorized the WU5-only `size:exception` at ≤ 700 complete changed lines with no additional functionality and a maintainer-run audited attempt reset; the maintainer executed `sdd-attempt reset` (expected revision `sha256:c72bcc5b6eeaf6bcde641ee517677a9c5386ac3be9d3a715add8a103a746bd24`, actor `maintainer-user`); reset succeeded — last_reset revision `sha256:c893b5326a95239ee1047b293f83fb336fb927fddfa0844cb947e8b7d121cdf6`, `decision_required: false`, `next_action: begin`, `cumulative_attempts: 0`, history retained. No reset was performed by this agent.
- Arithmetic correction (WU5-only bookkeeping): the earlier WU5 sections above claimed "348 + 278 = 636 ⇒ ≈651" — that arithmetic and the 651 figure are INCORRECT. The actual complete candidate before this follow-up is EXACTLY **649 changed lines** = tracked 301 (apply-progress 23, tasks.md 6, `ProductDetailView.vue` 119, `ProductDetailView.test.ts` 153) + the four NEW files 348 (`OnlineStockOverrideFields.vue` 91, its spec 55, `ProductCatalogSettingsSection.vue` 110, its spec 92). No source or test content changed in this follow-up; the corrected number is bookkeeping-only.
- Native history (retained): the prior attempt settled truthfully `failed` by budget only (ordinal 26, provider-tracked changed_lines 633, evidence revision `sha256:dd3cf10d654d09776688adbfc3eb3220edb93d9d6f83000ec09f2df677b71223`); this revalidation supersedes that outcome only via the observed fresh pass below.
- Revalidation acquire: `state: proceed`, token `sha256:2b685b799c35d6a041c412cc6363614f3aa445112ecfafbd7f7f7cc95d11d4c2`, work-unit `wu5-advanced-catalog-section-revalidation`, max-attempts 2, max-changed-lines 700, untracked ruling `select` for exactly the four NEW WU5 files (the two historical untracked files remain excluded/preserved); settle bound by the tool to name the prior failed evidence as remediated.
- This is a REVALIDATION of the existing GREEN candidate — no new RED was fabricated and the source/tests are unchanged; the fresh check battery below is the verification evidence.
- Fresh check battery (revalidation, all exits observed on the unchanged candidate): focused `pnpm test:unit --run src/features/POS/products/views/__tests__/ProductDetailView.test.ts src/features/POS/products/components/__tests__/ProductCatalogSettingsSection.spec.ts src/features/POS/products/components/__tests__/OnlineStockOverrideFields.spec.ts` — PASS 3 files / 23 tests (exit 0); `pnpm build` (vue-tsc + vite) — exit 0 (pre-existing chunk-size warning only); `pnpm exec oxlint` on the six WU5 files — 0 warnings / 0 errors; `git diff --check` — clean.
- Cap check: measured complete candidate ≤ 700 (see exact count below) — met; the WU5 checkbox in `tasks.md` is now marked `[x]` (WU6 and Cross-Slice remain unchecked). Runtime evidence remains the mounted-view test coverage described in the previous section (module-boundary mocks; NO browser/manual run was performed — the mounted test runtime is the actual evidence).
- FINAL exact complete changed-line count (measured after this follow-up's bookkeeping, verified via `git diff --numstat` + `wc -l`): recorded immediately below in the accounting line.
- Accounting (exact, measured via `git diff --numstat` + `wc -l` at finalization): tracked `apply-progress.md` 35, `tasks.md` 10 (adds 5 / dels 5), `ProductDetailView.vue` 119 (107/12), `ProductDetailView.test.ts` 153 (143/10) = 317 tracked; four NEW files 348 (91 + 55 + 110 + 92) = **665 complete changed lines** — inside the user-authorized ≤ 700 WU5 bound. No additional functionality; source/tests unchanged from the verified GREEN candidate.

## WU5 Correction — `wu5_correct_up_to750` (verifier-FAIL contract defect)

- Authorization: after the independent verifier FAILED the settled 665-line candidate on a candidate-caused contract defect (all 23 tests/build/oxlint/diff-check had passed), the user authorized the WU5-only complete cap 750 (`wu5_correct_up_to750`) with no coverage cuts and no added functionality. Corrected WU5 bookkeeping only; no other work unit or historical evidence rewritten.
- Confirmed defect: `ProductDetailView.vue` destructured only `settings` from the settings query (dropping `isLoading`/`isError`) and defaulted missing data to `[]`; the section rendered context controls only via `v-for`, so with `canReadSettings=false` no selector control rendered at all (REQ-15 requires rendered-but-disabled + locked note), and pending/failed/unavailable states were visually conflated with accepted-empty (design: query state affects only the selector).
- RED (observed): 8 new failing pins written first (standalone: gated-without-accepted-contexts, table-driven pending/failed, accepted-empty copy, stale-context guard; view: extended missing-read test, authorized pending, authorized failed) — exact focused command: 2 files failed / 8 tests failed against the unchanged source; the 22 pre-existing tests still passed.
- GREEN (observed): section takes `settingsLoading`/`settingsError`, returns no rows while pending/failed (no silently editable stale contexts), renders a visibly disabled placeholder selector whenever no row controls exist (no synthesized options/backend defaults), and chains four distinct notes (locked note; `Cargando contextos públicos del tenant…`; `No se pudieron cargar los contextos públicos del tenant`; accepted-empty `El tenant no tiene contextos públicos configurados` — the tenant-configured-contexts fact, NOT a supports-all claim). View destructures and forwards the query state. Focused: 3 files / 30 tests passed.
- TRIANGULATE (observed): added the integrated accepted-empty view case; exposed and fixed an inter-test leak (pending test used a permanent `mockImplementation`; now `mockImplementationOnce`) that conflated accepted-empty with pending in the full-file run. Final focused: **31/31 passed**.
- REFACTOR (observed): comments rewritten to rationale-first form (the original gate-comment content retained verbatim, requirement-ID prefix dropped per the current instruction); no comments/tests/blank lines deleted; no source outside the two WU5 files and their specs; `OnlineStockOverrideFields.vue` and its spec untouched.
- Fresh check battery (all exits observed): focused 3 files / 31 tests exit 0; `pnpm build` exit 0 (pre-existing chunk-size warning only); six-file oxlint 0 warnings / 0 errors; `git diff --check` clean. Mounted-view test runtime remains the actual runtime evidence (module-boundary mocks; NO browser/manual run performed).
- The supports-all indicator remains the separate response-only element (server `supportsAllCatalogPriceLists`); accepted-empty states the configured-contexts fact.

## WU5 Finalize — `wu5_finalize_max800` (bookkeeping-only margin)

- Independent verifier PASS on the corrected candidate: original defect fixed, no new behavioral blockers, exact 782 complete lines, 31/31 focused / build 0 / oxlint 0/0 / diff-check clean, preservation hashes unchanged. The user authorized the WU5 total cap 800 (`wu5_finalize_max800`) with bookkeeping-only margin and NO further source/test modifications; source hashes verified identical before and after (6 files, below), shared stock field unchanged, no functionality change. Cap references updated to 800 (history 380 → 475 → 700 → 750 → 800); the prior truthful `failed` (782 > 750, ordinal 28) history is retained above.
- Native note: the ordinary continuation acquire with max-changed-lines 800 was REFUSED by the runtime (`state: blocked`, `reason: maintainer_decision` — the objective changed without an explicit maintainer rescope/supersede; sanctioned resolution recorded in the phase return). No reset performed; docs finalized; the maintainer-run supersede + settle remain for the parent.
- Fresh revalidation on the untouched candidate: focused 3 files / 31 tests exit 0; `pnpm build` exit 0; six-file oxlint 0 warnings / 0 errors; `git diff --check` clean. Mounted-view test runtime remains the actual runtime evidence (no browser/manual run).
- Final exact complete count (measured at finalization, `git diff --numstat` + `wc -l`): recorded in the phase return; source/test hashes after are byte-identical to before (equality proof below).

# Apply Progress — WU6 Persisted-Variant Catalog Controls

- Change: `online-catalog-backoffice`; WU: `wu6-persisted-variant-catalog-controls` (continued active attempt token `sha256:67f1fe9ccfdf18e6b119fa74dc89d8511bacb067c304077cccadbeee68cb09dd`, acquire state `proceed`, work-unit `WU6`, evidence goal `wu6-persisted-variant-catalog-controls`, max-changed-lines 360; branch `feat/online-catalog-backoffice` at HEAD `71ee256`, no commit). Native status consumed from the parent's authoritative v2 read: `applyState: ready`, `nextRecommended: apply`, `blockedReasons[]`, `actionContext {mode: repo-local, allowedEditRoots: [repo root]}`; no readiness was reconstructed locally.
- Scope: MOD `VariantDetailModal.vue` (80+/6−) + NEW `__tests__/VariantDetailModal.catalog.spec.ts` (205) + tasks.md checkbox (1+/1−) + this section. Reused `OnlineStockOverrideFields.vue` from WU5 unchanged (no copy) and the WU4 `fromVariantRawCatalog` / `toVariantPatchCatalogPayload` mappers unchanged. Create / inline builders, `product.types.ts`, API/mappers, dependencies, and all unrelated files untouched.
- RED (observed): spec written first; exact focused command failed 9/10 (1 absence guard trivially passed) — catalog select/options/stock-override absent from the modal (`Cannot call setValue on an empty DOMWrapper`), no PATCH with catalog keys, and missing variants-key invalidation.
- GREEN (observed): persisted-variant-only "Catálogo online" card — native select `INHERIT`/"Heredar", `ON`/"Publicado", `OFF`/"Oculto" plus the shared stock-override field, keyed off `variant.catalogPublishMode != null` (persisted variants always carry WU4-mapped catalog fields; inline/new objects do not); `persistChanges` gained `includeCatalog` (Save/Guardar flow only) merging `toVariantPatchCatalogPayload({form}, {pristine})` before the empty-diff early return; mutationFn widened to `UpdateVariantPayload & VariantPatchCatalogPayload` at the call site (no type/API change); success re-pristine's the catalog snapshot. Invalidation code untouched — the pre-existing `productQueryKeys.variants(tenantId, productId)` invalidation is the only one. Focused command: 10/10 passed.
- TRIANGULATE: table-driven pins — mode `ON`/`OFF` each PATCH exactly `{catalogPublishMode}` (no stock keys); stock pair round-trip `{onlineStockPresentation:'CUSTOM_QUANTITY', onlineStockPresentationCustomQty:5}`; custom `0` preserved with "Mostrar 0"; clearing existing stock emits BOTH `{onlineStockPresentation:null, onlineStockPresentationCustomQty:null}` (keys not omitted); unchanged-controls save PATCHes only `{sku}` (no catalog keys) for both persisted and non-persisted variants (modal-path only; actual create/inline builders verified statically — see the correction subsection); invalidation exactly once with `productQueryKeys.variants('tenant-1','p1')`.
- REFACTOR: removed the indentation churn the edits had introduced in the modal (fallback object, diff merge, template block); oxlint on both files 0 warnings / 0 errors; `git diff --check` clean; `pnpm build` exit 0.
- Verification (exact exits observed): focused `pnpm test:unit --run src/features/POS/products/components/__tests__/VariantDetailModal.catalog.spec.ts` — 1 file / 10 tests passed; `pnpm build` (vue-tsc + vite) exit 0 (pre-existing chunk-size warning only); `pnpm exec oxlint` on the two WU6 files — 0 warnings / 0 errors; `git diff --check` — clean.
- Runtime harness evidence: the mounted-modal spec is the actual runtime evidence — real Nuxt UI mount via `mountWithUApp` (only `productApi.updateVariant` mocked at module boundary with the real WU4 mappers preserved via `importOriginal`; auth store mocked for the tenant id; real `QueryClient`+`VueQueryPlugin` with a spied `invalidateQueries`). Harness discovery: real UModal teleports its body to a document.body portal and `global.stubs` do not apply through `mountWithUApp` (same WU5 finding), so queries go through `document` + `DOMWrapper`; `afterEach` clears the attached body (the helper's `findComponent` wrapper is not unmountable — "can only be called by the root wrapper"). No dev-tenant browser run was performed (verify phase owns browser evidence). Limits respected: no full-suite run, no cross-slice verification, no archive.
- Accounting (measured, superseded by the correction below): 86 (modal 80+/6−) + 205 (NEW spec) + 2 (tasks.md checkbox 1+/1−) + 15 (this section, `git diff --numstat`) = 308 complete changed lines before the verifier correction. No test/comment/blank-line deletion or restyle; no minification/coverage tricks.
- Rollback boundary: `git restore src/features/POS/products/components/VariantDetailModal.vue` + remove the NEW spec + revert the tasks.md checkbox and this section; `OnlineStockOverrideFields.vue`, WU5/WU4 surfaces, and every other module are untouched by this unit.
- Preserved verbatim: `stash@{0}` (`0a121804f963e07b4038547b5b2e3c96cfbc2893`), `/tmp/wu3b-candidate-input-20260915-113735` (never touched), and both historical untracked files (`openspec/changes/online-catalog-publishing/.gentle-ai-instance`, `openspec/changes/public-catalog-branch-discovery/verify-report.md`). No commit/stage/stash/merge/push/clean; no dependency/backend change; no ODD duplicate files.
- Remaining tasks: only Cross-Slice Verification & Isolation (unchecked; explicitly out of this session's scope). Review/verify/archive remain pending — this section leaves them honestly open; the parent owns settlement after independent verification, with the evidence digest above.
## WU6 Correction — `wu6-persisted-variant-catalog-controls` (verifier blocker, second bounded attempt)
- Verifier FAIL (evidence `sha256:e3a6c0460d9575158553e472c0b9b99a6d54e07d5a1052c32c03f1c5949df579`): every successful persistence re-pristined the catalog snapshot, so blur autosaves (`includeCatalog=false`) swallowed unsent catalog drafts. Reacquire continued token `sha256:cf08b59b20f248e69d9d58474efaa8356e2d440667fc7b4a5c3c40b5ebd1d576` (state `proceed`, cap 360).
- RED (observed): new real-mounted cost-autosave regression first — exact focused command failed 2/13 against the unchanged source; the `resolved` case is the blocker pin (old code re-pristined on success ⇒ explicit Save sent nothing); the `rejected` case (corrected to the honest full-body expectation) pins error-path draft retention. Autosave-only pristine swallow is fixed by gating re-pristining on `includeCatalogKeys` (explicit-Save PATCH on a persisted variant only); no draft reset on resolved/rejected autosaves.
- Table-driven INHERIT round-trip added: ON→INHERIT, OFF→INHERIT, INHERIT→ON, each PATCH exactly `{catalogPublishMode}`; 13/13 focused passed.
- Corrected claims: non-persisted spec cases exercise THIS modal's editing path only; actual create/inline payload builders are untouched and verified statically (ProductDetailView.vue 781-791 inline create, 1648-1676 new-variant builder, 3044-3055 persisted-modal caller — no catalog keys); runtime builder coverage cannot be added without disallowed surfaces, none claimed.
- Fixed the new-code indentation churn in the modal diff; corrected test names/docs that claimed fabricated builder coverage; no broad churn or minification.
- Re-check battery (all exits observed): focused 13/13 exit 0; `pnpm build` exit 0; two-file oxlint 0 warnings / 0 errors; `git diff --check` clean.
- Corrected total (measured): 97 (modal 88+/9−) + 235 (spec) + 2 (tasks.md 1+/1−) + 24 (progress: 15 original + 9 correction) = **358 complete changed lines ≤ 360**; task checkbox restored `[x]` only after all authorized checks passed.
- Preserved verbatim: `stash@{0}` (`0a121804`), `/tmp/wu3b-candidate-input-20260915-113735`, both historical untracked; no commit/stage/stash/merge/push/clean; no dependency/backend change; parent owns settlement/re-verification/review.
