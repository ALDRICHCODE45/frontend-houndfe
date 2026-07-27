# Tasks: Promotions Batch-End

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~120–160 |
| Estimated files | 4 |
| Estimated commits | 3 work-unit commits |
| 400-line budget risk | Low |
| Chained PRs recommended | No (solo, direct merge to main) |
| Decision needed before apply | No |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WU-1 | API `batchEnd` + tests | Commit 1 | `pnpm test:unit -- promotion.api.test` | N/A (pure HTTP layer) | Revert `promotion.api.ts` + test; view untouched |
| WU-2 | Mutation + bulk-action wiring + view tests | Commit 2 | `pnpm test:unit -- PromotionsView.test` | Manual: select 2 rows → click "Finalizar" → confirm modal | Revert `PromotionsView.vue` mutations; bulk button gone, no behavior change |
| WU-3 | Row-selection gate widening + loading bind + final pass | Commit 3 | `pnpm test:unit` + `pnpm build` | Manual: log in as `update:Promotion`-only user → verify checkboxes | Revert single `:enable-row-selection` line |

## Phase 1: API Layer (WU-1, Commit 1)

- [x] 1.1 RED: add `batchEnd` test in `src/features/POS/promotions/api/__tests__/promotion.api.test.ts` — dedup `['a','a','b']` → POSTs `{ ids: ['a','b'] }` to `/promotions/batch-end` (BE-REQ-002)
- [x] 1.2 RED: extend same test — empty array throws; 101 IDs throws
- [x] 1.3 GREEN: implement `async batchEnd(ids: string[]): Promise<{ ended: number }>` in `src/features/POS/promotions/api/promotion.api.ts` mirroring `batchDelete` shape

## Phase 2: Mutation + Bulk Action Wiring (WU-2, Commit 2)

- [x] 2.1 RED: in `src/features/POS/promotions/views/__tests__/PromotionsView.test.ts` add "Finalizar absent when `userCan('update','Promotion')` is false" (BE-REQ-001)
- [x] 2.2 GREEN: add `canBatchEnd` computed → `authStore.userCan('update','Promotion')` in `PromotionsView.vue`
- [x] 2.3 RED: test renders "Finalizar (N)" warning button enabled with 3 selected (BE-REQ-003); disabled at 0 and at 101 (BE-REQ-010)
- [x] 2.4 GREEN: extend `bulkActions` array with `id: 'batch-end'`, `variant: 'warning'`, gated by `canBatchEnd`, label "Finalizar (N)"
- [x] 2.5 RED: test ConfirmModal shows titles + status badges, `confirmColor: 'warning'`, label "Finalizar seleccionadas" (BE-REQ-004)
- [x] 2.6 GREEN: wire `openConfirm` closure capturing selected rows (mirror SDD-10)
- [x] 2.7 RED: test on `200 { ended: 3 }` → toast "3 promociones finalizadas", invalidate, clear selection, modal closes (BE-REQ-005)
- [x] 2.8 GREEN: add `batchEndMutation` with `onSuccess` (toast + `queryClient.invalidateQueries` + clear `rowSelection`)
- [x] 2.9 RED: test on `404 BATCH_DELETE_NOT_FOUND` → toast "N promocion(es) no encontrada(s)", invalidate, clear selection (BE-REQ-006)
- [x] 2.10 GREEN: handle 404 in `onError` dispatch (note: backend reuses `BATCH_DELETE_NOT_FOUND` literal for batch-end — flag with comment)
- [x] 2.11 RED: test on `403 INSUFFICIENT_PERMISSIONS` → toast, selection preserved (BE-REQ-007)
- [x] 2.12 GREEN: handle 403 in `onError` dispatch (no selection clear)
- [x] 2.13 RED: test `batchEndMutation.isPending` shows spinner + non-dismissible modal (BE-REQ-008)
- [x] 2.14 GREEN: extend `:loading="..."` binding on both bulk button and ConfirmModal to include `batchEndMutation.isPending.value`

## Phase 3: Selection Gate + Constants (WU-3, Commit 3)

- [x] 3.1 RED: test checkboxes visible when `canBatchDelete === false && canBatchEnd === true` (BE-REQ-009)
- [x] 3.2 GREEN: widen `:enable-row-selection` from `canBatchDelete` to `canBatchDelete || canBatchEnd`
- [x] 3.3 GREEN: add `const BATCH_END_CAP = 100` next to existing `BATCH_DELETE_CAP` in `PromotionsView.vue` (line 104); reuse in WU-2's `disabled` check
- [ ] 3.4 VERIFY: run `pnpm test:unit` — all new + existing pass; run `pnpm build` — no type errors
- [ ] 3.5 VERIFY: `git diff` against SDD-10 shows only documented deltas (no refactor leakage)