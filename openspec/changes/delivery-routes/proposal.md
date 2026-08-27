# Proposal — delivery-routes (Rutas de entrega)

## Why

Hound's internal couriers deliver sales that were placed ahead of time (`deliveryStatus`
`PENDING` / `SHIPPED` + a shipping address), but today the frontend has no surface to plan
or execute those deliveries. There is no way for a manager to group eligible sales into a
route, assign a driver, or hand the driver an ordered stop list; and no way for a driver to
check in stops from the field. The "next stop arriving soon" email that should reassure the
next customer before the courier arrives is equally unmanaged. The backend MVP for this is
**done** (branches `feat/delivery-routes-wu3`, contract at
`houndfe-backend/docs/delivery-routes-frontend.md`): full route CRUD + lifecycle
(`DRAFT → ACTIVE → COMPLETED/CANCELLED`), driver check-ins that mirror sales to `DELIVERED`,
a read-only 5-event timeline, and the next-stop email pipeline (outbox + Inngest) behind a
tenant opt-in.

This change builds the frontend for that backend: a **route-manager** workflow (create/plan
routes from eligible sales, assign drivers, reorder stops, start/cancel/delete) and a
**driver** workflow (see own routes, view stops + addresses, check in, read the timeline).
Both are gated by the new `DeliveryRoute` CASL subject (create/delete → manager; read/update
→ driver), and the "next stop" email gets a tenant opt-in toggle in the existing
Notificaciones admin screen. The map (Leaflet + OSM + Nominatim) is visual-only support —
optional lat/lng pins on customer addresses and read-only maps on driver stop detail — and
is explicitly deferred to a later slice so the core flow lands first.

## What Changes

New feature module `src/features/delivery-routes/` following the canonical feature shape
(`{api,composables,components,views,utils,interfaces,constants}` + `copy.ts`), mirroring the
`system/notifications` and `admin/payment-details` precedents:

- **API layer** (`delivery-routes.api.ts`): one method per endpoint —
  `POST /delivery-routes` (create), `GET /delivery-routes` (list), `GET /delivery-routes/:id`
  (detail + timeline), `PATCH :id` (driver + notes, DRAFT-only), `DELETE :id` (DRAFT, zero
  stops → 204), `POST :id/start`, `POST :id/cancel`, `POST :id/stops` (append sale),
  `POST :id/stops/:stopId/check-in`, `PUT :id/stops/reorder`. All JWT/tenant-scoped via the
  shared `http` instance. Never send `id`/`tenantId`/`createdAt`/`updatedAt`/`timeline` in
  request bodies (`forbidNonWhitelisted`).
- **Types** (`interfaces/delivery-route.types.ts`): zod schemas + inferred DTOs for
  `DeliveryRouteResponseDto`, `DeliveryRouteStop`, the 5-event `DeliveryRouteTimelineEvent`
  union (`ROUTE_CREATED | ROUTE_STARTED | STOP_CHECKED_IN | ROUTE_COMPLETED | ROUTE_CANCELLED`),
  and create/PATCH/stops/reorder payloads.
- **Domain error map** (`interfaces/errors.ts`): codes `DELIVERY_ROUTE_INVALID_TRANSITION`
  (422), `DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE` (422), `DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE`
  (409), `ENTITY_NOT_FOUND` (404), read from `error.response.data.error` per the envelope
  convention.
- **Query keys**: `deliveryRouteQueryKeys = { list(tenantId, params), detail(tenantId, id) }`
  registered centrally in `src/core/shared/constants/query-keys.ts`; driver picker reuses the
  existing `usersQueryKeys.assignable()`.
- **Routing / menu**: lazy routes `/pos/rutas-de-entrega` (list) and `/pos/rutas-de-entrega/:id`
  (detail), both `meta.permission: ['read', 'DeliveryRoute']`; sidebar entry
  `pos-delivery-routes` ("Rutas de entrega", `i-lucide-truck`) in the POS group. One list
  route serves both manager and driver; the view discriminates internally via permissions,
  never from the route payload.
- **Manager vs driver discriminator**: `authStore.userCan('create'|'delete', 'DeliveryRoute')`
  → manager UI (create/edit/reorder/start/cancel/delete); read/update only → driver UI
  (list/detail/check-in). No `driverUserId` query param — list scoping is server-side (CASL).
