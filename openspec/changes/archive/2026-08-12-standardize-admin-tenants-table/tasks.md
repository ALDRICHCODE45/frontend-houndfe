# Tasks: Standardize Admin Tenants Table

Derived from `proposal.md`, `design.md`, `specs/admin-tenants-list/spec.md` (REQ-1..7).

- Execution mode: AUTO (user away — orchestrator gatekeeps); delivery: no PRs — conventional commits on branch, user merges to main
- Artifact store: openspec; review budget: 400 lines/WU; strict TDD: `pnpm test:unit` (vitest), gate `pnpm build`
- WU-B ships without tests (Fase 1 + users + roles lessons) — tests land in WU-C
- `tenants.api.ts` is **untouchable** — full-catalog local filter/sort/paginate is correct (REQ-7 invariant); `tenant-actions.utils.ts` stays as-is

---

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: Medium

Estimated ~650 lines (WU-A ~175 + WU-B ~180 + WU-C ~295). Each WU < 400. WU-B heaviest but `TenantCard.vue` stays lean (no kebab). Precedents: roles ~600 (PASS WITH WARNINGS), users 796 (PASS WITH WARNINGS).

| Unit | Goal | REQs | Commit |
|------|------|------|--------|
| WU-A | view mode + error + phone column + visibility + header + #filters | 1, 2, 5, 6, 7 | `feat(admin-tenants): add view mode, surface list errors, standardize header and filters` |
| WU-B | card view + grid + click-to-edit (NO tests) | 3 | `feat(admin-tenants): add EmployeeCard-pattern card view with click-to-edit` |
| WU-C | tests: error, toggle, columns, kebab, cards | 1..7 | `test(admin-tenants): cover list view, view mode, columns, and gating` |

Test cmd (all): `pnpm test:unit --run src/features/admin/tenants`. Harness: `pnpm dev` for WU-A/B; N/A for WU-C. Rollback: revert per-WU files only.

---

## Phase 1: WU-A — View Mode + Error Handling + Phone Column + Header + Filters (~175 lines)

**Files**: create `composables/useTenantViewMode.ts`; modify `composables/useTenantColumns.ts`, `views/AdminTenantsView.vue`. Strict-TDD: RED → GREEN → REFACTOR.

- [x] 1.1 RED `composables/__tests__/useTenantViewMode.test.ts`: localStorage roundtrip under `admin-tenants-view-mode`; default `table`; invalid stored → `table`; `displayMode` bridges `card`→`cards`; `isTenantViewMode` guard accepts only `table`/`card`. Red.
- [x] 1.2 GREEN `composables/useTenantViewMode.ts`: wrap `useViewMode('admin-tenants-view-mode', ['table','card'], 'table')`; export `TENANT_VIEW_MODE_STORAGE_KEY` + `TenantViewMode` + `isTenantViewMode` + `{ viewMode, setMode, toggleViewMode, displayMode }`. Green.
- [x] 1.3 RED stub `views/__tests__/AdminTenantsView.test.ts` pinning `tenantsErrorMessage` precedence (`response.data.message` → `error.message` → "No se pudieron cargar las sucursales. Reintenta."). Red.
- [x] 1.4 GREEN `views/AdminTenantsView.vue`: destructure `isError`/`error` from `useServerTable`; add `tenantsErrorMessage` computed; pass `:error="isError"` + `:error-message="tenantsErrorMessage"` to `AppDataTable`. Green.
- [x] 1.5 RED column stub in `AdminTenantsView.test.ts`: order `[name, slug, address, phone, isActive, createdAt, actions]`; headers `Nombre/Slug/Dirección/Teléfono/Estado/Creación`; name/slug/createdAt sortable via `SortableHeader`; address/phone/isActive non-sortable; actions non-sortable/non-hideable/`text-right`. Red.
- [x] 1.6 GREEN `composables/useTenantColumns.ts`: insert `phone` at pos 4 (non-sortable, hideable, no custom cell slot); explicit `enableSorting`/`enableHiding` everywhere; reorder per proposal `name, slug, address, phone, isActive, createdAt, actions`; `isActive` non-sortable marker preserved; `actions` non-sortable/non-hideable/`text-right`. Green.
- [x] 1.7 GREEN `views/AdminTenantsView.vue`: `enable-column-visibility`; wire `useTenantViewMode`; `ViewToggle` (aria-label "Seleccionar vista de sucursales") in `#actions`; `:display-mode="displayMode"`; move `includeInactive` `<UCheckbox>` from standalone `div` into `#filters` slot (still drives `adminTenantQueryKeys.list({ includeInactive })`); replace inline `<h2>` with `<AdminPageHeader title="Gestión de sucursales" :description="headerDescription" />` where `headerDescription = 'Gestión global de sucursales (solo super-admin).'`; `handleViewModeChange(mode)` guards via `isTenantViewMode`. Green.
- [x] 1.8 REFACTOR trim dead imports; tests green.
- [x] 1.9 Verify `pnpm test:unit --run src/features/admin/tenants` green + `pnpm build` clean.

