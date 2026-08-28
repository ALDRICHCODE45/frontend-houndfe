# Proposal: pos-sale-delivery — Venta "para entrega a domicilio" al cobrar + enum de entrega completo

> Phase: propose (SDD)
> Input: `openspec/changes/pos-sale-delivery/exploration.md` (+ Engram `sdd/pos-sale-delivery/explore`)
> Backend source of truth: `houndfe-backend/docs/backend-requests/pos-sale-delivery-frontend.md`, `houndfe-backend/docs/sales-pos-charge-frontend.md` (§3.2/§9), `houndfe-backend/docs/backend-requests/sales-list-multiselect-filters-and-ranges-response.md` (§6/§7)
> Product decisions: **locked by user — not reopened** (see "Locked product decisions").

---

## 1. Why

Today every POS charge is born with `deliveryStatus: 'DELIVERED'` and can never be added to a delivery route. Cashiers who take a sale "para entrega a domicilio" have no way to express that at charge time — the sale is indistinguishable from a counter sale, and the delivery module never sees it as eligible.

The backend contract is ready: `POST /sales/drafts/:id/charge` accepts an optional `delivery?: boolean`; `delivery: true` confirms the sale with `deliveryStatus: 'PENDING'` (route-eligible). The frontend already wires every prerequisite (customer + shipping-address assignment, the `deliveryStatus` list filter, the "No Entregadas" tab) — the missing pieces are (a) the charge-time `delivery` flag + toggle, (b) the friendly mapping of the new `422 SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` error, and (c) completing the `deliveryStatus` enum (missing `SHIPPED`) and filter/badge coverage so the full backend enum round-trips cleanly.

Without this change the "No Entregadas" tab can only ever show rows from other channels, POS delivery sales are silently mislabeled as delivered, and cashiers have no delivery option at the till.

## 2. What Changes

User-visible:

1. In the charge step (`PaymentModal` slideover), a **"Entrega a domicilio" toggle**. When the draft has a shipping address assigned, the cashier can enable it → the charge sends `delivery: true` → the confirmed sale is born `PENDING` (route-eligible). When no address is assigned, the toggle is **disabled with a hint** ("asigná cliente y dirección primero") and a CTA that reuses the existing assign-customer/address slideover — the `422` is avoided by design.
2. If the toggle is somehow on without an address (stale draft, race), the backend `422 SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` surfaces as a **friendly inline error** instead of a raw toast.
3. The sales-list "Entrega" filter now offers **all 4 backend values** (Pendiente / En ruta / Entregada / No aplica), and the list badge renders all 4 statuses instead of falling back to "Desconocido".

Internal:

4. `delivery?: boolean` added to both `ChargeSalePayload` branches (`LegacyChargePayload`, `MultiPaymentChargePayload`) and emitted from `PaymentModal.buildPayload()` (only `delivery: true` when the toggle is on; omitted otherwise → legacy charges stay byte-identical).
5. `PaymentModal` gains a `shippingAddress` prop (currently only `customer` is passed); `SalesView` passes `activeDraft.shippingAddress` through.
6. The **idempotency key regenerates when the toggle changes** (the flag is part of the backend idempotency hash; a stale key would 409 `IDEMPOTENCY_KEY_CONFLICT` on a legit edit). The toggle joins the existing deep `entries` regen watch.
7. `SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` added to `ChargeDomainErrorCode` + `ERROR_ACTIONS` (`inline` action). `SALE_DELIVERY_STATUS` gains `SHIPPED`; `deliveryStatusBadgeMap` and the filter schema options gain `SHIPPED`/`NOT_APPLICABLE`.

Not changing: the charge **response** (no `deliveryStatus` — the sale is re-queried), `PaymentSuccessModal`, `counts`/KPI logic, CASL subjects, routes, or the customer/address picker.

## 3. Out of Scope

