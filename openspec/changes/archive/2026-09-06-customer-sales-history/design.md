# Design: Customer Sales History

> Change: `customer-sales-history` · Phase: design · Store: OpenSpec · Approved layout: Option A, right slideover · Backend source of truth: `houndfe-backend/docs/customer-sales-history-frontend.md` §2–§3

## 1. Design goals and locked decisions

This change adds a read-only customer sales ledger to the existing customers list. It does not add a route, duplicate the general sales table, or calculate financial totals in the browser.

Locked behavior:

- Open from either the table-row dropdown or the customer-card kebab.
- Render in the same right-side `USlideover` at all breakpoints: approximately 520px on `sm` and wider, full-width on narrow screens; never convert it to a bottom drawer.
- Request 10 confirmed sales per page from the existing `GET /sales` endpoint.
- Read the three metrics only from backend `response.summary`; never reduce or sum `response.data`.
- Omit both `status` and `customerIncludeNull` from the history request. In particular, never send `customerIncludeNull=true`.
- Gate every entry with existing CASL permission `read:Sale` and reuse named route `pos-sale-detail` for row navigation.
- Keep the implementation reviewable under the user-selected 400-line review budget by using three feature components and local state blocks. Tasks phase will apply `ask-on-risk` if its line forecast exceeds that budget.

## 2. Architecture and ownership

The sales domain owns the wire/query contract. The customers domain owns the customer-facing surface and entry actions.

```text
src/features/POS/sales/
├── interfaces/sale.types.ts                    # wire DTOs + summary runtime schema
└── composables/useCustomerSalesHistory.ts       # tenant-scoped server state

src/features/POS/customers/
├── components/CustomerSalesHistorySlideover.vue # shell and orchestration
├── components/SalesHistoryMetrics.vue           # summary presentation
├── components/SalesHistoryList.vue              # compact navigable rows
├── components/CustomerCard.vue                   # card entry
├── components/CustomerCardGrid.vue               # prop/event forwarding
└── views/CustomersView.vue                       # selected customer/open state
```

The slideover receives customer identity from the already-loaded `Customer` row. It must not call `GET /customers/:id`, reuse edit state, or depend on `CustomerDetail`.

### 2.1 Component contracts and single responsibilities

| Component | Typed public contract | Single responsibility and justification |
| --- | --- | --- |
| `CustomerSalesHistorySlideover.vue` | Props: `open: boolean`, `customer: Customer \| null`. Emits: `'update:open': [boolean]`. | Owns the `USlideover` shell, current 1-based page, query orchestration, loading/empty/error/data routing, retry, 403 defensive handling, pagination, and named-route navigation. This is the composition boundary; moving metrics and repeated rows out prevents it from combining orchestration with two substantial presentational sections. |
| `SalesHistoryMetrics.vue` | Prop: `summary: SaleListSummary`. No emits. | Purely renders the authoritative three-value summary as one semantic `<dl>`. It owns debt tone and `AppBadge` treatment, but no query, pagination, customer, or routing state. |
| `SalesHistoryList.vue` | Prop: `sales: readonly ConfirmedSaleRow[]`. Emits: `select: [sale: ConfirmedSaleRow]`. | Purely renders compact sale controls and null-safe labels, and emits the selected DTO. It does not know about Vue Router, current customer, pagination, or the slideover. |
| Local loading block | No public contract. | Three metric skeletons plus five compact row skeletons remain local because they are short, feature-specific markup with no behavior or reuse case. |
| Local empty block | No public contract. | The single icon/copy block remains local; a separate component would add indirection without isolating logic. |
| Local error block | No public contract. | The normalized message and retry `UButton` remain local to the owner of `refetch`. The 403 toast branch is orchestration, not a reusable error component. |
| `CustomerCard.vue` | Adds optional `canReadSales?: boolean`; adds emit `'view-history': [Customer]`. Existing `customer`, `canUpdate`, `canDelete`, `edit`, `delete`, and `click` contracts remain. | Owns one card and its kebab. It is visible when any update, delete, or sales-history action is allowed; card click behavior remains byte-for-byte conceptually unchanged. |
| `CustomerCardGrid.vue` | Adds optional `canReadSales?: boolean`; forwards `'view-history': [Customer]`. All existing contracts remain. | Remains a presentational grid and explicit event relay; component events do not bubble automatically. |
| `CustomersView.vue` | Internal state only: `historyCustomer: Customer \| null`, `isHistoryOpen: boolean`. | Remains the customer-list composition surface. It decides permissions and which customer opens, while the slideover owns sales-history behavior. |

