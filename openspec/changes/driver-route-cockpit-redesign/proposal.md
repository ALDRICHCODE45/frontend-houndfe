# Driver Route Cockpit Redesign — Proposal

Change: `driver-route-cockpit-redesign`
Phase: PROPOSE
Artifact store: OpenSpec
Confirmed product decisions (locked, do not re-open): `driver-detail-only`, `visual-priority-no-enforcement`, `maps-copy-email`, `single-drawer-confirm-refresh`
Research lane: unselected

## Why

The current driver route detail screen is a generic vertical stack of equal-weight stop cards. It wastes the screen real estate that mobile drivers need, gives the first actionable stop no visual priority, treats every `PENDING` stop identically, and leaves both the route timeline and the check-in action competing for the same thumb zone. The screenshot evidence and the existing `DriverStopDetail` code agree: there is no cockpit — only a list rendered with a card layout.

The repository already exposes everything the cockpit needs without backend help: route ordering, stop statuses with timestamps, customer name/email, full shipping address, optional coordinates, sale folio, route-level notes, and timeline events. What is missing is the **presentation layer that turns that DTO into a clear mobile-first operating surface** for a driver who is mid-shift. This change rebuilds only the driver detail view to read like a deliberate cockpit while leaving the manager branch, the driver route list, and every API contract untouched.

The decision tokens locked at the pre-proposal gate define the shape:

- **driver-detail-only** — manager detail and driver route list are out of scope.
- **visual-priority-no-enforcement** — derive `current` from the first `IN_PROGRESS` or `PENDING` stop, visually prioritize it, but do not disable later `PENDING` stops because the backend does not enforce order.
- **maps-copy-email** — offer external map navigation, copy address, and email when an address or email exists; do not add phone, ETA, sale items, proof of delivery, or skip flows because the contract does not expose them.
- **single-drawer-confirm-refresh** — one bottom drawer for stop and history modes, close it before opening `ConfirmModal`, and add an explicit manual refresh control in the cockpit header (no polling).

## What Changes

A new driver-only cockpit composition replaces the current driver branch of `DeliveryRouteDetailView`. The cockpit is composed of focused SFCs that consume a single loaded DTO and share a pure selector utility for derivations. The manager branch of the same view, the driver route list, all API/composable wrappers, the shared primitives, and the design tokens are reused without modification.

### New components and utilities (feature folder: `src/features/delivery-routes/components/cockpit/` and `composables/cockpit/`)

| New artifact | Single responsibility |
| --- | --- |
| `DriverRouteCockpit.vue` | Compose the driver detail from the loaded DTO; own selected-sheet mode and pending confirmation state. No fetching. |
| `DriverCockpitHeader.vue` | Sticky route identity, lifecycle badge, compact progress fraction, manual refresh, and back navigation. |
| `DriverCurrentStopCard.vue` | Render the derived current stop with customer avatar, folio, label-first address, and an inline `Route notes` callout when present. |
| `DriverNextStopPreview.vue` | Render only the next pending stop, or a terminal-route message when none remain. No ETA. |
| `DriverRouteSpine.vue` | Render all ordered stops as a semantic sequence with completed, current, upcoming, and skipped states; supports keyboard navigation and selection for the drawer. |
| `DriverStopSheet.vue` | Present selected stop details and the optional point map in `UDrawer`; emits close. |
| `DriverRouteHistorySheet.vue` | Present the existing read-only timeline inside the same drawer shell with a `history` mode flag. |
| `DriverDeliveryActionBar.vue` | Sticky bottom action bar; offers delivery only for a `PENDING` current stop and emits `request-confirm`. |
| `composables/cockpit/useDriverRouteCockpit.ts` | Pure selector / `computed` surface: `currentStop`, `nextStop`, `spine`, `progress`, `isTerminal`, derived from a single `DeliveryRouteResponseDto`. |
| `composables/cockpit/useCockpitManualRefresh.ts` | Thin TanStack Query wrapper that calls `useQueryClient().invalidateQueries` for the active route id and a bounded `refetch`. No interval polling. |
| `utils/cockpit/driverCockpitQuickActions.ts` | Pure helpers: `openExternalMap(address, coords)`, `copyAddressToClipboard(address)`, `openEmail(email)`, returning user-visible messages and a typed result. |