**Commit**: `feat(admin-tenants): add view mode, surface list errors, standardize header and filters`. Stages `useTenantViewMode.ts` (new), `useTenantViewMode.test.ts` (new), `useTenantColumns.ts` (modify), `AdminTenantsView.vue` (modify), `AdminTenantsView.test.ts` stub (new).

---

## Phase 2: WU-B — Card View + Grid + Click-to-Edit (~180 lines, NO TESTS)

**Files**: create `components/TenantCard.vue`, `components/TenantCardGrid.vue`; modify `views/AdminTenantsView.vue`. Implementation only.

- [x] 2.1 `components/TenantCard.vue`: `<article data-testid="tenant-card">` + `EntityAvatar(:name, :seed=tenant.id, size=lg)` + name + slug + chip row (`StatusDotBadge` with `activityToBadgeTone(isActive)` and label `Activa`/`Inactiva`) + `border-t border-dashed border-default` divider + 2-col body (`Dirección` null-safe `'—'`, `Creación` `es-AR`). Props `{ tenant: TenantTableRow }`. Emit `click` only — NO kebab, NO checkbox.
- [x] 2.2 `components/TenantCardGrid.vue`: props `{ tenants: TenantTableRow[]; loading?: boolean; empty?: string }`; emit `card-click`; ladder `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7`; 8 pulse skeletons; `i-lucide-building` empty icon.
- [x] 2.3 `views/AdminTenantsView.vue`: import `TenantCardGrid`; `handleCardClick(tenant)` → `openEdit(tenant)` (same path the kebab triggers); `#cards` slot → `TenantCardGrid(:tenants="data", :loading="isLoading || isFetching", :empty="'No se encontraron sucursales'", @card-click="handleCardClick")`. NO `router.push`, NO detail route.
- [x] 2.4 Verify existing `pnpm test:unit --run src/features/admin/tenants` (existing green) + `pnpm build` clean. Runtime: toggle to cards, click opens edit slideover, no nav, ladder fills 1/2/3/5/7, `Activa`/`Inactiva` chips render, no kebab on cards.

**Commit**: `feat(admin-tenants): add EmployeeCard-pattern card view with click-to-edit`. Stages `TenantCard.vue` (new), `TenantCardGrid.vue` (new), `AdminTenantsView.vue` (modify).

---

## Phase 3: WU-C — Tests (~295 lines)

**Files**: create `views/__tests__/AdminTenantsView.test.ts`; create `composables/__tests__/useTenantColumns.test.ts`, `composables/__tests__/useTenantViewMode.test.ts`; modify `views/__tests__/AdminTenantsView.spec.ts` (strip mount section). Strict-TDD: RED → GREEN → REFACTOR.

