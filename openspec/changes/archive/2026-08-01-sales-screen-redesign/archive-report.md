# Archive Report: sales-screen-redesign (SDD-14)

```yaml
schema: gentle-ai.archive-report/v1
change: sales-screen-redesign
sdd_id: SDD-14
mode: hybrid
archived_at: 2026-08-01
git_head: 7ee03be36f71265641b16dda9c8f02a07dab44c5
git_branch: main
commits_ahead_of_origin: 14
verdict: pass-with-warnings
```

## Final Verdict

**SDD cycle complete.** Change `sales-screen-redesign` (SDD-14) is verified
(`pass-with-warnings`, 0 blockers, 0 critical findings, 10/10 requirements,
10/10 scenarios) and archived. All 25 implementation tasks are complete on
`main`. The archived folder at
`openspec/changes/archive/2026-08-01-sales-screen-redesign/` is the immutable
audit trail for this change.

## What Shipped

### Phase 14a — Layout + Product Panel (5 source + 1 test files, 3 commits)

| Commit  | Hash      | Description                                |
|---------|-----------|--------------------------------------------|
| 14a.1   | `9818dbd` | feat(sales): 75/25 split + Ctrl+K/⌘K search shortcut |
| 14a.2   | `d0f0bcc` | feat(sales): product grid 3-col + #N stock badge     |
| 14a.3   | `f42f18c` | feat(sales): dark category panel + page size 36/42   |

### Phase 14b — Cart Items + Totals (5 source + 4 test files, 3 commits)

| Commit  | Hash      | Description                                       |
|---------|-----------|---------------------------------------------------|
| 14b.1   | `e7ea062` | feat(sales): SaleItemRow horizontal card rewrite |
| 14b.2   | `58a1897` | feat(sales): flat promo list (replaces accordion)|
| 14b.3   | `3ccab5c` | feat(sales): totals breakdown + cart header compaction |

### Stabilization Fixes (5 fix commits, all on `main`)

| Commit  | Hash      | Description                                            |
|---------|-----------|--------------------------------------------------------|
| fix.1   | `1d43849` | fix(sales): revert dark panel, shrink product cards, fix cart wrapper |
| fix.2   | `470c33c` | fix(sales): two-phase responsive split + restore cart rounded corners |
| fix.3   | `783f5bc` | fix(sales): gate USlideover with v-if to prevent full-screen backdrop leak |
| fix.4   | `7f28f5e` | fix(sales): gate AssignCustomerSlideover mount behind open state (white box fix) |
| fix.5   | `7ee03be` | style(sales): change product price color from accent cyan to primary blue |

**Total: 11 commits on `main` between `fa24e6e` (pre-change baseline) and
`7ee03be` (HEAD). 6 `feat(sales):` + 5 `fix(sales):`. Two debug commits
(`975d9a5`, `321ac50`) were also authored during white-box isolation and
remain in history for traceability.

### Final Test State

| Layer        | Tests | Files | Tooling                |
|--------------|-------|-------|------------------------|
| Unit         | 810   | 64    | vitest + @vue/test-utils |
| Integration  | —     | —     | Not configured for sales module |
| E2E          | —     | —     | Not configured         |
| **Total**    | **810** | **64** |                    |

- `pnpm type-check` (`vue-tsc --build`): exit 0
- `pnpm build`: exit 0, 2220 modules transformed in 22.56s
- `pnpm test:unit --run src/features/POS/sales/`: 810/810 pass, 0 fail, 0 skip, 22.52s

## Intentional Spec Revisions (User-Driven, Not Failures)

Three requirements were intentionally revised from the original delta spec
wording during implementation based on user feedback. The delta spec is
captured as the new main spec at
`openspec/specs/sales-screen-redesign/spec.md` with these revisions baked in
as the authoritative source of truth.

