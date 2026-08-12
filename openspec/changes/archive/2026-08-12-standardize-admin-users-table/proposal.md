# Proposal: Standardize Admin Users Table

## Intent

Bring `AdminUsersView.vue` to Fase 1 parity with `CustomersView.vue` (the gold standard): surface backend errors, add the card view users now expect, fix the dead column-visibility binding, and lock the behavior with the same test surface as the rest of Fase 1. Today this view — the first thing admins see when managing staff — masks failures ("No se encontraron usuarios" on a crashed request) and offers no second visual mode. It is also the first change of Fase 2.

## Scope

### In Scope

- **G1 error handling (HIGH)**: destructure `isError` / `error` from `useServerTable` (currently `AdminUsersView.vue:25-47`); compute `usersErrorMessage`; pass `:error` + `:error-message` to `<AppDataTable>` (currently `:189-211` passes neither). Match CustomersView wiring.
- **G2 view mode + card view (HIGH)**: `useUserViewMode` (wraps `useViewMode`, key `admin-users-view-mode`), `UserCard.vue`, `UserCardGrid.vue`, `ViewToggle` in `#actions`, `#cards` slot, `:display-mode`. EmployeeCard pattern (avatar seeded by id, chip row, dashed divider, 2-col body) on the standard ladder `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7`. **Card click opens `UserUpsertSlideover` in edit mode** (no detail route exists for users — same click semantics as CustomerCard, no `router.push`).
- **G3 column selector (MED)**: set `enable-column-visibility` on `AppDataTable` (currently `:194` binds `columnVisibility` but the dropdown is dead). All 4 columns hideable: `name`, `email`, `roles`, `createdAt`.
- **G4 tests (HIGH)**: `views/__tests__/AdminUsersView.test.ts` (mocked `useServerTable` incl. `isError` per `CustomersView.test.ts` pattern) + `composables/__tests__/useUserColumns.test.ts`.
- **Status chip (MED)**: render `isActive` as `Activo` / `Inactivo` chip in the card view (display ONLY — no toggle in this change). Uses `StatusDotBadge` / `AppBadge` from the shared kit.

### Out of Scope

- **G5 local filter semantics**: `users.api.ts:11-42` `applyLocalFilters` filters/sorts only the fetched page (name/email/roles), so search matches only the current page while `totalCount` stays the backend total — wrong pagination during search. **Kept as-is** in this change. Tracked as a known defect → requires backend `/admin/users` search/sort verification in `houndfe-backend` (sibling repo). Documented as a follow-up, NOT scheduled.
- No new `#filters` slot — Admin Users has no extra filter selects (search only).
- Header stays `AdminPageHeader` (admin-domain convention shared with `AdminTenantMembersView`, `PendingApprovalsView`, `ExpiringDocumentsView` — NOT a gap).
- No bulk actions / row selection (no bulk ops for users; CASL gate already in place).
- No delete wording change ("¿Quieres desactivar…?" matches a hard DELETE — wording quirk, out of scope).
- No `AdminUser` type change, no new route, no backend change.

### Already in Place (do NOT redo)

- `defaultPinning: { left: [], right: ['actions'] }` on `AdminUsersView.vue:46`.
- CASL-gated kebab (`canCreate` / `canUpdate` / `canDelete`) + `canManageUserActions` `v-if` at `:102-105, 250-251`.
- Roles N+1 solved via per-page `rolesCache` batch in `users.api.ts:44-91` (cleared on mutations).
- Tenant scoping via `authStore.currentTenantId` baked into the query key.

## Capabilities

### New

- `admin-users-list` — source-of-truth spec for the admin users list view. Covers the table behaviour (surfaced backend errors, working column-visibility selector, permission-gated kebab), the card rendering (avatar, dashed divider, 2-col body, `isActive` chip — EmployeeCard pattern), the per-user table/card preference persisted in `localStorage` under `admin-users-view-mode`, and card-click → edit slideover.

> No existing `admin-users` (or `users-admin`) capability exists in `openspec/specs/`. The whole capability is introduced here as `ADDED`; the original `AdminUsersView` pre-dates the spec system. No `MODIFIED` block is needed.

### Modified

None.

## Approach

