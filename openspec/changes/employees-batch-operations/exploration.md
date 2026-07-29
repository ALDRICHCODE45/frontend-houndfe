## Exploration: employees-batch-operations

### Current State

The Employees list page (`EmployeesListView.vue`) uses a custom TanStack Query composable (`useEmployeesList`) — NOT `useServerTable` — which lacks built-in row selection, bulk actions, and column pinning. The view supports two modes (table + card grid) via a `ViewToggle` component. Per-row actions (edit, terminate, reactivate) use dedicated dialog/slideover components wired through `getEmployeeRowActions()`.

The CASL ability system already supports `batch_delete` as an action and `Employee` as a subject, so `batch_delete:Employee` will parse correctly with zero changes to `ability.ts` or `auth.types.ts`.

The shared `AppDataTable` already supports `enableRowSelection`, `v-model:rowSelection`, `bulkActions`, and renders `DataTableBulkActions` when rows are selected. The `ConfirmModal` supports an `items` prop for listing selected rows but does NOT support input fields (textarea, date picker, etc.).

The promotions batch pattern (`PromotionsView.vue`) is the proven reference: it uses `useServerTable` → gets `rowSelection`, `selectedRows`, `data` for free → wires `bulkActions` computed → `ConfirmModal` confirms → mutation fires.

### Affected Areas

**Files to create (NEW):**
- `src/features/admin/employees/composables/useBatchTerminateEmployee.ts` — mutation composable for batch-terminate (needs `reason` in body)
- `src/features/admin/employees/composables/useBatchDeleteEmployee.ts` — mutation composable for batch-delete (hard delete with cascade, needs special warnings)
- `src/features/admin/employees/composables/useBatchReactivateEmployee.ts` — mutation composable for batch-reactivate
- `src/features/admin/employees/components/BatchTerminateModal.vue` — modal with textarea input for termination reason + selected employees list
- `src/features/admin/employees/components/BatchDeleteModal.vue` — modal with extra cascade warnings for hard delete
- `src/features/admin/employees/components/BatchReactivateModal.vue` — modal listing selected employees (uses `ConfirmModal` directly)

**Files to modify (EXISTING):**
- `src/features/admin/employees/views/EmployeesListView.vue` — add row selection, bulk actions bar, view-mode guard, modals
- `src/features/admin/employees/composables/useEmployeesList.ts` — add `rowSelection` ref and `selectedRows` computed
- `src/features/admin/employees/api/employees.api.ts` — add `batchDelete()`, `batchTerminate()`, `batchReactivate()` methods
- `src/core/shared/components/ConfirmModal.vue` — **possibly** extend with optional input slot (see Approach 2 for `reason` problem)
- `src/features/admin/employees/components/EmployeeFilters.vue` — may need adjustment if filters clear selection

**Files to NOT touch:**
- `src/features/auth/authorization/ability.ts` — `batch_delete` action already defined, `Employee` subject already defined. No changes needed.
- `src/features/auth/interfaces/auth.types.ts` — `AppAction` already includes `batch_delete`. No changes needed.
- `src/core/shared/components/DataTable/AppDataTable.vue` — already fully supports `enableRowSelection`, `v-model:rowSelection`, `bulkActions`
- `src/core/shared/components/DataTable/DataTableBulkActions.vue` — works as-is
- `src/core/shared/components/DataTable/SelectColumn.vue` — already reusable
- `src/features/admin/employees/components/EmployeeCardGrid.vue` — NO changes needed (batch ops are table-only, see below)
- `src/features/admin/employees/components/EmployeeCard.vue` — NO changes needed
- `src/features/admin/employees/components/TerminateEmployeeDialog.vue` — per-row dialog, untouched (batch terminate has different body shape)
- `src/features/admin/employees/components/ReactivateEmployeeDialog.vue` — per-row dialog, untouched

### Approaches

#### 1. `reason` Input Problem — Recommended Solution

**Option A: Create dedicated `BatchTerminateModal.vue` (RECOMMENDED)**

Create a new component that accepts `selectedEmployees: Employee[]` plus `loading` props. It renders:
- A scrollable list of selected employee names (like `ConfirmModal.items`)
- A `UTextarea` bound to a local `reason` ref
- A `UForm` with Zod validation (reason min 1 char)
- Confirm/Cancel buttons with proper loading state
- Emits `confirm(reason: string)` on submit