| Req | Original delta | Final implementation | Reason |
|-----|----------------|---------------------|--------|
| REQ-1 | Fixed 75/25 at lg (≥1024px) | Two-phase: **67/33 at lg, 75/25 at xl** | Fixed 75/25 was too tight at tablet/laptop widths; two-phase gives cart breathing room at laptop while preserving 25% panel at desktop |
| REQ-3 | Fixed 3-col grid (`sm:grid-cols-3 xl:grid-cols-3`) | **4-col on md+** (`md:grid-cols-4 xl:grid-cols-4`) | 4 per row shows more products on common laptop screens; `aspect-[4/3]` images prevent visual blow-up |
| REQ-6 | Dark category panel (`bg-coco-neutral-900`) | **Light elevated chips** (`bg-elevated/50`) | Dark panel created visual weight imbalance against the light/dark Coco surface tokens; light chips keep the panel quiet |

These revisions were captured in the verify report as
`pass-with-warnings` items and resolved in the archive-time spec sync. They
are not implementation defects — they are the final design.

## Specs Synced to Source of Truth

| Domain                  | Action   | File                                                                      | Details |
|-------------------------|----------|---------------------------------------------------------------------------|---------|
| `sales-screen-redesign` | Created  | `openspec/specs/sales-screen-redesign/spec.md` | New main spec with 10 requirements (REQ-1..REQ-10) reflecting the final implementation; 3 user-driven revisions baked in as authoritative |

The delta spec at
`openspec/changes/sales-screen-redesign/specs/sales-screen-redesign/spec.md`
remains in the archived change folder as the original delta; the new main
spec is the live source of truth going forward.

Existing `openspec/specs/sales/spec.md` (REQ-1..REQ-11 behavioral rules) and
`openspec/specs/sales-view-coco-redesign/spec.md` (REQ-1..REQ-7 Coco tokens)
were not modified — this change is purely visual/structural and does not
change behavior or token application.

## White-Box Bug Fixed During Stabilization

A full-screen white-box regression was introduced when the mobile cart
slideover was rendered. The fix path was a four-step debug-to-fix sequence:

1. `975d9a5` — debug: temporarily disable USlideover to isolate white box cause
2. `321ac50` — debug: disable AssignCustomerSlideover to isolate white box
3. `783f5bc` — fix: gate USlideover with v-if to prevent full-screen backdrop leak
4. `7f28f5e` — fix: gate AssignCustomerSlideover mount behind open state (root cause)

The root cause: a child slideover (`AssignCustomerSlideover`) was being
mounted unconditionally inside the parent `USlideover`, so its backdrop was
escaping the parent and covering the full viewport with a white surface.
Both slideovers are now gated behind their own `open` state with `v-if`,
and the white box no longer reproduces.

## Archive Contents

`openspec/changes/archive/2026-08-01-sales-screen-redesign/`

| Artifact        | Present | Notes |
|-----------------|---------|-------|
| `proposal.md`   | ✅      | 98 lines, full SDD-14 proposal |
| `explore.md`    | ✅      | 18 KB exploration doc |
| `design.md`     | ✅      | 16 KB technical design |
| `specs/sales-screen-redesign/spec.md` | ✅ | Original delta spec (98 lines) |
| `tasks.md`      | ✅      | 25/25 tasks checked (reconciled from stale `[ ]`) |
| `verify-report.md` | ✅   | Final verification report, `pass-with-warnings` |
| `archive-report.md` | ✅  | This file |

## Open Items (Non-Blocking)

| Item | Severity | Description |
|------|----------|-------------|
| `@vitest/coverage-v8` not installed | Suggestion | Coverage analysis could not be performed on changed files. Consider adding to devDependencies to enable per-file coverage tracking in future verifications. |
| No linter in project scripts | Suggestion | `pnpm lint` is not configured for this project; type-check and tests are the only quality gates. Consider adding `eslint` or `oxlint` for consistent style enforcement. |
| Two debug commits in history | Note | `975d9a5` and `321ac50` (debug: disable USlideover / AssignCustomerSlideover) remain on `main` for traceability of the white-box investigation. They can be squashed out in a future history-rewrite if desired. |
| Spec delta not in `openspec/specs/sales/` | Note | The visual/structural requirements live in a new `sales-screen-redesign` domain (sibling to `sales-view-coco-redesign`), not merged into `sales/` (which is behavioral). This is intentional — keeping behavior and layout specs separate. |

No blocking issues remain. The SDD cycle is complete and the change is
ready for production.
