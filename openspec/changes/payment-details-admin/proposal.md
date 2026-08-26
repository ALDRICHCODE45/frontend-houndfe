# Proposal — payment-details-admin (Datos bancarios)

## Summary / Intent (Why)

The WhatsApp bot charges customers by bank transfer and needs to tell each customer
which bank account to deposit into. Today that account data has no admin-facing
surface: there is no way to add, correct, or retire the bank accounts the bot
references, so the transfer instructions are effectively hardcoded or unmanaged
from the admin side.

This change adds a new admin bounded context **"Datos bancarios"** (`PaymentDetail`)
that gives tenant admins full, permission-gated control over the bank accounts used
for transfer payments. It is a standard tenant-scoped CRUD: list with active/inactive
badges, create, partial edit (PATCH), and logical deactivation (DELETE). It also
surfaces an explicit "no active account" banner so the operational state — is the
branch currently able to receive transfers? — is never silently wrong.

## Confirmed product decisions (settled — no open questions)

These were confirmed with the user before proposal. They are recorded here as fixed
assumptions, not as open items, and no proposal question round is required.

1. **Scope:** full CRUD + "sin cuenta activa" banner + CASL permission registration
   (the entire backend checklist).
2. **View:** table + cards via the existing `ViewToggle` primitive.
3. **No `isActive` toggle in forms.** The backend forbids `isActive` (sending it
   returns 400 via `forbidNonWhitelisted`). Create always starts active; deactivation
   is the DELETE (baja lógica) path only. There is no reactivation.
4. **Route:** `/admin/payment-details` (English, consistent with the other admin
   routes `/admin/users`, `/admin/roles`, `/admin/tenants`); menu label in Spanish
   **"Datos bancarios"**.
5. **Entity:** the bot must be able to show the correct active account. The
   "one active account per branch" rule is **operational** — the database does NOT
   enforce it. Design consequence: the UI must help avoid leaving a branch with no
   active account, i.e. warn/confirm when deactivating what appears to be the last
   active account.

## Scope (in)

- New feature module `src/features/admin/payment-details/` following the existing
  `users` / `tenants` / `employees` admin CRUD template:
  - API layer (`payment-details.api.ts`) for POST / GET / GET:id / PATCH / DELETE
    under `/admin/payment-details`, with a local payment-details error extractor.
  - Types (`interfaces/payment-detail.types.ts`) and domain error map
    (`interfaces/errors.ts`).
  - Form composable (`usePaymentDetailForm`) with zod schemas — create requires all
    four fields; edit makes them optional (partial PATCH). `isActive` is never in
    either schema.
  - Columns (`usePaymentDetailColumns`) and view-mode (`usePaymentDetailViewMode`)
    composables.
  - Dedicated mutation composables (`useCreatePaymentDetail`, `useUpdatePaymentDetail`,
    `useDeletePaymentDetail`) with list-query invalidation and domain-error mapping.
  - `PaymentDetailUpsertSlideover` (create/edit form), card view components, and the
    list view `AdminPaymentDetailsView` (table + cards + ViewToggle + ConfirmModal).
- Active/inactive badges (StatusDotBadge/AppBadge) in both table and card views.
- "Sin cuenta activa" banner, derived from the full (client-side) list rather than
  the current page slice, so it reflects the whole tenant.
- CASL subject registration (`PaymentDetail`) with exactly four actions:
  `create`, `read`, `update`, `delete` — no `manage`, no `batch_delete`.
- Menu gating: "Datos bancarios" entry hidden without `read:PaymentDetail`; route
  guard repeats the check and redirects to `/403`.
- Button gating: create/edit/delete controls shown only when the user holds the
  corresponding `*:PaymentDetail` permission.
- Query keys (`adminPaymentDetailQueryKeys`) registered centrally, tenant-scoped.

## Out of Scope (non-goals)

- **No reactivation.** Once deactivated (DELETE), an account can only be replaced by
  creating a new one.
- **No hard delete.** DELETE is always logical (`isActive=false`).
- **No `isActive` toggle** in the create/edit forms (backend-mandated; would 400).
- **No bot endpoint work.** The chatbot endpoint that reads the active account
  already exists and is not touched by this frontend change.
- **No simultaneous multi-active accounts.** The UI works within the "one active per
  branch" operational rule; it does not add UI to manage multiple actives.
- **No editing `tenantId`.** It is returned by the backend and rendered/typed only;
  never sent in create/update payloads.
