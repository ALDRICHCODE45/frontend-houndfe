# Exploration — custom-payment-methods (Métodos de cobro)

## Feature intent

Add a frontend-only integration for the backend `PaymentMethod` feature:
1. **Admin CRUD** — list / create / edit / logical-delete / reactivate for custom payment
   methods, mirroring the existing `payment-details` admin module.
2. **POS selector** — custom payment methods appear as **additional tiles in the same 2-col
   grid** the existing charge modals already use for the 4 fixed methods (Efectivo, Tarjeta
   crédito, Tarjeta débito, Transferencia).
3. **Sale detail** — prefer the snapshot `paymentMethodName` (with grey `paymentMethodSubtitle`
   sub-line) over the base `method` label when a custom method was used.

Backend contract (authoritative, from `houndfe-backend/docs/payment-methods-frontend.md`):

| Method | Endpoint | Permission | Notes |
| ------ | -------- | ---------- | ----- |
| GET | `/admin/payment-methods` | `read:PaymentMethod` | flat array, active + inactive, `updatedAt DESC` |
| GET | `/admin/payment-methods/:id` | `read:PaymentMethod` | full DTO |
| POST | `/admin/payment-methods` | `create:PaymentMethod` | create |
| PATCH | `/admin/payment-methods/:id` | `update:PaymentMethod` | partial; **`isActive` editable** (reactivate path) |
| DELETE | `/admin/payment-methods/:id` | `delete:PaymentMethod` | logical, `isActive=false`, 204 |
| GET | `/sales/payment-methods` | `read:Sale` (NOT `read:PaymentMethod`) | POS projection, **active only**, `{ id, name, category, subtitle }`, ordered by name |

DTO shape: `{ id, tenantId, name, category, subtitle, isActive, createdAt, updatedAt }`.
`category` enum: `cash | card_credit | card_debit | transfer` (**no `credit`**).

Error codes: `400 INVALID_NAME | NAME_TOO_LONG | INVALID_CATEGORY | INVALID_SUBTITLE |
SUBTITLE_TOO_LONG`, `409 DUPLICATE_NAME`, `404 ENTITY_NOT_FOUND`, `403` permission.

Sale detail (`SaleDetailPaymentDto`): optional `paymentMethodId`, `paymentMethodName`,
`paymentMethodSubtitle`. Prefer `paymentMethodName` over `method` when present; render
`paymentMethodSubtitle` as a grey sub-line. Same for the `PAYMENT_RECEIVED` timeline event.

CASL permissions: `create:PaymentMethod`, `read:PaymentMethod`, `update:PaymentMethod`,
`delete:PaymentMethod`. POS uses `read:Sale` only.

---

## 1. The admin pattern to replicate: `src/features/admin/payment-details/`

The `payment-details` module is the **exact structural template** for the new
`payment-methods` module. It is a compact, single-source-wrapper CRUD (not the older
dedicated-mutation-composable employees pattern). Full tree:

```
src/features/admin/payment-details/
├── api/
│   ├── payment-details.api.ts              # paymentDetailsApi + pure local filter/paginate helpers
│   └── __tests__/payment-details.api.spec.ts
├── interfaces/
│   ├── payment-detail.types.ts             # zod schemas + DTO/request types + status label map
│   ├── errors.ts                           # domain error code map + extractor
│   └── __tests__/ (errors.spec.ts, payment-detail.types.spec.ts)
├── composables/
│   ├── usePaymentDetailColumns.ts          # TableColumn[] via createSimpleHeader
│   ├── usePaymentDetailForm.ts             # zod create/edit schema + reactive state
│   ├── usePaymentDetailViewMode.ts         # 'table'|'card' + displayMode bridge
│   ├── usePaymentDetailsTable.ts           # LOCKED single-source wrapper over useServerTable
│   └── __tests__/ (columns, form, viewMode, table specs)
├── components/
│   ├── PaymentDetailCardGrid.vue           # presentational card grid
│   ├── PaymentDetailUpsertSlideover.vue    # USlideover + UForm create/edit
│   └── __tests__/ (CardGrid, UpsertSlideover specs)
├── utils/
│   ├── payment-detail-actions.utils.ts     # row actions / deactivate copy builders
│   └── __tests__/payment-detail-actions.utils.spec.ts
└── views/
    ├── AdminPaymentDetailsView.vue         # route-level composition surface
    └── __tests__/AdminPaymentDetailsView.spec.ts
```

