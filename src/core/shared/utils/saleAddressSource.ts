/**
 * Sale address source status (odd/tasks/sale-address-change-notice.md S2/S4).
 *
 * A sale keeps the shipping address it was sold with. The backend compares that snapshot with
 * the customer's live address and reports `sourceStatus` + `changedFields`; this helper turns
 * it into the notice the screens show next to the sale's address (never replacing it).
 */

export type SaleAddressSourceStatus = 'UNCHANGED' | 'CHANGED' | 'DELETED'
export type SaleAddressSourceNotice = Exclude<SaleAddressSourceStatus, 'UNCHANGED'>

/** Structural input: any snapshot carrying the two computed fields (optional on older payloads). */
export interface SaleAddressSourceInput {
  sourceStatus?: SaleAddressSourceStatus | null
  changedFields?: readonly string[] | null
}

export const SALE_ADDRESS_SOURCE_MESSAGES: Record<SaleAddressSourceNotice, string> = {
  CHANGED: 'El cliente cambió esta dirección después de la venta.',
  DELETED: 'El cliente eliminó esta dirección después de la venta.',
}

/** Short marker for dense rows; the full message rides in `title` and for screen readers. */
export const SALE_ADDRESS_SOURCE_SHORT_LABELS: Record<SaleAddressSourceNotice, string> = {
  CHANGED: 'Dirección cambiada',
  DELETED: 'Dirección eliminada',
}

// The label is a nickname, not a delivery fact: a change of only the label is no change.
const IGNORED_FIELDS = new Set(['label'])

export function saleAddressSourceNotice(
  address: SaleAddressSourceInput | null | undefined,
): SaleAddressSourceNotice | null {
  if (!address) return null
  if (address.sourceStatus === 'DELETED') return 'DELETED'
  if (address.sourceStatus !== 'CHANGED') return null
  // No list at all is not evidence of a label-only change, so it still warns.
  if (address.changedFields == null) return 'CHANGED'
  return address.changedFields.some((field) => !IGNORED_FIELDS.has(field)) ? 'CHANGED' : null
}

export function saleAddressSourceMessage(address: SaleAddressSourceInput | null | undefined): string | null {
  const notice = saleAddressSourceNotice(address)
  return notice ? SALE_ADDRESS_SOURCE_MESSAGES[notice] : null
}
