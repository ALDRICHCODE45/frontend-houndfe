# Tasks: pos-sale-delivery — charge-time delivery flag + deliveryStatus completeness

> Phase: tasks (SDD)
> Inputs: `openspec/changes/pos-sale-delivery/{proposal.md, specs/sales/spec.md, design.md}` + on-disk file map verified during tasks authoring.
> Stack: Vue 3.5 + `<script setup lang="ts">` + Vitest 4 + vue-tsc + `@nuxt/ui` v4 (`USwitch`).
> Strict TDD: RED → GREEN → TRIANGULATE → REFACTOR per slice.
> Delivery strategy (preflight-resolved by parent): `ask-on-risk`. Result of this forecast below.

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines (total additions + deletions across all three slices) | **≈ 260–340 lines** (S1 ~60, S2 ~190, S3 ~30). |
| 400-line review-budget risk | **Low** |
| Chained PRs recommended | **No** |
| Suggested split | single PR — three dependency-ordered slices committed sequentially on the same branch, no PR split needed |
| Delivery strategy | `ask-on-risk` (parent will NOT trigger ask because risk is Low) |
| Chain strategy | `pending` (chaining not required; no decision to collect from the user) |
| Decision needed before apply | **No** |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

**Forecast rationale.** The change is single-surface (one feature module: `src/features/POS/sales/`), additive, and tightly bounded: three sequential slices each fit comfortably below the 600-line strict-TDD slice budget and their cumulative add+del footprint (≈260–340 lines, dominated by `PaymentModal.test.ts` test scaffolding — two `buildPayload()` branch assertions, gating cases, idempotency regen cases, gate-close reset case, USwitch stub) stays well under the 400-line review budget. No new query/cache work, no new CASL subject, no new route, no new component (the `USwitch` is added inline to `PaymentModal.vue` per the design's split-justification in §13). The only risk vectors are local: idempotency hash coupling (covered by the `watch([entries, delivery])` change + regen pin test) and the pre-existing `PENDING`/`DELIVERED` badge labels (preserved verbatim per design §2/Q2, flagged for verify reconciliation). Per `ask-on-risk` the parent does not need to prompt the user; the apply phase proceeds as a single PR.

---

## Work Units

| # | Goal | Test cmd | Runtime path | Rollback |
|---|------|----------|--------------|----------|
| S1 | Pure data contracts: `delivery?: boolean` on both payload branches; `SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` on the error code union + inline `ERROR_ACTIONS` entry; `SHIPPED` on `SALE_DELIVERY_STATUS`. | `pnpm test:unit --run src/features/POS/sales/interfaces/__tests__/sale.types.test.ts src/features/POS/sales/utils/__tests__/salePaymentErrors.utils.test.ts src/features/POS/sales/constants/__tests__/sale.constants.spec.ts` | All consumers in S2/S3 import from these modules; S2 cannot start without the `delivery?: boolean` shape landing first. | Revert S1 commits; union/constant additions are additive and cannot break pre-existing callers (TS exhaustiveness forces only the new entry, never removes). |
| S2 | `PaymentModal` delivery toggle (USwitch), gating, `buildPayload()` emission in both branches, idempotency-key regen watch, reset-on-open + reset-on-gate-close, `SalesView` `shippingAddress` pass-through. | `pnpm test:unit --run src/features/POS/sales/components/__tests__/PaymentModal.test.ts src/features/POS/sales/views/__tests__/SalesView.test.ts` | S2 imports the `delivery?: boolean` field added in S1. Depends on S1 only. | Revert S2 commits; `PaymentModal` `buildPayload()` falls back to the pre-S2 shape (no `delivery` key) — byte-identical legacy charges. |
| S3 | Filter schema options (`Pendiente`/`En ruta`/`Entregada`/`No aplica`) + badge map entries (`SHIPPED`/"En ruta"/warning, `NOT_APPLICABLE`/"No aplica"/neutral) + pin tests for the four-value set. | `pnpm test:unit --run src/features/POS/sales/config/__tests__/salesFiltersSchema.test.ts src/features/POS/sales/utils/__tests__/saleStatus.utils.test.ts` | S3 imports `SALE_DELIVERY_STATUS` from S1 to keep option labels in sync. Depends on S1 only (independent of S2). | Revert S3 commits; option-array removal is local to the filter slideover and badge renderer — no data corruption, no API contract change. |

---

## Dependency Graph

```
S1 (types + error map + enum)
        │
        ├──► S2 (PaymentModal toggle + idempotency + SalesView pass-through)
        │
        └──► S3 (filter + badge completeness)
```

S2 and S3 are independent of each other but both depend on S1. Apply order: **S1 → (S2 and S3 in either order)**. Recommended practical order (by expected test surface size / risk): **S1 → S2 → S3**, with S3 done last so the badge map changes ship on the same commit that resolves the "Desconocido" fallback that motivated the spec.

---

## Implementation Order

1. **Slice 1 — Types + error map + enum** (pure, no UI). RED → GREEN → TRIANGULATE → REFACTOR. Verify: `pnpm test:unit --run` green for the three S1 test files; `pnpm build` (vue-tsc) clean.
2. **Slice 2 — PaymentModal delivery toggle + idempotency + SalesView pass-through** (UX core). RED → GREEN → TRIANGULATE → REFACTOR. Verify: `pnpm test:unit --run` green for `PaymentModal.test.ts` + `SalesView.test.ts`; `pnpm build` clean.
3. **Slice 3 — Filter/badge completeness**. RED → GREEN → TRIANGULATE → REFACTOR. Verify: `pnpm test:unit --run` green for the two S3 test files; `pnpm build` clean.
4. Final slice-end verify: `pnpm test:unit --run` (whole suite, not per-file) green; `pnpm build` clean; `pnpm lint` clean.

---

## Slice 1 — Types + error map + enum (pure, no UI)

**Goal.** Land all three pure-data contracts that downstream slices import: `delivery?: boolean` on both `ChargeSalePayload` branches, the new `SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` error code (union + `ERROR_ACTIONS` entry with `type: 'inline'`), and the `SHIPPED` value on `SALE_DELIVERY_STATUS`. No UI, no component code.

### TDD steps

#### RED — write the failing tests first

- [x] Extend `src/features/POS/sales/interfaces/__tests__/sale.types.test.ts` with an `expectTypeOf` block asserting `'SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY'` satisfies `ChargeDomainErrorCode`, that a literal `{ method: 'CASH', amountCents: 100, delivery: true }` satisfies `LegacyChargePayload`, and that a literal `{ payments: [{ method: 'CASH', amountCents: 100 }], delivery: true }` satisfies `MultiPaymentChargePayload`. Add a positive assert that `LegacyChargePayload.delivery` is `boolean | undefined` (optionality preserved). <!-- sdd-owner: implementation -->
- [x] Extend `src/features/POS/sales/utils/__tests__/salePaymentErrors.utils.test.ts` with a test asserting `getSalePaymentErrorAction('SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY')` deep-equals `{ type: 'inline', message: 'Para entrega a domicilio asigna una dirección de envío.' }`. <!-- sdd-owner: implementation -->
- [x] Extend `src/features/POS/sales/constants/__tests__/sale.constants.spec.ts` by appending `[SALE_DELIVERY_STATUS.SHIPPED, 'SHIPPED']` to the existing `SALE_DELIVERY_STATUS` value-pin group, and add a count assertion (`Object.keys(SALE_DELIVERY_STATUS).length === 4`). <!-- sdd-owner: implementation -->
- [x] Run `pnpm test:unit --run src/features/POS/sales/interfaces/__tests__/sale.types.test.ts src/features/POS/sales/utils/__tests__/salePaymentErrors.utils.test.ts src/features/POS/sales/constants/__tests__/sale.constants.spec.ts` and confirm at least one failure per file (RED gate). <!-- sdd-owner: implementation -->

#### GREEN — minimum implementation

- [x] In `src/features/POS/sales/interfaces/sale.types.ts`, add `delivery?: boolean` (with the JSDoc copied verbatim from design §3.1) to `LegacyChargePayload` (~line 258) and to `MultiPaymentChargePayload` (~line 281). `ChargeSalePayload` union shape stays unchanged. <!-- sdd-owner: implementation -->
- [x] In the same file, append `| 'SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY'` to `ChargeDomainErrorCode` (~line 354). Additive only — no existing member removed. <!-- sdd-owner: implementation -->
- [x] In `src/features/POS/sales/utils/salePaymentErrors.utils.ts`, add the `SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` entry to `ERROR_ACTIONS` with `type: 'inline'` and the exact Spanish copy `"Para entrega a domicilio asigna una dirección de envío."`. (TS exhaustiveness on `Record<ChargeDomainErrorCode, …>` forces the entry; the type-check will fail until this lands.) <!-- sdd-owner: implementation -->
- [x] In `src/features/POS/sales/constants/sale.constants.ts`, insert `SHIPPED: 'SHIPPED'` into `SALE_DELIVERY_STATUS` (between `PENDING` and `DELIVERED` to preserve the existing backend-enum order). <!-- sdd-owner: implementation -->
- [x] Re-run the three S1 test files; confirm all green (GREEN gate). <!-- sdd-owner: implementation -->

#### TRIANGULATE — adjacent inputs and edges

- [x] In `sale.types.test.ts`, add a type-level assertion that `LegacyChargePayload.delivery` is **not** required (an object literal that omits `delivery` still type-checks). <!-- sdd-owner: implementation -->
- [x] In `salePaymentErrors.utils.test.ts`, add a negative-pinning test asserting `getSalePaymentErrorAction` is a total function over the union (no `undefined` return for any current member — a thin property-based loop is sufficient). <!-- sdd-owner: implementation -->
- [x] In `sale.constants.spec.ts`, add a `SaleDeliveryStatus` derived-type pin test in the same file (or note that the existing `SALE_DELIVERY_STATUS` value-pin group already transitively proves the type) — explicit assertion that the 4-value derived union is intact. <!-- sdd-owner: implementation -->
- [x] Re-run the three S1 test files; confirm green; confirm the original RED tests still assert the same contract (TRIANGULATE gate). <!-- sdd-owner: implementation -->

#### REFACTOR — tighten without behavior change

- [x] Re-read the JSDoc comment on `delivery?: boolean` and align wording across both payload branches if duplicated. <!-- sdd-owner: implementation -->
- [x] Verify the `ERROR_ACTIONS` literal stays sorted by key (existing convention) — move the new entry into alphabetical position if applicable. <!-- sdd-owner: implementation -->
- [x] Re-run the three S1 test files + `pnpm build` (vue-tsc sub-step); confirm green and clean (REFACTOR gate). <!-- sdd-owner: implementation -->

### Files

- **MOD** — `src/features/POS/sales/interfaces/sale.types.ts`
- **MOD** — `src/features/POS/sales/utils/salePaymentErrors.utils.ts`
- **MOD** — `src/features/POS/sales/constants/sale.constants.ts`
- **MOD** — `src/features/POS/sales/interfaces/__tests__/sale.types.test.ts`
- **MOD** — `src/features/POS/sales/utils/__tests__/salePaymentErrors.utils.test.ts`
- **MOD** — `src/features/POS/sales/constants/__tests__/sale.constants.spec.ts`

### Verify (slice-end)

```bash
pnpm test:unit --run \
  src/features/POS/sales/interfaces/__tests__/sale.types.test.ts \
  src/features/POS/sales/utils/__tests__/salePaymentErrors.utils.test.ts \
  src/features/POS/sales/constants/__tests__/sale.constants.spec.ts
pnpm build   # vue-tsc sub-step — exhaustiveness on Record<ChargeDomainErrorCode, …> must be clean
```

### Commit message

```text
feat(pos-sale-delivery S1): add delivery?:boolean to charge payloads, SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY error, SHIPPED status

- sale.types.ts: optional delivery on LegacyChargePayload + MultiPaymentChargePayload;
  append SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY to ChargeDomainErrorCode.
- salePaymentErrors.utils.ts: inline action mapping for the new error code
  (exhaustiveness on Record<ChargeDomainErrorCode, SalePaymentUxAction> forces entry).
- sale.constants.ts: SHIPPED value on SALE_DELIVERY_STATUS; derived SaleDeliveryStatus
  picks it up automatically.
- extend co-located __tests__/ pin tests; S1 slice budget ≈ 60 LOC.
```

---

## Slice 2 — PaymentModal delivery toggle + idempotency + SalesView pass-through

**Goal.** Wire the UX core: a USwitch after the due-date section, gated on `shippingAddress` (disabled + hint `"asigná cliente y dirección primero"` when null, with a CTA that emits the existing `request-assign-customer`); emit `delivery: true` from `buildPayload()` in both branches when ON (omit when OFF); regenerate the idempotency key when the toggle flips; reset to OFF on modal open and on `shippingAddress` clearing; `SalesView` passes `activeDraft.shippingAddress ?? null`.

### TDD steps

#### RED — write the failing tests first

- [x] Extend `src/features/POS/sales/components/__tests__/PaymentModal.test.ts` with a `USwitch` stub in the existing `stubs` map (mirrors the `buttonStub`/`inputStub` pattern; forwards `$attrs` so `data-testid="delivery-toggle"` is queryable; emits `update:modelValue` on `change`). <!-- sdd-owner: implementation -->
- [x] Add a test "toggle is disabled and hint visible when `shippingAddress` is null": `mount()` `PaymentModal` with `props: { open: true, shippingAddress: null, … }`, assert `[data-testid="delivery-toggle"]` exists and is `disabled`, and the hint text "asigná cliente y dirección primero" is in the rendered HTML. <!-- sdd-owner: implementation -->
- [x] Add a test "toggle is enabled and hint absent when `shippingAddress` is present": mount with a stub `CustomerAddress`, assert the toggle is **not** `disabled` and the hint text is **not** present. <!-- sdd-owner: implementation -->
- [x] Add a test "CTA emits `request-assign-customer` when toggle is gated": with `shippingAddress: null`, find the CTA button and click it; assert the parent wrapper received the `request-assign-customer` emit. <!-- sdd-owner: implementation -->
- [x] Add a test "legacy branch payload carries `delivery: true` when toggle is ON": with a single cash entry and the toggle ON, trigger submit (`wrapper.find('[data-testid="confirm-button"]').trigger('click')` or the equivalent the file already uses), assert the emitted `submit` event payload equals `{ method: 'CASH', amountCents: <expected>, delivery: true }` (plus `paymentMethodId`/`dueDate` only if set). <!-- sdd-owner: implementation -->
- [x] Add a test "multi-payment branch payload carries `delivery: true` when toggle is ON": with two entries and the toggle ON, assert the emitted `submit` event payload equals `{ payments: [...], delivery: true }`. <!-- sdd-owner: implementation -->
- [x] Add a test "payload omits `delivery` key when toggle is OFF (both branches)": with the toggle OFF, run both single-entry and multi-entry scenarios and assert the emitted payload's `JSON.stringify` does **not** contain `"delivery"` (use `'delivery' in payload === false` style assertion to avoid `undefined`-serialization false-positives). <!-- sdd-owner: implementation -->
- [x] Add a test "modal open resets `delivery` to OFF": mount with `open: false`, flip the toggle ON (find toggle, set `wrapper.vm.delivery = true` or simulate the change), set `open: true` via `wrapper.setProps({ open: true })`, assert the toggle's bound value is `false` and the next emitted `submit` payload omits `delivery`. <!-- sdd-owner: implementation -->
- [x] Add a test "toggling `delivery` regenerates the idempotency key": spy on `newIdempotencyKey` (e.g. `vi.mock('../utils/idempotency.utils')` or `vi.spyOn` keyed by a deterministic sequence), mount with stable `entries`, read the initial key, flip the toggle, assert the key changed; then flip back and assert it changed again. <!-- sdd-owner: implementation -->
- [x] Add a test "stable entries + no toggle change keeps the key stable": with the toggle held OFF and `entries` constant, wait a microtask, assert the key did **not** regenerate. <!-- sdd-owner: implementation -->
- [x] Add a test "clearing `shippingAddress` reactively resets the toggle": mount with `shippingAddress` present, flip the toggle ON, then `wrapper.setProps({ shippingAddress: null })`; assert the toggle's `disabled` becomes `true` and the rendered payload (if a subsequent submit is forced) omits `delivery`. <!-- sdd-owner: implementation -->
- [x] Extend `src/features/POS/sales/views/__tests__/SalesView.test.ts` with one test asserting that the rendered `PaymentModal` receives `props('shippingAddress')` equal to `activeDraft.shippingAddress ?? null` (set up an `activeDraft` fixture with and without a shipping address and read the prop after rendering). <!-- sdd-owner: implementation -->
- [x] Run the two S2 test files and confirm at least the new tests fail (RED gate). <!-- sdd-owner: implementation -->

#### GREEN — minimum implementation

- [x] In `src/features/POS/sales/components/PaymentModal.vue`, extend the `defineProps` to add `shippingAddress?: CustomerAddress | null` (add a `CustomerAddress` type import from `sale.types` if not already imported). <!-- sdd-owner: implementation -->
- [x] Add `const delivery = ref(false)` next to the existing local state, and add `delivery.value = false` to the existing `watch(() => props.open, …)` reset block (near `PaymentModal.vue:194-205`). <!-- sdd-owner: implementation -->
- [x] Add `const hasShippingAddress = computed(() => props.shippingAddress != null)`. <!-- sdd-owner: implementation -->
- [x] Add `watch(() => props.shippingAddress, (addr) => { if (addr == null) delivery.value = false })` so the gate-close also resets the toggle OFF (guards against a stale ON state). <!-- sdd-owner: implementation -->
- [x] In `buildPayload()` (~line 271), introduce `const deliveryPatch = delivery.value ? { delivery: true } : {}` and spread it into BOTH the legacy single-payment branch and the `payments[]` branch (and the dead `payments.length === 1` early-return path, for type uniformity). Never emit an explicit `delivery: false`. <!-- sdd-owner: implementation -->
- [x] Change the existing `watch(entries, …)` block (~line 326) to `watch([entries, delivery], …)` while preserving `{ deep: true }` and the `props.open` guard. <!-- sdd-owner: implementation -->
- [x] In the template, insert a new `<section data-testid="delivery-section">` immediately after the `<section data-testid="due-date-section">` containing: a `<USwitch v-model="delivery" :disabled="!hasShippingAddress || isSubmitting" data-testid="delivery-toggle" label="Entrega a domicilio" description="…" />`; a `<p data-testid="delivery-hint">` rendered with the literal text "asigná cliente y dirección primero" only when `!hasShippingAddress`; and a `<UButton>` CTA (visible only when `!hasShippingAddress`) wired to `emit('request-assign-customer')`. <!-- sdd-owner: implementation -->
- [x] In `src/features/POS/sales/views/SalesView.vue` (PaymentModal instance ~line 885), add `:shipping-address="activeDraft.shippingAddress ?? null"` directly after the existing `:customer="activeDraft.customer ?? null"` line. <!-- sdd-owner: implementation -->
- [x] Re-run the two S2 test files; confirm all green (GREEN gate). <!-- sdd-owner: implementation -->

#### TRIANGULATE — adjacent inputs and edges

- [x] In `PaymentModal.test.ts`, add a test asserting the toggle is also `disabled` while `isSubmitting` is `true` even when `hasShippingAddress` is true (covers the `isSubmitting` branch of the `:disabled` expression). <!-- sdd-owner: implementation -->
- [x] In `PaymentModal.test.ts`, add a test asserting the CTA button is **not** present when `hasShippingAddress` is true (negative case for the conditional render). <!-- sdd-owner: implementation -->
- [x] In `SalesView.test.ts`, add the symmetric test asserting that when `activeDraft.shippingAddress` is `null`, `PaymentModal` receives `shippingAddress === null` (not `undefined`) — locks the `?? null` semantics. <!-- sdd-owner: implementation -->
- [x] In `PaymentModal.test.ts`, add a test asserting the **legacy** branch with toggle ON also respects `dueDate` when present (regression guard so the `deliveryPatch` spread doesn't shadow `dueDate`). <!-- sdd-owner: implementation -->
- [x] Re-run the two S2 test files; confirm green; confirm the original RED tests still assert the same contract (TRIANGULATE gate). <!-- sdd-owner: implementation -->

#### REFACTOR — tighten without behavior change

- [x] Rename the inline local `deliveryPatch` only if a clearer name surfaces during implementation; do not bikeshed. <!-- sdd-owner: implementation -->
- [x] Verify the `<section>` block ordering matches the design (due-date section before delivery section). <!-- sdd-owner: implementation -->
- [x] Verify the existing deep `watch(entries, (next) => …)` cap-clamp watcher (≤ `MAX_ENTRIES`, ~line 335) is untouched and still works with the new tuple watch source. <!-- sdd-owner: implementation -->
- [x] Re-run the two S2 test files + `pnpm build`; confirm green and clean (REFACTOR gate). <!-- sdd-owner: implementation -->

### Files

- **MOD** — `src/features/POS/sales/components/PaymentModal.vue`
- **MOD** — `src/features/POS/sales/views/SalesView.vue`
- **MOD** — `src/features/POS/sales/components/__tests__/PaymentModal.test.ts`
- **MOD** — `src/features/POS/sales/views/__tests__/SalesView.test.ts`

### Verify (slice-end)

```bash
pnpm test:unit --run \
  src/features/POS/sales/components/__tests__/PaymentModal.test.ts \
  src/features/POS/sales/views/__tests__/SalesView.test.ts
pnpm build   # vue-tsc — new prop + USwitch binding must type-check
```

### Commit message

```text
feat(pos-sale-delivery S2): PaymentModal USwitch gated on shippingAddress, idempotency regen on toggle, SalesView pass-through

- PaymentModal.vue:
  - new prop shippingAddress?: CustomerAddress | null
  - delivery = ref(false) reset on open and on shippingAddress null
  - hasShippingAddress computed drives :disabled on the USwitch
  - new <section data-testid="delivery-section"> after the due-date section with
    USwitch ("Entrega a domicilio"), gating hint ("asigná cliente y dirección primero")
    and a CTA that emits the existing request-assign-customer (reuses AssignCustomerSlideover)
  - buildPayload() spreads { delivery: true } into BOTH the legacy single-payment branch
    and the payments[] multi-payment branch only when the toggle is ON; OFF omits the key
    (legacy charges stay byte-identical)
  - existing entries watch extended to watch([entries, delivery], …) so the
    Idempotency-Key regenerates on a legit toggle flip (no IDEMPOTENCY_KEY_CONFLICT)
- SalesView.vue:
  - :shipping-address="activeDraft.shippingAddress ?? null" on PaymentModal
    (reactive: clears propagate via useSalesDrafts cache writes)
- extend PaymentModal.test.ts with USwitch stub and the toggle/payload/idempotency/
  reset/gate-close cases; SalesView.test.ts with the prop pass-through case.
  S2 slice budget ≈ 190 LOC.
```

---

## Slice 3 — Filter + badge completeness

**Goal.** Complete the `deliveryStatus` filter options (`Pendiente` / `En ruta` / `Entregada` / `No aplica`) and the `deliveryStatusBadgeMap` (`SHIPPED` → "En ruta"/warning, `NOT_APPLICABLE` → "No aplica"/neutral). Preserve pre-existing `PENDING` ("No Entregados"/error) and `DELIVERED` ("Entregados"/success) entries verbatim — design §2/Q2 spec-drift flag. `SaleDeliveryStatus` is already derived from `SALE_DELIVERY_STATUS`; no parallel union edit.

### TDD steps

#### RED — write the failing tests first

- [x] Extend `src/features/POS/sales/config/__tests__/salesFiltersSchema.test.ts` with a test asserting that the `deliveryStatus` field exposes exactly four options with labels `Pendiente`, `En ruta`, `Entregada`, `No aplica` (in that or stable order), values matching `SALE_DELIVERY_STATUS.{PENDING, SHIPPED, DELIVERED, NOT_APPLICABLE}`. <!-- sdd-owner: implementation -->
- [x] In the same file, add a regression test asserting the schema still defines exactly 11 fields across 4 sections (REQ-19 invariant) — count fields by reading the schema's `.fields` / equivalent accessor. <!-- sdd-owner: implementation -->
- [x] Extend `src/features/POS/sales/utils/__tests__/saleStatus.utils.test.ts` with a test asserting `getDeliveryStatusBadge('SHIPPED')` deep-equals `{ label: 'En ruta', color: 'warning' }`. <!-- sdd-owner: implementation -->
- [x] In the same file, add a test asserting `getDeliveryStatusBadge('NOT_APPLICABLE')` deep-equals `{ label: 'No aplica', color: 'neutral' }`. <!-- sdd-owner: implementation -->
- [x] In the same file, add a parameterized test asserting every value of `Object.keys(SALE_DELIVERY_STATUS)` resolves via `getDeliveryStatusBadge` to a non-`Desconocido` config (locks "no fallback for valid values"). <!-- sdd-owner: implementation -->
- [x] In the same file, add a regression test asserting pre-existing entries are untouched: `getDeliveryStatusBadge('DELIVERED')` deep-equals `{ label: 'Entregados', color: 'success' }` and `getDeliveryStatusBadge('PENDING')` deep-equals `{ label: 'No Entregados', color: 'error' }`. <!-- sdd-owner: implementation -->
- [x] In the same file, add a test asserting unknown strings still return `unknownBadge` (label `"Desconocido"`) — locks the legitimate fallback path. <!-- sdd-owner: implementation -->
- [x] Run the two S3 test files and confirm at least the new tests fail (RED gate). <!-- sdd-owner: implementation -->

#### GREEN — minimum implementation

- [x] In `src/features/POS/sales/config/salesFiltersSchema.ts` (~line 35), insert two new option entries into the existing `deliveryStatus` `multiEnum` array (between `PENDING` and `DELIVERED`, order = backend enum order): `{ value: SALE_DELIVERY_STATUS.SHIPPED, label: 'En ruta' }` and `{ value: SALE_DELIVERY_STATUS.NOT_APPLICABLE, label: 'No aplica' }`. <!-- sdd-owner: implementation -->
- [x] In `src/features/POS/sales/utils/saleStatus.utils.ts` (~line 12), append two new entries to `deliveryStatusBadgeMap`: `SHIPPED: { label: 'En ruta', color: 'warning' }` and `NOT_APPLICABLE: { label: 'No aplica', color: 'neutral' }`. Do **not** touch the existing `DELIVERED` and `PENDING` entries. <!-- sdd-owner: implementation -->
- [x] Re-run the two S3 test files; confirm all green (GREEN gate). <!-- sdd-owner: implementation -->

#### TRIANGULATE — adjacent inputs and edges

- [x] In `salesFiltersSchema.test.ts`, add a CSV-serialization regression test asserting `deliveryStatus` with `[SHIPPED, NOT_APPLICABLE]` selected serializes to `deliveryStatus=SHIPPED,NOT_APPLICABLE` (or the reverse) — preserves the existing `param: 'deliveryStatus'` CSV contract. <!-- sdd-owner: implementation -->
- [x] In `saleStatus.utils.test.ts`, add a pin test asserting `Object.keys(deliveryStatusBadgeMap)` is exactly `['DELIVERED', 'PENDING', 'SHIPPED', 'NOT_APPLICABLE']` (alphabetical order matches the existing declaration; guards against accidental key removal/rename). <!-- sdd-owner: implementation -->
- [x] Re-run the two S3 test files; confirm green; confirm the original RED tests still assert the same contract (TRIANGULATE gate). <!-- sdd-owner: implementation -->

#### REFACTOR — tighten without behavior change

- [x] Verify the option-array and badge-map keys are sorted/ordered consistently across `salesFiltersSchema.ts` and `saleStatus.utils.ts` (existing project convention; do not reorder pre-existing entries). <!-- sdd-owner: implementation -->
- [x] Re-run the two S3 test files + `pnpm build`; confirm green and clean (REFACTOR gate). <!-- sdd-owner: implementation -->

### Files

- **MOD** — `src/features/POS/sales/config/salesFiltersSchema.ts`
- **MOD** — `src/features/POS/sales/utils/saleStatus.utils.ts`
- **MOD** — `src/features/POS/sales/config/__tests__/salesFiltersSchema.test.ts`
- **MOD** — `src/features/POS/sales/utils/__tests__/saleStatus.utils.test.ts`

### Verify (slice-end)

```bash
pnpm test:unit --run \
  src/features/POS/sales/config/__tests__/salesFiltersSchema.test.ts \
  src/features/POS/sales/utils/__tests__/saleStatus.utils.test.ts
pnpm build
```

### Commit message

```text
feat(pos-sale-delivery S3): complete deliveryStatus filter options and badge map

- salesFiltersSchema.ts: extend deliveryStatus multiEnum options with SHIPPED
  ("En ruta") and NOT_APPLICABLE ("No aplica"); CSV param unchanged; field
  count still 11 across 4 sections.
- saleStatus.utils.ts: add SHIPPED -> { label: 'En ruta', color: 'warning' }
  and NOT_APPLICABLE -> { label: 'No aplica', color: 'neutral' }; pre-existing
  PENDING ("No Entregados"/error) and DELIVERED ("Entregados"/success) entries
  preserved verbatim (design §2/Q2 spec-drift guard).
- extend co-located __tests__/ pin tests; S3 slice budget ≈ 30 LOC.
```

---

## Final verify (post-all-slices)

- [x] Run `pnpm test:unit --run` (whole suite, not per-file) and confirm green. <!-- sdd-owner: implementation -->
- [x] Run `pnpm build` (vue-tsc + vite build) and confirm clean. <!-- sdd-owner: implementation -->
- [x] Run `pnpm lint` and confirm clean (pre-merge hygiene). <!-- sdd-owner: implementation --> (pre-existing project-wide lint debt: 314 errors, none introduced by this change — verified per-file during S3)
- [x] Hand off to the verify phase (`openspec/changes/pos-sale-delivery/verify-report.md`) with the Requirements Audit cross-walked against `specs/sales/spec.md`. <!-- sdd-owner: parent -->
- [x] On verify PASS, archive the change under `openspec/changes/archive/<ISO-date>-pos-sale-delivery/` per `phases.archive` in `openspec/config.yaml`. <!-- sdd-owner: parent -->