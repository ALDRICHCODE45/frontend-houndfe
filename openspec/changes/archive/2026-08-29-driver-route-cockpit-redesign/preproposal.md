# Driver Route Cockpit Redesign — Pre-Proposal Decision Gate

Change: `driver-route-cockpit-redesign`  
State: confirmed  
Research lane: unselected (repository evidence is sufficient; no SDD evidence grants are available in this runtime)
Confirmed selections: `driver-detail-only`, `visual-priority-no-enforcement`, `maps-copy-email`, `single-drawer-confirm-refresh`

## Confirmed product direction

- Comprehensive redesign of the delivery-driver route detail screen.
- Modern, content-rich, always mobile-first route cockpit.
- Sticky route/progress identity, prominent current stop, route spine, bottom drawer interactions, sticky delivery CTA, and explicit confirmation.
- Reuse actual Coco tokens, Inter, EntityAvatar, status primitives, ConfirmModal, AddressMapPicker, and Nuxt UI v4 Drawer.
- Preserve truthful capability boundaries; no fabricated backend data.

## Decisions awaiting user confirmation

### D1 — Scope boundary

Recommended token: `driver-detail-only`

- `driver-detail-only`: Redesign the complete driver route-detail screen shown in the screenshot; manager detail and driver route list remain behaviorally unchanged.
- `driver-flow`: Redesign both driver route list and driver route detail as one flow; manager detail remains unchanged.

### D2 — Delivery order semantics

Recommended token: `visual-priority-no-enforcement`

- `visual-priority-no-enforcement`: Derive the first IN_PROGRESS or PENDING stop as current, visually prioritize it, and keep other PENDING stops actionable from their details because the backend does not enforce order.
- `strict-order-ui`: Only the derived current stop can be delivered; later stops are disabled in the UI despite the backend allowing them.
- `no-current-stop`: Do not derive a current stop; preserve equal action semantics and only improve the visual design.

### D3 — Truthful quick actions

Recommended token: `maps-copy-email`

- `maps-copy-email`: Offer external map navigation when an address/coordinates exist, copy address, and email when customer email exists.
- `maps-copy`: Offer external map navigation and copy address, but omit email.
- `display-only`: Keep address/map informational and add no new outbound actions.

Phone, real ETA/polyline, sale items, proof of delivery, and skip reasons remain out of scope because the current contract does not expose them.

### D4 — Overlay and freshness model

Recommended token: `single-drawer-confirm-refresh`

- `single-drawer-confirm-refresh`: One reusable bottom drawer for stop/history modes; close it before opening ConfirmModal; add explicit manual refresh in the cockpit header.
- `single-drawer-confirm`: Same one-overlay-at-a-time flow without manual refresh.
- `inline-confirm-refresh`: Use inline expandable details instead of a drawer; retain ConfirmModal and manual refresh.
- `separate-overlays`: Separate stop/history drawers and confirmation modal, accepting higher focus/stacking complexity.

## Proposal gate

D1–D4 were confirmed by the user. `sdd-proposal` may proceed using the exact selection tokens recorded above.
