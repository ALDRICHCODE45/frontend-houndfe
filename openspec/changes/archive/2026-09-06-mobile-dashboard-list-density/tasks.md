# Tasks: Mobile Dashboard List Density

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Approximately 700–950 authored lines across 4 implementation work units, including tests |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 shared containment/accessibility → PR 2 Products pilot → PR 3 Customers pilot → PR 4a Employees route surface + grid → PR 4b Employee card (child branch stacked on 4a, maintainer-approved split of the original S4); rendered geometry remains later verify work |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked child branches; S4 split into S4a/S4b by maintainer decision (no size:exception) |

Decision needed before apply: Yes (resolved for S1–S3 and S4a/S4b by maintainer-approved split)
Chained PRs recommended: Yes
Chain strategy: stacked child branches; S4 split into S4a/S4b (maintainer-approved, no size:exception)
400-line budget risk: High

The proposed boundaries are independently reviewable and each targets under 400 changed lines where practical. The total is expected to exceed the 400-line review budget because the shared foundation and three materially different pilots each carry their own tests. Do not treat this forecast as authorization for `size:exception` or a chain topology decision. Actual commits require separate explicit user authorization under repository safety; the messages below are plan metadata only.

## Work Units Table

| Slice | Boundary and goal | Expected size | Focused test command | Runtime path | Rollback boundary |
|---|---|---:|---|---|---|
| S1 | Backward-compatible shared containment and accessibility for `AppDataTable`, `DataTableToolbar`, `ViewToggle`, and `DataTablePagination` | 220–320 lines | `pnpm test:unit --run src/core/shared/components/DataTable/__tests__/AppDataTable.spec.ts src/core/shared/components/DataTable/__tests__/DataTableToolbar.spec.ts src/core/shared/components/DataTable/__tests__/DataTablePagination.spec.ts src/core/shared/components/__tests__/ViewToggle.spec.ts` | N/A during apply; jsdom cannot prove geometry | Revert only shared primitive classes/attributes and their co-located contract tests |
| S2 | Products route, grid, card, and tests | 140–220 lines | `pnpm test:unit --run src/features/POS/products/views/__tests__/ProductsView.test.ts src/features/POS/products/components/__tests__/ProductCardGrid.test.ts src/features/POS/products/components/__tests__/ProductCard.test.ts` | N/A during apply; rendered geometry is later manual verify work | Revert Products view/grid/card changes and their tests without touching shared primitives |
| S3 | Customers route, grid, card, and tests | 140–220 lines | `pnpm test:unit --run src/features/POS/customers/views/__tests__/CustomersView.test.ts src/features/POS/customers/components/__tests__/CustomerCardGrid.spec.ts src/features/POS/customers/components/__tests__/CustomerCard.spec.ts` | N/A during apply; rendered geometry is later manual verify work | Revert Customers view/grid/card changes and their tests without touching other pilots |
| S4a | Employees route surface + card grid (maintainer-approved split of the original S4): route containment, grid available-width tracks, and their tests | ~333 lines (actual: 333) | `pnpm test:unit --run src/features/admin/employees/views/__tests__/EmployeesListView.test.ts src/features/admin/employees/components/__tests__/EmployeeCardGrid.spec.ts` plus existing employee list/card-view coverage not requiring S4b | N/A during apply; rendered geometry is later manual verify work | Revert Employees view/grid changes and their tests without touching other pilots or the S4b card slice |
| S4b | Employee card + tests (child branch `feat/mobile-dashboard-list-density-s4b-employee-card`, stacked on S4a): shrinkable card root/fields, status/kebab controls, card contract tests | ~290 lines (partial changes preserved uncommitted from the original S4 attempt) | `pnpm test:unit --run src/features/admin/employees/components/__tests__/EmployeeCard.spec.ts` plus existing employee card-view coverage | N/A during apply; rendered geometry is later manual verify work | Revert EmployeeCard changes and its test without touching S4a or other pilots |

Every relevant slice preserves the invariant that table horizontal scrolling remains inside the rendered Nuxt UI table region and the sticky/pinned right `actions` column remains aligned and actionable. Card mode must not gain a horizontal scroll workaround. No slice changes APIs, backend/query data, routes, permissions, global `DashboardLayout` behavior, or non-pilot layouts.

## Dependency Graph

```text
S1 shared containment/accessibility
 ├──> S2 Products pilot
 ├──> S3 Customers pilot
 └──> S4a Employees route surface + grid
       └──> S4b Employee card (child branch, stacked on S4a)

S2, S3, S4a are independent after S1 and may be chained in any approved order; S4b depends on S4a only.
S1–S4 ──> later verify: rendered/manual geometry matrix (not jsdom geometry)
```

