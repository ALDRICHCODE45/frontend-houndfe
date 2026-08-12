# Proposal: Standardize Admin Tenants Table

## Intent

Bring `AdminTenantsView.vue` to Fase 2 parity with the just-archived `standardize-admin-roles-table` (Fase 2 #2). Today this view masks failures ("No se encontraron sucursales" on a crashed request), offers no card view, leaves the column-visibility selector dead-bound, uses an inline `<h2>` instead of the admin convention, and parks `includeInactive` outside the table toolbar. CRUD flows through `TenantUpsertSlideover` (kebab → `isSuperAdmin`-gated, since tenants are a global resource, not CASL-permission-based). `tenants.api.ts` `getPaginated` already fetches the FULL `/admin/tenants` array and applies local filter/sort/paginate (`tenants.api.ts:29-90`) — like `roles.api.ts`, this is **semantically CORRECT** (no backend pagination), so the existing `SortableHeader` slots on `name` / `slug` / `createdAt` can stay cheap. `isActive` stays non-sortable (boolean comparator would be a no-op; local comparator handles string/number only at `:44-58`).

## Scope

### In Scope

- **G1 error handling (HIGH)**: destructure `isError` / `error` from `useServerTable` (`AdminTenantsView.vue:36-51`); compute `tenantsErrorMessage`; pass `:error` + `:error-message` to `<AppDataTable>` (`:218-241` passes neither today). No "No se encontraron sucursales" on a failed request.
- **G2 view mode + card view (HIGH)**: `useTenantViewMode` (wraps `useViewMode`, key `admin-tenants-view-mode`, modes `['table','card']`, default `table`), `TenantCard.vue`, `TenantCardGrid.vue`, `ViewToggle` in `#actions`, `#cards` slot, `:display-mode`. EmployeeCard pattern (avatar seeded by id, chip row, dashed divider, 2-col body). **Card click opens `TenantUpsertSlideover` in edit mode** (same `openEdit` the kebab triggers — kebab parity, no `router.push`, no detail route).
- **G3 column selector (MED)**: set `enable-column-visibility` on `AppDataTable` (`:223` binds `columnVisibility` but the dropdown is dead — same gap roles had). All data columns hideable: `name`, `slug`, `address`, `phone`, `isActive`, `createdAt`. `actions` stays non-hideable. `isActive` renders as `StatusDotBadge` (Activa/Inactiva) in card view.
- **G4 sortable columns (MED)**: `name` / `slug` / `createdAt` already use `SortableHeader`. `isActive` stays **non-sortable** (boolean comparator no-op — roles description precedent). `address`, `phone`, `actions` stay non-sortable.
- **G5 #filters slot (MED)**: move `includeInactive` `<UCheckbox>` from its own standalone `div` (`:213-216`) into `AppDataTable`'s `#filters` slot. Visible in **both** table and card modes (it's a query-key driver, not a UI decoration).
- **G6 header (MED)**: replace the inline `<h2>` + `<p>` block (`:207-211`) with `<AdminPageHeader title="Gestión de sucursales" :description="headerDescription" />` (matches `AdminTenantMembersView` which already uses it).
- **G7 explicit column flags (LOW)**: add `enableSorting` / `enableHiding` to every column in `useTenantColumns.ts`. Mirrors `useUserColumns.ts` / `useRoleColumns.ts` shape.
- **G8 tests (HIGH)**: `views/__tests__/AdminTenantsView.test.ts` + `composables/__tests__/useTenantColumns.test.ts` + `composables/__tests__/useTenantViewMode.test.ts`.

### Out of Scope

- **tenants.api.ts local-filter semantics — CORRECT, untouchable** (like roles): `tenantsApi.getPaginated({pageSize:1000})` fetches the FULL catalog and applies local filter/sort/paginate (`tenants.api.ts:29-90`). Unlike `users.api.ts`, this is not a defect. `tenantsApi.getPaginated` has NO other consumers today (safe to extend, but no change needed in this change). State explicitly here so future readers don't "fix" it. `tenants.api.ts` is **forbidden** to touch in apply.
- **memberships module** (`AdminTenantMembersView`, `useTenantSummary`, `/admin/tenants/:id/members`) — separate Fase 2 change. `useTenantSummary` is consumed by memberships view; do not touch.
- **`tenant-actions.utils.ts` stays as-is** (13 tests, permission-aware kebab builder). `Editar` + `Gestionar miembros` + `Desactivar` sections all keep current behavior. NO `isSystem`-style gate needed (no system-tenant concept).
- **`"Gestionar miembros"` kebab action stays** — it routes to memberships view (separate change owns that slice).
- **Reactivation UX rework** — only via edit slideover `isActive` toggle (edit-mode only), as today.
- **`isActive` sortable** — rejected (boolean comparator no-op; local comparator at `:44-58` is string/number only).
- **Bulk ops / row selection** — none (no bulk tenant ops; `isSuperAdmin` gate already in place).
- **No `TenantTableRow` type change, no new route, no backend change, no `tenants.api.ts` change.**

### Already in Place (do NOT redo)

- `defaultPinning: { left: [], right: ['actions'] }` on `AdminTenantsView.vue:57`.
- `isSuperAdmin` gate documented at `:134` ("global resource, not permission-based"). CASL `userCan` does NOT apply — keep the existing gate as-is.
- `persistKey: 'admin-tenants'` (`:55`) — separate from `admin-users` / `admin-roles`.
- `StatusDotBadge` + `activityToBadgeTone` for `isActive` ✅ (commit `622e5c6`).
- `SortableHeader` on `name` / `slug` / `createdAt` ✅.
- Add button via `AppDataTable` props ✅.
- Tenant scoping does NOT apply — query key `adminTenantQueryKeys.list(includeInactive)` has no `tenantId` (global resource, correct).
- Local filter/sort/pagination over the FULL dataset (`tenants.api.ts:29-90`) — correct semantics.
- `includeInactive` already drives the query key `{ includeInactive }` — moving it into `#filters` slot changes placement, not behavior.
- Toast copy uses `"Sucursal"` (neutral es post-voseo fix `5d954f6`) — keep.

## Capabilities

### New

- `admin-tenants-list` — source-of-truth spec for the admin tenants list view: surfaced backend errors, working column-visibility selector, `localStorage` `admin-tenants-view-mode` table/card preference, EmployeeCard-pattern card rendering with click-to-edit, `StatusDotBadge` chip + `includeInactive` filter in `#filters` slot, `AdminPageHeader` shell, `isSuperAdmin`-gated kebab. Slideover stays governed by other capabilities.

> No existing `admin-tenants` capability in `openspec/specs/`. Whole capability is `ADDED`; original `AdminTenantsView` pre-dates the spec system. No `MODIFIED` block needed.

### Modified

None.

## Approach

Mirror `AdminUsersView.vue` / `AdminRolesView.vue` (post-standardization, on the unmerged `feat/standardize-admin-users-table` / `feat/standardize-admin-roles-table` branches) 1:1: same `useServerTable` destructure, same `*ErrorMessage` shape (backend `response.data.message` → `error.message` → "No se pudieron cargar las sucursales. Reintenta."), same `<ViewToggle>` wiring in `#actions`, same `enable-column-visibility`. Reuse `useViewMode` from `@/core/shared/composables/useViewMode`. Cards follow the **EmployeeCard** pattern — `article` root, `EntityAvatar(name, seed=id, lg)`, `name` + `slug` header, chip row = `StatusDotBadge` (Activa / Inactiva, tone from `activityToBadgeTone`), `border-t border-dashed border-default` divider, 2-col body (`Dirección` `null-safe '—'`, `Creación` es-AR). NO kebab on the card (matches EmployeeCard parity; destructive actions stay on the table row). Card click emits `card-click`; `AdminTenantsView` opens `TenantUpsertSlideover` in edit mode (`openEdit(tenant)`). `includeInactive` `<UCheckbox>` moves into `AppDataTable`'s `#filters` slot so it stays visible in both table and card modes. `isActive` column stays non-sortable (boolean comparator no-op). WU-B ships **without tests** (Fase 1 + Fase 2-#1/#2 lesson: customers WU-B, users WU-B, roles WU-B all went over budget). Tests land in their own WU-C.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/admin/tenants/views/AdminTenantsView.vue` | Modified | `isError`/`error` destructure, `tenantsErrorMessage`, `enable-column-visibility`, `:display-mode`, `ViewToggle` slot, `#cards` slot, card-click → `TenantUpsertSlideover` open in edit mode, inline `<h2>` → `<AdminPageHeader>`, `#filters` slot hosts `includeInactive` `<UCheckbox>`. |
| `src/features/admin/tenants/composables/useTenantViewMode.ts` | **New** | Storage key `admin-tenants-view-mode`; `isTenantViewMode` guard; returns `{ viewMode, setMode, toggleViewMode, displayMode }` (bridges `card` → `cards`). |
| `src/features/admin/tenants/components/TenantCard.vue` | **New** | `defineProps<{ tenant }>`, emits `click`. EmployeeCard pattern (no kebab). `EntityAvatar(name, seed=id, lg)` + `name` + `slug` + `StatusDotBadge` chip row + dashed divider + 2-col body (`Dirección` `null-safe '—'`, `Creación` es-AR). |
| `src/features/admin/tenants/components/TenantCardGrid.vue` | **New** | `defineProps<{ tenants, loading, empty }>`, emits `card-click`. Ladder `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7`. Empty icon `i-lucide-building`. |
| `src/features/admin/tenants/composables/useTenantColumns.ts` | Modified | Explicit `enableSorting` / `enableHiding` on every column; `name` / `slug` / `createdAt` already `SortableHeader`; `isActive` sortable=false; `address` / `phone` / `actions` sortable=false; `actions` hideable=false. |
| `src/features/admin/tenants/views/__tests__/AdminTenantsView.test.ts` | **New** | Mocks `useServerTable` incl. `isError` mockState; pins error block + precedence + retry, ViewToggle + `localStorage` `admin-tenants-view-mode`, `enable-column-visibility`, `#filters` slot includes `includeInactive` (visible in both modes), kebab sections (`Editar` / `Gestionar miembros` / `Desactivar`), card-click → edit slideover (no `router.push`). |
| `src/features/admin/tenants/composables/__tests__/useTenantColumns.test.ts` | **New** | Locks column order, sortability + hideability flags, header text (`Nombre`, `Slug`, `Dirección`, `Teléfono`, `Estado`, `Creación`). |
| `src/features/admin/tenants/composables/__tests__/useTenantViewMode.test.ts` | **New** | `localStorage` round-trip under key `admin-tenants-view-mode`, `isTenantViewMode` guard, `displayMode` bridge (`card` → `cards`). |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Card click → edit slideover drops the "Gestionar miembros" workflow in card mode | Med | **Accepted by design**: cards open the same `openEdit` the kebab triggers. "Gestionar miembros" stays table-kebab (memberships = separate Fase 2 change; no detail route introduced). Card view is an alternate read; member management is the table's job. |
| Reference patterns live on unmerged branches (`feat/standardize-admin-users-table`, `feat/standardize-admin-roles-table`) — `git show` access only | Low | `git show feat/standardize-admin-roles-table:<path>` during apply reads the live branch bytes. No file-level cross-branch conflicts (tenants creates its own `TenantCard` / `TenantCardGrid` / `useTenantViewMode`). |
| Moving `includeInactive` into `#filters` slot is a UX relocation; if filters slot hides in card mode the toggle becomes invisible | Low | `#filters` slot is rendered above the body in both table and card modes (slots are not display-mode-gated in `AppDataTable`). If the host wants to verify, a `useTenantViewMode`-aware guard is overkill — slot is unconditionally present. |
| `isActive` rows currently can't be re-sorted by status — designers may ask "why isn't Estado sortable?" later | Low | Stated non-goal in this change; local comparator at `tenants.api.ts:44-58` is string/number only. Adding a boolean comparator is a separate, larger decision (touching `tenants.api.ts` is forbidden here). Future change can address. |
| ~650 total lines, at/over the 400-line budget edge | Med | 3 work units; WU-B (cards) ships without tests so the heaviest single commit stays under 400. Users precedent (796 insertions) accepted PASS WITH WARNINGS; roles precedent (~600) split the same way. |
| Local filter semantics look fine here but a future backend move to true server-side pagination could regress silently | Low | `tenants.api.ts` is untouchable in this change; explicitly stated as a non-goal. If the backend later paginates, both the column flags and the full-dataset assumption need revisiting. |
| `tenantsApi.getPaginated({pageSize:1000})` has no other consumers today, but a future consumer could couple to its current signature | Low | No signature change in this change. Document the full-array contract in the `admin-tenants-list` spec so future coupling is intentional. |

## Rollback Plan

Revert the merge commit. Error handling is additive (`tenantsErrorMessage` falls back to the existing empty state when `error` is `null`). Removing the card view deletes the new composable + 2 components and strips the `#cards` slot — no breaking change to the table view. Moving `includeInactive` back into a standalone `div` reverts G5 with no behavior change (query key still reacts to the checkbox). The column-visibility toggle is opt-in (a toolbar menu); removing the prop reverts to the previous dead selector. `AdminPageHeader` swap is a thin replacement of one block for another component; reverting restores the inline `<h2>`. Tests live next to the code they pin, so reverting WU-C alone removes them.

## Dependencies

`useViewMode` (Customers/Promotions/Sales/Users/Roles already use it); `ViewToggle`; `EntityAvatar` / `AppBadge` (shared kit); `useServerTable` already returns `isError` / `error`; `AdminPageHeader` (shared with `AdminUsersView`, `AdminRolesView`, `AdminTenantMembersView`); `StatusDotBadge` + `activityToBadgeTone` (already in place, commit `622e5c6`). No new dependency on `houndfe-backend`.

## Success Criteria

- [ ] Failed list requests render a backend-derived error; empty placeholder only on empty success.
- [ ] ViewToggle switches table ↔ card; persists in `localStorage` under `admin-tenants-view-mode`; cards match EmployeeCard pattern.
- [ ] Card click opens `TenantUpsertSlideover` in edit mode (same `openEdit` as kebab); no `router.push`, no detail route introduced.
- [ ] `name` / `slug` / `createdAt` remain sortable; `isActive` stays non-sortable; `address` / `phone` / `actions` non-sortable.
- [ ] All data columns hideable: `name`, `slug`, `address`, `phone`, `isActive`, `createdAt`. `actions` non-hideable. `isActive` rendered as `StatusDotBadge` (Activa / Inactiva) in card view.
- [ ] `includeInactive` `<UCheckbox>` lives in `AppDataTable` `#filters` slot, visible in both table and card modes, still drives the query key.
- [ ] Header uses `<AdminPageHeader>` with `title="Gestión de sucursales"`; inline `<h2>` removed.
- [ ] `defaultPinning.right: ['actions']` and the `isSuperAdmin`-gated kebab (`Editar` / `Gestionar miembros` / `Desactivar`) remain unchanged.
- [ ] `pnpm test:unit --run` passes with the three new files green; `pnpm build` clean.
- [ ] No `TenantTableRow` type change; no new route; no backend change; `tenants.api.ts` contract untouched.

## Work Units (forecast)

- **WU-A — view mode + error handling + column selector + header + #filters slot + explicit column flags (~160-190 lines)**: `useTenantViewMode` + `AdminTenantsView` destructure / `tenantsErrorMessage` / `enable-column-visibility` / `ViewToggle` slot / `includeInactive` move into `#filters` / inline-header → `<AdminPageHeader>`; `useTenantColumns.ts` `enableSorting`/`enableHiding` flags + `isActive` non-sortable marker + existing `SortableHeader` slots preserved.
- **WU-B — card view (~170-190 lines). No tests** (Fase 1 + Fase 2-#1/#2 lesson: customers WU-B, users WU-B, roles WU-B all went over budget). `TenantCard`, `TenantCardGrid`, card-click → `openEdit`, `StatusDotBadge` chip, empty-state icon `i-lucide-building`.
- **WU-C — tests (~280-320 lines)**: `AdminTenantsView.test.ts` + `useTenantColumns.test.ts` + `useTenantViewMode.test.ts`.

Review Workload Forecast: `Decision needed before apply: No`, `Chained PRs recommended: No` (NO PRs — conventional commits on branch, user merges manually to main, per session preflight), `400-line budget risk: Medium` — WU-B is heaviest but stays under 400 if `TenantCard.vue` stays lean (no kebab, no checkbox).