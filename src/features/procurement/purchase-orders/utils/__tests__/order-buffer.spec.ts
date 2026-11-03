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
  it('blocks a noncanonical quantity on a line added without a product before sending', () => {
    const buffer = createOrderBuffer(null)
    buffer.lines.push(replaceLineProduct(null))
    for (const quantity of ['1e3', '-1', '0', '1.2345']) {
      buffer.lines[0]!.quantity = quantity
      expect(bufferErrors(buffer)).toEqual([{ path: '/lines/0/orderedQuantity', message: 'Escribe una cantidad positiva con el formato de esta unidad.' }])
    }
    buffer.lines[0]!.quantity = '2.5'
    expect(bufferErrors(buffer)).toEqual([])
  })
})
