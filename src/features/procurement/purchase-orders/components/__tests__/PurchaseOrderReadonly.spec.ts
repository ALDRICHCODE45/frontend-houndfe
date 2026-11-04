import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import PurchaseOrderReadonly from '../PurchaseOrderReadonly.vue'
import OrderIssueChecklist from '../OrderIssueChecklist.vue'
import type { PurchaseOrder } from '../../interfaces/purchase-order.types'
const confirmed: PurchaseOrder = {
  id: 'order-id-9f2', version: 4, status: 'CONFIRMED', supplierId: 'supplier-id-77', note: 'Entrega por la puerta trasera', location: { detail: 'Bodega 2' },
  lines: [{ lineId: 'line-id-1', productId: 'product-id-5', variantId: 'variant-id-6', orderedQuantity: '12', informedUnitCost: { amount: '250.00', currency: 'MXN', unit: 'BOLSA', taxBasis: 'INCLUDES_TAX' } }],
  createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-03T10:00:00Z',
  supplierDisplaySnapshot: { id: 'supplier-id-77', displayName: 'Distribuidora del Norte', status: 'ACTIVE' },
  lineDisplaySnapshots: [{ lineId: 'line-id-1', productName: 'Croquetas Premium 10 kg', variantName: 'Pollo', unit: 'BOLSA' }],
  lineSubtotals: [{ lineId: 'line-id-1', subtotal: { amount: '3000.00', currency: 'MXN', taxBasis: 'INCLUDES_TAX' } }],
  locationSnapshot: { tenantId: 'tenant-id-3', tenantName: 'Sucursal Centro', detail: 'Bodega 2' }, validation: { issues: [] },
  supplierCurrentVersion: 7, referenceToken: 'opaque-token', canConfirm: false,
  confirmedAt: '2026-11-03T10:00:00Z', confirmedBy: { displayName: 'Ana Pérez' }, cancelledAt: null, cancelledBy: null,
}
describe('closed order read-only block', () => {
  it('shows the frozen lines by readable names, quantities, costs and subtotal; supplier and status now live in the header', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: confirmed } })
    const text = wrapper.text()
    for (const expected of ['Croquetas Premium 10 kg', 'Pollo', '12 Bolsa', '$250.00', 'con imp.', '$3,000.00', 'Entrega por la puerta trasera', 'Sucursal Centro', 'Bodega 2']) expect(text).toContain(expected)
    expect(text).not.toContain('250.00 MXN')
    expect(wrapper.find('dl.order-readonly-details').text()).not.toContain('Estado')
  })
  it('names who closed the order and when, and never renders ids or the opaque token', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: confirmed } })
    expect(wrapper.text()).toContain(`Confirmada por Ana Pérez el ${new Date(confirmed.confirmedAt!).toLocaleString('es-MX')}`)
    for (const hidden of ['order-id-9f2', 'supplier-id-77', 'line-id-1', 'product-id-5', 'variant-id-6', 'tenant-id-3', 'opaque-token']) expect(wrapper.html()).not.toContain(hidden)
    const cancelled = mount(PurchaseOrderReadonly, { props: { order: { ...confirmed, status: 'CANCELLED', confirmedAt: null, confirmedBy: null, cancelledAt: '2026-11-04T09:00:00Z', cancelledBy: { displayName: 'Luis Gómez' } } } })
    expect(cancelled.text()).toContain(`Cancelada por Luis Gómez el ${new Date('2026-11-04T09:00:00Z').toLocaleString('es-MX')}`)
    expect(cancelled.text()).not.toContain('Confirmada por')
  })
  it('keeps who confirmed a later cancelled order next to who cancelled it', () => {
    const both = mount(PurchaseOrderReadonly, { props: { order: { ...confirmed, status: 'CANCELLED', cancelledAt: '2026-11-04T09:00:00Z', cancelledBy: { displayName: 'Luis Gómez' } } } })
    expect(both.text()).toContain(`Confirmada por Ana Pérez el ${new Date(confirmed.confirmedAt!).toLocaleString('es-MX')}`)
    expect(both.text()).toContain(`Cancelada por Luis Gómez el ${new Date('2026-11-04T09:00:00Z').toLocaleString('es-MX')}`)
  })
  it('keeps readable fallbacks for missing optional data', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: { ...confirmed, note: null, location: { detail: null }, locationSnapshot: { tenantId: 't', tenantName: 'Sucursal Centro', detail: null }, supplierDisplaySnapshot: null, lineDisplaySnapshots: [], lineSubtotals: [] } } })
    expect(wrapper.text()).toContain('Sin nota')
    expect(wrapper.text()).toContain('Sin producto')
  })
  it('renders a missing subtotal of a never-confirmed cancelled order as a dash', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: { ...confirmed, status: 'CANCELLED', confirmedAt: null, confirmedBy: null, cancelledAt: '2026-11-04T09:00:00Z', cancelledBy: { displayName: 'Luis Gómez' }, lineSubtotals: [{ lineId: 'line-id-1', subtotal: null }] } } })
    expect(wrapper.get('[data-testid="line-subtotal"]').text()).toBe('—')
    expect(wrapper.text()).not.toContain('null')
  })
  it('formats money as es-MX currency in tabular right-aligned cells, keeping server precision', () => {
    const precise = { ...confirmed, lines: [{ ...confirmed.lines[0]!, informedUnitCost: { amount: '12.125', currency: 'MXN', unit: 'BOLSA', taxBasis: 'EXCLUDES_TAX' as const } }], lineSubtotals: [{ lineId: 'line-id-1', subtotal: { amount: '145.5', currency: 'MXN', taxBasis: 'EXCLUDES_TAX' as const } }] }
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: precise } })
    expect(wrapper.get('[data-testid="line-cost"]').text()).toBe('$12.125')
    expect(wrapper.get('[data-testid="line-subtotal"]').text()).toBe('$145.50')
    for (const cell of ['line-cost', 'line-subtotal']) {
      expect(wrapper.get(`[data-testid="${cell}"]`).classes()).toContain('order-money')
      expect(wrapper.get(`[data-testid="${cell}"]`).text()).toMatch(/\$[\d,]+\.\d{2}/)
    }
    const css = readFileSync('src/features/procurement/purchase-orders/styles/purchase-orders-visual.css', 'utf8')
    expect(css).toMatch(/\.order-money[^{]*\{[^}]*font-variant-numeric: tabular-nums/)
    expect(css).toMatch(/\.order-money[^{]*\{[^}]*text-align: right/)
  })
  it('keeps the closure record, the location and the note as label/value pairs', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: confirmed } })
    const groups = wrapper.findAll('dl.order-readonly-details > div.order-detail')
    expect(groups.map(group => group.get('dt').text())).toEqual(['Registro', 'Ubicación', 'Nota'])
    for (const group of groups) { expect(group.findAll('dt')).toHaveLength(1); expect(group.findAll('dd')).toHaveLength(1) }
  })
  it('keeps a missing unit cost as a dash instead of a currency', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: { ...confirmed, lines: [{ ...confirmed.lines[0]!, informedUnitCost: null }] } } })
    expect(wrapper.get('[data-testid="line-cost"]').text()).toBe('—')
  })
  it('lays the lines out like the editor but with no control to edit them', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: confirmed } })
    expect(wrapper.get('.order-lines-head').text()).toContain('Subtotal')
    expect(wrapper.findAll('.order-line-row')).toHaveLength(1)
    expect(wrapper.get('h2').text()).toBe('Renglones · 1')
    expect(wrapper.findAll('button, input, select, textarea, a')).toHaveLength(0)
  })
})
describe('draft shown read-only', () => {
  const draft: PurchaseOrder = { ...confirmed, status: 'DRAFT', supplierId: null, supplierDisplaySnapshot: null, confirmedAt: null, confirmedBy: null, canConfirm: false,
    lines: [{ ...confirmed.lines[0]!, orderedQuantity: null }], lineSubtotals: [{ lineId: 'line-id-1', subtotal: null }],
    validation: { issues: [{ path: '/supplierId', code: 'SUPPLIER_REQUIRED' }, { path: '/lines/0/orderedQuantity', code: 'QUANTITY_REQUIRED' }, { path: '/lines/0/orderedQuantity', code: 'QUANTITY_REQUIRED' }, { path: '/lines/9/productId', code: 'PRODUCT_REQUIRED' }, { path: '/lines/0/mystery', code: 'SOMETHING_NEW' }] } }
  it('lists the validation issues once in the checklist as readable text, never raw codes, without links', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: draft } })
    const block = wrapper.get('[data-testid="order-readonly-warnings"]')
    expect(block.text()).toContain('Selecciona un proveedor.')
    expect(block.text()).toContain('Indica la cantidad del producto.')
    expect(block.text()).toContain('Selecciona un producto.')
    expect(block.text()).toContain('Revisa este dato del borrador.')
    expect(block.text().split('Indica la cantidad del producto.').length - 1).toBe(1)
    for (const code of ['SUPPLIER_REQUIRED', 'QUANTITY_REQUIRED', 'PRODUCT_REQUIRED', 'SOMETHING_NEW']) expect(wrapper.text()).not.toContain(code)
    expect(block.find('button').exists()).toBe(false)
    expect(wrapper.getComponent(OrderIssueChecklist).props('linkable')?.('line-id-1')).toBe(false)
  })
  it('tints the flagged line and marks what is missing instead of repeating the message under it', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: draft } })
    const row = wrapper.get('.order-line-row')
    expect(row.attributes('data-flagged')).toBe('true')
    expect(row.get('.order-line-qty').text()).toContain('Falta')
    expect(wrapper.get('[aria-label="Renglón 1"]').text().split('Indica la cantidad del producto.').length - 1).toBe(0)
  })
  it('has no controls to disable: no buttons, inputs or selects', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: draft } })
    expect(wrapper.findAll('button, input, select, textarea')).toHaveLength(0)
  })
  it('renders no checklist for a draft without issues', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: { ...draft, validation: { issues: [] } } } })
    expect(wrapper.find('[data-testid="order-readonly-warnings"]').exists()).toBe(false)
  })
})
