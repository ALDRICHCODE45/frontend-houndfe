```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:f35997ba18425348132a374480c673b66224e584b7978040db39f4c883d13750
verdict: fail
blockers: 1
critical_findings: 1
requirements: 7/7
scenarios: 13/15
test_command: pnpm test:unit --run
test_exit_code: 0
test_output_hash: sha256:233844f02aaab02d9afde423542ea59aa299ce155db059be4bea2328811235d9
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:d6bf490b97b2c7bed88d2ce70976bc050986f90a91f021909b305cf5afdcac38
```

## Verification Report

**Change**: standardize-admin-tenants-table
**Version**: N/A (new capability `admin-tenants-list`)
**Mode**: Strict TDD
**Branch**: feat/standardize-admin-tenants-table (HEAD `ede6318`)
**Date**: 2026-08-12

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total (implementation) | 21 |
| Tasks complete (marked `[x]`) | 0 |
| Tasks unchecked | 21 (+ 4 Definition-of-Done items unchecked) |
| Work units | 3/3 committed (WU-A `b045100`, WU-B `e8241ac`, WU-C `ede6318`) |

> **CRITICAL**: the implementation is complete and every runtime gate passes, but the `tasks.md` artifact has all 21 implementation tasks and all 4 Definition-of-Done items still `- [ ]`. Apply completed the work without recording task completion. This blocks archive (Apply State `all_done` requires every task checked `[x]`).

### Build & Tests Execution

**Build**: ✅ Passed (`pnpm build` = `vue-tsc --build` + `vite build`, exit 0; only the pre-existing chunk-size advisory warning).

**Tests (scoped)**: ✅ 238 passed / 0 failed
```text
pnpm test:unit --run src/features/admin/tenants
Test Files  17 passed (17)
     Tests  238 passed (238)
exit 0
```

**Tests (full)**: ✅ 3938 passed / 0 failed
```text
pnpm test:unit --run
Test Files  260 passed (260)
     Tests  3938 passed (3938)
exit 0
```

**Coverage**: ➖ Not available — no `coverage` provider configured in `vitest.config.ts`.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-1 error propagation | failed request | `AdminTenantsView.test.ts` > "renders the error block…" | ✅ COMPLIANT |
| REQ-1 | retry | `AdminTenantsView.test.ts` > "triggers refresh when the retry button is clicked" | ✅ COMPLIANT |
| REQ-1 | precedence | `AdminTenantsView.test.ts` > "prefers response.data.message…" / "falls back to error.message…" / "falls back to the Spanish message…" | ✅ COMPLIANT |
| REQ-2 view mode | toggle switches and persists | `AdminTenantsView.test.ts` > display-mode default/cards + `useTenantViewMode.test.ts` persist/toggle/read | ✅ COMPLIANT |
| REQ-2 | invalid stored value | `AdminTenantsView.test.ts` > "falls back to display-mode=table…" + `useTenantViewMode.test.ts` | ✅ COMPLIANT |
| REQ-3 card rendering | card click opens edit slideover | `AdminTenantsView.test.ts` > "card click opens the edit slideover…" | ✅ COMPLIANT |
| REQ-3 | ladder and no kebab | (none) — TenantCardGrid ladder + TenantCard no-kebab source-verified only | ❌ UNTESTED |
| REQ-3 | loading / empty | (none) — skeleton + `i-lucide-building` source-verified only | ❌ UNTESTED |
| REQ-4 kebab gate | non-super-admin | `AdminTenantsView.test.ts` > "hides the kebab…" | ✅ COMPLIANT |
| REQ-4 | super-admin | `AdminTenantsView.test.ts` > "shows the kebab…" + "flattens kebab items…" | ✅ COMPLIANT |
| REQ-5 column flags | flags locked | `useTenantColumns.test.ts` (order, headers, sortable/hideable flags, actions meta) | ✅ COMPLIANT |
| REQ-6 visibility + #filters | dropdown lists all data columns | `useTenantColumns.test.ts` per-column `enableHiding` + `AdminTenantsView.test.ts` > "wires enable-column-visibility" | ✅ COMPLIANT |
| REQ-6 | filter visible in both modes | `AdminTenantsView.test.ts` > includeInactive checkbox in table + card mode | ✅ COMPLIANT |
| REQ-7 header + invariants | header swap | `AdminTenantsView.test.ts` > "renders AdminPageHeader with the standardized title" | ✅ COMPLIANT |
| REQ-7 | invariants hold | isSuperAdmin gate (runtime) + `git diff main...HEAD` proves `tenants.api.ts`/`tenant-actions.utils.ts` absent + `defaultPinning.right:['actions']`/`persistKey` unchanged | ✅ COMPLIANT |

