# Design: pos-sale-delivery — charge-time delivery flag + deliveryStatus completeness

> Phase: design (SDD)
> Inputs: `openspec/changes/pos-sale-delivery/proposal.md`, `openspec/changes/pos-sale-delivery/specs/sales/spec.md`, Engram `sdd/pos-sale-delivery/proposal` + `sdd/pos-sale-delivery/spec`
> Backend source of truth: `POST /sales/drafts/:id/charge` accepts optional `delivery?: boolean`; `delivery:true` → sale born `deliveryStatus: 'PENDING'`; `422 SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` when no shipping address; `delivery` participates in the idempotency request hash.

This design locks the contracts the proposal left open and answers the seven design questions. It does **not** reopen locked decisions D1–D4.

---

## 1. Summary

A single-surface change in `src/features/POS/sales/`:

1. **Charge-time toggle** in `PaymentModal.vue` ("Entrega a domicilio", a Nuxt UI `USwitch`), gated on the draft having a shipping address, emitting `delivery: true` only when ON into both `buildPayload()` branches, and joining the idempotency-key regeneration watch.
2. **Reactive pass-through** of `activeDraft.shippingAddress` from `SalesView.vue` → `PaymentModal.vue`.
3. **Friendly error mapping** for `SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` through the existing `inline` action type (no new dispatch chain).
4. **Enum/filter/badge completeness** for the full 4-value `deliveryStatus` set (`PENDING | SHIPPED | DELIVERED | NOT_APPLICABLE`).

No new query, no new CASL subject, no new route/picker, no charge-response or `PaymentSuccessModal` change, no `counts` change.

---

## 2. Finalized design decisions (answers to the seven questions)

### Q1 — Toggle widget: `USwitch` (confirmed)

**Decision: `USwitch`** from Nuxt UI v4 (standalone `@nuxt/ui`). Evidence it exists in this project's design system and is already the canonical boolean-toggle primitive:

- `src/features/POS/products/views/ProductDetailView.vue` — `v-model` + `label` + `description` + `:disabled` (`sellInPos`, `includeInOnlineCatalog`, `requiresPrescription`, …).
- `src/features/system/notifications/components/ActionRow.vue` — `:model-value` + `:disabled` + `@update:model-value` + `aria-labelledby`/`aria-describedby`.
- `src/features/system/notifications/components/MasterToggle.vue`, `src/features/admin/payment-methods/components/PaymentMethodUpsertSlideover.vue`.

`UCheckbox` exists too (`SelectColumn.vue`, `RolePermissionsSlideover.vue`, promo/product forms), but it is the project's multi-select / "include this field" primitive, not an on/off switch. For a single boolean "Entrega a domicilio" state, `USwitch` is the idiomatic match.

**Placement:** a new `<section data-testid="delivery-section">` in `PaymentModal.vue`'s scrollable body, **immediately after** the due-date `<section data-testid="due-date-section">`. Rationale: due-date and delivery are the two optional charge modifiers that only make sense after a customer is assigned; grouping them keeps the "optional contract" surface together and near the footer CTA that already reasons about `hasCustomer`.

`USwitch` contract used: `v-model="delivery"`, `:disabled="!hasShippingAddress || isSubmitting"`, `data-testid="delivery-toggle"`.

### Q2 — Badge copy/color (finalized)

`utils/saleStatus.utils.ts` `deliveryStatusBadgeMap` final state:

| Key | Label | Color | Status |
|---|---|---|---|
| `PENDING` | `'No Entregados'` | `'error'` | **unchanged** (pre-existing) |
| `SHIPPED` | `'En ruta'` | `'warning'` | **new** |
| `DELIVERED` | `'Entregados'` | `'success'` | **unchanged** (pre-existing) |
| `NOT_APPLICABLE` | `'No aplica'` | `'neutral'` | **new** |

This satisfies every scenario assertion in the delta spec: `DELIVERED` → `success` (already true), `SHIPPED` → `warning` + `"En ruta"`, `NOT_APPLICABLE` → `neutral` + `"No aplica"`.

