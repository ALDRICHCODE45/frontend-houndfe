# promotions-batch-end apply progress

## Phase 1 — API Layer (WU-1)
- [x] 1.1 RED — Added batchEnd deduplication/POST test; confirmed failure before implementation.
- [x] 1.2 RED — Added empty-array and >100 guards tests; confirmed failure before implementation.
- [x] 1.3 GREEN — Implemented `promotionApi.batchEnd` with deduplication, 0/100 guards, and `{ ended }` response.

### Verification
- `pnpm test:unit -- src/features/POS/promotions/api/__tests__/promotion.api.test.ts` — PASS (212 tests, 2972 tests)
- `pnpm build` — PASS (type-check + Vite build; chunk-size warning only)
