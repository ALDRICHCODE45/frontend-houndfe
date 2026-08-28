# Delta for Sales

This delta adds the charge-time "Entrega a domicilio" flow so a cashier at the POS can mark a sale as "para entrega a domicilio" the moment they press **Cobrar**. The change completes the backend `deliveryStatus` enum coverage in the frontend so the full set `PENDING | SHIPPED | DELIVERED | NOT_APPLICABLE` round-trips through the type, the filter UI, and the badge map without falling back to a generic "Desconocido".

The change has three capabilities, all **ADDED** (no canonical requirement block in `openspec/specs/sales/spec.md` is being replaced):

- **CAP-DLV-1 — Charge with delivery flag.** The cashier toggles "Entrega a domicilio" in the charge step; the payload carries `delivery: true`; the confirmed sale is born `PENDING`. The toggle is gated on a shipping address being assigned; the idempotency key regenerates when the toggle changes.
- **CAP-DLV-2 — Delivery charge error handling.** The backend `422 SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` is mapped to a friendly inline action so it never surfaces as a raw error toast. The toggle gating makes this a safety-net path, not the primary flow.
- **CAP-DLV-3 — Delivery status enum/filter/badge completeness.** All four `deliveryStatus` values appear in `SALE_DELIVERY_STATUS`, the filter schema options, and the badge map; the `SaleDeliveryStatus` type follows the constant.

Product decisions locked by the user (D1–D4 in the proposal) are encoded directly into the requirements below.

## ADDED Requirements

### Requirement: Charge Payload Carries Optional `delivery` on Both Branches

The charge request payload types (`LegacyChargePayload` and `MultiPaymentChargePayload`, the two branches of `ChargeSalePayload`) MUST accept an OPTIONAL field `delivery?: boolean`. When the field is omitted OR explicitly `false`, the charge MUST behave exactly as it does today (legacy charges stay byte-identical to pre-change behavior). When the field is `true`, the confirmed sale MUST be born with `deliveryStatus: 'PENDING'` (route-eligible). The `ChargeSalePayload` union shape itself MUST NOT change beyond this addition.

#### Scenario: legacy branch accepts `delivery: true`

- GIVEN a charge with the legacy single-payment shape (`{ method, amountCents, … }`)
- WHEN the cashier submits the charge with `delivery: true`
- THEN the request body sent to `POST /sales/drafts/:id/charge` includes the literal `delivery: true`
- AND the legacy payload shape otherwise matches its existing contract

#### Scenario: multi-payment branch accepts `delivery: true`

- GIVEN a charge with the multi-payment shape (`{ payments: […] }`)
- WHEN the cashier submits the charge with `delivery: true`
- THEN the request body includes `delivery: true` alongside the `payments` array
- AND no payment entry shape changes

#### Scenario: payload omits `delivery` when toggle is off

- GIVEN the "Entrega a domicilio" toggle is OFF
- WHEN the cashier submits a charge
- THEN the request body MUST NOT carry a `delivery` key (omission only — never an explicit `false`)
- AND legacy charges stay byte-identical to pre-change behavior

#### Scenario: confirmed sale shows `PENDING` after toggle-on charge

- GIVEN the charge was submitted with `delivery: true` against a draft that has a shipping address
- WHEN the cashier retrieves the confirmed sale from `GET /sales/:id` or `GET /sales`
- THEN `deliveryStatus === 'PENDING'`

### Requirement: PaymentModal Toggle Emits `delivery` Only When On

The charge step (`PaymentModal`) MUST expose an "Entrega a domicilio" toggle. When the toggle is ON, the built payload MUST spread `delivery: true` into BOTH the legacy branch and the multi-payment branch of the payload returned by `buildPayload()`. When the toggle is OFF, the payload MUST NOT contain a `delivery` key. The toggle MUST reset to OFF every time the modal opens (alongside the existing per-open reset behavior).

#### Scenario: toggle ON emits `delivery: true` on the legacy branch

- GIVEN the toggle is ON and the cashier uses the legacy single-payment shape
- WHEN `buildPayload()` returns the legacy payload
- THEN the returned object includes `delivery: true`
- AND no other field of the legacy payload changes

#### Scenario: toggle ON emits `delivery: true` on the multi-payment branch

- GIVEN the toggle is ON and the cashier uses the multi-payment shape
- WHEN `buildPayload()` returns the multi-payment payload
- THEN the returned object includes `delivery: true` alongside `payments`
- AND no payment entry shape changes

