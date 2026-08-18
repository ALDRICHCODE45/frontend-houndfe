# Exploration: sales-pos-charge

> **Headline reframe (read this first)**: the FE is **not** a greenfield build for this contract. The `frontend-houndfe` POS/sales module has **already implemented the large majority** of the `sales-pos-charge-frontend.md` contract — multi-method charge (max 5), legacy single-payment, credit, confirmed-sales listing with tabs/filters/counts, detail view with 4-variant timeline + inline comments, debt collection (multi-method), customer/address/seller assignment, comments CRUD, due-date editing, idempotency-key helper, and the two `customer` shapes + `method` case asymmetry.
>
> The real work is **narrow gap-closure + reconciliation**, dominated by: (1) the missing **payment-reference editing** endpoint (`PATCH /sales/:saleId/payments/:paymentId/reference`), (2) a **missing "Pagos Pendientes" tab** in the listing, (3) making `reference` **optional** in validation (contract changed 2026-08-11 but FE still requires it), and (4) a handful of **stale/mismatched error codes** (`SALE_FULLY_PAID` vs `SALE_ALREADY_PAID`, missing `PAYMENT_AMOUNT_INSUFFICIENT`, dead `SELLER_NOT_ASSIGNABLE`). The contract doc §5.1 is itself **stale** (debt payment is multi-method in both FE and real backend, not single-payment).

---

## 1. Existing FE state inventory

| Path | Purpose | State | Evidence |
|---|---|---|---|
| `components/PaymentModal.vue` | Charge a draft → confirmed; primary checkout surface | `exists-but-mismatch` | Multi-method already built: `entries[]` with `MAX_ENTRIES = 5` (`:36`), dual legacy/array `buildPayload()` (`:243-258`), idempotency key (`:139,:149`), due-date section (`:450-488`). **Mismatch**: `validate()` still forces reference for card/transfer (`:210-222`); pure credit sends `{payments: []}` not legacy `{method:'credit', amountCents:0}`. |
| `components/PaymentSuccessModal.vue` | Receipt after charge | `exists-as-is` | Handles `changeDueCents`, `debtCents`, `paymentStatus` badges (`:62-81`). |
| `components/DebtPaymentModal.vue` | Collect debt on confirmed sale | `exists-but-mismatch` | Multi-method already built (`entries[]`, `MAX_PAYMENT_ENTRIES`, `:30,:128`). Sends `{payments:[...]}` — **correct vs real backend** (`AddSalePaymentDto` accepts `payments[]` @ArrayMaxSize(5)), **stale vs doc §5.1**. **Mismatch**: reference still required via `validateEntry` (`paymentEntries.utils.ts:65-70`). |
| `components/PaymentMethodPills.vue` | **Display-only** pills for listing `paymentMethods[]` | `exists-as-is` | Reads UPPERCASE `SaleDetailPaymentMethod[]`, renders via `paymentMethodMeta` (`:6-22`). NOT a selector (contrary to initial assumption). |
| `components/DueDateEditModal.vue` | Edit/clear due date | `exists-but-mismatch` | Wired via `useSaleDueDate`. **Mismatch**: maps `SALE_ALREADY_PAID` (`:68`) — backend emits `SALE_FULLY_PAID`. |
| `components/AssignCustomerSlideover.vue` | Assign customer + shipping address (draft) | `exists-as-is` | 2-step picker (`:123-194`); handles `CUSTOMER_NOT_FOUND`/`SHIPPING_ADDRESS_*`/`SALE_NOT_DRAFT` errors. |
| `components/AssignSellerSlideover.vue` | Assign seller (confirmed + draft) | `exists-as-is` | Wired to `usersApi.listAssignable()` (`GET /users/assignable`). **Dead code**: `SELLER_NOT_ASSIGNABLE` branch (`:71`) — backend only emits `SELLER_NOT_FOUND`. |
| `components/SaleCommentInput.vue` | "Agregar comentario" trigger | `exists-as-is` | Delegates to `SaleCommentSlideover`. |
| `components/SaleCommentSlideover.vue` | Comment add slideover | `exists-as-is` | Trim + focus handling (`:22,:53-60`). |
| `components/SaleDetailHeader.vue` | (was) detail header | **orphaned** | Not imported anywhere; `SaleDetailView.vue:59` comment confirms it was inlined. Dead file. |
| `components/SaleDetailItemsList.vue` | Detail items table | `exists-as-is` | Renders NET `subtotalCents`, strikethrough, badges (`:44-126`). |
| `components/SaleDetailTotalsCard.vue` | Detail totals + "Registrar Pago" | `exists-as-is` | Totals rows + debt-colored + register-payment CTA (`:83-95`). |
| `components/SaleDetailTimeline.vue` | 4-variant timeline + inline comment edit/delete | `exists-as-is` | Discriminated 4-event render (`:45-64`), actor asymmetry handled (`:53-56`), inline COMMENT edit/delete (`:162-177`). |
| `components/SaleCard.vue` / `SaleCardGrid.vue` | Card-mode list | `exists-as-is` | Card renders customer/folio/total/debt/due-date (`SaleCard.vue:69-105`). |
| `components/payments/PaymentEntryCard.vue`, `PaymentMethodTileGrid.vue`, `PaymentTotalsRow.vue`, `paymentMethod.config.ts` | (intended) multi-method building blocks | **dead code** | Not imported by any non-test source (grep confirms zero usage outside `__tests__`). Duplicates the inline logic now living in `PaymentModal.vue`/`DebtPaymentModal.vue`. |
| `components/SalesListTabs.vue` | Listing quick tabs | `exists-but-mismatch` | Only **2 tabs** ("Todas", "No Entregadas") (`:21-40`). **Missing** "Pagos Pendientes" tab (doc §6.7) and never surfaces `counts.pendingPayments`. |