**Compliance summary**: 13/15 scenarios runtime-compliant; 2 scenarios (REQ-3 card-rendering internals) source-verified only.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| REQ-1 error propagation | ✅ Implemented | `tenantsErrorMessage` computed prefers `response.data.message` (string or array[0]) → `error.message` → Spanish fallback; `:error` + `:error-message` bound. |
| REQ-2 view mode | ✅ Implemented | `useTenantViewMode` wraps `useViewMode` (key `admin-tenants-view-mode`, `['table','card']`, default `table`); `displayMode` bridges `card`→`cards`; `ViewToggle` in `#actions`. |
| REQ-3 card rendering | ✅ Implemented | `TenantCard` article + `EntityAvatar` + name/slug + `StatusDotBadge` Activa/Inactiva + dashed divider + 2-col Dirección(??'—')/Creación(es-AR); click-only emit. `TenantCardGrid` ladder 1/2/3/5/7 + 8 skeletons + `i-lucide-building`. Card click → `handleCardClick` → `openEdit` (no `router.push`). |
| REQ-4 kebab gate | ✅ Implemented | `v-if="canManageTenantActions"` where `canManageTenantActions = authStore.isSuperAdmin` (CASL not used); `buildTenantRowActions` unchanged (Editar / Gestionar miembros / Desactivar). |
| REQ-5 column flags | ✅ Implemented | explicit `enableSorting`/`enableHiding` on every column; name/slug/createdAt sortable; address/phone/isActive non-sortable; actions non-sortable/non-hideable/text-right. |
| REQ-6 visibility + #filters | ✅ Implemented | `enable-column-visibility`; all 6 data columns hideable, actions non-hideable; `includeInactive` UCheckbox in `#filters` slot, drives `adminTenantQueryKeys.list({ includeInactive })`. |
| REQ-7 header + invariants | ✅ Implemented | `AdminPageHeader` title "Gestión de sucursales"; `defaultPinning.right:['actions']`, `persistKey:'admin-tenants'`, full-catalog local semantics preserved; `tenants.api.ts` and `tenant-actions.utils.ts` untouched (absent from `git diff --name-only main...HEAD`). |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Add `phone` column (accessorKey, header `Teléfono`, non-sortable, hideable) | ✅ Yes | `useTenantColumns.ts` position 4. |
| Proposal column order `name, slug, address, phone, isActive, createdAt, actions` | ✅ Yes | Locked by `useTenantColumns.test.ts`. |
| TenantCard `{ tenant }` + single `click` emit, no kebab/checkbox | ✅ Yes | `TenantCard.vue`. |
| Card chip `StatusDotBadge` + `activityToBadgeTone` + Activa/Inactiva | ✅ Yes | `TenantCard.vue`. |
| View mode mirror `useRoleViewMode` | ✅ Yes | `useTenantViewMode.ts`. |
| Error precedence backend → message → fallback | ✅ Yes | `tenantsErrorMessage`. |
| Header description static | ✅ Yes | `headerDescription`. |
| Strip `AdminTenantsView.spec.ts` mount section | ✅ Yes | Stripped to pure unit tests (mapTenantError, query keys, confirm copy). |
| WU-B ships without tests | ✅ Yes | No TenantCard/TenantCardGrid tests (documented). |

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | apply-progress has "TDD Cycle Evidence" table |
| RED confirmed (test files exist) | ✅ | 3/3 test files present (`useTenantViewMode.test.ts`, `useTenantColumns.test.ts`, `AdminTenantsView.test.ts`) |
| GREEN confirmed (tests pass) | ✅ | 238/238 scoped + 3938/3938 full, exit 0 |
| Triangulation adequate | ✅ | view mode 8 cases, columns 9 cases, view tests cover all 6 design cases |
| Safety Net for modified files | ✅ | baseline 14 files/202 tests; spec.ts mount section intentionally stripped per design |

