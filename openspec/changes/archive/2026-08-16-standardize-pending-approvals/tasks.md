# Tasks: Standardize Pending Approvals

Derived from `proposal.md`, `design.md`, `specs/admin-pending-approvals/spec.md` (REQ-1..8).

- Execution mode: AUTO; delivery: no PRs — conventional commits on branch, manual merge to main (solo dev)
- Artifact store: openspec; review budget: 400 lines/WU; strict TDD: `pnpm test:unit` (vitest), gate `pnpm build`
- WU-B ships without tests (Fase 2 lesson) — tests land in WU-C
- Frontend-only: `houndfe-backend` forbidden. Pagination bridge copy-pasted verbatim from `ExpiringDocumentsView.vue`. NO split of `usePendingApprovals` out of `useReviewTimeOff.ts` (REQ-8 invariant). Sorting deferred (all `enableSorting: false`). `acciones` right-pinned via view-owned `ref<ColumnPinningState>({ right: ['acciones'] })`. Header refresh button removed (toolbar refresh + error-retry cover it). Card extraction → `PendingApprovalCard.vue` + pure `buildPendingApprovalCardData`.

---

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: Medium

Estimated ~450-570 lines (WU-A ~150-180 + WU-B ~100-140 + WU-C ~200-250). WU-A is heaviest (client-side `AppDataTable` adoption + 8 columns + error computed + view-mode composable) — conservative per Fase 3 #1 WU-A actual-overrun precedent. Each WU < 400.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WU-A | `AppDataTable` client-side + error + 8 columns + `usePendingApprovalsViewMode` | commit 1 on branch | `pnpm test:unit --run src/features/admin/employees/composables/__tests__/usePendingApprovalsViewMode.test.ts` | `pnpm dev` toggling error/reload/column-vis/view-mode | revert `usePendingApprovalsViewMode.ts` + `usePendingApprovalsColumns.ts` + `PendingApprovalsView.vue` A edits |
| WU-B | `PendingApprovalCard` + `#cards` slot + `ViewToggle` (NO tests) | commit 2 on branch | N/A (no tests in WU-B by design — Fase 2 lesson) | `pnpm dev` toggling to cards, card actions per CASL, dialog opens | revert `PendingApprovalCard.vue` + `usePendingApprovalCard.ts` + `PendingApprovalsView.vue` B edits |
| WU-C | tests: error, pagination, view-mode, columns, visibility, no-match/empty, canReview | commit 3 on branch | `pnpm test:unit --run src/features/admin/employees` | N/A | revert new test files + stripped section in `s5-tray-reframe.spec.ts` |

| Unit | REQs | Commit |
|------|------|--------|
| WU-A | 1, 2, 3, 5, 8 | `feat(admin-pending-approvals): adopt AppDataTable, surface errors, add view mode + columns` |
| WU-B | 2, 3, 4, 6 | `feat(admin-pending-approvals): render card in #cards slot with ViewToggle` |
| WU-C | 1..8 | `test(admin-pending-approvals): cover view, view mode, columns, and gating` |

---

## Phase 1: WU-A — `AppDataTable` Client-Side + Error + Columns + View-Mode (~150-180 lines)

**Files**: create `composables/usePendingApprovalsViewMode.ts`, `composables/usePendingApprovalsColumns.ts`; create RED stubs `composables/__tests__/usePendingApprovalsViewMode.test.ts`, `composables/__tests__/usePendingApprovalsColumns.test.ts`, `views/__tests__/PendingApprovalsView.test.ts`; modify `views/PendingApprovalsView.vue` (A part). Strict-TDD: RED → GREEN → REFACTOR.