- **Delivery routes / stops / check-in** — no FE module exists in this repo; marking a sale `PENDING` and filtering it is the entire FE surface. Route assignment is backend/delivery-module work.
- **`SHIPPED` lifecycle (WhatsApp/ONLINE bot flow)** — the status is only *displayed/filtered* here; POS never produces it.
- **Charge response / `PaymentSuccessModal` changes** — response shape identical; `deliveryStatus` is read from `GET /sales` / `GET /sales/:id`.
- **WebSocket / outbox / real-time events.**
- **`counts`/KPI changes** — backend §7 locked: extended filters (incl. `deliveryStatus`) intentionally do not alter counts.
- **New customer/address picker, new route, new CASL subject.**
- **Delivery-routes feature module** — there is none in `frontend-houndfe`; the friendly-error pattern lives in the sales feature (`salePaymentErrors.utils.ts` + shared `error.utils.ts`).

## 4. Locked product decisions (user-confirmed — do not reopen)

| # | Decision |
|---|---|
| D1 | **Enum/filter completeness**: complete all 4 `deliveryStatus` values everywhere — type/constant, filter UI options, badge map: `PENDING`, `SHIPPED`, `DELIVERED`, `NOT_APPLICABLE`. |
| D2 | **Toggle gating**: when the draft has NO shipping address, the toggle is DISABLED with hint "asigná cliente y dirección primero" (avoids the 422 by design; backend §7 recommendation). |
| D3 | **Charge response & success modal UNCHANGED** — response carries no `deliveryStatus`; sale must be re-queried. No change to `PaymentSuccessModal.vue` or `counts`. |
| D4 | **No new CASL subject, no new route, no new customer/address picker** — reuse `AssignCustomerSlideover` + `useDraftCustomerAssignment`. |

## 5. Capabilities (New / Modified — to be specified under `openspec/changes/pos-sale-delivery/specs/`)

- **CAP-DLV-1 — Charge with delivery flag (Modified).** Cashier marks a sale "para entrega a domicilio" at charge time; payload carries `delivery: true`; sale confirms as `PENDING`; toggle gated on shipping-address presence; idempotency key regenerated on toggle change.
- **CAP-DLV-2 — Delivery charge error handling (Modified).** `SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` (422) mapped to a friendly inline action; toggle state protects the flow so the error is only a safety net.
- **CAP-DLV-3 — Delivery status enum/filter/badge completeness (Modified).** All 4 `deliveryStatus` values in `SALE_DELIVERY_STATUS`, the filter schema options, and the badge map; `SaleDeliveryStatus` type follows the constant automatically.

## 6. Approach

### 6.1 Charge-time `delivery` flag

- **Types** (`interfaces/sale.types.ts`): add `delivery?: boolean` to `LegacyChargePayload` (≈line 258) and `MultiPaymentChargePayload` (≈line 281). `ChargeSalePayload` union unchanged in shape otherwise.
- **`PaymentModal.vue`**:
  - New prop: `shippingAddress?: CustomerAddress | null` (draft already carries it — `Sale.shippingAddress`, `sale.types.ts:469`). A `computed hasShippingAddress` drives gating.
  - New local state `delivery = ref(false)`; reset to `false` on modal open (alongside the existing reset block, `PaymentModal.vue:194-205`).
  - Toggle UI ("Entrega a domicilio", `USwitch`/`UCheckbox` per design) near the due-date section; disabled + hint "asigná cliente y dirección primero" when `shippingAddress == null`, with a CTA reusing the existing `request-assign-customer` emit (which opens `AssignCustomerSlideover` — already the address step).
  - `buildPayload()` (line 271): spread `delivery: true` into the returned object **only when the toggle is on**, in both the legacy branch and the `payments[]` branch. Omit otherwise (backend treats omit/`false` identically; omission keeps legacy charges byte-identical).
  - Idempotency: add `delivery` to the key-regen watch source (alongside the existing deep `entries` watch at line 326) — `watch([entries, delivery], …)`. On open, `newIdempotencyKey()` already runs.
- **`SalesView.vue`** (PaymentModal instantiation, line 885): add `:shipping-address="activeDraft.shippingAddress ?? null"` beside `:customer="activeDraft.customer ?? null"`.
- **Reactivity for the address-cleared-on-customer-change rule** (backend §2.5.1): binding the prop to `activeDraft.shippingAddress` makes the toggle re-evaluate automatically when the address is cleared — no extra wiring.

