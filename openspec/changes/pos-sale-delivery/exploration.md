# Exploration: pos-sale-delivery

> **Headline reframe (read this first)**: this is **not** a greenfield build and **not** even a large net-new surface. The `frontend-houndfe` POS/sales module (`src/features/POS/sales/`) has **already implemented** nearly every backend prerequisite this change needs:
>
> - the **shipping-address assignment endpoints are already wired** — `saleApi.assignShippingAddress` (PUT) and `saleApi.unassignShippingAddress` (DELETE), plus the full `useDraftCustomerAssignment` composable and a 2-step **customer → shipping-address picker** (`AssignCustomerSlideover.vue`). The `SHIPPING_ADDRESS_REQUIRES_CUSTOMER` error is already parsed and translated.
> - the **sales-list `deliveryStatus` filter is already wired** end-to-end (schema → composable → tabs → badge), including the "No Entregadas" quick tab (`deliveryStatus=PENDING`).
>
> The **real** work is narrow:
> 1. **Charge-time `delivery` flag** — add `delivery?: boolean` to the `ChargeSalePayload` union, thread it through `PaymentModal.buildPayload()`, surface a "Entrega a domicilio" toggle in the charge slideover, gate it on a shipping address being present, and regenerate the idempotency key when the toggle changes.
> 2. **New charge error `SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` (422)** — add it to `ChargeDomainErrorCode` and the friendly-error map (`salePaymentErrors.utils.ts`) with an "asigna dirección" inline action.
> 3. **Optional filter completeness** — the `deliveryStatus` enum/type/constant is missing `SHIPPED` (backend accepts it; user confirmed all 4 values), and the filter UI only lists `PENDING` + `DELIVERED` (missing `SHIPPED` and `NOT_APPLICABLE`).

---

## 1. Feature location & shape

The charge + list surfaces live in a single feature folder — there is **no separate `sales-pos-charge` source directory** (that name is the SDD change id, not a folder).

```
src/features/POS/sales/
  api/sale.api.ts                      # axios methods (one per endpoint)
  composables/useSalesDrafts.ts        # draft CRUD + chargeDraft mutation
  composables/useDraftCustomerAssignment.ts  # customer + shipping-address mutations
  composables/useConfirmedSales.ts     # GET /sales list query + tab/filter merge
  composables/useSalesColumns.ts       # table columns (deliveryStatus = "Productos")
  config/salesFiltersSchema.ts         # slideover filter schema (deliveryStatus present)
  constants/sale.constants.ts          # SALE_DELIVERY_STATUS (PENDING/DELIVERED/NOT_APPLICABLE)
  interfaces/sale.types.ts             # ChargeSalePayload, ChargeDomainErrorCode, Sale…
  utils/salePaymentErrors.utils.ts     # friendly charge-error map (UX actions)
  utils/idempotency.utils.ts           # newIdempotencyKey()
  utils/saleStatus.utils.ts            # deliveryStatus badge map
  components/PaymentModal.vue          # charge step (slideover) — buildPayload()
  components/PaymentSuccessModal.vue   # charge receipt (response unchanged)
  components/AssignCustomerSlideover.vue # customer → shipping-address picker
  components/ActiveSalePanel.vue       # cart panel (already renders shipping-address summary)
  components/SalesListTabs.vue         # "Todas / Pagos Pendientes / No Entregadas" tabs
  views/SalesView.vue                  # checkout orchestrator + handleChargeDraft()
  views/SalesListView.vue              # confirmed-sales list + DataTableFilters
```

Routes (confirmed in `src/app/router/index.ts`): `/pos/ventas` → `SalesListView`, `/pos/ventas/nueva` → `SalesView`, `/pos/ventas/:id` → `SaleDetailView`. All gated `meta.permission: ['read','Sale']`.

---

## 2. Charge flow integration points

