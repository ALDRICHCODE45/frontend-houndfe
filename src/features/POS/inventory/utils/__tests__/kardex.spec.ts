import { describe, expect, it } from 'vitest'
import type { StockMovement } from '../../interfaces/inventory.types'
import { buildKardexRows, movementDetail, movementLocation, movementTypeLabel } from '../kardex'

function movement(patch: Partial<StockMovement> & { id: string }): StockMovement {
  return {
    type: 'SALE', bucket: 'LOT', productId: 'p1', variantId: null, lotId: 'l1',
    labels: { product: 'Croquetas', variant: null, lot: 'L-A' }, delta: -3, balanceAfter: 0, productBalanceAfter: 15,
    reason: null, note: null, removalCause: null, group: { type: 'SALE', id: 'sale-1' },
    actor: { displayName: 'María López' }, createdAt: '2026-11-04T15:02:11.120Z', ...patch,
  }
}
// Newest first, as the server sends them: the untracked row of the sale comes before the lot rows.
const sale = [
  movement({ id: 'm3', bucket: 'PRODUCT_UNTRACKED', lotId: null, labels: { product: 'Croquetas', variant: null, lot: null }, delta: -2, balanceAfter: 3, productBalanceAfter: 3 }),
  movement({ id: 'm2', labels: { product: 'Croquetas', variant: null, lot: 'L-B' }, lotId: 'l2', delta: -10, balanceAfter: 0, productBalanceAfter: 5 }),
  movement({ id: 'm1', delta: -3, balanceAfter: 0, productBalanceAfter: 15 }),
]

describe('kardex labels', () => {
  it.each([
    ['OPENING', 'Apertura'], ['INITIAL', 'Inicial'], ['ADJUSTMENT', 'Ajuste'], ['SALE', 'Venta'],
    ['SALE_CANCELLATION', 'Cancelación de venta'], ['REMOVAL', 'Baja'],
  ] as const)('names %s «%s»', (type, label) => expect(movementTypeLabel(type)).toBe(label))

  it('names the bucket: lot number, variant label or «Sin lote»', () => {
    expect(movementLocation(movement({ id: 'a' }))).toBe('Lote L-A')
    expect(movementLocation(movement({ id: 'b', bucket: 'VARIANT', lotId: null, variantId: 'v1', labels: { product: 'Collar', variant: 'Chico · Azul', lot: null } }))).toBe('Chico · Azul')
    expect(movementLocation(movement({ id: 'c', bucket: 'PRODUCT_UNTRACKED', lotId: null, labels: { product: 'Croquetas', variant: null, lot: null } }))).toBe('Sin lote')
  })

  it('names the untracked bucket of a plain product «Existencias»', () => {
    const untracked = movement({ id: 'c', bucket: 'PRODUCT_UNTRACKED', lotId: null, labels: { product: 'Croquetas', variant: null, lot: null } })
    expect(movementLocation(untracked, 'Existencias')).toBe('Existencias')
    expect(buildKardexRows([untracked], new Set(), 'Existencias')[0]!.location).toBe('Existencias')
    expect(movementLocation(movement({ id: 'a' }), 'Existencias')).toBe('Lote L-A')
  })

  it('details an adjustment with its reason label and note, a removal with its cause', () => {
    expect(movementDetail(movement({ id: 'a', type: 'ADJUSTMENT', reason: 'EXPIRED', note: 'Lote vencido retirado', group: { type: 'ADJUSTMENT', id: 'x' } })))
      .toBe('Caducado · Lote vencido retirado')
    expect(movementDetail(movement({ id: 'b', type: 'ADJUSTMENT', reason: 'PHYSICAL_COUNT', note: null }))).toBe('Conteo físico')
    expect(movementDetail(movement({ id: 'c', type: 'REMOVAL', removalCause: 'FIRST_VARIANT_ZEROING', group: { type: 'PRODUCT', id: 'p1' } })))
      .toBe('Se creó la primera variante: el stock pasó a 0')
    expect(movementDetail(movement({ id: 'd', type: 'REMOVAL', removalCause: 'PRODUCT_DELETED' }))).toBe('Producto eliminado')
    expect(movementDetail(movement({ id: 'e', type: 'REMOVAL', removalCause: 'VARIANT_DELETED' }))).toBe('Variante eliminada')
    expect(movementDetail(movement({ id: 'f' }))).toBe('')
  })
})

