# Apply Progress — employees-batch-operations

Branch: `sdd-12-employees-batch-operations`

## Phase 2: Composables — ✅ COMPLETE

### Tasks completed

- [x] **2.1** RED composables spec — rowSelection/selectedEmployees/clearSelection
- [x] **2.2** GREEN extended `useEmployeesList.ts` — added `rowSelection`, `selectedEmployees`, `clearSelection()`, `watch([statusTab, search])` reset
- [x] **2.3** RED `useBatchDeleteEmployee` spec — 200/404/403 dispatch
- [x] **2.4** GREEN created `useBatchDeleteEmployee.ts`
- [x] **2.5** RED `useBatchTerminateEmployee` spec — same dispatch with reason
- [x] **2.6** GREEN created `useBatchTerminateEmployee.ts`
- [x] **2.7** RED `useBatchReactivateEmployee` spec
- [x] **2.8** GREEN created `useBatchReactivateEmployee.ts`

### Files changed

- **added** `src/features/admin/employees/__tests__/wu12-batch-composables.spec.ts` (20 RED specs)
- **added** `src/features/admin/employees/composables/useBatchDeleteEmployee.ts`
- **added** `src/features/admin/employees/composables/useBatchTerminateEmployee.ts`
- **added** `src/features/admin/employees/composables/useBatchReactivateEmployee.ts`
- **modified** `src/features/admin/employees/composables/useEmployeesList.ts` (added rowSelection + selectedEmployees + clearSelection + watch)

### Verification

- `pnpm test:unit -- wu12-batch-composables.spec.ts` → 20/20 PASS
- `pnpm test:unit` (full suite) → 3029/3029 PASS
- `pnpm type-check` → zero errors
- `pnpm build` → production bundle clean

### Notes

- Composables intentionally do NOT receive `rowSelection` from the caller —
  the view layer calls `useEmployeesList.clearSelection()` after a successful
  batch (see `wu12-batch-composables.spec.ts:119-127`). This keeps mutation
  composables decoupled from the list composable.
- Tested via TanStack Query mutationOptions capture pattern (mock useMutation
  to capture options, invoke onSuccess/onError directly) — avoids standing
  up a full Vue app while still proving the dispatch contract.
- `INSUFFICIENT_PERMISSIONS` dispatch does NOT call `invalidateQueries` —
  selection is preserved at the view layer (caller does NOT clear on 403).

## Phase 1: Types & API — ✅ COMPLETE

### Tasks completed

- [x] **1.1** RED `wu12-batch-types-api.spec.ts` — Zod rejects empty/whitespace, accepts 'Reorg'
- [x] **1.2** GREEN added `BatchTerminateDto` + `BatchTerminateDtoSchema` in `employee.types.ts`
- [x] **1.3** RED API guard spec — `batchDelete`/`batchTerminate`/`batchReactivate` throw on empty or >100, dedup via `Set`, no HTTP
- [x] **1.4** GREEN added 3 batch methods to `employees.api.ts` (POST `/admin/employees/batch-{delete,terminate,reactivate}`)
- [x] **1.5** RED error-map spec — `BATCH_DELETE_NOT_FOUND` + `INSUFFICIENT_PERMISSIONS` resolve to Spanish
- [x] **1.6** GREEN extended `errors.ts` union + map with 2 codes
- [x] **1.7** RED `BulkAction.variant` accepts `'primary'`; `DataTableBulkActions` maps to Nuxt `'primary'` color
- [x] **1.8** GREEN extended `BulkAction.variant` union in `table.types.ts`; map `'primary' → 'primary'` in `DataTableBulkActions.vue`

### Files changed

- **added** `src/features/admin/employees/__tests__/wu12-batch-types-api.spec.ts` (25 RED specs)
- **modified** `src/features/admin/employees/interfaces/employee.types.ts` (BatchTerminateDto + Zod)
- **modified** `src/features/admin/employees/interfaces/errors.ts` (BATCH_DELETE_NOT_FOUND + INSUFFICIENT_PERMISSIONS)
- **modified** `src/features/admin/employees/api/employees.api.ts` (batchDelete / batchTerminate / batchReactivate)
- **modified** `src/core/shared/types/table.types.ts` (BulkAction.variant extended with 'primary')
- **modified** `src/core/shared/components/DataTable/DataTableBulkActions.vue` (variant → Nuxt color map)

### Verification

- `pnpm test:unit -- src/features/admin/employees/__tests__/wu12-batch-types-api.spec.ts` → 25/25 PASS
- `pnpm test:unit` (full suite) → 3009/3009 PASS
- `pnpm type-check` → zero errors
- `pnpm build` → production bundle clean

### Notes

- Backend reuses literal `BATCH_DELETE_NOT_FOUND` for all 3 batch endpoints — comment added in `employees.api.ts` + `errors.ts`.
- `batchTerminate` API trims reason client-side before POST — guards against whitespace.
- `BatchTerminateDtoSchema` validates only the `reason` field (form-level); `ids[]` is API-level.

## Phase 3: BatchTerminateModal — ✅ COMPLETE

### Tasks completed

- [x] **3.1** RED `BatchTerminateModal.spec.ts` — reason validity, confirm/cancel emits, loading state, employee list
- [x] **3.2** GREEN created `components/BatchTerminateModal.vue` with a scrollable employee list and Zod-backed reason form

### Files changed

- **added** `src/features/admin/employees/components/BatchTerminateModal.vue`
- **added** `src/features/admin/employees/components/__tests__/BatchTerminateModal.spec.ts`

### Verification

- `pnpm exec vitest run src/features/admin/employees/components/__tests__/BatchTerminateModal.spec.ts` → 9/9 PASS
- `pnpm type-check` → zero errors

### Notes

- Nuxt auto-imports UI components under resolved names (`Modal`, `Form`, `FormField`, `Textarea`, `Button`) in unit tests; stubs use those names so the modal remains isolated from router and teleport behavior.

## Phase 4: View Integration — ✅ COMPLETE

### Tasks completed

- [x] **4.1–4.2** Added independent CASL gates for delete, terminate, and reactivate
- [x] **4.3–4.4** Added permission-gated bulk actions with the 100-row cap and card-view guard
- [x] **4.5–4.6** Wired row selection, select slots, and selection clearing on page/view/filter changes
- [x] **4.7–4.8** Wired delete, terminate, and reactivate modals to their mutation composables with merged pending state

### Files changed

- **modified** `src/features/admin/employees/views/EmployeesListView.vue`
- **added** `src/features/admin/employees/views/__tests__/EmployeesListView.batch.spec.ts`

### Verification

- `pnpm exec vitest run src/features/admin/employees/views/__tests__/EmployeesListView.batch.spec.ts src/features/admin/employees/components/__tests__/BatchTerminateModal.spec.ts` → 14/14 PASS
- `pnpm type-check` → zero errors

### Notes

- The project view-mode contract uses `'card'` (singular), despite the SDD prose using `'cards'`; the integration follows the typed project contract.
- Batch 404 responses clear selection and close the modal; permission and unknown failures preserve both so the user can retry.
- Existing per-row terminate/reactivate dialogs remain unchanged and coexist with the batch modals.
