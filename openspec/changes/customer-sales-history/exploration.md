# Exploration: Customer Sales History

## Scope and evidence

This exploration maps the customer entry surfaces, confirmed-sales contract, shared overlay/list primitives, CASL conventions, route reuse, TanStack Query conventions, and component-test infrastructure for a read-only customer sales-history slideover. It does not define the proposal, design, specifications, tasks, or implementation.

Binding decisions and evidence:

- Backend contract source: `/home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend/docs/customer-sales-history-frontend.md`, especially §2–§3 and lines 560–602.
- User-selected layout: Option A, a right-side lateral slideover approximately 480–560px wide with metrics above a paginated list.
- No new route; sale rows reuse `pos-sale-detail`.
- Review budget for later task slicing: 400 changed lines.
- Frontend evidence: `src/features/POS/customers/`, `src/features/POS/sales/`, `src/core/shared/`, `src/features/auth/authorization/ability.ts`, `src/app/router/index.ts`, and `src/test/mountWithUApp.ts`.

## Executive summary

The feature fits the existing customers list without a new customer detail page or route. `CustomersView.vue` already owns row dropdown actions and two customer slideovers, while `CustomerCard.vue` owns the responsive card dropdown. Both surfaces derive permissions through `authStore.userCan(...)`; adding a `read:Sale` gate can hide the history action completely while preserving existing edit/delete gates.

The sales API method already exists: `saleApi.listConfirmed(params)` calls `GET /sales` and returns `ConfirmedSalesListResponse` directly, and `saleApi.getById(id)` supports the existing sale-detail view. `ListSalesParams` already accepts `customerId?: string[]`, paging, supported sorting, and `customerIncludeNull?: boolean`. The history query therefore needs no new API method, but it must omit `status` and `customerIncludeNull` (or explicitly send false). The frontend response model is missing the backend-authoritative `summary`, and several existing row fields are narrower than the binding handoff (`folio`, `paymentStatus`, and `confirmedAt` are currently non-null).

Nuxt UI 4 provides the required `USlideover`; it is already used in customers, sales, catalog, and delivery routes. There is no need to create a drawer/slideover primitive. The best local precedent for a custom-width right panel is `EditReferenceSlideover.vue`; the best test precedent wraps the real overlay with `mountWithUApp`, attaches to `document.body`, and queries teleported content through `document`.

The repository mandates centralized, tenant-scoped query-key factories in `src/core/shared/constants/query-keys.ts`. A customer-history key should therefore be added there rather than declared locally. A `saleQueryKeys.customerHistory(tenantId, customerId, params)` shape such as `['sales', tenantId, 'customer-history', customerId, params]` avoids collision with the general confirmed list while preserving the sales hierarchy. Pagination can use `placeholderData: keepPreviousData` and a 30-second `staleTime`, both established conventions.

## 1. Customer module and entry surfaces

### Customers list view

`src/features/POS/customers/views/CustomersView.vue` is the only customer route-level surface. It composes:

- `AppDataTable` for the server-paginated table.
- `CustomerCardGrid` for the responsive card mode.
- `CustomerUpsertSlideover` for create and edit.
- `UDropdownMenu` for table-row actions.
- `useServerTable` with `customerQueryKeys.paginated(tenantId)`.

Permission values are computed from `useAuthStore().userCan(action, subject)`. Current values are `canCreate`, `canUpdate`, and `canDelete`; `canManageCustomerActions` controls whether the row kebab appears. `getRowItems(customer)` returns grouped Nuxt UI dropdown sections, with edit in a normal group and delete in a destructive group. The history action can be a normal action gated by a new `canReadSales = computed(() => authStore.userCan('read', 'Sale'))`. The kebab visibility must include this permission so a read-only customer user with `read:Sale` still sees the history action.

The view already owns selected-customer/open state for edit. History should have independent selected-customer/open state so opening history does not fetch `CustomerDetail` or couple to the edit form. A list-row `Customer` already supplies the required `id` and `fullName`.

### Customer card and grid

`CustomerCard.vue` receives the customer plus `canUpdate`/`canDelete`, computes whether to render its kebab, and emits typed `edit`, `delete`, and card `click` events. Its menu is an inline `UDropdownMenu` item array. The kebab wrapper uses `@click.stop`, preventing menu actions from triggering the card click.

`CustomerCardGrid.vue` is purely presentational: it forwards permission props and card events to `CustomersView.vue`. To keep responsive parity, a history permission prop/event must flow through grid → card → view. The card's kebab visibility should include `canReadSales`, independently of edit/delete.

