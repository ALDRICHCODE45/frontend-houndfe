import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import OrderReferencePicker from '../OrderReferencePicker.vue'
const select = defineComponent({ props: ['items', 'modelValue', 'searchTerm', 'ignoreFilter'], template: '<div><slot name="content-bottom"/></div>' })
describe('searchable order reference picker', () => {
  it('uses server search, retains the selected archived option across pages and emits selection', async () => {
    const archived = { id: 'old', label: 'Proveedor · Archivado' }
    const active = { id: 'new', label: 'Proveedor activo' }
    const wrapper = mount(OrderReferencePicker, { props: { modelValue: archived, items: [active], searchTerm: '', clearLabel: 'Sin proveedor', hasNext: true, hasPrevious: false, placeholder: 'Proveedor', searchPlaceholder: 'Buscar proveedor activo...' }, global: { stubs: { SelectMenu: select, USelectMenu: select, UButton: { template: '<button><slot/></button>' } } } })
    const menu = wrapper.getComponent(select)
    expect(menu.props('ignoreFilter')).toBe(true)
    expect(menu.props('items')).toContainEqual(archived)
    menu.vm.$emit('update:searchTerm', 'nuevo')
    expect(wrapper.emitted('update:searchTerm')?.[0]).toEqual(['nuevo'])
    menu.vm.$emit('update:modelValue', 'new')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([active])
    await wrapper.get('[data-testid="picker-next"]').trigger('click')
    expect(wrapper.emitted('next')).toHaveLength(1)
    menu.vm.$emit('update:modelValue', '')
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([null])
  })
})
