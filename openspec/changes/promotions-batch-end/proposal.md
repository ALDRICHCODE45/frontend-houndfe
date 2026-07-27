# Proposal: Promotions Batch-End

## Intent

The Promotions module already supports batch-delete (SDD-10). The backend now exposes `POST /promotions/batch-end`, an atomic all-or-nothing operation that finalizes up to 100 promotions in one request. Today, finishing several promotions requires one per-row confirmation modal round trip — slow and error-prone for admins cleaning up at scale. This change consumes the new endpoint from the frontend so users with `update:Promotion` can finalize promotions in bulk from the same sticky bar as batch-delete, keeping the operation surface consistent with the rest of the module.

The batch-end feature is **~90% identical** to batch-delete: same selection infrastructure, same ConfirmModal pattern, same mutation lifecycle, same invalidation strategy. The deltas are permission (`update:Promotion` vs `batch_delete:Promotion`), endpoint, success payload (`{ ended: N }`), UI labeling (warning color, "Finalizar" copy), and a narrower error set (no 409 `PROMOTION_REFERENCED_BY_SALE`).

Honors the user's priorities: reusing the existing pattern preserves mantenibilidad (no new abstractions), escalabilidad (the bar accepts N actions cleanly via the array), legibilidad (everything that applies to batch-delete applies here), and arquitectura (no deviation from the established bulk-action shape).

## Scope

### In Scope

- `promotionApi.batchEnd(ids)` following the `batchDelete` shape (dedup, min/max guards, single POST)
- `batchEndMutation` in `PromotionsView.vue` with `onSuccess` toast + invalidate + clear selection, and `onError` dispatch for `BATCH_DELETE_NOT_FOUND` and `INSUFFICIENT_PERMISSIONS`
- `canBatchEnd` computed gate → `authStore.userCan('update', 'Promotion')`
- New entry in the existing `bulkActions` array (id `batch-end`, `variant: 'warning'`, gated by `canBatchEnd`)
- `:loading="…"` extended to include `batchEndMutation.isPending.value`; closing modal `:loading="…"` line updated
- `:enable-row-selection` widened from `canBatchDelete` to `canBatchDelete || canBatchEnd`
- Test coverage in `PromotionsView.test.ts` (permissions, success, not-found, insufficient-permissions, label/color) and `promotion.api.test.ts` (dedup, min, max guards)
- New constant `BATCH_END_CAP = 100` (kept as a separate, semantically named const rather than renaming the existing one — minimizes diff in the archived SDD-10 pattern)

### Out of Scope

- Refactoring batch-delete + batch-end into a `useBatchAction` composable — premature at N=2; revisit when batch-terminate/reactivate for employees arrives
- Renaming `BATCH_DELETE_CAP` to `BATCH_CAP` — out of scope for this change to keep the diff focused
- New tests for `useServerTable` row selection mechanics — already covered
- Changes to `ConfirmModal`, `DataTableBulkActions`, `SelectColumn`, `AppDataTable` — all reusable as-is
- Changes to CASL `ability.ts` — `update:Promotion` already exists
- Per-row toggle behavior — the per-row `Finalizar` action and the bulk button must coexist so users can still end one promo without selecting it
- Optimistic cache updates — staying with the SDD-10 pattern: invalidate-on-success after the server confirms

## Approach

Mirror the batch-delete pattern verbatim, swapping only the deltas above. Implementation order, file layout, test names, and copy conventions match the SDD-10 work so a future reader sees one consistent bulk-action idiom in the file.

