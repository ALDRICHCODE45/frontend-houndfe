# Tasks: Standardize Admin Roles Table

Derived from `proposal.md`, `design.md`, `specs/admin-roles-list/spec.md` (REQ-1..8).

- Execution mode: AUTO (user away — orchestrator gatekeeps); delivery: no PRs — conventional commits on branch, user merges to main
- Artifact store: openspec; review budget: 400 lines/WU; strict TDD: `pnpm test:unit` (vitest), gate `pnpm build`
- WU-B ships without tests (Fase 1 + users lesson) — tests land in WU-C
- `roles.api.ts` is **untouchable** — `useAdminRolesQuery` couples to `rolesApi.getPaginated`

---

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: Medium

Estimated ~600 lines (WU-A ~160 + WU-B ~190 + WU-C ~250). Each WU < 400. WU-B heaviest but `RoleCard.vue` stays lean (no kebab). Users precedent: 796 insertions accepted PASS WITH WARNINGS.

| Unit | Goal | REQs | Commit |
|------|------|------|--------|
| WU-A | view mode + error + description + visibility + isSystem + header | 1, 2, 4, 6, 7 | `feat(admin-roles): add view mode, surface list errors, expose description column` |
| WU-B | card view + grid + click-to-edit (NO tests) | 3, 5 | `feat(admin-roles): add EmployeeCard-pattern card view with click-to-edit` |
| WU-C | tests: error, toggle, columns, kebab | 1..8 | `test(admin-roles): cover list view, view mode, columns, and kebab gating` |

Test cmd (all): `pnpm test:unit --run src/features/admin/roles`. Harness: `pnpm dev` for WU-A/B; N/A for WU-C. Rollback: revert per-WU files only.

---

## Phase 1: WU-A — View Mode + Error Handling + Description Column (~160 lines) — commit `ae64ef3`

**Files**: create `composables/useRoleViewMode.ts`; modify `composables/useRoleColumns.ts`, `views/AdminRolesView.vue`. Strict-TDD: RED → GREEN → REFACTOR.

- [x] 1.1 RED `composables/__tests__/useRoleViewMode.test.ts`: localStorage roundtrip; default `table`; invalid stored → `table`; `displayMode` bridges `card`→`cards`. Red. _(commit `ae64ef3` — WU-A)_
- [x] 1.2 GREEN `useRoleViewMode.ts`: wrap `useViewMode('admin-roles-view-mode', ['table','card'], 'table')`; export `isRoleViewMode` + `{ viewMode, setMode, toggleViewMode, displayMode }`. Green. _(commit `ae64ef3` — WU-A)_
- [x] 1.3 RED stub `views/__tests__/AdminRolesView.test.ts` pinning `rolesErrorMessage` precedence (`response.data.message` → `error.message` → "No se pudieron cargar los roles. Reintenta."). Red. _(commit `ae64ef3` — WU-A)_
- [x] 1.4 GREEN `AdminRolesView.vue`: destructure `isError`/`error` from `useServerTable`; add `rolesErrorMessage` computed; pass `:error` + `:error-message` to `AppDataTable`. _(commit `ae64ef3` — WU-A)_
- [x] 1.5 RED column stub in `AdminRolesView.test.ts`: order `[name, description, permissionCount, userCount, createdAt, actions]`; description `'Descripción'`; counts sortable; description non-sortable; actions non-sortable/non-hideable/`text-right`. Red. _(commit `ae64ef3` — WU-A)_
- [x] 1.6 GREEN `useRoleColumns.ts`: insert `description` at pos 2 (non-sortable, hideable); explicit `enableSorting`/`enableHiding` everywhere; `permissionCount`/`userCount` sortable; `actions` non-sortable/non-hideable/`text-right`. Green. _(commit `ae64ef3` — WU-A)_
- [x] 1.7 GREEN `AdminRolesView.vue`: `enable-column-visibility`; wire `useRoleViewMode`; `ViewToggle` in `#actions`; `:display-mode="displayMode"`; `#description-cell` (`?? '—'`); `#permissionCount-header` / `#userCount-header` `SortableHeader` slots; replace inline `<h2>` with `<AdminPageHeader title="Gestión de roles" :description="headerDescription" />` (`Administrá los roles y permisos de ${currentTenant.name ?? '(Global)'}`); `getRowItems` `destructiveActions = canDeleteRole.value && !role.isSystem ? [Eliminar] : []`. _(commit `ae64ef3` — WU-A)_
- [x] 1.8 REFACTOR trim dead imports; tests green. _(commit `ae64ef3` — WU-A)_
- [x] 1.9 Verify `pnpm test:unit --run src/features/admin/roles` green + `pnpm build` clean. _(commit `ae64ef3` — WU-A; verified at close: 87/87 roles, 3935/3935 full, build exit 0)_