**⚠️ Spec-drift flag (for verify reconciliation):** the requirement *statement* in `specs/sales/spec.md` ("Delivery Status Badge Map Covers All Four Backend Values") parenthetically lists `PENDING` (warning) and `DELIVERED` ("Entregada", success). This is inconsistent with the **existing** badge map (`PENDING` → `'No Entregados'`/`error`, `DELIVERED` → `'Entregados'`/`success`) and with the proposal's "What Changes §3", which promised only *adding* `SHIPPED`/`NOT_APPLICABLE`, not re-labeling the two pre-existing entries. Those parenthetical labels are actually the **filter** labels (`Pendiente`, `Entregada`), not the badge labels. **Decision: preserve the pre-existing `PENDING`/`DELIVERED` badge copy+color (no user-visible regression); add only `SHIPPED`/`NOT_APPLICABLE`.** The scenario-level assertions (which are what the verify audit checks) are all satisfied. Verify should confirm the requirement statement is read as illustrative of the filter labels, not a badge-label override.

### Q3 — Idempotency watch + reset-on-open (confirmed)

- Local state `const delivery = ref(false)`.
- Reset on open: add `delivery.value = false` to the existing `watch(() => props.open, …)` reset block (next to `entries.value = []`, `inlineError.value = null`, `dueDateInput.value = null`, `isDueDateExpanded.value = false`).
- Regen watch: replace the existing

  ```ts
  watch(entries, () => { if (!props.open) return; idempotencyKey.value = newIdempotencyKey() }, { deep: true })
  ```

  with

  ```ts
  watch([entries, delivery], () => { if (!props.open) return; idempotencyKey.value = newIdempotencyKey() }, { deep: true })
  ```

  `delivery` is a `ref<boolean>`, so it is a valid watch source in the tuple; `{ deep: true }` remains correct for the `entries` array source and is a no-op for the primitive. The `props.open` guard is preserved so idle non-open renders never mutate the key. `newIdempotencyKey()` already runs on open (immediate reset), so a freshly-opened modal always has a fresh key regardless of the prior toggle value.

### Q4 — Payload emission (confirmed)

Add one local patch and spread it into **both** branches (and the legacy dead branch, for type uniformity):

```ts
function buildPayload(): ChargeSalePayload {
  const payments = normalizeEntries()
  const dueDate = dueDateInput.value || undefined
  const deliveryPatch = delivery.value ? { delivery: true } : {}

  if (payments.length === 1) {
    const single = payments[0]
    if (!single) {
      return { payments, ...(dueDate ? { dueDate } : {}), ...deliveryPatch }
    }
    const legacy: LegacyChargePayload = {
      method: single.method,
      amountCents: single.amountCents,
      ...deliveryPatch,
    }
    if (single.paymentMethodId !== undefined) legacy.paymentMethodId = single.paymentMethodId
    if (dueDate) legacy.dueDate = dueDate
    return legacy
  }

  return { payments, ...(dueDate ? { dueDate } : {}), ...deliveryPatch }
}
```

- Toggle OFF → `deliveryPatch` is `{}` → **no `delivery` key** on either branch → legacy charges stay byte-identical.
- Toggle ON → `deliveryPatch` is `{ delivery: true }` → key present on both the legacy single-payment branch and the `payments[]` multi-payment branch.
- Never emits an explicit `delivery: false` (per spec and backend omit/`false` equivalence).

### Q5 — TanStack Query cache invalidation (confirmed: no new query)

- `useSalesDrafts.chargeDraftMutation.onSuccess` already evicts the charged draft from `saleQueryKeys.drafts(tenant)` via `removeChargedDraftFromCache` — **unchanged**.
- The confirmed-sales list is a separate query (`saleQueryKeys.confirmed(tenant, filters)` in `useConfirmedSales`), driven by `useServerTable` and re-fetched on view mount / filter change. `ChargeSaleResponse` carries **no** `deliveryStatus` (confirmed in `interfaces/sale.types.ts` — it has `saleId/folio/subtotalCents/discountCents/totalCents/paidCents/debtCents/changeDueCents/paymentStatus/confirmedAt`, and nothing else), so there is nothing to seed into the confirmed list from the response.
- **No new query, no new invalidation.** The post-charge `deliveryStatus: 'PENDING'` is read on the next `GET /sales` / `GET /sales/:id` (list/detail), which is exactly the locked D3 behavior. Touching `useConfirmedSales.ts` is out of scope.

### Q6 — Per-slice test layout (finalized)

Existing test files already exist for every touched surface (all co-located under `__tests__/`). We **extend** them, not create new files:

| Slice | Test file (extend) | New coverage |
|---|---|---|
| S1 — types + error map + enum | `interfaces/__tests__/sale.types.test.ts` | `expectTypeOf` assertions: `'SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY'` satisfies `ChargeDomainErrorCode`; both `LegacyChargePayload` and `MultiPaymentChargePayload` accept `delivery: true`; a `delivery: false`-only object is NOT required (optionality). |
| | `utils/__tests__/salePaymentErrors.utils.test.ts` | `getSalePaymentErrorAction('SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY')` deep-equals `{ type: 'inline', message: 'Para entrega a domicilio asigna una dirección de envío.' }`; exhaustiveness is enforced at compile time by `Record<ChargeDomainErrorCode, …>`. |
| | `constants/__tests__/sale.constants.spec.ts` | add `[SALE_DELIVERY_STATUS.SHIPPED, 'SHIPPED']` to the value-pin group; assert the const now enumerates exactly the 4 values. |
| S2 — toggle + idempotency + pass-through | `components/__tests__/PaymentModal.test.ts` | toggle disabled + hint when `shippingAddress: null`; enabled + no hint when present; CTA emits `request-assign-customer`; `buildPayload()` via `submit` emit carries `delivery: true` (both branches) when ON and omits it when OFF; reset-to-OFF on reopen; idempotency key regenerates on toggle flip (with `newIdempotencyKey` spied/mocked to return a deterministic sequence). |
| | `views/__tests__/SalesView.test.ts` | assert the rendered `PaymentModal` receives `shippingAddress === activeDraft.shippingAddress ?? null` (find `PaymentModal`, read `props('shippingAddress')`). |
| S3 — filter + badge completeness | `utils/__tests__/saleStatus.utils.test.ts` | `getDeliveryStatusBadge` returns non-`Desconocido` config for all 4 values; `SHIPPED` → `{ label:'En ruta', color:'warning' }`; `NOT_APPLICABLE` → `{ label:'No aplica', color:'neutral' }`; unknown string still → `Desconocido`. Pin the map keys. |
| | `config/__tests__/salesFiltersSchema.test.ts` | `deliveryStatus` filter exposes exactly the 4 labeled options (`Pendiente`/`En ruta`/`Entregada`/`No aplica`); schema still has 11 fields / 4 sections (REQ-19 invariant). |

**Mounting note for PaymentModal toggle tests:** the existing `PaymentModal.test.ts` already mounts with plain `mount()` + an exhaustive `stubs` map (`USlideover`, `UButton`, `UInputNumber`, `UInput`, `USelect`, `UBadge`, `USeparator`, `UFormField`, `UIcon`, `UAlert`) — it does **not** need `UApp` provider context because the provider-dependent components are stubbed. **Decision: extend that same pattern** by adding a `USwitch` stub; `mountWithUApp` is NOT required here (it is reserved for components that actually inject `UApp` provider contexts such as `UTooltip`/`UModal`/`UToast`/`UDropdownMenu`, none of which PaymentModal renders un-stubbed). Proposed `USwitch` stub (forwards `$attrs` so `data-testid="delivery-toggle"` is queryable):

```ts
USwitch: {
  props: ['modelValue', 'disabled', 'label', 'description'],
  emits: ['update:modelValue'],
  template:
    '<input type="checkbox" v-bind="$attrs" :checked="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
}
```

### Q7 — Reactivity of `shippingAddress` (confirmed)

- `SalesView.vue` (PaymentModal instance at line 885) adds `:shipping-address="activeDraft.shippingAddress ?? null"` beside `:customer="activeDraft.customer ?? null"`.
- `PaymentModal.vue` adds `shippingAddress?: CustomerAddress | null` to `defineProps` and derives `const hasShippingAddress = computed(() => props.shippingAddress != null)`.
- **Address-clears-on-customer-change is handled by prop reactivity, no extra wiring.** `activeDraft` is a `computed` over the drafts TanStack cache (`useSalesDrafts`), and every `useDraftCustomerAssignment` mutation writes the backend-returned `Sale` back into that cache via `replaceSaleInCache` — including `unassignCustomer` and `clearShippingAddress` which explicitly set `shippingAddress: null`, and `assignCustomer` whose backend response carries the cleared address (backend §2.5.1). The moment the cache updates, `activeDraft.shippingAddress` → `null` → prop updates → `hasShippingAddress` flips → toggle disables.
- **Guard against a stale ON state:** add `watch(() => props.shippingAddress, (addr) => { if (addr == null) delivery.value = false })` so a gate-close also resets the toggle OFF (satisfies the spec scenario "clearing the address reactively disables the toggle … built payload MUST NOT carry `delivery: true` while the gate is closed"). `buildPayload()` is additionally gated by the patch only when `delivery.value` is true, so even a transient in-flight render cannot emit `delivery: true` without an address.

