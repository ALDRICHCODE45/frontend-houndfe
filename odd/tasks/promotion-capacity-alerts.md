# Promotion capacity and email alerts

## Goal

Integrate the backend promotion-capacity contract into the existing Vue/Nuxt frontend. Tenant users must be able to configure an optional product-unit cap, see server-owned consumption and remaining capacity, handle checkout re-quotes safely, observe restored capacity after full cancellation, and configure the two new asynchronous email alerts through the existing notification settings surface.

## Authority and boundaries

- The user authorized local frontend implementation from `main`; work continues on `feat/promotion-capacity-alerts`.
- Backend source of truth: `/home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend/docs/promotion-capacity-alerts-frontend.md` at backend commit `edf6ef8`.
- No backend mutation, push, pull request, deployment, release, branch deletion, reset, clean, rebase, force operation, or unrelated refactor is authorized.
- Preserve these protected untracked artifacts byte-for-byte:
  - `openspec/changes/online-catalog-publishing/.gentle-ai-instance`
  - `openspec/changes/public-catalog-branch-discovery/verify-report.md`
- Keep technical artifacts in English and user-facing UI copy in Spanish.
- Reuse existing Nuxt UI controls, notification registry/mappers, promotion form/detail/list patterns, payment confirmation surfaces, query keys, and responsive test fixtures.

## Contract constraints

- Render `maxProductUnits`, `consumedProductUnits`, and `remainingProductUnits` exactly as returned. Never derive remaining capacity in the client.
- Promotion updates preserve tri-state semantics: omit to keep, `null` to remove, positive integer to replace. Never send `consumedProductUnits` or `remainingProductUnits`.
- Every charge attempt sends one non-empty `idempotency-key`; transport retry reuses it, but a user-confirmed re-quote creates a fresh key.
- `PROMO_CAPACITY_RE_QUOTE` always rereads the draft and presents the accepted server totals before an explicit second confirmation. Never auto-retry.
- `PROMOTION_CAPACITY_EXCEEDED` and `PROMOTION_CAPACITY_CLAIM_MISMATCH` keep the draft open and provide actionable retry recovery.
- The backend accepts exactly five cancellation reasons (`CUSTOMER_REQUEST`, `ORDER_ERROR`, `OUT_OF_STOCK`, `DUPLICATE_SALE`, or `OTHER`), but this frontend flow sends `CUSTOMER_REQUEST` and does not invent a broader reason workflow. Refresh affected sales/promotion state and do not add partial cancellation/refund behavior.
- Notification preferences remain a full replacement. GET precedes PUT; PUT sends only the currently enabled subset of exactly five action keys and preserves recipients/master state.
- Alert delivery is asynchronous email only. Do not promise immediate delivery or add in-app, push, SMS, or Slack behavior.

## Allowed implementation surfaces

- `src/features/POS/promotions/**`
- `src/features/POS/sales/**`
- `src/features/system/notifications/**`
- `src/core/shared/constants/query-keys.ts`
- `src/features/POS/quotations/composables/__tests__/useAvailablePromotions.test.ts` (fixture-only compatibility)
- `src/features/POS/quotations/views/__tests__/QuotationDetailView.test.ts` (fixture-only compatibility)
- directly related responsive E2E targets/specs/fixtures/assertions under `e2e/responsive/**`
- `package.json` (responsive verification script paths only)
- `src/test/mountWithUApp.ts` (test-only toaster teardown isolation)
- `src/features/POS/customers/components/CustomerSalesHistorySlideover.spec.ts` (explicit real-toaster regression opt-in only)
- `odd/tasks/promotion-capacity-alerts.md`

Any required file outside these surfaces is a material scope change and must be reassessed before writing.

## Tasks

