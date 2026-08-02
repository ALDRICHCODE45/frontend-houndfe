# Exploration: Quotations (Cotizaciones) — Frontend Integration

> Date: 2026-08-01
> Backend branch: `feat/quotations`
> Backend doc: `houndfe-backend/docs/quotations-frontend.md`

## Executive Summary

The backend provides 15 REST endpoints for the Quotations module with lifecycle DRAFT → SENT → EXPIRED/CANCELLED. The frontend needs a new feature module under `src/features/POS/quotations/` following established conventions. Key reusable assets already exist: customer selector (`AssignCustomerSlideover`), product search panel (`ProductSearchPanel`), price list selector (`PriceListSelector`), PDF blob preview pattern (`SaleDetailView`), status badges (`StatusDotBadge`/`AppBadge`), confirm modals (`ConfirmModal`), and currency formatters (`formatCentsMXN`). The `Quotation` subject must be registered in CASL (ability.ts) before the module works.

---

## 1. Feature Module Pattern

### 1.1 Canonical Folder Layout

Both `src/features/POS/sales/` and `src/features/admin/employees/` follow the exact same convention:

```
src/features/POS/quotations/
├── api/
│   └── quotation.api.ts          # API functions (like sale.api.ts)
├── interfaces/
│   └── quotation.types.ts        # DTOs, enums, shapes
├── constants/
│   └── quotation.constants.ts    # SCREAMING_SNAKE_CASE value objects
├── composables/
│   ├── useQuotationsList.ts      # List with pagination/search/filter
│   ├── useQuotationDraft.ts      # Draft mutations (items, promos, send, cancel)
│   └── useQuotationDetail.ts     # Single quotation detail query
├── views/
│   ├── QuotationsListView.vue    # List view (table + card toggle)
│   └── QuotationDraftView.vue    # Draft editing workbench (the main screen)
├── components/
│   ├── QuotationItemRow.vue      # Single item line with price/badges
│   ├── QuotationStatusBadge.vue  # DRAFT/SENT/EXPIRED/CANCELLED pill
│   ├── QuotationTotalsFooter.vue # Subtotal/Discount/Total summary
│   └── ...                       # Send confirmation dialog, cancel reason dialog
├── utils/
│   ├── currency.utils.ts         # Re-export from core if needed
│   └── quotation.utils.ts        # Status-to-badge-tone, lazy expiry check
└── __tests__/                    # Co-located per SDD convention
```

**Observed evidence:**
- `src/features/POS/sales/` — 8 subdirectories: `api/`, `components/`, `composables/`, `config/`, `constants/`, `interfaces/`, `utils/`, `views/`
- `src/features/admin/employees/` — 8 subdirectories: `__tests__/`, `api/`, `components/`, `composables/`, `constants/`, `interfaces/`, `utils/`, `views/`

### 1.2 Index / Barrel Files

Neither the `sales` nor `employees` modules use `index.ts` barrel files. Imports go directly to the specific file (e.g., `from '../api/sale.api'`). Do NOT add barrel files — follow existing convention.

---

## 2. API Layer

### 2.1 HTTP Client

**File:** `src/core/shared/api/http.ts`
- Default base URL: `VITE_API_BASE_URL` env var, fallback `http://localhost:3000`
- JWT bearer token auto-injected via request interceptor
- Automatic 401 → refresh → retry via interceptor
- No-cache headers on authenticated GETs
- Parameter serializer: `csvParamsSerializer`

**File:** `src/core/shared/api/queryClient.ts`
- Shared `QueryClient` instance
- Default: `retry: false`, `staleTime: 0`

### 2.2 API Function Pattern

Same as `src/features/POS/sales/api/sale.api.ts`:
```typescript
import { http } from '@/core/shared/api/http'

export const quotationApi = {
  async createDraft(payload: { customerId?: string }): Promise<Quotation> {
    const { data } = await http.post<Quotation>('/quotations/drafts', payload)
    return data
  },
  async list(params: ListParams): Promise<...> {
    const { data } = await http.get<...>('/quotations', { params })
    return data
  },
  // ... etc
}
```

**Key conventions observed:**
- Export a single `quotationApi` object with all methods
- Each method uses `http.<method>` with typed generic
- Backend errors are parsed from `AxiosError.response.data`
- Domain error classes extend `Error` with `code` property (e.g., `SalePdfError`)
- PDF blob endpoint uses `responseType: 'blob'`

