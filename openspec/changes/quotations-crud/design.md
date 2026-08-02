# Design: Quotations CRUD

## Technical Approach

Feature module at `src/features/POS/quotations/` following the established `sales`/`employees` conventions: API layer (`quotationApi` object), TanStack Query composables, two views (list + detail), focused child components. No Pinia store — all server state via TanStack Query, local form state in composables/views. After every mutation, `setQueryData` replaces cached state with the backend's complete response. Reuse `AssignCustomerSlideover`, `ProductSearchPanel`, `PriceListSelector`, `ConfirmModal`, `StatusDotBadge`, `AppDataTable`, `formatCentsMXN`.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Single DetailView with mode switch vs two views | One view: less duplication, clear DRAFT/non-DRAFT branching | Single `QuotationDetailView.vue` that reads `status` to toggle edit controls |
| `useQuotationDraft` for all mutations vs per-action composables | Monolithic: simpler test suite, single invalidation point. Per-action: better tree-shaking | `useQuotationDraft` — mirrors `useSalesDrafts` pattern |
| Stock badges: inline in item response vs separate product query | Inline: requires backend to include stock. Separate: more requests | Separate product stock query called per item on mount, cached per product — advisory only |

## File Structure

```
src/features/POS/quotations/
├── api/quotation.api.ts              # 15 API calls as quotationApi object
├── interfaces/quotation.types.ts     # DTOs, params, enums, CancelReason union
├── constants/quotation.constants.ts  # QUOTATION_STATUS_MAP, CANCEL_REASONS, TONE_MAP
├── composables/
│   ├── useQuotationsList.ts          # Paginated list + filters
│   ├── useQuotationDetail.ts         # Single GET /quotations/:id
│   └── useQuotationDraft.ts          # All mutations (items, customer, price-list, promo, send, cancel, expiry)
├── views/
│   ├── QuotationsListView.vue        # AppDataTable + status tabs, search, pagination
│   └── QuotationDetailView.vue       # DRAFT editor / read-only detail (mode-switched by status)
├── components/
│   ├── QuotationItemRow.vue          # Product, qty ±, price override, line subtotal, remove
│   ├── QuotationTotalsFooter.vue     # Subtotal / Discount / Total bar
│   ├── QuotationSendDialog.vue       # Email confirmation + pre-send validation
│   ├── QuotationCancelDialog.vue     # Reason selector (CUSTOMER_REQUEST|PRICE_OBJECTION|EXPIRED|OTHER)
│   └── QuotationExpiryPicker.vue     # Date picker for expiresAt (with null=never option)
├── utils/
│   ├── quotation.utils.ts            # isExpired(), statusToTone(), statusToLabel(), isDraft()
│   └── currency.utils.ts             # Re-export formatCentsMXN from core
└── __tests__/                        # Per-file tests
```

## Route Design

```typescript
// src/app/router/index.ts additions:
{
  path: '/pos/cotizaciones',
  name: 'pos-quotations-list',
  component: () => import('@/features/POS/quotations/views/QuotationsListView.vue'),
  meta: { layout: 'dashboard', permission: ['read', 'Quotation'] },
},
{
  path: '/pos/cotizaciones/nueva',
  name: 'pos-quotation-create',
  component: () => import('@/features/POS/quotations/views/QuotationDetailView.vue'),
  meta: { layout: 'dashboard', permission: ['create', 'Quotation'] },
},
{
  path: '/pos/cotizaciones/:id',
  name: 'pos-quotation-detail',
  component: () => import('@/features/POS/quotations/views/QuotationDetailView.vue'),
  meta: { layout: 'dashboard', permission: ['read', 'Quotation'] },
},
```

`/nueva` does a `POST /quotations/drafts` on mount, then `router.replace` to `/:id`.

## Data Flow — TanStack Query

### Query Keys (`src/core/shared/constants/query-keys.ts`)

```typescript
export const quotationQueryKeys = {
  list: (tenantId: string) => ['quotations', tenantId, 'list'] as const,
  detail: (tenantId: string, id: string) => ['quotations', tenantId, 'detail', id] as const,
}
```

### Queries

| Hook | Key | Stale | Placeholder |
|------|-----|-------|-------------|
| `useQuotationsList` | `list(tenantId)` + params | 30s | `keepPreviousData` |
| `useQuotationDetail` | `detail(tenantId, id)` | 30s | none (detail is single-row) |

