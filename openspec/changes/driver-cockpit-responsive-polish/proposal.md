# Proposal — `driver-cockpit-responsive-polish`

Make the driver cockpit present correctly on every viewport: right-side slideover on desktop, bottom sheet on mobile, one visible primary check-in action per context, and a restored mobile sidebar trigger — without touching reducer, derivation, check-in, or backend semantics.

## Why

The driver cockpit is functionally complete and its reducer/derivation semantics are well tested, but its responsive presentation is wrong and two defects are user-facing regressions:

1. **Wrong overlay pattern on desktop.** The single `UDrawer direction="bottom"` runs on every viewport, producing a full-width bottom sheet where the project's established pattern is a right `USlideover side="right" inset` (canonical precedent: `DeliveryRouteUpsertSlideover.vue`). Screenshot evidence (1705×1382 desktop) confirms the drawer spans the desktop width.
2. **Broken mobile navigation.** `DashboardLayout.vue` renders `UDashboardNavbar :toggle="false"`, and the only control in the navbar's left slot is `UDashboardSidebarCollapse`, which toggles *collapse* (desktop) — not *open*. On `<lg` viewports the sidebar is unreachable: no trigger exists. Screenshot 3 (373×807) shows no sidebar toggle at all.
3. **Duplicated, miscomposed overlay chrome.** `DriverStopPanel` renders a second sticky header and a second close control inside the drawer's own header — two titles ("Parada 2 — Cliente Centro" twice) and two X buttons in one overlay.
4. **Ambiguous primary action.** "Marcar entregada" appears simultaneously in the page footer *and* inside the drawer body on desktop. The confirmed contract is exactly one primary action for the active viewport/context: slideover footer on `lg+`, page bottom footer on mobile.
5. **Layout defects.** Asymmetric gutters (`DriverOperationalStops` nested `px-4` inside the cockpit body's `px-4 sm:px-6` while `DriverRouteSpine` adds none), header identity truncated to "Re" at 373px with cramped control wrapping, premature spine truncation, and a footer safe-area bug where `py-3` + `pb-[env(safe-area-inset-bottom)]` can collapse ordinary bottom padding to 0 when no inset exists.

These defects make the cockpit — the driver's primary operating surface — confusing and partially unusable on phones, and off-pattern on desktop. The fix is corrective: it preserves all existing feature behavior.

## What Changes

- **Overlay container becomes viewport-adaptive.** On `lg+`, stop detail/history open in a right `USlideover` (`side="right"`, `inset`, `#footer` slot per precedent). Below `lg`, the existing `UDrawer direction="bottom"` is retained. One overlay component owns the choice; the `closed` synthesis contract (from native `animationEnd(false)`) is preserved across both containers.
- **Stop panel loses overlay chrome.** `DriverStopPanel` renders body content only — no internal sticky header, no internal close control, no inline secondary action. The single title/close lives in the overlay header; the secondary "Marcar entregada" moves to the overlay footer (desktop) or the page footer (mobile).
- **Primary action placement is viewport-composed.** Desktop: slideover `#footer`. Mobile: cockpit's bottom page footer, prominent and bottom-aligned. Exactly one primary action is visible per active viewport/context. (The desktop page-footer mechanism — hide vs. non-action surface — is a design-phase decision; the placement is confirmed and not reopenable.)
- **App shell regression fixed.** `DashboardLayout.vue` restores an accessible, discoverable sidebar trigger below `lg` (via `UDashboardNavbar` toggle or an explicit `UDashboardSidebarToggle`, per installed `@nuxt/ui ^4.6.0` API — verified in design phase). Desktop collapse behavior is unchanged.
- **Shell polish.** Header controls re-grouped with safe wrapping and full identity on mobile (no "Re" truncation); unified gutters between operational stops and spine; spine truncation re-checked for narrow widths; footer safe-area padding made additive (`max()`-style) so ordinary padding survives a zero inset; if design confirms it, introduce a deliberate viewport-height composition (`dvh`-based `min-height` with a flex column) so the action region can reliably sit at the bottom — the cockpit does not currently have a proven `dvh` composition to retain, so this is established rather than preserved.
- **Untouched by contract.** `reduceCockpit` phase machine, `useDriverRouteCockpit` derivation, `useCheckInStop` mutation ownership, manager branch, route list, router paths, CASL subjects/permissions, API surface, and backend DTOs.

## Out of Scope

- Manager branch of `DeliveryRouteDetailView` (lifecycle controls, timeline) — bit-equivalent.
- Route list view — bit-equivalent.
- Reducer phases, derivation selector semantics — bit-equivalent.
- Check-in mutation contract, endpoint, permissions, toast copy — unchanged.
- Any new backend endpoint, DTO change, or query key.
- New navigation entries, new routes, or CASL subject registration.
- Redesign of cockpit visual identity (colors, typography) — this change corrects composition, not brand direction.
- Broader app-shell refactor beyond the mobile navigation trigger contract.

## Capabilities

### Modified

- **`driver-cockpit-drawer`** (`openspec/specs/driver-cockpit-drawer/spec.md`)
  - REQ-DCK-001 changes: one overlay container that selects `USlideover` (right, inset) on `lg+` vs `UDrawer direction="bottom"` below `lg`; two modes preserved; `closed` synthesized only from native settled-closed lifecycle in either container.
  - REQ-DCK-002 changes: single titled header with one ≥44px close control owned by the overlay; body scroll containment per container.
  - REQ-DCK-003 changes: `DriverStopPanel` drops its internal header/close/secondary action; secondary action renders in the overlay footer on desktop and is absent from the panel body on all viewports.
  - REQ-DCK-006 preserved: close-before-confirm ordering, single `request-check-in` emission, view-owned mutation.
  - REQ-DCK-004/005/007/008 preserved: direct timeline reuse, exact quick-action predicates, reduced motion, focus trap/restore — applied to whichever container is active.
- **`driver-cockpit-shell`** (`openspec/specs/driver-cockpit-shell/spec.md`)
  - REQ-DCS-002 changes: header control grouping/wrapping and identity truncation rules at 320–373px.
  - REQ-DCS-006 changes: footer primary action placement is viewport-dependent (mobile page footer only; desktop action lives in the slideover footer); safe-area padding becomes additive.
  - New shell requirement(s): unified gutters across `DriverOperationalStops` and `DriverRouteSpine`; spine truncation behavior at narrow widths.
  - REQ-DCS-001/003/004/005/007/008/009/010 preserved.

### New

- **`app-shell-mobile-nav-trigger`** (`openspec/specs/app-shell-mobile-nav-trigger/spec.md`) — narrow capability covering only the application shell's mobile navigation trigger contract: below the sidebar breakpoint (`lg`), `DashboardLayout` SHALL expose a discoverable, accessible (≥44px, labeled) trigger that opens/closes the `UDashboardSidebar`; at `lg+` the existing collapse control remains; no other shell behavior is claimed.

## Approach

1. **Breakpoint source of truth.** A small composable (e.g. `useCockpitBreakpoint.ts`) wrapping `@vueuse/core` `useMediaQuery` at Tailwind's `lg` boundary (1024px, aligned with `UDashboardSidebar` behavior) provides a reactive `isDesktop` flag. Reactive, not CSS-class, switching — avoids overlay flicker during resize. `@vueuse/core` is already in the stack; no new dependency.
2. **One overlay component, one active container.** The overlay component (replacing or renaming `DriverCockpitDrawer.vue`) is the single public cockpit overlay: it keeps the existing props/emits contract (`open`, `mode`, `update:open`, `closed`, `request-confirm`) and conditionally renders exactly one active Nuxt UI container — `USlideover` on desktop or `UDrawer` on mobile — based on `isDesktop`; the inactive container is not mounted. The `closed` synthesis contract is reimplemented per container after verifying `USlideover` lifecycle-event parity in the design phase; mode switch still closes-then-reopens.
3. **Chrome consolidation.** Title and the single close control move to the overlay header in both containers. `DriverStopPanel` sheds its internal header/close/secondary action; tests asserting `stop-panel-close` are updated as part of this modified scope (spec delta notes the removal).
4. **Action placement.** The secondary action renders in the overlay's `#footer` slot on desktop; on mobile it stays in `DriverCockpitFooter`'s existing current-action mode, which becomes inert/non-action on `lg+` per the design-phase mechanism decision. Gating (`canCheckIn`, `checkInPending`, PENDING + non-terminal, route position never gates) is byte-equivalent in both placements.
5. **Shell fix.** `DashboardLayout.vue` restores the mobile trigger using the verified `@nuxt/ui ^4.6.0` API (`UDashboardNavbar` toggle or explicit `UDashboardSidebarToggle` in the navbar left slot); desktop collapse button unchanged.
6. **Polish passes.** Gutters unified (single gutter authority in the cockpit body; `DriverOperationalStops` drops its nested `px-4`); header regrouped with wrap-safe flex and full identity; spine truncation adjusted; footer padding made additive (`max(env(safe-area-inset-bottom), spacing)` pattern).

Preserved invariants throughout: reducer machine, `useDriverRouteCockpit` selector, `request-confirm` → `ConfirmModal` → `request-check-in(stopId)` flow with `DeliveryRouteDetailView` owning the single mutation, close-before-confirm ordering, focus trap/restore, reduced motion, quick-action predicates, manager branch.

## Impact

| Area | Effect |
|---|---|
| `src/features/delivery-routes/components/cockpit/` | `DriverCockpitDrawer.vue` → viewport-adaptive overlay; `DriverStopPanel.vue` loses chrome; `DriverCockpitFooter.vue` viewport-aware action placement + additive safe-area; `DriverCockpitHeader.vue` regrouping; `DriverOperationalStops.vue` / `DriverRouteSpine.vue` gutter + truncation. |
| `src/app/layouts/DashboardLayout.vue` | Restores mobile sidebar trigger; desktop unchanged. |
| Composables | New `useCockpitBreakpoint.ts` (or equivalent) in the cockpit feature folder. |
| Tests | Existing cockpit specs updated where they pin bottom-drawer-on-all-viewports or `stop-panel-close`; new specs for container selection, single close control, action placement per viewport, mobile trigger. |
| Reuse | `USlideover side="right" inset` + `#footer` precedent from `DeliveryRouteUpsertSlideover.vue`; `@vueuse/core useMediaQuery`; `mountWithUApp` test helper; existing quick-action utils, timeline, ConfirmModal flow. |
| CASL / router / sidebar registry / API | No changes. No new subjects, routes, endpoints, or query keys. |

## Risks / Unknowns

| Risk | Mitigation |
|---|---|
| `USlideover` lifecycle events may not mirror `UDrawer`'s `animationEnd(open)` exactly, threatening the `closed` synthesis contract (REQ-DCK-001). | Design phase verifies the installed `@nuxt/ui ^4.6.0` slideover API before locking the contract; if parity is missing, synthesize from the closest settled-closed signal and codify per container in the spec delta. |
| `UDashboardNavbar` toggle API differences across Nuxt UI versions (Q4 in exploration). | Verify against installed package during design; fallback is an explicit `UDashboardSidebarToggle` in the navbar left slot. |
| Removing `DriverStopPanel`'s internal header breaks tests pinning `stop-panel-close`. | Accepted modified scope; tests updated in the same slice; spec delta documents the removal. |
| Overlay flicker or state loss on viewport resize crossing `lg`. | Reactive `useMediaQuery` flag with a single threshold; mode state lives in the cockpit (not the container), so container swap preserves mode; resize behavior covered by triangulate tests. |
| Footer mechanism on desktop (hide vs. non-action surface) is open (Q2). | Design phase locks the mechanism; placement is confirmed and cannot be reopened. |
| Safe-area `max()` pattern support in the Tailwind v4 setup. | Trivial CSS; verify in slice tests; fallback to `calc()` with explicit padding constant. |

## First Slice Scope

**Slice 1: app-shell mobile navigation trigger restore** — the bounded, independently testable foundation.

- RED: a failing test asserting `DashboardLayout.vue` renders an accessible sidebar trigger reachable below `lg` (toggle present/enabled; existing desktop collapse assertions still pass).
- GREEN: minimal `DashboardLayout.vue` change enabling the trigger (verified Nuxt UI API).
- TRIANGULATE: desktop collapse control unchanged; trigger labeled (aria); no effect on cockpit or other views.
- REFACTOR: tidy navbar slot composition.

Rationale: it is a genuine user-facing regression, is one implementation surface plus its existing co-located test surface (`src/app/layouts/DashboardLayout.vue` and `src/app/layouts/__tests__/DashboardLayout.test.ts`), carries no dependency on cockpit work, validates the test harness around the app shell, and de-risks the design phase's Nuxt UI API verification. Cockpit overlay/shell slices follow after design locks the container and action-placement contracts.

## Rollback Plan

Rollback is capability-scoped, matching the three capability deltas:

- **`app-shell-mobile-nav-trigger`**: revert the single `DashboardLayout.vue` slice commit; shell returns to prior state with no cockpit coupling.
- **`driver-cockpit-drawer`**: revert the overlay-container slices; `DriverCockpitDrawer.vue` returns to unconditional bottom drawer with its prior single-container `closed` synthesis. Stop-panel chrome restoration rides in the same revert.
- **`driver-cockpit-shell`**: revert the header/gutter/footer/safe-area slices independently; action placement and composition return to prior behavior.

No data, API, or schema changes exist, so any revert is purely a source-tree operation. Slices are sequenced so each is its own commit; partial rollback (e.g. keep the shell fix, revert the overlay swap) is always available.

## Success Criteria

- [ ] On `lg+`, opening stop detail or history shows a right-side `USlideover` (`side="right"`, inset) matching the `DeliveryRouteUpsertSlideover` precedent; below `lg`, the bottom `UDrawer` remains.
- [ ] Exactly one primary "Marcar entregada" action is visible for the active viewport/context: slideover footer on desktop, page bottom footer on mobile — never both, never inline in the stop panel body.
- [ ] Each open overlay has exactly one title and one close control; no duplicate header chrome.
- [ ] On mobile (<1024px), the application shell exposes an accessible sidebar trigger that opens the sidebar; desktop collapse behavior is unchanged.
- [ ] Header identity no longer truncates to fragments at 373px; controls wrap without horizontal scroll at 320px.
- [ ] Operational-stops and spine share consistent gutters; spine truncation no longer fires prematurely.
- [ ] Footer bottom padding survives a zero safe-area inset (additive padding).
- [ ] `pnpm test:unit --run` green; reducer/derivation/check-in tests pass unchanged; `vue-tsc --build` clean.
- [ ] All preserved contracts verified: manager branch, route list, permissions, API, close-before-confirm, focus trap, reduced motion, quick-action predicates.
