# Dashboard operational insights

## Objective and authority

Turn the existing aggregate-only `/dashboard` into a richer operational sales dashboard inspired by `/home/aldrich_coder45/Pictures/Screenshots/Screenshot_2026-09-22-14-13-52_5360x2520.png`, while preserving Houndfe/Coco visual language and never fabricating trends, comparisons, ratios, targets, inventory warnings, or product rankings.

Frontend worktree: `/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe-branch-sales-summary`

Frontend branch/start: `feat/branch-sales-summary` at `249a3fa`

Authorized backend worktree: `/home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend-branch-sales-timeseries`

Authorized backend branch/base: `feat/branch-sales-timeseries` from local backend `main` at `57eab80`

The user explicitly authorized creating the isolated backend worktree and selected `@unovis/vue` plus `@unovis/ts`, matching the official Nuxt UI Vue Dashboard template, for the real sales trend visualization. No push, PR, merge, deployment, destructive Git action, or unrelated worktree mutation is authorized.

## Problem and why

The current Dashboard is visually polished but still behaves like one enlarged summary card: eight period aggregates plus date controls. It cannot express movement over time, and it offers no direct operational context. The supplied reference establishes a stronger information architecture: a compact KPI strip, one dominant trend surface, a secondary operational column, and lower-detail modules within the existing large page card.

The deployed backend currently exposes only `GET /analytics/sales/summary`. A truthful trend requires a new backend contract. Recent sales, debt-bearing sales, and pending refunds already have real endpoints and may be reused only when the authenticated identity has their exact permissions.

## Product and design decisions

- Keep `/dashboard` as the sole exact `read:Analytics` destination.
- Keep the existing full-width Products-style outer `UCard`; redesign only its interior information architecture.
- Default the range to `Este mes` using the existing Mexico City calendar helper.
- `Este mes` is selected initially. Selecting another preset moves the selection. Manually editing either date clears the preset highlight but keeps the valid custom range active; there is no empty/no-query range mode.
- Use the reference's hierarchy, not its pink palette or fictitious metrics. Use existing Coco blue/neutral semantic tokens in light and dark themes.
- Show all eight summary values one-to-one. Sales and refunds remain distinct accounting concepts.
- Add one real daily trend sourced from the new backend time-series endpoint. Do not infer missing points in the browser; backend returns zero-filled calendar buckets.
- The primary chart presents one metric at a time to avoid mixed-unit dual axes. Net sales is the default. Any metric switch must map directly to one returned series.
- Use an Unovis area surface with a Coco line and explicit `.dark` token overrides; Unovis 1.7.0 does not recognize the app's `html.dark` selector automatically.
- Provide a concise text summary and a semantic table alternative for the chart. Hover-only tooltips are insufficient.
- Reuse recent confirmed sales, debt-bearing sales, and pending refunds only through existing endpoints and only when their exact permissions are present. Hide unavailable modules rather than leaking or producing avoidable 403 requests.
- Register `SaleRefund` canonically in the frontend CASL subject/type registries so `userCan('read', 'SaleRefund')` remains the sole permission authority; the user explicitly authorized this narrow auth-surface expansion plus its focused test.
- Keep operational folios and refund sale identifiers as plain text in this phase; no navigation behavior is added.
- Do not add stock warnings or top-product/category modules in this phase; no trustworthy backend contract exists for them.
- No prior-period percentage, delta badge, target, forecast, derived ratio, combined refund net, or derived financial total.
- Preserve exact `America/Mexico_City` `YYYY-MM-DD` half-open `[from,to)` ranges, canonical MXN formatting, 44px targets, visible focus, non-color obligation cues, no horizontal overflow, and deterministic light/dark behavior.

## Verified contracts

### Existing summary

`GET /analytics/sales/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`

- JWT tenant scope; never send `tenantId` or `branchId`.
- Exact permission `read:Analytics`.
- `America/Mexico_City`; exact half-open `[from,to)` range; maximum 366 days.
- Returns `timeZone`, `from`, `to`, `grossSalesCents`, `netSalesCents`, `collectedCents`, `outstandingDebtCents`, `saleCount`, `averageTicketCents`, `settledRefundsCents`, and `pendingRefundObligationsCents`.

### New backend contract

`GET /analytics/sales/timeseries?from=YYYY-MM-DD&to=YYYY-MM-DD&interval=day`

- Same JWT tenant scope, exact `read:Analytics`, timezone, date validation, strict unknown-query rejection, and 366-day maximum as summary.
- `interval` defaults to and only accepts `day` in v1.
- Backend returns every local calendar day in `[from,to)`, including zero-filled days.
- Response:

