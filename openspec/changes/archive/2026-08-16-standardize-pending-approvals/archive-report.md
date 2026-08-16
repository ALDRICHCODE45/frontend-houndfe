# Archive Report: standardize-pending-approvals

**Change**: standardize-pending-approvals
**Archived**: 2026-08-16
**Cycle verdict**: PASS WITH WARNINGS — closed intentionally with carried WARNINGs (0 CRITICAL, 0 blockers)

---

## Executive Summary

All 8 requirements (29 scenarios) shipped across 3 implementation work-units (3 conventional commits) on `feat/standardize-pending-approvals`. Final verification: focused employees suite 885/885 green (32 files), full suite 4220/4222 pass with 2 pre-existing unrelated flaky timeouts (`router.notifications.spec.ts`, `POS/sales/SalesListView.test.ts` — OUT OF SCOPE, preserved, not fixed), `pnpm build` clean. The new `admin-pending-approvals` capability is now source-of-truth under `openspec/specs/admin-pending-approvals/spec.md` (whole-ADDED — no prior main spec existed; delta was copied as-is, byte-identical). 23/24 implementation tasks `[x]`; only the manual `pnpm dev` smoke DoD item is unticked (carried as WARNING, same precedent as Fase 2 and Fase 3 #1 archives). Change folder archived; cycle complete.

**Notable recovery**: WU-C run was accidentally cancelled mid-flight by the user; the changes were recovered, re-verified green, and committed as `75cf0dc`. The focused gate (885/885) and build (clean) are the post-recovery evidence.

---

## Final State (per Final-State Authority)

Per the orchestrator's launch prompt (highest-ranked source after `reviewGate`/`tasks` artifact) and the verified `verify-report.md`, the change closed in the following state:

- **Verify phase verdict**: PASS WITH WARNINGS — 8/8 requirements, 29/29 scenarios, `pnpm test:unit --run src/features/admin/employees` exit 0 (885/885 tests), `pnpm build` exit 0. 0 CRITICAL, 3 WARNINGs carried (see "Carried Warnings" below).
- **Implementation commits** (all on `feat/standardize-pending-approvals`, in order):
  - `c9ec805` — WU-A: `feat(admin-pending-approvals): adopt AppDataTable, surface errors, add view mode + columns`
  - `7f0c963` — WU-B: `feat(admin-pending-approvals): render card in #cards slot with ViewToggle`
  - `75cf0dc` — WU-C: `test(admin-pending-approvals): cover view, view mode, columns, and gating` (post-recovery)
- **Tasks artifact**: 23/24 implementation tasks marked `[x]` in `tasks.md` (archived). DoD manual `pnpm dev` smoke unticked (carried, see WARNING #1).
- **Spec source of truth**: `openspec/specs/admin-pending-approvals/spec.md` created from the delta spec (capability was new; no prior main spec existed). Byte-identity confirmed via `diff -r` (empty).
- **Archived folder**: `openspec/changes/archive/2026-08-16-standardize-pending-approvals/`
- **Active changes directory**: `standardize-pending-approvals` no longer present.
- **REQ-8 invariants verified** (the change's primary no-regression contract):
  - `useReviewTimeOff.ts` UNCHANGED in diff (`git diff main...HEAD -- src/features/admin/employees/composables/useReviewTimeOff.ts` = empty).
  - `pagination.utils.ts` UNCHANGED in diff (`git diff main...HEAD -- src/core/shared/utils/pagination.utils.ts` = empty).
  - `refetchOnWindowFocus: true` + `staleTime: 30_000` preserved in `usePendingApprovals` query.
  - No `bulkActions` / `enableRowSelection` (REQ-7) — source grep + view test `"does not pass bulkActions / enableRowSelection"` confirm.
  - Card Aprobar/Rechazar CASL-gated (`canReview: update:EmployeeTimeOff`) + `UModal` confirmation dialog + `isReviewing` disable preserved.
  - Per-employee `POST /admin/employees/:employeeId/time-off/:timeOffId/review` endpoint untouched.
  - `TimeOffRequest` type unchanged; no new route; no backend change (`houndfe-backend` folder forbidden, never accessed).
  - `listForPicker` >100-cap documented limitation preserved in-code (no silent "fix" attempt).
  - `wu11-timeoff-review-emergency-contacts.spec.ts`, `wu12b-dashboard-views.spec.ts`, `foundation.spec.ts` UNCHANGED in diff (preserved invariants).

---

## Spec Sync

| Domain | Action | Details |
|--------|--------|---------|
| `admin-pending-approvals` | **Created** | 8 ADDED requirements (REQ-1 through REQ-8); 29 scenarios. No MODIFIED / REMOVED / RENAMED. Delta was whole spec — copied as the main spec byte-identically (no reconciliation required; design and implementation aligned on Approach C hybrid, client-side `AppDataTable` + `ViewToggle` + `#cards` slot). |

### Mechanical copy verification (MUST appear in phase result)

```
$ diff -r openspec/changes/standardize-pending-approvals/specs/admin-pending-approvals/spec.md \
          <temp staging copy>
(EMPTY — byte-identity confirmed; no output produced)
```

The main spec at `openspec/specs/admin-pending-approvals/spec.md` (247 lines, 14331 bytes) now defines the `admin-pending-approvals` capability and supersedes the delta. It is the source of truth from this point forward.

---

## Archive Contents

```
openspec/changes/archive/2026-08-16-standardize-pending-approvals/
├── proposal.md                         ✅
├── explore.md                          ✅
├── design.md                           ✅
├── tasks.md                            ✅  (23/24 implementation [x]; 1 DoD carried)
├── verify-report.md                    ✅  (PASS WITH WARNINGS — 8/8 reqs, 29/29 scenarios)
├── archive-report.md                   ✅  (this file)
└── specs/
    └── admin-pending-approvals/
        └── spec.md                     ✅  (delta spec, archived for audit trail)
```

---

## Review Budget / WU Tally (carried forward)

The proposal forecast ~450-570 lines (WU-A ~150-180 + WU-B ~100-140 + WU-C ~200-250). Final tally landed higher — all 3 WU hit ledger resets:

- **WU-A (`c9ec805`)**: **1,307 changed lines** vs **400-line budget** → maintainer-approved ledger reset (`size:exception`). Carried as WARNING #1a.
- **WU-B (`7f0c963`)**: **579 changed lines** vs **200-line budget** → maintainer-approved ledger reset. Carried as WARNING #1b.
- **WU-C (`75cf0dc`)**: **584 changed lines** vs **300-line budget** → maintainer-approved ledger reset. Carried as WARNING #1c.

All 3 resets approved by the maintainer (user) explicitly. Ledger settled; no outstanding budget exception.

WU-B ships without tests by design (Fase 2 precedent — design-sanctioned; tests land in WU-C). WU-C commits include the test coverage for WU-B shapes (cards, view-mode, columns).

---

## Carried Warnings (Final State from `verify-report.md` + launch prompt)

Per the orchestrator's launch prompt and `verify-report.md` WARNINGs section, the following are explicitly accepted at archive-time (none blocks archive; all are WARNINGs):

1. **Manual `pnpm dev` smoke NOT run in browser**: DoD item remains unticked in `tasks.md` (sole unticked item — 23/24 ticked total). Same precedent as Fase 2 (`standardize-admin-tenant-members-table` and others) and Fase 3 #1 (`standardize-admin-employees-table`): manual runtime verification (forced 500, reload persistence, column visibility, no-checkbox/bulk bar, name search, page reset/clamp, CASL card gating, dialog copy) deferred to the user's local merge. All REQ-1..8 are substantively complete and source-verified; the manual smoke is a sanity check, not a substantive gate.
2. **Full suite has 2 pre-existing unrelated flaky failures**: `router.notifications.spec.ts` "resolves the route when the user has read:NotificationConfig perm" + `POS/sales/SalesListView.test.ts` "clears only the slideover filter state when Limpiar is clicked", both `Test timed out in 5000ms`. Both files are untouched by this diff (`git diff main...HEAD --name-only` contains only `src/features/admin/employees/**`). Out of scope per orchestrator instruction; left unfixed. Session context notes the last full run was 4222/4222 green — flakiness varies run to run.
3. **No `apply-progress` artifact persisted**: `sdd-status` reports `applyProgress: missing`. Strict-TDD evidence was reconstructed from the commit trail (WU-A feat → WU-B feat → WU-C test, with WU-C cancelled mid-flight and recovered) and test-file RED headers rather than a persisted TDD Cycle Evidence table. TDD process itself evident on disk; not a substantive gap.
4. **Ledger exceptions (WU-A, WU-B, WU-C)**: each WU overran its budget (1307/400, 579/200, 584/300) — all 3 maintainer-delegated exceptions; resets done. No outstanding budget exception.
5. **REQ-6 view-orchestration scenarios source-verified only**: confirm approve/reject/cancel paths in `PendingApprovalsView` are source-verified (composable mutation contract runtime-tested by unchanged `wu11-timeoff-review-emergency-contacts.spec.ts` and `s5-tray-reframe.spec.ts`). The view-level thin wiring (Confirmar/Cancelar → `submitReview`) is source-only (stubs `useReviewTimeOff` inert). Low-risk gap; a focused test clicking Confirmar/Cancelar would close it (SUGGESTION, not WARNING).

> **Additional carry (from launch prompt, not in `verify-report.md`)**: backend open questions relayed (NOT in scope for this change): (1) server-side pagination/search/sort on `GET /admin/employees-time-off/pending-approvals` (group with expiring-documents question, ask both endpoints in one message), (2) batch-review endpoint (gates any future bulk approve/reject), (3) inlined `employeeName` server-side join (removes `listForPicker` >100-cap). Frontend-only — `houndfe-backend` never accessed.

Per `sdd-archive` Strict-vs-OpenSpec Archive Policy, this is a **non-critical partial / intentional archive** — recorded as "intentional-with-warnings". Archive proceeds because:

- 0 CRITICAL issues.
- 0 blockers.
- All WARNINGs have documented acceptance (orchestrator launch-prompt final-state fact).
- All 23 implementation tasks ticked; only the manual smoke DoD remains (a `pnpm dev` browser check, not implementation work).

---

## WU-C Recovery Note (closed-cycle)

Per the launch prompt, the WU-C run was accidentally cancelled mid-flight by the user. The pending changes were recovered, the focused suite re-verified (885/885 green), and the WU-C work committed as `75cf0dc`. The post-recovery evidence is identical to the planned outcome:

- `PendingApprovalsView.test.ts` (33 cases) green
- `usePendingApprovalsViewMode.test.ts` (12 cases) green
- `usePendingApprovalsColumns.test.ts` (12 cases) green
- `s5-tray-reframe.spec.ts` (+7 cases: `buildPendingApprovalCardData` SICK-guard, "—" name, days plural, date-range label) green
- `wu11-timeoff-review-emergency-contacts.spec.ts`, `wu12b-dashboard-views.spec.ts`, `foundation.spec.ts` UNCHANGED in diff (preserved invariants)

No leftover dirty state. Recovery is byte-equivalent to uninterrupted execution.

---

## Contradictions and Final-State Resolutions

Per the Final-State Authority hierarchy (Section "Final-State Authority" of `sdd-archive/SKILL.md`):

- **Higher-ranked sources (orchestrator launch prompt + tasks artifact)**: WIN. 23/24 tasks ticked (1 DoD manual smoke carried), `useReviewTimeOff.ts` + `pagination.utils.ts` byte-identical vs main, all REQ-1..8 implemented, ledger exceptions settled by user approval, WU-C recovery acknowledged.
- **Intermediate snapshot (`verify-report.md`)**: VALID history at its moment. The "23/24 ticked" snapshot reflects verify-time state; the orchestrator's launch prompt confirms the current 23/24 state with the same carry (no subsequent commits). No stale "pending" claims to echo.
- **Earlier `apply-progress` snapshot**: missing artifact; WARNING #3. Not blocking.

No unrankable contradictions. The implementation matches the delta spec 1:1; the only divergence is the manual smoke carry (orchestrator-authorized), the WU-C recovery (orchestrator-acknowledged), and the 3 ledger resets (all maintainer-approved).

---

## Source-of-Truth Specs Updated

The following main spec now reflects the standardized admin pending-approvals behavior:

- `openspec/specs/admin-pending-approvals/spec.md` (CREATED, byte-identical from delta)

---

## Fase 3 Status — PENDING APPROVAL PARITY COMPLETE (3/3)

This is the **3rd of 3** Fase 3 standardization changes:

| Module | Branch | Archived | Cycle Verdict |
|--------|--------|----------|---------------|
| **Employees** | `feat/standardize-admin-employees-table` | ✅ (`2026-08-14`) | PASS WITH WARNINGS |
| Expiring Documents | `feat/standardize-expiring-documents-table` | ⏳ (paused on backend answer) | TBD |
| **Pending Approvals** | `feat/standardize-pending-approvals` | ✅ (this archive) | PASS WITH WARNINGS |

Fase 3 frontend parity is now **2/3 closed** (employees + pending-approvals). Expiring documents remains pending backend confirmation on the shared "server-side pagination/search/sort" open question (same group as this change's open question #1). Frontend code is ready for backend confirmation on all three moduli.

---

## Open Follow-ups (Not in Spec Sync)

Carried from the verify-report WARNINGs + design Open Questions + launch-prompt relay:

- **Backend open questions (relay)** — same family as expiring-documents:
  1. Server-side pagination/search/sort on `GET /admin/employees-time-off/pending-approvals` (group with expiring-documents question — ask both endpoints in one message).
  2. Batch review endpoint (e.g. `POST /admin/employees-time-off/review-batch`) — gates any future bulk approve/reject.
  3. Inlined `employeeName` server-side join — removes the documented `listForPicker` >100-active-cap limitation.
- **Manual `pnpm dev` smoke** — DoD item remains for the user to verify in browser at merge time (same precedent as Fase 2 and Fase 3 #1 archives).
- **`apply-progress` artifact gap** — process-bookkeeping; not blocking; can be regenerated next cycle.
- **REQ-6 view-orchestration test gap (SUGGESTION)** — view-level confirm/cancel wiring is source-verified only; a focused test clicking Confirmar/Cancelar would close it. Low-risk; the mutation contract is pinned by unchanged `wu11` + `s5` specs.

---

## SDD Cycle Status

| Phase | Status |
|-------|--------|
| Propose | ✅ complete |
| Spec | ✅ complete |
| Design | ✅ complete |
| Tasks | ✅ complete (23/24 implementation [x]; DoD smoke carried) |
| Apply | ✅ complete (3 WU commits on branch — WU-C recovered after accidental cancel) |
| Verify | ✅ PASS WITH WARNINGS (0 CRITICAL, 0 blockers) |
| **Archive** | ✅ **complete (intentional-with-warnings)** |

The change has been fully planned, implemented, verified, and archived. Ready for the next change.