- [x] **PCA-1 — Add promotion capacity contracts and UI.** Extended exact response/request/schema types, preserved create/update tri-state semantics, added an accessible optional capacity field, and displayed server-authoritative cap/consumed/remaining values in existing promotion list/detail patterns without deriving remaining. **Verified:** 32 focused files / 770 tests passed; `pnpm type-check`, changed-file Prettier, and `git diff --check` passed; independent verifier verdict PASS. **Commit:** `1d0092c` (`feat(promotions): add product-unit capacity controls`).
- [x] **PCA-2 — Make charge re-quotes capacity-safe.** Preserved the existing idempotency lifecycle, strictly parsed the three flat 409 capacity envelopes without conflating `PROMO_RE_QUOTE`, reread authoritative draft totals, added a non-dismissible explicit-acceptance modal, minted a fresh key only after acceptance, required a new charge click, kept race-conflict drafts open, and invalidated promotion/confirmed-sale state after success. **Verified:** five specs / 189 tests and full sales 76 files / 1,224 tests passed; type-check, exact-file Prettier/ESLint, `git diff --check`, and independent verifier PASS. **Commit:** `f7d8ef3` (`feat(sales): require explicit promotion capacity re-quotes`).
- [x] **PCA-3 — Add full sale cancellation.** Added the exact five-reason contract while this flow always sends `CUSTOMER_REQUEST` without a client idempotency key; added the existing-dropdown `CONFIRMED` + `delete:Sale` gate, destructive full-sale confirmation, authoritative refunded/restocked-unit copy, honest replay/conflict handling, and tenant-scoped sale, pending-refund, dashboard, analytics, and promotion invalidation. Test-local `UApp` toaster isolation prevents reka-ui timers from leaking beyond jsdom teardown while preserving the shared real toaster. **Verified:** current focused PCA-3 4 files / 44 tests and full sales 79 files / 1,257 tests passed with zero unhandled errors; type-check, exact-file ESLint, and `git diff --check` passed; independent verifier verdict PASS. Two whole-file Prettier warnings are inherited from `HEAD`. **Commit:** `f0ae1d0` (`feat(sales): add full confirmed-sale cancellation`).
- [x] **PCA-4 — Add promotion email-alert preferences.** Extended the exact five-key union and runtime whitelist with `PROMOTION_EXPIRING` and `PROMOTION_NEAR_CAPACITY`; added a data-driven “Promociones” accordion module with two shared-recipient toggles and accurate Spanish copy for the 7-day expiry window, upward finite-cap 80% crossing, unlimited exclusion, and asynchronous email delivery. Preserved GET `recipients` → PUT `recipientUserIds`, exact three-field full replacement, unrelated enabled actions, permission/error/default behavior, and authoritative PUT-response rehydration. **Verified:** six focused files / 169 tests and full notifications 14 files / 255 tests passed; type-check, exact-file Prettier/ESLint, `git diff --check`, and independent verifier PASS. **Commit:** `84bd265` (`feat(notifications): add promotion capacity alerts`).
- [x] **PCA-5 — Verify the integrated workflow and responsive UX.** Added routed browser coverage for capacity editing/status, explicit capacity re-quote acceptance, confirmed-sale cancellation, and promotion alert preferences at shell-1024, phone-375, and phone-320. The focused promotion-capacity browser suite passed 12/12 with strict request auditing, overflow checks, keyboard interaction, 44px capacity input coverage, and light/dark readability checks. Fresh independent HY-04 evidence also passed the candidate-owned Entregas → Promociones ArrowDown record and dirty-form Promociones → enabled Guardar Tab record at all four HY-04 viewports with zero setup failures. **Verified:** full unit suite 438 files / 7,290 tests, `pnpm type-check`, production build, `pnpm type-check:responsive`, focused browser suite 12/12, exact-file ESLint, and `git diff --check` passed. Existing HY-04/DT01 strict-red conformance failures, inherited whole-file Prettier debt, and the build chunk-size warning remain visible below. Native review was unavailable. **Commit:** `bc146e8` (`test(responsive): cover promotion capacity workflows`).
- [x] **PCA-6 — Eliminate the SaleDetailView sales-test toast teardown leak.** Corrected the `SaleDetailView.test.ts` Nuxt UI toast mock to expose `toasts` as a real Vue `ref([])` and removed ineffective global `useToast` stubs. This prevents the real `UApp` toaster from iterating `{ value: [] }` as one bogus toast and scheduling a reka-ui close timer after jsdom teardown, while preserving the shared real toaster and all toast spy assertions. **Verified:** focused SaleDetailView 1 file / 28 tests and full sales 79 files / 1,257 tests exited 0 with zero unhandled errors; type-check, exact-file Prettier/ESLint, and `git diff --check` passed independently. The three known jsdom navigation warnings remain non-failing. **Commit:** included in `f0ae1d0`.
- [x] **PCA-7 — Normalize the remaining sales toast mocks.** Changed the existing Nuxt UI `useToast` mocks in `SaleDetailTimeline.test.ts` and `SaleDetailHistoryCard.test.ts` from plain `{ value: [] }` objects to real empty Vue `ref([])` values, preserving the real shared toaster and existing assertions. **Verified:** focused 2 files / 21 tests passed; two consecutive full-sales runs each passed 79 files / 1,257 tests with zero unhandled errors; type-check, exact-file ESLint, and `git diff --check` passed. Exact-file Prettier still warns on both whole files, but both HEAD versions also fail and formatter diffs do not touch the new `ref` import or `toasts: ref([])` lines. The three known jsdom navigation warnings remain non-failing. **Commit:** included in `f0ae1d0`.

## Verification contract

Minimum checks:

```sh
pnpm test:unit --run <focused promotion, sales, and notification specs>
pnpm type-check
pnpm build
pnpm type-check:responsive
pnpm exec prettier --check <changed supported files>
pnpm exec eslint <changed source files>
git diff --check
```

Browser verification must prove keyboard-accessible controls, no horizontal overflow at 320px, honest re-quote copy, preserved notification preferences, and both light/dark readability. Authenticated or backend-coupled scenarios that cannot run locally must be reported as unavailable rather than simulated as passing.

## Evidence