| Concern | Where | State |
|---|---|---|
| Charge API | `saleApi.chargeDraft(saleId, payload, idempotencyKey)` → `POST /sales/drafts/:id/charge`, sets `Idempotency-Key` header (`api/sale.api.ts:210-220`) | ✅ exists, unchanged |
| Charge mutation | `useSalesDrafts` → `chargeDraftMutation` (`composables/useSalesDrafts.ts:234`) + public `chargeDraft()` (`:396`). On success removes the charged draft from cache (`removeChargedDraftFromCache`). | ✅ exists |
| Request body builder | `PaymentModal.buildPayload()` — single entry → legacy `{method, amountCents, paymentMethodId?, dueDate?}`; multi → `{payments:[…], dueDate?}`. **No `delivery` today.** | ⚠️ needs `delivery` |
| Payload type | `ChargeSalePayload` discriminated union (`interfaces/sale.types.ts:287`) = `(LegacyChargePayload & {payments?: never}) | (MultiPaymentChargePayload & {method?: never; amountCents?: never})`. **Neither branch has `delivery`.** | ⚠️ needs `delivery?: boolean` on both |
| Idempotency | `newIdempotencyKey()` = `crypto.randomUUID()` (`utils/idempotency.utils.ts`). Regenerated on modal open **and** on every deep `entries` change (`PaymentModal.vue` deep watcher). | ⚠️ must also regen on toggle change |
| Charge view/step | `PaymentModal.vue` (slideover) + `PaymentSuccessModal.vue` (receipt). Orchestrated by `SalesView.handleChargeDraft()` + `openPaymentModal()`. | ✅ exists |
| Draft customer | `AssignCustomerSlideover.vue` → `useDraftCustomerAssignment.assignCustomer` (PUT `/sales/drafts/:id/customer`). | ✅ exists |
| Shipping address | `useDraftCustomerAssignment.setShippingAddress` (PUT) / `clearShippingAddress` (DELETE), surfaced in `AssignCustomerSlideover` step 2 and summarized in `ActiveSalePanel` (`customerAddressSummary`). | ✅ exists |

### Where the "delivery" toggle plugs in

1. **`PaymentModal.vue`** — the charge step. Add a `delivery` toggle (e.g. an `USwitch`/`UCheckbox` "Entrega a domicilio" section) in the slideover body near the due-date section. It needs to know whether a shipping address is assigned to gate/disable itself, so a new prop (`shippingAddress?: CustomerAddress | null` or a boolean `hasShippingAddress`) must be added — today `PaymentModal` only receives `customer`.
2. **`SalesView.vue`** — passes `:customer="activeDraft.customer"` to `PaymentModal`; must also pass `:shipping-address="activeDraft.shippingAddress"` (both are already on `Sale`).
3. **`buildPayload()`** — emit `delivery: true` only when the toggle is on; omit it (or send `false`) otherwise. Backend treats omit/`false` identically. Recommended: spread `delivery: true` into the final returned object in both branches (legacy and multi), or normalize once after the existing return.
4. **Idempotency nuance** — `delivery` participates in the backend idempotency hash. The existing deep watch only reacts to `entries`; a toggle change must also regenerate the key (add the toggle to the regen watch) so an edit of the flag after building payments never replays a stale key with a different payload (would 409 `IDEMPOTENCY_KEY_CONFLICT`).
5. **Shipping-address prerequisite UX** — the "assign address first" path already exists: `PaymentModal` emits `request-assign-customer`, `SalesView.handleRequestAssignCustomerFromPayment()` closes the modal and opens `AssignCustomerSlideover`. The delivery toggle can (a) be disabled when `shippingAddress == null` with a small CTA, and/or (b) rely on the backend `422 SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` surfaced as a friendly inline error. Both are compatible with existing wiring.

---

## 3. Sales-list integration points

| Concern | Where | State |
|---|---|---|
| List API | `saleApi.listConfirmed(params)` → `GET /sales` (`api/sale.api.ts:225`). | ✅ exists |
| List composable | `useConfirmedSales` (`composables/useConfirmedSales.ts`) — `useServerTable` + `resolveActiveFilters` + `setTabFilter`. | ✅ exists |
| Filter schema | `createSalesFiltersSchema` (`config/salesFiltersSchema.ts:35`) already declares `filter.multiEnum({ id:'deliveryStatus', param:'deliveryStatus', options:[PENDING, DELIVERED] })`. | ⚠️ exists, options incomplete |
| Query param type | `ListSalesParams.deliveryStatus?: SaleDeliveryStatus[]` (`sale.types.ts:241`). | ✅ exists |
| CSV serialization | `core/shared/data-table-filters/schema/serializers/multiEnum.ts` `toQuery` joins the array with `,`; `resolveDeliveryStatus`/`resolvePaymentStatus` normalize both `string` (CSV) and `string[]` to an array before axios serializes. | ✅ exists |
| Quick tab | `SalesListTabs.vue` "No Entregadas" → `setTabFilter({ deliveryStatus: SALE_DELIVERY_STATUS.PENDING })`. | ✅ exists |
| Counts/KPI | `useConfirmedSales` stores `response.counts`; `SalesListTabs` renders `counts.all / pendingPayments / notDelivered`. Backend doc §7 (locked): extended filters (incl. `deliveryStatus`) do **not** change `counts`. No FE change needed. | ✅ exists |
| Column/badge | `useSalesColumns` column `deliveryStatus` ("Productos"); `SalesListView` `#deliveryStatus-cell` → `getDeliveryStatusBadge()` (`utils/saleStatus.utils.ts`). | ✅ exists |

