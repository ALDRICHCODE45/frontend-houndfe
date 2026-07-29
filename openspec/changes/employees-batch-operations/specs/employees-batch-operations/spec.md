# Delta for Employees Batch Operations

## ADDED Requirements

### A-REQ-001: Shared Selection Infrastructure
Table view MUST render per-row checkboxes and a select-all header. `selectedEmployees` SHALL bind via `id` keys. Selection MUST clear on filter, search, page, or view-mode change. `enable-row-selection` true only when `viewMode === 'table'`. A sticky bottom bar MUST show "N de T seleccionados" with a "Deseleccionar" link when ≥1 row selected.

*Scenario: Select-all and filter-clear* — 10 rows selected via header checkbox; on filter change, selection clears and bar hides.
*Scenario: Card view blocks batch* — 3 selected in table; switching to card clears selection and hides bar.

### A-REQ-002: CASL Gates and Button States
Each operation independently gated: `canBatchDelete` → `batch_delete:Employee`; `canBatchTerminate`/`canBatchReactivate` → `update:Employee`. Checkboxes render when ANY gate passes. Buttons disabled at `n === 0 || n > 100`.

*Scenario: Mixed perms* — user has only `update:Employee`; bar shows terminate+reactivate, hides delete; checkboxes visible.
*Scenario: No perms* — all gates false; no checkboxes, no bar.

### B-REQ-001: Batch Delete
`employeesApi.batchDelete(ids)` MUST dedup via `Set`, throw on empty/>100, POST `/admin/employees/batch-delete`. Red "Eliminar (N)" button opens `ConfirmModal` listing selected (name+status) with cascade warning: irreversible destruction of salaries, positions, documents, time-off, emergency contacts. Error color, label "Eliminar permanentemente". Non-dismissible during `isPending`.

*Scenario: Cascade modal* — 2 selected (ACTIVE+TERMINATED); modal warns about 5 tables, error color, "Eliminar permanentemente".
*Scenario: Client guards* — empty or >100 throws client-side, no request.

### B-REQ-002: Batch Delete — Response Handling
200 `{ deleted: N }` → toast "N empleados eliminados", invalidate paginated cache, clear selection. 404 `BATCH_DELETE_NOT_FOUND` → warning toast with offendingId count, invalidate, clear. 403 → error toast, preserve selection.

*Scenario: Success* — confirmed delete of 3; toast, cache invalidated, cleared, modal closed.
*Scenario: 404 partial* — offendingIds `['a','b']`; toast, invalidate, clear.
*Scenario: 403* — permission toast, selection preserved.

### C-REQ-001: Batch Terminate
`employeesApi.batchTerminate(ids, reason)` MUST dedup, throw on empty/>100/empty-reason, POST `/admin/employees/batch-terminate`. Warning "Dar de baja (N)" button opens `BatchTerminateModal` — dedicated modal with `UTextarea` + Zod `BatchTerminateDtoSchema` (min 1 non-whitespace). Lists selected (name+status). Confirm disabled while `reason.trim().length === 0`. Emits `confirm(reason)`. Response handling mirrors B-REQ-002 pattern (200→toast+invalidate+clear, 404→warn+invalidate+clear, 403→error+preserve).

*Scenario: Reason required* — modal open, textarea empty → confirm disabled; "Reorg" entered → enabled, emits `confirm("Reorg")`.
*Scenario: Reason client guard* — empty reason passed to API → throws, no request.
*Scenario: Success* — confirmed "Reestructuración", backend `{ updated: 5 }` → toast "5 empleados dados de baja", invalidate, clear.

### D-REQ-001: Batch Reactivate
`employeesApi.batchReactivate(ids)` MUST dedup, throw on empty/>100, POST `/admin/employees/batch-reactivate`. Primary "Reactivar (N)" button opens `ConfirmModal` listing selected (name+status), primary color, label "Reactivar seleccionados". No cascade warnings. Response handling mirrors B-REQ-002.

*Scenario: Reactivate flow* — 3 terminated selected; POST sent with deduped ids; 200 → toast "3 empleados reactivados", invalidate, clear.
*Scenario: Error dispatch* — 404 or 403 mirrors B-REQ-002 pattern.
