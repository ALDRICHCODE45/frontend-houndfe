# Delivery Routes — Exploration

Change: `delivery-routes` · Phase: EXPLORE · Backend: DONE (MVP merged)
Contract source of truth: `houndfe-backend/docs/delivery-routes-frontend.md` (read).

---

## 1. Relevant existing features and shared primitives to reuse

### Canonical feature shape (verified)
- `src/features/system/notifications/` — config toggle + data-driven registry. Shows the
  `copy.ts` + `registry/` pattern (`copy.ts`, `registry/action-registry.ts`,
  `interfaces/notification-config.types.ts`).
- `src/features/admin/payment-details/` — CRUD + `useServerTable`. Shows the
  zod-in-`interfaces/*.types.ts` pattern (`interfaces/payment-detail.types.ts`) plus a
  domain error map in `interfaces/errors.ts` (`interfaces/errors.ts`). Note: this feature
  has **no** `copy.ts` and **no** `constants/` — the canonical shape is a guideline, not a
  hard requirement.

Recommended delivery-routes layout (mirror the two precedents):
`src/features/delivery-routes/{api,composables,components,views,utils,interfaces,constants}` +
`copy.ts`.

### HTTP / errors
- `src/core/shared/api/http.ts` — shared axios instance (`http`), injects JWT, refresh
  interceptor, `csvParamsSerializer` for array query params, `Cache-Control: no-cache` on GETs.
- `src/core/shared/utils/error.utils.ts` — `normalizeApiError(err, fallback?)` →
  `{ message, code? }`, plus `mapDomainError` back-compat. Backend envelope is
  `{ statusCode, error (CODE), message, timestamp }`; domain code lives in `error`, not `message`.
- Feature error-map precedent: `src/features/admin/payment-details/interfaces/errors.ts`
  (`PAYMENT_DETAIL_ERROR_MAP` + `extractPaymentDetailErrorCode`). Delivery-routes should add
  `interfaces/errors.ts` with codes `DELIVERY_ROUTE_INVALID_TRANSITION`,
  `DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE`, `DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE`,
  `ENTITY_NOT_FOUND`.

### CASL / RBAC
- `src/features/auth/authorization/ability.ts` — `APP_SUBJECTS` runtime array +
  `parsePermissionCode` + `updateAbilityFromPermissionCodes`.
- `src/features/auth/interfaces/auth.types.ts` — `AppSubject` union + `AppAction`.
- `src/features/auth/stores/useAuthStore.ts` — `permissionCodes: string[]`,
  `userCan(action, subject)` (line ~272), `fetchPermissions()` via `GET /auth/me/permissions`.
- `src/features/admin/roles/i18n/permissions.ts` — human labels/descriptions for the role
  permission UI (`SUBJECT_LABELS` + `PERMISSION_COPY`).

### Query keys
- `src/core/shared/constants/query-keys.ts` — ALL query keys centralized here (never local).
  Add `deliveryRouteQueryKeys = { list(tenantId, params), detail(tenantId, id) }`.
  Reuse existing `usersQueryKeys.assignable()` for the driver picker.

### Routing / menu
- `src/app/router/index.ts` — lazy route imports + `meta.permission: [action, subject]`.
- `src/app/navigation/navigation.registry.ts` — sidebar + command-palette single source.
- `src/app/navigation/navigation.types.ts` — `PermissionTuple = [AppAction, AppSubject]`.

### Server table
- `src/core/shared/composables/useServerTable.ts` — generic server-table composable.
- `src/features/admin/payment-details/composables/usePaymentDetailsTable.ts` — wrapper
  precedent that adds `fullList`/derived flags on top of `useServerTable` (useful for the
  manager list).

### Sales (for eligible-sales picker)
- `src/features/POS/sales/api/sale.api.ts` — `saleApi.listConfirmed(params)` → `GET /sales`.
- `src/features/POS/sales/interfaces/sale.types.ts` — `ConfirmedSaleRow`, `ListSalesParams`,
  `SaleDeliveryStatus`, `Sale`, `SaleDetail`.
- `src/features/POS/sales/composables/useConfirmedSales.ts` — list composable; supports
  `deliveryStatus` filter via `resolveDeliveryStatus`/`setTabFilter`, and maps filters to
  `ListSalesParams`.
- `src/features/POS/sales/config/salesFiltersSchema.ts` — `deliveryStatus` multiEnum filter.
- `src/features/POS/sales/constants/sale.constants.ts` — `SALE_DELIVERY_STATUS`.
- `src/features/POS/sales/utils/saleStatus.utils.ts` — `deliveryStatusBadgeMap`.

### Customers (for address + map write)
- `src/features/POS/customers/interfaces/customer.types.ts` — `CustomerAddress`,
  `CustomerAddressBackendResponse`, `CreateCustomerAddressPayload`, `AddressFormInput`.