1. **API (`promotion.api.ts`)** — add `async batchEnd(ids: string[]): Promise<{ ended: number }>` next to `batchDelete`, dedup + cap guards return early (throw localized `Error` matching the existing style), POST `/promotions/batch-end`.
2. **Mutation (`PromotionsView.vue`)** — add `batchEndMutation` mirroring `batchDeleteMutation`, success payload `{ ended }`, error codes `BATCH_DELETE_NOT_FOUND` and `INSUFFICIENT_PERMISSIONS` (the backend shares the `BATCH_DELETE_NOT_FOUND` code across both batch endpoints per the integration doc — match the literal code).
3. **Gate + bulk action (`PromotionsView.vue`)** — `canBatchEnd` computed (same shape as `canBatchDelete`), single new entry in `bulkActions` (id `batch-end`, `variant: 'warning'`, copy "Finalizar", `confirmColor: 'warning'`), wired through `openConfirm` + `void batchEndMutation.mutateAsync(...)` closure capture exactly like the delete entry.
4. **Row selection (`AppDataTable`)** — flip `:enable-row-selection` to `canBatchDelete || canBatchEnd` so users with only `update:Promotion` (a broader permission) can still see checkboxes.
5. **Tests** — new cases parallel the SDD-10 cases for batch-delete: `BE-REQ-001` permission gate, success path, not-found toast, insufficient-permissions toast, label/color assertion.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/POS/promotions/api/promotion.api.ts` | Modified | Add `batchEnd(ids)` API method |
| `src/features/POS/promotions/views/PromotionsView.vue` | Modified | Add `batchEndMutation`, `canBatchEnd`, bulk action entry, extend `:loading` and `:enable-row-selection`, add `BATCH_END_CAP` |
| `src/features/POS/promotions/views/__tests__/PromotionsView.test.ts` | Modified | Test cases for batch-end behavior |
| `src/features/POS/promotions/api/__tests__/promotion.api.test.ts` | Modified | Test `batchEnd` API method guards |
| `src/features/POS/promotions/constants/index.ts` (if any) | Modified | Optional: add `BATCH_END_CAP = 100` if the existing constant lives outside the view |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Backend returns `BATCH_DELETE_NOT_FOUND` (404) for batch-end per the integration doc — error code naming does NOT change | Low | Match the literal code string `BATCH_DELETE_NOT_FOUND` in the error dispatch exactly as the backend emits it; comment in code to flag this for future readers |
| Broadening `:enable-row-selection` to `canBatchDelete || canBatchEnd` makes checkboxes visible to non-admin staff with only `update:Promotion` | Low | Intentional UX choice — those users do have a legitimate batch action ("Finalizar"). The bar shows only the action their permission unlocks, so a staff member without `batch_delete:Promotion` sees only one button, not two |
| Two bulk buttons appear simultaneously for users with both permissions — slightly busier bar | Low | Matches user expectation; the bulk-actions component already handles N actions in its array. No layout fix needed |
| `offendingIds` reuse is tempting but wrong — it only applies to the 409 reference error which batch-end does not raise | Medium | Reuse the simpler toast-only path from the SDD-10 `BATCH_DELETE_NOT_FOUND` branch. Refresh + clear selection is sufficient |
| Idempotency: backend treats re-ending an already-ENDED promo as no-op, not error | Low | Match backend behavior — no special UI. The invalidation on success will refresh `status` from the server response, which is fine because the response `{ ended: N }` reflects the count, not the new state; the list invalidate handles visibility |

## Rollback Plan

- Remove the `batch-end` entry from the `bulkActions` array
- Remove `batchEndMutation`, `canBatchEnd`, and `BATCH_END_CAP` from `PromotionsView.vue`
- Revert `:enable-row-selection` to `canBatchDelete`
- Remove `promotionApi.batchEnd` and its tests
- The server endpoint (`POST /promotions/batch-end`) stays available — no server rollback needed
- The CASL permission (`update:Promotion`) is unaffected

## Dependencies

- Backend endpoint `POST /promotions/batch-end` deployed and stable (per `houndfe-backend/docs/batch-operations-frontend.md`)
- Existing patterns: `ConfirmModal`, `DataTableBulkActions`, `SelectColumn`, `useMutation`, `authStore.userCan` — all in production
- The SDD-10 batch-delete work as the reference template

## Success Criteria

- [ ] Users with `update:Promotion` see a "Finalizar" bulk action in the sticky bar when rows are selected
- [ ] Confirming the modal calls `POST /promotions/batch-end` with the selected `ids`, shows a success toast on `{ ended: N }`, invalidates the promotions list, and clears the selection
- [ ] Backend 404 `BATCH_DELETE_NOT_FOUND` produces a localized toast and refreshes the list (already-ENDED promos disappear from active filters); the modal closes
- [ ] Backend 403 `INSUFFICIENT_PERMISSIONS` produces a localized toast; no mutation runs and selection is preserved
- [ ] Bulk action is invisible when `userCan('update', 'Promotion') === false`; checkboxes are hidden in that case
- [ ] `pnpm test:unit` passes new + existing tests; `pnpm build` succeeds with no type errors
- [ ] Code matches the SDD-10 batch-delete shape (mutation pattern, modal pattern, error dispatch pattern) — `git diff` should show only the documented deltas

## Capabilities

### New Capabilities

- `promotions-batch-end`: Bulk-end selection on the PromotionsView listing — admins finalize up to 100 promotions atomically through a `POST /promotions/batch-end` call gated by `update:Promotion`, surfaced as a `warning`-variant action in the existing bulk-actions bar.

### Modified Capabilities

- None. The existing `promotions` capability is scoped to form composition (target types, payload mapping, BXGY rules, error mapping). The PromotionsView listing surface — row selection, bulk actions, ConfirmModal confirmation flows — is a distinct concern and not part of the current spec.
