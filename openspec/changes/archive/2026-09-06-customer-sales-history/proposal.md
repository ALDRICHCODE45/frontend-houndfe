# Proposal: Customer Sales History

> Change: `customer-sales-history` · Phase: propose · Backend contract: `/home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend/docs/customer-sales-history-frontend.md` §2–§3 (binding) · Exploration: `exploration.md` (approved)

## Why

Store staff answer the same customer questions every day: *what has this customer bought, how much have they spent, and how much do they still owe us?* Today the customers module (`/pos/clientes`) has no answer. The only way to reconstruct a customer's purchase history is to leave the customers list, open the general sales list, filter or search by customer name — and even then there is no per-customer financial summary; staff would have to mentally sum rows, which is impossible across paginated data and error-prone during a live customer conversation or collections call.

The backend has already solved the hard part: `GET /sales?customerId=<uuid>` now returns an additive, backend-authoritative `summary { salesCount, totalSoldCents, outstandingDebtCents }` computed over all confirmed sales of that customer (handoff §2.6), in the same response as the list — zero extra queries. The backend change is implemented locally and pending deploy. The frontend gap is purely presentational: expose a read-only "sales history" view per customer, with metrics that come from the wire, never from summing paginated rows.

This closes a concrete operational cost (collections and customer-service friction) with a small, permission-gated surface that reuses existing infrastructure end to end.

## What Changes

- Add a **"Ver historial de ventas" action** to both customer list modes: the table row dropdown in `CustomersView.vue` and the card kebab menu in `CustomerCard.vue` (forwarded via `CustomerCardGrid.vue`).
- Add a **lateral slideover** (`USlideover`, right side, ~480–560px, Option A) with:
  - Customer identity header (name via existing `EntityAvatar` pattern).
  - **Three metric cards** on top — ventas confirmadas, total vendido, saldo pendiente — rendered **exclusively** from `response.summary`, formatted with `formatCentsMXN`; alert styling when `outstandingDebtCents > 0`, "Al corriente" treatment when zero with sales present.
  - **Paginated compact sale list** below (folio, fecha de confirmación, total, deuda, estado de pago) using existing sales formatting/status utilities; traditional pagination controls.
  - Differentiated **loading / empty / error** states rendered locally (skeletons; "Este cliente aún no tiene ventas confirmadas."; `normalizeApiError` + retry).
- Extend the sales type contract: add `SaleListSummary` and `summary: SaleListSummary` to `ConfirmedSalesListResponse` in `src/features/POS/sales/interfaces/sale.types.ts`, widening `folio`/`paymentStatus`/`confirmedAt` to their backend nullability with explicit null-safe fallbacks in the row UI. Update existing fixtures/tests that construct list responses.
- Add a focused `useCustomerSalesHistory` TanStack Query composable (tenant-scoped centralized query key `saleQueryKeys.customerHistory(tenantId, customerId, params)`, `staleTime: 30_000`, `placeholderData: keepPreviousData`, `enabled` guard on open state) calling the **unmodified** `saleApi.listConfirmed`.
- Gate the action with `read:Sale` via `authStore.userCan('read', 'Sale')` — hidden entirely without the permission, independently of customer edit/delete permissions.
- Row click navigates to the existing named route `pos-sale-detail` (`/pos/ventas/:id`). No new routes, no sidebar changes, no new CASL subjects.

## Out of Scope

Per handoff §11 and user decisions — none of these are in this change even if related:

- ❌ Editing or canceling sales from the history (read-only; `pos-sale-detail` owns mutations).
- ❌ Re-implementing the full sales list inside the slideover (no `AppDataTable` full chrome, no extended columns like cashier/seller/delivery).
- ❌ Customer create/edit/delete changes (existing actions untouched; card-click behavior unchanged).
- ❌ Export to Excel/CSV.
- ❌ Charts/dashboards.
- ❌ Extended filters inside the slideover (paymentStatus, deliveryStatus, amount ranges) — including base date filters (`confirmedFrom`/`To`) for v1.
- ❌ KPIs over extended filters (would require backend contract extension).
- ❌ Push notifications for overdue debt.
- ❌ Cobros/payments recording from the history (future; would invalidate `customer-history` keys).
- ❌ A customer detail page/tab or any new route.

