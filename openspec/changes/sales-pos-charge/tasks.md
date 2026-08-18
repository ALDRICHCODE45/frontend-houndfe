# Tasks: sales-pos-charge

> Gap-closure + reconciliation change. Five work units; one PR to `main`. Pre-PR build (`pnpm build`) is authoritative.

## Preamble

**Strategy**: `single-pr` → branch `feat/sales-pos-charge` → merge to `main` at end.
**Review budget**: 400 changed lines per WU (default); **WU-B explicitly requests `size:exception` (~450 lines, justified by 4 new files + 1 view mount + 4 test files for net-new reference-edit UI surface)**.

### WU ordering dependency

WU-A **must complete first** because it introduces `paymentId` (REQ-NEW-6), `ReferenceUpdateError` (REQ-NEW-7), `UpdatePaymentReferencePayload` (REQ-NEW-1), and the renamed enum codes (`SALE_FULLY_PAID`, dropped `REFERENCE_REQUIRED`/`SELLER_NOT_ASSIGNABLE`) that WU-B consumes. Single-PR doesn't enforce commit-order at merge (CI runs all tests), but the conceptual dependency must be respected at commit time so each commit is independently type-checkable.

1. **WU-A** — types + API stub + error-code reconciliation (~200 lines)
2. **WU-B** — reference-edit UI (depends on WU-A; ~450 lines → `size:exception`)
3. **WU-C** — `reference` optional in modals (independent of WU-B; can land in any order after WU-A)
4. **WU-D** — "Pagos Pendientes" tab (independent; can land after WU-A)
5. **WU-E** — dead code cleanup (independent; can land any time after WU-A)

### Verification gate per WU

`pnpm type-check && pnpm test:unit && pnpm lint` must be green before moving on. Authoritative build (`pnpm build`) at the end of all WUs.

### Commit strategy

Per-WU conventional commits (one WU = one commit, or one WU = one squash-merge of multiple atomic commits if implementer prefers):

- `feat(sales): <description>` for new behavior
- `fix(sales): <description>` for error-code renames/removals
- `test(sales): <description>` for new tests-only commits
- `chore(sales): <description>` for dead-code deletion

### Skill conventions

- New components use `<script setup lang="ts">` Composition API (vue-best-practices).
- New components split on responsibility: `PaymentsListSection` (presentational list) vs `EditReferenceSlideover` (composable + toasts) — D6.
- All Nuxt UI component tests use `src/test/mountWithUApp.ts`.

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~830 lines (cumulative across 5 WUs) |
| 400-line budget risk | **Low per WU** (A~200, B~450, C~80, D~100, E~0) — single-PR total exceeds 400, but per-WU budgets hold |
| Chained PRs recommended | No |
| Suggested split | Single PR with 5 conventional commits |
| Delivery strategy | single-pr |
| Chain strategy | size-exception (WU-B only) |
| Decision needed before apply | No |
| Chained PRs recommended | No |
| Chain strategy | size-exception |
| 400-line budget risk | Low |

> Per-WU 400-line ceiling: 4 of 5 WUs sit under 400. WU-B (~450) requires `size:exception` and is justified in B's preamble. Cumulative single-PR size (~830) is the inherent cost of a single-PR gap-closure; splitting into chained PRs would force half-baked UI in main (B alone is unusable without A).

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| A | Types + error-code reconciliation | PR 1 (part of single-PR) | `pnpm type-check && pnpm test:unit` | N/A (pure types + error maps; no UI) | Revert commit; consumer-coupled renames are atomic |
| B | Net-new reference-edit UI surface | PR 1 (part of single-PR) | `pnpm test:unit src/features/POS/sales/{components,composables,api}` | Manual: edit reference in detail view → 200 OK | Delete `PaymentsListSection.vue` + `EditReferenceSlideover.vue` + `useUpdatePaymentReference.ts`; revert `sale.api.ts` patch |
| C | `reference` optional in modals | PR 1 (part of single-PR) | `pnpm test:unit src/features/POS/sales/components/{PaymentModal,DebtPaymentModal}` | Manual: charge w/o reference → 200 OK | Revert 3 files; reference becomes required again |
| D | "Pagos Pendientes" tab | PR 1 (part of single-PR) | `pnpm test:unit src/features/POS/sales/{components/SalesListTabs,composables/useConfirmedSales}` | Manual: click tab → list re-queries with `paymentStatus=PARTIAL,CREDIT` | Revert 2 files; tab removed |
| E | Dead-code cleanup | PR 1 (part of single-PR) | `pnpm type-check && grep -rn "SaleDetailHeader\|components/payments" src/ --include="*.{ts,vue}"` | N/A (file deletions only) | `git checkout HEAD~1 -- src/features/POS/sales/components/SaleDetailHeader.vue src/features/POS/sales/components/payments/` |

---

## WU-A — Types + API stub + error codes (~200 lines)

### Goal
Establish the type/API/error-code foundation that WU-B builds on. No net-new UI in this WU. All WU-B consumers depend on these types being present.

