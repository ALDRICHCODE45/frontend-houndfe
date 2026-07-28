# Apply Progress — employees-batch-operations

Branch: `sdd-12-employees-batch-operations`

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