All new Vue files use Composition API with `<script setup lang="ts">`, typed props/emits, props-down/events-up, and derived `computed` values. New replace-only primitive/object state should use `shallowRef`; no duplicated watcher-assigned derived state is needed.

## 3. Backend-derived contracts

### 3.1 Runtime schema and DTO shapes

`src/features/POS/sales/interfaces/sale.types.ts` gains a small Zod boundary for the newly deployed, mandatory summary. The current `saleApi.listConfirmed` path otherwise uses TypeScript DTOs and does not parse the complete list payload at runtime, so this design does not introduce a second full row schema that would duplicate the existing sale constant unions. The query parses `response.summary` with `SaleListSummarySchema`; an absent/malformed summary fails closed into the error state instead of silently deriving totals from rows.

```ts
import { z } from 'zod'

export const SaleListSummarySchema = z.object({
  salesCount: z.number().int(),
  totalSoldCents: z.number().int(),
  outstandingDebtCents: z.number().int(),
})

export type SaleListSummary = z.infer<typeof SaleListSummarySchema>

export interface ConfirmedSaleRow {
  id: string
  folio: string | null
  status: SaleStatus
  paymentStatus: SalePaymentStatus | null
  deliveryStatus: SaleDeliveryStatus
  totalCents: number
  debtCents: number
  confirmedAt: string | null
  dueDate: string | null
  customer: SaleActorRef | null
  cashier: SaleActorRef
  seller: SaleActorRef | null
  paymentMethods: SaleDetailPaymentMethod[]
}

export interface ConfirmedSalesListResponse {
  data: ConfirmedSaleRow[]
  pagination: SalesListPagination
  counts: SalesListCounts
  summary: SaleListSummary
}
```

The summary fields are required and non-null. Backend guarantees `summary.salesCount === pagination.total === counts.all`, confirmed-only aggregation, and zero values for no matches. The UI does not attempt to repair an invariant violation.

`CustomerSalesHistoryParams` is the key/query-owned subset and has no extended filters:

```ts
export type CustomerSalesHistoryParams = Required<
  Pick<ListSalesParams, 'page' | 'limit' | 'sortBy' | 'sortOrder'>
>
```

Its runtime value is always:

```ts
{
  page,
  limit: 10,
  sortBy: 'confirmedAt',
  sortOrder: 'desc',
}
```

The API-bound object adds `customerId: [customerId]` and adds nothing else. It never contains `status` or `customerIncludeNull`.

### 3.2 Nullability ripple and fallbacks

Inventory of production `ConfirmedSaleRow` consumers found before widening:

| Consumer | Nullable fields used | Required remediation |
| --- | --- | --- |
| `sales/components/SaleCard.vue` | `folio`, `confirmedAt` | Guard before calling `extractFolioNumber`/`formatSaleDate`; render `Sin folio` and `Fecha no disponible` fallbacks. |
| `sales/views/SalesListView.vue` | `folio`, `confirmedAt`, `paymentStatus` | Apply the same folio/date guards; map null payment status to a neutral `Sin estado` badge. |
| `sales/composables/useSalesColumns.ts` | Accessor typing only | No rendering or runtime change. |
| `sales/components/SaleCardGrid.vue` | Pass-through only | No rendering or runtime change. |
| New `SalesHistoryList.vue` | All three | Render `Sin folio`, `Fecha no disponible`, and neutral `Sin estado`; generate its accessible name from those same labels. |

`formatSaleDate`, `extractFolioNumber`, and `getPaymentStatusBadge` keep their existing non-null/string contracts. Callers guard nulls rather than weakening shared utility semantics.

Required response-fixture updates include:

- `sales/interfaces/__tests__/sale.types.test.ts`
- `sales/api/__tests__/sale.api.test.ts` (all five `ConfirmedSalesListResponse` fixtures)
- `sales/composables/__tests__/useConfirmedSales.test.ts`
- `sales/views/__tests__/SalesListView.persistence.test.ts`