## Implementation Order

1. Apply S1 only after confirming the existing component contracts and test fixtures; keep the real `UTable` scroller and pinning models untouched.
2. Apply S2 Products as the narrow-width stress pilot, preserving product filters, persisted mode, permissions, and table actions.
3. Apply S3 Customers, preserving customer card actions, history access, permissions, and the current absence/presence of filter slots rather than inventing one.
4. Apply S4a Employees route surface + grid (maintainer-approved split), preserving status filters, batch actions, navigation, permissions, and persisted mode. Then apply S4b on the stacked child branch.
5. Leave 360/412/740 browser geometry, both display modes, both themes, and sticky-action extreme checks to the later verify phase; do not manufacture layout assertions in jsdom.

## S1 — Shared containment and accessibility foundation

**Scope:** `AppDataTable`, `DataTableToolbar`, `ViewToggle`, and `DataTablePagination` only. This is backward-compatible shared work, not a pilot migration. Preserve all existing props, emits, slots, table models, pagination value bridges, and the Nuxt UI table root's internal `overflow-auto` behavior.

**Files (MOD):**

- `src/core/shared/components/DataTable/AppDataTable.vue`
- `src/core/shared/components/DataTable/__tests__/AppDataTable.spec.ts`
- `src/core/shared/components/DataTable/DataTableToolbar.vue`
- `src/core/shared/components/DataTable/__tests__/DataTableToolbar.spec.ts`
- `src/core/shared/components/DataTable/DataTablePagination.vue`
- `src/core/shared/components/DataTable/__tests__/DataTablePagination.spec.ts`
- `src/core/shared/components/ViewToggle.vue`
- `src/core/shared/components/__tests__/ViewToggle.spec.ts`

### TDD steps

- [x] RED: Add failing contract assertions in the listed shared test files for `w-full min-w-0 max-w-full` containment, the real `UTable` boundary, toolbar column behavior through `<md` and mobile region order/wrapping, pagination mobile containment, labeled toggle options, accessible names, focus-visible treatment, 44px target classes, keyboard activation, and unchanged emits. <!-- sdd-owner: implementation -->
- [x] GREEN: Add the minimum backward-compatible classes and attributes in the four listed shared components; keep Nuxt UI `UTable` as the sole table horizontal scroller, preserve sticky/pinned right actions, and do not alter APIs, models, slots, or filter-sheet behavior. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: Extend the shared tests across table/card modes, loading/error/empty paths, with and without filters/actions, 640–767px class intent, pagination zero/one-based emission, custom toggle options, keyboard activation, and desktop class preservation; explicitly assert no card-mode horizontal-scroll class is introduced. <!-- sdd-owner: implementation -->
- [x] REFACTOR: Remove only local duplicated class fragments or unclear test helpers within the shared files, retain explicit component contracts, and keep all shared test assertions green without changing behavior. <!-- sdd-owner: implementation -->

**Verify:** Run the focused S1 command after each TDD step as required by `openspec/config.yaml`; at completion, run `pnpm test:unit --run` for the affected shared suites and `pnpm build` only at the applicable slice/build gate. Unit tests may assert DOM contracts, never calculated geometry.

**Commit metadata:** `feat(data-table): contain shared mobile density primitives`

## S2 — Products pilot route, grid, card, and tests

**Scope:** Products only, dependent on S1. Remove duplicate mobile outer padding while retaining desktop padding, contain the list surface and inner body, use the available-width grid convention for loading and data states, and make product card roots/long fields shrinkable. Preserve the product type selector, search/sort/pagination, persistence, permissions, card actions, table data, local table scrolling, and sticky right `actions` column.

**Files (MOD):**

- `src/features/POS/products/views/ProductsView.vue`
- `src/features/POS/products/views/__tests__/ProductsView.test.ts`
- `src/features/POS/products/components/ProductCardGrid.vue`
- `src/features/POS/products/components/__tests__/ProductCardGrid.test.ts`
- `src/features/POS/products/components/ProductCard.vue`
- `src/features/POS/products/components/__tests__/ProductCard.test.ts`

### TDD steps

