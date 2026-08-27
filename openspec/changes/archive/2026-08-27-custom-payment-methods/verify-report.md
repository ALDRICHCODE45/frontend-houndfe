```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:57f97e5885d545d72903414eccee3df6d0e0a491d4c074ed3e7e1eb35e1bf5e7
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 30/31
scenarios: 31/31
test_command: pnpm test:unit --run
test_exit_code: 0
test_output_hash: sha256:6f344bf4bd605f2175c9c389b48f5090578ea6ee36e5502fc434a6cec0afd64b
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:055df782f7ec9ddfde69979c779ff544b60be790490b3bb337db4f4a349a4d04
```

# Verify Report — custom-payment-methods (Métodos de cobro)

> Phase: `sdd-verify` · Store: `openspec` · Change id: `custom-payment-methods`
> Branch: `feat/custom-payment-methods` @ `b629a0c`
> Verdict: **PASS (with warnings)**


---

## 0. Verdict

**PASS** — all required gates are green after the type-fix remediation commit
`b629a0c` (`fix(types): resolve vue-tsc build errors in custom-payment-methods`):

- `pnpm test:unit --run` → 321 files / 4843 tests pass.
- `pnpm exec vue-tsc --build` (the REAL type gate — `vue-tsc --noEmit` is a no-op in
  this repo because `tsconfig.json` is solution-style with `"files": []`) → clean, exit 0.
- `pnpm build` (type-check + vite build) → `✓ built in 10.19s`, exit 0.

Warnings (non-blocking):
1. **REQ-PM-007 PARTIAL** — the admin error map covers 3 of 7 mandated domain codes
   (`DUPLICATE_NAME`, `ENTITY_NOT_FOUND`, `NAME_TOO_LONG`). The 4 remaining codes
   (`INVALID_NAME`, `INVALID_CATEGORY`, `INVALID_SUBTITLE`, `SUBTITLE_TOO_LONG`) are
   pre-validated client-side so they cannot reach the wire, but the spec's "map SHALL
   cover at minimum" is not met. Recommend adding the 4 codes to the map as a follow-up.
   This is an unmet SHALL requirement (recorded as PARTIAL in §4.1 and §4.5) and MUST
   be accepted as follow-up debt before archive; it is the one requirement-level gap.

---

## 1. Test Results

| Command | Result | Details |
|---------|--------|---------|
| `pnpm test:unit --run` | ✅ PASS | `Test Files 321 passed (321)` · `Tests 4843 passed (4843)` · exit 0 |

Slice-specific suites (all green):
- `src/features/admin/payment-methods` → 11 files / 148 tests.
- `src/features/POS/sales` → 72 files / 1022 tests.

## 2. Type Check

| Command | Result | Details |
|---------|--------|---------|
| `pnpm exec vue-tsc --build` | ✅ PASS | exit 0. This is the meaningful gate; `--noEmit` checks zero files (solution-style tsconfig). |

## 3. Build

| Command | Result | Details |
|---------|--------|---------|
| `pnpm build` (type-check + vite build) | ✅ PASS | `✓ built in 10.19s`, exit 0 |

The earlier FAIL (14 type errors) was remediated by commit `b629a0c` (12 files,
40 insertions / 21 deletions): non-null assertion in `PaymentModal.vue`, watch-source
fix in `PaymentMethodUpsertSlideover.vue` (watch the `defineModel` ref directly),
`CreatePaymentMethodFormState` type in `usePaymentMethodForm.ts`, `paymentMethodSubtitle?:
string | null` widening in `sale.types.ts`/`paymentMethodMeta.ts`, and 8 test-fixture
typing fixes. All type-only; no runtime behavior changed (4843 tests still pass).

## 4. Requirements Audit

Status legend: **PASS** = implementation + tests satisfy the REQ; **PARTIAL** =
implemented but with a coverage gap; **FAIL** = not met.

### 4.1 admin-payment-methods (`specs/admin-payment-methods/spec.md`)