- **No chatbot UI.** This change is admin CRUD only.
- **No migration.** The backend already performed any schema/data migration.
- **No new dependencies.** Everything reuses the established stack (Nuxt UI, zod,
  TanStack Query, CASL).

## Capabilities (scoped to `openspec/specs/`)

New capability spec(s) to be authored in the spec phase:

- `payment-details` — admin CRUD of bank accounts, permission gating, badges,
  active-account banner, and domain-error handling. Scenarios will cover list, create,
  partial edit, logical delete with confirmation, no-active-account banner, and the
  CASL/menu gating behavior.

Modified capabilities (no new subject semantics beyond registration):

- `authorization` — the `PaymentDetail` subject is added to the `AppSubject` union and
  `APP_SUBJECTS` registry so existing generic permission parsing works unchanged.

## Business rules the UI must honor

- **`isActive` is not editable.** The UI never includes `isActive` in create/edit
  schemas or payloads. Sending it yields a 400 (backend `forbidNonWhitelisted`).
- **One active account per branch (operational).** Enforced by UX, not the DB. The UI
  must warn when deactivating the last active account and surface the resulting
  "no active account" state via banner.
- **Logical delete is idempotent.** DELETE returns 204 and sets `isActive=false`.
- **`DUPLICATE_CLABE` (409)** maps to a specific user-facing toast (the CLABE is
  already registered for this tenant).
- **`ENTITY_NOT_FOUND` (404)** maps to a specific user-facing message (missing or
  cross-tenant id).
- **`NO_ACTIVE_PAYMENT_DETAIL` (404)** is a bot-endpoint code only; harmless to
  include in the map but not raised by admin CRUD.
- **403 gating.** No `read:PaymentDetail` → hidden menu item + route redirects to
  `/403`. No `create`/`update`/`delete` → corresponding buttons hidden.
- **Domain errors are read from `error`** in the `{ statusCode, error, message,
  timestamp }` envelope (not from `message`), per the backend domain-exception filter.

## Affected areas

New:

- `src/features/admin/payment-details/` (api, interfaces, composables, components,
  views, `__tests__`) — the entire new bounded context.

Modified:

- `src/features/auth/interfaces/auth.types.ts` — add `'PaymentDetail'` to `AppSubject`.
- `src/features/auth/authorization/ability.ts` — add `'PaymentDetail'` to `APP_SUBJECTS`.
- `src/features/admin/roles/i18n/permissions.ts` — add `PaymentDetail: 'Datos bancarios'`
  to `SUBJECT_LABELS`; add a `PaymentDetail` block to `PERMISSION_COPY` with exactly
  `create`/`read`/`update`/`delete` (no `manage`, no `batch_delete`). Leave
  `HIDDEN_SUBJECTS` unchanged.
- `src/app/navigation/navigation.registry.ts` — add `admin-payment-details` child to
  the `admin` group: `{ label: 'Datos bancarios', to: '/admin/payment-details',
  permission: ['read', 'PaymentDetail'] }`.
- `src/app/router/index.ts` — lazy import + route `/admin/payment-details` with
  `meta.permission: ['read', 'PaymentDetail']`.
- `src/core/shared/constants/query-keys.ts` — add `adminPaymentDetailQueryKeys`
  (list + detail, tenant-scoped).

## Approach

Mirror the existing admin CRUD conventions, choosing the closest template per concern:

- **List + client pagination:** the backend returns a flat array (no `{ data, meta }`),
  ordered `updatedAt DESC`. Follow the `tenants` pattern: wrap the flat array into a
  `PaginatedResponse` client-side, apply local `globalFilter` (search across `bankName`,
  `beneficiary`, `clabe`, `accountNumber`) and sorting, defaulting to
  `updatedAt desc` to preserve backend order. Drive it with `useServerTable`.
- **Form:** `USlideover` + `UForm :schema` + zod (create all-required, edit all-optional,
  `isActive` never present), following `useTenantForm`.
- **Deactivation:** `ConfirmModal` with `confirm-label "Desactivar"`, `confirm-color
  "error"`, and a warning that the bot will stop showing this account — strengthened
  when it is the last active account for the branch.
- **Mutations:** dedicated composables (`useCreatePaymentDetail`, etc.) following the
  `employees` pattern: `useMutation`, success toast, invalidate the list query key, and
  map domain errors via a local `extractPaymentDetailErrorCode` (avoiding a type leak
  from the employees module).
- **Error mapping:** local `interfaces/errors.ts` is the single source for
  `PAYMENT_DETAIL_ERROR_MAP`, reading `error.response.data.error`.