The card-level click currently opens edit through `CustomersView.handleCardClick`; history should remain an explicit menu action rather than changing that existing behavior.

### Customer types and detail surface

`Customer` contains `id`, `fullName`, contact data, price-list display data, and timestamps, which is sufficient for the slideover header and query. `CustomerDetail` adds billing and addresses but no sales information.

There is no `CustomerDetailView`, `/pos/customers/:id` route, customer-detail tab surface, or dedicated customer-detail page in the repository. `CustomerUpsertSlideover` is an editor, not a customer-detail destination. The selected no-new-route approach is therefore the smallest coherent integration.

## 2. Sales API and frontend contract gaps

### Existing API methods

`src/features/POS/sales/api/sale.api.ts` already exposes:

| Method | Wire call | Return |
| --- | --- | --- |
| `saleApi.listConfirmed(params)` | `GET /sales` with `{ params }` | Unwrapped `Promise<ConfirmedSalesListResponse>` |
| `saleApi.getById(id)` | `GET /sales/:id` | Unwrapped `Promise<SaleDetail>` |

No adapter transformation occurs, so a new backend `summary` field will be preserved at runtime even though TypeScript does not model it yet.

`ListSalesParams` already supports `customerId?: string[]`, `customerIncludeNull?: boolean`, `page`, `limit`, `sortBy`, `sortOrder`, and date/list filters. No API-method extension is required for `customerId`. The history request should send one ID as `customerId: [customerId]`, use `sortBy: 'confirmedAt'`, `sortOrder: 'desc'`, and omit both `status` and `customerIncludeNull`.

### Existing response types

The following already exist in `sale.types.ts`:

- `SalesListCounts`
- `SalesListPagination`
- `ConfirmedSaleRow`
- `ConfirmedSalesListResponse`

The following does not exist:

- `SaleListSummary`
- `ConfirmedSalesListResponse.summary`

The binding additive shape is:

```ts
interface SaleListSummary {
  salesCount: number
  totalSoldCents: number
  outstandingDebtCents: number
}
```

`ConfirmedSalesListResponse` must include `summary: SaleListSummary`. Existing API and type tests construct list-response fixtures without `summary`, so those fixtures/tests must be updated when the type becomes required.

The binding handoff allows `folio: string | null`, `paymentStatus: ... | null`, and `confirmedAt: string | null`; current `ConfirmedSaleRow` declares all three as non-null. This is a pre-existing type-contract mismatch to resolve explicitly in design because row labels, status badges, dates, and accessible names need null fallbacks.

### Binding request/response semantics

```text
GET /sales
  ?customerId=<customer UUID>
  &page=<1-based page>
  &limit=<page size>
  &sortBy=confirmedAt
  &sortOrder=desc
```

The frontend must:

- Require `read:Sale` before exposing the action.
- Never send `customerIncludeNull=true`.
- Omit `status`; backend defaults this listing to confirmed-only semantics.
- Render all three metrics from `response.summary`; never sum paginated rows.
- Treat a tenant-safe 200 response with zero summary and empty data as a normal empty state, not a 403/not-found signal.
- Preserve the backend invariant `summary.salesCount === pagination.total === counts.all`.
- Treat `outstandingDebtCents` and each row's `debtCents` as authoritative.

Expected errors are 400 for invalid listing inputs, 401 for expired/absent authentication, 403 without `read:Sale`, and ordinary transport/server failures. The shared `normalizeApiError` helper exists in `src/core/shared/utils/error.utils.ts`; there is no exported shared function literally named `userMessageForError` (that name is local to quotations).

## 3. Shared primitives and presentation patterns

### Overlay

`USlideover` exists and is already used by `CustomerUpsertSlideover.vue`, `AssignCustomerSlideover.vue`, `SaleCommentSlideover.vue`, `EditReferenceSlideover.vue`, `CatalogCartDrawer.vue`, and delivery-route components. `UDrawer` also exists for bottom-sheet/adaptive layouts, but the selected desktop/right-side Option A can use `USlideover` directly.

Relevant patterns:

- `side="right"` and `inset` are standard.
- `v-model:open` or explicit `:open` plus `@update:open` are both established.
- `#content` supports a full-height custom shell with header, scrollable body, and footer.
- `:ui="{ content: '!max-w-md' }"` in `EditReferenceSlideover.vue` demonstrates width control; history can use an explicit approximately 480–560px max width in design.
- Nuxt UI owns modal focus management, Escape dismissal, overlay behavior, and dialog semantics; a new primitive would duplicate this capability.

