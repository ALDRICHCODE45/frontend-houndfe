# Proposal: Notification Configuration (Sistema → Configuración → Notificaciones)

## Intent

Tenant admins need a UI to control WHO receives the email when a product's `minQuantity` is breached. Backend already implements the edge-triggered one-shot `LOW_STOCK` email. We ship the tenant-scoped settings screen — master kill-switch, recipient multi-select, module-grouped action list — data-driven so new modules/actions require config, not restructure.

## Scope

### In Scope
- Route `/sistema/configuracion/notificaciones` + sidebar entry under Sistema → Configuración, gated `['read','NotificationConfig']`.
- Feature folder `src/features/system/notifications/` (api/composables/interfaces/views/components/__tests__).
- **Auth prerequisite**: add `'NotificationConfig'` to `AppSubject` (`auth.types.ts`) + `APP_SUBJECTS` (`ability.ts`).
- GET `/notification-config` hydration; PUT save with snapshot-based `isDirty` guard + in-flight disable.
- Recipient multi-select (`USelectMenu :multiple`) from `GET /users/assignable`.
- `UAccordion` shell grouping actions BY MODULE (first: "Punto de venta" → "Bajo inventario").
- Spanish error map: `UNKNOWN_ACTION_KEY` → toast; `INVALID_RECIPIENT` → recipient field; 400/401/403 fallbacks.
- Tests: pure mappers (`toConfigPayload`, `fromConfigResponse`, `toPutBody`, `mapNotificationConfigError`, `isDirty`) + composable + view render states.

### Out of Scope
- Email/Inngest/alert detection (backend); thresholds (`minQuantity`); low-stock dashboard; alert history/logs.
- Other Configuración tabs (General/Seguridad/Integraciones) — no empty shell.

## Capabilities

### New Capabilities
- `notification-config`: the UI module — screen, route, sidebar entry, GET/PUT client, query/mutation, action-registry data model, recipient picker, error mapping, 403/loading/empty states, and the `NotificationConfig` permission-subject registration.

### Modified Capabilities
None.

## Approach

- **Composition API + `<script setup lang="ts">`**, feature-folder layout. Stateful logic in composables; UI in views/components.
- **HTTP**: single `src/core/shared/api/http.ts`. NEVER pass `tenantId` (carried in JWT). Base URL env `VITE_API_BASE_URL`.
- **TanStack Query**: `useNotificationConfigQuery` mirrors `useEligibleUsersQuery` (`useQuery` + computed key); `useUpdateNotificationConfigMutation` mirrors `useUpdateEmployee` (`useMutation` → `invalidateQueries` + Spanish toast + mapped error). Query key: `notificationConfigQueryKeys.config(tenantId)`.
- **Pure mappers (extracted, test-first)**:
  - `toConfigPayload(enabled, recipientIds, enabledActions)` — ON ⇒ `enabled:true, enabledActions:["LOW_STOCK"]`; OFF ⇒ `enabled:false, []`.
  - `fromConfigResponse(view)` — `recipients` → form `recipientUserIds`.
  - `toPutBody(formState)` — EXACTLY `{enabled, recipientUserIds, enabledActions}`. No extras (forbidNonWhitelisted).
  - `mapNotificationConfigError(code)` — `Record<string,string>` uppercase + `FALLBACK_ERROR_MESSAGE`. `INVALID_RECIPIENT` → field; `UNKNOWN_ACTION_KEY` → toast.
  - `isDirty(state, pristine)` — snapshot diff for save gating.
- **Action registry (data-driven, NOT hardcoded)**:
  `[{ moduleKey:'pos', moduleLabel:'Punto de venta', actions:[{ key:'LOW_STOCK', label:'Bajo inventario' }] }]` — accordion iterates this; adding modules/actions is config, not restructure.
- **Toggle semantics (DECIDED)**: `enabled` = independent master kill-switch; `enabledActions` = per-action membership. Master OFF greys action toggles. "Configured but paused" is allowed.
- **Save guard**: disabled when `(a)` not dirty, `(b)` `mutation.isPending`, `(c)` any action enabled AND `recipientUserIds.length === 0` (inline Spanish: "Selecciona al menos un usuario a notificar").
- **Stale recipient**: id in `recipients` absent from `/users/assignable` → non-removable `Usuario no disponible` chip.
- **Tests**: `pnpm test:unit` (vitest); gate `pnpm build`. Extract-before-mock. `mountWithUApp.ts` for Nuxt UI injection.

