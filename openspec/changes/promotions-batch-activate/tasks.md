# Tasks: Promotions Batch-Activate

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~140–180 |
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
| WU-1 | API `batchActivate` + `activate` + tests | Commit 1 | `pnpm test:unit -- promotion.api.test` | N/A (pure HTTP layer) | Revert `promotion.api.ts` + test; view untouched |
| WU-2 | Mutation + bulk-action wiring + view tests | Commit 2 | `pnpm test:unit -- PromotionsView.test` | Manual: select 2 rows → click "Reactivar" → confirm modal | Revert `PromotionsView.vue` mutations; bulk button gone, no behavior change |
| WU-3 | Selection gate + loading bind + final pass | Commit 3 | `pnpm test:unit` + `pnpm build` | Manual: log in as `update:Promotion`-only user → verify checkboxes | Revert single `:enable-row-selection` line |

## Phase 1: API Layer (WU-1, Commit 1)

- [x] 1.1 RED: add `batchActivate` test in `src/features/POS/promotions/api/__tests__/promotion.api.test.ts` — dedup `['a','a','b']` → POSTs `{ ids: ['a','b'] }` to `/promotions/batch-activate` (BA-REQ-002)
- [x] 1.2 RED: extend same test — empty array throws; 101 IDs throws
- [x] 1.3 RED: add `activate(id)` test — PATCH `/promotions/${id}/activate` returns updated `PromotionResponse` (IA-REQ-001)
- [x] 1.4 GREEN: implement `async batchActivate(ids: string[]): Promise<{ activated: number }>` and `async activate(id: string): Promise<PromotionResponse>` in `src/features/POS/promotions/api/promotion.api.ts` mirroring `batchEnd`/`end`

## Phase 2: Mutation + Bulk Action Wiring (WU-2, Commit 2)

- [x] 2.1 RED: in `src/features/POS/promotions/views/__tests__/PromotionsView.test.ts` add "Reactivar absent when `userCan('update','Promotion')` is false" (BA-REQ-001)
- [x] 2.2 GREEN: add `canBatchActivate` computed → `authStore.userCan('update','Promotion')` in `PromotionsView.vue`
- [x] 2.3 RED: test renders "Reactivar (N)" primary button enabled with 3 selected (BA-REQ-003); disabled at 0 and at 101 (BA-REQ-010)
- [x] 2.4 GREEN: extend `bulkActions` array with `id: 'batch-activate'`, `variant: 'primary'`, gated by `canBatchActivate`, label "Reactivar (N)"
- [x] 2.5 RED: test ConfirmModal shows titles + status badges, `confirmColor: 'primary'`, label "Reactivar seleccionadas" (BA-REQ-004)
- [x] 2.6 GREEN: wire `openConfirm` closure capturing selected rows (mirror SDD-11)
- [x] 2.7 RED: test on `200 { activated: 3 }` → toast "3 promociones reactivadas", invalidate, clear selection, modal closes (BA-REQ-005)
- [x] 2.8 GREEN: add `batchActivateMutation` with `onSuccess` (toast + `queryClient.invalidateQueries` + clear `rowSelection`)
- [x] 2.9 RED: test on `404 BATCH_DELETE_NOT_FOUND` → toast "N promocion(es) no encontrada(s)", invalidate, clear selection (BA-REQ-006)
- [x] 2.10 GREEN: handle 404 in `onError` dispatch (note: backend reuses `BATCH_DELETE_NOT_FOUND` literal — flag with comment)
- [x] 2.11 RED: test on `403 INSUFFICIENT_PERMISSIONS` → toast, selection preserved (BA-REQ-007)
- [x] 2.12 GREEN: handle 403 in `onError` dispatch (no selection clear)
- [x] 2.13 RED: test `batchActivateMutation.isPending` shows spinner + non-dismissible modal (BA-REQ-008)
- [x] 2.14 GREEN: extend `:loading="..."` binding on ConfirmModal to include `batchActivateMutation.isPending.value`

## Phase 3: Selection Gate + Constants (WU-3, Commit 3)

- [x] 3.1 RED: test checkboxes visible when `canBatchDelete === false && canBatchActivate === true` (BA-REQ-009)
- [x] 3.2 GREEN: widen `:enable-row-selection` from `canBatchDelete || canBatchEnd` to `canBatchDelete || canBatchEnd || canBatchActivate`
- [x] 3.3 VERIFY: run `pnpm test:unit` — all new + existing pass; run `pnpm build` — no type errors
- [x] 3.4 VERIFY: `git diff` against SDD-11 shows only documented deltas (no refactor leakage)
## Implementation Notes

- Existing `:enable-row-selection="canBatchDelete || canBatchEnd"` already covers update-only users because `canBatchEnd` and `canBatchActivate` map to the same `update:Promotion` permission. BA-REQ-009 verified — no gate widening performed.
- Per user direction, the existing `BATCH_END_CAP = 100` constant is reused; no `BATCH_ACTIVATE_CAP` constant was added.
- Per-row "Reactivar" action in the row dropdown is intentionally deferred (API method exists in `promotionApi` for future use).
