# Design — payment-details-admin (Datos bancarios) · COMPACT rerun

## 1. Executive summary

Add a tenant-scoped admin CRUD bounded context **"Datos bancarios"** (`PaymentDetail`) under
`src/features/admin/payment-details/`. The surface is unchanged from the proposal: a table/card
list with `Activa`/`Inactiva` badges, a create/edit slideover (create all-required, edit
all-optional, **`isActive` never a form field**), a logical-delete confirm with last-active
warning, and a **"Sin cuenta activa"** banner derived from the whole tenant — not the current
page slice.

This corrective rerun **replaces the previous over-engineered design** (~2,900 lines, 32 new
files, granular `employees`-style mutation composables and dedicated banner/card components)
with the **compact `tenants`/`users` pattern**:

- Mutations are declared **inline in the view** with `useMutation` (as in
  `AdminTenantsView.vue` / `AdminUsersView.vue`). The three dedicated
  `useCreatePaymentDetail.ts` / `useUpdatePaymentDetail.ts` / `useDeletePaymentDetail.ts`
  composables and their specs are **removed**.
- The "Sin cuenta activa" banner is an **inline `UAlert`** in the view. `NoActiveAccountBanner.vue`
  and its spec are **removed**.
- Cards are rendered by a **single** presentational `PaymentDetailCardGrid.vue` (card markup is
  inside the grid). `PaymentDetailCard.vue` and its spec are **removed**.

The **one real design decision is preserved unchanged**: `usePaymentDetailsTable.ts` remains the
single-source table wrapper (one fetch → full-list ref + page slice + `hasActiveAccount`). All
locked contracts in §3 stay byte-for-byte intact.

## 2. Change vs. the previous design (what is removed / kept)

| Concern | Previous design (removed) | Compact design (adopted) |
| ------- | ------------------------- | ------------------------ |
| Create/update/delete mutations | 3 dedicated composables + 3 specs | Inline `useMutation` in `AdminPaymentDetailsView.vue` |
| No-active-account banner | `NoActiveAccountBanner.vue` + spec | Inline `UAlert color="warning"` + `v-if` in the view |
| Cards | `PaymentDetailCard.vue` + `PaymentDetailCardGrid.vue` + 2 specs | Single `PaymentDetailCardGrid.vue` with card markup inlined |
| Single-source table wrapper | `usePaymentDetailsTable.ts` | **KEPT** (the one real design decision) |

Everything else is kept: `payment-details.api.ts` (flat array + pure filter/sort/paginate),
`payment-detail.types.ts` (zod + DTOs + label map), `errors.ts` (extractor + map),
`usePaymentDetailForm.ts`, `usePaymentDetailColumns.ts`, `usePaymentDetailViewMode.ts`,
`payment-detail-actions.utils.ts`, `PaymentDetailUpsertSlideover.vue`, and
`AdminPaymentDetailsView.vue`.

## 3. Locked contracts (unchanged, mandatory)

These are frozen from the proposal/specs and are **not** renegotiated by this rerun:

1. **Single-source wrapper** — `usePaymentDetailsTable` performs exactly **one** fetch of the
   flat list, stores the full array in `fullList`, returns the filtered/sorted/paginated page
   slice, and derives `hasActiveAccount` from `fullList`. No second query, no shared
   `useServerTable` change, no cache-key hack.
2. **Zod schemas** — create requires all four fields; edit makes all four optional; `isActive` is
   **never** present in either schema or request type. `clabe` = `/^\d{18}$/`, `accountNumber` =
   `/^\d{10,}$/`.
3. **Query keys** — `adminPaymentDetailQueryKeys.list(tenantId)` and `.detail(tenantId, id)`;
   tenant-scoped; prefix invalidation of the base list key.
4. **Error map** — domain codes are read from `.response.data.error` (never `.message`);
   `DUPLICATE_CLABE` (409) and `ENTITY_NOT_FOUND` (404) map to specific user-facing toasts.
5. **CASL** — exactly four actions `create` / `read` / `update` / `delete` (no `manage`, no
   `batch_delete`); subject registered as `PaymentDetail`.
6. **Route + label** — route `/admin/payment-details`; menu/permission label **"Datos bancarios"**.
7. **Status label** — `paymentDetailStatusLabel` returns `Activa` / `Inactiva`.

## 4. File structure (exact) — compact tree

22 new files (11 implementation modules + 11 co-located specs) plus 6 modified code sites and
≤3 modified test files.

```
src/features/admin/payment-details/
├── api/
│   ├── payment-details.api.ts                  # HTTP surface + pure local filter/sort/paginate
│   └── __tests__/payment-details.api.spec.ts
├── interfaces/
│   ├── payment-detail.types.ts                 # zod schemas + DTOs + badge label map
│   ├── errors.ts                               # domain error code type + map + extractor
│   └── __tests__/
│       ├── payment-detail.types.spec.ts
│       └── errors.spec.ts
├── composables/
│   ├── usePaymentDetailForm.ts                 # create/edit form state + schema selection
│   ├── usePaymentDetailColumns.ts              # TableColumn<PaymentDetailTableRow>[]
│   ├── usePaymentDetailViewMode.ts             # persisted 'table' | 'card' + displayMode bridge
│   ├── usePaymentDetailsTable.ts               # LOCKED single-source wrapper (one fetch)
│   └── __tests__/
│       ├── usePaymentDetailForm.spec.ts
│       ├── usePaymentDetailColumns.test.ts
│       ├── usePaymentDetailViewMode.test.ts
│       └── usePaymentDetailsTable.spec.ts
├── components/
│   ├── PaymentDetailUpsertSlideover.vue        # create/edit USlideover + UForm
│   ├── PaymentDetailCardGrid.vue               # cards + skeleton + empty; card markup inline
│   └── __tests__/
│       ├── PaymentDetailUpsertSlideover.spec.ts
│       └── PaymentDetailCardGrid.spec.ts
├── utils/
│   ├── payment-detail-actions.utils.ts         # pure row-action + last-active copy helpers
│   └── __tests__/payment-detail-actions.utils.spec.ts
└── views/
    ├── AdminPaymentDetailsView.vue             # composition surface + inline mutations + banner
    └── __tests__/AdminPaymentDetailsView.spec.ts
```

Modified code sites (6): `auth.types.ts`, `ability.ts`, `permissions.ts`, `query-keys.ts`,
`navigation.registry.ts`, `router/index.ts`. Modified test files (≤3):
`ability.test.ts`, `permissions.spec.ts`, `query-keys.test.ts`.

