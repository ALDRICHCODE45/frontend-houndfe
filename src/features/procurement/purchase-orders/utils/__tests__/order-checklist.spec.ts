import { describe, expect, it } from 'vitest'
import { buildChecklist, confirmSteps, lineFlags } from '../order-checklist'
import type { PurchaseOrder, ValidationIssue } from '../../interfaces/purchase-order.types'
const line = (n: number) => ({ lineId: `line-${n}`, productId: `p${n}`, variantId: null, orderedQuantity: '1', informedUnitCost: null })
const order = (issues: ValidationIssue[], lines = 2) => ({
  lines: Array.from({ length: lines }, (_, i) => line(i + 1)),
  lineDisplaySnapshots: Array.from({ length: lines }, (_, i) => ({ lineId: `line-${i + 1}`, productName: `Producto ${i + 1}`, variantName: null, unit: 'UNIDAD' })),
  validation: { issues },
}) as Pick<PurchaseOrder, 'lines' | 'lineDisplaySnapshots' | 'validation'>

describe('issue checklist', () => {
  it('lists every pending item once, in readable copy, never raw codes', () => {
    const items = buildChecklist(order([{ path: '/supplierId', code: 'SUPPLIER_REQUIRED' }, { path: '/supplierId', code: 'SUPPLIER_REQUIRED' }, { path: '/lines/0/mystery', code: 'SOMETHING_NEW' }]))
    expect(items.map(item => item.message)).toEqual(['Selecciona un proveedor.', 'Revisa este dato del borrador.'])
    expect(items[0]).toMatchObject({ lineId: null, productName: null, count: 1 })
  })
  it('keeps order-level issues as single items without a link', () => {
    const items = buildChecklist(order([{ path: '/supplierId', code: 'SUPPLIER_REQUIRED' }, { path: '/lines', code: 'LINES_REQUIRED' }], 0))
    expect(items.map(item => [item.message, item.lineId])).toEqual([['Selecciona un proveedor.', null], ['Agrega al menos un renglón para completar la orden.', null]])
  })
  it('groups every cost sub-field of one line (amount, currency, unit, tax basis) into one "Falta el costo" item with the product and one line to link', () => {
    const items = buildChecklist(order([
      { path: '/lines/1/informedUnitCost/amount', code: 'COST_AMOUNT_REQUIRED' }, { path: '/lines/1/informedUnitCost/currency', code: 'COST_CURRENCY_REQUIRED' },
      { path: '/lines/1/informedUnitCost/taxBasis', code: 'COST_TAX_BASIS_REQUIRED' }, { path: '/lines/1/informedUnitCost/unit', code: 'COST_UNIT_REQUIRED' },
    ]))
    expect(items).toEqual([{ key: 'cost', message: 'Falta el costo', lineId: 'line-2', productName: 'Producto 2', count: 1 }])
  })
  it('aggregates a family across lines into one item that counts them and links to the first', () => {
    const items = buildChecklist(order([
      { path: '/lines/1/informedUnitCost/amount', code: 'COST_AMOUNT_REQUIRED' }, { path: '/lines/0/informedUnitCost/taxBasis', code: 'COST_TAX_BASIS_REQUIRED' },
      { path: '/lines/0/informedUnitCost/amount', code: 'COST_AMOUNT_REQUIRED' }, { path: '/lines/1/orderedQuantity', code: 'QUANTITY_REQUIRED' },
    ]))
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ message: 'Falta el costo', lineId: 'line-1', productName: 'Producto 1', count: 2 })
    expect(items[1]).toMatchObject({ message: 'Falta la cantidad', lineId: 'line-2', count: 1 })
  })
  it('links an aggregated family to the first line in order, whatever the order of the diagnostics', () => {
    const [item] = buildChecklist(order([{ path: '/lines/1/informedUnitCost/amount', code: 'COST_AMOUNT_REQUIRED' }, { path: '/lines/0/informedUnitCost/amount', code: 'COST_AMOUNT_REQUIRED' }]))
    expect(item).toMatchObject({ lineId: 'line-1', productName: 'Producto 1', count: 2 })
  })
  it('groups quantity, product or variant reference and unit issues per family too', () => {
    const items = buildChecklist(order([
      { path: '/lines/0/productId', code: 'PRODUCT_REQUIRED' }, { path: '/lines/0/variantId', code: 'VARIANT_REQUIRED' }, { path: '/lines/1/variantId', code: 'REFERENCE_UNAVAILABLE' },
      { path: '/lines/0/orderedQuantity', code: 'QUANTITY_REQUIRED' }, { path: '/lines/0/orderedQuantity', code: 'QUANTITY_FRACTION_NOT_ALLOWED' },
      { path: '/lines/1/informedUnitCost/unit', code: 'UNIT_MISMATCH' },
    ]))
    expect(items.map(item => [item.key, item.message, item.lineId, item.count])).toEqual([
      ['reference', 'Revisa el producto o la variante', 'line-1', 2], ['quantity', 'Revisa la cantidad', 'line-1', 1], ['unit', 'La unidad no coincide con la del producto', 'line-2', 1],
    ])
  })
  it('says Falta only when every code of the family is a missing value', () => {
    expect(buildChecklist(order([{ path: '/lines/0/productId', code: 'PRODUCT_REQUIRED' }, { path: '/lines/1/variantId', code: 'VARIANT_REQUIRED' }]))[0]).toMatchObject({ message: 'Falta el producto o la variante', count: 2 })
  })
  it('sends an issue that points past the lines to the summary instead of a missing line', () => {
    const [item] = buildChecklist(order([{ path: '/lines/9/productId', code: 'PRODUCT_REQUIRED' }]))
    expect(item).toMatchObject({ lineId: null, message: 'Selecciona un producto.' })
  })
  it('is empty for an order without issues', () => {
    expect(buildChecklist(order([]))).toEqual([])
  })
})

