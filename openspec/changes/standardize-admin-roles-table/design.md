# Design: Standardize Admin Roles Table

## Technical Approach

Mirror the archived `standardize-admin-users-table` 1:1: error surfacing, `useRoleViewMode`, `ViewToggle`, `enable-column-visibility`, EmployeeCard-pattern cards (click-only), `AdminPageHeader`, per-row `isSystem` gate. One addition: the table has **no `description` column** — REQ-5/6/8 require it, added like users' `email`. Counts become `SortableHeader`; `applyLocalRoleFilters` (`roles.api.ts:48-52`) already sorts numbers over the full catalog.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| `description` column | Absent today; REQ-6/8 mandate hideable `Descripción` (pos 2) | **Add** `accessorKey: 'description'` + null-safe `#description-cell` |
| RoleCard props | No kebab on card | **`{ role: RoleTableRow }`**, single `click`; gate in existing `openEdit` |
| `isSystem` chip | Spec lists content, proposal lists order | **`StatusDotBadge(tone="info", label="Sistema", compact)`** first, then counts |
| Count chips | `AppBadge :value` renders bare number | **`AppBadge :label`** — `tone info` (permisos), `tone type` outline (usuarios) |
| View mode | — | `useUserViewMode` shape: key `admin-roles-view-mode`, `['table','card']`, default `table`, `isRoleViewMode`, `displayMode` bridge |
| Error precedence | — | `response.data.message` (string or array[0]) → `error.message` → `'No se pudieron cargar los roles. Reintenta.'` |
| Card click | No detail route | `handleCardClick(role) → openEdit(role)`; no `router.push` |
| `isSystem` gate | `window.alert` (`:139-142`) is runtime, not UX | `getRowItems`: `destructiveActions = canDeleteRole.value && !role.isSystem ? [Eliminar] : []` |
| WU-B tests | Customers + users WU-B over budget | No tests in WU-B; all in WU-C |

## Data Flow

```
useServerTable ──isError/error──▶ rolesErrorMessage ──▶ AppDataTable :error/:error-message
useRoleViewMode ──▶ ViewToggle(#actions) ──▶ :display-mode ──▶ #cards ──▶ RoleCardGrid
RoleCard click ──▶ card-click ──▶ handleCardClick ──▶ openEdit ──▶ RoleUpsertSlideover (edit)
```

## File Changes

| File | Action | WU | Description |
|---|---|---|---|
| `admin/roles/composables/useRoleViewMode.ts` | Create | A | `useViewMode` wrapper + `isRoleViewMode` + `displayMode` |
| `admin/roles/composables/useRoleColumns.ts` | Modify | A | Add `description` (pos 2); explicit `enableSorting`/`enableHiding` everywhere; counts sortable |
| `admin/roles/views/AdminRolesView.vue` | Modify | A+B | A: `isError`/`error` destructure, `rolesErrorMessage`, `:error`/`:error-message`, `enable-column-visibility`, `ViewToggle`, `:display-mode`, `AdminPageHeader`, `isSystem` gate, `#description-cell`, count header slots. B: `RoleCardGrid` + `#cards` + `handleCardClick` |
| `admin/roles/components/RoleCard.vue` | Create | B | `article` + `EntityAvatar` + chips + divider + 2-col body |
| `admin/roles/components/RoleCardGrid.vue` | Create | B | Ladder 1/2/3/5/7, 8 skeletons, `i-lucide-shield` empty |
| `admin/roles/views/__tests__/AdminRolesView.test.ts` | Create | C | View tests |
| `admin/roles/composables/__tests__/useRoleColumns.test.ts` | Create | C | Order, flags, headers |

## Interfaces / Contracts

