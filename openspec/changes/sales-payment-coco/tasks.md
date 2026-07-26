# Tasks: Sales Payment Coco

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~75 |
| Estimated files | 6–7 |
| Estimated commits | 5 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single branch, five work-unit commits; manual merge to main |
| Delivery strategy | single-pr (PRs opted out; manual merge) |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| T1–T5 | Coco-ize and verify payment modals | No PR | `pnpm test:unit --run -- src/features/POS/sales/components/__tests__/{PaymentModal,PaymentSuccessModal,DebtPaymentModal}.test.ts` | Dev server: payment, success, and debt modals in light/dark | `git revert <sha>` per work-unit commit; no API/data-shape changes |

## Tasks

### [x] T1 — `feat(sales): coco-ize PaymentModal payment surface`

- **Files**: `src/features/POS/sales/components/PaymentModal.vue`
- **Change**: Apply all seven banner, tile, hover, icon, link, `UInputNumber`, and Confirmar cobro substitutions; preserve behavior/contracts. Satisfies PMT-REQ-001 (partial), 002, 003 (partial), 004 (PaymentModal), 005 (PaymentModal).
- **Verification**: `pnpm build`; dev server: open PaymentModal, select methods, enter amounts, confirm.
- **Rollback**: `git revert <T1-sha>` restores only PaymentModal styling.
- **Dependencies**: None.

### [x] T2 — `feat(sales): coco-ize PaymentSuccessModal`

- **Files**: `src/features/POS/sales/components/PaymentSuccessModal.vue`
- **Change**: Replace Cambio text with mode-aware coco-gold and apply the canonical brand-action class to Cerrar. Satisfies PMT-REQ-001 (partial), 003 (Cambio), 004 (Cerrar).
- **Verification**: `pnpm build`; dev server: complete a payment and inspect Cambio/Cerrar.
- **Rollback**: `git revert <T2-sha>` restores only PaymentSuccessModal styling.
- **Dependencies**: T1.

## Visual review checkpoint

After T2, review PaymentModal and PaymentSuccessModal in light/dark before T3. Resolve requested token tweaks here so DebtPaymentModal mirrors the approved pattern.

### [x] T3 — `feat(sales): coco-ize DebtPaymentModal`

- **Files**: `src/features/POS/sales/components/DebtPaymentModal.vue`
- **Change**: Mirror T1’s approved banner, tile, hover, icon, input, and debt-action substitutions without changing warning semantics or contracts. Satisfies PMT-REQ-001 (partial), 002, 003 (partial), 004 (debt action), 005 (debt input).
- **Verification**: `pnpm build`; dev server: open debt payment, select methods, enter amounts, confirm.
- **Rollback**: `git revert <T3-sha>` restores only DebtPaymentModal styling.
- **Dependencies**: T2 and visual approval.

### [x] T4 — `test(sales): pin coco-gold tokens on payment modals`

- **Files**: `src/features/POS/sales/components/__tests__/PaymentModal.test.ts`, `src/features/POS/sales/components/__tests__/PaymentSuccessModal.test.ts`, `src/features/POS/sales/components/__tests__/DebtPaymentModal.test.ts`
- **Change**: Add five focused token assertions and forward `$attrs` in PaymentModal’s `buttonStub`; keep behavioral assertions intact. Satisfies PMT-REQ-006.
- **Verification**: `pnpm test:unit --run -- src/features/POS/sales/components/__tests__/PaymentModal.test.ts src/features/POS/sales/components/__tests__/PaymentSuccessModal.test.ts src/features/POS/sales/components/__tests__/DebtPaymentModal.test.ts`; `pnpm build`.
- **Rollback**: `git revert <T4-sha>` removes only regression assertions/stub fidelity change.
- **Dependencies**: T3.

### [x] T5 — `chore(sales): verify payment coco tokens`

- **Files**: `openspec/changes/sales-payment-coco/VERIFICATION.md` (or commit body only)
- **Change**: Record light/dark checks for all three modals and the `UInputNumber` warning-versus-neutral ring decision. Satisfies PMT-REQ-003 visual verification and PMT-REQ-005 fallback decision.
- **Verification**: `pnpm test:unit --run`; `pnpm build`; dev server walkthrough of payment, success, and debt flows in both themes; confirm `SaleTotalsFooter.vue` has no diff.
- **Rollback**: `git revert <T5-sha>` removes verification evidence only; any input fallback belongs in T1/T3.
- **Dependencies**: T4.

## Dependency Graph

`T1 → T2 → [VISUAL REVIEW] → T3 → T4 → T5`
