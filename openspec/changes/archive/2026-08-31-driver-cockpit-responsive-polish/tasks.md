# Tasks — `driver-cockpit-responsive-polish`

Scope: corrective responsive composition for the driver cockpit and the application-shell mobile navigation regression. Reducer/derivation/check-in wiring, manager branch, route list, CASL, router, sidebar registry, API, query keys, and DTOs are preserved verbatim.

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines (all-inclusive, recovered 5-slice plan) | ~930 (S1 actual 168; S2 partial measured ~505 before evidence compression; S3/S4 forecast ~265) |
| 400-line budget risk | High (total review scope exceeds 400 even though each slice is bounded) |
| Per-slice 600-line hard cap | Within budget on every slice (worst slice ≈ 225 lines) |
| Chained PRs recommended | Yes |
| Suggested grouping | Four review units (B1, B2, B3, B4), each < 400 changed lines, preserving five atomic slice commits |
| B1 — Shell trigger + breakpoint foundation | S1 + S2a ≈ 335 lines all-inclusive |
| B2 — Adaptive overlay lifecycle/container | S2b ≈ 370 lines all-inclusive |
| B3 — Stop-panel chrome + action composition | S3 actual 298 lines all-inclusive |
| B4 — Viewport polish | S4 forecast ≈ 110 lines all-inclusive |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain (user selected) |

Per-slice all-inclusive forecast (implementation + co-located tests + progress/artifact edits):

| Slice | Files touched | Forecast (all-inclusive) | 400 risk | 600 cap |
|-------|---------------|--------------------------|----------|---------|
| S1 — App-shell mobile sidebar trigger | `src/app/layouts/DashboardLayout.vue`, `src/app/layouts/__tests__/DashboardLayout.test.ts` | ~50 lines | Low | OK |
| S2a — Parent-owned breakpoint foundation | NEW `useCockpitBreakpoint.ts` + spec; MOD `DriverRouteCockpit.vue` + spec; minimal required `isDesktop` prop declaration in `DriverCockpitDrawer.vue` | ~165 lines | Low | OK |
| S2b — Adaptive overlay lifecycle/container | MOD `DriverCockpitDrawer.vue` + spec only; uses required parent prop and distinct native lifecycle adapters | ~370 lines | Medium | OK |
| S3 — Stop-panel chrome removal + single-action composition | MOD `DriverStopPanel.vue` + spec (props `{ stop, mapReady }`, no emits); MOD `DriverCockpitDrawer.vue` + spec (slideover `#footer` slot); MOD `DriverCockpitFooter.vue` + spec (REQUIRED `isDesktop` prop, gate current-action on `!isDesktop`); MOD `DriverRouteCockpit.vue` + spec | ~155 lines | Low | OK |
| S4 — Header / gutter / spine / safe-area / viewport polish | MOD `DriverCockpitHeader.vue` + spec (no destructive truncate removal); MOD `DriverOperationalStops.vue` + spec; MOD `DriverRouteSpine.vue` + spec (preserve existing `min-w-0 flex-1 truncate` overflow safety); MOD `DriverCockpitFooter.vue` + spec (additive safe-area); MOD `DriverRouteCockpit.vue` (containing-panel-aware viewport composition — NEVER raw `min-h-[100dvh]`) | ~110 lines | Low | OK |

No slice exceeds 600 changed lines. Recovery evidence split the underestimated S2 into S2a (~165) and S2b (~370). After S3 settled at 298 changed lines, its B3 branch retained only 102 lines under the 400-line review budget, less than S4's ~110-line forecast. The user therefore authorized a fourth review unit: B1 = S1+S2a, B2 = S2b, B3 = S3, B4 = S4. The `feature-branch-chain` strategy remains; no size exception applies. S4 additionally requires manual screenshot verification at 373×807 and a desktop viewport (≥1024px) for the containing-panel-aware viewport composition (no jsdom pixel assertions).