---

## 3. Data contracts

### 3.1 Types (`interfaces/sale.types.ts`) — plain TS interfaces (no Zod; sales module has no Zod schema)

- `LegacyChargePayload` (≈line 258): add `/** Charge-time "para entrega" flag. Omit when off; `true` births the sale as PENDING. */ delivery?: boolean`.
- `MultiPaymentChargePayload` (≈line 281): add the same `delivery?: boolean`.
- `ChargeSalePayload` union: **unchanged** (discriminants remain `payments?: never` / `method?: never; amountCents?: never`).
- `ChargeDomainErrorCode` (≈line 354): append `| 'SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY'`. Additive only — no existing member removed.

### 3.2 Constant (`constants/sale.constants.ts`)

```ts
export const SALE_DELIVERY_STATUS = {
  PENDING: 'PENDING',
  SHIPPED: 'SHIPPED',        // NEW
  DELIVERED: 'DELIVERED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
} as const
```

`SaleDeliveryStatus = (typeof SALE_DELIVERY_STATUS)[keyof typeof SALE_DELIVERY_STATUS]` (already derived at `sale.types.ts:32-33`) picks up `'SHIPPED'` automatically — single source of truth, no parallel union edit.

### 3.3 Error map (`utils/salePaymentErrors.utils.ts`)

```ts
SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY: {
  type: 'inline',
  message: 'Para entrega a domicilio asigna una dirección de envío.',
},
```

TS exhaustiveness on `Record<ChargeDomainErrorCode, SalePaymentUxAction>` forces this entry — adding the union member without it is a compile error. Dispatch is the existing `SalesView.handleChargeDraft → getSalePaymentErrorAction(code)`; the `inline` action sets `inlineAmountError` → `:external-error` → PaymentModal footer inline text (never a raw toast). **No dispatch change.**

### 3.4 Filter (`config/salesFiltersSchema.ts`)

Extend the existing `deliveryStatus` `multiEnum` options array (order = backend enum order):

```ts
{ value: SALE_DELIVERY_STATUS.PENDING, label: 'Pendiente' },
{ value: SALE_DELIVERY_STATUS.SHIPPED, label: 'En ruta' },
{ value: SALE_DELIVERY_STATUS.DELIVERED, label: 'Entregada' },
{ value: SALE_DELIVERY_STATUS.NOT_APPLICABLE, label: 'No aplica' },
```

`param: 'deliveryStatus'` and CSV multi-enum serialization are unchanged (backend OR-within-filter semantics preserved). Field count stays 11 across 4 sections (REQ-19).

### 3.5 Badge map (`utils/saleStatus.utils.ts`)

As finalized in §2/Q2 — add `SHIPPED` and `NOT_APPLICABLE`; keep `PENDING`/`DELIVERED` unchanged.

---

## 4. Data flow

```
SalesView (drafts cache via useSalesDrafts)
  └─ activeDraft.shippingAddress (reactive, cache-backed)
       │  :shipping-address="activeDraft.shippingAddress ?? null"
       ▼
PaymentModal
  ├─ hasShippingAddress = computed(shippingAddress != null)
  ├─ delivery = ref(false)                 ← reset on open
  ├─ USwitch v-model="delivery" :disabled="!hasShippingAddress || isSubmitting"
  ├─ CTA (disabled state) ──emit('request-assign-customer')──▶ AssignCustomerSlideover
  ├─ watch([entries, delivery]) → newIdempotencyKey()        ← idempotency regen
  └─ buildPayload()
       ├─ legacy branch:   { method, amountCents, ...(delivery? {delivery:true}:{}) }
       └─ payments branch: { payments, ...(delivery? {delivery:true}:{}) }
             │  emit('submit', { saleId, payload, idempotencyKey })
             ▼
SalesView.handleChargeDraft → useSalesDrafts.chargeDraft → saleApi.chargeDraft
  ├─ success: chargeDraftMutation evicts draft; success modal opens (UNCHANGED)
  └─ error SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY → getSalePaymentErrorAction → inline
             (safety net only; gating avoids it in normal flow)
```

