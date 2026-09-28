# Seller report date controls and width

## Intent and authorization

Owner requests Nuxt UI date controls instead of native HTML date inputs and a wider seller report slideover, slightly under half the desktop viewport. Preserve the liked visual direction. No backend contact. No print/PDF, row-limit/copy, API, shared analytics or shared drawer changes.

Base: feat/seller-sales-report at 9e23901484c9fdf254cb9ccf5c8c0040fa4abb65. Tracked/index clean before work; preserve two existing untracked OpenSpecs. Same worktree. No push, main integration, installs, server or external requests. No commit requested for this correction yet.

## Plan and scope

- [x] U1: Add local Nuxt UI date filter and report-only desktop width. Writer reports 182 tests and quality/type checks passing; date-filter initial RED was missing-import only, drawer width had behavioral RED. Do not claim full behavioral test-first evidence for the filter.
- [ ] U2: Verify types, scoped quality, regression tests and review outcome. In progress; independent verification after generated-file scope decision.
- [ ] U3: Present changes and remaining browser acceptance. Pending.

Exact source surfaces: components/SellerReportDateRangeFilter.vue and its __tests__/SellerReportDateRangeFilter.spec.ts (new), components/SellerSalesReportDrawer.vue and its __tests__/SellerSalesReportDrawer.spec.ts, all under src/features/admin/users/seller-report/.

Use two single-date UInputDate/UPopover/UCalendar controls, retain calendar strings and explicit inclusive from/exclusive to, no JS Date boundary conversion. Existing four presets, range validation, disabled/loading behavior and query guards unchanged. Reuse existing CDMX calendar utilities. Accessible labels/errors and 44px targets.

Use report-local desktopUi override to approximately45vw, no shared component modifications. Preserve mobile bottom sheet. Do not change report content, print, endpoints, authorization or limits.

One coherent correction with its tests; initial forecast250–450, actual writer report694 additions/12 deletions=706. Owner delegated resolution to parent, who accepts this size and keeps the exact one added UInputDate declaration in components.d.ts as a fifth path. No blanket declaration generation permission. Attribution to tooling is not independently proven; current diff verified one line. Do not remove coverage or minify. Rollback limited to these five changes. Parent owns this tracker.

## Verification and runner constraints

Test-first RED then GREEN for Nuxt controls/calendar emissions, disabled/preset/error behavior, unchanged half-open dates and desktop width prop. Run existing isolated seller-report suite (includes new colocated spec). Runner already authorized for future outputs ONLY node_modules/.nuxt-ui/ and node_modules/.vite-temp/; require envDir:false,dts:false,cache:false, no .env/generated declarations/results cache/other output expansion. No config changes without parent decision. HTTP/print mocked; no real network/runtime.

Command: node_modules/.bin/vitest run --config vitest.seller-report.isolated.config.ts --no-file-parallelism (optionally select focused spec paths for RED). Three local vue-tsc --noEmit --incremental false configurations app/vitest/node, scoped ESLint/Oxlint/Prettier checks and git diff --check. Shared analytics/drawer regression only if runner can include them without changing config; do not import default Vite config. Record actual tests or exclusion, no invented browser proof.

Browser acceptance remains necessary for45vw visual sizing, popover interaction and mobile layout. Screenshot inspected by parent; mapping confirms shared drawer already supports desktopUi and Nuxt UI4.6 provides InputDate/Calendar. Current next step: independent verification then native review. Shared analytics/drawer tests were excluded by isolated runner; no shared sources changed. No backend contact, PDF edits or commits.