**TDD Compliance**: 5/5 checks passed.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (pure) | 17 | `useTenantColumns.test.ts` (9), `useTenantViewMode.test.ts` (8) | vitest |
| Unit (mount) | 20 | `AdminTenantsView.test.ts` | vitest + @vue/test-utils (real Nuxt UI renders — `@nuxt/ui` mock bypassed by auto-imports) |
| Unit (preserved) | 11 | `AdminTenantsView.spec.ts` | vitest |

### Changed File Coverage

Coverage analysis skipped — no coverage provider configured in `vitest.config.ts`.

### Assertion Quality

| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| `AdminTenantsView.test.ts` | 375/383 | `wrapper.html()` contains/not-contains `reka-dropdown-menu-trigger` | Implementation-detail coupling to Reka UI internal id | WARNING |
| `AdminTenantsView.test.ts` | 196–221 | `vi.mock('@nuxt/ui', …)` block | Dead mock — bypassed by Nuxt UI auto-imports (real components render) | SUGGESTION |
| `AdminTenantsView.spec.ts` | 86–103 | "Confirm modal copy" asserts local string constants | Asserts local constants, not production code (pre-existing, preserved by design) | SUGGESTION |

**Assertion quality**: 0 CRITICAL, 1 WARNING, 2 SUGGESTION. No tautologies, no orphan empty assertions, no ghost loops; type-only `toBeDefined()` checks are always combined with value assertions.

### Quality Metrics

**Linter**: ➖ Not run (not part of the verify contract; `pnpm lint` exists).
**Type Checker**: ✅ No errors (`vue-tsc --build` passed as part of `pnpm build`).

### Issues Found

**CRITICAL**:
1. `tasks.md` has all 21 implementation tasks and all 4 Definition-of-Done items unchecked. Apply completed the implementation (3 ordered conventional commits, all files present, 238/238 scoped + 3938/3938 full tests green, `pnpm build` clean) but never marked task completion in the task artifact. This blocks archive — Apply State `all_done` requires every implementation task checked `[x]`. Fix is mechanical (check off the boxes; no code change).

**WARNING**:
1. REQ-3 "ladder and no kebab" and "loading / empty" scenarios have no runtime covering test — `TenantCard`/`TenantCardGrid` internals (ladder classes, dashed divider, chip, skeleton, `i-lucide-building`) are source-verified only. Documented "WU-B ships without tests" decision; roles/users precedent (PASS WITH WARNINGS).
2. Card-mode error bypass in `AppDataTable` (design open question #1): a failed request in card mode renders the grid empty state instead of the error block. Parity with roles/users; fix belongs in `AppDataTable`, out of scope.
3. `phone` column spec-text discrepancy (design open question #2): spec REQ-5/6 reference `phone` as if it existed; design adds the column (roles `description` precedent). Reconcile at archive.
4. Test pragmatics: `inheritAttrs:false` on the `AppDataTable` stub; `#filters` asserted via `[role="checkbox"]` (real UCheckbox renders a button role); `@nuxt/ui` mock bypassed by auto-imports so real UDropdownMenu/UCheckbox/UCard render in view tests; `reka-dropdown-menu-trigger` implementation-detail coupling.
5. Attempt ledger: 1118 total vs 700 ledger (maintainer-delegated exception, reset done).

**SUGGESTION**:
1. Remove the dead `vi.mock('@nuxt/ui', …)` block in `AdminTenantsView.test.ts` (lines 196–221) — it is bypassed by Nuxt UI auto-imports and misleads readers into thinking those components are stubbed.
2. `AdminTenantsView.spec.ts` "Confirm modal copy" tests (86–103) assert local string constants rather than exercising the view's actual deactivate copy construction (pre-existing, preserved by design).

### Verdict

**FAIL** — sole blocker: `tasks.md` task completion not recorded (21 implementation tasks + 4 DoD items unchecked). The implementation itself is complete and correct (all 7 requirements implemented, invariants preserved, `tenants.api.ts`/`tenant-actions.utils.ts` untouched, 238/238 scoped + 3938/3938 full tests green, `pnpm build` clean). After apply checks off the `tasks.md` boxes, this change is archive-ready.