```text
Decision needed before apply: No (resolved: split selected)
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

---

## Work Units

| # | Goal | Files (NEW + MOD) | Strict-TDD verify command | Runtime path | Rollback |
|---|------|-------------------|---------------------------|--------------|----------|
| S1 | Restore an accessible mobile sidebar trigger below `lg` in `DashboardLayout.vue`; preserve desktop collapse. | MOD `src/app/layouts/DashboardLayout.vue`; MOD `src/app/layouts/__tests__/DashboardLayout.test.ts` | `pnpm test:unit --run src/app/layouts/__tests__/DashboardLayout.test.ts` | Manual: open any view in a <1024px window, tap navbar trigger, sidebar opens. | Revert one commit (`DashboardLayout.vue` + its test) — shell returns to pre-change state with no cockpit coupling. |
| S2a | Land the single parent-owned breakpoint foundation: composable + focused spec + root wiring/route spec + minimal required drawer prop. No adaptive template/lifecycle commit yet. | NEW breakpoint composable/spec; MOD root/spec; minimal MOD drawer prop | focused composable + route tests | Manual: root supplies desktop/mobile boolean deterministically. | Revert S2a commit only. |
| S2b | Complete adaptive `USlideover`/`UDrawer` container and lifecycle behavior using the required parent prop; no breakpoint import in drawer. | MOD drawer + drawer spec only | focused drawer + route + composable tests | Manual: one active container across breakpoint, settled lifecycle correct. | Revert S2b commit only; S2a foundation remains. | | NEW `src/features/delivery-routes/composables/cockpit/useCockpitBreakpoint.ts`; NEW `src/features/delivery-routes/composables/cockpit/__tests__/useCockpitBreakpoint.spec.ts`; MOD `src/features/delivery-routes/components/cockpit/DriverCockpitDrawer.vue` (REQUIRED `isDesktop` prop, NO `useCockpitBreakpoint` import); MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitDrawer.spec.ts` (USlideover/UDrawer stubs, lifecycle assertions, breakpoint swap); MOD `src/features/delivery-routes/components/cockpit/DriverRouteCockpit.vue` (owns the SINGLE `useCockpitBreakpoint()` call; passes `:is-desktop` to drawer + footer); MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverRouteCockpit.spec.ts` (extend DrawerStub/FooterStub to accept `isDesktop`, assert single source) | `pnpm test:unit --run src/features/delivery-routes/composables/cockpit/__tests__/useCockpitBreakpoint.spec.ts src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitDrawer.spec.ts src/features/delivery-routes/components/cockpit/__tests__/DriverRouteCockpit.spec.ts` | Manual: open stop detail on a desktop viewport → right slideover; open on a mobile viewport → bottom drawer. Resize across 1024px: one active container, no duplicate portal. | Revert one commit touching only the files listed above — overlay returns to unconditional bottom drawer; `useCockpitBreakpoint` disappears; `isDesktop` prop vanishes. Reducer, derivation, check-in contracts unchanged. |
| S3 | Remove `DriverStopPanel`'s internal header/close/secondary action (props reduce to `{ stop, mapReady }`, no emits); route the single delivery action through the overlay's `#footer` slot on desktop and through the cockpit's bottom page footer on mobile. `DriverCockpitFooter` gains a REQUIRED `isDesktop` prop (wired from S2's single source) and gates `current-action` on `!isDesktop` while preserving `terminal` / `in-progress` / `empty` rendering. | MOD `src/features/delivery-routes/components/cockpit/DriverStopPanel.vue` (drop header/close/secondary; props `{ stop, mapReady }`; no emits); MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverStopPanel.spec.ts` (absence assertions); MOD `src/features/delivery-routes/components/cockpit/DriverCockpitDrawer.vue` (slideover `#footer` slot with gated action); MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitDrawer.spec.ts` (overlay footer-action describe); MOD `src/features/delivery-routes/components/cockpit/DriverCockpitFooter.vue` (REQUIRED `isDesktop` prop, gate current-action on `!isDesktop`); MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitFooter.spec.ts` (viewport-composed describe); MOD `src/features/delivery-routes/components/cockpit/DriverRouteCockpit.vue` (passes `:is-desktop` to footer from the same source); MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverRouteCockpit.spec.ts` (extend FooterStub `isDesktop`, suppression triangulation) | `pnpm test:unit --run src/features/delivery-routes/components/cockpit/__tests__/DriverStopPanel.spec.ts src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitFooter.spec.ts src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitDrawer.spec.ts src/features/delivery-routes/components/cockpit/__tests__/DriverRouteCockpit.spec.ts` | Manual: on mobile, tap `Marcar entregada` in page footer only; on desktop, open stop slideover and tap `Marcar entregada` in slideover footer only — never both, never in panel body. | Revert one commit — `DriverStopPanel` regains its internal chrome (intentional spec-delta replacement); overlay `#footer` slot removed; footer `isDesktop` prop removed. S2's adaptive container + single breakpoint authority preserved. |
| S4 | Polish header regrouping for 320–373px (preserve existing overflow-safe `truncate` on header identity AND spine customer span; NO destructive `truncate` removal); unify cockpit body gutter authority (drop nested `px-4` from `DriverOperationalStops`); keep spine truncation firing only at actual overflow; switch footer padding to additive `pb-[calc(0.75rem+env(safe-area-inset-bottom))]` + `pt-3`; apply a CONTAINING-PANEL-AWARE viewport composition (`h-full min-h-0` chain OR navbar-offset `calc`) — NEVER raw `min-h-[100dvh]` which can create vertical overshoot below the global navbar. Footer remains non-fixed (sticky) and bottom-aligned. | MOD `src/features/delivery-routes/components/cockpit/DriverCockpitHeader.vue` (narrow-width regrouping only if tests reveal overflow; preserve existing `truncate`); MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitHeader.spec.ts` (DOM/content/a11y contract pins — NOT pixel measurements); MOD `src/features/delivery-routes/components/cockpit/DriverOperationalStops.vue` (drop nested `px-4`); MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverOperationalStops.spec.ts` (body-gutter describe); MOD `src/features/delivery-routes/components/cockpit/DriverRouteSpine.vue` (NO source change unless tests reveal a real defect; preserve `min-w-0 flex-1 truncate` overflow safety); MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverRouteSpine.spec.ts` (meaningful DOM/content/a11y contract pins — NOT jsdom pixel assertions); MOD `src/features/delivery-routes/components/cockpit/DriverCockpitFooter.vue` (additive `pb-[calc(0.75rem+env(safe-area-inset-bottom))]`; `py-3` → `pt-3`); MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitFooter.spec.ts` (safe-area regex update); MOD `src/features/delivery-routes/components/cockpit/DriverRouteCockpit.vue` (containing-panel-aware viewport composition — `h-full min-h-0` chain OR navbar-offset `calc`; NO raw `min-h-[100dvh]`) | `pnpm test:unit --run src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitHeader.spec.ts src/features/delivery-routes/components/cockpit/__tests__/DriverOperationalStops.spec.ts src/features/delivery-routes/components/cockpit/__tests__/DriverRouteSpine.spec.ts src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitFooter.spec.ts src/features/delivery-routes/components/cockpit/__tests__/DriverRouteCockpit.spec.ts` | **Manual screenshot verification (REQUIRED):** at 373×807 (mobile) AND a desktop viewport (≥1024px), capture the cockpit and verify (a) header identity readable (no `Re`-style fragment), (b) no horizontal page scroll, (c) footer action bottom-aligned with safe-area padding, (d) no vertical overshoot below the global navbar, (e) spine status label + position + customer all render without premature truncation. | Revert one commit — layout polish undone; functionality from S1/S2/S3 preserved. |

