# Tasks: Sales History Coco

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~60–70 |
| Estimated files | 12 (6 components + 6 tests) |
| Estimated commits | 7 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Seven commits; manual merge |
| Delivery strategy | single-pr (no PRs) |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

T1–T7 are rollback-safe commits; evidence follows.

Cross-cutting: HST-REQ-005/006/008. Threat matrix: N/A.

## Tasks

### [x] T1 — `feat(sales): coco-ize SalesListView action + folio link`
- **Files**: `src/features/POS/sales/views/SalesListView.vue`
- **Change/spec requirements satisfied**: Apply Nueva Venta Cobrar class, `text-coco-gold-800` folio, and Coco-neutral `ui.body` — HST-REQ-001 (partial), 002–004.
- **Verification**: `pnpm test:unit --run -- src/features/POS/sales/views/__tests__/SalesListView.test.ts`; `pnpm build`; `pnpm dev` → `/pos/ventas`, light/dark.
- **Rollback**: `git revert <T1-sha>`.
- **Dependencies**: None.

### [x] T2 — `feat(sales): coco-ize SaleCard folio + UCard surface`
- **Files**: `src/features/POS/sales/components/SaleCard.vue`
- **Change/spec requirements satisfied**: Coco-neutral `ui.body`, remove `bg-default`, `text-coco-gold-800` folio — HST-REQ-001 (partial), 002, 004.
- **Verification**: `pnpm test:unit --run -- src/features/POS/sales/components/__tests__/SaleCard.test.ts`; `pnpm build`; `pnpm dev` → mobile cards, light/dark.
- **Rollback**: `git revert <T2-sha>`.
- **Dependencies**: T1.

### [x] T3 — `feat(sales): coco-ize SaleDetailTimeline event + connector`
- **Files**: `src/features/POS/sales/components/SaleDetailTimeline.vue`
- **Change/spec requirements satisfied**: Coco-gold SALE_REGISTERED tint and Coco-neutral connector — HST-REQ-001 (partial), 004.
- **Verification**: `pnpm build`; `pnpm dev` → 2+ events, light/dark. Selector update lands in T7.
- **Rollback**: `git revert <T3-sha>`.
- **Dependencies**: T2.

## Visual review checkpoint
STOP after T3; approve event/connector before T4 or adjust T3/T4.

### [x] T4 — `feat(sales): coco-ize SaleDetailTotalsCard Registrar Pago CTA`
- **Files**: `src/features/POS/sales/components/SaleDetailTotalsCard.vue`
- **Change/spec requirements satisfied**: Cobrar classes on `register-debt-payment`; `debtClass` unchanged — HST-REQ-001 (partial), 003.
- **Verification**: `pnpm test:unit --run -- src/features/POS/sales/components/__tests__/SaleDetailTotalsCard.test.ts`; `pnpm build`; `pnpm dev` → debt CTA, light/dark.
- **Rollback**: `git revert <T4-sha>`.
- **Dependencies**: T3 + visual approval.

### [x] T5 — `feat(sales): coco-ize SaleCommentInput trigger tint`
- **Files**: `src/features/POS/sales/components/SaleCommentInput.vue`
- **Change/spec requirements satisfied**: Drop `color="primary"`; add `!bg-coco-gold-500/15 !text-coco-gold-800 dark:!text-coco-gold-300` — HST-REQ-001 (partial), 004.
- **Verification**: `pnpm build`; `pnpm dev` → comment trigger, light/dark. Selector update lands in T7.
- **Rollback**: `git revert <T5-sha>`.
- **Dependencies**: T4.

### [x] T6 — `feat(sales): coco-ize SaleDetailView header + Datos cards + header CTA`
- **Files**: `src/features/POS/sales/views/SaleDetailView.vue`
- **Change/spec requirements satisfied**: `coco-neutral-50/950` header/five Datos cards; Cobrar header CTA — HST-REQ-001 (partial), 002, 003.
- **Verification**: `pnpm test:unit --run -- src/features/POS/sales/views/__tests__/SaleDetailView.test.ts`; `pnpm build`; `pnpm dev` → all four tabs; check all five `reflow-*` cards.
- **Rollback**: `git revert <T6-sha>`.
- **Dependencies**: T5.

### [x] T7 — `test(sales): pin coco tokens on sales-history components`
- **Files**: `src/features/POS/sales/views/__tests__/SalesListView.test.ts`, `src/features/POS/sales/views/__tests__/SaleDetailView.test.ts`, `src/features/POS/sales/components/__tests__/SaleCard.test.ts`, `src/features/POS/sales/components/__tests__/SaleDetailTimeline.test.ts`, `src/features/POS/sales/components/__tests__/SaleDetailTotalsCard.test.ts`, `src/features/POS/sales/components/__tests__/SaleCommentInput.test.ts`
- **Change/spec requirements satisfied**: Add design-table pins, rewrite both primary assertions, and forward `$attrs` in the SaleDetailView UButton stub — HST-REQ-001 (test), 004, 007.
- **Verification**: `pnpm test:unit --run -- src/features/POS/sales/views/__tests__/{SalesListView,SaleDetailView}.test.ts src/features/POS/sales/components/__tests__/{SaleCard,SaleDetailTimeline,SaleDetailTotalsCard,SaleCommentInput}.test.ts`; `pnpm build`.
- **Rollback**: `git revert <T7-sha>`.
- **Dependencies**: T6.

## Dependency Graph
`T1 → T2 → T3 → [VISUAL REVIEW] → T4 → T5 → T6 → T7`
