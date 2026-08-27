# Design — delivery-routes (Rutas de entrega)

> Phase: `sdd-design` · Store: `openspec` · Change id: `delivery-routes`
> Authoritative inputs: `proposal.md`, `exploration.md`, `houndfe-backend/docs/delivery-routes-frontend.md`
> (backend contract wins on wire shapes). Reference designs matched: `payment-details-admin` (zod + error-map +
> `useServerTable` wrapper + inline-discriminator pattern) and `custom-payment-methods` (CASL registration +
> `core/shared` cross-feature constant + per-surface state tables).

This document locks the contracts for the delivery-routes frontend integration. The backend MVP is done; this is a
consume-only frontend change. The single most important contract is the **manager/driver discriminator** (§5) —
one list route, one detail route, two renderings, never inferred from the route payload — followed by the
**eligible-sales picker** and the **DRAFT-only mutation surface** (§6).

---

## 1. Executive summary

Add `src/features/delivery-routes/` — a bounded context with two surfaces sharing one API/types layer:

- **Manager surface** (holds `create` or `delete` on `DeliveryRoute`): list all tenant routes, create a DRAFT from
  eligible sales (`deliveryStatus ∈ {PENDING, SHIPPED}`), assign a driver, edit driver/notes (DRAFT-only),
  append stops, reorder stops (DnD + up/down fallback), start/cancel/delete.
- **Driver surface** (read + update only): list **own** routes (server-scoped, `?status=ACTIVE`), open a stop
  detail with customer name + formatted address + read-only map, check in stops, read the 5-event timeline.

Supporting changes are small and additive: `SHIPPED` joins the sales delivery-status union/badge/filter (S1);
optional `latitude`/`longitude` join the customer-address types + `AddressModal` via a shared `AddressMapPicker`
behind a map-provider port (S3); a `DELIVERY_NEXT_STOP` action joins the notification registry with a
`requiresRecipients` refinement so empty recipients are legal for the delivery email (S2).

The two open unknowns — **driver-picker courier-scoping** and **customer `label` vs lat/lng** — are carried as
design decisions with recommended defaults + a confirm gate before S4/S5 (§13). They do **not** block S1–S3.

---

## 2. Locked contracts (from proposal/specs, non-renegotiable)

1. **One list route serves both roles.** `/pos/rutas-de-entrega` (list) + `/pos/rutas-de-entrega/:id` (detail),
   both `meta.permission: ['read', 'DeliveryRoute']`. The view discriminates internally.
2. **Manager discriminator** = `create:DeliveryRoute` **or** `delete:DeliveryRoute` present. Read/update only ⇒
   driver. Never send a `driverUserId` list param (list scoping is server-side CASL).
3. **DRAFT-only mutations.** `PATCH`, `POST :id/stops`, `PUT :id/stops/reorder` are DRAFT-only; `DELETE` only for
   zero-stop DRAFT; `start`/`cancel`/`check-in` per the lifecycle. `COMPLETED` is terminal.
4. **Map is visual-only** Leaflet + OSM + Nominatim; no GPS/realtime/optimization; check-in = delivered always; no
   date field; no polling. Map write lives in `AddressModal` (via `AddressMapPicker`), read-only map in driver stop
   detail.
5. **Error codes read from `error.response.data.error`** (never `.message`): `DELIVERY_ROUTE_INVALID_TRANSITION`
   (422), `DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE` (422), `DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE` (409),
   `ENTITY_NOT_FOUND` (404).
6. **CASL** = exactly `create`/`read`/`update`/`delete` on subject `DeliveryRoute` (no `manage`, no `batch_delete`).
7. **Request bodies are whitelisted** by zod; never send `id`/`tenantId`/`createdAt`/`updatedAt`/`timeline`/
   `activeRouteId` (backend `forbidNonWhitelisted`).
8. **Notification toggle** is full-overwrite PUT: read → merge `DELIVERY_NEXT_STOP` into `enabledActions` → PUT.

---

## 3. File structure (exact)

```
src/features/delivery-routes/
├── api/
│   └── delivery-routes.api.ts                 # one method per endpoint (10 methods)
├── interfaces/
│   ├── delivery-route.types.ts                # zod schemas + inferred DTOs + label/icon maps
│   └── errors.ts                              # domain error code union + Spanish map + extractor
├── composables/
│   ├── useDeliveryRouteRole.ts                # manager/driver discriminator (permissions-derived)
│   ├── useDeliveryRoutesTable.ts              # manager list: useServerTable wrapper + fullList + client paginate
│   ├── useDriverActiveRoutes.ts               # driver list: plain useQuery over ?status=ACTIVE
│   ├── useDeliveryRouteDetail.ts              # detail + timeline query
│   ├── useEligibleSales.ts                    # thin wrapper over useConfirmedSales (PENDING+SHIPPED)
│   ├── useCreateDeliveryRoute.ts              # POST /delivery-routes
│   ├── useUpdateDeliveryRoute.ts              # PATCH /delivery-routes/:id
│   ├── useDeleteDeliveryRoute.ts              # DELETE /delivery-routes/:id (204)
│   ├── useStartDeliveryRoute.ts               # POST /delivery-routes/:id/start (409 race)
│   ├── useCancelDeliveryRoute.ts              # POST /delivery-routes/:id/cancel
│   ├── useAppendDeliveryRouteStop.ts          # POST /delivery-routes/:id/stops (201)
│   ├── useCheckInStop.ts                      # POST /delivery-routes/:id/stops/:stopId/check-in
│   └── useReorderStops.ts                     # PUT /delivery-routes/:id/stops/reorder
├── components/
│   ├── DeliveryRouteUpsertSlideover.vue       # create/edit (sales picker + driver picker + notes)
│   ├── EligibleSalesPicker.vue                # eligible-sales multi-select
│   ├── DriverPicker.vue                       # assignable-user picker
│   ├── DeliveryRouteReorderPanel.vue          # vuedraggable reorder + up/down fallback
│   ├── DeliveryRouteTimeline.vue              # read-only 5-event vertical timeline
│   ├── DriverStopDetail.vue                   # stop address + read-only map + check-in
│   └── DriverRouteCard.vue                    # mobile-first driver route card
├── views/
│   ├── DeliveryRoutesListView.vue             # route composition surface (discriminates manager/driver)
│   └── DeliveryRouteDetailView.vue            # detail composition surface (discriminates manager/driver)
├── utils/
│   └── delivery-route-actions.utils.ts        # pure row-action + stop-order + stop-progress helpers
└── copy.ts                                    # Spanish UI copy (toasts, titles, empty states, confirm copy)

src/core/shared/
├── components/
│   └── AddressMapPicker.vue                   # NEW — Leaflet/Nominatim map behind provider port (write + read)
├── maps/
│   ├── map-provider.ts                        # NEW — MapProvider port + GeoPoint types
│   └── leaflet-map-provider.ts                # NEW — default Leaflet+OSM+Nominatim implementation
└── utils/
    └── formatAddress.ts                       # NEW — shared label-first formatter
```