### Modified components

- `src/features/delivery-routes/views/DeliveryRouteDetailView.vue` — driver branch swaps the current stop list + timeline for `<DriverRouteCockpit>`. Manager branch, role gating, query orchestration, error privacy, and not-found mapping remain unchanged.
- `src/features/delivery-routes/composables/useDeliveryRouteDetail.ts` — no behavior change; only the comment around `keepPreviousData` is tightened to call out that freshness is delivered by mutation invalidation plus the new manual refresh action.

### Reused without modification

`EntityAvatar`, `StatusDotBadge`, `AppBadge`, `ConfirmModal`, `AddressMapPicker` (read-only mode), `formatAddress`, `formatDateTime`, the existing route/stop status maps, the Coco token set in `src/assets/main.css`, and the Nuxt UI v4 `UDrawer` (first direct app use) backed by `vaul-vue`.

### Reduced or retired

- `src/features/delivery-routes/components/DriverStopDetail.vue` — reduced to a thin wrapper used inside `DriverStopSheet`; the old full-card layout is no longer the primary presentation.
- The five-status stop badge requirement from the archived check-in spec is **explicitly superseded**: spine state encodes status visually; textual status still appears inside the drawer detail and history views, so no information is lost.

`DeliveryRouteTimeline.vue` is reused inside the history drawer mode and the `DeliveryRouteDetailView` still imports it so the manager branch is unaffected.

## Out of Scope

The following are explicit non-goals for this change and must not appear as functioning UI even if they seem trivial:

- Any backend endpoint, DTO field, or contract change.
- Manager route detail, manager lifecycle actions, or the manager route planner.
- Driver route list view, its empty/loading/error/retry surfaces, and its navigation contract.
- Real travel ETA, distance, traffic, polyline, route geometry, or turn-by-turn navigation.
- Customer phone display or any `tel:` deep link.
- Sale line items, package contents, manifests, or any per-stop pricing on the route.
- Proof-of-delivery capture (photo, signature, recipient name) and offline queue.
- Failed-delivery / skip mutations, skip reasons, or per-stop notes.
- Driver geolocation, live tracking, or share-my-location affordance.
- Polling, focus refetch, push updates, or any auto-refresh; the only refresh is the explicit header action.
- Replacement of the dashboard shell, sidebar, or global design tokens.
- New map vendor or replacement of Leaflet; `AddressMapPicker` continues to be the only map primitive.
- Internationalization work beyond reusing existing English/Spanish copy paths and the current `t()` usage in the route feature.

## Capabilities

Capabilities map 1:1 to future `openspec/changes/driver-route-cockpit-redesign/specs/<capability>/spec.md` artifacts.

### New capabilities

1. **driver-cockpit-shell** — The end-to-end driver cockpit composition (header, current stop, next-stop preview, spine, drawer, action bar) with a single derived state model. SHALL preserve all existing role gating, error privacy, and not-found mapping.
2. **driver-cockpit-derivation** — Pure selector surface that turns one `DeliveryRouteResponseDto` into `currentStop`, `nextStop`, `spine[]`, `progress` (completed/total), and `isTerminal` flags. SHALL be deterministic, side-effect free, and unit-testable without TanStack Query.
3. **driver-cockpit-drawer** — One `UDrawer` shell with explicit `stop` and `history` modes. SHALL be modal, dismissible, focus-trapped, and emit a single `update:open` event. SHALL mount at most once at a time and SHALL close before any `ConfirmModal` is opened.
4. **driver-cockpit-quick-actions** — External map deep link, copy-to-clipboard for address, and email deep link guarded by feature-detected data (address/coords and customer email respectively). SHALL fall back gracefully when the underlying API is unavailable and SHALL surface success/failure via the existing toast helper.
5. **driver-cockpit-manual-refresh** — Header refresh button that invalidates the active route detail query and refetches without intervals or focus listeners. SHALL be disabled while the query is already fetching and SHALL preserve scroll position.
6. **driver-cockpit-terminal-state** — When the route is `COMPLETED` or `CANCELLED`, the action bar is replaced by a terminal summary card and the spine becomes read-only. SHALL keep history mode reachable.

