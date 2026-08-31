# Exploration — `driver-cockpit-responsive-polish`

Date: 2026-08-30 · SDD preflight: execution=auto, artifact store=openspec, delivery strategy=ask-on-risk, review budget=400 lines, product decisions=confirmed.

## 1. Problem statement

The driver cockpit (`src/features/delivery-routes/components/cockpit/`) is functionally complete and its reducer/derivation semantics are well tested, but its responsive presentation is wrong. The single existing `UDrawer direction="bottom"` is used on every viewport, which on desktop produces a bottom sheet where the project's established pattern is a **right-side `USlideover`** (`DeliveryRouteUpsertSlideover.vue` uses `USlideover side="right" inset`). Additional composition, gutter, truncation, overlay-header, "Marcar entregada" placement, and safe-area defects appear in the supplied screenshots. The application shell (`DashboardLayout.vue`) also removes the sidebar trigger on mobile via `UDashboardNavbar :toggle="false"`, which is a functional regression.

## 2. Capability map (existing → changed)

### Existing canonical spec inventory
| Spec (openspec/specs) | What it covers | Relationship to this change |
|---|---|---|
| `driver-cockpit-drawer/spec.md` | REQ-DCK-001..008 — one `UDrawer direction="bottom"`, two modes, animation-end synthesis, stop panel, quick actions, close-before-confirm, focus trap, reduced motion | **MODIFIED SCOPE.** Canonical spec currently requires a bottom drawer on all viewports; the confirmed contract requires slideover on desktop, bottom sheet on mobile. |
| `driver-cockpit-shell/spec.md` | REQ-DCS-001..009 — header, operational current/next, spine, four-mode footer, refresh | **MODIFIED SCOPE.** Header placard truncation, footer placement of "Marcar entregada", gutters, safe-area, whitespace. |
| `driver-cockpit-derivation/spec.md` | REQ-DCD-001..008 — pure selector `useDriverRouteCockpit.ts` (current/next/spine/progress/isTerminal) | **PRESERVED** — derivation semantics stay bit-identical. |
| `delivery-route-check-in/spec.md` | REQ-DRC-103..112 — role gate, single `useCheckInStop` mutation, check-in wiring, manager branch preservation, mobile-first a11y | **PRESERVED REDUCER/WIRING RESP.** — responsive polish must not touch reducer phases, mutation ownership, manager branch, or list. |

### Source files inventory (cockpit domain)
| File | Role | Defect(s) observed |
|---|---|---|
| `DriverCockpitDrawer.vue` | Single `UDrawer direction="bottom"` container; stop/history | Uses bottom drawer on all viewports; should be slideover on `lg+` and bottom sheet on mobile. |
| `DriverStopPanel.vue` | Stop-mode body (header, address, map, quick actions, secondary "Marcar entregada") | Owns a second sticky header + a second close button (duplicate header/close controls vs. drawer header). Secondary action lives inline in body on all viewports (should be slideover footer on desktop, prominent bottom on mobile). |
| `DriverRouteCockpit.vue` | Composition surface; reducer; drawer + ConfirmModal | Root `-m-4 sm:-m-6` full-bleed offset exists, but it is not proven to cause the asymmetric gutters. Body `pb-20` is intentional clearance for the sticky footer. |
| `DriverCockpitFooter.vue` | Four-mode sticky footer (current-action / in-progress / terminal / empty) | Gold "Marcar entregada" duplicates the same action that also appears inside the drawer stop panel; placement should differ desktop vs. mobile. Evidence-backed defect: `py-3` combined with `pb-[env(safe-area-inset-bottom)]` can override the ordinary bottom padding with 0 when no safe-area inset exists — later design should use additive/`max()` safe-area padding. The matching body `pb-20` in `DriverRouteCockpit.vue` is intentional footer clearance, not a double-padding defect. |
| `DriverCockpitHeader.vue` | Sticky header (back, identity, status badge, progress, history, refresh) | Controls (history, refresh, progress, badge) wrap into cramped second row on mobile and truncate identity to "Re" on mobile (screenshot 3, 373px). |
| `DriverOperationalStops.vue` | Current card + next card | Owns nested `px-4` inside the parent cockpit body's `px-4 sm:px-6`, while `DriverRouteSpine.vue`'s list adds no nested gutter — the concrete gutter mismatch. |
| `DriverRouteSpine.vue` | Ordered spine list | Premature truncation (`truncate` on extremely narrow containers); needs re-check. |
| `DashboardLayout.vue` | App shell | `UDashboardNavbar :toggle="false"` removes the mobile sidebar toggle entirely — regression. |

## 3. Confirmed product decisions (from orchestrator brief)

