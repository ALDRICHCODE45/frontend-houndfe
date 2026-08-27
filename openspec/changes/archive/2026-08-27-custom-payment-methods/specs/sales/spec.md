# Delta for Sales — Custom Payment Method Catalog Integration

Extends `openspec/specs/sales/spec.md` with the wire-shape and display rules required by the custom-payment-methods change. Anchored on `openspec/changes/custom-payment-methods/design.md` §2.3 (data contracts), §3 (per-component split), §7.4 (sale-detail / timeline states) and `houndfe-backend/docs/payment-methods-frontend.md` §2 (response shapes), §4 (error codes), §6.3 (detail / timeline display rules). Scope: ADDED requirements only; no existing REQ-* in the canonical sales spec is modified (the wire-shape additions are purely additive, and the charge-error dispatch is a new layer that short-circuits before the legacy dispatch).

## ADDED Requirements

### REQ-CAT-001: `PaymentEntry` accepts optional `paymentMethodId`

`PaymentEntry` (used by `PaymentModal`, `DebtPaymentModal`, `useDebtPayment`, and the entry builders under `src/features/POS/sales/utils/paymentEntries.utils.ts`) MUST accept an optional `paymentMethodId?: string` field. The base `method: CollectionPaymentMethod` MUST remain required and unchanged. Entries constructed from a fixed tile MUST omit `paymentMethodId` so legacy payloads stay byte-identical (idempotency hash unchanged — backend §7.3); entries constructed from a custom tile MUST include `paymentMethodId` with the tile's UUID.

#### Scenario: fixed-tile entry omits `paymentMethodId`

- GIVEN the cashier toggles on a fixed tile ("Efectivo", "Tarjeta crédito", "Tarjeta débito", or "Transferencia")
- WHEN the entry is constructed
- THEN the entry is `{ method: "cash" | "card_credit" | "card_debit" | "transfer", amountCents: N, reference?: string }`
- AND no `paymentMethodId` key is present
- AND the wire payload hash matches the pre-change shape

#### Scenario: custom-tile entry includes `paymentMethodId`

- GIVEN the cashier toggles on a custom tile with `paymentMethodId: "uuid-x"` and `category: "transfer"`
- WHEN the entry is constructed
- THEN the entry is `{ method: "transfer", amountCents: N, paymentMethodId: "uuid-x" }`
- AND the base `method` equals the tile's `category`

#### Scenario: `paymentMethodId` is type-checked when omitted

- GIVEN a `PaymentEntry` literal constructed by a legacy code path
- WHEN type-checked with `paymentMethodId` absent
- THEN the literal is accepted (the field is optional)

### REQ-CAT-002: `LegacyChargePayload` accepts optional `paymentMethodId`

`LegacyChargePayload` (the single-payment charge shape returned by `PaymentModal.buildPayload()` per design §1.3 / backend §7.1) MUST accept an optional `paymentMethodId?: string`. When the charge flattens a single custom-tile entry, the field MUST be forwarded. When the charge flattens a fixed-tile entry, the field MUST be omitted. The existing `method: PaymentMethod` and `amountCents: number` fields MUST remain required and unchanged.

#### Scenario: single-entry custom charge flattens with `paymentMethodId`

- GIVEN the cashier confirms a charge with exactly one custom entry `{ method: "transfer", paymentMethodId: "uuid-x", amountCents: N }`
- WHEN `buildPayload()` flattens the entry
- THEN the payload is `{ method: "transfer", amountCents: N, paymentMethodId: "uuid-x" }`
- AND the legacy single-payment shape is otherwise preserved

#### Scenario: single-entry fixed charge flattens without `paymentMethodId`

- GIVEN the cashier confirms a charge with exactly one fixed entry `{ method: "cash", amountCents: N }`
- WHEN `buildPayload()` flattens the entry
- THEN the payload is `{ method: "cash", amountCents: N }`
- AND no `paymentMethodId` key is present

### REQ-CAT-003: `SaleDetailPayment` accepts three optional catalog fields

`SaleDetailPayment` (the payment row inside `GET /sales/:id`) MUST accept three additional OPTIONAL fields that the backend populates only when the payment was charged with a custom `PaymentMethod`: `paymentMethodId?: string`, `paymentMethodName?: string`, `paymentMethodSubtitle?: string`. Existing fields (`method`, `amountCents`, `tenderedCents`, `changeCents`, `reference`, `paidAt`, `paymentId`) MUST remain unchanged. Legacy rows (charged before the catalog existed) MUST continue to type-check with all three new fields absent.

