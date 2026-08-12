# Tasks: Standardize Admin Users Table

Derived from `proposal.md`, `design.md`, `specs/admin-users-list/spec.md` (REQ-1..7).

- Execution mode: interactive; delivery: no PRs — conventional commits on branch, user merges to main
- Artifact store: openspec; review budget: 400 lines/WU; strict TDD: `pnpm test:unit` (vitest), gate `pnpm build`
- WU-B ships without tests (Fase 1 lesson) — tests land in WU-C

---

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: Low

Estimated ~515 lines total (WU-A ~155 + WU-B ~180 + WU-C ~180). Each WU < 400. WU-B heaviest but `UserCard.vue` stays lean (no kebab).

| Unit | Goal | REQs | Commit |
|------|------|------|--------|
| WU-A | view mode + error + email column + visibility | 1, 2, 6 | `feat(admin-users): add view mode, surface list errors, expose email column` |
| WU-B | card view + grid + click-to-edit (NO tests) | 3, 5 | `feat(admin-users): add EmployeeCard-pattern card view with click-to-edit` |
| WU-C | tests: error, toggle, columns, kebab | 1, 2, 4, 6 | `test(admin-users): cover list view, view mode, columns, and kebab gating` |

Test cmd (all): `pnpm test:unit --run src/features/admin/users`. Harness: `pnpm dev` for WU-A/B; N/A for WU-C. Rollback: revert per-WU files only.

---

## Phase 1: WU-A — View Mode + Error Handling + Email Column (~155 lines)

**Files**: create `composables/useUserViewMode.ts`; modify `composables/useUserColumns.ts`, `views/AdminUsersView.vue`. Strict-TDD: RED → GREEN → REFACTOR.

- [x] 1.1 RED `composables/__tests__/useUserViewMode.test.ts`: localStorage roundtrip; default `table`; invalid stored → `table`; `displayMode` bridges `card`→`cards`. Run — red.
- [x] 1.2 GREEN `useUserViewMode.ts`: wrap `useViewMode('admin-users-view-mode', ['table','card'], 'table')`; export `isUserViewMode` + `{ viewMode, setMode, toggleViewMode, displayMode }`. Test green.
- [x] 1.3 RED stub `AdminUsersView.test.ts` pinning `usersErrorMessage` precedence (`response.data.message` → `error.message` → "No se pudieron cargar los usuarios. Reintenta."). Red.
- [x] 1.4 GREEN `AdminUsersView.vue`: destructure `isError`/`error`; add `usersErrorMessage` computed; pass `:error` + `:error-message` to `AppDataTable`.
- [x] 1.5 RED column test: order `[name, email, roles, createdAt, actions]`; email header `'Email'`; email hideable; actions non-hideable. Red.
- [x] 1.6 GREEN `useUserColumns.ts`: insert email column between name and roles (`accessorKey: 'email'`, header `'Email'`); keep actions non-sortable/non-hideable/`text-right`. Test green.
- [x] 1.7 GREEN `AdminUsersView.vue`: `enable-column-visibility`; wire `useUserViewMode`; `ViewToggle` in `#actions`; `:display-mode="displayMode"`; `#email-header` + `#email-cell` slots (name-cell drops email).
- [x] 1.8 REFACTOR trim dead imports; `pnpm test:unit --run` green.
- [x] 1.9 Verify `pnpm test:unit --run src/features/admin/users` green + `pnpm build` clean.

**Commit**: `feat(admin-users): add view mode, surface list errors, expose email column` (`72b637a`). Stages `useUserViewMode.ts` (new), `useUserViewMode.test.ts` (new), `useUserColumns.ts` (modify), `AdminUsersView.vue` (modify). Tests with behavior.

---

## Phase 2: WU-B — Card View + Grid + Click-to-Edit (~180 lines, NO TESTS)

**Files**: create `components/UserCard.vue`, `components/UserCardGrid.vue`; modify `views/AdminUsersView.vue`. Implementation only — tests land in WU-C.

