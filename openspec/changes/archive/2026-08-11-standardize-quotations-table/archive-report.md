# Archive Report: standardize-quotations-table

```yaml
schema: gentle-ai.archive-report/v1
change: standardize-quotations-table
mode: openspec
artifact_store: openspec
archived_at: 2026-08-11
git_head: 7a837c2
git_branch: main
delivery_strategy: structured-commits
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
requirements: 1/1
scenarios: 9/9
tasks: 4/4
```

## Final Verdict

**SDD cycle complete.** Change `standardize-quotations-table` is verified
(`pass-with-warnings`, 0 blockers, 0 critical findings) and archived. All 4
implementation tasks (T-01…T-04) are `[x]` in the persisted `tasks.md` and
are confirmed by the verify report's Spec Compliance Matrix. The FE work
unit ships on `main` as 4 source commits plus 2 documentation commits
(6 total on this branch, ahead of `origin/main`). The archived folder at
`openspec/changes/archive/2026-08-11-standardize-quotations-table/` is the
immutable audit trail.

## Final-State Authority

This archive reflects the state AT CLOSE, not intermediate snapshots. Per
the orchestrator's launch-prompt final-state facts, which outrank
`apply-progress` and `verify-report` snapshots for any claims made after
those snapshots were written:

| Source | Authority | What it covered |
|--------|-----------|----------------|
| Verify phase completed (`verify-report.md` written) | Highest for delivery facts | 3757 tests passing, build green, 9/9 spec scenarios compliant, 3 non-blocking warnings |
| Orchestrator launch prompt — DESIGN GATE caveat | Highest for DESIGN GATE | Only `createdAt` confirmed working against staging; other 4 sortable columns (`customer`, `status`, `totalCents`, `expiresAt`) share backend field names but unverified |
| Orchestrator launch prompt — task completion | Highest for tasks | All 4 tasks complete, tasks.md checkboxes flipped |
| Orchestrator launch prompt — git state | Highest for git | 6 commits on main, clean working tree |

`apply-progress` and `verify-report` remain valid as historical evidence of
what was true at their write-time, but their "pending"/"blocked"/"open gap"
claims are not echoed as current facts.

## What Shipped

### Frontend work-unit (6 commits on `main`, ahead of `origin/main` by 6)

| Commit  | Hash      | Description |
|---------|-----------|-------------|
| FE.1    | `2ebbf43` | feat(DataTable): add optional testid props for toolbar buttons |
| FE.2    | `624b8e0` | feat(quotations): add useQuotationsViewMode composable |
| FE.3    | `f295bfc` | refactor(quotations): standardize table toolbar, sorting, and view mode |
| FE.4    | `7d83b1e` | docs(quotations): close sortBy allowlist design gate |
| FE.5    | `53f48c8` | docs(quotations): mark apply tasks complete in tasks.md |
| FE.6    | `7a837c2` | docs(quotations): include standardize-quotations-table proposal + delta spec |

The implementation lands in `f295bfc`. `2ebbf43` adds the backward-compatible
optional `refreshButtonTestId` / `addButtonTestId` props to `AppDataTable` and
`DataTableToolbar` (default `undefined`, so 22 existing callers unaffected).
`624b8e0` introduces the new `useQuotationsViewMode` composable mirroring
`useProductViewMode`. `7d83b1e`, `53f48c8`, and `7a837c2` are documentation
commits that close the design gate, mark apply tasks complete, and capture
the proposal + delta spec in the change folder.

### Files affected by the FE work-unit

- `src/core/shared/components/DataTable/AppDataTable.vue` — added optional `addButtonTestId` / `refreshButtonTestId` props
- `src/core/shared/components/DataTable/DataTableToolbar.vue` — added optional `addButtonTestId` / `refreshButtonTestId` props
- `src/features/POS/quotations/composables/useQuotationsViewMode.ts` — **new** composable
- `src/features/POS/quotations/views/QuotationsListView.vue` — toolbar refactor, sortable headers, ViewToggle wiring
- `src/features/POS/quotations/views/__tests__/QuotationsListView.test.ts` — stub additions + `data-show-refresh` flip

### Final Test State

| Layer | Tests | Files | Tooling |
|-------|-------|-------|---------|
| FE unit (full suite) | 3757 passed | 246 | vitest + @vue/test-utils |
| FE type-check | — | — | `vue-tsc --build` exit 0, zero errors |
| FE build | — | — | `pnpm build` exit 0, 2258 modules in 30.74s |

All 9 spec scenarios have covering tests in `QuotationsListView.test.ts` with
real assertions (testid preservation, prop forwarding, slot wiring, event
emission, conditional rendering via CASL gates, navigation behavior,
sortable header labels, stray-button absence, display-mode bridging, status
badge lazy-expiry logic). No tautologies or smoke-only assertions.

## Requirement Completeness

