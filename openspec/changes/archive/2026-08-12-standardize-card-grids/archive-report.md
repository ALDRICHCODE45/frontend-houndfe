# Archive Report: standardize-card-grids

**Change**: `standardize-card-grids`
**Archived on**: 2026-08-12
**Archived to**: `openspec/changes/archive/2026-08-12-standardize-card-grids/`
**Verdict**: PASS — 6/6 requirements compliant, 16/16 scenarios compliant, 3827/3827 tests passing, build clean (exit 0)

---

## Executive Summary

The card surfaces for Sales, Quotations, and Products were standardized to the EmployeeCard pattern. SaleCard and QuotationCard were redesigned from the legacy UCard/RouterLink shape to the `<article>` + EntityAvatar + dashed divider + 2-col body pattern; both views now wire through `AppDataTable`'s `#cards` slot (replacing `#mobile-card`). ProductCard tokens were aligned to theme primitives (`border-default`/`bg-default`/`hover:border-primary/30`) and `ProductCardGrid` stepped up to the Employee ladder. Delivered in 3 commits (sales/quotations/products), each under the 400-line review budget. After the apply phase, a separate follow-up commit (`32a6492`) pinned the actions column and unified the Sales toolbar filters row — a related but independent direct fix, NOT included in this spec sync.

---

## Specs Synced

| Domain | Action | Requirements |
|--------|--------|--------------|
| `sales` | Updated | +3 ADDED (REQ-12, REQ-13, REQ-14) |
| `quotations-list` | Updated | +3 ADDED (REQ-17, REQ-18, REQ-19) |

**Merged into**:
- `openspec/specs/sales/spec.md` — REQ-12..14 appended before the `## UI Copy` section; existing REQ-1..11 preserved verbatim.
- `openspec/specs/quotations-list/spec.md` — REQ-17..19 appended after REQ-16; existing REQ-1..16 preserved verbatim.

No MODIFIED, REMOVED, or RENAMED sections in either delta — all changes are additive.

---

## Archive Contents

- `proposal.md` ✅
- `specs/sales/spec.md` ✅
- `specs/quotations-list/spec.md` ✅
- `design.md` ✅
- `tasks.md` ✅ (17/17 tasks checked — see Reconciliation Note below)
- `verify-report.md` ✅

Active `openspec/changes/` no longer contains `standardize-card-grids`.

---

## Implementation Evidence

### Source of Truth Updated
- `openspec/specs/sales/spec.md` (now REQ-1..14)
- `openspec/specs/quotations-list/spec.md` (now REQ-1..19)

### Implementation Commits

| Commit | Scope | Description |
|--------|-------|-------------|
| `78873c5` | Sales | `feat(sales): redesign SaleCard to EmployeeCard pattern + multi-col grid` |
| `8b06f8a` | Quotations | `feat(quotations): redesign QuotationCard to EmployeeCard pattern + multi-col grid` |
| `415814e` | Products | `feat(products): align card tokens + grid to EmployeeCard ladder` |
| `b50a348` | Docs | `docs(cards): include standardize-card-grids proposal, specs, design, and tasks` |
| `e120c02` | Test fix | `test(sales): add replace to vue-router mock in list view tests` — resolved pre-existing `router.replace is not a function` unhandled rejection |
| `4dd2b55` | Docs | `docs(cards): update verify report with clean test exit` |

### Test Results

- `pnpm test:unit` → 249 test files, **3827 passed**, 0 failed, 0 errors, **exit 0**
- `pnpm build` → `vue-tsc --build` clean, vite build (2263 modules, 28.04s), **exit 0**
- Spec compliance: 16/16 scenarios compliant across REQ-12..14 (sales) and REQ-17..19 (quotations)

---

## Reconciliation Note (tasks.md checkboxes)

The persisted `tasks.md` on disk arrived with all 17 task checkboxes unchecked, contradicting the orchestrator's launch-prompt assertion that all tasks are complete and the verify-report's `Tasks complete: 17 / Tasks incomplete: 0` evidence.

Per the SDD `sdd-archive` Task Completion Gate, this is an exceptional mechanical reconciliation:
- **Orchestrator's explicit instruction**: launch prompt listed "All 17 tasks complete, tasks.md checkboxes marked" as final-state fact #2 (outranks intermediate snapshot).
- **Proof of completion**: `verify-report.md` confirms via source inspection that every task landed in the codebase (REQ-12..14, REQ-17..19, and Products tokens all COMPLIANT) plus the implementation commits `78873c5`, `8b06f8a`, `415814e`.
- **Action taken**: all 17 checkboxes marked `- [x]` before archival. The archived `tasks.md` reflects the verified final state.

If `sdd-apply` did not update the persisted tasks artifact during this cycle, it should be reconciled in future cycles so this manual checkbox repair is unnecessary.

---

## Follow-up Not In Scope (Not in Spec Sync)

**Commit `32a6492`** — `fix(tables): pin actions column and unify sales toolbar filters row` — landed AFTER the apply phase completed:

- Added `defaultPinning: { left: [], right: ['actions'] }` to Sales and Quotations composables.
- Unified the `SalesListView` `#filters` row.

This is a related but **separate direct fix**. It is NOT included in the spec sync because:
1. It post-dates the verify-report verdict.
2. It does not introduce new requirements; it tightens existing REQ-11 (column visibility, sorting) and toolbar wiring (REQ-12 / REQ-17 in this change).
3. Its scope belongs in a follow-up SDD change if behavior changes need to be captured as explicit requirements.

---

## Coherence & Design Notes

Per `design.md`:
- `#cards` receives `{data}` array (grids iterate internally) — followed.
- `data-testid="quotation-card-link"` removed (RouterLink gone) — followed.
- ProductCard hover → `hover:border-primary/30` — followed.
- SaleCard debt row spans below 2-col grid with `mt-2` — followed.
- SaleCardGrid props `{sales, loading, empty}`, emits `card-click` — followed.
- QuotationCardGrid props `{quotations, loading, empty}`, emits `card-click` + `delete` — followed.
- QuotationCard emits expanded: `click` (new) + `navigate` (kept) + `delete` (kept) — followed.

---

## Risks

- **Pre-existing infrastructure noise** (`router.replace is not a function` unhandled rejection) was observed in `SalesListView.test.ts` baseline. Fixed in `e120c02` by extending the vue-router mock; suite now runs clean.
- **Stale task artifact pattern**: `sdd-apply` did not update `tasks.md` during this cycle, requiring archive-time checkbox reconciliation. Recommend verifying `sdd-apply`'s checkbox update path in future cycles.

---

## SDD Cycle Complete

All phases complete: explore → propose → spec → design → tasks → apply (via direct commits) → verify → archive.

Source-of-truth specs (`openspec/specs/sales/spec.md`, `openspec/specs/quotations-list/spec.md`) now reflect the new card-mode behavior.

The change has been fully planned, implemented, verified, and archived. Ready for the next change.