Mirror `CustomersView.vue` 1:1: same `useServerTable` destructure, same `*ErrorMessage` shape (backend `response.data.message` → `error.message` → "No se pudieron cargar los usuarios. Reintenta."), same `<ViewToggle>` wiring in `#actions`. Reuse `useViewMode` from `@/core/shared/composables/useViewMode`. Cards follow the **EmployeeCard** pattern — `article` root, `EntityAvatar` seeded by user id, name + email chips, `border-t border-dashed border-default` divider, 2-col body (`roles`, `createdAt`), `isActive` badge in the chip row. NO kebab on the card (matches EmployeeCard parity; destructive actions stay on the table row where `canManageUserActions` already gates them). Card click emits `card-click`; `AdminUsersView` opens `UserUpsertSlideover` in edit mode (same single-emit pattern as Customers). WU-B ships **without tests** (Fase 1 lesson: customers WU-B went over budget). Tests land in their own WU-C.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/admin/users/views/AdminUsersView.vue` | Modified | `isError`/`error` destructure, `usersErrorMessage`, `enable-column-visibility`, `ViewToggle` slot, `#cards` slot, card-click → `UserUpsertSlideover` open in edit mode. |
| `src/features/admin/users/composables/useUserViewMode.ts` | **New** | Storage key `admin-users-view-mode`; `isUserViewMode` guard; returns `{ viewMode, setMode, toggleViewMode, displayMode }` (bridges `card` → `cards`). |
| `src/features/admin/users/components/UserCard.vue` | **New** | `defineProps<{ user, canUpdate, canDelete }>`, emits `click`. EmployeeCard pattern (no kebab, no checkbox). `isActive` chip in the chip row. |
| `src/features/admin/users/components/UserCardGrid.vue` | **New** | `defineProps<{ users, loading, empty }>`, emits `card-click`. Ladder `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7`. |
| `src/features/admin/users/views/__tests__/AdminUsersView.test.ts` | **New** | Mocks `useServerTable` incl. `isError` mockState; pins error block, ViewToggle, card toggle, column-visibility dropdown. |
| `src/features/admin/users/composables/__tests__/useUserColumns.test.ts` | **New** | Locks column order, sortability flags, `isActive` flag, header text. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Card click → edit slideover collides with a future "open details" route | Low | Single `card-click` emit; flipping to `router.push` is one line. Mirrors Customers. |
| Error-state test flakes on `useServerTable` mock | Low | Pin `data-testid` on the error banner; assert on the computed string (same pattern as `CustomersView.test.ts`). |
| ~430 total lines, at the 400-line budget edge | Med | 3 work units; WU-B (cards) ships without tests so heaviest single commit stays under 400. WU-B is the largest — review the card split before merging. |
| Local filter semantics (G5) leaks into user trust if not surfaced | Med | Documented in proposal "Out of Scope" with a clear follow-up pointer to `houndfe-backend`. NOT silently fixed. |
| Column-visibility selector exposes `createdAt` on a list where admins typically sort by name | Low | All 4 columns hideable is the user-approved default; persistence follows TanStack Table's built-in state. |

## Rollback Plan

Revert the merge commit. Error handling is additive (the computed `usersErrorMessage` falls back to the existing empty-state when `error` is `null`). Removing the card view deletes the new composable + 2 components and strips the `#cards` slot — no breaking change to the table view. The column visibility toggle is opt-in (a toolbar menu) and removing the prop reverts to the previous selectors. Tests live next to the code they pin, so reverting WU-C alone removes them.

## Dependencies

`useViewMode` (Customers/Promotions/Sales already use it); `ViewToggle`; `EntityAvatar` / `StatusDotBadge` / `AppBadge` (in the shared kit); `useServerTable` already returns `isError` / `error`. No new dependency on `houndfe-backend`.

## Success Criteria

- [ ] Failed list requests render a backend-derived error; empty placeholder only on empty success.
- [ ] ViewToggle switches table ↔ card; persists in `localStorage`; cards match EmployeeCard pattern.
- [ ] Card click opens `UserUpsertSlideover` in edit mode; no `router.push`, no detail route introduced.
- [ ] `isActive` chip renders in the card view (display only); `createdAt` / `roles` / `name` / `email` all hideable.
- [ ] `defaultPinning.right: ['actions']` and the CASL-gated kebab remain unchanged.
- [ ] `pnpm test:unit --run` passes with the two new files green; `pnpm build` clean.
- [ ] No `AdminUser` type change; no new route; no backend change; G5 left as documented follow-up.

## Work Units (forecast)

- **WU-A — view mode + error handling + column selector (~140 lines)**: `useUserViewMode` + `AdminUsersView` destructure / computed / `enable-column-visibility` / `ViewToggle` slot.
- **WU-B — card view (~180 lines). No tests** (Fase 1 lesson: customers WU-B went over budget). `UserCard`, `UserCardGrid`, card-click → edit slideover, `isActive` chip.
- **WU-C — tests (~180 lines)**: `AdminUsersView.test.ts` + `useUserColumns.test.ts`.

Review Workload Forecast: `Decision needed before apply: No`, `Chained PRs recommended: No` (commits on main), `400-line budget risk: Medium` — WU-B is heaviest but stays under 400 if `UserCard.vue` stays lean (no kebab, no checkbox).
