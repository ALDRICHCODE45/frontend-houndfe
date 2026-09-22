# Branch sales summary

## Objective and authority

Add the first authenticated branch analytics screen to the frontend using the backend-owned `GET /analytics/sales/summary` contract. The user explicitly authorized implementation in an isolated frontend worktree while public catalog work continues independently.

Frontend worktree: `/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe-branch-sales-summary`

Branch/base: `feat/branch-sales-summary` from local `main` at `f44bbda`

The backend repository is strictly read-only from this session. Contract questions or requested backend changes must go through the backend agent by intercom. No backend file, Git state, runtime, deployment, or environment may be mutated here.

## Problem and why

The backend now provides authoritative sales and refund aggregates for the authenticated tenant, but the frontend has no Analytics subject, route, navigation entry, transport boundary, fixed-zone date handling, query state, or analytics presentation. Deriving totals from paginated sales or payments would be incorrect because the endpoint mixes cohort state and settlement flows with intentionally distinct accounting semantics.

## Verified backend contract and readiness

Authoritative handoff: `/home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend/docs/branch-sales-summary-frontend.md`.

Backend-owner read-only confirmation:

- `GET /analytics/sales/summary` is merged into backend local `main` at `111e112`.
- No remote publication/deployment is confirmed; backend local `main` was 20 commits ahead of `origin/main`.
- The endpoint requires JWT and exact permission `read:Analytics`; tenant/branch identity comes from the JWT.
- Query is exact local calendar strings `from` inclusive and `to` exclusive in `America/Mexico_City`, with `to > from` and at most 366 calendar days.
- The response exposes eight authoritative metrics in integer cents/counts. The frontend must not recompute them or combine sales and refund lines into an invented cash net.
- The existing product-wide frontend MXN configuration is an acceptable external currency authority. MXN must not be inferred from the endpoint timezone.
- No backend changes were made for this work.

Remote live integration remains blocked until the backend is published/deployed. Local mocked transport, unit, type, build, and intercepted browser evidence may proceed.

## Scope

Included:

- register the `Analytics` CASL subject without silently dropping `read:Analytics`;
- add strict TypeScript response/query contracts and the authenticated Axios API method;
- add centralized tenant-scoped analytics query keys;
- add fixed `America/Mexico_City` calendar helpers without UTC/browser-zone shifts;
- add a TanStack Vue Query composable with enabled/range guards, prior-data refetch behavior, bounded retry policy, and exact query identity;
- add guarded route and navigation entry;
- add a responsive analytics screen with explicit date boundaries/presets, eight metrics, loading, refetch, empty, error, and retry states;
- keep sales, debt, settled refunds, and pending refund obligations visually and semantically separate;
- invalidate matching analytics summaries after the existing sale-confirmation and debt-payment mutations;
- cover permissions, transport, dates, query behavior, presentation, navigation, and invalidation with focused tests.

Excluded:

- backend edits, backend Git/runtime/deployment operations, or assumptions about remote availability;
- tenant/branch selectors or tenant/branch query parameters;
- recomputing metrics from sales, payments, refunds, or methods of payment;
- currency inference from `America/Mexico_City`;
- charts, period comparisons, tax breakdowns, payment-method mix, daily/weekly/monthly series, or multi-branch analytics;
- refund creation/settlement mutation invalidation today because no refund feature exists in this frontend; add it with that future feature;
- unrelated public-catalog work.

## Decisions and rationale

- **Currency:** reuse `src/core/shared/utils/currency.utils.ts` and its canonical product-wide MXN configuration. This is external to the endpoint payload and avoids timezone inference.
- **Date boundary:** keep `from` and `to` as `YYYY-MM-DD` strings end-to-end. Build fixed-zone calendar helpers with `@internationalized/date`; do not reuse browser-local `dateRangeBoundaries.ts` or parse endpoint boundaries with `Date`.
- **User range semantics:** show the exclusive upper boundary explicitly instead of hiding a conversion. Presets may calculate exact `[from,to)` boundaries in Mexico City.
- **Empty state:** consider every numeric metric; `saleCount === 0` alone is insufficient because refund activity may still exist.
- **Unauthorized behavior:** hide navigation without permission and rely on the existing global `/403` guard for forced URLs.
- **Refund invalidation:** mark as not currently applicable rather than inventing frontend mutation sites.
- **Visual direction:** use the existing dashboard tokens, typography, Nuxt UI components, icons, light/dark behavior, and density. Present a restrained data-dense KPI layout; do not introduce new fonts, palettes, charts, decorative gradients, or motion dependencies.

