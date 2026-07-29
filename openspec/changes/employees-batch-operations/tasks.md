# Tasks: Employees Batch Operations

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

Changed lines ~1100 (code ~700 + tests ~400). Files 11 (4 new + 7 mod). Commits 5 work units. Delivery `exception-ok` (solo dev, direct merge to main).

## Phase 1: Types & API

- [x] 1.1 RED `wu12c-batch-types.spec.ts` — Zod rejects empty/whitespace, accepts `'Reorg'`
- [x] 1.2 GREEN add `BatchTerminateDto` + Zod schema in `employee.types.ts`
- [x] 1.3 RED API guard spec — `batchDelete`/`batchTerminate`/`batchReactivate` throw on empty or >100, dedup via `Set`, no HTTP
- [x] 1.4 GREEN add 3 batch methods to `employees.api.ts` (POST `/admin/employees/batch-{delete,terminate,reactivate}`)
- [x] 1.5 RED error-map spec — `BATCH_DELETE_NOT_FOUND` + `INSUFFICIENT_PERMISSIONS` resolve to Spanish
- [x] 1.6 GREEN extend `errors.ts` union + map with 2 codes
- [x] 1.7 RED `BulkAction.variant` accepts `'primary'`; `DataTableBulkActions` maps to Nuxt `'primary'` color
- [x] 1.8 GREEN extend `BulkAction.variant` union in `table.types.ts`; map `'primary' → 'primary'` in `DataTableBulkActions.vue`

## Phase 2: Composables

- [x] 2.1 RED `useEmployeesList` spec — `selectedEmployees` derives `rowSelection`×`employees`; `clearSelection()` empties; filter watch clears
- [x] 2.2 GREEN extend `useEmployeesList.ts` — add `rowSelection`, `selectedEmployees`, `clearSelection()`, `watch([statusTab, search])` reset (existing spec stays green)
- [x] 2.3 RED `useBatchDeleteEmployee` spec — 200 toast+invalidate; `BATCH_DELETE_NOT_FOUND` warn+invalidate+clear; `INSUFFICIENT_PERMISSIONS` error+preserve
- [x] 2.4 GREEN create `useBatchDeleteEmployee.ts` (reuse `extractDomainErrorCode`)
- [x] 2.5 RED `useBatchTerminateEmployee` spec — same dispatch with `reason`
- [x] 2.6 GREEN create `useBatchTerminateEmployee.ts`
- [x] 2.7 RED `useBatchReactivateEmployee` spec
- [x] 2.8 GREEN create `useBatchReactivateEmployee.ts`

## Phase 3: BatchTerminateModal

- [x] 3.1 RED `BatchTerminateModal.spec.ts` — confirm disabled when `reason.trim()===''`; enabled when filled; emits `confirm(reason)`; Zod rejects whitespace; loading disables buttons
- [x] 3.2 GREEN create `components/BatchTerminateModal.vue` (`UModal` + scrollable list + `UTextarea` + Zod form)

## Phase 4: View Integration

- [x] 4.1 RED view spec — `canBatchDelete` true only with `batch_delete:Employee`; checkboxes hidden when all gates false
- [x] 4.2 GREEN add 3 CASL gates
- [x] 4.3 RED view spec — `bulkActions` returns 3 entries (delete+destructive, terminate+warning, reactivate+primary); `[]` when `viewMode==='cards'`; disabled when `n===0||n>100`
- [x] 4.4 GREEN add `bulkActions` computed + `BATCH_OPS_CAP=100`
- [x] 4.5 RED view spec — `:enable-row-selection` true only when `viewMode==='table'`; selection cleared on filter/page/view change
- [x] 4.6 GREEN wire `AppDataTable` with `:enable-row-selection`, `v-model:row-selection`, `#select-header` + `#select-cell` slots via `SelectColumn`
- [x] 4.7 RED view spec — delete opens `ConfirmModal` (cascade, error); terminate opens `BatchTerminateModal`; reactivate opens `ConfirmModal` (success); `:loading` ORs 3 `isPending`
- [x] 4.8 GREEN import 3 mutations + `BatchTerminateModal` + 2 `ConfirmModal`s; wire open/confirm/close + OR-merge `isPending`

## Phase 5: Verification

- [x] 5.1 `pnpm test:unit --run` — full green; WU-02..WU-12B employees specs unaffected
- [x] 5.2 `pnpm type-check` — zero errors; Customers/Products/Promotions views still pass
- [x] 5.3 `pnpm build` — production bundle clean
- [x] 5.4 Smoke success — 3 selected → cascade modal → toast "3 empleados eliminados"; repeat for terminate (reason "Reorg") + reactivate (all-terminated)
- [x] 5.5 Smoke card view — bar hidden, no checkboxes; back to table → selection cleared
- [x] 5.6 Smoke error dispatch — 404 (delete then re-batch) → warn + refresh + clear; 403 (no `batch_delete:Employee`) → error + selection preserved