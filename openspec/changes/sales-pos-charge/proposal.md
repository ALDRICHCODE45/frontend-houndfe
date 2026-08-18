# Proposal: Sales POS Charge — Frontend reconciliation with backend contract

## Intent

Backend phases 1–4 of the `sales-pos-charge` contract are complete. The FE POS/sales module already implements ~85% of the contract (verified by sdd-explore); it has **drifted** in four narrow ways and is **missing one surface**. This change is **gap-closure + reconciliation**, not a greenfield build. It closes the drift so FE behavior matches the real backend.

## Scope

### In Scope

- **A. Per-payment reference-edit UI** (biggest net-new surface). New `saleApi.updatePaymentReference()` (`PATCH /sales/:saleId/payments/:paymentId/reference`); new `useUpdatePaymentReference` composable; new `PaymentsListSection.vue` rendered under the "Pagos y deuda" totals card in `SaleDetailView`. Each payment row shows an inline "Editar referencia" affordance (non-CASH methods with `paymentId` present only). Optimistic update of `SaleDetailPayment.reference` + `getById` invalidation. Add `paymentId: string` to `SaleDetailPayment`. 404 `ENTITY_NOT_FOUND` → toast + re-fetch detail.
- **B. "Pagos Pendientes" tab** in listing. Third quick-tab in `SalesListTabs.vue` between "Todas" and "No Entregadas". Filter `paymentStatus=PARTIAL,CREDIT`. Surface `counts.pendingPayments`. Tab badge + empty state.
- **C. `reference` optional.** Remove reference-required block for non-cash in `PaymentModal.vue` `validate()` (L210–222) and `paymentEntries.utils.ts:65–70`. Allow `null`/`undefined` when sending. Remove obsolete `REFERENCE_REQUIRED` from `ChargeDomainErrorCode`.
- **D. Error-code fixes.** `ChargeDomainErrorCode`: add `PAYMENT_AMOUNT_INSUFFICIENT` (+ action "Agregá un pago en efectivo o ajustá los montos para cubrir el total"); remove `REFERENCE_REQUIRED`. `SaleDueDateErrorCode`: rename `SALE_ALREADY_PAID` → `SALE_FULLY_PAID`. `SellerAssignmentErrorCode`: remove dead `SELLER_NOT_ASSIGNABLE`.
- **E. Dead-code cleanup** (optional, recommended). Delete `SaleDetailHeader.vue` (orphaned, inlined at `SaleDetailView.vue:59`) and `components/payments/` subfolder (`PaymentEntryCard`, `PaymentMethodTileGrid`, `PaymentTotalsRow`, `paymentMethod.config.ts` — zero non-test imports) + their tests.

### Out of Scope

- WebSocket / outbox event bridge (`sale.confirmed`, `sale.payment.received`, `sale.fully.paid`).
- Facturación / CFDI; múltiples cajas / canales; límites de crédito por cliente; refunds / cancelación de pagos.
- Visual recolor ("Coco-ization") — separate `sales-payment-coco` change; will re-apply to the new surface if needed.

## Capabilities

> Contract with sdd-spec. Research `openspec/specs/` done.

### New Capabilities

- `sales-payment-references`: per-payment reference editing (PATCH endpoint, `SaleDetailPayment.paymentId`, `PaymentsListSection`, `useUpdatePaymentReference`).

### Modified Capabilities

- `sales` (existing `openspec/specs/sales/spec.md`): "Pagos Pendientes" tab + `paymentStatus` quick filter + `counts.pendingPayments` — modifies **REQ-19** (SalesListTabs invariant) and touches REQ-16/18.

### Spec-home note

The payment/charge contract (charge/debt modals, reference optionality, error-code semantics) has **no existing spec home**. `openspec/specs/sales/spec.md` exists but covers **promotions + listing** only. sdd-spec decides: extend `sales` or create a new `pos/sales` capability spec. `openspec/config.yaml` does not exist (no project `rules.proposal`).

## Approach

Work-unit slicing (sdd-tasks finalizes; delivery `single-pr`, budget 400 lines):