describe('line flags', () => {
  const flagged = order([
    { path: '/lines/0/productId', code: 'PRODUCT_REQUIRED' }, { path: '/lines/0/variantId', code: 'VARIANT_REQUIRED' },
    { path: '/lines/1/orderedQuantity', code: 'QUANTITY_REQUIRED' }, { path: '/lines/1/informedUnitCost/amount', code: 'COST_AMOUNT_REQUIRED' }, { path: '/lines/1/informedUnitCost/taxBasis', code: 'COST_TAX_BASIS_REQUIRED' },
  ])
  it('tells which cell of a line is missing', () => {
    expect(lineFlags(flagged, 'line-1')).toEqual({ product: true, variant: true, quantity: false, cost: false, tax: false, any: true })
    expect(lineFlags(flagged, 'line-2')).toEqual({ product: false, variant: false, quantity: true, cost: true, tax: true, any: true })
  })
  it('is all false for a clean line or an unknown id', () => {
    expect(lineFlags(order([]), 'line-1').any).toBe(false)
    expect(lineFlags(flagged, 'nope').any).toBe(false)
  })
})

describe('confirm steps', () => {
  const states = (input: { pending: number; dirty: boolean }) => confirmSteps(input).map(step => `${step.key}:${step.state}`)
  it('Completar is current while items are pending, whatever else changed', () => {
    expect(states({ pending: 2, dirty: false })).toEqual(['complete:current', 'save:upcoming', 'confirm:upcoming'])
    expect(states({ pending: 2, dirty: true })).toEqual(['complete:current', 'save:upcoming', 'confirm:upcoming'])
    expect(confirmSteps({ pending: 2, dirty: false })[0]!.count).toBe(2)
  })
  it('Guardar is current once nothing is pending but changes are unsaved', () => {
    expect(states({ pending: 0, dirty: true })).toEqual(['complete:done', 'save:current', 'confirm:upcoming'])
  })
  it('Confirmar is current when complete and saved', () => {
    expect(states({ pending: 0, dirty: false })).toEqual(['complete:done', 'save:done', 'confirm:current'])
    expect(confirmSteps({ pending: 0, dirty: false }).every(step => step.count === 0)).toBe(true)
  })
  it('labels the steps in Spanish', () => {
    expect(confirmSteps({ pending: 0, dirty: false }).map(step => step.label)).toEqual(['Completar', 'Guardar', 'Confirmar'])
  })
})
