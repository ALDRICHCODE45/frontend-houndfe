import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PurchaseOrderDetailHeader from '../PurchaseOrderDetailHeader.vue'
import OrderStepStrip from '../OrderStepStrip.vue'
import RowActionsMenu from '@/core/shared/components/RowActionsMenu.vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import type { PurchaseOrder } from '../../interfaces/purchase-order.types'
const order: PurchaseOrder = {
  id: 'order-id-9f2', version: 3, status: 'DRAFT', supplierId: 'supplier-id-77', note: null, location: { detail: null }, lines: [], createdAt: '', updatedAt: '2026-11-03T20:43:00Z',
  supplierDisplaySnapshot: { id: 'supplier-id-77', displayName: 'Distribuidora del Norte', status: 'ACTIVE' }, lineDisplaySnapshots: [], lineSubtotals: [],
  locationSnapshot: { tenantId: 't', tenantName: 'Sucursal Centro', detail: null }, validation: { issues: [] }, supplierCurrentVersion: 7, referenceToken: 'opaque-token', canConfirm: true,
  confirmedAt: null, confirmedBy: null, cancelledAt: null, cancelledBy: null,
}
const actions = [{ key: 'cancel', label: 'Cancelar orden…', icon: 'i-lucide-ban' }, { key: 'discard', label: 'Descartar borrador', icon: 'i-lucide-trash-2', destructive: true }]
const props = { order, showConfirm: true, confirmEnabled: true, actions, dirty: false, pending: 0 }
const mountHeader = (patch: Record<string, unknown> = {}) => mount(PurchaseOrderDetailHeader, { props: { ...props, ...patch }, attachTo: document.body })
describe('detail header', () => {
  it('shows the meta line (status badge, location, guardada date) above the supplier title, with no ids', () => {
    const wrapper = mountHeader()
    const meta = wrapper.get('.order-header-meta')
    expect(meta.get('[data-testid="order-status"]').text()).toBe('Borrador')
    expect(meta.get('[data-testid="order-status"]').attributes('data-tone')).toBe('warning')
    expect(meta.text()).toContain(`Sucursal Centro · guardada ${formatShortDateTime(order.updatedAt)}`)
    expect(wrapper.get('h2').text()).toBe('Distribuidora del Norte')
    expect(wrapper.html()).not.toContain('order-id-9f2')
    wrapper.unmount()
  })
  it('words the meta date after what closed the order', () => {
    const confirmed = mountHeader({ order: { ...order, status: 'CONFIRMED', confirmedAt: '2026-11-04T09:00:00Z' } })
    expect(confirmed.get('.order-header-meta').text()).toContain(`confirmada ${formatShortDateTime('2026-11-04T09:00:00Z')}`)
    expect(confirmed.get('[data-testid="order-status"]').attributes('data-tone')).toBe('success')
    const cancelled = mountHeader({ order: { ...order, status: 'CANCELLED', cancelledAt: '2026-11-05T09:00:00Z' } })
    expect(cancelled.get('.order-header-meta').text()).toContain(`cancelada ${formatShortDateTime('2026-11-05T09:00:00Z')}`)
    expect(cancelled.get('[data-testid="order-status"]').attributes('data-tone')).toBe('neutral')
    confirmed.unmount(); cancelled.unmount()
  })
  it('titles a missing supplier and a new order', () => {
    expect(mountHeader({ order: { ...order, supplierDisplaySnapshot: null } }).get('h2').text()).toBe('Sin proveedor')
    const fresh = mountHeader({ order: null, showConfirm: false, actions: [] })
    expect(fresh.get('h2').text()).toBe('Nueva orden')
    expect(fresh.find('.order-header-meta').exists()).toBe(false)
    expect(fresh.findComponent(OrderStepStrip).exists()).toBe(false)
    expect(fresh.find('[data-testid="confirm-order"]').exists()).toBe(false)
  })
  it('marks a draft the user can only read', () => {
    expect(mountHeader({ readOnly: true }).get('.order-header-meta').text()).toContain('Solo lectura')
    expect(mountHeader().get('.order-header-meta').text()).not.toContain('Solo lectura')
  })
  it('has one primary, Confirmar orden, and a ⋮ for the rest, with no loose secondary buttons', () => {
    const wrapper = mountHeader()
    const buttons = wrapper.findAll('button')
    expect(buttons.map(button => button.attributes('aria-label') ?? button.text())).toEqual(['Confirmar orden', 'Más acciones de la orden', 'Cerrar'])
    expect(wrapper.findAll('button.hf-primary-control')).toHaveLength(1)
    expect(wrapper.get('[data-testid="confirm-order"]').text()).toBe('Confirmar orden')
    expect(wrapper.getComponent(RowActionsMenu).props('actions')).toEqual(actions)
    wrapper.unmount()
  })
  it('omits the primary without the confirm permission and the ⋮ without actions', () => {
    const wrapper = mountHeader({ showConfirm: false, actions: [] })
    expect(wrapper.find('[data-testid="confirm-order"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Más acciones de la orden"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Cerrar"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it('emits confirm from the enabled primary', async () => {
    const wrapper = mountHeader()
    await wrapper.get('[data-testid="confirm-order"]').trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.get('[data-testid="confirm-order"]').attributes('aria-disabled')).toBeUndefined()
    wrapper.unmount()
  })
  it('keeps a not-ready primary aria-disabled, pointing at the checklist, and silent on click', async () => {
    const wrapper = mountHeader({ confirmEnabled: false })
    const primary = wrapper.get('[data-testid="confirm-order"]')
    expect(primary.attributes('aria-disabled')).toBe('true')
    expect(primary.attributes('aria-describedby')).toBe('order-checklist')
    await primary.trigger('click')
    expect(wrapper.emitted('confirm')).toBeUndefined()
    wrapper.unmount()
  })
  it('relays the ⋮ choice and the close button', async () => {
    const wrapper = mountHeader()
    wrapper.getComponent(RowActionsMenu).vm.$emit('select', 'cancel')
    expect(wrapper.emitted('action')).toEqual([['cancel']])
    await wrapper.get('button[aria-label="Cerrar"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
  it('shows the step strip for drafts only, fed by pending and dirty', () => {
    const draft = mountHeader({ pending: 2, dirty: true })
    expect(draft.getComponent(OrderStepStrip).props()).toMatchObject({ pending: 2, dirty: true })
    const confirmed = mountHeader({ order: { ...order, status: 'CONFIRMED' } })
    expect(confirmed.findComponent(OrderStepStrip).exists()).toBe(false)
    draft.unmount(); confirmed.unmount()
  })
  it('exposes the ⋮ trigger and a focus target so a dialog opened from the menu can give focus back', () => {
    const wrapper = mountHeader()
    const exposed = wrapper.vm as unknown as { menuTrigger: () => HTMLElement | null; focusTarget: () => HTMLElement | null }
    expect(exposed.menuTrigger()).toBe(wrapper.get('button[aria-label="Más acciones de la orden"]').element)
    expect(exposed.focusTarget()).toBe(wrapper.get('[data-testid="confirm-order"]').element)
    const noPrimary = mountHeader({ showConfirm: false })
    expect((noPrimary.vm as unknown as { focusTarget: () => HTMLElement | null }).focusTarget()).toBe(noPrimary.get('button[aria-label="Más acciones de la orden"]').element)
    wrapper.unmount(); noPrimary.unmount()
  })
  it('on mobile becomes a bar: close first, no primary (it moves to the sticky bar), compact steps', () => {
    const wrapper = mountHeader({ mobile: true, pending: 1 })
    expect(wrapper.find('[data-testid="confirm-order"]').exists()).toBe(false)
    const buttons = wrapper.findAll('button')
    expect(buttons[0]!.attributes('aria-label')).toBe('Cerrar')
    expect(buttons[buttons.length - 1]!.attributes('aria-label')).toBe('Más acciones de la orden')
    expect(wrapper.getComponent(OrderStepStrip).props('compact')).toBe(true)
    wrapper.unmount()
  })
})
