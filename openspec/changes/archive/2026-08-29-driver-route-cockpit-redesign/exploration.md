# Driver Route Cockpit Redesign — Exploration

Change: `driver-route-cockpit-redesign`  
Phase: EXPLORE  
Artifact store: OpenSpec  
Scope explored: the delivery-driver route detail experience, its list entry point, shared UI primitives, frontend API contracts, tests, and dashboard shell.

## 1. Executive finding

The repository already has a functional driver flow, but its route detail is a generic stack of equal-weight stop cards. The current frontend can support a substantially better cockpit without inventing logistics data: it can derive progress, the first actionable stop, the following stop, a stop sequence, customer identity, sale folio, complete shipping address, optional point coordinates, route notes, completion timestamps, and timeline events from `DeliveryRouteResponseDto`.

The redesign should preserve the manager branch and existing API/query/mutation contracts while replacing the driver branch with a mobile-first composition. The strongest repository-grounded direction is an edge-to-edge route cockpit with a compact sticky identity/progress header, a gold-accented active stop, a blue route spine, a bottom drawer for stop/history details, and a bottom action bar that opens the existing `ConfirmModal` before check-in.

A real route polyline, travel ETA, phone contact, sale line items, proof of delivery, and skip-reason handling are not present in the frontend contract or API surface and must not appear as functioning UI.

## 2. Repository evidence reviewed

### Existing delivery route entry points

- `src/features/delivery-routes/views/DeliveryRoutesListView.vue`
  - One route serves managers and drivers; role discrimination comes from `useDeliveryRouteRole`.
  - The driver branch calls `useDriverActiveRoutes`, which fetches `GET /delivery-routes?status=ACTIVE` and relies on backend CASL scoping rather than a `driverUserId` query parameter.
  - Active routes render as full-card button targets through `DriverRouteCard`; selecting one navigates to `/pos/rutas-de-entrega/:id`.
  - Driver loading, empty, error, and retry states already exist.
- `src/features/delivery-routes/views/DeliveryRouteDetailView.vue`
  - Loads detail through `useDeliveryRouteDetail` and protects against stale `keepPreviousData` by checking the returned route id.
  - Maps driver `403` and route `404 ENTITY_NOT_FOUND` to the same not-found surface to avoid presence leaks.
  - The driver branch currently renders a basic summary, every stop as `DriverStopDetail`, and `DeliveryRouteTimeline`.
  - The manager branch owns edit/start/cancel/delete/append/reorder behavior and should not be accidentally redesigned by a driver-only cockpit change.

### Current driver detail behavior

- `DriverStopDetail.vue` shows stop number, customer name, formatted address, an optional read-only point map, and a check-in button.
- Every `PENDING` stop currently gets an enabled check-in button; there is no current-stop-only gate or confirmation modal.
- Check-in calls `POST /delivery-routes/:id/stops/:stopId/check-in`, then invalidates detail and list queries. There is no optimistic update.
- The button is disabled for non-`PENDING` states and has a 44px minimum height.
- `DeliveryRouteTimeline.vue` renders backend event order without client sorting.
- `useDeliveryRouteDetail` disables focus refetching; there is no polling. Freshness comes from navigation, explicit query activity, or mutation invalidation.

### Screenshot evidence

The supplied screenshot is consistent with the current code: on a wide dark dashboard it shows a small route/status/progress summary, two visually equal stop cards with full-width blue “Marcar entregada” actions, and a compact timeline below. The screen leaves a large amount of unused space, gives no stop clear priority, and does not present a route-shaped sequence. No map is visible in the captured state, which is consistent with coordinates being optional.

### Current tests

The route feature has co-located API, type, composable, utility, component, and view tests. Important existing contracts include:

- driver list fetches only `ACTIVE` routes and does not send `driverUserId`;
- full-card navigation from list to detail;
- loading, empty, retry, generic error, and not-found states;
- driver/manager branch isolation;
- stale detail data is not rendered for a different route id;
- one stop component per backend-ordered stop;
- formatted address and optional map behavior;
- check-in mutation payload, pending state, non-pending disablement, and cache invalidation;
- 44px card/check-in touch targets;
- five timeline event types in backend order;
- manager lifecycle controls and confirmations.

The existing tests are heavily tied to `DriverStopDetail` and driver-branch DOM test ids. A redesign will require intentional test replacement rather than preserving obsolete card anatomy. API/composable/security tests should remain stable.

Notable mismatch: the archived check-in specification says a stop status badge shall render, but `DriverStopDetail.vue` currently does not render one and its tests do not pin one. A proposal should either restore that requirement in the cockpit or explicitly supersede it.

## 3. Reusable visual and interaction language

### Coco visual foundation

