/**
 * What the FE shows each fixture actor, derived from its claim and permission codes the same way
 * the FE decides (ProductEditorialView, editorial-access.ts, EditorialWorkspace). Pure: no I/O.
 */
export interface ActorGrants {
  readonly isSuperAdmin: boolean
  readonly permissionCodes: readonly string[]
}

export const GENERIC_PRODUCT_TITLE = 'Producto'

/** ProductEditorialView asks GET /products/:id only with read:Product (Super Admin and manage:all have it). */
export function readsProductName(actor: ActorGrants): boolean {
  return actor.isSuperAdmin || actor.permissionCodes.includes('manage:all') || actor.permissionCodes.includes('read:Product')
}

/** canPublishEditorial: Super Admin, manage:all, or read + publish on the editorial draft. */
export function publishesEditorial(actor: ActorGrants): boolean {
  return actor.isSuperAdmin || actor.permissionCodes.includes('manage:all') ||
    (actor.permissionCodes.includes('read:ProductEditorialDraft') && actor.permissionCodes.includes('publish:ProductEditorialDraft'))
}

/**
 * The save-bar status once a save is acknowledged and nothing is pending. Publishers get the
 * publish bar (EditorialPublishBar: readiness wording, never «Guardado»); everyone else keeps
 * HfSaveBar's «Guardado …».
 */
export function savedStatusPattern(actor: ActorGrants): RegExp {
  return publishesEditorial(actor)
    ? /^\s*(Revisando qué falta para publicar…|Listo para publicar|Completa lo pendiente para publicar)\s*$/
    : /Guardado/
}

/** Redacted exchange log line: method, backend-relative path (query already dropped), status. */
export function exchangeLine(exchange: { readonly method: string; readonly path: string; readonly status: number | null }): string {
  return `${exchange.method} ${exchange.path} -> ${exchange.status ?? 'pending'}`
}