Existing row fixtures remain valid because widening accepts their current non-null values; adjacent null tests are added to `SaleCard` and `SalesListView` coverage.

## 4. TanStack Query contract

### 4.1 Centralized keys

`src/core/shared/constants/query-keys.ts` follows the existing `saleQueryKeys` factory shape exactly and adds:

```ts
customerHistoryPrefix: (tenantId: string, customerId: string) =>
  ['sales', tenantId, 'customer-history', customerId] as const,

customerHistory: (
  tenantId: string,
  customerId: string,
  params: CustomerSalesHistoryParams,
) => ['sales', tenantId, 'customer-history', customerId, params] as const,
```

Every result dependency is serializable and present: tenant, customer, page, limit, sort field, and sort order. Customer history never reuses `saleQueryKeys.confirmed`, so the compact history and general list cannot overwrite one another.

### 4.2 Composable API

`useCustomerSalesHistory.ts` accepts reactive inputs through one options object:

```ts
interface UseCustomerSalesHistoryOptions {
  customerId: MaybeRefOrGetter<string | null | undefined>
  page: MaybeRefOrGetter<number>
  open: MaybeRefOrGetter<boolean>
}
```

It reads `authStore.currentTenantId` internally and returns focused readonly query state:

```ts
{
  response,          // ComputedRef<ConfirmedSalesListResponse | undefined>
  isLoading,         // initial load or guarded customer switch
  isFetching,        // includes background/page transition
  isPageTransition,  // same-customer placeholder page is visible
  isError,
  error,
  refetch,
}
```

Query options:

```ts
{
  queryKey: computed(() =>
    saleQueryKeys.customerHistory(tenantId, customerId, params.value)),
  enabled: computed(() => open && Boolean(tenantId) && Boolean(customerId)),
  staleTime: 30_000,
  placeholderData: keepPreviousData,
  retry: (failureCount, error) =>
    ![400, 401, 403].includes(httpStatus(error)) && failureCount < 2,
}
```

The query function snapshots the non-empty customer ID, calls the unmodified `saleApi.listConfirmed`, validates `response.summary` with `SaleListSummarySchema`, and returns an internal cache entry:

```ts
interface CustomerHistoryCacheEntry {
  ownerCustomerId: string
  response: ConfirmedSalesListResponse
}
```

### 4.3 Cross-customer render guard

`keepPreviousData` is useful between pages of the same customer but unsafe between two customer keys because the wire response has no requested-customer discriminator. The exposed `response` therefore returns data only when:

```ts
entry.ownerCustomerId === currentCustomerId
```

Consequences:

- Page 1 → page 2 for the same customer may display the previous list while fetching; summary remains visible and pagination is disabled.
- Customer A → customer B never renders A's metrics or rows. While B is pending, `response` is `undefined` and the initial skeleton state appears.
- A late response remains isolated in A's tenant/customer/page cache key and cannot become B's visible response.

### 4.4 Cache invalidation and mutation strategy

This surface is read-only: it introduces no `useMutation`, optimistic write, rollback context, or `setQueryData` path.

- Closing or reopening the slideover does **not** invalidate. The enabled guard stops inactive fetching and `staleTime: 30_000` supports quick reopen.
- Changing page uses a distinct key and `keepPreviousData`.
- Current customer create/update/delete mutations do not invalidate history; they do not change confirmed sale financials.
- A future payment, sale-cancellation, or customer-history mutation must invalidate `saleQueryKeys.customerHistoryPrefix(tenantId, customerId)` and the affected `saleQueryKeys.detail(tenantId, saleId)`. That mutation is outside this change; no speculative mutation code is added now.
- Stale history after an out-of-scope mutation elsewhere is bounded by 30 seconds until those flows adopt the prefix invalidation contract.

## 5. Data flow