## Component and data-flow map

- `BranchSalesSummaryView.vue`: thin route-level composition; owns date selection/preset intent, consumes the query composable, and selects the correct state presentation.
- `BranchSalesSummaryFilters.vue`: explicit typed `from`/`to` inputs and preset events; no transport ownership.
- `BranchSalesSummaryMetrics.vue`: presentational grouping for six sales metrics and two refund metrics; props down only.
- `useBranchSalesSummary.ts`: owns query identity, enabled rules, prior-data refetch behavior, normalized error exposure, and retry action.
- `analytics.api.ts`: exact Axios transport only; returns `response.data`.
- `branch-sales-summary.types.ts`: wire/query contracts.
- `branchSalesSummary.utils.ts`: pure empty-state helpers and metric metadata; monetary formatting delegates to the canonical shared currency utility.
- `mexicoCityCalendar.ts`: pure fixed-zone calendar/preset/range helpers.

## TDD, routing, and verification mode

TDD is **off by current ODD evidence**. The repository's `strict_tdd` setting is scoped to SDD/OpenSpec, the user did not select SDD or strict TDD, and test presence alone does not enable it. Use ordinary behavior-first implementation and observed focused checks. Unit runner: `pnpm test:unit --run`.

Every implementation task is delegated because each coherent work unit touches multiple non-trivial files. The parent owns scope, reconciliation, task state, commits, and review boundaries. Each writer receives exact allowed edit surfaces and exact verification commands.

Receipt-driven development is enabled globally. After each work-unit commit, assess the committed range through the native review facade and follow the returned risk/verification plan. Native review never authorizes push, PR, merge, or deployment.

## Delivery and workload

Delivery strategy: `ask-on-risk` (default). The user selected `feature-branch-chain`: keep ordered work-unit commits and any future review slices on `feat/branch-sales-summary`, then integrate to `main` only after Analytics is explicitly closed.

Forecast: approximately 850–1,000 authored changed lines including behavior and focused tests. The feature is intentionally split into reviewable work units; tests stay with the behavior they prove. No push, PR, merge, or backend delivery is authorized.

## Tasks

- [x] **A0 — Establish the isolated worktree and integration map.** Created `feat/branch-sales-summary` from local `main` at `f44bbda`, registered the worktree, read the backend handoff, obtained backend-owner readiness/currency confirmation, and mapped permissions, routing, queries, dates, mutation sites, UI analogues, and tests. No source file or backend state changed.
- [x] **A1 — Add the analytics authorization and transport foundation.** Registered `Analytics` in both permission domains; added the exact wire/query contracts, tenant/range query keys, authenticated Axios boundary, and minimal mutation-sensitive tests. Writer and independent verifier both observed 181/181 focused tests, type-check, new-file Prettier, and whitespace checks passing. Parent spot-check passed 2/2 API tests. Committed as `a032bc0 feat(analytics): add sales summary contract foundation`; native high-risk review `review-ffb45921d6593276` approved and was acknowledged with only one non-blocking portability suggestion about this task document. Route: delegated multi-file writer.
- [x] **A2a — Add fixed-zone range and summary semantics.** Implemented Mexico City calendar/preset/range helpers and summary empty-state utilities with focused tests. This was split from the original A2 after the first implementation measured 698 lines: the pure domain boundary is 419 lines and can be reviewed independently from query orchestration. Writer checks passed; independent verifier `mubxfeox-7-pjp0` returned PASS with no findings after 18/18 focused tests, type-check, Prettier, and whitespace checks. Parent spot-check passed 13/13 calendar tests. Committed as `ad7733a feat(analytics): add fixed-zone summary ranges`. Native assessment was unavailable while A2b remained intentionally untracked, and explicit committed-only review START failed before lineage creation with `candidate-target-projection-drift`; the completed independent PASS remains the verification of record. Route: delegated multi-file writer.
- [x] **A2b — Add branch summary query state.** Implemented `useBranchSalesSummary` with exact reactive keying, tenant/range guards, previous-data refetch behavior, retry controls, and focused tests. The first independent verification found two test-evidence gaps without a runtime defect; a one-file correction added getter/`to` reactivity plus empty/366-day boundary coverage. Re-verifier `muby5c89-a-qrom` returned PASS with no findings after 7/7 tests, type-check, Prettier, and whitespace checks. Route: delegated multi-file writer. Commit pending immediately after task-state persistence as `feat(analytics): add branch summary query state`.
- [ ] **A3 — Add the guarded analytics experience.** Add route/navigation permission gates and the thin responsive view, filters, grouped metrics, and loading/refetch/empty/error/retry states using existing design tokens and canonical MXN formatting. Include focused component/router/navigation tests and intercepted browser evidence if the existing harness can cover it without a remote backend. Route: delegated multi-file writer. Expected commit: `feat(analytics): add branch sales summary screen`.
- [ ] **A4 — Keep summaries fresh after existing sales mutations.** Invalidate the tenant-scoped analytics prefix after sale confirmation and debt payment; add mutation-sensitive focused tests. Record refund invalidation as N/A until a refund mutation feature exists. Route: delegated multi-file writer. Expected commit: `fix(analytics): refresh summaries after sales mutations`.
- [ ] **A5 — Verify and close the feature.** Run the full focused unit/type/build/format/whitespace matrix, any authorized intercepted responsive browser matrix, parent spot-check, native assessment/review continuations, and record every pass/failure/skip. Remote live endpoint evidence remains pending until deployment is confirmed. Route: delegated verifier when required by native assessment or expensive/browser checks.