### deliveryStatus filter gap

- `SALE_DELIVERY_STATUS` (`constants/sale.constants.ts:68`) holds only `PENDING`, `DELIVERED`, `NOT_APPLICABLE` — **`SHIPPED` is missing**. `SaleDeliveryStatus` (`sale.types.ts:32`) derives from this const, so the whole type is missing `SHIPPED`.
- The slideover filter options list only `PENDING` and `DELIVERED` (`salesFiltersSchema.ts:35-38`); `NOT_APPLICABLE` is in the constant but not offered as a filter option; `SHIPPED` is absent everywhere.
- Badge map (`saleStatus.utils.ts:12-14`) covers only `DELIVERED`/`PENDING` (unknown → `Desconocido` fallback). `SHIPPED`/`NOT_APPLICABLE` would currently render as "Desconocido" if they appear in a row.
- Backend canonical contract (`sales-pos-charge-frontend.md` §6.1) and the user's confirmation state **all 4 values are accepted** (`PENDING, SHIPPED, DELIVERED, NOT_APPLICABLE`). `SHIPPED` is bot/ONLINE-only (not produced by POS), so it is optional for the charge flow but needed if the filter should cover the full enum.

**Conclusion**: the deliveryStatus filter is **already wired**; the only additions are completing the enum (`SHIPPED`), optionally adding `SHIPPED`/`NOT_APPLICABLE` filter options + badge entries. No new filter infrastructure, no new query param plumbing, and no `counts` changes are required.

---

## 4. Error handling (ProblemDetails / friendly errors)

Standard envelope everywhere: `{ statusCode, error (code), message, timestamp }` (Nest domain shape) and, for listing validation, `{ statusCode, code, message, field, details }` (`LISTING_*`).

Existing friendly-error patterns to **reuse**:

- **Charge errors** — `SalesView.handleChargeDraft()` dispatches in order: (1) `applyCatalogChargeErrorAction` (custom payment-method codes), (2) `getSalePaymentErrorAction(code)` from `utils/salePaymentErrors.utils.ts` (UX-action map `inline | retry | refetch | new-key`), (3) generic toast fallback reading `err.response.data.message`.
- **Customer/address assignment errors** — `DraftCustomerAssignmentError` + `parseAssignmentError` (`useDraftCustomerAssignment.ts`); Spanish copy in `SalesView.mapCustomerAssignmentErrorMessage()` and `AssignCustomerSlideover.resolveErrorMessage()`. `SHIPPING_ADDRESS_REQUIRES_CUSTOMER` is **already** handled.
- **Shared normalizers** — `core/shared/utils/error.utils.ts` (`normalizeApiError`, `mapDomainError`, `DEFAULT_FALLBACK`); listing filter errors via `mapListingErrorToFilterField` (`core/shared/data-table-filters/errorMapping.ts`).

**Gaps to close for this change:**

- `SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` is **not** in `ChargeDomainErrorCode` (`sale.types.ts:354`) nor in `ERROR_ACTIONS` (`salePaymentErrors.utils.ts`). Add it as an `inline` action with copy like "Para entrega a domicilio asigna una dirección de envío." (and a path to open the address picker).
- `IDEMPOTENCY_KEY_CONFLICT` is **already** mapped (`new-key` action) — no work beyond ensuring the toggle regenerates the key (prevents the conflict in the first place).
- `SHIPPING_ADDRESS_REQUIRES_CUSTOMER` is already covered; no new assignment-error work.

> **Note on "delivery-routes feature"**: there is **no `delivery-routes` feature in this frontend repo** (grep across `src/` returns zero matches for `deliveryRoute` / `DeliveryRoute` / `delivery-routes`). The friendly-error pattern the prompt refers to is the **sales-feature pattern** documented above (`salePaymentErrors.utils.ts` + `paymentMethodChargeErrors.utils.ts` + `DraftCustomerAssignmentError`) plus the shared `error.utils.ts`. Reuse those rather than looking for a separate delivery-routes module.

