import type { PurchaseOrder } from '../interfaces/purchase-order.types'
import { diagnosticMessage, diagnosticTarget } from './order-diagnostics'

// Id of the issue checklist; the disabled primary points at it with aria-describedby.
export const CHECKLIST_ID = 'order-checklist'
// Id of the draft form, so the footer's submit button can live outside it.
export const ORDER_FORM_ID = 'purchase-order-form'
type Checked = Pick<PurchaseOrder, 'lines' | 'lineDisplaySnapshots' | 'validation'>
export interface ChecklistItem { key: string; message: string; lineId: string | null; productName: string | null; count: number }

// Line diagnostics are grouped by issue family, not by field: every cost sub-field of a line (amount,
// currency, unit, tax basis) is the same "Falta el costo". The exact field is marked in the open line editor.
const families = [
  { key: 'cost', missing: 'Falta el costo', review: 'Revisa el costo', codes: ['COST_AMOUNT_REQUIRED', 'COST_CURRENCY_REQUIRED', 'COST_UNIT_REQUIRED', 'COST_TAX_BASIS_REQUIRED'], required: ['COST_AMOUNT_REQUIRED', 'COST_CURRENCY_REQUIRED', 'COST_UNIT_REQUIRED', 'COST_TAX_BASIS_REQUIRED'] },
  { key: 'quantity', missing: 'Falta la cantidad', review: 'Revisa la cantidad', codes: ['QUANTITY_REQUIRED', 'QUANTITY_FRACTION_NOT_ALLOWED'], required: ['QUANTITY_REQUIRED'] },
  { key: 'reference', missing: 'Falta el producto o la variante', review: 'Revisa el producto o la variante', codes: ['PRODUCT_REQUIRED', 'VARIANT_REQUIRED', 'REFERENCE_UNAVAILABLE', 'REFERENCE_INCOMPATIBLE'], required: ['PRODUCT_REQUIRED', 'VARIANT_REQUIRED'] },
  { key: 'unit', missing: 'La unidad no coincide con la del producto', review: 'La unidad no coincide con la del producto', codes: ['UNIT_MISMATCH'], required: [] as string[] },
]
type Family = typeof families[number]
const familyOf = (code: string) => families.find(family => family.codes.includes(code))

// One item per family across the lines (counted, linking to the first line in order) and one per readable
// message for everything else; order-level issues (supplier, lines, note, unknown paths) carry no link.
export function buildChecklist(order: Checked): ChecklistItem[] {
  const items = new Map<string, ChecklistItem>()
  const grouped = new Map<string, { family: Family; lines: Set<number>; codes: Set<string> }>()
  for (const issue of order.validation.issues) {
    const target = diagnosticTarget(issue.path, order.lines.length)
    const index = target.startsWith('/lines/') ? Number(target.split('/')[2]) : -1
    const family = index >= 0 ? familyOf(issue.code) : undefined
    if (family) {
      const found = grouped.get(family.key) ?? { family, lines: new Set<number>(), codes: new Set<string>() }
      found.lines.add(index)
      found.codes.add(issue.code)
      grouped.set(family.key, found)
      continue
    }
    const message = diagnosticMessage(issue.code)
    const lineId = index >= 0 ? order.lines[index]?.lineId ?? null : null
    if (!items.has(message)) items.set(message, { key: message, message, lineId, productName: nameOf(order, lineId), count: 1 })
  }
  const familyItems = [...grouped.values()].map(({ family, lines, codes }): ChecklistItem => {
    const first = Math.min(...lines)
    const lineId = order.lines[first]?.lineId ?? null
    return { key: family.key, message: [...codes].every(code => family.required.includes(code)) ? family.missing : family.review, lineId, productName: nameOf(order, lineId), count: lines.size }
  })
  return [...items.values(), ...familyItems]
}
const nameOf = (order: Checked, lineId: string | null) => lineId ? order.lineDisplaySnapshots.find(item => item.lineId === lineId)?.productName ?? null : null

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

type StepKey = 'complete' | 'save' | 'confirm'
const stepLabels: Record<StepKey, string> = { complete: 'Completar', save: 'Guardar', confirm: 'Confirmar' }
// The current step is derived from the record: pending items first, then unsaved changes, then ready.
export function confirmSteps({ pending, dirty }: { pending: number; dirty: boolean }) {
  const keys: StepKey[] = ['complete', 'save', 'confirm']
  const current = pending > 0 ? 0 : dirty ? 1 : 2
  return keys.map((key, index) => ({ key, label: stepLabels[key], state: index < current ? 'done' as const : index === current ? 'current' as const : 'upcoming' as const, count: key === 'complete' ? pending : 0 }))
}
