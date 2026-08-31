# Design — driver-cockpit-responsive-polish

## Decision summary

Implement this as a presentation-only responsive composition change. The cockpit remains a Vue 3 Composition API surface with typed props/emits, `reduceCockpit` remains the sole transition authority, and the detail view remains the sole owner of `useCheckInStop`. At the shared Tailwind `lg` boundary (1024px), exactly one overlay is mounted:

- `lg+`: `USlideover side="right" inset`.
- `<lg`: `UDrawer direction="bottom"`.

The desktop primary action is rendered only by the slideover footer. The mobile primary action is rendered only by the page footer. The page footer keeps terminal, in-progress, and empty modes coherent, but its `current-action` branch is suppressed at `lg+` rather than rendered as a competing action.

## Installed Nuxt UI contracts verified

The installed package is `@nuxt/ui@4.6.0`. The relevant package implementation/type surface is under `node_modules/@nuxt/ui/dist/runtime/components/` (the generated declaration surface is in the corresponding `*.d.ts` files):

- `Slideover.vue` / `Slideover` emits the colon-named Vue transition lifecycle events `after:enter` and `after:leave` (`defineEmits(["after:leave", "after:enter", ...])`), verified at `node_modules/@nuxt/ui/dist/runtime/components/Slideover.vue:34,78-79`. The listener contract is therefore **`@after:leave` / `@after:enter`**, not the hyphenated listener spelling and not a drawer-style `animationEnd` event. The adapter calls `settleClosed()` only from `after:leave`, guarded so one close produces one `closed` emission; `after:enter` is the slideover map-readiness signal. `update:open(false)` only starts the close and forwards the controlled value to the parent.
- `Drawer.vue` / `Drawer` exposes the existing `animationEnd(open: boolean)` contract used by the current cockpit. The drawer adapter continues to synthesize `closed` only from `animationEnd(false)` and treats `animationEnd(true)` as opening-settled/map-ready.
- `DashboardNavbar.vue` accepts the `toggle` boolean prop. When enabled, its native leading toggle is the responsive `UDashboardSidebarToggle`; its implementation supplies the accessible sidebar open/close behavior and touch target. `UDashboardSidebarToggle.vue` is the direct component contract if an explicit slot fallback is ever required. The chosen implementation is to remove `:toggle="false"` (or set `:toggle="true"`) and retain the existing `UDashboardSidebarCollapse` separately. This restores the native navbar toggle without repurposing desktop collapse.
- `DashboardSidebar.vue` remains the owner of the sidebar responsive overlay/dismiss behavior. No custom mobile sidebar state or duplicate trigger is introduced.

The source-level design pin for implementation review is: `USlideover @after:leave` and `@after:enter` from `node_modules/@nuxt/ui/dist/runtime/components/Slideover.vue:34,78-79`, and `UDashboardNavbar`'s `toggle` prop forwarding to `UDashboardSidebarToggle` in `node_modules/@nuxt/ui/dist/runtime/components/DashboardNavbar.vue`. Tests must stub these colon-named lifecycle events explicitly rather than pretending `USlideover` emits `animationEnd`.

The canonical project precedent remains `src/features/delivery-routes/components/DeliveryRouteUpsertSlideover.vue`: `USlideover` with `side="right"`, `inset`, `#body`, and `#footer`.

## Component map and typed contracts

