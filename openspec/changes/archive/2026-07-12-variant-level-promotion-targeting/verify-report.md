```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:c4f63bff688375efbf25f39cfca8917fcf32a80bcd21593259b278a16ac46025
verdict: pass
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 9/9
test_command: CI=true pnpm test:unit run
test_exit_code: 1
test_output_hash: sha256:efc3855cb56a1833751dd6cd1b9f801e83eeb56840c3262d83952850d5d5d2db
test_baseline_failures: 18
test_new_failures: 0
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:807cc91575892298df89707fbd1d424a823b274e19fb31ebee36ad2227e12b2b
```

## Verification Report

**Change**: variant-level-promotion-targeting
**Version**: promotions spec — 7 requirements, 8 `#### Scenario` blocks (REQ-1's block bundles 2 independently-tested behaviors → 9 behavioral checks)
**Mode**: Strict TDD
**Branch**: `feat/variant-level-promotion-targeting` (base `main` @ `0fcf90a`; 7 commits `75b2070`…`006bce3`)

> **Note on `test_exit_code: 1`**: the FULL suite exits non-zero solely because of **18 pre-existing baseline failures** (documented in the launch brief and reproduced verbatim below). **Zero** of those 18 live in this change's diff. The authoritative gate for this slice is `pnpm build` (exit 0) plus "no new test failures vs baseline" — both satisfied. Per the orchestrator's baseline contract, the 18 pre-existing failures are NOT counted against this change.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 26 (7 phases) |
| Tasks complete | 25 |
| Tasks incomplete | 1 — Phase 7.4 (optional manual smoke, explicitly deferred: no stub backend) |

All build/behavior-coupled tasks are complete. The single unchecked item (7.4) is an *optional* manual smoke test the plan itself marked deferred — it is not a core implementation task, so it is a WARNING, not a blocker.

### Build & Tests Execution

**Build**: ✅ Passed (exit 0)
```text
$ pnpm build   # run-p type-check ("vue-tsc --build" full project references) + build-only ("vite build")
> vue-tsc --build      → no TypeScript errors
> vite build           → ✓ built in 9.20s
(only a pre-existing project-wide chunk-size warning on index-*.js — not an error, unrelated to this change)
```

**Tests**: ✅ 2388 passed / ❌ 18 failed (baseline) / 2406 total
```text
$ CI=true pnpm test:unit run
Test Files  5 failed | 191 passed (196)
     Tests  18 failed | 2388 passed (2406)
```
The 18 failures (all PRE-EXISTING baseline, none in this change's 10 diffed files):
- `auth/stores/useAuthStore.spec.ts` — 2 (switchTenant 403 recoverable handling)
- `POS/promotions/composables/usePromotionColumns.test.ts` — 2 (status tone: `'active'`≠`'success'`, `'pending'`≠`'info'`) — file NOT modified by this change
- `POS/sales/components/DebtPaymentModal.test.ts` — 9
- `POS/sales/components/SaleDetailMetadataCard.spec.ts` — 1 (relative date "Hoy a las")
- `POS/sales/composables/useDebtPayment.test.ts` — 4

Matches apply-progress exactly (2388/18). **New failures introduced by this slice: 0.** The 4 new/extended test files for this change all pass: `usePromotionForm.test.ts`, `ProductVariantSelector.test.ts`, `PromotionTargetItemsSection.test.ts`, `usePromotionTargetNames.test.ts`.

**Coverage**: ➖ Not run (no coverage tool wired into `test:unit`; informational only, non-blocking).

### Spec Compliance Matrix
| Requirement | Scenario / Behavior | Test | Result |
|-------------|--------------------|------|--------|
| REQ-1a | VARIANTS listed for PRODUCT_DISCOUNT | `usePromotionForm.test.ts > TARGET_TYPE_OPTIONS > contains VARIANTS with label "Variantes"` + `PromotionTargetItemsSection.test.ts > renders VARIANTS option when allowVariants is true (PRODUCT_DISCOUNT)` | ✅ COMPLIANT |
| REQ-1b | VARIANTS removed under BUY_X_GET_Y / ADVANCED | `PromotionTargetItemsSection.test.ts > does NOT render VARIANTS when allowVariants omitted` + `…explicitly false` (radio-option render inspection) | ✅ COMPLIANT |
| REQ-2 | Selecting VARIANTS clears `targetItems` | `PromotionTargetItemsSection.test.ts > switching from VARIANTS clears items (REQ-2)` (handler `onTargetTypeChange` emits `[]` for any switch — direction-agnostic) | ✅ COMPLIANT |
| REQ-3 | Two-step product→variant; hasVariants filter; add one variant | `ProductVariantSelector.test.ts > filters product list to hasVariants===true` + `> add: emits update:selectedItems with extended entry shape` + `> loading variants triggers getVariants(productId)` | ✅ COMPLIANT |
| REQ-3 | Multi-variant across products | `ProductVariantSelector.test.ts > multi-variant across two products: second pick preserves the first` | ✅ COMPLIANT |
| REQ-4 | Payload `[{targetType:'VARIANTS',targetId}]`, no side/id/productId | `usePromotionForm.test.ts > VARIANTS payload shape` (asserts exact shape + `JSON.stringify` excludes productId/productName/"side"/"Talle M") | ✅ COMPLIANT |
| REQ-5 | Resolvable name shows; unresolvable unchanged; never throws | `usePromotionTargetNames.test.ts` — 7 VARIANTS cases (resolves, batches per product, no-productId unchanged, mixed, throws→unchanged, id-not-in-list unchanged, idempotent) | ✅ COMPLIANT |
| REQ-6 | 400 INVALID_TARGET → Spanish message, form editable | `usePromotionForm.test.ts > maps INVALID_TARGET to field-level error on targetItems with Spanish message (REQ-6)` | ✅ COMPLIANT |
| REQ-7 | No POS-side promo calc; POS renders backend fields only | `git diff main --name-only` → 0 files under `src/features/POS/sales/`; no discount/precedence math added (invariant verified by scope) | ✅ COMPLIANT |

**Compliance summary**: 9/9 behavioral scenarios compliant (covering test passed at runtime for all 8 that require one; REQ-7 verified as a scope invariant).

### Correctness (Static + Runtime Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| REQ-1 union + options | ✅ Implemented | `promotion.types.ts:11` adds `'VARIANTS'`; `usePromotionForm.ts:57` adds `{label:'Variantes',value:'VARIANTS'}`; scoped per-instance via `allowVariants` |
| REQ-1 scope fix (`006bce3`) | ✅ Verified | `PromotionForm.vue:323` `:allow-variants="true"` ONLY on PRODUCT_DISCOUNT; BUY_X_GET_Y (L426), ADVANCED buy (L450) & get (L484) omit it → default `false`; `Section.vue:97-99` filters VARIANTS out unless opted in |
| REQ-4 payload | ✅ Implemented | `toCreatePayload` L169-172 maps only `{targetType, targetId}`; runtime JSON invariant test confirms no leak |
| REQ-5 resolver | ✅ Implemented | `resolveVariants` L245-301: groups by productId, fetches `getVariants` once/product (Set dedup), entries w/o productId returned unchanged, wrapped in try/catch + per-product catch → never throws |
| REQ-6 error map | ✅ Implemented | `mapApiErrorToFields` L364-374: exact Spanish message, `path:'targetItems'`, `toastMessage:null` (field-level → form stays editable) |
| Entry shape (Q(a)) | ✅ Implemented | optional `productId?`/`productName?` L154-156, session-only, stripped from payload |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Q(a) extend entry with optional productId/productName | ✅ Yes | never reaches payload (REQ-4 test proves) |
| Q(b) resolvable-only, honest fallback to identifier | ✅ Yes | no `getVariantById` invented; entries w/o productId returned unchanged |
| Q(c) extract `ProductVariantSelector.vue` child | ✅ Yes | focused 219-line child, parent forwards emit unchanged |
| Locked #1 client-side `hasVariants` filter | ✅ Yes | `filteredProducts` L44 filters `p.hasVariants === true` |
| Locked #2 query key `['promotions','variants-by-product',id]` + staleTime 60_000 | ✅ Yes | selector L53/L60 and resolver L271/L275 both consistent |
| Locked #3 INVALID_TARGET via `mapApiErrorToFields` → `targetItems` field error | ✅ Yes | mirrors DUPLICATE_TARGET branch |
| Open question: error reaches `mapApiErrorToFields` as `response.data.error` | ✅ Confirmed | apply VERIFY-DURING-APPLY on `PromotionDetailView.vue:120` |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Present in apply-progress "TDD Cycle Evidence" table |
| All tasks have tests | ✅ | 6 apply tasks + scoped fix (`006bce3`) all have covering test files |
| RED confirmed (tests exist) | ✅ | 4 test files verified present in codebase |
| GREEN confirmed (tests pass) | ✅ | All new tests pass on independent execution (scoped run: 303 passed, only baseline usePromotionColumns tone ×2 failing) |
| Triangulation adequate | ✅ | ProductVariantSelector 8 cases, resolver 7 cases, section 5+3 cases, payload 1 (+JSON invariant) |
| Safety net for modified files | ✅ | modified files (`usePromotionForm`, `Section`) kept their full pre-existing suites green |

**TDD Compliance**: 6/6 checks passed.

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit / Component (jsdom + @vue/test-utils + mountWithUApp) | ~30 new across VARIANTS behavior | 4 | vitest 4, jsdom |
| Integration | 0 | — | not installed |
| E2E | 0 | — | not installed |

All coverage is unit/component-level, consistent with the project's harness. No integration/E2E tooling is configured (not a failure).

### Assertion Quality
Scanned all 4 new/modified test files for trivial assertions (tautologies, ghost loops, empty-collection-only, type-only, smoke-only, mock-heavy).
- No `expect(true).toBe(true)` / tautologies.
- No ghost loops (chip-label assertions run against non-empty rendered arrays).
- Every assertion exercises production code (emitted payloads, rendered radio `value` attrs, resolver return arrays, error-map output).
- REQ-4 uses a hard `JSON.stringify` negative invariant — excellent.

**Assertion quality**: ✅ All assertions verify real behavior.

### Issues Found

**CRITICAL**: None.

**WARNING**:
1. **Full suite is not absolutely green** — `pnpm test:unit` exits 1 due to 18 pre-existing baseline failures (auth switchTenant ×2, usePromotionColumns tone ×2, DebtPaymentModal ×9, SaleDetailMetadataCard ×1, useDebtPayment ×4). None are attributable to this change, but reviewers should be aware the suite is red at the repo level.
2. **Edit-mode UUID fallback** — a VARIANTS promo loaded fresh from the backend has no session `productId`, so `resolveVariants` cannot hydrate names and chips render the raw variant UUID. This is the *intentional* "honest fallback" from design Q(b) (no `getVariantById` endpoint exists), but it WILL surprise a merchant editing an existing variant promo.
3. **Client-side product search over first 20 rows** — `ProductVariantSelector` fetches `pageSize: 20` with no server `globalFilter` and filters client-side. Merchants with >20 variant-bearing products cannot reach all of them via the search box. Diverges from the sibling PRODUCTS branch (which passes `globalFilter` server-side). Not a spec violation (REQ-3 only requires the `hasVariants` filter), but a real scale limitation worth a follow-up.

**SUGGESTION**:
1. REQ-2's test asserts the symmetric direction (VARIANTS→PRODUCTS clears) rather than the spec's literal direction (BRANDS→VARIANTS clears). The handler is direction-agnostic so behavior is covered; an exact-direction test would match the scenario verbatim.
2. REQ-6 "form remains editable" is structurally guaranteed (field-level error via UForm `:errors`, not a blocking toast/state) but not directly asserted — an integration test rendering the form post-error would close the loop.
3. Run the deferred Phase 7.4 manual smoke against a real/stub backend before release (create + edit a PRODUCT_DISCOUNT with `appliesTo=VARIANTS`, confirm chips + INVALID_TARGET Spanish message).

### Verdict
**PASS WITH WARNINGS** — All 7 requirements satisfied and all 9 behavioral scenarios covered by passing runtime tests; `pnpm build` (vue-tsc full project references + vite) is green; **zero** new test failures vs the 18-failure baseline. Non-blocking warnings concern the intentional edit-mode UUID fallback and a client-side product-search scale limit — neither breaks a spec. Recommended next phase: **archive**.
