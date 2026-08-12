# Design: Standardize Admin Tenants Table

## Technical Approach

Mirror the archived `standardize-admin-roles-table` 1:1: error surfacing, `useTenantViewMode`, `ViewToggle`, `enable-column-visibility`, EmployeeCard-pattern cards (click-only), `AdminPageHeader`, `isSuperAdmin` kebab gate. One deviation found by code reading: the proposal/spec assume a `phone` column exists — it does not (`useTenantColumns.ts` has `name, slug, isActive, address, createdAt, actions`). Like roles' `description`, the design **adds** `phone` within Modified scope, in the proposal's pinned order (`name, slug, address, phone, isActive, createdAt, actions`). `tenants.api.ts` stays untouched (full-catalog local filter/sort/paginate is correct — REQ-7).

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| `phone` column | Absent today; REQ-5/6 + proposal test-lock (`…Dirección, Teléfono, Estado…`) mandate it | **Add** `accessorKey: 'phone'`, header `Teléfono`, non-sortable, hideable; no custom cell slot |
| Column order | Proposal order moves `isActive` from pos 3 → 5 | **Follow proposal order**: `name, slug, address, phone, isActive, createdAt, actions` |
| TenantCard props | No kebab on card | **`{ tenant: TenantTableRow }`**, single `click`; gate lives in existing `openEdit` |
| Card chip row | `StatusDotBadge` only | `activityToBadgeTone(isActive)` + label `Activa`/`Inactiva` (no isSystem equivalent) |
| View mode | — | `useRoleViewMode` shape: key `admin-tenants-view-mode`, `['table','card']`, default `table`, `isTenantViewMode`, `displayMode` bridge |
| Error precedence | — | `response.data.message` (string \| array[0]) → `error.message` → `'No se pudieron cargar las sucursales. Reintenta.'` |
| Header description | Tenants are global (no tenant name) | **Static** `'Gestión global de sucursales (solo super-admin).'` — not a computed |
| Existing `AdminTenantsView.spec.ts` | New destructure (`error.value`) breaks its `useServerTable` mock (no `isError`/`error`) | **Strip the mount section** (lines 140–226); port the StatusDotBadge case into `AdminTenantsView.test.ts`; keep pure unit tests (mapTenantError, query keys, confirm copy) |
| WU-B tests | Customers/users/roles WU-B over budget | No tests in WU-B; all in WU-C |

## Data Flow

```
useServerTable ──isError/error──▶ tenantsErrorMessage ──▶ AppDataTable :error/:error-message
useTenantViewMode ──▶ ViewToggle(#actions) ──▶ :display-mode ──▶ #cards ──▶ TenantCardGrid
TenantCard click ──▶ card-click ──▶ handleCardClick ──▶ openEdit ──▶ TenantUpsertSlideover (edit)
```

## File Changes

| File | Action | WU | Description |
|---|---|---|---|
| `admin/tenants/composables/useTenantViewMode.ts` | Create | A | `useViewMode` wrapper + `isTenantViewMode` + `displayMode` |
| `admin/tenants/composables/useTenantColumns.ts` | Modify | A | Add `phone`; explicit `enableSorting`/`enableHiding` everywhere; reorder per proposal |
| `admin/tenants/views/AdminTenantsView.vue` | Modify | A+B | A: `isError`/`error` destructure, `tenantsErrorMessage`, `:error`/`:error-message`, `enable-column-visibility`, `ViewToggle`, `:display-mode`, `AdminPageHeader`, `includeInactive` → `#filters`. B: `#cards` + `handleCardClick` |
| `admin/tenants/components/TenantCard.vue` | Create | B | `article` + `EntityAvatar` + name/slug + StatusDotBadge chip + divider + 2-col body |
| `admin/tenants/components/TenantCardGrid.vue` | Create | B | Ladder 1/2/3/5/7, 8 skeletons, `i-lucide-building` empty |
| `admin/tenants/views/__tests__/AdminTenantsView.test.ts` | Create | C | View tests (roles-style stubs) |
| `admin/tenants/views/__tests__/AdminTenantsView.spec.ts` | Modify | C | Strip mount section (superseded); keep unit tests |
| `admin/tenants/composables/__tests__/useTenantColumns.test.ts` | Create | C | Order, flags, headers |
| `admin/tenants/composables/__tests__/useTenantViewMode.test.ts` | Create | C | Storage round-trip, guard, bridge |

## Interfaces / Contracts

