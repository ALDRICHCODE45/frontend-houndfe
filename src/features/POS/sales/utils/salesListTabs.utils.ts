/**
 * sales-pos-charge WU-B.6 / WU-D.1: tiny view-model helper for the
 * "Pagos Pendientes" tab badge on `SalesListTabs`.
 *
 * Contract (REQ-NEW-8 explicit, carried to WU-D acceptance criteria):
 *   - Badge renders iff `count > 0`.
 *   - The tab remains selectable at zero (empty table state is a valid
 *     outcome when no sales are pending — the cashier might still want to
 *     confirm that fact).
 *
 * Returns a structured shape so the caller (the tabs component) does not
 * have to repeat the count check at three different rendering sites.
 */
export interface PendingPaymentsBadgeView {
  visible: boolean
  text: string | null
}

export function pendingPaymentsBadge(count: number): PendingPaymentsBadgeView {
  return {
    visible: count > 0,
    text: count > 0 ? String(count) : null,
  }
}