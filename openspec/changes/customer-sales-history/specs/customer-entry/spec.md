# Customer Entry Specification

## Purpose

Define consistent, permission-gated entry points for opening customer sales history in table and card customer-list modes without coupling history state to existing customer editing or detail behavior.

## Requirements

### REQ-CSH-ENT-001 — Table history action and permission gate

`CustomersView` SHALL expose a `Ver historial de ventas` row-dropdown action only when `authStore.userCan('read', 'Sale')` is true. Without that permission, the action SHALL be hidden entirely. Its visibility SHALL be independent of customer edit and delete permissions, and existing customer actions SHALL retain their current behavior.

#### Scenario: Authorized table user opens history

#### Given

- The user has `read:Sale` and may or may not have customer update/delete permissions.

#### When

- The user opens a customer row dropdown and selects history.

#### Then

- The history action is visible and opens the selected customer's independent history surface.

#### Scenario: Unauthorized table user cannot discover history

#### Given

- The user lacks `read:Sale`.

#### When

- Customer row actions are rendered.

#### Then (negative)

- The history action is absent, not merely disabled or hidden after activation.
- Edit/delete visibility is evaluated independently.

### REQ-CSH-ENT-002 — Card and grid forwarding parity

`CustomerCard` SHALL expose the same gated history action through its kebab menu, and `CustomerCardGrid` SHALL explicitly forward the permission prop and history-open event to preserve parity with the table entry. The card's existing click behavior SHALL remain unchanged.

#### Scenario: Authorized card user opens history

#### Given

- A card is rendered for a customer and the user has `read:Sale`.

#### When

- The user opens the card kebab and selects history.

#### Then

- The action is visible and emits/forwards the selected customer to the history surface.
- Clicking the card body retains its existing behavior.

#### Scenario: Grid forwards permission and selection

#### Given

- The grid renders cards with history permission and an entry handler.

#### When

- A card emits a history selection.

#### Then

- The grid forwards the event without changing the customer identity or swallowing the selection.

### REQ-CSH-ENT-003 — Kebab visibility and independent state

The customer-card kebab SHALL be visible when any of update, delete, or read-sale actions is available. History open state SHALL be independent from the customer edit form and `CustomerDetail` fetch state; opening or closing history SHALL not open, submit, reset, or refetch the edit/detail surface.

#### Scenario: Read-only sales permission preserves kebab

#### Given

- The user has `read:Sale` but lacks customer update and delete permissions.

#### When

- A customer card is rendered.

#### Then

- The kebab is visible and contains the history action.

#### Scenario: History lifecycle is independent

#### Given

- A customer edit form or customer-detail request exists for the same customer.

#### When

- History is opened and then closed.

#### Then

- The edit form state and detail-fetch state are unchanged.
- Reopening history uses its own selected-customer/open state and query lifecycle.

### REQ-CSH-ENT-004 — Defensive authorization error handling

Entry-point permission checks SHALL provide the normal UX gate, while the history surface SHALL still handle a backend 403 defensively: show a single toast, close the panel, and never expose fabricated customer data or a retry affordance for an authorization failure.

#### Scenario: Backend rejects an otherwise visible action

#### Given

- The action was visible because the local ability allowed `read:Sale`.
- The history request receives HTTP 403.

#### When

- The slideover receives the authorization failure.

#### Then

- The user sees one toast `Sin permiso para ver ventas` and the panel closes without retry.
- The customer list action remains governed by the local permission check and no unauthorized sales are rendered.
