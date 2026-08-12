# Archive Report: standardize-admin-users-table

**Change**: standardize-admin-users-table
**Archived**: 2026-08-12
**Cycle verdict**: PASS WITH WARNINGS — closed cleanly (no blockers, no CRITICAL)

---

## Executive Summary

All 7 requirements (15 scenarios) shipped across 3 implementation commits on branch `feat/standardize-admin-users-table` (4 commits total including the docs bootstrap). Final verification: 3930 tests pass (exit 0), `vue-tsc --build` + `vite build` clean, 0 blockers. The new `admin-users-list` capability is now source-of-truth under `openspec/specs/admin-users-list/spec.md` with REQ-4 wording tightened to reflect the actual `canManageUserActions` gating (`canUpdateUser || canDeleteUser`). Change folder archived; cycle complete. Ready for Fase 2 next change (Admin Roles).

---

## Final State (per Final-State Authority)

Per the orchestrator's launch prompt (highest-ranked source after `reviewGate`) and the verified `verify-report.md`, the change closed in the following state:

- **Verify phase verdict**: PASS WITH WARNINGS — 7/7 requirements, 15/15 scenarios, `pnpm test:unit --run` exit 0 (3930 tests), `pnpm build` exit 0. 0 blockers, 0 CRITICAL findings.
- **Implementation commits** (all on branch `feat/standardize-admin-users-table`; user merges manually to `main`):
  - `06eb1fa` — `docs(admin-users): add proposal, spec, design, and tasks for table standardization` (docs-only, 371 lines)
  - `72b637a` — `feat(admin-users): add view mode, surface list errors, expose email column` (WU-A, 178 lines)
  - `d0eea46` — `feat(admin-users): add EmployeeCard-pattern card view with click-to-edit` (WU-B, 164 lines, **no tests** — Fase 1 lesson)
  - `bc7a1a1` — `test(admin-users): cover list view, view mode, columns, and kebab gating` (WU-C, 454 lines — test-only, over the 400-line budget; orchestrator-approved maintainer exception W1)