**Commit**: `feat(admin-roles): add view mode, surface list errors, expose description column` (`ae64ef3`). Stages `useRoleViewMode.ts` (new), `useRoleViewMode.test.ts` (new), `useRoleColumns.ts` (modify), `AdminRolesView.vue` (modify), `AdminRolesView.test.ts` stub (new). **Budget deviation**: 490 insertions (bundled column-coverage stub) — maintainer-delegated exception, reset done.

---

## Phase 2: WU-B — Card View + Grid + Click-to-Edit (~190 lines, NO TESTS) — commit `fa34c01`

**Files**: create `components/RoleCard.vue`, `components/RoleCardGrid.vue`; modify `views/AdminRolesView.vue`. Implementation only.

- [x] 2.1 `RoleCard.vue`: `<article data-testid="role-card">` + `EntityAvatar(:name, :seed=role.id, size=lg)` + name + description (line-clamped, null-safe) + chip row (`StatusDotBadge tone="info" label="Sistema" compact` for `isSystem`, `AppBadge tone="info" :label="`${permissionCount} permisos`"`, `AppBadge tone="type" variant="outline" :label="`${userCount} usuarios`"`) + `border-t border-dashed border-default` divider + 2-col body (`Descripción` null → `'—'`, `Creación` `es-AR`). Props `{ role: RoleTableRow }`. Emit `click` only — NO kebab, NO checkbox. _(commit `fa34c01` — WU-B)_
- [x] 2.2 `RoleCardGrid.vue`: props `{ roles: RoleTableRow[]; loading?: boolean; empty?: string }`; emit `card-click`; ladder `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7`; 8 pulse skeletons; `i-lucide-shield` empty icon. _(commit `fa34c01` — WU-B)_
- [x] 2.3 `AdminRolesView.vue`: import `RoleCardGrid`; `handleCardClick(role)` → `openEdit(role)`; `#cards` slot → `RoleCardGrid` with `@card-click="handleCardClick"`. NO `router.push`, NO detail route. _(commit `fa34c01` — WU-B)_
- [x] 2.4 Verify `pnpm test:unit --run src/features/admin/roles` (existing green) + `pnpm build` clean. Runtime: toggle cards, click opens edit slideover, no nav, ladder fills, `Sistema` chip on system rows, no kebab on cards. _(commit `fa34c01` — WU-B; verified at close)_

**Commit**: `feat(admin-roles): add EmployeeCard-pattern card view with click-to-edit` (`fa34c01`). Stages `RoleCard.vue` (new), `RoleCardGrid.vue` (new), `AdminRolesView.vue` (modify). 171 insertions.

---

## Phase 3: WU-C — Tests (~250 lines) — commit `04127ec`

**Files**: expand `views/__tests__/AdminRolesView.test.ts` (from WU-A stub); create `composables/__tests__/useRoleColumns.test.ts`. Strict-TDD: RED → GREEN → REFACTOR.