- `src/features/POS/customers/api/customer.api.ts` — `createAddress`, `updateAddress`,
  `mapAddress`.
- `src/features/POS/customers/components/AddressModal.vue` — THE shared address create/edit form.
- `src/features/POS/customers/components/CustomerUpsertSlideover.vue` — customer upsert +
  address list (create-mode inline `addresses[]`).
- `src/features/POS/sales/components/AssignCustomerSlideover.vue` — draft-sale shipping
  address picker (reuses `AddressModal`).

### Timeline precedent
- `src/features/POS/sales/components/SaleDetailTimeline.vue` + `SaleTimelineEvent` union in
  `sale.types.ts` (4 event types: `SALE_REGISTERED`, `PAYMENT_RECEIVED`,
  `PRODUCTS_DELIVERED`, `COMMENT`). See §4 for reuse decision.

### DnD
- `sortablejs` + `vuedraggable` already in `package.json` but **unused** in `src/`
  (no DnD precedent). `vuedraggable@4` is the Vue 3 wrapper over `sortablejs` — use it for
  S5 stop reorder.

### Map dependency
- `leaflet` is **NOT** in `package.json`. S3 must add `leaflet` (+ `@types/leaflet`).

---

## 2. CASL subjects to register; sidebar/router touch points (exact)

Register the `DeliveryRoute` subject in **three** places (the PaymentDetail/PaymentMethod
registrations are the exact precedent):

1. **`src/features/auth/interfaces/auth.types.ts`** — add `| 'DeliveryRoute'` to the
   `AppSubject` union (before `| 'all'`, ~lines 49–80).
2. **`src/features/auth/authorization/ability.ts`** — add `'DeliveryRoute'` to the
   `APP_SUBJECTS` array (before `'all'`, ~lines 7–36). Without both, `parsePermissionCode`
   silently drops `*:DeliveryRoute` and the ability never grants.
3. **`src/features/admin/roles/i18n/permissions.ts`** — the role-permission UI copy:
   - `SUBJECT_LABELS` (~lines 37–71): add `DeliveryRoute: 'Rutas de entrega'`.
   - `PERMISSION_COPY` (append a `DeliveryRoute` block, mirroring `PaymentDetail` ~line 563):
     exactly `create / read / update / delete` (no `manage`, no `batch_delete`) with
     neutral-Spanish labels + one-line descriptions.

Sidebar:
- `src/app/navigation/navigation.registry.ts` — add a POS-group child, e.g.
  `{ id: 'pos-delivery-routes', label: 'Rutas de entrega', icon: 'i-lucide-truck',
     to: '/pos/rutas-de-entrega', permission: ['read', 'DeliveryRoute'] }`.

Router:
- `src/app/router/index.ts` — add lazy `DeliveryRoutesListView` +
  `DeliveryRouteDetailView` imports and routes:
  - `GET /pos/rutas-de-entrega` → list, `permission: ['read', 'DeliveryRoute']`.
  - `GET /pos/rutas-de-entrega/:id` → detail, `permission: ['read', 'DeliveryRoute']`.
  Both manager and driver have `read:DeliveryRoute`, so ONE list route serves both; the
  view internally discriminates manager vs driver (do NOT infer from route payload).

Manager/driver discriminator (per backend §5):
- `authStore.userCan('create', 'DeliveryRoute') || authStore.userCan('delete', 'DeliveryRoute')`
  → **manager** UI. Read/update only → **driver** UI.
- Do not send a `driverUserId` query param — list scoping is server-side (CASL).

---

## 3. API surface sketch (endpoints + methods + request/response summary)

All under `/delivery-routes`, JWT bearer, tenant from token. Cross-tenant id → `404`.

| Method | Endpoint | Permission | Purpose |
| ------ | -------- | ---------- | ------- |
| POST | `/delivery-routes` | `create:DeliveryRoute` | Create DRAFT route from ≥1 eligible sale |
| GET | `/delivery-routes` | `read:DeliveryRoute` | List (drivers see own only; managers see all) |
| GET | `/delivery-routes/:id` | `read:DeliveryRoute` | Detail + timeline |
| PATCH | `/delivery-routes/:id` | `update:DeliveryRoute` | DRAFT-only: reassign driver / update notes |
| DELETE | `/delivery-routes/:id` | `delete:DeliveryRoute` | Hard-delete DRAFT with zero stops → `204` |
| POST | `/delivery-routes/:id/start` | `update:DeliveryRoute` | DRAFT → ACTIVE |
| POST | `/delivery-routes/:id/cancel` | `update:DeliveryRoute` | DRAFT/ACTIVE → CANCELLED |
| POST | `/delivery-routes/:id/stops` | `update:DeliveryRoute` | Append one eligible sale to DRAFT → `201` |
| POST | `/delivery-routes/:id/stops/:stopId/check-in` | `update:DeliveryRoute` | Check-in stop; mirrors sale DELIVERED; next-stop email |
| PUT | `/delivery-routes/:id/stops/reorder` | `update:DeliveryRoute` | Replace DRAFT stop order |