### 1.1 API surface (`api/payment-details.api.ts`)

- `paymentDetailsApi.list()` → `http.get('/admin/payment-details')` returns the **flat array**
  (no envelope). Pure helpers `applyLocalPaymentDetailFilters` and `paginatePaymentDetails`
  wrap it into `PaginatedResponse` client-side (globalFilter + single-column sort + slice).
- `getById(id)`, `create(payload)`, `update(id, payload)`, `remove(id)`.
- **Key gotcha**: `update()` defensively strips `isActive`/`tenantId` via
  `filterAllowedKeys` because the payment-details backend **rejects** `isActive`
  (`forbidNonWhitelisted` → 400). **This is the OPPOSITE of payment-methods**, where
  `isActive` IS editable for reactivation — the new API must NOT strip `isActive`.
- SEARCH_FIELDS = `['bankName','beneficiary','clabe','accountNumber']` — for payment-methods
  the searchable fields are `name` (+ possibly `subtitle`), with `category` as a filter/enum
  sort field.

### 1.2 Types (`interfaces/payment-detail.types.ts`)

- Zod `CreatePaymentDetailSchema` (all 4 required) + `UpdatePaymentDetailSchema` (all 4
  optional, partial PATCH). Payment-methods needs: `name` (required, trimmed),
  `category` (enum select), `subtitle` (optional) on create; partial on edit **plus** an
  `isActive` boolean for reactivation.
- `PaymentDetailResponse` = backend DTO (read-only `tenantId`, `isActive`).
- `CreatePaymentDetailRequest` / `UpdatePaymentDetailRequest` mirror the schemas; `isActive`
  deliberately absent. **Payment-methods differs**: `UpdatePaymentMethodRequest` MUST include
  `isActive?: boolean` (reactivation).
- `PAYMENT_DETAIL_STATUS_LABELS` + `paymentDetailStatusLabel(isActive)` = single source for the
  Activa/Inactiva badge. Payment-methods should mirror this (Activo/Inactivo) AND add a
  category label map (`cash`/`card_credit`/`card_debit`/`transfer`).

### 1.3 Error map (`interfaces/errors.ts`)

- `PaymentDetailDomainErrorCode` union + `PAYMENT_DETAIL_ERROR_MAP`.
- `extractPaymentDetailErrorCode(error)` reads **only** `error.response.data.error` (never
  `.message`), returns known code or `null`; mutator pipeline falls back to
  `normalizeApiError`.
- Payment-methods needs its own `PAYMENT_METHOD_ERROR_MAP`:
  `INVALID_NAME`, `NAME_TOO_LONG`, `INVALID_CATEGORY`, `INVALID_SUBTITLE`, `SUBTITLE_TOO_LONG`,
  `DUPLICATE_NAME`, `ENTITY_NOT_FOUND`.

### 1.4 Composable — `usePaymentDetailForm.ts`

- Owns BOTH `createState` and `editState`; `schema` computed by `mode`; `resetForm` clears
  both; `setValues` prefills editState filtering foreign keys via `ALLOWED_EDIT_KEYS`.
- `setCreateField` / `setEditField` per-field setters used by the slideover's
  `@update:model-value` handlers.
- Payment-methods form needs a **category select** (USelect / URadioGroup) and an optional
  subtitle input, plus an `isActive` toggle only in edit mode.

### 1.5 Composable — `usePaymentDetailsTable.ts` (single-source wrapper)

- `useServerTable` only exposes the page slice; the wrapper keeps `fullList` (whole flat array)
  in a ref and derives `hasActiveAccount` from it, so ONE fetch drives table + banner.
- Config: `queryKey: () => adminPaymentDetailQueryKeys.list(tenantId.value)`,
  `defaultPageSize: 10`, `persistKey: 'admin-payment-details'`,
  `defaultSorting: [{ id: 'updatedAt', desc: true }]`, `defaultPinning: { left: [], right: ['actions'] }`.
- Payment-methods wrapper mirrors this; the banner analog is optional (no "sin cuenta activa"
  requirement), but the `fullList` pattern is still useful if a "no active method" hint or a
  reactivation filter is desired.

### 1.6 Columns (`usePaymentDetailColumns.ts`)

