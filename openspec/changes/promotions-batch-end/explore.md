# Exploration: promotions-batch-end

## Current State

The Promotions module already has a complete batch-delete implementation (sdd-10). The batch-end feature is a near-identical pattern with different:
- Endpoint (`POST /promotions/batch-end`)
- Permission gate (`update:Promotion` instead of `batch_delete:Promotion`)
- Success payload (`{ ended: N }` instead of `{ deleted: N }`)
- Fewer error states (no 409 PROMOTION_REFERENCED_BY_SALE)
- UI labeling (Finalizar vs Eliminar, warning vs destructive)

### Existing batch-delete architecture (PromotionsView.vue)

```
┌─────────────────────────────────────────────────────────┐
│ PromotionsView.vue                                       │
│                                                          │
│ BATCH_DELETE_CAP = 100 (line 104)                        │
│ rowSelection ← useServerTable                             │
│ selectedRows ← computed: data.filter by rowSelection      │
│                                                          │
│ offendingIds ← ref<Set<string>> (line 157)               │
│   → watch(rowSelection) clears on new selection          │
│                                                          │
│ batchDeleteMutation (line 270):                          │
│   onSuccess: toast, invalidate, clear selection+offending │
│   onError: dispatch on error codes:                      │
│     PROMOTION_REFERENCED_BY_SALE (409) → set offendingIds │
│     BATCH_DELETE_NOT_FOUND (409) → toast + invalidate    │
│     INSUFFICIENT_PERMISSIONS (403) → toast               │
│     default → normalizeApiError                          │
│                                                          │
│ bulkActions computed (line 368):                         │
│   gate: canBatchDelete                                   │
│   id: 'batch-delete'                                     │
│   variant: 'destructive'                                 │
│   onClick: openConfirm with closure-captured rows        │
│                                                          │
│ enable-row-selection: canBatchDelete (line 505)          │
│                                                          │
│ SelectColumn wired in #select-header + #select-cell      │
│ #title-cell template highlights offendingIds             │
└─────────────────────────────────────────────────────────┘
```

### Existing single-promo end (PromotionsView.vue)

```
endMutation (line 224):
  mutationFn: promotionApi.end(id)
  onSuccess: toast "Promoción finalizada", invalidate
  onError: toast generic error

handleEnd (line 323):
  openConfirm with color 'warning'
  ConfirmModal label: "Finalizar"
  description: "¿Quieres finalizar la promoción?"

getRowItems (line 341):
  per-row "Finalizar" action gated by:
    canUpdate && status !== PROMOTION_STATUS.ENDED
```

### Existing API layer (promotion.api.ts)

```typescript
// Line 102 - single end
async end(promotionId: string): Promise<PromotionResponse> {
  const { data } = await http.patch<PromotionResponse>(`/promotions/${promotionId}/end`)
  return data
}
// Line 120-133 - batch delete pattern to replicate
async batchDelete(ids: string[]): Promise<{ deleted: number }> {
  const uniqueIds = Array.from(new Set(ids))
  if (uniqueIds.length === 0) throw new Error('...')
  if (uniqueIds.length > 100) throw new Error('...')
  const { data } = await http.post<{ deleted: number }>('/promotions/batch-delete', {
    ids: uniqueIds,
  })
  return data
}
```

---

## Affected Areas

| File | Why |
|---|---|
| `src/features/POS/promotions/api/promotion.api.ts` | Add `batchEnd(ids)` method following `batchDelete` pattern |
| `src/features/POS/promotions/views/PromotionsView.vue` | Add `batchEndMutation`, `canBatchEnd` computed/gate, extend `bulkActions`, adjust `enable-row-selection` |
| `src/features/POS/promotions/views/__tests__/PromotionsView.test.ts` | Add test cases for batch-end: permissions, success, error, button label/color |
| `src/features/POS/promotions/api/__tests__/promotion.api.test.ts` | Test `batchEnd` API method (dedup, min, max guards) |

### Files that DO NOT need changes