- **Banner:** since the list is small and client-paginated, keep the full fetched array
  available to the view and derive both the paginated table data and the
  `hasActiveAccount` flag from it (the main open design decision; resolved in design.md).

## Impact (areas + reuse)

Reused primitives (no reinvention): `useServerTable`, `useViewMode`, `AppDataTable`,
`ViewToggle`, `USlideover`, `UForm`, `ConfirmModal`, `StatusDotBadge`/`AppBadge`,
`createSimpleHeader`, toast provider, and the existing CASL `userCan`/route-guard
machinery. Permission parsing, the navigation registry, the router guard, and the role
permissions UI all pick up `PaymentDetail` automatically once the subject is registered
in the four listed touch points.

No shared primitives change. No existing feature behavior changes.

## Risks / Unknowns

1. **"One active per branch" is not DB-enforced.** Deactivating the last active
   account silently leaves the branch unable to show transfer instructions. Mitigation:
   confirmation with an explicit warning (and the "sin cuenta activa" banner as the
   persistent signal). Resolved decision: warn + confirm + banner.
2. **Banner vs. paginated slice.** `useServerTable` only exposes the current page;
   the banner needs the full list. Mitigation: keep the full array in the view and
   derive both table page data and `hasActiveAccount` from it (design.md will lock this).
3. **Default sort vs. backend order.** Client-side sorting must default to
   `updatedAt desc` to avoid reordering the canonical backend order.
4. **Error envelope drift.** The tenants convention reads `.message`; the correct
   source for domain codes is `.error`. Payment-details uses the `.error` convention.
5. **Route path naming** was the one open item from exploration; it is now settled as
   `/admin/payment-details` (English, matching module + backend + sibling admin routes).

## First Slice Scope

1. **S1 — registration + types + keys:** `auth.types.ts`, `ability.ts`, `query-keys.ts`,
   `interfaces/*`, `permissions.ts` (`SUBJECT_LABELS` + `PERMISSION_COPY`). Unlocks
   permission parsing and the list query key. Independently verifiable.
2. **S2 — read-only list:** `payment-details.api.ts` + `interfaces/errors.ts` +
   `useServerTable` wiring + `usePaymentDetailColumns` + `usePaymentDetailViewMode` +
   `AdminPaymentDetailsView` (badges + table/card toggle), no mutations.
3. **S3 — mutations:** slideover form + `useCreatePaymentDetail` /
   `useUpdatePaymentDetail` / `useDeletePaymentDetail` + ConfirmModal + error toasts.
4. **S4 — banner + polish + tests:** "Sin cuenta activa" banner, card-view polish,
   and completion of co-located unit tests.

Slices 1–3 are independently verifiable; slice 4 is UI polish and can land separately.
All slices follow the strict-TDD cycle (RED/GREEN/TRIANGULATE/REFACTOR) within the
400-line budget.

## Rollback Plan

The feature is isolated to `src/features/admin/payment-details/` plus four small,
reversible registration edits (`auth.types.ts`, `ability.ts`, `permissions.ts`,
`query-keys.ts`) and two routing/navigation edits. Rollback is a git revert of the
feature branch: removing the registration edits removes the subject, the menu entry,
the route, and the permission UI entries atomically. No data or backend migration is
involved on the frontend, so there is no data rollback surface.

## Success Criteria

Measurable and verifiable in the verify phase:

1. A user with `read:PaymentDetail` sees the "Datos bancarios" menu entry; the list
   loads at `/admin/payment-details` with active/inactive badges and table/card toggle.
2. A user without `read:PaymentDetail` does NOT see the menu entry, and direct
   navigation to `/admin/payment-details` redirects to `/403`.
3. The create button is visible only with `create:PaymentDetail`, edit only with
   `update:PaymentDetail`, and delete only with `delete:PaymentDetail`.
4. Creating an account (no `isActive` field) returns 201 and the new account appears at
   the top of the list (`updatedAt desc`) as active.
5. PATCH updates persist and invalidate the list; the form never sends `isActive`.
6. DELETE shows the confirmation and results in an `isActive=false` badge switch
   (logical delete, idempotent on repeat).
7. The "Sin cuenta activa" banner renders when no account is active and disappears when
   at least one active account exists.
8. `DUPLICATE_CLABE` (409) and `ENTITY_NOT_FOUND` (404) each surface their specific
   user-facing toast (domain code read from `error`).
9. Deactivating the last active account warns the user before confirming.
10. `pnpm test:unit --run` passes for the new `payment-details` co-located specs;
    `vue-tsc --build` is clean.