## Capabilities

Scoped to `openspec/specs` (specs written under `openspec/changes/customer-sales-history/specs/<capability>/spec.md`):

| Capability | Status | Covers |
| --- | --- | --- |
| `customer-sales-history/summary-contract` | **New** | `SaleListSummary` type, `ConfirmedSalesListResponse.summary`, nullability alignment, the `useCustomerSalesHistory` query contract (params sent: `customerId`, `page`, `limit`, `sortBy=confirmedAt`, `sortOrder=desc`; `status` and `customerIncludeNull` never sent), centralized tenant-scoped query key, cache behavior. |
| `customer-sales-history/history-surface` | **New** | The slideover itself: metrics rendered only from `response.summary`, compact list, pagination keeping the summary stable, loading/empty/error states, tenant-safe empty state (200 zeros is not an error), row navigation to `pos-sale-detail`. |
| `customer-sales-history/customer-entry` | **New** | Entry points in `CustomersView` row dropdown, `CustomerCard` kebab, `CustomerCardGrid` prop/event forwarding; `read:Sale` gating (hidden without it, independent of edit/delete gates); kebab visibility rules. |
| `customer-list` | **Modified** | The customer list surfaces gain one new gated action in their dropdowns (row dropdown + card kebab). Existing actions, visibility, and card-click behavior unchanged. |

(No existing `sales` spec requirement is weakened; the summary addition is additive to the wire contract and is specced under `summary-contract`.)

## Approach

**Contract first (types → query → surface → entries).**