```ts
// useTenantViewMode.ts — byte-for-byte useRoleViewMode mirror
export type TenantViewMode = 'table' | 'card'
export const TENANT_VIEW_MODE_STORAGE_KEY = 'admin-tenants-view-mode'
export function isTenantViewMode(value: string): value is TenantViewMode
export function useTenantViewMode(): {
  viewMode: Ref<TenantViewMode>; setMode(m: TenantViewMode): void
  toggleViewMode(): void; displayMode: ComputedRef<'table' | 'cards'>
}

// TenantCard.vue — no kebab/checkbox/props beyond tenant; article[data-testid="tenant-card"]
defineProps<{ tenant: TenantTableRow }>()
defineEmits<{ click: [tenant: TenantTableRow] }>()
// EntityAvatar(:name, :seed=tenant.id, lg) + name + slug + StatusDotBadge chip row
// (activityToBadgeTone, 'Activa'/'Inactiva') + dashed divider + 2-col body:
// Dirección (?? '—') | Creación (es-AR)

// TenantCardGrid.vue
defineProps<{ tenants: TenantTableRow[]; loading?: boolean; empty?: string }>()
defineEmits<{ 'card-click': [tenant: TenantTableRow] }>()

// AdminTenantsView.vue — new/changed lines
const headerDescription = 'Gestión global de sucursales (solo super-admin).'
const { viewMode, setMode: setViewMode, displayMode } = useTenantViewMode()
function handleViewModeChange(mode: string) { if (!isTenantViewMode(mode)) return; setViewMode(mode) }
function handleCardClick(tenant: TenantTableRow) { openEdit(tenant) }
// AppDataTable: :error="isError" :error-message="tenantsErrorMessage" :display-mode="displayMode"
//   enable-column-visibility; #filters → UCheckbox includeInactive; #actions → ViewToggle
//   (aria-label "Seleccionar vista de sucursales"); #cards → TenantCardGrid(:tenants="data",
//   :loading="isLoading || isFetching", empty="No se encontraron sucursales", @card-click)
// Kebab gate unchanged: canManageTenantActions = authStore.isSuperAdmin
```

## Work Units

| WU | Files | Commit message (conventional) |
|---|---|---|
| A | `useTenantViewMode.ts`, `useTenantColumns.ts`, `AdminTenantsView.vue` | `feat(admin-tenants): add view mode, surface list errors, standardize header and filters` |
| B | `TenantCard.vue`, `TenantCardGrid.vue`, `AdminTenantsView.vue` | `feat(admin-tenants): add EmployeeCard-pattern card view with click-to-edit` |
| C | `AdminTenantsView.test.ts`, `AdminTenantsView.spec.ts`, `useTenantColumns.test.ts`, `useTenantViewMode.test.ts` | `test(admin-tenants): cover list view, view mode, columns, and gating` |

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | Columns + view mode | `useTenantColumns.test.ts`: order `[name, slug, address, phone, isActive, createdAt, actions]`; headers `Nombre/Slug/Dirección/Teléfono/Estado/Creación`; name/slug/createdAt sortable; address/phone/isActive non-sortable; actions non-sortable/non-hideable/`text-right`. `useTenantViewMode.test.ts`: key round-trip, guard, invalid→`table`, `card`→`cards` |
| Unit (view) | `AdminTenantsView.test.ts` | Mock `useServerTable` (mockState incl. `isError`/`error`), `useAuthStore` (`isSuperAdmin` toggle), `@tanstack/vue-query`, router push spy; stub `AppDataTable` (`data-error`/`data-error-message`/`data-column-visibility`/`data-display-mode` attrs, `actions`/`cards`/`filters` slots, error/empty branches), `TenantCardGrid`, `TenantUpsertSlideover` (`data-tenant-id`/`data-mode`), `StatusDotBadge`, `AdminPageHeader` (`:data-title`), `ViewToggle`, `UCheckbox`, `ConfirmModal`; real `useTenantViewMode`. Cases: error block (backend msg / `error.message` / fallback / retry→`refresh` / empty suppressed); `display-mode` default `table`, localStorage `card`→`cards`, invalid→`table`; `enable-column-visibility`; `#filters` includes UCheckbox in **both** modes; kebab presence via `reka-dropdown-menu-trigger` (super-admin only); opened menu shows `Editar`/`Gestionar miembros`/`Desactivar`; card-click → edit slideover (`data-tenant-id`), no `router.push`; isActive-cell StatusDotBadge (ported from spec) |

## Threat Matrix

N/A — slideover (no `router.push`), no shell/subprocess/VCS automation, no executable classification, no process integration.

## Migration / Rollout

No migration. Rollback: A reverts composable/columns/view edits; B deletes card files + `#cards` + `handleCardClick`; C removes new tests and restores the stripped spec section.

## Open Questions

- [ ] Card-mode errors: AppDataTable's `#cards` branch (`v-if="slots.cards"`) bypasses the `error` block — a failed request renders the grid's empty state. Parity limitation (roles/users identical); fix belongs in AppDataTable, out of scope.
- [ ] Spec REQ-5/6 mention `phone` as if it existed; design adds the column (roles `description` precedent) — reconcile spec text at archive.
- [ ] Proposal test-lock order relocates `isActive` from pos 3 to 5; design follows proposal order — verify is a deliberate UX choice at archive.
