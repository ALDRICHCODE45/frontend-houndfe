# App Shell Mobile Nav Trigger Specification

## Purpose

Close the user-facing regression where the application sidebar is unreachable below the sidebar breakpoint: `DashboardLayout.vue` disabled the `UDashboardNavbar` toggle (`:toggle="false"`), leaving no discoverable control to open the `UDashboardSidebar` on phones and narrow tablets. This capability covers ONLY the application shell's mobile navigation trigger contract. Cockpit composition, page content, routing, permissions, and every other shell behavior are out of scope and remain governed by their own specs.

The sidebar breakpoint is `lg` (1024px), the same boundary used by the cockpit overlay container selection (`driver-cockpit-drawer` REQ-DCK-001/009).

## Requirements

### ASNT-REQ-001: A labeled, accessible sidebar trigger is exposed below `lg`

Below `lg` (< 1024px), `DashboardLayout` SHALL render a discoverable sidebar trigger in the dashboard navbar that is:

- visible and reachable without hover or hidden gestures,
- at least 44×44px when interactive,
- keyboard focusable with a visible focus ring,
- labeled with an accessible name (e.g. `aria-label` "Abrir menú" or the installed Nuxt UI component's equivalent), not icon-only-unlabeled.

When the trigger is reachable, activating it SHALL open the `UDashboardSidebar` below `lg`. Because the opened sidebar MAY render as an overlay that covers the navbar trigger or otherwise makes it unreachable, this capability MUST NOT require the trigger itself to close the already-open sidebar in that state. Instead, the opened sidebar SHALL remain closable through the installed Nuxt UI's accessible native close/dismiss mechanisms as supported — an explicit close control, the Escape key, and overlay/scrim dismissal. The central user outcome MUST hold: below `lg` there is always a discoverable way to open the mobile sidebar. The trigger MUST NOT invoke the desktop collapse behavior and MUST NOT alter page content, routing, or permissions.

#### Scenario: Trigger opens the sidebar on mobile

- GIVEN a viewport < 1024px and the sidebar closed
- WHEN the driver or any user activates the navbar trigger
- THEN the `UDashboardSidebar` opens
- AND no route navigation occurs

#### Scenario: Trigger toggles the sidebar when reachable

- GIVEN a viewport < 1024px and the sidebar closed
- WHEN the driver or any user activates the navbar trigger
- THEN the `UDashboardSidebar` opens
- AND when the trigger remains reachable while the sidebar is open, activating it again toggles the sidebar closed
- AND no route navigation occurs

#### Scenario: Opened sidebar remains closable without the trigger

- GIVEN a viewport < 1024px and the mobile sidebar open, with the opened sidebar covering or otherwise making the navbar trigger unreachable
- WHEN the user closes the sidebar through an installed Nuxt UI accessible close/dismiss mechanism as supported — the sidebar's close control, the Escape key, or activating the overlay/scrim
- THEN the `UDashboardSidebar` closes
- AND the spec does not require the covered navbar trigger to perform the close
- AND after closing, the navbar trigger remains available as the discoverable way to open the sidebar again

#### Scenario: Trigger is accessible

- GIVEN a viewport < 1024px
- WHEN the navbar is inspected
- THEN the trigger is at least 44×44px, keyboard focusable with a visible focus ring, and exposes an accessible name
- AND it is not reachable only by hover or swipe

#### Scenario: No navigation or permission side effects

- GIVEN the trigger is activated any number of times
- WHEN the resulting behavior is inspected
- THEN no route change, no API request, and no permission check change occurs
- AND the trigger only affects sidebar open/closed state

### ASNT-REQ-002: Desktop collapse behavior at `lg+` is unchanged

At `lg+` (≥ 1024px), the existing desktop sidebar collapse control SHALL remain, with its current behavior and placement unchanged. The mobile trigger contract MUST NOT remove, relocate, or resemantize the desktop collapse control, and the desktop collapse control MUST NOT be repurposed as the mobile open/close trigger.

#### Scenario: Desktop collapse control is preserved

- GIVEN a viewport ≥ 1024px
- WHEN the navbar is inspected
- THEN the existing collapse control is present and toggles sidebar collapse exactly as before this change

#### Scenario: Collapse and open/close remain distinct behaviors

- GIVEN the app shell at any viewport
- WHEN both controls are compared
- THEN desktop collapse toggles the collapsed rail state at `lg+`, and the mobile trigger opens the sidebar below `lg`
- AND neither control performs the other's behavior

### ASNT-REQ-003: Narrow scope — no other shell behavior is claimed

This change SHALL modify `DashboardLayout.vue` only to the extent required to satisfy ASNT-REQ-001 and ASNT-REQ-002. Shell layout structure, panel composition, global navbar styling, and other views MUST NOT change as part of this capability. Any broader shell refactor is out of scope and requires its own change.

#### Scenario: Shell diff is limited to the trigger restoration

- GIVEN the change is applied
- WHEN the `DashboardLayout.vue` diff is reviewed
- THEN only the mobile trigger restoration (and its direct wiring) appears
- AND no unrelated shell restructuring, styling rewrite, or component replacement is introduced