- `TableColumn<PaymentDetailTableRow>[]`; `createSimpleHeader` for non-sortable columns
  (`isActive`, `actions`); data columns sortable/hideable. Payment-methods columns:
  `name`, `category` (label map), `subtitle`, `isActive`, `updatedAt`, `actions`.

### 1.7 Slideover (`PaymentDetailUpsertSlideover.vue`)

- `USlideover` + `defineModel<boolean>('open')` + `UForm :schema :state` + `@submit`.
- Emits `create` / `edit` payloads; `watch(props.paymentDetail)` prefills in edit mode;
  `resetForm()` on close and `@after-leave`.
- Payment-methods slideover = same shape + category select + optional subtitle + edit-mode
  `isActive` toggle (reactivate).

### 1.8 View (`AdminPaymentDetailsView.vue`)

- Route-level composition surface. Destructures the wrapper at TOP LEVEL of `<script setup>`.
- Inline `useMutation` for create/update/delete (compact pattern, not dedicated composables).
- `invalidateList()` → `queryClient.invalidateQueries({ queryKey: adminPaymentDetailQueryKeys.list(tenantId.value) })`.
- `resolveMutationError(err, fallback)` → domain code first, generic fallback via
  `normalizeApiError`.
- CASL gating: `authStore.userCan('create'|'update'|'delete', 'PaymentDetail')`.
- `AppDataTable` wiring (props + named slots) — see §1.9.
- `ConfirmModal` for deactivate; `buildPaymentDetailDeactivateDescription` /
  `buildPaymentDetailRowActions` from `utils/payment-detail-actions.utils.ts`.

### 1.9 AppDataTable + shared components

- `AppDataTable` (`src/core/shared/components/DataTable/AppDataTable.vue`) is the generic
  wrapper. The view binds v-models (`sorting`, `pagination`, `globalFilter`, `columnPinning`,
  `columnVisibility`) and props (`columns`, `data`, `loading`, `fetching`, `error`,
  `error-message`, `page-count`, `total-count`, `showing-from/to`, `page-size-options`,
  `display-mode`, `search-placeholder`, `show-add-button`, `add-button-text`, `add-button-icon`,
  `enable-column-visibility`, `empty`). It emits `add` / `refresh`.
- Column cells via named slots `#<accessorKey>-cell="{ row }"` (e.g. `#bankName-cell`,
  `#isActive-cell`, `#actions-cell`); sortable header via `#bankName-header` +
  `<SortableHeader>`; card view via `#cards`; toolbar extras via `#actions`.
- `<StatusDotBadge :tone="activityToBadgeTone(isActive)" :label="paymentDetailStatusLabel(isActive)" />`
  renders Activa/Inactiva (green/red dot). `activityToBadgeTone` lives in
  `src/core/shared/utils/badge.utils.ts`; `StatusDotBadge` in
  `src/core/shared/components/StatusDotBadge.vue`.
- `AdminPageHeader` (`src/features/admin/shared/components/AdminPageHeader.vue`) — title +
  description inside `UCard #header`.
- `ConfirmModal` (`src/core/shared/components/ConfirmModal.vue`) — `open`, `description`,
  `confirm-label`, `confirm-color`, `loading`; emits `update:open` / `confirm` / `cancel`.

### 1.10 Key differences payment-methods vs payment-details

| Concern | payment-details | payment-methods |
| --- | --- | --- |
| `isActive` editability | never editable (delete-only) | **editable via PATCH (reactivate)** |
| create/edit fields | bankName, beneficiary, clabe, accountNumber | name, category (enum), subtitle (opt) |
| `UpdateXxxRequest` | no `isActive` | **includes `isActive?: boolean`** |
| API `update` | strips `isActive`/`tenantId` | must **forward** `isActive` (but still omit `tenantId`) |
| reactivation UI | none | edit-mode toggle OR explicit "Reactivar" row action |
| banner | "Sin cuenta activa" | none required (optional) |
| search fields | 4 strings | `name` (+ `subtitle` optional) |
| category/status map | Activa/Inactiva | category label map + Activo/Inactivo |

---

## 2. CASL registration — exact insertion points

A new `'PaymentMethod'` subject must be registered in **three** places (mirroring the
`PaymentDetail` precedent, which is cited inline in each file):

### 2.1 `src/features/auth/interfaces/auth.types.ts`

`AppSubject` union starts at **line 49**. `| 'PaymentDetail'` is at **line 70**, `| 'all'` at
**line 71**.

