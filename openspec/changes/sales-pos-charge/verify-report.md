```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:0b04f8ea249c69fd4fd48f0bd3cd3337f22d17b601089782b7b1f75bfb1e8439
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 16/16
scenarios: 19/19
test_command: pnpm test:unit --run
test_exit_code: 0
test_output_hash: sha256:726ff58b653f97395c984028496b390193cf006dda6fbfab9469ad010282d963
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:f389dbca9f4800370e65e5579091b38abbe49aeb39365c1446922e7c8191e2d3
```

## Verification Report

**Change**: sales-pos-charge
**Version**: N/A (delta spec)
**Mode**: Strict TDD (runner: `pnpm test:unit` = vitest 4.1.0, jsdom; authoritative: `pnpm build`)
**Branch**: `feat/sales-pos-charge` (5 commits) → `main`
**HEAD**: `fa62b450e6a1dd916597eba7bf08c08f730acc74`

### Completeness

| Metric | Value |
|--------|-------|
| Requirements total (spec) | 16 (15 ADDED + 1 MODIFIED REQ-19) |
| Scenarios total (spec) | 19 |
| Work units | 5 (WU-A..WU-E) |
| Tasks complete | 5/5 (all WUs committed; apply-progress engram #3562 reports COMPLETE) |
| Tasks incomplete | 0 |

### Build & Tests Execution

**Build**: ✅ Passed (authoritative — `vue-tsc --build` + `vite build`)
```text
pnpm build  → exit 0
✓ built in 15.05s (chunk-size warning only, non-blocking)
```

**Tests**: ✅ 4352 passed / ❌ 0 failed / ⚠️ 0 skipped
```text
pnpm test:unit --run  → exit 0
Test Files  292 passed (292)
      Tests  4352 passed (4352)
```

**Type-check**: ✅ clean (`vue-tsc --build`, exit 0)

**Lint**: ⚠️ 291 `x eslint` errors (baseline pre-WU-A 293; WU-E dropped 2 → 291 ≤ 293 as expected)

**Coverage**: ➖ Not available (no coverage tool configured in `package.json` scripts)

### Spec Compliance Matrix

| Requirement | Scenario(s) | Code evidence | Test evidence | Verdict |
|-------------|-------------|---------------|---------------|---------|
| REQ-NEW-1 | PATCH fires w/ body, no Idempotency-Key; null persists | `sale.api.ts:296-310` (PATCH `:302-305`, no key header) | `sale.api.test.ts:1299-1309,1311-1320` | PASS |
| REQ-NEW-2 | success → invalidate detail; 404 → toast + re-fetch | `useUpdatePaymentReference.ts:63-68,72-81` | `useUpdatePaymentReference.test.ts:76-86,146-162` | PASS |
| REQ-NEW-3 | 3 payments → 3 rows | `PaymentsListSection.vue:106-156`; mounted `SaleDetailView.vue:430-435` | `PaymentsListSection.spec.ts:42-57` | PASS |
| REQ-NEW-4 | non-CASH → edit visible; CASH → hidden | `referenceEditAffordance.ts:19-22`; `PaymentsListSection.vue:143-153` | `referenceEditAffordance.spec.ts:18-42`; `PaymentsListSection.spec.ts:59-77` | WARN |
| REQ-NEW-5 | clear → PATCH `reference:null` | `EditReferenceSlideover.vue:49-57` | `EditReferenceSlideover.spec.ts:102-118` | PASS |
| REQ-NEW-6 | omitting `paymentId` = type error | `sale.types.ts:141` | `sale.types.test.ts:312-339` | PASS |
| REQ-NEW-7 | 403 toast; network backoff retry | `useUpdatePaymentReference.ts:59-62,83-90,95-99` | `useUpdatePaymentReference.test.ts:105-124,126-144` | PASS |
| REQ-NEW-8 | count>0 → badge; count=0 → no badge, tab selectable | `salesListTabs.utils.ts:19-24`; `SalesListTabs.vue:54-60` | `salesListTabs.utils.spec.ts:5-23`; `SalesListTabs.test.ts:23-37` | PASS |
| REQ-NEW-9 | non-CASH no ref → omit key, 200 OK | `PaymentModal.vue:194-215,114-140` | `PaymentModal.test.ts:253-275` | PASS |
| REQ-NEW-10 | non-CASH debt no ref → omit key, 200 OK | `paymentEntries.utils.ts:58-70`; `DebtPaymentModal.vue:125-141` | `DebtPaymentModal.test.ts:175-198`; `paymentEntries.utils.spec.ts:100-123` | PASS |
| REQ-NEW-11 | `REFERENCE_REQUIRED` not enumerated | `sale.types.ts:328-346` | `sale.types.test.ts:125-129` (`@ts-expect-error`) | PASS |
| REQ-NEW-12 | `PAYMENT_AMOUNT_INSUFFICIENT` action text | `sale.types.ts:332`; `salePaymentErrors.utils.ts:23-26` | `salePaymentErrors.utils.test.ts:5-12` | PASS |
| REQ-NEW-13 | `SALE_FULLY_PAID` (not `SALE_ALREADY_PAID`) | `sale.types.ts:429-433`; `useSaleDueDate.ts:15-20`; `DueDateEditModal.vue:68-69` | `useSaleDueDate.test.ts:94-105` | PASS |
| REQ-NEW-14 | `SELLER_NOT_ASSIGNABLE` not enumerated | `sale.types.ts:412-415`; `useSellerAssignment.ts:15-19`; `AssignSellerSlideover.vue:66-77` | `useSellerAssignment.test.ts:103-114` | PASS |
| REQ-NEW-15 | dead code deleted, zero live imports | git diff stat (9 files deleted); grep verify | `pnpm build` exit 0 (no broken imports) | PASS |
| REQ-19 (MOD) | 3 tabs + invariants preserved | `SalesListTabs.vue` (3 tabs); `SalesListView.vue` (SaleCard/PaymentMethodPills/salesFiltersSchema/cell slots) | `SalesListTabs.test.ts:89-105`; `SalesListView.test.ts:775-845` | PASS |

**Compliance summary**: 19/19 scenarios covered; 15/16 requirements PASS, 1 WARN.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| REQ-NEW-1 | ✅ Implemented | `updatePaymentReference` PATCHes `/sales/:saleId/payments/:paymentId/reference` with `{reference}` and no `Idempotency-Key` |
| REQ-NEW-2 | ✅ Implemented | `useUpdatePaymentReference` invalidates `saleQueryKeys.detail` on success; 404 → toast + re-invalidate |
| REQ-NEW-3 | ✅ Implemented | one `<li>` per `payments[]` entry; empty state + skeleton |
| REQ-NEW-4 | ⚠️ Narrowed | `shouldShowEditReference` uses whitelist `{CARD_DEBIT, CARD_CREDIT, TRANSFER}` instead of spec's `method !== 'CASH'` (excludes `CREDIT`) |
| REQ-NEW-5 | ✅ Implemented | slideover normalizes empty → `null` before emit |
| REQ-NEW-6 | ✅ Implemented | `paymentId: string` required on `SaleDetailPayment` |
| REQ-NEW-7 | ✅ Implemented | 404/403 typed toasts; network retry via TanStack default exponential backoff |
| REQ-NEW-8 | ✅ Implemented | badge rendered iff `count > 0`; tab selectable at 0 |
| REQ-NEW-9 | ✅ Implemented | `PaymentModal.validate()` has no reference gate; `normalizeEntries` omits empty ref |
| REQ-NEW-10 | ✅ Implemented | `validateEntry` has no reference gate; `handleSubmit` omits empty ref |
| REQ-NEW-11 | ✅ Implemented | `REFERENCE_REQUIRED` removed from `ChargeDomainErrorCode` |
| REQ-NEW-12 | ✅ Implemented | `PAYMENT_AMOUNT_INSUFFICIENT` in union + `ERROR_ACTIONS` with exact copy |
| REQ-NEW-13 | ✅ Implemented | `SALE_FULLY_PAID` rename propagated to type, composable, modal |
| REQ-NEW-14 | ✅ Implemented | `SELLER_NOT_ASSIGNABLE` removed from type, composable, slideover switch |
| REQ-NEW-15 | ✅ Implemented | 9 files deleted, zero live imports (only a stale code comment remains) |
| REQ-19 | ✅ Implemented | "Pagos Pendientes" additive slot; existing tabs/cards/schema/cell slots unchanged |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 — error home in `sale.api.ts` | ✅ Yes | `ReferenceUpdateError` + `parseReferenceUpdateError` beside `SalePdfError`/`parseCommentError` |
| D2 — PATCH, no Idempotency-Key | ✅ Yes | `sale.api.ts:302-305` |
| D3 — `retry: 3`, skip ReferenceUpdateError | ✅ Yes | `useUpdatePaymentReference.ts:59-62` |
| D4 — local tab state, `urlSync: false` | ✅ Yes | `useConfirmedSales.ts:172` |
| D5 — emit widened | ⚠️ Partial | `paymentStatus` typed as `string` (tasks D.1 CSV), not `SalePaymentStatus[]` (design D5 literal) |
| D6 — slideover extraction | ✅ Yes | `EditReferenceSlideover.vue` owns composable; list section presentational |
| D7 — mount in `#pagos` | ✅ Yes | `SaleDetailView.vue:430-435` (after `SaleDetailTotalsCard`) |
| D8 — `normalizeReferenceInput` | ⚠️ Deviation | impl returns `undefined` for empty (matches tasks B.6), not `null` (design D8 literal); wire semantics correct |
| D9 — 404 handling | ✅ Yes | invalidate detail = re-fetch + "Pago no encontrado" toast |

### Issues Found

**CRITICAL**: None

**WARNING**:
1. **REQ-NEW-4** — `shouldShowEditReference` (`referenceEditAffordance.ts:19-22`) narrows the spec rule `method !== 'CASH'` to a three-method whitelist (`CARD_DEBIT`, `CARD_CREDIT`, `TRANSFER`), excluding `CREDIT`. Design B.6 also specified `payment.method !== 'CASH'`. The code comment + test (`referenceEditAffordance.spec.ts:35-37`) justify the narrowing ("credit sales have no reference"), but the divergence was never reconciled into the spec/design artifacts. Defensible in the domain (a `CREDIT`-status sale has no per-payment reference), but it is a spec-vs-implementation gap that the archive phase should either record or the spec should be updated to say `method ∈ {CARD_DEBIT, CARD_CREDIT, TRANSFER}`.
2. **TDD Cycle Evidence table absent** — the `apply-progress` summary (engram #3562) reports verification gates + TDD notes but does not include the formal RED/GREEN/TRIANGULATE/SAFETY-NET/REFACTOR table required by strict-tdd-verify. Direct inspection confirms every test file exists and passes at runtime, so this is a reporting gap, not a code gap (flagged WARNING, not CRITICAL, given the recovery-from-cancellation context documented in #3562).

**SUGGESTION**:
1. `SaleDetailView.vue:432` passes `:loading="referencePending"` to `PaymentsListSection` instead of `:loading="isLoading"` (tasks B.7 literal). Effect: the list flips to skeleton rows during an in-flight reference edit. Initial-load flash is still prevented by the outer `v-else` guard.
2. Reference truncation is hardcoded to 20 chars (`PaymentsListSection.vue:66`) vs design.md "truncated 24ch"; tasks B.4 says ">20", so tasks wins and design.md is stale.
3. Stale code comment at `SaleDetailView.vue:78` still references the deleted `SaleDetailHeader` component.
4. `normalizeReferenceInput` signature returns `string | null | undefined` (three-state) rather than design D8's `string | null` (two-state) — the `undefined` arm is the modal "omit the key" signal. Internally consistent, but design D8 ("undefined return dropped") is out of date.

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ⚠️ | apply-progress summary has gates + notes, no formal RED/GREEN table |
| All tasks have tests | ✅ | 13 test files created/updated across WU-A..WU-D |
| RED confirmed (tests exist) | ✅ | all listed test files present on disk |
| GREEN confirmed (tests pass) | ✅ | 4352/4352 pass at runtime |
| Triangulation adequate | ✅ | multi-case per behavior (e.g. `normalizeReferenceInput` 5 cases; badge 5 cases) |
| Safety Net for modified files | ⚠️ | existing suites (useSaleDueDate/useSellerAssignment) updated, not re-run-before-edit evidence in summary |

**TDD Compliance**: 4/6 checks passed, 2 partial

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (pure fns) | ~35 | referenceEditAffordance.spec.ts, salesListTabs.utils.spec.ts, paymentEntries.utils.spec.ts, salePaymentErrors.utils.test.ts, sale.types.test.ts | vitest |
| Unit (composables) | ~25 | useUpdatePaymentReference.test.ts, useSaleDueDate.test.ts, useSellerAssignment.test.ts, useConfirmedSales.test.ts | vitest + VueQueryPlugin |
| Unit (API, mocked http) | ~5 | sale.api.test.ts | vitest (vi.mock http) |
| Component (mount) | ~60 | PaymentsListSection.spec.ts, EditReferenceSlideover.spec.ts, PaymentModal.test.ts, DebtPaymentModal.test.ts, AssignSellerSlideover.spec.ts, SalesListTabs.test.ts, SaleDetailView.test.ts, SalesListView.test.ts | vitest + mountWithUApp / @vue/test-utils |
| E2E | 0 | — | not installed |
| **Total (change-relevant)** | **~125** | **17 files** | |

### Assertion Quality

✅ All assertions verify real behavior. `for…of` loops over error-code arrays (`useSaleDueDate.test.ts:98`, `useSellerAssignment.test.ts:107`) iterate hardcoded non-empty arrays with per-iteration `mockRejectedValueOnce` + `await expect().rejects`, so they are not ghost loops. `@ts-expect-error` directives (`sale.types.test.ts:125-128,327,379`) are compile-time assertions that fail the build if the type is ever re-widened.

### Quality Metrics

**Linter**: ⚠️ 291 `x eslint` errors (pre-existing baseline; WU-E reduced 293 → 291)
**Type Checker**: ✅ No errors

### Verdict

**PASS WITH WARNINGS** — 15/16 requirements PASS, 1 WARN (REQ-NEW-4 method narrowing). All 19 spec scenarios have implementation + passing runtime tests. Build, type-check, and full test suite are green. No blocking findings.
