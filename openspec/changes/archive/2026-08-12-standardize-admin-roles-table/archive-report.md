# Archive Report: standardize-admin-roles-table

**Change**: standardize-admin-roles-table
**Archived**: 2026-08-12
**Branch**: `feat/standardize-admin-roles-table` (user merges manually to main — no PRs, per session preflight)
**Cycle verdict**: PASS WITH WARNINGS — closed cleanly (no blockers, no CRITICAL)

---

## Executive Summary

All 8 requirements (16 scenarios) shipped across 3 implementation commits on `feat/standardize-admin-roles-table`, preceded by the docs commit. Final verification: 3935/3935 full suite + 87/87 roles-scoped tests pass (exit 0), `pnpm build` clean (vue-tsc + vite). The new `admin-roles-list` capability is now source-of-truth at `openspec/specs/admin-roles-list/spec.md`. All 19 archived `tasks.md` checkboxes marked `[x]` under the orchestrator-approved exceptional repair path, each annotated with the commit SHA that delivered it. Change folder archived; cycle complete. REQ-7 invariants hold (`rolesApi.getPaginated` untouched, `useAdminRolesQuery` coupling preserved).

---

## Final State (per Final-State Authority)

Per the orchestrator's launch prompt (highest-ranked source after `reviewGate`) and the verified `verify-report.md`, the change closed in the following state:

- **Verify phase verdict**: PASS WITH WARNINGS — 8/8 requirements, 16/16 scenarios, `pnpm test:unit --run` exit 0 (3935 tests), `pnpm build` exit 0. 0 blockers, 0 CRITICAL findings.
- **Implementation commits** (all on `feat/standardize-admin-roles-table`):
  - `cce4aa2` — `docs(admin-roles): add proposal, spec, design, and tasks for table standardization`
  - `ae64ef3` — `feat(admin-roles): add view mode, surface list errors, expose description column` (WU-A — 490 insertions, maintainer-delegated budget exception)
  - `fa34c01` — `feat(admin-roles): add EmployeeCard-pattern card view with click-to-edit` (WU-B — 171 insertions, no tests by design)
  - `04127ec` — `test(admin-roles): cover list view, view mode, columns, and kebab gating` (WU-C — 277 insertions)
- **Tasks artifact**: All 19 implementation tasks now marked `[x]` in archived `tasks.md` under the orchestrator-approved exceptional repair path (every checkbox annotated with the commit SHA that delivered it).
- **Spec source of truth**: `openspec/specs/admin-roles-list/spec.md` created from the delta spec (capability was new; no prior main spec existed). Reformatted from delta framing to the standard main-spec shape — 8 requirements, 16 scenarios, three-paragraph purpose describing the parity-with-`AdminUsersView` rationale and the deliberate roles-vs-users difference (`rolesApi.getPaginated` already fetches the full `/admin/roles` catalog so counts can be made sortable without a backend change).
- **Archived folder**: `openspec/changes/archive/2026-08-12-standardize-admin-roles-table/`
- **Active changes directory**: `standardize-admin-roles-table` no longer present.

---

## Task Reconciliation (Task Completion Gate)

The persisted `tasks.md` arrived at archive with **23 unchecked `- [ ]`** boxes (0 `[x]`) per `verify-report.md` §Completeness ("documentation-hygiene gap"). The `apply` phase implemented and shipped all 19 implementation tasks but did not tick the boxes during the work — completion is independently proven by the 3 WU commits + green tests/build + the `apply-progress` observation, so the gap is documentation hygiene, not substantive incompleteness.

The orchestrator's launch prompt explicitly pre-approved this exceptional repair:

> "Reconcile stale task checkboxes: mark all 19 tasks `[x]` in the ARCHIVED tasks.md with commit SHA pointers (ae64ef3, fa34c01, 04127ec) and a reconciliation note (Fase 1 + Fase 2-#1 lesson — orchestrator pre-approves this exceptional repair)."

**Action performed**: every implementation task in the archived `tasks.md` is now `[x]` with a `_(commit <SHA> — WU-X)_` pointer inline. A reconciliation note appended at the bottom records the orphan-tick lesson for the next change. The archived `tasks.md` is the audit trail; no follow-up commit needed.