| File | Reason |
|---|---|
| `src/features/auth/authorization/ability.ts` | `update:Promotion` already exists in CASL — no new action needed |
| `src/core/shared/components/ConfirmModal.vue` | Already supports `items[]`, `confirmColor`, all needed props |
| `src/core/shared/components/DataTable/DataTableBulkActions.vue` | Existing component works as-is (the onClick([]) latent bug is already sidestepped via closure) |
| `src/core/shared/components/DataTable/SelectColumn.vue` | Reusable as-is |
| `src/core/shared/components/DataTable/AppDataTable.vue` | Already supports `enableRowSelection` + `bulkActions` |

---

## Approaches

### Approach: Single bulkActions array (recommended)

Add `batchEndMutation` and a second entry in the `bulkActions` array. Both batch-end and batch-delete buttons coexist in the sticky bar when the user has both permissions.

**Changes:**
1. **`promotion.api.ts`**: Add `batchEnd(ids: string[])` method (same guards as `batchDelete`, post to `/promotions/batch-end`)
2. **`PromotionsView.vue`**:
   - Add `batchEndMutation` with onSuccess `{ ended }` toast, onError dispatching BATCH_DELETE_NOT_FOUND (404) and INSUFFICIENT_PERMISSIONS
   - Add `canBatchEnd` computed → `authStore.userCan('update', 'Promotion')` (same as `canUpdate`)
   - Extend `bulkActions` to include batch-end entry gated on `canBatchEnd`
   - Change `enable-row-selection` from `canBatchDelete` to `canBatchDelete || canBatchEnd`
   - Optional: reuse `BATCH_DELETE_CAP` → rename to `BATCH_CAP` (or duplicate as `BATCH_END_CAP`)
3. **Tests**: Add batch-end test cases

**Pros:**
- Minimal change surface
- Reuses all existing patterns, components, and error handling
- No structural refactoring needed
- `offendingIds` concept doesn't apply to batch-end (no 409), so simpler

**Cons:**
- Two bulk buttons appear simultaneously for users with both permissions → slightly busier UI
- `BATCH_DELETE_CAP=100` naming is delete-specific; could rename but not required

**Effort: Low**

---

### Alternative: Refactor to generic batch action factory

Extract common batch logic into a composable `useBatchAction` that returns mutation + bulkAction entry. Both batch-delete and batch-end become one-liner instantiations.

**Pros:**
- DRY — eliminates duplication between the two batch mutations
- Easier to add batch-terminate/reactivate later

**Cons:**
- Premature abstraction — only 2 batch operations exist
- Adds indirection to a well-understood pattern
- Takes longer to implement and test

**Effort: Medium**

---

## Recommendation

**Approach 1 (single bulkActions array)** — replicate the batch-delete pattern with minor labeling/permission differences. The batch-end feature is ~90% identical to batch-delete; extracting a generic abstraction for a 2nd use case is premature. If/When batch-terminate/reactivate for employees follows the same pattern, THEN extract.

---

## Risks

- **Row selection gate change**: Changing `enable-row-selection` from `canBatchDelete` to `canBatchDelete || canBatchEnd` means many more users will see checkboxes. This is intentional (batch-end uses `update:Promotion` which is broadly granted) but worth noting for UX — non-admin staff may see checkboxes they can only use for "Finalizar".
- **BATCH_DELETE_CAP naming**: The constant is named for delete but the end cap is also 100. Renaming is a minor design decision. Simplest option: add `const BATCH_END_CAP = 100` alongside (identical value, separate semantic).
- **offendingIds reuse**: The `offendingIds` concept is currently tied to 409 PROMOTION_REFERENCED_BY_SALE which doesn't apply to batch-end. No need to reuse it for batch-end's 404 BATCH_DELETE_NOT_FOUND — a simple toast is sufficient since "already deleted" is not an actionable state for the user (the list refresh handles it).
- **Backend error code is BATCH_DELETE_NOT_FOUND even for batch-end**: Despite the name, this is the code the backend returns for 404 on batch-end per the integration guide. The frontend error handler should match this code literally.

---

## Ready for Proposal

Yes. The pattern is well-understood, all reusable components exist, and the change surface is small. The implementation is a straightforward replication of batch-delete with different labels, permissions, and error codes.