```text
Table dropdown / card kebab: "Ver historial de ventas"
                         |
                         | read:Sale allowed
                         v
CustomersView.handleOpenHistory(customer)
                         |
                         +--> historyCustomer = customer
                         +--> isHistoryOpen = true
                                      |
                                      v
CustomerSalesHistorySlideover(open, customer)
  page = 1 -- customer change resets page ----+
      |                                       |
      +--> useCustomerSalesHistory            |
            enabled = open && tenant && id    |
            key = sales/tenant/customer-history/id/params
            GET /sales?customerId=[id]&page&limit=10
                       &sortBy=confirmedAt&sortOrder=desc
                                      |
                                      v
              owner-customer render guard
                         |
          +--------------+----------------+
          |                               |
          v                               v
SalesHistoryMetrics(summary only)   SalesHistoryList(data)
                                          |
                    UPagination page -----+-- refetch new key
                                          |
                    row select -----------+--> router.push({
                                                name: 'pos-sale-detail',
                                                params: { id: sale.id }
                                              })
```

The customer ID is an array only at the `ListSalesParams` API boundary because that existing type models CSV-capable filters. The centralized key stores the scalar customer ID once.

## 6. Permission and entry design

### 6.1 Permission matrix

| User action / surface | CASL check | Behavior without permission |
| --- | --- | --- |
| Table action “Ver historial de ventas” | `authStore.userCan('read', 'Sale')` in `CustomersView.vue` | Action absent. |
| Card action “Ver historial de ventas” | `canReadSales` prop derived from the same check | Action absent. |
| Customer kebab visibility | Any of `update:Customer`, `delete:Customer`, `read:Sale` | Kebab absent only when all three are false. |
| Call `GET /sales?customerId=…` | Backend `read:Sale`; frontend enabled only through gated entry | A defensive 403 is toasted and the panel closes. |
| Select history row / visit `pos-sale-detail` | Existing route meta `['read', 'Sale']` | Entry is already gated; the existing route guard remains authoritative. |
| Edit customer | Existing `update:Customer` | Unchanged. |
| Delete customer | Existing `delete:Customer` | Unchanged. |
| Create customer | Existing `create:Customer` | Unchanged. |

No CASL action, subject, ability registry, route, navigation registry, or sidebar entry changes.

### 6.2 Entry wiring

`CustomersView.vue` adds:

```ts
const canReadSales = computed(() => authStore.userCan('read', 'Sale'))
const canShowCustomerActions = computed(
  () => canUpdate.value || canDelete.value || canReadSales.value,
)
```

The normal dropdown group includes the history action when `canReadSales` is true; destructive delete remains in its existing separate group. `CustomerCard` includes the same normal action and emits `view-history`. `CustomerCardGrid` explicitly forwards both the prop and event.

`historyCustomer`/`isHistoryOpen` are independent from `selectedCustomer`, `selectedCustomerId`, `isEditOpen`, and form errors. Existing `handleCardClick` still opens edit exactly as before; the history is available only through the explicit kebab action.

## 7. Surface layout and visual treatment

### 7.1 Slideover shell

Use Nuxt UI's existing `USlideover` with `side="right"` and `inset`. The width class follows the repository's responsive `sm:max-w-*` pattern used by `PaymentModal.vue`, while applying the selected exact cap:

```vue
:ui="{
  content: 'w-full !max-w-none sm:!max-w-[520px]',
  body: 'p-0',
}"
```

The base class makes the same right-side panel fill narrow screens. At `sm` and wider it caps at 520px. It remains a lateral slideover at every width; there is no `UDrawer`, breakpoint branch, or bottom-sheet conversion.

The panel uses a fixed identity header, scrollable body, and compact footer/pagination region. The header combines `EntityAvatar`, “Historial de ventas”, customer full name, and an icon-only `UButton` labelled “Cerrar historial de ventas”. The default Nuxt UI dialog title contract is retained so the rendered dialog has an accessible name.

### 7.2 Information hierarchy

The visual direction is a quiet point-of-sale ledger using existing Coco semantic tokens and typography; no new palette, font, global CSS, gradient, or decorative motion is introduced. The focal element is a single three-cell metric band:

- “Ventas confirmadas” — count with tabular numerals.
- “Total vendido” — `formatCentsMXN(summary.totalSoldCents)`.
- “Saldo pendiente” — `formatCentsMXN(summary.outstandingDebtCents)`.