#### Scenario: toggle OFF omits `delivery`

- GIVEN the toggle is OFF
- WHEN `buildPayload()` returns either branch
- THEN the returned object MUST NOT carry a `delivery` key

#### Scenario: modal open resets the toggle to OFF

- GIVEN the toggle was ON at modal close
- WHEN the cashier opens `PaymentModal` again
- THEN the toggle MUST be OFF
- AND the built payload MUST NOT carry a `delivery` key on first render

### Requirement: Toggle Gated on Shipping-Address Presence

The "Entrega a domicilio" toggle MUST be DISABLED whenever the draft has no shipping address assigned (`shippingAddress == null`). When disabled, an inline hint MUST be visible with the copy "asigná cliente y dirección primero" so the cashier understands the constraint and is not left wondering why the toggle will not move. The toggle MUST be enabled (interactive) whenever `shippingAddress != null`. The disabled/enabled state MUST recompute reactively so that clearing the shipping address (e.g. when the customer is reassigned, since backend rules clear the address on customer change) immediately disables the toggle again without a manual refresh.

#### Scenario: no address disables the toggle and shows the hint

- GIVEN `shippingAddress == null`
- WHEN the charge step renders
- THEN the toggle MUST render in a disabled state
- AND an inline hint with the literal text "asigná cliente y dirección primero" MUST be visible

#### Scenario: address present enables the toggle without a hint

- GIVEN `shippingAddress != null`
- WHEN the charge step renders
- THEN the toggle MUST be enabled (interactive)
- AND no gating hint MUST be visible

#### Scenario: clearing the address reactively disables the toggle

- GIVEN the toggle is ON with an assigned address
- WHEN the address is cleared (e.g. customer reassignment triggers backend address clear)
- THEN the toggle MUST immediately become disabled again on the next render
- AND the gating hint MUST be visible again
- AND the built payload MUST NOT carry `delivery: true` while the gate is closed

#### Scenario: gating alone prevents the 422 in normal flow

- GIVEN a draft with no shipping address
- WHEN the cashier submits the charge (with the toggle disabled)
- THEN the request body MUST NOT carry `delivery: true`
- AND the backend `422 SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` MUST NOT be triggered by this flow

### Requirement: Toggle CTA Reuses Existing Customer/Address Assignment

When the toggle is disabled because the draft has no shipping address, the charge step MUST surface an affordance (CTA) that reuses the existing customer/address assignment flow already triggered by `request-assign-customer` (the same emit the modal already uses for the same purpose from its other surfaces). Activating the CTA MUST open the existing `AssignCustomerSlideover` — no new slideover, no new route, no new picker MUST be introduced.

#### Scenario: disabled toggle exposes a CTA to assign customer/address

- GIVEN `shippingAddress == null`
- WHEN the charge step renders
- THEN a CTA MUST be visible alongside (or directly reachable from) the disabled toggle
- AND activating it MUST emit `request-assign-customer` (the existing signal)

#### Scenario: CTA opens the existing AssignCustomerSlideover

- GIVEN the cashier activates the CTA
- WHEN `SalesView` receives the `request-assign-customer` emit
- THEN the existing `AssignCustomerSlideover` MUST open
- AND no new slideover, route, or picker is rendered

#### Scenario: customer/address assignment enables the toggle

- GIVEN the cashier assigns a customer and a shipping address from the opened slideover
- WHEN the address propagates back to the charge step (via the `shippingAddress` prop)
- THEN the toggle MUST become enabled automatically on the next render
- AND the gating hint MUST disappear

### Requirement: Idempotency Key Regenerates When Delivery Toggle Changes

The idempotency key used on the charge request MUST be regenerated whenever the "Entrega a domicilio" toggle changes (ON → OFF or OFF → ON), in addition to the existing regen behavior driven by the payment entries. The toggle MUST be a source in the same key-regen effect that already watches the entries. A pin test MUST assert the key changes when the toggle flips while entries are otherwise unchanged. Without this regen, a legitimate toggle edit would reuse an `Idempotency-Key` whose backend hash captured the prior `delivery` value and would respond with `409 IDEMPOTENCY_KEY_CONFLICT`.

#### Scenario: toggling delivery regenerates the idempotency key

- GIVEN the charge modal is open with a stable `entries` value
- WHEN the cashier flips the "Entrega a domicilio" toggle
- THEN the displayed `Idempotency-Key` MUST change
- AND the new key MUST be sent on the next charge request

#### Scenario: stable entries + no toggle change keep the key stable

