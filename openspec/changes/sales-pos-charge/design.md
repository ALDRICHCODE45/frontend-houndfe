# Design: Sales POS Charge — FE/backend reconciliation (gap-closure)

## Technical Approach

Gap-closure: POS/sales already implements ~85% of the contract. Reuse established patterns — error classes + parse fns (`sale.api.ts:43,73`), `MaybeRefOrGetter` mutation composables (`useSaleDueDate.ts:31`), `saleQueryKeys` (`query-keys.ts:65-87`), auto-imported `useToast`. No new state library, no URL-sync, one new PATCH.

## Architecture Decisions

| # | Decision | Choice (rationale) |
|---|---|---|
| D1 | `ReferenceUpdateError` home | `sale.api.ts` beside `SalePdfError` (`:43`), parse fn beside `parseCommentError` (`:73`); no `SalePaymentError` parent; unknown codes rethrow raw |
| D2 | PATCH transport | `PATCH /sales/:saleId/payments/:paymentId/reference` body `{reference: string\|null}`, NO `Idempotency-Key` (PATCHes send none `:170,:244`; only POSTs `:184,:197`). Response per §7.4 (L1120-45) |
| D3 | Mutation config | No `mutationKey` (none used today). `retry: 3`, skipping `ReferenceUpdateError` (404/403); REQ-NEW-7 backoff = TanStack built-in |
| D4 | Tab state serialization | Local ref — `urlSync: false` (`useConfirmedSales.ts:131`); no `useTabQueryParam`; delivery tab already local-only. URL round-trip = open question |
| D5 | `SalesListTabs` contract | Emit widened to `{deliveryStatus?; paymentStatus?}` (SaleDeliveryStatus / SalePaymentStatus[]); "Todas" clears both. No active highlight (REQ-19); badge neutral/soft |
| D6 | Slideover extraction | Extract `EditReferenceSlideover.vue` — owns composable + toasts; list section presentational, owns `editingPaymentId` |
| D7 | Mount point (correction) | `#pagos` tab after `SaleDetailTotalsCard` (`SaleDetailView.vue:398-412`); Timeline is in `#comentarios` (`:452`) — brief's claim false |
| D8 | `normalizeReferenceInput` | `(raw) => string\|null`: null/empty/ws → `null` else trimmed; modals omit key, slideover sends `null` to clear (§5.5 L656). `undefined` return dropped |
| D9 | 404 handling | Invalidating detail IS the re-fetch (REQ-NEW-2); toast "El pago ya no existe" |

## Data Flow

```
CHARGE: entries → validate() → buildPayload() → chargeDraft(POST+key) → success modal
REFERENCE-EDIT: "Editar referencia" → slideover prefilled → normalizeReferenceInput
  → PATCH → invalidate detail → re-render
DEBT: entries → validateEntry → {payments} (ref omitted when empty)
  → registerDebtPayment(POST) → toast + invalidate
```

## State Management

- Keys: `detail(tenant, saleId)` — ref-edit/due-date/debt/seller; `confirmed` — debt only (doc L662).
- `useConfirmedSales`: `deliveryStatusFilter` (`:87`) + new `paymentStatusFilter` + setter; `resolvePaymentStatus` mirrors `resolveDeliveryStatus` (`:70-82`); slideover wins.

## Interfaces / Contracts

```ts
SaleDetailPayment (:128) += paymentId: string  // required — §7.4 (REQ-NEW-6)
ChargeDomainErrorCode (:298): −REFERENCE_REQUIRED; +PAYMENT_AMOUNT_INSUFFICIENT
SaleDueDateErrorCode (:400): SALE_ALREADY_PAID → SALE_FULLY_PAID
SellerAssignmentErrorCode (:382): −SELLER_NOT_ASSIGNABLE
type ReferenceUpdateErrorCode = 'ENTITY_NOT_FOUND'|'SALE_UPDATE_FORBIDDEN'|'NETWORK_ERROR'  // sale.api.ts
ERROR_ACTIONS: +PAYMENT_AMOUNT_INSUFFICIENT {type:'inline', message:'Agregá un pago en efectivo
  o ajustá los montos para cubrir el total'} (REQ-NEW-12); −REFERENCE_REQUIRED
```

Pure fns: `normalizeReferenceInput` → `paymentEntries.utils.ts`; `shouldShowEditReference(p)` (`method !== 'CASH' && paymentId`) → `salePaymentMethod.utils.ts`; `pendingPaymentsBadge(count)` → `saleStatus.utils.ts`.

