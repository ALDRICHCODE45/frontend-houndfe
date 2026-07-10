# Design: notification-config

## Technical Approach

Tenant-admin settings screen consuming GET/PUT `/notification-config`. Composition API + `<script setup lang="ts">`, feature-folder layout, TanStack **vue**-query (not react). All server-state via query/mutation composables mirroring `useEligibleUsersQuery` + `useUpdateEmployee`. Form logic and field-asymmetry live in pure, test-first modules (extract-before-mock). Components stay thin (props down / emits up). Data-driven action registry so new modules/actions are config-only. Satisfies spec REQ-1..REQ-10.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|---|---|---|---|
| Feature placement | `src/features/system/notifications/` | `admin/notification-config` | Proposal-locked; "Sistema → Configuración" is a new top-level domain, not admin CRUD. **Divergence noted**: no `features/system/*` exists yet — first tenant in that namespace. |
| Field asymmetry (GET `recipients` ↔ PUT `recipientUserIds`) | Isolate in pure `fromConfigResponse`/`toPutBody` | Inline in composable | Only unit-tested boundary de-risks `forbidNonWhitelisted`. |
| Dirty tracking | New snapshot pure-core `isDirty(state, pristine)` + reactive wrapper | Reuse `useRoleForm` (no dirty support) | No repo precedent; `create-adaptable-composable` pure-core keeps it testable. |
| Recipient source | Reuse `usersApi.listAssignable()` + `usersQueryKeys.assignable()` | New endpoint | Both already exist in repo. |
| Master↔actions | Independent `enabled`; master OFF greys actions | Derived master | Proposal locked decision #2. |
| Permission gate | Route `meta.permission` for `read`; in-view `userCan('update',…)` for Save | Guard-only | Mirrors router pattern; `update` must live in view (disable + notice). |

## Data Flow

    GET /notification-config ─┐
                              ├─ useNotificationConfigQuery ─→ fromConfigResponse ─→ formModel(reactive)
    GET /users/assignable ────┘                                                          │ pristine snapshot
                                                                                         ▼
    View ── v-model ──> MasterToggle / RecipientSelect / ActionsAccordion   useNotificationConfigForm
                                                                          (isDirty, canSave, save())
                                                                                         │ toPutBody (3 keys)
                                        toast + invalidate + re-hydrate ◀── useUpdateNotificationConfigMutation ─→ PUT

## File Changes

| File | Action | Description |
|---|---|---|
| `src/features/auth/interfaces/auth.types.ts` | Modify | Add `'NotificationConfig'` to `AppSubject` union |
| `src/features/auth/authorization/ability.ts` | Modify | Add `'NotificationConfig'` to `APP_SUBJECTS` |
| `src/core/shared/constants/query-keys.ts` | Modify | Add `notificationConfigQueryKeys.config(tenantId)=['notification-config',tenantId]` |
| `src/app/router/index.ts` | Modify | Lazy route `/sistema/configuracion/notificaciones`, `meta.permission:['read','NotificationConfig']` |
| `src/app/composables/useSidebar.ts` | Modify | New "Sistema" group → "Configuración" child guarded `['read','NotificationConfig']` |
| `.../notifications/api/notificationConfig.api.ts` | Create | GET/PUT + `NOTIFICATION_CONFIG_ERROR_MAP` + `mapNotificationConfigError` |
| `.../notifications/interfaces/notification-config.types.ts` | Create | Response/request/form/registry types |
| `.../notifications/registry/action-registry.ts` | Create | Data-driven module→actions descriptor |
| `.../notifications/utils/notificationConfigMappers.ts` | Create | `fromConfigResponse`, `toPutBody`, `isDirty` (pure) |
| `.../notifications/composables/useNotificationConfigQuery.ts` | Create | GET query (mirror `useEligibleUsersQuery`) |
| `.../notifications/composables/useUpdateNotificationConfigMutation.ts` | Create | PUT mutation (mirror `useUpdateEmployee`) |
| `.../notifications/composables/useNotificationConfigForm.ts` | Create | Reactive form-state wrapper over pure core |
| `.../notifications/views/NotificationConfigView.vue` | Create | Route view — composition surface only |
| `.../notifications/components/{MasterToggle,RecipientSelect,ActionsAccordion,ModuleAccordionItem,ActionRow}.vue` | Create | Thin UI sections |
| `.../notifications/**/__tests__/*` | Create | Pure-unit + view render tests |