- **SHIPPED status (S1, mandatory gap fix)**: add `SHIPPED` to `SALE_DELIVERY_STATUS`
  (`constants/sale.constants.ts`), the `SaleDeliveryStatus` union (`sale.types.ts`),
  `deliveryStatusBadgeMap` (`utils/saleStatus.utils.ts`), and the `deliveryStatus` filter
  options (`config/salesFiltersSchema.ts`). Currently `SHIPPED` matches nowhere in `src/`
  and would render "Desconocido".
- **Eligible-sales picker**: `saleApi.listConfirmed({ deliveryStatus: ['PENDING', 'SHIPPED'], ... })`
  via the existing `useConfirmedSales` composable. Filter is status-only (MVP); the backend
  re-validates and rejects address-less sales with
  `422 DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE`, which the frontend surfaces.
- **Notification opt-in (S2)**: in the Notificaciones admin screen, add a
  "next stop delivery notification" action toggle (`ActionRow`/`ActionsAccordion` +
  `action-registry`) that includes `DELIVERY_NEXT_STOP` in `enabledActions`. Full-overwrite
  PUT: read `GET /notification-config` first, merge, then `PUT`; handle
  `400 UNKNOWN_ACTION_KEY` / `400 INVALID_RECIPIENT`.
- **Map (S3, visual only)**: add `leaflet` + `@types/leaflet`; WRITE inside the shared
  `AddressModal.vue` (Nominatim geocoding + draggable pin → optional `latitude`/`longitude`
  on `CustomerAddress`, saved via `createAddress`/`updateAddress`; pin optional, does NOT
  gate eligibility); READ-ONLY Leaflet map on driver stop detail (`stop.shippingAddress`).
  Add one reusable `formatAddress` util (label first, street + exterior/interior,
  neighborhood, municipality, city, state, `CP zipCode`) and update the two divergent local
  formatters in `CustomerUpsertSlideover.vue` and `AssignCustomerSlideover.vue` to use it.
- **CASL registration (3 places, S1)**: `AppSubject` union + `APP_SUBJECTS` array
  (`auth.types.ts`, `ability.ts`) and role-permission UI copy
  (`admin/roles/i18n/permissions.ts`: `DeliveryRoute: 'Rutas de entrega'` + a
  `create/read/update/delete` `PERMISSION_COPY` block — no `manage`, no `batch_delete`).

## Out of Scope

- **No GPS / realtime / optimization.** The map is visual only: geocoding + draggable pin.
  No live driver location, no route optimization, no ETAs, no realtime sync.
- **No "not delivered" / retry flow.** Check-in = delivered, always. No skip/retry UI.
- **No delivery date field.** Routes are ad-hoc; no scheduled date on create/edit.
- **No polling.** Manager progress = status + x/y stops counter refreshed on demand
  (refetch), never a timer.
- **No timeline polling either.** The detail endpoint returns the full sorted `timeline`;
  the UI renders it, refreshed after mutations.
- **No new backend work.** Everything in this proposal consumes the existing
  `delivery-routes` + `notification-config` endpoints. The only backend-dependent items are
  carried as *unknowns* (see Risks), not as scope.
- **No new CASL actions.** `create/read/update/delete` only — no `manage`, no `batch_delete`.
- **No shared timeline abstraction.** A new `DeliveryRouteTimeline` component is built for
  the 5 read-only event types instead of generalizing `SaleDetailTimeline` (which hardcodes
  sale colors, labels, and comment editing).
- **No address-label editing.** The customer `label` is only *rendered* via the stop
  projection + formatter; the customer address form does not gain label editing in this
  change.
- **No map in the manager list/detail.** Map surfaces are: AddressModal (write, S3) and
  driver stop detail (read-only, S3) only.

## Capabilities (scoped to `openspec/specs/`)

New capability specs to be authored in the spec phase:

- `delivery-route-management` — manager create/plan/edit (driver + notes), append stop,
  reorder (DnD), start/cancel/delete, 409/422/404 error surfacing, eligible-sales picker,
  permission-gated controls, x/y stop progress counter.
- `delivery-route-check-in` — driver list (own routes only), stop detail with formatted
  address + read-only map, check-in with result refresh, read-only 5-event timeline,
  mobile-first polish.
- `delivery-next-stop-notification` — the `DELIVERY_NEXT_STOP` toggle in the Notificaciones
  admin screen (registry entry, read-merge-PUT semantics, `UNKNOWN_ACTION_KEY` /
  `INVALID_RECIPIENT` handling).
