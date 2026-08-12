# Proposal: Standardize Customers Table

## Intent

Bring `CustomersView.vue` to parity with `ProductsView.vue`: surface backend errors, add the card view users now expect, gate destructive menus, add sortable headers + tests, port the post-create visibility reset. The current view masks failures and offers no second visual mode.

## Scope

### In Scope

- **G1 error handling**: destructure `isError` / `error` from `useServerTable`; add `customersErrorMessage`; pass to `<AppDataTable>`.
- **G2 card view**: `useCustomerViewMode`, `CustomerCard.vue`, `CustomerCardGrid.vue`, `ViewToggle` slot, `#cards` slot, `display-mode`.
- **G3 actions gate**: `canReadCustomer` / `canManageCustomerActions`; `v-if` on the kebab.
- **G5 post-create reset**: port `resetVisibilityContextAfterCreate` from Products.
- **G6 tests**: `CustomersView.test.ts` + `useCustomerColumns.test.ts`.
- **G7 sortable headers**: `SortableHeader` slots for `email`, `phone`, `globalPriceListName`.
- Card click → opens the edit slideover (no detail route exists).

### Out of Scope

- **G4 Detalles route**: skipped per user direction; future change.
- **RFC / fiscal on card**: live on `CustomerDetail`, not list `Customer`. Card uses `fullName / email / phone / globalPriceListName / createdAt`.
- `CustomerUpsertSlideover`, address modal, Coco brand pass, backend changes (list already accepts `sortBy`).

## Capabilities

### New

- `customer-list`: source-of-truth spec for the customers list view. Covers the table behaviour (server-side sort on `email`/`phone`/`globalPriceListName`; surfaced backend errors; permission-gated actions dropdown; post-create filter/page reset), the card rendering (avatar, dashed divider, 2-col body — EmployeeCard pattern), and the per-user table/card preference persisted in `localStorage` under `customers-view-mode`.

> Note: no existing `customer-list` (or `customers`) capability exists in `openspec/specs/`. The whole capability is introduced here as `ADDED`; the original CustomersView pre-dates the spec system. No `MODIFIED` block is needed.

## Approach

Mirror `ProductsView.vue` 1:1: same `useServerTable` destructure, same `*ErrorMessage` shape (backend `response.data.message` → `error.message` → Spanish fallback), same `<ViewToggle>` wiring. Reuse `useViewMode` from `@/core/shared/composables/useViewMode`. Cards follow the **EmployeeCard** pattern (avatar, name, chip row, `border-t border-dashed border-default` divider, 2-col body) — NOT the older `ProductCard`. Card action menu mirrors `EmployeeCard` (gated, `@click.stop` on the kebab). Tests pin new props/emits/`data-testid`s.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `views/CustomersView.vue` | Modified | Error destructure + computed, ViewToggle slot, `#cards` slot, canManageCustomerActions gate, SortableHeader slots, `resetVisibilityContextAfterCreate`, card-click. |
| `composables/useCustomerViewMode.ts` | New | Storage key `customers-view-mode`; `isCustomerViewMode` guard; returns `{ viewMode, setMode, toggleViewMode, displayMode }`. |
| `components/CustomerCard.vue` | New | `defineProps<{ customer, canUpdate, canDelete }>`, emits `edit`/`delete`/`click`. EmployeeCard pattern. |
| `components/CustomerCardGrid.vue` | New | `defineProps<{ customers, loading, empty }>`, emits `card-click`/`edit`/`delete`. Ladder `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7`. |
| `views/__tests__/CustomersView.test.ts` | New | Error state, sort-header count, ViewToggle, card toggle. |
| `composables/__tests__/useCustomerColumns.test.ts` | New | Locks column order, sortability flags, header text. |

## Risks

| Risk | Mitigation |
|------|------------|
| Card click → edit slideover collides with future "open details" | Single-emit `card-click`; flipping to `router.push` is one line. |
| Error-state test flakes on `useServerTable` mock | Pin `data-testid` on error banner; assert on computed string. |
| ~480 new lines, near 400 cap | 3 work units; WU-B kept lean so heaviest single commit stays under 400. |
| `phone` sorts as string (country code prepended) | Matches list shape; identical to Products string sort. |
| RFC on card feels incomplete without fiscal fields | Out of scope; documented. Future detail route extends the card. |

## Rollback Plan

Revert the merge commit. Error handling is additive (computed falls back when `error` is `null`). Removing the card view deletes the new composable + components and strips the `#cards` slot — no breaking change to the table view. Tests live next to the code they pin, so reverting WU-C alone removes them.

## Dependencies

`useViewMode` (Products/Sales already use it); `ViewToggle`; `EntityAvatar` / `DotBadge` / `AppBadge` (all in the customers tree); `useServerTable` already returns `isError` / `error`.

## Success Criteria

- [ ] Failed list requests render a backend-derived error; empty placeholder only on empty success.
- [ ] ViewToggle switches table ↔ card; persists; cards match EmployeeCard pattern.
- [ ] Read-only users see no empty kebab.
- [ ] `email` / `phone` / `globalPriceListName` have working server-side sort; `actions` pinning preserved.
- [ ] After create with an active filter that doesn't match, the filter clears.
- [ ] `pnpm test:unit --run` passes with the two new files green; `pnpm build` clean.
- [ ] No `Customer` type change; no new route; no backend change.

## Work Units (forecast)

- **WU-A — view mode + error handling** (~90 lines): `useCustomerViewMode` + `CustomersView` destructure / computed / SortableHeader slots.
- **WU-B — card view** (~230 lines): `CustomerCard`, `CustomerCardGrid`, ViewToggle wiring, card-click, dropdown gate, visibility reset.
- **WU-C — tests** (~200 lines): `CustomersView.test.ts` + `useCustomerColumns.test.ts`.

Review Workload Forecast: `Decision needed before apply: No`, `Chained PRs recommended: No` (commits on main), `400-line budget risk: Medium` — WU-B is heaviest but stays under 400 if `CustomerCard.vue` stays lean.