### Modified capabilities

- **delivery-route-detail-view (driver branch)** — Driver rendering swaps to the cockpit; manager rendering, role check, query orchestration, error mapping, and not-found privacy are preserved verbatim. SHALL NOT change the route path, the route guard, or the sidebar entry.

## Approach

1. **Keep the data model honest.** `useDriverRouteCockpit` reads only fields that already exist on `DeliveryRouteResponseDto` and its stops. The selector is a single pure function plus `computed` wrappers; no new fetches, no polling, no fabricated fields.
2. **Lock the cockpit vocabulary to the existing system.** All colors come from Coco tokens (`#2442f6`, `#173968`, `#f6bb13`, dark neutrals). Inter is the only type family. Gold (`#f6bb13`) is reserved for the current/active work and the primary delivery CTA; Coco blue carries route continuity (spine, header link, map marker); navy carries hierarchy. The signature device is the **route spine** — a vertical line whose nodes carry completed/current/upcoming/skipped states through both color and label.
3. **Build the composition from focused SFCs.** Each cockpit component owns one responsibility and emits via `defineEmits`. State for the drawer mode and the pending confirmation lives in `DriverRouteCockpit` so children stay presentational.
4. **Stack overlays carefully.** The drawer is modal by default and is closed before `ConfirmModal` is opened. Focus returns to the trigger after the modal closes. The integration test must cover this exact sequence.
5. **Stay mobile-first inside the dashboard shell.** Use the `SaleDetailView` pattern: counter the panel body padding with negative margins, build a full-height flex column, keep the header sticky inside the panel's scroll container, and add explicit bottom safe-area padding on the action bar. Use `dvh` for sheet bodies.
6. **Touch targets and a11y.** Primary CTA stays at the Coco large button height (≥44px) and adds an inner safe-area pad. Spine nodes are real `<button>` (or `<li>` + accessible label) with visible focus rings; state is never conveyed by color alone (each node also carries a textual status). `prefers-reduced-motion` is respected on the drawer enter transition.
7. **Truthful quick actions.** External map opens `https://www.google.com/maps/search/?api=1&query=...` only when an address or coordinates are present; copy-to-clipboard uses `navigator.clipboard.writeText`; email opens `mailto:` only when a customer email exists. Each helper returns a typed result for the toast helper.
8. **Tests are rewritten on intent, not preserved by inertia.** Existing driver-detail view/component tests are replaced by cockpit-semantic tests. API, role, error privacy, mutation, and invalidation tests are kept as the stable contract. At least one integration-style test uses `mountWithUApp` to verify `UDrawer` open/close and the drawer-then-confirm focus flow.
9. **Strict TDD per `openspec/config.yaml`.** Every slice follows RED → GREEN → TRIANGULATE → REFACTOR and ends in `pnpm test:unit --run` green plus a clean `vue-tsc --build`. Slice budget is 400 changed lines; chains are deferred (each slice is independently mergeable and the open PR will be the proposal gate).

## Impact

### Code touch surface

- New folder `src/features/delivery-routes/components/cockpit/` (~9 SFCs).
- New folder `src/features/delivery-routes/composables/cockpit/` and `src/features/delivery-routes/utils/cockpit/` (~3 TS modules).
- Modified: `DeliveryRouteDetailView.vue` (driver branch swap; ~30 changed lines), `DriverStopDetail.vue` (reduced to a drawer-internal wrapper), `useDeliveryRouteDetail.ts` (doc comment tightening only).
- Manager branch files untouched.

### Tests

- New co-located `*.spec.ts` files for the selector utility, the action helpers, and each cockpit component.
- New `DriverRouteCockpit.test.ts` covering composition, empty/loading/error/handoff from the view, and the drawer mode toggle.
- New `DriverRouteDetailView.test.ts` updates that verify the manager branch stays unchanged and that the driver branch mounts the cockpit with the expected props.
- `DriverStopDetail.test.ts` is rewritten against the wrapper contract.
- Stable tests (API, role, error privacy, mutation, invalidation) remain green without modification.

