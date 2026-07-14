```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:18fe17f4896a04756666aaaa1a5b7bb5ab1222cbc289e1f4825a3abab55bc40a
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 14/14
test_command: pnpm test:unit src/features/POS/sales/utils/__tests__/promotion.utils.test.ts src/features/POS/sales/components/__tests__/PromocionesDisponiblesAccordion.test.ts src/features/POS/sales/interfaces/__tests__/sale.types.test.ts src/features/POS/sales/components/__tests__/SaleDetailItemsList.test.ts src/features/POS/sales/components/__tests__/SaleItemBadges.test.ts
test_exit_code: 0
test_output_hash: sha256:bb415107ebd51dceb4c755b6d01aca2cf86f08b1310cc9ac43714c8870ee6123
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:34e251410ef50b22c6fb4d14cf05156e1cac4d15351268457a44153b468f2b80
```

## Verification Report

**Change**: bxgy-promotion-followups
**Version**: specs/sales delta REQ-4..REQ-8 (reconciled to `=== false` gate + defensive fallback chip)
**Mode**: Strict TDD (runner `pnpm test:unit`; authoritative gate `pnpm build`)
**Branch**: `feat/bxgy-promotion-followups` @ `467d751` (2 commits: `0af90fe` F-1, `467d751` F-2)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 26 (Phase 1: 13, Phase 2: 11, Phase 3: 3 minus overlap) |
| Tasks complete | All implementation tasks landed (F-1 + F-2 commits present, code matches design) |
| Tasks incomplete | 0 blocking — 3.2/3.3 (push + PR) deferred: SSH/remote unavailable, local-only per apply-progress #2841 |

> Task checkboxes in `tasks.md` remain unchecked (`- [ ]`), but every implementation task is objectively DONE per code inspection + green gates. The only genuinely-open items are branch push and PR creation, which are environmental (no remote access), not implementation gaps. Archive should tick the boxes.

### Build & Tests Execution

**Build**: ✅ Passed (exit 0) — vue-tsc type-check + Vite build
```text
$ pnpm build
✓ built in 12.36s   (type-check green — validates REQ-4/REQ-7 type-only cases)
BUILD_EXIT=0
```

**Tests (change gate — 5 target files)**: ✅ 118 passed / 0 failed
```text
Test Files  5 passed (5)
     Tests  118 passed (118)
```

**Tests (full repo suite — transparency)**: ⚠️ 18 failed / 2523 passed (2541 total), exit 1
```text
Test Files  5 failed | 195 passed (200)
     Tests  18 failed | 2523 passed (2541)
```
The 18 failures live in 5 files UNRELATED to this change and are **PRE-EXISTING**, independently proven by checking out `main` (`6122196`) and re-running those exact 5 files → identical 18 failures. NOT regressions from F-1/F-2:
| Pre-existing failing file | Failures |
|---|---|
| `auth/stores/__tests__/useAuthStore.spec.ts` | 2 |
| `POS/promotions/composables/__tests__/usePromotionColumns.test.ts` | 2 |
| `POS/sales/components/__tests__/DebtPaymentModal.test.ts` | 9 |
| `POS/sales/components/__tests__/SaleDetailMetadataCard.spec.ts` | 1 |
| `POS/sales/composables/__tests__/useDebtPayment.test.ts` | 4 |
| **Total** | **18** |