Insert `| 'PaymentMethod'` immediately **before `| 'all'`** (i.e. between line 70 and 71).

### 2.2 `src/features/auth/authorization/ability.ts`

`APP_SUBJECTS: AppSubject[]` array starts at **line 7**. `'PaymentDetail'` is at **line 28**,
`'all'` at **line 29**.

Insert `'PaymentMethod'` immediately **before `'all'`** (between line 28 and 29). Without this
runtime entry, `parsePermissionCode` returns `null` for `create:PaymentMethod` etc. and the
ability silently drops the permission (the `PaymentDetail` comment at lines 24–27 documents
this exact failure mode).

### 2.3 `src/features/admin/roles/i18n/permissions.ts`

- `SUBJECT_LABELS` object at **line 35**; `PaymentDetail: 'Datos bancarios'` at **line 61**.
  Add `PaymentMethod: 'Métodos de cobro'` (or similar neutral-Spanish label).
- `PERMISSION_COPY` object at **line 83**; `PaymentDetail` curated block at **lines 564+**
  (end of file). Add a `PaymentMethod` block with exactly the 4 CRUD actions
  `create/read/update/delete` (**no `manage`, no `batch_delete`** — backend registers only 4).
- Do **NOT** add `PaymentMethod` to `HIDDEN_SUBJECTS` (`['all','Order']` at top).

No other literal `AppSubject` lists exist (`navigation.types.ts` only derives `PermissionTuple`
from the union; `useAuthStore.userCan` is generic).

---

## 3. POS charge flow

There are **two** charge surfaces, both with an identical 2-col tile grid and an identical
`methodOptions` array:

### 3.1 Main charge modal — `src/features/POS/sales/components/PaymentModal.vue`

Used for a **normal sale charge** (`Cobrar venta`). Confirmed via `chargeDraft` in
`src/features/POS/sales/api/sale.api.ts` (`POST /sales/drafts/:saleId/charge`).

- `methodOptions` at **lines 59–64**:
  ```ts
  { value: PAYMENT_METHOD.CASH,        label: 'Efectivo',        icon: 'i-lucide-banknote' },
  { value: PAYMENT_METHOD.CARD_CREDIT, label: 'Tarjeta crédito', icon: 'i-lucide-credit-card' },
  { value: PAYMENT_METHOD.CARD_DEBIT,  label: 'Tarjeta débito',  icon: 'i-lucide-wallet-cards' },
  { value: PAYMENT_METHOD.TRANSFER,    label: 'Transferencia',   icon: 'i-lucide-arrow-right-left' },
  ```
- `methodIconMap` at **lines 66–70**.
- `type PaymentEntryForm` at **line 26**; `entries = ref<PaymentEntryForm[]>` at **line 39**.
- `toggleMethod(method)` at **line 174**; `addEntryWithMethod(method)` at **line 169**;
  `normalizeEntries(): PaymentEntry[]` at **line 114**; `buildPayload(): ChargeSalePayload`
  at **line 217**.
- The 2-col grid markup renders at **line 324** (`v-for="option in methodOptions"`).

### 3.2 Debt charge modal — `src/features/POS/sales/components/DebtPaymentModal.vue`

Used to register a payment against an outstanding debt (`Cobrar deuda`), mounted from
`SaleDetailView.vue`. Confirmed via `registerDebtPayment`
(`POST /sales/:saleId/payments`).

- `entries = ref<PaymentEntry[]>` at **line 31**.
- `CARD_METHODS` at **lines 35–39**; `methodOptions` at **lines 41–45**; `methodIconMap` at
  **lines 48–52**.
- `handleMethodToggle(method)` at **line 104** (toggles one entry per method).
- `handleSubmit` builds `normalizedPayments` at **line 131** and calls
  `submitSafe({ payload: { payments: normalizedPayments }, idempotencyKey })` at **line 144**.
- Grid markup at **line 222** (`v-for="option in methodOptions"`); tile testid
  `payment-method-tile-${option.value}`.

### 3.3 Types + payload builders — `src/features/POS/sales/interfaces/sale.types.ts`

- `PaymentEntry` at **lines 254–258**:
  ```ts
  export interface PaymentEntry {
    method: CollectionPaymentMethod
    amountCents: number
    reference?: string
  }
  ```
  **This is the type that must gain an optional `paymentMethodId?: string`.**