### 2.3 TanStack Query Patterns

**Observed in** `src/features/POS/sales/composables/useSalesDrafts.ts`:

**Queries:**
```typescript
// With computed queryKey and reactive tenantId
const { data, isLoading } = useQuery({
  queryKey: computed(() => quotationQueryKeys.list(tenantId.value)),
  queryFn: () => quotationApi.list(params),
  enabled: computed(() => !!tenantId.value),
  placeholderData: keepPreviousData,
  staleTime: 30_000,
})
```

**Mutations (optimistic cache update):**
```typescript
const addItemMutation = useMutation({
  mutationFn: ({ id, payload }) => quotationApi.addItem(id, payload),
  onSuccess: (updatedQuotation) => {
    const current = queryClient.getQueryData<Quotation[]>(draftsKey.value) ?? []
    queryClient.setQueryData(draftsKey.value, replaceInCache(current, updatedQuotation))
  },
})
```

**Query key factory pattern** in `src/core/shared/constants/query-keys.ts`:
```typescript
// Will add:
export const quotationQueryKeys = {
  list: (tenantId: string) => ['quotations', tenantId, 'list'] as const,
  detail: (tenantId: string, id: string) => ['quotations', tenantId, 'detail', id] as const,
  drafts: (tenantId: string) => ['quotations', tenantId, 'drafts'] as const,
}
```

### 2.4 PDF Blob Pattern

**Observed in** `src/features/POS/sales/views/SaleDetailView.vue:209-246`:
```typescript
async function handlePreviewPdf() {
  const blob = await quotationApi.getPdfBlob(id, 'quotation-a4', { signal: controller.signal })
  const objectUrl = URL.createObjectURL(blob)
  window.open(objectUrl, '_blank')
  // Revoke after 1s grace period
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
}
```

---

## 3. CASL Permissions

### 3.1 Ability Definition

**File:** `src/features/auth/authorization/ability.ts`

The `APP_SUBJECTS` array must be extended with `'Quotation'`:
```typescript
const APP_SUBJECTS: AppSubject[] = [
  // ... existing subjects
  'Quotation',  // ← NEW
  'all',
]
```

### 3.2 Permission Format

Backend sends permission codes as `"action:Subject"` (e.g., `"read:Quotation"`, `"create:Quotation"`, `"update:Quotation"`, `"delete:Quotation"`). The `parsePermissionCode()` function splits on `:` and maps to `can(action, subject)`.

### 3.3 Usage in Components

**Observed in** `src/features/admin/employees/views/EmployeesListView.vue:82-89`:
```typescript
const canCreate = computed(() => authStore.userCan('create', 'Employee'))
const canUpdate = computed(() => authStore.userCan('update', 'Employee'))
```

**In templates:**
```html
<UButton v-if="canCreate" @click="openCreateSlideover">Nueva cotización</UButton>
```

**Route-level permission via meta:**
```typescript
{
  path: '/pos/cotizaciones',
  name: 'pos-quotations-list',
  component: QuotationsListView,
  meta: {
    layout: 'dashboard',
    permission: ['read', 'Quotation'] as RoutePermission,
  },
}
```

### 3.4 Permission Check in Auth Store

**Observed in** `src/features/auth/stores/useAuthStore` (via usage: `authStore.userCan(action, subject)`). The `userCan` method wraps `ability.can(action, subject)`.

---

## 4. Reusable UI Components

### 4.1 Customer Selector

**File:** `src/features/POS/sales/components/AssignCustomerSlideover.vue`
- Slideover with customer search + inline creation
- Uses `customerApi.getPaginated()` + local filter
- Emits: selects customer → parent calls API
- Reusable as-is: the quotation flow needs customer assignment (same backend contract)

**Customer API:** `src/features/POS/customers/api/customer.api.ts`
- `getPaginated(params)`, `getById(id)`, `create(payload)`

### 4.2 Product Search / Selector

**Files:**
- `src/features/POS/sales/components/ProductSearchPanel.vue` — search input + category chips + results grid
- `src/features/POS/sales/components/ProductSearchResults.vue` — grid display of `PosCatalogItem`
- `src/features/POS/sales/components/ProductSearchResultItem.vue` — individual card
- `src/features/POS/sales/components/VariantPickerModal.vue` — variant selector when product has variants
- `src/features/POS/sales/composables/useProductSearch.ts` — search logic with debounce, categories

