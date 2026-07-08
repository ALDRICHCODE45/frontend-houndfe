# Exploration: notification-config

> SDD EXPLORE phase — read-only investigation. No application code written.
> Frontend module: **Sistema → Configuración → Notificaciones**. Backend already implemented.
> Store mode: hybrid (Engram authoritative `sdd/notification-config/explore` + this file).

## Current State

There is **NO** Configuración/Notificaciones screen, route, sidebar entry, feature folder, or
`NotificationConfig` permission subject in the frontend today. Confirmed:

- `src/app/router/index.ts` — no `configuracion`/`notificaciones`/`sistema` route. Routes are a flat
  array of lazy `import()` views with `meta: { layout: 'dashboard', permission: [action, subject] }`.
- `src/app/composables/useSidebar.ts` — `getNavigationItems()` builds groups (`Dashboard`, `POS`,
  `RR.HH.`, `Admin`) with `children[]`; no `Sistema`/`Configuración` group exists.
- `src/features/auth/interfaces/auth.types.ts` + `src/features/auth/authorization/ability.ts` — the
  `AppSubject` union and `APP_SUBJECTS` array **do NOT include `NotificationConfig`**.

The feature must be built from scratch as a new `src/features/system/notifications/` (or
`src/features/admin/notifications/`) module, following the repo's feature-folder convention
(`api/`, `composables/`, `interfaces/`, `views/`, `components/`, `__tests__/`).

## Affected Areas

- `src/app/router/index.ts` — register the new route + `meta.permission: ['read','NotificationConfig']`.
- `src/app/composables/useSidebar.ts` — add a `Sistema`/`Configuración` group with a `Notificaciones`
  child guarded by `['read','NotificationConfig']`.
- `src/features/auth/interfaces/auth.types.ts` — add `'NotificationConfig'` to the `AppSubject` union. **(required)**
- `src/features/auth/authorization/ability.ts` — add `'NotificationConfig'` to `APP_SUBJECTS`. **(required)**
- `src/core/shared/constants/query-keys.ts` — add `notificationConfigQueryKeys`.
- New feature folder: `api/notification-config.api.ts`, `composables/useNotificationConfig*.ts`,
  `interfaces/notification-config.types.ts`, `views/NotificationsSettingsView.vue`, components, `__tests__/`.

## Investigation Findings (per goal)

### 1. Settings/Configuración precedent + form pattern
- No settings screen exists. Closest FULL-PAGE form-with-save precedents are slideover forms
  (`MembershipUpsertSlideover.vue`, `EmployeeEditSlideover.vue`) and the form-state composable
  pattern `useRoleForm.ts` (`reactive(getInitialState())` + `resetForm()` + `setValues(partial)`).
- **save-in-flight**: established via `mutation.isPending` (e.g. `AdminRolesView.vue`,
  `ProductDetailView.vue` bind `:loading`/`:disabled` to `*Mutation.isPending.value`).
- **dirty tracking / save-disabled-when-not-dirty**: **NO existing pattern** in feature forms
  (no `JSON.stringify` snapshot / `isDirty` computed found under `src/features/**`). This is a GAP —
  we will introduce a snapshot-based `isDirty = computed(() => !deepEqual(state, pristine))` and gate
  the save button on it. Keep the comparison as an EXTRACTED pure function for TDD.

### 2. Tenant user list endpoint — RECOMMENDATION: `/users/assignable`
| Endpoint | File | Shape | Perm required | Verdict |
|---|---|---|---|---|
| `/users/assignable` | `POS/users/api/user.api.ts` → `AssignableUser[]` | plain array `{id,name}` | operational (JWT tenant) | **RECOMMENDED** |
| `/admin/users` | `admin/users/api/users.api.ts` | `{data, meta:{page,limit,total,totalPages}}` | `read:User` | too heavy / wrong perm |
| `/admin/tenants/:tenantId/members` | `admin/tenants/memberships/api/memberships.api.ts` | `{data}` | `read:TenantMembership` + tenantId path | wrong perm/scope |
| `/admin/tenants/:tenantId/eligible-users` | same file | `{data, meta}` | `read:TenantMembership` | returns NON-members (opposite intent) |

**Justification**: Our screen is gated by `read/update:NotificationConfig`, NOT `read:TenantMembership`
or `read:User`. Using `/admin/*` or `/members`/`/eligible-users` would couple the picker to a
permission our notification-admin users may not hold → 403. `/users/assignable` is the tenant-scoped
operational user list (tenant from JWT), returns exactly `{id, name}` = USER IDs + display names, no
pagination needed for a picker. The R-FE5-001 regression test (`cashier-membership-regression.spec.ts`)
only scans `src/features/POS`, so it does NOT bind our Sistema/admin module — but its INTENT (don't
depend on `read:TenantMembership` from a screen reachable without it) reinforces choosing
`/users/assignable`.
**FLAG**: `/users/assignable` was built for seller assignment — verify with backend that it returns
ALL active tenant users, not a role-filtered subset. Ties to open question #2. Also `AssignableUser`
has no `email`; if the picker must show email, extend the type/endpoint.