- **WU-A** — Types + API + error codes (D + `paymentId` add). Small (<400).
- **WU-B** — `updatePaymentReference` + `useUpdatePaymentReference` + `PaymentsListSection` UI + tests. ~400–600 lines → **`size:exception` needed for this single WU only**.
- **WU-C** — `reference` optional in both modals + util (C). Small (<400).
- **WU-D** — "Pagos Pendientes" tab + counts wiring (B). Small (<400).
- **WU-E** (optional) — Dead-code cleanup (E). Small.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/POS/sales/api/sale.api.ts` | Modified | Add `updatePaymentReference` |
| `src/features/POS/sales/composables/` | New | `useUpdatePaymentReference` |
| `src/features/POS/sales/components/PaymentsListSection.vue` | New | Per-payment rows + inline reference edit |
| `src/features/POS/sales/views/SaleDetailView.vue` | Modified | Mount `PaymentsListSection` under totals card |
| `src/features/POS/sales/interfaces/sale.types.ts` | Modified | `SaleDetailPayment.paymentId`; error-code edits |
| `src/features/POS/sales/components/PaymentModal.vue` / `DebtPaymentModal.vue` / `paymentEntries.utils.ts` | Modified | `reference` optional |
| `src/features/POS/sales/components/SalesListTabs.vue` + `useConfirmedSales` | Modified | Third tab + `pendingPayments` count |
| `SaleDetailHeader.vue` / `components/payments/` | Removed | Dead code (optional WU-E) |

## Decisions Assumed (auto mode — user reviews at end)

1. **Multi-method UX** — keep inline stacked rows already in `PaymentModal`/`DebtPaymentModal`. Don't adopt dead `components/payments/` blocks.
2. **Legacy credit format** — FE sends `{payments: []}`; backend tolerates via `normalizeChargeRequestPayments`. Document divergence explicitly; no code change.
3. **Idempotency-key lifecycle** — keep regen-on-entries-change. Reference-edit PATCH sends no `Idempotency-Key` (PATCH not idempotency-required by design).
4. **Timeline** — keep unified `SaleDetailTimeline.vue` feed. No change.
5. **Reference-edit UX location** — inline row in `PaymentsListSection.vue` under `SaleDetailTotalsCard`; slideover with current reference pre-filled, clear via `null`/`""`.
6. **Reference-edit permission** — always show affordance; backend enforces RBAC (403), FE toasts.
7. **Listing empty/loading states** — reuse `AppDataTable` pattern (already done for existing 2 tabs).
8. **`debtCents` sortable** — NO. Backend `sortBy` locked to `confirmedAt | totalCents | createdAt`. Keep non-sortable.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Doc §5.1 staleness tempts "fixing" debt-payment to single-method | High | Explicit note in proposal; do NOT change FE |
| `SALE_FULLY_PAID` rename breaks `useSaleDueDate` consumers (`DueDateEditModal.vue`) | Med | Update consumer + tests in same WU-A |
| Removing `SELLER_NOT_ASSIGNABLE` breaks `useSellerAssignment.test.ts:105` | Med | Delete test case in WU-A, no skip |
| New tests need Nuxt UI injection | Med | Use `src/test/mountWithUApp.ts` |
| `{payments:[]}` credit path breaks if backend tightens | Low | Explicit scenario test in WU-C |
| WU-B exceeds 400-line budget | High | `size:exception` for WU-B only |

## Rollback Plan

Single-PR to `main`: revert the PR commit (git revert) for full rollback. Per-WU: WU-B/D/C are additive or validation-loosening — safe to revert independently. WU-A error-code renames are the riskiest (compile-level, consumer-coupled) — revert as one commit with tests.

## Dependencies

Backend phases 1–4 complete: PATCH reference endpoint, `payments[].paymentId` in detail response, `PAYMENT_AMOUNT_INSUFFICIENT`, `SALE_FULLY_PAID`, `counts.pendingPayments`, `paymentStatus` filter. No blocking FE deps.

## Success Criteria

- [ ] `pnpm type-check` clean
- [ ] `pnpm test:unit` all green (vitest)
- [ ] `pnpm lint` clean
- [ ] `pnpm build` (authoritative) succeeds
- [ ] Reference edit persists; 404 → toast + re-fetch
- [ ] "Pagos Pendientes" tab shows `pendingPayments` count + filters correctly; empty state renders
