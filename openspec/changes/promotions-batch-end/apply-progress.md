
## Phase 2 — Mutation + Bulk Action Wiring (WU-2)
- [x] 2.1–2.2 — Added and implemented `update:Promotion` permission gate.
- [x] 2.3–2.4 — Added warning batch-end action with 0/100 guards and labels.
- [x] 2.5–2.6 — Added warning confirmation modal with selected promotion items.
- [x] 2.7–2.8 — Added success toast, invalidation, and selection clearing.
- [x] 2.9–2.10 — Added 404 `BATCH_DELETE_NOT_FOUND` count toast, invalidation, and clear.
- [x] 2.11–2.12 — Added 403 permission toast while preserving selection.
- [x] 2.13–2.14 — Added pending loading binding coverage and wired mutation pending state.

### Verification
- `pnpm exec vitest run src/features/POS/promotions/api/__tests__/promotion.api.test.ts src/features/POS/promotions/views/__tests__/PromotionsView.test.ts` — PASS (55 tests)
- `pnpm build` — PASS (type-check + Vite build; chunk-size warning only)

## Phase 3 — Selection Gate + Constants (WU-3)
- [ ] 3.1–3.3 — Add update-only selection visibility coverage, widen gate, and verify `BATCH_END_CAP`.
