# Tasks: Customer Sales History

## Review Workload Forecast

| Field | Value |
| ------- | ------- |
| Estimated changed lines | 1,280 total: S1 ~230, S2 ~220, S3a ~270, S3b ~290, S4 ~270 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (S1) → PR 2 (S2) → PR 3 (S3a) → PR 4 (S3b) → PR 5 (S4) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

The total forecast exceeds the 400-line review budget. Ask the user to select `stacked-to-main` or `feature-branch-chain` before apply. The exact first PR boundary is **after S1 Contract**; each later PR ends after its named slice. S3 is split into presentation and integration work so its implementation and real-overlay tests remain independently reviewable.

## Work Units

| Slice | Goal | Test cmd | Runtime path | Rollback |
| --- | --- | --- | --- | --- |
| S1 | Add required sales-summary contract, query keys, fixtures, and null guards. | `pnpm test:unit --run` | Existing sales lists safely accept nullable fields. | Revert S1 commit; do not land consumers without this contract. |
| S2 | Add tenant/customer-scoped history query with safe request and cache behavior. | `pnpm test:unit --run` | Open history panel fetches confirmed customer sales only. | Revert S2 commit; no mutation/cache invalidation was introduced. |
| S3a | Add pure metrics and compact history-list presentation. | `pnpm test:unit --run` | Authoritative metrics and selectable accessible rows render. | Revert S3a commit; it is not yet reachable. |
| S3b | Add slideover orchestration, query states, pagination, navigation, and 403 behavior. | `pnpm test:unit --run` | Open panel presents history and routes sale selection. | Revert S3b commit; S3a remains inert. |
| S4 | Wire table/card entries with independent `read:Sale` gating. | `pnpm test:unit --run` | Users authorized for sales open history from either customer-list mode. | Revert S4 commit to remove all user entry points. |

## Dependency Graph

```text
S1 Contract
  └─> S2 Query
       └─> S3a Presentation
            └─> S3b Slideover integration
                 └─> S4 Customer entries
```

## Implementation Order

1. Complete and commit S1; it makes the backend summary mandatory and repairs all existing affected fixtures/nullable consumers.
2. Complete and commit S2 against S1's contract and centralized key factory.
3. Complete and commit S3a as pure, mountable presentation components using S1 DTOs.
4. Complete and commit S3b using S2 query state and S3a components; verify the real teleported overlay.
5. After the delivery-chain decision, complete and commit S4 to expose the already-tested surface from both customer modes.

## S1 — Contract (~230 lines)

**Files**

- MOD `src/features/POS/sales/interfaces/sale.types.ts`
- MOD `src/core/shared/constants/query-keys.ts`
- MOD `src/features/POS/sales/components/SaleCard.vue`
- MOD `src/features/POS/sales/views/SalesListView.vue`
- MOD `src/features/POS/sales/interfaces/__tests__/sale.types.test.ts`
- MOD `src/features/POS/sales/api/__tests__/sale.api.test.ts` (all five list-response fixtures)
- MOD `src/features/POS/sales/composables/__tests__/useConfirmedSales.test.ts`
- MOD `src/features/POS/sales/views/__tests__/SalesListView.persistence.test.ts`
- MOD `src/core/shared/constants/__tests__/query-keys.test.ts`
- MOD concrete discovery targets `src/features/POS/sales/components/**/SaleCard*.test.ts` and `src/features/POS/sales/views/**/SalesListView*.test.ts` for co-located null-fallback coverage.

**TDD steps**

- [x] **RED:** Extend contract/key and existing response-fixture tests to require integer `summary`, reject missing/malformed summaries, accept nullable `folio`/`paymentStatus`/`confirmedAt`, and assert the tenant/customer/page history-key shape; add failing SaleCard/SalesListView null-display tests. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Add `SaleListSummarySchema`, inferred `SaleListSummary`, required `ConfirmedSalesListResponse.summary`, nullable row fields, and `CustomerSalesHistoryParams`; add `saleQueryKeys.customerHistoryPrefix` and `customerHistory`; update exactly the identified fixtures and add only null guards/fallbacks (`Sin folio`, `Fecha no disponible`, `Sin estado`) in existing sales UIs. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Cover differing tenant/customer/page keys and null combinations without changing shared formatter utility contracts. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Remove repeated fixture builders where local test conventions support one, retain strict DTO typing, and confirm no existing sales-list behavior changes beyond null safety. <!-- sdd-owner: implementation -->

**Verify**

```bash
pnpm test:unit --run
pnpm build
pnpm lint
```

**Commit message**

```text
feat(sales): add customer history summary contract
```

## S2 — Query (~220 lines)

**Files**

- NEW `src/features/POS/sales/composables/useCustomerSalesHistory.ts`
- NEW `src/features/POS/sales/composables/__tests__/useCustomerSalesHistory.test.ts`

**TDD steps**