### Mutations (`useQuotationDraft`)

Every mutation returns `QuotationResponseDto` → `setQueryData` on both `detail` and `list` caches:

```typescript
onSuccess: (updated) => {
  queryClient.setQueryData(detailKey.value, updated)
  // Replace in list cache too
  const list = queryClient.getQueryData(listKey.value) as PaginatedResponse<QuotationResponseDto>
  if (list) {
    const replaced = list.data.map(q => q.id === updated.id ? updated : q)
    queryClient.setQueryData(listKey.value, { ...list, data: replaced })
  }
}
```

### Mutation Functions

| Name | Endpoint | Cache Update |
|------|----------|-------------|
| `createDraft` | `POST /quotations/drafts` | Adds to list head after redirect |
| `assignCustomer` | `PUT .../drafts/:id/customer` | Replace detail + list |
| `setPriceList` | `PUT .../drafts/:id/price-list` | Replace detail + list |
| `addItem` | `POST .../drafts/:id/items` | Replace detail + list |
| `updateQuantity` | `PATCH .../items/:itemId/quantity` | Replace detail + list |
| `removeItem` | `DELETE .../items/:itemId` | Replace detail + list |
| `overridePrice` | `PATCH .../items/:itemId/price` | Replace detail + list |
| `applyManualPromo` | `PUT .../manual-promotions/:promoId` | Replace detail + list |
| `removeManualPromo` | `DELETE .../manual-promotions/:promoId` | Replace detail + list |
| `vetoPromo` | `POST .../promotions/:promoId/veto` | Replace detail + list |
| `unvetoPromo` | `DELETE .../promotions/:promoId/veto` | Replace detail + list |
| `setExpiry` | `PATCH .../drafts/:id/expiry` | Replace detail + list |
| `send` | `POST .../drafts/:id/send` | Replace detail + list |
| `cancel` | `POST .../drafts/:id/cancel` | Replace detail + list |
| `getPdfBlob` | `GET /quotations/:id/pdf` | No cache (blob) |

## State Management

**Server state**: TanStack Query for all API data. **Local state**: search term, pagination page/pageSize, status tab filter — all held in `useQuotationsList` composable. Detail form: quantity input, price override input, cancel reason selection — held in `QuotationDetailView` reactive state. No Pinia store needed — no cross-component shared state beyond query cache.

## Component Design

### QuotationsListView.vue

- **Reuses**: `AppDataTable`, status tab bar, search input with `refDebounced`
- **Props**: none (route-driven)
- **Data**: `useQuotationsList` composable (returns `quotations`, `isLoading`, `isFetching`, `setSearch`, `setStatusTab`, `setPage`)
- **States**: loading → skeleton, empty → "No hay cotizaciones", error → toast + retry
- **Actions**: "Nueva cotización" button gated by `canCreate`

### QuotationDetailView.vue

- **Route params**: `id` (or none for `/nueva`)
- **On mount `/nueva`**: call `createDraft()`, redirect to `/:newId`
- **On mount `/:id`**: `useQuotationDetail(id)` → returns reactive `quotation`
- **Mode switch**: `v-if="quotation?.status === 'DRAFT'"` → edit controls; else → read-only
- **Reuses**: `AssignCustomerSlideover` (customer), `PriceListSelector` (price list), `ProductSearchPanel` + `VariantPickerModal` (add items)
- **Child components**: `QuotationItemRow` × N, `QuotationTotalsFooter`, `QuotationSendDialog`, `QuotationCancelDialog`, `QuotationExpiryPicker`
- **Permissions**: `canUpdate` gates all edit controls; `canRead` baseline for view

### QuotationItemRow.vue

- **Props**: `item: QuotationItemResponseDto`, `readonly: boolean`
- **Emits**: `update:quantity`, `override:price`, `remove`
- **Displays**: product name/SKU, variant, unit price (formatCentsMXN), line subtotal, `✏️` when `priceSource === 'CUSTOM'`, quantity ± controls (hidden when readonly), remove button (hidden when readonly)
- **Stock badge**: computed from a stock query (separate, advisory)

### QuotationTotalsFooter.vue