These use the POS catalog endpoint (`GET /sales/pos-catalog`), NOT the quotation endpoint. For quotations, the `POST /quotations/drafts/:id/items` endpoint takes `productId`, `variantId`, `quantity`. The product/variant selection UI can reuse `ProductSearchPanel` + `VariantPickerModal` as-is, or be wrapped in a `QuotationProductSearch` adapter that calls `quotationApi.addItem()` instead of `saleApi.addItem()`.

### 4.3 Price List Selector

**File:** `src/features/POS/sales/components/PriceListSelector.vue`
- Dropdown menu with PUBLICO default + custom price lists
- Fetches from `GET /products/global-price-lists`
- Emits `change-price-list` or `request-confirm` (for non-empty carts)
- **Reusable as-is** for quotation drafts (same backend contract: `PUT /quotations/drafts/:id/price-list`)

### 4.4 Table / List View

**File:** `src/core/shared/components/DataTable/` — `AppDataTable` component
- Used by `EmployeesListView.vue` via `<AppDataTable>`
- Supports: pagination, row selection, bulk actions, custom column templates, loading/fetching states, empty state

**Observed pattern** in `EmployeesListView.vue:438-570`:
```html
<AppDataTable
  v-if="viewMode === 'table'"
  v-model:pagination="pagination"
  v-model:row-selection="rowSelection"
  :columns="columns"
  :data="employees"
  :loading="isLoading"
  :fetching="isFetching"
  :page-count="pageCount"
  :total-count="totalCount"
  :showing-from="showingFrom"
  :showing-to="showingTo"
  :page-size-options="[10, 20, 50]"
  :bulk-actions="bulkActions"
  empty="No se encontraron cotizaciones"
>
  <template #status-cell="{ row }">
    <StatusDotBadge :tone="statusConfig[row.original.status].tone" :label="statusConfig[row.original.status].label" />
  </template>
</AppDataTable>
```

**Data table composables:**
- `src/core/shared/composables/useServerTable.ts` — full server-side table (used by `useConfirmedSales`)
- For simpler list pages (like employee list), direct `useQuery` + `refDebounced` + manual `page`/`pageSize` state is the pattern (`useEmployeesList.ts`).

### 4.5 Status Badges

**Files:**
- `src/core/shared/components/StatusDotBadge.vue` — outlined pill with colored dot (e.g., "● Activo")
- `src/core/shared/components/AppBadge.vue` — colored badge (`success`, `warning`, `error`, `info`, `neutral`, + aliases `active`→`success`, `pending`→`warning`, `inactive`→`error`)
- `src/core/shared/utils/badge.utils.ts` — `badgeToneToColor()`, `toneToDotClass()`, `AppBadgeTone` type

**For quotations statuses, define mappings:**
| Status     | Tone      | Label       |
|------------|-----------|-------------|
| DRAFT      | `info`    | Borrador    |
| SENT       | `success` | Enviada     |
| EXPIRED    | `warning` | Expirada    |
| CANCELLED  | `error`   | Cancelada   |

### 4.6 Confirm Modal

**File:** `src/core/shared/components/ConfirmModal.vue`
- Uses Nuxt UI `UModal`
- Props: `open`, `title`, `description`, `confirmLabel`, `confirmColor`, `loading`, `items[]`
- Emits: `confirm`, `cancel`, `update:open`

**Observed usage in** `EmployeesListView.vue:624-634`:
```html
<ConfirmModal
  v-model:open="isCancelOpen"
  title="Cancelar cotización"
  description="Selecciona el motivo de cancelación"
  confirm-label="Cancelar cotización"
  confirm-color="error"
  :loading="isPending"
  @confirm="handleCancelQuotation"
/>
```

### 4.7 Toast Notifications

**Pattern:** Nuxt UI `useToast()` with `declare const useToast` 
```typescript
declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}
// Usage:
useToast().add({ title: 'Cotización enviada', color: 'success' })
useToast().add({ title: 'Error', description: 'No se pudo cancelar', color: 'error' })
```

### 4.8 Entity Avatar

**File:** `src/core/shared/components/EntityAvatar.vue`
- Shows initials avatar with optional status dot
- Used in customer list, employee list

---

## 5. PDF Handling

