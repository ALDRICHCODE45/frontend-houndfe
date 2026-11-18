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
 * The settled save-bar status once a save is acknowledged and nothing is pending.
 * EditorialWorkspace.vue `bar` (publish when publication.visible && draft && clean && not saving)
 * swaps HfSaveBar for EditorialPublishBar for publishers; EditorialPublishBar `text` then reads
 * «Revisando qué falta para publicar…» while readiness loads (transient, not accepted here) and
 * settles on «Listo para publicar» or «Completa lo pendiente para publicar». An error message or
 * «No pudimos revisar qué falta para publicar.» never matches. Everyone else keeps HfSaveBar's
 * «Guardado …».
 */
export const PUBLISH_BAR_SETTLED = /^\s*(Listo para publicar|Completa lo pendiente para publicar)\s*$/
export function savedStatusPattern(actor: ActorGrants): RegExp {
  return publishesEditorial(actor) ? PUBLISH_BAR_SETTLED : /Guardado/
}

export interface ExchangeLike { readonly method: string; readonly path: string; readonly status: number | null }

/** Statuses (null = no response yet) of every `method path` exchange, in order. */
export function statusesOf(exchanges: readonly ExchangeLike[], method: string, path: string): (number | null)[] {
  return exchanges.filter(exchange => exchange.method === method && exchange.path === path).map(exchange => exchange.status)
}

/** The redacted HTTP log of one step: the exchanges recorded from index `from` on. */
export function stepLog(exchanges: readonly ExchangeLike[], from: number): string {
  const lines = exchanges.slice(from).map(exchangeLine)
  return lines.length ? lines.join('; ') : 'no backend request'
}

/** Redacted exchange log line: method, backend-relative path (query already dropped), status. */
export function exchangeLine(exchange: ExchangeLike): string {
  return `${exchange.method} ${exchange.path} -> ${exchange.status ?? 'pending'}`
}

/**
 * App-shell reads the isolated editorial backend does not mount (run 2): tolerated ONLY as
 * GET on these exact backend-relative paths (query already dropped) answering exactly 404.
 * Any other method, status or path at ≥400 still fails the network step.
 */
export const UNSERVED_SHELL_READS: readonly string[] = Object.freeze([
  '/sales/refunds/pending',
  '/delivery-zone-validations',
  '/notifications/unread-count',
])
export const UNSERVED_NOTE = 'unserved by the isolated backend'

export function isUnservedShellRead(exchange: ExchangeLike): boolean {
  return exchange.method === 'GET' && exchange.status === 404 && UNSERVED_SHELL_READS.includes(exchange.path)
}

/** Splits the ≥400 exchanges into allowlisted unserved shell reads and real failures. */
export function classifyFailures(exchanges: readonly ExchangeLike[]): { unserved: ExchangeLike[]; failed: ExchangeLike[] } {
  const atLeast400 = exchanges.filter(exchange => exchange.status !== null && exchange.status >= 400)
  return {
    unserved: atLeast400.filter(isUnservedShellRead),
    failed: atLeast400.filter(exchange => !isUnservedShellRead(exchange)),
  }
}
