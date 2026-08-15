# Tasks: Standardize Admin Employees Table

Derived from `proposal.md`, `design.md`, `specs/admin-employees-list/spec.md` (REQ-1..10).

- Execution mode: AUTO; delivery: no PRs — conventional commits on branch, manual merge to main (solo dev)
- Artifact store: openspec; review budget: 400 lines/WU; strict TDD: `pnpm test:unit` (vitest), gate `pnpm build`
- WU-B ships without tests (Fase 1 + users + roles + tenants + tenant-members lessons) — tests land in WU-C
- Frontend-only: `houndfe-backend` forbidden. Sorting descoped pending backend. Card kebab + card-click → `admin-employee-detail` + bulk-action bar PRESERVED by explicit decision (employees has a real detail route and richer per-row actions)
- `useServerTable` (shared composable) is **untouchable** — `statusTab`/`managerId` close over `queryKey`/`queryFn` (Approach C)

---

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: Medium

Estimated ~470-580 lines (WU-A ~150-180 + WU-B ~120-150 + WU-C ~200-250). Each WU < 400. WU-C is heaviest (test file expansion + spec strip + new view/columns/viewmode specs). Precedents: tenant-members ~620 (PASS WITH WARNINGS), tenants ~650 (PASS WITH WARNINGS).

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WU-A | useServerTable migration + error surfacing + AdminPageHeader + column visibility + dead-UI cleanup | commit 1 on branch | `pnpm test:unit --run src/features/admin/employees/composables/__tests__/useEmployeeViewMode.test.ts` | `pnpm dev` toggling error/reload/column-vis | revert `useEmployeesList.ts` + `employees.api.ts` + `useEmployeeColumns.ts` + `useEmployeeViewMode.ts` + `EmployeesListView.vue` A edits |
| WU-B | card into `#cards` slot + status tabs into `#filters` (NO tests) | commit 2 on branch | N/A (no tests in WU-B by design — Fase 1/2 lesson) | `pnpm dev` toggling to cards, card-click → detail, status tabs in #filters | revert `EmployeesListView.vue` B edits + restore `EmployeeFilters.vue` `search` prop |
| WU-C | tests: error, view mode, columns, tabs, search, card-click/kebab, bulk-preserved | commit 3 on branch | `pnpm test:unit --run src/features/admin/employees` | N/A | revert new test files + restore stripped `useEmployeesList.spec.ts` section |

| Unit | REQs | Commit |
|------|------|--------|
| WU-A | 1, 2, 3, 5, 9 | `feat(admin-employees): migrate to useServerTable, surface errors, add header + column visibility` |
| WU-B | 4, 6, 7 | `feat(admin-employees): render card in #cards slot and status tabs in #filters` |
| WU-C | 1..10 | `test(admin-employees): cover list view, view mode, columns, and gating` |

---

## Phase 1: WU-A — useServerTable Migration + Error + Header + Visibility (~150-180 lines)

**Files**: modify `composables/useEmployeesList.ts`, `api/employees.api.ts`, `composables/useEmployeeColumns.ts`, `composables/useEmployeeViewMode.ts`, `views/EmployeesListView.vue` (A part); create RED stubs `composables/__tests__/useEmployeeViewMode.test.ts`, `views/__tests__/EmployeesListView.test.ts`. Strict-TDD: RED → GREEN → REFACTOR.

