# Admin Payment Methods Specification

Domain: `admin-payment-methods` · Admin CRUD of the per-tenant `PaymentMethod` catalog that customizes the POS payment-method selector. Mirrors the structural shape of `payment-details` (list + create + partial edit + logical delete) with the deliberate, load-bearing differences locked in §1 (logical-state reversal), §2 (whitelisted wire payloads + `isActive` patchable), and §8 (domain-error map) of the change's `design.md`.

## Purpose

Give tenant admins a permission-gated surface to manage the per-tenant catalog of payment methods ("Mercado Pago", "SPEI Banorte", "Efectivo USD", etc.) so the cashier sees the correct destination label and the sale-detail snapshot carries the customer-facing name. The UI MUST expose active/inactive state via badges, MUST allow create + partial edit (including `isActive` for reactivation) + logical delete with confirmation, MUST keep `category` locked to the four enum values, MUST honor `DUPLICATE_NAME` (per-tenant uniqueness) and `ENTITY_NOT_FOUND` without leaking presence across tenants, and MUST NOT offer hard delete.

## Requirements

### REQ-PM-001: List catalog with active/inactive badges and view toggle

The list view at `/admin/payment-methods` SHALL be reachable only by users holding `read:PaymentMethod` and SHALL render every payment method for the current tenant — active AND inactive — in the order the backend returns them (`updatedAt` descending). Each row SHALL show a status badge derived from `isActive`: "Activo" when `true`, "Inactivo" when `false`. The view SHALL offer a table/cards toggle via `ViewToggle`, and both modes SHALL render from the same fetched data.

#### Scenario: admin with read permission sees every method

- GIVEN a user with `read:PaymentMethod` and a tenant with 3 methods (2 active, 1 inactive)
- WHEN the user opens `/admin/payment-methods`
- THEN the list renders 3 rows
- AND each active row shows the "Activo" badge
- AND the inactive row shows the "Inactivo" badge

#### Scenario: backend order is preserved by default

- GIVEN the backend returns methods ordered `updatedAt` descending
- WHEN the list renders without user-applied sorting
- THEN the most recently updated method is first
- AND the default client-side sort remains `updatedAt desc`

#### Scenario: table/cards toggle

- GIVEN table mode is the default
- WHEN the user toggles to cards
- THEN the cards view renders the same methods with the same badges
- AND the choice persists across reloads (mirrors `payment-details` REQ-PD-001)

#### Scenario: no-active banner is intentionally absent

- GIVEN a tenant whose fetched methods are ALL inactive
- WHEN the list view renders
- THEN no "Sin método activo" banner appears (empty/fully-inactive catalog is a valid opt-in state; the POS falls back to the 4 fixed tiles — see `pos-payment-method-tiles` REQ-PT-005)

### REQ-PM-002: Create method with strict whitelisted payload (no `isActive`)

The create slideover SHALL collect `name`, `category`, and `subtitle`. The submitted payload MUST contain ONLY those three keys (`subtitle` omitted when empty/whitespace-only) and MUST NOT contain `id`, `tenantId`, `isActive`, `createdAt`, `updatedAt`, or `metadataJson` — backend enforces this via `forbidNonWhitelisted`. Client-side validation SHALL require `name` 1..60 chars after trimming, `category` one of the four enum values, and `subtitle` ≤120 chars after trimming (optional). On success the row appears at the top of the list rendered as "Activo" (new methods are born active).

#### Scenario: happy path creates an active row

- GIVEN a user with `create:PaymentMethod` and a fully valid form (`name="Mercado Pago"`, `category="transfer"`, `subtitle="Link"`)
- WHEN the user submits
- THEN a POST is sent whose body is `{ name, category, subtitle }` only
- AND the list query is invalidated and refetched
- AND the new row appears at the top with the "Activo" badge

#### Scenario: payload never contains `isActive`

- GIVEN the create form is filled with valid data
- WHEN the submit payload is inspected
- THEN no `isActive`, `id`, `tenantId`, `createdAt`, `updatedAt`, or `metadataJson` key is present
- AND only `name`, `category`, and optionally `subtitle` are sent

#### Scenario: empty subtitle is omitted from the wire

- GIVEN the user leaves `subtitle` blank or enters only whitespace
- WHEN the submit payload is emitted
- THEN the `subtitle` key is omitted entirely (not sent as `""`)

#### Scenario: invalid name (empty or >60 chars)

- GIVEN a `name` that is empty/whitespace-only after trim OR exceeds 60 chars
- WHEN the user submits
- THEN the form shows the field-level validation error
- AND no request is sent

#### Scenario: invalid category rejected client-side

- GIVEN any value that is not one of `cash | card_credit | card_debit | transfer`
- WHEN the user inspects the category selector
- THEN that value is not offered as an option (`credit` is excluded structurally; see REQ-PM-008)

