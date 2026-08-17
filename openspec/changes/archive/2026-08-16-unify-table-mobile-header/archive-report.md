# Archive Report: unify-table-mobile-header

**Change**: unify-table-mobile-header
**Archived**: 2026-08-16
**Cycle verdict**: PASS WITH WARNINGS — closed with accepted N/A warnings (manual 360px visual smoke; see below)

---

## Executive Summary

The unified mobile toolbar shipped across 3 implementation commits on `feat/unify-table-mobile-header`. Final verification: 8/8 requirements, 13/13 scenarios, `pnpm test:unit` exit 0 (4278/4278 passed, 283 test files), `pnpm build` exit 0; spec validator admitted `valid: true`. The new `data-table-toolbar` capability is now source-of-truth under `openspec/specs/data-table-toolbar/spec.md`. Change folder archived; cycle complete.

The change was the agreed single choke-point fix: rewriting `DataTableToolbar.vue` so all 8 list views inherit the same `< md` layout (search / actions cluster / "Filtros" bottom-sheet), plus a new `activeFilterCount: number` prop forwarded through `AppDataTable.vue` so each view can derive its filter count from existing state without migrating filter logic.

---

## Final State (per Final-State Authority)

Per the orchestrator's launch prompt (highest-ranked source after `reviewGate`) and the verified `verify-report.md`, the change closed in the following state:

- **Verify phase verdict**: `pass_with_warnings` — 8/8 requirements, 13/13 scenarios satisfied. `pnpm test:unit` exit 0 (4278/4278 tests passed, 283 test files). `pnpm build` exit 0 (`✓ built in 10.38s`). Validator admitted `valid: true`.
- **Implementation commits** (all on `feat/unify-table-mobile-header`, base `b2a5665`):
  - `30b18d7` — `feat(data-table): unify mobile header below md (search/rows/clusters/filters sheet)` (WU-A: `DataTableToolbar.vue` rewrite + `activeFilterCount` prop on `DataTableToolbar` and `AppDataTable`)
  - `ba1f5a1` — `feat(views): bind active-filter-count to existing filter state on 3 list views` (WU-B: bindings on `EmployeesListView`, `ExpiringDocumentsView`, `AdminTenantsView`)
  - `536fc64` — `test(data-table): fix TypeScript narrowing on findAll array indexing` (WU-C: TS narrowing fixes in the new spec file)
- **Native runtime ledger**: maintainer APPROVED a reset for the WU-apply objective because it changed 690 lines (exceeded the 400-line budget; the excess is the new test coverage — 23 new TDD tests on `DataTableToolbar.spec.ts`). Reset recorded at revision `8665ad44...` with actor `maintainer`.
- **Tasks artifact**: 9/10 implementation tasks marked `[x]` in `tasks.md` (archived). Task 3.3 (manual 360px visual smoke) left unchecked and explicitly marked N/A. Archive-time checkbox reconciliation was explicitly approved by the orchestrator (FINAL-STATE HANDOFF) and is backed by `verify-report.md` (8/8 requirements, 13/13 scenarios, 4278 tests pass, build clean). The reconciliation reason is recorded below.
- **Spec source of truth**: `openspec/specs/data-table-toolbar/spec.md` created from the delta spec (capability was new; no prior main spec existed). Reformatted from delta framing to the standard REQ-N main-spec shape.
- **Archived folder**: `openspec/changes/archive/2026-08-16-unify-table-mobile-header/`
- **Active changes directory**: `unify-table-mobile-header` no longer present.

---

## Spec Sync

| Domain | Action | Details |
|--------|--------|---------|
| `data-table-toolbar` | **Created** | 8 ADDED requirements (REQ-1 through REQ-8); no MODIFIED / REMOVED / RENAMED. Delta was full spec — copied as the main spec after reformatting from delta framing (`### Requirement: <name>`) to the standard main-spec shape (`### REQ-N: <name>`) and adding the "Domain: ..." header convention used by other capabilities. |

The main spec at `openspec/specs/data-table-toolbar/spec.md` now defines the unified mobile toolbar capability and supersedes the delta. It is the source of truth from this point forward.

---

## Archive Contents

```
openspec/changes/archive/2026-08-16-unify-table-mobile-header/
├── proposal.md           ✅  (new capability — no `Modified` capability declared)
├── design.md             ➖ not produced (new capability, structural change only; design captured in proposal §Approach + design intent in spec REQs)
├── tasks.md              ✅  (9/10 tasks complete; 3.3 marked N/A — see reconciliation note)
├── verify-report.md      ✅  (pass_with_warnings — 8/8 reqs, 13/13 scenarios)
├── specs/
│   └── data-table-toolbar/
│       └── spec.md       ✅  (delta spec, archived for audit trail)
└── archive-report.md     ✅  (this file)
```

---

## Review Budget Note (carried forward)

