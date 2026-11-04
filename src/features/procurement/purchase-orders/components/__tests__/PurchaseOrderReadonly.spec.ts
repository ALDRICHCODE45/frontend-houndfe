import { mount } from '@vue/test-utils'
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
    for (const expected of ['Distribuidora del Norte', 'Croquetas Premium 10 kg', 'Pollo', '12', '250.00', 'MXN', '3000.00', 'Entrega por la puerta trasera', 'Sucursal Centro', 'Bodega 2', 'Confirmada']) expect(text).toContain(expected)
  })
  it('names who closed the order and when, and never renders ids or the opaque token', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: confirmed } })
    expect(wrapper.text()).toContain(`Confirmada por Ana Pérez el ${new Date(confirmed.confirmedAt!).toLocaleString('es-MX')}`)
    for (const hidden of ['order-id-9f2', 'supplier-id-77', 'line-id-1', 'product-id-5', 'variant-id-6', 'tenant-id-3', 'opaque-token']) expect(wrapper.html()).not.toContain(hidden)
    const cancelled = mount(PurchaseOrderReadonly, { props: { order: { ...confirmed, status: 'CANCELLED', confirmedAt: null, confirmedBy: null, cancelledAt: '2026-11-04T09:00:00Z', cancelledBy: { displayName: 'Luis Gómez' } } } })
    expect(cancelled.text()).toContain(`Cancelada por Luis Gómez el ${new Date('2026-11-04T09:00:00Z').toLocaleString('es-MX')}`)
    expect(cancelled.text()).not.toContain('Confirmada por')
  })
  it('keeps readable fallbacks for missing optional data', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: { ...confirmed, note: null, location: { detail: null }, locationSnapshot: { tenantId: 't', tenantName: 'Sucursal Centro', detail: null }, supplierDisplaySnapshot: null, lineDisplaySnapshots: [], lineSubtotals: [] } } })
    expect(wrapper.text()).toContain('Sin proveedor')
    expect(wrapper.text()).toContain('Sin nota')
    expect(wrapper.text()).toContain('Sin producto')
  })
  it('renders a missing subtotal of a never-confirmed cancelled order as a dash', () => {
    const wrapper = mount(PurchaseOrderReadonly, { props: { order: { ...confirmed, status: 'CANCELLED', confirmedAt: null, confirmedBy: null, cancelledAt: '2026-11-04T09:00:00Z', cancelledBy: { displayName: 'Luis Gómez' }, lineSubtotals: [{ lineId: 'line-id-1', subtotal: null }] } } })
    expect(wrapper.text()).toContain('Subtotal: —')
    expect(wrapper.text()).not.toContain('null')
  })
})