### 6.2 Error mapping

- `ChargeDomainErrorCode` (`sale.types.ts:354`): add `'SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY'`.
- `ERROR_ACTIONS` (`utils/salePaymentErrors.utils.ts`, `Record<ChargeDomainErrorCode, SalePaymentUxAction>`): TS exhaustiveness forces the entry. Use `type: 'inline'` with copy like "Para entrega a domicilio asigna una dirección de envío." `SalesView.handleChargeDraft` already dispatches through `getSalePaymentErrorAction` before the generic toast — no dispatch change needed.

### 6.3 Enum / filter / badge completeness

- `SALE_DELIVERY_STATUS` (`constants/sale.constants.ts:68`): add `SHIPPED: 'SHIPPED'`. `SaleDeliveryStatus` derives automatically. Pin test (`sale.constants.spec.ts`) updated.
- `createSalesFiltersSchema` (`config/salesFiltersSchema.ts:35-39`): extend `deliveryStatus` `multiEnum` options with `SHIPPED` ("En ruta") and `NOT_APPLICABLE` ("No aplica").
- `deliveryStatusBadgeMap` (`utils/saleStatus.utils.ts:12-14`): add `SHIPPED` (e.g. "En ruta", warning) and `NOT_APPLICABLE` (e.g. "No aplica", neutral). No filter infra, serialization, or `counts` change (CSV multi-enum plumbing already works).

## 7. Impact

| Area | File(s) | Kind |
|---|---|---|
| Charge payload types | `src/features/POS/sales/interfaces/sale.types.ts` | MOD |
| Delivery status constant | `src/features/POS/sales/constants/sale.constants.ts` | MOD |
| Charge step UI + payload build + idempotency | `src/features/POS/sales/components/PaymentModal.vue` | MOD |
| Checkout orchestration (prop pass-through) | `src/features/POS/sales/views/SalesView.vue` | MOD |
| Friendly charge errors | `src/features/POS/sales/utils/salePaymentErrors.utils.ts` | MOD |
| Badge map | `src/features/POS/sales/utils/saleStatus.utils.ts` | MOD |
| List filter options | `src/features/POS/sales/config/salesFiltersSchema.ts` | MOD |
| Tests | co-located `*.spec.ts` (PaymentModal, sale.constants, saleStatus.utils, salePaymentErrors.utils; `mountWithUApp` for PaymentModal) | MOD/NEW |

**Reuse (no reinvention):** `AssignCustomerSlideover.vue` (customer → shipping-address picker), `useDraftCustomerAssignment` (`setShippingAddress`/`clearShippingAddress`), `newIdempotencyKey()`, `getSalePaymentErrorAction` dispatch chain in `SalesView.handleChargeDraft`, `ActiveSalePanel` address summary, existing `deliveryStatus` filter plumbing + "No Entregadas" tab.

**Untouched:** `api/sale.api.ts`, `useSalesDrafts.ts` charge mutation, `PaymentSuccessModal.vue`, `useConfirmedSales.ts`, `SalesListTabs.vue`, CASL `ability.ts`/`auth.types.ts`, router, `counts`.

## 8. Risks / Unknowns

| Risk | Mitigation |
|---|---|
| **Idempotency hash coupling** — forgetting the toggle in the key-regen watch → `409 IDEMPOTENCY_KEY_CONFLICT` on legit toggle edits | Toggle joins the regen watch; pin test asserts key changes when `delivery` flips. `IDEMPOTENCY_KEY_CONFLICT` already maps to `new-key` as a backstop. |
| `SHIPPED` missing → badge renders "Desconocido" for ONLINE/bot rows | Enum completion (D1) closes this for good; badge map covers all 4 values. |
| `ChargeSaleResponse` has no `deliveryStatus` → temptation to read it | Explicit non-goal; success modal unchanged; status is re-queried via list/detail. |
| Address silently cleared on customer change (backend §2.5.1) | Toggle bound to reactive `activeDraft.shippingAddress`; gating recomputes automatically. |
| Toggle enabled without address (race/stale) → 422 | Gating prevents in normal flow; 422 mapped as friendly `inline` error (safety net). |
| Nuxt UI components in tests | `src/test/mountWithUApp.ts` (config `testing.helpers`) for any PaymentModal toggle test. |

