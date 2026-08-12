# Design: Standardize Admin Tenant Members Table

## Technical Approach

Mirror the archived `standardize-admin-tenants-table` 1:1: `isError`/`error` destructure + `membershipsErrorMessage`, `useMembershipViewMode` (wraps shared `useViewMode`), `ViewToggle` in `#actions`, `enable-column-visibility`, EmployeeCard-pattern `MemberCard`/`MemberCardGrid` with click-to-edit guarded on `canUpdateMembership`, explicit column flags, and the `defaultSorting` bug fix (`userEmail` → `userName`). Code reading verified the real column ids (`userName`, `roleName`, `createdAt`, `actions`). `memberships.api.ts` untouchable (REQ-7); no type, route, or backend change.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Error precedence | — | `response.data.message` (string \| array[0]) → `error.message` → `'No se pudieron cargar los miembros. Reintenta.'` |
| View-mode key | Table persistKey is per-tenant | Global `admin-tenant-members-view-mode` (cross-tenant preference, no tenantId); `persistKey: 'admin-tenant-members-{tenantId}'` unchanged |
| Role chip placement | Spec REQ-3 lists `AppBadge(roleName)` beside `StatusDotBadge` in the chip row; UserCard/EmployeeCard put roles in the body | Body `Rol` column = `AppBadge(roleName, info)`; chip row = `StatusDotBadge` only — see Open Questions |
| `userIsActive` null-safety | Optional on `MembershipTableRow` | Render `StatusDotBadge` only when `!== undefined`; tone via `activityToBadgeTone`, labels `Activo`/`Inactivo` |
| Card-click guard | Existing `openEdit` is ungated (kebab gates via `getRowItems`) | Add `if (!canUpdateMembership.value) return` inside `openEdit` (AdminTenantsView parity); `handleCardClick` delegates |
| Kebab / add flow | — | Untouched: `getRowItems` CASL-gated, `@add` preserved |
| WU-B tests | Card WUs historically over budget | None in WU-B; all in WU-C |
| 547-line spec | Stub-weak (`wrapper.vm` asserts); mock lacks `isError`/`error` | Strip mounts; keep solid unit + permission-guards tests; add `isError`/`error` to mock |

## Data Flow

```
useServerTable ──isError/error──▶ membershipsErrorMessage ──▶ AppDataTable :error/:error-message
useMembershipViewMode ──▶ ViewToggle(#actions) ──▶ :display-mode ──▶ #cards ──▶ MemberCardGrid
MemberCard click ──▶ card-click ──▶ handleCardClick ──▶ openEdit (guard) ──▶ MembershipUpsertSlideover (edit)
```

## File Changes

| File | Action | WU | Description |
|---|---|---|---|
| `memberships/composables/useMembershipViewMode.ts` | Create | A | `useViewMode` wrapper: key `admin-tenant-members-view-mode`, `['table','card']`, default `table`; `isMembershipViewMode`; `{ viewMode, setMode, toggleViewMode, displayMode }` (`card`→`cards`) |
| `memberships/composables/useMembershipColumns.ts` | Modify | A | Explicit `enableSorting`/`enableHiding` on all 4: data cols `true/true`; `actions` `false/false` (kept) |
| `memberships/views/AdminTenantMembersView.vue` | Modify | A+B | A: destructure `isError`/`error`, `membershipsErrorMessage`, `:error`/`:error-message`, `enable-column-visibility`, `ViewToggle` in `#actions`, `:display-mode`, `defaultSorting: [{ id: 'userName', desc: false }]`. B: `openEdit` guard, `handleCardClick`, `#cards` |
| `memberships/components/MemberCard.vue` | Create | B | `article` + `EntityAvatar(userName, seed=userId\|\|id, lg)` + name/email + null-safe `StatusDotBadge` + dashed divider + 2-col body (`Rol` `AppBadge(info)` + `Fecha de ingreso` es-AR); single `click` emit |
| `memberships/components/MemberCardGrid.vue` | Create | B | Ladder 1/2/3/5/7, 8 skeletons, `i-lucide-users` empty |
| `memberships/views/__tests__/AdminTenantMembersView.test.ts` | Create | A+C | WU-A RED stubs (error precedence, `defaultSorting` arg, column-visibility, `display-mode`); WU-C expands (persistence, kebab, card-click, retry, header, add-flow) |
| `memberships/views/__tests__/AdminTenantMembersView.spec.ts` | Modify | C | Strip stub-weak mounts; keep query-key/pageSize/persistKey/pinning/invalidation + permission-guards tests; add `isError`/`error` to mock |
| `memberships/composables/__tests__/useMembershipColumns.test.ts` | Create | C | Order `[userName, roleName, createdAt, actions]`; headers `Usuario/Rol/Fecha de ingreso`; flags |
| `memberships/composables/__tests__/useMembershipViewMode.test.ts` | Create | C | Storage round-trip, guard, invalid→`table`, `displayMode` bridge |

## Interfaces / Contracts