### 5.1 Existing Pattern

**File:** `src/features/POS/sales/views/SaleDetailView.vue:209-246`

```typescript
async function handlePreviewPdf(format: SalePdfFormat) {
  const blob = await saleApi.getPdfBlob(saleId, format, { signal: controller.signal })
  const objectUrl = URL.createObjectURL(blob)
  const opened = window.open(objectUrl, '_blank')
  if (!opened) {
    // Popup blocked fallback: direct download via anchor click
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = `cotizacion-${id}.pdf`
    link.click()
  }
  // Revoke after 1s
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
}
```

**API side** (`sale.api.ts:317-333`):
```typescript
async getPdfBlob(saleId: string, format: string, options?: { signal?: AbortSignal }): Promise<Blob> {
  const { data } = await http.get<Blob>(`/sales/${saleId}/pdf`, {
    params: { format },
    responseType: 'blob',
    timeout: 15_000,
    signal: options?.signal,
  })
  return data
}
```

### 5.2 Quotation PDF Endpoint

Backend endpoint: `GET /quotations/:id/pdf?format=quotation-a4`
- Returns `Content-Type: application/pdf` with `Content-Disposition: inline`
- Works in any status (DRAFT, SENT, EXPIRED, CANCELLED)
- Apply same blob + `URL.createObjectURL` + `window.open` pattern

---

## 6. Price Formatting

### 6.1 Canonical Currency Utilities

**File:** `src/core/shared/utils/currency.utils.ts`
- `formatCentsMXN(cents: number): string` — 4998 → "$49.98"
- `lineCents(unitPriceCents, quantity): number` — single line total in cents
- `sumLineCents(items): number` — sum line totals in cents
- `currencyToCents(amount: number): number` — major units → cents
- `normalizeDecimalInput(value: string): string` — "50,5" → "50.5"
- `currencyFormatter` — pre-built `Intl.NumberFormat('es-MX', MXN)`
- `CURRENCY_CONFIG` — `{ locale: 'es-MX', currency: 'MXN' }`

**Module-local re-export pattern** (`sales/utils/currency.utils.ts`):
```typescript
export { formatCentsMXN, lineCents, sumLineCents, normalizeDecimalInput, currencyToCents, currencyFormatter, CURRENCY_CONFIG } from '@/core/shared/utils/currency.utils'
```

### 6.2 Backend Contract

All monetary amounts in the Quotation API are in integer cents:
- `subtotalCents`, `discountCents`, `totalCents`
- Per item: `unitPriceCents`, `discountAmountCents`

Display: always use `formatCentsMXN()`.

---

## 7. Import / Navigation Patterns

### 7.1 Router

**File:** `src/app/router/index.ts`
- Routes use lazy imports: `const QuotationsListView = () => import('@/features/POS/quotations/views/QuotationsListView.vue')`
- Route meta uses `permission: [action, subject]` tuple
- Navigation guard auto-checks `authStore.userCan(action, subject)` against route meta

**Proposed routes:**
```typescript
{
  path: '/pos/cotizaciones',
  name: 'pos-quotations-list',
  component: () => import('@/features/POS/quotations/views/QuotationsListView.vue'),
  meta: {
    layout: 'dashboard',
    permission: ['read', 'Quotation'] as RoutePermission,
  },
},
{
  path: '/pos/cotizaciones/nueva',
  name: 'pos-quotation-create',
  component: () => import('@/features/POS/quotations/views/QuotationDraftView.vue'),
  meta: {
    layout: 'dashboard',
    permission: ['create', 'Quotation'] as RoutePermission,
  },
},
{
  path: '/pos/cotizaciones/:id',
  name: 'pos-quotation-detail',
  component: () => import('@/features/POS/quotations/views/QuotationDraftView.vue'),
  meta: {
    layout: 'dashboard',
    permission: ['read', 'Quotation'] as RoutePermission,
  },
},
```

### 7.2 Navigation Registry

**File:** `src/app/navigation/navigation.registry.ts` — sidebar items with permission gates. Add quotation item with `permission: 'Quotation'`.

---

## 8. Recommended Architecture

### 8.1 File Structure

