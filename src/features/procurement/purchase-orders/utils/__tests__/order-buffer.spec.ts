import { describe, it, expect } from 'vitest'
import { createOrderBuffer, serializeOrderBuffer, replaceLineProduct, bufferErrors } from '../order-buffer'
const product = { id: 'p', name: 'Harina', type: 'PRODUCT', unit: 'KILOGRAMO', hasVariants: true, useStock: true }
describe('draft editor buffer', () => {
  it('serializes incomplete drafts with no currency or tax preselection; cost data uses fixed MXN', () => {
    const buffer = createOrderBuffer(null)
    buffer.lines.push(replaceLineProduct(product))
    expect(serializeOrderBuffer(buffer).lines[0]?.informedUnitCost).toBeNull()
    buffer.lines[0]!.amount = '0.1200'
    expect(serializeOrderBuffer(buffer).lines[0]?.informedUnitCost).toEqual({ amount: '0.1200', currency: 'MXN', unit: 'KILOGRAMO', taxBasis: null })
    buffer.lines[0]!.quantity = '1.230'
    expect(serializeOrderBuffer(buffer).lines[0]?.orderedQuantity).toBe('1.230')
    expect(bufferErrors(buffer)).toEqual([])
    expect(replaceLineProduct(product).lineId).not.toBe(buffer.lines[0]!.lineId)
  })
  it('validates only supplied numeric syntax, codepoint lengths and bounds; missing data remains saveable', () => {
    const buffer = createOrderBuffer(null)
    expect(bufferErrors(buffer)).toEqual([])
    buffer.note = '😀'.repeat(2000)
    expect(bufferErrors(buffer)).toEqual([])
    buffer.note += 'a'
    buffer.lines.push(replaceLineProduct({ ...product, unit: 'CAJA' }))
    buffer.lines[0]!.quantity = '1.2'
    buffer.lines[0]!.amount = '1e3'
    expect(bufferErrors(buffer)).toHaveLength(3)
  })
  // Backend contract (L23): an unchanged persisted fraction that became invalid
  // because the catalog unit changed is preserved with a diagnostic, never a 400.
  it('keeps an unchanged persisted fraction saveable but blocks an edited one for an integer unit', () => {
    const saved = {
      id: 'o', version: 2, status: 'DRAFT', supplierId: null, note: null, location: { detail: null },
      lines: [{ lineId: 'l1', productId: 'p', variantId: null, orderedQuantity: '1.5', informedUnitCost: null }],
      createdAt: '', updatedAt: '', supplierDisplaySnapshot: null,
      lineDisplaySnapshots: [{ lineId: 'l1', productName: 'Caja de croquetas', variantName: null, unit: 'CAJA' }],
      lineSubtotals: [], locationSnapshot: { tenantId: 't', tenantName: 'Centro', detail: null },
      validation: { issues: [{ path: '/lines/0/orderedQuantity', code: 'QUANTITY_FRACTION_NOT_ALLOWED' }] },
    } as const
    const buffer = createOrderBuffer(saved as never)
    buffer.note = 'Otro cambio'
    expect(bufferErrors(buffer)).toEqual([])
    buffer.lines[0]!.quantity = '2.5'
    expect(bufferErrors(buffer)).toEqual([{ path: '/lines/0/orderedQuantity', message: 'Escribe una cantidad positiva con el formato de esta unidad; usa punto para los decimales.' }])
    buffer.lines[0]!.quantity = '1e3'
    expect(bufferErrors(buffer)).toHaveLength(1)
    buffer.lines[0]!.quantity = '1.5'
    expect(bufferErrors(buffer)).toEqual([])
  })
  it('blocks a noncanonical quantity on a line added without a product before sending', () => {
    const buffer = createOrderBuffer(null)
    buffer.lines.push(replaceLineProduct(null))
    for (const quantity of ['1e3', '-1', '0', '1.2345']) {
      buffer.lines[0]!.quantity = quantity
      expect(bufferErrors(buffer)).toEqual([{ path: '/lines/0/orderedQuantity', message: 'Escribe una cantidad positiva con el formato de esta unidad; usa punto para los decimales.' }])
    }
    buffer.lines[0]!.quantity = '2.5'
    expect(bufferErrors(buffer)).toEqual([])
  })
  // T22/S18: amounts travel as strings; a comma is never guessed, so the message says to use a dot.
  it('asks for a dot when a cost is written with a comma', () => {
    const buffer = createOrderBuffer(null)
    buffer.lines.push(replaceLineProduct(product))
    buffer.lines[0]!.amount = '70,55'
    expect(bufferErrors(buffer)).toEqual([{ path: '/lines/0/informedUnitCost/amount', message: 'Escribe el importe sin comas; usa punto para los decimales (hasta cuatro).' }])
  })
})
