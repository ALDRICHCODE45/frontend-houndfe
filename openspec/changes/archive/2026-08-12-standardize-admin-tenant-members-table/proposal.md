# Proposal: Standardize Admin Tenant Members Table

## Intent

Bring `AdminTenantMembersView.vue` to Fase 2 parity with the just-archived `standardize-admin-tenants-table` (Fase 2 #3) and the Fase 2 #1/#2 siblings (`standardize-admin-users-table`, `standardize-admin-roles-table`). Today this view masks failures ("No hay miembros en este tenant" on a crashed request), offers no card view, leaves the column-visibility selector dead-bound, ships a **latent bug** where `defaultSorting: [{ id: 'userEmail' }]` references a column that does not exist (real ids are `userName` / `roleName` / `createdAt` / `actions`), and only `actions` has explicit `enableSorting` / `enableHiding`. CRUD flows through `MembershipUpsertSlideover` + `ConfirmModal`, kebab CASL-gated via `userCan('read'|'create'|'update'|'delete', 'TenantMembership')`. `memberships.api.ts` `getPaginated` (`:114-136`) fetches the FULL `/admin/tenants/:tenantId/members` array and applies local filter/sort/paginate — like `tenants.api.ts` and `roles.api.ts`, this is **semantically CORRECT** (backend has no pagination), so the existing `SortableHeader` slots on `userName` / `roleName` / `createdAt` can stay cheap. `userIsActive?` is **optional** on `MembershipTableRow` (some rows omit it) — any chip render must be null-safe.

## Scope

### In Scope

- **G1 error handling (HIGH)**: destructure `isError` / `error` from `useServerTable` (`AdminTenantMembersView.vue:60-75`); compute `membershipsErrorMessage`; pass `:error` + `:error-message` to `<AppDataTable>` (`:220-242` passes neither today). No "No hay miembros en este tenant" on a failed request.
- **G2 view mode + card view (HIGH)**: `useMembershipViewMode` (wraps `useViewMode`, key `admin-tenant-members-view-mode`, modes `['table','card']`, default `table`), `MemberCard.vue`, `MemberCardGrid.vue`, `ViewToggle` in `#actions`, `#cards` slot, `:display-mode`. **TenantCard pattern** (`article` + `EntityAvatar(name=userName, seed=userId||id, lg)` + `userName` + `userEmail` + `AppBadge(roleName, info)` + `StatusDotBadge(userIsActive → activityToBadgeTone, only when defined)` + `border-t border-dashed border-default` + 2-col body (`Rol` info chip + `Fecha de ingreso` es-AR)). **Card click → `openEdit(membership)`**, guarded on `canUpdateMembership` (kebab parity, no `router.push`, no detail route). Empty icon `i-lucide-users`.
- **G3 column selector (MED)**: set `enable-column-visibility` on `AppDataTable` (`:225` binds `columnVisibility` but the dropdown is dead — same gap tenants/roles/users had). All **3 data columns** hideable: `userName`, `roleName`, `createdAt`. `actions` stays non-hideable.
- **G4 sortable columns (MED)**: `userName` / `roleName` / `createdAt` already use `SortableHeader`. `actions` stays non-sortable + non-hideable (already correct).
- **G5 #filters slot (MED)**: NOT applicable — members list has no `includeInactive`-style query param (no backend filter today). **Rejected**: adding a local "Mostrar inactivos" toggle over `userIsActive?` would require touching `memberships.api.ts` (forbidden-by-precedent for tenant/role/membership sibling views that all do full-catalog local filter). Out of scope, see below.
- **G6 header (MED)**: **already in place** (`AdminPageHeader title="Miembros del tenant" :description="headerDescription"` at `:208-212`) + `useTenantSummary(tenantId)` for the name resolver (`:55`). No change.
- **G7 explicit column flags (LOW)**: add `enableSorting` / `enableHiding` to all 4 columns in `useMembershipColumns.ts`. Currently only `actions` has them (`:22-23`). Mirrors `useUserColumns.ts` / `useRoleColumns.ts` shape.
- **G8 latent bug fix (MED)**: `defaultSorting: [{ id: 'userEmail', desc: false }]` (`AdminTenantMembersView.vue:80`) references a column that does not exist (real columns are `userName` / `roleName` / `createdAt` / `actions`). Result: no active-sort indicator, falls through to the table's default order. **Change to `userName`** (matches the human-readable header label "Usuario"). Behavior change: initial sort is now by user name ascending instead of undefined/by-table-default. Spec this explicitly.
- **G9 tests (HIGH)**: `views/__tests__/AdminTenantMembersView.test.ts` (strip + port — current 547-line spec is `expect(wrapper.vm).toBeDefined()` stub-weak, `useServerTable` mock lacks `isError`/`error`) + `composables/__tests__/useMembershipColumns.test.ts` + `composables/__tests__/useMembershipViewMode.test.ts`.

### Out of Scope

- **`memberships.api.ts` local-filter semantics — CORRECT, untouchable**: `membershipsApi.getPaginated(tenantId, params)` fetches the FULL catalog and applies local filter/sort/paginate (`:114-136`). Same shape as `tenants.api.ts` / `roles.api.ts` — semantically correct for a non-paginated backend. **Forbidden** to touch in apply. State explicitly here so future readers don't "fix" it.
- **#filters slot — NOT applicable** (rejected Option 2). No `includeInactive`/`isActive` query param exists on the backend. A local "Mostrar inactivos" toggle would require extending `applyLocalMembershipFilters`, which is a separate product decision (not part of Fase 2 sibling parity).
- **Eligible-users picker rework** in `MembershipUpsertSlideover` — debounced search + min 2 chars already correct (commit precedent). Untouched.
- **Slideover rework** (`create` / `edit` mode split, role select UX) — out of scope; tested and stable.
- **Bulk ops / row selection** — none (no bulk membership ops; CASL `userCan` already in place).
- **`useTenantSummary`** — already correct, header depends on it. Untouched.
- **Route change** — `/admin/tenants/:tenantId/members` (`requiresSuperAdmin` + `skipTenantCheck`) stays; `tenantId` source is `route.params.tenantId` (NOT `authStore` — unlike users/roles views). Preserve.
- **No `MembershipTableRow` type change, no new route, no backend change, no `memberships.api.ts` change.**

### Already in Place (do NOT redo)

- `defaultPinning: { left: [], right: ['actions'] }` on `AdminTenantMembersView.vue:81` ✅.
- `defaultPageSize: 10`, `persistKey: 'admin-tenant-members-{tenantId}'` (per-tenant, intended — precedent-consistent) ✅.
- `AdminPageHeader` + `useTenantSummary` (header) ✅.
- `SortableHeader` on `userName` / `roleName` / `createdAt` ✅.
- Add button via `AppDataTable` props (`add-button-text="Agregar miembro"`) ✅.
- CASL `userCan` gates on `read` / `create` / `update` / `delete` for `TenantMembership` ✅.
- Create / edit `MembershipUpsertSlideover` + `ConfirmModal` remove flow ✅.
- `useEligibleUsersQuery` (min 2 chars, 300ms debounce, `keepPreviousData`) ✅.
- `appBadge tone="info" :label="row.original.roleName"` single-chip pattern ✅.
- `dateFormatter` (es-AR, `day: '2-digit', month: 'short', year: 'numeric'`) ✅.
- `getInitials(name)` helper (table-cell avatar) ✅.

## Capabilities

### New

- `admin-tenant-members-list` — source-of-truth spec for the admin tenant members list view: surfaced backend errors, working column-visibility selector, `localStorage` `admin-tenant-members-view-mode` table/card preference, TenantCard-pattern card rendering with `EntityAvatar(name=userName, seed=userId||id, lg)` + `StatusDotBadge(userIsActive → activityToBadgeTone, null-safe)` + `AppBadge(roleName, info)` + click-to-edit slideover (guarded on `canUpdateMembership`), explicit column flags on all 4 columns, fixed `defaultSorting` targeting `userName`. CASL `userCan` kebab governs table actions. Slideover + eligible-users picker stay governed by other capabilities.

> No existing `admin-tenant-members` capability in `openspec/specs/`. Whole capability is `ADDED`; original `AdminTenantMembersView` pre-dates the spec system. No `MODIFIED` block needed.

### Modified

None.

## Approach

Mirror `AdminTenantsView.vue` (post-standardization, on the unmerged `feat/standardize-admin-tenants-table` branch) 1:1: same `useServerTable` destructure, same `*ErrorMessage` shape (backend `response.data.message` → `error.message` → "No se pudieron cargar los miembros. Reintenta."), same `<ViewToggle>` wiring in `#actions`, same `enable-column-visibility`. Reuse `useViewMode` from `@/core/shared/composables/useViewMode`. Cards follow the **TenantCard** pattern — `article` root, `EntityAvatar(name=userName, seed=userId || id, lg)`, `userName` + `userEmail` header, chip row = `AppBadge(roleName, info)` + `StatusDotBadge(userIsActive → activityToBadgeTone, compact, only when defined — null-safe via optional chaining)`, `border-t border-dashed border-default` divider, 2-col body (`Rol` info chip + `Fecha de ingreso` es-AR). NO kebab on the card (TenantCard parity; destructive actions stay on the table row). Card click emits `card-click`; `AdminTenantMembersView` calls `openEdit(membership)` only when `canUpdateMembership.value === true` (otherwise no-op — same defensive guard kebab already enforces). `defaultSorting` fixed to `userName` ascending. WU-B ships **without tests** (Fase 1 + Fase 2-#1/#2/#3 lesson: customers/users/roles/tenants WU-B all went over budget). Tests land in their own WU-C.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/admin/tenants/memberships/views/AdminTenantMembersView.vue` | Modified | `isError`/`error` destructure, `membershipsErrorMessage`, `enable-column-visibility`, `:display-mode`, `ViewToggle` slot, `#cards` slot, card-click → `openEdit(membership)` guarded on `canUpdateMembership`, `defaultSorting` `userEmail` → `userName` bug fix. |
| `src/features/admin/tenants/memberships/composables/useMembershipViewMode.ts` | **New** | Storage key `admin-tenant-members-view-mode`; `isMembershipViewMode` guard; returns `{ viewMode, setMode, toggleViewMode, displayMode }` (bridges `card` → `cards`). |
| `src/features/admin/tenants/memberships/components/MemberCard.vue` | **New** | `defineProps<{ membership }>`, emits `click`. TenantCard pattern (no kebab). `EntityAvatar(name=userName, seed=userId||id, lg)` + `userName` + `userEmail` + chip row (`AppBadge(roleName, info)` + null-safe `StatusDotBadge(userIsActive)`) + dashed divider + 2-col body (`Rol` info chip + `Fecha de ingreso` es-AR). |
| `src/features/admin/tenants/memberships/components/MemberCardGrid.vue` | **New** | `defineProps<{ memberships, loading, empty }>`, emits `card-click`. Ladder `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7`, 8 skeletons, empty icon `i-lucide-users`. |
| `src/features/admin/tenants/memberships/composables/useMembershipColumns.ts` | Modified | Explicit `enableSorting` / `enableHiding` on all 4 columns; `userName` / `roleName` / `createdAt` already `SortableHeader`; `actions` sortable=false, hideable=false (preserved). |
| `src/features/admin/tenants/memberships/views/__tests__/AdminTenantMembersView.test.ts` | **New** (port + strip) | Mocks `useServerTable` incl. `isError` / `error` mockState; pins error block + precedence + retry, `ViewToggle` + `localStorage` `admin-tenant-members-view-mode`, `enable-column-visibility`, kebab CASL gates (`Editar rol` / `Eliminar miembro`), card-click → edit slideover guarded on `canUpdateMembership` (no `router.push`), `defaultSorting` `userName` ascending, `userIsActive` null-safe chip. |
| `src/features/admin/tenants/memberships/composables/__tests__/useMembershipColumns.test.ts` | **New** | Locks column order (4), sortability + hideability flags (3 data sortable + hideable, `actions` non-sortable + non-hideable), header text (`Usuario`, `Rol`, `Fecha de ingreso`). |
| `src/features/admin/tenants/memberships/composables/__tests__/useMembershipViewMode.test.ts` | **New** | `localStorage` round-trip under key `admin-tenant-members-view-mode`, `isMembershipViewMode` guard, `displayMode` bridge (`card` → `cards`). |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Card click → edit slideover drops the "Eliminar miembro" workflow in card mode | Med | **Accepted by design**: cards open `openEdit` (kebab parity); "Eliminar miembro" stays table-kebab. Card view is an alternate read; destructive actions live on the table row. Guarded: card-click is a no-op when `canUpdateMembership` is false. |
| `userIsActive` is optional on `MembershipTableRow` — chip must be null-safe | Med | `StatusDotBadge` rendered only when `props.membership.userIsActive !== undefined`; tone via `activityToBadgeTone(props.membership.userIsActive)`. Spec the null-safe branch explicitly. |
| `defaultSorting` `userEmail` → `userName` is a behavior change (initial sort order shifts) | Med | Spec'd explicitly in `admin-tenant-members-list` capability. `userName` is the human-readable "Usuario" column; matches what a user would expect on landing. |
| Existing 547-line spec is `expect(wrapper.vm).toBeDefined()` stub-weak and `useServerTable` mock lacks `isError`/`error` | Med | WU-C strips + ports per tenants WU-C 3.1 precedent. New spec file in same path, no RED-stub collisions. |
| Reference patterns live on unmerged branches (`feat/standardize-admin-tenants-table`, `feat/standardize-admin-users-table`, `feat/standardize-admin-roles-table`) — `git show` access only | Low | `git show feat/standardize-admin-tenants-table:<path>` during apply reads the live branch bytes. No file-level cross-branch conflicts (members creates its own `MemberCard` / `MemberCardGrid` / `useMembershipViewMode`). |
| `tenantId` from `route.params.tenantId` (not `authStore`) is unusual vs users/roles views | Low | Stated explicitly in `Already in Place`. `requiresSuperAdmin` + `skipTenantCheck` route guard already enforces the right context. No change to scoping. |
| ~600 total lines, at/over the 400-line budget edge | Med | 3 work units; WU-B (cards) ships without tests so the heaviest single commit stays under 400. Tenants precedent (3 WUs, ~600 lines) accepted the same split. |
| `useMembershipViewMode` per-tenant `localStorage` key churn across tenants | Low | Intended. Precedent: `persistKey: 'admin-tenant-members-{tenantId}'` already per-tenant for table state. View-mode key is global (`admin-tenant-members-view-mode`, no tenantId) — user preference is cross-tenant. |
| Local filter semantics look fine here but a future backend move to true server-side pagination could regress silently | Low | `memberships.api.ts` is untouchable in this change; explicitly stated as a non-goal. If the backend later paginates, the full-dataset assumption + `defaultSorting` fix + column flags need revisiting. |

## Rollback Plan

Revert the merge commit. Error handling is additive (`membershipsErrorMessage` falls back to the existing empty state when `error` is `null`). Removing the card view deletes the new composable + 2 components and strips the `#cards` slot — no breaking change to the table view. The column-visibility toggle is opt-in (a toolbar menu); removing the prop reverts to the previous dead selector. `defaultSorting` revert (`userName` → `userEmail`) restores the latent bug but is a one-line change; if the bug is "fixed" in production long enough, prefer a fresh commit on top rather than re-introducing the defect. `useMembershipViewMode` deletion + slot removal is the only non-additive step. `AdminPageHeader` + `useTenantSummary` stay untouched. Tests live next to the code they pin, so reverting WU-C alone removes them.

## Dependencies

`useViewMode` (Customers/Promotions/Sales/Users/Roles/Tenants already use it); `ViewToggle`; `EntityAvatar` / `AppBadge` / `StatusDotBadge` (shared kit); `activityToBadgeTone` (shared util); `useServerTable` already returns `isError` / `error`; `AdminPageHeader` (shared with `AdminUsersView`, `AdminRolesView`, `AdminTenantsView`, `AdminTenantMembersView` already); `MembershipUpsertSlideover` + `ConfirmModal` (in place). No new dependency on `houndfe-backend`.

## Success Criteria

- [ ] Failed list requests render a backend-derived error; empty placeholder only on empty success.
- [ ] ViewToggle switches table ↔ card; persists in `localStorage` under `admin-tenant-members-view-mode`; cards match TenantCard pattern.
- [ ] Card click opens `MembershipUpsertSlideover` in edit mode (same `openEdit` as kebab) **only when `canUpdateMembership` is true**; no `router.push`, no detail route introduced; no-op when permission is false.
- [ ] Card chip row: `AppBadge(roleName, info)` always present; `StatusDotBadge(userIsActive, compact)` rendered only when `userIsActive !== undefined` (null-safe).
- [ ] `userName` / `roleName` / `createdAt` remain sortable; `actions` non-sortable.
- [ ] All 3 data columns hideable: `userName`, `roleName`, `createdAt`. `actions` non-hideable.
- [ ] `defaultSorting` is `[{ id: 'userName', desc: false }]`; `userEmail` reference removed (latent bug fixed).
- [ ] `AdminPageHeader` + `useTenantSummary` header untouched; `tenantId` from `route.params.tenantId` preserved.
- [ ] CASL `userCan` kebab (`Editar rol` / `Eliminar miembro`) remains unchanged; `userCan('read', 'TenantMembership')` gating on the section stays.
- [ ] `pnpm test:unit --run` passes with the three new files green; `pnpm build` clean.
- [ ] No `MembershipTableRow` type change; no new route; no backend change; `memberships.api.ts` contract untouched.

## Work Units (forecast)

- **WU-A — view mode + error handling + column selector + explicit column flags + `defaultSorting` bug fix (~140-170 lines)**: `useMembershipViewMode` + `AdminTenantMembersView` destructure / `membershipsErrorMessage` / `enable-column-visibility` / `ViewToggle` slot / `defaultSorting` `userEmail` → `userName`; `useMembershipColumns.ts` `enableSorting`/`enableHiding` flags on all 4 columns + existing `SortableHeader` slots preserved.
- **WU-B — card view (~160-190 lines). No tests** (Fase 1 + Fase 2-#1/#2/#3 lesson: customers/users/roles/tenants WU-B all went over budget). `MemberCard` (null-safe `userIsActive` chip), `MemberCardGrid` (ladder grid + `i-lucide-users` empty icon), card-click → `openEdit` guarded on `canUpdateMembership`, `AppBadge(roleName, info)` + `StatusDotBadge(userIsActive)` chip row.
- **WU-C — tests (~270-310 lines)**: strip + port `AdminTenantMembersView.test.ts` (replace `expect(wrapper.vm).toBeDefined()` stub, add `isError`/`error` mockState) + `useMembershipColumns.test.ts` + `useMembershipViewMode.test.ts`. Pins error precedence, ViewToggle persistence, column-visibility, kebab CASL gates, card-click guard, `defaultSorting` `userName`, `userIsActive` null-safe.

Review Workload Forecast: `Decision needed before apply: No`, `Chained PRs recommended: No` (NO PRs — conventional commits on branch, user merges manually to main, per session preflight), `400-line budget risk: Medium` — WU-B is heaviest but stays under 400 if `MemberCard.vue` stays lean (no kebab, no checkbox, no filter slot).
