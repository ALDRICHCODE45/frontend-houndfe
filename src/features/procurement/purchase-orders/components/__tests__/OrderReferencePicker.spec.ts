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
    const clear = menu.props('items').find((item: { label: string }) => item.label === 'Sin proveedor')
    menu.vm.$emit('update:modelValue', clear.id)
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([null])
  })
  // Reka's ComboboxItem throws at runtime for an empty-string value, which
  // broke the real supplier picker; every option needs a non-empty value.
  it('never gives an option or the cleared selection an empty-string value', async () => {
    const wrapper = mount(OrderReferencePicker, { props: { modelValue: null, items: [{ id: 'a', label: 'A' }], searchTerm: '', clearLabel: 'Sin proveedor', placeholder: 'Proveedor', searchPlaceholder: 'Buscar...' }, global: { stubs: { USelectMenu: select, UButton: true } } })
    const menu = wrapper.getComponent(select)
    expect(menu.props('items').every((item: { id: string }) => item.id !== '')).toBe(true)
    expect(menu.props('modelValue')).not.toBe('')
    await wrapper.setProps({ clearLabel: undefined })
    expect(menu.props('modelValue')).not.toBe('')
  })
})
