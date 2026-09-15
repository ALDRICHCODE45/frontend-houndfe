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