- `address-map-pin` — optional lat/lng write via `AddressModal` (Nominatim geocode +
  draggable pin + clear-pin) and read-only Leaflet map in driver stop detail; pin never
  gates eligibility.

Modified capabilities:

- `authorization` — `DeliveryRoute` subject added to `AppSubject` union, `APP_SUBJECTS`,
  and the role-permission UI copy so existing generic permission parsing works unchanged.
- `sales-status` — `SHIPPED` added to the sale delivery-status constant, type, badge map,
  and filter schema (drives the eligible-sales picker and correct badge rendering).
- `customer-address` — optional `latitude`/`longitude` fields on customer-address
  interfaces/payloads + `mapAddress`, and the standardized `formatAddress` util (also
  reused by the two existing address formatters).

## Approach

Follow the repo's canonical feature conventions, choosing the closest precedent per concern:

- **Feature shape**: `src/features/delivery-routes/` with `api`, `interfaces` (zod), `errors`,
  `composables` (TanStack Query wrappers + mutations), `components`, `views`, `utils`,
  `constants`, `copy.ts` — mirroring `payment-details` and `notifications`.
- **Query layer**: `useDeliveryRoutesList` (server-scoped, supports `?status=`),
  `useDeliveryRouteDetail`, and dedicated mutation composables
  (`useCreateDeliveryRoute`, `useUpdateDeliveryRoute`, `useDeleteDeliveryRoute`,
  `useStartDeliveryRoute`, `useCancelDeliveryRoute`, `useAppendStop`, `useCheckInStop`,
  `useReorderStops`) that invalidate `deliveryRouteQueryKeys` on success and map domain
  errors via the local error map.
- **Manager list**: wrap the flat array into a client `PaginatedResponse` and drive with
  `useServerTable` (the `usePaymentDetailsTable` wrapper precedent adds full-list derived
  flags — e.g. status + `x/y` stop counter). Progress = status badge + stops counter,
  refreshed by refetch on demand, no polling.
- **Manager create/edit**: eligible-sales multi-select driven by `useConfirmedSales`
  filtered to `{PENDING, SHIPPED}` (status-only; backend rejects address-less sales with
  a surfaced 422), driver picker via `usersApi.listAssignable()` /
  `usersQueryKeys.assignable()`, notes input (≤ 280), DRAFT-only PATCH for reassign/notes.
- **Reorder (S5)**: `vuedraggable@4` (already in `package.json`, currently unused) over
  `sortablejs`; `PUT :id/stops/reorder` with every stop exactly once; `422` on mismatch.
- **Start (S5)**: confirm modal before `POST :id/start`; on `409
  DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE` show a clear conflict message and refetch
  the list so the manager can re-pick. `DELETE` only when DRAFT with zero stops (hide the
  button once stops exist).
- **Driver flow (S6)**: list `?status=ACTIVE` (server already scopes to own routes),
  detail renders stops in `sortOrder` with `customer.name` + formatted address, check-in
  button → `POST check-in` → refresh detail + timeline. Timeline rendered by a new
  read-only `DeliveryRouteTimeline` (backend order `at` ASC, mutually exclusive
  COMPLETED/CANCELLED, actor = assigned driver or null).
- **Map (S3)**: Leaflet + OSM tiles + Nominatim client-side. Write lives **inside**
  `AddressModal.vue` (the single shared address form used by both
  `CustomerUpsertSlideover` and `AssignCustomerSlideover`) so both flows gain lat/lng
  without duplicated map logic; `toCreatePayload` already spreads `addresses` verbatim.
  Debounced Nominatim search (one request per interaction) with manual-pin fallback on
  geocode failure; "clear pin" leaves lat/lng undefined. Read-only driver map = marker +
  popup, no drag, no geocoding.
- **Mobile-first driver polish (S7)**: touch-sized check-in targets, address/step layout
  that works on a phone held in the field, mindful of the interface-design craft rules
  (intent: a driver on the road checking off stops, not a desktop admin).
- **Delivery**: `single-pr` — one branch, manual merge to main, no PRs; strict TDD slices
  (RED/GREEN/TRIANGULATE/REFACTOR) within the 400-line review budget.

## Impact (areas + reuse)

New:
- `src/features/delivery-routes/` — the entire bounded context (api, interfaces, errors,
  composables, components, views, utils, constants, copy, co-located specs).