## UX States

| State | Behavior |
|---|---|
| Loading | `USkeleton` block; no controls enabled |
| No row yet | Render defaults OFF/empty as disabled form — NOT an error |
| No `read` perm | Hide sidebar entry; route guard → `/403` |
| No `update` perm | Save disabled with Spanish tooltip "No tienes permisos para guardar cambios" |
| Dirty + valid | Save enabled |
| Save in-flight | Save disabled |
| Stale recipient | `Usuario no disponible` chip, not auto-removed |
| Save error | Toast for `UNKNOWN_ACTION_KEY`/generic; field-level inline for `INVALID_RECIPIENT` |
| Save success | Spanish toast; `invalidateQueries` refetch |

## Acceptance Criteria

- [ ] `NotificationConfig` added to `AppSubject` and `APP_SUBJECTS`; `userCan('read','NotificationConfig')` returns true for granted users.
- [ ] Route + sidebar entry gated `['read','NotificationConfig']`; route guard sends unauthorized to `/403`.
- [ ] GET hydrates form; absent row renders defaults OFF/empty (no error toast).
- [ ] PUT body contains EXACTLY `{enabled, recipientUserIds, enabledActions}` — unit-tested.
- [ ] Master toggle ↔ `enabled`; per-action toggle ↔ `enabledActions` membership; master OFF greys action toggles.
- [ ] Save disabled when not dirty, in-flight, or (action enabled AND zero recipients).
- [ ] Stale id renders as `Usuario no disponible` chip — not auto-removed.
- [ ] `INVALID_RECIPIENT` → field-level Spanish; `UNKNOWN_ACTION_KEY` → toast; 401/403/400 fallbacks mapped.
- [ ] Action registry is data-driven; adding a module/action needs only a registry entry.
- [ ] `pnpm test:unit` + `pnpm build` green; pure mappers tested first.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/features/auth/interfaces/auth.types.ts` | Modified | Add `'NotificationConfig'` to `AppSubject` union |
| `src/features/auth/authorization/ability.ts` | Modified | Add `'NotificationConfig'` to `APP_SUBJECTS` |
| `src/core/shared/constants/query-keys.ts` | Modified | Add `notificationConfigQueryKeys.config(tenantId)` |
| `src/app/router/index.ts` | Modified | New lazy route + `meta.permission` |
| `src/app/composables/useSidebar.ts` | Modified | New Sistema/Configuración group + Notificaciones child |
| `src/features/system/notifications/**` | New | Full feature folder |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| GET `recipients` ↔ PUT `recipientUserIds` asymmetry | High | Isolated pure mappers, unit-tested |
| `/users/assignable` returns role-filtered subset (not all tenant users) | Medium | Confirm with backend before impl |
| `NotificationConfig` missing from subject registries blocks access | High (req) | Add both edits in this change |
| `forbidNonWhitelisted` rejects extras on PUT | Medium | `toPutBody` asserts exactly 3 fields, unit-tested |
| Master OFF + action ON "on-but-off" confusion | Low | Action toggles greyed when master OFF; copy clarifies master wins |
| `UAccordion` usage not yet established in repo | Low | Component is auto-registered by Nuxt UI plugin; light test surface |

## Rollback Plan

Single PR, no DB migrations, no infra. Revert PR restores all edits (route, sidebar, two auth-subject changes, feature folder). No other code references `NotificationConfig` — removing the subject breaks only this feature's permissions.

## Dependencies

- Backend `GET`/`PUT /notification-config` (implemented).
- `GET /users/assignable` (exists; scope confirmation needed — see Open Questions).
- `@nuxt/ui` `UAccordion` (auto-registered); TanStack Vue Query; Vitest.

## Success Criteria

- [ ] User with `read+update:NotificationConfig` edits, saves, sees Spanish success toast; GET roundtrip reflects new state.
- [ ] User without `update` sees Save disabled with Spanish notice; user without `read` cannot reach the screen.
- [ ] `pnpm test:unit` + `pnpm build` green.

## Open Questions for Backend

1. `GET /users/assignable` — does it return ALL active tenant users, or a role-filtered subset (sellers only)?
2. Does `AssignableUser` (`{id, name}`) include `email`/`displayName`? Can we extend it for the picker display? (Email is display-only; not sent to backend.)