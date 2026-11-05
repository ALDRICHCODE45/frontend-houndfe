import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import GlobalDiscountModal from '../GlobalDiscountModal.vue'

const onApplyGlobalDiscount = vi.fn(() => Promise.resolve())

const fieldStub = { props: ['error'], template: '<div><slot /><p v-if="error">{{ error }}</p></div>' }
const buttonStub = {
  props: ['label', 'disabled'],
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ label }}<slot /></button>',
}
const inputStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}
const stubs = {
  UModal: { template: '<div><slot name="body" /><slot name="footer" /></div>' },
  Modal: { template: '<div><slot name="body" /><slot name="footer" /></div>' },
  UButton: buttonStub,
  Button: buttonStub,
  UInput: inputStub,
  Input: inputStub,
  UFormField: fieldStub,
  FormField: fieldStub,
  UAlert: { props: ['description'], template: '<p>{{ description }}</p>' },
  UIcon: { template: '<span />' },
  Icon: { template: '<span />' },
}

function mountModal() {
  return mount(GlobalDiscountModal, {
    props: { open: true, itemCount: 2, hasExistingDiscounts: false, onApplyGlobalDiscount },
    global: { stubs },
  })
}

async function chooseAmount(wrapper: ReturnType<typeof mountModal>) {
  await wrapper.findAll('button').find((button) => button.text() === 'Monto fijo')?.trigger('click')
}

// T22/S18: the one money rule; `70,55` is 70.55, never 7055.
describe('GlobalDiscountModal typed amounts', () => {
  beforeEach(() => {
    onApplyGlobalDiscount.mockClear()
  })

  it.each([
    ['70.55', 7055],
    ['70,55', 7055],
    ['1,234.50', 123450],
  ])('submits an amount typed as %j as %i cents', async (text, cents) => {
    const wrapper = mountModal()
    await chooseAmount(wrapper)
    await wrapper.findAll('input')[0]!.setValue(text)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(onApplyGlobalDiscount).toHaveBeenCalledWith({ type: 'amount', amountCents: cents, strategy: 'replace' })
  })

  it.each([
    ['12.5', 12.5],
    ['12,5', 12.5],
    ['10', 10],
  ])('submits a percent typed as %j as %d', async (text, percent) => {
    const wrapper = mountModal()
    await wrapper.findAll('input')[0]!.setValue(text)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(onApplyGlobalDiscount).toHaveBeenCalledWith({ type: 'percentage', percent, strategy: 'replace' })
  })

  it.each(['0,100', '1,23,4', '1.005'])('blocks an amount typed as %j', async (text) => {
    const wrapper = mountModal()
    await chooseAmount(wrapper)
    await wrapper.findAll('input')[0]!.setValue(text)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(onApplyGlobalDiscount).not.toHaveBeenCalled()
  })

  it('explains an ambiguous comma under the amount', async () => {
    const wrapper = mountModal()
    await chooseAmount(wrapper)
    await wrapper.findAll('input')[0]!.setValue('0,100')
    expect(wrapper.text()).toContain('Escribe el monto con punto para los centavos, por ejemplo 70.55.')
  })
})