```ts
{
  timeZone: 'America/Mexico_City'
  from: string
  to: string
  interval: 'day'
  points: Array<{
    date: string
    grossSalesCents: number
    netSalesCents: number
    collectedCents: number
    outstandingDebtCents: number
    saleCount: number
    averageTicketCents: number
  }>
}
```

- Each bucket uses `CONFIRMED` sales grouped by `confirmedAt` in Mexico City calendar time.
- `averageTicketCents` is zero for a zero-sale day.
- Refunds are not subtracted and no cash-net value is invented.

### Existing optional operational contracts

- Recent tickets: `GET /sales?status=CONFIRMED&sortBy=confirmedAt&sortOrder=desc&page=1&limit=5` with exact `read:Sale`.
- Debt-bearing tickets: `GET /sales?status=CONFIRMED&paymentStatus=PARTIAL,CREDIT&debtMin=1&sortBy=confirmedAt&sortOrder=desc&page=1&limit=5` with exact `read:Sale`; `debtMin` is cents.
- Pending refunds: `GET /sales/refunds/pending?page=1&limit=5` with exact `read:SaleRefund`; existing queue ordering remains authoritative.

## Component map

- `BranchSalesSummaryView.vue` — thin route composition surface; owns range and active preset, coordinates independently resilient modules, and preserves the single page heading.
- `BranchSalesSummaryFilters.vue` — controlled dates and preset selection; props down, events up; active preset uses `aria-pressed` plus visible selected styling.
- `BranchSalesSummaryMetrics.vue` — composes all eight one-to-one aggregates into the top KPI strip and supporting sales/refund groups.
- `BranchSalesTrendChart.vue` (new) — presentational Unovis single-series chart, metric selector, accessible summary, semantic table alternative, and chart-specific loading/empty/error/retry UI.
- `DashboardOperationalPanel.vue` (new) — permission-aware composition of recent sales, debts, and pending refunds; each data source fails independently.
- Focused small row/card components may be extracted only when they remove real duplication and keep typed props/no hidden data access.
- `useBranchSalesTimeseries.ts` plus focused API/types/query keys — exact transport and cached query state for the new analytics endpoint.
- Reuse existing sales/refund APIs/composables when their request contracts already match; do not create competing clients.

## Tasks