**Routes**: `/pos/ventas` → `SalesListView` (list), `/pos/ventas/:id` → `SaleDetailView` (detail), `/pos/ventas/nueva` → `SalesView` (draft checkout) — all wired in `src/app/router/index.ts:120-146`.

---

## 2. Gap matrix

Contract capability → FE state (evidence), gaps marked.

| # | Capability (doc ref) | FE state | Gaps |
|---|---|---|---|
| 1 | Cobrar draft multi-método (§3.2 array) | **exists** — `PaymentModal` entries max 5, `buildPayload` array branch | reference still required (should be optional); `PAYMENT_AMOUNT_INSUFFICIENT` unmapped |
| 2 | Cobrar draft legacy (§3.2 legacy) | **exists** — `buildPayload` single branch (`PaymentModal.vue:247-255`) | none |
| 3 | Cobrar draft crédito (§3.2 legacy credit) | **exists-but-verify** — sends `{payments: []}` when `entries.length===0 && hasCustomer` | backend `normalizeChargeRequestPayments` tolerates `payments: []` → CREDIT status, so it works, but it diverges from the documented legacy `{method:'credit', amountCents:0}`. Confirm in design. |
| 4 | Listar ventas confirmadas (§6) | **exists** — `SalesListView` + `useConfirmedSales` + `salesFiltersSchema` | "Pagos Pendientes" tab missing; `ConfirmedSaleRow` nullability (folio/paymentStatus/confirmedAt) not typed |
| 5 | Detalle venta (§7) | **exists** — `SaleDetailView` | no per-payment rows with editable reference (payments only appear in timeline + `uniquePaymentMethods`) |
| 6 | Timeline (§7.5) | **exists** — `SaleDetailTimeline` 4 variants + actor asymmetry | none |
| 7 | Modal cobro deuda (§5) | **exists** — `DebtPaymentModal` multi-method | reference still required (validateEntry) |
| 8 | Editar/limpiar referencia (§5.5) | **MISSING** | no `saleApi.updatePaymentReference`; no UI; `SaleDetailPayment` lacks `paymentId` |
| 9 | Asignar cliente (§2.5) | **exists** — draft only | none (draft-only matches contract) |
| 10 | Asignar dirección (§2.5) | **exists** — draft only | none |
| 11 | Asignar vendedor (§2.6) | **exists** — confirmed (`SaleDetailView`); verify draft (`SalesView`) | `SELLER_NOT_ASSIGNABLE` dead code |
| 12 | Comentarios CRUD (§2.7) | **exists** — add/update/delete + timeline inline | none |
| 13 | Update due date (§8) | **exists** | error code `SALE_ALREADY_PAID` → should be `SALE_FULLY_PAID` |
| 14 | Idempotency-key helper (§4) | **exists** — `newIdempotencyKey()` + regen on entries change | key regen policy is a product decision (see §6) |
| 15 | Error envelope parsing (§9) | **exists** — per-domain error classes (`SaleCommentError`, `SellerAssignmentError`, `SaleDueDateError`, `DraftCustomerAssignmentError`) + `salePaymentErrors.utils` map | scattered; `PAYMENT_AMOUNT_INSUFFICIENT` missing from `ChargeDomainErrorCode` and its action map |
| 16 | Type asymmetry mapping (customer 2 shapes, method case) | **exists** — `SaleDraftCustomer {id,firstName,lastName}` vs `SaleActorRef {id,name}`; `PAYMENT_METHOD` (lower) vs `SALE_DETAIL_PAYMENT_METHOD` (upper) | three method-config sources (`salePaymentMethod.utils`, `paymentMethodMeta`, `payments/paymentMethod.config`) — divergence risk |