- [x] RED: Add failing Products assertions for no route-level horizontal gutter below `md`, retained desktop padding, contained surface/body, available-width `auto-fit/minmax` grid classes in skeleton and data states, shrinkable card roots/long SKU/name/brand/price fields, and unchanged table-mode pinning/action contracts. <!-- sdd-owner: implementation -->
- [x] GREEN: Implement only the Products view, grid, and card containment changes required by the failing tests; keep card mode free of horizontal scrolling and leave table scrolling to the rendered Nuxt UI table region. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: Test long representative product strings, loading/empty/error/paginated states, product-type filtering, persisted display mode, permission-gated actions, card click/kebab propagation, and the intentional replacement of exact viewport ladder assertions; retain checks for sticky right actions and existing table models. <!-- sdd-owner: implementation -->
- [x] REFACTOR: Consolidate repeated static class fragments only within Products components/tests, preserve Coco/Nuxt semantic tokens and rounded surfaces, and avoid introducing a shared grid wrapper or composable. <!-- sdd-owner: implementation -->

**Verify:** Run the focused S2 command after each TDD step. Confirm no source changes outside the six Products files and no geometry claims from jsdom.

**Commit metadata:** `feat(products): contain responsive list density pilot`

## S3 — Customers pilot route, grid, card, and tests

**Scope:** Customers only, dependent on S1. Remove duplicate mobile outer padding while retaining desktop padding, contain the surface/body, use available-width grid tracks, and constrain customer identity/chips/email/phone/date/price-list content. Preserve customer card click/edit/delete/history behavior, permissions, persisted mode, current filter-slot semantics, pagination, local table scrolling, and sticky right `actions` column.

**Files (MOD):**

- `src/features/POS/customers/views/CustomersView.vue`
- `src/features/POS/customers/views/__tests__/CustomersView.test.ts`
- `src/features/POS/customers/components/CustomerCardGrid.vue`
- `src/features/POS/customers/components/__tests__/CustomerCardGrid.spec.ts`
- `src/features/POS/customers/components/CustomerCard.vue`
- `src/features/POS/customers/components/__tests__/CustomerCard.spec.ts`

### TDD steps

- [x] RED: Add failing Customers assertions for dashboard-owned mobile gutter, retained desktop padding, contained surface/body, available-width grid classes in skeleton/data/empty states, shrinkable card roots and badge/content fields, and unchanged table-region scroll/pinned-action contracts. <!-- sdd-owner: implementation -->
- [x] GREEN: Implement only the Customers view, grid, and card containment changes required by the tests; do not invent a Filters slot or alter customer data, route, permission, or table behavior. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: Test long names, email, phone, dates, and price-list labels; loading/error/empty/pagination/persistence paths; card click and kebab propagation; edit/delete/history permissions; and existing table actions while ensuring card mode has no horizontal-scroll workaround. <!-- sdd-owner: implementation -->
- [x] REFACTOR: Remove local duplication only where it improves the Customers files, preserve semantic light/dark surface classes and actionable kebab placement, and avoid a cross-pilot abstraction. <!-- sdd-owner: implementation -->

**Verify:** Run the focused S3 command after each TDD step. Treat exact grid class assertions as the new available-width contract, not as browser geometry evidence.

**Commit metadata:** `feat(customers): contain responsive list density pilot`

## S4a — Employees route surface + card grid (maintainer-approved split)

> **Split rationale:** the original S4 (~620 lines across six files) exceeded the 400-line review budget. The maintainer approved splitting it into S4a (route surface + grid, this unit) and S4b (card, child branch), without `size:exception`. S4a was implemented on branch `feat/mobile-dashboard-list-density-s4a-employees-surface` (renamed from the original S4 branch); S4b partial changes were isolated via `git stash` during S4a verification and restored uncommitted onto the child branch `feat/mobile-dashboard-list-density-s4b-employee-card`.

**Scope:** Employees/Colaboradores route surface and card grid only, dependent on S1. Remove only the duplicated mobile horizontal gutter while retaining `py-3` and desktop `md:px-6 lg:px-8`, contain the list surface/body, and use available-width grid tracks in skeleton/data/empty states. Preserve status filter-sheet behavior, three mobile toolbar regions, batch actions, navigation, permissions, persisted mode, pagination, local table scrolling, and sticky right `actions` column. No card-mode horizontal scrolling; no jsdom geometry claims.

**Files (MOD/NEW):**

- `src/features/admin/employees/views/EmployeesListView.vue` (MOD)
- `src/features/admin/employees/views/__tests__/EmployeesListView.test.ts` (MOD)
- `src/features/admin/employees/components/EmployeeCardGrid.vue` (MOD)
- `src/features/admin/employees/components/__tests__/EmployeeCardGrid.spec.ts` (NEW)

### TDD steps