**Coverage**: ➖ Not available (no coverage tool configured in `pnpm test:unit`)

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-4 | concrete values type-check | `sale.types.test.ts > accepts all five eligibility fields with concrete values` | ✅ COMPLIANT |
| REQ-4 | buy/getQuantity accept null | `sale.types.test.ts > accepts explicit null for buyQuantity and getQuantity` | ✅ COMPLIANT |
| REQ-4 | all five omittable (legacy) | `sale.types.test.ts > remains omittable for legacy fixtures` + `pnpm build` | ✅ COMPLIANT |
| REQ-5 | `eligible:false` disables Aplicar, no emit | `PromocionesDisponiblesAccordion.test.ts > disables Aplicar when eligible:false…` | ✅ COMPLIANT |
| REQ-5 | `eligible:true` enabled, emits | `…keeps Aplicar enabled when eligible:true and clicking emits apply` | ✅ COMPLIANT |
| REQ-5 | legacy (omit) stays enabled | `…keeps Aplicar enabled for legacy fixtures that omit eligible` | ✅ COMPLIANT |
| REQ-6 | N=1 singular hint | `PromocionesDisponiblesAccordion.test.ts > renders singular hint…` + `promotion.utils.test.ts` | ✅ COMPLIANT |
| REQ-6 | N=2 plural hint | `…renders the plural hint…` + `promotion.utils.test.ts` | ✅ COMPLIANT |
| REQ-6 | absent/null → no hint | `…does NOT render the hint element when unitsNeeded is absent or null` | ✅ COMPLIANT |
| REQ-7 | promotionId string | `sale.types.test.ts > accepts promotionId as a string…` | ✅ COMPLIANT |
| REQ-7 | promotionId null | `sale.types.test.ts > accepts explicit null for promotionId` | ✅ COMPLIANT |
| REQ-7 | omittable (legacy) | `sale.types.test.ts > omits promotionId for legacy…` + `pnpm build` | ✅ COMPLIANT |
| REQ-8 | promotionId + title → chip, no remove | `SaleDetailItemsList.test.ts > forwards promotionId … renders the promo-name chip…` | ✅ COMPLIANT |
| REQ-8 | promotionId + empty title → forwarded, fallback chip, no remove | `SaleDetailItemsList.test.ts > forwards promotionId … when discountTitle is empty…` | ⚠️ PARTIAL |

**Compliance summary**: 14/14 scenarios compliant (13 full ✅ + 1 ⚠️ PARTIAL at integration layer — see SUGGESTION).

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| REQ-4 | ✅ Implemented | `sale.types.ts` L403-410: `eligible?`, `buyQuantity?: number\|null`, `getQuantity?: number\|null`, `unitsNeeded?: number`, `method?: 'MANUAL'` — all optional, numeric pair nullable. |
| REQ-5 | ✅ Implemented | Accordion L166 `:disabled="promo.eligible === false"` — STRICT `=== false`, generic on `eligible`, NO `promo.type` branch. Legacy/undefined + `true` stay enabled (proven by tests). |
| REQ-6 | ✅ Implemented | `promotion.utils.ts` L10-13 singular/plural ternary + static `"2x1 ·"`; accordion L157 gates `v-if="promo.unitsNeeded != null"`, testid `promo-hint-${promo.id}` L158. |
| REQ-7 | ✅ Implemented | `sale.types.ts` L84 `promotionId?: string \| null` on `SaleDetailItem`. |
| REQ-8 | ✅ Implemented | `SaleDetailItemsList.vue` L96 `:promotion-id="item.promotionId"` forwarded; chip gated on `hasPromotion = promotionId != null` (`SaleItemBadges.vue` L82); fallback `"Promoción"` chip L125-130; remove gated `v-if="removable"` (default false) L132. **`SaleItemBadges.vue` git diff EMPTY — confirmed UNCHANGED.** |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| All new fields OPTIONAL + numeric pair nullable | ✅ Yes | Matches `rewardKind` precedent; build green with legacy fixtures. |
| Disable gate STRICT `=== false` (not `!eligible`) | ✅ Yes | Exactly as design Decisions + spec REQ-5 reconciled text; undefined stays enabled. |
| Gate generic on `eligible`, never `promo.type` | ✅ Yes | No type-branch anywhere in the binding. |
| `"2x1 ·"` static literal in helper | ✅ Yes | `promotion.utils.ts` L12. |
| Pure `buildBxgyHint()` helper (Extract-Before-Mock) | ✅ Yes | Unit-tested without mount; template stays declarative. |
| `SaleItemBadges.vue` NO change | ✅ Yes | `git diff main...HEAD` for that file is empty. |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | apply-progress #2841 documents RED→GREEN per commit with baseline/added/confirmed counts. |
| All reqs have tests | ✅ | REQ-4..REQ-8 each map to ≥1 runtime test file that exists and passes. |
| RED confirmed (tests exist) | ✅ | All 5 test files present; 13 new cases added on top of prior baseline. |
| GREEN confirmed (tests pass) | ✅ | 118/118 pass on independent re-run; `pnpm build` green (type-only RED cases). |
| Triangulation adequate | ✅ | Singular/plural/≥3 for hint; string/null/undefined for types; false/true/omit for gate — DIFFERENT expected values, no monoculture. |
| Safety Net for modified files | ✅ | Prior suites (73 / 84 baseline) ran green before additions per #2841. |