#### Scenario: catalog-charged row exposes the three fields

- GIVEN a sale charged with `paymentMethodId: "uuid-x"`, name "Mercado Pago", subtitle "Link"
- WHEN `GET /sales/:id` returns the sale
- THEN each affected payment row has `paymentMethodId: "uuid-x"`, `paymentMethodName: "Mercado Pago"`, `paymentMethodSubtitle: "Link"`
- AND the base `method` is the canonical UPPERCASE category (`"TRANSFER"`)

#### Scenario: legacy row keeps type-checking without the new fields

- GIVEN a sale charged before the catalog existed
- WHEN a `SaleDetailPayment` literal is constructed with no `paymentMethodId` / `paymentMethodName` / `paymentMethodSubtitle`
- THEN the literal type-checks
- AND the existing `method` field still drives the label

### REQ-CAT-004: `PAYMENT_RECEIVED` timeline member accepts the same three optional fields

The `PAYMENT_RECEIVED` event in `SaleTimelineEvent` MUST accept the same three optional fields as `SaleDetailPayment`: `paymentMethodId?: string`, `paymentMethodName?: string`, `paymentMethodSubtitle?: string`. The snapshot originates from the same `SalePayment.metadataJson.catalog` payload that feeds `SaleDetailPayment`, so the two surfaces MUST stay in lock-step.

#### Scenario: catalog-charged timeline event exposes the three fields

- GIVEN a sale charged with a custom method
- WHEN the timeline renders the `PAYMENT_RECEIVED` event
- THEN the event carries `paymentMethodId`, `paymentMethodName`, and (when present) `paymentMethodSubtitle`

#### Scenario: legacy timeline event keeps type-checking without the new fields

- GIVEN a legacy timeline event with no catalog fields
- WHEN type-checked
- THEN the event is accepted
- AND the existing `method` field still drives the label

### REQ-CAT-005: Display label prefers `paymentMethodName` over the base `method` label

Both `PaymentsListSection` (sale detail) and `SaleDetailTimeline` (for `PAYMENT_RECEIVED`) MUST render the row label as `paymentMethodName ?? getMethodMeta(method).label`. The fallback to the base `method` label MUST be silent — no branch on enum values, no special cases. When both `paymentMethodName` and `method` are absent, the implementation MUST fall back to the existing default copy without throwing.

#### Scenario: catalog row shows the snapshot name

- GIVEN a `SaleDetailPayment` with `paymentMethodName: "Mercado Pago"` and `method: "TRANSFER"`
- WHEN `PaymentsListSection` renders the row
- THEN the visible label is "Mercado Pago"
- AND the legacy "Transferencia" label is NOT used

#### Scenario: legacy row shows the base label

- GIVEN a legacy `SaleDetailPayment` with no `paymentMethodName`
- WHEN `PaymentsListSection` renders the row
- THEN the visible label is the existing base-category label for `method`

#### Scenario: timeline `PAYMENT_RECEIVED` parity

- GIVEN a `PAYMENT_RECEIVED` event with `paymentMethodName: "Mercado Pago"`
- WHEN the timeline renders the event
- THEN the label is "Mercado Pago"
- AND parity with the `PaymentsListSection` surface is preserved for the same payload

### REQ-CAT-006: `paymentMethodSubtitle` renders as a grey sub-line when present

When `paymentMethodSubtitle` is a non-empty string after trimming, `PaymentsListSection` and `SaleDetailTimeline` MUST render it as a grey sub-line directly below the label. When it is `null`, missing, or whitespace-only, the sub-line MUST NOT render (no "—" placeholder, no empty space). The same truthy-trim rule from `pos-payment-method-tiles` REQ-PT-007 applies — the renderer MUST NOT branch on enum values to decide visibility.

#### Scenario: row with subtitle renders the grey sub-line

- GIVEN a row with `paymentMethodName: "Mercado Pago"`, `paymentMethodSubtitle: "Link"`
- WHEN the row renders
- THEN a grey sub-line containing "Link" renders below the label

#### Scenario: row without subtitle hides the sub-line

