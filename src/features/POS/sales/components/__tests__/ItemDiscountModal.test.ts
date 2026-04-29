import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ItemDiscountModal from '../ItemDiscountModal.vue'
import type { SaleItem } from '../../interfaces/sale.types'

const onApplyDiscount = vi.fn()

const stubs = {
  UModal: { template: '<div><slot name="body" /><slot name="footer" /></div>' },
  Modal: { template: '<div><slot name="body" /><slot name="footer" /></div>' },
  UButton: { props: ['label', 'disabled'], emits: ['click'], template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>' },
  Button: { props: ['label', 'disabled'], emits: ['click'], template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>' },
  UInput: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
  Input: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
  UFormField: { template: '<div><slot /></div>' },
  FormField: { template: '<div><slot /></div>' },
  UAlert: { props: ['description'], template: '<p>{{ description }}</p>' },
}

const item: SaleItem = {
  id: 'item-1', productId: 'prod-1', variantId: null, productName: 'Aspirina', variantName: null,
  quantity: 1, unitPriceCents: 10000, unitPriceCurrency: 'MXN',
}

describe('ItemDiscountModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submits amount mode converting currency units to cents', async () => {
    const wrapper = mount(ItemDiscountModal, { props: { open: true, item, onApplyDiscount }, global: { stubs } })
    expect(wrapper.text()).toContain('Resumen del ítem')
    expect(wrapper.text()).toContain('Modo de descuento')
    await wrapper.findAll('input')[0]!.setValue('50.50')
    await wrapper.find('form').trigger('submit')
    expect(onApplyDiscount).toHaveBeenCalledWith('item-1', { type: 'amount', amountCents: 5050 })
  })

  it('submits percentage mode with percent value', async () => {
    const wrapper = mount(ItemDiscountModal, { props: { open: true, item, onApplyDiscount }, global: { stubs } })
    await wrapper.findAll('button').find((button) => button.text() === 'Porcentaje')?.trigger('click')
    await wrapper.findAll('input')[0]!.setValue('10')
    await wrapper.find('form').trigger('submit')
    expect(onApplyDiscount).toHaveBeenCalledWith('item-1', { type: 'percentage', percent: 10 })
  })

  it('blocks submit when amount exceeds unit price', async () => {
    const wrapper = mount(ItemDiscountModal, { props: { open: true, item, onApplyDiscount }, global: { stubs } })
    await wrapper.findAll('input')[0]!.setValue('150')
    await wrapper.find('form').trigger('submit')
    expect(onApplyDiscount).not.toHaveBeenCalled()
  })

  it('blocks submit when percentage exceeds 100', async () => {
    const wrapper = mount(ItemDiscountModal, { props: { open: true, item, onApplyDiscount }, global: { stubs } })
    await wrapper.findAll('button').find((button) => button.text() === 'Porcentaje')?.trigger('click')
    await wrapper.findAll('input')[0]!.setValue('101')
    await wrapper.find('form').trigger('submit')
    expect(onApplyDiscount).not.toHaveBeenCalled()
  })

  it('includes title in payload when provided', async () => {
    const wrapper = mount(ItemDiscountModal, { props: { open: true, item, onApplyDiscount }, global: { stubs } })
    await wrapper.findAll('input')[0]!.setValue('20')
    await wrapper.findAll('input')[1]!.setValue('Promo especial')
    await wrapper.find('form').trigger('submit')
    expect(onApplyDiscount).toHaveBeenCalledWith('item-1', { type: 'amount', amountCents: 2000, title: 'Promo especial' })
  })
})
