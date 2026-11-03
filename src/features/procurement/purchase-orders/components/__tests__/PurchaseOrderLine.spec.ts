import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import { shallowRef } from 'vue'
import PurchaseOrderLine from '../PurchaseOrderLine.vue'
import { replaceLineProduct } from '../../utils/order-buffer'
vi.mock('../../composables/usePurchaseOrderProducts', () => ({ usePurchaseOrderVariants: () => ({ items: shallowRef([{ id: 'v', name: 'Grande' }]), error: shallowRef(null), isFetching: shallowRef(false), refresh: vi.fn() }) }))
describe('draft line card', () => {
  it('keeps decimal strings, leaves tax pending and displays server subtotal only', async () => {
    const line = replaceLineProduct({ id: 'p', name: 'Harina', type: 'PRODUCT', unit: 'KILOGRAMO', hasVariants: true, useStock: true })
    const wrapper = mount(PurchaseOrderLine, { props: { modelValue: line, index: 0, context: { userId: 'u', tenantId: 't', ready: true, canReadProduct: true }, messages: {}, subtotal: { amount: '23.100', currency: 'MXN', taxBasis: 'INCLUDES_TAX' } } })
    expect(wrapper.get<HTMLSelectElement>('[data-testid="line-tax"]').element.value).toBe('')
    expect(wrapper.text()).toContain('23.100 MXN')
    expect(wrapper.find('input[value="MXN"]').exists()).toBe(false)
    await wrapper.get('[data-testid="line-quantity"]').setValue('1.230')
    expect(wrapper.emitted('update:modelValue')?.slice(-1)[0]?.[0]).toMatchObject({ quantity: '1.230' })
    expect(wrapper.get('[data-testid="line-quantity"]').attributes('step')).toBe('0.001')
    expect(wrapper.text()).not.toContain('Total de la orden')
  })
})