### Single-responsibility summary

| File | Responsibility (one sentence) |
| ---- | ----------------------------- |
| `api/payment-details.api.ts` | Owns the axios calls and pure client-side filter/sort/paginate transforms. |
| `interfaces/payment-detail.types.ts` | Owns zod schemas, DTO/request types, and the `Activa`/`Inactiva` label map. |
| `interfaces/errors.ts` | Owns the domain error code type, Spanish map, and code extractor. |
| `composables/usePaymentDetailForm.ts` | Owns create/edit form state, schema selection, reset and prefill. |
| `composables/usePaymentDetailColumns.ts` | Owns the table column definition. |
| `composables/usePaymentDetailViewMode.ts` | Owns persisted table/card mode + `displayMode` bridge. |
| `composables/usePaymentDetailsTable.ts` | Owns the single full-list fetch and derives page data + `hasActiveAccount`. |
| `components/PaymentDetailUpsertSlideover.vue` | Captures/validates the four account fields and emits create/edit. |
| `components/PaymentDetailCardGrid.vue` | Renders skeleton/empty/grid, inlines the card markup, forwards clicks. |
| `utils/payment-detail-actions.utils.ts` | Builds row dropdown items and the last-active confirmation copy. |
| `views/AdminPaymentDetailsView.vue` | Composes the above; owns inline mutations, banner, gating and confirm state. |

## 5. Content contracts / zod schemas

### 5.1 `interfaces/payment-detail.types.ts`

```ts
import { z } from 'zod'

// ─── Form schemas ──────────────────────────────────────────────────────────────
// isActive is NEVER a form field (backend forbidNonWhitelisted → 400).
// Create requires all four; edit makes them all optional (partial PATCH).
export const CreatePaymentDetailSchema = z.object({
  bankName: z
    .string({ required_error: 'El banco es obligatorio' })
    .trim()
    .min(1, 'El banco es obligatorio'),
  beneficiary: z
    .string({ required_error: 'El beneficiario es obligatorio' })
    .trim()
    .min(1, 'El beneficiario es obligatorio'),
  clabe: z
    .string({ required_error: 'La CLABE es obligatoria' })
    .regex(/^\d{18}$/, 'La CLABE debe tener 18 dígitos'),
  accountNumber: z
    .string({ required_error: 'El número de cuenta es obligatorio' })
    .regex(/^\d{10,}$/, 'El número de cuenta debe tener al menos 10 dígitos'),
})

export const UpdatePaymentDetailSchema = z.object({
  bankName: CreatePaymentDetailSchema.shape.bankName.optional(),
  beneficiary: CreatePaymentDetailSchema.shape.beneficiary.optional(),
  clabe: CreatePaymentDetailSchema.shape.clabe.optional(),
  accountNumber: CreatePaymentDetailSchema.shape.accountNumber.optional(),
})

export type CreatePaymentDetailFormValues = z.infer<typeof CreatePaymentDetailSchema>
export type UpdatePaymentDetailFormValues = z.infer<typeof UpdatePaymentDetailSchema>

// ─── DTO / request shapes ─────────────────────────────────────────────────────
export interface PaymentDetailResponse {
  id: string
  tenantId: string
  bankName: string
  beneficiary: string
  clabe: string
  accountNumber: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Table row is currently identical to the response (tenants precedent) so a future
// client-side projection doesn't ripple through callers.
export interface PaymentDetailTableRow extends PaymentDetailResponse {}

// Mirror the zod schemas 1:1. isActive is absent by construction; tenantId is
// read-only (returned by the backend, never sent in create/update payloads).
export interface CreatePaymentDetailRequest {
  bankName: string
  beneficiary: string
  clabe: string
  accountNumber: string
}

export interface UpdatePaymentDetailRequest {
  bankName?: string
  beneficiary?: string
  clabe?: string
  accountNumber?: string
}

// ─── Badge label map ──────────────────────────────────────────────────────────
// Single source used by the table cell and the card. Gender matches "cuenta".
export const PAYMENT_DETAIL_STATUS_LABELS = {
  active: 'Activa',
  inactive: 'Inactiva',
} as const

export type PaymentDetailStatusLabelKey = keyof typeof PAYMENT_DETAIL_STATUS_LABELS

export function paymentDetailStatusLabel(isActive: boolean): string {
  return isActive
    ? PAYMENT_DETAIL_STATUS_LABELS.active
    : PAYMENT_DETAIL_STATUS_LABELS.inactive
}
```

Locked notes: `isActive` is never in either schema/request; `tenantId` is typed read-only; edit
accepts `{}` and partial single-field payloads.

### 5.2 `interfaces/errors.ts`

```ts
export type PaymentDetailDomainErrorCode =
  | 'DUPLICATE_CLABE'
  | 'ENTITY_NOT_FOUND'
  | 'NO_ACTIVE_PAYMENT_DETAIL'

export const PAYMENT_DETAIL_ERROR_MAP: Record<PaymentDetailDomainErrorCode, string> = {
  DUPLICATE_CLABE: 'Esta CLABE ya existe en esta sucursal',
  ENTITY_NOT_FOUND: 'No encontrado',
  // Bot-endpoint code only; not raised by admin CRUD but harmless to keep mapped.
  NO_ACTIVE_PAYMENT_DETAIL: 'No hay una cuenta activa para mostrar al cliente.',
}

interface MaybeAxiosError {
  response?: { data?: { error?: unknown } }
}

/**
 * Pure extractor. Backend domain envelope is { statusCode, error: <CODE>,
 * message, timestamp } — the CODE lives in `error` (NOT `message`).
 */
export function extractPaymentDetailErrorCode(
  error: unknown,
): PaymentDetailDomainErrorCode | null {
  const maybe = error as MaybeAxiosError
  const code = maybe?.response?.data?.error
  if (typeof code === 'string' && code in PAYMENT_DETAIL_ERROR_MAP) {
    return code as PaymentDetailDomainErrorCode
  }
  return null
}
```

Copy matches REQ-PD-008 exactly. Generic (non-domain) failures reuse the shared
`normalizeApiError` from `src/core/shared/utils/error.utils.ts`; this module does not duplicate
the `message`/`string[]` normalization logic.

## 6. Query keys + invalidation + mutation strategy

### 6.1 Central key registration — `src/core/shared/constants/query-keys.ts`

```ts
export const adminPaymentDetailQueryKeys = {
  list: (tenantId: string) => ['admin', 'payment-details', tenantId, 'list'] as const,
  detail: (tenantId: string, id: string) =>
    ['admin', 'payment-details', tenantId, 'detail', id] as const,
}
```

