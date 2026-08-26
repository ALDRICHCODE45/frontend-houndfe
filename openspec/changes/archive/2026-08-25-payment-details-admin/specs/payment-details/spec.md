# Payment Details Specification

Domain: `payment-details` · Admin CRUD of tenant bank accounts (`PaymentDetail`) used for bank-transfer payments: list with active/inactive badges, create, partial edit (PATCH), logical deactivation (DELETE), "Sin cuenta activa" banner, permission gating, and domain-error handling. Auth/tenant scoping, the CASL `PaymentDetail` subject registration, and the role-permissions UI copy are governed by the `authorization` capability. The bot endpoint that reads the active account is backend-owned and out of scope.

## Purpose

Give tenant admins a permission-gated surface to manage the bank accounts the WhatsApp bot references for transfer payments, so the transfer instructions are never silently wrong. The UI must surface the operational state "is this branch able to receive transfers?" via active/inactive badges and a no-active-account banner, and must never allow an account to be left in an ambiguous state: creation always starts active, deactivation is explicit and warned, and there is no reactivation or hard delete.

## Requirements

### REQ-PD-001: List accounts with badges and view toggle

The list view SHALL be reachable only by users holding `read:PaymentDetail` and SHALL render every bank account for the current tenant — active and inactive — ordered by `updatedAt` descending by default. Each row SHALL show an "Activa"/"Inactiva" badge derived from `isActive`, and the view SHALL offer the table/cards toggle via `ViewToggle`, rendering both modes from the same fetched data.

#### Scenario: admin with read permission sees all accounts

- GIVEN a user with `read:PaymentDetail` and a tenant with 3 accounts (2 active, 1 inactive)
- WHEN the user opens `/admin/payment-details`
- THEN the list renders 3 rows
- AND each active account shows the "Activa" badge
- AND the inactive account shows the "Inactiva" badge

#### Scenario: backend order is preserved by default

- GIVEN the backend returns accounts ordered `updatedAt` descending
- WHEN the list renders without user sorting
- THEN the most recently updated account is first
- AND the default client sort remains `updatedAt desc`

#### Scenario: table/cards toggle

- GIVEN table mode by default
- WHEN the user toggles to cards
- THEN the cards view renders the same accounts with the same badges
- AND the choice persists across reloads

### REQ-PD-002: Create account (always starts active, strict validation)

The create form SHALL collect `bankName`, `beneficiary`, `clabe`, and `accountNumber` and MUST NOT include `isActive` in its schema or payload. Validation SHALL require: `clabe` exactly 18 digits (digits only); `accountNumber` at least 10 digits (digits only); `bankName` and `beneficiary` non-empty after trimming. On a successful create (HTTP 201) the list query MUST be invalidated and the new account MUST appear at the top of the list rendered as "Activa".

#### Scenario: happy path

- GIVEN a user with `create:PaymentDetail` and a fully valid form
- WHEN the user submits
- THEN a POST is sent with only the four collected fields
- AND the list query is invalidated and refetched
- AND the new account appears at the top with the "Activa" badge

#### Scenario: payload never contains isActive

- GIVEN the create form is filled with valid data
- WHEN the submit payload is inspected
- THEN it contains no `isActive` key

#### Scenario: invalid clabe

- GIVEN a `clabe` of 17 digits or containing a non-digit character
- WHEN the user submits
- THEN the form shows a validation error
- AND no request is sent

#### Scenario: invalid accountNumber

- GIVEN an `accountNumber` with fewer than 10 digits or containing non-digits
- WHEN the user submits
- THEN the form shows a validation error
- AND no request is sent

#### Scenario: blank bankName or beneficiary

- GIVEN a `bankName` or `beneficiary` that is empty or whitespace-only after trimming
- WHEN the user submits
- THEN the form shows a validation error
- AND no request is sent

### REQ-PD-003: Partial edit (PATCH) with prefill and no isActive

The edit form SHALL prefill all four fields with the account's current values, SHALL treat every field as optional, and MUST NOT include `isActive` (or `tenantId`) in the PATCH payload. On success the list query MUST be invalidated; because the backend bumps `updatedAt`, the edited account SHALL re-sort to the top under the `updatedAt desc` order.

#### Scenario: edit prefills current values

- GIVEN an existing account opened in edit mode
- THEN `bankName`, `beneficiary`, `clabe`, and `accountNumber` show the account's current values

#### Scenario: partial patch of a single field

- GIVEN the user changes only `beneficiary`
- WHEN the user submits
- THEN a PATCH is sent whose payload contains the changed field and no `isActive` key
- AND the list query is invalidated and refetched

#### Scenario: edited account re-sorts to top

- GIVEN the account was not the most recently updated
- WHEN the edit succeeds
- THEN the list refetch shows the edited account first (its `updatedAt` bumped)

### REQ-PD-004: Logical delete with mandatory confirmation and idempotency

DELETE SHALL require an explicit confirmation before any request is issued. Confirming SHALL send DELETE for the account, setting `isActive=false`; the row MUST remain visible in the list rendered as "Inactiva". Repeating DELETE on the same account MUST NOT fail (idempotent) and MUST NOT surface an error toast. The UI MUST NOT offer reactivation or hard delete.

#### Scenario: cancel does not delete

- GIVEN a user with `delete:PaymentDetail` opens the delete confirmation
- WHEN the user cancels
- THEN no DELETE request is sent
- AND the account keeps its current badge

#### Scenario: confirm deactivates