`deliveryStatus: 'PENDING'` is never read from the charge response — the confirmed list/detail re-query it afterward.

---

## 5. File change map

| File | Kind | Change |
|---|---|---|
| `src/features/POS/sales/interfaces/sale.types.ts` | MOD | `delivery?: boolean` on `LegacyChargePayload` + `MultiPaymentChargePayload`; `'SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY'` on `ChargeDomainErrorCode`. |
| `src/features/POS/sales/constants/sale.constants.ts` | MOD | `SHIPPED: 'SHIPPED'` in `SALE_DELIVERY_STATUS`. |
| `src/features/POS/sales/components/PaymentModal.vue` | MOD | `shippingAddress` prop + `CustomerAddress` import; `delivery` ref + reset + gate-close watch; `hasShippingAddress` computed; `USwitch` section + hint + CTA; `deliveryPatch` in `buildPayload()`; `watch([entries, delivery], …)`. |
| `src/features/POS/sales/views/SalesView.vue` | MOD | `:shipping-address="activeDraft.shippingAddress ?? null"` on `PaymentModal`. |
| `src/features/POS/sales/utils/salePaymentErrors.utils.ts` | MOD | `SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` inline entry. |
| `src/features/POS/sales/utils/saleStatus.utils.ts` | MOD | `SHIPPED` + `NOT_APPLICABLE` badge entries. |
| `src/features/POS/sales/config/salesFiltersSchema.ts` | MOD | `SHIPPED` + `NOT_APPLICABLE` filter options. |
| `interfaces/__tests__/sale.types.test.ts` | MOD | type pin tests (S1). |
| `utils/__tests__/salePaymentErrors.utils.test.ts` | MOD | error-map pin tests (S1). |
| `constants/__tests__/sale.constants.spec.ts` | MOD | `SHIPPED` value pin (S1). |
| `components/__tests__/PaymentModal.test.ts` | MOD | toggle/idempotency/payload tests (S2). |
| `views/__tests__/SalesView.test.ts` | MOD | prop pass-through test (S2). |
| `utils/__tests__/saleStatus.utils.test.ts` | MOD | badge completeness tests (S3). |
| `config/__tests__/salesFiltersSchema.test.ts` | MOD | filter option completeness tests (S3). |

**Untouched (per proposal §7):** `api/sale.api.ts`, `useSalesDrafts.ts` charge mutation, `PaymentSuccessModal.vue`, `useConfirmedSales.ts`, `SalesListTabs.vue`, CASL `ability.ts`/`auth.types.ts`, router, `counts`.

---

## 6. TanStack Query strategy

- **Keys touched:** none new. `saleQueryKeys.drafts(tenant)` (eviction already handled by `chargeDraftMutation`), `saleQueryKeys.confirmed(tenant, filters)` (re-fetch on mount/filter change).
- **Mutation strategy:** no mutation changes. `chargeDraftMutation` unchanged.
- **Invalidation:** no new invalidation. Charge response carries no `deliveryStatus`; the sale is re-queried via list/detail (locked D3).

---

## 7. Permission matrix (CASL)

**No change.** Locked D4: no new CASL subject, verb, route, or picker. The charge flow already runs under existing POS draft/sale permissions; the toggle CTA reuses `request-assign-customer` → existing `AssignCustomerSlideover` (already permission-gated). No `APP_SUBJECTS` / `AppSubject` / `navigation.registry.ts` / router edits.

---

## 8. Empty / loading / error states

No new views. State handling reuses existing surfaces:

- **Loading:** `isSubmitting` disables the `USwitch`, CTA, and confirm button (same as other inputs).
- **Empty/gate-closed (no address):** `USwitch` `:disabled` + inline hint `"asigná cliente y dirección primero"` + CTA (`request-assign-customer`). No auto-open side effects.
- **Error (`422 SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY`):** `inline` action → `inlineAmountError` → PaymentModal footer `inlineError || externalError` red text. Safety-net only (gating prevents it in normal flow).
- **Unknown delivery status (legacy/typo):** `getDeliveryStatusBadge` still returns `unknownBadge` (`"Desconocido"`, neutral) — unchanged fallback.