Tenant-scoped, matching `adminUserQueryKeys` / `adminRoleQueryKeys`. `useServerTable` appends
`serverParams` to the base `list` key, so the actual cache slot is
`[...list(tenantId), { pageIndex, pageSize, sorting, globalFilter }]`. `detail` is registered for
parity/future detail views; the current slice does not fetch it (the list carries all DTO fields).

### 6.2 Invalidation (inline in the view, on success)

Every mutation invalidates the **base** list prefix so all page/filter/sort cache slots refresh
(TanStack Query prefix-matches array keys):

```ts
void queryClient.invalidateQueries({
  queryKey: adminPaymentDetailQueryKeys.list(tenantId.value),
})
```

No `setQueryData` optimistic write: the list is small, mutations are infrequent admin actions,
and invalidation keeps the wrapper's `fullList` ref correct on the next fetch.

### 6.3 Mutation strategy — inline `useMutation` (users/tenants convention)

The view declares three `useMutation` calls directly (create/edit/deactivate), exactly like
`AdminTenantsView.vue`. The compact pattern **does not** add mutation composables; the inline
`onError` calls `extractPaymentDetailErrorCode` + `PAYMENT_DETAIL_ERROR_MAP` (see §8.3 for the
full view code). This keeps the domain-error mapping in `errors.ts` while removing three files
and their specs.

## 7. Permission matrix (exactly 4 actions — no `manage`, no `batch_delete`)

| Action | CASL verb | Endpoint | Subject registration |
| ------ | --------- | -------- | -------------------- |
| Create | `create` | `POST /admin/payment-details` | `create:PaymentDetail` |
| Read   | `read`   | `GET /admin/payment-details[/:id]` | `read:PaymentDetail` |
| Update | `update` | `PATCH /admin/payment-details/:id` | `update:PaymentDetail` |
| Delete | `delete` | `DELETE /admin/payment-details/:id` | `delete:PaymentDetail` |

### 7.1 `src/features/auth/interfaces/auth.types.ts`

Add `'PaymentDetail'` to `AppSubject` (before `'all'`):

```ts
          | 'EmployeeEmergencyContact'
          | 'NotificationConfig'
          | 'PaymentDetail'
          | 'all'
```

### 7.2 `src/features/auth/authorization/ability.ts`

Add `'PaymentDetail'` to `APP_SUBJECTS` (before `'all'`):

```ts
          'EmployeeEmergencyContact',
          'NotificationConfig',
          'PaymentDetail',
          'all',
```

### 7.3 `src/features/admin/roles/i18n/permissions.ts`

Add to `SUBJECT_LABELS`:

```ts
  PaymentDetail: 'Datos bancarios',
```

Add to `PERMISSION_COPY` (exactly `create`/`read`/`update`/`delete`):

```ts
  PaymentDetail: {
    create: {
      label: 'Crear datos bancarios',
      description: 'Dar de alta cuentas bancarias para recibir transferencias.',
    },
    read: {
      label: 'Ver datos bancarios',
      description: 'Listar las cuentas bancarias de la sucursal.',
    },
    update: {
      label: 'Editar datos bancarios',
      description: 'Modificar banco, beneficiario, CLABE o número de cuenta.',
    },
    delete: {
      label: 'Desactivar datos bancarios',
      description:
        'Dar de baja una cuenta. El bot deja de mostrarla en el mensaje de transferencia.',
    },
  },
```

`HIDDEN_SUBJECTS` stays unchanged. No `manage`, no `batch_delete`.

### 7.4 Menu + route gating

`src/app/navigation/navigation.registry.ts` — add to the `admin` group children:

```ts
{ id: 'admin-payment-details', label: 'Datos bancarios', icon: 'i-lucide-credit-card',
  to: '/admin/payment-details', permission: ['read', 'PaymentDetail'] },
```

`src/app/router/index.ts` — lazy import + guarded route:

```ts
const AdminPaymentDetailsView = () =>
  import('@/features/admin/payment-details/views/AdminPaymentDetailsView.vue')
```

```ts
{
  path: '/admin/payment-details',
  name: 'admin-payment-details',
  component: AdminPaymentDetailsView,
  meta: { layout: 'dashboard', permission: ['read', 'PaymentDetail'] as RoutePermission },
},
```

The existing global `beforeEach` already checks `meta.permission` and redirects to `/403`.

### 7.5 View gating booleans

```ts
const canCreatePaymentDetail = computed(() => authStore.userCan('create', 'PaymentDetail'))
const canUpdatePaymentDetail = computed(() => authStore.userCan('update', 'PaymentDetail'))
const canDeletePaymentDetail = computed(() => authStore.userCan('delete', 'PaymentDetail'))
const canManagePaymentDetailActions = computed(
  () => canUpdatePaymentDetail.value || canDeletePaymentDetail.value,
)
```

Read gating is enforced by menu + route guard; the view assumes `read` (it only renders for users
who passed the guard).

## 8. Data flow

### 8.1 `api/payment-details.api.ts` (surface + pure helpers)