---

## 3. API client inventory

All endpoints wired in `src/features/POS/sales/api/sale.api.ts` unless noted.

| Endpoint | Wired? | Notes |
|---|---|---|
| `POST /sales/drafts/:id/charge` | ✅ `chargeDraft` (`:179-190`) | `Idempotency-Key` header ✓ |
| `POST /sales/:id/payments` | ✅ `registerDebtPayment` (`:192-203`) | `Idempotency-Key` ✓. FE sends `{payments:[...]}`; backend supports array (max 5) — **doc §5.1 stale** |
| `PATCH /sales/:saleId/payments/:paymentId/reference` | ❌ **MISSING** | No API method. No `Idempotency-Key` needed (update). |
| `PUT /sales/drafts/:id/customer` | ✅ `assignCustomer` (`:147`) | |
| `DELETE /sales/drafts/:id/customer` | ✅ `unassignCustomer` (`:152`) | |
| `PUT /sales/drafts/:id/shipping-address` | ✅ `assignShippingAddress` (`:156`) | |
| `DELETE /sales/drafts/:id/shipping-address` | ✅ `unassignShippingAddress` (`:175`) | |
| `PUT /sales/:id/seller` | ✅ `assignSeller` (`:161`) | |
| `DELETE /sales/:id/seller` | ✅ `unassignSeller` (`:166`) | |
| `POST /sales/:id/comments` | ✅ `addComment` (`:235`) | |
| `PATCH /sales/:id/comments/:commentId` | ✅ `updateComment` (`:244`) | |
| `DELETE /sales/:id/comments/:commentId` | ✅ `deleteComment` (`:253`) | |
| `PATCH /sales/:id/due-date` | ✅ `setDueDate` (`:170`) | |
| `GET /sales` | ✅ `listConfirmed` (`:225`) | |
| `GET /sales/:id` | ✅ `getById` (`:230`) | |
| `GET /users/assignable` | ✅ `usersApi.listAssignable` (`src/features/POS/users/api/user.api.ts:5`) | |
| `GET /sales/:id/pdf` | ✅ `getPdfBlob` (`:317`) | bonus, not in this contract |

**Special attention (per prompt):**