Modified code sites (11 + specs):

- `src/features/auth/interfaces/auth.types.ts` — add `'DeliveryRoute'` to `AppSubject`.
- `src/features/auth/authorization/ability.ts` — add `'DeliveryRoute'` to `APP_SUBJECTS`.
- `src/features/admin/roles/i18n/permissions.ts` — `SUBJECT_LABELS` + `PERMISSION_COPY` block.
- `src/app/navigation/navigation.registry.ts` — `pos-delivery-routes` POS-group child.
- `src/app/router/index.ts` — two lazy routes with `meta.permission`.
- `src/core/shared/constants/query-keys.ts` — `deliveryRouteQueryKeys`.
- `src/features/POS/sales/constants/sale.constants.ts` — `SHIPPED` in `SALE_DELIVERY_STATUS`.
- `src/features/POS/sales/utils/saleStatus.utils.ts` — `SHIPPED` badge.
- `src/features/POS/sales/config/salesFiltersSchema.ts` — `SHIPPED` filter option.
- `src/features/system/notifications/interfaces/notification-config.types.ts` — `ActionKey` + `ActionDescriptor.requiresRecipients`.
- `src/features/system/notifications/registry/action-registry.ts` — `DELIVERY_NEXT_STOP` entry.
- `src/features/system/notifications/utils/notificationConfigMappers.ts` — `computeZeroRecipientViolation` refinement.
- `src/features/POS/customers/interfaces/customer.types.ts` — optional `latitude`/`longitude` on 5 address types.
- `src/features/POS/customers/api/customer.api.ts` — `mapAddress` copies lat/lng.
- `src/features/POS/customers/components/AddressModal.vue` — optional map section (mounts `AddressMapPicker`).
- `src/features/POS/customers/components/CustomerUpsertSlideover.vue` — swap local `formatAddress`.
- `src/features/POS/sales/components/AssignCustomerSlideover.vue` — swap local `formatAddress`.
- `package.json` — `leaflet` + `@types/leaflet` (S3).

Note: `SaleDeliveryStatus` in `sale.types.ts` is **derived** from `SALE_DELIVERY_STATUS`
(`(typeof SALE_DELIVERY_STATUS)[keyof typeof SALE_DELIVERY_STATUS]`), so adding `SHIPPED` to the const in
`sale.constants.ts` automatically widens the type — the `sale.types.ts` "edit" is a comment update at most.

---

## 4. Per-component split + single-responsibility justification

Route view rule (vue-best-practices): `DeliveryRoutesListView`/`DeliveryRouteDetailView` are composition surfaces;
feature UI and logic live in child components + composables.

### 4.1 Manager surface

| File | Responsibility (one sentence) | Why separate |
| --- | --- | --- |
| `views/DeliveryRoutesListView.vue` | Chooses manager vs driver rendering from `useDeliveryRouteRole`, then composes the table + slideover + mutations. | Orchestration only; the discriminator is the one branching decision. |
| `views/DeliveryRouteDetailView.vue` | Loads one route, composes stop list/timeline and, per role, the edit/reorder/start/cancel/delete or check-in actions. | Orchestration only; mutation wiring is role-gated. |
| `components/DeliveryRouteUpsertSlideover.vue` | Captures `saleIds[]` + `driverUserId` + `notes` on create, and `driverUserId` + `notes` on edit; emits `create`/`edit`. | One form owns both modes; parent owns the mutation (payment-details convention). |
| `components/EligibleSalesPicker.vue` | Multi-select over `useEligibleSales` (PENDING+SHIPPED confirmed sales); forwards selected `saleIds`. | The eligibility filter + multi-select is a distinct, reusable concern from the rest of the form. |
| `components/DriverPicker.vue` | Single-select over `usersApi.listAssignable()`; emits `driverUserId`. | Isolates the open courier-scoping unknown (§13.1) behind one surface. |
| `components/DeliveryRouteReorderPanel.vue` | Renders the ordered stop list via `vuedraggable` with ↑/↓ buttons and emits the full `orderedStopIds`. | DnD + keyboard fallback is a self-contained interaction with its own tests. |
| `utils/delivery-route-actions.utils.ts` | Builds row-action dropdown items, the stop-progress `x/y` string, confirm copy, and the "every stop exactly once" guard. | Pure builders/guards; no store/HTTP coupling (extract-before-mock). |

### 4.2 Driver surface

| File | Responsibility | Why separate |
| --- | --- | --- |
| `components/DriverRouteCard.vue` | Mobile-first card for one own ACTIVE route (status, stop counter, driver tap target). | Driver list is card-first, distinct from the manager's dense table. |
| `components/DriverStopDetail.vue` | Renders one stop: `customer.name` + `formatAddress` + read-only `AddressMapPicker` + check-in button. | Field stop detail is the driver's core action surface; isolated from list/detail orchestration. |
| `components/DeliveryRouteTimeline.vue` | Renders the 5-event read-only vertical timeline in backend `at` ASC order. | New component (not a `SaleDetailTimeline` generalization) because payloads/colors/editing differ (§4.4). |

### 4.3 Shared map + formatter

| File | Responsibility | Why separate |
| --- | --- | --- |
| `core/shared/maps/map-provider.ts` | Declares the `MapProvider` port (`kind`, `createMap`, `geocode`) + `GeoPoint`. | The port is the only Mapbox-migration seam; UI never imports Leaflet directly. |
| `core/shared/maps/leaflet-map-provider.ts` | Default provider: Leaflet + OSM tiles + Nominatim geocode + draggable marker. | Keeps the Leaflet import (the one vendored dependency) in one file. |
| `core/shared/components/AddressMapPicker.vue` | Vue component consuming the port; `mode: 'write' | 'read'`; `modelValue: GeoPoint \| null`; debounced search + clear-pin (write), static marker (read). | Single reusable map used by `AddressModal` (write) and `DriverStopDetail` (read) — no duplicated Leaflet logic. |
| `core/shared/utils/formatAddress.ts` | Single label-first address formatter (§8). | Three features need one ordering; two divergent local formatters are deleted. |

### 4.4 Why a NEW `DeliveryRouteTimeline` (not `SaleDetailTimeline`)

`SaleDetailTimeline.vue` hardcodes 4 sale event types, sale colors/labels, and `COMMENT` edit/delete. Delivery
timeline is 5 read-only event types with different payloads (`stopId`/`sortOrder`) and no editing. Forcing a shared
abstraction would add a second consumer to a component designed for one; the proposal locks a new component. Only
the vertical-connector *visual pattern* is borrowed, not the code.

### 4.5 Why `AddressMapPicker` lives in `core/shared`

