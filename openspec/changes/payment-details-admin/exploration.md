# Exploration — payment-details-admin (Datos bancarios)

## Feature intent

Add a new admin bounded context **"Datos bancarios"** (`PaymentDetail`) that manages the
tenant's bank accounts used for transfer payments via the WhatsApp bot. It is a standard
admin CRUD, tenant-scoped and CASL-permission-gated, with a logical delete (baja lógica)
and no reactivation path.

Backend contract (from `houndfe-backend/docs/payment-details-frontend.md` + source):

| Method | Endpoint | Permission | Notes |
| ------ | -------- | ---------- | ----- |
| POST | `/admin/payment-details` | `create:PaymentDetail` | 201, returns full DTO, `isActive: true` by default |
| GET | `/admin/payment-details` | `read:PaymentDetail` | flat array, no pagination, order `updatedAt DESC` |
| GET | `/admin/payment-details/:id` | `read:PaymentDetail` | 200 full DTO |
| PATCH | `/admin/payment-details/:id` | `update:PaymentDetail` | partial, 200 updated DTO |
| DELETE | `/admin/payment-details/:id` | `delete:PaymentDetail` | logical `isActive=false`, 204 |

DTO shape (`PaymentDetailResponseDto`): `{ id, tenantId, bankName, beneficiary, clabe,
accountNumber, isActive, createdAt, updatedAt }` (all strings except `isActive` boolean,
timestamps ISO 8601).

Validation: `clabe` exactly 18 digits; `accountNumber` >= 10 digits (digits only);
`bankName` / `beneficiary` non-empty after trim. `isActive` is **not** an editable field —
sending it produces `400` (global `ValidationPipe` uses `forbidNonWhitelisted`).

## Confirmed architecture / pattern decisions

### 1. Module directory + template

Feature dir: `src/features/admin/payment-details/{api,interfaces,composables,components,views}`
plus `__tests__` subfolders (matches the existing `users` / `tenants` / `employees` layout).

Primary template is `src/features/admin/users` (admin CRUD, tenant-scoped, permission-gated).
Concrete adaptations pulled from `tenants` (flat array → client-side `PaginatedResponse`,
slideover form, `mapTenantError`) and `employees` (dedicated mutation composables +
`errors.ts` with `extractDomainErrorCode`).

### 2. Template shape (users) — exact files read

- `src/features/admin/users/api/users.api.ts` — `usersApi` with `getPaginated`,
  `getById`, `create`, `update`, `remove`. For payment-details the list endpoint returns a
  flat array (not `{ data, meta }`), so `getPaginated` will follow the **tenants** variant
  (wrap the flat array into `{ data, pagination }`).
- `src/features/admin/users/interfaces/user.types.ts` — separates backend list item vs
  table row vs create/update request interfaces.
- `src/features/admin/users/composables/useUserForm.ts` — zod schemas split by
  `create | edit` mode, `reactive` state, `resetForm`, and a `setEdit*` helper to prefill.
- `src/features/admin/users/composables/useUserColumns.ts` — `TableColumn<UserTableRow>[]`
  with `createSimpleHeader` from `@/core/shared/components/DataTable`.
- `src/features/admin/users/composables/useUserViewMode.ts` — wraps
  `useViewMode(STORE_KEY, VALID_MODES, 'table')`, exposes `viewMode`, `setMode`,
  `toggleViewMode`, and a `displayMode` bridge to `'table' | 'cards'`.
- `src/features/admin/users/components/UserUpsertSlideover.vue` — `USlideover` + `UForm
  :schema` + `defineModel<boolean>('open')` + `create`/`edit` emits.
- `src/features/admin/users/views/AdminUsersView.vue` — `useServerTable` +
  `AppDataTable` + `ViewToggle` + inline `useMutation` (create/edit/delete) + `ConfirmModal`.

### 3. Flat array → client-side `PaginatedResponse` (tenants)