Modified:
- `src/features/auth/interfaces/auth.types.ts` — add `'DeliveryRoute'` to `AppSubject`.
- `src/features/auth/authorization/ability.ts` — add `'DeliveryRoute'` to `APP_SUBJECTS`.
- `src/features/admin/roles/i18n/permissions.ts` — `SUBJECT_LABELS` +
  `DeliveryRoute` `PERMISSION_COPY` block (create/read/update/delete).
- `src/app/navigation/navigation.registry.ts` — `pos-delivery-routes` sidebar entry
  (POS group, `i-lucide-truck`).
- `src/app/router/index.ts` — two lazy routes with `meta.permission`.
- `src/core/shared/constants/query-keys.ts` — `deliveryRouteQueryKeys` (+ reuse
  `usersQueryKeys.assignable()`).
- `src/features/POS/sales/constants/sale.constants.ts` — `SHIPPED` in `SALE_DELIVERY_STATUS`.
- `src/features/POS/sales/interfaces/sale.types.ts` — `SHIPPED` in `SaleDeliveryStatus`.
- `src/features/POS/sales/utils/saleStatus.utils.ts` — `SHIPPED` badge.
- `src/features/POS/sales/config/salesFiltersSchema.ts` — `SHIPPED` filter option.
- `src/features/system/notifications/` — `DELIVERY_NEXT_STOP` action registry entry + copy
  (+ `ActionRow` toggle wiring).
- `src/features/POS/customers/interfaces/customer.types.ts` — optional
  `latitude`/`longitude` on address interfaces + payloads.
- `src/features/POS/customers/api/customer.api.ts` — `mapAddress` copies lat/lng.
- `src/features/POS/customers/components/AddressModal.vue` — optional map section (S3).
- `src/features/POS/customers/components/CustomerUpsertSlideover.vue` and
  `src/features/POS/sales/components/AssignCustomerSlideover.vue` — swap local formatters
  for the shared `formatAddress` util.
- `package.json` — `leaflet` + `@types/leaflet` (S3).

Reused primitives (no reinvention): `useServerTable`, `useConfirmedSales`,
`saleApi.listConfirmed`, `usersApi.listAssignable`, `AddressModal`, `ConfirmModal`,
`AppBadge`/`StatusDotBadge`, `AppDataTable`, `userMessageForError`, `normalizeApiError`,
CASL `userCan` + route-guard machinery, notification `action-registry`,
`vuedraggable`/`sortablejs` (already installed).

No shared primitives change behavior; existing features change only by additive, reversible
edits (SHIPPED status, lat/lng optionals, formatter swap).

## Risks / Unknowns

1. **Driver picker scope (open unknown).** Does `GET /users/assignable` return ONLY couriers
   (users with `read`+`update` on `DeliveryRoute`), or all assignable users? The frontend
   only knows `AssignableUser {id, name}`. If not courier-scoped, a manager could assign a
   non-driver. **Carried as an open unknown, resolved before S4/S5** (manager create/edit):
   confirm backend; if needed, request a scoped endpoint/param or a role field to filter
   client-side.
2. **`SHIPPED` frontend gap (confirmed, fixed in S1).** `SHIPPED` has zero matches in
   `src/`. Until S1 adds it to constant + type + badge + filter, the eligible-sales picker
   cannot request `{PENDING, SHIPPED}` and badges render "Desconocido". Mitigation: it is
   the first concrete item in S1 with co-located tests.
3. **Nominatim usage policy / rate limits.** Browser-direct geocoding to OSM Nominatim with
   no backend proxy can be rate-limited. Mitigation: light debounce, one request per
   interaction, graceful fallback to manual pin placement, and clear-pin. If abuse becomes a
   concern, a backend proxy is a follow-up (out of scope here).
4. **CustomerAddress `label` vs lat/lng confirmation (open unknown).** The delivery-route
   stop projection includes `label`; the customer address DTO gains `latitude`/`longitude`
   (`Float?` + DTOs, per locked scope) — but it is unconfirmed whether `label` is also added
   to the customer address entity. Mitigation: keep `label` optional/nullable in the shared
   `formatAddress` superset so the formatter is correct either way; S3 only depends on
   lat/lng.
5. **409 race at start.** A sale can be claimed by another ACTIVE route between picker and
   start (partial unique index). Mitigation: surface the specific
   `DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE` message and refetch the list.