- [x] 1.1 RED `composables/__tests__/useEmployeeViewMode.test.ts`: localStorage roundtrip under `employee-view-mode`; default `table`; invalid stored → `table`; `displayMode` bridges `card`→`cards`; `isEmployeeViewMode` guard accepts only `table`/`card`. Red.
- [x] 1.2 GREEN `composables/useEmployeeViewMode.ts`: wrap `useViewMode('employee-view-mode', ['table','card'], 'table')`; export `EMPLOYEE_VIEW_MODE_STORAGE_KEY` + `EmployeeViewMode` + `isEmployeeViewMode` + `{ viewMode, setMode, toggleViewMode, displayMode }` (computed bridges `card`→`cards`); preserve `computeSeniority`/`buildCardData` exports. Green.
- [x] 1.3 RED `api/__tests__/employees.api.spec.ts` (or extend existing): `EmployeesListParams.page` → `pageIndex` (0-based); `list` sends `page = (pageIndex ?? 0) + 1`; no sort param; `status` lowercase; no tenantId; `managerId`/`search` passed through. Red.
- [x] 1.4 GREEN `api/employees.api.ts`: rename `EmployeesListParams.page` to `pageIndex`; `list` constructs `page = pageIndex + 1`; drop any sort; `mapPaginated` unchanged. Green.
- [x] 1.5 RED `composables/__tests__/useEmployeeColumns.test.ts`: order `[select?, colaborador, cargo, departamento, jefedirecto, fechaIngreso, modalidad, estado, actions]`; headers `Colaborador/Cargo/Departamento/Jefe directo/Fecha de ingreso/Modalidad/Estado`; 7 data columns `enableHiding: true`; `actions` `enableHiding: false`/`enableSorting: false`/`class: 'text-right'`; all `enableSorting: false`. Red.
- [x] 1.6 GREEN `composables/useEmployeeColumns.ts`: explicit `enableHiding: true` on 7 data columns; `actions` `enableHiding: false`; explicit `enableSorting: false` everywhere; no `SortableHeader`. Green.
- [x] 1.7 RED stub `views/__tests__/EmployeesListView.test.ts` pinning `employeesErrorMessage` precedence (`response.data.message` string|array[0] → `error.message` → "No se pudieron cargar los colaboradores. Reintenta.") + `enable-column-visibility` + `:display-mode="displayMode"` + `defaultPinning: { right: ['actions'] }` + `persistKey: 'admin-employees'`. Red.
- [x] 1.8 GREEN `composables/useEmployeesList.ts`: drop `page`/`pageSize`/`search` refs; compose `useServerTable` with `queryKey`/`queryFn` closures over `statusTab`/`managerId`; `pageSizeOptions: [10, 20, 50]`; `defaultPinning: { left: [], right: ['actions'] }`; `persistKey: 'admin-employees'`, `urlSync: false`; destructure + return `isError`/`error`/`selectedRows`/`refresh`; rewrite `buildEmployeesQueryParams` to 0-based `pageIndex` (lowercase `status`, no tenantId); `watch([statusTab, t.globalFilter], t.clearSelection)`; alias `selectedRows: selectedEmployees`. Green.
- [x] 1.9 GREEN `views/EmployeesListView.vue` (A part): replace inline `<h1>Colaboradores</h1>` with `<AdminPageHeader title="Colaboradores" />`; `useEmployeeViewMode()` → `ViewToggle` (aria-label "Seleccionar vista de empleados") in `#actions`; pass `:error="isError"` + `:error-message="employeesErrorMessage"` + `:display-mode="displayMode"` + `enable-column-visibility` + `v-model:global-filter/sorting/column-pinning/column-visibility` to `AppDataTable`; `:show-add-button="canCreate"` + `@add="openCreate"` (gated); remove Importar/Exportar buttons, "Filtros" button, "Todos los departamentos" select, "Cualquier modalidad" select, "Más recientes" sort `USelect`; `watch([viewMode, () => pagination.value.pageIndex], clearSelection)`. Green.
- [x] 1.10 REFACTOR trim dead imports; tests green.
- [x] 1.11 Verify `pnpm test:unit --run src/features/admin/employees` (new stubs green; existing `useEmployeesList.spec.ts`/`wu03-card-view.spec.ts`/`EmployeesListView.batch.spec.ts` UNCHANGED) + `pnpm build` clean.

**Commit**: `feat(admin-employees): migrate to useServerTable, surface errors, add header + column visibility`. Stages `useEmployeesList.ts` (modify), `employees.api.ts` (modify), `useEmployeeColumns.ts` (modify), `useEmployeeViewMode.ts` (modify), `EmployeesListView.vue` (modify — A), `useEmployeeViewMode.test.ts` (new), `EmployeesListView.test.ts` stub (new), `useEmployeeColumns.test.ts` stub (new).

---