Lifecycle: `DRAFT → ACTIVE → COMPLETED` (or `CANCELLED`); `COMPLETED` terminal.

**`DeliveryRouteResponseDto`** (every route endpoint except DELETE):
```
id: string
status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
driver: { id, name, email } | null
startedAt | completedAt | cancelledAt: string | null
notes: string | null
stops: DeliveryRouteStop[]   // sorted by sortOrder ASC
timeline: DeliveryRouteTimelineEvent[]
```

**`DeliveryRouteStop`**:
```
id, saleId, saleFolio: string | null, sortOrder: number
status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
checkedInAt | completedAt: string | null
customer: { id, name, email } | null
shippingAddress: { id, street, exteriorNumber, interiorNumber, zipCode, neighborhood,
                   municipality, city, state, label } | null   // label present here
```

**Request bodies**:
- create: `{ saleIds: string[], driverUserId: string, notes?: string }` → `201`.
- PATCH: `{ driverUserId? }` and/or `{ notes?: string | null }`.
- append stop: `{ saleId: string }` → `201`.
- reorder: `{ orderedStopIds: string[] }` (every existing stop exactly once).
- start/cancel/check-in: no body.

**Timeline** (`GET /:id` only; sorted ascending by `at` — backend sorts):
`ROUTE_CREATED` (actor null) · `ROUTE_STARTED` · `STOP_CHECKED_IN` (`stopId`, `sortOrder`) ·
`ROUTE_COMPLETED` · `ROUTE_CANCELLED`. Actor = assigned driver (or null).

**Notification opt-in**: `GET /notification-config` → `{ enabled, recipients, enabledActions }`;
`PUT /notification-config` full-overwrite `{ enabled, recipientUserIds, enabledActions }`.
`enabledActions` locked set: `LOW_STOCK | TIME_OFF_REQUESTED | DELIVERY_NEXT_STOP`.

**Key error codes**: `DELIVERY_ROUTE_INVALID_TRANSITION` (422) ·
`DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE` (422) ·
`DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE` (409) · `ENTITY_NOT_FOUND` (404).

### Notable frontend gaps (must fix in S1)
- **`SHIPPED` does not exist anywhere in `src/`** (grep = 0 matches). Must add it to:
  - `SALE_DELIVERY_STATUS` in `src/features/POS/sales/constants/sale.constants.ts` (currently
    `PENDING | DELIVERED | NOT_APPLICABLE`) and the derived `SaleDeliveryStatus` type in
    `sale.types.ts`.
  - `deliveryStatusBadgeMap` in `src/features/POS/sales/utils/saleStatus.utils.ts`
    (currently only `DELIVERED`/`PENDING`; otherwise SHIPPED renders "Desconocido").
  - `deliveryStatus` filter options in `src/features/POS/sales/config/salesFiltersSchema.ts`
    (currently only `PENDING`/`DELIVERED`).
- Eligible-sales picker: `ConfirmedSaleRow` (`sale.types.ts`) has `deliveryStatus` but
  **NOT** `shippingAddress` or an address id; `SaleDetail` (confirmed) also has no
  `shippingAddress`. Per locked scope, filter client-side by `deliveryStatus ∈ {PENDING,
  SHIPPED}` only and let the backend reject address-less sales with
  `422 DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE`. The picker can call
  `saleApi.listConfirmed({ deliveryStatus: ['PENDING', 'SHIPPED'], ... })` once `SHIPPED`
  is in the union — no new backend list field needed.
- `CustomerAddress` / `CustomerAddressBackendResponse` have **no** `label`, `latitude`, or
  `longitude` (customer.types.ts). The delivery-route stop projection adds `label`; the
  customer address DTO gains `latitude`/`longitude` (backend adds `Float?` + DTOs).

---

## 4. Map integration points (CustomerAddress write + driver read-only)

Provider (locked): **Leaflet + OSM tiles + Nominatim** (geocoding + draggable pin). Visual
only; no GPS/realtime/optimization. Pin optional; does not gate sale eligibility. Wire fields
are `latitude`/`longitude` (not `lat`/`lng`).

### WRITE — CustomerAddress upsert (S3)
`src/features/POS/customers/components/AddressModal.vue` is the **single** shared
create/edit address form. It is used by BOTH:
- `CustomerUpsertSlideover.vue` (customer create: collects into `pendingAddresses` and sends
  inline via `toCreatePayload(values, addresses)` → `CreateCustomerPayload.addresses[]`;
  customer edit: emits `create-address`/`update-address` to the parent view).