The metric cells stack on narrow screens (`grid-cols-1 sm:grid-cols-3`) and sit in one row inside the 520px panel. Debt greater than zero uses the existing error/warning semantic tokens, warning icon, and `AppBadge` “Con saldo pendiente”; zero debt with at least one sale uses success/neutral treatment and `AppBadge` “Al corriente”. This ledger band is the only emphasized visual gesture; list rows remain restrained.

The compact list is a semantic `<ul>`. Each `<li>` contains one full-width native button with folio/date on the first line and total/debt/payment `StatusDotBadge` on the second. A decorative chevron indicates navigation. `AppDataTable` is explicitly not used: its toolbar, column system, selection, and desktop density solve a different full-page problem.

Pagination uses existing `UPagination` conventions (`v-model:page`, `items-per-page=10`, `total=response.pagination.total`, `show-edges`, `sibling-count=1`) and is disabled while fetching. Page-size selection is intentionally absent because v1 is locked to 10.

## 8. State, errors, and concurrency

State priority in `CustomerSalesHistorySlideover` is: defensive 403 side effect, visible error, initial loading, successful summary with either empty or list.

| State | Detection | Render and behavior |
| --- | --- | --- |
| Closed / no customer | `!open` or `customer == null` | Query disabled; no request. No invalidation. |
| Initial loading | Enabled, no guarded response, fetching, not error | Body has `aria-busy="true"`; render three metric skeletons and five list-row skeletons. No stale customer identity data is shown. |
| Same-customer page transition | Guarded response exists and `isPageTransition`/`isFetching` | Keep prior summary and rows visible, set list region `aria-busy="true"`, visually soften it, and disable pagination until the requested page settles. |
| Empty / tenant-safe empty | Successful response and `summary.salesCount === 0` | Render zero metrics, then icon plus exact copy “Este cliente aún no tiene ventas confirmadas.” with `role="status"`. A 200-zero response for another tenant is indistinguishable and is not an error. |
| Data | Successful response and `summary.salesCount > 0` | Render metrics from `summary`, rows from `data`, and pagination from `pagination`. Do not sum rows or recompute `debtCents`. |
| 400 / 5xx / transport / invalid summary | Query error other than handled 401/403 | `normalizeApiError(error, 'No se pudo cargar el historial de ventas. Reintenta.')`; render its message inside `role="alert"` with `UButton` “Reintentar” calling `refetch`. |
| 401 | Final unrecoverable auth failure | Follow the repository-wide convention: `http.ts` attempts token refresh; on missing/failed refresh it emits the session-expired event, and `main.ts` clears the session then `router.replace('/login?redirect=…')`. The slideover does not add a competing local login redirect. |
| 403 | Stale permissions or defensive backend rejection | The action is normally absent. If 403 still arrives, show one error toast (“Sin permiso para ver ventas”) with description from `normalizeApiError`, emit `update:open(false)`, and do not retry automatically. |

The 403 watcher must deduplicate by error object/query transition so rerenders cannot repeat the toast. Closing does not clear TanStack cache. Changing customer resets page to 1 before enabling the new key; the cache-entry owner guard prevents cross-customer placeholder leakage.

## 9. Accessibility

- `USlideover` provides `role="dialog"`, modal focus management, Escape dismissal, overlay handling, and focus trapping. Its title/description contract supplies the accessible name; the close button has an explicit label.
- `SalesHistoryMetrics` uses one `<dl>` with three `<div><dt><dd>` groups. The debt cell uses `aria-live="polite"` when debt is positive; visual color is never the only signal because its badge and icon carry text.
- Each sale row is a native `<button type="button">`, not a clickable `<div>`. Its generated label follows the binding handoff pattern, for example: “Venta folio A-202608-000042 del 30 ago 2026 por $1,800.00 con saldo de $500.00”. Null values become “sin folio” / “fecha no disponible” / “sin estado”, never an empty accessible name.
- Keyboard users can tab through rows, pagination, retry, and close controls with the existing Nuxt UI/native focus styles.
- Initial loading and page transitions expose `aria-busy="true"`; skeletons themselves are `aria-hidden="true"`.
- Empty copy has `role="status"`; its icon is decorative (`aria-hidden="true"`).
- Error content has `role="alert"` and a keyboard-operable retry button.
- Motion remains owned by `USlideover`; no custom animation is added, preserving the library's reduced-motion behavior.