It is used by two features (`POS/customers/AddressModal` and `delivery-routes/DriverStopDetail`) and is a generic
cross-feature primitive. `core/shared` is the config.yaml home for "shared cross-feature primitives: queries,
forms, ui". The provider port keeps the Leaflet dependency (and any future Mapbox swap) behind one seam.

---

## 5. Zod schemas / DTO shapes (derived from backend, TS inferred from zod)

### 5.1 `interfaces/delivery-route.types.ts`

```ts
import { z } from 'zod'

// ─── Primitives ─────────────────────────────────────────────────────────────────
const UuidSchema = z.string().uuid()

export const DeliveryRouteActorSchema = z.object({
  id: z.string(),
  name: z.string(),
})

// ─── Status enums (single source; TS types derived below) ─────────────────────
export const DeliveryRouteStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'])
export const DeliveryRouteStopStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'])

// ─── Shipping address (stop projection) ────────────────────────────────────────
// label is present in the delivery-route stop projection (backend §2). latitude/
// longitude are OPTIONAL-nullish until the backend ships the Float? + DTO
// projection for the S3 map; .nullish() tolerates both omission and null.
export const DeliveryRouteShippingAddressSchema = z.object({
  id: z.string(),
  street: z.string().nullable(),
  exteriorNumber: z.string().nullable(),
  interiorNumber: z.string().nullable(),
  zipCode: z.string().nullable(),
  neighborhood: z.string().nullable(),
  municipality: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  label: z.string().nullable(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
})

// ─── Stop ───────────────────────────────────────────────────────────────────────
export const DeliveryRouteStopSchema = z.object({
  id: z.string(),
  saleId: z.string(),
  saleFolio: z.string().nullable(),
  sortOrder: z.number(),                       // 0-based position
  status: DeliveryRouteStopStatusSchema,
  checkedInAt: z.string().nullable(),          // ISO 8601
  completedAt: z.string().nullable(),          // ISO 8601
  customer: z
    .object({ id: z.string(), name: z.string(), email: z.string().nullable() })
    .nullable(),
  shippingAddress: DeliveryRouteShippingAddressSchema.nullable(),
})

// ─── Timeline discriminated union (5 events, backend §4) ───────────────────────
export const DeliveryRouteTimelineEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ROUTE_CREATED'), at: z.string(), actor: z.null() }),
  z.object({ type: z.literal('ROUTE_STARTED'), at: z.string(), actor: DeliveryRouteActorSchema.nullable() }),
  z.object({
    type: z.literal('STOP_CHECKED_IN'),
    at: z.string(),
    stopId: z.string(),
    sortOrder: z.number(),
    actor: DeliveryRouteActorSchema.nullable(),
  }),
  z.object({ type: z.literal('ROUTE_COMPLETED'), at: z.string(), actor: DeliveryRouteActorSchema.nullable() }),
  z.object({ type: z.literal('ROUTE_CANCELLED'), at: z.string(), actor: DeliveryRouteActorSchema.nullable() }),
])

// ─── Response DTO ───────────────────────────────────────────────────────────────
export const DeliveryRouteResponseSchema = z.object({
  id: z.string(),
  status: DeliveryRouteStatusSchema,
  driver: z.object({ id: z.string(), name: z.string(), email: z.string() }).nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  notes: z.string().nullable(),               // ≤ 280, trimmed by backend
  stops: z.array(DeliveryRouteStopSchema),    // sorted by sortOrder ASC
  timeline: z.array(DeliveryRouteTimelineEventSchema),
})

// ─── Request payloads (whitelisted; nothing else crosses the wire) ────────────
// forbidNonWhitelisted: NEVER id/tenantId/createdAt/updatedAt/timeline/activeRouteId.
export const CreateDeliveryRouteSchema = z.object({
  saleIds: z.array(UuidSchema).min(1, 'Selecciona al menos una venta'),
  driverUserId: UuidSchema,
  notes: z.string().trim().max(280, 'Máximo 280 caracteres').optional(),
})

export const UpdateDeliveryRouteSchema = z.object({
  driverUserId: UuidSchema.optional(),
  notes: z.string().trim().max(280, 'Máximo 280 caracteres').nullable().optional(), // null clears
})

export const AppendDeliveryRouteStopSchema = z.object({ saleId: UuidSchema })

export const ReorderDeliveryRouteStopsSchema = z.object({
  orderedStopIds: z.array(UuidSchema).min(1, 'La ruta debe tener al menos una parada'),
})

// ─── Inferred TS types ─────────────────────────────────────────────────────────
export type DeliveryRouteStatus = z.infer<typeof DeliveryRouteStatusSchema>
export type DeliveryRouteStopStatus = z.infer<typeof DeliveryRouteStopStatusSchema>
export type DeliveryRouteActor = z.infer<typeof DeliveryRouteActorSchema>
export type DeliveryRouteShippingAddress = z.infer<typeof DeliveryRouteShippingAddressSchema>
export type DeliveryRouteStop = z.infer<typeof DeliveryRouteStopSchema>
export type DeliveryRouteTimelineEvent = z.infer<typeof DeliveryRouteTimelineEventSchema>
export type DeliveryRouteResponseDto = z.infer<typeof DeliveryRouteResponseSchema>
export type CreateDeliveryRouteRequest = z.infer<typeof CreateDeliveryRouteSchema>
export type UpdateDeliveryRouteRequest = z.infer<typeof UpdateDeliveryRouteSchema>
export type AppendDeliveryRouteStopRequest = z.infer<typeof AppendDeliveryRouteStopSchema>
export type ReorderDeliveryRouteStopsRequest = z.infer<typeof ReorderDeliveryRouteStopsSchema>

// ─── Label / icon maps (single source for table cells + timeline) ─────────────
export const DELIVERY_ROUTE_STATUS_LABELS: Record<DeliveryRouteStatus, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activa',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
}
export const DELIVERY_ROUTE_STATUS_TONES: Record<DeliveryRouteStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  DRAFT: 'neutral',
  ACTIVE: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
}
export const DELIVERY_ROUTE_STOP_STATUS_LABELS: Record<DeliveryRouteStopStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Entregada',
  SKIPPED: 'Omitida',
}
```

Notes:

- `ROUTE_CREATED` actor is `null` (creator not persisted in MVP); the other four use `actor = assigned driver |
  null`. `ROUTE_COMPLETED`/`ROUTE_CANCELLED` are mutually exclusive (aggregate lifecycle).
- Backend sorts `timeline` by `at` ASC and `stops` by `sortOrder` ASC — the client renders as-is, never re-sorts.
- "Every stop exactly once" in reorder is **not** expressible in zod alone (it needs the existing stop list), so it
  is a pure guard in `delivery-route-actions.utils.ts` (§10.2).

### 5.2 `SHIPPED` addition (S1, mandatory gap fix)

`SHIPPED` has zero matches in `src/` today. Three value-level edits:

```ts
// src/features/POS/sales/constants/sale.constants.ts
export const SALE_DELIVERY_STATUS = {
  PENDING: 'PENDING',
  SHIPPED: 'SHIPPED',     // NEW
  DELIVERED: 'DELIVERED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
} as const
```

`SaleDeliveryStatus` widens automatically (derived type). Then:

```ts
// src/features/POS/sales/utils/saleStatus.utils.ts
export const deliveryStatusBadgeMap: Record<string, SaleBadgeConfig> = {
  DELIVERED: { label: 'Entregados', color: 'success' },
  SHIPPED:   { label: 'Enviados',   color: 'warning' },   // NEW — intermediate state
  PENDING:   { label: 'No Entregados', color: 'error' },
}
```

```ts
// src/features/POS/sales/config/salesFiltersSchema.ts (deliveryStatus multiEnum)
{ value: SALE_DELIVERY_STATUS.SHIPPED, label: 'Enviada' },   // NEW — singular-feminine to match Pendiente/Entregada
```

Badge map stays plural (`Enviados`) for row/tab consistency with `Entregados`/`No Entregados`; the filter option is
singular-feminine (`Enviada`) to match its siblings `Pendiente`/`Entregada`.

### 5.3 Optional `latitude`/`longitude` on customer-address types (S3)

Add to `src/features/POS/customers/interfaces/customer.types.ts`:

```ts
export interface CustomerAddressBackendResponse {
  // ...existing fields...
  latitude?: number | null   // NEW
  longitude?: number | null  // NEW
}
export interface CustomerAddress {
  // ...existing fields...
  latitude: number | null    // NEW (mapAddress normalizes to null)
  longitude: number | null   // NEW
}
export interface CreateCustomerAddressPayload {
  // ...existing fields...
  latitude?: number | null   // NEW
  longitude?: number | null  // NEW
}
export type UpdateCustomerAddressPayload = Partial<CreateCustomerAddressPayload> // inherits lat/lng
export interface AddressFormInput {
  // ...existing fields...
  latitude: number | null    // NEW
  longitude: number | null   // NEW
}
```

`customer.api.ts` `mapAddress` copies `latitude: item.latitude ?? null`, `longitude: item.longitude ?? null`.

`AddressModal.vue` adds `latitude`/`longitude` to `formState` + `addressSchema` (optional), emits them in
`handleSubmit` **only when present** (`...(event.data.latitude != null ? { latitude } : {})`), and mounts
`<AddressMapPicker mode="write" v-model="pin" />`. Pin optional; never gates eligibility.

---

## 6. TanStack Query keys + cache invalidation + mutation strategy

### 6.1 Exact keys — `src/core/shared/constants/query-keys.ts`

```ts
export const deliveryRouteQueryKeys = {
  // Fetch slot: params = { status?: DeliveryRouteStatus }. useServerTable appends
  // its own serverParams, so the real cache slot is
  //   [...list(tenantId, { status }), { pageIndex, pageSize, sorting, globalFilter }]
  list: (tenantId: string, params: Record<string, unknown> = {}) =>
    ['delivery-routes', tenantId, 'list', params] as const,
  // Invalidation prefix — matches EVERY list slot (all status + table params) in
  // one call. Kept separate because a `list(tenantId, {})` suffix would NOT
  // prefix-match a `{ status:'ACTIVE' }` slot.
  listPrefix: (tenantId: string) =>
    ['delivery-routes', tenantId, 'list'] as const,
  detail: (tenantId: string, id: string) =>
    ['delivery-routes', tenantId, 'detail', id] as const,
}
```

### 6.2 Read composables

| Composable | Query key | Source | Notes |
| --- | --- | --- | --- |
| `useDeliveryRoutesTable(status?)` (manager) | `list(tenantId, { status })` + `useServerTable` serverParams | `deliveryRoutesApi.list(status)` → flat array → `paginateDeliveryRoutes` | Mirrors `usePaymentDetailsTable`: one fetch, `fullList` ref + page slice + derived flags. |
| `useDriverActiveRoutes()` (driver) | `list(tenantId, { status: 'ACTIVE' })` | `deliveryRoutesApi.list('ACTIVE')` | Plain `useQuery` returning `DeliveryRoute[]`; no server table (card-first, server-scoped). |
| `useDeliveryRouteDetail(id)` | `detail(tenantId, id)` | `deliveryRoutesApi.getById(id)` | `placeholderData: keepPreviousData`; invalidated by every route mutation. |
| `useEligibleSales()` | `saleQueryKeys.confirmed(tenantId, { deliveryStatus: ['PENDING','SHIPPED'], ... })` | `saleApi.listConfirmed({ deliveryStatus: ['PENDING','SHIPPED'], ... })` via `useConfirmedSales` | Reuses the centralized sale cache; status-only client filter (backend re-validates address). |

### 6.3 Mutation composables + invalidation (all on success, no optimistic writes)

The 8 mutation composables are thin `useMutation` wrappers. Each maps domain errors via
`extractDeliveryRouteErrorCode` → `DELIVERY_ROUTE_ERROR_MAP` (§7), else falls back to `normalizeApiError`. All
invalidate the list prefix; route-mutating ones also invalidate the affected detail.

| Mutation | mutationFn | Invalidates on success | Post-success |
| --- | --- | --- | --- |
| `useCreateDeliveryRoute` | `POST /delivery-routes` | `listPrefix(tenantId)` | Close slideover; toast "Ruta creada"; navigate/refetch list. |
| `useUpdateDeliveryRoute` | `PATCH /delivery-routes/:id` | `detail(tenantId, id)` + `listPrefix(tenantId)` | Toast "Cambios guardados". |
| `useDeleteDeliveryRoute` | `DELETE /delivery-routes/:id` (204) | `listPrefix(tenantId)` (+ `removeQueries` for `detail`) | Toast; close detail. |
| `useStartDeliveryRoute` | `POST :id/start` | `detail(tenantId, id)` + `listPrefix(tenantId)` | Toast; on 409 also refetch list (§10.1). |
| `useCancelDeliveryRoute` | `POST :id/cancel` | `detail(tenantId, id)` + `listPrefix(tenantId)` | Toast. |
| `useAppendDeliveryRouteStop` | `POST :id/stops` (201) | `detail(tenantId, id)` + `listPrefix(tenantId)` | Toast; invalidate `saleQueryKeys.confirmed` (sale eligibility changed). |
| `useCheckInStop` | `POST :id/stops/:stopId/check-in` | `detail(tenantId, id)` + `listPrefix(tenantId)` | Toast; detail refetch refreshes stop + timeline (replay-safe). |
| `useReorderStops` | `PUT :id/stops/reorder` | `detail(tenantId, id)` + `listPrefix(tenantId)` | Toast "Orden guardado". |

No `setQueryData` optimistic writes: mutations are infrequent and the backend returns the canonical
`DeliveryRouteResponseDto`; invalidation keeps `fullList`/detail correct on the next fetch (payment-details
convention).

