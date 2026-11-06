import type { AdjustmentReason, MovementType, RemovalCause, StockMovement } from '../interfaces/inventory.types'
import { ADJUSTMENT_REASONS } from './adjustment'

const TYPE_LABELS: Record<MovementType, string> = {
  OPENING: 'Apertura',
  INITIAL: 'Inicial',
  ADJUSTMENT: 'Ajuste',
  SALE: 'Venta',
  SALE_CANCELLATION: 'Cancelación de venta',
  REMOVAL: 'Baja',
}
const REMOVAL_LABELS: Record<RemovalCause, string> = {
  PRODUCT_DELETED: 'Producto eliminado',
  VARIANT_DELETED: 'Variante eliminada',
  FIRST_VARIANT_ZEROING: 'Se creó la primera variante: el stock pasó a 0',
}
const reasonLabel = (reason: AdjustmentReason) => ADJUSTMENT_REASONS.find(item => item.value === reason)?.label ?? ''

export const movementTypeLabel = (type: MovementType) => TYPE_LABELS[type]
// `untracked` names the product-level bucket: «Sin lote» next to lots, «Existencias» for a plain product.
export function movementLocation(movement: StockMovement, untracked = 'Sin lote') {
  if (movement.bucket === 'LOT') return movement.labels.lot ? `Lote ${movement.labels.lot}` : 'Lote'
  if (movement.bucket === 'VARIANT') return movement.labels.variant ?? 'Variante'
  return untracked
}
export function movementDetail(movement: StockMovement) {
  if (movement.removalCause) return REMOVAL_LABELS[movement.removalCause]
  return [movement.reason && reasonLabel(movement.reason), movement.note].filter(Boolean).join(' · ')
}
// The opening balance is written by the migration, not by a person.
const actorOf = (movement: StockMovement) =>
  movement.actor?.displayName || (movement.type === 'OPENING' ? 'Sistema' : '—')

export interface KardexRow {
  key: string
  kind: 'single' | 'group' | 'child'
  typeLabel: string
  createdAt: string
  location: string
  detail: string
  delta: number
  // A group spans several buckets, so it has no single bucket balance.
  balanceAfter: number | null
  productBalanceAfter: number
  actor: string
  parts: number
}

function rowOf(movement: StockMovement, kind: KardexRow['kind'], key: string, untracked?: string): KardexRow {
  return {
    key, kind, typeLabel: movementTypeLabel(movement.type), createdAt: movement.createdAt,
    location: movementLocation(movement, untracked), detail: movementDetail(movement), delta: movement.delta,
    balanceAfter: movement.balanceAfter, productBalanceAfter: movement.productBalanceAfter,
    actor: actorOf(movement), parts: 1,
  }
}
const sameOperation = (a: StockMovement, b: StockMovement) =>
  a.group?.type === 'SALE' && b.group?.type === 'SALE' && a.group.id === b.group.id && a.type === b.type

// One sale writes a row per bucket it consumed (FEFO), all under one group id:
// consecutive rows of the same operation fold into a single expandable row.
export function buildKardexRows(
  movements: readonly StockMovement[],
  expanded: ReadonlySet<string>,
  untracked?: string,
): KardexRow[] {
  const rows: KardexRow[] = []
  for (let index = 0; index < movements.length;) {
    let end = index + 1
    while (end < movements.length && sameOperation(movements[index]!, movements[end]!)) end++
    const parts = movements.slice(index, end)
    const first = parts[0]!
    if (parts.length === 1) {
      rows.push(rowOf(first, 'single', first.id, untracked))
    } else {
      const key = `group:${first.id}`
      rows.push({
        ...rowOf(first, 'group', key, untracked), delta: parts.reduce((sum, part) => sum + part.delta, 0),
        balanceAfter: null, location: `${parts.length} ubicaciones`, parts: parts.length,
      })
      if (expanded.has(key)) parts.forEach(part => rows.push(rowOf(part, 'child', `child:${part.id}`, untracked)))
    }
    index = end
  }
  return rows
}
