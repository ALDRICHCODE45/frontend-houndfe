# Clients main workspace visual migration

## Specs

User approved the main Clients screen only: header, search, table, cards, pagination and empty states, following the approved Products and unified shell design. Forms, addresses, confirmation and sales history remain excluded. Preserve APIs, permissions, mutations, table preferences, sorting, pagination, error/retry priority, card events and view-mode persistence. No synthetic counters, filters or functionality.

S1. Opt in only the listing container; excluded overlays are siblings outside the themed section.
S2. Use a Clients-owned stylesheet and list portal marker; do not borrow Products-specific markers or modify shared shell styles. Shared DataTable may add only a separately optional paginationPortalClass forwarding hook; omission and the existing toolbar portalClass must preserve prior behavior.
S3. Match approved light/dark shell palette, foundation field contrast, Manrope, restrained panel/control corners, compact pagination and wrapping toolbar.
S4. Cards keep bounded tracks and long text containment; preserve card actions and existing permissions.
S5. One presentation-only empty-state unit serves table and card slots; loading/error precedence stays with existing owners.
S6. Run focused regressions, Vue-aware types/build and independent verification if assessment requires it; source tests are not browser or user visual acceptance.

## Plan

Inline presentation unit: CustomersView retains all existing orchestration. CustomerCard/Grid keep their current responsibilities; add inert style markers and optional portalClass forwarding (props down, events up), plus an empty slot with legacy fallback. CustomersEmptyState is a stateless message-only presentation unit. No composable or business refactor.

Read-only exploration returned a map. Parent correction: foundation-only portals would diverge from approved Products, so the Clients-local stylesheet owns explicit light/dark palette values copied from approved shell, without editing shared styles. Scope CSS to Clients listing/portal only and retain foundation field-border tokens.

## Log

- Checkout already contains extensive uncommitted Products/shell/Caja/auth work. Clients subtree initially clean. Do not commit, reset, publish or reformat unrelated work.
- User shell visual approval recorded in Engram 14352; Clients scope recorded in 14353.
- Plain TypeScript LSP reported the existing unchanged CustomersView.vue import as unresolved. Vue-aware `pnpm type-check` job-1 exit 0, 37s; marked false-positive without suppression.
- Initial RED job-2: exit 1, 8 expected visual-contract failures / 243 passing tests. Initial GREEN job-3: exit 0, 2,008 tests / 147 files. Three additional card portal/empty-slot regression checks were added afterward.
- Parent structural readback passed: view business script unchanged except presentation imports; excluded form/history sources equal HEAD. New-file formatting initially reported docs formatting; fixed, final scoped check and diff check passed. LSP coverage incomplete, with Spanish spellcheck hints and existing plain-TS Vue-import false positives.
- Native assess returned unassessable due pre-existing untracked scope, with independent verification required. No native approval or browser proof.
- Independent verifier mv4lodh5-2-k9m6: exact focused command exit 0, 2,011 tests / 147 files, 92.31s. S1/S4/S5 passed; S2 blocked and S3 partial: AppDataTable did not forward the theme to the pagination page-size portal. This result is pre-correction only.
- Accepted correction: add a separately optional paginationPortalClass to AppDataTable and optional portalClass to DataTablePagination; only Clients opts in, so existing Products/legacy toolbar portal behavior does not expand silently. Public event/legacy tests precede source fix. Correction RED launched as job-5.
- Correction job-5 RED exit 1: 3 failures / 74 passes, including two new test harness TooltipProvider errors. Stubbed only irrelevant toolbars in the new tests. True RED job-6 exit 1: 2 expected missing portal-prop assertions / 75 passes. Source fix then GREEN job-7 exit 0: 2,025 tests / 156 files (includes archived copies).
- Incident: the unrestricted full-suite job-4 collected test copies and Playwright specs inside `artifacts/`, generating unrelated failures. Stopped that invalid-scope job; no successful full-suite or build result is claimed from it. Early focused counts likewise included archived copies and are not checkout-only counts.
- Post-correction independent task mv4m09gq-3-24nv closed S2/S3 technical blocker. Its checkout-only command with artifact/worktree excludes exited 0: 205 tests / 16 files, 18.58s. Native Nuxt content-root marker ownership and legacy omission/toolbar-only isolation were confirmed. Browser fidelity remains unverified.
- Final current-checkout suite job-8 (explicit artifact/worktree excludes) exited 1 after 2m49s: 8,710 passed / 5 failed by timeout / 35 skipped, 508 passing files / 3 failing files. Failures: router.spec.ts:88,137,172 (5s), :290 (10s); ProductDetailView.test.ts:197 (5s); PendingApprovalsView.test.ts:233 beforeAll (10s hook timeout, suite-level failure). These are not proven preexisting failures. Do not retry automatically or alter global timeouts.
- Job-8 used `&& pnpm build`; build did not run. Separate first final `pnpm build` job-9 exited 0 in33s: Vue-aware typecheck and production build passed. Vite retains a nonblocking >500kB chunk warning. Independent scoped verification and formatting/diff checks passed; global verification remains partial pending a user decision about full-suite timeout investigation outside Clients scope. No timeout retry, browser/live-API proof, native approval, commit or publication.