- [x] 1.1 RED `composables/__tests__/usePendingApprovalsViewMode.test.ts`: localStorage roundtrip under `pending-approvals-view-mode`; default `card`; invalid stored → `card`; `displayMode` bridges `card`→`cards`/`table`→`table`; `isPendingApprovalsViewMode` guard accepts only `table`/`card`. Red.
- [x] 1.2 GREEN `composables/usePendingApprovalsViewMode.ts`: wrap `useViewMode('pending-approvals-view-mode', ['table','card'], 'card')`; export `PENDING_APPROVALS_VIEW_MODE_STORAGE_KEY` + `PendingApprovalsViewMode` + `isPendingApprovalsViewMode` + `{ viewMode, setMode, toggleViewMode, displayMode }` (computed bridges `card`→`cards`). Green.
- [x] 1.3 RED `composables/__tests__/usePendingApprovalsColumns.test.ts`: order `[colaborador, tipo, fechas, dias, motivo, estado, solicitada, acciones]`; headers `Colaborador/Tipo/Fechas/Días/Motivo/Estado/Solicitada`; 7 data columns `enableHiding: true`; `acciones` `enableHiding: false` + `enableSorting: false` everywhere + `meta: { class: { td: 'text-right' } }`. Red.
- [x] 1.4 GREEN `composables/usePendingApprovalsColumns.ts`: 8 columns via `createSimpleHeader`; explicit `enableHiding: true` on 7 data columns; `acciones` `enableHiding: false`; explicit `enableSorting: false` everywhere; `acciones` right-aligned via `meta.class`. Green.
- [x] 1.5 RED stub `views/__tests__/PendingApprovalsView.test.ts` pinning `pendingErrorMessage` precedence (`response.data.message` string|array[0] → `error.message` → "No se pudieron cargar las solicitudes pendientes. Intenta de nuevo.") + `:data="paged.pageRows"` + `v-model:pagination` bridge + `v-model:global-filter` + `enable-column-visibility` + `v-model:column-pinning` `{ right: ['acciones'] }` + `:show-toolbar="queueNonEmpty"` (no `bulkActions`/`enableRowSelection`). Red.
- [x] 1.6 GREEN `views/PendingApprovalsView.vue` (A part): drop `UInput`/`UPagination` + hand-rolled error block + header `Actualizar` button; import `usePendingApprovalsViewMode` + `usePendingApprovalsColumns`; `pagination` computed get/set copy-pasted verbatim from `ExpiringDocumentsView.vue` (pageSize = `ref(DEFAULT_TABLE_PAGE_SIZE)`); `:page-size-options="[10, 20, 50]"`; `v-model:global-filter="searchQuery"` (filterPendingBySearch stays view-owned); `v-model:column-pinning="columnPinning"` (`ref<ColumnPinningState>({ left: [], right: ['acciones'] })`); `v-model:column-visibility`; `enable-column-visibility`; `pendingErrorMessage` computed; `:error="isError"` + `:error-message="pendingErrorMessage"`; destructure `isError`/`error`/`refetch` from `usePendingApprovals`. Green.
- [x] 1.7 REFACTOR trim dead imports (`UInput`/`UPagination`/header refresh handler); tests green.
- [x] 1.8 Verify `pnpm test:unit --run src/features/admin/employees` (new stubs green; existing `s5-tray-reframe.spec.ts`/`wu11-timeoff-review-emergency-contacts.spec.ts`/`wu12b-dashboard-views.spec.ts`/`foundation.spec.ts` UNCHANGED) + `pnpm build` clean.

**Commit**: `feat(admin-pending-approvals): adopt AppDataTable, surface errors, add view mode + columns`. Stages `usePendingApprovalsViewMode.ts` (new), `usePendingApprovalsColumns.ts` (new), `PendingApprovalsView.vue` (modify — A), `usePendingApprovalsViewMode.test.ts` (new), `usePendingApprovalsColumns.test.ts` (new), `PendingApprovalsView.test.ts` stub (new).

---

## Phase 2: WU-B — Card into `#cards` + `ViewToggle` + `PendingApprovalCard` (~100-140 lines, NO TESTS)

**Files**: create `composables/usePendingApprovalCard.ts`, `components/PendingApprovalCard.vue`; modify `views/PendingApprovalsView.vue` (B part). Implementation only.

