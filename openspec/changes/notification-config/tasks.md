# Tasks: notification-config

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: High

Estimated ~1500–1800 lines. Solo, no PRs — intra-branch commit boundaries.

**Pause points**: P1=after WU-1 · P2=after WU-3 · P3=after WU-5 · P4=after WU-8 · P5=after WU-11 · P6=after WU-13.

## Phase 1 — Foundation  [P1]
- [x] 1.1 **WU-1**: add `'NotificationConfig'` to `AppSubject` (`auth.types.ts`) and `APP_SUBJECTS` (`ability.ts`).
- [x] 1.2 **WU-1 test**: extend `ability.test.ts` — `userCan('read','NotificationConfig')` true; `parsePermissionCode` returns tuple.
- [x] 1.3 **WU-2**: `interfaces/notification-config.types.ts` (response/put/form, `ActionKey='LOW_STOCK'`, `ActionDescriptor`, `ModuleDescriptor`).
- [x] 1.4 **WU-2**: add `notificationConfigQueryKeys.config(tenantId)` to `query-keys.ts` + tuple-shape test.

## Phase 2 — Pure core (TDD, ZERO mocks)  [P2]
- [x] 2.1 **WU-3 RED**: `utils/__tests__/notificationConfigMappers.spec.ts` — `fromConfigResponse`, `toPutBody` (EXACTLY 3 keys), `isDirty`, `mapNotificationConfigError` (INVALID_RECIPIENT→field; UNKNOWN_ACTION_KEY→toast), `computeCanSave`, `computeZeroRecipientViolation`.
- [x] 2.2 **WU-3 GREEN**: `utils/notificationConfigMappers.ts` with the 6 pure functions; refactor pass.
- [ ] 2.3 **WU-4**: `registry/action-registry.ts` (`ACTION_REGISTRY: ModuleDescriptor[]`; pos → LOW_STOCK) + shape + `ActionKey` membership test.

## Phase 3 — Server-state composables  [P3 / P4]
- [ ] 3.1 **WU-5 RED**: `api/__tests__/notificationConfig.api.spec.ts` (mirror `memberships.api.spec`) — `get()`→`GET /notification-config`; `update()`→`PUT` with exactly `{enabled, recipientUserIds, enabledActions}`.
- [ ] 3.2 **WU-5 GREEN**: `api/notificationConfig.api.ts` with `get/update`, `NOTIFICATION_CONFIG_ERROR_MAP`, `mapNotificationConfigError`.
- [ ] 3.3 **WU-6**: `composables/useNotificationConfigQuery.ts` (mirror `useEligibleUsersQuery`: `useQuery`, tenantId from `useAuthStore`, `keepPreviousData`) + test (mount, `isLoading`, `data` shape).
- [ ] 3.4 **WU-7**: `composables/useUpdateNotificationConfigMutation.ts` (mirror `useUpdateEmployee` STRUCTURE only — PUT not PATCH; invalidate `notificationConfigQueryKeys.config(tenantId)`; Spanish success toast; error map → `{field,toast}`) + test.
- [ ] 3.5 **WU-8**: `composables/useNotificationConfigForm.ts` (snapshot `pristine` + reactive `form`; exposes `form, isDirty, canSave, zeroRecipientViolation, save()`) + test (`save()`→`toPutBody`; `canSave` false on pending/not-dirty/zero-recipient/no-update-perm).

## Phase 4 — UI components (props↓/emits↑)
- [ ] 4.1 **WU-9a**: `components/MasterToggle.vue` (USwitch wrapper, `modelValue:boolean`, `@update:modelValue`).
- [ ] 4.2 **WU-9b**: `components/RecipientSelect.vue` (USelectMenu `:multiple`; props `assignable, modelValue, disabled, error?`; `"Usuario no disponible"` chip for absent ids; never auto-strips) + test.
- [ ] 4.3 **WU-9c RED**: smoke render test for `ActionsAccordion.vue` (`mountWithUApp`) — every module + action label renders from registry. **No in-repo UAccordion precedent** — first contact contract.
- [ ] 4.4 **WU-9c GREEN**: `ActionsAccordion.vue` → `ModuleAccordionItem.vue` → `ActionRow.vue` (UAccordion; `disabled = !masterEnabled`; emits checked keys) + test (master-OFF greys rows; flip adds key, emits dirty).

## Phase 5 — View + routing + permission gating  [P5]
- [ ] 5.1 **WU-10**: `views/NotificationConfigView.vue` (composition surface: composables + USkeleton on `isLoading`, defaults render, Spanish inline errors) + test (skeleton; defaults; no error toast on 404).
- [ ] 5.2 **WU-11**: lazy route `/sistema/configuracion/notificaciones` in `app/router/index.ts` (`meta.permission: ['read','NotificationConfig']`) + sidebar entry Sistema → Configuración in `app/composables/useSidebar.ts` (guarded, direct link, no empty tabs).
- [ ] 5.3 **WU-12**: in view, gate Save with `userCan('update','NotificationConfig')`; show Spanish `"No tienes permisos para guardar cambios"`.

## Phase 6 — Final verification  [P6]
- [ ] 6.1 **WU-13**: `pnpm test:unit` all green; `pnpm build` (vue-tsc --build + vite build) green.
- [ ] 6.2 **WU-13 manual**: toggle master + action; assign user; save; refresh; verify persisted.
- [ ] 6.3 **WU-13 manual**: revoked perm → 403 redirect + sidebar hidden.

## Rollback
Each WU = 1 commit; `git revert <sha>` restores prior green state. Recipients reuses `usersApi.listAssignable()` + `usersQueryKeys.assignable()`.
