# Archive Report: standardize-sales-list-table

**Change**: `standardize-sales-list-table`
**Archived on**: 2026-08-12
**Archived to**: `openspec/changes/archive/2026-08-12-standardize-sales-list-table/`
**Verdict**: PASS WITH WARNINGS — 5/5 requirements compliant (12/12 scenarios), 3827/3827 tests passing, build clean (exit 0). See "Verify CRITICAL Note" below.

---

## Executive Summary

`SalesListView` was brought to Products-table parity. The most damaging UX bug (failed `/sales/confirmed` requests silently rendering "No hay ventas todavía") was fixed by surfacing `useConfirmedSales`'s `isError`/`error` to `AppDataTable`. The hardcoded `USelect` sort dropdown was joined by nine `SortableHeader` slots for the columns the backend can order by, while four unsortable columns now declare `enableSorting: false` explicitly. A new `useSalesViewMode` composable (mirroring `useProductViewMode`) gives the user a manual `ViewToggle` whose selection persists across reloads at every viewport — including mobile, where the persisted mode now wins over the legacy `cards`-only fallback. The toolbar was consolidated to Products' single-row pattern: `DataTableFilters` lives inside `#filters`, the "Nueva Venta" CTA moved from a custom `#actions` `UButton` to `show-add-button`/`add-button-text` props, and "Limpiar" became a `UButton variant="link"` that calls `filtersCtl.clearAll()`. Domain invariants (`SalesListTabs`, `SaleCard`, `PaymentMethodPills`, `salesFiltersSchema`, `#<col>-cell` slots) were preserved untouched.

Delivered in 5 structured commits on `main`, each under the 400-line review budget.

---

## Specs Synced

| Domain | Action | Requirements |
|--------|--------|--------------|
| `sales` | Updated | +5 ADDED (REQ-15, REQ-16, REQ-17, REQ-18, REQ-19) |

**Merged into**:
- `openspec/specs/sales/spec.md` — REQ-15..19 appended after REQ-14 (Multi-column card mode via `#cards`) and before the `## UI Copy` section; existing REQ-1..14 preserved verbatim.

### REQ Numbering Reconciliation

The delta spec was authored with REQ-12..16, but the main spec already held REQ-12..14 from the just-archived `standardize-card-grids` change (Multi-column card mode, SaleCard EmployeeCard layout, SaleCardGrid skeleton/empty states). To avoid duplicate REQ numbers in `openspec/specs/sales/spec.md`, this change's requirements were renumbered on merge:

| Delta (archived) | Main spec (current) | Topic |
|------------------|---------------------|-------|
| REQ-12 | REQ-15 | Confirmed Sales List Surfaces Request Errors |
| REQ-13 | REQ-16 | Sortable Column Headers |
| REQ-14 | REQ-17 | View Mode Persistence |
| REQ-15 | REQ-18 | Consolidated Toolbar |
| REQ-16 | REQ-19 | Preserved Sales List Invariants |

The delta spec in this archive folder retains its original REQ-12..16 numbering for traceability against the implementation commits (`62bc4ab`, `1979694`, `c798c0a`, `a52b42e`, `2067207`) and `tasks.md` task references. The verify-report and the live source of truth use the final numbering.

No MODIFIED, REMOVED, or RENAMED sections in the delta — all changes are additive.

---

## Archive Contents

- `proposal.md` ✅
- `specs/sales/spec.md` ✅ (delta, original REQ-12..16 numbering preserved)
- `design.md` ✅
- `tasks.md` ✅ (31/31 task checkboxes checked — see Reconciliation Note)
- `verify-report.md` ✅

Active `openspec/changes/` no longer contains `standardize-sales-list-table`.

---

## Implementation Evidence

### Source of Truth Updated
- `openspec/specs/sales/spec.md` (now REQ-1..19)

### Implementation Commits

| Commit | Scope | Task | Description |
|--------|-------|------|-------------|
| `62bc4ab` | Sales view | T1 | `fix(sales): surface confirmed sales request errors in the list table` |
| `1979694` | Sales composable | T2 | `feat(sales): add useSalesViewMode with persisted view mode` |
| `c798c0a` | Sales columns | T3 | `feat(sales): render sortable headers for backend-sortable columns` |
| `a52b42e` | Sales view | T4 | `refactor(sales): consolidate toolbar with ViewToggle and add-button props` |
| `2067207` | Tests | T5 | `test(sales): reconcile list-view assertions after toolbar consolidation` |
| `95489ed` | Docs | T5 | `docs(sales): record standardize-sales-list-table apply results` |

### Test Results

- `pnpm test:unit --run` → 249 test files, **3827 passed**, 0 failed, 0 errors, **exit 0**
- `pnpm build` → `vue-tsc --build` clean, vite build (2263 modules, 28.39s), **exit 0**
- Spec compliance: 12/12 scenarios compliant across REQ-15..19 (after renumbering)

---

## Verify CRITICAL Note

The `verify-report.md` labels one finding as **CRITICAL** — "Missing TDD Cycle Evidence table" — while also stating:

> "**Verdict**: PASS WITH WARNINGS. All 5 requirements (12 scenarios) are fully implemented and verified with runtime evidence. 3827 tests pass (exit code 0), `vue-tsc` and `vite build` are clean. The single CRITICAL finding is a documentation-format gap in the apply-phase artifact — the implementation satisfies every spec, design decision, and task. **No blockers prevent archiving.**"

This is a process-compliance gap in the apply-phase artifact (the formal RED/GREEN/TRIANGULATE/SAFETY NET/REFACTOR evidence table required by `strict-tdd-verify.md` §Step 5a was not produced), not an implementation defect:

1. All five tasks have corresponding tests in 2 test files (`SalesListView.test.ts`, `useSalesViewMode.test.ts`).
2. The full suite passes (3827/3827, exit 0).
3. The verify report itself classifies the verdict as `pass_with_warnings` and explicitly states no blockers.
4. Per-task test pass counts are recorded in `tasks.md` Apply Results, and the source-code line ranges cited in the verify report (REQ-15 85-86/164-165, REQ-16 29-37/242-268, etc.) match the implementation commits.

The orchestrator's launch prompt outranked the verify-report's CRITICAL label: "Verify phase complete... all 5 requirements (12 scenarios) compliant, 3827 tests passing (exit 0), build clean." The implementation is verified complete and functional; the only gap is a documentation-format requirement that was never produced at apply time. **Archive proceeded** with this finding explicitly recorded so future cycles can ensure `sdd-apply` emits the required TDD evidence table.

---

## Reconciliation Note (tasks.md checkboxes)

The persisted `tasks.md` arrived with **31/31 checkboxes already marked `- [x]`** in this cycle — no mechanical reconciliation was required. (Note: the previous archived change `standardize-card-grids` arrived with all checkboxes unchecked and required repair; that pattern does not repeat here.)

---

## Follow-up Not In Scope (Not in Spec Sync)

**Commit `32a6492`** — `fix(tables): pin actions column and unify sales toolbar filters row` — landed AFTER the verify-report verdict:

- Added `defaultPinning: { left: [], right: ['actions'] }` to `useConfirmedSales` and (per the card-grids archive) the Quotations equivalent.
- Unified the `SalesListView` `#filters` toolbar row.

This is a related but **separate direct fix**. It is NOT included in this spec sync because:

1. It post-dates the verify-report verdict.
2. It does not introduce new requirements — it pins the existing `actions` column (already a requirement under REQ-18's toolbar) and refines the `#filters` row (already a requirement under REQ-18). Both behaviors are subsumed by REQ-18's "Consolidated Toolbar" clause.
3. Its scope belongs in a follow-up SDD change if behavior changes need to be captured as explicit requirements.

**Commit `e120c02`** — `test(sales): add replace to vue-router mock in list view tests` — also landed after the verify report:

- Fixed the pre-existing `router.replace is not a function` unhandled rejection observed in `SalesListView.test.ts`.
- Resolves a baseline infrastructure noise item, not a behavior change.
- The verify-report records this commit as compatible with the change's spec scope.

---

## Coherence & Design Notes

Per `design.md`:

- Error wiring — `isError`/`error` destructured from `useConfirmedSales` → bound to `AppDataTable :error/:error-message` (REQ-15). ✅ Followed.
- `USelect` shortcut — KEEP alongside `SortableHeader`; shared `sorting` ref via `watch` (REQ-16). ✅ Followed.
- View mode — `useSalesViewMode()` mirroring `useProductViewMode` with `displayMode` bridge mapping `card→cards` (REQ-17). ✅ Followed.
- Toolbar order — `[Refresh] [Columnas] [+ Nueva Venta] [ViewToggle]`; `ViewToggle` in `#actions`, add via `show-add-button` prop (REQ-18). ✅ Followed.
- "Limpiar" — `UButton variant="link"` → `filtersCtl.clearAll()` (not `clear()`); sorting/search/view mode untouched (REQ-18). ✅ Followed.
- Mobile — respect `localStorage` preference; drop `mobile-render="cards"` (REQ-17). ✅ Followed.

Domain invariants preserved (REQ-19):
- `SalesListTabs` (Todas/No Entregadas), `SaleCard`, `PaymentMethodPills`, `salesFiltersSchema` (11 fields, 4 sections), and every `#<id>-cell` slot remain unchanged.
- Verified by approval tests and source-code inspection (see verify-report §Correctness).

---

## Risks

- **Process gap**: `sdd-apply` did not produce the formal TDD Cycle Evidence table required by `strict-tdd-verify.md` §Step 5a. The implementation is functionally complete and verified; the gap is documentation-format only. Future cycles should ensure `sdd-apply` emits this artifact so the verify report does not have to flag it.
- **REQ numbering collision**: The delta spec used REQ-12..16, which collided with `standardize-card-grids` REQ-12..14 already in the main spec. Resolved on merge by renumbering to REQ-15..19 and recording the mapping here. Future sales changes should start at REQ-20+.
- **CTA visual change**: The "Nueva Venta" button is now driven by `AppDataTable`'s built-in `show-add-button`/`add-button-text` props (per REQ-18), which drops the previous `bg-(--brand-action) text-black rounded-xl font-semibold shadow-sm` styling. The button now uses `DataTableToolbar`'s default `UButton` styling. This is the same tradeoff `standardize-quotations-table` accepted in `f295bfc`, but it is a real visual change to the gold CTA and worth a design confirmation if the look matters.
- **Test isolation fragility**: The view test suite had a `beforeEach` scoping bug that leaked `data: []` from error-state cases into later blocks. Fixed in T5 by hoisting the mock to file level. Watch for similar leakage when adding future cases.
- **Runtime harness not executed**: No browser available in this environment — `pnpm dev` → `/pos/ventas` still needs a manual pass for forced-500 error block, header sorting round-trip, view-toggle persistence across reload, and the single-row toolbar.

---

## SDD Cycle Complete

All phases complete: explore → propose → spec → design → tasks → apply (via direct commits) → verify → archive.

Source-of-truth spec `openspec/specs/sales/spec.md` now reflects the standardized table behavior at REQ-15..19.

The change has been fully planned, implemented, verified, and archived. Ready for the next change.