```ts
// useMembershipViewMode.ts — byte-for-byte useTenantViewMode mirror
export type MembershipViewMode = 'table' | 'card'
export const MEMBERSHIP_VIEW_MODE_STORAGE_KEY = 'admin-tenant-members-view-mode'
export function isMembershipViewMode(value: string): value is MembershipViewMode
export function useMembershipViewMode(): {
  viewMode: Ref<MembershipViewMode>; setMode(m): void
  toggleViewMode(): void; displayMode: ComputedRef<'table' | 'cards'>
}

// MemberCard.vue — no kebab/checkbox; article[data-testid="member-card"]
defineProps<{ member: MembershipTableRow }>()
defineEmits<{ click: [member: MembershipTableRow] }>()
// StatusDotBadge: v-if member.userIsActive !== undefined; label Activo/Inactivo
// body: Rol → AppBadge(:label=roleName, tone="info")
//       Fecha de ingreso → dateFormatter(createdAt), '-' fallback

// MemberCardGrid.vue
defineProps<{ members: MembershipTableRow[]; loading?: boolean; empty?: string }>()
defineEmits<{ 'card-click': [member: MembershipTableRow] }>()

// AdminTenantMembersView.vue — new/changed
//   destructure isError/error; membershipsErrorMessage computed
//   (response.data.message string|array[0] → error.message → fallback)
//   useMembershipViewMode(); handleViewModeChange (guard + setMode)
//   openEdit: early-return unless canUpdateMembership; handleCardClick → openEdit
// AppDataTable: :error="isError" :error-message="membershipsErrorMessage"
//   :display-mode="displayMode" enable-column-visibility
//   #actions → ViewToggle(:model-value="viewMode", aria-label="Seleccionar vista de miembros")
//   #cards → MemberCardGrid(:members="data", :loading="isLoading || isFetching",
//     empty="No se encontraron miembros", @card-click="handleCardClick")
```

## Work Units

| WU | Files | Commit message (conventional) |
|---|---|---|
| A | `useMembershipViewMode.ts`, `useMembershipColumns.ts`, `AdminTenantMembersView.vue`, `AdminTenantMembersView.test.ts` (RED stubs) | `feat(admin-tenant-members): add view mode, surface list errors, fix default sort` |
| B | `MemberCard.vue`, `MemberCardGrid.vue`, `AdminTenantMembersView.vue` | `feat(admin-tenant-members): add EmployeeCard-pattern card view with click-to-edit` |
| C | `AdminTenantMembersView.test.ts` (expand), `AdminTenantMembersView.spec.ts` (strip), `useMembershipColumns.test.ts`, `useMembershipViewMode.test.ts` | `test(admin-tenant-members): cover list view, view mode, columns, and gating` |

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | Columns | Order, headers, `enableSorting`/`enableHiding` per column, `actions` `text-right` |
| Unit | View mode | Key round-trip, guard (`cards`/`grid`/`''` rejected), invalid→`table`, toggle, `card`→`cards` bridge |
| Unit (view) | `AdminTenantMembersView.test.ts` | Mock `useServerTable` (mockState incl. `isError`/`error`), `useAuthStore` (per-action `userCan`), `@tanstack/vue-query`, router (`useRoute` tenant-123, `push` spy), `tenants.api`; stub `AppDataTable` (`data-error`/`data-error-message`/`data-column-visibility`/`data-display-mode`, error/empty branches, `actions`/`cards` slots), `MemberCardGrid`, `MembershipUpsertSlideover` (`data-mode`/`data-membership-id`), `ViewToggle`, `AdminPageHeader` (`data-title`), `UDropdownMenu` (`kebab-menu`); real `useMembershipViewMode` + `useTenantSummary` (fast path). Cases: error block (backend msg / array[0] / `error.message` / fallback / retry→`refresh` / empty suppressed); `display-mode` default `table`, stored `card`→`cards`, invalid→`table`; column-visibility; `defaultSorting: [{id:'userName',desc:false}]`, no `userEmail`; kebab only when `getRowItems` non-empty; card-click → edit slideover, no `router.push`, no-op without `canUpdateMembership`; header; add-flow |

## Threat Matrix

N/A — no routing change (`openEdit` sets local state, no `router.push`), no shell/subprocess/VCS automation, no executable-file classification, no process integration.

## Migration / Rollout

No migration. Rollback: A reverts composable/columns/view edits; B deletes card files + `#cards` + `handleCardClick`; C removes new tests and restores the stripped spec section.

## Open Questions

- [ ] Card-mode errors: `AppDataTable`'s `#cards` branch bypasses the `error` block — a failed request renders the grid's empty state. Parity limitation (tenants/users/roles identical); fix belongs in `AppDataTable`, out of scope.
- [ ] Spec REQ-3 lists `AppBadge(roleName)` beside `StatusDotBadge` in the chip row; the design places the role chip in the body `Rol` column (UserCard/EmployeeCard parity). Reconcile spec wording at archive if verify flags it.
