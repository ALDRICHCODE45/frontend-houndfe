# Proposal: Standardize Admin Roles Table

## Intent

Bring `AdminRolesView.vue` to Fase 2 parity with the just-archived `standardize-admin-users-table` (Fase 2 #1). Today this view masks failures ("No se encontraron roles" on a crashed request), offers no card view, leaves the column-visibility selector dead-bound, uses an inline `<h2>` instead of the admin convention, and lets `isSystem` rows expose `Eliminar` only to be blocked by `window.alert` at runtime. CRUD flows through `RoleUpsertSlideover` + `RolePermissionsSlideover` (kebab → CASL-gated). `roles.api.ts` `getPaginated` already fetches the FULL `/admin/roles` array and applies local filter/sort/paginate (`roles.api.ts:64-83`) — unlike `users.api.ts`, filtered pagination is **semantically CORRECT** here, so `permissionCount` / `userCount` can be made sortable.

## Scope

### In Scope

- **G1 error handling (HIGH)**: destructure `isError` / `error` from `useServerTable` (`AdminRolesView.vue:23-38`); compute `rolesErrorMessage`; pass `:error` + `:error-message` to `<AppDataTable>` (`:214-235` passes neither today). No "No se encontraron roles" on a failed request.
- **G2 view mode + card view (HIGH)**: `useRoleViewMode` (wraps `useViewMode`, key `admin-roles-view-mode`, modes `['table','card']`, default `table`), `RoleCard.vue`, `RoleCardGrid.vue`, `ViewToggle` in `#actions`, `#cards` slot, `:display-mode`. EmployeeCard pattern (avatar seeded by id, chip row, dashed divider, 2-col body). **Card click opens `RoleUpsertSlideover` in edit mode** (same `openEdit` the kebab triggers).
- **G3 column selector (MED)**: set `enable-column-visibility` on `AppDataTable` (`:219` binds `columnVisibility` but the dropdown is dead). All data columns hideable: `name`, `description`, `permissionCount`, `userCount`, `createdAt`. `actions` stays non-hideable. `isSystem` is a card-only chip.
- **G4 sortable counts (MED)**: `permissionCount` and `userCount` become `SortableHeader` (cheap + correct over the full dataset — `applyLocalRoleFilters` already sorts numbers). `name` and `createdAt` already sortable. `description` and `actions` stay non-sortable.
- **G5 isSystem gate (MED)**: in `getRowItems`, **hide** the `Eliminar` entry for `isSystem` rows (today every row gets the menu item — the `window.alert` at `:139-142` is a runtime block, not a UX gate). `Editar` / `Permisos` remain allowed (no silent backend-behavior change). `window.alert` → toast migration is OPTIONAL and out of scope.
- **G6 header (MED)**: replace the inline `<h2>` + `<p>` block (`:206-211`) with `<AdminPageHeader title="Gestión de roles" :description="headerDescription" />` (tenant signposting like users: `Administrá los roles y permisos de ${currentTenant.name}`).
- **G7 explicit column flags (LOW)**: add `enableSorting` / `enableHiding` to every column in `useRoleColumns.ts`. Mirrors `useUserColumns.ts` shape.
- **G8 tests (HIGH)**: `views/__tests__/AdminRolesView.test.ts` + `composables/__tests__/useRoleColumns.test.ts`.

### Out of Scope

- **G5 (users counterpart) — N/A here**: `roles.api.ts:64-83` `applyLocalRoleFilters` already filters/sorts over the FULL catalog (totalCount = filtered length). Pagination semantics are correct; no backend defect. `roles.api.ts` is **untouchable** in this change — `useAdminRolesQuery` (users' role picker) consumes `rolesApi.getPaginated({pageSize:1000})`. State explicitly here so future readers don't "fix" it.
- `RolePermissionsSlideover` and `RoleUpsertSlideover` stay as-is.
- `useRolePermissions.ts` and `permissions.spec.ts` stay untouched.
- No new `#filters` slot — Admin Roles has no extra filter selects (search only).
- No bulk actions / row selection (no bulk ops for roles; CASL gate already in place).
- `window.alert` → toast migration for the system-role guard is OPTIONAL and out of scope (flag in tasks).
- No `RoleTableRow` type change, no new route, no backend change.

### Already in Place (do NOT redo)

- `defaultPinning: { right: ['actions'] }` on `AdminRolesView.vue:44`.
- CASL-gated kebab (`canCreateRole` / `canUpdateRole` / `canDeleteRole`) + `canManageRoleActions` `v-if` at `:116, 259`.
- Tenant scoping via `authStore.currentTenantId` baked into the query key (`:39`).
- `persistKey: 'admin-roles'` (`:42`) — separate from `admin-users`.
- Local filter/sort/pagination over the FULL dataset (`roles.api.ts:64-83`) — correct semantics.
- `RolePermissionsSlideover` already CASL-gated (`openPermissions` checks `canUpdateRole`, `:130-134`).
- `usersApi.clearRolesCache()` invalidation on every role mutation — N+1 fix already lives here.

## Capabilities

### New

- `admin-roles-list` — source-of-truth spec for the admin roles list view: surfaced backend errors, working column-visibility selector, sortable counts (`permissionCount` / `userCount`), `localStorage` `admin-roles-view-mode` table/card preference, EmployeeCard-pattern card rendering with click-to-edit, `isSystem` chip + per-row `Eliminar` gate, `AdminPageHeader` shell, CASL-gated kebab. Slideovers stay governed by other capabilities.

> No existing `admin-roles` capability in `openspec/specs/`. Whole capability is `ADDED`; original `AdminRolesView` pre-dates the spec system. No `MODIFIED` block needed.

### Modified

None.

## Approach

Mirror `AdminUsersView.vue` (post-standardization, on the unmerged `feat/standardize-admin-users-table` branch) 1:1: same `useServerTable` destructure, same `*ErrorMessage` shape (backend `response.data.message` → `error.message` → "No se pudieron cargar los roles. Reintenta."), same `<ViewToggle>` wiring in `#actions`, same `enable-column-visibility`. Reuse `useViewMode` from `@/core/shared/composables/useViewMode`. Cards follow the **EmployeeCard** pattern — `article` root, `EntityAvatar` seeded by `role.id` (lg), `name` + `description` header, chip row = `isSystem` info-tone badge (`Sistema`) + `permissionCount` `AppBadge(info)` + `userCount` `AppBadge(type, outline)`, `border-t border-dashed border-default` divider, 2-col body (`Descripción`, `Creación`). NO kebab on the card (matches EmployeeCard parity; destructive actions stay on the table row). Card click emits `card-click`; `AdminRolesView` opens `RoleUpsertSlideover` in edit mode (`openEdit(role)`). `isSystem` rows hide `Eliminar` from `getRowItems` (G5). Permisos stays table-only — cards have no kebab by design (users parity, no detail route). WU-B ships **without tests** (Fase 1 + Fase 2-#1 lesson: customers WU-B and users WU-B both went over budget). Tests land in their own WU-C.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/admin/roles/views/AdminRolesView.vue` | Modified | `isError`/`error` destructure, `rolesErrorMessage`, `enable-column-visibility`, `:display-mode`, `ViewToggle` slot, `#cards` slot, card-click → `RoleUpsertSlideover` open in edit mode, inline `<h2>` → `<AdminPageHeader>`, `getRowItems` hides `Eliminar` for `isSystem` rows. |
| `src/features/admin/roles/composables/useRoleViewMode.ts` | **New** | Storage key `admin-roles-view-mode`; `isRoleViewMode` guard; returns `{ viewMode, setMode, toggleViewMode, displayMode }` (bridges `card` → `cards`). |
| `src/features/admin/roles/components/RoleCard.vue` | **New** | `defineProps<{ role }>`, emits `click`. EmployeeCard pattern (no kebab). `isSystem` `Sistema` info-tone chip + `permissionCount` / `userCount` AppBadges + dashed divider + 2-col body (`Descripción`, `Creación`). |
| `src/features/admin/roles/components/RoleCardGrid.vue` | **New** | `defineProps<{ roles, loading, empty }>`, emits `card-click`. Ladder `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7`. Empty icon `i-lucide-shield`. |
| `src/features/admin/roles/composables/useRoleColumns.ts` | Modified | Explicit `enableSorting` / `enableHiding` on every column; counts get `SortableHeader`; `description` sortable=false; `actions` sortable=false, hideable=false. |
| `src/features/admin/roles/views/__tests__/AdminRolesView.test.ts` | **New** | Mocks `useServerTable` incl. `isError` mockState; pins error block + precedence + retry, ViewToggle + `localStorage` `admin-roles-view-mode`, `enable-column-visibility`, kebab gating (incl. `isSystem` hides `Eliminar`), card-click → edit slideover (no `router.push`). |
| `src/features/admin/roles/composables/__tests__/useRoleColumns.test.ts` | **New** | Locks column order, sortability + hideability flags, header text (`Nombre`, `Descripción`, `Permisos`, `Usuarios`, `Creación`). |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Card click → edit slideover drops the `Permisos` workflow in card mode | Med | **Accepted by design**: cards open the same `openEdit` the kebab triggers. `Permisos` stays table-kebab. Card view is an alternate read; permission assignment is the table's job. |
| Reference pattern lives on an unmerged branch (`feat/standardize-admin-users-table`) — `git show` access only | Low | `git show feat/standardize-admin-users-table:<path>` during apply reads the live branch bytes. No file-level cross-branch conflicts (roles creates its own `RoleCard` / `RoleCardGrid` / `useRoleViewMode`). |
| `isSystem` rows currently rely on `window.alert` to block deletion — per-row kebab gating changes visible UX | Low | The runtime block already exists (`window.alert` at `:139-142`); hiding the menu item is purely defensive UX tightening. No backend behavior change. Edit / Permisos remain allowed (intentional). |
| ~600 total lines, at/over the 400-line budget edge | Med | 3 work units; WU-B (cards) ships without tests so the heaviest single commit stays under 400. Users precedent: 796 insertions accepted PASS WITH WARNINGS. |
| Local filter semantics (G5) look fine here but a future backend move to true server-side pagination could regress silently | Low | `roles.api.ts` is untouchable in this change; explicitly stated as a non-goal. If the backend later paginates, both the column flags and the full-dataset assumption need revisiting. |
| `useAdminRolesQuery` (users' role picker) couples to `rolesApi.getPaginated({pageSize:1000})`; changing `roles.api.ts` would break it | High | `roles.api.ts` is in the **Out of Scope** list. Apply phase must not touch it. |

## Rollback Plan

Revert the merge commit. Error handling is additive (`rolesErrorMessage` falls back to the existing empty state when `error` is `null`). Removing the card view deletes the new composable + 2 components and strips the `#cards` slot — no breaking change to the table view. The column-visibility toggle is opt-in (a toolbar menu); removing the prop reverts to the previous selectors. `isSystem` gating is a pure additive hide in `getRowItems` — reverting restores the (less defensible) kebab rendering + `window.alert` runtime block. Tests live next to the code they pin, so reverting WU-C alone removes them.

## Dependencies

`useViewMode` (Customers/Promotions/Sales/Users already use it); `ViewToggle`; `EntityAvatar` / `AppBadge` (shared kit); `useServerTable` already returns `isError` / `error`; `AdminPageHeader` (shared with `AdminUsersView`, `AdminTenantMembersView`). No new dependency on `houndfe-backend`.

## Success Criteria

- [ ] Failed list requests render a backend-derived error; empty placeholder only on empty success.
- [ ] ViewToggle switches table ↔ card; persists in `localStorage` under `admin-roles-view-mode`; cards match EmployeeCard pattern.
- [ ] Card click opens `RoleUpsertSlideover` in edit mode (same `openEdit` as kebab); no `router.push`, no detail route introduced.
- [ ] `permissionCount` and `userCount` become sortable; `description` stays non-sortable.
- [ ] All data columns hideable: `name`, `description`, `permissionCount`, `userCount`, `createdAt`. `actions` non-hideable. `isSystem` rendered as `Sistema` chip in card view only.
- [ ] `Eliminar` kebab item hidden for `isSystem` rows; `Editar` and `Permisos` remain (CASL-gated by `canUpdateRole`).
- [ ] Header uses `<AdminPageHeader>` with tenant description; inline `<h2>` removed.
- [ ] `defaultPinning.right: ['actions']` and the CASL-gated kebab remain unchanged.
- [ ] `pnpm test:unit --run` passes with the two new files green; `pnpm build` clean.
- [ ] No `RoleTableRow` type change; no new route; no backend change; `roles.api.ts` contract untouched.

## Work Units (forecast)

- **WU-A — view mode + error handling + column selector + header + isSystem gate + explicit column flags (~150-170 lines)**: `useRoleViewMode` + `AdminRolesView` destructure / `rolesErrorMessage` / `enable-column-visibility` / `ViewToggle` slot / inline-header → `<AdminPageHeader>` / `getRowItems` `isSystem` hide; `useRoleColumns.ts` `enableSorting`/`enableHiding` flags + `SortableHeader` slots for counts + description slot.
- **WU-B — card view (~150-170 lines). No tests** (Fase 1 + Fase 2-#1 lesson: customers WU-B and users WU-B both went over budget). `RoleCard`, `RoleCardGrid`, card-click → `openEdit`, `isSystem` chip, empty-state icon `i-lucide-shield`.
- **WU-C — tests (~250-300 lines)**: `AdminRolesView.test.ts` + `useRoleColumns.test.ts`.

Review Workload Forecast: `Decision needed before apply: No`, `Chained PRs recommended: No` (NO PRs — conventional commits on branch, user merges manually to main, per session preflight), `400-line budget risk: Medium` — WU-B is heaviest but stays under 400 if `RoleCard.vue` stays lean (no kebab, no checkbox).