6. **DnD is new to this repo.** `vuedraggable`/`sortablejs` are installed but unused. S5
   keeps DnD isolated to the reorder surface with its own tests; reorder fallback (up/down
   buttons) is a mitigation if DnD proves flaky in the Vue 3 + Nuxt UI environment.
7. **Full-overwrite notification config.** PUT replaces the whole config; a stale client
   enum or removed recipient → `400 UNKNOWN_ACTION_KEY` / `400 INVALID_RECIPIENT`. S2 reads
   current config before merging and maps both errors.
8. **`GET /delivery-routes` returns `timeline` on list items** (contract says yes). The
   manager list does not render it — detail only — keeping the list light.

## First Slice Scope

**S1 — foundations (status + types + CASL + keys + API + routing/menu):**
- `SHIPPED` addition (constants, `SaleDeliveryStatus`, badge map, filter schema) with tests.
- `DeliveryRoute` CASL registration in the three touch points (`auth.types.ts`,
  `ability.ts`, `permissions.ts` i18n).
- `deliveryRouteQueryKeys` in `query-keys.ts`; `deliveryRoute.types.ts` (full DTO/timeline
  zod schemas); `deliveryRoute.api.ts` (all 10 endpoints); `interfaces/errors.ts`.
- Router + navigation registry entries (`/pos/rutas-de-entrega` list + detail).
- No views yet (list/detail views land in S4/S6) — S1 is independently verifiable via
  type-check + co-located API/type tests and builds-failing-until-views-exist is accepted
  only for the missing route components.

S1 is the first slice; S2–S7 follow the locked order (S2 notification toggle, S3 map, S4
manager list/create/edit, S5 reorder/start/cancel/delete + 409, S6 driver list/detail/
check-in/timeline, S7 mobile-first driver polish). All slices follow strict TDD within the
400-line review budget.

## Rollback Plan

The feature is isolated to `src/features/delivery-routes/` plus small, reversible edits:
CASL registration (3 files), router/navigation (2 files), query keys (1 file), SHIPPED
status (4 files), customer-address lat/lng optionals (2 files + AddressModal), notification
registry entry, the two formatter call-site swaps, and `package.json` deps (leaflet).
Rollback is a git revert of the single feature branch: removing the registration edits
removes the subject, menu, routes, and permission UI entries atomically. No frontend data or
migration surface exists (the backend already shipped schema/migration work); reverting only
removes UI surface and optional fields. The `single-pr` delivery (one branch, manual merge,
no PRs) means rollback is a single revert with no chain of PRs to unwind.

## Success Criteria

Measurable and verifiable in the verify phase:

1. A user with `read:DeliveryRoute` sees the "Rutas de entrega" menu entry and loads
   `/pos/rutas-de-entrega`; without it, the entry is hidden and navigation redirects to
   `/403`.
2. Manager discriminator works: create/edit/reorder/start/cancel/delete controls render
   only when `create` or `delete` permission exists; drivers see only list + check-in.
3. A manager can create a DRAFT route from `{PENDING, SHIPPED}` sales with a driver and
   notes; address-less/ineligible sales surface `422 DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE`
   with a clear message.
4. `SHIPPED` sales render a proper badge (never "Desconocido") and are selectable in the
   eligible-sales picker and the sales filter.
5. DRAFT-only edits work: PATCH driver/notes, append stop, DnD reorder; non-DRAFT edits show
   the `DELIVERY_ROUTE_INVALID_TRANSITION` message.
6. Start works with confirmation; a sale already on another ACTIVE route surfaces
   `409 DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE` and the list refetches. Cancel
   works from DRAFT/ACTIVE; delete is available only for zero-stop DRAFT routes.
7. A driver sees only their own routes; the ACTIVE detail lists stops in order with
   `customer.name` + formatted address; check-in flips the stop (and route when last) and
   refreshes the timeline; the 5-event timeline renders in backend order.
8. The Notificaciones admin screen toggles `DELIVERY_NEXT_STOP` (read → merge → PUT) and
   handles `400 UNKNOWN_ACTION_KEY` / `400 INVALID_RECIPIENT`.
9. `AddressModal` optionally saves `latitude`/`longitude` (map + draggable pin, clear-pin
   works) without gating eligibility; driver stop detail shows a read-only map when coords
   exist.
10. Reusable `formatAddress` renders label-first addresses with `CP zipCode` and both
    existing call sites use it (regression tests green).
11. `pnpm test:unit --run` passes for all new co-located specs; `vue-tsc --build` is clean;
    each slice is under the 400-line review budget.
