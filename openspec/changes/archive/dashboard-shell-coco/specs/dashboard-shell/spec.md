# Delta for Dashboard Shell — Coco Brand Redesign

## Purpose

Replace all remaining default Nuxt UI primary-blue tokens on the dashboard shell (sidebar, navbar, search, navigation menu, dashboard home view) with Coco-brand tokens, closing the SDD-1→9 chain. No new tokens, no behavior changes, no `app.config.ts` rewrites.

## ADDED Requirements

### Requirement: DSC-REQ-001 DashboardHomeView Coco Token Binding

`DashboardHomeView.vue` SHALL render the dashboard icon (`i-lucide-layout-dashboard`) with `text-coco-gold-500` and the `<UCard>` body SHALL use `bg-coco-neutral-50 dark:bg-coco-neutral-950`. No `text-primary` or `bg-white` SHALL remain.

#### Scenario: gold icon + neutral card, light and dark

- GIVEN `DashboardHomeView` mounted in light mode
- WHEN the icon and card surface render
- THEN the icon class list includes `text-coco-gold-500` and excludes `text-primary`
- AND the `UCard` body class list includes `bg-coco-neutral-50`
- GIVEN dark mode — THEN card body includes `dark:bg-coco-neutral-950`

### Requirement: DSC-REQ-002 Navbar Brand Tokens

`UDashboardNavbar` SHALL render its `title` text with `text-coco-gold-500` and its `leading` icon with `text-coco-gold-500` via `:ui` slot overrides. The `title="Coco"` string SHALL remain unchanged.

#### Scenario: gold title and icon

- GIVEN `DashboardLayout` mounted
- WHEN the navbar renders
- THEN the title text includes `text-coco-gold-500`
- AND the leading icon (logo mark) includes `text-coco-gold-500`
- AND no `text-primary` appears on the navbar chrome

### Requirement: DSC-REQ-003 Sidebar Shell Surface

`UDashboardSidebar` SHALL use `bg-coco-neutral-50 dark:bg-coco-neutral-950` on its body surface. The collapse button (`UDashboardSidebarCollapse`) SHALL render its icon with `text-coco-gold-500`.

#### Scenario: coco-neutral sidebar, gold collapse icon

- GIVEN sidebar expanded
- WHEN the sidebar body and collapse button render
- THEN the sidebar body class list includes `bg-coco-neutral-50 dark:bg-coco-neutral-950`
- AND the collapse button icon includes `text-coco-gold-500`

### Requirement: DSC-REQ-004 Navigation Menu Coco Active State

`UNavigationMenu` active nav items SHALL render the leading icon with `text-coco-gold-500`, the label with `group-data-[active=true]:text-coco-gold-500`, and the active background with `bg-coco-gold-500/10`. Inactive nav labels SHALL preserve `text-dimmed`.

#### Scenario: active item gold, inactive dimmed

- GIVEN a nav item is active
- WHEN the item and its sibling render
- THEN the active icon includes `text-coco-gold-500`, label includes `text-coco-gold-500`, and background includes `bg-coco-gold-500/10`
- AND inactive siblings preserve `text-dimmed` without gold tokens

#### Scenario: collapsed sidebar gold still applies

- GIVEN sidebar collapsed
- WHEN active nav icons render
- THEN they still include `text-coco-gold-500`

### Requirement: DSC-REQ-005 Search Button Collapsed State

`UDashboardSearchButton` in collapsed sidebar SHALL use `hover:bg-coco-gold-500/10` to match sidebar active-item tint.

#### Scenario: search button gold hover

- GIVEN sidebar collapsed and `UDashboardSearchButton` visible
- WHEN the button is hovered
- THEN its hover state includes `bg-coco-gold-500/10`

### Requirement: DSC-REQ-006 UDashboardSearch Modal Shell Rule

`UDashboardSearch` (UModal-derived) SHALL NOT force any Coco dark background (`bg-coco-neutral-900`, `bg-coco-neutral-950`, or any `dark:bg-coco-*`) on its `:ui` header, body, or footer slots. Shell backgrounds SHALL remain theme-adaptive (Nuxt UI 4 default).

#### Scenario: no forced dark bg on search modal shell

