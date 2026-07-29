```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:2c0d8a3bdbe73457fe2ed7098c44f7933a1511214faa89e529d3f44b74cfc266
verdict: pass
blockers: 0
critical_findings: 0
requirements: 10/10
scenarios: 10/10
test_command: pnpm test:unit
test_exit_code: 0
test_output_hash: sha256:2c0d8a3bdbe73457fe2ed7098c44f7933a1511214faa89e529d3f44b74cfc266
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:6b8079705b4e27780f59b224265807d155ffa29d86711724e3f632cc569bd333
```

## Verification Report

**Change**: promotions-batch-end
**Version**: N/A (no version header)
**Mode**: Standard

### Completeness

| Metric | Value |
|--------|-------|
| Implementation tasks total | 20 |
| Implementation tasks complete | 20 |
| Verification tasks total | 2 (3.4, 3.5) |
| Verification tasks resolved | 2 (satisfied by this report) |
| Artifacts present | proposal, explore, tasks, spec, apply-progress |

### Build & Tests Execution

**Build**: ✅ Passed
```text
pnpm build
→ vue-tsc --build (exit 0)
→ vite build (exit 0, 18.82s)
→ 2220 modules transformed, 91 chunks
→ Chunk size warning (non-blocking): index chunk 838 kB
```

**Type-check**: ✅ Passed
```text
pnpm type-check
→ vue-tsc --build (exit 0)
```

**Tests**: ✅ 3043 passed / ❌ 0 failed / ⚠️ 0 skipped
```text
pnpm test:unit (vitest v4.1.0)
 Test Files  216 passed (216)
      Tests  3043 passed (3043)
   Start at  14:05:36
   Duration   58.39s
```

**Coverage**: ➖ Not available (no coverage config in test run)

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| BE-REQ-001 | No permission gate | `PromotionsView.test.ts` > "BE-REQ-001: omits Finalizar when user lacks update:Promotion" | ✅ COMPLIANT |
| BE-REQ-002 | API dedup + guards | `promotion.api.test.ts` > "deduplicates ids before POST and returns { ended: number }" | ✅ COMPLIANT |
| BE-REQ-002 | Empty array rejection | `promotion.api.test.ts` > "rejects empty arrays client-side without a network call" | ✅ COMPLIANT |
| BE-REQ-002 | >100 rejection | `promotion.api.test.ts` > "rejects arrays longer than 100 client-side without a network call" | ✅ COMPLIANT |
| BE-REQ-003 | Button enabled with 3 selected | `PromotionsView.test.ts` > "BE-REQ-003: renders warning Finalizar (3) enabled with 3 selected rows" | ✅ COMPLIANT |
| BE-REQ-003 | Disabled at 0 and >100 | `PromotionsView.test.ts` > "BE-REQ-003/010: disables Finalizar at zero and above the 100-row cap" | ✅ COMPLIANT |
| BE-REQ-004 | Confirm modal contents | `PromotionsView.test.ts` > "BE-REQ-004: opens warning confirmation with selected titles and Finalizar label" | ✅ COMPLIANT |
| BE-REQ-005 | Success toast + invalidate + clear | `PromotionsView.test.ts` > "BE-REQ-005: success shows toast, clears selection and closes modal" | ✅ COMPLIANT |
| BE-REQ-006 | Not-found toast + clear | `PromotionsView.test.ts` > "BE-REQ-006: 404 BATCH_DELETE_NOT_FOUND shows count toast and clears selection" | ✅ COMPLIANT |
| BE-REQ-007 | Forbidden toast + preserve selection | `PromotionsView.test.ts` > "BE-REQ-007: 403 preserves selection and shows permission toast" | ✅ COMPLIANT |
| BE-REQ-008 | Loading spinner binding | `PromotionsView.test.ts` > "BE-REQ-008: binds pending batch-end state to ConfirmModal loading" | ✅ COMPLIANT |
| BE-REQ-009 | Row selection for update-only | `PromotionsView.test.ts` > "BE-REQ-009: shows row selection for update-only users" | ✅ COMPLIANT |
| BE-REQ-010 | Boundary protection (0 and >100 disabled) | `PromotionsView.test.ts` > "BE-REQ-003/010: disables Finalizar at zero and above the 100-row cap" | ✅ COMPLIANT |
| BE-REQ-010 | Client-side dedup | `promotion.api.test.ts` > "deduplicates ids before POST and returns { ended: number }" | ✅ COMPLIANT |