---

## 5. Permissions (CASL)

- `Sale` is **already registered** as a subject: `APP_SUBJECTS` in `src/features/auth/authorization/ability.ts` and the `AppSubject` union in `src/features/auth/interfaces/auth.types.ts`.
- `update:Sale` (charge + shipping-address PUT/DELETE) and `read:Sale` (list) already parse into the CASL ability. **No new subject registration is required** — this is an existing subject, exactly as flagged.
- Route gating is unchanged (`read:Sale` on all three sales routes). Charge/address actions are backend-enforced via `update:Sale`; the FE relies on the existing `authStore.userCan(...)` where needed (e.g. `SalesListView` gates `read:Sale` and `create:Sale` for the "Nueva Venta" button) and backend 403s otherwise.

---

## 6. Existing customer/address selection

Yes — fully present and reusable:

- `AssignCustomerSlideover.vue`: 2-step flow. Step 1 lists/searches customers (`customerApi.getPaginated`) and can create a customer. Step 2 lists the selected customer's `addresses[]`, allows picking one (`setShippingAddress({shippingAddressId})`), picking "Sin dirección de envío" (`null`), or creating a new address (`AddressModal` → `customerApi.createAddress` → auto-select).
- `useDraftCustomerAssignment`: `assignCustomer`, `unassignCustomer`, `setShippingAddress`, `clearShippingAddress` with cache reconciliation (`replaceSaleInCache`) and applicable-promotions invalidation.
- `ActiveSalePanel.vue` already renders the assigned address summary (`customerAddressSummary`), so the cashier sees the prerequisite state without new UI.

**Implication**: no new customer/address picker is needed. The only wiring for the delivery flow is (a) surfacing the address-presence signal into `PaymentModal` and (b) optionally auto-opening the address step when the cashier enables delivery without an address.

---

## 7. Gap matrix (contract → FE)

| # | Capability (backend doc) | FE state | Action |
|---|---|---|---|
| 1 | `delivery?: boolean` on `POST /sales/drafts/:id/charge` | ⚠️ absent | Add `delivery?: boolean` to both `ChargeSalePayload` branches; emit in `PaymentModal.buildPayload()` |
| 2 | Delivery toggle UX in charge step | ❌ absent | Add toggle to `PaymentModal.vue`; pass `shippingAddress` prop from `SalesView` |
| 3 | `SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` (422) | ❌ unmapped | Add to `ChargeDomainErrorCode` + `ERROR_ACTIONS` (inline action) |
| 4 | `IDEMPOTENCY_KEY_CONFLICT` (409) | ✅ mapped (`new-key`) | Ensure toggle change regenerates idempotency key |
| 5 | Prereq `PUT/DELETE /sales/drafts/:id/shipping-address` | ✅ wired | none (reuse) |
| 6 | `SHIPPING_ADDRESS_REQUIRES_CUSTOMER` (422) | ✅ parsed + copy | none |
| 7 | `GET /sales?deliveryStatus=` CSV filter | ✅ wired (PENDING/DELIVERED) | optionally add `SHIPPED`+`NOT_APPLICABLE` options; add `SHIPPED` to enum/type |
| 8 | `counts` KPI unaffected by extended filters | ✅ consumed as-is | none |
| 9 | Charge response unchanged | ✅ `ChargeSaleResponse` unchanged | none |
| 10 | Sale results carry `deliveryStatus: 'PENDING'` | ✅ `ConfirmedSaleRow.deliveryStatus` typed/badged | none |

---

## 8. Type audit (deltas only)

| Type / const | State | Action |
|---|---|---|
| `ChargeSalePayload` (`sale.types.ts:287`) | ⚠️ | add `delivery?: boolean` to `LegacyChargePayload` and `MultiPaymentChargePayload` (or at the union level via intersection) |
| `ChargeDomainErrorCode` (`sale.types.ts:354`) | ⚠️ | add `'SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY'` |
| `SALE_DELIVERY_STATUS` (`sale.constants.ts:68`) | ⚠️ | add `SHIPPED: 'SHIPPED'` (pin test at `sale.constants.spec.ts:50-54` will need the new value) |
| `SaleDeliveryStatus` (derived) | ⚠️ | follows the const automatically once `SHIPPED` is added |
| `deliveryStatusBadgeMap` (`saleStatus.utils.ts`) | ⚠️ | optionally add `SHIPPED` (e.g. "En ruta") and `NOT_APPLICABLE` (e.g. "No aplica") labels |
| `ChargeSaleResponse` | ✅ | unchanged (backend response identical) |