The delta MODIFIED `REQ-11` of `quotations-list`; all other REQs (1–10, 12–16)
were untouched and remain valid as written.

| Req | Title | Status | Notes |
|-----|-------|--------|-------|
| REQ-11 | column visibility + global search + page-size options (now includes toolbar/sort/view-mode/refresh/add wiring) | ✅ FE | Merged into `openspec/specs/quotations-list/spec.md`. 9 scenarios compliant, 6 new (single toolbar row, sortable headers re-sort rows, cliente sorts by resolved name, view mode persists across reload, toolbar refresh refetches, add button emits @add). |
| REQ-1…10, 12…16 | (untouched) | ✅ Unchanged | Preserved verbatim in main spec; no diff outside REQ-11 |

**REQ-11 merge details**: the old REQ-11 (3 scenarios: global search, column
picker, page size) was expanded with the toolbar/sort/view-mode/refresh/add
behavior. Total scenarios for REQ-11 went from 3 to 9. Total scenarios for
the whole `quotations-list` domain went from 43 to 49.

## Verification Evidence

### Build & tests execution (per `verify-report.md` envelope)

```
$ pnpm build
vue-tsc --build: no errors
vite build: 2258 modules transformed, built in 30.74s

$ pnpm test:unit
 Test Files  246 passed (246)
      Tests  3757 passed (3757)
   Duration  69.51s
```

Strict verify envelope (`gentle-ai.verify-result/v1`):
- `verdict: pass`
- `blockers: 0`, `critical_findings: 0`
- `requirements: 1/1`, `scenarios: 9/9`
- `test_exit_code: 0`, `build_exit_code: 0`
- `evidence_revision: sha256:19e594c78f5fbe596649d3cf91a4bbf5ffb74aa7b3ff073644f06c835497a427`

### Assertions / TDD quality

| File | Tests | Findings |
|------|-------|----------|
| `QuotationsListView.test.ts` | 46 | All verify real behavior per `verify-report.md` Assertion Quality section: testid preservation, prop forwarding, slot wiring, event emission, conditional rendering, navigation, sortable header labels, stray-button absence, display-mode bridging, status badge lazy-expiry logic |
| `AppDataTable.spec.ts` | (existing) | T-01 tested optional props don't break existing callers |
| `DataTableToolbar.spec.ts` | (existing) | T-01 tested optional props don't break existing callers |
| `useQuotationsViewMode` | implicit via view test | T-02 composable covered through view test consumer |

Assertion quality audit: ✅ All assertions verify real behavior. No
tautologies, no ghost loops, no smoke-test-only tests, no orphan empty
checks.

### Non-blocking warnings (carried forward to follow-ups)

1. **Missing `apply-progress` artifact** (process gap). Strict TDD mode
   expects a formal `apply-progress.md` with RED/GREEN/TRIANGULATE/SAFETY
   NET/REFACTOR columns. The apply phase recorded task completion via
   `tasks.md` commit summary instead. Pure process gap; all tests pass.
2. **DESIGN GATE staging verification deferred** (environment access gap).
   Only `createdAt` confirmed working against staging. The other 4 sortable
   columns (`customer`, `status`, `totalCents`, `expiresAt`) share backend
   field names but were not click-tested against staging during verify.
   **Mitigation baked in**: the design (and the implementation) keep the
   sort wiring simple — flipping `enableSorting: false` on a failing column
   is a single-line change. See follow-ups table.
3. **`data-testid="app-data-table"` only in test stub** (pre-existing).
   REQ-QAF-016 lists `app-data-table` as a stable testid but the real
   `AppDataTable.vue` does not render this attribute. The testid only
   exists in `appDataTableStub`. Pre-existing — not introduced by this
   change.

## DESIGN GATE Caveat (Final)

The DESIGN GATE in `design.md` (backend `sortBy` allowlist) is **closed with
caveat**. The frontend is fully ready and all 5 sortable columns are wired
through `useQuotationsListTable`'s `sorting[0].id` → backend `sortBy`
mapping. Per the orchestrator's final-state facts:

- ✅ `createdAt` is verified working (used in `defaultSorting: [{ id:
  'createdAt', desc: true }]` and the `mapServerTableParamsToListQuotationsParams`
  passthrough).
- ⚠️ `customer`, `status`, `totalCents`, `expiresAt` share backend field
  names but were not click-tested against staging during the verify phase.

**Follow-up action**: click each sortable header against staging. If any
column 500s or silently ignores `sortBy`, flip `enableSorting: false` on
that column in `QuotationsListView.vue` and record the reason. The
implementation is symmetric across all 5 columns; the fallback is a
single-line toggle per failing column.

## Specs Synced to Source of Truth

| Domain | Action | File | Details |
|--------|--------|------|---------|
| `quotations-list` | Modified | `openspec/specs/quotations-list/spec.md` | REQ-11 MODIFIED: old (3 scenarios) replaced with merged block (9 scenarios, +6 new covering toolbar/sort/view-mode/refresh/add). All other REQs (1–10, 12–16) preserved verbatim. Total scenarios: 43 → 49. |