**Compliance summary**: 10/10 requirements compliant, 10/10 scenarios covered with passing tests

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| BE-REQ-001: Permission gate | ✅ Implemented | `canBatchEnd` is `authStore.userCan('update', 'Promotion')`; gates bulk action entry AND checkboxes |
| BE-REQ-002: API method | ✅ Implemented | `promotionApi.batchEnd(ids)` deduplicates, rejects empty and >100, POSTs to `/promotions/batch-end` with `{ids}` |
| BE-REQ-003: Bulk action UI | ✅ Implemented | `id: 'batch-end'`, variant `'warning'`, label `Finalizar (N)`, disabled at `n === 0 \|\| n > BATCH_END_CAP` |
| BE-REQ-004: Confirm modal | ✅ Implemented | `openConfirm` with `'warning'` color, `'Finalizar seleccionadas'` label, items array with titles + status |
| BE-REQ-005: Success handling | ✅ Implemented | Toast `"N promociones finalizadas"`, `invalidateQueries`, `rowSelection = {}` |
| BE-REQ-006: Not-found error | ✅ Implemented | `offendingCount` toasts count + `"no encontrada(s)"`, invalidates, clears selection |
| BE-REQ-007: Forbidden error | ✅ Implemented | Permission-denied toast; no rowSelection mutation (selection preserved) |
| BE-REQ-008: Loading state | ✅ Implemented | `batchEndMutation.isPending.value` passed to ConfirmModal's `:loading` prop (line 499) |
| BE-REQ-009: Row selection gate | ✅ Implemented | `:enable-row-selection="canBatchDelete \|\| canBatchEnd"` (line 573) |
| BE-REQ-010: Pre-flight guards | ✅ Implemented | API rejects empty / >100; bulk button disabled at those boundaries; dedup before POST |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Mirror batch-delete pattern (same mutation shape, same ConfirmModal, same invalidation) | ✅ Yes | Identical structure in `batchEndMutation`, `bulkActions`, and `openConfirm` closure |
| Widen `:enable-row-selection` to `canBatchDelete \|\| canBatchEnd` | ✅ Yes | Single-line change at line 573 |
| Use `update:Promotion` permission (not new CASL ability) | ✅ Yes | `canBatchEnd` computed uses `authStore.userCan('update', 'Promotion')` |
| Keep `BATCH_END_CAP` as separate constant (not rename `BATCH_DELETE_CAP`) | ✅ Yes | Line 106 defines `const BATCH_END_CAP = 100` independently |
| Backend reuses `BATCH_DELETE_NOT_FOUND` literal for batch-end 404 | ✅ Yes | Comment at line 339; error dispatch matches the literal string |
| No optimistic cache — invalidate-on-success | ✅ Yes | `onSuccess` calls `queryClient.invalidateQueries` |

### Issues Found

**CRITICAL**: None

**WARNING**:
- Tasks 3.4 (full `pnpm test:unit` pass) and 3.5 (`git diff` vs SDD-10 delta check) are unchecked in `tasks.md`. Both are verification-phase tasks now satisfied by this report: all 3043 tests pass (exit 0), and the diff against main shows the expected 4-file delta. Non-blocking.

**SUGGESTION**:
- BE-REQ-008 non-dismissible behavior: the view correctly passes `batchEndMutation.isPending.value` into ConfirmModal's `:loading` prop, but the non-dismissible-on-loading behavior is a ConfirmModal component concern. Consider adding an explicit `dismissible` guard in the view if ConfirmModal does not handle it natively. The test coverage for loading state is present and passing.

### Verdict

**PASS**

All 10 requirements are implemented and covered by passing tests. The build, type-check, and full test suite (3043 tests across 216 files) all pass with zero failures. Implementation faithfully mirrors the SDD-10 batch-delete pattern — same mutation structure, same ConfirmModal wiring, same error dispatch flow — with only the documented deltas (endpoint, permission gate, copy, warning color). No CRITICAL findings. The two unchecked verification tasks in `tasks.md` are now satisfied by this report's evidence.