## Phase 2: WU-B — Card into `#cards` + Status Tabs into `#filters` (~120-150 lines, NO TESTS)

**Files**: modify `views/EmployeesListView.vue` (B part), `components/EmployeeFilters.vue`. Implementation only.

- [x] 2.1 `components/EmployeeFilters.vue`: strip `search` prop + search `<UInput>`; keep status tabs only (`Todos`/`Activos`/`Bajas`) bound to `statusTab` ref via `setStatusTab(EMPLOYEE_STATUS_FILTER.*)`; emit `update:status-tab`; no sort select. Props `{ statusTab: EmployeeStatusFilter }`. Single emit `update:status-tab`.
- [x] 2.2 `views/EmployeesListView.vue` (B part): import `EmployeeCardGrid`; add `#cards` slot to `AppDataTable` → `<EmployeeCardGrid :employees="employees" :manager-map="managerMap" :loading="isLoading || isFetching" :can-update="canUpdate" empty="No se encontraron colaboradores" @card-click="navigateToDetail" />` (kebab via canUpdate gate preserved inside `EmployeeCard`); delete sibling `v-else` branch + hand-rolled prev/next pagination block (`EmployeesListView.vue:586-611`); render `<EmployeeFilters :status-tab="statusTab" @update:status-tab="setStatusTab" />` inside `AppDataTable`'s `#filters` slot (keeps toolbar `globalFilter` search box). `navigateToDetail(employee)` → `router.push({ name: 'admin-employee-detail', params: { id: employee.id } })` (PRE-EXISTING, preserved).
- [x] 2.3 Verify existing `pnpm test:unit --run src/features/admin/employees` (existing green — `wu03-card-view.spec.ts`/`EmployeesListView.batch.spec.ts` UNCHANGED) + `pnpm build` clean. Runtime: toggle to cards renders inside `#cards` (no sibling v-else), card-click navigates to `admin-employee-detail` (no slideover), card kebab shows Editar/Dar de baja/Reactivar per CASL `canUpdate`, status tabs visible in `#filters`, search box in toolbar debounces 300ms, bulk-action bar still appears on selection, duplicate prev/next pagination gone.

**Commit**: `feat(admin-employees): render card in #cards slot and status tabs in #filters`. Stages `EmployeeFilters.vue` (modify), `EmployeesListView.vue` (modify — B).

---

## Phase 3: WU-C — Tests (~200-250 lines)

**Files**: expand `views/__tests__/EmployeesListView.test.ts`; strip `__tests__/useEmployeesList.spec.ts`; create `composables/__tests__/useEmployeeColumns.test.ts`, `composables/__tests__/useEmployeeViewMode.test.ts`. `EmployeesListView.batch.spec.ts` + `wu03-card-view.spec.ts` UNCHANGED (preserved invariants). Strict-TDD: RED → GREEN → REFACTOR.