```
src/features/POS/quotations/
├── api/
│   ├── quotation.api.ts               # All 15 API calls (mirrors sale.api.ts pattern)
│   └── __tests__/
│       └── quotation.api.test.ts
├── interfaces/
│   ├── quotation.types.ts             # Quotation, QuotationItem, Status enum, DTOs
│   └── __tests__/
│       └── quotation.types.test.ts
├── constants/
│   ├── quotation.constants.ts          # QUOTATION_STATUS (DRAFT/SENT/EXPIRED/CANCELLED), CANCEL_REASONS
│   └── __tests__/
│       └── quotation.constants.spec.ts
├── composables/
│   ├── useQuotationsList.ts            # Paginated list with filters (mirrors useEmployeesList.ts)
│   ├── useQuotationDraft.ts            # Draft CRUD: items, promos, send, cancel (mirrors useSalesDrafts)
│   ├── useQuotationDetail.ts           # Single quotation detail query
│   └── __tests__/
│       ├── useQuotationsList.test.ts
│       ├── useQuotationDraft.test.ts
│       └── useQuotationDetail.test.ts
├── views/
│   ├── QuotationsListView.vue          # Table view with status tabs, search, pagination
│   ├── QuotationDraftView.vue          # Draft edit workbench (items, customer, price list, promos, send/cancel)
│   └── __tests__/
│       ├── QuotationsListView.test.ts
│       └── QuotationDraftView.test.ts
├── components/
│   ├── QuotationItemRow.vue            # Item line: product name, qty controls, price, badges
│   ├── QuotationStatusBadge.vue        # Semantic badge for DRAFT/SENT/EXPIRED/CANCELLED
│   ├── QuotationTotalsFooter.vue       # Subtotal/Discount/Total bar
│   ├── QuotationSendConfirmation.vue   # Send confirmation dialog (email preview)
│   ├── QuotationCancelDialog.vue       # Cancel with reason selector
│   ├── QuotationExpiryPicker.vue       # Expiry date picker
│   └── __tests__/
│       ├── QuotationItemRow.test.ts
│       └── QuotationStatusBadge.test.ts
├── utils/
│   ├── currency.utils.ts               # Re-export from core
│   ├── quotation.utils.ts             # Status-to-tone mapping, lazy expiry check
│   └── __tests__/
│       └── quotation.utils.test.ts
```

### 8.2 Reusable Pattern: Re-import Existing Components

Instead of re-creating, **reuse** these existing components:
1. `AssignCustomerSlideover.vue` → customer selection (same API)
2. `ProductSearchPanel.vue` → product browsing (adapt add-item callback)
3. `PriceListSelector.vue` → price list picker (same API)
4. `ConfirmModal.vue` → confirm send/cancel
5. `StatusDotBadge.vue` → status display
6. `AppDataTable` → list view table
7. `formatCentsMXN` → price display

### 8.3 CASL Registration Required

Before any route or component works, add `'Quotation'` to `APP_SUBJECTS` in:
- `src/features/auth/authorization/ability.ts` — line 7-24

### 8.4 Query Keys

Add to `src/core/shared/constants/query-keys.ts`:
```typescript
export const quotationQueryKeys = {
  list: (tenantId: string) => ['quotations', tenantId, 'list'] as const,
  detail: (tenantId: string, id: string) => ['quotations', tenantId, 'detail', id] as const,
  pdf: (tenantId: string, id: string) => ['quotations', tenantId, 'pdf', id] as const,
}
```

### 8.5 UI Flow Architecture

The draft editing screen (`QuotationDraftView.vue`) is the most complex view. Follow the pattern from `SalesView.vue`:

```
QuotationDraftView (composition surface)
├── Header (customer info, status badge, price list, expiry)
├── Product search panel (reuse ProductSearchPanel → addItem)
├── Items list (QuotationItemRow × N)
├── Totals footer (subtotal, discount, total)
├── Promotions panel (reuse ApplicablePromotions list)
├── Action bar (Preview PDF, Send, Cancel)
└── Modals (ConfirmModal for send/cancel)
```

### 8.6 List View Architecture

Follow the exact pattern from `EmployeesListView.vue`:
```
QuotationsListView (composition surface)
├── Header (title, "Nueva cotización" button gated by create:Quotation)
├── Filters (status tabs: Todos / Borradores / Enviadas / Expiradas / Canceladas)
├── Search input with debounce
├── Table/Card view toggle
├── AppDataTable
│   └── Columns: Cliente, Total, Estado, Fecha, Vencimiento, Acciones
└── Row actions menu (Ver, Enviar, Cancelar — gated by status + permissions)
```