## File Changes

**New**: `PaymentsListSection.vue` (props `payments`/`loading`/`saleId`; row = `getMethodMeta` badge + `formatCentsMXN` + reference truncated 24ch w/ `UTooltip` + `formatSaleDate(paidAt)`; skeleton on `loading`; subtle "Sin pagos registrados"; `payment-row-{paymentId}`), `EditReferenceSlideover.vue`, `useUpdatePaymentReference.ts` + test (harness `useSaleDueDate.test.ts:46-66`; happy/404/403/network cases).

**Modified**: `PaymentModal.vue` −`validate()` ref block (`:210-222`) + `referenceErrorByIndex` machinery; `normalizeEntries` (`:123-125`) sets `reference` only when normalized ≠ null. `paymentEntries.utils.ts:65-70` −ref branch. `DebtPaymentModal.vue:127-130` map via `normalizeReferenceInput`. `useSaleDueDate.ts:17`/`DueDateEditModal.vue:68` rename; `useSellerAssignment.ts:17`/`AssignSellerSlideover.vue:71-72` −branch. `useConfirmedSales.ts`; `SalesListTabs.vue` third tab + badge; `SaleDetailView.vue:398-412` mount.

**Deleted (WU-E; grep-verified zero non-test imports)**: `SaleDetailHeader.vue` + spec, `components/payments/` (4 files) + 3 `__tests__`. Live `utils/paymentMethodMeta.ts` NOT deleted.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Pure (100%) | 3 fns | extend existing specs (`paymentEntries.utils.spec.ts:89-105` flip; `salePaymentMethod.utils.test.ts`; `saleStatus.utils.test.ts`) |
| Unit | API | extend `sale.api.test.ts` (http mock `:25-33`): path, no key header, 404/403 |
| Unit | Composable | `useUpdatePaymentReference.test.ts`: mocked `saleApi` + `QueryClient`, spy `invalidateQueries` |
| Component | Slideover/list | `mountWithUApp` (USlideover/UTooltip/UBadge); stubbed composable |
| Scenario | WU-C | `PaymentModal.test.ts:249`/`DebtPaymentModal.test.ts:171` flip; `{payments:[]}` credit 200 |
| Integration | WU-B | 1 scenario PATCH → invalidate → re-render |

Coverage: 100% pure fns; 80%+ new components.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

Single PR to `main`, branch `feat/sales-pos-charge` (repo uses both prefixes). Per-WU conventional commits (`feat/fix/test/chore(sales)`). No data migration. After each WU: `pnpm type-check && pnpm test:unit && pnpm lint`; `pnpm build` pre-PR. §5.1 staleness in PR.

## Work Units

| WU | Scope | Files (~lines) | Gate |
|---|---|---|---|
| A | Types + error codes (D + `paymentId` + `UpdatePaymentReferencePayload`) | 6 source files + 5 tests: flip `useSaleDueDate.test.ts:96`/`useSellerAssignment.test.ts:105`/`salePaymentErrors.utils.test.ts:7`, delete `AssignSellerSlideover.spec.ts:148`, `sale.types.test.ts` +paymentId (~200) | type-check + unit |
| B | Reference-edit UI — **size:exception** | `sale.api.ts` (+`updatePaymentReference`/`ReferenceUpdateError`), `useUpdatePaymentReference.ts`, `PaymentsListSection.vue`, `EditReferenceSlideover.vue`, `SaleDetailView.vue`, `salePaymentMethod.utils.ts`, 4 test files (~450) | unit + build |
| C | `reference` optional | `PaymentModal.vue`, `paymentEntries.utils.ts`, `DebtPaymentModal.vue`, 3 test flips (~80) | unit |
| D | Pending tab | `SalesListTabs.vue`, `useConfirmedSales.ts`, `saleStatus.utils.ts`, `SalesListView.vue`, 3 test files (~100) | unit |
| E | Dead code | 9 files deleted + grep verify (0 net) | build |

REQ-16/18 confirmed non-intersecting (sorting/toolbar untouched); only REQ-19 MODIFIED.

## Open Questions

- Tab URL round-trip vs `urlSync: false` (D4)
- §5.1 stale — FE stays multi-method
- Three method-config sources stay divergent (out of scope)