- [x] 3.1 Expand `AdminRolesView.test.ts` stubs (from 1.3 + 1.5): mock `useServerTable` (mockState incl. `isError`/`error` refs); stub `AppDataTable` (`data-error`/`data-error-message`/`data-column-visibility`/`data-display-mode` attrs, `actions`/`cards`/`actions-cell` slots), `ViewToggle`, `SortableHeader`, `RoleCardGrid`, `RoleUpsertSlideover` (`data-role-id`/`data-mode`), `RolePermissionsSlideover`, `AppBadge`, `ConfirmModal`, `AdminPageHeader` (`:data-title`), `@nuxt/ui` primitives. Real `useRoleViewMode` (localStorage-driven). Red. _(commit `04127ec` — WU-C)_
- [x] 3.2 GREEN tests: error block precedence (backend/`error.message`/Spanish fallback); retry→`refresh`; empty suppressed on error; `ViewToggle` renders; `display-mode` default `table`, localStorage `card`→`cards`, invalid→`table`; `enable-column-visibility` wired; `AdminPageHeader` `:data-title` = "Gestión de roles". _(commit `04127ec` — WU-C)_
- [x] 3.3 GREEN tests: kebab via `reka-dropdown-menu-trigger`; **isSystem gate**: mounted `UDropdownMenu` `props('items')` flattened — `Editar`+`Permisos` present, no `Eliminar`; editor shows kebab; read-only hides kebab; `card-click` → `RoleUpsertSlideover` (`data-role-id`); no `router.push` on card click. _(commit `04127ec` — WU-C)_
- [x] 3.4 `composables/__tests__/useRoleColumns.test.ts`: order `[name, description, permissionCount, userCount, createdAt, actions]`; headers `Nombre`/`Descripción`/`Permisos`/`Usuarios`/`Creación`; name/createdAt/counts sortable; description non-sortable + hideable; actions non-sortable/non-hideable/`text-right`. _(commit `04127ec` — WU-C)_
- [x] 3.5 REFACTOR trim mocks, consolidate stubs; tests green. _(commit `04127ec` — WU-C)_
- [x] 3.6 Verify `pnpm test:unit --run src/features/admin/roles` (all green) + `pnpm build` clean. _(commit `04127ec` — WU-C; verified at close: 87/87 roles, 3935/3935 full, build exit 0)_

**Commit**: `test(admin-roles): cover list view, view mode, columns, and kebab gating` (`04127ec`). Stages `AdminRolesView.test.ts` (expand), `useRoleColumns.test.ts` (new). 277 insertions.

---

## Threat Matrix

N/A per design (no routing/shell/subprocess/VCS/exec/process boundaries; card click → slideover, no `router.push`).

---

## Definition of Done

- [x] REQ-1..8 satisfied; REQ-7 invariants preserved (`defaultPinning.right: ['actions']`; CASL-gated kebab; tenant scoping via `authStore.currentTenantId`; full-catalog local filter/sort/paginate over `rolesApi.getPaginated`; `usersApi.clearRolesCache()` invalidation; `AdminPageHeader`; no type/route/backend change; `roles.api.ts` contract untouched)
- [x] `pnpm test:unit --run src/features/admin/roles` green (87/87); `pnpm build` clean (exit 0); full suite `pnpm test:unit --run` 3935/3935 green
- [x] Per-WU commits on branch in order: `ae64ef3` (WU-A) → `fa34c01` (WU-B) → `04127ec` (WU-C); docs `cce4aa2`. WU-A is 490 lines (budget exception, accepted; the rest < 400).
- [x] `pnpm dev` smoke: error banner on forced 500; toggle persists across reload; card-click opens edit slideover (no nav); all 5 data columns hideable; `isSystem` row hides `Eliminar`

---

## Archive-Time Reconciliation Note

All 19 implementation tasks above were marked `[x]` at archive time under the orchestrator's pre-approval for the Task Completion Gate's exceptional mechanical repair path (per `sdd-archive` SKILL.md "Task Completion Gate"). Every checkbox is annotated with the exact commit SHA that delivered it (`ae64ef3` / `fa34c01` / `04127ec`). Completion is independently proven by:

1. The 3 implementation commits themselves, in order, on `feat/standardize-admin-roles-table`.
2. `pnpm test:unit --run` exit 0 with **3935/3935** tests passing (full suite) and **87/87** for the roles scope.
3. `pnpm build` exit 0 (`vue-tsc --build` + `vite build` clean).
4. `verify-report.md` verdict PASS WITH WARNINGS (0 CRITICAL, 0 blockers).
5. `apply-progress` observation `sdd/standardize-admin-roles-table/apply-progress` (obs 3673) recording the 922 insertions / 13 deletions across 8 code files.

The Fase 2 lesson is reinforced for the next change: apply-phase checkbox ticking must happen as commits land (this is the second Fase-2 cycle where the gap surfaced — see `sdd/standardize-admin-users-table` archive for the prior record).