**Pros:**
- Zero changes to `ConfirmModal` (26 existing callers stay green)
- Full control over validation, layout, and UX
- Clear single responsibility — this modal does ONE thing
- Can show contextual warnings specific to batch terminate (e.g., "X employees will be marked as Terminated")

**Cons:**
- One more component to maintain (~60-80 lines)
- Slight duplication of "list of selected items" pattern from `ConfirmModal`

**Option B: Extend `ConfirmModal` with optional input slot**

Add an optional `<slot name="input">` inside `ConfirmModal`'s body. The batch terminate call site would pass the textarea via this slot.

**Pros:**
- No new component needed
- Potentially reusable for future batch operations needing inputs

**Cons:**
- Changes a shared component used by 26 callers — risk of regression
- Slot-based validation is harder to coordinate (ConfirmModal doesn't know about the input's validity)
- The `confirm` emit becomes ambiguous (what data does it carry?)
- Violates single responsibility — `ConfirmModal` becomes a "confirm with optional form" component

**Option C: Adapt per-row `TerminateEmployeeDialog` for batch**

The per-row dialog uses `terminationDate + terminationReason`. The batch endpoint only needs `reason`. Adapting it would require conditional logic for batch vs. single mode.

**Pros:**
- Reuses existing form infrastructure

**Cons:**
- Mismatched schemas: single needs `{terminationDate, terminationReason}`, batch needs `{ids, reason}` — different endpoints, different DTOs
- Conditional rendering (show/hide date picker) adds complexity
- The per-row dialog shows employee name in the warning text — batch needs to show N names
- Coupling two different use cases in one component is an anti-pattern

**Verdict: Option A is the clear winner.** It's the most SOLID approach and aligns with the existing pattern of dedicated dialogs (TerminateEmployeeDialog, ReactivateEmployeeDialog) rather than a "one modal to rule them all."

---

#### 2. Row Selection Infrastructure

**The Problem:** `useEmployeesList` does NOT return `rowSelection` or `selectedRows`. Unlike PromotionsView which uses `useServerTable` (which provides these for free), the employees list uses a custom TanStack Query composable.

**Option A: Extend `useEmployeesList` with row selection (RECOMMENDED)**

Add two things to the composable:
```ts
// Inside useEmployeesList:
const rowSelection = ref<RowSelectionState>({})
const selectedEmployees = computed<Employee[]>(() => {
  // RowSelectionState keys are stringified row indices
  const selected = rowSelection.value
  return employees.value.filter((_, index) => selected[index])
})
function clearSelection() {
  rowSelection.value = {}
}
```

**Pros:**
- Minimal change to the existing composable (~15 lines)
- Preserves the existing query architecture (no migration to `useServerTable`)
- Works with `AppDataTable`'s `v-model:rowSelection` — which operates by row INDEX
- `selectedEmployees` provides the actual `Employee[]` objects for mutations