```ts
import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import { http } from '@/core/shared/api/http'
import type {
  PaymentDetailResponse,
  PaymentDetailTableRow,
  CreatePaymentDetailRequest,
  UpdatePaymentDetailRequest,
} from '../interfaces/payment-detail.types'

// ─── Pure: search + sort (exported for direct unit testing) ──────────────────
const SEARCH_FIELDS = ['bankName', 'beneficiary', 'clabe', 'accountNumber'] as const

export function applyLocalPaymentDetailFilters(
  rows: PaymentDetailResponse[],
  params: ServerTableParams,
): PaymentDetailResponse[] {
  let filtered = [...rows]

  if (params.globalFilter) {
    const search = params.globalFilter.toLowerCase()
    filtered = filtered.filter((row) =>
      SEARCH_FIELDS.some((field) => row[field].toLowerCase().includes(search)),
    )
  }

  if (params.sorting && params.sorting.length > 0) {
    const sort = params.sorting[0]
    if (sort) {
      filtered.sort((a, b) => {
        const aVal = a[sort.id as keyof PaymentDetailResponse]
        const bVal = b[sort.id as keyof PaymentDetailResponse]
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sort.desc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal)
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sort.desc ? bVal - aVal : aVal - bVal
        }
        return 0
      })
    }
  }

  return filtered
}

// ─── Pure: paginate (exported for direct unit testing) ───────────────────────
export function paginatePaymentDetails(
  rows: PaymentDetailResponse[],
  params: ServerTableParams,
): PaginatedResponse<PaymentDetailTableRow> {
  const filteredRows = applyLocalPaymentDetailFilters(rows, params)
  const totalCount = filteredRows.length
  const pageCount = Math.ceil(totalCount / params.pageSize) || 1
  const start = params.pageIndex * params.pageSize
  const pagedRows = filteredRows.slice(start, start + params.pageSize)

  return {
    data: pagedRows as PaymentDetailTableRow[],
    pagination: {
      pageIndex: params.pageIndex,
      pageSize: params.pageSize,
      totalCount,
      pageCount,
    },
  }
}

// ─── HTTP surface ─────────────────────────────────────────────────────────────
export const paymentDetailsApi = {
  /** Full flat array, backend-ordered updatedAt DESC. Used by the single-source wrapper. */
  async list(): Promise<PaymentDetailResponse[]> {
    const { data } = await http.get<PaymentDetailResponse[]>('/admin/payment-details')
    return data
  },
  async getById(id: string) {
    const { data } = await http.get<PaymentDetailResponse>(`/admin/payment-details/${id}`)
    return data
  },
  async create(payload: CreatePaymentDetailRequest) {
    const { data } = await http.post<PaymentDetailResponse>('/admin/payment-details', payload)
    return data
  },
  async update(id: string, payload: UpdatePaymentDetailRequest) {
    const { data } = await http.patch<PaymentDetailResponse>(
      `/admin/payment-details/${id}`,
      payload,
    )
    return data
  },
  async remove(id: string) {
    await http.delete(`/admin/payment-details/${id}`)
  },
}
```

The backend list is a **flat array** (no `{ data, meta }`), so pagination is fully client-side.
Default sort `updatedAt desc` is preserved by the view's `defaultSorting` and the backend's own
ordering; client sort only reorders on explicit user sort.

### 8.2 `usePaymentDetailsTable.ts` — LOCKED single-source wrapper

```ts
import { computed, ref } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { adminPaymentDetailQueryKeys } from '@/core/shared/constants/query-keys'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { paymentDetailsApi, paginatePaymentDetails } from '../api/payment-details.api'
import type { PaymentDetailResponse, PaymentDetailTableRow } from '../interfaces/payment-detail.types'

/**
 * usePaymentDetailsTable — single-source wrapper over the UNTOUCHABLE useServerTable.
 *
 * useServerTable only surfaces the current page slice (`data`), but the
 * "Sin cuenta activa" banner must know whether the tenant has ANY active account.
 * The backend list is small and flat, so this wrapper performs ONE fetch and:
 *   - keeps the full fetched array in `fullList` (unfiltered, unpaginated)
 *   - returns the page slice through useServerTable's `data`
 *   - derives `hasActiveAccount` from `fullList`
 * Both the table page and the banner therefore share one source of truth.
 */
export function usePaymentDetailsTable() {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  const fullList = ref<PaymentDetailResponse[]>([])

  const table = useServerTable<PaymentDetailTableRow>({
    queryKey: () => adminPaymentDetailQueryKeys.list(tenantId.value),
    queryFn: async (params) => {
      const rows = await paymentDetailsApi.list()
      fullList.value = rows
      return paginatePaymentDetails(rows, params)
    },
    defaultPageSize: 10,
    persistKey: 'admin-payment-details',
    defaultSorting: [{ id: 'updatedAt', desc: true }],
    defaultPinning: { left: [], right: ['actions'] },
  })

  const hasActiveAccount = computed(() => fullList.value.some((row) => row.isActive))

  return {
    ...table,          // pagination, sorting, globalFilter, data, totalCount, error, refresh, ...
    fullList,
    hasActiveAccount,
  }
}
```