- GIVEN a row with `paymentMethodName: "Efectivo USD"`, `paymentMethodSubtitle: null`
- WHEN the row renders
- THEN only the label renders
- AND no sub-line element is present

#### Scenario: whitespace-only subtitle hides the sub-line

- GIVEN a row with `paymentMethodSubtitle: "   "`
- WHEN the row renders
- THEN the sub-line element is absent

### REQ-CAT-007: `PAYMENT_METHOD_CATEGORY_MISMATCH` clears catalog selection silently

When `POST /sales/drafts/:id/charge` or `POST /sales/:id/payments` returns HTTP 400 with `error: "PAYMENT_METHOD_CATEGORY_MISMATCH"` (per backend §4 charge-error table), the dispatch layer (`SalesView.handleChargeDraft` for normal charges; `useDebtPayment.onError` for debt payments) MUST: invoke `getPaymentMethodChargeErrorAction("PAYMENT_METHOD_CATEGORY_MISMATCH")` FIRST (short-circuit before the legacy `getSalePaymentErrorAction` dispatch); on a non-null action, filter out every entry with `paymentMethodId` from the modal's `entries`; increment the `catalogClearSignal` so the modal reacts; and surface NO toast (the error is self-explanatory: the cashier re-selects). The dispatch MUST NOT mutate fixed entries.

#### Scenario: mismatch on charge clears custom entries only

- GIVEN the cashier has selected one fixed entry (`{ method: "cash" }`) and one custom entry (`{ method: "transfer", paymentMethodId: "uuid-x" }`)
- WHEN the charge returns 400 with `error: "PAYMENT_METHOD_CATEGORY_MISMATCH"`
- THEN the custom entry is removed from `entries`
- AND the fixed entry remains
- AND no toast is shown
- AND `catalogClearSignal` increments

#### Scenario: mismatch on debt payment clears custom entries only

- GIVEN the cashier submits a debt payment that includes a custom entry
- WHEN the request returns 400 with `error: "PAYMENT_METHOD_CATEGORY_MISMATCH"`
- THEN `useDebtPayment.onError` invokes the catalog action first
- AND the custom entry is removed from `normalizedPayments`
- AND no toast is shown

#### Scenario: mismatch short-circuits before legacy dispatch

- GIVEN a 400 response with `error: "PAYMENT_METHOD_CATEGORY_MISMATCH"`
- WHEN the dispatch layer runs
- THEN the catalog action resolves and returns BEFORE the legacy `getSalePaymentErrorAction` path
- AND the legacy code path does NOT execute

### REQ-CAT-008: `PAYMENT_METHOD_NOT_FOUND` clears selection, refetches, and toasts

When the charge endpoint returns HTTP 404 with `error: "PAYMENT_METHOD_NOT_FOUND"` (the selected UUID does not exist OR belongs to another tenant — backend uses the same code to avoid leaking presence), the dispatch layer MUST: invoke `getPaymentMethodChargeErrorAction("PAYMENT_METHOD_NOT_FOUND")` first; clear every custom entry from the modal; call `invalidateQueries({ queryKey: saleQueryKeys.paymentMethods(tenantId) })` to refetch the projection; increment `catalogClearSignal`; and surface the toast "Método de cobro no disponible."

#### Scenario: not-found on charge clears + refetches + toasts

- GIVEN a charge with a custom entry whose `paymentMethodId` was deactivated and deleted between selection and submit (or belongs to another tenant)
- WHEN the charge returns 404 with `error: "PAYMENT_METHOD_NOT_FOUND"`
- THEN the custom entry is removed from `entries`
- AND `saleQueryKeys.paymentMethods(tenantId)` is invalidated
- AND `catalogClearSignal` increments
- AND the toast "Método de cobro no disponible." is shown

#### Scenario: not-found on debt payment mirrors the behavior

- GIVEN a debt payment that returns 404 with `error: "PAYMENT_METHOD_NOT_FOUND"`
- WHEN `useDebtPayment.onError` runs
- THEN `normalizedPayments` is filtered to remove custom entries
- AND the projection key is invalidated
- AND the same toast is shown

### REQ-CAT-009: `INACTIVE_PAYMENT_METHOD` clears selection, refetches, and toasts