- [x] **OI-1 — Reconcile frontend, reference, and backend contracts.** Read-only frontend mapping and backend coordination confirmed the aggregate-only limit, existing operational endpoints, the one-endpoint time-series plan, official Unovis precedent, default-preset behavior, and isolated-worktree requirement. Route: delegated frontend explorer plus backend-owner coordination.
- [x] **OI-2 — Create and implement the isolated backend time-series contract.** Completed five reviewed local commits: S1 transport `07fc6598`, S2 port/service/zero-fill `a46e4c57`, S3 Prisma adapter `c643fea9`, S4 HTTP exposure `08c9822e`, and S5 frontend contract handoff `3da066c`. Final range `57eab80..3da066c` spans 14 paths and passed 145/145 unit tests, 5/5 strict PostgreSQL tests, build/type/lint/format/diff/safety gates, per-slice independent/native reviews, and assembled-range native review `review-cd491f040f4d9451` with no findings. The backend worktree is clean; the promotions worktree remained hash-identical. The endpoint exists only on this local branch, not production. Route: backend owner in its dedicated worktree.
- [x] **OI-3 — Make `Este mes` the selected default.** Completed in `4e1b301 feat(dashboard): select current month by default`: one typed active preset defaults to `thisMonth`; presets expose semantic selected styling plus `aria-pressed`; manual date edits clear only selection and issue the exact custom request. The final matrix passed 50/50 focused tests, type-check, scoped static gates, and 8/8 responsive Chromium cases after test-only remediation closed three independent evidence gaps. Native review `review-f6dfd65667879b76` approved/acknowledged with no findings. The user explicitly accepted the reviewed 684-line size exception for this coherent local commit. Route: delegated bounded writer, independent verifier, and native review.
- [x] **OI-4 — Add the typed time-series frontend boundary.** Completed in `1bf3661 feat(analytics): add branch sales timeseries client` under the user-authorized single-commit `size:exception`. The unit adds strict response validation/types, exact abortable transport, tenant-isolated query keys, an independently guarded composable, and authorized Unovis dependencies without rendering or importing a chart. Verifier remediation rejects equal/inverted or >366-day windows in at most 367 calendar steps, documents cohort-state accounting semantics, and gives `refetch`/`retry` one guard. Final evidence: 143/143 focused tests, 12/12 summary regressions, type-check/build/frozen-lockfile/diff checks green, independent verdict READY, and native review `review-45dac163e35c5d0b` approved/acknowledged with no findings. The full Prettier command reports only proven HEAD debt in the two legacy query-key files; every new line matches actual Prettier output. Route: delegated bounded writer, independent verifier, and native review.
- [ ] **OI-5 — Build the richer responsive dashboard interior.** OI-5A completed in `b6c3290 feat(dashboard): add accessible sales trend` under the user-authorized single-commit `size:exception`. OI-5B1 completed in `579a45d feat(sales): add pending refund query boundary` under a separately authorized single-commit `size:exception`. B1 canonically registers `SaleRefund`, adds strict pending-refund wire validation/API/query keys, and provides a permission-aware fixed-page composable. Verifier remediation removed cross-tenant placeholder retention, masks every public data/error/loading surface on tenant or permission loss, and makes guarded `refetch`/`retry` return `Promise<void>` instead of raw observer results. Evidence: 316/316 focused tests, 22/22 neighbor regressions, 372/372 broad auth/sales tests, type-check/forced vue-tsc/build/frozen-lock/diff green, zero candidate Prettier conflicts beyond proven HEAD debt, backend worktree clean, independent verdict READY, and native review `review-07dfb001e7cc1ca8` approved/acknowledged without correction. The installed TanStack 5.95.2 observer contains late A→B refetch errors before the public promise; a dedicated runtime regression remains future hardening, not a demonstrated leak. OI-5B2 mapping is complete and confirmed that the POS `useConfirmedSales` table composable cannot be mounted twice safely because it has no permission gate, defaults to 20 rows, and shares one persisted table key. B2 is therefore split into S1 an additive abortable `listConfirmed` transport extension plus query keys and two fixed permission-aware sales composables, S2 presentational operational panels, S3 view integration, and S4 strict responsive request evidence. The existing authorization for focused sales API/spec changes applies because mapping proved that the current one-argument transport cannot forward TanStack's AbortSignal; the extension remains optional and backwards-compatible. S1 implementation and independent verification are complete; fresh native review is pending. S1 now forwards cancellation, owns exact five-row recent/debt requests, masks every public surface behind tenant/permission plus current-query adoption, and prevents synchronous A→B exposure while Vue Query changes observers. Evidence: 35/35 new composable tests across three runs, 173/173 combined query regressions, 102/102 sales API tests, 22/22 neighbor tests, 76/76 broad analytics composable tests, type-check/two explicit vue-tsc/build/diff green, zero candidate Prettier conflicts beyond proven HEAD debt, and independent verdict READY. Route: delegated bounded frontend writers with strict focused TDD and per-slice independent/native review.
- [ ] **OI-6 — Verify integration and responsive behavior.** Prove exact summary/time-series requests, Mexico City month-to-date defaults, selected/deselected presets, all eight metrics, chart/table equivalence, permission-gated optional requests, independent failure states, light/dark parity, 44px controls, and no overflow at 320×568, 375×667, 768×1024, 1024×768, and a wide desktop reference viewport. Route: independent verifier plus browser evidence as required by native assessment.
- [ ] **OI-7 — Reconcile evidence and delivery boundaries.** Update this record and its Engram mirror, report backend/frontend worktree status and uncommitted scope, and request any still-required commit/delivery authorization. Push, PR, merge, and deployment remain separate explicit decisions.

## TDD and verification

TDD: **on**, inherited from the established Dashboard feature workflow and its strict focused-test practice. Frontend runner: `pnpm test:unit --run`. Backend owner must record its repository's exact focused runner in its own ODD record. Every implementation unit records observed RED, GREEN, then REFACTOR; no fabricated retrospective RED.

Frontend focused checks:

```sh
pnpm test:unit --run src/features/analytics <focused sales/refund specs>
pnpm type-check
pnpm exec prettier --check <changed frontend paths>
git diff --check
```

Frontend final checks:

```sh
pnpm test:unit --run src/features/analytics src/features/POS/sales src/app/router
pnpm type-check
pnpm build
pnpm exec prettier --check <all OI-owned frontend paths>
git diff --check
pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/branch-sales-summary.spec.ts
```

Backend focused/final commands are owned and recorded in the backend task document; they must include DTO validation, service/controller behavior, repository bucket semantics, timezone boundaries, zero-filled days, authorization, build/type checks, formatting/lint, and whitespace checks.

## Acceptance criteria

