# Proposal: Employees Batch Operations

## Intent

Backend exposes three batch endpoints (`batch-delete`, `batch-terminate`, `batch-reactivate`) but `EmployeesListView` only supports per-row actions — finishing N employees takes N modals. Wire the sticky bulk-actions bar (proven in `PromotionsView`) so admins act on up to 100 employees atomically. Three operations, one pattern, three risk profiles. The `reason` field on `batch-terminate` is the pivot: `ConfirmModal` can't host inputs, so a dedicated `BatchTerminateModal.vue` is required. Delete + reactivate reuse `ConfirmModal`.

## Scope

### In Scope
- `employeesApi.batchDelete / batchTerminate / batchReactivate` with dedup + cap=100
- 3 mutation composables: `useBatch{Delete,Terminate,Reactivate}Employee`
- `BatchTerminateModal.vue` (textarea, Zod, selected list, emits `confirm(reason)`)
- `useEmployeesList` extended with `rowSelection` + `selectedEmployees` + `clearSelection()`
- CASL: `canBatchDelete` (`batch_delete:Employee`), `canBatchTerminate` / `canBatchReactivate` (`update:Employee`)
- Bulk-actions bar in table view only; `BatchTerminateDtoSchema`; `errors.ts` extended
- Error dispatch: `BATCH_DELETE_NOT_FOUND` (warn + invalidate + clear), `INSUFFICIENT_PERMISSIONS` (error + preserve)
- Tests: API guards, composable selection, view perms + success/error paths

### Out of Scope
- `useEmployeesList` → `useServerTable` migration
- Card view batch selection (click-to-navigate UX conflict)
- Extending `ConfirmModal` with input slot (SRP, 26 callers)
- Reusing per-row `TerminateEmployeeDialog` (mismatched DTO)
- Optimistic updates, per-employee reasons

## Capabilities

### New Capabilities
- `employees-batch-operations`: Bulk operations on `EmployeesListView` — admins delete (hard, cascade), terminate (soft, shared `reason`), or reactivate up to 100 employees atomically. Selection infra, CASL gates, three mutations, dedicated batch-terminate modal, table-only bulk-actions bar.

### Modified Capabilities
- None. No existing Employees spec; `promotions/spec.md` is scoped to form composition (per SDD-11).

## Approach

Mirror SDD-11 (`promotions-batch-end`) verbatim, adapted for 3 mutations + `reason`.

1. **API** (`employees.api.ts`): 3 methods, dedup + min/max guards (mirrors `promotion.api.ts:120`).
2. **Mutations** (3 new): `useMutation` per `useTerminateEmployee.ts` (invalidate paginated + detail; dispatch on `err.response?.data?.error`).
3. **Row selection** (`useEmployeesList`): surgical extension — `rowSelection`, `selectedEmployees`, `clearSelection()`. No migration.
4. **`BatchTerminateModal.vue`**: owns `UForm` + `UTextarea` + Zod; emits `confirm(reason)`; inline list. SRP — `ConfirmModal` untouched.
5. **Bulk actions** (`bulkActions` computed): 3 entries, perms-gated, `disabled: n === 0 || n > 100`. Delete + reactivate → `ConfirmModal`; terminate → dedicated modal.
6. **Filter guard**: `watch([statusTab, search])` resets `page = 1` + clears `rowSelection` (mirrors `PromotionsView.vue:148`).
7. **View gate**: `:enable-row-selection` true only when `viewMode === 'table'`.
8. **`reason`**: single shared string for ALL selected (atomic backend). No per-employee reasons in v1.

## Affected Areas

| Area | Impact |
|------|--------|
| `employees.api.ts` | Modified — 3 batch methods |
| `useEmployeesList.ts` | Modified — row selection |
| `useBatch{Delete,Terminate,Reactivate}Employee.ts` | New (×3) |
| `BatchTerminateModal.vue` | New |
| `EmployeesListView.vue` | Modified — wiring |
| `interfaces/{employee.types.ts,errors.ts}` | Modified — Zod + codes |
| `__tests__/*` | Modified — guards + perms |

## Risks

| Risk | Mitigation |
|------|------------|
| `batch-delete` cascade is irreversible (salary/position/documents/time-off/contacts) | Modal in `error` color; explicit "destruirá historial" listing 5 tables; UI recommends `batch-terminate` |
| `RowSelectionState` keys are page-relative — stale on filter/page change | `watch([statusTab, search])` resets selection (mirrors `PromotionsView.vue:148`) |
| `batch-terminate` requires `reason` — extending `ConfirmModal` risks 26-caller regression | Dedicated `BatchTerminateModal.vue`; `ConfirmModal` untouched |
| Card view loses batch capability | Industry standard; users switch to table |
| Backend reuses literal `BATCH_DELETE_NOT_FOUND` across all 3 batch endpoints | Match literal in dispatch; comment flags it (mirrors `PromotionsView.vue:339`) |
| `batch_delete:Employee` not granted backend-side yet | Buttons silently hidden — desired; CASL already supports the action |
| 3 mutations × 3 `isPending` flags — loading OR must be correct | OR all three in each modal's `:loading` (mirrors `PromotionsView.vue:499`) |

## Rollback Plan

Remove 3 bulk-action entries + `rowSelection`/`selectedEmployees`/`clearSelection`; delete 3 mutation composables + `BatchTerminateModal.vue`; revert API + Zod + error-map additions. Backend endpoints stay available — no server rollback.

## Dependencies

- Backend endpoints deployed (per `houndfe-backend/docs/batch-operations-frontend.md`)
- Existing infra: `AppDataTable`, `SelectColumn`, `DataTableBulkActions`, `ConfirmModal`, `BulkAction<T>`, `useMutation`, `authStore.userCan`
- SDD-10 + SDD-11 as reference templates

## Success Criteria

- [ ] `batch_delete:Employee` users see red "Eliminar (N)" → `POST /admin/employees/batch-delete`, cascade warning, invalidate + clear on success
- [ ] `update:Employee` users see "Dar de baja (N)" → `BatchTerminateModal` requires `reason` (≥1 char) → `POST /admin/employees/batch-terminate`
- [ ] `update:Employee` users see "Reactivar (N)" → `ConfirmModal` → `POST /admin/employees/batch-reactivate`
- [ ] Buttons disabled when `n === 0 || n > 100`; checkboxes hidden when no batch perms; card view shows NO bulk-action bar
- [ ] 404 `BATCH_DELETE_NOT_FOUND` → warning + invalidate + clear; 403 → error + preserve selection
- [ ] `pnpm test:unit` + `pnpm build` clean
- [ ] `ConfirmModal.vue` unchanged (zero diff); 26 callers stay green