1. **Types & fixtures**: Add `SaleListSummary` + `summary` to `sale.types.ts`; widen the three nullable row fields. This is the backend binding §2.6/§2.5 shape — no frontend derivation, no client-side recompute of `debtCents`. Compile/test failures in stale fixtures are the intended discovery mechanism; fix fixtures to include `summary`.
2. **Query layer**: `useCustomerSalesHistory(customerId, page)` in `src/features/POS/sales/composables/` calling `saleApi.listConfirmed({ customerId: [id], page, limit: 10, sortBy: 'confirmedAt', sortOrder: 'desc' })` — **omitting** `status` (backend defaults to confirmed-only) and **never sending** `customerIncludeNull` (defaults to `false`; sending `true` would mix anonymous sales into the customer's history). TanStack v5 conventions per exploration: centralized key `['sales', tenantId, 'customer-history', customerId, params]` in `src/core/shared/constants/query-keys.ts`, `staleTime: 30_000` for close/reopen cycles, `placeholderData: keepPreviousData` for pagination continuity, `enabled` guard so nothing fetches while closed. Render guards ensure displayed data belongs to the currently selected customer (keepPreviousData can briefly retain the prior customer's page).
3. **Slideover surface**: Component split (deliberately smaller than the handoff's six-component sketch, per the 400-line budget):
   - `CustomerSalesHistorySlideover.vue` — `USlideover` shell (right, ~520px `:ui` width, `v-model:open`), customer header, open-state + pagination orchestration, state routing (loading/empty/error/data), row-navigation handling.
   - `SalesHistoryMetrics.vue` — pure presentation of the three metric cards from a `summary` prop (`<dl>` semantics, alert color when debt > 0).
   - `SalesHistoryList.vue` — compact semantic list of rows (folio or fallback, `formatSaleDate`, `formatCentsMXN`, `getPaymentStatusBadge`), emits `select(row)`; accessible row controls, not `<div onClick>`.
   - Loading/empty/error blocks stay local to the slideover (no separate components) unless design proves markup complexity justifies a split.
   - Design phase follows the repo's Nuxt UI/Tailwind conventions and the frontend-design skill: quiet, disciplined panel; the metric row is the focal element; no decorative excess.
4. **Entry wiring**: `canReadSales = computed(() => authStore.userCan('read', 'Sale'))` in `CustomersView.vue`; history action in `getRowItems` normal group; `canReadSales` prop flows grid → card for kebab parity; kebab visibility becomes "any action visible", including the new action independently of edit/delete. Independent `historyCustomer`/`isHistoryOpen` state (not coupled to edit state or `CustomerDetail` fetch). `SalesHistoryList` row select → `router.push({ name: 'pos-sale-detail', params: { id } })`.
5. **Tests**: types/API fixture tests; composable query contract tests (key shape, params sent, staleTime); component tests via `mountWithUApp` + `attachTo: document.body` (`EditReferenceSlideover.spec.ts` precedent) for the real overlay: metrics from summary, empty-not-error, pagination keeps summary stable, permission-gated entries; card/grid event-forwarding parity per existing card test patterns. Strict TDD slices per `openspec/config.yaml`.

## Impact

**Areas touched**

- `src/features/POS/sales/interfaces/sale.types.ts` (+ `SaleListSummary`, `summary`, nullability widening) and its co-located tests/fixtures.
- `src/core/shared/constants/query-keys.ts` (+ `saleQueryKeys.customerHistory`).
- New: `src/features/POS/customers/components/` slideover + metrics + list components; `src/features/POS/sales/composables/useCustomerSalesHistory.ts` (sales feature owns the sales-domain query; customers own the surface).
- Modified: `CustomersView.vue`, `CustomerCard.vue`, `CustomerCardGrid.vue` (+ specs).

**Reuse (nothing rebuilt)**

- `saleApi.listConfirmed` — no API-method change, no adapter change.
- `USlideover` (Nuxt UI 4) — no new overlay primitive.
- `EntityAvatar`, `formatCentsMXN`, `formatSaleDate`, `getPaymentStatusBadge`, payment-method formatting, `StatusDotBadge`/`AppBadge`.
- `authStore.userCan` / CASL `Sale` subject (already registered — **zero new CASL subjects**).
- `normalizeApiError` for error messaging; `mountWithUApp` test helper; route `pos-sale-detail` with its existing `read:Sale` guard.
- No router, sidebar, or navigation-registry changes.

**Ripple effects**

- Making `summary` required will surface compile/test errors in existing `ConfirmedSalesListResponse` fixtures — intentional, contained to sales list tests.
- `customerIncludeNull` remains untouched for all other callers; the "never true" rule is scoped to the history query.

## Risks / Unknowns

| Risk | Mitigation |
| --- | --- |
| Backend `summary` not yet deployed (handoff: local, uncommitted). | Frontend must not derive a fallback summary by summing rows. Ship order: coordinate staging validation; until `summary` is on the wire the slideover shows the error state, which is acceptable and honest. Release note flags the dependency. |
| Row nullability widening (`folio`/`paymentStatus`/`confirmedAt`) could ripple into other sales UI consumers of `ConfirmedSaleRow`. | Design phase inventories consumers; widen at the type level and add local null-safe fallbacks in the history row rendering; do not change other views' rendering in this change. |
| `keepPreviousData` can show a prior customer's or prior page's data briefly. | Render guard keyed on the current query key/customer; metric cards only render when `data` matches the selected customer. |
| 400-line review budget: entry wiring (3 files) + types/tests + query factory/composable + multi-state slideover may exceed one review unit. | Component split kept minimal (3 components + local state blocks); tasks phase forecasts lines and splits slices on risk (delivery strategy decided at tasks time, ask-on-risk). |
| `AppDataTable` temptation for the list. | Rejected in exploration: compact semantic list instead; design validates. |
| Permission-model regression: hiding the whole kebab when the user only lacks `update:Customer`/`delete:Customer`. | `canReadSales` participates in kebab visibility independently; tests pin read-only-users-with-`read:Sale` still see the history action. |

## First Slice Scope

Smallest vertical slice that proves the riskiest contract, ordered to fail fast:

1. **S1 — Contract**: `SaleListSummary` + `summary` in `sale.types.ts`, nullability widening, fixture/test updates, centralized `saleQueryKeys.customerHistory`. (Pure contract; unlocks everything; low lines.)
2. **S2 — Query**: `useCustomerSalesHistory` composable with RED/GREEN tests pinning params sent (no `status`, no `customerIncludeNull`), key shape, `staleTime`, `keepPreviousData`.
3. **S3 — Surface**: metrics + list + slideover with states and `pos-sale-detail` navigation, tested via `mountWithUApp`/`document.body`.
4. **S4 — Entries**: row dropdown + card kebab + grid forwarding, permission gating and visibility tests.

S1–S2 alone are inert to users; S3 delivers the capability; S4 completes parity. If the budget forecast at tasks time shows S3+S4 over 400 changed lines combined, the chain splits there (delivery strategy evaluated at tasks time).

## Rollback Plan

- The change is purely additive: one new gated action, one new slideover, one additive type field, one new query key factory, one new composable. Reverting the slice commits removes the feature with no migration, no data changes, and no persistence.
- Rollback per slice: revert the slice commit; S1's type change is the only shared-surface edit — if S1 must roll back after later slices merge, the whole chain reverts together (dependency graph is linear).
- Feature flag not required: the action is permission-gated; removing `read:Sale` from roles hides the entry without a deploy, as an operational soft-kill switch while a code rollback is arranged.
- Backend independence: if the backend `summary` deploy is pulled, the frontend must be rolled back (metrics depend on the wire field; no fallback derivation will exist).

## Success Criteria

Verified in the verify phase against the spec requirements:

1. **Metrics always from `response.summary`** — the three metric cards render `summary.salesCount`, `summary.totalSoldCents`, `summary.outstandingDebtCents` only; no code path sums `data[]` rows to derive any financial figure; `debtCents` is read, never recomputed.
2. **`customerIncludeNull` never true** — the history request sends `customerId`, `page`, `limit`, `sortBy`, `sortOrder` and omits both `status` and `customerIncludeNull` (test-pinned).
3. **`read:Sale` gates the action** — the entry is completely hidden in both table and card modes without the permission, independent of customer edit/delete permissions; backend 403 remains a defensive error path (toast via `normalizeApiError`).
4. **Loading / empty / error differentiated** — skeletons while fetching; centered empty state for `summary.salesCount === 0` (including the tenant-safe 200-zeros case — never shown as an error); error state with retry for 400/500 paths.
5. **Row click navigates to `pos-sale-detail`** — `router.push({ name: 'pos-sale-detail', params: { id } })` from the history list.
6. **Pagination keeps the summary stable** — changing pages updates only the list; metrics remain the confirmed-only, filter-base summary; the `summary.salesCount === pagination.total === counts.all` invariant is preserved by construction.
7. Existing sales/customer tests remain green after the fixture updates; `pnpm test:unit --run` and `vue-tsc` clean at slice completion.

---

## Proposal question round

Key product decisions were already resolved with the user (Option A lateral slideover, 400-line review budget, auto mode) and are locked above. Remaining assumptions the user may correct or confirm before the design phase:

1. **Page size**: proposal assumes `limit: 10` for the compact panel (handoff sketch used 20). Confirm 10 vs 20.
2. **Empty-state copy**: "Este cliente aún no tiene ventas confirmadas." — confirm or adjust (Spanish copy, no tenant-existence disclosure).
3. **Mobile behavior**: desktop decision (right slideover) is fixed; design may render the same panel full-width on narrow screens rather than converting to a bottom drawer. Confirm full-width fallback is acceptable.
4. **Panel width**: proposal assumes ~520px within the 480–560px range; final number lands in design.

No answer is required to proceed to design; silence adopts the stated assumptions.