Unknowns are implementation-level only; product decisions are locked. See §10 for the residuals design will settle.

## 9. First Slice Scope

Following the exploration's work-unit hint (and the 400-line/600-line slice budget):

1. **Slice 1 — Types + error map + enum** (pure, high pin-test density): `delivery?: boolean` on both payload branches; `SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` in `ChargeDomainErrorCode` + `ERROR_ACTIONS`; `SHIPPED` in `SALE_DELIVERY_STATUS`; updated pin tests. No UI.
2. **Slice 2 — PaymentModal delivery toggle + idempotency regen + SalesView pass-through** (the UX core, < 400 changed lines): prop, toggle UI + gating, `buildPayload()` emission, regen watch, CTA reusing `request-assign-customer`.
3. **Slice 3 — Filter/badge completeness** (small): schema options + badge map + type fallout.

Order is dependency-respecting (types before consumers). Each slice ends green on `pnpm test:unit --run`; type-check via `pnpm build` (vue-tsc) at slice completion.

## 10. Proposal question round (assumptions needing user review)

Product decisions are locked (D1–D4) and were not reopened. The following are implementation assumptions the design phase will finalize; flag any you disagree with:

1. **Payload shape** — send `delivery: true` only when the toggle is on, omit otherwise (keeps legacy charges byte-identical; backend treats omit/`false` identically). Not sending `delivery: false`.
2. **Toggle gating UX** — disabled toggle + inline hint + CTA that reuses the existing `request-assign-customer` emit (opens the existing customer/address slideover). No auto-open side effects on toggle.
3. **Toggle placement** — inside `PaymentModal` (single charge-contract surface), not on `ActiveSalePanel`.
4. **Idempotency** — the toggle joins the existing key-regen watch (correctness requirement, not preference).
5. **Badge copy/colors** — `SHIPPED` → "En ruta" (warning), `NOT_APPLICABLE` → "No aplica" (neutral); adjust copy as preferred. Design will confirm the exact widget (`USwitch` vs `UCheckbox`) and labels.

## 11. Rollback Plan

- **Frontend-only rollback**: revert the `PaymentModal` toggle and `buildPayload()` emission → all charges omit `delivery` → identical to pre-change behavior (backend treats omission as `false`). No data migration, no schema change, no backend dependency.
- **Partial rollback**: keep the error mapping + enum/filter completion (harmless additive) while removing only the toggle.
- **Backend contract safety**: the flag is optional and backward compatible; an old frontend never sends it, a new frontend never breaks old behavior.
- **No feature flag needed** given the small surface; if a staged rollout is preferred, gating the toggle on a flag is trivial (slice 2).

## 12. Success Criteria

1. A charge with the toggle on sends `delivery: true` (legacy and multi-payment branches) and the confirmed sale lists with `deliveryStatus: 'PENDING'` (verifiable via `GET /sales`).
2. The toggle is disabled with the hint when no shipping address is assigned; enabling requires an address (CTA reuses existing slideover).
3. `422 SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` renders as the friendly inline message, never a raw error toast.
4. Toggling `delivery` regenerates the idempotency key (pin test); no `IDEMPOTENCY_KEY_CONFLICT` from legit edits.
5. `SALE_DELIVERY_STATUS`/`SaleDeliveryStatus`/filter options/badge map all cover `PENDING | SHIPPED | DELIVERED | NOT_APPLICABLE`; no "Desconocido" fallback for valid statuses.
6. `PaymentSuccessModal`, charge response handling, and `counts` are byte-for-byte unchanged.
7. `pnpm test:unit --run` green (including updated pin tests and new PaymentModal tests via `mountWithUApp`); `vue-tsc` clean; `pnpm lint` clean.