`src/features/admin/tenants/api/tenants.api.ts` is the exact model to copy:

```ts
async getPaginated(params, includeInactive): Promise<PaginatedResponse<TenantTableRow>> {
  const { data } = await http.get<TenantResponse[]>('/admin/tenants', { params: { includeInactive } })
  const rows = data
  const filteredRows = applyLocalTenantFilters(rows, params)   // globalFilter + sorting
  const totalCount = filteredRows.length
  const pageCount = Math.ceil(totalCount / params.pageSize) || 1
  const start = params.pageIndex * params.pageSize
  const pagedRows = filteredRows.slice(start, start + params.pageSize)
  return { data: pagedRows, pagination: { pageIndex: params.pageIndex, pageSize: params.pageSize, totalCount, pageCount } }
}
```

`useServerTable` (`src/core/shared/composables/useServerTable.ts`) only needs:
`queryKey` (fn), `queryFn` (fn receiving `ServerTableParams`), and optional
`defaultPageSize`, `persistKey`, `defaultSorting`, `defaultPinning`. It drives
`{ pagination, sorting, globalFilter, data, totalCount, pageCount, isLoading, isFetching,
isError, error, refresh, pageSizeOptions, showingFrom, showingTo }`.

For payment-details there is **no `includeInactive` filter** — the backend list always
returns active + inactive. The client-side `applyLocalPaymentDetailFilters` should still
implement `globalFilter` (search across `bankName` / `beneficiary` / `clabe` /
`accountNumber`) and sorting; the default sort should be `updatedAt desc` to mirror backend
order. Note the backend already sorts `updatedAt DESC`; client-side sorting should preserve
that default.

### 4. Form via USlideover + UForm + zod

Follow `useTenantForm` (`src/features/admin/tenants/composables/useTenantForm.ts`) for the
slideover form. Create schema requires all four fields; edit schema makes all four optional
(partial PATCH). `isActive` must **not** appear in either schema.

### 5. Baja via ConfirmModal + mutation remove

Follow `AdminUsersView.vue` / `AdminTenantsView.vue`: `ConfirmModal` with `confirm-label`
"Desactivar", `confirm-color="error"`, description "¿Desactivar esta cuenta? El bot dejará
de mostrarla en el mensaje de transferencia."

### 6. Dedicated mutation composables

`src/features/admin/employees/composables/useCreateEmployee.ts` is the pattern for
`useCreatePaymentDetail` / `useUpdatePaymentDetail` / `useDeletePaymentDetail`. It uses
`useMutation`, a local `declare const useToast`, invalidates the list query key on success,
and on error calls `extractDomainErrorCode(error)` then maps via `*_ERROR_MAP`.

### 7. Error map (`.error`, not `.message`) — DISCREPANCY RESOLVED

**Confirmed backend emits the domain code in `error` (not `message`).**

`houndfe-backend/src/shared/filters/domain-exception.filter.ts` (lines 46–50):

```ts
const body: Record<string, unknown> = {
  statusCode: status,
  error: exception.code,
  message: exception.message,
  timestamp: exception.timestamp.toISOString(),
};
```

So the canonical envelope is `{ statusCode, error: <code>, message, timestamp }`.
The **employees** convention (`extractDomainErrorCode` reading
`error.response.data.error`) is the correct one for payment-details. The **tenants**
convention (`mapTenantError` reading `error.response?.data?.message`) is the one that
drifted and is NOT the right source for payment-details domain codes.

Payment-details domain codes to map:
- `DUPLICATE_CLABE` → 409 (from `BusinessRuleViolationError`, thrown by
  `prisma-payment-detail.repository.ts` on Prisma P2002).
- `ENTITY_NOT_FOUND` → 404 (from `EntityNotFoundError('PaymentDetail', id)`, thrown by the
  service for missing/cross-tenant ids).