### Sub-tasks

#### A.1 — `SaleDetailPayment.paymentId` (REQ-NEW-6)
- [x] Open `src/features/POS/sales/interfaces/sale.types.ts:128-135`
- [x] Add `paymentId: string` to `SaleDetailPayment` interface (required, non-null). Place before `method` for visual grouping.
- [x] Add JSDoc citing backend contract §7.4.

#### A.2 — `ChargeDomainErrorCode` reconciliation (REQ-NEW-11, REQ-NEW-12)
- [x] Open `src/features/POS/sales/interfaces/sale.types.ts:298-317`
- [x] Remove `'REFERENCE_REQUIRED'` from the union (line 302)
- [x] Add `'PAYMENT_AMOUNT_INSUFFICIENT'` to the union (REQ-NEW-12)

#### A.3 — `SaleDueDateErrorCode` rename (REQ-NEW-13)
- [x] Open `src/features/POS/sales/interfaces/sale.types.ts:402`
- [x] Rename `'SALE_ALREADY_PAID'` → `'SALE_FULLY_PAID'`

#### A.4 — `SellerAssignmentErrorCode` trim (REQ-NEW-14)
- [x] Open `src/features/POS/sales/interfaces/sale.types.ts:384`
- [x] Remove `'SELLER_NOT_ASSIGNABLE'` from the union

#### A.5 — `UpdatePaymentReferencePayload` type export (REQ-NEW-1)
- [x] In `src/features/POS/sales/interfaces/sale.types.ts`, add and export: `export interface UpdatePaymentReferencePayload { reference: string | null }`
- [x] Co-locate with `PaymentEntry` / `MultiPaymentChargePayload` for grouping.

#### A.6 — Error mapping updates (`src/features/POS/sales/utils/salePaymentErrors.utils.ts`)
- [x] Add `PAYMENT_AMOUNT_INSUFFICIENT` entry to `ERROR_ACTIONS` (line 10): `{ type: 'inline', message: 'Agregá un pago en efectivo o ajustá los montos para cubrir el total' }`
- [x] Remove `REFERENCE_REQUIRED` entry from `ERROR_ACTIONS`
- [x] Verify the `Record<ChargeDomainErrorCode, ...>` still type-checks (it MUST, since we kept union + map in sync).

#### A.7 — Consumer update for `SALE_FULLY_PAID` rename (REQ-NEW-13)
- [x] `src/features/POS/sales/composables/useSaleDueDate.ts:17` — replace `SALE_ALREADY_PAID` with `SALE_FULLY_PAID` in `KNOWN_CODES`
- [x] `src/features/POS/sales/components/DueDateEditModal.vue:68` — update switch case label
- [x] `src/features/POS/sales/composables/__tests__/useSaleDueDate.test.ts:96` — update codes array literal: `['INVALID_DUE_DATE', 'SALE_FULLY_PAID', 'SALE_NOT_FOUND', 'SALE_UPDATE_FORBIDDEN']`

#### A.8 — Consumer update for `SELLER_NOT_ASSIGNABLE` removal (REQ-NEW-14)
- [x] `src/features/POS/sales/composables/useSellerAssignment.ts:17` — remove `SELLER_NOT_ASSIGNABLE` from `KNOWN_CODES`
- [x] `src/features/POS/sales/components/AssignSellerSlideover.vue:71-72` — delete the dead `case 'SELLER_NOT_ASSIGNABLE':` branch (and its `break`/fallthrough)
- [x] `src/features/POS/sales/composables/__tests__/useSellerAssignment.test.ts:105` — update codes array: `['SELLER_NOT_FOUND', 'SALE_NOT_FOUND', 'SALE_UPDATE_FORBIDDEN']`
- [x] `src/features/POS/sales/components/__tests__/AssignSellerSlideover.spec.ts:148` — delete the line `assignSellerMock.mockRejectedValueOnce(new SellerAssignmentError('SELLER_NOT_ASSIGNABLE'))` and the surrounding test case that only asserts that branch

#### A.9 — API stub for `updatePaymentReference` (placeholder for WU-B)
- [x] In `src/features/POS/sales/api/sale.api.ts`, declare the function signature in the `saleApi` object (find the PATCH cluster around `setDueDate` ~L170, `updateComment` ~L244):
  ```ts
  async updatePaymentReference(
    saleId: string,
    paymentId: string,
    payload: UpdatePaymentReferencePayload,
  ): Promise<UpdatedPaymentReference> {
    throw new Error('WU-A stub — implement in WU-B')
  }
  ```
- [x] Add `UpdatePaymentReferencePayload` and `UpdatedPaymentReference` to the import block at the top (line 3-29)
- [x] Define `UpdatedPaymentReference` type in `sale.types.ts` alongside `DebtPaymentResponse`: `{ paymentId: string; method: SaleDetailPaymentMethod; amountCents: number; reference: string | null; paidAt: string }`

### Files modified