## Interfaces / Contracts

```ts
// notification-config.types.ts
export interface NotificationConfigResponse { enabled: boolean; recipients: string[]; enabledActions: ActionKey[] }
export interface NotificationConfigPutBody { enabled: boolean; recipientUserIds: string[]; enabledActions: ActionKey[] } // exactly 3
export interface NotificationConfigForm { enabled: boolean; recipientUserIds: string[]; enabledActions: ActionKey[] }
export type ActionKey = 'LOW_STOCK'
export interface ActionDescriptor { key: ActionKey; label: string }              // label = neutral Spanish
export interface ModuleDescriptor { moduleKey: string; moduleLabel: string; actions: ActionDescriptor[] }

// action-registry.ts  (adding entries here is the ONLY edit to extend)
export const ACTION_REGISTRY: ModuleDescriptor[] = [
  { moduleKey: 'pos', moduleLabel: 'Punto de venta', actions: [{ key: 'LOW_STOCK', label: 'Bajo inventario' }] },
]

// api client
export const notificationConfigApi = {
  get(): Promise<NotificationConfigResponse>,                        // GET /notification-config
  update(body: NotificationConfigPutBody): Promise<NotificationConfigResponse>, // PUT
}
export function mapNotificationConfigError(codeOrMessage: string): { field?: 'recipients'; toast?: string }

// pure mappers
fromConfigResponse(view: NotificationConfigResponse): NotificationConfigForm  // recipients→recipientUserIds
toPutBody(form: NotificationConfigForm): NotificationConfigPutBody            // whitelist exactly 3 keys
isDirty(state: NotificationConfigForm, pristine: NotificationConfigForm): boolean

// form composable
useNotificationConfigForm(source: MaybeRefOrGetter<NotificationConfigResponse | undefined>): {
  form; isDirty; canSave; zeroRecipientViolation; save(): Promise<void>
}
// canSave = isDirty && !isPending && !zeroRecipientViolation && userCan('update','NotificationConfig')
// zeroRecipientViolation = enabledActions.length > 0 && recipientUserIds.length === 0
```

**Component tree / contracts** — `NotificationConfigView` (owns composables) → `MasterToggle` (`modelValue:boolean`, `@update:modelValue`) → `RecipientSelect` (`modelValue:string[]`, `assignable:AssignableUser[]`, `disabled`, `error?`; renders `Usuario no disponible` for ids absent from `assignable`, never auto-strips) → `ActionsAccordion` (`registry`, `masterEnabled`, `modelValue:ActionKey[]`) → `ModuleAccordionItem` → `ActionRow` (`action`, `checked`, `disabled=!masterEnabled`, `@toggle`). Loading → `USkeleton`.

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit (pure) | `fromConfigResponse`, `toPutBody` (asserts exactly 3 keys), `isDirty`, `mapNotificationConfigError` (INVALID_RECIPIENT→field, UNKNOWN_ACTION_KEY→toast, uppercase+fallback), registry→accordion mapping, `computeCanSave`/`computeZeroRecipientViolation` extracted helpers | vitest, no mount |
| Component | View render states (loading skeleton, defaults OFF/disabled, master-OFF greys actions, stale chip, Save-guard states, no-`update` notice) | `mountWithUApp`, mock composables |
| Integration | query→form hydration; mutation invalidate + re-hydrate + toast | mock `notificationConfigApi`, vue-query test client |

Authoritative gate: `pnpm build`. Runner: `pnpm test:unit`.

## Migration / Rollout

No migration. Single PR, no DB/infra. Revert restores all edits (no other code references `NotificationConfig`).

## Open Questions

- [ ] Backend: `GET /users/assignable` returns ALL active tenant users or a role-filtered subset? (affects recipient completeness / stale-chip frequency)
- [ ] `AssignableUser` has no `email` — acceptable to display name-only in the picker? (non-blocking)