- [x] **RED:** Write query tests for disabled closed/missing-customer/missing-tenant inputs, the exact key `['sales', tenantId, 'customer-history', customerId, params]`, and the exact API object `{ customerId: [id], page, limit: 10, sortBy: 'confirmedAt', sortOrder: 'desc' }` with neither `status` nor `customerIncludeNull`. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Implement the options-object composable over unmodified `saleApi.listConfirmed`, centralized keys, `enabled`, `staleTime: 30_000`, `placeholderData: keepPreviousData`, summary parsing via `SaleListSummarySchema`, and owner-customer cache entries/render guard. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Test malformed/absent `summary` fails to query error; same-customer page placeholder is exposed; A→B suppresses A; close/reopen uses fresh cache without invalidation. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Keep the returned computed query state focused and readonly, deduplicate parameter construction, and retain retry exclusion for 400/401/403. <!-- sdd-owner: implementation -->

**Verify**

```bash
pnpm test:unit --run
pnpm build
pnpm lint
```

**Commit message**

```text
feat(sales): add customer sales history query
```

## S3a — Surface presentation (~270 lines)

**Files**

- NEW `src/features/POS/customers/components/SalesHistoryMetrics.vue`
- NEW `src/features/POS/customers/components/SalesHistoryList.vue`
- NEW concrete co-located specs `src/features/POS/customers/components/SalesHistoryMetrics.spec.ts` and `src/features/POS/customers/components/SalesHistoryList.spec.ts`

**TDD steps**

- [x] **RED:** Using plain `mount`, add failing metrics tests proving values come only from `summary` despite contradictory rows, plus failing list tests for formatting, `sin folio`/`fecha no disponible`/`sin estado`, the required accessible-name pattern, and `select` emission. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Implement typed pure props/emits: one semantic metrics `<dl>` with MXN formatting and debt/`Al corriente` treatment, and a semantic `<ul>` of native row buttons using existing format/status utilities and explicit null fallbacks. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Test positive versus zero debt, integer currency values, nullable combinations, and exactly one emitted selected sale. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Centralize local display-label derivations in computed values without query, router, pagination, or row aggregation logic. <!-- sdd-owner: implementation -->

**Verify**

```bash
pnpm test:unit --run
pnpm build
pnpm lint
```

**Commit message**

```text
feat(customers): add sales history presentation
```

## S3b — Slideover integration (~290 lines)

**Files**

- NEW `src/features/POS/customers/components/CustomerSalesHistorySlideover.vue`
- NEW `src/features/POS/customers/components/CustomerSalesHistorySlideover.spec.ts`

**TDD steps**

- [x] **RED:** With `mountWithUApp`, `VueQueryPlugin`, retries disabled, and `attachTo: document.body`, write failing real-overlay tests for width/body classes, named dialog/header/close control, three-plus-five initial skeletons, exact empty `role=status` copy, error `role=alert` plus retry, page transition stability, named-route selection, and deduplicated 403 toast/close. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Implement the typed `open`/`customer` and `update:open` shell using S2 and S3a; reset page on customer change; render guarded query states; use `UPagination` at 10 items, route with `{ name: 'pos-sale-detail', params: { id } }`, and apply `content: 'w-full !max-w-none sm:!max-w-[520px]'` plus `body: 'p-0'`. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Assert 200-zero is empty rather than error, page changes retain same-customer summary without row summation, retry refetches current inputs, and rerenders do not duplicate the exact toast `Sin permiso para ver ventas`. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Keep shell orchestration separate from S3a presentation, make state priority explicit, clean portal DOM after each test, and add no routes, API adapters, or mutation/invalidation code. <!-- sdd-owner: implementation -->

**Verify**

```bash
pnpm test:unit --run
pnpm build
pnpm lint
```

**Commit message**

```text
feat(customers): add sales history slideover
```

## S4 — Customer entries (~270 lines)

**Files**

- MOD `src/features/POS/customers/views/CustomersView.vue`
- MOD `src/features/POS/customers/components/CustomerCard.vue`
- MOD `src/features/POS/customers/components/CustomerCardGrid.vue`
- MOD concrete co-located tests `src/features/POS/customers/components/CustomerCard.spec.ts`, `src/features/POS/customers/components/CustomerCardGrid.spec.ts`, and `src/features/POS/customers/views/CustomersView.test.ts`

**TDD steps**

- [x] **RED:** Add failing permission/event tests for table and card history actions, read-sales-only kebab visibility, update/delete-only history absence, no-permission kebab absence, one-time grid forwarding, and unchanged card-body click behavior. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Add `canReadSales` and `canShowCustomerActions` in `CustomersView`, independent `historyCustomer`/`isHistoryOpen` state, history menu item and slideover composition; pass `canReadSales` grid-to-card and relay typed `view-history`. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Exercise each permission union (`canUpdate || canDelete || canReadSales`), table/card parity, close/reopen isolation from edit/detail state, and selected-customer identity preservation. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Preserve existing normal/destructive action grouping and click-stop behavior, remove duplicated open handlers where possible, and confirm no router/sidebar/CASL-registry changes entered the diff. <!-- sdd-owner: implementation -->

**Verify**

```bash
pnpm test:unit --run
pnpm build
pnpm lint
```

**Commit message**

```text
feat(customers): expose sales history actions
```

## Parent Lifecycle Actions

- [ ] Obtain the user’s chain-strategy decision (`stacked-to-main` or `feature-branch-chain`) before apply because the forecast is over budget and delivery strategy is ask-on-risk. <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for each approved PR-sized slice, beginning with S1 and using the selected chain base/target strategy. <!-- sdd-owner: parent -->
