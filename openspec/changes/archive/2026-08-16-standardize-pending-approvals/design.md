# Design: Standardize Pending Approvals

## Technical Approach

Approach C (hybrid) per proposal. Rewrite `PendingApprovalsView.vue` from hand-rolled card list to client-side `AppDataTable` (endpoint returns full server-sorted array — NO `useServerTable`, mirroring Fase 3 #2 `ExpiringDocumentsView`): `:data="paged.pageRows"` + manual `v-model:pagination` bridge, `v-model:global-filter` bound to `searchQuery` with `filterPendingBySearch` as the view-owned filter (REQ-4), `usePendingApprovalsViewMode` (default `card`, REQ-2), 8 columns via new `usePendingApprovalsColumns` (REQ-3), `enable-column-visibility` + pinned `acciones`, `:error`/`:error-message` from a `backendMessage > error.message > fallback` computed (REQ-5). Card markup extracts to `PendingApprovalCard.vue` fed by a pure `buildPendingApprovalCardData` builder. `useReviewTimeOff` mutation, query options (`refetchOnWindowFocus: true`, `staleTime 30_000`), and `pagination.utils.ts` stay UNTOUCHED (REQ-8). No bulk actions/`enableRowSelection` (REQ-7).

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Pagination bridge | AppDataTable 0-based vs view 1-based | Copy `ExpiringDocumentsView` computed get/set verbatim; `pageSize` becomes `ref(DEFAULT_TABLE_PAGE_SIZE)`; page-size change resets to page 1; `:page-size-options="[10, 20, 50]"` (REQ-1 pins default 10 only) |
| Split `usePendingApprovals` out of `useReviewTimeOff.ts` | Proposal marks optional "for symmetry" with `useExpiringDocuments.ts`; REQ-8 scenario pins `useReviewTimeOff` **unchanged in the diff** | **Do NOT split** — the spec invariant wins; zero diff on the file; reversible later if desired |
| Card extraction | Inline keeps closures (name/avatar/dialog) but bloats the view; extraction adds a component + prop contract | **Extract `PendingApprovalCard.vue`** + pure `buildPendingApprovalCardData` — EmployeeCard precedent + Extract-Before-Mock; card template is a repeated item (vue-best-practices split trigger); card becomes presentational `:data`/`:can-review`/`:is-reviewing`, emits `approve`/`reject` |
| Sorting | `AppDataTable` forces `manualSorting: true` — view would own sort state | Deferred per proposal: all columns `enableSorting: false`; not a parity gap for this tray |
| `acciones` right-pin | No `useServerTable` to supply `defaultPinning` | View-owned `ref<ColumnPinningState>({ left: [], right: ['acciones'] })` bound via `v-model:column-pinning` (precedent: gold views' `defaultPinning`) |
| Refresh placement | Header `Actualizar` duplicates toolbar refresh | Remove header button; toolbar refresh (AppDataTable `showRefresh` default) + error-retry "Reintentar" cover it; retry renders even when toolbar hidden |
| Empty/no-match/toolbar | REQ-4: empty queue → no search/summary; no-match → distinct copy | `emptyMessage` computed; `:show-toolbar="queueNonEmpty"`; summary in `#above-table`; no-match copy via `:empty` (table) and `#cards` slot block (cards) |

## Data Flow

```
usePendingApprovals ──data──▶ filteredRequests (filterPendingBySearch + employeeMap)
searchQuery ⇄ v-model:global-filter ──▶ watcher ──▶ pageAfterQueryChange ──▶ page = 1
page/pageSize refs ──pagination bridge──▶ v-model:pagination (0-based)
filteredRequests ──paginateRows(clampPage)──▶ paged.pageRows ──▶ :data, :page-count, :total-count
useViewMode('pending-approvals-view-mode', ['table','card'], 'card') ──▶ displayMode ──▶ :display-mode
#cards slot ◀── PendingApprovalCard ──approve/reject──▶ openReviewDialog ──▶ useReviewTimeOff (UNTOUCHED)
isError/error ──▶ pendingErrorMessage ──▶ :error/:error-message (table/cards-error-state, retry → refetch)
```

## File Changes

| File | Action | WU | Description |
|---|---|---|---|
| `composables/usePendingApprovalsViewMode.ts` | Create | A | Wraps `useViewMode` (key `pending-approvals-view-mode`, `['table','card']`, default `card`); `isPendingApprovalsViewMode` guard; `displayMode` `card`→`cards` bridge |
| `composables/usePendingApprovalsColumns.ts` | Create | A | 8 cols `colaborador, tipo, fechas, dias, motivo, estado, solicitada, acciones` via `createSimpleHeader`; `enableHiding: true` on 7 data cols, `false` on `acciones`; all `enableSorting: false`; `acciones` `meta: { class: { td: 'text-right' } }` |
| `composables/usePendingApprovalCard.ts` | Create | B | Pure `buildPendingApprovalCardData(request, employeeMap)` + `PendingApprovalCardData` type |
| `components/PendingApprovalCard.vue` | Create | B | Presentational card (avatar, type badge, range, days, reason SICK-guard, status, createdAt); emits `approve`/`reject` |
| `views/PendingApprovalsView.vue` | Modify | A+B | A: `AppDataTable` + pagination bridge + error computed + `globalFilter` + pinning/visibility + remove hand-rolled `UInput`/`UPagination`/hardcoded error/header refresh. B: `ViewToggle` `#actions`, `:display-mode`, `#cards` slot, summary `#above-table`, empty/no-match blocks |
| `composables/useReviewTimeOff.ts` | Unchanged | — | REQ-8: no diff |
| `core/shared/utils/pagination.utils.ts` | Unchanged | — | REQ-8 |
| `__tests__/s5-tray-reframe.spec.ts` | Modify | C | Keep all existing pure tests; add `buildPendingApprovalCardData` cases |
| `composables/__tests__/usePendingApprovalsViewMode.test.ts` | Create | C | Guard, bridge, storage round-trip, invalid→card |
| `composables/__tests__/usePendingApprovalsColumns.test.ts` | Create | C | Order, headers, hide/sort flags |
| `views/__tests__/PendingApprovalsView.test.ts` | Create | C | View tests (below) |

## Interfaces / Contracts

```ts
// usePendingApprovalsViewMode(): { viewMode, setMode, toggleViewMode, displayMode } + isPendingApprovalsViewMode
// usePendingApprovalsColumns(): { columns: TableColumn<TimeOffRequest>[] }
// PendingApprovalCard: props { data: PendingApprovalCardData; canReview: boolean; isReviewing: boolean }
//   emits { approve: [request: TimeOffRequest]; reject: [request: TimeOffRequest] }

// Pagination bridge (ExpiringDocumentsView precedent, REQ-1):
const pagination = computed({
  get: () => ({ pageIndex: page.value - 1, pageSize: pageSize.value }),
  set: (val) => {
    if (val.pageSize !== pageSize.value) { pageSize.value = val.pageSize; page.value = FIRST_PAGE }
    else page.value = val.pageIndex + 1
  },
})
// pendingErrorMessage: response.data.message (string | array[0]) → error.message →
//   'No se pudieron cargar las solicitudes pendientes. Intenta de nuevo.' (REQ-5)
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit (pure) | Card builder | Extend `s5-tray-reframe.spec.ts`: SICK guard, "—" name, days plural, date-range label |
| Unit | Columns | Order/headers; 7 `enableHiding: true`; `acciones` non-hideable + `enableSorting: false` everywhere |
| Unit | View mode | Default `card`; `card`→`cards`/`table`→`table`; storage round-trip; invalid→`card` |
| View | `PendingApprovalsView.test.ts` | Stub `AppDataTable` (mirror `EmployeesListView.test.ts` `data-error`/`data-error-message`/`data-display-mode` attrs + slots), mock `usePendingApprovals` + picker query, real view-mode/columns. Cases: error precedence ×4 + retry→`refetch`; pagination 1↔0 bridge + size-change reset + shrink clamp; search→`globalFilter` + page reset; `display-mode` default/stored/invalid; visibility enabled + `acciones` pin; no-match vs empty copy; `show-toolbar` false on empty; summary "N de M total"; `canReview: false` hides actions; no `enable-row-selection` |

## Threat Matrix

N/A — no routing change, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary (view renders in place; no navigation).

## Migration / Rollout

No data migration. Rollback: revert merge — error computed falls back when `error` is null; card relocation restorable from git history; only non-additive step is deleting the hand-rolled `UInput`/`UPagination`/error block. WU-B ships without tests (Fase 2 lesson). Forecast: WU-A ~150–180, WU-B ~100–140 (card extraction pushes upper bound), WU-C ~200–250. `Decision needed before apply: No` · `Chained PRs recommended: No` (no PRs — conventional commits, manual merge) · `400-line budget risk: Medium` (WU-A heaviest; Fase 3 #1 overrun lesson).

## Open Questions

- Backend (relay to orchestrator): (1) server pagination/search/sort on `/pending-approvals`? (2) batch-review endpoint? (3) inlined `employeeName` to lift the `listForPicker` >100 cap?
- None blocking the design.