| Component / module | Single responsibility | Contract |
|---|---|---|
| `DriverRouteCockpit.vue` | Own route-local UI state, reducer orchestration, focus return, and composition order. | Props: `{ route, isFetching, canCheckIn, checkInPending }`; emits `back`, `refresh`, `request-check-in(stopId)`; no query, mutation, router, or HTTP imports. |
| `DriverCockpitOverlay.vue` (rename/replace `DriverCockpitDrawer.vue`) | Mount exactly one active Nuxt UI overlay, provide one header/close, map mode content, adapt native settled lifecycle, and expose the desktop footer. | Props: `{ open, mode, route, stop, routeTerminal, canCheckIn, checkInPending }`; emits `update:open(boolean)`, `closed`, `request-confirm(StopTrigger)`. Internal reactive `isDesktop` comes only from the breakpoint composable. |
| `useCockpitBreakpoint.ts` | Single breakpoint authority for cockpit container selection. | `useCockpitBreakpoint(): { isDesktop: ComputedRef<boolean> }`; uses `useMediaQuery('(min-width: 1024px)')`; no second threshold. |
| `DriverStopPanel.vue` | Render stop details body only: position/folio, customer, address, map, and quick actions. | Minimal props: `{ stop, mapReady }`; no emits. It renders no header, close, or delivery action. Overlay-owned action gating and emission are outside this body-only component. |
| `DeliveryRouteTimeline.vue` | Existing history body, directly mounted by overlay mode mapping. | Existing props and test IDs unchanged. |
| `DriverCockpitFooter.vue` | Render mutually exclusive page-footer modes and mobile current action. | Existing typed props/emits; add `isDesktop`/`desktopActionSuppressed` as an explicit presentation prop only if needed. At desktop, `current-action` renders no primary button; terminal/in-progress/empty behavior remains unchanged. |
| `DriverCockpitHeader.vue` | Render sticky cockpit identity, lifecycle, progress, history, refresh, and back controls with narrow-width grouping. | Existing typed props/emits unchanged. |
| `DriverOperationalStops.vue` | Render current/next operational cards without owning the body gutter. | Existing props/emits unchanged; remove nested horizontal padding. |
| `DriverRouteSpine.vue` | Render ordered selectable stop sequence without premature truncation. | Existing `{ nodes }` and `select-stop(StopTrigger)` contract unchanged. |
| `DashboardLayout.vue` | Compose global app shell and restore native mobile sidebar trigger. | No new public contract; enable `UDashboardNavbar` native `toggle`; preserve `UDashboardSidebarCollapse` desktop control and all unrelated shell structure. |

No new DTO, Zod schema, API method, query key, cache policy, or CASL subject is needed. Existing route DTO and stop types are passed through unchanged.

## Overlay lifecycle and state machine

### Adapter

Keep two explicit adapters rather than pretending event parity:

```ts
// Drawer: native animationEnd(openAfter)
if (openAfter) mapReady = true
else emitClosedOnce()

// Slideover: native colon-named lifecycle events
@after:enter => mapReady = true
@after:leave => emitClosedOnce()
```

`update:open(false)`, `close`, and drawer `release(false)` only call `emit('update:open', false)`. A per-open `closedEmitted` guard prevents duplicate events. Opening settles reset `mapReady` and the guard; drawer readiness is set only by `animationEnd(true)`, while slideover readiness is set only by native `@after:enter`. There is no nextTick or open-state fallback. Close completion is set only by slideover `@after:leave` or drawer `animationEnd(false)`.

During a direct open-state surface swap, render exactly one branch with `v-if`/`v-else`, never both. The old container is unmounted without emitting a custom `closed`; reset `mapReady`, then mount the new container with the same parent-owned `open`, `mode`, and selected stop. This preserves state while ensuring only one portal, focus trap, and scroll lock owner exists. If an actual close transition is already in flight, freeze the active surface until its settled-close event (`@after:leave` or `animationEnd(false)`); do not adopt the new breakpoint or unmount early. After settlement, adopt the latest breakpoint before any reducer-driven reopen, allowing exactly one normal `closed` continuation and preventing stale portals or modal ownership leaks.

### Parent reducer flow

Do not rename reducer phases merely because the visual surface changes; `DRAWER_STOP` and `DRAWER_HISTORY` are compatibility names for the cockpit overlay states. Preserve:

- selected stop and mode across responsive swaps;
- stop/history mode changes as close → settled `closed` → reopen;
- drawer-origin confirmation as close → settled `closed` → `CONFIRM`;
- exactly one active overlay, with `ConfirmModal` opened only after the overlay settles;
- focus origin capture on open/action, restoration only on final `CLOSED`/cancel/mutation settle, and root fallback when the origin is disconnected.

The selected stop is always resolved from the current `route.stops` by ID. No overlay-local copy becomes authoritative, so resize and query refresh cannot silently change the selected mode semantics.

## Action placement and user path

`DriverCockpitFooter` computes the same four semantic modes. On `<lg`, `current-action` renders the single prominent page-footer button. On `lg+`, the page footer receives a `desktopActionSuppressed` presentation flag and renders no `Marcar entregada` button for `current-action`; it still renders the in-progress indicator, terminal summary/history, and empty output for their respective modes.

When a desktop user clicks a current/next stop card or spine node, the cockpit opens the right slideover. The slideover header identifies the stop and owns the sole close control. The stop body has address, map, and quick actions only. The gated `Marcar entregada` button is in the slideover `#footer`; clicking it captures its element, requests close, waits for `@after:leave`, then opens `ConfirmModal`. The action still targets the selected stop, not necessarily the current stop, and remains disabled while `checkInPending`.

No action is duplicated in `DriverStopPanel`, the desktop page footer, or the overlay header. A read-only user, terminal route, and non-PENDING stop show no delivery action. `IN_PROGRESS` retains its disabled status indicator.

## Layout architecture