- [x] 2.1 `composables/usePendingApprovalCard.ts`: pure `buildPendingApprovalCardData(request: TimeOffRequest, employeeMap: Map<string, ManagerInfo>): PendingApprovalCardData`; export `PendingApprovalCardData` type; `employeeMap.get(id)?.fullName ?? '—'`; SICK+null reason → `resolveSickReason('SICK', null)`; days plural via existing helper; date-range label via existing `formatTimeOffDateRange`.
- [x] 2.2 `components/PendingApprovalCard.vue`: presentational card (avatar initials, type badge, date range, days, reason SICK-guarded, status chip, createdAt). Props `{ data: PendingApprovalCardData; canReview: boolean; isReviewing: boolean }`. Emits `{ approve: [request: TimeOffRequest]; reject: [request: TimeOffRequest] }`.
- [x] 2.3 `views/PendingApprovalsView.vue` (B part): render `<ViewToggle v-model:view-mode="viewMode" />` in `AppDataTable`'s `#actions` slot; pass `:display-mode="displayMode"`; move existing card markup into `#cards` slot → `<PendingApprovalCard v-for="row in paged.pageRows" :data="buildPendingApprovalCardData(row, employeeMap)" :can-review="canReview" :is-reviewing="isReviewing(row.id)" @approve="openReviewDialog(row, 'APPROVED')" @reject="openReviewDialog(row, 'REJECTED')" />`; summary "N solicitudes pendientes (de M en total)" in `#above-table`; empty/no-match blocks (no-match via `#cards` slot block; empty via `AppDataTable` `:empty` prop); `:show-toolbar="queueNonEmpty"`; `canReview` from CASL `update:EmployeeTimeOff`; `isReviewing(id)` from `useReviewTimeOff` per-row state.
- [x] 2.4 Verify existing `pnpm test:unit --run src/features/admin/employees` (existing green — `s5-tray-reframe.spec.ts`/`wu11-timeoff-review-emergency-contacts.spec.ts`/`wu12b-dashboard-views.spec.ts`/`foundation.spec.ts` UNCHANGED) + `pnpm build` clean. Runtime: toggle to cards renders inside `#cards` (no sibling v-else), card actions gated by CASL `canReview`, dialog opens with decision text, summary line "N de M total" in `#above-table`, no-match vs empty copy distinct, header refresh button gone, `globalFilter` still drives name-resolved search.

**Commit**: `feat(admin-pending-approvals): render card in #cards slot with ViewToggle`. Stages `usePendingApprovalCard.ts` (new), `PendingApprovalCard.vue` (new), `PendingApprovalsView.vue` (modify — B).

---

## Phase 3: WU-C — Tests (~200-250 lines)

**Files**: extend `__tests__/s5-tray-reframe.spec.ts`; create `composables/__tests__/usePendingApprovalsViewMode.test.ts`, `composables/__tests__/usePendingApprovalsColumns.test.ts`, `views/__tests__/PendingApprovalsView.test.ts`. `wu11-timeoff-review-emergency-contacts.spec.ts`/`wu12b-dashboard-views.spec.ts`/`foundation.spec.ts` UNCHANGED (preserved invariants). Strict-TDD: RED → GREEN → REFACTOR.

