# Tasks: Standardize Customers Table

## Review Workload Forecast

Estimated: ~520 lines (3 work units, each <400). Risk Medium.

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Work Units

| Unit | Commit | Test cmd | Runtime harness | Rollback |
|------|--------|----------|-----------------|----------|
| WU-A | `feat(customers): add view mode + surface list errors + sortable headers` | `pnpm test:unit --run src/features/POS/customers/composables` | `pnpm dev` (forced failure shows error banner) | revert composable, sort-header slots, error destructure |
| WU-B | `feat(customers): add EmployeeCard-pattern card view` | `pnpm test:unit --run src/features/POS/customers/components` | `pnpm dev` (toggle cards; card-click → slideover; create with non-matching filter clears it) | revert `CustomerCard.vue`, `CustomerCardGrid.vue`, slots + computed + reset additions |
| WU-C | `test(customers): cover list view and column definitions` | `pnpm test:unit --run src/features/POS/customers` | N/A (unit-tested) | revert the two new `__tests__/` files |

## Phase 1: WU-A — View Mode + Error Handling + Sortable Headers

- [x] 1.1 Create `useCustomerViewMode.ts` wrapping `useViewMode('customers-view-mode', ['table','card'], 'table')`; export `isCustomerViewMode` guard and `{ viewMode, setMode, toggleViewMode, displayMode }` (bridge `card`→`cards`).
- [x] 1.2 Modify `useCustomerColumns.ts`: drop `createSimpleHeader` on `email`/`phone`/`globalPriceListName` (keep `accessorKey`); preserve `actions` pinned right, non-sortable, non-hideable.
- [x] 1.3 Modify `CustomersView.vue`: destructure `isError`/`error` from `useServerTable`; add `customersErrorMessage` computed (`response.data.message` → `error.message` → "No se pudieron cargar los clientes. Reintenta."); pass `:error` + `:error-message` to `AppDataTable`.
- [x] 1.4 Modify `CustomersView.vue`: add `#email-header`, `#phone-header`, `#globalPriceListName-header` slots rendering `SortableHeader`; default sort `fullName` asc.
- [x] 1.5 Verify WU-A: `pnpm typecheck` + `pnpm exec eslint src/features/POS/customers` clean.

## Phase 2: WU-B — Card View + Wiring + Gate + Reset

- [x] 2.1 Create `CustomerCard.vue` (`<article>` + `EntityAvatar` `seed=customer.id` + `fullName`/email + chip row with `AppBadge` for `globalPriceListName` + `border-t border-dashed border-default` divider + 2-col body for phone/createdAt); props `{ customer, canUpdate?, canDelete? }`; emits `edit`/`delete`/`click`.
- [x] 2.2 Gate kebab in `CustomerCard.vue`: internal `canManage = canUpdate || canDelete`; `v-if` on kebab; `@click.stop` on kebab.
- [x] 2.3 Create `CustomerCardGrid.vue` (ladder `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7`; 8 skeletons; `i-lucide-users` empty; forwards `card-click`/`edit`/`delete`).
- [x] 2.4 Modify `CustomersView.vue`: import `useCustomerViewMode`; render `ViewToggle` in `#actions`; pass `:display-mode` to `AppDataTable`; add `#cards` slot rendering `CustomerCardGrid` with handlers `card-click`/`edit`→`openEditor`, `delete`→`openDelete`.
- [x] 2.5 Gate row kebab in `CustomersView.vue`: `canManageCustomerActions = canUpdate || canDelete`; `v-if` on kebab.
- [x] 2.6 Port `resetVisibilityContextAfterCreate` into `CustomersView.vue`: add `customerMatchesFilter`; on create success reset `pageIndex` when `>0` and clear `globalFilter` only when non-matching.
- [x] 2.7 Verify WU-B: `pnpm dev` → toggle persists, card click opens slideover, create with non-matching filter clears it, read-only user sees no kebab.

## Phase 3: WU-C — Tests

- [x] 3.1 Create `composables/__tests__/useCustomerColumns.test.ts`: column count, `actions` pinned right + non-sortable + non-hideable, email/phone/globalPriceListName expose `accessorKey` and no `createSimpleHeader`.
- [x] 3.2 Create `views/__tests__/CustomersView.test.ts`: stub `useServerTable`/`useAuthStore`/`useCustomerViewMode`; assert error banner (`data-testid`) when `isError=true`, message precedence, `ViewToggle` renders, `display-mode` switches, kebab hidden when `canManageCustomerActions=false`.
- [x] 3.3 Run `pnpm test:unit --run src/features/POS/customers` (both files green) and `pnpm build` clean.

## Threat Matrix

N/A per design (no routing/shell/subprocess/VCS/exec/process boundaries). No RED-test tasks.