- Initial branch point: `5da38c2d0a15d7eec6b4b12cd250812040326eeb`.
- PCA-1 writer RED: 7 new capacity spec files failed with 51 failures before implementation.
- PCA-1 focused writer GREEN: 30 promotion files / 627 tests passed.
- PCA-1 independent final verification: 32 files / 770 tests passed; `pnpm type-check`, changed-file Prettier (24/24), and `git diff --check` passed.
- PCA-1 native assessment was unavailable with `package-local-binary-missing`; the independent verifier is evidence, not native approval.
- PCA-2 writer RED covered missing parser/modal/query helpers and key regeneration; final independent verification passed five specs / 189 tests, full sales 76 files / 1,224 tests, type-check, Prettier, ESLint, and diff-check.
- PCA-2 sales tests emitted three environment warnings (`Not implemented: navigation to another Document`) with no uncaught errors.
- PCA-3 writer and independent verifier passed four focused files / 70 tests, the isolated failure-path reproduction, and full sales 79 files / 1,257 tests; `pnpm type-check`, exact-file ESLint, and `git diff --check` passed.
- PCA-3 corrected a row-count/quantity copy defect by summing backend `restockedItems[].quantity` and reporting authoritative restored units. The shared `mountWithUApp` helper continues to mount the real toaster; the two offending sale-history specs now mock `@nuxt/ui/composables/useToast` directly, eliminating the prior post-teardown `document is not defined` error without weakening shared toast coverage.
- PCA-3 whole-file Prettier check still reports inherited warnings in `sale.types.ts` and `SaleDetailView.vue`; checking both `HEAD` versions also fails, and no PCA-3-added line required reformatting.
- PCA-4 independent verification passed six focused files / 169 tests and full notifications 14 files / 255 tests; type-check, exact-file Prettier/ESLint, and `git diff --check` passed.
- PCA-4 copy explicitly describes the upward crossing from below 80% to reaching or exceeding the threshold, unlimited-cap exclusion, and asynchronous email delivery that may be delayed.
- PCA-5 cumulative unit verification passed 438 files / 7,290 tests. `pnpm type-check`, `pnpm build`, and `pnpm type-check:responsive` passed. The build retained the known chunk-size warning, including an 888.75 kB index chunk.
- PCA-5 focused browser verification passed 12/12 across shell-1024, phone-375, and phone-320. It covered finite/unlimited/stale capacity, the 44px capacity spinbutton, explicit re-quote acceptance without auto-charge, cancellation request and restored-unit copy, promotion-alert preference preservation, strict request auditing, overflow, keyboard operation, and light/dark readability.
- Fresh independent HY-04 C3 evidence is stored at `artifacts/responsive/hy04-final-independent-verify-q4/evidence/evidence.jsonl` (with `summary.json`, `test-results/`, and `html/` under the same run root). `success-focus-order-2` (Entregas → Promociones via ArrowDown) and `success-focus-order-dirty` (Promociones → enabled Guardar via Tab) passed at phone-320, phone-375, tablet-768, and shell-1024; setup failures were zero.
- The same fresh HY-04 C3 run intentionally remained strict-red overall: Playwright exited 1 with 71 passing and 41 failing evidence records. Unrelated failures remain unsuppressed for the master → recipient accessible-name expectation, recipient semantics, five undersized targets, accordion focus/activation, HR visibility, and one shell-1024 focus obstruction.
- Exact-file HY-04 ESLint, responsive type-check, and `git diff --check` passed. Whole-file Prettier remains inherited debt in `sale.types.ts`, `SaleDetailView.vue`, and `hy04-notifications.spec.ts`; read-only comparisons found no candidate-added formatting violation.
- A later transient TS2352 report was not reproducible: forced `vue-tsc`, the Vitest TS project, mapper tests (13/13), and capacity resolver tests (24/24) passed. Missing response counters remain stale-safe through the explicit undefined guard and were not reproduced as unlimited.
- Native review remained unavailable with `package-local-binary-missing`; independent verification is evidence, not native approval.
- PCA-6 corrected the SaleDetailView toast mock. `SaleDetailView.test.ts` now returns `toasts: ref([])` from its Nuxt UI module mock, so `UApp` renders zero toast roots instead of scheduling a bogus reka-ui timeout. Independent verification passed the focused view spec (28/28), full sales (79 files / 1,257 tests) with zero unhandled errors, type-check, exact-file Prettier/ESLint, and diff-check.
- PCA-7 applied the same real-ref contract to the existing Timeline and HistoryCard toast mocks. Focused 21/21 passed; two consecutive full-sales runs each passed 79 files / 1,257 tests with zero unhandled errors. Type-check, ESLint, and diff-check passed; both whole-file Prettier warnings are inherited from HEAD and do not intersect the PCA-7 lines.
- Source work-unit tip before this evidence document: `bc146e8` on `feat/promotion-capacity-alerts`; commits `1d0092c`, `f7d8ef3`, `f0ae1d0`, `84bd265`, and `bc146e8` contain the implementation and verification slices.
- Protected OpenSpec paths remain untracked and byte-identical: `.gentle-ai-instance` SHA-256 `9fa0954a5f13bd6af4c6c635a1bfdccbd7232b6e2b35e573d8d6efa749657ffe`; `verify-report.md` SHA-256 `9f66230d7ea06a5b54816965699097aca89e9043f45378d98b6b85578f6498ab`.