Final full gates (after every slice merged, run once at the end):

```bash
pnpm test:unit --run
pnpm build      # includes vue-tsc --build + vite build
pnpm lint
```

---

## ASCII Dependency Graph

```
                 ┌──────────────────────────────────────────────┐
                 │ Slice 1 — App-shell mobile sidebar trigger   │
                 │   DashboardLayout.vue + its co-located test  │
                 └────────────────────────────┬─────────────────┘
                                              │
                                              │ (independent — no
                                              │  cockpit coupling)
                                              ▼
              ┌───────────────────────────────────────────────────────┐
              │ Slice 2 — Breakpoint authority + adaptive overlay     │
              │   NEW useCockpitBreakpoint.ts                          │
              │   MOD DriverCockpitDrawer.vue + its spec               │
              │   MOD DriverRouteCockpit.vue (pass isDesktop) + spec   │
              └─────────────────────────┬─────────────────────────────┘
                                        │
                                        │ (depends on the breakpoint
                                        │  composable from S2)
                                        ▼
                ┌─────────────────────────────────────────────────────┐
                │ Slice 3 — Stop-panel chrome + single-action place  │
                │   MOD DriverStopPanel.vue + spec                    │
                │   MOD DriverCockpitDrawer.vue (overlay #footer)    │
                │   MOD DriverCockpitFooter.vue (desktop suppression) │
                │   + their co-located specs                         │
                └─────────────────────────┬───────────────────────────┘
                                          │
                                          │ (depends on S2's overlay
                                          │  + S3's chrome removal)
                                          ▼
                    ┌─────────────────────────────────────────────────┐
                    │ Slice 4 — Layout polish (header / gutter /     │
                    │   spine / safe-area / available height)                      │
                    │   MOD Header / Operational / Spine / Footer /  │
                    │     Cockpit SFCs + their co-located specs       │
                    └─────────────────────────┬───────────────────────┘
                                              │
                                              ▼
                              ┌─────────────────────────────────┐
                              │ Final full gates:               │
                              │   pnpm test:unit --run          │
                              │   pnpm build (vue-tsc + vite)   │
                              │   pnpm lint                     │
                              └─────────────────────────────────┘
```

S1 is intentionally isolated: it de-risks the Nuxt UI shell trigger without touching the cockpit. S2 establishes the breakpoint authority and container selection that S3 and S4 rely on. S3 and S4 are sequenced so chrome/footer placement lands before polish so the polish tests do not silently relax the placement contract.

---

## Implementation Order

1. **Slice 1 — App-shell mobile sidebar trigger** (independent foundation).
2. **Slice 2a — Parent-owned breakpoint foundation** (lands the single authority without the high-churn overlay rewrite).
3. **Slice 2b — Adaptive overlay container/lifecycle** (depends on S2a and completes the drawer/slideover behavior).
4. **Slice 3 — Stop-panel chrome removal + single-action composition** (depends on the slideover from S2; updates tests whose old all-drawer / panel-close assumptions are deliberately changed).
5. **Slice 4 — Header/gutter/spine/footer/safe-area polish** (depends on S2 + S3; visual-only polish layered on the now-correct composition).
6. **Final full gates** after Slice 4 lands.

Resolved delivery topology:

```text
tracker: feat/driver-cockpit-responsive-polish (from main)
B1: feat/driver-cockpit-responsive-polish-b1-shell-overlay (S1 + S2a; targets tracker)
B2: feat/driver-cockpit-responsive-polish-b2-adaptive-overlay (S2b; targets B1)
B3: feat/driver-cockpit-responsive-polish-b3-action-polish (S3; targets B2)
B4: feat/driver-cockpit-responsive-polish-b4-viewport-polish (S4; targets B3)
Only the tracker branch ultimately integrates to main.
```

Implementation checklist consumed by native SDD status/apply:

- [x] S1 — Restore the app-shell mobile sidebar trigger with focused tests green.
- [x] S2a — Land the single parent-owned breakpoint foundation and root wiring with focused tests green.
- [x] S2b — Complete the adaptive overlay container/lifecycle using the required parent prop with focused tests green.
- [x] S3 — Remove duplicate stop-panel chrome and compose exactly one viewport-specific delivery action with focused tests green.
- [x] S4 — Complete evidence-backed responsive header/gutter/spine/footer/available-height polish, including required viewport screenshots, with focused tests green.
- [x] Final gates — `pnpm test:unit --run` (5,789/5,789 across 364 files) and `pnpm build` (vue-tsc + vite) pass; lint baseline exception accepted (S4 delta clean, remaining failures pre-existing).

---

## Per-slice details

Strict TDD discipline applies to every slice. Each slice is its own commit, with the commit message listed verbatim below.

### Slice 1 — App-shell mobile sidebar trigger (independent foundation)

**Scope (single capability: `app-shell-mobile-nav-trigger`; REQ ASNT-001 / 002 / 003):**

- The installed `UDashboardNavbar` accepts a `toggle` prop. Setting it to `true` (i.e. removing `:toggle="false"`) restores the native leading `UDashboardSidebarToggle` rendered by the navbar. The existing `UDashboardSidebarCollapse` in the navbar `#left` slot stays in place for `lg+` desktop behavior; it is NOT repurposed.
- No other `DashboardLayout.vue` change. No router, no API, no permission, no shell style change. No CASL subject registration.

**TDD Steps:**

1. **RED** — `src/app/layouts/__tests__/DashboardLayout.test.ts`:
   - Add a new `describe('DashboardLayout — mobile sidebar trigger (ASNT-REQ-001/002)', () => { ... })` block. Stub `UDashboardNavbar` so the wrapper exposes a `toggle` prop in a test-visible attribute. Pin:
     - `UDashboardNavbar :toggle` is NOT `false` (i.e. the literal `:toggle="false"` no longer appears in the SFC).
     - A native `UDashboardSidebarToggle` is exposed by the navbar stub at <1024px.
     - The `UDashboardSidebarCollapse` (desktop) remains present in the SFC source (do NOT remove).
   - `pnpm test:unit --run src/app/layouts/__tests__/DashboardLayout.test.ts` reports `>=1` failure in the new `describe`.
2. **GREEN** — `src/app/layouts/DashboardLayout.vue`:
   - Remove `:toggle="false"` from `UDashboardNavbar`. Keep all other slots unchanged.
   - Re-run the gate; the new tests pass; the existing `DSC-REQ-*` source assertions still pass (no `:ui` block removed).
3. **TRIANGULATE** — within the same new `describe`:
   - At `>=1024px`, the desktop collapse control is still emitted (source scan: `UDashboardSidebarCollapse` block still present).
   - No route/permission/HTTP side effect on activate: the wrapper renders without router navigation; no axios mock touched.
4. **REFACTOR** — no follow-up needed; the change is one-line.

**Files (NEW + MOD):**

- MOD `src/app/layouts/DashboardLayout.vue` (one-line prop removal + comment on intent; ~+3/-2 lines).
- MOD `src/app/layouts/__tests__/DashboardLayout.test.ts` (new `describe` block; ~+40 lines).

**Verify block:**

```bash
pnpm test:unit --run src/app/layouts/__tests__/DashboardLayout.test.ts
```

Expect: every test green, including the new `ASNT-REQ-001/002` describe and the pre-existing `DSC-REQ-013` suite.

**Rollback boundary:**

Revert one commit touching only `DashboardLayout.vue` and `DashboardLayout.test.ts`. Shell returns to pre-change state (`UDashboardNavbar :toggle="false"`). No other file affected; no cockpit coupling.

**Commit message:**

```
feat(shell): restore mobile sidebar trigger below lg (ASNT-REQ-001/002)

Remove `:toggle="false"` from UDashboardNavbar so the installed
@nuxt/ui native UDashboardSidebarToggle returns to the navbar
leading slot on viewports <lg. Desktop collapse (UDashboardSidebarCollapse)
remains unchanged. No router / permission / API / shell-style changes.

Capability: app-shell-mobile-nav-trigger
Spec:        openspec/changes/driver-cockpit-responsive-polish/specs/app-shell-mobile-nav-trigger/spec.md
Verify:      pnpm test:unit --run src/app/layouts/__tests__/DashboardLayout.test.ts
```

---

### Slice 2a — Parent-owned breakpoint foundation (recovery split)

**Scope:** land only the single breakpoint authority and parent wiring while preserving green behavior. This slice is extracted from the reusable interrupted S2 work.

**TDD / files:**

1. RED/GREEN `useCockpitBreakpoint.spec.ts` + `useCockpitBreakpoint.ts`: one reactive `useMediaQuery('(min-width: 1024px)')` threshold.
2. RED/GREEN `DriverRouteCockpit.spec.ts` + `DriverRouteCockpit.vue`: the root calls the composable exactly once and passes required `isDesktop` to the overlay stub; reducer tests remain unchanged.
3. Add only the minimal required `isDesktop: boolean` prop declaration to `DriverCockpitDrawer.vue`; do not land adaptive template/lifecycle changes in S2a. Existing drawer behavior remains mobile/bottom-drawer behavior.
4. TRIANGULATE desktop/mobile composable flips and required prop wiring. REFACTOR generated declarations away.

