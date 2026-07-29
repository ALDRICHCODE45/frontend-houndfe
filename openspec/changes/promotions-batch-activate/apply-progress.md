# Apply Progress: promotions-batch-activate
## Phase 1 — API Layer (WU-1, Commit 1)
- [x] 1.1 — RED: batchActivate dedup + POST shape test (BA-REQ-002)
- [x] 1.2 — RED: batchActivate empty + cap guards test (BA-REQ-002)
- [x] 1.3 — RED: individual `activate(id)` PATCH shape test (IA-REQ-001)
- [x] 1.4 — GREEN: implemented `batchActivate` and `activate` methods mirroring `batchEnd`/`end`

### Verification
- `pnpm exec vitest run src/features/POS/promotions/api/__tests__/promotion.api.test.ts` — PASS (14 tests)