- **Idempotency-Key header pattern** — helper `newIdempotencyKey()` (`utils/idempotency.utils.ts`) exists and is used by both charge and debt flows. The header is set per-request in `saleApi`. ✓
- **2 `customer` representations** — already typed separately: `SaleDraftCustomer {id, firstName, lastName}` (draft mutations) vs `SaleActorRef {id, name}` (queries). `Sale.customer` is `SaleDraftCustomer | null`; `SaleDetail.customer` / `ConfirmedSaleRow.customer` is `SaleActorRef | null`. ✓ No work needed.
- **`method` case asymmetry** — already handled via two constants (`PAYMENT_METHOD` lowercase / `SALE_DETAIL_PAYMENT_METHOD` uppercase). Payment modals do `.toUpperCase()` inline to map lowercase entry → uppercase display/color. ✓ (but see §4 divergence risk on config sources).
- **`payments[].paymentId`** — **NOT in FE type**. `SaleDetailPayment` (`sale.types.ts:128-135`) has `method, amountCents, tenderedCents, changeCents, reference, paidAt` — **missing `paymentId`**. This is the key for reference editing. Must be added.
- **`timeline` discriminated union** — already typed exactly per §7.5 with actor asymmetry (`SaleTimelineEvent`, `sale.types.ts:137-165`). ✓
- **`debtCents` on listing + detail** — present in both `ConfirmedSaleRow.debtCents` and `SaleDetail.debtCents`. ✓
- **`counts` for tabs** — typed (`SalesListCounts`, `sale.types.ts:54-58`) and consumed (`useConfirmedSales:107`, `SalesListTabs`), but `pendingPayments` is never rendered (missing tab).

---

## 4. Type audit

| Type | State | Action |
|---|---|---|
| `PaymentMethod` (lowercase) | ✅ exists | none |
| `SaleDetailPaymentMethod` (uppercase) | ✅ exists | none |
| `Sale` (draft) | ✅ exists | none |
| `SaleDetail` | ✅ exists | none |
| `SaleDetailPayment` (≈ "SalePayment") | ⚠️ exists | **ADD `paymentId: string`** for reference editing |
| `SaleTimelineEvent` | ✅ exists (4 variants, actor asymmetry) | none |
| `ChargeSalePayload` (legacy\|multi union) | ✅ exists | none |
| `DebtPaymentPayload` | ✅ exists `{payments: PaymentEntry[]}` | matches real backend |
| `DebtPaymentResponse` | ✅ exists (`paymentIds: string[]`) | matches backend `updated.paymentIds` |
| `ChargeDomainErrorCode` | ⚠️ exists | **remove `REFERENCE_REQUIRED`** (backend dropped it); **add `PAYMENT_AMOUNT_INSUFFICIENT`** (doc §3.3) + its action map entry |
| `SaleDueDateErrorCode` | ⚠️ exists | **rename `SALE_ALREADY_PAID` → `SALE_FULLY_PAID`** (backend `sale.errors.ts:11`) |
| `SellerAssignmentErrorCode` | ⚠️ exists | **remove `SELLER_NOT_ASSIGNABLE`** (backend never emits) |
| `ConfirmedSaleRow` | ⚠️ exists | `folio`, `paymentStatus`, `confirmedAt` are non-null but doc §6.4 says nullable for DRAFT rows (listing can filter `status=DRAFT`) |

No Zod schemas exist in this module (plain string unions + `as const` constants per `sdd/magic-string-constants` convention). New reference-editing needs: a small `UpdatePaymentReferencePayload { reference: string | null }` and a `SaleDetailPayment.paymentId`. No new Zod/variant helper needed beyond what exists.

---

## 5. UX hot spots