### UX and operations

- Drivers see one obvious next stop instead of N equal cards; check-in becomes a single thumb action guarded by confirmation.
- No new backend traffic; no new permission required; existing `read:DeliveryRoute` + `update:DeliveryRoute` (for check-in) CASL verbs are sufficient.
- No new dependencies; `@nuxt/ui` already exposes `UDrawer` and the existing `vaul-vue` runtime is installed.

### Documentation

- `openspec/changes/driver-route-cockpit-redesign/{exploration,preproposal,proposal,design,tasks,verify-report}.md` plus `specs/<capability>/spec.md` per the configured phase order.
- The archived check-in spec note about a stop status badge is explicitly superseded in the new spec (`driver-cockpit-derivation` REQ).

## Risks / Unknowns

| Risk | Likelihood | Mitigation baked into the proposal |
| --- | --- | --- |
| `UDrawer` + `ConfirmModal` stacking causes focus or scroll-lock defects. | Medium | One-overlay-at-a-time rule (D4); close drawer before opening modal; integration test pins the sequence. |
| Leaflet inside an animated drawer mounts before dimensions settle. | Medium | Optional map is reused via `AddressMapPicker` read mode with its existing tile-error fallback; the text address is the always-available primary; map lives in the drawer body only, not inside the action bar. |
| Sticky CTA obscures the final stop or timeline. | Medium | Bottom safe-area padding on the action bar plus matching content bottom padding; sticky scope is the dashboard panel's scroll container, not the browser viewport; tested in `pnpm test:unit`. |
| Visual "current" implies an enforced order that does not exist in the backend. | Low–Medium | Spine labels and the locked D2 decision make the priority purely visual; later `PENDING` stops remain actionable through the drawer with their own confirmation flow; copy says "Siguiente" / "Acción actual" not "Orden obligatoria". |
| Stale data after a third-party mutation on the same route. | Medium | Manual refresh in the header (D4); no silent polling; toast reflects refresh success/failure. |
| Null-rich DTO renders empty decoration. | Medium | Defensive labels and per-component triangulation tests for missing customer, address, folio, notes, coordinates, timestamps; spine still renders the full ordered list. |
| `UDrawer` is the first direct app use; test helpers have no precedent. | Low | One `mountWithUApp` integration test plus a dedicated component test that stubs the drawer for state-only contracts. |
| Large test churn breaks CI confidence during the rewrite. | Medium | Slice-by-slice TDD; API/composable/security tests preserved verbatim; driver-detail test replacement happens inside the same slice as the cockpit composition. |
| Accessibility regression in spine state. | Low | Each spine node carries a textual status and uses real focusable controls; reduced motion respected on drawer transition; keyboard navigation matches the visual order. |
| Confirm copy wording causes confusion about irreversibility. | Low | Confirmation text names the customer, folio, and stop number; final toast uses the existing action messaging; no proof-of-delivery claim is made. |

## First Slice Scope

The first PR-sized slice delivers the verifiable end-to-end shell with no optional behavior. It is bounded to ≤400 changed lines, ends in `pnpm test:unit --run` green plus a clean `vue-tsc --build`, and is independently mergeable.

**Slice 1 — Cockpit shell + derivation + minimal composition**

- Add `useDriverRouteCockpit` (pure selector + `computed` wrappers) with full unit tests covering: route with no stops, route with one stop, route where first `PENDING` is current, route where an `IN_PROGRESS` stop takes priority over `PENDING`, mixed `COMPLETED`/`PENDING`/`SKIPPED` order, and `COMPLETED`/`CANCELLED` terminal routes.
- Add `DriverCockpitHeader.vue`, `DriverCurrentStopCard.vue`, `DriverNextStopPreview.vue`, `DriverRouteSpine.vue`, `DriverDeliveryActionBar.vue` as presentational-only SFCs with co-located tests pinning props/emits and `aria`/role attributes.
- Add `DriverRouteCockpit.vue` that composes the above with `ConfirmModal` reused as-is for the CTA confirmation; integration test uses `mountWithUApp` and asserts the close-drawer-then-open-confirm invariant (no drawer mode yet, so the invariant is exercised when the second slice lands).
- Wire the driver branch of `DeliveryRouteDetailView.vue` to render `<DriverRouteCockpit>` while the manager branch, role gate, error privacy, and not-found mapping remain unchanged. View test asserts the swap.
- Reduce `DriverStopDetail.vue` to the wrapper it will become in the next slice; the wrapper is not yet rendered.
- Stable tests (API, role, mutation, invalidation, error mapping) remain green.