- `DriverRouteCockpit` remains a flex column with a deliberate viewport composition: use `min-h-[100dvh]` (or the containing panel's available `min-h-0`/`h-full` equivalent) and `flex-1 min-h-0` on the body region, while the footer remains the terminal flex child/sticky surface. This lets mobile place the action at the visible bottom without adding a desktop-only blank block. Do not use a fixed or absolutely positioned footer.
- The cockpit body is the sole horizontal gutter authority: `px-4 sm:px-6` (or the project-equivalent token) lives on `cockpit-body`. Remove `px-4` from `DriverOperationalStops`; the spine and all body sections consume the parent width. The overlay body has its own internal padding because it is a separate surface, not a competing page gutter.
- Footer safe area is additive: use `padding-bottom: calc(0.75rem + env(safe-area-inset-bottom))` (or an equivalent tokenized calc), with matching body clearance derived from the same base/inset rule. A zero inset preserves the 0.75rem base and a nonzero inset is added to it; do not use `max(0.75rem, env(safe-area-inset-bottom))` while describing the behavior as additive.
- Header uses narrow groups: back plus a `min-w-0 flex-1` identity group, then progress and a compact action group for history/refresh. Controls remain at least 44×44px, can wrap at 320–373px, and never force horizontal scroll. Identity may ellipsize only after the group has genuinely exhausted available width; never reduce to a meaningless `Re` fragment. Status text remains available through the existing badge/accessibility label.
- Body labels use `min-w-0`, `max-w-full`, and truncation only on the constrained text span. Spine position/status remain flex-none; customer text is the flexible span. No fixed width is introduced. Address text truncates at actual overflow while map and quick-action rows wrap.
- Safe-area padding is additive and the mobile footer's clearance is included in the body composition. Desktop does not inherit mobile dead space merely because the footer is sticky.
- Respect existing semantic tokens, focus-visible rings, reduced-motion classes on the actual Nuxt UI overlay/content/overlay slots, and dynamic viewport units for the mobile drawer's `85dvh` cap.

## Data, permissions, and server-state boundaries

There are no data-flow changes. `DeliveryRouteDetailView` continues to pass `canUpdate` as `canCheckIn`, owns the one `useCheckInStop` mutation, and owns query invalidation/toasts. The cockpit emits only `request-check-in(stopId)` after confirmation.

| User action | Permission / owner |
|---|---|
| Inspect cockpit, history, stop details | Existing route-read/view gate; no new CASL check. |
| Show/activate `Marcar entregada` | `update:DeliveryRoute` (`canCheckIn === canUpdate`), non-terminal route, selected/current PENDING stop, not pending. |
| Perform check-in | Existing `useCheckInStop` in `DeliveryRouteDetailView`; no child mutation. |
| Desktop sidebar collapse | Existing `UDashboardSidebarCollapse` behavior unchanged. |
| Mobile sidebar open | Native `UDashboardNavbar toggle` / `UDashboardSidebarToggle`; no route or permission side effect. |

No query key or invalidation strategy changes. No new error mapping is required.

## Empty, loading, and error states

- Existing route-level loading, fetch error, and manager/driver branching remain in `DeliveryRouteDetailView` and are not moved into cockpit components.
- Zero stops: header and body mount, operational fallback and empty spine render, footer is empty; no overlay action exists.
- Non-terminal last stop: existing “last stop” copy remains; terminal route takes precedence for “no more” copy.
- Terminal route: page footer shows terminal summary and history; history overlay remains available and contains the direct timeline, including the existing empty timeline state.
- Null customer/folio/address: existing fallbacks remain; absent address never suppresses the stop identity; invalid coordinates suppress only the map.
- Map tile failure: existing map component behavior remains (hide map, no toast).
- Refresh/check-in pending: existing disabled controls and mutation-owned error/success toasts remain unchanged.
- Overlay close during any mode: no premature reducer transition; only the native settled adapter emits `closed`.

## Reused primitives

Reuse `USlideover`, `UDrawer`, `UDashboardNavbar`, `UDashboardSidebarCollapse`, `StatusDotBadge`, `AddressMapPicker`, `DeliveryRouteTimeline`, `ConfirmModal`, `DELIVERY_ROUTE_COPY`, `useDriverRouteCockpit`, `mountWithUApp`, and the existing quick-action utilities. Reuse the `DeliveryRouteUpsertSlideover` footer/header pattern rather than introducing an overlay primitive. `@vueuse/core` is already installed; `useMediaQuery` adds no dependency.

## Testing architecture (strict TDD seams)

Tests remain co-located and each implementation slice follows RED → GREEN → TRIANGULATE → REFACTOR with `pnpm test:unit --run` as its gate.

1. **Breakpoint seam:** mock `useMediaQuery` or stub `window.matchMedia` at 1024px; assert desktop/mobile branches and reactive resize crossing in both directions. Assert exactly one `v-if`/`v-else` container is mounted, an open-state swap unmounts the old surface without custom `closed`, resets `mapReady`, and preserves parent-owned `open`/`mode`/selected stop. Also change breakpoint while a close is in flight and assert the active surface freezes until `@after:leave`/`animationEnd(false)`, then adopts the latest breakpoint before reducer reopen, with no stale portal, focus trap, or scroll lock.
2. **Overlay lifecycle seam:** provide distinct `USlideover` and `UDrawer` stubs. Emit `USlideover update:open(false)` and assert no `closed`; emit `after:leave` and assert one `closed`; emit `after:enter` and assert `mapReady`. Retain drawer `animationEnd(true)` → `mapReady` and `animationEnd(false)` → `closed` assertions. Include duplicate settled events and reduced-motion classes.
3. **Overlay composition seam:** assert exactly one title and `aria-label="Cerrar"` close control, direct timeline mounting, `DriverStopPanel` with exactly `{ stop, mapReady }` and no emits/close/action, footer slot action, and close-before-confirm.
4. **Footer seam:** assert mobile page action, desktop suppression, desktop slideover footer action, terminal/history, in-progress, empty, read-only, pending mutation, selected non-current stop, additive safe-area class/style, and no duplicate action.
5. **Header seam:** assert one control group, 44px controls, readable identity at 373px, no horizontal-overflow class contract at 320px, back/history/refresh emits and disabled refresh.
6. **Shell seam:** assert `UDashboardNavbar` toggle is enabled/native, the mobile trigger has accessible naming/touch behavior through the installed stub, desktop collapse remains present and distinct, and no navigation/API side effects occur.
7. **Body seam:** assert one gutter declaration at cockpit body, aligned operational/spine edges at 320/373/768px, and actual-overflow-only truncation.
8. **Preservation suite:** keep reducer/derivation, quick actions, manager branch, list, check-in mutation, permission, and existing timeline tests green. Update only tests whose old all-drawer or panel-close assumptions are deliberately changed.

Use `mountWithUApp` for real Nuxt UI/provider integration; use explicit lifecycle-aware stubs for deterministic component unit tests. Do not assert unavailable `USlideover animationEnd` parity.

## Scope and file plan

Likely modified files:

- `src/features/delivery-routes/components/cockpit/DriverCockpitDrawer.vue` (or replacement `DriverCockpitOverlay.vue`)
- `src/features/delivery-routes/components/cockpit/DriverStopPanel.vue`
- `src/features/delivery-routes/components/cockpit/DriverRouteCockpit.vue`
- `src/features/delivery-routes/components/cockpit/DriverCockpitFooter.vue`
- `src/features/delivery-routes/components/cockpit/DriverCockpitHeader.vue`
- `src/features/delivery-routes/components/cockpit/DriverOperationalStops.vue`
- `src/features/delivery-routes/components/cockpit/DriverRouteSpine.vue`
- `src/app/layouts/DashboardLayout.vue`

Likely new file:

- `src/features/delivery-routes/composables/cockpit/useCockpitBreakpoint.ts`

Likely modified tests:

- `src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitDrawer.spec.ts`
- `DriverStopPanel.spec.ts`, `DriverCockpitFooter.spec.ts`, `DriverCockpitHeader.spec.ts`, `DriverRouteCockpit.spec.ts`
- `src/app/layouts/__tests__/DashboardLayout.test.ts`

No view, API, DTO, query, router, authorization, or navigation-registry file should change.

## Risks, budgets, and rollout

The main budget risk is combining overlay replacement, header/footer composition, gutter/layout changes, and their tests in one slice. Keep the app-shell trigger as an isolated first slice, then breakpoint/lifecycle overlay, then action/stop-panel composition, then header/body/footer polish. Each slice must remain below the configured 600 changed-line hard limit and the parent review forecast of 400 lines; split tests from layout polish if the forecast exceeds 400. Renaming the drawer component creates avoidable import/test churn, so retain the `DriverCockpitDrawer.vue` filename unless implementation clarity requires a new overlay file.

Roll out source-only, with no migration or backend coordination. Rollback is per slice: revert the shell trigger independently, revert adaptive overlay/lifecycle independently, and revert visual footer/header/gutter polish independently. The safest emergency rollback is to restore unconditional `UDrawer` only after preserving the existing reducer and mutation boundaries; no persisted data is affected.

## Acceptance checklist

- [ ] Installed `USlideover @after:leave` is used for settled close and `@after:enter` is used for map readiness, citing `node_modules/@nuxt/ui/dist/runtime/components/Slideover.vue:34,78-79`; no fabricated slideover `animationEnd` event.
- [ ] Native navbar toggle is restored and desktop collapse remains separate.
- [ ] Desktop action is reachable from the selected stop slideover footer; mobile action is page-footer-only.
- [ ] Exactly one active overlay, title, close control, and primary action per context.
- [ ] Reducer, focus return, selected stop/mode, quick actions, and check-in ownership remain unchanged.
- [ ] One cockpit body gutter authority, `dvh`/flex composition, `calc(0.75rem + env(safe-area-inset-bottom))` additive safe-area padding, narrow grouping, and overflow-safe truncation are implemented.
- [ ] Strict TDD seams and preserved manager/list/check-in coverage are green; `vue-tsc --build` and final build pass.