- **PaymentModal — NOT a rewrite.** Multi-method already built (stacked entry rows + method-tile grid + count badges + max-5 guard + due-date section). The only UX change: make `reference` optional (remove the hard block in `validate()` and `validateEntry`), likely with an "optional, add later" hint.
- **PaymentMethodPills — NOT a selector.** Display-only; no work.
- **SaleDetailTimeline — NO rewrite.** 4 variants + comment edit/delete already complete.
- **AssignSellerSlideover — done.** `GET /users/assignable` wired; just clean dead `SELLER_NOT_ASSIGNABLE` branch.
- **Listing view — EXISTS but incomplete.** Missing "Pagos Pendientes" tab. The quick-tab mechanism (`useConfirmedSales.setDeliveryStatusFilter`) only drives `deliveryStatus`; a `paymentStatus` quick filter must be added (or the tab modeled through the existing `paymentStatus` multiEnum filter).
- **NEW surface — payment reference editing.** There is currently **no per-payment row UI** in the detail. The "Pagos y deuda" tab renders only `SaleDetailTotalsCard` (totals + register button). To edit a reference you must add a payments list (each row: method, amount, reference with inline edit, `paymentId` as key) — likely inside the "Pagos y deuda" tab, or a dedicated slideover/modal. This is the biggest net-new UI.

---

## 6. Open product questions (for sdd-propose)

1. **Multi-method UX** — already resolved in-tree (stacked rows + tile grid + count badges, max 5). Confirm keep-as-is vs. adopt the dead `payments/PaymentEntryCard` building blocks.
2. **Legacy format exposure** — FE never sends legacy `{method:'credit', amountCents:0}`; it uses `{payments: []}` for pure credit. Confirm this is acceptable (backend tolerates it) or switch to explicit legacy credit.
3. **Idempotency-key lifecycle** — currently regenerated on **every** `entries` deep change (amount/method/reference) and on modal open; reused across retries only if entries are untouched. Confirm: should reference edits also regenerate the key (they don't affect the payment hash's order, but do affect the payload hash)?
4. **Timeline render** — unified chronological feed already implemented (all 4 types inline, comments editable). Confirm keep single feed vs. tabbed.
5. **Reference-editing UX** — where? Inline edit-on-click per payment row in "Pagos y deuda" tab (recommended), or a dedicated slideover? Which methods are candidates (any non-CASH, per checklist §"Edición posterior")?
6. **"Editar referencia" permission** — any `update:Sale` user can edit any payment's reference (doc §5.5.2). Confirm: always show the edit affordance (rely on backend 403), or hide when the current user isn't the cashier (there is no per-payment `userId` in the detail response to gate on, so **always-show + backend enforcement** is the pragmatic default).
7. **Empty/loading/error states for listing tabs** — existing `AppDataTable` handles row empty/loading; confirm no tab-specific states needed beyond the current `counts` badges.
8. **`debtCents` as sortable column** — backend `sortBy` is locked to `confirmedAt | totalCents | createdAt` (no `debtCents`). Confirm `debtCents` stays a non-sortable display column (already `enableSorting: false`).

---

## 7. Dependency risks / gotchas

- **Contract doc §5.1 is stale.** Debt payment is multi-method in both FE and real backend (`AddSalePaymentDto.payments[] @ArrayMaxSize(5)`), contradicting the doc's "un solo pago por request". Do NOT "fix" the FE to single-payment — the FE is correct. Note the doc drift in proposal; no FE change.
- **Dead code in `components/payments/`** (`PaymentEntryCard`, `PaymentMethodTileGrid`, `PaymentTotalsRow`, `paymentMethod.config.ts`) duplicates the live inline logic. Decide: delete (cleaner) or adopt (risk of drift). Their `__tests__` still run and pass, masking the fact they're unused.
- **Orphaned `SaleDetailHeader.vue`** — dead; safe to delete but out of this change's scope (leave unless a cleanup WU is explicitly wanted).
- **Three method-config sources** (`salePaymentMethod.utils.ts` labels/colors, `paymentMethodMeta.ts` badge meta, `payments/paymentMethod.config.ts`) have subtly different labels ("Tarjeta crédito" vs "T. Crédito"). Extracting one canonical source would reduce drift but touches many files — scope it carefully.
- **Error-code drift** (`SALE_FULLY_PAID` vs `SALE_ALREADY_PAID`) silently breaks the due-date error mapping: the catch in `useSaleDueDate` won't classify the error, so `lastError` stays null and `DueDateEditModal` shows the generic fallback. Fix is a string swap + test update.
- **`PAYMENT_AMOUNT_INSUFFICIENT` unmapped** — if backend returns it (no-cash array that under-covers total with no cash entry), the FE has no entry in `ChargeDomainErrorCode`/`salePaymentErrors.utils`, so the cashier gets a generic failure instead of "add cash or adjust amounts".
- **`ConfirmedSaleRow` nullability** — listing `status` filter can return DRAFT rows with `folio/paymentStatus/confirmedAt = null`, but the type declares them non-null. `SaleCard`/column cells would render `null` into date formatters. Low risk today (default tab is confirmed), but a latent type-unsoundness.
- **`payments: []` credit path** — relies on backend tolerating an empty array; if backend validation tightens, pure-credit charge breaks. Worth an explicit scenario test.
- **Test mount helper** — `src/test/mountWithUApp.ts` required for Nuxt UI injection contexts; new reference-editing component tests must use it.