### REQ-PM-003: Partial edit (PATCH) with prefill and reversible `isActive`

The edit slideover SHALL prefill `name`, `category`, `subtitle`, and `isActive` with the row's current values and SHALL treat every field as optional (partial PATCH). Unlike `PaymentDetail`, the `PaymentMethod` update payload MUST allow `isActive: boolean` so the admin can toggle a row back to active without recreating it. On success the list query MUST be invalidated; because the backend bumps `updatedAt`, the edited row SHALL re-sort to the top under `updatedAt desc`.

#### Scenario: edit prefills current values

- GIVEN an existing method opened in edit mode
- THEN `name`, `category`, `subtitle`, and `isActive` show the method's current values

#### Scenario: partial patch of a single field

- GIVEN the user changes only `subtitle` from `"Link"` to `"QR"`
- WHEN the user submits
- THEN a PATCH is sent whose body is `{ subtitle: "QR" }` only
- AND the list query is invalidated and refetched
- AND the edited row shows the new subtitle

#### Scenario: edited method re-sorts to top

- GIVEN the method was not the most recently updated
- WHEN the edit succeeds
- THEN the list refetch shows the edited method first (its `updatedAt` bumped by the backend)

#### Scenario: reactivation via `isActive: true`

- GIVEN a previously-deactivated method (current `isActive: false`)
- WHEN the user flips the active toggle to on and submits
- THEN a PATCH is sent whose body contains `{ isActive: true }`
- AND the list refetch renders the row with the "Activo" badge
- AND the method reappears in the next `GET /sales/payment-methods` projection

#### Scenario: deactivation via `isActive: false` from the edit slideover

- GIVEN an active method
- WHEN the user flips the active toggle to off and submits
- THEN a PATCH is sent whose body contains `{ isActive: false }`
- AND the row's badge becomes "Inactivo"
- AND the method disappears from the next POS projection (per design §4)

### REQ-PM-004: Logical delete with mandatory confirmation and idempotency

DELETE SHALL require an explicit confirmation before any request is issued. Confirming SHALL send `DELETE /admin/payment-methods/:id` (HTTP `204` — `isActive` is flipped to `false`); the row MUST remain visible in the list rendered as "Inactivo". Repeating DELETE on an already-inactive row MUST NOT fail (idempotent per backend §3.5) and MUST NOT surface an error toast. The UI MUST NOT offer hard delete in any affordance.

#### Scenario: cancel does not delete

- GIVEN a user with `delete:PaymentMethod` opens the delete confirmation
- WHEN the user cancels
- THEN no DELETE request is sent
- AND the method keeps its current badge

#### Scenario: confirm deactivates

- GIVEN the delete confirmation
- WHEN the user confirms
- THEN a DELETE request is sent for that method id
- AND the list refetch renders the method with the "Inactivo" badge
- AND the method is no longer returned by the POS projection

#### Scenario: repeat delete is idempotent

- GIVEN an already-deactivated method
- WHEN the user deletes it again
- THEN the request succeeds (HTTP 204) without an error toast
- AND the row remains visible as "Inactivo"

#### Scenario: no hard delete affordance

- GIVEN any method row
- THEN no destructive hard-delete control is rendered in the kebab menu or anywhere else in the row
- AND no client-side call site constructs a non-DELETE mutation that would bypass the logical-delete contract

### REQ-PM-005: Row kebab actions reflect CASL verbs

The per-row kebab menu SHALL expose exactly the actions the current user is allowed to perform: "Editar" with `update:PaymentMethod`, "Desactivar" with `delete:PaymentMethod`. The menu SHALL be hidden entirely when the user holds neither verb. The kebab SHALL NOT expose a "Reactivar" entry — reactivation happens via the edit slideover's `isActive` toggle (REQ-PM-003). The kebab SHALL NOT expose "Eliminar definitivamente" (hard delete is not supported).

#### Scenario: read-only user sees no kebab

- GIVEN a user with only `read:PaymentMethod`
- WHEN the list view renders
- THEN no kebab menu is rendered on any row

#### Scenario: update-only user sees only Editar

- GIVEN a user with `read:PaymentMethod` and `update:PaymentMethod`
- WHEN the list view renders
- THEN each row's kebab exposes "Editar" only

#### Scenario: delete-only user sees only Desactivar

- GIVEN a user with `read:PaymentMethod` and `delete:PaymentMethod`
- WHEN the list view renders
- THEN each row's kebab exposes "Desactivar" only

### REQ-PM-006: Permission gating (CASL `PaymentMethod` subject)

