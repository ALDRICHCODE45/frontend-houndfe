import type { PurchaseOrder } from '../interfaces/purchase-order.types'
import { diagnosticMessage, diagnosticTarget } from './order-diagnostics'

// Id of the issue checklist; the disabled primary points at it with aria-describedby.
export const CHECKLIST_ID = 'order-checklist'
// Id of the draft form, so the footer's submit button can live outside it.
export const ORDER_FORM_ID = 'purchase-order-form'
type Checked = Pick<PurchaseOrder, 'lines' | 'lineDisplaySnapshots' | 'validation'>
export interface ChecklistItem { key: string; message: string; lineId: string | null; productName: string | null; count: number }

// One item per readable message. An issue repeated over several lines is a single item that counts them
// and links to the first; line-less issues (supplier, note, unknown paths) carry no link.
export function buildChecklist(order: Checked): ChecklistItem[] {
  const items = new Map<string, ChecklistItem & { lines: Set<string> }>()
  for (const issue of order.validation.issues) {
    const message = diagnosticMessage(issue.code)
    const target = diagnosticTarget(issue.path, order.lines.length)
    const lineId = target.startsWith('/lines/') ? order.lines[Number(target.split('/')[2])]?.lineId ?? null : null
    const found = items.get(message) ?? { key: message, message, lineId, productName: lineId ? order.lineDisplaySnapshots.find(item => item.lineId === lineId)?.productName ?? null : null, count: 1, lines: new Set<string>() }
    if (lineId && !found.lines.has(lineId)) { found.lines.add(lineId); found.count = found.lines.size }
    items.set(message, found)
  }
  return [...items.values()].map(({ lines: _lines, ...item }) => item)
}

export interface LineFlags { product: boolean; variant: boolean; quantity: boolean; cost: boolean; tax: boolean; any: boolean }
export const noFlags: LineFlags = { product: false, variant: false, quantity: false, cost: false, tax: false, any: false }
// Which cell of a line the server diagnostics point at, as of the last save.
export function lineFlags(order: Checked, lineId: string): LineFlags {
  const index = order.lines.findIndex(line => line.lineId === lineId)
  const flags = { ...noFlags }
  if (index < 0) return flags
  for (const issue of order.validation.issues) {
    const target = diagnosticTarget(issue.path, order.lines.length)
    if (target !== `/lines/${index}` && !target.startsWith(`/lines/${index}/`)) continue
    flags.any = true
    const field = target.slice(`/lines/${index}/`.length)
    if (field === 'productId') flags.product = true
    else if (field === 'variantId') flags.variant = true
    else if (field === 'orderedQuantity') flags.quantity = true
    else if (field === 'informedUnitCost/taxBasis') flags.tax = true
    else if (field.startsWith('informedUnitCost')) flags.cost = true
  }
  return flags
}

export type StepKey = 'complete' | 'save' | 'confirm'
export const stepLabels: Record<StepKey, string> = { complete: 'Completar', save: 'Guardar', confirm: 'Confirmar' }
// The current step is derived from the record: pending items first, then unsaved changes, then ready.
export function confirmSteps({ pending, dirty }: { pending: number; dirty: boolean }) {
  const keys: StepKey[] = ['complete', 'save', 'confirm']
  const current = pending > 0 ? 0 : dirty ? 1 : 2
  return keys.map((key, index) => ({ key, label: stepLabels[key], state: index < current ? 'done' as const : index === current ? 'current' as const : 'upcoming' as const, count: key === 'complete' ? pending : 0 }))
}