### 6.4 Manager/driver discriminator (permissions query)

The discriminator does **not** add a new query. `GET /auth/me/permissions` is already loaded by the global
`beforeEach` guard via `authStore.fetchPermissions()` before any guarded route renders. The composable reads the
already-loaded `permissionCodes`:

```ts
// useDeliveryRouteRole.ts
export function useDeliveryRouteRole() {
  const authStore = useAuthStore()
  const isManager = computed(
    () =>
      authStore.userCan('create', 'DeliveryRoute') ||
      authStore.userCan('delete', 'DeliveryRoute'),
  )
  const isDriver = computed(
    () => !isManager.value && authStore.userCan('read', 'DeliveryRoute'),
  )
  return { isManager, isDriver }
}
```

Manager ⇔ `create` **or** `delete` present (backend §5). Driver ⇔ read/update only.

---

## 7. Domain error map + surfacing

### 7.1 `interfaces/errors.ts`

```ts
export type DeliveryRouteDomainErrorCode =
  | 'DELIVERY_ROUTE_INVALID_TRANSITION'
  | 'DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE'
  | 'DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE'
  | 'ENTITY_NOT_FOUND'

export const DELIVERY_ROUTE_ERROR_MAP: Record<DeliveryRouteDomainErrorCode, string> = {
  DELIVERY_ROUTE_INVALID_TRANSITION:
    'La ruta no permite esta acción en su estado actual.',
  DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE:
    'Una de las ventas no es elegible (debe estar pendiente o enviada y tener dirección de envío).',
  DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE:
    'Una de las ventas ya pertenece a otra ruta activa.',
  ENTITY_NOT_FOUND: 'Ruta no encontrada.',
}

export function extractDeliveryRouteErrorCode(error: unknown): DeliveryRouteDomainErrorCode | null {
  const maybe = error as { response?: { data?: { error?: unknown } } }
  const code = maybe?.response?.data?.error
  if (typeof code === 'string' && code in DELIVERY_ROUTE_ERROR_MAP) {
    return code as DeliveryRouteDomainErrorCode
  }
  return null
}
```

Reads **only** `.response.data.error` (never `.message`), mirroring `extractPaymentDetailErrorCode`.

### 7.2 Surfacing channel per code

| Code | HTTP | Context | Surfacing channel |
| --- | --- | --- | --- |
| `DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE` | 422 | create / append-stop | **Inline field error** on the `EligibleSalesPicker` (slideover stays open); backend `details.saleId`/`deliveryStatus` may exist but MVP surfaces the static map copy. |
| `DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE` | 409 | start | **Toast** (clear conflict message) + refetch list/detail + close confirm modal. |
| `DELIVERY_ROUTE_INVALID_TRANSITION` | 422 | PATCH/start/cancel/delete/reorder/check-in | **Toast** + refetch detail (resync stale status); slideover stays open for edit. |
| `ENTITY_NOT_FOUND` | 404 | detail fetch | **Full-page state** "Ruta no encontrada" (never leak cross-tenant presence). |
| `ENTITY_NOT_FOUND` | 404 | action mutations | **Toast** "Ruta no encontrada." + refetch list. |
| 401 / 403 | — | all | Global interceptor/guard: redirect login / hide-or-disable (403 never toasts a presence leak). |
| 400 class-validator | 400 | create/PATCH/stops/reorder | **Toast** fallback via `normalizeApiError` (client zod pre-validates first). |

Generic (non-domain) failures reuse `normalizeApiError`; the module does not duplicate `message`/`string[]`
normalization.

---

## 8. Address formatter contract + exact call-site swaps

### 8.1 Shared formatter — `src/core/shared/utils/formatAddress.ts`

Single source, label-first ordering, accepts a superset type (all fields optional/nullable) so customer entities
(no `label` today) and the delivery-route stop projection (with `label`) both type-check.

```ts
export interface AddressFormatInput {
  label?: string | null
  street?: string | null
  exteriorNumber?: string | null
  interiorNumber?: string | null
  neighborhood?: string | null
  municipality?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
}

export function formatAddress(input: AddressFormatInput): string {
  const segments: string[] = []

  const label = input.label?.trim()
  if (label) segments.push(label)

  const street = [
    input.street?.trim(),
    input.exteriorNumber ? `#${input.exteriorNumber.trim()}` : '',
    input.interiorNumber ? `Int. ${input.interiorNumber.trim()}` : '',
  ].filter(Boolean)
  if (street.length) segments.push(street.join(' '))

  const locality = [
    input.neighborhood?.trim(),
    input.municipality?.trim(),
    input.city?.trim(),
    input.state?.trim(),
  ].filter(Boolean).join(', ')
  if (locality) segments.push(locality)

  const zip = input.zipCode?.trim()
  if (zip) segments.push(`CP ${zip}`)

  return segments.join(', ')
}
```

Ordering: **label** → street + `#exterior` + `Int. interior` → neighborhood, municipality, city, state →
`CP zipCode`. Empty/whitespace fields are dropped; missing everything returns `''`.

### 8.2 Exact call-site swaps

**`src/features/POS/customers/components/CustomerUpsertSlideover.vue`** — delete the local fn at ~line 153:

```ts
// DELETE:
function formatAddress(addr: CreateCustomerAddressPayload | CustomerAddress): string {
  const parts = [
    addr.street,
    'exteriorNumber' in addr && addr.exteriorNumber ? `#${addr.exteriorNumber}` : null,
    addr.neighborhood ?? null,
    addr.city ?? null,
    addr.state ?? null,
  ].filter(Boolean)
  return parts.join(', ')
}
// ADD:
import { formatAddress } from '@/core/shared/utils/formatAddress'
```

Call sites at ~lines 285 and 307 (`{{ formatAddress(addr) }}`) are unchanged — they now resolve to the shared fn.

**`src/features/POS/sales/components/AssignCustomerSlideover.vue`** — delete the local fn at ~line 196:

```ts
// DELETE:
function formatAddress(address: CustomerAddress): string {
  return [address.street, address.exteriorNumber ? `#${address.exteriorNumber}` : null, address.city]
    .filter(Boolean)
    .join(', ')
}
// ADD:
import { formatAddress } from '@/core/shared/utils/formatAddress'
```

Call site at ~line 343 (`{{ formatAddress(address) }}`) is unchanged.

`DriverStopDetail.vue` calls `formatAddress(stop.shippingAddress)` directly (the projection is a superset). A
regression spec pins both old call sites to the shared ordering (success criterion #10).

---

## 9. Permission matrix + CASL registration

| Action | CASL verb | Endpoint | Subject | Who |
| --- | --- | --- | --- | --- |
| Create route | `create` | `POST /delivery-routes` | `DeliveryRoute` | Manager |
| List routes | `read` | `GET /delivery-routes` | `DeliveryRoute` | Manager + driver |
| Detail + timeline | `read` | `GET /delivery-routes/:id` | `DeliveryRoute` | Manager + driver (own) |
| Edit DRAFT (driver/notes) | `update` | `PATCH /delivery-routes/:id` | `DeliveryRoute` | Manager |
| Delete DRAFT zero-stop | `delete` | `DELETE /delivery-routes/:id` | `DeliveryRoute` | Manager |
| Start | `update` | `POST /delivery-routes/:id/start` | `DeliveryRoute` | Manager |
| Cancel | `update` | `POST /delivery-routes/:id/cancel` | `DeliveryRoute` | Manager |
| Append stop | `update` | `POST /delivery-routes/:id/stops` | `DeliveryRoute` | Manager |
| Check-in stop | `update` | `POST /delivery-routes/:id/stops/:stopId/check-in` | `DeliveryRoute` | Driver (own route) |
| Reorder | `update` | `PUT /delivery-routes/:id/stops/reorder` | `DeliveryRoute` | Manager |

**Discriminator rule (backend §5):** a caller with `create` **or** `delete` is a manager; read/update only is a
driver. Driver-only callers receive CASL conditional rules `{ driverUserId: userId }`, so acting on someone else's
route returns `403`. Frontend guidance: render manager controls only when `isManager`; drivers see only
list + check-in. Detail 403 for a driver on a non-owned route surfaces as the not-found/full-page state (never a
presence leak).

### 9.1 Registration (3 places — silent-drop risk if any is missed)

1. **`src/features/auth/interfaces/auth.types.ts`** — `AppSubject` union, before `| 'all'`:

   ```ts
   | 'PaymentMethod'
   | 'DeliveryRoute'
   | 'all'
   ```

2. **`src/features/auth/authorization/ability.ts`** — `APP_SUBJECTS` array, before `'all'`:

   ```ts
   'PaymentMethod',
   'DeliveryRoute',
   'all',
   ```

3. **`src/features/admin/roles/i18n/permissions.ts`**:
   - `SUBJECT_LABELS`: `DeliveryRoute: 'Rutas de entrega'`.
   - `PERMISSION_COPY` (exactly `create`/`read`/`update`/`delete` — no `manage`, no `batch_delete`):

   ```ts
   DeliveryRoute: {
     create: { label: 'Crear rutas de entrega', description: 'Agrupar ventas pendientes o enviadas en una ruta y asignar un repartidor.' },
     read:   { label: 'Ver rutas de entrega',   description: 'Listar y consultar rutas de entrega (propias para repartidores).' },
     update: { label: 'Editar rutas de entrega', description: 'Editar rutas en borrador, iniciarlas, cancelarlas y registrar entregas.' },
     delete: { label: 'Eliminar rutas de entrega', description: 'Eliminar rutas en borrador sin paradas.' },
   },
   ```

Do **not** add to `HIDDEN_SUBJECTS`.

### 9.2 Menu + routes

- `navigation.registry.ts` — POS group: `{ id: 'pos-delivery-routes', label: 'Rutas de entrega',
  icon: 'i-lucide-truck', to: '/pos/rutas-de-entrega', permission: ['read', 'DeliveryRoute'] }`.
- `router/index.ts` — lazy `DeliveryRoutesListView` / `DeliveryRouteDetailView`:
  - `{ path: '/pos/rutas-de-entrega', name: 'pos-delivery-routes-list', meta.permission: ['read','DeliveryRoute'] }`
  - `{ path: '/pos/rutas-de-entrega/:id', name: 'pos-delivery-route-detail', meta.permission: ['read','DeliveryRoute'] }`

Both manager and driver hold `read`, so ONE list route + ONE detail route serve both; views discriminate internally.

### 9.3 View gating booleans

```ts
const canCreate = computed(() => authStore.userCan('create', 'DeliveryRoute'))
const canDelete = computed(() => authStore.userCan('delete', 'DeliveryRoute'))
const isManager = computed(() => canCreate.value || canDelete.value)
// update gates edit/start/cancel/append/reorder; check-in is the driver's update surface.
const canUpdate = computed(() => authStore.userCan('update', 'DeliveryRoute'))
```

---

## 10. Specific flows

### 10.1 409 start-race flow

1. Manager taps "Iniciar ruta" (DRAFT, ≥1 stop) → `ConfirmModal` → `useStartDeliveryRoute.mutateAsync(id)`.
2. Success → toast + invalidate detail/list; route shows `ACTIVE` + `startedAt`.
3. `409 DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE` → map to toast "Una de las ventas ya pertenece a otra
   ruta activa." + `invalidateQueries(listPrefix)` + `detail(id)` + close the confirm. **No auto-retry**: the
   manager must return to the DRAFT, inspect stops, remove/replace the now-conflicted sale, and re-start. This is
   the only correct recovery because the conflict sale can only be resolved by changing the route composition.

### 10.2 DnD reorder contract + up/down fallback

- `PUT /delivery-routes/:id/stops/reorder` body `{ orderedStopIds: string[] }` must reference **every** existing
  stop **exactly once** (length match, no unknown id, no duplicate) → else `422 DELIVERY_ROUTE_INVALID_TRANSITION`.
- `DeliveryRouteReorderPanel.vue` renders the DRAFT stops in `sortOrder` with `vuedraggable@4` (over `sortablejs`,
  already installed/unused). Drag mutates a **local ordered copy**; an explicit "Guardar orden" button (not
  drag-end autosave) builds `orderedStopIds = stops.map(s => s.id)` and calls `useReorderStops.mutateAsync`.
- Pure guard `assertReorderCoversStops(orderedStopIds, existingStopIds): string | null` in
  `delivery-route-actions.utils.ts` validates exactly-once **before** sending; on failure it returns an inline
  message and blocks the request (defensive — DnD cannot normally produce this).
- **Up/down fallback**: each row exposes ↑/↓ buttons that swap adjacent stops in the same local ordered copy; both
  DnD and buttons converge on the same local array → same `orderedStopIds` → same mutation. This is the
  accessibility/touch fallback if `vuedraggable` proves flaky in the Vue 3 + Nuxt UI environment (risk #6).
- On success → invalidate detail + list; the refetched detail re-renders stops in the new `sortOrder`.

### 10.3 Notification toggle read → merge → PUT

The existing notification screen already implements read → hydrate → dirty-track → PUT full-overwrite
(`useNotificationConfigQuery` → `useNotificationConfigForm` → `useUpdateNotificationConfigMutation`). S2 adds the
action and one semantic fix:

1. **`interfaces/notification-config.types.ts`**: widen `ActionKey` to
   `'LOW_STOCK' | 'TIME_OFF_REQUESTED' | 'DELIVERY_NEXT_STOP'`; add `requiresRecipients?: boolean` to
   `ActionDescriptor` (default `true`).
2. **`registry/action-registry.ts`**: add a `delivery` module:

   ```ts
   {
     moduleKey: 'delivery',
     moduleLabel: 'Entregas',
     actions: [
       {
         key: 'DELIVERY_NEXT_STOP',
         label: 'Próxima parada',
         description: 'Avisa al siguiente cliente que su paquete está por llegar.',
         requiresRecipients: false,
       },
     ],
   },
   ```

3. **`utils/notificationConfigMappers.ts`**: refine `computeZeroRecipientViolation` so empty recipients are legal
   when the only enabled actions are non-recipient-based (the delivery email resolves the recipient server-side to
   the **next customer email**, not `recipientUserIds` — backend §6 explicitly allows empty recipients):

   ```ts
   export function computeZeroRecipientViolation(form: {
     enabledActions: readonly ActionKey[]
     recipientUserIds: readonly string[]
   }): boolean {
     const hasRecipientBasedAction = form.enabledActions.some((key) =>
       findActionDescriptor(key)?.requiresRecipients !== false,
     )
     return hasRecipientBasedAction && form.recipientUserIds.length === 0
   }
   ```

   `LOW_STOCK`/`TIME_OFF_REQUESTED` keep `requiresRecipients` default `true`, so their existing behavior is
   unchanged.

Toggle semantics (already implemented, unchanged): toggling `DELIVERY_NEXT_STOP` calls `toggleActionMembership`
(add/remove the key from `enabledActions`); Save reads the current config from the query cache (already hydrated),
merges the toggle, and `PUT`s the whole object (`{ enabled, recipientUserIds, enabledActions }`). Errors
`400 UNKNOWN_ACTION_KEY` → toast (stale client enum), `400 INVALID_RECIPIENT` → inline recipients field error — both
already routed by `mapNotificationConfigError`.

---

## 11. Empty / loading / error states (every view)

| View | Loading | Empty | Error | Notes |
| --- | --- | --- | --- | --- |
| **Manager list** (`DeliveryRoutesListView` manager branch) | `AppDataTable :loading="isLoading"` skeleton | `empty="No hay rutas de entrega"` + enabled "Nueva ruta" button | `AppDataTable :error="isError"` + `:error-message="normalizeApiError(error, fallback).message"` + `@refresh`; no toast on fetch error | `:fetching` soft indicator on refetch. |
| **Manager create/edit** (`DeliveryRouteUpsertSlideover`) | Submit button `:loading="isPending"` | Sales picker empty → "No hay ventas pendientes o enviadas"; driver picker empty → "No hay repartidores disponibles" | Field zod errors inline (sales ≥1, driver required, notes ≤280); domain 422/409 as toast + slideover stays open (inline for sale-eligibility per §7.2) | Create shows sales picker; edit hides it (driver/notes only). |
| **Driver list** (driver branch) | `DriverRouteCard` skeletons | "No tienes rutas activas" | Error block + retry (`normalizeApiError`) | No manager controls render. |
| **Driver detail** (`DeliveryRouteDetailView` + `DriverStopDetail`) | `USkeleton` header/stops/timeline | n/a (a route with stops is the detail); no stops → "Sin paradas" | `404 ENTITY_NOT_FOUND`/driver-403 → full-page "Ruta no encontrada"; other errors → error block + retry | Check-in button disabled for non-`PENDING` stops; `isPending` spinner while checking in. |
| **Notification toggle** (`NotificationConfigView`) | `USkeleton` ×3 cards (existing) | n/a (config always returns defaults) | Existing error routing: `INVALID_RECIPIENT` inline field, `UNKNOWN_ACTION_KEY` toast, 401/403/400 toasts (existing `mapNotificationConfigError`) | `DELIVERY_NEXT_STOP` row renders via `ActionRow`; `requiresRecipients:false` removes the zero-recipient block for delivery-only enablement. |
| **Map write** (`AddressMapPicker` inside `AddressModal`) | Debounced geocode spinner | No pin / cleared pin → coords `null`, address still saves | Geocode failure → **no blocking error**, fall back to manual pin placement (drag map); clear-pin resets coords | Map never gates eligibility. |
| **Map read** (`DriverStopDetail`) | Tile load spinner (Leaflet) | No `latitude`/`longitude` → **hide map**, show formatted address only | Tile/network failure → hide map gracefully, keep the text address | Read-only: marker + popup, no drag/geocode. |

---

## 12. Reused primitives (no reinvention)

| Primitive | Use | Why reuse |
| --- | --- | --- |
| `useServerTable` | Manager list pagination/search/error | Untouchable shared table state; wrapped by `useDeliveryRoutesTable` (payment-details precedent). |
| `useConfirmedSales` + `saleApi.listConfirmed` | `useEligibleSales` (PENDING+SHIPPED) | Existing confirmed-sales list + `deliveryStatus` filter; no new sales endpoint. |
| `usersApi.listAssignable` + `usersQueryKeys.assignable` | `DriverPicker` | Existing assignable-user source; shares the cache slot with the notification recipients picker. |
| `AddressModal` | Address create/edit (map write host) | Single shared address form used by `CustomerUpsertSlideover` + `AssignCustomerSlideover`; map write lives here so both flows gain lat/lng. |
| `ConfirmModal` | Start / cancel / delete confirmations | Owns open/loading/confirm contract. |
| `AppBadge` / `StatusDotBadge` + `activityToBadgeTone` | Route status + stop status badges | Single badge/tone source; only labels differ. |
| `AppDataTable` + `SortableHeader` | Manager list table | Identical v-model/props/slots contract as payment-details/sales. |
| `normalizeApiError` | Generic error fallback | Single defensive envelope parser; domain codes short-circuit first. |
| CASL `userCan` + route guard | Menu/route/button gating | Existing `meta.permission` + `beforeEach` + `userCan`. |
| Notification `action-registry` + `ActionRow`/`ActionsAccordion` | `DELIVERY_NEXT_STOP` toggle | Data-driven registry is the single extension point; no switch/case. |
| `vuedraggable` / `sortablejs` | DnD reorder (S5) | Already installed/unused; avoids a new dependency. |
| `formatAddress` (new shared util) | Address rendering in 3 features | Replaces two divergent local formatters; label-first ordering per backend §8.2. |
| `mountWithUApp` | Co-located component tests | Nuxt UI provider contexts already solved. |

No shared primitive changes behavior; existing features change only by additive/reversible edits.

---

## 13. Open unknowns — carried as design decisions (confirm before S4/S5)

| # | Unknown | Recommended default (implemented now) | Confirm gate |
| --- | --- | --- | --- |
| 1 | **Driver-picker courier-scoping**: does `GET /users/assignable` return ONLY couriers (read+update on `DeliveryRoute`)? | Treat it as **courier-scoped** (backend already returns the assignable driver set); `DriverPicker` renders `AssignableUser {id, name}` verbatim with **no client filter**. | **Confirm before S4/S5.** If it returns all assignable users, request a scoped endpoint/param OR a role field to filter client-side — do not ship a manager-able-to-assign-non-driver path. |
| 2 | **Customer `label` vs lat/lng**: does the customer `CustomerAddress` DTO also gain `label`, or only `latitude`/`longitude`? | Add **only** `latitude`/`longitude` to customer-address types (§5.3). Keep `label` optional/nullable **only** in the `formatAddress` superset + the stop projection; do **not** add `label` editing to `AddressModal`. | **Confirm before S4/S5.** If `label` lands on the customer entity, thread it through `mapAddress` read-only + `AddressModal` display; the shared formatter already handles it. |
| 3 | Nominatim rate limits | Light debounce, one request per interaction, manual-pin fallback; no backend proxy (out of scope). | Monitor only; proxy is a follow-up if abuse appears. |

These defaults keep S1–S3 independent of backend answers and keep the shared formatter correct either way.

---

## 14. Rollout / slice alignment (single-pr, 400-line review budget)

The proposal's 7-slice order is preserved; this design only sharpens the contracts:

1. **S1 — foundations** — `SHIPPED` (4 files + specs), `DeliveryRoute` CASL (3 files + specs), `deliveryRouteQueryKeys`,
   `delivery-route.types.ts`, `delivery-routes.api.ts`, `errors.ts`. No views; type/api/pin tests green.
2. **S2 — notification toggle** — `ActionKey` + registry + `requiresRecipients` + `computeZeroRecipientViolation`
   refinement + specs.
3. **S3 — map + formatter** — `leaflet` deps, `map-provider.ts`, `leaflet-map-provider.ts`, `AddressMapPicker.vue`,
   `formatAddress.ts`, customer-address lat/lng + `mapAddress` + `AddressModal` map + two call-site swaps + specs.
4. **S4 — manager list/create/edit** — `useDeliveryRoutesTable`, `useDeliveryRouteRole`, `useEligibleSales`,
   `DriverPicker`, `EligibleSalesPicker`, `DeliveryRouteUpsertSlideover`, `DeliveryRoutesListView`,
   create/update mutations + specs.
5. **S5 — reorder/start/cancel/delete + 409** — `DeliveryRouteReorderPanel`, `delivery-route-actions.utils`,
   reorder/start/cancel/delete/append mutations, 409 race flow, up/down fallback + specs.
6. **S6 — driver flow + timeline** — `useDriverActiveRoutes`, `useDeliveryRouteDetail`, `DeliveryRouteDetailView`,
   `DriverRouteCard`, `DriverStopDetail`, `DeliveryRouteTimeline`, `useCheckInStop` + specs.
7. **S7 — mobile-first driver polish** — touch-sized check-in targets, field-layout refinement (no contract change).

Slices remain independently verifiable (`pnpm test:unit --run` per slice; `vue-tsc --build` clean at completion).
S1 accepts build-failing-until-views-exist for the two missing route components only.

---

## 15. Tests (co-located, extract-before-mock)

| Spec | Asserts |
| --- | --- |
| `interfaces/__tests__/delivery-route.types.spec.ts` | Schemas parse the backend sample; `SHIPPED` is in the sales const/type/badge/filter; timeline discriminates 5 events; `ROUTE_CREATED.actor` is `null`; payloads whitelist (reject `id`/`timeline`); `DELIVERY_ROUTE_STATUS_LABELS`/tones. |
| `interfaces/__tests__/errors.spec.ts` | `extractDeliveryRouteErrorCode` reads `.response.data.error`, `null` for `.message`-only/unknown; map copy frozen. |
| `api/__tests__/delivery-routes.api.spec.ts` | 10 methods' URL/method/payload via `vi.mock('axios')`; `paginateDeliveryRoutes` slice/total/pageCount; never sends whitelist-forbidden keys. |
| `composables/__tests__/useDeliveryRouteRole.spec.ts` | `isManager` ⇔ create-or-delete; `isDriver` ⇔ read-only; no new query. |
| `composables/__tests__/useDeliveryRoutesTable.spec.ts` | One fetch → `fullList` + page slice; status param in key; invalidation refetches. |
| `composables/__tests__/useDeliveryRouteDetail.spec.ts` | Detail key + timeline passthrough; invalidation. |
| `utils/__tests__/delivery-route-actions.utils.spec.ts` | `assertReorderCoversStops` exactly-once guard; stop-progress `x/y`; row-action gating; confirm copy. |
| `components/__tests__/DeliveryRouteUpsertSlideover.spec.ts` | Create shows sales picker + emits create; edit hides sales picker + emits edit; zod field errors. |
| `components/__tests__/DeliveryRouteReorderPanel.spec.ts` | DnD + up/down both produce `orderedStopIds`; guard blocks bad payload. |
| `components/__tests__/DeliveryRouteTimeline.spec.ts` | Renders 5 event types in order; labels/icons; actor name. |
| `components/__tests__/DriverStopDetail.spec.ts` | Address formatting, check-in button disabled for non-PENDING, read-only map only when coords. |
| `views/__tests__/DeliveryRoutesListView.spec.ts` | Discriminator branches manager vs driver; mutations success/error (invalidate + toast + domain-code mapping). |
| `views/__tests__/DeliveryRouteDetailView.spec.ts` | Role-gated controls; start 409 flow; delete zero-stop-only; driver 403 → not-found state. |

Modified specs: `query-keys.test.ts`, `ability.test.ts`, `permissions.spec.ts`, `sale.constants.spec.ts`,
`saleStatus.utils.spec.ts`, `salesFiltersSchema.spec.ts`, `customer.types`/`customer.api` specs,
`AddressModal.spec.ts`, `notificationConfigMappers.spec.ts`, `action-registry.spec.ts`,
`CustomerUpsertSlideover.spec.ts`, `AssignCustomerSlideover.spec.ts`, and a new `formatAddress.spec.ts`.

---

## 16. Risks & mitigations (locked)

1. **Driver-picker scope** — carried unknown; default courier-scoped + confirm gate before S4/S5 (§13.1).
2. **`SHIPPED` gap** — fixed in S1 first; picker cannot request `{PENDING, SHIPPED}` until then.
3. **Nominatim rate limits** — debounce + manual-pin fallback; no proxy in scope (§13.3).
4. **Customer `label` vs lat/lng** — `label` optional/nullable in the formatter superset only; S3 depends on lat/lng (§13.2).
5. **409 start race** — specific toast + refetch; no auto-retry (§10.1).
6. **DnD new to repo** — isolated to `DeliveryRouteReorderPanel` + up/down fallback (§10.2).
7. **Full-overwrite notification config** — read-merge-PUT already implemented; `requiresRecipients` refinement prevents
   the delivery-only-with-empty-recipients false block (§10.3).
8. **`timeline` on every list item** — manager list does not render it; detail only keeps the list light.
9. **Error envelope drift** — delivery-routes reads `.error` via `extractDeliveryRouteErrorCode`; generic fallback via
   `normalizeApiError` (payment-details convention, never `.message`).
