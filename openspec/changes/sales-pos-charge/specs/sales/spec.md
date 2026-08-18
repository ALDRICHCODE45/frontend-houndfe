# Delta Spec: sales

Extends `openspec/specs/sales/spec.md`. Decision rationale in engram `sdd/sales-pos-charge/spec`.

> **In-flight correction (archive phase)**: REQ-NEW-4 wording reconciled with the implementation's whitelist `{CARD_DEBIT, CARD_CREDIT, TRANSFER}` (see `referenceEditAffordance.ts:19-22`). The original delta said `method !== 'CASH'`; the verify-report flagged the divergence as a WARN. The whitelist is defensible — cash and credit sales have no per-payment reference by definition, and contract doc §3.2 excludes `'credit'` from the `payments[]` array. The implementation was NOT reverted; both the canonical spec and this delta now reflect the whitelist.

## ADDED Requirements

### REQ-NEW-1: Reference-edit endpoint
`saleApi.updatePaymentReference` SHALL expose `PATCH /sales/:saleId/payments/:paymentId/reference` with `{ reference: string | null }` and NO `Idempotency-Key`.

- **Given** `paymentId` and a non-empty reference, **When** invoked, **Then** the PATCH fires with the body and no `Idempotency-Key`.
- **Given** `reference: null`, **When** the PATCH fires, **Then** the backend persists null.

### REQ-NEW-2: useUpdatePaymentReference composable
On success invalidate `getById(saleId)`. On 404 `ENTITY_NOT_FOUND` toast "el pago ya no existe" AND re-fetch `getById`.

- **Given** a successful PATCH, **When** resolved, **Then** `getById(saleId)` is invalidated.
- **Given** a 404, **When** the mutation rejects, **Then** a toast shows and `getById` re-fetches.

### REQ-NEW-3: PaymentsListSection component
`PaymentsListSection.vue` SHALL render every `SaleDetail.payments[]` entry under the "Pagos y deuda" totals card in `SaleDetailView` (one row per payment).

- **Given** `payments.length === 3`, **When** `SaleDetailView` renders, **Then** exactly 3 rows render.

### REQ-NEW-4: Edit affordance on non-CASH non-CREDIT rows
Rows with `method` in the whitelist `{CARD_DEBIT, CARD_CREDIT, TRANSFER}` AND `paymentId` present SHALL expose "Editar referencia" opening a slideover pre-filled with `reference`. Cash and credit sales have no per-payment reference by definition; the edit affordance would be misleading. The whitelist `{CARD_DEBIT, CARD_CREDIT, TRANSFER}` is intentional and matches the contract doc §3.2 which excludes `'credit'` from the `payments[]` array. Always render (backend RBAC enforces; FE toasts on 403).

- **Given** `method: 'CARD_DEBIT'` or `'CARD_CREDIT'` or `'TRANSFER'`, **When** the row renders, **Then** "Editar referencia" is visible and the slideover opens pre-filled.
- **Given** `method: 'CASH'`, **When** the row renders, **Then** no "Editar referencia" is visible.
- **Given** `method: 'CREDIT'`, **When** the row renders, **Then** no "Editar referencia" is visible (whitelist excludes CREDIT by design — see contract §3.2).

### REQ-NEW-5: Slideover submit semantics
Accept string OR null/"". Empty normalized to null before transport.

- **Given** the slideover open with current reference pre-filled, **When** the cashier clears and submits, **Then** the PATCH fires with `reference: null`.

### REQ-NEW-6: SaleDetailPayment.paymentId required
`SaleDetailPayment` SHALL include `paymentId: string` (required, non-null).

- **Given** a `SaleDetailPayment` literal, **When** type-checked, **Then** omitting `paymentId` is a type error.

### REQ-NEW-7: Reference-edit error handling
404 → toast + re-fetch (REQ-NEW-2). 403 → permission toast. Network → backoff retry.

- **Given** a 403, **When** the mutation rejects, **Then** a permission toast shows.
- **Given** a transient network failure, **When** the mutation rejects, **Then** the composable retries with exponential backoff.

### REQ-NEW-8: Pending-payments badge conditional
The "Pagos Pendientes" tab SHALL show the badge only when `counts.pendingPayments > 0`; tab remains selectable at `0`.

- **Given** `counts.pendingPayments === 8`, **When** the listing renders, **Then** the badge shows `8`.
- **Given** `counts.pendingPayments === 0`, **When** the listing renders, **Then** the tab renders without a badge and clicking it shows the empty table.

### REQ-NEW-9: PaymentModal reference optional
`PaymentModal.validate()` SHALL NOT require `reference` for non-CASH entries.

- **Given** a non-CASH entry with no `reference`, **When** submitted, **Then** the payload omits `reference` and the backend returns 200 OK.

### REQ-NEW-10: DebtPaymentModal reference optional
`DebtPaymentModal.validateEntry` SHALL NOT require `reference`.

- **Given** a non-CASH debt entry with no `reference`, **When** submitted, **Then** the payload omits `reference` and the backend returns 200 OK.

### REQ-NEW-11..14: Error-code reconciliation
- **REQ-NEW-11** `ChargeDomainErrorCode` SHALL NOT enumerate `REFERENCE_REQUIRED`.
- **REQ-NEW-12** `ChargeDomainErrorCode` SHALL include `PAYMENT_AMOUNT_INSUFFICIENT` with action `"Agregá un pago en efectivo o ajustá los montos para cubrir el total"`.
- **REQ-NEW-13** `SaleDueDateErrorCode` SHALL enumerate `SALE_FULLY_PAID` (not `SALE_ALREADY_PAID`); `DueDateEditModal` mapping updated in lock-step.
- **REQ-NEW-14** `SellerAssignmentErrorCode` SHALL NOT enumerate `SELLER_NOT_ASSIGNABLE` (backend only emits `SELLER_NOT_FOUND`).

- **Given** the backend returns `PAYMENT_AMOUNT_INSUFFICIENT`, **When** a multi-method charge under-covers the total, **Then** a toast displays the action text.
- **Given** a backend 4xx with `code: 'SALE_FULLY_PAID'`, **When** `useSaleDueDate` rejects, **Then** `DueDateEditModal` shows the "sale is already fully paid" message.
- **Given** `AssignSellerSlideover` error mapping, **When** inspected, **Then** it does NOT branch on `SELLER_NOT_ASSIGNABLE`.

### REQ-NEW-15: Dead code MAY be removed
MAY delete (WU-E): `SaleDetailHeader.vue`, `components/payments/PaymentEntryCard.vue`, `PaymentMethodTileGrid.vue`, `PaymentTotalsRow.vue`, `paymentMethod.config.ts` (+ `__tests__`) — zero non-test imports.

## MODIFIED Requirements

### REQ-19: Preserved Sales List Invariants
`SalesListTabs` (Todas / Pagos Pendientes / No Entregadas), `SaleCard`, `PaymentMethodPills`, `salesFiltersSchema` (11 fields, 4 sections), and every `#<id>-cell` slot SHALL remain unchanged. "Pagos Pendientes" is an additive slot filtering `paymentStatus=PARTIAL,CREDIT` and surfacing `counts.pendingPayments` (badge per REQ-NEW-8).

- **Given** the listing mounts, **When** `SalesListTabs` renders, **Then** three tabs render: Todas, Pagos Pendientes, No Entregadas AND `SaleCard`/`PaymentMethodPills`/`salesFiltersSchema`/`#<id>-cell` match prior behavior.
