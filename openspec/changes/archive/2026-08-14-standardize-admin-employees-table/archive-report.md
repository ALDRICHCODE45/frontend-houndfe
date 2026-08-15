# Archive Report: standardize-admin-employees-table

**Change**: standardize-admin-employees-table
**Archived**: 2026-08-14
**Cycle verdict**: PASS WITH WARNINGS — closed intentionally with carried WARNINGs (0 CRITICAL, 0 blockers)

---

## Executive Summary

All 10 requirements (25 scenarios) shipped across 3 implementation commits + 1 test port commit + 1 docs-tick commit on `feat/standardize-admin-employees-table`. Final verification: focused employees suite 821/821 green (29 files), full suite 4157 pass with 1 pre-existing unrelated failure (`POS/sales/SalesListView.test.ts` — OUT OF SCOPE, preserved), `pnpm build` clean. The new `admin-employees-list` capability is now source-of-truth under `openspec/specs/admin-employees-list/spec.md` (whole-ADDED — no prior main spec existed; delta was copied as-is, byte-identical). 22 implementation tasks `[x]`; only the manual `pnpm dev` smoke DoD item is unticked (carried as WARNING, same precedent as Fase 2 archives). Change folder archived; cycle complete.

---

## Final State (per Final-State Authority)

Per the orchestrator's launch prompt (highest-ranked source after `reviewGate`/`tasks` artifact) and the verified `verify-report.md`, the change closed in the following state:

- **Verify phase verdict**: PASS WITH WARNINGS — 10/10 requirements, 25/25 scenarios, `pnpm test:unit --run src/features/admin/employees` exit 0 (821/821 tests), `pnpm build` exit 0. 0 CRITICAL, 4 WARNINGs carried (see "Carried Warnings" below).
- **Implementation commits** (all on `feat/standardize-admin-employees-table`):
  - `b4d0289` — `feat(admin-employees): migrate to useServerTable, surface errors, add header + column visibility` (WU-A)
  - `aac6809` — `test(admin-employees): port useEmployeesList spec to pageIndex contract` (WU-A correction: spec port for task 3.1)
  - `43aa82d` — `feat(admin-employees): render card in #cards slot and status tabs in #filters` (WU-B)
  - `f271b45` — `test(admin-employees): cover list view, view mode, columns, and gating` (WU-C: test + flaky-test fix)