- `LegacyChargePayload` at **lines 246–250** (`{ method, amountCents, dueDate? }`).
- `MultiPaymentChargePayload` at **lines 260–263** (`{ payments: PaymentEntry[], dueDate? }`).
- `ChargeSalePayload` discriminated union at **lines 266–268**.
- `DebtPaymentPayload` at **line 294** (`{ payments: PaymentEntry[] }`).
- `CollectionPaymentMethod`/`NonCreditPaymentMethod` derive from `PAYMENT_METHOD` (lowercase,
  `cash | card_credit | card_debit | transfer | credit`) minus `credit`.

### 3.4 Where `paymentMethodId` must be threaded

The cleanest model: each custom method still maps to a base `category`
(`cash|card_credit|card_debit|transfer`), so a selected custom tile produces a `PaymentEntry`
with `{ method: category, paymentMethodId: customId }` (fixed tiles leave `paymentMethodId`
undefined). Exact spots:

1. `PaymentEntry` — add `paymentMethodId?: string` (sale.types.ts:254).
2. `PaymentEntryForm` (PaymentModal.vue:26) — add `paymentMethodId?: string` and carry it
   through `normalizeEntries()` (PaymentModal.vue:114) and `buildPayload()` (PaymentModal.vue:217).
3. `DebtPaymentModal.vue` — `handleMethodToggle` (line 104) and `normalizedPayments` (line 131)
   must preserve `paymentMethodId`.
4. `PaymentEntryPatch` in `src/features/POS/sales/utils/paymentEntries.utils.ts` (line 13) and
   `createEntry`/`addEntry` (lines 16–33) — accept/thread the id. Note `PaymentEntryPatch`
   currently is `Partial<Pick<PaymentEntry,'amountCents'|'reference'>>`; extend if the id can
   change after entry creation (it should be fixed at selection, so only the tile→entry path
   needs it).
5. `methodOptions` arrays in **both** modals become a **merged** list: the 4 fixed options
   PLUS one option per active POS method (from `GET /sales/payment-methods`). Custom options
   carry `{ value: category, label: name, icon: categoryIconMap[category], paymentMethodId }`.
6. `methodIconMap`/`getMethodCount`/`getMethodColor` keying by `method` only still works
   because custom methods reuse the base `category` as their `method`; the tile badge/count
   logic needs no change if custom tiles are keyed by `category`. **Open question**: allow
   selecting two custom methods of the same category simultaneously (two different
   `card_credit` custom methods)? See §9.

### 3.5 POS projection fetch

- New API method on `saleApi` (or a small `salePaymentMethodsApi`):
  `GET /sales/payment-methods` → `{ id, name, category, subtitle }[]`, active only, ordered by
  name. Uses `read:Sale` (no `read:PaymentMethod` needed).
- Add a query key (see §6) and a small `useSalePaymentMethods()` composable (mirroring
  `useSafeTenantId` + `useQuery`, `staleTime` generous since the list is static per tenant).

---

## 4. Sale detail + timeline display

### 4.1 Payments list — `src/features/POS/sales/components/PaymentsListSection.vue`

- Renders each `SaleDetailPayment` method via `getMethodMeta(payment.method).label/.icon` at
  **lines 118–120**.
- `getMethodMeta` lives in `src/features/POS/sales/utils/paymentMethodMeta.ts`
  (`METHOD_META` keyed by UPPERCASE base codes: `CASH`, `CARD_DEBIT`, `CARD_CREDIT`,
  `TRANSFER`, `CREDIT`; unknown → `FALLBACK_META` "Otro").
- **Change**: when `payment.paymentMethodName` is present, render it instead of
  `getMethodMeta(payment.method).label`, and render `payment.paymentMethodSubtitle` as a grey
  sub-line beneath. The base `method` remains the fallback.

### 4.2 Timeline — `src/features/POS/sales/components/SaleDetailTimeline.vue`

- `eventLabel(event)` at **lines 45–51**; the `PAYMENT_RECEIVED` label is composed at **line 50**:
  ```ts
  return `Cobro de ${formatCentsMXN(event.amountCents)} en ${formatPaymentMethod(event.method)}`
  ```
  `formatPaymentMethod` (uppercase-keyed) lives in
  `src/features/POS/sales/utils/salePaymentMethod.utils.ts` (lines 17–19).