- **Tasks artifact**: All 19 implementation tasks marked `[x]` in `tasks.md` (archived) after archive-time reconciliation. See "Task Reconciliation" below.
- **Spec source of truth**: `openspec/specs/admin-users-list/spec.md` created from the delta spec (capability was new; no prior main spec existed). REQ-4 wording TIGHTENED to specify `canUpdateUser || canDeleteUser` (the parenthetical "(canCreate/canUpdate/canDelete)" was imprecise — create has no kebab action, it's the Add button).
- **Archived folder**: `openspec/changes/archive/2026-08-12-standardize-admin-users-table/`
- **Active changes directory**: `standardize-admin-users-table` no longer present.

---

## Task Reconciliation (Task Completion Gate)

The persisted `tasks.md` arrived at archive with all 19 implementation tasks unchecked. All 19 are addressed here under the orchestrator-approved exceptional repair path (documented in the launch prompt — "Fase 1 lesson: `standardize-card-grids` archive required manual checkbox reconciliation"):

- **Reconciliation evidence**: `verify-report.md` Completeness section reports "Tasks complete: 19 / Tasks incomplete: 0". The 4 commits on branch deliver every task's artifact: `useUserViewMode.ts` (1.1-1.2), `AdminUsersView.vue` error destructure/computed (1.3-1.4), `useUserColumns.ts` email column (1.5-1.6), `enable-column-visibility` + ViewToggle slots (1.7), `UserCard.vue` (2.1), `UserCardGrid.vue` (2.2), `AdminUsersView.vue` card-click handler (2.3), runtime smoke (2.4), `AdminUsersView.test.ts` (3.1-3.3, 3.5), `useUserColumns.test.ts` (3.4), final verify (3.6).
- **Final verify numbers** (highest-ranked source per Final-State Authority): 3930/3930 tests pass, `pnpm build` clean, 0 CRITICAL.
- **DoD reconciled**: REQ-1..7 satisfied; REQ-7 invariants preserved (`defaultPinning.actions`-right; tenant scoping via `authStore.currentTenantId`; `rolesCache` batch; `AdminPageHeader`; CASL gates; `users.api.ts` NOT modified; G5 left as documented follow-up).

**Result**: All 19 tasks marked `[x]` in archived `tasks.md` with explicit commit SHA pointers and an embedded reconciliation note. Cycle proceeds.

---

## Spec Sync

| Domain | Action | Details |
|--------|--------|---------|
| `admin-users-list` | **Created** | 7 ADDED requirements (REQ-1 through REQ-7); no MODIFIED / REMOVED / RENAMED. Delta was a full spec — copied as the main spec after reformatting from delta framing to the standard main-spec shape. REQ-4 wording tightened to specify `canUpdateUser || canDeleteUser` per Suggestion S2 in `verify-report.md`. |

The main spec at `openspec/specs/admin-users-list/spec.md` now defines the `admin-users-list` capability and supersedes the delta. It is the source of truth from this point forward.

### REQ-4 reconciliation diff (delta → main)

| Field | Delta wording (imprecise) | Main-spec wording (reconciled) |
|-------|---------------------------|-------------------------------|
| Permission gate | "`canManageUserActions` (`canCreate`/`canUpdate`/`canDelete`)" | `canManageUserActions` (`canUpdateUser \|\| canDeleteUser`); the Add button is gated separately by `canUpdateUser` and is not part of the kebab. |

The reconciled wording matches the verified implementation per `verify-report.md` Spec Compliance Matrix REQ-4 (✅ COMPLIANT — `canManageUserActions = canUpdateUser || canDeleteUser` (141); `UDropdownMenu v-if="canManageUserActions"` (299-300)) and `design.md` §Architecture Decisions row 2 ("`user` only — single prop, single `click` emit ... Permission gate lives in `openEdit`'s existing `canUpdateUser` check"). The create permission is correctly attributed to the Add button, not the kebab.

---

## Archive Contents

```
openspec/changes/archive/2026-08-12-standardize-admin-users-table/
├── proposal.md            ✅
├── design.md              ✅
├── tasks.md               ✅  (19/19 tasks complete after reconciliation)
├── verify-report.md       ✅  (PASS WITH WARNINGS — 7/7 reqs, 15/15 scenarios, 0 blockers)
└── specs/
    └── admin-users-list/
        └── spec.md        ✅  (delta spec, archived for audit trail)
```

---

## Review Budget Note (carried forward)

The proposal forecast was "Low" risk; total 1167 insertions across 4 commits.

- **WU-C (`bc7a1a1`) — 454 insertions of test code**: exceeds the 400-line review budget (forecast ~180). Test-only commit — no production code touched. Documented as WARNING W1 in `verify-report.md`. The orchestrator's launch prompt explicitly states "(may be under `architecture/sdd-apply-progress-standardize-admin-users-table`, obs 3663) ... WU-C test-only lines (maintainer exception approved in runtime ledger)" — that pre-approval is the explicit override recorded here; it does NOT weaken the gate.
- **WU-B (`d0eea46`) — 164 lines, no tests**: deliberate (Fase 1 lesson — customers WU-B went over budget). Tests landed in WU-C. Documented as a TDD compliance partial in `verify-report.md` (4/6 checks fully passed; 2 partial — WU-B no-tests is a documented decision; safety-net N/A because the changed files were previously untested).
- All other commits (docs + WU-A) under the 400-line authored-risk budget.

---

## Warnings Carried Forward (non-blocking)

1. **W1 — WU-C test-only commit at 454 lines** (over the 400-line review budget). No production code touched. Recorded above.
2. **W2 — `vi.mock('@nuxt/ui')` unreliability in jsdom**: the real Reka UI `UDropdownMenu` still renders when the actions-cell slot is active, so item-level assertions ("Editar"/"Eliminar") cannot be reliably asserted. Kebab gating is verified via `reka-dropdown-menu-trigger` substring presence/absence (the established `CustomersView.test.ts` pattern). REQ-4 "editor" scenario is therefore PARTIAL: presence tested, item labels source-verified in `getRowItems` (172-190).
3. **W3 — Card-mode error bypass**: `AppDataTable`'s `#cards` branch bypasses `error`, so a failed request in card mode renders the grid's empty state ("No se encontraron usuarios") instead of the error block. Parity limitation identical in CustomersView/PromotionsView; fix belongs in AppDataTable (shared candidate), out of scope for this change. (design open question, accepted)
4. **W4 — UserCard.vue / UserCardGrid.vue have no direct spec tests**. REQ-3 (ladder/no-kebab, loading/empty) and REQ-5 (chip Activo/Inactivo) are source-verified only. Diverges from CustomersView gold standard (which shipped `CustomerCard.spec.ts` + `CustomerCardGrid.spec.ts`). WU-B "no tests" decision deferred tests to WU-C, but WU-C delivered view-level coverage only (grid is stubbed in `AdminUsersView.test.ts`), not component-internal coverage. Presentational/low-risk, but a real coverage gap.

---

## Suggestions Carried Forward (non-blocking)

1. **S1 — Add `UserCard.spec.ts` + `UserCardGrid.spec.ts`** in a follow-up to lock card internals (chip row, dashed divider, 2-col body, ladder breakpoints, skeleton/empty) at runtime — closes W4.
2. **S2 — Tighten spec REQ-4 wording**: COMPLETED at archive time (see "Spec Sync" above).
3. **S3 — Install `@vitest/coverage-v8`** to enable per-file coverage reporting for future SDD changes.
4. **S4 — `// @ts-nocheck` at the top of `AdminUsersView.test.ts`** (392 lines) suppresses type-checking of a large test file — consider typing the mocks and removing it.

---

## Follow-ups (non-blocking)

1. **G5 local filter semantics** (`users.api.ts:11-42` `applyLocalFilters` filters/sorts only the fetched page; search matches only the current page while `totalCount` stays the backend total — wrong pagination during search). Kept as-is in this change. `users.api.ts` NOT modified in this branch. Documented follow-up to `houndfe-backend` (sibling repo) — verify `/admin/users` search/sort contract. NOT silently fixed.
2. **Manual mobile toolbar QA** parity check (defensive — admin shell typically doesn't share the slot issues documented for promotions) — covered by `pnpm test:unit` smoke + `pnpm build`; manual `xs`/`sm` render not exercised.
3. **Shared AppDataTable fix candidate** (W3 above) — when the next shared-table standardization lands, migrate the card-mode error bypass into the shared component. Tracked as a candidate for the `standardize-card-grids` follow-up if such a change is scoped.

---

## Contradictions and Final-State Resolutions

No unrankable contradictions found. All facts consistent across sources:

- `verify-report.md` (intermediate snapshot) and the launch prompt (highest-ranked) agree on the final state: 3930/3930 tests, build clean, 0 CRITICAL, 4 WARNINGs.
- REQ-4 spec-vs-implementation divergence: the delta's `(canCreate/canUpdate/canDelete)` parenthetical was imprecise. Implementation per `verify-report.md` correctness row REQ-4 uses `canManageUserActions = canUpdateUser || canDeleteUser`, the create permission gating the Add button instead of the kebab. Reconciled in main spec (see "Spec Sync" above).
- Final test/build numbers (3930 tests, exit 0; build clean) match the verify report — no later work altered them.
- No CRITICAL issues in `verify-report.md`. WARNINGs are non-blocking and tracked above.

---

## Source-of-Truth Specs Updated

The following main spec now reflects the standardized admin users list behavior:

- `openspec/specs/admin-users-list/spec.md` (NEW)

No other main spec was modified. The delta spec (`openspec/changes/standardize-admin-users-table/specs/admin-users-list/spec.md`) is preserved in the archive for audit traceability.

---

## SDD Cycle Status

| Phase | Status |
|-------|--------|
| Propose | ✅ complete |
| Spec | ✅ complete |
| Design | ✅ complete |
| Tasks | ✅ complete (19/19 [x] after archive-time reconciliation) |
| Apply | ✅ complete (4 commits on branch) |
| Verify | ✅ PASS WITH WARNINGS (0 blockers) |
| **Archive** | ✅ **complete** |

The change has been fully planned, implemented, verified, and archived. Ready for the next change (Fase 2: Admin Roles).
