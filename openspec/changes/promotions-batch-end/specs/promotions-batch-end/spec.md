# Promotions Batch-End Specification

## Purpose

Bulk-finalize up to 100 promotions atomically via `POST /promotions/batch-end`, gated by `update:Promotion`, surfaced as a warning action in the existing bulk-actions bar. Mirrors the SDD-10 batch-delete pattern.

## Requirements

### BE-REQ-001: Permission Gate

The batch-end action and row checkboxes MUST NOT render when `userCan('update', 'Promotion')` is false.

#### Scenario: No permission
- **Given** `userCan('update', 'Promotion')` is false
- **When** the PromotionsView renders
- **Then** "Finalizar" is absent from bulk-actions and checkboxes are hidden

### BE-REQ-002: API Method

`promotionApi.batchEnd(ids)` MUST deduplicate, MUST throw on empty or >100, and MUST POST to `/promotions/batch-end` with `{ ids }`.

#### Scenario: Dedup + guards
- **Given** `ids = ['a','a','b']`
- **When** `batchEnd(ids)` is called
- **Then** it POSTs `{ ids: ['a','b'] }` to `/promotions/batch-end`
- **And** empty array throws; >100 throws

### BE-REQ-003: Bulk Action UI

A "Finalizar (N)" button SHALL appear in the bulk bar when rows are selected and `canBatchEnd` is true. Warning variant, disabled at 0 or >100.

#### Scenario: Enabled state
- **Given** 3 rows selected and `canBatchEnd` is true
- **When** the bar renders
- **Then** warning button "Finalizar (3)" is enabled
- **And** at 0 or >100 it shows disabled

### BE-REQ-004: Confirm Modal

Clicking the button MUST open `ConfirmModal` listing selected titles with status badges. Warning color, confirm label "Finalizar seleccionadas".

#### Scenario: Modal contents
- **Given** 2 promotions selected (ACTIVE + SCHEDULED)
- **When** user clicks "Finalizar"
- **Then** modal shows both titles + status badges, warning color, confirm "Finalizar seleccionadas"

### BE-REQ-005: Success Handling

On 200 `{ ended: N }`: MUST toast "N promociones finalizadas", invalidate promotions cache, clear selection.

#### Scenario: Successful batch
- **Given** user confirms finalizing 3 promotions
- **When** backend returns `200 { ended: 3 }`
- **Then** toast "3 promociones finalizadas" appears, cache invalidated, selection cleared, modal closes

### BE-REQ-006: Not-Found Error

On 404 `BATCH_DELETE_NOT_FOUND`: MUST toast offendingId count, invalidate list, clear selection.

#### Scenario: Some IDs not found
- **Given** backend returns `404 { error: 'BATCH_DELETE_NOT_FOUND', offendingIds: ['a','b'] }`
- **When** mutation `onError` runs
- **Then** toast shows "2 promocion(es) no encontrada(s)", list invalidated, selection cleared

### BE-REQ-007: Forbidden Error

On 403 `INSUFFICIENT_PERMISSIONS`: MUST toast error and preserve selection.

#### Scenario: Permission denied mid-flight
- **Given** backend returns `403 { error: 'INSUFFICIENT_PERMISSIONS' }`
- **When** mutation `onError` runs
- **Then** permission-denied toast appears, selection preserved

### BE-REQ-008: Loading State

ConfirmModal confirm button MUST show spinner while mutation is pending. Modal MUST be non-dismissible during loading.

#### Scenario: Pending mutation
- **Given** `batchEndMutation.isPending` is true
- **When** modal renders
- **Then** confirm button shows spinner, outside-click does not close modal

### BE-REQ-009: Row Selection Gate

Checkboxes SHALL render when `canBatchDelete || canBatchEnd` is true (widened from the `canBatchDelete`-only gate).

#### Scenario: Checkbox visibility
- **Given** `canBatchDelete` is false, `canBatchEnd` is true
- **When** table renders
- **Then** checkboxes are visible and rows are selectable for batch-end

### BE-REQ-010: Pre-Flight Guards

Client-side MUST mirror server rules: empty rejected, >100 blocked, duplicates deduped. Bulk button disabled at 0 or >100.

#### Scenario: Boundary protection
- **Given** user selects 101 rows
- **When** bulk button renders
- **Then** button is disabled, no request sent
- **And** empty array rejected client-side; duplicates silently removed before POST