describe('buildKardexRows', () => {
  it('shows an opening balance as one row done by «Sistema»', () => {
    const [row] = buildKardexRows([movement({ id: 'o', type: 'OPENING', delta: 40, balanceAfter: 40, productBalanceAfter: 40, group: { type: 'PRODUCT', id: 'p1' }, actor: { displayName: '' } })], new Set())
    expect(row).toMatchObject({ kind: 'single', typeLabel: 'Apertura', actor: 'Sistema', delta: 40, balanceAfter: 40 })
  })

  it('keeps single movements as plain rows in server order', () => {
    const rows = buildKardexRows([
      movement({ id: 'a', type: 'ADJUSTMENT', delta: -8, group: { type: 'ADJUSTMENT', id: 'adj-1' } }),
      movement({ id: 'b', type: 'INITIAL', delta: 22, group: { type: 'PRODUCT', id: 'p1' } }),
    ], new Set())
    expect(rows.map(row => [row.key, row.kind])).toEqual([['a', 'single'], ['b', 'single']])
    expect(rows[0]).toMatchObject({ actor: 'María López', location: 'Lote L-A', balanceAfter: 0, productBalanceAfter: 15 })
  })

  it('folds the rows of one sale into a single operation with the summed delta and the final product total', () => {
    const [group, ...rest] = buildKardexRows(sale, new Set())
    expect(rest).toEqual([])
    expect(group).toMatchObject({
      kind: 'group', typeLabel: 'Venta', delta: -15, productBalanceAfter: 3, balanceAfter: null, parts: 3,
      location: '3 ubicaciones', actor: 'María López',
    })
  })

  it('expands the split with every bucket row under the operation, indented and in the server order', () => {
    const rows = buildKardexRows(sale, new Set([buildKardexRows(sale, new Set())[0]!.key]))
    expect(rows.map(row => row.kind)).toEqual(['group', 'child', 'child', 'child'])
    expect(rows.slice(1).map(row => [row.location, row.delta, row.balanceAfter])).toEqual([
      ['Sin lote', -2, 3], ['Lote L-B', -10, 0], ['Lote L-A', -3, 0],
    ])
    expect(new Set(rows.map(row => row.key)).size).toBe(4)
  })

  it('never merges a sale with its cancellation even under the same sale id', () => {
    const cancellation = [
      movement({ id: 'c2', type: 'SALE_CANCELLATION', delta: 3, balanceAfter: 3, productBalanceAfter: 18 }),
      movement({ id: 'c1', type: 'SALE_CANCELLATION', delta: 2, bucket: 'PRODUCT_UNTRACKED', lotId: null, labels: { product: 'Croquetas', variant: null, lot: null }, balanceAfter: 5, productBalanceAfter: 15 }),
    ]
    const rows = buildKardexRows([...cancellation, ...sale], new Set())
    expect(rows.map(row => [row.typeLabel, row.delta])).toEqual([['Cancelación de venta', 5], ['Venta', -15]])
  })

  it('does not merge two different sales that follow each other', () => {
    const other = sale.map(row => movement({ ...row, id: 'x' + row.id, group: { type: 'SALE', id: 'sale-2' } }))
    const rows = buildKardexRows([...other, ...sale], new Set())
    expect(rows).toHaveLength(2)
    expect(new Set(rows.map(row => row.key)).size).toBe(2)
  })

  it('keeps a sale that touched one bucket as a plain row', () => {
    const [row] = buildKardexRows([sale[2]!], new Set())
    expect(row).toMatchObject({ kind: 'single', typeLabel: 'Venta', delta: -3 })
  })

  it('merges a sale whose rows arrive on different pages once both pages are shown', () => {
    const firstPage = sale.slice(0, 1)
    const secondPage = sale.slice(1)
    expect(buildKardexRows(firstPage, new Set())[0]!.kind).toBe('single')
    expect(buildKardexRows([...firstPage, ...secondPage], new Set())[0]).toMatchObject({ kind: 'group', parts: 3, delta: -15 })
  })

  it('never exposes a sale or movement id in any visible text', () => {
    const rows = buildKardexRows(sale, new Set([buildKardexRows(sale, new Set())[0]!.key]))
    const visible = JSON.stringify(rows.map(({ key: _key, ...rest }) => rest))
    expect(visible).not.toContain('sale-1')
    expect(visible).not.toMatch(/"m[123]"/)
  })
})
