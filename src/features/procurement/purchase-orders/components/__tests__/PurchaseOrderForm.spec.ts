import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import PurchaseOrderForm from '../PurchaseOrderForm.vue'
import OrderReferencePicker from '../OrderReferencePicker.vue'
vi.mock('@/features/procurement/suppliers/composables/useSuppliers', () => ({ useSuppliers: () => ({ search: shallowRef(''), items: shallowRef([]), hasNext: shallowRef(false), hasPrevious: shallowRef(false), isFetching: shallowRef(false), error: shallowRef(null), next: vi.fn(), back: vi.fn(), refresh: vi.fn() }) }))
vi.mock('../../composables/usePurchaseOrderProducts', () => ({ usePurchaseOrderProducts: () => ({ search: shallowRef(''), items: shallowRef([]), hasNext: shallowRef(false), hasPrevious: shallowRef(false), isFetching: shallowRef(false), error: shallowRef(null), next: vi.fn(), back: vi.fn(), refresh: vi.fn() }) }))
const context = { userId: 'u', tenantId: 't', ready: true, canReadProduct: true, canReadSupplier: true }
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
    const wrapper = mount(PurchaseOrderForm, { props: { initial: null, context }, global: { stubs: { UIcon: true } } })
    await wrapper.get('textarea').setValue('Una nota')
    expect(wrapper.emitted('dirty')?.slice(-1)[0]).toEqual([true])
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]).toEqual([{ supplierId: null, note: 'Una nota', location: { detail: null }, lines: [] }])
    expect(wrapper.get('textarea').element.value).toBe('Una nota')
  })
  it('blocks oversized notes locally but leaves diagnostic warnings nonblocking', async () => {
    const wrapper = mount(PurchaseOrderForm, { props: { initial: null, context } })
    await wrapper.get('textarea').setValue('a'.repeat(2001))
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.text()).toContain('2000 caracteres')
  })
})
