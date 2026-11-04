import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import PurchaseOrderReadonly from '../PurchaseOrderReadonly.vue'
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
  it('shows the frozen order by readable names, quantities, costs and subtotal', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: confirmed } })
    const text = wrapper.text()
    for (const expected of ['Distribuidora del Norte', 'Croquetas Premium 10 kg', 'Pollo', '12', '$250.00', '$3,000.00', 'Entrega por la puerta trasera', 'Sucursal Centro', 'Bodega 2', 'Confirmada']) expect(text).toContain(expected)
    expect(text).not.toContain('250.00 MXN')
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
    expect(wrapper.text()).toContain('Sin proveedor')
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
    expect(css).toMatch(/\.order-readonly-figures dd[^{]*\{[^}]*text-align: right/)
  })
  it('groups every label with its value, so the details can sit in two columns from md', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: confirmed } })
    const groups = wrapper.findAll('dl.order-readonly-details > div.order-detail')
    expect(groups.map(group => group.get('dt').text())).toEqual(['Estado', 'Proveedor', 'Registro', 'Ubicación', 'Nota'])
    for (const group of groups) { expect(group.findAll('dt')).toHaveLength(1); expect(group.findAll('dd')).toHaveLength(1) }
    expect(groups.filter(group => group.classes().includes('order-detail-wide')).map(group => group.get('dt').text())).toEqual(['Registro', 'Ubicación', 'Nota'])
    expect(wrapper.get('dl.order-readonly-details dd').text()).toBe('Confirmada')
  })
  it('keeps a missing unit cost as a dash instead of a currency', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: { ...confirmed, lines: [{ ...confirmed.lines[0]!, informedUnitCost: null }] } } })
    expect(wrapper.get('[data-testid="line-cost"]').text()).toBe('—')
  })
})
describe('draft shown read-only', () => {
  const draft: PurchaseOrder = { ...confirmed, status: 'DRAFT', supplierId: null, supplierDisplaySnapshot: null, confirmedAt: null, confirmedBy: null, canConfirm: false,
    lines: [{ ...confirmed.lines[0]!, orderedQuantity: null }], lineSubtotals: [{ lineId: 'line-id-1', subtotal: null }],
    validation: { issues: [{ path: '/supplierId', code: 'SUPPLIER_REQUIRED' }, { path: '/lines/0/orderedQuantity', code: 'QUANTITY_REQUIRED' }, { path: '/lines/0/orderedQuantity', code: 'QUANTITY_REQUIRED' }, { path: '/lines/9/productId', code: 'PRODUCT_REQUIRED' }, { path: '/lines/0/mystery', code: 'SOMETHING_NEW' }] } }
  it('shows the Borrador status and the validation issues as readable warnings, never raw codes', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: draft } })
    expect(wrapper.text()).toContain('Borrador')
    const warnings = wrapper.findAll('p.order-warning, .order-warning p').map(item => item.text())
    expect(warnings).toContain('Selecciona un proveedor.')
    expect(warnings).toContain('Selecciona un producto.')
    expect(warnings).toContain('Revisa este dato del borrador.')
    for (const code of ['SUPPLIER_REQUIRED', 'QUANTITY_REQUIRED', 'PRODUCT_REQUIRED', 'SOMETHING_NEW']) expect(wrapper.text()).not.toContain(code)
  })
  it('places a line issue under its own line, once, and the rest in the order summary', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: draft } })
    const line = wrapper.get('[aria-label="Renglón 1"]')
    expect(line.findAll('.order-warning').map(item => item.text()).filter(text => text === 'Indica la cantidad del producto.')).toHaveLength(1)
    expect(wrapper.get('[data-testid="order-readonly-warnings"]').text()).toContain('Selecciona un proveedor.')
    expect(wrapper.get('[data-testid="order-readonly-warnings"]').text()).not.toContain('Indica la cantidad')
  })
  it('has no controls to disable: no buttons, inputs or selects', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: draft } })
    expect(wrapper.findAll('button, input, select, textarea')).toHaveLength(0)
  })
  it('renders no warnings block for a draft without issues', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: { ...draft, validation: { issues: [] } } } })
    expect(wrapper.find('[data-testid="order-readonly-warnings"]').exists()).toBe(false)
  })
})