Menu and route: the "Métodos de cobro" sidebar entry SHALL render only for users with `read:PaymentMethod`; direct navigation to `/admin/payment-methods` without that permission SHALL redirect to `/403` via the global `beforeEach`. Controls: the create button SHALL render only with `create:PaymentMethod`, "Editar" only with `update:PaymentMethod`, and "Desactivar" only with `delete:PaymentMethod`. CASL registration MUST include `'PaymentMethod'` as a member of `AppSubject` AND `APP_SUBJECTS` (verbatim insertion immediately before `'all'` per `auth.types.ts`/`ability.ts`) — without that runtime entry, `parsePermissionCode` returns `null` and the ability silently drops the permission.

#### Scenario: no read permission hides menu and route

- GIVEN a user without `read:PaymentMethod`
- WHEN the navigation renders
- THEN no "Métodos de cobro" entry appears
- AND navigating directly to `/admin/payment-methods` redirects to `/403`

#### Scenario: read only hides all mutation controls

- GIVEN a user with only `read:PaymentMethod`
- WHEN the list view renders
- THEN no create button, no edit controls, no delete controls, and no kebab menu are rendered

#### Scenario: full CRUD user sees all controls

- GIVEN a user with `create`, `update`, and `delete` on `PaymentMethod`
- WHEN the list view renders
- THEN the create button, the kebab menu, and both "Editar" and "Desactivar" actions are visible

#### Scenario: `'PaymentMethod'` is registered as a CASL subject

- GIVEN the admin roles i18n file
- WHEN the role-permissions UI enumerates subjects
- THEN a `Métodos de cobro` subject with exactly the four actions (`create`, `read`, `update`, `delete` — NO `manage`, NO `batch_delete`) is selectable
- AND the label text matches the `PERMISSION_COPY` block in design §5.1

### REQ-PM-007: Domain error mapping (code read from `error`)

Mutation failures SHALL map backend domain errors read from the `error` field of the `{ statusCode, error, message, timestamp }` envelope — never from `message`. The map SHALL cover at minimum: `INVALID_NAME`, `NAME_TOO_LONG`, `INVALID_CATEGORY`, `INVALID_SUBTITLE`, `SUBTITLE_TOO_LONG`, `DUPLICATE_NAME`, `ENTITY_NOT_FOUND`. `INVALID_*` / `*_TOO_LONG` are pre-validated client-side; their server-fallback toast MUST use the same wording as the domain map. `DUPLICATE_NAME` MUST surface the toast "Ya existe un método con ese nombre en esta sucursal" and the slideover MUST stay open. `ENTITY_NOT_FOUND` MUST surface "No encontrado" and MUST NOT reveal presence between tenants.

#### Scenario: duplicate name keeps the slideover open

- GIVEN the create/edit request returns 409 with `error: "DUPLICATE_NAME"`
- WHEN the mutation settles
- THEN the toast "Ya existe un método con ese nombre en esta sucursal" is shown
- AND the slideover remains open so the cashier can rename

#### Scenario: entity not found

- GIVEN a get-by-id, update, or delete request returns 404 with `error: "ENTITY_NOT_FOUND"`
- WHEN the mutation settles
- THEN the toast "No encontrado" is shown
- AND the implementation does NOT distinguish "missing" vs "another tenant" — the same toast covers both

#### Scenario: code read from `error`, not `message`

- GIVEN a 409 response whose `message` field differs from `error: "DUPLICATE_NAME"`
- WHEN the mutation settles
- THEN the mapping uses the `error` field and the duplicate-name toast is shown

#### Scenario: server-side validation fallback

- GIVEN the client-side validation passes but the server returns 400 with `error: "NAME_TOO_LONG"`
- WHEN the mutation settles
- THEN the field toast "El nombre no puede superar 60 caracteres" is shown
- AND the slideover stays open

#### Scenario: unknown error falls back to generic toast

- GIVEN the request fails with a code not in the domain map (network, 5xx, unmapped 4xx)
- WHEN the mutation settles
- THEN a generic error toast (via `normalizeApiError` fallback) is shown

### REQ-PM-008: Category selector excludes `credit`

The create/edit slideover's `category` selector SHALL expose exactly four options: "Efectivo" (`cash`), "Tarjeta de crédito" (`card_credit`), "Tarjeta de débito" (`card_debit`), "Transferencia" (`transfer`). The selector MUST NOT offer `credit` (the legacy sale-status marker, not a configurable method category). The wire value MUST be lowercase and one of the four enum values; any other value SHALL be rejected client-side by the zod schema before a request is sent. The category enum is sourced from `PAYMENT_METHOD_CATEGORY_VALUES` in `core/shared/constants/payment-method-category.ts` (design §2.1) so the admin and POS share a single source.

#### Scenario: selector renders exactly four options