- **Props**: `subtotalCents: number`, `discountCents: number`, `totalCents: number`
- **Display**: `Subtotal: $X | Descuento: -$Y | TOTAL: $Z`

## API Layer

```typescript
// api/quotation.api.ts
import { http } from '@/core/shared/api/http'
import type { QuotationResponseDto, QuotationListParams, PaginatedQuotations, CancelReason } from '../interfaces/quotation.types'

export const quotationApi = {
  async list(params: QuotationListParams): Promise<PaginatedQuotations> {
    const { data } = await http.get<PaginatedQuotations>('/quotations', { params }); return data
  },
  async getById(id: string): Promise<QuotationResponseDto> {
    const { data } = await http.get<QuotationResponseDto>(`/quotations/${id}`); return data
  },
  async createDraft(customerId?: string): Promise<QuotationResponseDto> {
    const { data } = await http.post<QuotationResponseDto>('/quotations/drafts', { customerId }); return data
  },
  async assignCustomer(id: string, customerId: string): Promise<QuotationResponseDto> {
    const { data } = await http.put<QuotationResponseDto>(`/quotations/drafts/${id}/customer`, { customerId }); return data
  },
  async setPriceList(id: string, globalPriceListId: string | null): Promise<QuotationResponseDto> {
    const { data } = await http.put<QuotationResponseDto>(`/quotations/drafts/${id}/price-list`, { globalPriceListId }); return data
  },
  async addItem(id: string, payload: { productId: string; variantId?: string; quantity: number }): Promise<QuotationResponseDto> {
    const { data } = await http.post<QuotationResponseDto>(`/quotations/drafts/${id}/items`, payload); return data
  },
  async updateQuantity(id: string, itemId: string, quantity: number): Promise<QuotationResponseDto> {
    const { data } = await http.patch<QuotationResponseDto>(`/quotations/drafts/${id}/items/${itemId}/quantity`, { quantity }); return data
  },
  async removeItem(id: string, itemId: string): Promise<QuotationResponseDto> {
    const { data } = await http.delete<QuotationResponseDto>(`/quotations/drafts/${id}/items/${itemId}`); return data
  },
  async overridePrice(id: string, itemId: string, unitPriceCents: number): Promise<QuotationResponseDto> {
    const { data } = await http.patch<QuotationResponseDto>(`/quotations/drafts/${id}/items/${itemId}/price`, { unitPriceCents }); return data
  },
  async applyManualPromotion(id: string, promoId: string): Promise<QuotationResponseDto> {
    const { data } = await http.put<QuotationResponseDto>(`/quotations/drafts/${id}/manual-promotions/${promoId}`, {}); return data
  },
  async removeManualPromotion(id: string, promoId: string): Promise<QuotationResponseDto> {
    const { data } = await http.delete<QuotationResponseDto>(`/quotations/drafts/${id}/manual-promotions/${promoId}`); return data
  },
  async vetoPromotion(id: string, promoId: string): Promise<QuotationResponseDto> {
    const { data } = await http.post<QuotationResponseDto>(`/quotations/drafts/${id}/promotions/${promoId}/veto`, {}); return data
  },
  async unvetoPromotion(id: string, promoId: string): Promise<QuotationResponseDto> {
    const { data } = await http.delete<QuotationResponseDto>(`/quotations/drafts/${id}/promotions/${promoId}/veto`); return data
  },
  async setExpiry(id: string, expiresAt: string | null): Promise<QuotationResponseDto> {
    const { data } = await http.patch<QuotationResponseDto>(`/quotations/drafts/${id}/expiry`, { expiresAt }); return data
  },
  async send(id: string, email: boolean): Promise<QuotationResponseDto> {
    const { data } = await http.post<QuotationResponseDto>(`/quotations/drafts/${id}/send`, null, { params: { email } }); return data
  },
  async cancel(id: string, cancelReason: CancelReason): Promise<QuotationResponseDto> {
    const { data } = await http.post<QuotationResponseDto>(`/quotations/drafts/${id}/cancel`, { cancelReason }); return data
  },
  async getPdfBlob(id: string, signal?: AbortSignal): Promise<Blob> {
    const { data } = await http.get<Blob>(`/quotations/${id}/pdf`, {
      params: { format: 'quotation-a4' }, responseType: 'blob', timeout: 15_000, signal,
    }); return data
  },
}
```

