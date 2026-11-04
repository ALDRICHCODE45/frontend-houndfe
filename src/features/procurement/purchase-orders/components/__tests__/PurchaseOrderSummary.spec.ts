import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PurchaseOrderSummary from '../PurchaseOrderSummary.vue'
import type { PurchaseOrder } from '../../interfaces/purchase-order.types'
const lineOf = (n: number) => ({ lineId: `line-id-${n}`, productId: `product-id-${n}`, variantId: n % 2 ? `variant-id-${n}` : null, orderedQuantity: `${n}.5`, informedUnitCost: { amount: '10', currency: 'MXN', unit: 'KILOGRAMO', taxBasis: 'INCLUDES_TAX' as const } })
const snapshotOf = (n: number) => ({ lineId: `line-id-${n}`, productName: `Producto ${n}`, variantName: n % 2 ? `Variante ${n}` : null, unit: 'KILOGRAMO' })
const orderWith = (count: number): PurchaseOrder => ({
  id: 'order-id-9f2', version: 3, status: 'DRAFT', supplierId: 'supplier-id-77', note: null, location: { detail: 'Bodega 2' },
  lines: Array.from({ length: count }, (_, i) => lineOf(i + 1)), createdAt: '', updatedAt: '',
  supplierDisplaySnapshot: { id: 'supplier-id-77', displayName: 'Distribuidora del Norte', status: 'ACTIVE' },
  lineDisplaySnapshots: Array.from({ length: count }, (_, i) => snapshotOf(i + 1)),
  lineSubtotals: Array.from({ length: count }, (_, i) => ({ lineId: `line-id-${i + 1}`, subtotal: { amount: '15', currency: 'MXN', taxBasis: 'INCLUDES_TAX' as const } })),
  locationSnapshot: { tenantId: 'tenant-id-3', tenantName: 'Sucursal Centro', detail: 'Bodega 2' }, validation: { issues: [] },
  supplierCurrentVersion: 7, referenceToken: 'opaque-token', canConfirm: true, confirmedAt: null, confirmedBy: null, cancelledAt: null, cancelledBy: null,
})
describe('order summary for the confirm and cancel dialogs', () => {
  it('lists supplier, location, line count and each line as product · variant — quantity unit', () => {
    const wrapper = mount(PurchaseOrderSummary, { props: { order: orderWith(2) } })
    const text = wrapper.text()
    for (const expected of ['Proveedor', 'Distribuidora del Norte', 'Ubicación', 'Sucursal Centro · Bodega 2', 'Renglones', '2']) expect(text).toContain(expected)
    const items = wrapper.findAll('li').map(item => item.text())
    expect(items).toEqual(['Producto 1 · Variante 1 — 1.5 Kilogramo', 'Producto 2 — 2.5 Kilogramo'])
    expect(wrapper.element.tagName).toBe('DL')
    expect(text).not.toContain('y 0')
  })
  it('groups label/value pairs so supplier and location can share a row from md', () => {
    const wrapper = mount(PurchaseOrderSummary, { props: { order: orderWith(2) } })
    const groups = wrapper.findAll('dl > div.order-detail')
    expect(groups.map(group => group.get('dt').text())).toEqual(['Proveedor', 'Ubicación', 'Renglones'])
    expect(groups[2]!.classes()).toContain('order-detail-wide')
    expect(groups[2]!.findAll('li')).toHaveLength(2)
  })
  it('caps the list at five lines and says how many are left, singular and plural', () => {
    const six = mount(PurchaseOrderSummary, { props: { order: orderWith(6) } })
    expect(six.findAll('li')).toHaveLength(5)
    expect(six.text()).toContain('y 1 renglón más')
    const seven = mount(PurchaseOrderSummary, { props: { order: orderWith(7) } })
    expect(seven.findAll('li')).toHaveLength(5)
    expect(seven.text()).toContain('y 2 renglones más')
    expect(mount(PurchaseOrderSummary, { props: { order: orderWith(5) } }).text()).not.toContain('más')
  })
  it('computes no totals and never renders ids or the opaque token', () => {
    const wrapper = mount(PurchaseOrderSummary, { props: { order: orderWith(3) } })
    expect(wrapper.text()).not.toMatch(/\$|Total|Subtotal/)
    for (const hidden of ['order-id-9f2', 'supplier-id-77', 'line-id-1', 'product-id-1', 'variant-id-1', 'tenant-id-3', 'opaque-token']) expect(wrapper.html()).not.toContain(hidden)
  })
  it('keeps readable fallbacks for a missing supplier, product or detail', () => {
    const order = { ...orderWith(1), supplierDisplaySnapshot: null, lineDisplaySnapshots: [], locationSnapshot: { tenantId: 't', tenantName: 'Sucursal Centro', detail: null } }
    const wrapper = mount(PurchaseOrderSummary, { props: { order } })
    expect(wrapper.text()).toContain('Sin proveedor')
    expect(wrapper.text()).toContain('Sin producto')
    expect(wrapper.text()).toContain('Sucursal Centro')
    expect(wrapper.text()).not.toContain('Sucursal Centro ·')
  })
  it('says there are no lines instead of an empty list', () => {
    const wrapper = mount(PurchaseOrderSummary, { props: { order: orderWith(0) } })
    expect(wrapper.find('li').exists()).toBe(false)
    expect(wrapper.text()).toContain('Sin renglones')
  })
})