## Authorized implementation surfaces

Planned new feature surfaces:

- `src/features/analytics/interfaces/`
- `src/features/analytics/api/`
- `src/features/analytics/composables/`
- `src/features/analytics/utils/`
- `src/features/analytics/components/`
- `src/features/analytics/views/`

Planned shared/auth/navigation/router surfaces:

- `src/features/auth/interfaces/auth.types.ts`
- `src/features/auth/authorization/ability.ts`
- `src/features/auth/authorization/__tests__/ability.test.ts`
- `src/core/shared/constants/query-keys.ts`
- `src/core/shared/constants/__tests__/query-keys.test.ts`
- `src/core/shared/utils/mexicoCityCalendar.ts`
- `src/core/shared/utils/__tests__/mexicoCityCalendar.spec.ts`
- `src/app/router/index.ts`
- `src/app/router/__tests__/`
- `src/app/navigation/navigation.registry.ts`
- `src/app/navigation/__tests__/`
- `src/features/POS/sales/composables/useSalesDrafts.ts`
- `src/features/POS/sales/composables/useDebtPayment.ts`
- their focused existing/new tests only
- `e2e/responsive/specs/branch-sales-summary.spec.ts` if browser evidence is feasible with intercepted transport
- this task document

Explicitly excluded: every backend path, public-catalog source, unrelated feature, dependency/lockfile change, generated artifacts, stash, existing OpenSpec artifacts, and remote environment mutation.

## Acceptance criteria

- A user with `read:Analytics` sees and can open the analytics entry; a user without it does not see the entry and a forced URL reaches the global forbidden flow.
- Requests send only exact `from` and `to` calendar strings to `/analytics/sales/summary`; no tenant, branch, currency, or extra query parameter is sent.
- Date helpers and presets use `America/Mexico_City`, preserve `[from,to)`, reject invalid/equal/inverted or over-366-day ranges before query execution, and never shift calendar days through UTC parsing.
- The query key changes for tenant context and either boundary, preserves prior valid data during refetch, and distinguishes initial loading from refetch.
- All eight backend metrics render exactly from the payload, with cents formatted through the canonical product MXN source and no invented aggregate.
- Sales and refunds remain separate; debt and pending obligations include non-color attention cues.
- Global empty appears only when every numeric metric is zero; refund-only activity is not empty.
- Existing sale confirmation and debt payment success paths invalidate the analytics summary prefix.
- Initial loading, refetch, data, empty, 400 validation, 403/forbidden, unexpected error, and retry behavior are covered at the appropriate layer.
- The layout remains usable without horizontal overflow at desktop, 375 px, and 320 px, with visible labels, keyboard access, visible focus, and at least 44×44 px interactive targets.
- No backend repository or public-catalog file changes.

## Verification contract

Per work unit, run the narrowest focused tests plus:

```sh
pnpm type-check
pnpm exec prettier --check <scoped-paths>
git diff --check
```

Final minimum matrix:

```sh
pnpm test:unit --run src/features/analytics src/features/auth/authorization src/app/navigation src/app/router src/features/POS/sales
pnpm type-check
pnpm build
pnpm exec prettier --check src/features/analytics src/core/shared/constants/query-keys.ts src/core/shared/utils/mexicoCityCalendar.ts src/app/router/index.ts src/app/navigation/navigation.registry.ts src/features/auth src/features/POS/sales
pnpm exec prettier --check odd/tasks/branch-sales-summary.md
git diff --check
```

If intercepted responsive evidence is added, run its exact focused Playwright command once through a verification worker. Remote live integration is explicitly not part of the passing matrix until deployment is confirmed.

## Progress and evidence

A0 evidence:

- New worktree is clean on `feat/branch-sales-summary` at `f44bbda`.
- Catalog worktree remains on `feat/public-catalog-visual-redesign` at `bb29560` with its preserved artifacts.
- Backend documentation was read only.
- Backend owner confirmed local merge at `111e112`, no remote deployment, and canonical frontend MXN use.
- Read-only frontend mapping task `mubunllx-1-hg3m` identified the exact permission, query, date, navigation, mutation, test, and UI integration points.

A1 evidence:

- Final scoped diff is 297 authored additions and zero deletions across exactly eight implementation/test files; unrelated pre-existing formatting is byte-for-byte preserved.
- Writer observed 181 focused tests, `pnpm type-check`, new-file Prettier, and `git diff --check` passing after correcting three initially misnamed wire fields and removing formatter/test bloat.
- Pre-commit native `assess` returned `unassessable` because intended untracked files were not yet declared; its plan required independent verification.
- Independent verifier `mubw16zv-5-ra0d` returned PASS with no findings and repeated all authorized checks successfully. Parent spot-check then passed the focused API spec 2/2. Runtime harness is N/A for the non-rendered foundation.
- Work-unit commit `a032bc0` contains exactly the task artifact and eight A1 implementation/test files. Post-commit native assessment classified it high risk because it touches authorization.
- Native review `review-ffb45921d6593276` ran risk, resilience, readability, and reliability lenses, approved the candidate, and was acknowledged. Its sole informational suggestion notes that the absolute worktree path in this recovery document is nonportable; it does not affect behavior or reopen review.
- Backend remained read-only; no package or lockfile change occurred.

A2a evidence:

- The original 698-line A2 implementation was split into a 419-line pure-domain unit and a 279-line query-state unit to protect review focus without dropping tests.
- A2a owns only four new files: the Mexico City calendar helper and tests plus the eight-metric empty-state helper and tests.
- Writer checks passed. Independent verifier `mubxfeox-7-pjp0` returned PASS with no findings and observed 18/18 focused tests, `pnpm type-check`, four-file Prettier, and `git diff --check` passing.
- Verification confirmed exact `[from,to)` boundaries, fixed-zone day selection, real-date/year-zero validation, 366-day acceptance, 367-day rejection, deterministic presets, and refund-only non-empty behavior.
- Parent spot-check passed the calendar spec 13/13. Work-unit commit `ad7733a` contains the four A2a files plus the reconciled task document; A2b remained untracked and unstaged.
- Post-commit native assessment was unavailable because A2b remained intentionally untracked. After explicitly excluding untracked work, committed-only native review START against `a032bc0..ad7733a` failed before lineage creation with `candidate-target-projection-drift`; no authority or candidate state was created.
- Runtime harness is N/A because this unit is pure domain logic. Backend and A2b files remained untouched by the verifier.

A2b evidence:

- A2b owns exactly two new files: `useBranchSalesSummary.ts` and its focused spec, totaling 313 lines after the bounded test correction.
- Writer checks initially passed 7/7 tests, type-check, two-file Prettier, and whitespace.
- Independent verifier `mubxvl2p-8-0e2i` found no runtime defect but identified missing mutation evidence for getter/`to` reactivity and empty/exact-366-day boundaries.
- A test-only correction changed only the spec, preserved 7 tests, and added all missing assertions. Re-verifier `muby5c89-a-qrom` returned PASS with no findings and repeated every check successfully.
- Verification confirms tenant cache isolation without transport leakage, live tenant/from/to key identity across getter/ref inputs, fully valid range gating, exact API arguments, 30-second stale time, previous-data retention, distinct loading/refetch states, empty-state integration, and guarded manual retry.
- Runtime harness is N/A because no route or rendered interaction exists. Backend and committed A1/A2a files were not modified.

## Next step

Create the isolated A2b work-unit commit, record its native risk outcome, then delegate A3 guarded analytics experience.