- [x] RED (reconstructed truthfully): With S4b isolated, checksum + patch-save the two S4a production diffs, temporarily restore only `EmployeesListView.vue` and `EmployeeCardGrid.vue` to the S3 base (`62e2a3b`) while keeping the S4a tests, and capture the focused two-file failures (8 failed / 45 passed). <!-- sdd-owner: implementation -->
- [x] GREEN: Implement only the Employees view and grid containment changes required by the failing tests; preserve the existing status filter sheet, three-region toolbar, batch-action path, permissions, navigation, and table/card mode bridge. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: Cover long employee names, skeleton/data/empty grid states, persisted card mode, permission forwarding, pinned-actions contract, filter sheet, and negative `overflow-x-auto` assertions in the route root and grid; table scroll extremes remain conceptual (contract-level pinning assertions only, no jsdom geometry). <!-- sdd-owner: implementation -->
- [x] REFACTOR: Consolidate the duplicated grid class string into the `gridClasses` constant in `EmployeeCardGrid.vue`; no other duplication within S4a files; behavior unchanged. <!-- sdd-owner: implementation -->

**Verify:** Run the focused S4a command plus existing employee list/card-view coverage that does not require S4b (`EmployeesListView.batch.spec.ts`, `wu03-card-view.spec.ts`, `useEmployeeViewMode.test.ts`, `useEmployeeColumns.test.ts`), then `pnpm build` while S4b changes are isolated. Confirm only the four listed S4a files change in this work unit.

**Commit metadata:** `feat(employees): contain responsive list surface and grid`

## S4b — Employee card + tests (child branch, stacked on S4a)

**Scope:** `EmployeeCard.vue` and `EmployeeCard.spec.ts` only, on branch `feat/mobile-dashboard-list-density-s4b-employee-card` created from the S4a commit. Shrinkable card root (`w-full min-w-0 max-w-full`), constrained chip row, truncation for modality/seniority fields, kebab-wrapper testid, and card contract tests. The prior worker's partial changes for these two files are preserved uncommitted in the working tree.

**Files (MOD/NEW):**

- `src/features/admin/employees/components/EmployeeCard.vue` (MOD — partial changes restored, uncommitted)
- `src/features/admin/employees/components/__tests__/EmployeeCard.spec.ts` (NEW — partial changes restored, uncommitted; known pi-lens TS2307 to resolve in this unit)

### TDD steps

- [x] RED: Add failing card assertions for the shrinkable card root, constrained chip row, truncation of modality/seniority fields, and kebab-wrapper testid. <!-- sdd-owner: implementation -->
- [x] GREEN: Implement only the EmployeeCard containment changes required by the failing tests; keep kebab actions and status/dot badges intact. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: Test long department/manager/position/modality/seniority/status labels, kebab propagation beside long content, and permission-gated actions. <!-- sdd-owner: implementation -->
- [x] REFACTOR: Tighten local duplication within the two S4b files only; retain semantic theme tokens and rounded treatment. <!-- sdd-owner: implementation -->

**Verify:** Run the focused S4b command plus existing employee card-view coverage; resolve the pi-lens TS2307 in `EmployeeCard.spec.ts` as part of this unit.

**Commit metadata:** `feat(employees): contain employee card within grid track`

## Later Verify Boundary: Rendered/Manual Geometry

This is not apply work and must not be simulated with jsdom assertions. After S1–S4 and the normal type/unit/build gates, later verify work must use `pnpm dev --host` and an authenticated browser session without adding a browser dependency. Exercise Products, Customers, and Colaboradores at 360, 412, and 740 CSS px in table/card modes and light/dark themes. Record page and participating-surface `scrollWidth <= clientWidth` in card mode; confirm the actual `[data-testid="table-view"][data-slot="root"]` owns table overflow; and compare sticky right-action alignment and clickability at both horizontal scroll extremes. Also verify toolbar order, filter-sheet behavior, labeled 44px ViewToggle targets, long-content containment, and pagination bounds. This evidence is manual rendered verification, not a fake geometry test.

## Scope Guardrails

- Do not modify `DashboardLayout.vue`, `vite.config.ts`, APIs, DTOs, query keys, mutations, router entries, route metadata, CASL subjects, permissions, backend code, or non-pilot list views.
- Do not remove or relocate Nuxt UI table horizontal scrolling, alter `columnPinning`, or replace sticky right actions with page-level scrolling.
- Do not add browser automation or dependencies in this change.
- Do not create a new shared grid wrapper or layout composable for the three materially different card grids.
- Do not create RDD authority, receipt, or delivery-gate tasks; delivery remains governed by the native `ask-on-risk` decision.
