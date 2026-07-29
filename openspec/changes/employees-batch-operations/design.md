# Design: Employees Batch Operations

## Technical Approach

Mirror SDD-11 (`promotions-batch-end`) batch pattern: `AppDataTable` row selection + `DataTableBulkActions` sticky bar + `ConfirmModal` for simple confirmations + dedicated `BatchTerminateModal.vue` for the `reason` field that `ConfirmModal` cannot host. Three `useMutation` composables (separate, not a god composable) wire TanStack Query, toast, and cache invalidation. `useEmployeesList` gets a surgical extension — `rowSelection`, `selectedEmployees`, `clearSelection()` — no migration to `useServerTable`.

## Architecture Decisions

### Decision: Dedicated BatchTerminateModal instead of extending ConfirmModal

**Choice**: New `BatchTerminateModal.vue` with `UTextarea` + Zod validation.
**Alternatives considered**: Add an input slot to `ConfirmModal`.
**Rationale**: `ConfirmModal` has 26 callers — adding a slot risks regression on all of them. A dedicated component honors SRP: one modal, one concern (batch terminate with reason). The per-row `TerminateEmployeeDialog` cannot be reused either — its DTO is `{ terminationDate, terminationReason }` while the batch DTO is `{ ids, reason }`.

### Decision: Three separate mutation composables instead of one `useBatchOperations`

**Choice**: `useBatchDeleteEmployee`, `useBatchTerminateEmployee`, `useBatchReactivateEmployee` — each owning its own `useMutation`.
**Alternatives considered**: One composable with `operation: 'delete' | 'terminate' | 'reactivate'` parameter.
**Rationale**: Each mutation has a different `mutationFn` signature (batch-delete takes `ids[]`, batch-terminate takes `ids[] + reason`, batch-reactivate takes `ids[]`), different toast messages, and slightly different `onError` dispatch. Composition trumps parameterization — callers compose the one they need.

### Decision: Invalidate-only on success (no optimistic update)

**Choice**: `queryClient.invalidateQueries({ queryKey: employeeQueryKeys.paginated(tenantId) })` after every mutation.
**Alternatives considered**: `setQueryData` optimistic update.
**Rationale**: Batch operations are destructive/state-mutating by nature — stale cache is dangerous. Invalidation ensures the next render shows authoritative server state. Matches the existing `useTerminateEmployee` pattern.

## Data Flow

```
User selects rows → rowSelection (Record<string, boolean>) updates
  → selectedEmployees (ComputedRef<Employee[]>) derived from rowSelection + employees
    → bulkActions computed re-evaluates: button labels show "(N)", disabled when n===0 || n>100
      → User clicks action
        ├── [batch-delete]: openDeleteConfirm() → ConfirmModal lists selected (name+status+red cascade warning)
        ├── [batch-terminate]: openTerminateModal() → BatchTerminateModal lists selected + UTextarea
        └── [batch-reactivate]: openReactivateConfirm() → ConfirmModal lists selected (name+status, success color)
          → User confirms → mutation.mutateAsync(ids, reason?) fires
            ├── 200: toast + queryClient.invalidateQueries(paginated) + clearSelection() + close modal
            ├── 404 (BATCH_DELETE_NOT_FOUND): warning toast + invalidate + clearSelection() + close modal
            └── 403 (INSUFFICIENT_PERMISSIONS): error toast + preserve selection (modal stays open)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/features/admin/employees/api/employees.api.ts` | Modify | Add `batchDelete(ids)`, `batchTerminate(ids, reason)`, `batchReactivate(ids)` — each with `Set` dedup, throw on empty/>100 |