- [x] 3.1 Modify `views/__tests__/AdminTenantsView.spec.ts`: strip mount section (lines 140–226 — `isError`/`error` mock lacks refs); port StatusDotBadge case into new test file; keep pure unit tests (mapTenantError, query keys, confirm copy).
- [x] 3.2 RED expand `views/__tests__/AdminTenantsView.test.ts` (from 1.3 + 1.5): mock `useServerTable` (mockState incl. `isError`/`error` refs); stub `AppDataTable` (`data-error`/`data-error-message`/`data-column-visibility`/`data-display-mode` attrs, `actions`/`cards`/`filters` slots), `TenantCardGrid`, `TenantUpsertSlideover` (`data-tenant-id`/`data-mode`), `StatusDotBadge`, `AdminPageHeader` (`:data-title`), `ViewToggle`, `UCheckbox`, `ConfirmModal`. Real `useTenantViewMode` (localStorage-driven). Red.
- [x] 3.3 GREEN tests: error block precedence (backend `response.data.message` / `error.message` / Spanish fallback); retry→`refresh`; empty suppressed on error; `ViewToggle` renders; `display-mode` default `table`, localStorage `card`→`cards`, invalid→`table`; `enable-column-visibility` wired; `AdminPageHeader` `:data-title` = "Gestión de sucursales".
- [x] 3.4 GREEN tests: kebab via `reka-dropdown-menu-trigger` (super-admin only); mounted `UDropdownMenu` `props('items')` flattened — `Editar` + `Gestionar miembros` + `Desactivar` present for super-admin; non-super-admin hides kebab; card-click → `TenantUpsertSlideover` (`data-tenant-id` in edit mode); no `router.push` on card click; `#filters` slot includes UCheckbox in BOTH modes; isActive cell StatusDotBadge (ported from spec).
- [x] 3.5 `composables/__tests__/useTenantViewMode.test.ts`: localStorage roundtrip under `admin-tenants-view-mode`; invalid stored → `table`; `displayMode` bridges `card`→`cards`; `isTenantViewMode` guard.
- [x] 3.6 `composables/__tests__/useTenantColumns.test.ts`: order `[name, slug, address, phone, isActive, createdAt, actions]`; headers `Nombre`/`Slug`/`Dirección`/`Teléfono`/`Estado`/`Creación`; name/slug/createdAt sortable; address/phone/isActive non-sortable; actions non-sortable/non-hideable/`text-right`.
- [x] 3.7 REFACTOR trim mocks, consolidate stubs; tests green.
- [x] 3.8 Verify `pnpm test:unit --run src/features/admin/tenants` (all green) + `pnpm build` clean.

**Commit**: `test(admin-tenants): cover list view, view mode, columns, and gating`. Stages `AdminTenantsView.test.ts` (new), `AdminTenantsView.spec.ts` (modify), `useTenantColumns.test.ts` (new), `useTenantViewMode.test.ts` (new).

---

## Threat Matrix

N/A per design (no routing/shell/subprocess/VCS/exec/process boundaries; card click → slideover, no `router.push`).

---

## Definition of Done

- [x] REQ-1..7 satisfied; REQ-7 invariants preserved (`defaultPinning.right: ['actions']`; `isSuperAdmin` kebab gate; `persistKey: 'admin-tenants'`; full-catalog local filter/sort/paginate over `tenantsApi.getPaginated`; `tenants.api.ts` contract untouched; `tenant-actions.utils.ts` untouched; "Gestionar miembros" preserved)
- [x] `pnpm test:unit --run src/features/admin/tenants` green; `pnpm build` clean; full suite green
- [x] Per-WU commits on branch in order: WU-A → WU-B → WU-C (3 conventional commits on `feat/standardize-admin-tenants-table`)
- [x] `pnpm dev` smoke: error banner on forced 500; toggle persists across reload; card-click opens edit slideover (no nav); all 6 data columns hideable; `isActive` non-sortable; super-admin-only kebab; `includeInactive` drives query key in both modes
---

## Reconciliation note (orchestrator, post-verify)

All 21 implementation tasks and 4 DoD items were completed by sdd-apply but left unchecked in this artifact. Verified green before marking: `pnpm test:unit --run src/features/admin/tenants` → 238/238, full suite → 3938/3938, `pnpm build` clean. Commits: WU-A `b045100`, WU-B `e8241ac`, WU-C `ede6318`. Marked [x] at archive gate per the established Fase 1/2 checkbox-reconciliation exception.