---

## 8. Work-unit hint (rough logical sequence — sdd-tasks will finalize)

Suggested order (each a candidate WU):

1. **WU-A: Types + API wiring for reference editing.** Add `SaleDetailPayment.paymentId`; add `UpdatePaymentReferencePayload`; add `saleApi.updatePaymentReference()`; fix `SALE_FULLY_PAID`, remove `REFERENCE_REQUIRED`, add `PAYMENT_AMOUNT_INSUFFICIENT`, remove `SELLER_NOT_ASSIGNABLE`. Small, type-safe, high test coverage (pin tests). *Likely under 400 lines.*
2. **WU-B: Payments list + reference editing UI in detail.** New component (or extend `SaleDetailTotalsCard`) to render per-payment rows with inline reference edit → `PATCH`. *Likely **exceeds 400 lines** (new component + tests + wiring) → consider `size:exception` or split into (B1) read-only payments list + (B2) edit affordance.*
3. **WU-C: Reference optionality.** Drop the hard reference requirement in `PaymentModal.validate()` + `DebtPaymentModal`/`validateEntry`; add "optional" hint. Touches both modals + util + several tests. *Likely under 400 lines.*
4. **WU-D: "Pagos Pendientes" tab.** Add `paymentStatus` quick filter to `useConfirmedSales` + third button in `SalesListTabs` using `counts.pendingPayments`. *Under 400 lines.*
5. **WU-E (optional cleanup):** Delete dead `payments/` subfolder + orphaned `SaleDetailHeader.vue` (+ their tests). *Small, but optional — confirm with user.*

Delivery strategy is `single-pr` with a 400-line budget; **WU-B is the only one likely to breach 400 lines**.

---

## 9. Out-of-scope signals (do NOT include in this change)

- **WebSocket / outbox events** (§10 `sale.confirmed`, `sale.payment.received`, `sale.fully.paid`) — backend bridge not implemented; no FE real-time work.
- **Facturación / CFDI** — column stays empty ("Factura" empty per §6.6).
- **Múltiples cajas / canales** — `channel: 'POS'`, `register: 'Principal'` hardcoded.
- **Acciones de venta (imprimir ticket, PDF beyond receipt)** — `GET /sales/:id/pdf` already exists; the broader Web Serial/printing bridge is out.
- **Crédito limits por cliente**, **refunds/cancelación de pagos** — explicitly "todavía NO implementado" (§0).
- **`sales-payment-coco`** — visual recolor of the payment modals (Coco gold tokens) is a *separate in-flight change*; the payment modals already carry Coco tokens on `main` today, so if that change is re-applied, it must target the **new** reference-editing surface too. Do not fold it into this change.
- **`SaleDetailHeader.vue` / `payments/` dead-code cleanup** — optional hygiene; separate from contract work unless explicitly requested.