| REQ | Status | Evidence (file:line) |
|-----|--------|----------------------|
| REQ-PM-001 — list + Activo/Inactivo badges + view toggle + backend order | PASS | `views/AdminPaymentMethodsView.vue:328` (`:label="paymentMethodStatusLabel(row.original.isActive)"`); `composables/usePaymentMethodsTable.ts` (defaultSorting `updatedAt DESC`); `composables/usePaymentMethodViewMode.ts` |
| REQ-PM-002 — create whitelist (no `isActive`/`id`/`tenantId`/…) | PASS | `api/payment-methods.api.ts:40-43` (`ALLOWED_CREATE_KEYS`), `:175-190` (whitelist + `normalizeSubtitle` omit) |
| REQ-PM-003 — partial PATCH + `isActive` reversal | PASS | `api/payment-methods.api.ts:40` (`ALLOWED_UPDATE_KEYS` incl. `isActive`), `:203-222` (update forwards `isActive`, never `tenantId`); `interfaces/payment-method.types.ts` (`UpdatePaymentMethodSchema.isActive` optional) |
| REQ-PM-004 — logical delete + confirm + idempotency | PASS | `views/AdminPaymentMethodsView.vue:157-166` (delete mutation), `:263` (`<ConfirmModal>`); `api/payment-methods.api.ts:226-229` (`remove` → `http.delete`) |
| REQ-PM-005 — kebab actions reflect CASL | PASS | `utils/payment-method-actions.utils.ts` (`buildPaymentMethodRowActions`); `views/AdminPaymentMethodsView.vue:89-91` (`canCreate/Update/Delete` computed) |
| REQ-PM-006 — CASL registration + route/nav/control gating | PASS | `auth/interfaces/auth.types.ts:78`; `auth/authorization/ability.ts:33`; `admin/roles/i18n/permissions.ts:65,596`; `app/router/index.ts:306-311` (`permission: ['read','PaymentMethod']`); `app/navigation/navigation.registry.ts:57` |
| REQ-PM-007 — domain error map (reads `error`, min 7 codes) | **PARTIAL** | `interfaces/errors.ts:28-37` — `PAYMENT_METHOD_ERROR_MAP` covers only 3 of 7 required codes (`DUPLICATE_NAME`, `ENTITY_NOT_FOUND`, `NAME_TOO_LONG`). `INVALID_NAME`, `INVALID_CATEGORY`, `INVALID_SUBTITLE`, `SUBTITLE_TOO_LONG` are absent (pre-validated client-side, but the spec's minimum is not met). Extractor reads `error.response.data.error` only: `errors.ts:49` |
| REQ-PM-008 — category selector = 4 values, no `credit` | PASS | `core/shared/constants/payment-method-category.ts:33-37` (`PAYMENT_METHOD_CATEGORY_VALUES` = cash/card_credit/card_debit/transfer); `components/PaymentMethodUpsertSlideover.vue` (category options from shared enum) |
| REQ-PM-009 — subtitle optional + trim/omit whitespace | PASS | `api/payment-methods.api.ts:179-190` (create), `:212-222` (update) — `normalizeSubtitle` deletes empty; `interfaces/payment-method.types.ts` (`SubtitleFieldSchema` ≤120, optional) |
| REQ-PM-010 — list invalidation, no POS cross-invalidation | PASS | `views/AdminPaymentMethodsView.vue:132` (`invalidateQueries({ queryKey: adminPaymentMethodQueryKeys.list(tenantId.value) })` on each mutation); no `saleQueryKeys.paymentMethods` invalidation present |
| REQ-PM-011 — empty/loading/error states | PASS | `views/AdminPaymentMethodsView.vue` (`AppDataTable` loading/`empty="No hay métodos de cobro"`/error block); `components/PaymentMethodCardGrid.vue` (8-skeleton) |

### 4.2 pos-payment-method-tiles (`specs/pos-payment-method-tiles/spec.md`)

| REQ | Status | Evidence (file:line) |
|-----|--------|----------------------|
| REQ-PT-001 — tile identity, fixed-vs-custom never collide | PASS | `utils/paymentMethodTile.utils.ts:98-107` (`paymentMethodTileKey`/`paymentEntryKey` = `paymentMethodId ?? method`), `:134-138` (`entryMatchesTile` fixed branch requires `paymentMethodId === undefined`) |
| REQ-PT-002 — `PaymentEntry`/`LegacyChargePayload` thread `paymentMethodId` | PASS | `interfaces/sale.types.ts:278` (`PaymentEntry.paymentMethodId?`), `:268` (`LegacyChargePayload.paymentMethodId?`); `utils/paymentEntries.utils.ts:23-34` (`createEntry` threads id only when provided) |
| REQ-PT-003 — projection fetch, `read:Sale`, staleTime 5m, no focus refetch | PASS | `composables/useSalePaymentMethods.ts:30-47` (`useQuery`, `staleTime: 5*60_000`, `refetchOnWindowFocus: false`, queryKey `saleQueryKeys.paymentMethods(tenantId)`); `api/sale.api.ts:316` (`getPaymentMethods()` → `GET /sales/payment-methods`, no query params) |
| REQ-PT-004 — grid merges fixed + custom | PASS | `components/PaymentModal.vue:83` (`buildMergedMethodOptions(projection.value ?? [])`); `components/DebtPaymentModal.vue:61` |
| REQ-PT-005 — empty projection → fixed-only, no warning | PASS | `components/PaymentModal.vue:83` (`?? []`); no warning/banner branch in grid (design §7.3); covered by `PaymentModal.test.ts` |
| REQ-PT-006 — projection error → degrade silently | PASS | `useSalePaymentMethods` returns `isError`/`error` but modals render fixed tiles from `?? []`; no toast/blocking error wired |
| REQ-PT-007 — subtitle grey sub-line (trimmed) | PASS | `components/PaymentModal.vue:425-431`; `components/DebtPaymentModal.vue:287-293` (`v-if="option.kind === 'custom' && (option.subtitle?.trim() ?? '') !== ''"`) |
| REQ-PT-008 — POS not gated by `read:PaymentMethod` | PASS | `composables/useSalePaymentMethods.ts:15-25` (no CASL branch; `read:Sale` implicit); admin gating unchanged (`router/index.ts:311`) |

### 4.3 sales (`specs/sales/spec.md`)

| REQ | Status | Evidence (file:line) |
|-----|--------|----------------------|
| REQ-CAT-001 — `PaymentEntry` accepts `paymentMethodId?` | PASS | `interfaces/sale.types.ts:272-278`; `utils/paymentEntries.utils.ts:23-34` |
| REQ-CAT-002 — `LegacyChargePayload` accepts `paymentMethodId?` | PASS | `interfaces/sale.types.ts:259-268`; `components/PaymentModal.vue:283-290` (single-entry flatten forwards id) |
| REQ-CAT-003 — `SaleDetailPayment` 3 optional fields | PASS | `interfaces/sale.types.ts:146-148` |
| REQ-CAT-004 — `PAYMENT_RECEIVED` 3 optional fields | PASS | `interfaces/sale.types.ts:168-170` |
| REQ-CAT-005 — display label prefers `paymentMethodName` | PASS | `utils/paymentMethodMeta.ts:62-68` (`paymentMethodDisplayLabel` = `paymentMethodName ?? baseLabel`); `components/PaymentsListSection.vue:48-49`; `components/SaleDetailTimeline.vue:51-54` |
| REQ-CAT-006 — subtitle grey sub-line (trimmed, null-safe) | PASS | `utils/paymentMethodMeta.ts:50-58` (`paymentMethodSubtitleText` trims, null/undefined → null); `components/PaymentsListSection.vue:51-56`; `components/SaleDetailTimeline.vue:57-61` |
| REQ-CAT-007 — `PAYMENT_METHOD_CATEGORY_MISMATCH` clears silently | PASS | `utils/paymentMethodChargeErrors.utils.ts:35-37` (map, no toast); `views/SalesView.vue:451-454`; `composables/useDebtPayment.ts:81`; modal watchers `PaymentModal.vue:346-350`, `DebtPaymentModal.vue:204-217` |
| REQ-CAT-008 — `PAYMENT_METHOD_NOT_FOUND` clear+refetch+toast | PASS | `utils/paymentMethodChargeErrors.utils.ts:38-40, 106-120` (`applyCatalogChargeErrorAction` invalidates `saleQueryKeys.paymentMethods`) |
| REQ-CAT-009 — `INACTIVE_PAYMENT_METHOD` clear+refetch+toast | PASS | same map (`paymentMethodChargeErrors.utils.ts`) |
| REQ-CAT-010 — `INVALID_PAYMENT_METHOD_ID` defensive toast only | PASS | `utils/paymentMethodChargeErrors.utils.ts` (action `{clear:false, refetch:false, toast}`); UUID guard `paymentMethodTile.utils.ts:117` + `buildMergedMethodOptions` drops non-UUID |
| REQ-CAT-011 — catalog dispatch short-circuits before legacy | PASS | `views/SalesView.vue:451-454`; `composables/useDebtPayment.ts:81` (`applyCatalogChargeErrorAction(...).handled` → return before legacy) |

### 4.4 payment-details (`specs/payment-details/spec.md`)

| REQ | Status | Evidence (file:line) |
|-----|--------|----------------------|
| REQ-PD-NOTE-001 — `isActive` reversal MUST NOT be generalized to `PaymentMethod` | PASS | `api/payment-methods.api.ts:40` (`ALLOWED_UPDATE_KEYS` includes `isActive`), `:203-222` (forwards `isActive`, never `tenantId`); `filterAllowedKeys` from `payment-details.api.ts` is NOT reused (re-implemented as `ALLOWED_CREATE_KEYS`/`ALLOWED_UPDATE_KEYS`); pin tests in `payment-methods.api.spec.ts` |

### Requirements Audit Summary

- PASS: 30 of 31 requirements (REQ-PM ×10 of 11, REQ-PT ×8, REQ-CAT ×11, REQ-PD-NOTE ×1)
- PARTIAL: 1 (REQ-PM-007 — error map covers 3 of 7 mandated codes; unmet SHALL)
- FAIL: 0 (no requirement is entirely unimplemented; the single PARTIAL is an
  accepted-as-follow-up spec-coverage gap, not a functional failure)

---

## 5. Native Review Integration (receipt-driven, RDD global ON)

Every medium-risk executable candidate went through a native ordinary review before
its commit. The receipt-driven cycle (consent granted per candidate) ran:
`start` → `lens-context` (provider_command delivery) → `review-reliability` lens over
the frozen candidate → `capture-result` (admitted) → `finalize --captured-results` →
`capture-evidence` (real test output, outcome passed) → `finalize --captured-evidence`
(approved) → `validate --gate pre-commit` (allow) → commit.

| Commit | Slice | Review lineage | Verdict |
|--------|-------|----------------|---------|
| `41117bc` | S4B modal integrations | `review-2583aa39475891a3` | approved (6 advisory) |
| `de85c10` | S5A charge error dispatch | `review-836102eef63a5494` | approved (4 advisory) |
| `fb5acf4` | S5B sale detail/timeline | `review-5bcdb35c10a7662c` | approved (3 advisory) |
| `b629a0c` | type-fix remediation | `review-2060ef7c24a1fb88` | approved (CRITICAL R3-001 refuted by refuter; 2 advisory) |

Advisory findings are informational only (none opened a correction, none reopen the
reviews). Notable: the type-fix review's single CRITICAL (watch-source reactivity in
`PaymentMethodUpsertSlideover.vue`) was **refuted** by the refuter role — `open` is a
`defineModel` ref, so the bare-identifier watch is reactive and correct.

