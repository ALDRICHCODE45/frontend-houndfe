# Tasks: Variant-Level Promotion Targeting

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~340-360 (types ~8, options/errormap ~25, section ~30, ProductVariantSelector.vue ~150, resolver ~35, tests ~110) |
| 400-line budget risk | Low |
| Chained PRs recommended | No (solo dev, work-unit commits only) |
| Chain strategy | N/A |
| Suggested split | Single feature branch; 7 work-unit commits |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Commit | Focused test | Runtime harness | Rollback boundary |
|------|------|--------|--------------|-----------------|-------------------|
| 1 | Types + options + UI labels (build-coupled) | feat(promotions): add VARIANTS target type | pnpm test:unit -t TARGET_TYPE_OPTIONS | pnpm build (tsc + vite) | Revert removes VARIANTS from union, options, emptyStateLabel, placeholder |
| 2 | Payload invariant test (REQ-4) | test(promotions): assert VARIANTS payload shape | pnpm test:unit -t "VARIANTS payload" | pnpm test:unit | Drop new test block |
| 3 | ProductVariantSelector.vue (REQ-3) | feat(promotions): add ProductVariantSelector | pnpm test:unit ProductVariantSelector | mount selector (N/A in slice) | Delete new component + test file |
| 4 | Section wiring (REQ-2/3) | feat(promotions): wire VARIANTS branch into target section | pnpm test:unit PromotionTargetItemsSection | pnpm build | Revert section render change |
| 5 | Edit-mode hydration (REQ-5) | feat(promotions): resolve VARIANTS names in edit mode | pnpm test:unit usePromotionTargetNames | pnpm build | Revert case 'VARIANTS' branch |
| 6 | INVALID_TARGET error (REQ-6) | feat(promotions): map INVALID_TARGET to targetItems error | pnpm test:unit -t INVALID_TARGET | pnpm build | Revert new branch |
| 7 | Final verification gate | chore(promotions): verify variant targeting slice | pnpm test:unit | pnpm build | None (gate only) |

## Phase 1: Foundation / Build-Coupled Type Widen
- [x] 1.1 RED — usePromotionForm.test.ts: assert TARGET_TYPE_OPTIONS values include 'VARIANTS' with label 'Variantes'.
- [x] 1.2 GREEN — promotion.types.ts: add 'VARIANTS' to PromotionTargetType (line 11); add optional productId? and productName? to PromotionTargetItemFormEntry (line 145).
- [x] 1.3 usePromotionForm.ts: append { label: 'Variantes', value: 'VARIANTS' } to TARGET_TYPE_OPTIONS (line 53).
- [x] 1.4 PromotionTargetItemsSection.vue: add VARIANTS: 'variantes' to emptyStateLabel typeMap (line ~109) AND extend search-placeholder ternary (line ~141) — REQUIRED in the SAME commit so pnpm build (tsc) stays green when union widens.
- [x] 1.5 Verify: pnpm test:unit (new case green) + pnpm build (tsc + vite green).

Commit: feat(promotions): add VARIANTS target type

## Phase 2: Payload Invariant Test (REQ-4)
- [x] 2.1 Add test in usePromotionForm.test.ts: toCreatePayload with appliesTo='VARIANTS' and targetItems=[{targetId:'v1',name:'Talle M',productId:'p1',productName:'Camisa'}] returns targetItems:[{targetType:'VARIANTS',targetId:'v1'}] with NO side, id, or productId.
- [x] 2.2 Test passes immediately (toCreatePayload already destructures only targetType/targetId at usePromotionForm.ts:168).
- [x] 2.3 Verify: pnpm test:unit -t "VARIANTS payload" green.

Commit: test(promotions): assert VARIANTS payload shape

## Phase 3: ProductVariantSelector Component (REQ-3)
- [x] 3.1 RED — create components/__tests__/ProductVariantSelector.test.ts using mountWithUApp; stub productApi.getPaginated and productApi.getVariants.
- [x] 3.2 Cases: product search filters to hasVariants===true; pick product loads variants via getVariants; add emits { targetId, name, productId, productName }; multi-variant across two products; remove filters item out.
- [x] 3.3 GREEN — create components/ProductVariantSelector.vue (script setup lang=ts): props selectedItems, emits update:selectedItems. Two-step UX: product list (client-side hasVariants filter via computed) then variant list (useQuery key ['promotions','variants-by-product',productId], staleTime 60_000) then chips emit unchanged shape.
- [x] 3.4 Verify: pnpm test:unit ProductVariantSelector green + pnpm build green.