## 10. Reused primitives and why

| Existing primitive / utility | Use |
| --- | --- |
| `USlideover` | Existing right overlay, dialog semantics, focus trap, Escape, portal, and responsive width support. |
| `EntityAvatar` | Deterministic customer identity in the panel header without a new avatar implementation. |
| `formatCentsMXN` | Canonical es-MX/MXN cents formatting for metrics, rows, and accessible names. |
| `formatSaleDate` | Existing sale event-date formatting; callers guard nullable `confirmedAt`. |
| `getPaymentStatusBadge` | Existing paid/partial/credit label and tone mapping; null gets an explicit local neutral fallback. |
| `AppBadge` | “Con saldo pendiente” / “Al corriente” textual metric state. |
| `StatusDotBadge` | Compact payment status in each history row. |
| `UButton` | Close, retry, and row affordances with established styling/focus behavior. |
| `UPagination` | Existing 1-based compact pagination behavior; no page-size dropdown. |
| `normalizeApiError` | Array-safe/domain-safe backend message extraction with a Spanish fallback. |
| `saleApi.listConfirmed` | Existing unwrapped GET `/sales` adapter; no API method or transport change. |
| `mountWithUApp` | Real Nuxt UI providers/portal behavior in slideover and dropdown tests. |
| Named route `pos-sale-detail` | Existing sale detail and its `read:Sale` route guard. |

No new dependency, shared overlay, table abstraction, formatter, badge, CASL subject, or route is introduced.

## 11. File change plan

### New production files

- `src/features/POS/sales/composables/useCustomerSalesHistory.ts`
- `src/features/POS/customers/components/CustomerSalesHistorySlideover.vue`
- `src/features/POS/customers/components/SalesHistoryMetrics.vue`
- `src/features/POS/customers/components/SalesHistoryList.vue`

### Modified production files

- `src/features/POS/sales/interfaces/sale.types.ts` — summary Zod/type, required response field, nullable row fields, history params type.
- `src/core/shared/constants/query-keys.ts` — history prefix/page factories.
- `src/features/POS/sales/components/SaleCard.vue` — null-safe folio/date fallbacks only.
- `src/features/POS/sales/views/SalesListView.vue` — null-safe folio/date/payment fallbacks only.
- `src/features/POS/customers/views/CustomersView.vue` — permission, state, table/card entry, slideover composition.
- `src/features/POS/customers/components/CustomerCard.vue` — permission prop, menu action, event, visibility rule.
- `src/features/POS/customers/components/CustomerCardGrid.vue` — prop/event forwarding.

No production change is needed in `sale.api.ts`, router, navigation registry, ability registry, auth subject types, or `AppDataTable`.

### Tests and fixtures

- Extend `src/core/shared/constants/__tests__/query-keys.test.ts`.
- Add `src/features/POS/sales/composables/__tests__/useCustomerSalesHistory.test.ts`.
- Add focused component specs beside the three new customer components; use ordinary mount for pure metrics/list and `mountWithUApp` plus `attachTo: document.body`, `VueQueryPlugin`, retries disabled, and document-level portal queries for the slideover.
- Extend existing `CustomerCard.spec.ts`, `CustomerCardGrid.spec.ts`, and `CustomersView.test.ts` permission/event tests.
- Update the response fixtures listed in §3.2 and add null fallback tests to `SaleCard.test.ts` and `SalesListView.test.ts`.

## 12. Test design

Strict TDD slices remain for tasks phase, but the design pins these behaviors:

1. **Contract and key tests**
   - `SaleListSummarySchema` accepts the exact three integer fields and rejects missing summary data.
   - `ConfirmedSalesListResponse.summary` is required.
   - `ConfirmedSaleRow` accepts null folio/payment status/confirmation date.
   - History key equals `['sales', tenantId, 'customer-history', customerId, params]` and differs by tenant, customer, and page.