- [x] 2.1 `UserCard.vue`: `<article>` + `EntityAvatar(name=user.name, seed=user.id, size=lg)` + name/email + chip row `StatusDotBadge` (`activityToBadgeTone(user.isActive)`, label `Activo`/`Inactivo`, `compact`) + `border-t border-dashed border-default` divider + 2-col body (roles, createdAt). Props `{ user: UserTableRow }`. Emit `click` only — NO kebab, NO checkbox (PromotionCard contract).
- [x] 2.2 `UserCardGrid.vue`: props `{ users: UserTableRow[]; loading?: boolean; empty?: string }`; emit `card-click`; ladder `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7`; 8 pulse skeletons; `i-lucide-users` empty.
- [x] 2.3 `AdminUsersView.vue`: import `UserCardGrid`; `handleCardClick(user)` → `openEdit(user)`; `#cards` slot → `UserCardGrid` with `@card-click="handleCardClick"`. NO `router.push`.
- [x] 2.4 Verify `pnpm test:unit --run src/features/admin/users` (existing green) + `pnpm build` clean. Runtime: toggle cards, click opens edit slideover, no nav, ladder fills at breakpoints.

**Commit**: `feat(admin-users): add EmployeeCard-pattern card view with click-to-edit` (`d0eea46`). Stages `UserCard.vue` (new), `UserCardGrid.vue` (new), `AdminUsersView.vue` (modify — import + slot + handler).

---

## Phase 3: WU-C — Tests (~180 lines)

**Files**: create `composables/__tests__/useUserColumns.test.ts`, `views/__tests__/AdminUsersView.test.ts`. Strict-TDD: RED → GREEN → REFACTOR.

- [x] 3.1 RED stub `AdminUsersView.test.ts`: mock `useServerTable` (mockState incl. `isError`/`error` refs); stub `AppDataTable` (slots + `data-error`/`data-error-message`/`data-column-visibility` attrs), `ViewToggle`, `UserCardGrid`, `UserUpsertSlideover`, `AdminPageHeader`, `AppBadge`, `ConfirmModal`, Nuxt UI primitives. Red.
- [x] 3.2 GREEN tests: error block + precedence (backend/`error.message`/Spanish fallback); retry→`refresh`; empty suppressed on error; `ViewToggle` renders; `display-mode` table→cards; `enable-column-visibility` wired.
- [x] 3.3 GREEN tests: kebab gating (read-only: no `reka-dropdown-menu-trigger`; editor: "Editar"; "Eliminar" only with `delete`); `card-click` → `UserUpsertSlideover` receives user; no `router.push`.
- [x] 3.4 `useUserColumns.test.ts`: order `[name, email, roles, createdAt, actions]`; name/email/createdAt string headers (sortable); roles `createSimpleHeader` (not sortable); actions non-sortable/non-hideable/`text-right`; email hideable.
- [x] 3.5 REFACTOR trim mocks, consolidate stubs; `pnpm test:unit --run` green.
- [x] 3.6 Verify `pnpm test:unit --run src/features/admin/users` (all green) + `pnpm build` clean.

**Commit**: `test(admin-users): cover list view, view mode, columns, and kebab gating` (`bc7a1a1`). Stages `AdminUsersView.test.ts` (new), `useUserColumns.test.ts` (new). Test-only commit.

---

## Threat Matrix

N/A per design (no routing/shell/subprocess/VCS/exec/process boundaries).

---

## Definition of Done

- [x] REQ-1..7 satisfied; REQ-7 invariants preserved (`defaultPinning.actions`-right; tenant scoping via `authStore.currentTenantId`; `rolesCache` batch; `AdminPageHeader`; CASL gates; no type/route/backend change; G5 left as documented follow-up)
- [x] `pnpm test:unit --run src/features/admin/users` green; `pnpm build` clean
- [x] Per-WU commits on branch in order: WU-A → WU-B → WU-C; each < 400 lines added (WU-C at 454 — test-only, documented deviation W1 in verify-report)
- [x] `pnpm dev` smoke: error banner on forced 500; toggle persists across reload; card-click opens edit slideover (no nav); all 4 columns hideable

---

## Archive-time reconciliation note

All 19 implementation tasks above were reconciled to `[x]` during archive (`sdd-archive`) per the orchestrator's explicit pre-approval and the Fase 1 lesson (`standardize-card-grids` required the same mechanical reconciliation). Verification evidence:

- `verify-report.md` reports "Tasks complete: 19 / Tasks incomplete: 0" (completion was tracked by commits, not checkbox state).
- 4 commits on branch (`06eb1fa` docs + `72b637a` WU-A + `d0eea46` WU-B + `bc7a1a1` WU-C) deliver every task's artifact.
- `pnpm test:unit --run` exit 0 (3930/3930); `pnpm build` exit 0.
- No CRITICAL issues in `verify-report.md` — only 4 non-blocking WARNINGs (W1 test-only commit line count, W2 `@nuxt/ui` mock reliability, W3 card-mode error bypass, W4 UserCard/UserCardGrid coverage gap as SUGGESTION S1).