- **Change**: `PAYMENT_RECEIVED` events gain optional `paymentMethodName` /
  `paymentMethodSubtitle` on the `SaleTimelineEvent` union (sale.types.ts:152–157) and must
  prefer `paymentMethodName` over `formatPaymentMethod(event.method)`. Since `eventLabel`
  returns a single string, the subtitle sub-line needs the timeline to either append it to the
  label or render a dedicated `<p>` for the `PAYMENT_RECEIVED` branch (grey, `text-muted`).

### 4.3 Types — `SaleDetailPayment` + timeline

- `SaleDetailPayment` at **sale.types.ts:128–140** — add optional `paymentMethodId?`,
  `paymentMethodName?`, `paymentMethodSubtitle?`.
- `PAYMENT_RECEIVED` timeline member at **sale.types.ts:152–157** — add the same three
  optional fields.

### 4.4 Scope note

`PaymentMethodPills.vue` (used on the confirmed-sales list filters) keys off
`ConfirmedSaleRow.paymentMethods: SaleDetailPaymentMethod[]` (UPPERCASE base methods). Custom
methods are **snapshots inside payment rows**, not part of that filter list — so the list
filter pills do NOT need to change. `SaleDetailPaymentMethod`/`SALE_DETAIL_PAYMENT_METHOD`
stay as-is.

---

## 5. Router + sidebar

### 5.1 `src/app/router/index.ts`

- Lazy import for `AdminPaymentDetailsView` at **lines 50–51**; add an analogous
  `const AdminPaymentMethodsView = () => import('@/features/admin/payment-methods/views/AdminPaymentMethodsView.vue')`.
- Route for `/admin/payment-details` at **lines 285–293** (with
  `permission: ['read','PaymentDetail'] as RoutePermission`). Add:
  ```ts
  {
    path: '/admin/payment-methods',
    name: 'admin-payment-methods',
    component: AdminPaymentMethodsView,
    meta: { layout: 'dashboard', permission: ['read', 'PaymentMethod'] as RoutePermission },
  }
  ```

### 5.2 `src/app/navigation/navigation.registry.ts`

- `admin-payment-details` entry at **line 54** inside the `admin` group. Add the sibling entry:
  ```ts
  { id: 'admin-payment-methods', label: 'Métodos de cobro', icon: 'i-lucide-credit-card', to: '/admin/payment-methods', permission: ['read', 'PaymentMethod'] },
  ```
- The registry is PURE data; `useSidebar` and the command palette both derive from it, so one
  entry surfaces in both.

---

## 6. Query keys — `src/core/shared/constants/query-keys.ts`

- `saleQueryKeys` at **line 65** (`detail` at line 69, `confirmed` at line 67).
- `adminPaymentDetailQueryKeys` at **lines 199–204**:
  ```ts
  export const adminPaymentDetailQueryKeys = {
    list: (tenantId: string) => ['admin','payment-details', tenantId, 'list'] as const,
    detail: (tenantId: string, id: string) => ['admin','payment-details', tenantId, 'detail', id] as const,
  }
  ```
- **Mirror for admin CRUD**:
  ```ts
  export const adminPaymentMethodQueryKeys = {
    list: (tenantId: string) => ['admin','payment-methods', tenantId, 'list'] as const,
    detail: (tenantId: string, id: string) => ['admin','payment-methods', tenantId, 'detail', id] as const,
  }
  ```
- **POS projection** key: add `paymentMethods: (tenantId) => ['sales', tenantId, 'payment-methods'] as const`
  to `saleQueryKeys` (or a dedicated `salePaymentMethodQueryKeys`). Use it in
  `useSalePaymentMethods()`.
- **Cache invalidation after a charge**: `useDebtPayment.ts` already invalidates
  `saleQueryKeys.detail(tenantId, saleId)` and `saleQueryKeys.confirmed(tenantId)` on success
  (lines ~in onSuccess). `useSaleDetail` reads `saleQueryKeys.detail`. Because custom method
  names are **snapshotted** into the sale detail by the backend, no extra invalidation is
  needed for the detail screen — the existing detail invalidation suffices. The POS projection
  list (static) should use a staleTime and only invalidate on admin CRUD (if at all, it is a
  separate tenant cache so admin invalidation is optional for correctness of the POS list until
  a refetch).

---

## 7. Icons