- `src/features/POS/sales/interfaces/sale.types.ts`
- `src/features/POS/sales/utils/salePaymentErrors.utils.ts`
- `src/features/POS/sales/composables/useSaleDueDate.ts`
- `src/features/POS/sales/components/DueDateEditModal.vue`
- `src/features/POS/sales/composables/__tests__/useSaleDueDate.test.ts`
- `src/features/POS/sales/composables/useSellerAssignment.ts`
- `src/features/POS/sales/components/AssignSellerSlideover.vue`
- `src/features/POS/sales/composables/__tests__/useSellerAssignment.test.ts`
- `src/features/POS/sales/components/__tests__/AssignSellerSlideover.spec.ts`
- `src/features/POS/sales/api/sale.api.ts` (stub only)

### Files NOT modified in WU-A (deferred)

- `PaymentModal.vue` (WU-C)
- `DebtPaymentModal.vue` (WU-C — only the validate cascade changes; file itself untouched)
- `paymentEntries.utils.ts` (WU-C)
- `SalesListTabs.vue` (WU-D)
- `useConfirmedSales.ts` (WU-D)
- `SaleDetailView.vue` (WU-B mount)
- All WU-B new components/composables

### Tests

- UPDATE: `useSaleDueDate.test.ts:96` (codes array)
- UPDATE: `useSellerAssignment.test.ts:105` (codes array)
- UPDATE: `AssignSellerSlideover.spec.ts:148` (delete case)
- UPDATE: `salePaymentErrors.utils.test.ts:7` (drop `REFERENCE_REQUIRED` row; add `PAYMENT_AMOUNT_INSUFFICIENT` row)
- UPDATE: `interfaces/__tests__/sale.types.test.ts:112-115` (replace the literal `ChargeDomainErrorCode` value tests — drop the `'REFERENCE_REQUIRED'` reference if present, add a `'PAYMENT_AMOUNT_INSUFFICIENT'` literal-type assertion)
- NEW: 1 literal-type-check test asserting `SaleDetailPayment` requires `paymentId` (REQ-NEW-6 scenario "omitting `paymentId` is a type error"). Place in `interfaces/__tests__/sale.types.test.ts`.

### Acceptance criteria

- [x] `pnpm type-check` green (all literal-type checks pass)
- [x] `pnpm test:unit` green (updated tests pass)
- [x] `pnpm lint` green
- [x] Grep verify: `grep -rn "SALE_ALREADY_PAID\|SELLER_NOT_ASSIGNABLE\|REFERENCE_REQUIRED" src/ --include="*.ts" --include="*.vue"` returns ZERO matches outside this task file
- [x] `updatePaymentReference` signature exists in `sale.api.ts` (stub body throws)
- [x] `UpdatedPaymentReference` type exported

### Verification

```bash
pnpm type-check && pnpm test:unit && pnpm lint
grep -rn "SALE_ALREADY_PAID\|SELLER_NOT_ASSIGNABLE\|REFERENCE_REQUIRED" src/ --include="*.ts" --include="*.vue"
```

---

## WU-B — Reference-edit UI (~450 lines, `size:exception` required)

### Goal
Implement the net-new reference-edit surface: PATCH endpoint wiring, mutation composable, `PaymentsListSection.vue`, `EditReferenceSlideover.vue`, mount in `SaleDetailView.vue`. The largest WU in this change; the only one to exceed the 400-line review budget.

### Size exception justification

| Component | ~Lines |
|-----------|--------|
| `sale.api.ts::updatePaymentReference` body (replace WU-A stub) | ~40 |
| `ReferenceUpdateError` class + `parseReferenceUpdateError` | ~30 |
| `useUpdatePaymentReference.ts` composable + test | ~120 |
| `PaymentsListSection.vue` + spec | ~120 |
| `EditReferenceSlideover.vue` + spec | ~80 |
| `SaleDetailView.vue` mount update + spec extension | ~30 |
| Integration scenario test (wire-level PATCH mock) | ~50 |
| **Total** | **~470** |

Justified because: this WU delivers 1 of the 5 deltas (Delta A — per-payment reference editing) entirely as net-new surface; no other WU can be merged independently and remain useful. Splitting would force half-baked UI in main. The work is bounded by a single PATCH endpoint + one slideover + one list component.

### Sub-tasks