### List, status, identity, and formatting

Reusable elements include:

- `AppDataTable` for full list pages; however, its toolbar/server-table shell is likely too broad for a 480–560px panel. A compact semantic list/table using existing sales format/status utilities is the better candidate unless design proves `AppDataTable` can be configured without its full chrome.
- `AppBadge` and `StatusDotBadge` for compact status labels.
- Nuxt UI `UButton`; no shared `AppButton` component exists despite the older OpenSpec config recommendation.
- `EntityAvatar` for the customer identity header.
- `formatCentsMXN` from `src/core/shared/utils/currency.utils.ts`, also re-exported by the sales-local currency utility.
- `formatSaleDate`, `getPaymentStatusBadge`, `getDeliveryStatusBadge`, and payment-method formatting helpers from the sales feature.
- `SaleCard` as a useful compact-row/card reference, though directly reusing it would repeat the customer identity and omit some history-specific information.

No generic shared empty/error/skeleton components were found. Existing features render these states locally with Nuxt UI icons, skeleton classes/components, alerts, and retry buttons. Focused history state components are reasonable if the design remains within the 400-line review budget; they do not need to mirror all six backend-suggested components if a smaller split keeps responsibilities clear.

A likely component map for later design is:

- `CustomerSalesHistorySlideover`: open state contract, query orchestration, panel shell, pagination, and row-navigation event.
- `SalesHistoryMetrics`: render the authoritative summary only.
- `SalesHistoryList`: compact sale rows and navigation emits.
- Local state blocks for loading/empty/error, split only where tests or markup complexity justify it.

## 4. RBAC, router, and navigation touch points

### CASL

`Sale` is already present in both the runtime `APP_SUBJECTS` registry and the `AppSubject` type used by CASL. `authStore.userCan('read', 'Sale')` is the established helper used in sales views.

**CASL subjects to register: none.** No new action or subject is needed. Both table and card history actions should be completely hidden without `read:Sale`; the backend 403 remains a defensive error path.

### Router and sidebar

`src/app/router/index.ts` registers:

```text
name: pos-sale-detail
path: /pos/ventas/:id
permission: read:Sale
```

The general sales list currently navigates with `router.push('/pos/ventas/${id}')`; the handoff recommends named navigation. History can use `router.push({ name: 'pos-sale-detail', params: { id: row.id } })` and close or allow route navigation to unmount the slideover according to later design.

No new customer-history route, lazy view, route guard, navigation-registry entry, or sidebar item is required. The only router touch point is reuse of the existing route from a history row.

## 5. TanStack Query and cache conventions

The repository explicitly centralizes all query keys in `src/core/shared/constants/query-keys.ts`. Existing sale keys are tenant-scoped under `saleQueryKeys`, including confirmed list and detail factories.

A convention-aligned history factory should include every result dependency and tenant isolation, for example:

```ts
saleQueryKeys.customerHistory(tenantId, customerId, {
  page,
  limit,
  sortBy: 'confirmedAt',
  sortOrder: 'desc',
})
// ['sales', tenantId, 'customer-history', customerId, params]
```

This is safer than declaring the handoff's illustrative `['customer-sales-history', ...]` locally because it follows the repository's central-key rule, carries tenant scope, and cannot collide with `saleQueryKeys.confirmed(...)`.

Established cache patterns support:

- `staleTime: 30_000` for customer/sales picker and detail data that should survive quick close/reopen cycles.
- `placeholderData: keepPreviousData` (TanStack Query v5 form) for pagination continuity; the old `keepPreviousData: true` option shown in the backend handoff is not the repository's v5 syntax.
- An `enabled` computed guard so no request runs when the panel is closed or the customer ID is empty.
- No invalidation merely on close/reopen. Future payment/cancellation flows can invalidate the customer-history prefix and sale detail deliberately.

The existing `useConfirmedSales` composable is tied to `useServerTable`, URL/filter state, list counts, and the general sales-page key. A focused `useCustomerSalesHistory` query composable is preferable to forcing the compact slideover through that full-page abstraction.

## 6. Testing infrastructure and precedents

`src/test/mountWithUApp.ts` wraps the component under test in real `UApp`, supplying Nuxt UI modal/tooltip/toast providers. It must be used for real `USlideover`, `UDropdownMenu`, or other provider-dependent components.

`EditReferenceSlideover.spec.ts` is the strongest overlay-test precedent:

- Create a `QueryClient` with retries disabled.
- Install `VueQueryPlugin` for query components.
- Call `mountWithUApp(..., { attachTo: document.body })`.
- Clear `document.body` between tests.
- Query teleported slideover content through `document.querySelector`, not only the wrapper.

`CustomerUpsertSlideover.spec.ts` instead mocks Nuxt UI and uses direct `mount`; it is useful for pure component logic but does not verify the real overlay/focus/teleport behavior. History integration tests should prefer the real `UApp` pattern, while focused metrics/list components can use ordinary mounting when they have no provider-dependent UI.

Existing customer card/grid tests already pin kebab visibility, click propagation, permission props, and forwarded events. Existing sale API/type tests pin `listConfirmed` request passthrough and response construction; they currently reveal the missing `summary` fixture coverage.

## 7. Open questions and resolved unknowns

| Question / unknown | Exploration finding | Status / later decision |
| --- | --- | --- |
| Does the UI library provide a slideover/drawer? | Yes. `USlideover` is widely used and `UDrawer` also exists. | Resolved: reuse `USlideover`; do not add a primitive. |
| Does `saleApi.listConfirmed` exist and accept customer filtering? | Yes. It accepts `ListSalesParams`, including `customerId?: string[]` and `customerIncludeNull?: boolean`. | Resolved: reuse the method without an API-method extension. |
| Does the list response already model the authoritative summary? | No. `SaleListSummary` and `ConfirmedSalesListResponse.summary` are absent. | Required contract/type/test change. |
| Are all handoff row nullabilities modeled? | No. `folio`, `paymentStatus`, and `confirmedAt` are narrower in the frontend. | Design must choose explicit null-safe widening/fallbacks. |
| Is there a dedicated customer detail page or route? | No. Only the customer list and upsert slideover exist. | Resolved: integrate from table/card actions only. |
| Should history use `AppDataTable`? | The primitive exists, but its full-page toolbar/table shell may not suit a 480–560px panel. | Validate in design; default to a compact semantic list/table reusing sales utilities. |
| Is there a shared `userMessageForError` helper? | No exported shared helper by that exact name. `normalizeApiError` is the established shared equivalent. | Resolved: reuse `normalizeApiError`. |
| Is there a shared `AppButton`? | No component was found. Nuxt UI `UButton` is the repository norm. | Resolved: use `UButton`. |
| How should mobile behave? | The selected decision fixes a lateral slideover; the repo also has adaptive `USlideover`/`UDrawer` precedent. | Confirm in design whether the same right panel becomes full-width on narrow screens or adapts to a bottom drawer without changing the desktop decision. |
| Is the backend contract deployable now? | The handoff says implementation is local, uncommitted, and pending deploy. | Release risk: coordinate staging availability; frontend must not derive a fallback summary. |
| Can the feature fit the 400-line review budget? | Entry wiring, types/tests, query factory/composable, and a multi-state slideover may exceed one review unit if all six suggested components are created. | Tasks phase should estimate and split on risk; avoid component-count inflation. |

## 8. Risks and constraints

- Shipping before the backend additive `summary` is deployed would leave the metrics contract unavailable; the frontend must show an error rather than sum page rows.
- Adding the action only to edit/delete-gated menus would incorrectly hide it from users who have `read:Sale` but cannot mutate customers.
- Reusing the general confirmed-sales key without customer/page dependencies could leak or overwrite cache entries; tenant/customer/params must all participate in a centralized key.
- `placeholderData: keepPreviousData` can briefly retain the prior page or prior customer; render guards must ensure displayed data belongs to the currently selected customer/key.
- The current card click opens edit regardless of permission, so history should remain a separately gated action and not inherit card-click behavior.
- Existing response fixtures omit `summary`; making it required will intentionally surface all stale fixtures at compile/test time.
- A dense desktop sales table copied into a 480–560px panel would harm readability. The selected panel requires a compact information hierarchy, not a miniature full-page table.
- The backend recommendation of six components is non-binding. Under a 400-line review budget, boundaries should follow state/orchestration versus presentation responsibilities rather than one file per visual state.

## 9. Exploration conclusion

The repository already supplies every foundational capability except the summary type and customer-history orchestration: customer row/card action hooks, `read:Sale`, a right-side `USlideover`, sales-list API support for `customerId`, formatting/status utilities, named sale-detail routing, centralized query keys, and real-overlay test infrastructure. The smallest safe direction is a customer-owned history slideover opened from both customer list modes, backed by a focused tenant-scoped TanStack query and the unmodified `GET /sales` adapter, with metrics rendered exclusively from the new wire `summary`.