```ts
// useRoleViewMode.ts — byte-for-byte useUserViewMode mirror
export type RoleViewMode = 'table' | 'card'
export const ROLE_VIEW_MODE_STORAGE_KEY = 'admin-roles-view-mode'
export function isRoleViewMode(value: string): value is RoleViewMode
export function useRoleViewMode(): {
  viewMode: Ref<RoleViewMode>; setMode(m: RoleViewMode): void
  toggleViewMode(): void; displayMode: ComputedRef<'table' | 'cards'>
}

// RoleCard.vue — no kebab/checkbox/permission props; article[data-testid="role-card"]
defineProps<{ role: RoleTableRow }>()
defineEmits<{ click: [role: RoleTableRow] }>()
// EntityAvatar(:name, :seed=role.id, lg) + name + description (line-clamped, null-safe)
// chip row: <StatusDotBadge v-if="role.isSystem" tone="info" label="Sistema" compact />
//           <AppBadge tone="info" :label="`${permissionCount} permisos`" />
//           <AppBadge tone="type" variant="outline" :label="`${userCount} usuarios`" />
// dashed divider; 2-col body: Descripción (null → '—') | Creación (es-AR)

// RoleCardGrid.vue
defineProps<{ roles: RoleTableRow[]; loading?: boolean; empty?: string }>()
defineEmits<{ 'card-click': [role: RoleTableRow] }>()

// AdminRolesView.vue
const headerDescription = computed(() =>
  `Administrá los roles y permisos de ${authStore.currentTenant?.name ?? '(Global)'}`)
function handleCardClick(role: RoleTableRow) { openEdit(role) }
// getRowItems: destructiveActions gated by `canDeleteRole.value && !role.isSystem`
// new slots: #description-cell (muted, `?? '—'`), #permissionCount-header,
//   #userCount-header (<SortableHeader label="Permisos|Usuarios"/>)
```

`rolesApi.getPaginated` (`roles.api.ts`) is **untouchable** — `useAdminRolesQuery` couples to it (REQ-7).

## Work Units

| WU | Files | Commit message (conventional) |
|---|---|---|
| A | `useRoleViewMode.ts`, `useRoleColumns.ts`, `AdminRolesView.vue` | `feat(admin-roles): add view mode, surface list errors, expose description column` |
| B | `RoleCard.vue`, `RoleCardGrid.vue`, `AdminRolesView.vue` | `feat(admin-roles): add EmployeeCard-pattern card view with click-to-edit` |
| C | `AdminRolesView.test.ts`, `useRoleColumns.test.ts` | `test(admin-roles): cover list view, view mode, columns, and kebab gating` |

## Testing Strategy

`AdminRolesView.test.ts` mirrors `AdminUsersView.test.ts`: mock `useServerTable` (mockState incl. `isError`/`error` refs), `useAuthStore`, `@tanstack/vue-query`; stub `AppDataTable` (`data-error`/`data-error-message`/`data-column-visibility`/`data-display-mode` attrs, `actions`/`cards`/`actions-cell` slots), `ViewToggle`, `SortableHeader`, `RoleCardGrid`, `RoleUpsertSlideover` (`data-role-id`/`data-mode`), `RolePermissionsSlideover`, `AppBadge`, `ConfirmModal`, `AdminPageHeader` (`:data-title`), `@nuxt/ui`. Real `useRoleViewMode` (localStorage-driven). Cases: error block (backend msg / `error.message` / Spanish fallback / retry→`refresh` / empty suppressed); `display-mode` default `table`, localStorage `card`→`cards`, invalid→`table`; `enable-column-visibility`; kebab presence via `reka-dropdown-menu-trigger`; **isSystem gate**: mounted `UDropdownMenu` `props('items')` flattened — `Editar`+`Permisos` present, no `Eliminar`; card click → edit slideover (`data-role-id`), no `router.push`. `useRoleColumns.test.ts`: order `[name, description, permissionCount, userCount, createdAt, actions]`; headers `Nombre`/`Descripción`/`Permisos`/`Usuarios`/`Creación`; name/createdAt/counts sortable; description non-sortable + hideable; actions non-sortable/non-hideable/`text-right`.

## Threat Matrix

N/A — slideover (no `router.push`), no shell/subprocess/VCS automation, no executable classification, no process integration.

## Migration / Rollout

No migration. Rollback: A reverts composable/columns/view edits; B deletes card files + `#cards` + `handleCardClick`; C removes tests only.

## Open Questions

- [ ] Card-mode errors: AppDataTable's `#cards` branch bypasses the `error` block — a failed request renders the grid's empty state. Parity limitation (Customers/Users identical); fix belongs in AppDataTable, out of scope.
- [ ] Chip order: spec lists `userCount`→`permissionCount`→`isSystem`; proposal lists `Sistema` first. Design pins proposal order; reconcile at archive.
- [ ] Proposal implies `description` exists today — it does not. Design adds it within "Modified" scope; no proposal edit this phase.
