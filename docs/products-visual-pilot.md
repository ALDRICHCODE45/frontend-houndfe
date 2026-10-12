# Products visual pilot

Products is the first table-based workspace adopting the accepted retail design reference from [v0](https://v0.app/bdps-projects/chat/mlxjrq5THf9). This is a presentation-only pilot, not a system-wide rollout. See [global design rules](design-system.md).

## Boundaries

- Reuse the existing Vue data table, cards, quick product forms and confirmation primitives.
- Keep queries, filters, sorting, pagination, column preferences, table/card persistence, permissions, validation, events and navigation in their current owners.
- Products continues to disable row selection and bulk actions.
- Keep the full product editor, Venta, Dashboard, Employees, Sales History and the application shell outside this pilot.
- Do not copy prototype controls, synthetic data, mock business logic, new stock thresholds or counters.

## Opt-in presentation

The shared `houndfe-ui.css` adapter uses the existing `--hf-*` foundation and applies only inside `hf-theme hf-ui` boundaries. `products-visual.css` supplies the Products workspace entry. Unmigrated screens keep their current theme.

Portal content needs an explicit boundary because it is rendered outside the workspace ancestor. Quick-form panels, category/brand dialogs, confirmation dialogs, row menus, the type selector and table toolbar portals must carry their owned theme classes. The optional DataTable `portalClass` property forwards presentation classes to toolbar portals; omitting it preserves the previous presentation and behavior.

Do not replace CategorySelect or SatKeySelect with another dropdown primitive as part of this migration: their native controls preserve the existing focus-trap workaround.

## Technical verification outcome

The initial bounded pilot passed parent checks: 360 focused tests in 36 files, the full unit run (8,616 tests in 508 files), Vue type-check and build. Independent verification passed S1–S5 and one isolated 360-test run; 1,132 protected baseline files and 20 candidate scope hashes stayed unchanged. These counts are observed evidence, not visual acceptance.

Native assessment could not delimit the candidate because the checkout contains pre-existing untracked work. It returned an unassessable risk and the high-equivalent independent-verification plan, which was completed. No native review approval or lineage is claimed.

Known limits: full-file formatting already fails at HEAD for six component/test files and was not broadly rewritten; new styles, shared-hook files, view and documentation formatting were checked separately. LSP coverage is incomplete, including plain TypeScript `.vue` import findings despite passing Vue-aware type-check. Browser/visual acceptance remains user-owned. No commits or publication were performed.

## Second visual pass

User feedback identified clipped table/card controls, stretched pagination and badges, oversized single-card tracks, plain empty states and residual pill geometry. The correction is Products-only: global Vite configuration and `src/assets/main.css` remain unchanged. Shared toolbar/pagination changes add inert presentation markers; table styles now anchor on actual table elements because Nuxt UI reuses slot names on unrelated controls. A presentation-only `ProductsEmptyState` is reused in table and cards.

Parent checks passed: 387 focused tests in 37 files, 8,643 full-suite tests in 509 files, Vue type-check, build, scoped formatting and whitespace checks. Independent focused verification passed 387 tests in 37 files; 1,076 protected paths and 15 candidate hashes stayed unchanged before and after. Its first scratch invocation failed before running tests due to an omitted TypeScript configuration; the user explicitly authorized one new execution with complete configuration, which passed. No application fix was needed for that setup failure.

The user reviewed the result and expressed visual satisfaction. This is not exhaustive theme, viewport or state coverage. Existing formatting exceptions, incomplete LSP coverage and build bundle-size advisories remain disclosed. Native assessment is unavailable for the existing untracked scope; no native approval or lineage is claimed. No commits, publication or migration to other screens were performed.

## Verification and preview

Functional regression, source-contract checks, type-check and build establish technical evidence, not rendered visual fidelity. The task log records actual results; this document alone is not a passing-check or native-review receipt.

Use the existing development server and open `/pos/products` with a test account and test data. Visual smoke belongs to the user:

- Compare table and cards in light/dark mode and narrow layouts.
- Open row and column menus and the type filter.
- Review quick create/edit forms, including service-edit field visibility.
- Review category/brand dialogs and the delete confirmation without executing a destructive action.
- Check focus, readable labels, long values, scrolling and font fallback.

Source migration does not authorize financial/API operations, publishing or automatic adoption by other modules.