| `src/features/admin/employees/composables/useEmployeesList.ts` | Modify | Add `rowSelection`, `selectedEmployees`, `clearSelection()`. Add `watch` on `[statusTab, search]` → reset selection |
| `src/features/admin/employees/composables/useBatchDeleteEmployee.ts` | New | `useMutation<{ deleted: number }>` wrapping `employeesApi.batchDelete` |
| `src/features/admin/employees/composables/useBatchTerminateEmployee.ts` | New | `useMutation<{ updated: number }>` wrapping `employeesApi.batchTerminate` |
| `src/features/admin/employees/composables/useBatchReactivateEmployee.ts` | New | `useMutation<{ updated: number }>` wrapping `employeesApi.batchReactivate` |
| `src/features/admin/employees/components/BatchTerminateModal.vue` | New | `UModal` + scrollable employee list + `UTextarea` with Zod `reason` validation + emits `confirm(reason)` |
| `src/features/admin/employees/views/EmployeesListView.vue` | Modify | Import 3 composables + `BatchTerminateModal` + `ConfirmModal` + `SelectColumn`; wire `enable-row-selection` + `v-model:row-selection` + `bulkActions` + select slots + 3 modals |
| `src/features/admin/employees/interfaces/employee.types.ts` | Modify | Add `BatchTerminateDto` interface + `BatchTerminateDtoSchema` (Zod: `reason: z.string().min(1)`) |
| `src/features/admin/employees/interfaces/errors.ts` | Modify | Add `BATCH_DELETE_NOT_FOUND` and `INSUFFICIENT_PERMISSIONS` to `EmployeeDomainErrorCode` union + `EMPLOYEE_ERROR_MAP` entries |

## Interfaces / Contracts

### API Methods (added to `employeesApi`)

```typescript
batchDelete(ids: string[]): Promise<{ deleted: number }>
batchTerminate(ids: string[], reason: string): Promise<{ updated: number }>
batchReactivate(ids: string[]): Promise<{ updated: number }>
```

All three: deduplicate via `Array.from(new Set(ids))`, throw `Error` on empty or >100.

### BatchTerminateModal

```
Props:  open: boolean, employees: { id, fullName, status }[], loading: boolean
Emits:  update:open(value: boolean), confirm(reason: string)
Zod:    BatchTerminateDtoSchema = z.object({ reason: z.string().min(1, 'El motivo es requerido') })
```

### Composable Signatures

```
useBatchDeleteEmployee()    → { mutateAsync: (ids: string[]) => Promise<{ deleted: number }>, isPending: Ref<boolean> }
useBatchTerminateEmployee() → { mutateAsync: (ids: string[], reason: string) => Promise<{ updated: number }>, isPending: Ref<boolean> }
useBatchReactivateEmployee()→ { mutateAsync: (ids: string[]) => Promise<{ updated: number }>, isPending: Ref<boolean> }
```

### useEmployeesList Extensions

```
New return fields:
  rowSelection: Ref<RowSelectionState>      // v-model for AppDataTable
  selectedEmployees: ComputedRef<Employee[]> // derived: employees.filter(e => rowSelection.value[e.id])
  clearSelection(): void                     // rowSelection.value = {}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (API) | `batchDelete`/`batchTerminate`/`batchReactivate` client guards (empty/>100/dedup) | Mock `http`, assert pre-flight throws |
| Unit (composable) | `useBatchDeleteEmployee` onSuccess/onError dispatch (200/404/403) | Mock `employeesApi`, `useToast`, `queryClient`; assert toast calls + invalidate queries |
| Unit (composable) | `useEmployeesList` rowSelection derived values + clear on filter | Create employees fixture, set rowSelection, assert `selectedEmployees`, call `clearSelection`, assert `{}` |
| Unit (view) | CASL gate: `batch_delete:Employee` shows delete; `update:Employee` shows terminate+reactivate; no perms hides everything | Mock `authStore.userCan`, render view, assert button presence/absence |
| Unit (view) | Modal wiring: delete opens ConfirmModal with cascade warning; terminate opens BatchTerminateModal; reactivate opens ConfirmModal with success color | Mock modals, assert open state + props |
| Unit (modal) | `BatchTerminateModal` Zod validation: confirm disabled when empty, enabled when filled, emits `confirm(reason)` on submit | Render, fill textarea, assert emit |
| Integration | Full flow: select rows → confirm → toast + list refresh | E2E or component integration test with real queryClient |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. This is a frontend UI wiring change against existing REST endpoints.

## Migration / Rollout

No migration required. Feature gated entirely by CASL permissions — buttons only render when the user's role has `batch_delete:Employee` or `update:Employee`. Backend endpoints already deployed.

## Open Questions

- [ ] Does `BulkAction.variant` need `'primary'` added to the union (`'default' | 'destructive' | 'warning'`)? Reactivate button should be primary/success tone — check if `DataTableBulkActions` renders `'default'` as primary or neutral before adding to union.
