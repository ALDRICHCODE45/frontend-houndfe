import { decimalMoneyTitle, formatDecimalMoney } from '@/core/shared/utils/currency.utils'
import type { RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import type { OrderTotal, PurchaseOrderStatus, PurchaseOrderSummary } from '../interfaces/purchase-order.types'

export const statusLabels: Record<PurchaseOrderStatus, string> = { DRAFT: 'Borrador', CONFIRMED: 'Confirmada', CANCELLED: 'Cancelada' }
// Domain state to badge tone, defined once for the list, the cards and the open order.
export const statusTones = { DRAFT: 'neutral', CONFIRMED: 'success', CANCELLED: 'neutral' } as const
const basisLabels: Record<OrderTotal['taxBasis'], string> = { EXCLUDES_TAX: 'sin imp.', INCLUDES_TAX: 'con imp.' }

// The list row only carries the server's raw issue count (one per sub-field), not the checklist's issue families, so the marker never shows a number.
export const avisoLabel = 'Con avisos'
export function orderRowLabel(order: Pick<PurchaseOrderSummary, 'status' | 'supplierDisplaySnapshot'>) {
  const supplier = order.supplierDisplaySnapshot?.displayName
  return `${supplier ? `la orden de ${supplier}` : 'la orden sin proveedor'}, ${statusLabels[order.status].toLowerCase()}`
}

// Server totals, one per tax basis. They are shown side by side and never summed: only a mixed order carries a basis label.
export function orderTotals(order: Pick<PurchaseOrderSummary, 'totals'>) {
  const totals = order.totals ?? []
  return totals.map(total => ({ key: total.taxBasis, text: formatDecimalMoney(total.amount, total.currency), title: decimalMoneyTitle(total.amount, total.currency), label: totals.length > 1 ? basisLabels[total.taxBasis] : null }))
}

export interface RowActionGates { canEdit: boolean; canConfirm: boolean; canCancel: boolean; canDelete: boolean; disabled?: boolean }
export type OrderRowActionKey = 'open' | 'confirm' | 'cancel' | 'discard'
export function orderRowActions(order: PurchaseOrderSummary, gates: RowActionGates): Array<RowAction & { key: OrderRowActionKey }> {
  const draft = order.status === 'DRAFT'
  const editable = draft && gates.canEdit
  const actions: Array<RowAction & { key: OrderRowActionKey }> = [
    { key: 'open', label: editable ? 'Continuar' : 'Ver orden', icon: editable ? 'i-lucide-pencil' : 'i-lucide-eye' },
  ]
  // The list only knows the issue count, but an order with avisos can never be confirmed.
  if (draft && gates.canConfirm) actions.push({ key: 'confirm', label: 'Confirmar…', icon: 'i-lucide-check', disabled: order.issueCount > 0 })
  if (order.status !== 'CANCELLED' && gates.canCancel) actions.push({ key: 'cancel', label: 'Cancelar…', icon: 'i-lucide-ban' })
  if (draft && gates.canDelete) actions.push({ key: 'discard', label: 'Descartar borrador', icon: 'i-lucide-trash-2', destructive: true })
  return gates.disabled ? actions.map(action => ({ ...action, disabled: true })) : actions
}

export interface HeaderActionGates { canCancel: boolean; canDelete: boolean; cancelEnabled: boolean; busy: boolean }
export function orderHeaderActions(status: PurchaseOrderStatus, gates: HeaderActionGates): Array<RowAction & { key: 'cancel' | 'discard' }> {
  const actions: Array<RowAction & { key: 'cancel' | 'discard' }> = []
  if (status !== 'CANCELLED' && gates.canCancel) actions.push({ key: 'cancel', label: 'Cancelar orden…', icon: 'i-lucide-ban', disabled: !gates.cancelEnabled })
  if (status === 'DRAFT' && gates.canDelete) actions.push({ key: 'discard', label: 'Descartar borrador', icon: 'i-lucide-trash-2', destructive: true, disabled: gates.busy })
  return actions
}