`src/assets/main.css` and `vite.config.ts` establish the actual system language:

- Inter is the global sans family.
- Primary blue: Coco `#2442f6`.
- Navy: Coco `#173968`.
- Action gold: Coco `#f6bb13`.
- Dark page/card neutrals derive from `#16121a`, `#2c2434`, and related Coco scales.
- Nuxt UI standalone v4 maps `primary`, `secondary`, `neutral`, and `action` to Coco color scales.
- Dashboard panel surfaces are dark-first and use standard Nuxt semantic classes such as `bg-default`, `text-muted`, and `border-default`.

The cockpit should use these tokens rather than a new page-local palette. The distinctive device should be the route spine itself: a functional sequence whose completed, active, upcoming, and terminal states are encoded by line/node treatment. Gold should be reserved for the active work/primary delivery action, while Coco blue/navy carry route continuity and structure.

### Shared primitives

- `EntityAvatar.vue`: deterministic initials/avatar colors with `sm|md|lg` sizes and optional status dot. It is suitable for the current customer identity and avoids bespoke avatar logic.
- `StatusDotBadge.vue` and `AppBadge.vue`: established semantic state chips. Route and stop status maps already exist.
- `ConfirmModal.vue`: established confirmation overlay with loading lock and mobile-stacked footer buttons. It can confirm delivery without changing its contract.
- `AddressMapPicker.vue`: shared Leaflet-backed map port. In read mode it renders a static marker and popup only when coordinates exist; tile errors hide the map without hiding the text address.
- `formatAddress`: already centralizes label-first full-address output.
- Lucide icons through Nuxt UI are the established icon vocabulary.
- Sticky header examples exist in `SaleDetailView.vue` and `CatalogHeader.vue`; sticky footer examples exist in data-table filters and notification configuration.

### Overlay patterns

- The repository currently uses `UModal`/`ConfirmModal`, `USlideover`, and bottom-side `USlideover` patterns.
- No application code currently uses `UDrawer`, so a cockpit drawer would be the first direct use and needs focused tests.
- The existing data-table filter bottom sheet demonstrates a reliable three-region structure: sticky header, independently scrollable body, sticky footer.

## 4. Nuxt UI v4 Drawer availability and constraints

`@nuxt/ui` is installed at `^4.6.0`, and the installed runtime includes `Drawer.vue` backed by `vaul-vue`. It is available in this standalone Vite setup through the existing `@nuxt/ui/vite` plugin.

Verified drawer capabilities:

- `v-model:open` through `open` / `update:open`;
- bottom direction by default, plus alternate directions;
- portal and overlay enabled by default;
- drag handle enabled by default;
- modal, dismissible, fixed, inset, nested, and handle-only controls;
- snap points and active snap point;
- header/body/footer/content slots;
- drag, release, close, animation, and prevented-close events.

Constraints and implications:

- Drawer is portal-based and locks/intercepts interaction as a modal by default; it should not be nested casually with `ConfirmModal`.
- If delivery confirmation is launched from drawer content, the safest flow is to close the drawer before opening the modal, or to prove focus/z-index behavior in tests.
- Snap points add state and drag complexity. A single bounded mobile sheet is the lower-risk default unless partial and expanded states provide a clear product benefit.
- A title or accessible title slot should be provided; the runtime uses visually hidden title/description handling for custom content.
- Map instances inside a drawer may mount before final drawer dimensions settle. Leaflet sizing should be tested after the opening animation; a detail sheet could also keep the map in normal page flow if this proves fragile.
- Nuxt UI does not remove the need for explicit bottom safe-area padding in cockpit footer content.

## 5. Delivery route data and API capability map

### Available now

`DeliveryRouteResponseDto` provides:

- route id and lifecycle status: `DRAFT | ACTIVE | COMPLETED | CANCELLED`;
- assigned driver id, name, and email;
- route-level notes;
- `startedAt`, `completedAt`, and `cancelledAt`;
- ordered stops;
- timeline events.

Each stop provides:

- stop id, sale id, optional sale folio, and `sortOrder`;
- `PENDING | IN_PROGRESS | COMPLETED | SKIPPED` status;
- `checkedInAt` and `completedAt`;
- optional customer id, name, and email;
- optional full shipping address including label, street/numbers, postal code, neighborhood, municipality, city, and state;
- optional latitude and longitude.

Existing endpoints are limited to list/detail/create/update/delete/start/cancel/append/reorder/check-in. For the driver cockpit, only list, detail, and check-in are currently relevant.

### Safe frontend derivations

Without changing the backend, the UI can derive:

- completed/total progress;
- first actionable pending stop;
- following pending stop;
- completed/upcoming route-spine segments;
- whether the active action should be hidden/disabled for completed/cancelled routes;
- customer initials through `EntityAvatar`;
- human stop labels from `sortOrder + 1` and `saleFolio`;
- completion times from stop/timeline timestamps.

Calling the first pending stop “current” is a presentation derivation, not a backend current-stop field. `IN_PROGRESS` exists in the enum but no frontend endpoint starts or arrives at a stop, so the selection rule needs explicit product confirmation.

### Backend-gated or absent

No explored route contract or endpoint exposes:

- customer phone;
- real travel ETA, distance, route geometry, or polyline;
- turn-by-turn navigation;
- sale line items or package contents on a route stop;
- proof-of-delivery capture, photo, signature, or recipient name;
- failed-delivery/skip mutation or skip reason;
- per-stop notes;
- driver live location;
- automatic polling or push-driven route refresh.

Customer email is available, but presenting it as a mail action is a product decision rather than an existing route behavior. Coordinates support a point map only; they do not imply a route map.

## 6. Responsive shell and safe-area findings

- Driver routes use `DashboardLayout`, not a dedicated field/mobile layout.
- The shell includes a dashboard navbar above a `UDashboardPanel` whose body is `flex-1 overflow-y-auto p-4 sm:p-6`.
- `SaleDetailView.vue` demonstrates the necessary full-bleed technique: counter the panel body padding with `-m-4 sm:-m-6`, create a full-height flex column, keep a compact sticky header, and place scrolling content below it.
- No global `env(safe-area-inset-*)` usage exists in `src`.
- A sticky/fixed delivery CTA therefore needs both bottom safe-area padding and matching content bottom padding so the final route-spine/timeline content is not obscured.
- Use dynamic viewport constraints (`dvh`) for drawer/sheet bodies rather than relying only on `vh`, particularly in mobile browser chrome and landscape.
- Sticky behavior must be tested inside the dashboard panel’s scrolling body; viewport-fixed assumptions can be wrong because the panel owns scrolling.
- Touch targets should remain at least 44×44px, with the primary CTA larger and separated from secondary drawer controls.

## 7. Candidate cockpit anatomy and component boundaries

These are candidates for proposal/design, not implementation commitments.

| Candidate | Single responsibility | Likely contract |
| --- | --- | --- |
| `DriverRouteCockpit.vue` | Compose the driver-only route detail from the loaded DTO and coordinate selected sheet/confirmation state. | `route`; no fetching; emits or invokes a single check-in path. |
| `DriverCockpitHeader.vue` | Sticky route identity, lifecycle badge, compact progress, and back navigation. | route id/status/progress; `back` emit. |
| `DriverCurrentStopCard.vue` | Make the first actionable stop unmistakable using customer avatar, folio, address, and route-level notes when applicable. | current stop, route notes; `open-details` emit. |
| `DriverNextStopPreview.vue` | Show only the next derived pending stop without implying ETA. | next stop or terminal copy; `select` emit. |
| `DriverRouteSpine.vue` | Render all ordered stops as a semantic sequence with completed/current/upcoming states. | stops, selected/current ids; `select-stop` emit. |
| `DriverStopSheet.vue` | Present selected stop details and optional point map in `UDrawer`. | stop, open; `update:open`; no fabricated fields. |
| `DriverRouteHistorySheet.vue` or sheet mode | Present the existing read-only timeline without competing with the operational spine. | route timeline, open. A shared sheet shell may avoid two overlays. |
| `DriverDeliveryActionBar.vue` | Reserve the thumb zone and request delivery confirmation for the current actionable stop. | stop, pending/disabled; `request-confirm` emit. |
| pure selector utility or `useDriverRouteCockpit` | Derive progress/current/next/spine state from one DTO without duplicating logic in templates. | pure/computed inputs and outputs; no server state duplication. |

`DeliveryRouteDetailView.vue` should remain the route-level query/error/role composition surface. The driver cockpit should not fetch the route again. `useCheckInStop` remains the server-state mutation boundary, with existing targeted query invalidation.

`DriverStopDetail.vue` may be retired, reduced to drawer content, or kept as a compatibility wrapper; preserving it unchanged would perpetuate the equal-card layout. `DeliveryRouteTimeline.vue` can be reused inside a sheet or lower-detail region because its backend-order contract remains valid.

## 8. Product decisions required before proposal

