/**
 * Venta presentation opt-in. A caller enables the sale-entry presentation by
 * passing a portal class that contains the exact `sales-entry-portal` token.
 * A substring such as `not-sales-entry-portal` must never match, otherwise an
 * unrelated consumer would receive the Venta checkout paint.
 */
export const SALES_ENTRY_PORTAL_TOKEN = 'sales-entry-portal'

export function hasSalesEntryToken(portalClass: string | null | undefined): boolean {
  return portalClass?.split(/\s+/).includes(SALES_ENTRY_PORTAL_TOKEN) ?? false
}