**Cons:**
- `RowSelectionState` uses numeric indices as keys — when filters/pagination change, we MUST manually clear selection (same pattern as PromotionsView's `watch` on filters)
- Does NOT give us `columnPinning` or `columnVisibility` — but we don't need them (the columns are already defined)

**Option B: Migrate to `useServerTable`**

Replace `useEmployeesList` with `useServerTable`. This would provide `rowSelection`, `selectedRows`, `columnPinning`, `columnVisibility` out of the box.

**Pros:**
- Full feature parity with PromotionsView
- Built-in `selectedRows` (maps indices → objects automatically)

**Cons:**
- `useServerTable` returns `data` (a computed ref from TanStack Query), NOT `employees` — requires renaming across the template
- `useEmployeesList` has custom logic (status tabs, search debounce, query gate, `setPageSize` vs `setPage`, pagination forwarding) that would need to be ported or adapted
- `useServerTable` doesn't support `managerId` filter or status-filter-as-ref — would need wrapper composable anyway
- High risk of regression in the employee list — this is a foundational composable touched by 10+ work units
- The `pagination` state shape differs: `useEmployeesList` uses 1-based `page` + `pageSize`, while `useServerTable` uses 0-based `pageIndex` + `pageSize`

**Verdict: Option A.** Extending `useEmployeesList` is a surgical change with zero regression risk. The migration to `useServerTable` would be a separate refactor — not something to bundle with batch operations.

---

#### 3. Card View Batch Selection

**The Problem:** `EmployeeCardGrid` renders cards with NO checkboxes. Cards have `@click` → navigation to detail view. Adding checkboxes to every card would conflict with the click-to-navigate behavior and clutter the card UI.

**Options:**
- **Option A: Table-only batch operations (RECOMMENDED)** — when in card view mode, hide the bulk actions bar entirely. This is the pragmatic choice: card views are optimized for browsing, not bulk operations. Most HR systems (BambooHR, Workday, Rippling) do the same — bulk actions are table-only.
- **Option B: Cards with checkboxes** — add a checkbox overlay to each card when "selection mode" is active. This requires a mode toggle ("Enable selection") that turns card clicks into toggles instead of navigation. Complex UX, high implementation cost, and users would likely switch to table view anyway for bulk ops.
- **Option C: Auto-switch to table on first selection** — if user somehow initiates selection from card view, force-switch to table mode. Disorienting UX.

**Verdict: Option A — table-only batch operations.** The `enableRowSelection` prop on `AppDataTable` should be `v-if="viewMode === 'table'"` (or at least `canBatchDelete || canBatchTerminate || canBatchReactivate` should only be true in table mode). The bulk actions bar naturally won't appear in card view since there's no `rowSelection` model bound to cards.

---

### What CAN be Reused from Promotions Batch Pattern

| Element | Reusable? | Notes |
|---------|-----------|-------|
| `AppDataTable` with `enableRowSelection` | ✅ Yes | Already used in EmployeesListView, just needs the prop + v-model |
| `SelectColumn` component | ✅ Yes | Drop-in: `import { SelectColumn } from '@/core/shared/components/DataTable'` |
| `DataTableBulkActions` | ✅ Yes | Rendered automatically by AppDataTable when `bulkActions` + `enableRowSelection` are set |
| `ConfirmModal` | ✅ Partial | Use for batch-delete and batch-reactivate (simple confirm with items list). NOT for batch-terminate (needs input). |
| `BulkAction<T>` type | ✅ Yes | Same type, same `onClick` pattern |
| `batch_delete` CASL action | ✅ Yes | Already in `APP_ACTIONS` and `AppAction` |
| Mutation pattern (useMutation + toast + query invalidation) | ✅ Yes | Same TanStack Query pattern |
| `offendingIds` Set pattern | ✅ Yes | For `BATCH_DELETE_NOT_FOUND` errors, highlight affected rows |
| Error code dispatch (switch on `err.response?.data?.error`) | ✅ Yes | Same pattern: `BATCH_DELETE_NOT_FOUND`, `INSUFFICIENT_PERMISSIONS` |
| Filter-change clears selection | ✅ Yes | Same `watch([statusTab, search], () => { rowSelection.value = {} })` pattern |

### What MUST Be New/Different for Employees

| Element | Why Different |
|---------|--------------|
| Row selection in composable | `useEmployeesList` doesn't have it — must add manually (unlike `useServerTable` which has it built-in) |
| Batch terminat e modal | Backend requires `{ids, reason}` — `ConfirmModal` doesn't support input fields |
| Batch delete warnings | Hard delete with cascade (salary history, positions, documents, time-off, emergency contacts) — needs explicit warning about what's destroyed |
| View mode gate | Batch operations only valid in table mode — must hide/disable in card view |
| Three mutations | Promotions had 2 (batch-delete + batch-end). Employees has 3 (batch-delete, batch-terminate, batch-reactivate). |
| Permission split | batch-delete needs `batch_delete:Employee` (explicit), batch-terminate + batch-reactivate need `update:Employee` |
| Batch terminate DTO | Unlike per-row terminate (which needs `terminationDate`), batch-terminate only needs `reason` — different endpoint, different DTO shape |
| `useEmployeesList` pagination | 1-based `page` vs 0-based `pageIndex` — the `pagination` computed getter/setter in the view already handles this conversion for AppDataTable |
| Data prop name | `employees` (not `data` like `useServerTable`) |

### Implementation Approach — Recommended Architecture

```
EmployeesListView.vue
├── Adds rowSelection + selectedEmployees to useEmployeesList
├── Wires AppDataTable: enableRowSelection + v-model:rowSelection
├── Adds SelectColumn slot (select-header + select-cell)
├── Adds bulkActions computed (gated by viewMode === 'table')
├── Renders 3 modals:
│   ├── BatchDeleteModal.vue     (uses ConfirmModal with extra cascade warning + items list)
│   ├── BatchTerminateModal.vue  (new dedicated modal with textarea for reason)
│   └── ConfirmModal             (for batch-reactivate — simple confirm with items)
└── Clears selection on filter/page change

useEmployeesList.ts
├── Adds rowSelection ref + selectedEmployees computed
├── Adds clearSelection function
└── Returns new entries

employees.api.ts
├── batchDelete(ids: string[]): Promise<{ deleted: number }>
├── batchTerminate(ids: string[], reason: string): Promise<{ updated: number }>
└── batchReactivate(ids: string[]): Promise<{ updated: number }>

NEW: useBatchDeleteEmployee.ts
NEW: useBatchTerminateEmployee.ts
NEW: useBatchReactivateEmployee.ts
NEW: BatchTerminateModal.vue
```

### Risks

1. **Pagination reset vs. selection clear**: When the user changes page, `rowSelection` (keyed by row index) will point to wrong rows on the new page. Must clear selection on page change AND filter change. Same pattern as PromotionsView.

2. **Row index instability**: `RowSelectionState` keys are the 0-based index of the row on the CURRENT page. If `employees` re-sorts or the user paginates, the selected indices are stale. This is inherent to TanStack's row selection model and is handled by clearing selection on any filter/pagination change.

3. **batch-delete cascade**: Hard delete wipes salary history, positions, documents, time-off, emergency contacts. The confirmation MUST explicitly list all affected data types. A simple "Are you sure?" is insufficient. Recommended: a dedicated `BatchDeleteModal` that itemizes what will be permanently destroyed.

4. **Card view users can't batch**: Users in card view won't see bulk actions. This is acceptable (industry standard) but should be tested with real users — if they frequently need batch ops, they'll learn to use table mode.

5. **`batch_delete:Employee` permission**: Backend requires this explicit code. If the backend hasn't been deployed yet or roles haven't been updated, the `canBatchDelete` guard will silently hide the button (desired behavior — no broken UI).

6. **Three mutations, three loading states**: Each mutation has its own `useMutation` with `isPending`. The confirm modal's loading prop must OR all three pending states (like PromotionsView does).

7. **batch-terminate only needs `reason` (no `terminationDate`)**: The per-row terminate dialog requires both `terminationDate` and `terminationReason`. The batch endpoint only needs `reason`. These are different backend contracts — do NOT try to reuse the per-row dialog or DTO.

### Estimated Files to Touch

**New files: 6**
1. `src/features/admin/employees/composables/useBatchDeleteEmployee.ts`
2. `src/features/admin/employees/composables/useBatchTerminateEmployee.ts`
3. `src/features/admin/employees/composables/useBatchReactivateEmployee.ts`
4. `src/features/admin/employees/components/BatchTerminateModal.vue`
5. (Batch-delete + batch-reactivate can use existing `ConfirmModal` directly, no new modal files needed for those)

**Modified files: 4**
1. `src/features/admin/employees/views/EmployeesListView.vue` — main integration point
2. `src/features/admin/employees/composables/useEmployeesList.ts` — add rowSelection
3. `src/features/admin/employees/api/employees.api.ts` — add 3 batch methods
4. `src/features/admin/employees/interfaces/employee.types.ts` — possibly add `BatchTerminateDto` / `BatchDeleteDto` Zod schemas

**Total: ~10 files touched, ~6 new, ~4 modified.**

### Ready for Proposal

**Yes.** The architecture is clear. The proven patterns from promotions-batch-end are directly applicable. The main decisions (row selection via composable extension, dedicated batch terminate modal, table-only batch ops) are resolved. Ready to move to `sdd-propose`.