The 4 base categories already have a stable icon map, duplicated in both charge modals:

| category | Lucide icon |
| --- | --- |
| `cash` | `i-lucide-banknote` |
| `card_credit` | `i-lucide-credit-card` |
| `card_debit` | `i-lucide-wallet-cards` |
| `transfer` | `i-lucide-arrow-right-left` |

Sources:
- `PaymentModal.vue` methodOptions lines 59–64 + methodIconMap lines 66–70.
- `DebtPaymentModal.vue` methodOptions lines 41–45 + methodIconMap lines 48–52.
- `paymentMethodMeta.ts` (`src/features/POS/sales/utils/paymentMethodMeta.ts`) has a
  **different** UPPERCASE-keyed map for the confirmed-sale detail/pills context
  (`CASH`→banknote, `CARD_DEBIT`/`CARD_CREDIT`→credit-card, `TRANSFER`→arrow-right-left,
  `CREDIT`→hand-coins). Custom-method tiles should reuse the **lowercase** category→icon map
  from the charge modals (extract it into a shared constant/util to avoid a third duplicate).

Base label constants:
- `PAYMENT_METHOD` (lowercase) at `sale.constants.ts:83–89`.
- `SALE_DETAIL_PAYMENT_METHOD` (uppercase) at `sale.constants.ts:100–107`.
- `SALE_TIMELINE_EVENT_TYPE` at `sale.constants.ts:117–122`.
- Uppercase labels/colors live in `salePaymentMethod.utils.ts` (labels lines 1–7, colors
  lines 9–15, `formatPaymentMethod` 17–19, `getPaymentMethodColor` 21–23).

---

## 8. Test conventions

Harness: `src/test/mountWithUApp.ts` wraps the component in `<UApp>` so Nuxt UI provider
contexts (Tooltip/Toast/Modal providers) resolve via `inject()`.

### 8.1 Admin view spec — `views/__tests__/AdminPaymentDetailsView.spec.ts`

- `// @ts-nocheck` + `mount`/`flushPromises` from `@vue/test-utils`.
- Mocks the single-source wrapper (`usePaymentDetailsTable` → stable `mockTable` of refs),
  `useAuthStore` (`userCan` mock), `useToast` (`vi.mock('@nuxt/ui/runtime/composables/useToast')`),
  `@tanstack/vue-query` (captures `useMutation` handles so tests invoke `config.onSuccess` /
  `config.onError` directly; `useQueryClient` → `invalidateQueries` mock), and shallow-stubs
  child components (`AppDataTable`, `SortableHeader`, `ConfirmModal`, `AdminPageHeader`,
  `PaymentDetailUpsertSlideover`, `PaymentDetailCardGrid`, `ViewToggle`) plus Nuxt UI stubs
  (both `U*` and unprefixed names).
- Assertions drive `data-testid` (e.g. `no-active-account-banner`, `app-data-table`,
  `kebab-menu`, `table-error-state`) and assert invalidate calls use the exact query key
  `['admin','payment-details','tenant-1','list']`.

### 8.2 Composable spec — `composables/__tests__/usePaymentDetailsTable.spec.ts`

- Mocks `useServerTable` (captures `queryKey`/`queryFn`/`defaultSorting`/`defaultPinning`/
  `persistKey`), `useAuthStore` (`currentTenantId`), and **partial-mocks the feature API**
  keeping the real `paginatePaymentDetails` helper:
  `vi.mock('@/features/admin/payment-details/api/payment-details.api', async (importOriginal) => ({...actual, paymentDetailsApi: {...actual.paymentDetailsApi, list: vi.fn()}}))`.
- Drives the captured `queryFn` directly to assert `fullList` + page slice + derived flags.

### 8.3 API spec — `api/__tests__/payment-details.api.spec.ts`

- `vi.mock('@/core/shared/api/http')` and assert `http.get/post/patch/delete` call signatures
  (exact URL + payload), never sending `isActive`/`tenantId` on create. Payment-methods spec
  must **assert the opposite** for update: `isActive` IS forwarded (reactivation), `tenantId`
  still omitted.

### 8.4 POS modal spec — `components/__tests__/DebtPaymentModal.test.ts`

- `shallow: true` + `renderStubDefaultSlot: true`; stubs Nuxt UI under both `U*` and
  unprefixed names (the comment explains Nuxt UI v4 resolves to unprefixed internal names).