---

## 9. Reused primitives (no reinvention)

- `USwitch` (Nuxt UI) — project's standard boolean toggle.
- `AssignCustomerSlideover` + `useDraftCustomerAssignment` — existing customer → shipping-address flow behind `request-assign-customer` (D4).
- `newIdempotencyKey()` (`utils/idempotency.utils.ts`) — unchanged.
- `getSalePaymentErrorAction` + `SalesView.handleChargeDraft` dispatch — unchanged.
- `SALE_DELIVERY_STATUS` const → `SaleDeliveryStatus` derived type — single source of truth.
- Existing co-located `__tests__/` files + `PaymentModal.test.ts` stub harness — extended, not rebuilt.

---

## 10. Slices (dependency-respecting, strict TDD)

1. **S1 — Types + error map + enum** (pure, no UI): `sale.types.ts`, `salePaymentErrors.utils.ts`, `sale.constants.ts` + their pin tests.
2. **S2 — PaymentModal toggle + idempotency + SalesView pass-through** (< 400 changed lines): `PaymentModal.vue`, `SalesView.vue` + `PaymentModal.test.ts`, `SalesView.test.ts`.
3. **S3 — Filter/badge completeness** (small): `salesFiltersSchema.ts`, `saleStatus.utils.ts` + their tests.

Each slice ends green on `pnpm test:unit --run`; type-check via `pnpm build` (vue-tsc) at slice completion. Slice budget ≤ 600 changed lines each.

---

## 11. Rollout / rollback

- **No feature flag** (small surface; proposal §11). If staged rollout is later preferred, gating the toggle on a flag is trivial in S2.
- **Full rollback:** revert `PaymentModal` toggle + `buildPayload()` emission → all charges omit `delivery` → byte-identical pre-change behavior (backend treats omission as `false`).
- **Partial rollback:** keep S1+S3 (error map + enum/filter/badge — harmless additive) while removing only the toggle.
- **Backend safety:** flag optional and backward compatible; old frontend never sends it, new frontend never breaks old behavior. No data migration / schema change.

---

## 12. Risks & open items

| Risk / Open item | Resolution |
|---|---|
| **Idempotency coupling** — stale key on toggle flip → `409` | `delivery` joins the regen watch; pin test asserts key change on flip; `IDEMPOTENCY_KEY_CONFLICT → new-key` remains a backstop. |
| **Spec-drift: badge `PENDING`/`DELIVERED` labels/tones** | Preserve pre-existing copy/tone; add only `SHIPPED`/`NOT_APPLICABLE`. Flagged in §2/Q2 for verify reconciliation. |
| **Stale ON toggle after address clear** | `watch(shippingAddress)` resets `delivery=false` when the address goes null; `deliveryPatch` gating double-protects the payload. |
| **Toggle enabled without address (race/stale draft)** | Gating is the primary path; `422` maps to friendly `inline` action as the safety net. |
| **Charge response temptation to read `deliveryStatus`** | Explicit non-goal; response shape unchanged; status read only via list/detail. |
| **Four other active sales-domain deltas** (`sales-payment-coco`, `sales-pos-charge`, `sales-history-coco`, `pos-price-list-tiers`) | None touch `deliveryStatus`/`SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY`/error map; no content overlap on these requirements (noted in spec). |

---

## 13. Component split justification

This is a **single-surface, additive** change, so no new components are introduced (vue-best-practices split triggers — 3+ UI sections, reusable repeated template, orchestration+markup — are not hit):

- `PaymentModal.vue` remains the single charge-contract surface (it already owns payment entries, due date, and submit). The delivery toggle is one more optional charge modifier in that same surface; extracting a child component for one `USwitch` + hint would add ceremony without a reuse boundary.
- `SalesView.vue` remains the composition surface (thin prop pass-through only).
- `saleStatus.utils.ts` / `salesFiltersSchema.ts` / `salePaymentErrors.utils.ts` / `sale.constants.ts` are pure data/value modules — no component split needed.

The change is props-down/events-up throughout: `SalesView → PaymentModal` (`shippingAddress` prop), `PaymentModal → SalesView` (`submit`, `update:open`, existing `request-assign-customer` emits). No new provide/inject, no new Pinia, no `reactive()` (a single `ref(false)` suffices; derivations are `computed`).
