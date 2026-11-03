import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/core/shared/components/DataTable/AppDataTable.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({ name: 'AppDataTable', props: ['data', 'columns', 'loading', 'mobileRender', 'displayMode', 'totalCount'], setup(props, { slots }) {
    return () => h('div', props.loading ? 'Cargando proveedores' : props.data.map((row: Record<string, unknown>) => slots['mobile-card']?.({ row })))
  } }) }
})
import SupplierList from '../SupplierList.vue'
const supplier = { id: 'one', displayName: 'Proveedor Centro', termsText: null, status: 'ACTIVE' as const, version: 1, createdAt: '', updatedAt: '' }
describe('supplier list', () => {
  it('uses the canonical responsive table without fabricated totals or sorting', () => {
    const wrapper = mount(SupplierList, { props: { items: [supplier], canEdit: false } })
    const table = wrapper.getComponent({ name: 'AppDataTable' })
    expect(table.props('mobileRender')).toBe('cards')
    expect(table.props('displayMode')).toBe('auto')
    expect(table.props('totalCount')).toBeUndefined()
    expect(table.props('columns').every((column: { enableSorting: boolean }) => column.enableSorting === false)).toBe(true)
    wrapper.unmount()
  })
  it('exposes details with a native button but no state mutation to read-only users', async () => {
    const wrapper = mount(SupplierList, { props: { items: [supplier], canEdit: false } })
    expect(wrapper.text()).not.toContain('Archivar')
    await wrapper.get('[data-testid="supplier-detail"]').trigger('click')
    expect(wrapper.emitted('open')?.[0]).toEqual([supplier])
    wrapper.unmount()
  })
  it.each(['ACTIVE', 'ARCHIVED'] as const)('offers an explicit state action for %s', async status => {
    const row = { ...supplier, status }
    const wrapper = mount(SupplierList, { props: { items: [row], canEdit: true } })
    const button = wrapper.get('[data-testid="supplier-status"]')
    expect(button.text()).toBe(status === 'ACTIVE' ? 'Archivar' : 'Reactivar')
    await button.trigger('click')
    expect(wrapper.emitted('changeStatus')?.[0]).toEqual([row])
    wrapper.unmount()
  })
  it('does not present an empty result during loading', () => {
    const wrapper = mount(SupplierList, { props: { items: [], loading: true, canEdit: false } })
    expect(wrapper.text()).toContain('Cargando proveedores')
    expect(wrapper.text()).not.toContain('No hay proveedores')
    wrapper.unmount()
  })
})
