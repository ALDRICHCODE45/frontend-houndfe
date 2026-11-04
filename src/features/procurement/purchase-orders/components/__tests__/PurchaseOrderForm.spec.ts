import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, shallowRef } from 'vue'
import PurchaseOrderForm from '../PurchaseOrderForm.vue'
import OrderReferencePicker from '../OrderReferencePicker.vue'
import OrderIssueChecklist from '../OrderIssueChecklist.vue'
import RowActionsMenu from '@/core/shared/components/RowActionsMenu.vue'
import type { PurchaseOrder } from '../../interfaces/purchase-order.types'
vi.mock('@/features/procurement/suppliers/composables/useSuppliers', () => ({ useSuppliers: () => ({ search: shallowRef(''), items: shallowRef([]), hasNext: shallowRef(false), hasPrevious: shallowRef(false), isFetching: shallowRef(false), error: shallowRef(null), next: vi.fn(), back: vi.fn(), refresh: vi.fn() }) }))
vi.mock('../../composables/usePurchaseOrderProducts', () => {
  const list = () => ({ search: shallowRef(''), items: shallowRef([]), hasNext: shallowRef(false), hasPrevious: shallowRef(false), isFetching: shallowRef(false), error: shallowRef(null), next: vi.fn(), back: vi.fn(), refresh: vi.fn() })
  return { usePurchaseOrderProducts: list, usePurchaseOrderVariants: list }
})
const context = { userId: 'u', tenantId: 't', ready: true, canReadProduct: true, canReadSupplier: true }
const stubs = { UIcon: true }
const saved: PurchaseOrder = {
  id: 'order-id', version: 3, status: 'DRAFT', supplierId: 'supplier-id', note: 'Reposición', location: { detail: 'Bodega 3' },
  lines: [
    { lineId: 'line-1', productId: 'p1', variantId: null, orderedQuantity: '12', informedUnitCost: { amount: '780.50', currency: 'MXN', unit: 'BOLSA', taxBasis: 'EXCLUDES_TAX' } },
    { lineId: 'line-2', productId: 'p2', variantId: null, orderedQuantity: '24', informedUnitCost: null },
  ],
  createdAt: '', updatedAt: '2026-11-03T20:43:00Z', supplierDisplaySnapshot: { id: 'supplier-id', displayName: 'Distribuidora', status: 'ACTIVE' },
  lineDisplaySnapshots: [{ lineId: 'line-1', productName: 'Croquetas', variantName: null, unit: 'BOLSA' }, { lineId: 'line-2', productName: 'Collar ajustable', variantName: null, unit: 'UNIDAD' }],
  lineSubtotals: [{ lineId: 'line-1', subtotal: { amount: '9366.00', currency: 'MXN', taxBasis: 'EXCLUDES_TAX' } }, { lineId: 'line-2', subtotal: null }],
  locationSnapshot: { tenantId: 't', tenantName: 'Sucursal', detail: 'Bodega 3' },
  validation: { issues: [{ path: '/lines/1/informedUnitCost/amount', code: 'COST_AMOUNT_REQUIRED' }, { path: '/lines/1/informedUnitCost/taxBasis', code: 'COST_TAX_BASIS_REQUIRED' }] },
  supplierCurrentVersion: 7, referenceToken: 'opaque', canConfirm: false, confirmedAt: null, confirmedBy: null, cancelledAt: null, cancelledBy: null,
}
const mountForm = (initial: PurchaseOrder | null = null, extra: Record<string, unknown> = {}) => mount(PurchaseOrderForm, { props: { initial, context, ...extra }, global: { stubs }, attachTo: document.body })

