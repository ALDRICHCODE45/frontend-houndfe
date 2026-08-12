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

## Phase 1: WU-A — View Mode + Error Handling + Description Column (~160 lines)

**Files**: create `composables/useRoleViewMode.ts`; modify `composables/useRoleColumns.ts`, `views/AdminRolesView.vue`. Strict-TDD: RED → GREEN → REFACTOR.

- [ ] 1.1 RED `composables/__tests__/useRoleViewMode.test.ts`: localStorage roundtrip; default `table`; invalid stored → `table`; `displayMode` bridges `card`→`cards`. Red.
- [ ] 1.2 GREEN `useRoleViewMode.ts`: wrap `useViewMode('admin-roles-view-mode', ['table','card'], 'table')`; export `isRoleViewMode` + `{ viewMode, setMode, toggleViewMode, displayMode }`. Green.
- [ ] 1.3 RED stub `views/__tests__/AdminRolesView.test.ts` pinning `rolesErrorMessage` precedence (`response.data.message` → `error.message` → "No se pudieron cargar los roles. Reintenta."). Red.
- [ ] 1.4 GREEN `AdminRolesView.vue`: destructure `isError`/`error` from `useServerTable`; add `rolesErrorMessage` computed; pass `:error` + `:error-message` to `AppDataTable`.
- [ ] 1.5 RED column stub in `AdminRolesView.test.ts`: order `[name, description, permissionCount, userCount, createdAt, actions]`; description `'Descripción'`; counts sortable; description non-sortable; actions non-sortable/non-hideable/`text-right`. Red.
- [ ] 1.6 GREEN `useRoleColumns.ts`: insert `description` at pos 2 (non-sortable, hideable); explicit `enableSorting`/`enableHiding` everywhere; `permissionCount`/`userCount` sortable; `actions` non-sortable/non-hideable/`text-right`. Green.
- [ ] 1.7 GREEN `AdminRolesView.vue`: `enable-column-visibility`; wire `useRoleViewMode`; `ViewToggle` in `#actions`; `:display-mode="displayMode"`; `#description-cell` (`?? '—'`); `#permissionCount-header` / `#userCount-header` `SortableHeader` slots; replace inline `<h2>` with `<AdminPageHeader title="Gestión de roles" :description="headerDescription" />` (`Administrá los roles y permisos de ${currentTenant.name ?? '(Global)'}`); `getRowItems` `destructiveActions = canDeleteRole.value && !role.isSystem ? [Eliminar] : []`.
- [ ] 1.8 REFACTOR trim dead imports; tests green.
- [ ] 1.9 Verify `pnpm test:unit --run src/features/admin/roles` green + `pnpm build` clean.

**Commit**: `feat(admin-roles): add view mode, surface list errors, expose description column`. Stages `useRoleViewMode.ts` (new), `useRoleViewMode.test.ts` (new), `useRoleColumns.ts` (modify), `AdminRolesView.vue` (modify), `AdminRolesView.test.ts` stub (new).

---

## Phase 2: WU-B — Card View + Grid + Click-to-Edit (~190 lines, NO TESTS)

**Files**: create `components/RoleCard.vue`, `components/RoleCardGrid.vue`; modify `views/AdminRolesView.vue`. Implementation only.

- [ ] 2.1 `RoleCard.vue`: `<article data-testid="role-card">` + `EntityAvatar(:name, :seed=role.id, size=lg)` + name + description (line-clamped, null-safe) + chip row (`StatusDotBadge tone="info" label="Sistema" compact` for `isSystem`, `AppBadge tone="info" :label="`${permissionCount} permisos`"`, `AppBadge tone="type" variant="outline" :label="`${userCount} usuarios`"`) + `border-t border-dashed border-default` divider + 2-col body (`Descripción` null → `'—'`, `Creación` `es-AR`). Props `{ role: RoleTableRow }`. Emit `click` only — NO kebab, NO checkbox.
- [ ] 2.2 `RoleCardGrid.vue`: props `{ roles: RoleTableRow[]; loading?: boolean; empty?: string }`; emit `card-click`; ladder `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7`; 8 pulse skeletons; `i-lucide-shield` empty icon.
- [ ] 2.3 `AdminRolesView.vue`: import `RoleCardGrid`; `handleCardClick(role)` → `openEdit(role)`; `#cards` slot → `RoleCardGrid` with `@card-click="handleCardClick"`. NO `router.push`, NO detail route.
- [ ] 2.4 Verify `pnpm test:unit --run src/features/admin/roles` (existing green) + `pnpm build` clean. Runtime: toggle cards, click opens edit slideover, no nav, ladder fills, `Sistema` chip on system rows, no kebab on cards.