- **Tasks artifact**: 22/22 implementation tasks marked `[x]` in `tasks.md` (archived). DoD manual `pnpm dev` smoke unticked (carried, see WARNING #5).
- **Spec source of truth**: `openspec/specs/admin-employees-list/spec.md` created from the delta spec (capability was new; no prior main spec existed). Byte-identity confirmed via `diff -r` (empty).
- **Archived folder**: `openspec/changes/archive/2026-08-14-standardize-admin-employees-table/`
- **Active changes directory**: `standardize-admin-employees-table` no longer present.
- **REQ-1..REQ-10 invariants verified**:
  - `useServerTable` shared composable UNTOUCHED (`git diff main...HEAD -- src/core/shared/composables/useServerTable.ts` = empty).
  - `EmployeesListView.batch.spec.ts` + `wu03-card-view.spec.ts` UNCHANGED (preserved).
  - Card kebab (Editar/Dar de baja/Reactivar, CASL `canUpdate`) + card-click → `admin-employee-detail` preserved by explicit decision (employees has a real detail route).
  - Bulk-action bar (`BATCH_OPS_CAP = 100`, batch terminate/reactivate, CASL `batch_delete`/`update`) preserved unchanged.
  - `defaultPinning: { right: ['actions'] }`; `persistKey: 'admin-employees'`, `urlSync: false`.
  - `EmployeeCard`/`EmployeeCardGrid` internals UNCHANGED — render location moves into `#cards`.
  - `useManagerResolution` (60s cache) untouched.
  - `normalizeEmployee` / `computeSeniority` / `buildCardData` untouched.
  - No `Employee` type change, no new route, no backend change (`houndfe-backend` folder forbidden, never accessed).
  - `employees.api.ts`: 0-based `pageIndex` (`page = pageIndex + 1`), no sort param; `mapPaginated` unchanged.

---

## Spec Sync

| Domain | Action | Details |
|--------|--------|---------|
| `admin-employees-list` | **Created** | 10 ADDED requirements (REQ-1 through REQ-10); 25 scenarios. No MODIFIED / REMOVED / RENAMED. Delta was whole spec — copied as the main spec byte-identically (no reconciliation required; design and implementation aligned on Approach C). |

### Mechanical copy verification (MUST appear in phase result)

```
$ diff -r openspec/changes/standardize-admin-employees-table/specs/admin-employees-list/spec.md \
         <temp staging copy>
(EMPTY — byte-identity confirmed; no output produced)
```

The main spec at `openspec/specs/admin-employees-list/spec.md` (211 lines, 12162 bytes) now defines the `admin-employees-list` capability and supersedes the delta. It is the source of truth from this point forward.

---

## Archive Contents

```
openspec/changes/archive/2026-08-14-standardize-admin-employees-table/
├── proposal.md                       ✅
├── explore.md                        ✅
├── design.md                         ✅
├── tasks.md                          ✅  (22/22 implementation [x]; 1 DoD carried)
├── verify-report.md                  ✅  (PASS WITH WARNINGS — 10/10 reqs, 25/25 scenarios)
├── archive-report.md                 ✅  (this file)
└── specs/
    └── admin-employees-list/
        └── spec.md                   ✅  (delta spec, archived for audit trail)
```

---

## Review Budget / WU Tally (carried forward)

The proposal forecast ~470-580 lines (WU-A ~150-180 + WU-B ~120-150 + WU-C ~200-250). Final tally landed higher — both WU-A and WU-C hit ledger resets:

- **WU-A (`b4d0289`)**: original run **1,658 changed lines** vs **400-line budget** → maintainer-approved ledger reset (`size:exception`). Carried as WARNING #1.
- **WU-C (`f271b45`)**: original run **411 changed lines** vs **300-line WU-C budget** → maintainer-approved ledger reset. Carried as WARNING #1b.
- **WU-A correction (`aac6809`)**: small spec-port commit (task 3.1); ≤50 lines.
- **WU-B (`43aa82d`)**: no tests (Fase 1 + Fase 2 precedent across users/roles/tenants/tenant-members — design-sanctioned; tests land in WU-C).

Both resets approved by the maintainer (user) explicitly. Ledger settled; no outstanding budget exception.

---

## Carried Warnings (Final State from `verify-report.md` + launch prompt)

Per the orchestrator's launch prompt and `verify-report.md` WARNINGs section, the following are explicitly accepted at archive-time (none blocks archive; all are WARNINGs):

1. **Ledger exception (WU-A)**: 1,658 lines vs 400 budget — maintainer-delegated exception; reset done.
2. **Ledger exception (WU-C)**: 411 lines vs 300 WU-C budget — maintainer-delegated exception; reset done.
3. **`apply-progress` artifact missing**: `sdd-status` reports `applyProgress: missing`. Strict-TDD evidence was reconstructed from the commit trail (feat→test interleaving) and test-file RED headers rather than a persisted TDD Cycle Evidence table. TDD process itself evident on disk; not a substantive gap.
4. **Full suite has 1 pre-existing unrelated failure**: `POS/sales/SalesListView.test.ts` "clears only the slideover filter state when Limpiar is clicked" — `git diff main...HEAD --name-only` shows only `src/features/admin/employees/**`. Out of scope per orchestrator instruction; left unfixed.
5. **`pnpm dev` smoke NOT run in browser**: DoD item remains unticked in `tasks.md` (sole unticked item — 25/26 ticked total). Same precedent as Fase 2 (`standardize-admin-tenant-members-table` and others): manual runtime verification deferred to the user's local merge. All REQ-1..REQ-10 are substantively complete and source-verified; the manual smoke is a sanity check, not a substantive gate.
6. **4 presentational/contract scenarios lack a dedicated unit test**: dead-UI removal, all-columns-hidden consequence, bulk cap, bulk-visible — verified via source + git diff + unchanged `EmployeesListView.batch.spec.ts`, per the design-sanctioned WU-B no-tests scope (testing CSS/layout consequences would be implementation-detail coupling).

> **Additional carry (from launch prompt, not in `verify-report.md`)**: backend open questions relayed (NOT in scope for this change): (1) sort support on `GET /admin/employees` (gates G4 sorting follow-up), (2) `pageSize` vs `limit` authority + `totalPages`, (3) search min-length (`<2` chars rejected?), (4) `managerId` latency. Frontend-only — `houndfe-backend` never accessed.

Per `sdd-archive` Strict-vs-OpenSpec Archive Policy, this is a **non-critical partial / intentional archive** — recorded as "intentional-with-warnings". Archive proceeds because:

- 0 CRITICAL issues.
- 0 blockers.
- All WARNINGs have documented acceptance (orchestrator launch-prompt final-state fact).
- All 22 implementation tasks ticked; only the manual smoke DoD remains (a `pnpm dev` browser check, not implementation work).

---

## Flaky-test Fix (WU-C, landed in `f271b45`)

Per the launch prompt, a flaky test in `EmployeesListView.test.ts` was fixed during WU-C: the dynamic import was hoisted to `beforeAll` (module-scoped `ViewModule`). Verified 35/35 on cold cache across 2 runs. The change is byte-identical in behaviour at runtime; the fix only stabilizes module resolution timing under vitest's async lazy-import surface.

---

## Approach C Closure-Composition — Closure Note

The `useServerTable` shared composable is byte-identical vs main (`git diff main...HEAD -- src/core/shared/composables/useServerTable.ts` = empty). Approach C (hybrid closure-composition) shipped as designed: `useEmployeesList` composes the shared composable and closes over feature-local `statusTab`/`managerId` refs in `queryKey`/`queryFn`. This confirms that employees-only filter dimensions can be added without modifying the shared composable — the same pattern will apply to future Fase 3 modules (Pending Approvals, Expiring Documents) that need non-shared filters.

---

## Contradictions and Final-State Resolutions

Per the Final-State Authority hierarchy (Section "Final-State Authority" of `sdd-archive/SKILL.md`):

- **Higher-ranked sources (orchestrator launch prompt + tasks artifact)**: WIN. 25/26 tasks ticked (1 DoD manual smoke carried), `useServerTable` byte-identical vs main, all REQ-1..REQ-10 implemented, ledger exceptions settled by user approval.
- **Intermediate snapshot (`verify-report.md`)**: VALID history at its moment. The "11/26 ticked" snapshot reflects verify-time state; the orchestrator's launch prompt confirms the current 25/26 state with the WU-A + DoD boxes ticked after verify (via subsequent commits / reconciliation). No stale "pending" claims to echo.
- **Earlier `apply-progress` snapshot**: missing artifact; WARNING #3. Not blocking.

No unrankable contradictions. The implementation matches the delta spec 1:1; the only divergence is the manual smoke carry, which the orchestrator explicitly authorized.

---

## Source-of-Truth Specs Updated

The following main spec now reflects the standardized admin employees list behavior:

- `openspec/specs/admin-employees-list/spec.md` (CREATED, byte-identical from delta)

---

## Fase 3 Status — EMPLOYEES PARITY COMPLETE (1/3)

This is the **1st of 3** Fase 3 standardization changes:

| Module | Branch | Archived | Cycle Verdict |
|--------|--------|----------|---------------|
| **Employees** | `feat/standardize-admin-employees-table` | ✅ (this archive) | PASS WITH WARNINGS |
| Expiring Documents | TBD | ⏳ | TBD |
| Pending Approvals | (existing `feat/pending-approvals-pagination` branch) | ⏳ | TBD |

Backend open questions 1–4 above need resolution before G4 sorting and related work ships in subsequent Fase 3 candidates. Frontend code is ready for backend confirmation.

---

## Open Follow-ups (Not in Spec Sync)

Carried from the verify-report WARNINGs + design Open Questions + launch-prompt relay:

- **G4 Sorting follow-up** — backend must confirm `sortBy`/`sortOrder` support on `GET /admin/employees` before reintroducing `SortableHeader`/`enableSorting`. Currently all 8 columns are explicitly `enableSorting: false`.
- **Backend open questions (relay)**:
  1. Sort support on `GET /admin/employees`.
  2. `pageSize` vs `limit` authority + `totalPages` in response.
  3. Search min-length (`<2` chars rejected?).
  4. `managerId` latency / intended exposure.
- **Manual `pnpm dev` smoke** — DoD item remains for the user to verify in browser at merge time (same precedent as Fase 2 archives).
- **`apply-progress` artifact gap** — process-bookkeeping; not blocking; can be regenerated next cycle.

---

## SDD Cycle Status

| Phase | Status |
|-------|--------|
| Propose | ✅ complete |
| Spec | ✅ complete |
| Design | ✅ complete |
| Tasks | ✅ complete (22/22 implementation [x]; DoD smoke carried) |
| Apply | ✅ complete (3 WU commits + 1 spec-port commit on branch) |
| Verify | ✅ PASS WITH WARNINGS (0 CRITICAL, 0 blockers) |
| **Archive** | ✅ **complete (intentional-with-warnings)** |

The change has been fully planned, implemented, verified, and archived. Ready for the next change (Fase 3 #2 or whichever the user picks).
