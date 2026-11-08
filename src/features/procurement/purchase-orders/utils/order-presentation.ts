import { decimalMoneyTitle, formatDecimalMoney } from '@/core/shared/utils/currency.utils'
import type { RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import type { OrderTotal, PurchaseOrderStatus, PurchaseOrderSummary } from '../interfaces/purchase-order.types'

export const statusLabels: Record<PurchaseOrderStatus, string> = { DRAFT: 'Borrador', CONFIRMED: 'Confirmada', CANCELLED: 'Cancelada' }
// Domain state to badge tone, defined once for the list, the cards and the open order.
export const statusTones = { DRAFT: 'neutral', CONFIRMED: 'success', CANCELLED: 'neutral' } as const
const basisLabels: Record<OrderTotal['taxBasis'], string> = { EXCLUDES_TAX: 'sin imp.', INCLUDES_TAX: 'con imp.' }

// The marker count is the server's checklist item count, shown as is. A response without it (older backend) keeps the generic wording while the draft has raw issues.
export function avisoText(order: Pick<PurchaseOrderSummary, 'status' | 'issueCount' | 'checklistItemCount'>): string | null {
  if (order.status !== 'DRAFT') return null
  const count = order.checklistItemCount
  if (count === undefined) return order.issueCount > 0 ? 'Con avisos' : null
  if (count <= 0) return null
  return count === 1 ? '1 aviso' : `${count} avisos`
}
export function orderRowLabel(order: Pick<PurchaseOrderSummary, 'status' | 'supplierDisplaySnapshot'>) {
  const supplier = order.supplierDisplaySnapshot?.displayName
  return `${supplier ? `la orden de ${supplier}` : 'la orden sin proveedor'}, ${statusLabels[order.status].toLowerCase()}`
}

// Server totals, one per tax basis. They are shown side by side and never summed: only a mixed order carries a basis label.
export function orderTotals(order: Pick<PurchaseOrderSummary, 'totals'>) {
  const totals = order.totals ?? []
  return totals.map(total => ({ key: total.taxBasis, text: formatDecimalMoney(total.amount, total.currency), title: decimalMoneyTitle(total.amount, total.currency), label: totals.length > 1 ? basisLabels[total.taxBasis] : null }))
}

/** Adds plain decimal strings exactly (scaled integers), e.g. "0.1" + "0.2" = "0.3". */
function addDecimals(amounts: readonly string[]): string {
  const scale = Math.max(0, ...amounts.map(amount => amount.split('.')[1]?.length ?? 0))
  const scaled = (amount: string) => {
    const negative = amount.startsWith('-')
    const [whole = '0', fraction = ''] = amount.replace('-', '').split('.')
    const value = BigInt(whole + fraction.padEnd(scale, '0'))
    return negative ? -value : value
  }
  const total = amounts.reduce((sum, amount) => sum + scaled(amount), 0n)
  const digits = (total < 0n ? -total : total).toString().padStart(scale + 1, '0')
  const whole = digits.slice(0, digits.length - scale)
  return `${total < 0n ? '-' : ''}${whole}${scale ? `.${digits.slice(-scale)}` : ''}`
}

/**
 * The orders' Total for the list's totals row: one exact sum per tax basis (never mixed), the basis
 * labelled only when both appear, then how many orders have no total yet. Empty when nothing to add.
 */
export function ordersTotalText(orders: readonly Pick<PurchaseOrderSummary, 'totals'>[]): string {
  const byBasis = new Map<OrderTotal['taxBasis'], string[]>()
  let missing = 0
  for (const order of orders) {
    if (!order.totals?.length) missing += 1
    for (const total of order.totals ?? []) byBasis.set(total.taxBasis, [...(byBasis.get(total.taxBasis) ?? []), total.amount])
  }
  const bases = (['EXCLUDES_TAX', 'INCLUDES_TAX'] as const).filter(basis => byBasis.has(basis))
  const parts = bases.map(basis => {
    const text = formatDecimalMoney(addDecimals(byBasis.get(basis)!), 'MXN')
    return bases.length > 1 ? `${text} ${basisLabels[basis]}` : text
  })
  if (missing > 0) parts.push(`${missing} sin total`)
  return parts.join(' · ')
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