- GIVEN `UDashboardSearch` open in light mode
- WHEN the modal header, body, and footer are inspected
- THEN none of their class lists include `bg-coco-neutral-900`, `bg-coco-neutral-950`, or `dark:bg-coco-neutral-*`
- AND the modal surface renders with the Nuxt UI 4 default theme-adaptive background

#### Scenario: dark mode still uses native bg

- GIVEN `UDashboardSearch` open in dark mode
- WHEN the modal shell is inspected
- THEN it does NOT carry `bg-coco-neutral-900` or any forced Coco dark background

### Requirement: DSC-REQ-007 UDashboardSearch Internal Coco Accents

`UDashboardSearch` internal elements SHALL use Coco tokens: input focus ring `focus-visible:ring-coco-gold-500`, active item highlight `bg-coco-gold-500/10`, group heading `text-coco-gold-700 dark:text-coco-gold-400`.

#### Scenario: gold accents, no shell override

- GIVEN `UDashboardSearch` open with groups and items visible
- WHEN the input, group heading, and active item render
- THEN the input focus ring includes `ring-coco-gold-500`
- AND the group heading includes `text-coco-gold-700` (light) / `text-coco-gold-400` (dark)
- AND the active highlighted item includes `bg-coco-gold-500/10`

### Requirement: DSC-REQ-008 Search Modal Lifecycle Preservation

`UDashboardSearch` SHALL preserve full modal lifecycle: open on trigger, accept keyboard input, navigate/jump on Enter, close on `Esc`.

#### Scenario: modal lifecycle unchanged

- GIVEN `DashboardLayout` mounted
- WHEN `UDashboardSearch` is opened via trigger, receives input, receives an Enter key
- THEN it navigates to the selected item
- WHEN `Esc` is pressed — THEN the modal closes
- AND no props, emits, or lifecycle hooks are removed

### Requirement: DSC-REQ-009 Tenant Dropdown Neutral Preservation

Tenant labels in `UDropdownMenu` SHALL retain `color="neutral"` (intentional — not CTAs). No Coco token SHALL be applied to tenant items.

#### Scenario: tenant labels stay neutral

- GIVEN `DashboardLayout` with tenant dropdown open
- WHEN the tenant list items render
- THEN they use `color="neutral"` and exclude `text-coco-gold-*`

### Requirement: DSC-REQ-010 User Dropdown Checkicon Coco

User-menu Appearance items (Light/Dark mode) SHALL render their checkicon with `text-coco-gold-500` when `data-[checked=true]`, via `:ui="{ itemLeadingIcon: 'group-data-[checked=true]:text-coco-gold-500' }"`.

#### Scenario: checkicon gold on active theme

- GIVEN user dropdown open and "Light" is the active theme
- WHEN the Light item renders with `data-[checked=true]`
- THEN its leading checkicon includes `text-coco-gold-500`
- AND the Dark item checkicon (unchecked) excludes gold

### Requirement: DSC-REQ-011 useSidebar.ts Class Field Extension

`getNavigationItems()` MAY return items with an optional `class` field (string) consumed by `UNavigationMenu` to apply brand color. The extension SHALL NOT change `canAccess()`, permission logic, route resolution, or any behavior.

#### Scenario: class field exists, behavior unchanged

- GIVEN `getNavigationItems()` returns items with a `class` field on selected entries
- WHEN the sidebar renders nav items
- THEN items with `class` pass it to `UNavigationMenu`
- AND `canAccess()` returns identical results pre- and post-change
- AND no route resolution or permission logic is modified

### Requirement: DSC-REQ-012 DashboardHomeView Test Coverage

`src/features/dashboard/home/__tests__/DashboardHomeView.test.ts` SHALL exist and pin: `text-coco-gold-500` on the dashboard icon, `bg-coco-neutral-50 dark:bg-coco-neutral-950` on the UCard body, and absence of `text-primary`.

#### Scenario: TDD test pins gold icon + neutral card

- GIVEN `DashboardHomeView.test.ts` is written and run
- WHEN it mounts the component
- THEN assertions confirm `text-coco-gold-500` on the icon element
- AND `bg-coco-neutral-50 dark:bg-coco-neutral-950` on the card surface
- AND `text-primary` is absent

### Requirement: DSC-REQ-013 DashboardLayout Test Coverage

