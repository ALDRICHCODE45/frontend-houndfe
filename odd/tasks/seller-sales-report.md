# Seller sales report

## Authorization and delivery

Owner authorizes seller report implementation in existing worktrees only; local commits, owner pushes. Frontend branch feat/seller-sales-report, base bdb0550a5e8499f099fb23ba4ff79b3d54468336. No PR, deployment, external requests, database operations or new worktrees. Preserve two existing untracked OpenSpecs and generated declarations.

After disclosed overruns, owner approved frontend ceiling 5,500 authored additions+deletions including tests/docs/corrections and backend 1,800. Original forecasts were frontend 1,855–2,535/backend 600–1,000. After native full-candidate review failed lens_context_budget_exceeded before creating authority, owner explicitly approved smaller coherent review/delivery units with tests. Strategy: same-branch local commit chain, review each committed range against its predecessor; no push or claim whole feature ready until all slices pass. Existing larger-than-400 exception remains; never truncate evidence or remove tests to fit.

## Approved behavior and frozen contract

Users row action requires read:User AND read:Sale AND read:Analytics without granting permissions. Current assigned seller, active tenant; inactive sellers remain actionable. Confirmed sales selected by confirmedAt; canceled sales separately by canceledAt, excluded from confirmed totals. Full-detail print, current attribution and balances disclosed; reassignment changes attribution even for past periods, not historical accounting snapshots.

GET /analytics/sales/sellers/:sellerUserId/report?from=YYYY-MM-DD&to=YYYY-MM-DD. CDMX [from,to), 1–366 days. Response seller{id,name}, tenantId, timeZone, from/to, generatedAt, attribution CURRENT_SELLER, balances CURRENT, rowLimit 1000, rowCount. Confirmed dateBasis confirmedAt, summary saleCount/netSalesCents/collectedCents/outstandingDebtCents/averageTicketCents, rows id/folio/confirmedAt/totalCents/paidCents/debtCents/paymentStatus (PAID|PARTIAL|CREDIT). Canceled dateBasis canceledAt, saleCount, rows id/folio/confirmedAt nullable/canceledAt/totalCents. Rows ordered date asc then id asc; safe nonnegative integer cents/counts, exact echoes/counts, no frontend totals computation. Empty200 valid. Combined >1000: 422 SELLER_REPORT_ROW_LIMIT_EXCEEDED, no partial dataset. 404 SELLER_NOT_FOUND. Domain envelope statusCode/error/message/timestamp; message equals code, 422 adds flat rowLimit/rowCount; parse status/error. Backend snapshot consistent, current tenant target membership or historical assignment eligibility. MXN existing formatter; no generic endpoints/migrations/history/PDF-server changes.

Print escaped standalone iframe HTML, inline styles/system fonts, no remote assets or application-window printing. Fresh fetch before print; recheck identity/permissions/range after fetch and frame load. Tenant/seller/range query identity, no stale carryover, errors disable printing. Explicit CDMX display.

## Tasks and ordered review slices

- [x] S1: Implement bounded frontend with tests. Writer RED then GREEN; attribution correction RED2 then GREEN39 focused/160 full.
- [ ] S2: Verify and review exact ordered slices. In progress; A/B/C approved and acknowledged. D final independent checks passed; its committed-range native review remains pending.
- [ ] S3: Confirm all frontend slices and backend reviewed candidate ready; finish local delivery and report remaining acceptance limits. Pending.

Slice A (1,644 actual Git additions; planning read lengths had trailing-newline overcounts): isolated runner; interfaces/seller-report.types.ts and test; api/sellerReport.api.ts and test; utils/sellerReportPresentation.ts and test. Depends only on base/shared infrastructure. Runner included so each cumulative snapshot can execute targeted tests.
Slice B (1,022 actual Git additions): utils/sellerReportPrint.ts and test. Depends on A.
Slice C (864 actual Git additions): query-keys.ts; composables/useSellerSalesReport.ts and test. Depends on A+B.
Slice D (1,061 new +248 tracked authored =1,309): Content/Drawer components and tests; AdminUsersView.vue and test; this tracker separately. Depends on A+B+C. No shared fixtures or future imports in earlier slices. Paths under src/features/admin/users/seller-report except existing views and root runner/tracker.

Parent rechecked tracked deltas +88/-5 and +155/-0. Correct newline-based implementation total is 4,839 authored lines, plus this tracker, within5,500. Earlier 4,855 included one extra read-length line per new file. A commit463c8bc2dd262657165f7aaa974c350b0478b8d9: review-1502f1d6eb4f173a approved/acknowledged. B commit2f4b2eb4a1aa93c9c067afb0162c3e302373f789: review-bdb48955efd8356b approved/acknowledged. C commitd50278cf9f3cfc83d056c81efdb5b72863567038: review-106f9c0ace307086 approved/acknowledged. Each review had informational nonblocking findings only, no corrections. D commit/review pending at this checkpoint; later completion recorded in session memory to avoid claiming approval in advance. Rollback later units in reverse dependency order without touching unrelated work; no partial production delivery.

## Verification and safeguards

Read-only mapper and independent verifier completed. Independent initial159tests/8files, app/vitest/node vue-tsc --noEmit --incremental false, scoped ESLint/Oxlint/Prettier and diff check PASS. Correction writer reported focused39 and full160 PASS, quality/app+vitest types PASS. Final independent160/8 PASS; per-slice A57/3, B25/1, C15/1 PASS. D closure repeated full160/8, all three noEmit/incrementalfalse type checks and scoped six-path ESLint/Oxlint/Prettier PASS. Hashes for all18 implementation paths,3declarations,2OpenSpecs unchanged; index empty before/after tests. HTTP/print mocked; ambient tests do not prove isolated committed-tree execution.

Runner must not import vite.config.ts or read .env files. Owner explicitly permits FUTURE NuxtUI template writes only node_modules/.nuxt-ui/ and config-loader writes node_modules/.vite-temp/. Require envDir:false,dts:false,test.cache:false; no generated declarations, results cache, other outputs or installs. This supersedes original Vue-only restriction prospectively, not retroactively. Earlier plugin/budget deviation disclosed; existing ignored files cannot be attributed by existence or timestamps. Unchanged hashes do not prove absence of ignored writes.

Exact runner: node_modules/.bin/vitest run --config vitest.seller-report.isolated.config.ts --no-file-parallelism; append selected spec paths for slices. No default full runner/build/network/server/DB. Parent owns tracker; workers no Git mutation.

Backend independent216tests/12suites and production types PASS, native approved/acknowledged, frozen awaiting frontend. Backend full type check has186 out-of-scope errors not proven pre-existing. Real PostgreSQL snapshot/timezone/scale and real-browser print remain unverified. Full frontend native START created NO lineage, no reset/recovery needed. Current next step: commit D six UI/test paths plus this tracker, then review only its range against d50278cf9f3cfc83d056c81efdb5b72863567038. Coordinate backend local commit only after D approval; no push or main integration authorized by a review.