**Commit**: `feat(admin-roles): add EmployeeCard-pattern card view with click-to-edit`. Stages `RoleCard.vue` (new), `RoleCardGrid.vue` (new), `AdminRolesView.vue` (modify).

---

## Phase 3: WU-C — Tests (~250 lines)

**Files**: expand `views/__tests__/AdminRolesView.test.ts` (from WU-A stub); create `composables/__tests__/useRoleColumns.test.ts`. Strict-TDD: RED → GREEN → REFACTOR.

- [ ] 3.1 Expand `AdminRolesView.test.ts` stubs (from 1.3 + 1.5): mock `useServerTable` (mockState incl. `isError`/`error` refs); stub `AppDataTable` (`data-error`/`data-error-message`/`data-column-visibility`/`data-display-mode` attrs, `actions`/`cards`/`actions-cell` slots), `ViewToggle`, `SortableHeader`, `RoleCardGrid`, `RoleUpsertSlideover` (`data-role-id`/`data-mode`), `RolePermissionsSlideover`, `AppBadge`, `ConfirmModal`, `AdminPageHeader` (`:data-title`), `@nuxt/ui` primitives. Real `useRoleViewMode` (localStorage-driven). Red.
- [ ] 3.2 GREEN tests: error block precedence (backend/`error.message`/Spanish fallback); retry→`refresh`; empty suppressed on error; `ViewToggle` renders; `display-mode` default `table`, localStorage `card`→`cards`, invalid→`table`; `enable-column-visibility` wired; `AdminPageHeader` `:data-title` = "Gestión de roles".
- [ ] 3.3 GREEN tests: kebab via `reka-dropdown-menu-trigger`; **isSystem gate**: mounted `UDropdownMenu` `props('items')` flattened — `Editar`+`Permisos` present, no `Eliminar`; editor shows kebab; read-only hides kebab; `card-click` → `RoleUpsertSlideover` (`data-role-id`); no `router.push` on card click.
- [ ] 3.4 `composables/__tests__/useRoleColumns.test.ts`: order `[name, description, permissionCount, userCount, createdAt, actions]`; headers `Nombre`/`Descripción`/`Permisos`/`Usuarios`/`Creación`; name/createdAt/counts sortable; description non-sortable + hideable; actions non-sortable/non-hideable/`text-right`.
- [ ] 3.5 REFACTOR trim mocks, consolidate stubs; tests green.
- [ ] 3.6 Verify `pnpm test:unit --run src/features/admin/roles` (all green) + `pnpm build` clean.

**Commit**: `test(admin-roles): cover list view, view mode, columns, and kebab gating`. Stages `AdminRolesView.test.ts` (expand), `useRoleColumns.test.ts` (new). Test-only commit.

---

## Threat Matrix

N/A per design (no routing/shell/subprocess/VCS/exec/process boundaries; card click → slideover, no `router.push`).

---

## Definition of Done

- [ ] REQ-1..8 satisfied; REQ-7 invariants preserved (`defaultPinning.right: ['actions']`; CASL-gated kebab; tenant scoping via `authStore.currentTenantId`; full-catalog local filter/sort/paginate over `rolesApi.getPaginated`; `usersApi.clearRolesCache()` invalidation; `AdminPageHeader`; no type/route/backend change; `roles.api.ts` contract untouched)
- [ ] `pnpm test:unit --run src/features/admin/roles` green; `pnpm build` clean
- [ ] Per-WU commits on branch in order: WU-A → WU-B → WU-C; each < 400 lines added
- [ ] `pnpm dev` smoke: error banner on forced 500; toggle persists across reload; card-click opens edit slideover (no nav); all 5 data columns hideable; `isSystem` row hides `Eliminar`