| Decision | Why it matters | Recommended starting point |
| --- | --- | --- |
| Is this change driver-branch-only, leaving manager detail unchanged? | The shared route view contains materially different manager lifecycle controls. | Yes; redesign only `isDriver` detail and shared pieces it consumes. |
| How is “current stop” selected? | Backend has ordered statuses but no explicit `currentStopId`; existing UI allows any pending stop to check in. | First `IN_PROGRESS` if one exists, otherwise first `PENDING`; confirm fallback semantics. |
| Must delivery be enforced in route order? | Disabling later pending stops changes existing behavior and may conflict with backend policy. | Do not enforce order until backend/product confirms it; visually prioritize current while preserving allowed pending actions through details if needed. |
| Does the sticky CTA act only on the derived current stop? | This determines whether later stops remain actionable from the spine/drawer. | Primary CTA targets current; confirm whether non-current check-in remains available. |
| Exact confirmation copy and consequence statement? | “Delivered” changes sale and route state; confirmation should identify the customer/stop. | Confirm with customer name, stop number/folio, and irreversible state change; no proof claim. |
| Drawer model: selected-stop details only, history only, or both modes? | Multiple stacked drawers increase complexity and focus risk. | One drawer shell with explicit stop/history modes and one open state. |
| Should route notes appear in the current-stop hero? | Notes are route-level, not stop-level; placement can falsely associate them with one customer. | Label them “Route notes” in a separate operational callout near the hero. |
| Should email or external map deep links be offered? | Data exists, but these actions are not current route capabilities and must be intentional. | Omit by default; point map remains informational unless explicitly approved. |
| What should completed/cancelled route detail show? | Driver list fetches ACTIVE only, but deep links/refetched final state can be COMPLETED. | Replace CTA with a terminal summary while keeping spine/history readable. |
| Is manual refresh needed for field reliability? | Queries do not poll or refetch on window focus. | Consider an explicit refresh control; do not add polling silently. |
| Mobile target baseline and landscape behavior? | Drawer height, sticky regions, and safe-area acceptance need concrete test dimensions. | Confirm at least 320px width, modern iOS/Android safe areas, and landscape overflow. |

## 9. Explicit non-goals

- No backend endpoint or DTO expansion in this frontend redesign.
- No ETA, distance, traffic, optimized routing, polyline, or turn-by-turn navigation.
- No customer phone display or calling action.
- No sale item/package manifest.
- No proof-of-delivery photo, signature, recipient capture, or offline queue.
- No failed-delivery/skip workflow or skip reason.
- No driver geolocation or live tracking.
- No manager route planner redesign unless separately approved.
- No replacement of the shared dashboard shell or global design system.
- No new map vendor; reuse the existing `AddressMapPicker`/Leaflet port.
- No polling introduced as visual polish.

## 10. Risks and test implications

1. **Action-order ambiguity:** a visually declared current stop could imply a backend order constraint that does not exist. Preserve behavior until confirmed.
2. **Overlay stacking:** opening `ConfirmModal` over a modal `UDrawer` can create focus, scroll-lock, and z-index defects. Use one active overlay at a time and test keyboard dismissal/focus return.
3. **Leaflet sizing in animated drawer:** map initialization may occur before stable sheet dimensions. Test real opening behavior and retain the text address as the reliable fallback.
4. **Sticky CTA obstruction:** without explicit safe-area and content-offset treatment, the action bar can cover the final stop or timeline.
5. **Dashboard scroll containment:** sticky elements must be scoped to the dashboard panel scroll container, not assumed to stick to the browser viewport.
6. **Stale route state:** no focus refetch or polling means an old detail can remain visible; mutation invalidation is reliable only after this client acts.
7. **Null-rich DTO:** customer, driver, shipping address, coordinates, folio, notes, and timestamps can be null. The cockpit must remain operational with defensive labels and no empty decorative shells.
8. **First Drawer adoption:** application test helpers have no existing Drawer precedent. Component tests will likely stub the drawer for state contracts, while at least one integration-style test should use `mountWithUApp` to verify portal/open/dismiss behavior.
9. **Large test churn:** existing view tests assert old card count and test ids. Rewrite the driver-detail assertions around cockpit semantics while retaining API, role, error privacy, mutation, and invalidation tests.
10. **Accessibility:** route spine state cannot rely on color alone. Nodes need text/status labels, selected stop state, logical DOM order, focus-visible controls, and reduced-motion-safe transitions.

## 11. Proposal readiness

The change is feasible with the existing Vue 3, TanStack Vue Query, Nuxt UI v4, Coco tokens, map primitive, and delivery-route API. Proposal should proceed after confirming at minimum: driver-only scope, current-stop selection, whether check-in order is enforced, sticky CTA target behavior, and the one-overlay-at-a-time drawer/confirmation flow.

Recommended proposal scope: preserve server contracts and manager UI; redesign only the driver detail presentation and interaction hierarchy; add pure current/next derivation; reuse shared primitives; add no backend-gated capability; and replace old driver-detail presentation tests through strict TDD during implementation.