- GIVEN `entries` is unchanged
- WHEN the toggle is NOT flipped
- THEN the idempotency key MUST NOT regenerate

#### Scenario: toggle flip never produces IDEMPOTENCY_KEY_CONFLICT for legitimate edits

- GIVEN the cashier flips the toggle
- WHEN the cashier submits the charge with the newly-generated key
- THEN the backend MUST NOT respond with `409 IDEMPOTENCY_KEY_CONFLICT`
- AND the `IDEMPOTENCY_KEY_CONFLICT` mapping (`new-key` action) remains a backstop only

### Requirement: SalesView Passes Shipping Address Reactively to PaymentModal

`SalesView` MUST pass the active draft's `shippingAddress` through to `PaymentModal` (alongside the existing `:customer` binding). The address passed MUST be reactive to `activeDraft.shippingAddress` so that backend-driven clears (the customer-change rule) propagate without manual wiring in the modal. The binding MUST use `activeDraft.shippingAddress ?? null` semantics (null when absent).

#### Scenario: PaymentModal receives the active draft's shipping address

- GIVEN `activeDraft.shippingAddress` is a `CustomerAddress`
- WHEN `SalesView` renders `PaymentModal`
- THEN `PaymentModal` MUST receive the address via its `shippingAddress` prop

#### Scenario: missing address propagates as null

- GIVEN `activeDraft.shippingAddress == null`
- WHEN `SalesView` renders `PaymentModal`
- THEN `PaymentModal`'s `shippingAddress` prop MUST be `null`

#### Scenario: address clear on customer change propagates to the modal

- GIVEN the cashier reassigns the customer and the backend clears `shippingAddress`
- WHEN the active draft updates reactively
- THEN `PaymentModal`'s `shippingAddress` prop MUST become `null` without a manual refresh
- AND the toggle gating MUST recompute to disabled (per the gating requirement)

### Requirement: Charge Response, Success Modal, and Counts Are Unchanged

The change MUST NOT alter the charge response contract, the success modal behavior, or the `counts` payload from `GET /sales`. The charge response still carries no `deliveryStatus` — the value is read from `GET /sales` / `GET /sales/:id` after the charge. `PaymentSuccessModal` MUST render exactly as it does today for a charge with `delivery: true` (no new fields, no new copy, no new totals). The KPI `counts` (`all`, `pendingPayments`, `notDelivered`) MUST NOT change because of this change — extended filters (including `deliveryStatus`) intentionally do not alter counts per the locked backend contract.

#### Scenario: charge response carries no `deliveryStatus`

- GIVEN the cashier submits a charge with `delivery: true`
- WHEN the backend responds
- THEN the response shape is identical to a charge without `delivery: true`
- AND no `deliveryStatus` field appears on the response

#### Scenario: success modal renders unchanged

- GIVEN the charge succeeds with `delivery: true`
- WHEN `PaymentSuccessModal` renders
- THEN it MUST render exactly as it does today (no new fields, copy, or totals)
- AND the cashier MUST be able to obtain `deliveryStatus` only via a follow-up `GET /sales` / `GET /sales/:id` request

#### Scenario: counts are unaffected by this change

- GIVEN the cashier applies a `deliveryStatus` filter on the sales list
- WHEN `GET /sales` returns
- THEN `counts.all`, `counts.pendingPayments`, and `counts.notDelivered` MUST behave identically to the pre-change baseline (extended filters do not alter counts)
- AND the filter value MUST affect the listed `data` only

### Requirement: ChargeDomainErrorCode Enumerates SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY

The `ChargeDomainErrorCode` union MUST include the literal `'SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY'` alongside its existing members. TS exhaustiveness on `Record<ChargeDomainErrorCode, …>` MUST force every consumer to handle the new code — adding the code without an `ERROR_ACTIONS` entry MUST be a type error. This requirement is additive: it MUST NOT remove any existing member of the union (no regression on `PAYMENT_AMOUNT_INSUFFICIENT`, `IDEMPOTENCY_KEY_CONFLICT`, etc.).

#### Scenario: literal is accepted by the union

- GIVEN the literal `'SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY'`
- WHEN it is assigned to a `ChargeDomainErrorCode`-typed value
- THEN the assignment MUST type-check

#### Scenario: omitting an entry in ERROR_ACTIONS is a type error

- GIVEN a `Record<ChargeDomainErrorCode, SalePaymentUxAction>` literal is being authored
- WHEN the new key is not provided
- THEN TypeScript MUST report an excess-property / missing-key error (exhaustiveness)