When the charge endpoint returns HTTP 409 with `error: "INACTIVE_PAYMENT_METHOD"` (the selected UUID exists but was deactivated between selection and submit), the dispatch layer MUST: invoke `getPaymentMethodChargeErrorAction("INACTIVE_PAYMENT_METHOD")` first; clear every custom entry from the modal; call `invalidateQueries({ queryKey: saleQueryKeys.paymentMethods(tenantId) })` to refetch the projection (the deactivated tile is now gone); increment `catalogClearSignal`; and surface the toast "Este método fue desactivado."

#### Scenario: inactive on charge clears + refetches + toasts

- GIVEN a charge with a custom entry whose `paymentMethodId` was deactivated after selection (admin clicked Desactivar)
- WHEN the charge returns 409 with `error: "INACTIVE_PAYMENT_METHOD"`
- THEN the custom entry is removed from `entries`
- AND the projection key is invalidated
- AND the toast "Este método fue desactivado." is shown

#### Scenario: inactive on debt payment mirrors the behavior

- GIVEN a debt payment that returns 409 with `error: "INACTIVE_PAYMENT_METHOD"`
- WHEN `useDebtPayment.onError` runs
- THEN `normalizedPayments` is filtered to remove custom entries
- AND the projection key is invalidated
- AND the same toast is shown

### REQ-CAT-010: `INVALID_PAYMENT_METHOD_ID` defends client-side

The frontend MUST treat `INVALID_PAYMENT_METHOD_ID` (HTTP 400) as a defensive layer: a malformed UUID cannot originate from the UI because `paymentMethodId` is sourced exclusively from `ActivePaymentMethodProjection.id`, and `buildMergedMethodOptions` drops any row whose `id` fails the UUID guard (`isUuidString`). If the error ever reaches the dispatch layer, the action is `{ clearCatalogSelection: false, refetchSelector: false, toast: "Método de cobro inválido." }` — purely a defensive toast, no clearing, no refetch.

#### Scenario: UUID guard drops non-UUID projection rows

- GIVEN the projection includes a row whose `id` is not a valid UUID (defensive: should never happen but enforced at the boundary)
- WHEN `buildMergedMethodOptions(projection)` runs
- THEN the row is dropped from the merged tile list
- AND no entry can be constructed with that id

#### Scenario: invalid id toast is defensive only

- GIVEN a 400 with `error: "INVALID_PAYMENT_METHOD_ID"` somehow reaches the dispatch layer
- WHEN `getPaymentMethodChargeErrorAction("INVALID_PAYMENT_METHOD_ID")` resolves
- THEN `clearCatalogSelection` is `false`
- AND `refetchSelector` is `false`
- AND the toast "Método de cobro inválido." is shown
- AND no entries are cleared and no projection query is invalidated

### REQ-CAT-011: Catalog error dispatch short-circuits before legacy error dispatch

Both `SalesView.handleChargeDraft` and `useDebtPayment.onError` MUST call `getPaymentMethodChargeErrorAction(code)` FIRST. When the action is non-null (any of the four catalog codes), the dispatch MUST handle it (clear/refetch/toast per REQ-CAT-007..010) and RETURN without falling through to the legacy `getSalePaymentErrorAction` path. The catalog error map is isolated from `salePaymentErrors.utils.ts` per design §8.2 (proposal risk #7 — preventing collisions with legacy codes).

#### Scenario: catalog code is handled before legacy dispatch

- GIVEN a charge rejection with `error: "PAYMENT_METHOD_CATEGORY_MISMATCH"`
- WHEN the dispatch runs
- THEN the catalog action runs first and resolves
- AND the legacy `getSalePaymentErrorAction` dispatch is NOT invoked for the same rejection

#### Scenario: non-catalog rejection falls through to legacy dispatch

- GIVEN a charge rejection with `error: "PAYMENT_AMOUNT_INSUFFICIENT"` (a legacy code)
- WHEN the dispatch runs
- THEN the catalog action returns `null`
- AND the legacy `getSalePaymentErrorAction` path runs unchanged

#### Scenario: dispatch order is the same for charge and debt

- GIVEN `SalesView.handleChargeDraft` (charge) and `useDebtPayment.onError` (debt)
- WHEN both surfaces handle the same catalog error code
- THEN the surface behavior (clear + refetch + toast) is identical across both
- AND the implementation does not diverge between modals

