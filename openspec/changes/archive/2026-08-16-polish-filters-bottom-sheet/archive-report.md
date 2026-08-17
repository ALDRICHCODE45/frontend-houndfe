# Archive Report: polish-filters-bottom-sheet

## Summary

**Change**: `polish-filters-bottom-sheet`
**Branch**: `feat/polish-filters-bottom-sheet` (based on `feat/unify-table-mobile-header`)
**Closed**: 2026-08-16
**Verdict at close**: `pass_with_warnings` (no CRITICAL, no blockers; one accepted residual WARNING)
**Archive location**: `openspec/changes/archive/2026-08-16-polish-filters-bottom-sheet/`

## Final State at Close

### Implementation

9 commits on `feat/polish-filters-bottom-sheet`:

| Commit | Work unit | Description |
|--------|-----------|-------------|
| `4c140e9` | WU-1 | feat(data-table-filters): add `embedded` prop to suppress trigger and own slideover |
| `76f76c5` | WU-2 | feat(data-table-toolbar): rebuild mobile filters bottom-sheet with sticky regions |
| `b7ae1c7` | WU-3 | feat(pos): bind `embedded=true` on `DataTableFilters` to drop nested sheet-in-sheet |
| `32402ad` | WU-4 | feat(admin): wrap raw filters in card sections for unified mobile sheet |
| `f6ce50a` | WU-4 | test(admin): remove unnecessary escape characters in WU-4 test names |
| `3c67133` | apply | docs(sdd): mark `tasks.md` checkboxes for polish-filters-bottom-sheet apply |
| `c5d5f6b` | correction | fix(data-table): render filters slot directly in mobile sheet and wire `clear-filters` |
| `37a489c` | correction | feat(data-table): add `FilterSectionCard` and card-style embedded filter sections |
| `dfe1f72` | correction | feat(views): wrap raw filters in `FilterSectionCard` and wire `clear-filters` |

### Verification (final)

- **Build**: ✅ `pnpm build` exit 0 (`vue-tsc` + `vite build`, ~10.6s).
- **Tests**: ✅ `pnpm test:unit` — 4292/4292 passed (283 test files, exit 0).
- **Spec compliance**: 9/9 REQs, 19/19 scenarios (18 full + 1 PARTIAL due to stale delta wording, reconciled at archive — see below).
- **Coherence**: design coherence skipped (no dedicated design artifact for this delta-only change).
- **TDD compliance**: 5/6 checks passed (prose-only TDD evidence reporting remains as in prior change).

### Previously-reported WARNING: RESOLVED

The inert `"Limpiar todo"` is now wired end-to-end:

- `DataTableToolbar.vue:324` emits `clear-filters`.
- `AppDataTable.vue:105,195` forwards the event.
- All 6 views handle `clear-filters`:
  - `EmployeesListView` → `setStatusTab('all')` (line 419)
  - `ExpiringDocumentsView` → `selectedThreshold = 30` (line 176)
  - `AdminTenantsView` → `includeInactive = false` (line 283)
  - `PromotionsView` → `resetFilters()` (line 673)
  - `QuotationsListView` → `filtersCtl.clearAll()` (line 445)
  - `SalesListView` → `filtersCtl.clearAll()` (line 181)
- Behavior assertion: `DataTableToolbar.spec.ts:334-345` (`emits clear-filters when "Limpiar todo" is clicked`).

### Root-cause fix shipped

`DataTableToolbar` no longer captures/re-renders `#filters` slot vnodes:

- `SectionDescriptor`, `readSectionId`, `filtersSections` removed (grep confirms zero references in `src/`).
- Sheet body renders `<slot name="filters" />` directly (`DataTableToolbar.vue:339`).
- Leaf `USelect` / Reka UI popovers now keep parentage (Promotions + Expiring threshold verified).

### Residual WARNING (accepted, non-blocking)

Manual 360px browser smoke (task 5.3) is unchecked — **N/A**: no browser available in this environment. Structural testids + stubbed breakpoints cover the contract; visual "nothing clipped / sticky regions" assertion is not run.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `mobile-filters-sheet` | **Created** | 8 REQs + 12 scenarios copied from delta to `openspec/specs/mobile-filters-sheet/spec.md` (new capability) |
| `data-table-toolbar` | **Modified (RECONCILED)** | REQ-3 wording updated to corrected contract — view-owned `FilterSectionCard` cards + direct slot render + `clear-filters` emit. Stale "Each direct child of #filters SHALL render inside a section card; #filters-title labels a section" wording NOT synced. Added 3 scenarios: "Structured sheet", "View-owned cards, slot rendered directly", "Embedded filters, single sheet". |

### Reconciliation note (archive-time)

Per orchestrator handoff, `specs/data-table-toolbar/spec.md` (the MODIFIED delta) still carried PRE-correction REQ-3 wording — "Each direct child of the `#filters` slot SHALL render inside a section card; an optional `#filters-title` slot (default `"Filtros"`) SHALL label a section" and the scenario "Raw content wrapped in cards" describing per-child wrapping labeled by `#filters-title`. This contradicted the corrected contract (cards are provided by views via `FilterSectionCard`; the wrapper renders the slot directly) and the implementation. **The archive did NOT sync the stale wording**; REQ-3 in `openspec/specs/data-table-toolbar/spec.md` reflects the corrected contract that ships in the codebase.

## Native Review Gate

- `reviewGate.delivery`: `disabled/unmanaged` (solo dev, no PRs; kill switch off).
- No review receipt required; the native gate's only relaxation is the kill-switch-off path.
- No automatic reviewer launch was performed.
- `reviewGate.result`: `n/a` (no review governed this change).

## Engram Observation IDs (traceability)

- `#3737` — `sdd/polish-filters-bottom-sheet/apply-progress` — Apply correction: vnode capture eliminated, clear-filters wired (also subsumes phase-1 apply-progress per topic upsert).
- `#3738` — `sdd/polish-filters-bottom-sheet/verify-report` — `pass_with_warnings`; 9/9 REQs, 19/19 scenarios; 4292/4292 tests; build clean.
- This report → `sdd/polish-filters-bottom-sheet/archive-report` (saved separately).

## Archive Contents

- `proposal.md` ✅
- `specs/mobile-filters-sheet/spec.md` ✅ (synced to base)
- `specs/data-table-toolbar/spec.md` ✅ (RECONCILED wording, synced to base)
- `tasks.md` ✅ (21/22 tasks complete; 5.3 = manual 360px smoke, N/A)
- `verify-report.md` ✅
- `archive-report.md` ✅ (this file)

Active `openspec/changes/` directory no longer contains `polish-filters-bottom-sheet`.

## Source of Truth Updated

The following specs now reflect the new behavior:

- `openspec/specs/mobile-filters-sheet/spec.md` (new)
- `openspec/specs/data-table-toolbar/spec.md` (REQ-3 reconciled)

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Ready for the next change.

---

*Do not delete or modify archived changes — this is an audit trail.*
