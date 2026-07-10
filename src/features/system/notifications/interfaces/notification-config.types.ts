// notification-config.types.ts — domain types for the tenant-admin notification
// configuration screen at /sistema/configuracion/notificaciones.
//
// Field-name asymmetry: the GET view returns `recipients` while the PUT body
// sends `recipientUserIds`. The mapper layer (`notificationConfigMappers.ts`)
// owns that translation. Keeping separate response vs put-body types here
// means the field-name asymmetry is visible at every consumer call site.

/**
 * Known notification action keys. Add here ONLY when the backend adds a new
 * action to the registry; the front-end action registry mirrors it.
 */
export type ActionKey = 'LOW_STOCK'

/**
 * GET /notification-config response.
 *
 * `recipients` is intentionally named DIFFERENTLY from the PUT body's
 * `recipientUserIds` — the backend uses distinct keys for read vs write.
 */
export interface NotificationConfigResponse {
  enabled: boolean
  recipients: string[]
  enabledActions: ActionKey[]
}

/**
 * PUT /notification-config request body. EXACTLY three whitelisted keys;
 * the backend uses `forbidNonWhitelisted` on its DTO so any extra field
 * would be rejected. `toPutBody` enforces this on the client side too.
 */
export interface NotificationConfigPutBody {
  enabled: boolean
  recipientUserIds: string[]
  enabledActions: ActionKey[]
}

/**
 * Reactive form model used by the UI layer. After hydration from a GET
 * response the shape matches the PUT body — recipients have already been
 * renamed to recipientUserIds by `fromConfigResponse`.
 */
export interface NotificationConfigForm {
  enabled: boolean
  recipientUserIds: string[]
  enabledActions: ActionKey[]
}

/**
 * One action inside an action registry module. `label` is plain Spanish
 * because it is shown directly to the tenant admin. `description` is
 * optional — simple actions (a single switch) get a one-line muted
 * subtitle under the label; complex actions (a future config form) may
 * omit it and render their own richer UI instead.
 */
export interface ActionDescriptor {
  key: ActionKey
  label: string
  description?: string
}

/**
 * A registry module groups related actions under a single accordion item.
 * The data-driven action registry is the ONLY extension point when adding
 * a new module or action — see `registry/action-registry.ts`.
 */
export interface ModuleDescriptor {
  moduleKey: string
  moduleLabel: string
  actions: ActionDescriptor[]
}