#### B.1 — Complete `sale.api.ts::updatePaymentReference` (REQ-NEW-1, REQ-NEW-7)
- [x] Open `src/features/POS/sales/api/sale.api.ts`, find the WU-A stub
- [x] Replace stub body with real implementation using `http.patch<UpdatedPaymentReference>(\`/sales/${saleId}/payments/${paymentId}/reference\`, payload)`
- [x] Path: `/sales/${saleId}/payments/${paymentId}/reference`
- [x] Body: JSON `payload` (the `{ reference }` object)
- [x] Headers: NO `Idempotency-Key` (verify against existing PATCHes that don't carry it — `setDueDate` ~L170, `updateComment` ~L244, `deleteComment` ~L253)
- [x] Response parsing: return `data`
- [x] In the `try`/`catch` wrapper (mirror the `setDueDate` pattern in `useSaleDueDate.ts:38-42`):
  - On caught error: throw `parseReferenceUpdateError(error) ?? error`

#### B.2 — `ReferenceUpdateError` class + parse fn (REQ-NEW-7, design D1)
- [x] Create class in `src/features/POS/sales/api/sale.api.ts` beside `SalePdfError` (`:43`):
  ```ts
  export type ReferenceUpdateErrorCode =
    | 'ENTITY_NOT_FOUND'
    | 'SALE_UPDATE_FORBIDDEN'
    | 'NETWORK_ERROR'
  export class ReferenceUpdateError extends Error {
    readonly code: ReferenceUpdateErrorCode
    constructor(code: ReferenceUpdateErrorCode) {
      super(code)
      this.code = code
      this.name = 'ReferenceUpdateError'
    }
  }
  ```
- [x] Create `parseReferenceUpdateError(error: unknown): ReferenceUpdateError | null` near `parseCommentError` (`:73`); known codes array `[ENTITY_NOT_FOUND, SALE_UPDATE_FORBIDDEN]` (NETWORK_ERROR is reserved for explicit re-throw scenarios)
- [x] Wire it in `updatePaymentReference` (see B.1)

#### B.3 — `useUpdatePaymentReference` composable (REQ-NEW-2, REQ-NEW-7, design D3)
- [x] New file: `src/features/POS/sales/composables/useUpdatePaymentReference.ts`
- [x] Match the `MaybeRefOrGetter` pattern from `useSaleDueDate.ts:31`
- [x] Signature: `useUpdatePaymentReference(saleId: MaybeRefOrGetter<string>)`
- [x] `useMutation` config:
  - `mutationFn: ({ paymentId, payload }) => updatePaymentReference(toValue(saleId), paymentId, payload)`
  - `retry: 3` (TanStack default), BUT skip retry when `error instanceof ReferenceUpdateError` (404/403) — mirror the existing error-classification pattern from `useSaleDueDate.ts:50-52`
  - NO `mutationKey` (matches existing convention per design D3)
- [x] `onSuccess`: invalidate `saleQueryKeys.detail(useSafeTenantId(), toValue(saleId))` (verify the key factory at `src/core/shared/constants/query-keys.ts:65-87`)
- [x] `onError`: dispatch toast via `useToast()` (auto-imported) and re-fetch on 404:
  - `ReferenceUpdateError('ENTITY_NOT_FOUND')`: toast `"El pago ya no existe. Refrescando detalle..."` + `queryClient.invalidateQueries({ queryKey: saleQueryKeys.detail(tenantId.value, toValue(saleId)) })`
  - `ReferenceUpdateError('SALE_UPDATE_FORBIDDEN')`: toast `"No tenés permisos para editar la referencia"`
  - other: toast `"Error al actualizar la referencia"`

#### B.4 — `PaymentsListSection.vue` component (REQ-NEW-3, REQ-NEW-4, REQ-NEW-5)
- [x] New file: `src/features/POS/sales/components/PaymentsListSection.vue`
- [x] `<script setup lang="ts">` Composition API (vue-best-practices)
- [x] Props: `payments: SaleDetailPayment[]`, `loading?: boolean = false`
- [x] Render: one row per payment with columns: method (use existing `paymentMethodMeta` from `paymentMethodMeta.ts`), amount (`formatCents(p.amountCents)`), reference (truncate >20 chars with `UTooltip`), `paidAt` (use existing `formatSaleDate` from `saleDate.utils.ts`)
- [x] Edit affordance: `UButton` "Editar referencia" on rows where `shouldShowEditReference(p)` is true (B.6)
- [x] Local state: `editingPaymentId: Ref<string | null>` — owning component passes the slideover via props/emit per design D6 (the list section is presentational; the view owns the mutation)
- [x] Slideover: extract a sibling `EditReferenceSlideover.vue` (B.5). `PaymentsListSection` imports + renders it; receives `open`/`currentReference`/`paymentMethod` and emits `update:open` + `submit: { reference: string \| null }`
- [x] Empty state: when `payments.length === 0 && !loading`, render subtle `<p>Sin pagos registrados</p>` (NOT a placeholder card)
- [x] Loading state: skeleton rows via `USkeleton` (or match the project's existing skeleton pattern — read `SaleDetailItemsList.vue` for reference)
- [x] Test: `__tests__/PaymentsListSection.spec.ts` using `mountWithUApp`. Cover:
  - 3 rows render for 3 payments
  - Edit button visible for non-CASH
  - Edit button hidden for CASH
  - Empty state for 0 payments
  - Slideover opens on click

#### B.5 — `EditReferenceSlideover.vue` component (REQ-NEW-4, REQ-NEW-5)
- [x] New file: `src/features/POS/sales/components/EditReferenceSlideover.vue`
- [x] `<script setup lang="ts">` Composition API
- [x] Use `USlideover` from Nuxt UI
- [x] Props: `open: boolean`, `currentReference: string | null`, `paymentMethod: string`, `loading?: boolean = false`
- [x] Emits: `update:open`, `submit: { reference: string | null }`
- [x] Local state: `referenceInput: Ref<string>` pre-filled with `currentReference ?? ''`
- [x] Submit button: calls `normalizeReferenceInput(referenceInput.value)` then emits `submit` with the result
- [x] Cancel button: emits `update:open` with `false`
- [x] Clear button: sets `referenceInput` to `''` (then submit sends `null`)
- [x] Test: `__tests__/EditReferenceSlideover.spec.ts` using `mountWithUApp`. Cover:
  - Opens pre-filled with `currentReference`
  - Submit sends trimmed string
  - Submit with empty input sends `null`
  - Clear button works

#### B.6 — Extracted pure functions (3, no new test files unless needed)
- [x] `normalizeReferenceInput(raw: string | null | undefined): string | null | undefined` — add to `src/features/POS/sales/utils/paymentEntries.utils.ts` (alongside `validateEntry` at `:58`). Per design D8: trim → if empty string → `undefined`; else return trimmed. Used by `PaymentModal.buildPayload` (WU-C) and `EditReferenceSlideover` (WU-B).
  - NOTE: spec §5.5 says backend persists `null` for cleared; the slideover sends `null` (not `undefined`). The util's `undefined` return is the "omit the key" signal for the modal payload builders (WU-C).
- [x] `shouldShowEditReference(payment: SaleDetailPayment): boolean` — add to `src/features/POS/sales/utils/paymentMethodMeta.ts` (or a new file `src/features/POS/sales/utils/referenceEditAffordance.ts` if the import surface is cleaner). Returns `payment.method !== 'CASH' && !!payment.paymentId`.
- [x] `pendingPaymentsBadge(count: number): { visible: boolean; text: string | null }` — add to `src/features/POS/sales/utils/saleStatus.utils.ts` (or new file `salesListTabs.utils.ts`). Returns `{ visible: count > 0, text: count > 0 ? String(count) : null }`. Used by WU-D.
- [x] Tests for all 3 in their existing `__tests__/*.spec.ts` files (extract-before-mock: NO new test files if existing util files already have `__tests__` neighbors)

#### B.7 — Mount in `SaleDetailView.vue` (REQ-NEW-3)
- [x] Open `src/features/POS/sales/views/SaleDetailView.vue:398-412` (the `#pagos` slot)
- [x] Mount `<PaymentsListSection :payments="sale?.payments ?? []" :loading="isLoading" />` BETWEEN `SaleDetailTotalsCard` and the rest of the slot content
- [x] Wire `getById(saleId)` (already fetched) to feed the `payments` prop
- [x] Wire `useUpdatePaymentReference(saleId)` to handle the slideover submit: the section emits `submit`, the view calls the mutation
- [x] Test: extend `SaleDetailView.spec.ts` (if exists) with a scenario asserting `<PaymentsListSection>` renders when detail is loaded; if no spec exists, create one focused on the new mount

#### B.8 — Integration test (wire-level)
- [x] In `src/features/POS/sales/api/__tests__/sale.api.test.ts`: scenario test for `updatePaymentReference` (mock `http.patch`, assert PATCH path/body/no-Idempotency-Key, assert 404 → `ReferenceUpdateError`, assert 200 → returns parsed response)
- [x] In `src/features/POS/sales/composables/__tests__/useUpdatePaymentReference.test.ts` (new): scenario tests asserting:
  - `onSuccess` invalidates the detail query key (mock `queryClient.invalidateQueries`)
  - 404 → toast dispatched + re-fetch fires
  - 403 → permission toast dispatched
  - Network error → 3 retries then toast

### Files created

- `src/features/POS/sales/components/PaymentsListSection.vue`
- `src/features/POS/sales/components/EditReferenceSlideover.vue`
- `src/features/POS/sales/composables/useUpdatePaymentReference.ts`
- `src/features/POS/sales/composables/__tests__/useUpdatePaymentReference.test.ts`
- `src/features/POS/sales/components/__tests__/PaymentsListSection.spec.ts`
- `src/features/POS/sales/components/__tests__/EditReferenceSlideover.spec.ts`
- (optional) `src/features/POS/sales/utils/referenceEditAffordance.ts` — only if B.6 inline placement pollutes `paymentMethodMeta.ts`
- (optional) `src/features/POS/sales/utils/salesListTabs.utils.ts` — only if B.6 inline placement pollutes `saleStatus.utils.ts`

### Files modified

- `src/features/POS/sales/api/sale.api.ts` (replace WU-A stub with real impl + add `ReferenceUpdateError` + parse fn)
- `src/features/POS/sales/utils/paymentEntries.utils.ts` (add `normalizeReferenceInput`)
- `src/features/POS/sales/utils/paymentMethodMeta.ts` OR `utils/referenceEditAffordance.ts` (add `shouldShowEditReference`)
- `src/features/POS/sales/utils/saleStatus.utils.ts` OR `utils/salesListTabs.utils.ts` (add `pendingPaymentsBadge`)
- `src/features/POS/sales/views/SaleDetailView.vue` (mount PaymentsListSection + wire mutation)

### Acceptance criteria

- [x] All REQ-NEW-1 through REQ-NEW-7 scenarios pass their tests
- [x] `PaymentsListSection` renders in `SaleDetailView` only when detail is loaded (no flash on initial loading)
- [x] Slideover pre-fills correctly with `currentReference`
- [x] Submit string → backend persists string (200 OK mocked)
- [x] Submit empty → backend persists `null` (200 OK mocked)
- [x] 404 → toast + re-fetch works
- [x] 403 → permission toast works
- [x] Network errors retried 3x then toast
- [x] No `Idempotency-Key` header on the PATCH (verified by mock assertion)

### Verification

```bash
pnpm type-check && pnpm test:unit && pnpm lint
```

---

## WU-C — `reference` optional in charge + debt modals (~80 lines)

### Goal
Remove the reference-required validation in both `PaymentModal` and `DebtPaymentModal`. Wire `normalizeReferenceInput` so non-cash entries can submit without `reference`. Remove the obsolete `REFERENCE_REQUIRED` error code (already done in WU-A; verify here).

### Sub-tasks

#### C.1 — `paymentEntries.utils.ts::validateEntry` (REQ-NEW-9, REQ-NEW-10)
- [x] Open `src/features/POS/sales/utils/paymentEntries.utils.ts:65-70`
- [x] Remove the entire `if (entry.method !== PAYMENT_METHOD.CASH) { ... }` block that forces a non-empty reference
- [x] New rule: reference is allowed to be undefined for non-CASH entries; the entry passes validation as long as `amountCents >= 1`

#### C.2 — `PaymentModal.vue` validate() update (REQ-NEW-9)
- [x] Open `src/features/POS/sales/components/PaymentModal.vue:210-222`
- [x] Remove the reference-required block in `validate()` (likely mirrors `validateEntry`; if PaymentModal has its own validate logic, edit here)
- [x] Update `buildPayload()` (L243-258) to call `normalizeReferenceInput(reference)` for each non-CASH entry; if result is `undefined`, OMIT the `reference` key (NOT send `null`) — per design D8
- [x] Verify the legacy single-payment branch (`buildPayload` ~L247-255) does not reintroduce the required check

#### C.3 — `DebtPaymentModal.vue` wiring (REQ-NEW-10) — citation precision clarification

**The change lives at `paymentEntries.utils.ts:65-70` (C.1), NOT in `DebtPaymentModal.vue` itself.** The DebtPaymentModal submit boundary (`DebtPaymentModal.vue:127-130`, the `submitSafe({ payload: { payments: entries.value }, ... })` call) does NOT directly reference `reference` — it passes `entries.value` through. The cascade works because `canSubmit` (in the template) gates on `validateEntry(entries.value[i])` (the util in C.1).

- [x] Verify by reading `DebtPaymentModal.vue:1-150` that no direct edit is needed beyond the util change
- [x] If DebtPaymentModal has a parallel inline validate reference block (separate from `validateEntry`), edit it the same way as C.2
- [x] If `buildPayload`/`handleSubmit` need `normalizeReferenceInput` wiring (to OMIT the key when undefined), apply it here too — same pattern as C.2

#### C.4 — Tests
- [x] In `components/__tests__/PaymentModal.test.ts` (search for validate/payload tests around L249): add scenarios:
  - non-CASH entry with no `reference` → payload omits `reference` key, backend returns 200 OK (mocked)
  - non-CASH entry with `reference` set → payload includes trimmed `reference`
- [x] In `components/__tests__/DebtPaymentModal.test.ts` (search around L171): same scenarios
- [x] In `utils/__tests__/paymentEntries.utils.spec.ts:89-105` (or wherever `validateEntry` tests live): add cases:
  - non-CASH entry without `reference` → no error returned
  - non-CASH entry with empty-string `reference` → no error returned
  - CASH entry without `reference` → no error returned (unchanged)
- [x] In `utils/__tests__/paymentEntries.utils.spec.ts` (new section): add `normalizeReferenceInput` test cases:
  - `''` → `undefined`
  - `'  '` → `undefined`
  - `'  TRF-001  '` → `'TRF-001'`
  - `null` → `null` (passthrough — slideover uses this for clear)
  - `undefined` → `undefined` (passthrough)
- [x] Add a scenario test that exercises the `{payments: []}` credit path: entry-less submit (with customer assigned) still works, backend returns 200 OK with `paymentStatus: 'CREDIT'`

### Files modified

- `src/features/POS/sales/components/PaymentModal.vue`
- `src/features/POS/sales/utils/paymentEntries.utils.ts`
- (Possibly `DebtPaymentModal.vue` if its own validate/buildPayload needs the change — clarify in commit message)

### Acceptance criteria

- [x] Non-cash entry without reference → 200 OK (mocked)
- [x] `{payments: []}` credit path → 200 OK with CREDIT status (mocked)
- [x] `REFERENCE_REQUIRED` is no longer in `ChargeDomainErrorCode` or its action map (already done in WU-A; verify here with grep)
- [x] All existing PaymentModal/DebtPaymentModal tests still pass
- [x] `normalizeReferenceInput` test cases all pass

### Verification

```bash
pnpm type-check && pnpm test:unit && pnpm lint
grep -rn "REFERENCE_REQUIRED" src/ --include="*.ts" --include="*.vue"
```

---

## WU-D — "Pagos Pendientes" tab (~100 lines)

### Goal
Add the third quick-tab to the sales listing. Surface `counts.pendingPayments`. Filter by `paymentStatus=PARTIAL,CREDIT` (CSV per backend §6.1). REQ-19 invariant: SaleCard, PaymentMethodPills, salesFiltersSchema (11 fields, 4 sections), and every `#<id>-cell` slot remain unchanged.

### Sub-tasks

#### D.1 — `SalesListTabs.vue` third tab (REQ-NEW-8, MODIFIED REQ-19)
- [x] Open `src/features/POS/sales/components/SalesListTabs.vue:21-40`
- [x] Add a new tab BETWEEN "Todas" and "No Entregadas" (preserves REQ-19's no-highlight invariant by not changing existing tab positions)
- [x] Tab label: `"Pagos Pendientes"`
- [x] Use the `pendingPaymentsBadge(count)` pure fn (from WU-B.6): **badge renders iff `counts.pendingPayments > 0` (REQ-NEW-8 EXPLICIT); tab remains selectable at 0 (empty table state)**
- [x] Filter values when active: `{ paymentStatus: 'PARTIAL,CREDIT' }` (CSV per backend §6.1) — string, not array
- [x] Emit change with the new filter shape (existing emit widening per design D5: `{ deliveryStatus?: SaleDeliveryStatus; paymentStatus?: SalePaymentStatus[] }`). "Todas" clears both.

#### D.2 — `useConfirmedSales.ts` filter wiring
- [x] Open `src/features/POS/sales/composables/useConfirmedSales.ts:87,131,70-82`
- [x] Ensure `paymentStatus` filter is included in the tab-state-to-query-string conversion (mirror `resolveDeliveryStatus` at `:70-82` as `resolvePaymentStatus`)
- [x] Confirm `paymentStatus: 'PARTIAL,CREDIT'` (single CSV string) is correctly serialized to `?paymentStatus=PARTIAL,CREDIT` (NOT an array). Verify against backend §6.1 CSV contract.
- [x] Verify URL sync behavior matches codebase convention: per design D4 (verified) this repo uses `urlSync: false`, so the tab state is local-only. Document the deviation as an open question if needed (carry to PR description).

#### D.3 — Tests
- [x] Extend `composables/__tests__/useConfirmedSales.test.ts` (if exists) with scenarios:
  - "Pagos Pendientes" tab selected → query string includes `paymentStatus=PARTIAL,CREDIT`
  - Switching tabs preserves other filter values (customer, folio, dates, etc.)
  - Empty `counts.pendingPayments === 0` → tab renders without badge AND clicking it triggers the same query as a non-empty count
- [x] Extend `components/__tests__/SalesListTabs.spec.ts` (if exists) with:
  - 3 tabs render: Todas, Pagos Pendientes, No Entregadas (in that order)
  - Badge shows when `count > 0`
  - Badge hidden when `count === 0`
  - Tab click emits correct filter shape with `paymentStatus: 'PARTIAL,CREDIT'`

### Files modified

- `src/features/POS/sales/components/SalesListTabs.vue`
- `src/features/POS/sales/composables/useConfirmedSales.ts`

### Acceptance criteria

- [x] 3 tabs render in order: Todas, Pagos Pendientes, No Entregadas
- [x] **Badge renders iff `counts.pendingPayments > 0` (REQ-NEW-8 explicit); tab is selectable at 0 with empty table state**
- [x] Clicking the tab triggers a re-query with `paymentStatus=PARTIAL,CREDIT`
- [x] REQ-19 invariant preserved: `SaleCard`, `PaymentMethodPills`, `salesFiltersSchema` (11 fields, 4 sections), and every `#<id>-cell` slot remain unchanged
- [x] Other filter values are preserved when switching tabs

### Verification

```bash
pnpm type-check && pnpm test:unit && pnpm lint
```

---

## WU-E — Dead code cleanup (0 net lines, optional but recommended)

### Goal
Delete files that have zero non-test imports. Grep-verified safe per the exploration phase.

### Sub-tasks

#### E.1 — Delete files (REQ-NEW-15)
- [x] `rm src/features/POS/sales/components/SaleDetailHeader.vue` (orphaned; confirmed not imported — `SaleDetailView.vue:59` inlined it)
- [x] `rm src/features/POS/sales/components/payments/PaymentEntryCard.vue`
- [x] `rm src/features/POS/sales/components/payments/PaymentMethodTileGrid.vue`
- [x] `rm src/features/POS/sales/components/payments/PaymentTotalsRow.vue`
- [x] `rm src/features/POS/sales/components/payments/paymentMethod.config.ts`
- [x] `rm -r src/features/POS/sales/components/payments/__tests__/` (3 test files for the deleted components)
- [x] If `SaleDetailHeader.vue` has a sibling spec, delete it too
- [x] Verify no remaining references:
  ```bash
  grep -rn "SaleDetailHeader\|components/payments" src/ --include="*.ts" --include="*.vue"
  ```
  Returns ZERO non-test matches.

### Files deleted

- `src/features/POS/sales/components/SaleDetailHeader.vue` (+ its spec if exists)
- `src/features/POS/sales/components/payments/PaymentEntryCard.vue`
- `src/features/POS/sales/components/payments/PaymentMethodTileGrid.vue`
- `src/features/POS/sales/components/payments/PaymentTotalsRow.vue`
- `src/features/POS/sales/components/payments/paymentMethod.config.ts`
- `src/features/POS/sales/components/payments/__tests__/` (3 test files)

### Files NOT modified (preserved)

- `src/features/POS/sales/utils/paymentMethodMeta.ts` — LIVE, NOT to be deleted (exploration §3 explicitly marked it as the live meta source)

### Acceptance criteria

- [x] No remaining live imports
- [x] `pnpm type-check` green (no broken imports)
- [x] `pnpm test:unit` green (no orphan test references)

### Verification

```bash
pnpm type-check && pnpm test:unit
grep -rn "SaleDetailHeader\|components/payments" src/ --include="*.ts" --include="*.vue"
```

---

## Migration / Single-PR strategy

- **Branch**: `feat/sales-pos-charge`
- **Base**: `main` (current HEAD)
- **Commit strategy**: per-WU conventional commits. One WU = one commit minimum; multiple atomic commits acceptable (e.g., WU-B may split into B1-B2-B3, B4-B5-B6, B7-B8 if reviewer focus benefits).
  - `feat(sales): wire updatePaymentReference PATCH + types` (WU-A)
  - `feat(sales): add reference-edit UI surface` (WU-B)
  - `fix(sales): make reference optional in charge + debt modals` (WU-C)
  - `feat(sales): add Pagos Pendientes quick tab` (WU-D)
  - `chore(sales): remove dead payment components` (WU-E)
- **Pre-PR gate**: `pnpm build` (authoritative — runs `vue-tsc --build` + `vite build`) must be green
- **PR description must include**:
  - Headline reframe: gap-closure + reconciliation (not greenfield) — the FE already implements ~85% of the contract
  - Backend doc §5.1 staleness callout: FE stays multi-method (debt payment), do NOT "fix" to single-method
  - WU-B `size:exception` justification (~450 lines for net-new reference-edit surface; per-WU budget still respected)
  - Manual smoke checklist: charge w/o reference → 200 OK; reference edit persists; pending tab count + filter; `{payments: []}` credit path
  - Rollback: `git revert` of the merge commit; revert WU-A first if error renames are coupled to consumers
- **Post-merge**: sdd-archive phase syncs REQ-NEW-1..15 to canonical `openspec/specs/sales/spec.md` and replaces REQ-19 with the MODIFIED block

---

## Open questions for orchestrator / user (carry-forward, non-blocking)

1. **D4 URL sync deviation**: design chose `urlSync: false` for tab state (matches codebase convention). User may want shareable URLs. Document in PR description; revisit in a future change if requested.
2. **§5.1 doc staleness**: explicit note in PR description; document the divergence once and forget.
3. **Three method-config sources**: explicitly out of scope (exploration §4, design open questions); tech debt for a future change. Not addressed here.
4. **`ConfirmedSaleRow` nullability** (folio/paymentStatus/confirmedAt for DRAFT-filtered listings): flagged in exploration §4 but not addressed here. Type-unsoundness is latent; document if a future change touches this surface.

---

## Validator carry-over resolutions

1. **REQ-NEW-8 explicit constraint** — addressed in WU-D.1 (acceptance criterion) and WU-D acceptance criteria: "Badge renders iff `counts.pendingPayments > 0` (REQ-NEW-8 explicit); tab is selectable at 0 with empty table state." Not just a pure-fn name.
2. **WU-A must precede WU-B** — documented in Preamble (`### WU ordering dependency`) with the explicit reason: "WU-A introduces `paymentId`, `ReferenceUpdateError`, `UpdatePaymentReferencePayload`, and the renamed enum codes that WU-B consumes."
3. **DebtPaymentModal.vue citation precision** — clarified in WU-C.3: "The change lives at `paymentEntries.utils.ts:65-70` (C.1), NOT in `DebtPaymentModal.vue` itself. The DebtPaymentModal submit boundary (`DebtPaymentModal.vue:127-130`, the `submitSafe({...})` call) does NOT directly reference `reference` — the cascade flows through `validateEntry` in the util."