Commit: feat(promotions): add ProductVariantSelector

## Phase 4: Section Wiring (REQ-2/3)
- [x] 4.1 RED — extend PromotionTargetItemsSection.test.ts: when targetType='VARIANTS', selector renders; switching emits update:selectedItems with []; chip label "Camisa . Talle M" when productName present, else name||targetId.
- [x] 4.2 GREEN — PromotionTargetItemsSection.vue: when targetType === 'VARIANTS', render ProductVariantSelector and forward update:selected-items unchanged. REQ-2 already satisfied by existing onTargetTypeChange (line 89).
- [x] 4.3 Verify: pnpm test:unit PromotionTargetItemsSection green + pnpm build green.

Commit: feat(promotions): wire VARIANTS branch into target section

## Phase 5: Edit-Mode Hydration (REQ-5)
- [x] 5.1 RED — extend usePromotionTargetNames.test.ts: stub getVariants. Entry WITH productId resolves via getVariants(cached); entry WITHOUT productId returned unchanged; never throws.
- [x] 5.2 GREEN — usePromotionTargetNames.ts: add case 'VARIANTS' returning resolveVariants(queryClient, items); helper try/catch mirroring resolveProducts using productApi.getVariants(productId); add promotionTargetNameQueryKeys.variantsByProduct(id); group items by productId, fetch once per product, map variantId to name; skip items without productId.
- [x] 5.3 Verify: pnpm test:unit usePromotionTargetNames green + pnpm build green.

Commit: feat(promotions): resolve VARIANTS names in edit mode

## Phase 6: INVALID_TARGET Error Map (REQ-6)
- [x] 6.1 RED — extend usePromotionForm.test.ts: mapApiErrorToFields({error:'INVALID_TARGET'}) returns fieldErrors[0].path === 'targetItems' with Spanish message; toastMessage null.
- [x] 6.2 GREEN — usePromotionForm.ts: add if (code === 'INVALID_TARGET') branch mirroring DUPLICATE_TARGET (after line 357) with message 'La variante seleccionada no existe o no pertenece a tu comercio'.
- [x] 6.3 VERIFY-DURING-APPLY — confirm handleMutationError in views/PromotionDetailView.vue:120 passes error.response?.data.error (verified for DUPLICATE_TARGET today; mirror for INVALID_TARGET). Flag if upstream contract differs.
- [x] 6.4 Verify: pnpm test:unit -t INVALID_TARGET green + pnpm build green.

Commit: feat(promotions): map INVALID_TARGET to targetItems error

## Phase 7: Final Verification Gate
- [x] 7.1 REQ-7 invariant self-check: git diff of this slice touches ZERO files under src/features/POS/sales/ or POS draft view; no POS-side discount math, no precedence logic.
- [x] 7.2 Run pnpm test:unit; full suite green, baseline (~18 pre-existing failures per memory) preserved, NO NEW failures. Final: 18 failed / 2385 passed (was 18/2362 → +23 new passes, 0 new fails).
- [x] 7.3 Run pnpm build; vue-tsc full project references + vite build green.
- [x] 7.4 Manual smoke (was deferred at plan time): user executed end-to-end smoke test against live backend on 2026-07-12. Outcome: create VARIANTS promo → POS reflects discounts on targeted variants → CONFIRMED WORKING. One blocker observed (HTTP 500 on POST /promotions) was diagnosed as a BACKEND defect (Postgres enum `PromotionTargetType` missing the `VARIANTS` value — missing Prisma migration), NOT a frontend defect. The FE request shape is correct. Backend follow-up handed off (engram bugfix obs #2951). Reconciled at archive time per orchestrator authorization (apply-progress/verify-report prove all implementation tasks complete; only this optional manual QA was pending).

Commit: chore(promotions): verify variant targeting slice

## Cross-Phase Constraints
- Phase 1 widens union AND widens both Record<PromotionTargetType,string> and placeholder ternary in the SAME commit (build-break gotcha).
- Phase 2 test PROVES productId/productName never reach the backend (REQ-4 invariant).
- Tests use mountWithUApp for any Nuxt UI stubs; do NOT use vi.stubGlobal('useToast').
- Do NOT add variant targeting for BUY_X_GET_Y or ADVANCED; backend only documents PRODUCT_DISCOUNT.