- GIVEN the create or edit slideover is open
- WHEN the category selector is opened
- THEN it renders exactly four options: "Efectivo", "Tarjeta de crédito", "Tarjeta de débito", "Transferencia"
- AND no "Crédito" / "A crédito" option is present

#### Scenario: enum value is lowercase on the wire

- GIVEN a form filled with `category="Tarjeta de crédito"`
- WHEN the submit payload is emitted
- THEN `category` is the lowercase wire string `"card_credit"` (not the label)

#### Scenario: `credit` is rejected both client-side and server-side

- GIVEN a payload constructed by mistake with `category: "credit"`
- WHEN the submit handler runs
- THEN the zod schema rejects the value with the message "Selecciona una categoría válida"
- AND no request is sent
- AND the backend confirms the rejection contract (`400 INVALID_CATEGORY` if it ever reaches the server)

### REQ-PM-009: `subtitle` is optional and tolerates whitespace/empty

The `subtitle` field SHALL be optional. The slideover's submit handler SHALL trim the field and SHALL omit the key entirely from the wire payload when the trimmed value is empty (no `""` sent). The validation SHALL require `subtitle` ≤120 chars after trimming.

#### Scenario: whitespace-only subtitle is omitted

- GIVEN the user types `"   "` (only spaces) into the subtitle input
- WHEN the submit handler emits the payload
- THEN the `subtitle` key is omitted
- AND the backend stores `null`

#### Scenario: subtitle >120 chars is rejected client-side

- GIVEN a `subtitle` of 121 chars after trimming
- WHEN the user submits
- THEN the field-level error "El subtítulo no puede superar 120 caracteres" is shown
- AND no request is sent

### REQ-PM-010: Mutation lifecycle — list query invalidation

Create, edit, and delete mutations SHALL invalidate the admin list query key (`adminPaymentMethodQueryKeys.list(tenantId)`) on success. Because `useServerTable` appends `serverParams` to the list key, prefix-matching the base key MUST re-fetch every page/filter/sort slot in one call. Mutations MUST NOT invalidate the POS projection key (`saleQueryKeys.paymentMethods`) — admin and POS caches are scoped separately and cross-cache invalidation is out of scope (proposal). The mutation response MUST replace the affected row in the local cache when the backend returns the updated `PaymentMethodResponseDto`.

#### Scenario: create invalidates the list

- GIVEN a successful `POST /admin/payment-methods`
- WHEN the mutation settles
- THEN `adminPaymentMethodQueryKeys.list(tenantId)` is invalidated
- AND the new row is visible in the refetched list

#### Scenario: edit invalidates the list and bumps the row

- GIVEN a successful `PATCH /admin/payment-methods/:id`
- WHEN the mutation settles
- THEN `adminPaymentMethodQueryKeys.list(tenantId)` is invalidated
- AND the edited row is replaced with the backend response (new `updatedAt`, possibly new fields)

#### Scenario: delete invalidates the list

- GIVEN a successful `DELETE /admin/payment-methods/:id` (HTTP 204)
- WHEN the mutation settles
- THEN `adminPaymentMethodQueryKeys.list(tenantId)` is invalidated
- AND the row's badge becomes "Inactivo"

#### Scenario: admin mutations do not touch the POS cache

- GIVEN any successful admin mutation (create, edit, delete)
- WHEN the mutation settles
- THEN `saleQueryKeys.paymentMethods(tenantId)` is NOT invalidated (POS projection is fetched on demand by `useSalePaymentMethods`)

### REQ-PM-011: List view empty/loading/error states

The list view SHALL render: a table skeleton with the standard skeleton rows (and 8 card skeletons in card mode) while loading; an empty state with copy "No hay métodos de cobro" when the backend returns `[]`; a full-table error block with retry (NOT a toast) when the list fetch fails; a soft `:fetching` indicator when the query is re-running in the background.

#### Scenario: loading skeleton

- GIVEN the list query is in-flight
- WHEN the view mounts
- THEN skeleton rows render in the table (and 8 card skeletons in card mode)

#### Scenario: empty list shows the empty state

- GIVEN the backend returns `[]`
- WHEN the list renders
- THEN the "No hay métodos de cobro" empty state is shown
- AND the create button remains visible (subject to CASL gating)

#### Scenario: list-fetch error renders the error block

- GIVEN the list query fails (network, 403, 5xx)
- WHEN the mutation settles
- THEN the full-table error block is rendered with a retry button
- AND the "No hay métodos de cobro" empty state is NOT shown

#### Scenario: background refetch shows the soft indicator

- GIVEN the list is rendered and the user clicks the refresh control
- WHEN the refetch is in-flight
- THEN a soft `:fetching` indicator is shown
- AND the existing rows remain visible (no skeleton swap)