---

## 9. Key Risks & Considerations

### 9.1 Backend URL Structure

The quotation endpoints use `/quotations/drafts/:id/...` for draft-scoped operations. This differs from sales which uses `/sales/drafts/:id/...` — the pattern is consistent. The `quotationApi` object will mirror `saleApi` but with `/quotations` prefix.

### 9.2 No Stock Checks

Per backend doc: "NO hay validación de stock — la cotización es una promesa, no una reserva." The frontend should not display stock-related badges (unlike sales).

### 9.3 Lazy EXPIRED Transition

Per backend doc §7.4: the `SENT → EXPIRED` transition is lazy (happens on read). The frontend can pre-compute: `if status === 'SENT' && expiresAt && new Date(expiresAt) < Date.now()` → display as EXPIRED.

### 9.4 Manual Price Indicator

When `priceSource === 'CUSTOM'` and `manuallyAdjusted === true`, display an edit-icon badge. Pattern: reuse `SaleItemBadges.vue` logic (it already handles `priceSource === 'custom'` with "PRECIO MANUAL" badge at `src/features/POS/sales/components/SaleItemBadges.vue:64-76`).

### 9.5 Send Requires Customer Email

Per backend doc §7.2: verify `customer.email` before allowing send. If null, show dialog to capture email. This validation should be in the `QuotationSendConfirmation` component.

### 9.6 Cancel Requires Reason

The cancel endpoint requires `cancelReason` enum. The `QuotationCancelDialog` component should present a select/radio for `CUSTOMER_REQUEST | PRICE_OBJECTION | EXPIRED | OTHER`.

---

## 10. Testing Infrastructure

### 10.1 Test Runner

`pnpm test:unit` = vitest (per SDD config: strict TDD)

### 10.2 Existing Test Patterns

- API tests: `src/features/POS/sales/api/__tests__/sale.api.test.ts` — mock `http` Axios instance
- Component tests: use `@vue/test-utils` + `vi.mock` for TanStack Query, router, stores
- Composable tests: use `vi.mock` for API calls, test with reactive refs
- `__tests__/foundation.spec.ts` exists in several modules — test constants, type unions, utility functions

---

## 11. Summary of Reusable Assets

| Asset | File | Reuse Strategy |
|---|---|---|
| **HTTP client** | `src/core/shared/api/http.ts` | Direct import, no changes needed |
| **Query client** | `src/core/shared/api/queryClient.ts` | Direct import |
| **Customer selector** | `src/features/POS/sales/components/AssignCustomerSlideover.vue` | Reuse as-is or wrap |
| **Product search** | `src/features/POS/sales/components/ProductSearchPanel.vue` | Reuse as-is |
| **Variant picker** | `src/features/POS/sales/components/VariantPickerModal.vue` | Reuse as-is |
| **Price list selector** | `src/features/POS/sales/components/PriceListSelector.vue` | Reuse as-is |
| **Confirm modal** | `src/core/shared/components/ConfirmModal.vue` | Reuse as-is |
| **Status badge** | `src/core/shared/components/StatusDotBadge.vue` | Reuse, map quotation statuses to tones |
| **App badge** | `src/core/shared/components/AppBadge.vue` | Reuse for DRAFT/SENT/EXPIRED/CANCELLED pills |
| **Data table** | `src/core/shared/components/DataTable/` | Reuse AppDataTable for list views |
| **Currency formatter** | `src/core/shared/utils/currency.utils.ts` | Direct import (`formatCentsMXN`) |
| **PDF blob preview** | Pattern from `SaleDetailView.vue:209-246` | Copy pattern (blob → objectURL → window.open) |
| **Toast** | Nuxt UI `useToast()` | Direct use |
| **View toggle** | `src/core/shared/components/ViewToggle.vue` | Table/card toggle for list |
| **Entity avatar** | `src/core/shared/components/EntityAvatar.vue` | Customer display in list rows |
| **Sales item badges** | `src/features/POS/sales/components/SaleItemBadges.vue` | Copy price-source badge logic |
| **useServerTable** | `src/core/shared/composables/useServerTable.ts` | For list queries with full server-side sorting/filtering |
| **Table types** | `src/core/shared/types/table.types.ts` | `PaginatedResponse<T>`, `ServerTableParams`, `BulkAction<T>` |