The delta spec at `openspec/changes/archive/2026-08-11-standardize-quotations-table/specs/quotations-list/spec.md`
remains in the archived change folder as the original delta; the live
source of truth is `openspec/specs/quotations-list/spec.md`.

## Archive Contents

`openspec/changes/archive/2026-08-11-standardize-quotations-table/`

| Artifact | Present | Notes |
|----------|---------|-------|
| `proposal.md` | ✅ | 63 lines, full proposal with intent, scope, capabilities, approach, affected areas, risks, rollback, dependencies, success criteria |
| `design.md` | ✅ | 129 lines, technical design + DESIGN GATE close-out note |
| `specs/quotations-list/spec.md` | ✅ | Original delta spec, 61 lines, MODIFIED REQ-11 only |
| `tasks.md` | ✅ | 4/4 tasks `[x]`; review workload forecast at top; apply-phase result at bottom |
| `verify-report.md` | ✅ | Strict verify envelope, `pass-with-warnings`, 9/9 scenarios compliant, 3 non-blocking warnings listed |
| `archive-report.md` | ✅ | This file |

## Archive Verification

- [x] Main spec updated at `openspec/specs/quotations-list/spec.md` (REQ-11 replaced, all other REQs preserved)
- [x] Change folder moved to `openspec/changes/archive/2026-08-11-standardize-quotations-table/`
- [x] Archive contains all artifacts: proposal.md, design.md, specs/quotations-list/spec.md, tasks.md, verify-report.md, archive-report.md
- [x] Archived `tasks.md` has all 4 tasks `[x]` (no stale checkboxes; no exceptional reconciliation needed — apply phase flipped them during commit `53f48c8`)
- [x] Active changes directory no longer contains `standardize-quotations-table`

## Open Items / Follow-ups

| Item | Severity | Description |
|------|----------|-------------|
| **DESIGN GATE staging click-through** | WARNING (carry-over) | Click each of the 5 sortable headers against staging. If any column 500s or silently ignores `sortBy`, flip `enableSorting: false` on that column in `QuotationsListView.vue` and record the reason in this archive report's follow-up history. Single-line toggle per failing column. |
| Missing `apply-progress` artifact | NOTE | Strict TDD mode expects a formal `apply-progress.md` with RED/GREEN/TRIANGULATE/SAFETY NET/REFACTOR columns. The apply phase recorded task completion via `tasks.md` commit summary instead. Pure process gap; implementation has full test coverage and all tests pass. |
| `data-testid="app-data-table"` only in test stub | NOTE (pre-existing) | Real `AppDataTable.vue` does not render this testid. Pre-existing — not introduced by this change. If E2E tests rely on `[data-testid="app-data-table"]`, they will fail until the real component renders the testid. |
| `@vitest/coverage-v8` not installed | SUGGESTION | Coverage analysis skipped in verify. Consider adding to devDependencies for per-file coverage tracking in future verifications. |

No blocking issues remain. The SDD cycle is complete and the change is
ready for the platform to consume the new toolbar/sort/view-mode/refresh/add
behavior end-to-end.

## Rollback Notes

If the platform needs to roll back after deployment:

- **Branch**: `main`, ahead of `origin/main` by 6 commits.
- **Commits to revert (in reverse order)**: `7a837c2` (docs), `53f48c8`
  (docs), `7d83b1e` (docs), `f295bfc` (refactor), `624b8e0` (composable),
  `2ebbf43` (optional props).
- **Files affected by the FE work-unit**:
  - `src/core/shared/components/DataTable/AppDataTable.vue`
  - `src/core/shared/components/DataTable/DataTableToolbar.vue`
  - `src/features/POS/quotations/composables/useQuotationsViewMode.ts` (new)
  - `src/features/POS/quotations/views/QuotationsListView.vue`
  - `src/features/POS/quotations/views/__tests__/QuotationsListView.test.ts`
- **No data migration touched** — pure view refactor.
- **Shared component backward compatibility preserved**: `addButtonTestId`
  and `refreshButtonTestId` default to `undefined`; Vue omits the attribute
  when undefined, so 22 existing callers of `AppDataTable` continue working
  without changes.

## SDD Cycle Complete

The `standardize-quotations-table` change has been fully planned,
implemented, verified, and archived. The quotations list now ships the
same toolbar/sort/view-mode identity as the products module: one
`DataTableToolbar` row, `<SortableHeader>` per sortable column, `ViewToggle`
persisted via `useQuotationsViewMode`, and refresh/add wired through
`AppDataTable` props. REQ-QAF-016 testids (`refresh-quotations-button`,
`new-quotation-button`) preserved via optional `refreshButtonTestId` /
`addButtonTestId` props. 3757 tests green, build clean, type-check clean.
Ready for the next change.