**Fase 2 lesson (carried forward)**: apply-phase checkbox ticking must happen as commits land. This is the **second** Fase-2 cycle where the gap surfaced (after `standardize-admin-users-table`); the next change's apply phase should tick boxes commit-by-commit so the archive gate stays a no-op.

---

## Spec Sync

| Domain | Action | Details |
|--------|--------|---------|
| `admin-roles-list` | **Created** | 8 ADDED requirements (REQ-1 through REQ-8); no MODIFIED / REMOVED / RENAMED. Delta was a full spec — copied as the main spec after reformatting from delta framing to the standard main-spec shape (title + lead paragraph + `## Purpose` + `## Requirements` per the format of `openspec/specs/admin-users-list/spec.md` on `feat/standardize-admin-users-table` and `openspec/specs/promotions-list/spec.md` on `main`). |

The main spec at `openspec/specs/admin-roles-list/spec.md` now defines the `admin-roles-list` capability and supersedes the delta. It is the source of truth from this point forward. Notable main-spec-vs-delta refinements made during the reformat:

- **Lead paragraph** added that names the Fase-2-#2 origin, the `AdminUsersView` parity target, and the **deliberate** roles-vs-users difference: `rolesApi.getPaginated` already fetches the full `/admin/roles` catalog, so `permissionCount` / `userCount` can be made sortable without a backend change; `rolesApi.getPaginated` is **untouchable** because `useAdminRolesQuery` couples to its full-catalog contract. Stated up-front so future readers do not "fix" it.
- **REQ-1** expanded to the array-first-element precedence (matching `verify-report.md` Static Evidence row for `rolesErrorMessage` L74-81), with a two-bullet scenario covering both `string` and `array` shapes.
- **REQ-3** scenario list now covers three sub-scenarios: card click opens edit slideover (no `router.push`); ladder 1/2/3/5/7 with no kebab/checkbox; loading/empty with `i-lucide-shield`. Matches verify-report REQ-3 row.
- **REQ-7** now explicit about the `roles.api.ts` file being unchanged in the change diff (REQ-7 invariant preserved).
- **REQ-8** scenarios mirror the test files' actual assertions (view test pins error + toggle + visibility + header + kebab; columns test pins order + flags + headers). "Creación" header text added (missing from delta wording).

---

## Archive Contents

```
openspec/changes/archive/2026-08-12-standardize-admin-roles-table/
├── proposal.md            ✅
├── design.md              ✅
├── tasks.md               ✅  (19/19 tasks [x] after archive-time reconciliation, every box annotated with commit SHA)
├── verify-report.md       ✅  (PASS WITH WARNINGS — 8/8 reqs, 16/16 scenarios, 0 blockers)
├── archive-report.md      ✅  (this file)
└── specs/
    └── admin-roles-list/
        └── spec.md        ✅  (delta spec, archived for audit trail)
```

---

## Carry-Forward Warnings (non-blocking)

Carried forward from `verify-report.md` §Issues Found and §Assertion Quality so future changes can address them; none of these block the SDD cycle close:

1. **WU-A 490-line budget overrun** (`ae64ef3`) — maintainer-delegated exception (bundled `AdminRolesView.test.ts` column-coverage stub into WU-A). Code totals ~938 insertions across 8 code files; the exception was approved during planning and the budget reset at the WU boundary.
2. **UDropdownMenu items extraction via `document.body.innerHTML`** — deviation from the design's test plan (which called for flattened `UDropdownMenu` `props('items')`). `@nuxt/ui` is not mockable at the virtual-module level, so the isSystem-gate test clicks the trigger and inspects `document.body.innerHTML`. Coverage intact — asserts "Editar"/"Permisos" present, "Eliminar" absent.
3. **Card-mode error bypass** (design Open Question #1, parity-accepted) — `AppDataTable`'s `#cards` branch bypasses the `:error` block, so a failed request in card mode renders the grid's empty state rather than the error block. Identical to `CustomersView` and `UsersView`; the fix belongs in `AppDataTable` and is out of scope for any single list standardization change.
4. **No dedicated `RoleCard` / `RoleCardGrid` runtime tests** — REQ-3's ladder/no-kebab and loading/empty scenarios are statically correct in the source but lack dedicated component-level spec files. Design's test scope was `AdminRolesView.test.ts` + `useRoleColumns.test.ts` only; the behaviorally-significant card-click → slideover IS tested at the view level.
5. **Chip-order divergence** — spec REQ-3 lists `userCount → permissionCount → isSystem`; implementation renders `Sistema` first, then `permisos`, then `usuarios` (design-pinned proposal order, deliberately reconciled at design time). All content present; the order decision was finalized in `design.md` §Architecture Decisions row 3 and recorded there for transparency. The main-spec REQ-3 reflects the implemented order.

---

## Follow-ups (non-blocking)

1. **Fase 2-#3 next change: `standardize-admin-tenants-table`** — same parity pattern, target `AdminTenantsView.vue`. Carry the **apply-phase checkbox ticking** discipline from this cycle's lesson so the archive gate stays a no-op. (Orchestrator pre-approved.)
2. **G5 users filter defect → `houndfe-backend`** — the Fase-1 `AdminUsersView` local-per-page filter regression (filters over the fetched page rather than the full `/admin/users` catalog) is documented as the users-side counterpart to roles' full-catalog correctness. Reminder for the next backend sync: server-side filter on `/admin/users` should match the `roles.api.ts:64-83` pattern.
3. **W4 component tests** — add `RoleCard.spec.ts` and `RoleCardGrid.spec.ts` to close the REQ-3 ladder/no-kebab and loading/empty coverage gap. Behaviorally-significant assertions live at the view level today; component-level tests would harden presentational contracts.
4. **W3 `AppDataTable` fix** — close the card-mode error bypass by routing the `:error` prop through `#cards` (or render an error state inside the card grid). Same fix benefits `CustomersView`, `UsersView`, and every future card-enabled list.
5. **Coverage tool installation** — install `@vitest/coverage-v8` to close the "Coverage: Not available" gap (verify-report §Build & Tests). Cycles stay on `pnpm test:unit --run` until coverage is wired.
6. **Chip-order reconciliation note** — the design-vs-spec divergence was decided at design time and recorded in `design.md` §Architecture Decisions row 3 ("`StatusDotBadge(tone="info", label="Sistema", compact)` first, then counts"). Future readers should consult `design.md` rather than re-litigate.

---

## Contradictions and Final-State Resolutions

The only contradiction in the cycle is the **chip-order spec-vs-design divergence** (REQ-3 chip ordering: spec listed `userCount → permissionCount → isSystem`, design pinned `Sistema` first, implementation followed the design). It is fully resolved and recorded in `design.md` §Architecture Decisions row 3 + `verify-report.md` §Issues Found → "Chip order" SUGGESTION. No unrankable contradictions remain:

- `verify-report.md` (intermediate snapshot) reports REQ-3 as ✅ COMPLIANT with the design-pinned `Sistema`-first chip order. The launch prompt (higher-ranked) confirms the same. The main spec's REQ-3 wording now matches both.
- Final test/build numbers (3935 tests, exit 0; build clean) match the verify report — no later work altered them.
- No CRITICAL issues in `verify-report.md`. WARNINGS are non-blocking and tracked above.

---

## Source-of-Truth Specs Updated

The following main spec now reflects the standardized admin roles list behavior:

- `openspec/specs/admin-roles-list/spec.md` (NEW)

The following specs are **unchanged** (different capabilities, deliberately disjoint):

- `openspec/specs/admin-users-list/spec.md` — does not exist on this branch (it lives on `feat/standardize-admin-users-table` which is **unmerged**; that branch's archive is its own cycle). Future readers must read both branches to see the parity pair.
- All other `openspec/specs/*` are untouched.

---

## SDD Cycle Status

| Phase | Status |
|-------|--------|
| Propose | ✅ complete |
| Spec | ✅ complete |
| Design | ✅ complete |
| Tasks | ✅ complete (19/19 `[x]` after archive-time reconciliation, every box annotated with commit SHA) |
| Apply | ✅ complete (3 implementation commits, 922 insertions / 13 deletions across 8 code files) |
| Verify | ✅ PASS WITH WARNINGS (0 blockers, 0 CRITICAL) |
| **Archive** | ✅ **complete** |

The change has been fully planned, implemented, verified, and archived. Ready for the next change.