**Allowed commit surfaces:** breakpoint composable/spec, root/spec, and the minimal drawer prop hunk. Mark only S2a complete and append <=30 concise evidence lines.

**Verify:**

```bash
pnpm test:unit --run src/features/delivery-routes/composables/cockpit/__tests__/useCockpitBreakpoint.spec.ts \
                 src/features/delivery-routes/components/cockpit/__tests__/DriverRouteCockpit.spec.ts \
                 src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitDrawer.spec.ts
```

**Commit:** `feat(cockpit): add parent-owned responsive breakpoint foundation (REQ-DCK-009)`

---

### Slice 2b — Adaptive overlay container and lifecycle (recovery split)

**Scope:** using S2a's required `isDesktop` prop, complete the one-active-container overlay: desktop `USlideover side="right" inset`, mobile `UDrawer direction="bottom"`; drawer `animationEnd(true/false)`, slideover `@after:enter`/`@after:leave`; no breakpoint composable import inside the drawer. Preserve open/mode/selected-stop and reducer behavior.

**TDD / files:**

1. RED/GREEN/TRIANGULATE only `DriverCockpitDrawer.spec.ts` and `DriverCockpitDrawer.vue` for container selection, map readiness, exactly-once settled close, direct open-state swap without `closed`, close-in-flight freeze, reduced motion, and no duplicate portal.
2. Re-run S2a composable/root tests as preservation gates; do not edit them in S2b unless a proven integration failure requires it.
3. Keep S2b all-inclusive <=390 lines by compressing duplicated test setup and apply-progress evidence without weakening behavior. Restore `components.d.ts`.
4. Mark only S2b complete after focused green.

**Verify:** same focused three-file command as S2a.

**Commit:** `feat(cockpit): adapt overlay container lifecycle to viewport (REQ-DCK-001/009)`

---

### Slice 3 — Stop-panel chrome removal + single-action composition

**Scope (capabilities: `driver-cockpit-drawer` REQ-DCK-002 / 003; `driver-cockpit-shell` REQ-DCS-006):**

- `DriverStopPanel.vue` minimal contract: `{ stop, mapReady }`, no emits. The internal sticky header, internal close button, and inline secondary `Marcar entregada` action are removed. Body content only: position/folio, customer fallback, formatted address, map (gated on `mapReady` + finite coords), quick actions. Address DOM-precedes map; map omitted when coords missing or non-finite; tile failure hides map with no toast; (0, 0) coords are a legal pin.
- The overlay's `#footer` slot renders the gated `Marcar entregada` action on desktop (inside the `USlideover`). On mobile the action lives in `DriverCockpitFooter`'s `current-action` mode (no change to the four-mode reducer). `DriverCockpitFooter` receives the same required `isDesktop` value owned by `DriverRouteCockpit` and hides only the primary `current-action` button on desktop while preserving `terminal` / `in-progress` / `empty` rendering.
- Gating is byte-equivalent across viewports: visible only when `stop.status === 'PENDING'` AND `!routeTerminal` AND `canCheckIn`; disabled while `checkInPending`; emits `request-confirm({ stopId, trigger })` exactly once; route position never gates; read-only drivers see no action.
- This slice deliberately updates the existing `DriverStopPanel.spec.ts` assertions for `stop-panel-close` and `stop-panel-secondary-action` to assert their ABSENCE (per the spec delta REQ-DCK-003, the chrome is removed by design). The replacement tests pin the new contract: panel body has no delivery action, no close control; only body content is rendered. This is a deliberate expectation replacement, not weakening — the existing assertions would now false-positive on the new contract and are retired in favor of stricter absence assertions.

**TDD Steps:**

1. **RED** — `src/features/delivery-routes/components/cockpit/__tests__/DriverStopPanel.spec.ts`:
   - In the existing `describe('DriverStopPanel — header surface (REQ-DCK-003)', ...)`, replace the `close emits []` and `aria-label` assertions with: "panel body contains NO element matching `[data-testid='stop-panel-close']`" and "panel body contains NO element matching `[data-testid='stop-panel-header']`". The new tests fail because the old SFC still renders them.
   - In the existing `describe('DriverStopPanel — secondary delivery action ...', ...)`, replace the visibility/emit assertions with: "panel body contains NO element matching `[data-testid='stop-panel-secondary-action']`" across the four gating combinations (PENDING+canCheckIn, COMPLETED, SKIPPED, IN_PROGRESS, terminal, read-only). The new tests fail.
2. **GREEN** — `src/features/delivery-routes/components/cockpit/DriverStopPanel.vue`:
   - Change `defineProps` to `{ stop: DeliveryRouteStop; mapReady: boolean }`.
   - Drop `defineEmits`. Drop `onClose` and `onSecondary`. Drop the `<header data-testid="stop-panel-header">` block and the `<button data-testid="stop-panel-close">` button. Drop the `<button data-testid="stop-panel-secondary-action">` button.
   - Keep: address → map → quick-actions. Keep `secondaryActionVisible` predicate (or move it out entirely; cleanest is to remove from this component since the overlay owns it).
   - Re-run: new absence assertions pass; old positive assertions removed.
