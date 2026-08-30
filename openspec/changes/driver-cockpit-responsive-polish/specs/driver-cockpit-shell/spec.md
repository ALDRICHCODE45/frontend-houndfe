# Delta for Driver Cockpit Shell

Delta spec against canonical `openspec/specs/driver-cockpit-shell/spec.md`.
REQ-DCS-001, REQ-DCS-003, REQ-DCS-004, REQ-DCS-005, REQ-DCS-007, REQ-DCS-008, REQ-DCS-009, and REQ-DCS-010 are preserved verbatim. No REMOVED requirements.

## MODIFIED Requirements

### REQ-DCS-002: Sticky header renders identity, lifecycle, progress, history, refresh, and back with safe narrow-width composition

`DriverCockpitHeader` SHALL render a sticky panel-contained header with back, route identity (`route.driver?.name ?? 'Ruta'`), existing lifecycle badge/labels, `completed/total`, history, and refresh controls. Back SHALL emit; it SHALL not push the router. Refresh follows REQ-DCS-007. Controls SHALL not force horizontal scrolling at 320px, SHALL be at least 44×44px when interactive, and SHALL wrap into deliberate groups without cramped overlap at 320–373px.

The route identity SHALL NOT be destructively or prematurely truncated at 320–373px: the driver name or `Ruta` fallback SHALL remain readable at those widths, truncating only when the full header layout is genuinely exhausted, and never down to a meaningless fragment (e.g. `Re`). Header content MUST NOT cause horizontal overflow at 320px.

(Previously: identity and control composition were unspecified below 373px; real usage truncated the identity to fragments and cramped the controls.)

#### Scenario: Full identity at 373px

- GIVEN a driver named with a long name (e.g. more than 8 characters) on a 373px viewport
- WHEN the cockpit header renders
- THEN the identity is readable without collapsing to a one-or-two-character fragment
- AND the lifecycle badge, progress counter, history, and refresh controls remain present and reachable

#### Scenario: No horizontal overflow at 320px

- GIVEN a 320px viewport
- WHEN the header renders with all controls
- THEN no horizontal page or panel scroll is introduced by the header
- AND controls wrap within the header instead of overflowing

#### Scenario: Preserved header behavior

- GIVEN a null driver name, `{ completed: 2, total: 5 }`, a back press, or a panel scroll
- WHEN the header renders or is interacted with
- THEN it shows `Ruta` without an empty line, renders `2/5`, emits back once without router push, and stays inside the panel below the global navbar

### REQ-DCS-006: `DriverCockpitFooter` modes remain exclusive and gated; primary action placement is viewport-composed with additive safe-area padding

For a non-terminal route with current PENDING, the footer SHALL render one sticky primary `Marcar entregada` action targeting only that current stop. It SHALL emit `request-confirm({ stopId, trigger })`; it SHALL not mutate. The action is visible only when `canCheckIn` is true and disabled while `checkInPending` is true. `canCheckIn` SHALL equal the view's existing `canUpdate` permission. This gating is byte-equivalent across viewports.

Exactly one primary delivery action SHALL be visible per active viewport/context:

- Below `lg` (< 1024px): the action renders in the cockpit's bottom page footer, prominent and bottom-aligned.
- On `lg+` (≥ 1024px): the action renders in the open stop overlay's footer slot (governed by `driver-cockpit-drawer` REQ-DCK-003); the page footer's current-action mode MUST NOT render a competing primary delivery action on `lg+`.

For current IN_PROGRESS, the footer SHALL render the specified disabled IN_PROGRESS mode and emit nothing. Other non-actionable current states use empty mode.

The footer's bottom padding SHALL be additive with respect to the safe-area inset: the base bottom spacing SHALL be preserved even when `env(safe-area-inset-bottom)` is 0, and the inset SHALL be added or otherwise chosen to be sufficient when nonzero. The footer padding MUST NOT collapse the ordinary bottom padding to 0 on devices without a safe-area inset, and the cockpit body SHALL retain matching clearance so the last content is never hidden under the footer.

(Previously: the footer rendered the primary action on all viewports while the stop panel duplicated it inline, and safe-area padding could override ordinary bottom padding with a 0 inset.)

#### Scenario: Mobile keeps the single page-footer action

- GIVEN a non-terminal route with a PENDING current stop, `canCheckIn` true, `checkInPending` false, on a <1024px viewport
- WHEN the cockpit renders
- THEN one enabled ≥44px `Marcar entregada` action renders in the bottom page footer and emits the current stop id
- AND no duplicate delivery action exists in the page footer, the drawer body, or the drawer header

#### Scenario: Desktop page footer does not compete with the slideover footer action

- GIVEN the same gating on a ≥1024px viewport
- WHEN the cockpit renders with the stop slideover open
- THEN the `Marcar entregada` action renders in the slideover footer
- AND the page footer's current-action mode presents no primary delivery action

#### Scenario: Additive safe-area padding survives a zero inset

- GIVEN a viewport with `env(safe-area-inset-bottom)` = 0
- WHEN the footer renders
- THEN the footer's bottom padding is at least the base bottom spacing (not 0)
- AND when the inset is nonzero the effective bottom padding includes it without reducing the base spacing

#### Scenario: Preserved gating and modes

- GIVEN `checkInPending` true, a read-only driver, an IN_PROGRESS current stop, or a non-actionable current state
- WHEN the footer renders on any viewport
- THEN the action is disabled with no repeat emission, absent for read-only drivers (inspect/history controls retained), the IN_PROGRESS mode renders disabled and emits nothing, and empty mode renders otherwise

## ADDED Requirements

### REQ-DCS-011: One horizontal gutter authority across cockpit sections

The cockpit body SHALL own a single horizontal gutter authority: `DriverOperationalStops`, `DriverRouteSpine`, and other cockpit body sections SHALL present consistent horizontal padding derived from that authority across 320–1024px. Nested sections MUST NOT add divergent horizontal padding that produces visibly misaligned edges between the operational-stops card and the spine at the same viewport width.

#### Scenario: Operational stops and spine share aligned edges

- GIVEN the cockpit renders on a 320px, 373px, or 768px viewport
- WHEN the left and right edges of the operational-stops content and the spine content are compared
- THEN they align within the shared gutter with no mismatched nested padding
- AND no horizontal overflow is introduced by either section

#### Scenario: Gutter authority is single-sourced

- GIVEN the cockpit body composition is inspected
- WHEN horizontal padding for `DriverOperationalStops` and `DriverRouteSpine` is traced
- THEN both derive from the cockpit body's single gutter rather than each declaring independent, divergent values

### REQ-DCS-012: Spine and header content avoid premature truncation at narrow widths

`DriverRouteSpine` node labels and other cockpit body text SHALL remain readable at narrow widths (down to 320px): text SHALL ellipsize only when actually constrained by its container, MUST NOT truncate prematurely while space remains, and MUST NOT cause horizontal overflow. Stop status remains conveyed by the existing textual labels, preserving REQ-DCS-005's color-plus-text rule.

#### Scenario: Spine label readable at 320px

- GIVEN a spine node whose customer label is long (e.g. more than 12 characters) on a 320px viewport
- WHEN the spine renders
- THEN the label is not truncated to a meaningless fragment while its container has remaining space
- AND if ellipsis applies, it fires only at actual overflow and never introduces horizontal scroll

#### Scenario: Premature truncation regression is closed

- GIVEN the previously observed defect where spine text truncated at typical mobile widths
- WHEN the spine renders at 373px with realistic stop names
- THEN stop names render without the premature ellipsis evidenced at that width