## 6. Task Checkbox Verification

All implementation slices (S1–S5B) are complete and committed. The three
`sdd-owner: parent` lifecycle-gate checkboxes in `tasks.md` are now satisfied:

1. "Run bounded review on every sub-slice's diff" → satisfied: 4 native reviews
   (S4B/S5A/S5B/type-fix) ran with approved receipts (see §5).
2. "Record final verdict (size:exception vs chained PRs)" → resolved: user chose
   **chained PRs (stacked-to-main)** on the Review Workload Guard; per-slice commits
   on `feat/custom-payment-methods`.
3. "Move the change to archive once verify-report carries PASS" → pending in the
   `sdd-archive` phase (this report now carries PASS).

## 7. Risks observed (advisory, from native reviews)

- **S4B (review-2583aa39475891a3):** closed-modal `catalogClearSignal` drops; the
  end-to-end composable→modal→filter chain is only piecewise tested; debt-flow
  idempotency-key regeneration unasserted; `SalesView` suite lacks a
  `useSalePaymentMethods` mock guard.
- **S5A (review-836102eef63a5494):** same closed-modal drop; `invalidateQueries` is
  fire-and-forget (`void`); composable failure-path branches (no `error.response`,
  post-error modal state) unproved.
- **S5B (review-5bcdb35c10a7662c):** empty/whitespace `paymentMethodName` falls back
  to blank label (should fall back to base label); timeline label preference is not
  type-guarded to `PAYMENT_RECEIVED`; `paymentId`-keyed display Map collapses
  duplicate ids.
- All are non-blocking per the approved receipts; recommended as separate follow-up
  work, not reasons to re-run review.

## 8. Structured Status

Native engine (`gentle-ai sdd-status custom-payment-methods`): `artifactStore:
openspec` · `apply: ready` · `verify: ready` (this report) · `archive: blocked until
verify PASS + parent reconciliation` · `nextRecommended: archive`.

## 9. Final

The change is **verified PASS with warnings**. Archive is now eligible once the
parent records the single requirement-level gap (REQ-PM-007 map coverage) as
accepted follow-up debt. The strict-TDD evidence gap referenced in an earlier draft
is closed: `apply-progress.md` now carries the full `TDD Cycle Evidence` table
(§slice status, per-slice RED/GREEN/TRIANGULATE/REFACTOR).