1. **Desktop stop details** SHALL use project's established right-side slideover (`USlideover side="right" inset` per canonical precedent), not a bottom drawer.
2. **Mobile** SHALL retain an appropriate bottom sheet (`UDrawer direction="bottom"` preserved for `<lg`).
3. **Mobile sidebar trigger** SHALL be restored (discoverable, accessible); regression root cause identified in `DashboardLayout.vue` (`UDashboardNavbar :toggle="false"`).
4. **"Marcar entregada" placement** SHALL be intentionally composed:
   - Desktop: slideover footer (canonical `USlideover` `#footer` slot pattern used by `DeliveryRouteUpsertSlideover.vue`).
   - Mobile: page footer area, prominent, stable, bottom-aligned (single placement, not both footer AND drawer body).
5. **Responsive boundary** SHALL be `lg` aligned with app shell (Tailwind `lg:` = 1024px, consistent with `UDashboardSidebar` breakpoint behavior).
6. Fix asymmetric gutters, excess whitespace, duplicate overlay headers/close controls, premature truncation, cramped header controls, safe-area/footer padding.

## 4. Screenshot evidence log

| Screenshot | Evidence |
|---|---|
| `/home/aldrich_coder45/Pictures/Screenshots/Screenshot_2026-08-30-02-24-09_4520x2520.png` | **Desktop (1705x1382), bottom drawer open** — cockpit bottom drawer spans the desktop width instead of a right slideover; duplicate drawer title/header "Parada 2 — Cliente Centro" with a secondary X close below the first close (duplicate close controls); full-width gold "Marcar entregada" inside the drawer body duplicating the footer's action; gutter mismatch visible between operational-stops card and spine. |
| `/home/aldrich_coder45/Pictures/Screenshots/Screenshot_2026-08-30-02-25-46_4520x2520.png` | **Desktop page (1294x1239), drawer closed** — footer "Marcar entregada" shown as the single page-level placement; premature spine truncation ("Parada 2 Cliente Cent…"). Not a mobile capture; the missing mobile sidebar toggle is evidenced in screenshot 3. |
| `/home/aldrich_coder45/Pictures/Screenshots/Screenshot_2026-08-30-02-26-56_4520x2520.png` | **Mobile (373x807)** — missing sidebar toggle (`UDashboardNavbar :toggle="false"` regression, see `DashboardLayout.vue`); header identity truncated to "Re"; cramped header controls (history + refresh bunch under progress `1/2`); premature truncation in the spine's second stop; gutter mismatch between the operational-stops card padding and the spine padding. |

## 5. Reusable primitives & precedent

| Reuse / precedent | Source |
|---|---|
| `USlideover side="right" inset` with `#footer` slot | `DeliveryRouteUpsertSlideover.vue` (canonical form overlay precedent). |
| `USlideover` / `UDrawer` selection by breakpoint | Tailwind `lg` boundary; may introduce `useBreakpoint`/`useMediaQuery` composable (`@vueuse/core` available). |
| Focus trap / portal / reduced-motion invariants | Preserved from `DriverCockpitDrawer.vue` (REQ-DCK-001/007/008). |
| Reducer (`reduceCockpit`) phase machine | `DriverRouteCockpit.vue`; untouched except wiring responsive overlay container choice. |
| Confirm-check-in flow | `DriverRouteCockpit` emits `request-confirm` → `ConfirmModal` → `request-check-in(stopId)`, view owns `useCheckInStop`. Preserved. |
| `DeliveryRouteTimeline` for history mode | Direct mount preserved (REQ-DCK-004). |
| Quick actions (map / copy / email) | `driverCockpitQuickActions.ts` + `DriverStopPanel` visibility predicates. Preserved semantics. |

## 6. Proposed component split (design phase will lock)

Following `vue-best-practices` component map:

| Component | Single responsibility | Props / emits contract |
|---|---|---|
| `DriverCockpitOverlay.vue` (replaces `DriverCockpitDrawer.vue` or keeps same name) | One overlay container that chooses `USlideover` (right, inset) on `lg+` vs `UDrawer direction="bottom"` below `lg`; owns title, a single close control, and mode content mapping. | props: `open, mode, route, stop, routeTerminal, canCheckIn, checkInPending`; emits: `update:open`, `closed`, `request-confirm`. **New prop/internal:** viewport-derived `isDesktop` used to choose container. |
| `DriverStopPanel.vue` | Renders stop body ONLY (position/folio/customer/address/map/quick-actions). No internal header, no internal close, no secondary action button. Secondary "Marcar entregada" moves to overlay footer slot. | props: same minus `mapReady` ownership stays; single header removed; emits: `request-confirm`. |
| `DriverCockpitFooter.vue` | Four-mode footer preserved; mobile renders the single prominent bottom action. On `lg+` the action moves to the slideover footer (confirmed placement); the desktop page footer's current-action mode either hides or renders as a non-action surface — that mechanism choice is open, placement is not. | Same props/emits; mode mapping adjusted by viewport-derived flag. |
| `DriverCockpitHeader.vue` | Header controls re-grouped (history + refresh + progress) with safe wrapping; full identity no longer truncates to fragments on mobile. | Unchanged contract. |
| `DashboardLayout.vue` | Restore `UDashboardNavbar` toggle or add `UDashboardSidebarToggle` button visible below `lg`; keep desktop collapse control. | No prop contract change. |
| `useCockpitBreakpoint.ts` (new composable, optional) | Provide `isDesktop` reactive flag reading Tailwind `lg` media query via `@vueuse/core useMediaQuery`. | `() => ComputedRef<boolean>`. |