- GIVEN the delete confirmation
- WHEN the user confirms
- THEN a DELETE request is sent for that account id
- AND the list refetch renders the account with the "Inactiva" badge

#### Scenario: repeat delete is idempotent

- GIVEN an already-deactivated account
- WHEN the user deletes it again
- THEN the request succeeds without an error toast
- AND the account remains visible as "Inactiva"

#### Scenario: no reactivation or hard delete

- GIVEN any account row
- THEN no "reactivar" control and no destructive hard-delete control are rendered

### REQ-PD-005: Warning when deactivating the last active account

The delete confirmation SHALL warn the user when the target account is the only active account for the tenant, stating that the branch will be left without an active account and that the bot will stop showing it for transfers. This warning MUST appear before the user confirms and MUST be visible in addition to the standard confirmation.

#### Scenario: last active account

- GIVEN the tenant has exactly one active account
- WHEN the user opens delete on that account
- THEN the confirmation shows an explicit warning that no active account will remain
- AND the confirm action is not disabled (the user may still proceed after the warning)

#### Scenario: not the last active account

- GIVEN the tenant has at least one other active account
- WHEN the user opens delete on an active account
- THEN the confirmation shows the standard warning without the last-active escalation

### REQ-PD-006: "Sin cuenta activa" banner

The banner SHALL be derived from the complete fetched account list for the tenant — not from the current page slice — and SHALL render "Sin cuenta activa" (or equivalent copy) when no account has `isActive=true`. It MUST disappear as soon as at least one account is active, updating after create/delete mutations without a manual reload.

#### Scenario: no active account

- GIVEN a tenant whose fetched accounts are all inactive
- WHEN the list view renders
- THEN the banner is visible

#### Scenario: at least one active account

- GIVEN a tenant with one or more active accounts
- WHEN the list view renders
- THEN the banner is not visible

#### Scenario: banner reacts to deactivation of the last active account

- GIVEN the banner is hidden because exactly one account is active
- WHEN that account is deleted and the list refetches
- THEN the banner appears without a manual reload

#### Scenario: banner reflects the full list, not the page slice

- GIVEN a tenant whose active account is on a later page of the paginated table
- WHEN the user is on the first page
- THEN the banner is still hidden because the full list contains an active account

### REQ-PD-007: Permission gating

Menu and route: the "Datos bancarios" menu entry SHALL render only for users with `read:PaymentDetail`; direct navigation to `/admin/payment-details` without that permission SHALL redirect to `/403`. Controls: the create button SHALL render only with `create:PaymentDetail`, the edit control only with `update:PaymentDetail`, and the delete control only with `delete:PaymentDetail`. The row kebab menu SHALL be hidden entirely when the user holds neither `update` nor `delete` on `PaymentDetail`.

#### Scenario: no read permission

- GIVEN a user without `read:PaymentDetail`
- WHEN the navigation renders
- THEN no "Datos bancarios" entry appears
- AND navigating directly to `/admin/payment-details` redirects to `/403`

#### Scenario: read only

- GIVEN a user with only `read:PaymentDetail`
- WHEN the list view renders
- THEN rows render without a create button, without edit controls, without delete controls, and without a kebab menu

#### Scenario: create only

- GIVEN a user with `read:PaymentDetail` and `create:PaymentDetail`
- WHEN the list view renders
- THEN the create button is visible
- AND edit and delete controls are hidden

#### Scenario: update and/or delete

- GIVEN a user with `update:PaymentDetail` and/or `delete:PaymentDetail`
- WHEN the list view renders
- THEN the kebab menu is visible
- AND the edit action appears only with `update`, the delete action only with `delete`

### REQ-PD-008: Domain error mapping (code read from `error`)

Mutation failures SHALL map backend domain errors read from the `error` field of the `{ statusCode, error, message, timestamp }` envelope — never from `message`. `409` with `DUPLICATE_CLABE` SHALL surface the toast "Esta CLABE ya existe en esta sucursal". `404` with `ENTITY_NOT_FOUND` SHALL surface "No encontrado". Any other failure SHALL surface a generic error toast.

#### Scenario: duplicate clabe

- GIVEN the create/edit request returns 409 with `error: "DUPLICATE_CLABE"`
- WHEN the mutation settles
- THEN the toast "Esta CLABE ya existe en esta sucursal" is shown

#### Scenario: entity not found

- GIVEN the edit/delete request returns 404 with `error: "ENTITY_NOT_FOUND"`
- WHEN the mutation settles
- THEN the toast/message "No encontrado" is shown

#### Scenario: code read from error, not message

- GIVEN a 409 response whose `message` field differs from `error: "DUPLICATE_CLABE"`
- WHEN the mutation settles
- THEN the mapping uses the `error` field and the specific duplicate-clabe toast is shown

#### Scenario: unknown error

- GIVEN the request fails with a code not present in the domain map
- WHEN the mutation settles
- THEN a generic error toast is shown

### REQ-PD-009: Created active account feeds the bot transfer message (E2E, optional)

End-to-end only (backend R11): after creating an account for a tenant with no other active account, the bot's bank-transfer instruction message for a customer of that tenant SHALL show the newly created `bankName`, `clabe`, `accountNumber`, and `beneficiary`. This SHALL be verified via an E2E/integration path that exercises the real admin create flow and the bot message; it is optional for unit-test coverage.

#### Scenario: bot message reflects the created account

- GIVEN a tenant with no active account
- WHEN an admin creates a valid account and a customer of that tenant requests transfer instructions
- THEN the bot message shows the new account's bank data
- AND the account shown is the active one created through the admin UI
