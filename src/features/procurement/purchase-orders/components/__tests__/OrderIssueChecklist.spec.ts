import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OrderIssueChecklist from '../OrderIssueChecklist.vue'
import type { ChecklistItem } from '../../utils/order-checklist'
const cost: ChecklistItem = { key: 'cost', message: 'Indica el importe del costo unitario.', lineId: 'line-2', productName: 'Collar ajustable', count: 1 }
const supplier: ChecklistItem = { key: 'supplier', message: 'Selecciona un proveedor.', lineId: null, productName: null, count: 1 }
const base = { items: [], dirty: false, ready: false }
describe('issue checklist', () => {
  it('is one titled panel listing each pending item once, with the shared id the disabled primary points at', () => {
    const wrapper = mount(OrderIssueChecklist, { props: { ...base, items: [cost, supplier] } })
    expect(wrapper.get('ul').attributes('aria-label')).toBe('Pendientes para confirmar')
    expect(wrapper.get('ul').attributes('id')).toBe('order-checklist')
    const pending = wrapper.findAll('li[data-state="pending"]')
    expect(pending).toHaveLength(2)
    expect(pending[0]!.get('.order-check-message').text()).toBe('Indica el importe del costo unitario.')
    expect(pending[0]!.get('button').text()).toBe('Ir a Collar ajustable')
    expect(pending[1]!.text()).toBe('Selecciona un proveedor.')
  })
  it('links a line item to its line and tells the owner which one', async () => {
    const wrapper = mount(OrderIssueChecklist, { props: { ...base, items: [cost, supplier] } })
    expect(wrapper.findAll('button.order-check-link')).toHaveLength(1)
    await wrapper.get('button.order-check-link').trigger('click')
    expect(wrapper.emitted('goto')).toEqual([['line-2']])
  })
  it('counts the lines when one issue spans several', () => {
    const wrapper = mount(OrderIssueChecklist, { props: { ...base, items: [{ ...cost, count: 3 }] } })
    expect(wrapper.get('li').text()).toContain('Indica el importe del costo unitario. (3 renglones)')
  })
  it('does not offer a link to a line that is no longer there, nor in a read-only view', () => {
    const gone = mount(OrderIssueChecklist, { props: { ...base, items: [cost], linkable: () => false } })
    expect(gone.find('button.order-check-link').exists()).toBe(false)
    expect(gone.text()).toContain('Indica el importe del costo unitario.')
  })
  it('shortens the link on mobile but keeps the product in its accessible name', () => {
    const wrapper = mount(OrderIssueChecklist, { props: { ...base, items: [cost], compact: true } })
    const link = wrapper.get('button.order-check-link')
    expect(link.text()).toBe('Ver renglón')
    expect(link.attributes('aria-label')).toBe('Ir a Collar ajustable')
  })
  it('falls back to a generic link label when the product has no name', () => {
    const wrapper = mount(OrderIssueChecklist, { props: { ...base, items: [{ ...cost, productName: null }] } })
    expect(wrapper.get('button.order-check-link').text()).toBe('Ir al renglón')
  })
  it('asks to save, muted, when changes are unsaved: after the pending items, or alone', () => {
    const both = mount(OrderIssueChecklist, { props: { ...base, items: [cost], dirty: true } })
    expect(both.findAll('li').map(li => li.attributes('data-state'))).toEqual(['pending', 'stale'])
    const alone = mount(OrderIssueChecklist, { props: { ...base, dirty: true, ready: true } })
    expect(alone.findAll('li').map(li => li.text())).toEqual(['Guarda el borrador para validar los cambios'])
    expect(alone.find('[data-state="ready"]').exists()).toBe(false)
  })
  it('says Lista para confirmar when clean and ready, and that it cannot be confirmed yet when clean but not ready', () => {
    expect(mount(OrderIssueChecklist, { props: { ...base, ready: true } }).get('li').text()).toBe('Lista para confirmar')
    expect(mount(OrderIssueChecklist, { props: { ...base } }).get('li').text()).toBe('Todavía no se puede confirmar.')
  })
})
