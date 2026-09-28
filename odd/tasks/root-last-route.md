# Root-only remembered landing

## Authorization

Owner explicitly authorizes implementation after analysis: remember last stable section per user and tenant and restore it ONLY when visiting /. If unusable, use current permission-aware default; unauthenticated users go to login, missing tenant follows existing selection, no access ends at stable403. No OTP/login/deep-link behavior redesign, no superadmin membership redesign, backend contact or PDF edits.

Base feat/seller-sales-report HEAD9e23901484c9fdf254cb9ccf5c8c0040fa4abb65. Preserve existing uncommitted seller-report UI polish (five source paths including components.d.ts plus tracker), two OpenSpecs and generated declarations. Same worktree; no commits, push, installs, runtime/server/database or external requests authorized for this task.

## Work units

- [ ] R1: Implement root resolver/persistence and error-home navigation with regression tests. In progress; delegate multi-file writer after readonly map.
- [ ] R2: Verify focused tests, types, quality and native review for this unit. Pending.
- [ ] R3: Report outcome and browser acceptance needed. Pending.

One coherent behavior with tests. Forecast300–450 authored lines advisory, not a hard ceiling; do not remove coverage/minify. Parent owns tracker. Exact review scope must exclude pre-existing UI-polish changes rather than treating them as this work.

## Design

Add explicit named root route resolved in global guard after auth hydration, user, tenant and permissions readiness. Root redirects use replace, unauthenticated root must not add redirect-to-root. Existing navigation.landing/access helpers remain authoritative; remembered route must resolve to an explicitly opted-in stable route and pass route metadata/CASL. Do not authorize from menu visibility. Existing permission fallback may end at403 without looping.

Opt-in rememberAsLanding route metadata on stable module pages only. After successful authorized navigation persist canonical path without query/hash. No root/auth/public/error/tenantselection/create/detail/dynamic/transient destinations. Versioned localStorage record keyed by encoded userID+tenantID; absent scope skips memory. Reject noncanonical/external/malformed/denied values, best-effort remove, catch storage getter/get/set/remove errors. Do not delete a different tenant's record merely when switching scope. Remembered destination never overrides direct route navigation.

Error pages Home change push('/') to replace('/') only. No new global superadmin flow; current guards continue to enforce tenant rules.

## Scope

Modify src/app/router/index.ts; src/app/navigation/navigation.landing.ts and its __tests__/navigation.landing.spec.ts; src/app/router/__tests__/router.spec.ts; src/features/errors/views/ForbiddenView.vue and NotFoundView.vue.
Create src/app/navigation/navigation.memory.ts and its __tests__/navigation.memory.spec.ts; src/features/errors/views/__tests__/ErrorHomeNavigation.spec.ts; vitest.navigation.isolated.config.ts.
Potential existing root404 assertion in src/app/router/__tests__/router.analytics.spec.ts must be inspected and updated only if confirmed directly; this exact test path is included in scope to keep regression coherent.

## Checks and output limits

Test-first observed behavioral RED then GREEN, alternate auth/tenant/access/storage cases, source refactor. Root-specific tests must prove readiness, remembered precedence/fallback, noaccess403 and deep links unchanged. Persist only successful stable routes and isolate users/tenants; invalid or throwing storage cannot break navigation. ErrorHome tests verify replace notpush.

Use local node_modules/.bin/vitest run --config vitest.navigation.isolated.config.ts --no-file-parallelism. Config standalone Vue/NuxtUI dts:false,envDir:false,test.cache:false, mocked HTTP/auth and exact test includes. Permitted future outputs ONLY node_modules/.nuxt-ui/ and node_modules/.vite-temp/ (not root .vite-temp). Do not use proposed .vite-temp/navigation cacheDir or tsBuildInfoFile. Use noEmit --incremental false type checks app/vitest/node. No .env reads, declarations/results cache/other output expansion; stop for any unavoidable output scope. No default Vite config import. Existing seller-report runner/config unchanged.

Scoped lint/format, diffcheck and hashes of all preserved changes before/after. Native review cannot silently include old UI-polish unit. Browser reopening root/history behavior remains unverified until actually exercised. Current next step: bounded writer.