- [x] 3.1 Modify `__tests__/useEmployeesList.spec.ts`: port `buildEmployeesQueryParams` to `pageIndex` contract (0-based input; `status` lowercase; no tenantId; `search`/`managerId` omitted when undefined); port `employeesApi.list` spy to expect `page = pageIndex + 1` and NO sort param; keep pure adapter (`mapPaginated`), `normalizeEmployee`, badge-tone maps, `formatHireDate`, column-id-set (no `salario`) tests.
- [x] 3.2 RED expand `views/__tests__/EmployeesListView.test.ts` (from 1.7 + WU-B): mock `useServerTable` (mockState incl. `isError`/`error` refs, `globalFilter`, `columnVisibility`, `pagination`, `displayMode` via `useEmployeeViewMode`); stub `AppDataTable` (`data-error`/`data-error-message`/`data-column-visibility`/`data-display-mode`/`data-show-add-button` attrs, `actions`/`cards`/`filters` slots), `EmployeeCardGrid`, `EmployeeUpsertSlideover` (`data-mode`/`data-employee-id`), `ViewToggle`, `AdminPageHeader` (`data-title`), `ConfirmModal`, `BatchTerminateModal`. Real `useEmployeeViewMode` (localStorage-driven). Red.
- [x] 3.3 GREEN tests: error block precedence (`response.data.message` string|array[0] → `error.message` → "No se pudieron cargar los colaboradores. Reintenta."); retry → `refresh`; empty suppressed on error; `ViewToggle` renders; `display-mode` default `table`, localStorage `card`→`cards`, invalid→`table`; `enable-column-visibility` wired; `AdminPageHeader` `:data-title` = "Colaboradores".
- [x] 3.4 GREEN tests: status tabs in `#filters` (Todos → `statusTab=ALL`, Activos → `statusTab=ACTIVE`/request `status=active`, Bajas → `statusTab=TERMINATED`/request `status=terminated`); search input updates `globalFilter` after 300ms → request `search=juan`; card-click → `router.push({ name: 'admin-employee-detail', params: { id } })` (PRE-EXISTING navigateToDetail preserved); card kebab visible per CASL `canUpdate` (Editar/Dar de baja/Reactivar); bulk selection preserved (selectedRows → selectedEmployees alias wired into batch composables); `:show-add-button="canCreate"` gates create; no `router.push` to `admin-employee-edit` on card click.
- [x] 3.5 `composables/__tests__/useEmployeeViewMode.test.ts`: localStorage roundtrip under `employee-view-mode`; invalid stored → `table`; `displayMode` bridges `card`→`cards`; `isEmployeeViewMode` guard accepts only `table`/`card`.
- [x] 3.6 `composables/__tests__/useEmployeeColumns.test.ts`: order `[colaborador, cargo, departamento, jefedirecto, fechaIngreso, modalidad, estado, actions]`; headers `Colaborador`/`Cargo`/`Departamento`/`Jefe directo`/`Fecha de ingreso`/`Modalidad`/`Estado`; 7 data `enableHiding: true` + `enableSorting: false`; `actions` `enableHiding: false` + `enableSorting: false` + right-aligned.
- [x] 3.7 REFACTOR trim mocks, consolidate stubs; tests green.
- [x] 3.8 Verify `pnpm test:unit --run src/features/admin/employees` (all green — new + ported + preserved `wu03-card-view.spec.ts`/`EmployeesListView.batch.spec.ts`) + `pnpm build` clean; full suite green.

**Commit**: `test(admin-employees): cover list view, view mode, columns, and gating`. Stages `EmployeesListView.test.ts` (new), `useEmployeesList.spec.ts` (modify), `useEmployeeColumns.test.ts` (new), `useEmployeeViewMode.test.ts` (new).

---

## Threat Matrix

N/A per design (no new route, no shell/subprocess/VCS automation, no executable-file classification, no process integration). `navigateToDetail` `router.push` to `admin-employee-detail` is PRE-EXISTING — preserved, not introduced. No additional RED-test tasks required.

---

## Definition of Done

- [x] REQ-1..10 satisfied; REQ-7/8/10 invariants preserved (`defaultPinning.right: ['actions']`; card kebab via CASL `canUpdate`; card-click → `admin-employee-detail`; bulk-action bar + `BATCH_OPS_CAP = 100`; `useManagerResolution` batch resolution (60s cache); `normalizeEmployee`/`computeSeniority`/`buildCardData` untouched; `EmployeeCard`/`EmployeeCardGrid` visuals untouched; `Employee` type unchanged; no new route; no backend change; `employees.api.ts` no sort param; `mapPaginated` bridges `{ data, total, page, limit, pageSize }` → `pageIndex`)
- [x] `pnpm test:unit --run src/features/admin/employees` green; `pnpm build` clean; full suite green
- [x] Per-WU commits on branch in order: WU-A → WU-B → WU-C (3 conventional commits on `feat/standardize-admin-employees-table`)
- [ ] `pnpm dev` smoke: error banner on forced 500 + retry refetches; toggle persists across reload (`employee-view-mode`); status tabs in `#filters`; search in toolbar debounces 300ms; card-click → `admin-employee-detail`; card kebab visible per `canUpdate`; bulk-action bar still shows on selection; all 7 data columns hideable; `actions` non-sortable + non-hideable + right-aligned + right-pinned; no Importar/Exportar/Filtros/department/modality/sort placeholders