3. **RED** — `src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitDrawer.spec.ts`:
   - In the new `describe` from Slice 2 (or a fresh `describe('DriverCockpitDrawer — overlay footer slot action (REQ-DCK-003)', ...)`), pin:
     - On desktop slideover (stop mode, PENDING + canCheckIn + !checkInPending): a button with `[data-testid="overlay-footer-action"]` exists in the slideover's `#footer` slot, is enabled, and clicking emits `request-confirm` once with `{ stopId, trigger }`.
     - On mobile drawer (stop mode, same gating): NO `[data-testid="overlay-footer-action"]` exists in the drawer (the action lives in the page footer per `driver-cockpit-shell` REQ-DCS-006).
     - On either container, `checkInPending=true` disables the action; repeated clicks emit nothing.
     - `routeTerminal=true` / `canCheckIn=false` / non-PENDING status → no overlay footer action regardless of viewport.
   - These fail until the overlay's `#footer` slot is wired.
4. **GREEN** — `src/features/delivery-routes/components/cockpit/DriverCockpitDrawer.vue`:
   - Add `<template #footer>` only inside the desktop slideover branch (`v-if="isDesktop"`). The slot renders a `<button data-testid="overlay-footer-action">` gated by `secondaryActionVisible = computed(() => mode === 'stop' && stop?.status === 'PENDING' && !routeTerminal && canCheckIn)`. Click emits `request-confirm({ stopId: stop.id, trigger })`. Disabled while `checkInPending`. The mobile drawer branch keeps the current body-only template (no `#footer` slot).
   - Re-run: slideover footer assertions pass; mobile drawer assertions (no footer action) pass; pre-existing tests still pass.
5. **RED** — `src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitFooter.spec.ts`:
   - Add `describe('DriverCockpitFooter — viewport-composed action placement (REQ-DCS-006)', ...)` pinning:
     - With required `isDesktop=true` and `mode === 'current-action'`, the footer root contains NO `[data-testid="cockpit-footer-action"]` element.
     - With `isDesktop=true`, terminal and in-progress modes remain unchanged, and empty mode remains empty.
     - With required `isDesktop=false` and `mode === 'current-action'`, the footer renders `[data-testid="cockpit-footer-action"]`.
   - These fail because required `isDesktop` is not yet part of the footer contract.
6. **GREEN** — `src/features/delivery-routes/components/cockpit/DriverCockpitFooter.vue`:
   - Add required `isDesktop: boolean` to `defineProps` with no fallback/default.
   - In the `mode === 'current-action'` branch, gate the action button on `!props.isDesktop`.
   - Do not change safe-area classes in this slice; additive padding belongs to S4.
   - Re-run: viewport-composed assertions pass; existing mutual-exclusivity and token assertions remain green.
7. **TRIANGULATE** — `src/features/delivery-routes/components/cockpit/__tests__/DriverRouteCockpit.spec.ts`:
   - Extend `FooterStub` with required `isDesktop`; assert the same parent-owned breakpoint value reaches both footer and overlay stubs.
   - Pin `isDesktop=true` suppresses only the page primary action and `isDesktop=false` preserves it.
   - Pin the overlay's `request-confirm` continues to drive the reducer into `CLOSING_TO_CONFIRM` regardless of viewport; the reducer transition table remains unchanged.
8. **REFACTOR** — confirm no SFC imports server-state, mutation, router, or HTTP; confirm `DriverStopPanel.vue` source contains no `<button data-testid="stop-panel-secondary"` and no `<button data-testid="stop-panel-close"`. Tighten any duplication between the overlay's footer button and the cockpit's footer button (shared `Marcar entregada` label comes from `DELIVERY_ROUTE_COPY`).

**Files (NEW + MOD):**

- MOD `src/features/delivery-routes/components/cockpit/DriverStopPanel.vue` (drop header, close, secondary action; reduce props to `{ stop, mapReady }`; remove emits; ~-35/+3 lines).
- MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverStopPanel.spec.ts` (replace header/close/secondary assertions with absence assertions; remove now-irrelevant gating tests; ~-40/+35 lines).
- MOD `src/features/delivery-routes/components/cockpit/DriverCockpitDrawer.vue` (slideover `#footer` slot with gated action; ~+25/-2 lines).
- MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitDrawer.spec.ts` (new overlay-footer-action describe; ~+30/-5 lines).
- MOD `src/features/delivery-routes/components/cockpit/DriverCockpitFooter.vue` (required `isDesktop` prop gates only the current-action button; ~+6/-2 lines).
- MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitFooter.spec.ts` (new viewport-composed describe with explicit desktop/mobile props; ~+28 lines).
- MOD `src/features/delivery-routes/components/cockpit/DriverRouteCockpit.vue` (pass the existing parent-owned `isDesktop` value to the footer; ~+2 lines).
- MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverRouteCockpit.spec.ts` (extend `FooterStub` + `DrawerStub` required props; assert one shared breakpoint value; ~+22/-3 lines).

**Verify block:**

```bash
pnpm test:unit --run src/features/delivery-routes/components/cockpit/__tests__/DriverStopPanel.spec.ts \
                 src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitFooter.spec.ts \
                 src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitDrawer.spec.ts \
                 src/features/delivery-routes/components/cockpit/__tests__/DriverRouteCockpit.spec.ts
