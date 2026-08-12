# Tasks: Standardize Admin Tenant Members Table

Derived from `proposal.md`, `design.md`, `specs/admin-tenant-members-list/spec.md` (REQ-1..7).

- Execution mode: AUTO (user away — orchestrator gatekeeps); delivery: no PRs — conventional commits on branch, user merges to main
- Artifact store: openspec; review budget: 400 lines/WU; strict TDD: `pnpm test:unit` (vitest), gate `pnpm build`
- WU-B ships without tests (Fase 1 + users + roles + tenants lessons) — tests land in WU-C
- `memberships.api.ts` is **untouchable** — full-catalog local filter/sort/paginate is correct (REQ-7 invariant); `tenantId` stays from `route.params.tenantId`; `AdminPageHeader` + `useTenantSummary` stay as-is

---

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: Medium

Estimated ~620 lines (WU-A ~150 + WU-B ~180 + WU-C ~290). Each WU < 400. WU-C is heaviest (test file expansion + spec strip). Precedents: tenants ~650 (PASS WITH WARNINGS), roles ~600 (PASS WITH WARNINGS), users 796 (PASS WITH WARNINGS).

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WU-A | view mode + error handling + column flags + defaultSorting fix + enable-column-visibility | commit 1 on branch | `pnpm test:unit --run src/features/admin/tenants/memberships/composables/__tests__/useMembershipViewMode.test.ts` | `pnpm dev` toggling error/reload/column-vis | revert `useMembershipViewMode.ts`/`useMembershipColumns.ts` + AdminTenantMembersView.vue A edits |
| WU-B | EmployeeCard-pattern card view + grid + click-to-edit guarded (NO tests) | commit 2 on branch | N/A (no tests in WU-B by design — Fase 1/2-#1/#2/#3 lesson) | `pnpm dev` toggling to cards, click opens edit slideover without nav | delete `MemberCard.vue`/`MemberCardGrid.vue` + strip `#cards` slot + `handleCardClick` |
| WU-C | tests: error, toggle, columns, gating, card-click guard, defaultSorting, null-safe chip | commit 3 on branch | `pnpm test:unit --run src/features/admin/tenants/memberships` | N/A | revert new test files + restore stripped spec section |

| Unit | REQs | Commit |
|------|------|--------|
| WU-A | 1, 2, 5, 6, 7 | `feat(admin-tenant-members): add view mode, surface list errors, fix default sort` |
| WU-B | 3 | `feat(admin-tenant-members): add EmployeeCard-pattern card view with click-to-edit` |
| WU-C | 1..7 | `test(admin-tenant-members): cover list view, view mode, columns, and gating` |

---

## Phase 1: WU-A — View Mode + Error Handling + Column Flags + defaultSorting Fix (~150 lines)

**Files**: create `composables/useMembershipViewMode.ts` + RED stub `composables/__tests__/useMembershipViewMode.test.ts` + RED stub `views/__tests__/AdminTenantMembersView.test.ts`; modify `composables/useMembershipColumns.ts`, `views/AdminTenantMembersView.vue`. Strict-TDD: RED → GREEN → REFACTOR.

- [ ] 1.1 RED `composables/__tests__/useMembershipViewMode.test.ts`: localStorage roundtrip under `admin-tenant-members-view-mode`; default `table`; invalid stored → `table`; `displayMode` bridges `card`→`cards`; `isMembershipViewMode` guard accepts only `table`/`card`; rejects `cards`/`grid`/`''`. Red.
- [ ] 1.2 GREEN `composables/useMembershipViewMode.ts`: wrap `useViewMode('admin-tenant-members-view-mode', ['table','card'], 'table')`; export `MEMBERSHIP_VIEW_MODE_STORAGE_KEY` + `MembershipViewMode` + `isMembershipViewMode` + `{ viewMode, setMode, toggleViewMode, displayMode }` (computed bridges `card`→`cards`). Green.
- [ ] 1.3 RED stub `views/__tests__/AdminTenantMembersView.test.ts` pinning `membershipsErrorMessage` precedence (`response.data.message` string|array[0] → `error.message` → "No se pudieron cargar los miembros. Reintenta.") + `defaultSorting: [{ id: 'userName', desc: false }]` + `enable-column-visibility` + `:display-mode="displayMode"`. Red.
- [ ] 1.4 GREEN `views/AdminTenantMembersView.vue`: destructure `isError`/`error` from `useServerTable`; add `membershipsErrorMessage` computed; pass `:error="isError"` + `:error-message="membershipsErrorMessage"` to `AppDataTable`. Green.
- [ ] 1.5 RED column stub in `AdminTenantMembersView.test.ts`: order `[userName, roleName, createdAt, actions]`; headers `Usuario/Rol/Fecha de ingreso`; `userName`/`roleName`/`createdAt` sortable via `SortableHeader`; `actions` non-sortable/non-hideable/`text-right`. Red.
- [ ] 1.6 GREEN `composables/useMembershipColumns.ts`: explicit `enableSorting: true` + `enableHiding: true` on `userName`/`roleName`/`createdAt`; `actions` `enableSorting: false` + `enableHiding: false` + `class: 'text-right'` (preserved). Green.
- [ ] 1.7 GREEN `views/AdminTenantMembersView.vue`: `enable-column-visibility`; wire `useMembershipViewMode()`; `ViewToggle` (aria-label "Seleccionar vista de miembros") in `#actions`; `:display-mode="displayMode"`; `defaultSorting: [{ id: 'userName', desc: false }]` (replace latent `userEmail` bug). Green.
- [ ] 1.8 REFACTOR trim dead imports; tests green.
- [ ] 1.9 Verify `pnpm test:unit --run src/features/admin/tenants/memberships` green + `pnpm build` clean.

**Commit**: `feat(admin-tenant-members): add view mode, surface list errors, fix default sort`. Stages `useMembershipViewMode.ts` (new), `useMembershipViewMode.test.ts` (new), `useMembershipColumns.ts` (modify), `AdminTenantMembersView.vue` (modify), `AdminTenantMembersView.test.ts` stub (new).

---

## Phase 2: WU-B — Card View + Grid + Click-to-Edit Guarded (~180 lines, NO TESTS)

**Files**: create `components/MemberCard.vue`, `components/MemberCardGrid.vue`; modify `views/AdminTenantMembersView.vue`. Implementation only.

- [ ] 2.1 `components/MemberCard.vue`: `<article data-testid="member-card">` + `EntityAvatar(:name=userName, :seed=userId||id, size=lg)` + `userName` + `userEmail` header + chip row (`AppBadge(:label=roleName, tone="info")` always + null-safe `StatusDotBadge` rendered only when `member.userIsActive !== undefined` via `activityToBadgeTone` with label `Activo`/`Inactivo`) + `border-t border-dashed border-default` divider + 2-col body (`Rol` `AppBadge(info)` + `Fecha de ingreso` `dateFormatter` es-AR, `-` fallback). Props `{ member: MembershipTableRow }`. Emit `click` only — NO kebab, NO checkbox.
- [ ] 2.2 `components/MemberCardGrid.vue`: props `{ members: MembershipTableRow[]; loading?: boolean; empty?: string }`; emit `card-click`; ladder `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7`; 8 pulse skeletons; `i-lucide-users` empty icon.
- [ ] 2.3 `views/AdminTenantMembersView.vue`: import `MemberCardGrid`; `handleCardClick(member)` → `openEdit(member)` guarded: `if (!canUpdateMembership.value) return` (matches tenants `openEdit` guard); `#cards` slot → `MemberCardGrid(:members="data", :loading="isLoading || isFetching", :empty="'No se encontraron miembros'", @card-click="handleCardClick")`. NO `router.push`, NO detail route.
- [ ] 2.4 Verify existing `pnpm test:unit --run src/features/admin/tenants/memberships` (existing green) + `pnpm build` clean. Runtime: toggle to cards, click opens edit slideover without nav, ladder fills 1/2/3/5/7, `Activo`/`Inactivo` chips render null-safe, no kebab on cards, click no-op without `canUpdateMembership`.

**Commit**: `feat(admin-tenant-members): add EmployeeCard-pattern card view with click-to-edit`. Stages `MemberCard.vue` (new), `MemberCardGrid.vue` (new), `AdminTenantMembersView.vue` (modify).

---

## Phase 3: WU-C — Tests (~290 lines)

**Files**: expand `views/__tests__/AdminTenantMembersView.test.ts`; strip `views/__tests__/AdminTenantMembersView.spec.ts`; create `composables/__tests__/useMembershipColumns.test.ts`, `composables/__tests__/useMembershipViewMode.test.ts`. Strict-TDD: RED → GREEN → REFACTOR.

- [ ] 3.1 Modify `views/__tests__/AdminTenantMembersView.spec.ts`: strip stub-weak mount section (`expect(wrapper.vm).toBeDefined()` asserts); add `isError`/`error` refs to `useServerTable` mock; keep ~12 solid unit + permission-guard tests (query keys, pageSize, persistKey, pinning, invalidation, kebab CASL gates).
- [ ] 3.2 RED expand `views/__tests__/AdminTenantMembersView.test.ts` (from 1.3 + 1.5 + WU-B): mock `useServerTable` (mockState incl. `isError`/`error` refs); stub `AppDataTable` (`data-error`/`data-error-message`/`data-column-visibility`/`data-display-mode` attrs, `actions`/`cards` slots), `MemberCardGrid`, `MembershipUpsertSlideover` (`data-mode`/`data-membership-id`), `ViewToggle`, `AdminPageHeader` (`data-title`). Real `useMembershipViewMode` (localStorage-driven). Red.
- [ ] 3.3 GREEN tests: error block precedence (backend `response.data.message` / `error.message` / Spanish fallback); retry→`refresh`; empty suppressed on error; `ViewToggle` renders; `display-mode` default `table`, localStorage `card`→`cards`, invalid→`table`; `enable-column-visibility` wired; `AdminPageHeader` `:data-title` = "Miembros del tenant".
- [ ] 3.4 GREEN tests: kebab via `UDropdownMenu` only when `getRowItems` non-empty (CASL `userCan` gates); card-click → `MembershipUpsertSlideover` (`data-mode="edit"`); no `router.push` on card click; card-click no-op when `canUpdateMembership` is false; `defaultSorting: [{ id: 'userName', desc: false }]` (no `userEmail`); `userIsActive` null-safe chip; add-flow via `AppDataTable` `add-button-text="Agregar miembro"` preserved.
- [ ] 3.5 `composables/__tests__/useMembershipViewMode.test.ts`: localStorage roundtrip under `admin-tenant-members-view-mode`; invalid stored → `table`; `displayMode` bridges `card`→`cards`; `isMembershipViewMode` guard.
- [ ] 3.6 `composables/__tests__/useMembershipColumns.test.ts`: order `[userName, roleName, createdAt, actions]`; headers `Usuario`/`Rol`/`Fecha de ingreso`; `userName`/`roleName`/`createdAt` sortable + hideable; `actions` non-sortable + non-hideable + `text-right`.
- [ ] 3.7 REFACTOR trim mocks, consolidate stubs; tests green.
- [ ] 3.8 Verify `pnpm test:unit --run src/features/admin/tenants/memberships` (all green) + `pnpm build` clean.

**Commit**: `test(admin-tenant-members): cover list view, view mode, columns, and gating`. Stages `AdminTenantMembersView.test.ts` (new), `AdminTenantMembersView.spec.ts` (modify), `useMembershipColumns.test.ts` (new), `useMembershipViewMode.test.ts` (new).

---

## Threat Matrix

N/A per design (no routing/shell/subprocess/VCS/exec/process boundaries; card click → slideover, no `router.push`). No additional RED-test tasks required.

---

## Definition of Done

- [ ] REQ-1..7 satisfied; REQ-7 invariants preserved (`defaultPinning.right: ['actions']`; CASL `userCan` kebab gates; `persistKey: 'admin-tenant-members-{tenantId}'` per-tenant; full-catalog local filter/sort/paginate over `membershipsApi.getPaginated`; `memberships.api.ts` contract untouched; `tenantId` from `route.params.tenantId` not `authStore`; `AdminPageHeader` + `useTenantSummary` header untouched; `defaultSorting` is `userName` ascending; no `userEmail` reference)
- [ ] `pnpm test:unit --run src/features/admin/tenants/memberships` green; `pnpm build` clean; full suite green
- [ ] Per-WU commits on branch in order: WU-A → WU-B → WU-C (3 conventional commits on `feat/standardize-admin-tenant-members-table`)
- [ ] `pnpm dev` smoke: error banner on forced 500 + retry refetches; toggle persists across reload (`admin-tenant-members-view-mode` global, `persistKey` per-tenant); card-click opens edit slideover without nav; click no-op without `canUpdateMembership`; all 3 data columns hideable; `actions` non-sortable + non-hideable + right-aligned + right-pinned