#### Scenario: existing codes remain in the union

- GIVEN the change is applied
- WHEN the union is inspected
- THEN every pre-existing member (including `PAYMENT_AMOUNT_INSUFFICIENT`, `IDEMPOTENCY_KEY_CONFLICT`) MUST still be a member

### Requirement: Friendly Inline Error for SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY

The `ERROR_ACTIONS` map MUST carry an entry keyed by `'SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY'` with `type: 'inline'` and a Spanish-language `message` telling the cashier to assign a shipping address to use the delivery flow. The copy MUST be neutral and actionable (the proposal locks the wording to "Para entrega a domicilio asigna una dirección de envío."). The entry MUST be retrieved via the existing `getSalePaymentErrorAction(code)` dispatch path used by `SalesView.handleChargeDraft` — no new dispatch chain MAY be introduced.

#### Scenario: 422 SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY surfaces inline

- GIVEN the backend responds with `422` and `code: 'SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY'`
- WHEN `SalesView.handleChargeDraft` runs the dispatch chain
- THEN `getSalePaymentErrorAction('SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY')` MUST return a `SalePaymentUxAction`
- AND the returned action MUST have `type: 'inline'`
- AND the returned `message` MUST contain "Para entrega a domicilio" and reference "dirección de envío"

#### Scenario: friendly action replaces the raw error toast

- GIVEN the action is returned
- WHEN the cashier sees the result
- THEN a friendly inline message MUST render
- AND no raw backend error toast MUST be shown for this specific code

#### Scenario: gating is the primary path, 422 is the safety net

- GIVEN the toggle gating requirement (disabled-with-hint when no address)
- WHEN the cashier follows the gating flow normally
- THEN the backend `422 SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` MUST NOT be reached in normal flow
- AND the friendly inline action exists only as a safety net for stale drafts or races

### Requirement: SALE_DELIVERY_STATUS Covers All Four Backend Values

The `SALE_DELIVERY_STATUS` constant object MUST enumerate all four backend values in this exact set: `'PENDING'`, `'SHIPPED'`, `'DELIVERED'`, `'NOT_APPLICABLE'`. The corresponding `SaleDeliveryStatus` TS type MUST be derived from this constant (single source of truth) so that adding a backend value requires only the constant change. Pin tests MUST lock every value in the constant against accidental drift.

#### Scenario: the constant enumerates all four values

- GIVEN `SALE_DELIVERY_STATUS` is exported
- WHEN its keys are enumerated
- THEN it MUST contain `PENDING`, `SHIPPED`, `DELIVERED`, and `NOT_APPLICABLE` — no more, no less

#### Scenario: the type derives from the constant

- GIVEN `SaleDeliveryStatus` is the matching TS type
- WHEN a literal of `'PENDING' | 'SHIPPED' | 'DELIVERED' | 'NOT_APPLICABLE'` is assigned
- THEN the assignment MUST type-check

#### Scenario: adding a new backend value requires only the constant change

- GIVEN the constant is the single source of truth
- WHEN a future value is appended to `SALE_DELIVERY_STATUS`
- THEN the `SaleDeliveryStatus` type MUST pick up the new value automatically
- AND no parallel string-union edits are required

#### Scenario: pin tests freeze the value set

- GIVEN the co-located pin tests
- WHEN they run
- THEN every value in `SALE_DELIVERY_STATUS` MUST be asserted verbatim
- AND a renamed or removed value MUST fail a pin test

### Requirement: Delivery Status Filter Exposes All Four Backend Values

`createSalesFiltersSchema` MUST extend the `deliveryStatus` `multiEnum` options to include all four backend values with neutral Spanish labels. The full set MUST be exactly: `PENDING` ("Pendiente"), `SHIPPED` ("En ruta"), `DELIVERED` ("Entregada"), `NOT_APPLICABLE` ("No aplica"). The field MUST continue to use `param: 'deliveryStatus'` so existing serialization to the CSV `deliveryStatus=PENDING,SHIPPED` query string is preserved. The total field count of the schema (11 fields across 4 sections) MUST NOT change — this is purely an option-array expansion on the existing `deliveryStatus` field.

#### Scenario: filter exposes the four labeled options

- GIVEN the sales list slideover
- WHEN the cashier opens the "Entrega" filter
- THEN the options MUST be "Pendiente", "En ruta", "Entregada", and "No aplica" (in that or stable order)
- AND no other delivery-status option MUST appear

