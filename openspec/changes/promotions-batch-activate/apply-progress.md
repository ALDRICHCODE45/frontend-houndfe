# Apply Progress: promotions-batch-activate

## Phase 1 — API Layer (WU-1, Commit 1)
- [x] 1.1 — RED: batchActivate dedup + POST shape test (BA-REQ-002)
- [x] 1.2 — RED: batchActivate empty + cap guards test (BA-REQ-002)
- [x] 1.3 — RED: individual `activate(id)` PATCH shape test (IA-REQ-001)
- [x] 1.4 — GREEN: implemented `batchActivate` and `activate` methods mirroring `batchEnd`/`end`

### Verification
- `pnpm exec vitest run src/features/POS/promotions/api/__tests__/promotion.api.test.ts` — PASS (14 tests)

## Phase 2 — Mutation + Bulk Action Wiring (WU-2, Commit 2)
- [x] 2.1–2.2 — Added and implemented `canBatchActivate` permission gate (mirrors `canBatchEnd`).
- [x] 2.3–2.4 — Added primary batch-activate action with 0/100 guards and labels.
- [x] 2.5–2.6 — Added primary confirmation modal with selected promotion items.
- [x] 2.7–2.8 — Added success toast, invalidation, and selection clearing.
- [x] 2.9–2.10 — Added 404 `BATCH_DELETE_NOT_FOUND` count toast, invalidation, and clear.
- [x] 2.11–2.12 — Added 403 permission toast while preserving selection.
- [x] 2.13 — Pending loading binding coverage added in tests (RED until WU-3 wires it).

## Phase 3 — Loading Bind + Gate Verification (WU-3, Commit 3)
- [x] 3.1 — GREEN: extended `:loading="…"` on ConfirmModal to include `batchActivateMutation.isPending.value` (BA-REQ-008).
- [x] 3.2 — VERIFIED: existing `:enable-row-selection="canBatchDelete || canBatchEnd"` already covers update-only users since `canBatchEnd` and `canBatchActivate` map to the same `update:Promotion` permission. The BA-REQ-009 test exercises this scenario and passes via the existing gate. No gate widening needed (matches the user note: "The existing canUpdate gate already covers this").
- [x] 3.3 — Full verification completed: `pnpm test:unit` (3057 tests, +14 new) and `pnpm build` (no type errors).
- [x] 3.4 — Reviewed diff against SDD-11; changes are limited to documented batch-activate deltas plus the shared `BATCH_END_CAP` reuse (no `BATCH_ACTIVATE_CAP` constant per user direction "reuse existing BATCH_END_CAP").

## Out of Scope (deferred)
- Per-row "Reactivar" action for individual ENDED promos. The API method `activate(id)` exists in `promotionApi` and is ready to be wired into the row actions dropdown; this work was explicitly deferred ("Or simpler: just add the API method for now; the per-row action can come later").