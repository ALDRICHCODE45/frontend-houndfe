# Human Decisions — standard POS list presentation

## Goal and acceptance

Match the existing Sales list pattern supplied by the owner: a card enclosing the heading and list, consistent toolbar spacing, and explicit Tabla / Tarjetas selection. Keep the approved detail slideover and all RESTOCK behavior unchanged.

- Reuse existing UCard/header, ViewToggle and view-mode conventions; no new design system.
- Both presentations open the existing detail and retain search, refresh, pagination, loading, empty and error behavior.
- Keep mobile layout usable and prefer the existing responsive convention.
- Do not copy Sales-only actions, counts, filters or sorting unsupported by the RESTOCK API.

## Boundaries

Work only in the RESTOCK frontend feature worktree. Planned source surfaces are HumanDecisionsView.vue, HumanDecisionsListPanel.vue and their focused tests; the mapping task will confirm exact paths before the writer starts. No slideover, resolution, API, backend, history or visibility-window edits. No database, fixtures, credentials, provider calls, dependency installation, commit or user-process changes.

Preserve pre-existing pnpm-workspace.yaml and generated declaration changes, local configuration and task records. Tests use local mocks, not the owner's authenticated session or backend. A real browser/visual check must use an isolated mock-only local server without taking over port 4173; otherwise report visual verification pending.

## Component map

- HumanDecisionsView: compose inbox data and unchanged detail slideover; use Sales' outer spacing without a duplicate heading.
- HumanDecisionsListPanel: own UCard/TableHeaderDescription and shared toolbar/view-mode controls, existing card/table item rendering and events. This shares presentation with the offline demo.
- HumanDecisionsOfflineDemoView: preserve simulation labeling and in-memory behavior while removing the duplicate heading and aligning outer spacing.
- Shared ViewToggle/useViewMode/AppDataTable: reuse existing public contracts without global modifications.

## Tasks and routing

- [x] **LP-01 — Map the Sales pattern and applicable tests.** Read-only mapper `muhyp5os-g-ec4k` confirmed Sales' UCard/TableHeaderDescription/#actions ViewToggle convention. Existing `HumanDecisionCard` is reusable unchanged. Explore was initially unavailable; no duplicate scout after the owner updated its model.
- [x] **LP-02 — Apply the established card/table presentation with focused regression tests.** Writer `muhyuyfq-h-ak01` completed panel, production/demo composition and tests. Maps `table | card` to `table | cards`, retaining initial mobile cards/desktop table and persisted/manual precedence. Meaningful RED: 10 failures; GREEN: 29/29 tests.
- [x] **LP-03 — Verify and review the scoped source change.** Writer passed type check, exact-file lint/format and diff checks. Independent verifier `muhz5zge-i-oe93` reran focused tests (29/29) and diff check, and reviewed actual VueUse initialization and shared toolbar contracts: scoped PASS. Native assessment was unassessable due undeclared untracked scope; no native approval claimed. Browser appearance/overflow remain unverified; production rebuild was intentionally not run against the owner's active preview.

## Delivery

Forecast: approximately 150–300 authored changed lines, one coherent UI slice. Strategy: ask-on-risk if scope expands. No commits authorized. Rollback only this feature's authored changes; never reset the working tree. User screenshot references are local files dated 2026-09-25 at 23:23:06, 23:23:13, 23:31:34 and the Sales reference at 23:38:47.

## Evidence

Implementation and independent source/unit verification complete. The owner must rebuild before an existing production preview reflects this change. No server was stopped or started. Existing manual no-ETA acceptance and earlier normal build/preview success are prior evidence, not browser proof of this UI change. The current responsive Playwright configuration owns port 4173 with reuseExistingServer false; it was not launched against the user's preview.

### LP-02 writer evidence

- Shared panel now owns the Sales-style UCard/header, padded body and Tabla/Tarjetas toolbar. Initial md breakpoint supplies the fallback; validated stored/manual selection wins at either viewport size. Existing HumanDecisionCard, shared table states/events and detail/resolution logic remain unchanged.
- Production and offline views use Sales outer spacing without duplicate headings; simulation badge, explanation and in-memory behavior are preserved.
- RED: focused four-file Vitest command observed 10 intended failures and 19 passes before implementation. An earlier incomplete VueUse mock prevented panel collection; fixed with a partial mock before recording meaningful RED.
- GREEN: the same focused command passed all 29 tests across four files, including unchanged HumanDecisionCard tests. Both directions, both viewport defaults, invalid storage, persistence/remount at both sizes, shared state props and existing event wiring are covered. Initial GREEN attempt exposed a Nuxt component stub-name mismatch; corrected the test stub, not production behavior.
- Final validation: focused Vitest 29/29, `pnpm exec vue-tsc --build`, exact six-file ESLint and `git diff --check` passed. Exact-file Prettier normalization applied only to assigned source/tests; final format check reported separately by the writer.
- Scope: six source/test files, 201 added / 81 removed lines including wrapper indentation, plus this evidence append. Pre-existing generated declarations, workspace configuration and unrelated task remain dirty and were not manually edited or restored. No commit, server, production build, real HTTP, browser or native review performed; visual verification remains pending. Writer model/effort were not exposed in the task context.