- `AssignCustomerSlideover.vue` (draft sale "Nueva dirección": calls
  `customerApi.createAddress(customerId, payload)` directly).

Therefore the map write belongs **inside `AddressModal.vue`** so both flows get lat/lng.
Concretely:
1. `interfaces/customer.types.ts`: add optional `latitude?: number | null` and
   `longitude?: number | null` to `CustomerAddressBackendResponse`, `CustomerAddress`,
   `CreateCustomerAddressPayload`, `UpdateCustomerAddressPayload`, and `AddressFormInput`.
   (Optionally add `label` to the customer entity if the backend also adds it there — see
   open questions.)
2. `api/customer.api.ts`: extend `mapAddress()` to copy `latitude`/`longitude`.
3. `AddressModal.vue`: add `latitude`/`longitude` to `formState` + zod `addressSchema`
   (optional), emit them in `handleSubmit` payload, and mount the Leaflet geocode/drag map
   (Nominatim search box + draggable marker → writes `latitude`/`longitude`; "clear pin"
   leaves them undefined/null).
4. `composables/useCustomerForm.ts` `toCreatePayload()` already spreads `addresses` verbatim,
   so inline create mode needs no logic change beyond the payload type.

### READ-ONLY — driver stop detail (S3)
New delivery-routes stop-detail component reads `stop.shippingAddress` (backend projection
includes `label` + optional `latitude`/`longitude`) and renders a read-only Leaflet map
(marker + popup, no drag, no geocoding). No map controls in the manager list.

### Reusable address formatter (fills gap #3)
Two local, divergent `formatAddress` implementations exist:
- `src/features/POS/customers/components/CustomerUpsertSlideover.vue` (~line 153):
  `[street, #exteriorNumber, neighborhood, city, state].join(', ')`.
- `src/features/POS/sales/components/AssignCustomerSlideover.vue` (~line 196):
  `[street, #exteriorNumber, city].join(', ')`.
Neither renders `label`, `zipCode`, or `municipality`. Standardize ONE reusable formatter
(e.g. `utils/formatAddress.ts` in delivery-routes or `core/shared`) that accepts a
superset type with optional `label` and orders: `label` first, then
street + exterior/interior, neighborhood, municipality, city, state, `CP zipCode`
(per backend §8.2 driver guidance). Update both existing call sites to use it.

---

## 5. Open questions / unknowns

| # | Question | Context / impact | Recommendation |
| - | -------- | ---------------- | -------------- |
| 1 | **Driver picker**: does `GET /users/assignable` return ONLY couriers (users with `read`+`update` on `DeliveryRoute`)? | Frontend only has `AssignableUser {id, name}` via `usersApi.listAssignable()` (`src/features/POS/users/api/user.api.ts`). If it returns all assignable users, the manager could assign a non-driver. | Confirm backend; if not courier-only, request a scoped endpoint/param or filter client-side by role info the backend must expose. |
| 2 | Does the customer `CustomerAddress` DTO gain `label`, or only `latitude`/`longitude`? | Delivery-route stop projection has `label`; customer entity currently does not. Affects the reusable formatter + AddressModal form. | Confirm; keep `label` optional/nullable either way so the formatter is shared. |
| 3 | Nominatim client-side geocoding usage policy / rate limits | No backend proxy; browser-direct calls to Nominatim OSM. | Use a light debounce, one request per interaction, and consider a fallback to manual pin if geocoding fails. |
| 4 | Timeline component: generalize `SaleDetailTimeline.vue` vs new component | Sale timeline is 4 event types with COMMENT edit/delete; delivery timeline is 5 types, different payloads, read-only. `SaleDetailTimeline` hardcodes sale colors/labels/comment editing. | Build a NEW `DeliveryRouteTimeline` component (cleaner than forcing a shared abstraction); optionally extract only the vertical-connector styling. |
| 5 | Confirm `GET /delivery-routes` returns `timeline` on every list item (contract says yes) | Manager list may render status/history without a detail fetch. | Rely on backend order (`at` ASC); render only on detail to keep list light. |

---

## 6. Repo hygiene — stale un-archived changes under `openspec/changes/`

These exist as un-archived change dirs (no action taken; enumerated only):
1. `employees-batch-operations`
2. `payment-details-admin`
3. `pos-price-list-tiers`
4. `products-catalog-coco`
5. `promotions-batch-activate`
6. `promotions-batch-end`
7. `quotations-crud`
8. `quotations-ui-redesign`
9. `sales-history-coco`
10. `sales-layout-redesign`
11. `sales-payment-coco`
12. `sales-pos-charge`
13. `sales-view-coco-redesign`