#### Scenario: filter value serializes to the backend CSV param

- GIVEN the cashier selects `SHIPPED` and `NOT_APPLICABLE`
- WHEN the request is sent
- THEN the query string MUST carry `deliveryStatus=SHIPPED,NOT_APPLICABLE` (or `deliveryStatus=NOT_APPLICABLE,SHIPPED`)
- AND the backend CSV semantics (OR within the same filter) MUST be honored

#### Scenario: schema field count and section layout are unchanged

- GIVEN the option-array expansion
- WHEN the schema is inspected
- THEN it MUST still define exactly 11 fields across 4 sections (Estado / Personas / Montos / Fechas)
- AND the existing `REQ-19` invariants MUST continue to hold

### Requirement: Delivery Status Badge Map Covers All Four Backend Values

The `deliveryStatusBadgeMap` MUST carry a config entry for every one of the four backend values so that valid statuses never fall back to the generic "Desconocido" placeholder. Each entry MUST include a Spanish label and a tonal color (`success` | `warning` | `error` | `neutral`) consistent with the visual semantics: `PENDING` (warning), `SHIPPED` ("En ruta", warning), `DELIVERED` ("Entregada", success), `NOT_APPLICABLE` ("No aplica", neutral). The `getDeliveryStatusBadge` lookup MUST return the configured config for any of the four valid values; the `unknownBadge` fallback remains available only for genuinely unknown/legacy strings outside the four-value set.

#### Scenario: every backend value resolves to a configured config

- GIVEN `getDeliveryStatusBadge` is called with each of `PENDING`, `SHIPPED`, `DELIVERED`, `NOT_APPLICABLE`
- WHEN the lookup runs
- THEN every call MUST return a non-`unknownBadge` `SaleBadgeConfig`
- AND no call MUST return the literal label `"Desconocido"`

#### Scenario: badge copy and tone match the visual semantics

- GIVEN the badge map
- WHEN the entries are inspected
- THEN `DELIVERED` MUST use `color: 'success'`
- AND `SHIPPED` MUST use `color: 'warning'` with the label `"En ruta"`
- AND `NOT_APPLICABLE` MUST use `color: 'neutral'` with the label `"No aplica"`

#### Scenario: unknown strings still fall back to "Desconocido"

- GIVEN `getDeliveryStatusBadge` is called with a string outside the four-value set (e.g. a pre-deploy backend response or a typo)
- WHEN the lookup runs
- THEN the function MUST return the `unknownBadge` ("Desconocido") config
- AND no crash MAY occur

#### Scenario: pin tests freeze the badge map

- GIVEN the co-located badge-map pin tests
- WHEN they run
- THEN every key in `deliveryStatusBadgeMap` MUST be asserted verbatim
- AND a renamed or removed value MUST fail a pin test

## Notes on Non-Goals (Encoded from Locked Product Decisions D1–D4)

- **No new CASL subject, no new route, no new customer/address picker.** Reuse `AssignCustomerSlideover` and `useDraftCustomerAssignment` for the toggle's CTA. New RBAC, navigation, or picker primitives are out of scope.
- **Charge response and `PaymentSuccessModal` are unchanged** (success modal, copy, fields, totals). The `deliveryStatus` of the resulting sale is only ever read via `GET /sales` / `GET /sales/:id` — never from the charge response.
- **`counts` are unchanged.** The `deliveryStatus` filter (and every other extended filter) intentionally does not alter the KPI counts, per the locked backend contract §7.
- **`SHIPPED` is a display-only status in this frontend.** The status is only surfaced via the filter and the badge; the POS charge flow never produces a `SHIPPED` sale (the bot/WhatsApp/ONLINE lifecycle produces it elsewhere). No POS-side transition to `SHIPPED` is in scope.

## Out of Scope (recap)

- Delivery routes / stops / check-in (`DeliveryRoute`) — no frontend module exists in this repo; marking a sale `PENDING` and filtering it is the entire POS surface for delivery in this change.
- `SHIPPED` lifecycle mutations from the POS — display and filter only.
- Charge response / `PaymentSuccessModal` changes — explicitly unchanged.
- WebSocket / outbox / real-time events — not touched.
- `counts` / KPI changes — extended filters do not alter counts (locked backend contract).
- New customer/address picker, new route, new CASL subject — none introduced.
- Delivery-routes feature module — none exists in `frontend-houndfe`; the friendly-error pattern stays in the sales feature (`salePaymentErrors.utils.ts` + shared `error.utils.ts`).