`src/app/layouts/__tests__/DashboardLayout.test.ts` SHALL exist and pin: sidebar `:ui` slot additions (neutral surface), navbar gold tokens, and `UDashboardSearch` has NO forced-dark-bg slot. This test SHALL serve as the regression anchor against Nuxt UI upgrades.

#### Scenario: layout test pins shell tokens + UModal rule

- GIVEN `DashboardLayout.test.ts` is written
- WHEN it mounts `DashboardLayout`
- THEN assertions confirm `bg-coco-neutral-50 dark:bg-coco-neutral-950` on sidebar and card surfaces
- AND `text-coco-gold-500` on navbar and nav active state
- AND `UDashboardSearch` modal shell excludes `bg-coco-neutral-900`, `bg-coco-neutral-950`, and `dark:bg-coco-neutral-*`

### Requirement: DSC-REQ-014 Test Suite Gate

All new tests SHALL pass under `pnpm test:unit --run`. The existing 2926+ test suite SHALL remain green. No existing test SHALL be deleted.

#### Scenario: green test suite

- GIVEN the change is applied and `pnpm test:unit --run` executes
- THEN exit code is 0
- AND all existing tests (2926+) pass without regression

### Requirement: DSC-REQ-015 Visual Evidence Capture

Visual evidence SHALL be captured for: `DashboardHomeView` (empty + hydrated), dashboard sidebar expanded + collapsed, navbar with `UDashboardSearch` open + closed, all in light and dark mode.

#### Scenario: visual evidence collected

- GIVEN the verify phase executes
- WHEN screenshots are captured for all 8 state combinations
- THEN each screenshot shows Coco brand tokens on the claimed surfaces

### Requirement: DSC-REQ-016 Chain-Closing Visual Smoke

A chain-closing visual smoke SHALL be captured across SDD-1→9 touchpoints: catalog grid, product create, sale workspace, payment modal, sale history, sale detail, customers, promotions, dashboard — all displaying Coco tokens with no regression to prior SDDs.

#### Scenario: chain smoke all green

- GIVEN all 9 SDD touchpoints are rendered
- WHEN each surface is visually inspected for Coco tokens
- THEN all read Coco gold/neutral tokens
- AND no default Nuxt UI primary blue survives on any POS surface

### Requirement: DSC-REQ-017 Build Gate

`pnpm build` SHALL pass clean — no TypeScript errors, no build errors introduced by this SDD.

#### Scenario: build passes

- GIVEN the change is applied
- WHEN `pnpm build` runs
- THEN exit code is 0 with no TS or bundle errors

### Requirement: DSC-REQ-018 Token Invariant Protection

NO new Coco tokens SHALL be added to `src/assets/main.css`. NO `app.config.ts` `ui.colors` rewrites SHALL be made. Semantic colors (success/error/warning) SHALL remain on all untouched surfaces (StatusDotBadge, notification toasts, status pills).

#### Scenario: token invariant preserved

- GIVEN the change is applied
- WHEN `src/assets/main.css` and `app.config.ts` are diffed
- THEN both produce empty diffs
- AND `StatusDotBadge`, toasts, and status pills preserve their original semantic colors

### Requirement: DSC-REQ-019 Out-of-Scope Guard

`src/features/catalog/`, `ProductDetailModal`, `VariantPickerModal`, `GlobalDiscountModal`, auth, tenant admin, and `App.vue` layout switcher SHALL remain unchanged — no Coco token added or removed.

#### Scenario: zero diff on out-of-scope files

- GIVEN the change is applied
- WHEN `git diff` runs on out-of-scope paths
- THEN each file diff is empty

## MODIFIED Requirements

None — no existing dashboard spec to modify.

## REMOVED Requirements

None.

## Cross-References

- **Proposal**: `openspec/changes/dashboard-shell-coco/proposal.md` — 10-file swap table, 7 risks, 8 success criteria
- **Pattern memory**: `patterns/umodal-coco-styling` (Engram #3427) — hard rule: no forced dark bg on UModal shells
- **Chain status**: SDD-1→8 merged to main; SDD-9 is the final chain-closing change
- **Design**: `openspec/changes/dashboard-shell-coco/design.md` (to be authored by sdd-design)