Reducer machine (`reduceCockpit`) is **not touched**.

## 7. Open questions / unknowns

| # | Question | Impact |
|---|---|---|
| Q1 | Should `DriverStopPanel` secondary "Marcar entregada" be a slot or a prop-driven footer render inside the new overlay container? | Design phase must pick one; spec must codify. |
| Q2 | On `lg+`, does the page footer's 'current-action' mode hide entirely or render as a non-action surface? (Confirmed: desktop action belongs in the slideover footer; mobile action belongs in the page's bottom footer — only the desktop page-footer mechanism is open.) | Mechanism choice to lock in design; no reversal of the confirmed placement. |
| Q3 | How does `UDashboardNavbar` offer a toggle without breaking the current desktop collapse button — prop-driven, slot-driven, or duplicate control? | Design decision on app shell. |
| Q4 | Verification of exact `UDashboardSidebarToggle`/toggle API in installed `@nuxt/ui ^4.6.0` version. | Design/apply confirmation. |
| Q5 | Whether `DashboardLayout` sidebar fix rides in this change or a separate one; brief scopes it here. | Proposal must list modified capability `app-shell` if included. |
| Q6 | Confirm `@vueuse/core useMediaQuery` is acceptable new dependency usage (package already in stack). | Design phase. |

## 8. CASL subjects, sidebar, router touch-points

- **CASL subjects:** none new. Existing `DeliveryRoute` subject unchanged.
- **Router:** no path change; `DeliveryRouteDetailView` route `/rutas-de-entrega/:id` preserved.
- **Sidebar registry:** no navigation change; `DashboardLayout.vue` toggle fix only restores existing sidebar access.
- **Permission matrix:** unchanged (`read:DeliveryRoute`, `update:DeliveryRoute` for check-in, `canCreate/canDelete` manager branch).

## 9. API surface sketch

No new endpoints. Existing: `GET /delivery-routes/:id` (detail observer), `POST /delivery-routes/:id/stops/:stopId/check-in` (existing `useCheckInStop`), unchanged.

## 10. Testing / verification strategy preview

- TDD slices with `pnpm test:unit --run` preset; `vue-tsc --build` type gate per slice; `pnpm build` only at final verify.
- Co-located spec files (`*.test.ts`) next to each modified/added SFC and composable; mount via `src/test/mountWithUApp.ts` for overlay usage.
- New tests must assert: overlay chooses slideover on desktop vs drawer on mobile (breakpoint mock via `useMediaQuery` mock or `window.matchMedia` stub), single close control, footer-vs-slideover action placement per viewport, and unchanged reducer semantics tests continue to pass.

## 11. Out of scope

- Manager branch (manager lifecycle controls/timeline) — bit-equivalent (REQ-DRC-108).
- Route list view — bit-equivalent.
- Reducer phases + `useDriverRouteCockpit` selector semantics — bit-equivalent.
- `CheckIn` mutation contract, permissions, toast copy — unchanged.
- Any new backend endpoint or DTO change.
- Creating `proposal.md`, `design.md`, `tasks.md`, or any source code change.

## 12. Risks / unknowns summary

| Risk | Mitigation |
|---|---|
| `USlideover` vs `UDrawer` API differences breaking animation-end synthesis (`animationEnd(false)` semantics) | Keep `closed` synthesis contract; design phase must verify slideover emits equivalent lifecycle. |
| Viewport flag mixing via CSS classes rather than reactive prop could flicker during resize | Use `@vueuse/core useMediaQuery` for stable flag; threshold set once. |
| `UDashboardNavbar :toggle` prop behavior across Nuxt UI versions | Confirm API before locking design. |
| Removing internal header from `DriverStopPanel` may break existing tests asserting `stop-panel-close` | Update tests as part of modified scope; spec delta notes removal. |