- [x] 3.1 Extend `__tests__/s5-tray-reframe.spec.ts`: keep all existing cases (`buildManagerMap`/`filterPendingBySearch`/`resolveSickReason`/`resolveDomainErrorMessage`); add `buildPendingApprovalCardData` cases — SICK guard returns `"Motivo médico reservado"`, unknown `employeeId` resolves to `"—"`, days plural (1 vs N), date-range label via `formatTimeOffDateRange`.
- [x] 3.2 RED expand `views/__tests__/PendingApprovalsView.test.ts` (from 1.5 + WU-B): stub `AppDataTable` (mirror `EmployeesListView.test.ts` attrs `data-error`/`data-error-message`/`data-display-mode`/`data-show-toolbar`/`data-enable-column-visibility` + `actions`/`cards`/`above-table` slots), `PendingApprovalCard`, `ViewToggle`, `AdminPageHeader`, `ConfirmModal`. Mock `usePendingApprovals` (mockState incl. `isError`/`error`/`refetch` refs) + `useReviewTimeOff` (isReviewing) + `listForPicker` query. Real `usePendingApprovalsViewMode` (localStorage-driven) + real `usePendingApprovalsColumns`. Red.
- [x] 3.3 GREEN tests: error precedence ×4 (`response.data.message` string wins; array[0] wins; `error.message` second; fallback `"No se pudieron cargar las solicitudes pendientes. Intenta de nuevo."`); retry → `refetch`; empty placeholder suppressed on error; `ViewToggle` renders with `aria-label`; `display-mode` default `cards` (from `card`), localStorage `table`→`table`, invalid→`cards`; `enable-column-visibility` wired; `AdminPageHeader` `:data-title` = "Validaciones pendientes".
- [x] 3.4 GREEN tests: pagination bridge (1-based view ↔ 0-based `AppDataTable`); size-change resets to page 1; queue-shrink clamp via `clampPage` (no infinite watcher loop); search → `globalFilter` + page reset to FIRST_PAGE; `v-model:column-pinning` `{ right: ['acciones'] }`; `acciones` non-hideable; no-match copy `"No hay coincidencias para «…»"` vs empty `"Sin solicitudes pendientes"`; `:show-toolbar="false"` on empty queue; summary `"N solicitudes pendientes (de M en total)"`; `canReview: false` hides card actions AND no Aprobar/Rechazar buttons; no `enable-row-selection`/`bulkActions` props passed.
- [x] 3.5 `composables/__tests__/usePendingApprovalsViewMode.test.ts`: localStorage roundtrip under `pending-approvals-view-mode`; invalid stored → `card`; `displayMode` bridges `card`→`cards`/`table`→`table`; `isPendingApprovalsViewMode` guard accepts only `table`/`card`.
- [x] 3.6 `composables/__tests__/usePendingApprovalsColumns.test.ts`: order `[colaborador, tipo, fechas, dias, motivo, estado, solicitada, acciones]`; headers `Colaborador`/`Tipo`/`Fechas`/`Días`/`Motivo`/`Estado`/`Solicitada`; 7 data `enableHiding: true` + `enableSorting: false`; `acciones` `enableHiding: false` + `enableSorting: false` + right-aligned.
- [x] 3.7 REFACTOR trim mocks, consolidate stubs; tests green.
- [x] 3.8 Verify `pnpm test:unit --run src/features/admin/employees` (all green — new + extended + preserved `wu11`/`wu12b`/`foundation`) + `pnpm build` clean; full suite green.

**Commit**: `test(admin-pending-approvals): cover view, view mode, columns, and gating`. Stages `PendingApprovalsView.test.ts` (new), `usePendingApprovalsViewMode.test.ts` (new), `usePendingApprovalsColumns.test.ts` (new), `s5-tray-reframe.spec.ts` (modify — extension only).

---

## Threat Matrix

N/A per design (no routing change, no shell/subprocess/VCS automation, no executable-file classification, no process integration boundary). `useReviewTimeOff` mutation flow unchanged (REQ-8) — no new RED-test tasks required; existing `wu11-timeoff-review-emergency-contacts.spec.ts` already pins the invalidation contract. View renders in place; no navigation added.

---

## Definition of Done

- [x] REQ-1..8 satisfied; REQ-8 invariants preserved (`refetchOnWindowFocus: true` + `staleTime: 30_000`; client-side full-array pagination via `paginateRows`/`clampPage`/`pageAfterQueryChange`; `listForPicker` >100-cap documented limitation; card Aprobar/Rechazar CASL-gated + `UModal` confirmation + `isReviewing` disable; per-employee `POST /:employeeId/time-off/:timeOffId/review`; `useReviewTimeOff.ts` and `pagination.utils.ts` UNCHANGED in diff; `TimeOffRequest` type unchanged; no new route; no backend change)
- [x] `pnpm test:unit --run src/features/admin/employees` green; `pnpm build` clean; full suite green
- [x] Per-WU commits on branch in order: WU-A → WU-B → WU-C (3 conventional commits on `feat/standardize-pending-approvals`)
- [ ] `pnpm dev` smoke: error banner on forced 500 + retry refetches; toggle persists across reload (`pending-approvals-view-mode` default `card`); 8 columns render with right-pinned `acciones`; data columns hideable; `acciones` non-hideable + non-sortable + right-aligned; no checkbox column; no bulk-action bar; name-resolved search filters via `filterPendingBySearch` + `globalFilter`; page reset on search; queue-shrink clamp; empty queue hides toolbar; no-match vs empty copy distinct; summary "N de M total" in `#above-table`; card actions gated by CASL `canReview`; dialog opens with approve/reject copy; `useReviewTimeOff` + `pagination.utils.ts` untouched