describe('draft form', () => {
  it('binds supplier selection and server search through a single searchable control', async () => {
    const wrapper = mount(PurchaseOrderForm, { props: { initial: null, context }, global: { stubs: { OrderReferencePicker: true } } })
    const picker = wrapper.getComponent(OrderReferencePicker)
    expect(wrapper.find('input[placeholder="Buscar proveedor activo..."]').exists()).toBe(false)
    expect(wrapper.find('select[data-testid="order-supplier"]').exists()).toBe(false)
    picker.vm.$emit('update:modelValue', { id: 'supplier', label: 'Proveedor activo' })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({ supplierId: 'supplier' })
  })
  it('saves an incomplete order and tracks unsaved changes without silently resetting', async () => {
    const wrapper = mountForm()
    await wrapper.get('textarea').setValue('Una nota')
    expect(wrapper.emitted('dirty')?.slice(-1)[0]).toEqual([true])
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]).toEqual([{ supplierId: null, note: 'Una nota', location: { detail: null }, lines: [] }])
    expect(wrapper.get('textarea').element.value).toBe('Una nota')
    wrapper.unmount()
  })
  it('blocks oversized notes locally but leaves server diagnostics nonblocking', async () => {
    const wrapper = mountForm()
    await wrapper.get('textarea').setValue('a'.repeat(2001))
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.text()).toContain('2000 caracteres')
    wrapper.unmount()
  })
  it('exposes a stable form id so the footer can submit it from outside', () => {
    const wrapper = mountForm()
    expect(wrapper.get('form').attributes('id')).toBe('purchase-order-form')
    expect(wrapper.get('form').classes()).toContain('order-form')
    wrapper.unmount()
  })
  it('no longer carries a Cerrar or Guardar button: the header closes and the footer saves', () => {
    const wrapper = mountForm()
    expect(wrapper.findAll('button').map(button => button.text())).not.toContain('Guardar borrador')
    expect(wrapper.findAll('button').map(button => button.text())).not.toContain('Cerrar')
    expect(wrapper.emitted('cancel')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('text diet', () => {
  it('ships no permanent help paragraphs or character limits', () => {
    const wrapper = mountForm(saved)
    for (const copy of ['Puedes guardar el borrador incompleto', 'Hasta 2000 caracteres', 'Hasta 500 caracteres', 'Proveedor archivado. Puedes conservarlo']) expect(wrapper.text()).not.toContain(copy)
    expect(wrapper.find('.order-help').exists()).toBe(false)
    wrapper.unmount()
  })
  it('shows the note counter only from 90% of the limit, then warns, then flags the limit', async () => {
    const wrapper = mountForm()
    expect(wrapper.find('.order-counter').exists()).toBe(false)
    await wrapper.get('textarea').setValue('a'.repeat(1799))
    expect(wrapper.find('.order-counter').exists()).toBe(false)
    await wrapper.get('textarea').setValue('a'.repeat(1850))
    const counter = wrapper.get('.order-counter')
    expect(counter.text()).toBe('1,850 / 2,000')
    expect(counter.attributes('aria-live')).toBe('polite')
    expect(counter.classes()).not.toContain('is-limit')
    await wrapper.get('textarea').setValue('a'.repeat(2000))
    expect(wrapper.get('.order-counter').classes()).toContain('is-limit')
    wrapper.unmount()
  })
  it('shows the location counter from 450 of 500', async () => {
    const wrapper = mountForm()
    const input = wrapper.get('input[type="text"]')
    await input.setValue('a'.repeat(449))
    expect(wrapper.find('.order-counter').exists()).toBe(false)
    await input.setValue('a'.repeat(450))
    expect(wrapper.get('.order-counter').text()).toBe('450 / 500')
    wrapper.unmount()
  })
  it('puts supplier and location detail in two columns, then the note below', () => {
    const wrapper = mountForm(saved)
    const grid = wrapper.get('.order-grid')
    expect(grid.text()).toContain('Proveedor')
    expect(grid.text()).toContain('Detalle de ubicación')
    expect(grid.text()).not.toContain('Nota')
    const note = wrapper.get('textarea').element
    expect(grid.element.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    wrapper.unmount()
  })
})

describe('issue checklist', () => {
  it('lists the server pending items once, above the fields, and never repeats them per field', () => {
    const wrapper = mountForm(saved)
    const checklist = wrapper.getComponent(OrderIssueChecklist)
    expect(checklist.props('items').map((item: { message: string }) => item.message)).toEqual(['Indica el importe del costo unitario.', 'Indica si el costo incluye impuestos.'])
    expect(wrapper.text().split('Indica el importe del costo unitario.').length - 1).toBe(1)
    expect(wrapper.get('form').element.firstElementChild).toBe(checklist.element)
    wrapper.unmount()
  })
  it('does not render for a new order, which has nothing validated yet', () => {
    const wrapper = mountForm()
    expect(wrapper.findComponent(OrderIssueChecklist).exists()).toBe(false)
    wrapper.unmount()
  })
  it('tells the checklist about unsaved changes and the server canConfirm', async () => {
    const wrapper = mountForm({ ...saved, validation: { issues: [] }, canConfirm: true })
    expect(wrapper.getComponent(OrderIssueChecklist).props()).toMatchObject({ dirty: false, ready: true })
    await wrapper.get('textarea').setValue('cambio')
    expect(wrapper.getComponent(OrderIssueChecklist).props('dirty')).toBe(true)
    wrapper.unmount()
  })
  it('opens the flagged line and focuses its missing field when the link is used', async () => {
    const wrapper = mountForm(saved)
    expect(wrapper.find('[data-testid="line-amount"]').exists()).toBe(false)
    await wrapper.get('button.order-check-link').trigger('click')
    await nextTick(); await nextTick()
    const amount = wrapper.get('[data-testid="line-amount"]')
    expect(document.activeElement).toBe(amount.element)
    expect(amount.attributes('aria-invalid')).toBe('true')
    wrapper.unmount()
  })
  it('points the checklist link at a line that the user already removed as unavailable', async () => {
    const wrapper = mountForm(saved)
    const removable = wrapper.findAll('.order-line-group')[1]!
    removable.getComponent(RowActionsMenu).vm.$emit('select', 'remove')
    await nextTick()
    expect(wrapper.find('button.order-check-link').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('lines section', () => {
  it('renders compact rows with a table header, the heading count and an outline Agregar renglón', () => {
    const wrapper = mountForm(saved)
    expect(wrapper.get('.order-section-heading h2').text()).toBe('Renglones · 2')
    expect(wrapper.findAll('.order-line-group')).toHaveLength(2)
    expect(wrapper.get('.order-lines-head').text()).toContain('Costo unit.')
    expect(wrapper.findAll('button').map(button => button.text())).toContain('Agregar renglón')
    wrapper.unmount()
  })
  it('shows the saved subtotal only while the line is unchanged', async () => {
    const wrapper = mountForm(saved)
    const subtotal = () => wrapper.findAll('[data-testid="line-subtotal"]')[0]!.text()
    expect(subtotal()).toBe('$9,366.00')
    await wrapper.get('button.order-line-toggle').trigger('click')
    await wrapper.get('[data-testid="line-quantity"]').setValue('13')
    expect(subtotal()).toBe('—')
    wrapper.unmount()
  })
  it('opens the lines with local errors when saving is refused', async () => {
    const wrapper = mountForm(saved)
    await wrapper.get('button.order-line-toggle').trigger('click')
    await wrapper.get('[data-testid="line-quantity"]').setValue('doce')
    await wrapper.get('button.order-line-done').trigger('click')
    expect(wrapper.find('[data-testid="line-quantity"]').exists()).toBe(false)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()
    await nextTick()
    expect(wrapper.find('[data-testid="line-quantity"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Escribe una cantidad positiva')
    wrapper.unmount()
  })
})

describe('mobile form', () => {
  it('collapses location and note into one "Nota y ubicación" row that summarizes the location', () => {
    const wrapper = mountForm(saved, { mobile: true })
    const more = wrapper.get('details.order-more')
    expect(more.attributes('open')).toBeUndefined()
    expect(more.get('summary').text()).toContain('Nota y ubicación')
    expect(more.get('summary').text()).toContain('Bodega 3')
    expect(more.find('textarea').exists()).toBe(true)
    expect(wrapper.find('.order-grid').exists()).toBe(false)
    wrapper.unmount()
  })
  it('keeps the supplier outside the collapsed row, full width', () => {
    const wrapper = mountForm(saved, { mobile: true })
    expect(wrapper.get('details.order-more').text()).not.toContain('Proveedor')
    expect(wrapper.text()).toContain('Proveedor')
    wrapper.unmount()
  })
  it('opens the row when saving is refused because of the note or the location', async () => {
    const wrapper = mountForm(saved, { mobile: true })
    await wrapper.get('textarea').setValue('a'.repeat(2001))
    await wrapper.get('form').trigger('submit')
    await nextTick()
    expect(wrapper.get('details.order-more').attributes('open')).toBeDefined()
    expect(wrapper.text()).toContain('2000 caracteres')
    wrapper.unmount()
  })
  it('keeps the two-column grid on desktop and no collapsed row', () => {
    const wrapper = mountForm(saved)
    expect(wrapper.find('details.order-more').exists()).toBe(false)
    expect(wrapper.find('.order-grid').exists()).toBe(true)
    wrapper.unmount()
  })
})