### 3. HTTP client + auth/tenant
- Single axios instance: `src/core/shared/api/http.ts`. Request interceptor attaches
  `Authorization: Bearer <token>` from `authStorage`. **Tenant is NEVER sent as header/param — it is
  carried inside the JWT; backend resolves tenant from the token** (same as `satKey.api.ts`,
  `product.api.ts`). Base URL env var: **`VITE_API_BASE_URL`** (default `http://localhost:3000`).
  401 → transparent refresh + retry is built in. Just call `http.get/put('/notification-config', ...)`
  with a relative path and never pass tenantId.

### 4. Multi-select component — `USelectMenu :multiple`
- Established multi-select pattern: `USelectMenu` with `:multiple="true"` (`MultiSelectAsyncFilter.vue`,
  `MultiSelectEnumFilter.vue`, `PromotionConditionsSection.vue`, `MembershipUpsertSlideover.vue`).
  Single-select async precedent: `ManagerPicker.vue`.
- Recommend `USelectMenu multiple` with `:items` mapped from the user list to `{ label: name, value: id }`
  and a value-key so `v-model` holds an array of USER IDs (matches `recipients: string[]`).
- To render selected NAMES for the ids from GET `recipients`: load the user list first; USelectMenu
  resolves labels from `items` by value. The "4 seleccionados" chip is done via USelectMenu's trigger
  slot showing `modelValue.length`.

### 5. Accordion — `UAccordion` (available)
- `UAccordion` is present in the Nuxt UI runtime (`node_modules/@nuxt/ui/dist/runtime/components/Accordion.vue`)
  and auto-registered globally by the Nuxt UI Vite plugin. It is NOT yet used anywhere (hence absent
  from the usage-generated `components.d.ts`) but is fully available. Use `UAccordion :items` for
  "Acciones a notificar" grouped by module (first item = "Punto de venta" → "Bajo inventario").

### 6. Routing + sidebar wiring
- Add route (e.g. `/sistema/configuracion/notificaciones`, name `system-notifications`) with
  `meta: { layout: 'dashboard', permission: ['read','NotificationConfig'] }`. Guard already enforces
  `to.meta.permission` via `authStore.userCan` in `router.beforeEach` → `/403` on fail.
- Add a `Sistema`/`Configuración` group in `useSidebar.getNavigationItems()` with a `Notificaciones`
  child `permission: ['read','NotificationConfig']`.
- **FLAG**: mockup implies Configuración as a tabbed section ("Notificaciones" tab). Decide in propose:
  single route vs a Configuración shell view with `UTabs`.

### 7. Permission handling — CRITICAL prerequisite
- Permissions read via `authStore.userCan(action, subject)` (CASL ability built from permission codes).
- `parsePermissionCode` in `ability.ts` REJECTS unknown subjects. Because `NotificationConfig` is
  missing from `AppSubject` + `APP_SUBJECTS`, a backend `read:NotificationConfig` code is silently
  dropped and `userCan('read','NotificationConfig')` returns `false`. **Adding `NotificationConfig`
  to BOTH the `AppSubject` union AND `APP_SUBJECTS` is a REQUIRED prerequisite** (also unblocks the
  typed route `meta.permission` tuple).
- 403 handling: route guard → `/403`; in-screen hide/disable via `userCan('update','NotificationConfig')`
  to disable the save button / show a read-only notice.

### 8. Query keys + TanStack conventions
- Add to `src/core/shared/constants/query-keys.ts`:
  `notificationConfigQueryKeys = { config: (tenantId: string) => ['notification-config', tenantId] as const }`
  (keys are tenant-scoped throughout the repo).
- Query composable: mirror `useEligibleUsersQuery.ts` (`useQuery` + `computed` key).
- Mutation composable: mirror `useUpdateEmployee.ts` (`useMutation` + `onSuccess` →
  `queryClient.invalidateQueries({ queryKey: notificationConfigQueryKeys.config(tenantId) })` +
  Spanish success toast; `onError` → mapped Spanish error toast). NEVER send tenantId.

### 9. Error mapping precedent
- Mirror `mapMembershipError` / `mapEligibleUsersError` in `memberships.api.ts`
  (`Record<string,string>` + normalized-uppercase lookup + `FALLBACK_ERROR_MESSAGE`). Create
  `NOTIFICATION_CONFIG_ERROR_MAP` + `mapNotificationConfigError(codeOrMessage)`.