2. **Composable tests**
   - Closed, absent-customer, and absent-tenant inputs make zero API calls.
   - Open input sends exactly `{ customerId: [id], page, limit: 10, sortBy: 'confirmedAt', sortOrder: 'desc' }`; `status` and `customerIncludeNull` are absent.
   - The full response, including summary, is exposed; missing summary enters error.
   - Quick close/reopen inside 30 seconds reuses fresh cache without invalidation.
   - Same-customer page change keeps placeholder response and identifies a page transition.
   - Switching A → B while B is pending exposes no A response.

3. **Pure presentation tests**
   - Metrics render wire values and MXN formatting; a deliberately contradictory row list cannot affect them.
   - Positive debt gets warning/error text treatment; zero debt with sales gets “Al corriente”.
   - List renders compact fields, null fallbacks, payment badges, exact accessible labels, and emits `select`.

4. **Slideover integration tests**
   - Real teleported panel renders at the responsive width class and exposes accessible dialog behavior through `UApp`.
   - Initial skeleton has three metric and five row placeholders with `aria-busy`.
   - 200-zero summary renders the exact empty copy with `role=status`, not the error block.
   - Error uses `normalizeApiError`, `role=alert`, and retry calls `refetch`.
   - 403 emits one toast and closes; no action should normally reach this branch.
   - Page control changes the query page while keeping same-customer summary visible.
   - Row selection calls `router.push({ name: 'pos-sale-detail', params: { id } })`.

5. **Entry tests**
   - `read:Sale` only: table and card kebabs and history actions are visible even without update/delete customer permissions.
   - update/delete customer only: kebab remains for those actions but history is absent.
   - no three permissions: kebab is absent.
   - Grid forwards `canReadSales` and `view-history` exactly once.
   - Card kebab click still does not bubble; ordinary card click behavior remains unchanged.

Slice gates use `pnpm test:unit --run`; slice completion also runs `pnpm type-check`, and final verification runs `pnpm build`.

## 13. Risks resolved by this design

| Risk | Resolution |
| --- | --- |
| Required backend summary is not deployed | Parse the mandatory summary and fail into a clear retryable error. Never create a row-sum fallback. Deploy backend first. |
| `ConfirmedSaleRow` nullability breaks existing consumers | Inventory is explicit; only `SaleCard` and `SalesListView` need local formatting guards, while pass-through/accessor consumers remain unchanged. |
| `keepPreviousData` leaks customer A into customer B | Cache entries carry `ownerCustomerId`; the exposed response must match the current customer. Same-customer page placeholders remain allowed. |
| Metrics drift across pages | Metrics always come from the guarded current response summary; same-customer placeholder keeps the prior backend summary until the next backend summary arrives. Rows are never aggregated. |
| Anonymous sales contaminate a customer | The composable's exact request whitelist omits `customerIncludeNull` and tests assert it is absent. |
| Permission-only users lose the kebab | Visibility is the union of update/delete/read-sales, not a customer-mutation-only gate. |
| Dense panel becomes a miniature desktop table | Use a semantic compact list and `UPagination`; explicitly exclude `AppDataTable`. |
| Mobile changes interaction model | Use one right `USlideover`; base `w-full`, `sm` 520px cap, no drawer branch. |
| Auth handling competes with global session handling | 401 remains in the HTTP interceptor/session-event pipeline; only defensive 403 gets a local toast/close. |
| Scope expands into authorization or navigation | Reuse `Sale` and `pos-sale-detail`; no router, sidebar, or CASL registry files change. |

## 14. Rollout and rollback

1. Backend must deploy the additive `summary` response before the frontend action is released.
2. Validate staging with: a customer with paid sales, a customer with partial/credit debt, a customer with zero confirmed sales, a user with `read:Sale` only, and a user without `read:Sale`.
3. Confirm the request query string omits `status` and `customerIncludeNull` and that `summary.salesCount === pagination.total === counts.all` on at least two pages.
4. No data migration or feature flag is required. Removing `read:Sale` is an operational soft kill because it hides both entries.
5. Code rollback is additive and linear: remove the entries/surface/composable/key and revert the required summary/nullability contract plus fixture changes together. If backend summary is rolled back, frontend must also roll back; it must not introduce a fallback aggregate.

The 400-line delivery budget is evaluated in tasks phase. Contract/query, surface, and entry work remain separable TDD slices so an over-budget forecast can be chained without changing this architecture.