**TDD Compliance**: 6/6 checks passed.

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (pure fn) | 5 | 1 (`promotion.utils.test.ts`) | vitest |
| Unit (type-level) | 6 | 1 (`sale.types.test.ts`, this change's new cases) | vitest + vue-tsc |
| Integration (mount) | 14 | 2 (`PromocionesDisponiblesAccordion`, `SaleDetailItemsList`) | vitest + @vue/test-utils + `mountWithUApp` |
| E2E | 0 | 0 | not installed (not required) |
| **Total (change target files)** | **118** | **5** | |

### Changed File Coverage
Coverage analysis skipped — no coverage tool detected in the `pnpm test:unit` script.

### Assertion Quality
✅ All assertions verify real behavior. Scan of all 5 change test files found:
- No tautologies (`expect(true).toBe(true)`), no ghost loops, no orphan empty-checks.
- No assertions without a production-code call — every case invokes `buildBxgyHint(...)`, mounts the component, or constructs a typed literal exercised by `vue-tsc`.
- Type-only assertions (`toBeUndefined`) are paired with value assertions and backed by the `pnpm build` type-check gate.
- Minor implementation-detail note (NOT flagged as defect): a few assertions read `attributes('disabled')` / testids — acceptable here since they are the observable disabled-state and DOM contract the spec pins by testid.

**Assertion quality**: 0 CRITICAL, 0 WARNING.

### Issues Found
**CRITICAL**: None.

**WARNING**:
- W-1 (repo baseline, out-of-scope): full `pnpm test:unit` exits 1 with 18 pre-existing failures across 5 unrelated files (auth, DebtPaymentModal, useDebtPayment, usePromotionColumns, SaleDetailMetadataCard). **Proven pre-existing on `main` (`6122196`) — NOT caused by this change.** They keep the repo-wide gate red and should be tracked/fixed in a separate change; they do not block this one.

**SUGGESTION**:
- S-1 (REQ-8 scenario 2, PARTIAL): the empty-`discountTitle` integration test asserts `promotionId` forwarding + absence of the remove button, but does NOT directly assert the `"Promoción"` fallback chip label at the list layer (intentional — the test comment defers that rendering to the locked `SaleItemBadges`). The fallback behavior is guaranteed by unchanged `SaleItemBadges.vue` code (L113-130) + build, and is the user-ACCEPTED behavior. Optionally add one assertion in `SaleDetailItemsList.test.ts` that `sale-item-promo-badge` renders with text `"Promoción"` when title is empty, to make scenario 2 fully covered at the integration layer. Non-blocking.
- S-2 (archive follow-up): `tasks.md` checkboxes are still `- [ ]` though implementation is done. Archive should tick them and reconcile any remaining REQ-5 wording (already reconciled in the spec text read here).

### Verdict
**PASS WITH WARNINGS**

The change is COMPLETE and CORRECT: all five requirements (REQ-4..REQ-8) are implemented exactly per the reconciled spec + design (strict `=== false` gate, singular/plural hint, optional+nullable types, `promotionId` forwarding), covered by 118 passing runtime tests, and the authoritative `pnpm build` gate is green with zero regressions. `SaleItemBadges.vue` is provably unchanged and the defensive `"Promoción"` fallback chip is the accepted, spec-documented behavior (not a defect). The single WARNING is the pre-existing repo-wide test baseline (18 failures in 5 unrelated files, proven identical on `main`), which is out of scope for this change. Ready for `sdd-archive`.