- Field-vs-toast split (satKey precedent = `SAT_KEY_NOT_FOUND` → `fields.satKey`):
  - `INVALID_RECIPIENT` → recipient field error, Spanish e.g. "Uno de los usuarios seleccionados no
    pertenece a esta cuenta" (offending ids come in `message`).
  - `UNKNOWN_ACTION_KEY` → general toast.
  - 400 class-validator / 401 / 403 → generic mapped messages.

### 10. Loading skeleton pattern
- `USkeleton` with `v-if="isLoading"` (`ExpiringDocumentsView.vue`, `PendingApprovalsView.vue`,
  `EmployeeDetailView.vue`, `AdminPageHeader.vue`). Mirror for the GET `/notification-config` load state.

### 11. Testing / strict-TDD
- Runner `pnpm test:unit` (vitest); authoritative gate `pnpm build`. Extract-before-mock;
  `src/test/mountWithUApp.ts` for Nuxt UI injection. Extract these PURE functions for direct unit tests:
  - `toConfigPayload(enabled, recipientIds, enabledActions)` — toggle→payload mapping
    (ON ⇒ `enabled:true, enabledActions:["LOW_STOCK"]`; OFF ⇒ `enabled:false, []`).
  - `fromConfigResponse(view)` — GET→form hydration, mapping GET `recipients` → form `recipientUserIds`.
  - `toPutBody(formState)` — form→PUT adapter sending EXACTLY the 3 whitelisted fields
    (`enabled`, `recipientUserIds`, `enabledActions`) — no extras (forbidNonWhitelisted).
  - `mapNotificationConfigError(codeOrMessage)` — error mapping.
  - `isDirty(state, pristine)` — dirty comparison for save gating.

## Approaches

1. **Full modular shell (DECIDED by product owner)** — master toggle "Notificaciones" + "Usuarios a
   notificar" `USelectMenu multiple` + "Acciones a notificar" `UAccordion` grouped by module (first:
   "Punto de venta" → "Bajo inventario"). Future-proof for more modules/actions.
   - Pros: matches mockup; extensible without restructuring; testable pure mappers.
   - Cons: more components than v1 strictly needs; must design the action-registry data model now.
   - Effort: Medium.

2. ~~Single-toggle-only layout~~ — REJECTED by product owner (do not hardcode).

## Recommendation

Proceed with Approach 1. Build `src/features/system/notifications/` with: an action-registry data
structure (`[{ moduleKey:'pos', moduleLabel:'Punto de venta', actions:[{ key:'LOW_STOCK',
label:'Bajo inventario' }] }]`) driving the accordion, `/users/assignable` for the recipient picker,
pure mapper functions (payload/hydration/error/dirty) written test-first, TanStack query+mutation
composables mirroring `useEligibleUsersQuery`/`useUpdateEmployee`, and the two required auth-subject
edits. Wire the route + a new Sistema/Configuración sidebar group.

## Risks

- **Field-name asymmetry** (HIGH): GET returns `recipients`, PUT expects `recipientUserIds`. Isolate in
  a tested `fromConfigResponse`/`toPutBody` adapter to avoid a silent no-op save.
- **Endpoint choice** (MEDIUM): `/users/assignable` is recommended, but its "assignable/seller"
  semantics may not equal "all tenant users." Verify scope with backend before propose lock-in.
- **Missing permission subject** (HIGH/required): `NotificationConfig` absent from `AppSubject` +
  `APP_SUBJECTS` — without adding it, the screen can never be granted and route typing fails.
- **Master vs action toggle ambiguity** (product): see open questions.
- **forbidNonWhitelisted**: PUT must send exactly the 3 whitelisted fields, all three, every time.

## Open Product Questions (flag for propose — do NOT decide here)

1. **Master vs per-action toggle semantics (one action)**: how does `enabled` (master) relate to the
   "Bajo inventario" action toggle?
   - Rule A — *Master is derived*: master ON iff `enabledActions.length > 0`. Toggling the single
     action IS the master; master toggle just bulk on/off all actions. Simple; no impossible states;
     but "master OFF + action ON" cannot be represented (fine for v1).
   - Rule B — *Master is an independent kill-switch*: `enabled` gates delivery independently of
     `enabledActions`. Allows "configured but paused" (master OFF, action ON). More flexible/future-proof
     but introduces a 4-state matrix and a possibly-confusing "on but off" state for v1.
   - Tradeoff: A is simpler and matches a one-action v1; B preserves the backend's two-field model and
     scales to many actions. Recommend deciding in propose.
2. **Recipient picker population**: list ALL tenant users, or only users holding a specific
   permission/role (e.g. those who can receive stock notifications)? Depends on `/users/assignable`
   scope (risk above).

## Ready for Proposal

**Yes.** Next phase: `propose`. Tell the user: backend contract is consumable as-is; two required
prerequisite edits identified (`NotificationConfig` subject); recommended recipient endpoint is
`/users/assignable` (pending backend scope confirmation); two product decisions must be resolved in
propose (master/action toggle semantics + recipient population).