- `NO_ACTIVE_PAYMENT_DETAIL` → 404 (chatbot endpoint only; NOT raised by the admin CRUD, but
  harmless to include in the map).

## Exact files to CREATE

```
src/features/admin/payment-details/
├── api/payment-details.api.ts                 # paymentDetailsApi + mapPaymentDetailError + applyLocalPaymentDetailFilters
├── interfaces/payment-detail.types.ts         # PaymentDetailResponse, PaymentDetailTableRow, CreatePaymentDetailRequest, UpdatePaymentDetailRequest
├── interfaces/errors.ts                       # PaymentDetailDomainErrorCode + PAYMENT_DETAIL_ERROR_MAP
├── composables/usePaymentDetailForm.ts        # zod create/edit schemas + state + reset/setValues
├── composables/usePaymentDetailColumns.ts     # TableColumn<PaymentDetailTableRow>[]
├── composables/usePaymentDetailViewMode.ts    # 'table' | 'card' + displayMode bridge
├── composables/useCreatePaymentDetail.ts
├── composables/useUpdatePaymentDetail.ts
├── composables/useDeletePaymentDetail.ts
├── components/PaymentDetailUpsertSlideover.vue
├── components/PaymentDetailCard.vue           # optional card view
├── components/PaymentDetailCardGrid.vue       # optional card view
├── views/AdminPaymentDetailsView.vue
└── __tests__/ (per-module specs, mirroring users/tenants/employees conventions)
```

`extractDomainErrorCode` can be re-imported from `employees/composables/useCreateEmployee`,
but its return type is `EmployeeDomainErrorCode`. Cleaner: define a small local
`extractPaymentDetailErrorCode` in `payment-details/api` or a `usePaymentDetailError` helper,
and keep `errors.ts` the single source for the `PAYMENT_DETAIL_ERROR_MAP`. This avoids the
type leak from the employees module.

## Exact files to MODIFY

1. `src/features/auth/interfaces/auth.types.ts`
   — add `| 'PaymentDetail'` to the `AppSubject` union (before `| 'all'`).
2. `src/features/auth/authorization/ability.ts`
   — add `'PaymentDetail'` to the `APP_SUBJECTS` array (before `'all'`).
3. `src/features/admin/roles/i18n/permissions.ts`
   — add `PaymentDetail: 'Datos bancarios'` to `SUBJECT_LABELS`.
   — add a `PaymentDetail` block to `PERMISSION_COPY` with `create`/`read`/`update`/`delete`
     (no `manage`, no `batch_delete` — matching the backend registry which registers exactly
     4 actions). Do NOT add to `HIDDEN_SUBJECTS`.
4. `src/app/navigation/navigation.registry.ts`
   — add to the `admin` group children:
     `{ id: 'admin-payment-details', label: 'Datos bancarios', icon: 'i-lucide-credit-card', to: '/admin/datos-bancarios', permission: ['read', 'PaymentDetail'] }`.
5. `src/app/router/index.ts`
   — add a lazy import
     `const AdminPaymentDetailsView = () => import('@/features/admin/payment-details/views/AdminPaymentDetailsView.vue')`
   — add a route with `meta: { layout: 'dashboard', permission: ['read', 'PaymentDetail'] as RoutePermission }`.
6. `src/core/shared/constants/query-keys.ts`
   — add:
     ```ts
     export const adminPaymentDetailQueryKeys = {
       list: (tenantId: string) => ['admin', 'payment-details', tenantId, 'list'] as const,
       detail: (tenantId: string, id: string) => ['admin', 'payment-details', tenantId, 'detail', id] as const,
     }
     ```
   (tenant-scoped, mirroring `adminUserQueryKeys` / `adminRoleQueryKeys`).

## Exhaustive subject-list audit (grep results)

Files that hardcode `AppSubject` / subject lists and would need the `PaymentDetail` entry:

- `src/features/auth/interfaces/auth.types.ts` — `AppSubject` union (MODIFY).
- `src/features/auth/authorization/ability.ts` — `APP_SUBJECTS` array (MODIFY).
- `src/features/admin/roles/i18n/permissions.ts` — `SUBJECT_LABELS` + `PERMISSION_COPY`
  (+ `HIDDEN_SUBJECTS`, which should stay unchanged) (MODIFY).
- `src/app/navigation/navigation.types.ts` — only `import type { AppAction, AppSubject }`,
  derives `PermissionTuple`; no literal list (NO change).
- `src/app/router/index.ts` — `import type { AppAction, AppSubject }` + `RoutePermission`
  (no literal list, but route + permission tuple needed) (MODIFY).
- `src/features/auth/stores/useAuthStore.ts` — `userCan(action, subject)` is generic
  (NO change).
- `src/features/admin/roles/composables/useRolePermissions.ts` — filters via
  `isSubjectHidden`; no literal list (NO change, but new subject will flow through).
- `src/features/admin/employees/views/EmployeeDetailView.vue` — generic `userCan`
  (NO change).
- Tests that assert union membership (`ability.test.ts`, `foundation.spec.ts`) are NOT
  required to change, but adding a `PaymentDetail` compile-time check in
  `ability.test.ts` would mirror the existing `NotificationConfig`/`Quotation` precedent.

No existing `payment-details` feature exists in `frontend-houndfe/src` (grep returned no
matches; `find` for `**/payment-details/**` returned none).

## Risks / unknowns

1. **"Sin cuenta activa" banner vs paginated slice.** `useServerTable` only exposes the
   current page slice (`data`), but the banner needs to know whether the tenant has **any**
   active account across the full flat list. Resolution options: (a) expose the full
   filtered array from a thin wrapper around the query so the view can derive
   `hasActiveAccount`, or (b) a dedicated lightweight `useQuery`/derived flag. Recommend
   (a): since the list is small and client-paginated, keep the full array in the view and
   derive both the paginated table data and the banner from it. This is the main open design
   decision; it does not block the rest of the feature.
2. **Default sort vs backend order.** Backend returns `updatedAt DESC`. Client-side
   `applyLocalPaymentDetailFilters` must default to `updatedAt desc` (and `useServerTable`
   `defaultSorting: [{ id: 'updatedAt', desc: true }]`) to avoid reordering the canonical
   "most recently updated first" view.
3. **`extractDomainErrorCode` return-type leak.** Reusing the employees helper couples the
   module to `EmployeeDomainErrorCode`. Prefer a local payment-details error extractor.
4. **Route path naming.** Parent decision fixed the module dir as `payment-details`, but the
   user-facing route could be `/admin/datos-bancarios` (Spanish, matching UI conventions) or
   `/admin/payment-details` (English, matching backend + module). Confirm the final path with
   the parent; both the navigation registry and router must use the same string. This doc
   proposes `/admin/datos-bancarios`.
5. **No `manage:PaymentDetail`.** Backend registers only `create/read/update/delete`. Do NOT
   add a `manage` entry to `PERMISSION_COPY`; role UI fallback would otherwise suggest a
   permission the backend never seeds.

## Recommended first-slice boundary

1. Types + query keys + CASL registration (`auth.types.ts`, `ability.ts`, `query-keys.ts`,
   `interfaces/*`, `permissions.ts` SUBJECT_LABELS + PERMISSION_COPY) — unlocks permission
   parsing and list key.
2. `payment-details.api.ts` + `interfaces/errors.ts` + `useServerTable` list wiring +
   `usePaymentDetailColumns` + `usePaymentDetailViewMode` + `AdminPaymentDetailsView` with
   read-only list (badge + table/card toggle), no mutations yet.
3. Mutations + slideover + ConfirmModal delete + error toasts.
4. Banner "Sin cuenta activa" + card view polish + tests.

Slices 1–3 are independently verifiable; slice 4 is UI polish and can land separately.