- Mocks `useDebtPayment`, `idempotency.utils`, `currency.utils`, `vue-router`.
- Asserts tile clicks (`payment-method-tile-cash`, `payment-method-tile-card_credit`), entry
  testids (`payment-entry-0`, `payment-amount-0`, `payment-reference-0`), and the final
  `submitSafe` payload shape (including that a non-CASH entry **omits** `reference`).
  **New RED tests** should assert custom tiles render (`payment-method-tile-<id>` or a
  `payment-method-tile-custom-<id>` convention) and that the submitted `PaymentEntry` carries
  `paymentMethodId` for custom methods and omits it for fixed methods.

---

## 9. Open questions / unknowns

| # | Question | Where decided | Recommended resolution |
| --- | --- | --- | --- |
| 1 | Does the charge payload send `{ method: category, paymentMethodId }` (dual) or `{ paymentMethodId }` only? | Backend `payment-methods-frontend.md` (not yet read in this repo) | Dual `method` (base category) + optional `paymentMethodId`; keeps `PaymentEntry.method`/aggregation intact and stays backward-compatible. Confirm during design. |
| 2 | Can two custom methods of the **same category** be selected simultaneously in one charge (e.g. two `card_credit` custom methods)? Current `toggleMethod`/`getMethodCount` key by `method` (category), so two custom methods with the same category would collide. | Design | If yes, key custom tiles by `paymentMethodId` (or `id`) instead of `method`; if no (one custom per category max), the current keying works unchanged. |
| 3 | Does `SaleDetailPayment.method` still carry a base UPPERCASE method for custom payments (so fallback/`getMethodMeta` still works), or is it null/absent when `paymentMethodName` is present? | Backend DTO | Assume `method` stays populated (base category) with `paymentMethodName` as the preferred label — keeps `shouldShowEditReference` (which keys on `method`) correct. |
| 4 | Reactivation UI shape: explicit "Reactivar" row action vs an edit-mode `isActive` toggle in the slideover? | Design | Follow backend: `isActive` editable via PATCH → simplest is an edit-mode `UToggle`/`USwitch` in the slideover + keep DELETE as the "Desactivar" path. |
| 5 | POS projection fetch lifecycle: fetch once per tenant with long `staleTime`, or refetch on modal open? | Design | `useSalePaymentMethods()` with `staleTime: 5 * 60_000`, `refetchOnWindowFocus: false`; invalidate on admin CRUD is optional (separate cache) but cheap to add. |
| 6 | Idempotency key: does a custom-method charge reuse the existing `newIdempotencyKey()` + regen-on-entries-change, or does `paymentMethodId` require any change? | Existing code | No change — idempotency keys already regenerate on any entry mutation in both modals. |
| 7 | Does the POS tile grid stay a single merged `methodOptions` array (fixed 4 + customs), or a separate "custom" section? | User scope | Single merged array in the same 2-col grid (scope item 2 fixed this). |
| 8 | Category enum has **no `credit`** — confirm the admin category select omits Crédito and the POS tiles never surface a credit-category custom method. | Backend enum | Omit `credit` from the category select; POS projection only returns active rows so it is safe by construction. |
| 9 | Should `subtitle` be searchable in the admin list, or `name` only? | Design | `name` only for the global filter (mirrors payment-details' narrow search), `subtitle` shown in the row/card. |

---

## 10. Recommended slice boundary

1. **Types + query keys + CASL** — `auth.types.ts`, `ability.ts`, `permissions.ts`,
   `query-keys.ts`, new `payment-methods` `interfaces/*` (types + errors) → unlocks permission
   parsing and the list key.
2. **Admin read** — `payment-methods.api.ts` + `usePaymentMethodsTable` + columns + view
   (read-only list, category/status badges) + route + nav.
3. **Admin mutations** — slideover (create/edit/reactivate) + ConfirmModal delete + error
   toasts + tests.
4. **POS tiles + charge threading** — `saleApi` POS projection + `useSalePaymentMethods` +
   merge tiles in both modals + `PaymentEntry.paymentMethodId` + payload builders + tests.
5. **Sale detail + timeline** — `SaleDetailPayment`/timeline type extensions +
   `PaymentsListSection` + `SaleDetailTimeline` prefer `paymentMethodName`/subtitle + tests.

Slices 1–3 and 4–5 are independently verifiable.