## TypeScript Interfaces

```typescript
// interfaces/quotation.types.ts
export type QuotationStatus = 'DRAFT' | 'SENT' | 'EXPIRED' | 'CANCELLED'
export type CancelReason = 'CUSTOMER_REQUEST' | 'PRICE_OBJECTION' | 'EXPIRED' | 'OTHER'
export type PriceSource = 'PRICE_LIST' | 'TIER_PRICE' | 'CUSTOM' | 'PROMOTION'

export interface QuotationCustomer { id: string; firstName: string; lastName: string | null; email: string | null }
export interface QuotationItemProduct { id: string; name: string; sku: string; imageUrl: string | null }
export interface QuotationItemVariant { id: string; name: string; sku: string }

export interface QuotationItemResponseDto {
  id: string; productId: string; variantId: string | null; quantity: number
  product: QuotationItemProduct; variant: QuotationItemVariant | null
  unitPriceCents: number; priceSource: PriceSource
  discountType: 'PERCENTAGE' | 'FIXED' | null; discountValue: number | null
  discountAmountCents: number; discountTitle: string | null; promotionId: string | null
  manuallyAdjusted: boolean; overrideNote: string | null; createdAt: string; updatedAt: string
}

export interface AppliedPromotion { id: string; promotionId: string; title: string; discountCents: number }

export interface QuotationResponseDto {
  id: string; customerId: string | null; customer: QuotationCustomer | null
  globalPriceListId: string | null; priceListExplicitlySet: boolean
  status: QuotationStatus; expiresAt: string | null
  cancelReason: CancelReason | null; canceledAt: string | null
  subtotalCents: number; discountCents: number; totalCents: number
  manuallyEnded: boolean
  items: QuotationItemResponseDto[]
  appliedPromotions: AppliedPromotion[]
  vetoedPromotionIds: string[]; optedInManualPromotionIds: string[]
  createdAt: string; updatedAt: string
}

export interface QuotationListParams {
  page?: number; limit?: number; status?: QuotationStatus
  customerId?: string; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'
}

export interface PaginatedQuotations {
  data: QuotationResponseDto[]; meta: { page: number; limit: number; total: number; totalPages: number }
}
```

## Permission Integration

**`ability.ts`**: Add `'Quotation'` to `APP_SUBJECTS` array (line 7–24).
**Route guards**: `meta.permission: [action, 'Quotation']` — router `beforeEach` checks automatically.
**Component-level**: `const { userCan } = useAuthStore()`, then `v-if="userCan('update', 'Quotation')"` on all edit controls, send/cancel buttons, price list changes.
**Navigation**: Add `{ id: 'pos-quotations', label: 'Cotizaciones', icon: 'i-lucide-file-text', to: '/pos/cotizaciones', permission: ['read', 'Quotation'] }` to POS group in `navigation.registry.ts`.

## PDF Preview Approach

Blob → `URL.createObjectURL` → `window.open(_blank)` → popup-blocked fallback (anchor download). Token via Axios interceptor. Revoke after 1s. Concurrency guard via `AbortController`, aborted on unmount. Error handling: 400/500 → toast. Pattern: identical to `SaleDetailView.vue:209-246`.

## Send & Cancel Flows

**Send**: User clicks "Enviar" → `QuotationSendDialog` (confirm modal) checks `items.length > 0` → POST `/send?email=true` → OK: toast + detail page switches to read-only (status=SENT). 422 no-items: validation message. 422 no-email: email capture dialog. 502 Resend fail: error toast + stays DRAFT.

**Cancel**: User clicks "Cancelar" → `QuotationCancelDialog` with `CancelReason` select → POST `/cancel` with reason → OK: toast + read-only view (status=CANCELLED, shows `cancelReason`).

## Stock Badges

Advisory only. No gating. Strategy: `useQuery` per product in `QuotationItemRow` (with `staleTime: 60_000`). Display `StatusDotBadge` with `warning` tone when stock is low/zero. Never blocks add-to-quote, send, or any action. Backend does NOT provide stock in quotation item response — must hit product endpoint separately.

## Migration / Rollout

No migration required. Remove routes, navigation entry, CASL subject, query keys, and the feature folder.

## Open Questions

None — all decisions backed by backend docs and existing codebase patterns.