```

Expect: every test green; `DriverStopPanel` source contains no internal header/close/secondary action; footer suppression works on desktop, not on mobile; slideover footer action gated byte-equivalently with the prior contract.

**Rollback boundary:**

Revert one commit touching only the files listed above. `DriverStopPanel` regains its internal chrome (deliberate spec-delta replacement), overlay `#footer` slot is removed, footer desktop suppression is removed. S2's adaptive container, S1's shell trigger, reducer/derivation/check-in contracts all preserved.

**Commit message:**

```
feat(cockpit): drop stop-panel chrome; compose single delivery action (REQ-DCK-002/003, REQ-DCS-006)

DriverStopPanel now renders body content only with minimal props { stop, mapReady }
and no emits. The single delivery entry point renders in the slideover footer
on desktop and in the cockpit's bottom page footer on mobile. DriverCockpitFooter
receives the parent-owned required `isDesktop` value and hides the
current-action button at lg+ while preserving terminal/in-progress/empty
modes. Overlay owns action gating/emission; stop panel does not. Reducer
phases, derivation, check-in wiring, and manager branch unchanged.

Capabilities: driver-cockpit-drawer, driver-cockpit-shell
Specs:        openspec/changes/driver-cockpit-responsive-polish/specs/driver-cockpit-drawer/spec.md
              openspec/changes/driver-cockpit-responsive-polish/specs/driver-cockpit-shell/spec.md
Verify:       pnpm test:unit --run src/features/delivery-routes/components/cockpit/__tests__/DriverStopPanel.spec.ts \
                                  src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitFooter.spec.ts \
                                  src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitDrawer.spec.ts
```

---

### Slice 4 — Header / gutter / spine / footer safe-area / viewport polish

**Scope (capabilities: `driver-cockpit-shell` REQ-DCS-002 / 006 / 011 / 012):**

- `DriverCockpitHeader.vue`: regroup identity and controls only as required to keep the full accessible identity available, preserve ≥44×44 controls, and avoid horizontal overflow at 320–373px. Do not remove overflow safety merely to satisfy a source scan.
- `DriverOperationalStops.vue`: remove the nested outer `px-4`; `cockpit-body` remains the single horizontal gutter authority.
- `DriverRouteSpine.vue`: preserve the existing evidence-backed `min-w-0 flex-1 truncate` customer span. First re-evaluate the row after the gutter fix. Change its mobile allocation only if manual/DOM evidence still shows a defect; any change must preserve position, customer, textual status, and no horizontal overflow.
- `DriverCockpitFooter.vue`: replace `py-3` plus `pb-[env(...)]` with `pt-3` plus additive `pb-[calc(0.75rem+env(safe-area-inset-bottom))]`.
- `DriverRouteCockpit.vue`: establish a containing-panel-aware available-height chain so the body grows and the non-fixed sticky footer reaches the visible bottom. Prefer `h-full/min-h-0/flex-1` when the containing block provides height; otherwise use a justified navbar-offset `calc(100dvh - <verified shell offset>)`. Raw `min-h-[100dvh]` inside the panel is forbidden because it can overshoot below the global navbar.

**TDD Steps:**

1. **RED — narrow header contract:** extend `DriverCockpitHeader.spec.ts` to pin full identity text in the DOM, deliberate identity/control grouping, ≥44px interactive controls, and absence of fixed-width or horizontal-scroll classes. The test must fail on the structural grouping defect; jsdom MUST NOT claim pixel measurement.
2. **GREEN — header composition:** update `DriverCockpitHeader.vue` with wrap-safe groups and flexible identity allocation while preserving existing back/history/refresh emits and accessible labels. Retain truncation only where it represents real overflow.
3. **RED → GREEN — single gutter authority:** add a failing `DriverOperationalStops.spec.ts` assertion that the outer operational section owns no `px-4`, then remove only that nested gutter from `DriverOperationalStops.vue`. Keep card-internal padding.
4. **TRIANGULATE — spine width budget:** in `DriverRouteSpine.spec.ts`, pin that position, customer, and textual status remain present and accessible, and that the customer span retains `min-w-0 flex-1 truncate`. After the gutter GREEN, manually inspect 320px and 373px. If meaningful text still truncates while usable width remains, author a new failing contract for a deliberate mobile row allocation (for example a wrap-safe/grid allocation) before changing `DriverRouteSpine.vue`; never remove `truncate` solely to make a source assertion pass.
5. **RED → GREEN — additive safe area:** update `DriverCockpitFooter.spec.ts` first to require `pt-3` plus `pb-[calc(0.75rem+env(safe-area-inset-bottom))]` and reject the old `py-3`/`pb-[env(...)]` combination; then implement the class change without altering footer modes.
6. **RED — available-height mechanism:** inspect the actual `UDashboardPanel` → route view → cockpit containing-block chain. In `DriverRouteCockpit.spec.ts`, author one failing source-contract assertion for the chosen design-approved mechanism: either a complete `h-full/min-h-0/flex-1` chain or a documented navbar-offset `calc`. The test MUST reject raw `min-h-[100dvh]` on the cockpit root and keep body footer clearance.
7. **GREEN — bottom-aligned non-fixed footer:** implement the chosen containing-panel-aware chain in `DriverRouteCockpit.vue` (and only the nearest necessary existing wrapper if the chain requires it). Keep the footer sticky/non-fixed, body `flex-1 min-h-0`, and no desktop vertical overshoot.
8. **TRIANGULATE — real viewport evidence:** capture/inspect 373×807 mobile and ≥1024px desktop. Verify readable header identity, balanced gutters, position/customer/status visibility, no horizontal scroll, footer bottom alignment, safe-area spacing, and no vertical overshoot below the navbar. Record the chosen height mechanism in `apply-progress.md`.
9. **REFACTOR:** remove no overflow guards or accessibility labels; avoid new shared abstractions unless at least three concrete uses justify them. Re-run all focused tests.