- Default Dashboard request is the exact Mexico City current-month `[from,to)` range and `Este mes` is visibly and semantically selected.
- Manual date edits clear only the preset selection, not the valid range or query.
- Summary and time-series requests send only documented query parameters and never tenant/branch identifiers.
- Time-series points are real backend buckets, ordered, zero-filled, and bounded to the selected range.
- The chart defaults to net sales, exposes exact values through keyboard-reachable interaction plus a semantic table/text alternative, and never depends on color alone.
- All eight summary aggregates remain visible one-to-one; refunds remain separate.
- Optional recent/debt/refund modules make no request without their exact permission and do not break Analytics-only users.
- A failure in chart or one optional module does not erase successfully loaded KPIs or sibling modules; each failure offers a scoped recovery path.
- Layout follows the reference hierarchy inside the existing large card while using Coco tokens, consistent radii/elevation, tabular figures, and restrained motion.
- No stock warning, product ranking, trend comparison, delta, ratio, target, forecast, derived total, or fictitious value appears.
- Light/dark modes, visible focus, 44px targets, semantic headings/lists/tables, and no horizontal overflow pass the required viewport matrix.

## Authorized frontend edit surfaces

- `odd/tasks/dashboard-operational-insights.md`
- `package.json`
- `pnpm-lock.yaml`
- `src/core/shared/constants/query-keys.ts`
- `src/features/analytics/**`
- focused existing sales/refund API/composable/spec paths only after OI-5 mapping proves reuse requires a bounded change
- `src/features/auth/interfaces/auth.types.ts`
- `src/features/auth/authorization/ability.ts`
- `src/features/auth/authorization/__tests__/ability.test.ts`
- `e2e/responsive/specs/branch-sales-summary.spec.ts`

Explicitly excluded on frontend: router/navigation/auth behavior, public catalog, unrelated POS UI, generated artifacts, broad formatting, deployment/configuration, and any endpoint/client outside the verified Dashboard data plan.

Backend edit authority belongs only to the separate user-authorized backend worktree and its own bounded ODD record. The active `feat/promotion-capacity-alerts` worktree and its dirty integration spec are protected and must remain byte-for-byte untouched.

## Review workload and delivery strategy

Forecast: approximately 350–550 authored backend lines plus tests/docs and 650–950 authored frontend lines plus tests/E2E. This exceeds one review slice. Delivery strategy is `ask-on-risk`; the user selected **Feature Branch Chain** for any future PR delivery (no PR is authorized yet). OI-3 received an explicit reviewed `size:exception` and was committed as one 684-line local work unit. OI-4 was a coherent but larger-than-forecast transport/query unit (about 1,313 authored source/test lines plus generated lockfile growth); after independent/native approval, the user explicitly authorized its single local commit `1bf3661` under `size:exception`. OI-5 is split into chart composition (5A), refund permission/transport (5B1), operational composition (5B2), and browser evidence. OI-5A was a coherent large unit (`+2,524/-76` across source, tests, and E2E); after independent/native approval, the user explicitly authorized local commit `b6c3290` under `size:exception`. OI-5B1 was another coherent large candidate (1,672 reviewed changed lines); after independent/native approval, the user explicitly authorized local commit `579a45d` under `size:exception`. OI-5B2 is pre-split into four reviewable work units: S1 fixed operational queries, S2 presentational panels, S3 permission-aware view composition, and S4 browser/request evidence. S1 is a coherent but large candidate of roughly 1.7k authored source/test lines; request its explicit size/commit decision only after fresh native approval. Each later slice receives independent/native review and any slice still exceeding ~400 authored lines requires a separate explicit size decision. The ~400-line guideline is advisory: do not omit tests, minify code, or split incoherently to satisfy it.

## Progress and next step

OI-1 through OI-4 are complete. Backend timeseries remains local-only and undeployed. Frontend current-month preset behavior is committed at `4e1b301`; the typed time-series boundary and Unovis dependencies are committed at `1bf3661`; the accessible daily trend is committed at `b6c3290`. All three frontend units passed independent and native review. OI-5B1 is committed locally at `579a45d` after independent and native approval plus an explicit size exception. Its tracker closeout is recorded in a separate local documentation commit; no delivery action is authorized. OI-5B2 mapping is complete. S1 now additively extends `saleApi.listConfirmed` with optional AbortSignal forwarding, adds disjoint tenant-scoped dashboard-recent/dashboard-debt slots, and exposes two fixed five-row composables. Independent remediation closed synchronous tenant A→B exposure for rows, errors, and loading states by gating the whole public surface on current-query adoption; the installed Vue Query refetch wrapper also adopts B options synchronously before a pre-flush manual refetch. S1 is independently READY and uncommitted pending fresh native review plus an explicit size decision. Later slices own presentation, view integration, and browser evidence.