No Zod schemas in this module (plain string unions + `as const` per `sdd/magic-string-constants` convention).

---

## 9. Open questions (for propose/design)

1. **Toggle payload shape** — send `delivery: true` only when on and omit otherwise (recommended), or always send `delivery: boolean`? Backend treats omit/`false` identically; omit keeps legacy charges byte-identical.
2. **Toggle gating** — disable the toggle when `shippingAddress == null` (with an inline "asigna dirección" CTA), or allow enabling and surface the 422? Recommend disable-with-CTA for a cleaner UX, backed by the 422 as a safety net.
3. **Idempotency regen** — confirm the toggle must join the existing key-regen watch (backend includes `delivery` in the hash). This is a correctness requirement, not a preference.
4. **Filter completeness** — is completing the `deliveryStatus` enum with `SHIPPED`/`NOT_APPLICABLE` in scope for this change, or keep the existing PENDING/DELIVERED filter (the POS never emits `SHIPPED`)? User confirmed all 4 values are backend-valid; decide whether to expose them.
5. **Where the toggle lives** — inside `PaymentModal` (recommended, single surface) vs. a separate control on `ActiveSalePanel`. Recommend `PaymentModal` to keep the charge contract in one place.

---

## 10. Risks / gotchas

- **Idempotency hash coupling** — forgetting to regenerate the key on toggle change produces `409 IDEMPOTENCY_KEY_CONFLICT` on legit edits. Add the toggle to the regen watch and a pin test.
- **`SHIPPED` missing from the type** — if the list receives a `SHIPPED` row (e.g. an ONLINE-channel sale from the same tenant), `getDeliveryStatusBadge` falls through to "Desconocido" today. Low frequency, but a latent completeness gap.
- **Charge response has no `deliveryStatus`** — do not try to read `deliveryStatus` from `ChargeSaleResponse`; it is queried via `GET /sales` / `GET /sales/:id`. The success modal should stay unchanged.
- **Address-clears-on-customer-change** (backend §2.5.1) — when the cashier changes the customer, the prior shipping address is silently cleared. The delivery toggle must re-evaluate the `shippingAddress` presence after any customer assignment (the prop is reactive from `activeDraft.shippingAddress`, so this falls out naturally if bound to the draft).
- **No `delivery-routes` FE module** — any cross-reference to "delivery routes" for eligibility is backend-side; this change only marks the sale `PENDING` and filters the list. No route/stop UI exists in this repo (out of scope).
- **Test mount helper** — `src/test/mountWithUApp.ts` is required for Nuxt UI components (USwitch/USlideover). New `PaymentModal` toggle tests must use it.

---

## 11. Work-unit hint (rough logical sequence — sdd-tasks will finalize)

1. **WU-A: Types + error map.** Add `delivery?: boolean` to `ChargeSalePayload`; add `SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` to `ChargeDomainErrorCode` + `ERROR_ACTIONS` (inline action); add `SHIPPED` to `SALE_DELIVERY_STATUS` (+ pin test). Pure type/constant, high pin-test coverage. *Small.*
2. **WU-B: PaymentModal delivery toggle + idempotency regen.** Add `shippingAddress` prop, the toggle UI, `buildPayload()` `delivery` emission, and the key-regen watch inclusion. Add `SalesView` prop pass-through. *Under 400 lines.*
3. **WU-C: (optional) filter enum completion.** Add `SHIPPED`/`NOT_APPLICABLE` filter options + badge labels. *Small, confirm scope first.*

---

## 12. Out-of-scope signals (do NOT include)

- **Delivery route assignment / stops / check-in** — no FE module exists; marking a sale `PENDING` and listing/filtering it is the entire FE surface of this change.
- **WhatsApp/ONLINE `SHIPPED` lifecycle** — bot-only; not produced by POS.
- **Charge response / success modal changes** — response shape is unchanged; `PaymentSuccessModal` stays as-is.
- **WebSocket / outbox events** — no real-time work.
- **`counts`/KPI logic** — backend-owned; extended filters intentionally do not change counts.