The proposal forecast was **220–320 lines / Low 400-line risk**. Actual changed lines: **690** across 3 commits (per apply-progress engram #3726 and the native runtime ledger). The 290-line excess is concentrated in `DataTableToolbar.spec.ts` (+23 TDD tests on top of the existing 11 → 19 cases) covering every spec scenario.

- **Native runtime ledger reaction**: `changed_lines = 690 > 400` → blocked maintainer decision; maintainer APPROVED reset (actor `maintainer`, revision `8665ad44...`).
- **Recorded here for future audit traceability**: the budget exception was accepted because the excess is test coverage, not feature code, and the verification surface is what gives the change its reliability.
- This exception does NOT weaken the archive gate — it was the explicit pre-approval recorded in the native runtime ledger.

---

## Tasks Checkbox Reconciliation (archive-time exception)

Per the orchestrator's FINAL-STATE HANDOFF and `verify-report.md` WARNING #1 + SUGGESTION #1, the apply phase left all `tasks.md` checkboxes `[ ]` despite the work being verified complete. The orchestrator explicitly authorized archive-time reconciliation; this archive tick-ed 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2 and marked 3.3 as N/A.

**Proof backing the reconciliation**:
- `verify-report.md` reports 8/8 requirements and 13/13 scenarios compliant.
- `pnpm test:unit` exit 0 with 4278/4278 tests passing, including the 19 new `DataTableToolbar.spec.ts` cases that cover every spec scenario.
- `pnpm build` exit 0.
- The 3 implementation commits on `feat/unify-table-mobile-header` (`30b18d7`, `ba1f5a1`, `536fc64`) match the WU-A / WU-B / WU-C work-unit split.
- Task 3.3 (manual 360px visual smoke) cannot be executed in this environment — no browser runtime — so it is marked N/A rather than complete.

This exceptional repair is the only archive-time checkbox write performed in this cycle.

---

## Residual Warnings and Suggestions (accepted, non-blocking)

These were carried forward from `verify-report.md` and are recorded here so the archive reflects the final state honestly:

**WARNING** (accepted, NOT resolved):
1. **Manual 360px visual smoke (WU-C 3.3) was NOT run** — no browser available in this environment. The three-region order and bottom-sheet are covered by unit tests with stubbed `useBreakpoints`, but actual pixel-level "nothing clips at 360px" is NOT visually verified. N/A — cannot be resolved in the SDD cycle; a future E2E harness or manual device pass would close it.

**SUGGESTION** (recorded, not blocking):
1. ~~`tasks.md` checkboxes unticked~~ — **resolved by this archive's reconciliation**.
2. `ExpiringDocumentsView.vue` inlines the magic number `30` (`selectedThreshold !== 30`) instead of a named `DEFAULT_THRESHOLD` constant. Functionally correct — 30 is the composable default — but a named constant would be more maintainable. Tracked for follow-up.
3. `hasFiltersSlot` in `DataTableToolbar.vue` calls `useSlots()` inside a `computed`, which is not reactive to runtime slot-content changes in Vue 3. Safe for the current 8 views (all static slot presence) but fragile if a future view toggles `#filters` content at runtime.

---

## Contradictions and Final-State Resolutions

No unrankable contradictions found. All facts consistent across sources after applying the Final-State Authority hierarchy:

- `apply-progress` (engram #3726, intermediate snapshot): reported the apply state correctly at the time it was written (3 commits on branch, 690 lines, maintainer-approved reset). Final state matches.
- `verify-report.md` (intermediate snapshot): reported `pass_with_warnings` correctly. Final test/build numbers (4278/4278, exit 0; build clean) match the snapshot because no further commits were added after verify.
- Orchestrator launch prompt: explicitly stated the residual warnings (manual 360px smoke, `DEFAULT_THRESHOLD` suggestion, `hasFiltersSlot` reactivity). All recorded above.

---

## Source-of-Truth Specs Updated

The following main spec now reflects the unified mobile toolbar behavior:

- `openspec/specs/data-table-toolbar/spec.md`

No other specs were modified — `MODIFIED: None` was declared in the proposal and honored in execution.

---

## SDD Cycle Status

| Phase | Status |
|-------|--------|
| Propose | ✅ complete |
| Spec | ✅ complete |
| Design | ➖ not produced (new capability, structural change; design captured in proposal §Approach) |
| Tasks | ✅ complete (9/10 [x], 1 N/A — see reconciliation) |
| Apply | ✅ complete (3 commits, 690 lines, 400-budget exception accepted) |
| Verify | ✅ PASS WITH WARNINGS (8/8 reqs, 13/13 scenarios, 4278 tests, build clean) |
| **Archive** | ✅ **complete** |

The change has been fully planned, implemented, verified, and archived. Branch `feat/unify-table-mobile-header` retains the 3 implementation commits; it is **not merged to `main` and not pushed**, per the solo-dev workflow. Ready for the next change.