Out of slice 1 (later slices): the `UDrawer` shell with stop and history modes, the quick-actions helpers (map/copy/email), the manual refresh composable, the terminal-state card, the spine keyboard navigation polish, and the rewrite of `DriverStopDetail.test.ts` against the wrapper.

## Rollback Plan

- Frontend-only change behind the existing `/pos/rutas-de-entrega/:id` route and the existing role guard; no backend change, no permission change, no data migration.
- Manager branch of `DeliveryRouteDetailView.vue` is untouched, so reverting any slice commit returns the driver branch to the prior list-of-cards presentation without affecting manager flows.
- The existing TanStack Query keys, the `useCheckInStop` mutation, and the cache invalidation strategy are unchanged; reverting cannot leave stale mutation queues because no optimistic updates are introduced.
- New composables and components live under `src/features/delivery-routes/components/cockpit/` and `…/composables/cockpit/`; deleting those folders plus the small swap in `DeliveryRouteDetailView.vue` is sufficient to fully revert.
- The archived check-in spec note about a stop status badge is only superseded if the new spec lands; if the change is rolled back, the note remains the source of truth and the old UI continues to honor it (or not, as it did before).
- Rollback trigger criteria: any test that was green pre-change turns red post-change, any type-check failure, or any manager-branch regression — verified by running `pnpm test:unit --run` and `pnpm build` against the revert commit.

## Success Criteria

The proposal is considered successful when **all** of the following are demonstrable from the merged code, the tests, and a manual walkthrough on a mobile viewport:

1. Opening an active route from the driver list renders the cockpit with a sticky header, a gold-accented current stop card, a next-stop preview, a route spine, and a sticky delivery action bar inside the dashboard panel.
2. The "current" stop is always the first `IN_PROGRESS` if one exists, otherwise the first `PENDING`; later `PENDING` stops remain reachable and actionable through their spine node / drawer entry (D2).
3. Tapping the primary CTA opens `ConfirmModal` with the customer name, stop number/folio, and an irreversible state-change statement; cancelling closes the modal without changing server state; confirming calls `useCheckInStop`, invalidates the route detail and list queries, and the spine updates without a full-page reload.
4. The drawer has exactly one instance at a time; opening it in `stop` mode shows the selected stop, its label-first address, and the optional point map only when coordinates exist; switching to `history` mode replaces content without stacking overlays; closing the drawer returns focus to the originating control.
5. When an address or coordinates exist, the stop detail offers an external map deep link that opens in a new tab; when the customer email exists, the email action opens `mailto:`; the copy-address action uses `navigator.clipboard.writeText`; each surfaces a success or failure toast.
6. The header refresh button invalidates the active route detail query and refetches; the button is disabled while a fetch is in flight; no polling, no focus listener.
7. When the route is `COMPLETED` or `CANCELLED`, the action bar is replaced by a terminal summary card and the spine/history remain reachable in read-only form.
8. Manager detail, driver route list, route list filter, and the `ConfirmModal` contract are byte-equivalent in observable behavior to the pre-change codebase (verified by the existing manager test suite passing unchanged).
9. `pnpm test:unit --run` is green; `vue-tsc --build` is clean; `pnpm build` produces a successful bundle.
10. Touch targets on the primary CTA and the spine nodes are ≥44×44px; spine state is conveyed by both color and text label; focus-visible rings are present; reduced-motion users see a non-animated drawer enter.

## Next Phase

Hand off to `design.md`. The locked decisions above remove the major product ambiguity; design will lock the component contracts, the selector API surface, the DTO zod schemas, the TanStack Query keys and invalidation strategy, the permission matrix, and the empty/loading/error states required for verification.
