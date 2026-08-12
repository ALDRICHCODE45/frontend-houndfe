# Design: Standardize Admin Users Table

## Technical Approach

Mirror `CustomersView.vue` 1:1: error surfacing, view mode, column visibility, card view. Wrap `useViewMode` into `useUserViewMode` (same shape as `useCustomerViewMode`). Cards follow the EmployeeCard pattern but click-only (no kebab) — the closest reference is `PromotionCard` (single `click` emit, no permission props), not `CustomerCard` (whose `canUpdate`/`canDelete` exist solely to gate its kebab).

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Email as hideable column | `useUserColumns.ts` has NO `email` column (email renders inside `name`-cell); REQ-6 requires email independently hideable | **Add real `email` column** (`accessorKey: 'email'`) + `#email-header`/`#email-cell` slots; `name`-cell keeps avatar + name only. Mirrors CustomersView, minimal diff |
| UserCard props | Proposal table says `{ user, canUpdate, canDelete }`, but those props only gate CustomerCard's kebab; UserCard has no kebab | **`user` only** — single prop, single `click` emit (PromotionCard contract). Permission gate lives in `openEdit`'s existing `canUpdateUser` check |
| `isActive` chip placement | REQ-5 requires chip row | **Chip row** `StatusDotBadge` with `activityToBadgeTone(user.isActive)`, label `Activo`/`Inactivo`, `compact` |
| View mode composable | — | `useCustomerViewMode` shape exactly: key `admin-users-view-mode`, modes `['table','card']`, default `table`, `isUserViewMode` guard, `displayMode` bridge |
| Error precedence | — | Customers copy: `response.data.message` (string or array[0]) → `error.message` → `'No se pudieron cargar los usuarios. Reintenta.'` |
| Card click → edit | No detail route exists | Reuse `openEdit(user)` (`selectedUser` + `isEditOpen`). No `router.push` |
| WU-B without tests | Budget lesson from Fase 1 | No tests in WU-B; all tests land in WU-C |

## Data Flow

```
useServerTable ──isError/error──▶ usersErrorMessage ──▶ AppDataTable :error/:error-message
useUserViewMode ──▶ ViewToggle(#actions) ──▶ :display-mode ──▶ #cards slot ──▶ UserCardGrid
UserCard click ──▶ card-click ──▶ handleCardClick ──▶ openEdit (slideover, edit mode)
```

## File Changes

| File | Action | WU | Description |
|---|---|---|---|
| `admin/users/composables/useUserViewMode.ts` | Create | A | `useViewMode` wrapper + `isUserViewMode` + `displayMode` bridge |
| `admin/users/composables/useUserColumns.ts` | Modify | A | Add `email` column between `name` and `roles` (string header `'Email'`, sortable, hideable) |
| `admin/users/views/AdminUsersView.vue` | Modify | A+B | A: destructure `isError`/`error`; `usersErrorMessage`; `:error`/`:error-message`; `enable-column-visibility`; email slots; ViewToggle in `#actions`; `:display-mode`. B: import `UserCardGrid`, `#cards` slot, `handleCardClick` |
| `admin/users/components/UserCard.vue` | Create | B | `article` + `EntityAvatar`(name, seed=id, lg) + name/email + `StatusDotBadge` chip row + dashed divider + 2-col body (roles, createdAt) |
| `admin/users/components/UserCardGrid.vue` | Create | B | Props `{ users, loading, empty }`, emit `card-click`; ladder 1/2/3/5/7, 8 skeletons, `i-lucide-users` empty state |
| `admin/users/views/__tests__/AdminUsersView.test.ts` | Create | C | View tests (below) |
| `admin/users/composables/__tests__/useUserColumns.test.ts` | Create | C | Column order, sortability, headers, actions flags |

## Interfaces / Contracts

```ts
// useUserViewMode.ts
export type UserViewMode = 'table' | 'card'
export const USER_VIEW_MODE_STORAGE_KEY = 'admin-users-view-mode'
export function isUserViewMode(value: string): value is UserViewMode
export function useUserViewMode(): {
  viewMode: Ref<UserViewMode>
  setMode: (m: UserViewMode) => void
  toggleViewMode: () => void
  displayMode: ComputedRef<'table' | 'cards'>
}

// UserCard.vue
defineProps<{ user: UserTableRow }>()
defineEmits<{ click: [user: UserTableRow] }>()

// UserCardGrid.vue
defineProps<{ users: UserTableRow[]; loading?: boolean; empty?: string }>()
defineEmits<{ 'card-click': [user: UserTableRow] }>()

// AdminUsersView.vue — new handler
function handleCardClick(user: UserTableRow) { openEdit(user) }
```

## Testing Strategy

`AdminUsersView.test.ts` mocks `useServerTable` (mockState incl. `isError`/`error` refs), `useAuthStore`, `@tanstack/vue-query`, stubs `AppDataTable` (slots + `data-error`/`data-error-message`/`data-column-visibility` attrs), `ViewToggle`, `SortableHeader`, `UserCardGrid`, `UserUpsertSlideover`, `AdminPageHeader`, `AppBadge`, `ConfirmModal`, Nuxt UI primitives (`UDropdownMenu`, `UButton`, `UAvatar`, `UIcon`). Cases: error block + backend/`error.message`/Spanish fallback + retry→refresh + empty suppressed on error; ViewToggle rendered; `display-mode` table→cards (localStorage `admin-users-view-mode`); `enable-column-visibility` wired; kebab gating (read-only vs editor, `reka-dropdown-menu-trigger` presence); `card-click` → edit `UserUpsertSlideover` receives the user. `useUserColumns.test.ts`: order `[name, email, roles, createdAt, actions]`; name/email/createdAt string headers (sortable); roles `createSimpleHeader` (not sortable); actions non-sortable/non-hideable/`text-right`.

## Threat Matrix

N/A — no routing change (slideover, not `router.push`), no shell/subprocess/VCS automation, no executable classification, no process integration.

## Migration / Rollout

No migration. Per-WU rollback: A reverts slots/composable/column; B removes card files + slots; C removes tests only.

## Open Questions

- [ ] Card-mode errors: AppDataTable's `#cards` branch bypasses `error` — in card mode a failed request renders the grid's empty state (parity limitation, identical in CustomersView/PromotionsView). Accept as-is; fix belongs in AppDataTable (shared), out of scope.
- [ ] Proposal's `useUserColumns.test.ts` note mentions an `isActive` flag — no such column exists (chip is card-only); test locks columns only. Reconcile wording at archive.