**Files (NEW + MOD):**

- MOD `src/features/delivery-routes/components/cockpit/DriverCockpitHeader.vue`
- MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitHeader.spec.ts`
- MOD `src/features/delivery-routes/components/cockpit/DriverOperationalStops.vue`
- MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverOperationalStops.spec.ts`
- MOD `src/features/delivery-routes/components/cockpit/DriverRouteSpine.vue` only if post-gutter RED evidence requires a row-allocation change
- MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverRouteSpine.spec.ts`
- MOD `src/features/delivery-routes/components/cockpit/DriverCockpitFooter.vue`
- MOD `src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitFooter.spec.ts`
- MOD `src/features/delivery-routes/components/cockpit/DriverRouteCockpit.vue`
- MOD nearest existing route/panel wrapper only if required by the verified `h-full/min-h-0` chain; document the necessity before editing

**Verify block:**

```bash
pnpm test:unit --run src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitHeader.spec.ts \
                 src/features/delivery-routes/components/cockpit/__tests__/DriverOperationalStops.spec.ts \
                 src/features/delivery-routes/components/cockpit/__tests__/DriverRouteSpine.spec.ts \
                 src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitFooter.spec.ts \
                 src/features/delivery-routes/components/cockpit/__tests__/DriverRouteCockpit.spec.ts
```

Then perform the required 373×807 mobile and ≥1024px desktop screenshot checks. Expect: focused tests green, one gutter authority, overflow-safe spine content, additive safe area, bottom-aligned mobile action, and no desktop/mobile vertical overshoot.

**Rollback boundary:**

Revert one S4 commit. S1–S3 remain intact; only responsive composition polish is removed.

**Commit message:**

```
feat(cockpit): polish responsive shell composition (REQ-DCS-002/006/011/012)

Regroup the cockpit header for narrow widths, remove the nested operational
stops gutter, preserve evidence-based spine overflow safety, make footer
safe-area spacing additive, and use a verified containing-panel-aware height
chain so the mobile action sits at the visible bottom without overshooting
the desktop panel. Reducer, derivation, check-in, manager, and list behavior
remain unchanged.

Capability: driver-cockpit-shell
Spec:        openspec/changes/driver-cockpit-responsive-polish/specs/driver-cockpit-shell/spec.md
Verify:      pnpm test:unit --run src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitHeader.spec.ts \
                                  src/features/delivery-routes/components/cockpit/__tests__/DriverOperationalStops.spec.ts \
                                  src/features/delivery-routes/components/cockpit/__tests__/DriverRouteSpine.spec.ts \
                                  src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitFooter.spec.ts
```

---

## Final full gates (run after all four slices land)

```bash
pnpm test:unit --run          # every co-located spec across the change
pnpm build                    # vue-tsc --build + vite build
pnpm lint                     # oxlint + eslint + prettier
```

Success criteria (mirrors the proposal's checklist):

- [x] On `lg+`, opening stop detail or history shows a right-side `USlideover` (`side="right"`, inset); below `lg`, the bottom `UDrawer` remains.
- [x] Exactly one primary `Marcar entregada` action visible per active viewport/context: slideover footer on desktop, page bottom footer on mobile.
- [x] Each open overlay has exactly one title and one close control; no duplicate header chrome inside `DriverStopPanel`.
- [x] Below 1024px, `DashboardLayout` exposes an accessible sidebar trigger that opens the sidebar; desktop collapse behavior is unchanged.
- [x] Header identity does not truncate to fragments at 373px; controls wrap without horizontal scroll at 320px.
- [x] Operational-stops and spine share consistent gutters (single authority).
- [x] Footer bottom padding survives a zero safe-area inset (additive `calc`).
- [x] `pnpm test:unit --run` green; reducer/derivation/check-in tests pass unchanged; `vue-tsc --build` clean.
- [x] All preserved contracts verified: manager branch, route list, permissions, API, close-before-confirm, focus trap, reduced motion, quick-action predicates.

---

## Out-of-scope reminder

Manager branch (`DeliveryRouteDetailView` lifecycle controls/timeline), route list view, reducer phases, `useDriverRouteCockpit` selector semantics, `useCheckInStop` mutation contract/endpoint/permissions/toast copy, new backend endpoints, new DTOs, new query keys, new CASL subjects, new routes, navigation registry changes, and any visual-identity (color/typography) redesign are explicitly untouched. Any preservation test in `DeliveryRouteDetailView.spec.ts` that exercises these untouched surfaces continues to pass.
