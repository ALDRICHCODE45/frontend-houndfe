# Proposal: Standardize Pending Approvals

## Intent

Bring `PendingApprovalsView.vue` ("Validaciones pendientes") to Fase 3 parity with the Fase 2 gold standard. The view is **not a table at all** — a 499-line hand-rolled card list with custom `UInput` search, custom `UPagination`, and a **hardcoded** error message, while every gold module is an `AppDataTable` + `ViewToggle` (table+cards) hybrid. Its endpoint (`GET /admin/employees-time-off/pending-approvals`) returns the **full server-sorted array** (no pagination/search/sort params) — the *same* documented client-side contract as expiring-documents — so `useServerTable` is NOT a fit (Fase 3 #2 precedent). The goal: standardize as the hybrid **while preserving the deliberate time-sensitive card tray UX**.

## Scope

### In Scope

- **Adopt `AppDataTable` client-side (Approach C hybrid)**: `:data="pagedRows"` + manual `v-model:pagination` bridged from `paginateRows`; NO `useServerTable` (full-array endpoint).
- **`ViewToggle` + `#cards` slot + `:display-mode`**: table view AND preserved card tray; new `usePendingApprovalsViewMode` (`displayMode` bridge `card`→`cards` + type guard), persisted via `localStorage` key `pending-approvals-view-mode`, **default `card`** (time-sensitive "easy scanning" UX preserved as default).
- **Table columns** `Colaborador / Tipo / Fechas / Días / Motivo / Estado / Solicitada / Acciones`: per-row `Aprobar`/`Rechazar` in `#actions-cell` (CASL `canReview` + confirmation dialog); `enable-column-visibility` — data columns hideable, `acciones` non-hideable.
- **Name-resolved search into the toolbar**: keep `filterPendingBySearch` (employeeId→name) as the view-owned filter; bind `globalFilter` to `searchQuery`. Do NOT assume `AppDataTable` filters client-side.
- **Error surfacing (G2)**: replace hardcoded with `backendMessage > error.message > fallback` computed, surfaced via `:error`/`:error-message` (covers both `#cards` and table branches).
- **Tests**: extend `s5-tray-reframe.spec.ts`; add error-surfacing, pagination-reset, view-mode, and column-visibility specs.

### Out of Scope

- **Bulk approve/reject**: no backend batch-review endpoint; review stays per-employee `POST /:employeeId/time-off/:timeOffId/review`. No `bulkActions`/`enableRowSelection` scaffolding.
- **Sorting client-side** (`manualSorting: true` trap) is **not** required to reach parity — deferred unless design chooses it; not a gold-standard gap for this tray.
- No backend change, no `TimeOffRequest` type change, no new route, no `useServerTable` migration.

### Already in Place (do NOT redo)

- `usePendingApprovals` query (`refetchOnWindowFocus: true`, `staleTime 30_000`) + `useReviewTimeOff` mutation (invalidates pending tray + employee time-off + vacation balance) ✅.
- `filterPendingBySearch`, `resolveSickReason`, `resolveDomainErrorMessage` pure helpers + `paginateRows`/`clampPage`/`pageAfterQueryChange` seams ✅.
- Name resolution via cached `listForPicker` → `buildManagerMap` (documented `>100`-active cap) ✅.
- Card affordances: Aprobar/Rechazar CASL-gated, confirmation `UModal` dialog ✅.

## Capabilities

### New

- `admin-pending-approvals` — source-of-truth spec for the tenant-wide pending time-off tray: client-side `AppDataTable` (full server-sorted array, no server params), table columns `Colaborador/Tipo/Fechas/Días/Motivo/Estado/Solicitada/Acciones`, per-row Aprobar/Rechazar in `#actions-cell` (CASL-gated, confirmation dialog), `enable-column-visibility` (data columns hideable, `acciones` non-hideable), name-resolved search via `filterPendingBySearch` bound to `globalFilter`, `ViewToggle` + `#cards` slot with `localStorage` `pending-approvals-view-mode` defaulting to `card`, surfaced backend errors (`backendMessage > error.message > fallback`), preserved `refetchOnWindowFocus: true` and client-side full-array pagination.

> No existing pending-approvals capability in `openspec/specs/`. Whole capability is `ADDED`; the original `PendingApprovalsView` pre-dates the spec system. No `MODIFIED` block.

### Modified

None.

## Approach

**Approach C (hybrid)**. Keep the full-array fetch; render via `AppDataTable` in client-side mode (`:data` + manual `v-model:pagination`, mirroring Fase 3 #2 Approach B). Add `usePendingApprovalsViewMode` (wraps shared `useViewMode('pending-approvals-view-mode', ['table','card'], 'card')`) with a `displayMode` bridge (`card`→`cards`) feeding `:display-mode`. Existing card markup moves into the `#cards` slot (optionally extracted to `PendingApprovalCard.vue` — decided in design). Name-resolved search stays view-owned: `globalFilter` binds `searchQuery`; `filterPendingBySearch` does the actual employeeId→name filtering. New `usePendingApprovalsColumns` (or inline) defines the 8 columns with `enableHiding` on data columns only. Error computed prefers `error.response.data.message` (string or first element) → `error.message` → `"No se pudieron cargar las solicitudes pendientes. Intenta de nuevo."`, passed via `:error`/`:error-message`. Optionally split `usePendingApprovals` out of `useReviewTimeOff.ts` for symmetry with `useExpiringDocuments.ts` (design decision). `refetchOnWindowFocus: true` and client-side pagination stay **unchanged**. `pagination.utils.ts` header needs **no change** (still client-side).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/admin/employees/views/PendingApprovalsView.vue` | Modified | Adopt `AppDataTable` (`:data` + `v-model:pagination`), `ViewToggle` + `#cards` slot + `:display-mode`, `enable-column-visibility`, `:error`/`:error-message`, search → `globalFilter`, remove hand-rolled `UInput`/`UPagination`. |
| `src/features/admin/employees/composables/usePendingApprovalsViewMode.ts` | New | `displayMode` bridge (`card`→`cards`) + type guard, wraps `useViewMode`. |
| `src/features/admin/employees/composables/usePendingApprovalsColumns.ts` | New | 8-column defs; `enableHiding` on data columns, `acciones` non-hideable. |
| `src/features/admin/employees/composables/usePendingApprovals.ts` | New (optional) | Split the query out of `useReviewTimeOff.ts` for symmetry; full-array fetch, `refetchOnWindowFocus: true`. |
| `src/features/admin/employees/composables/useReviewTimeOff.ts` | Unchanged | Keep `useReviewTimeOff` mutation; only possibly move the query out. |
| `src/features/admin/employees/components/PendingApprovalCard.vue` | New (optional) | Extract card markup for the `#cards` slot (design decision). |
| `src/core/shared/utils/pagination.utils.ts` | Unchanged | Header already documents "full array, NO server pagination" — no change. |
| Tests: `s5-tray-reframe.spec.ts` (extend) + new `PendingApprovalsView`/columns/view-mode specs | Modified/New | Add error-surfacing, pagination-reset, view-mode, column-visibility coverage. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `globalFilter` assumed to filter client-side — silently breaks name resolution | Med | Keep `filterPendingBySearch` as the only filter; bind `globalFilter` to `searchQuery` only. |
| `refetchOnWindowFocus: true` flipped by a naive "mirror employees" rewrite | Med | Explicit preservation decision in Scope; do not touch the query options. |
| Card default vs table default ambiguity | Low | Default `card`, persisted via `pending-approvals-view-mode`. |
| `listForPicker` >100-cap name-resolution ceiling regressed/dropped | Low | Keep the documented limitation; do not attempt to "fix" without backend. |
| `#cards` extraction over-splits the card markup | Low | Optional extraction deferred to design; card affordances (CASL + dialog) must survive. |
| Test surface: `s5-tray-reframe.spec.ts` pins pure helpers | Med | Preserve seams; extend, don't delete; add view-level specs per WU-C precedent. |

## Rollback Plan

Revert the merge commit. The change is additive-to-behavior-preserving: card tray content is relocated into `#cards` (restore the hand-rolled list branch + remove `ViewToggle`/`displayMode` to revert); error computed falls back to the current message when `error` is `null`; column visibility is opt-in toolbar menu; search wiring keeps `filterPendingBySearch` intact. The only non-additive step is deleting the hand-rolled `UInput`/`UPagination` + `UCard` list wrapper — restorable from git history. `useReviewTimeOff`/`usePendingApprovals` split is reversible (single file). Tests live beside the code they pin.

## Dependencies

`AppDataTable` (`:data`, `v-model:pagination`, `v-model:global-filter`, `:display-mode`, `#cards`, `#actions-cell`, `enable-column-visibility`, `:error`/`:error-message`); `useViewMode`/`ViewToggle`; `AdminPageHeader`; `usePendingApprovals` + `useReviewTimeOff`; `filterPendingBySearch`/`resolveSickReason`; `paginateRows`/`clampPage`/`pageAfterQueryChange`; `employeeTimeOffQueryKeys.pending`; CASL `canReview`/`update:EmployeeTimeOff`. **No `houndfe-backend` dependency** (frontend-only — backend folder forbidden).

## Open Questions (backend team — relay to orchestrator)

1. **Server-side pagination/search/sort on `GET /admin/employees-time-off/pending-approvals`?** Frontend sends no params, treats response as full server-sorted array. (Group with the expiring-documents Open Question #1 — ask both endpoints in one message.)
2. **Batch review endpoint** (e.g. `POST /admin/employees-time-off/review-batch`)? Gates any future bulk approve/reject.
3. **Inlined `employeeName` (server-side join)?** Frontend resolves via cached `listForPicker` capped at 100 active employees; beyond that resolves to "—". Inlining removes the cap.

## Success Criteria

- [ ] `AppDataTable` renders the tray client-side (`:data` + manual pagination); no `useServerTable`.
- [ ] `ViewToggle` shows table/card; default `card`; `pending-approvals-view-mode` persists in `localStorage`.
- [ ] Table columns `Colaborador/Tipo/Fechas/Días/Motivo/Estado/Solicitada/Acciones`; per-row Aprobar/Rechazar in `#actions-cell`.
- [ ] Data columns hideable; `acciones` non-hideable.
- [ ] Search still filters by resolved employee name via `filterPendingBySearch`, bound to `globalFilter`.
- [ ] Failed requests render `backendMessage > error.message > fallback`; empty placeholder only on empty success.
- [ ] `refetchOnWindowFocus: true` preserved; client-side full-array pagination preserved.
- [ ] No bulk actions; review stays per-employee `POST /:employeeId/time-off/:timeOffId/review`.
- [ ] Card affordances (CASL `canReview` + confirmation dialog) unchanged.
- [ ] `pnpm test:unit --run` green (new/ported specs); `pnpm build` clean.
- [ ] No backend change; `pagination.utils.ts` header unchanged.

## Work Units (forecast)

- **WU-A — `AppDataTable` client-side adoption + error surfacing + columns + view-mode composable (~150-180 lines)**: `usePendingApprovalsViewMode`; `usePendingApprovalsColumns` (8 columns, `enableHiding`); `PendingApprovalsView` `AppDataTable` + `v-model:pagination` + `enable-column-visibility` + `:error`/`:error-message` computed; search → `globalFilter`; remove hand-rolled `UInput`/`UPagination`.
- **WU-B — cards into `#cards` + `ViewToggle` + optional `PendingApprovalCard.vue` (~100-140 lines). No tests** (Fase 2 WU-B lesson): `displayMode` bridge + type guard; `#cards` slot + `:display-mode`; move card markup; preserve Aprobar/Rechazar + dialog.
- **WU-C — tests (~200-250 lines)**: extend `s5-tray-reframe.spec.ts`; add error-surfacing, pagination-reset, view-mode, and column-visibility specs.

Review Workload Forecast: `Decision needed before apply: No`, `Chained PRs recommended: No` (NO PRs — conventional commits on branch, manual merge to main), `400-line budget risk: Medium` — WU-A is heaviest (client-side adoption + columns + error), conservative per Fase 3 #1 WU-A overrun precedent.