Why this and not alternatives (unchanged from the previous design's decision):

- **A second `useQuery`** would double-fetch and create two cache slots for one dataset — rejected.
- **Extending `useServerTable` with `rawData`** touches a shared "untouchable" primitive — rejected.
- **Cache-key versioning** churns cache slots for no benefit — rejected.

### 8.3 `AdminPaymentDetailsView.vue` — inline mutations + inline banner

The view **destructures** the wrapper (like `AdminTenantsView.vue` destructures `useServerTable`)
so refs are top-level template bindings and auto-unwrap correctly.

```ts
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import ViewToggle from '@/core/shared/components/ViewToggle.vue'
import { adminPaymentDetailQueryKeys } from '@/core/shared/constants/query-keys'
import { activityToBadgeTone } from '@/core/shared/utils/badge.utils'
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import AdminPageHeader from '@/features/admin/shared/components/AdminPageHeader.vue'
import { paymentDetailsApi } from '../api/payment-details.api'
import { usePaymentDetailColumns } from '../composables/usePaymentDetailColumns'
import { usePaymentDetailViewMode, isPaymentDetailViewMode } from '../composables/usePaymentDetailViewMode'
import { usePaymentDetailsTable } from '../composables/usePaymentDetailsTable'
import PaymentDetailUpsertSlideover from '../components/PaymentDetailUpsertSlideover.vue'
import PaymentDetailCardGrid from '../components/PaymentDetailCardGrid.vue'
import {
  buildPaymentDetailDeactivateDescription,
  buildPaymentDetailRowActions,
} from '../utils/payment-detail-actions.utils'
import { PAYMENT_DETAIL_ERROR_MAP, extractPaymentDetailErrorCode } from '../interfaces/errors'
import type { PaymentDetailTableRow } from '../interfaces/payment-detail.types'
import type { UpdatePaymentDetailFormValues } from '../interfaces/payment-detail.types'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const queryClient = useQueryClient()
const authStore = useAuthStore()
const toast = useToast()
const tenantId = computed(() => authStore.currentTenantId)

const { columns } = usePaymentDetailColumns()
const { viewMode, setMode: setViewMode, displayMode } = usePaymentDetailViewMode()

const {
  pagination,
  sorting,
  globalFilter,
  columnPinning,
  columnVisibility,
  data,
  totalCount,
  pageCount,
  isLoading,
  isFetching,
  isError,
  error,
  refresh,
  pageSizeOptions,
  showingFrom,
  showingTo,
  fullList,
  hasActiveAccount,
} = usePaymentDetailsTable()

function handleViewModeChange(mode: string) {
  if (isPaymentDetailViewMode(mode)) setViewMode(mode)
}

const paymentDetailsErrorMessage = computed(() =>
  normalizeApiError(error.value, 'No se pudieron cargar las cuentas bancarias. Reintenta.').message,
)

const canCreatePaymentDetail = computed(() => authStore.userCan('create', 'PaymentDetail'))
const canUpdatePaymentDetail = computed(() => authStore.userCan('update', 'PaymentDetail'))
const canDeletePaymentDetail = computed(() => authStore.userCan('delete', 'PaymentDetail'))
const canManagePaymentDetailActions = computed(
  () => canUpdatePaymentDetail.value || canDeletePaymentDetail.value,
)

// ── Inline banner (replaces NoActiveAccountBanner.vue) ────────────────────────
const showNoActiveAccountBanner = computed(
  () => !isLoading.value && !isError.value && !hasActiveAccount.value,
)

const isCreateOpen = ref(false)
const isEditOpen = ref(false)
const selectedPaymentDetail = ref<PaymentDetailTableRow | null>(null)
const confirmState = ref({ open: false, description: '', onConfirm: () => {} })

function openConfirm(description: string, onConfirm: () => void) {
  confirmState.value = { open: true, description, onConfirm }
}

function handleConfirm() {
  confirmState.value.onConfirm()
  confirmState.value.open = false
}

// ── Inline mutations (users/tenants convention; no dedicated composables) ──────

const createMutation = useMutation({
  mutationFn: paymentDetailsApi.create,
  onSuccess: async () => {
    isCreateOpen.value = false
    toast.add({
      title: 'Cuenta creada',
      description: 'La cuenta bancaria se creó correctamente.',
      color: 'success',
    })
    await queryClient.invalidateQueries({
      queryKey: adminPaymentDetailQueryKeys.list(tenantId.value),
    })
  },
  onError: (error) => {
    const code = extractPaymentDetailErrorCode(error)
    if (code) {
      toast.add({ title: PAYMENT_DETAIL_ERROR_MAP[code], color: 'error' })
      return
    }
    toast.add({
      title: 'No se pudo crear la cuenta',
      description: normalizeApiError(error).message,
      color: 'error',
    })
  },
})

const editMutation = useMutation({
  mutationFn: (payload: { id: string; data: UpdatePaymentDetailFormValues }) =>
    paymentDetailsApi.update(payload.id, payload.data),
  onSuccess: async () => {
    isEditOpen.value = false
    selectedPaymentDetail.value = null
    toast.add({
      title: 'Cuenta actualizada',
      description: 'Los cambios se guardaron correctamente.',
      color: 'success',
    })
    await queryClient.invalidateQueries({
      queryKey: adminPaymentDetailQueryKeys.list(tenantId.value),
    })
  },
  onError: (error) => {
    const code = extractPaymentDetailErrorCode(error)
    if (code) {
      toast.add({ title: PAYMENT_DETAIL_ERROR_MAP[code], color: 'error' })
      return
    }
    toast.add({
      title: 'No se pudo actualizar la cuenta',
      description: normalizeApiError(error).message,
      color: 'error',
    })
  },
})

const deactivateMutation = useMutation({
  mutationFn: paymentDetailsApi.remove,
  onSuccess: async () => {
    toast.add({
      title: 'Cuenta desactivada',
      description: 'El bot dejará de mostrarla en el mensaje de transferencia.',
      color: 'success',
    })
    await queryClient.invalidateQueries({
      queryKey: adminPaymentDetailQueryKeys.list(tenantId.value),
    })
  },
  onError: (error) => {
    const code = extractPaymentDetailErrorCode(error)
    if (code) {
      toast.add({ title: PAYMENT_DETAIL_ERROR_MAP[code], color: 'error' })
      return
    }
    toast.add({
      title: 'No se pudo desactivar la cuenta',
      description: normalizeApiError(error).message,
      color: 'error',
    })
  },
})

const isSubmitting = computed(
  () =>
    createMutation.isPending.value ||
    editMutation.isPending.value ||
    deactivateMutation.isPending.value,
)

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function openEdit(row: PaymentDetailTableRow) {
  if (!canUpdatePaymentDetail.value) return
  selectedPaymentDetail.value = row
  isEditOpen.value = true
}

function handleCardClick(row: PaymentDetailTableRow) {
  openEdit(row)
}

function handleDeactivate(row: PaymentDetailTableRow) {
  if (!canDeletePaymentDetail.value) return
  openConfirm(buildPaymentDetailDeactivateDescription(row, fullList.value), () => {
    void deactivateMutation.mutateAsync(row.id)
  })
}

function getRowItems(row: PaymentDetailTableRow) {
  return buildPaymentDetailRowActions(row, {
    canUpdate: canUpdatePaymentDetail.value,
    canDelete: canDeletePaymentDetail.value,
    onEdit: openEdit,
    onDelete: handleDeactivate,
  })
}
```

Template skeleton:

```html
<div class="flex flex-col gap-6 px-4 sm:px-6 lg:px-10">
  <!-- Inline banner (REQ-PD-006) -->
  <UAlert
    v-if="showNoActiveAccountBanner"
    color="warning"
    title="Sin cuenta activa"
    description="La sucursal no tiene ninguna cuenta bancaria activa para recibir transferencias."
    icon="i-lucide-triangle-alert"
    data-testid="no-active-account-banner"
  />

  <PaymentDetailUpsertSlideover
    v-model:open="isCreateOpen"
    mode="create"
    :loading="isSubmitting"
    @create="createMutation.mutate"
  />

  <PaymentDetailUpsertSlideover
    v-model:open="isEditOpen"
    mode="edit"
    :payment-detail="selectedPaymentDetail"
    :loading="isSubmitting"
    @edit="
      (payload) =>
        selectedPaymentDetail &&
        editMutation.mutate({ id: selectedPaymentDetail.id, data: payload })
    "
  />

  <ConfirmModal
    :open="confirmState.open"
    :description="confirmState.description"
    confirm-label="Desactivar"
    confirm-color="error"
    :loading="deactivateMutation.isPending.value"
    @update:open="confirmState.open = $event"
    @confirm="handleConfirm"
  />

  <UCard :ui="{ body: 'p-0 sm:p-0 bg-coco-neutral-50 dark:bg-coco-neutral-950' }">
    <template #header>
      <AdminPageHeader
        title="Datos bancarios"
        description="Cuentas bancarias para cobros por transferencia."
      />
    </template>

    <div class="px-6 py-5">
      <AppDataTable
        v-model:sorting="sorting"
        v-model:pagination="pagination"
        v-model:global-filter="globalFilter"
        v-model:column-pinning="columnPinning"
        v-model:column-visibility="columnVisibility"
        :columns="columns"
        :data="data"
        :loading="isLoading"
        :fetching="isFetching"
        :error="isError"
        :error-message="paymentDetailsErrorMessage"
        :page-count="pageCount"
        :total-count="totalCount"
        :showing-from="showingFrom"
        :showing-to="showingTo"
        :page-size-options="pageSizeOptions"
        :display-mode="displayMode"
        search-placeholder="Buscar cuentas..."
        :show-add-button="canCreatePaymentDetail"
        add-button-text="Crear cuenta"
        add-button-icon="i-lucide-credit-card"
        enable-column-visibility
        empty="No hay cuentas bancarias"
        @add="isCreateOpen = true"
        @refresh="refresh"
      >
        <template #bankName-header="{ column }">
          <SortableHeader :column="column" label="Banco" />
        </template>

        <template #beneficiary-header="{ column }">
          <SortableHeader :column="column" label="Beneficiario" />
        </template>

        <template #updatedAt-header="{ column }">
          <SortableHeader :column="column" label="Actualización" />
        </template>

        <template #isActive-cell="{ row }">
          <StatusDotBadge
            :data-testid="`status-badge-${row.original.id}`"
            :tone="activityToBadgeTone(row.original.isActive)"
            :label="paymentDetailStatusLabel(row.original.isActive)"
          />
        </template>

        <template #updatedAt-cell="{ row }">
          <span>{{ dateFormatter.format(new Date(row.original.updatedAt)) }}</span>
        </template>

        <template #actions-cell="{ row }">
          <UDropdownMenu
            v-if="canManagePaymentDetailActions"
            :items="getRowItems(row.original)"
            :content="{ align: 'end' }"
          >
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="ghost"
              class="size-7"
            />
          </UDropdownMenu>
        </template>

        <template #actions>
          <ViewToggle
            :model-value="viewMode"
            aria-label="Seleccionar vista de datos bancarios"
            @update:model-value="handleViewModeChange"
          />
        </template>

        <template #cards>
          <PaymentDetailCardGrid
            :payment-details="data"
            :loading="isLoading || isFetching"
            :empty="'No hay cuentas bancarias'"
            @card-click="handleCardClick"
          />
        </template>
      </AppDataTable>
    </div>
  </UCard>
</div>
```

Mutation flow notes:

- **Create:** add button → `isCreateOpen = true` → slideover `mode="create"` → `@create` →
  `createMutation.mutate`. On success the inline handler closes the slideover, toasts, and
  invalidates the list; the wrapper's next fetch repopulates `fullList`, so the banner hides as
  soon as the new active account appears.
- **Edit:** row/card click → `openEdit` (guarded by `canUpdatePaymentDetail`) → slideover
  `mode="edit"` prefilled → `@edit` → `editMutation.mutate({ id, data })`.
- **Delete (logical):** dropdown "Desactivar" → `ConfirmModal` `confirm-label="Desactivar"`,
  `confirm-color="error"` → `deactivateMutation.mutateAsync(id)`. Description is strengthened
  when the row is the **last active** account (see §9). Repeat DELETE is idempotent (204).

## 9. Form composable + last-active/actions utils

### 9.1 `usePaymentDetailForm.ts` (imports schemas from types.ts)

```ts
import { computed, reactive } from 'vue'
import {
  CreatePaymentDetailSchema,
  UpdatePaymentDetailSchema,
  type CreatePaymentDetailFormValues,
  type UpdatePaymentDetailFormValues,
} from '../interfaces/payment-detail.types'

function getCreateInitialState(): CreatePaymentDetailFormValues {
  return { bankName: '', beneficiary: '', clabe: '', accountNumber: '' }
}

function getEditInitialState(): UpdatePaymentDetailFormValues {
  return { bankName: '', beneficiary: '', clabe: '', accountNumber: '' }
}

export function usePaymentDetailForm(mode: 'create' | 'edit') {
  const createState = reactive<CreatePaymentDetailFormValues>(getCreateInitialState())
  const editState = reactive<UpdatePaymentDetailFormValues>(getEditInitialState())

  const schema = computed(() =>
    mode === 'create' ? CreatePaymentDetailSchema : UpdatePaymentDetailSchema,
  )

  function resetForm() {
    Object.assign(createState, getCreateInitialState())
    Object.assign(editState, getEditInitialState())
  }

  function setValues(values: UpdatePaymentDetailFormValues) {
    Object.assign(editState, getEditInitialState(), values)
  }

  return { schema, createState, editState, resetForm, setValues }
}
```

### 9.2 `utils/payment-detail-actions.utils.ts`

```ts
import type { PaymentDetailResponse, PaymentDetailTableRow } from '../interfaces/payment-detail.types'

export function isLastActivePaymentDetail(
  rows: PaymentDetailResponse[],
  targetId: string,
): boolean {
  return (
    rows.filter((row) => row.isActive).length === 1 &&
    rows.some((row) => row.id === targetId && row.isActive)
  )
}

export function buildPaymentDetailDeactivateDescription(
  row: PaymentDetailTableRow,
  rows: PaymentDetailResponse[],
): string {
  const base = `¿Desactivar la cuenta de ${row.bankName} (${row.beneficiary})? El bot dejará de mostrarla en el mensaje de transferencia.`
  if (isLastActivePaymentDetail(rows, row.id)) {
    return `${base} Es la única cuenta activa: la sucursal quedará sin una cuenta para recibir transferencias.`
  }
  return base
}

export interface PaymentDetailRowActionContext {
  canUpdate: boolean
  canDelete: boolean
  onEdit: (row: PaymentDetailTableRow) => void
  onDelete: (row: PaymentDetailTableRow) => void
}

export function buildPaymentDetailRowActions(
  row: PaymentDetailTableRow,
  ctx: PaymentDetailRowActionContext,
) {
  const main = ctx.canUpdate ? [{ label: 'Editar', onSelect: () => ctx.onEdit(row) }] : []
  const destructive = ctx.canDelete
    ? [{ label: 'Desactivar', color: 'error' as const, onSelect: () => ctx.onDelete(row) }]
    : []
  return [main, destructive].filter((section) => section.length > 0)
}
```

## 10. Component contracts

1. **`AdminPaymentDetailsView.vue`** — composition surface only: wires the table wrapper, columns,
   view mode, inline mutations, gating, slideover/confirm open state, and the inline banner. No
   card markup lives here (it is in `PaymentDetailCardGrid.vue`).
2. **`PaymentDetailUpsertSlideover.vue`** — owns the create/edit form (`USlideover` + `UForm` +
   zod). Captures the four account fields; emits `create` / `edit`; never renders `isActive`.
   Props `mode` / `loading` / `paymentDetail`; `v-model:open`; emits `create` / `edit`.
3. **`PaymentDetailCardGrid.vue`** — single presentational grid: renders 8 skeleton cards while
   loading, an empty block, or the card grid; the per-card `<article>` markup (bankName,
   beneficiary, Activa/Inactiva badge, CLABE, accountNumber) is **inline** in this component.
   Props `paymentDetails` / `loading?` / `empty?`; emits `card-click`.
4. **`ConfirmModal`, `StatusDotBadge`, `ViewToggle`, `AppDataTable`, `AdminPageHeader`
   (reused)** — shared chrome unchanged.

### `PaymentDetailCardGrid.vue` shape (card markup inlined)

```vue
<script setup lang="ts">
import { computed } from 'vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import { activityToBadgeTone } from '@/core/shared/utils/badge.utils'
import { paymentDetailStatusLabel } from '../interfaces/payment-detail.types'
import type { PaymentDetailTableRow } from '../interfaces/payment-detail.types'

const props = defineProps<{
  paymentDetails: PaymentDetailTableRow[]
  loading?: boolean
  empty?: string
}>()

const emit = defineEmits<{
  'card-click': [paymentDetail: PaymentDetailTableRow]
}>()

function statusTone(row: PaymentDetailTableRow) {
  return activityToBadgeTone(row.isActive)
}
</script>

<template>
  <div
    v-if="loading"
    data-testid="card-grid-skeleton"
    class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7"
  >
    <div
      v-for="i in 8"
      :key="i"
      data-testid="card-skeleton"
      class="h-56 animate-pulse rounded-xl border border-default bg-elevated"
    />
  </div>

  <div
    v-else-if="!paymentDetails.length"
    data-testid="card-grid-empty"
    class="flex flex-col items-center justify-center gap-3 py-16 text-center"
  >
    <UIcon name="i-lucide-credit-card" class="size-12 text-muted opacity-50" />
    <p class="text-sm text-muted">{{ empty ?? 'No hay cuentas bancarias' }}</p>
  </div>

  <div
    v-else
    data-testid="card-grid"
    class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7"
  >
    <article
      v-for="paymentDetail in paymentDetails"
      :key="paymentDetail.id"
      class="group relative flex cursor-pointer flex-col rounded-xl border border-default bg-default px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
      data-testid="payment-detail-card"
      @click="emit('card-click', paymentDetail)"
    >
      <div class="flex items-start gap-3">
        <div class="min-w-0 flex-1 space-y-1">
          <p class="line-clamp-2 text-sm font-semibold leading-tight text-highlighted">
            {{ paymentDetail.bankName }}
          </p>
          <p class="line-clamp-1 text-xs text-muted">{{ paymentDetail.beneficiary }}</p>
          <div class="flex min-h-6 flex-wrap items-center gap-1.5 pt-1">
            <StatusDotBadge
              :tone="statusTone(paymentDetail)"
              :label="paymentDetailStatusLabel(paymentDetail.isActive)"
              compact
            />
          </div>
        </div>
      </div>

      <div class="my-3 border-t border-dashed border-default" />

      <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div class="min-w-0">
          <p class="text-muted">CLABE</p>
          <p class="mt-1 truncate font-medium text-default">{{ paymentDetail.clabe }}</p>
        </div>
        <div class="min-w-0 text-right">
          <p class="text-muted">Número de cuenta</p>
          <p class="mt-1 truncate font-semibold text-default">{{ paymentDetail.accountNumber }}</p>
        </div>
      </div>
    </article>
  </div>
</template>
```

## 11. Empty / loading / error states

| State | Table view | Card view | Banner |
| ----- | ---------- | --------- | ------ |
| **Loading** | `AppDataTable :loading="isLoading"` spinner | `PaymentDetailCardGrid :loading` → 8 skeletons | hidden (`isLoading` suppresses banner) |
| **Refetching** | `:fetching="isFetching"` refresh indicator | skeleton (`isLoading || isFetching`) | stays visible (previous data retained) |
| **Empty** | `empty="No hay cuentas bancarias"` | `PaymentDetailCardGrid` empty block | shown when `!hasActiveAccount` (empty list ⇒ no active account) |
| **Error** | `AppDataTable :error="isError"` error block + retry (`@refresh`) | same error block via `AppDataTable` | hidden (`isError` suppresses banner) |
| **No active account** | n/a | n/a | inline `UAlert color="warning"` |

Banner edge case (explicit): with an **empty** list both the empty state and the banner can
render. That is intentional — "no data" (empty state) and "no active account" (banner) are
distinct operational facts, and the latter is what the bot's transfer instructions depend on.

## 12. Tests (co-located, extract-before-mock)

Priority follows the repo's "extract-before-mock" rule: pure helpers and schemas are tested first;
component/view specs use `mountWithUApp` (`src/test/mountWithUApp.ts`) and stub shared primitives
(`StatusDotBadge`, `EntityAvatar`/`AppBadge` as needed), mirroring `TenantCard.spec.ts`.

| Spec | What it tests |
| ---- | ------------- |
| `interfaces/__tests__/payment-detail.types.spec.ts` | Create schema requires all 4 + rejects bad CLABE/short account; edit all-optional (accepts `{}` and partial); `isActive` absent from both `.shape`; `paymentDetailStatusLabel` Activa/Inactiva. |
| `interfaces/__tests__/errors.spec.ts` | `extractPaymentDetailErrorCode` returns code from `.response.data.error`, `null` for `.message`-only and unknown codes; map copy matches REQ-PD-008. |
| `api/__tests__/payment-details.api.spec.ts` | `applyLocalPaymentDetailFilters` searches the 4 fields + sorts `updatedAt`; `paginatePaymentDetails` slice/total/pageCount; `paymentDetailsApi` URL+method+payload via `vi.mock` of the `http` client. |
| `utils/__tests__/payment-detail-actions.utils.spec.ts` | `isLastActivePaymentDetail` true only for the sole active row; `buildPaymentDetailDeactivateDescription` base vs strengthened copy; `buildPaymentDetailRowActions` respects `canUpdate`/`canDelete`. |
| `composables/__tests__/usePaymentDetailForm.spec.ts` | Schema selection per mode; `resetForm`; `setValues` prefills edit; initial create/edit states. |
| `composables/__tests__/usePaymentDetailColumns.test.ts` | Column ids; `actions` pinned right/non-hideable; data columns hideable. |
| `composables/__tests__/usePaymentDetailViewMode.test.ts` | Default `table`; `isPaymentDetailViewMode` guard; `displayMode` bridge `card → cards`. |
| `composables/__tests__/usePaymentDetailsTable.spec.ts` | **Locked decision:** queryFn fills `fullList` AND returns the page slice; `hasActiveAccount` derives from the full list across pages (active on page 2 still `true`); invalidation refetches. |
| `components/__tests__/PaymentDetailUpsertSlideover.spec.ts` | Create title + no `isActive` control; submit emits parsed `create`; edit prefills 4 fields + emits `edit`. |
| `components/__tests__/PaymentDetailCardGrid.spec.ts` | Skeleton, empty block, card fields + Activa/Inactiva badge, `card-click` forwarding. |
| `views/__tests__/AdminPaymentDetailsView.spec.ts` | Inline mutations success/error (invalidate + toasts + domain-code mapping); gating (add only with `create`, kebab only with `update`/`delete`); inline banner shows/hides; ConfirmModal "Desactivar" flow; list error block. |

Modified test files (extended, not rewritten):

- `src/core/shared/constants/__tests__/query-keys.test.ts` — `adminPaymentDetailQueryKeys.list/detail` shape + tenant isolation + prefix invalidation.
- `src/features/admin/roles/i18n/__tests__/permissions.spec.ts` — `SUBJECT_LABELS.PaymentDetail === 'Datos bancarios'`; `PERMISSION_COPY.PaymentDetail` has exactly `create/read/update/delete`; no `manage`/`batch_delete`; update the registry-coverage table.
- `src/features/auth/authorization/__tests__/ability.test.ts` — `PaymentDetail` membership/grant/no-silent-drop/revocation, mirroring the `NotificationConfig`/`Quotation` precedent.

## 13. Reused primitives (no reinvention)

| Primitive | Use |
| --------- | --- |
| `useServerTable` | Table state/pagination/search/error (wrapped by `usePaymentDetailsTable`). |
| `useViewMode` (via `usePaymentDetailViewMode`) | Persisted table/card toggle. |
| `AppDataTable` + `SortableHeader` | Table shell, headers, cell/actions/cards slots. |
| `ViewToggle` | Table/card segmented toggle. |
| `ConfirmModal` | Delete (logical) confirmation. |
| `StatusDotBadge` + `activityToBadgeTone` | `Activa`/`Inactiva` dot badge in table + card. |
| `USlideover` + `UForm` + `UInput` (Nuxt UI) | Create/edit form (no toggle for `isActive`). |
| `UAlert` | Inline "Sin cuenta activa" banner. |
| `normalizeApiError` | Generic error message fallback (reads `.error` code + `.message`). |
| `useAuthStore.userCan` + route guard | CASL gating (menu, route, buttons). |
| `AdminPageHeader` | Header title/description. |

No shared primitive changes.

## 14. Risks & mitigations (locked)

1. **One-active-per-branch not DB-enforced** → confirm + strengthened copy when deleting the last
   active account + inline banner.
2. **Banner vs page slice** → locked via `usePaymentDetailsTable` single-source wrapper (§8.2).
3. **Default sort vs backend order** → `defaultSorting: [{ id: 'updatedAt', desc: true }]`; local
   sort only changes on explicit user sort.
4. **Error envelope drift** → payment-details reads `.error` (domain code) via
   `extractPaymentDetailErrorCode`; generic fallback via shared `normalizeApiError`. Does NOT
   replicate the tenants `.message` drift.
5. **Route naming** → `/admin/payment-details` (English), locked in proposal; nav registry and
   router use the same string.
6. **No `manage`/`batch_delete`** → `PERMISSION_COPY.PaymentDetail` registers exactly 4 actions,
   so the role UI never suggests unseeded permissions.

## 15. Rollout (3 slices) + Review Workload Forecast

### Review Workload Forecast (recomputed for the compact tree)

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,200–1,600 |
| New files | 22 (11 implementation + 11 co-located specs) |
| Modified files | 6 code + ≤3 test |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | single PR (feature branch) with 3 internal slices |
| Delivery strategy | single-pr (one dev, one delivery to main via feature branch → merge) |
| Per-slice budget | S1 ≤ ~350, S2 ≤ ~700, S3 ≤ ~550 |

Estimate basis: compact `users`/`tenants`-style files run 60–120 lines each (API, types, columns,
view-mode, form, actions utils), the card grid ~110, the view ~230, the slideover ~110; co-located
specs run 60–160 lines each. The total is honestly ~1,200–1,600 lines — under half of the previous
~2,900-line forecast — and the split is 3 autonomous commits, not 8.

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium
```

### Slices

1. **S1 — registration + types + errors + keys** (≤ ~350 lines):
   `auth.types.ts`, `ability.ts`, `permissions.ts`, `query-keys.ts`, `interfaces/*`
   (`payment-detail.types.ts`, `errors.ts`) + their specs + the three modified test files.
   Unlocks permission parsing and the list query key. Independently verifiable, no route yet.

2. **S2 — API + single-source wrapper + columns + form + actions utils + card grid** (≤ ~700 lines):
   `payment-details.api.ts`, `usePaymentDetailsTable.ts`, `usePaymentDetailColumns.ts`,
   `usePaymentDetailForm.ts`, `usePaymentDetailViewMode.ts`, `payment-detail-actions.utils.ts`,
   `PaymentDetailCardGrid.vue` + their specs. All pure/unmounted units; unlocks list data,
   `hasActiveAccount`, columns, view mode and card rendering.

3. **S3 — view (inline mutation wiring, banner, confirm, gating) + slideover** (≤ ~550 lines):
   `PaymentDetailUpsertSlideover.vue` + `AdminPaymentDetailsView.vue` + their specs. Full CRUD
   live at `/admin/payment-details`.

Each slice follows strict TDD (RED/GREEN/TRIANGULATE/REFACTOR) and is individually revertible.
S1 and S2 are verifiable without a route; S3 makes the route reachable and completes the feature.

## 16. Rollback

The feature is isolated to `src/features/admin/payment-details/` plus six small, reversible
registration/routing edits (`auth.types.ts`, `ability.ts`, `permissions.ts`, `query-keys.ts`,
`navigation.registry.ts`, `router/index.ts`) and three test-file extensions. Rollback is a git
revert of the feature branch: removing the registration edits removes the subject, menu entry,
route and role-permission entries atomically. No frontend data/migration surface exists.
