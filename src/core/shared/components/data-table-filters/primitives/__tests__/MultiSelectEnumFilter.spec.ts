import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MultiSelectEnumFilter from '../MultiSelectEnumFilter.vue'

const SelectStub = {
  name: 'SelectStub',
  props: ['modelValue', 'searchInput', 'valueKey', 'items', 'multiple'],
  emits: ['update:model-value'],
  template: '<div data-testid="u-select-menu" :data-searchable="String(searchInput)" :data-value-key="valueKey" :data-multiple="String(multiple)"><slot /><slot name="content-bottom" /></div>',
}

const CheckboxStub = {
  name: 'CheckboxStub',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<button data-testid="u-checkbox" @click="$emit(\'update:modelValue\', !modelValue)"></button>',
}

function mountComponent(overrideProps: Record<string, unknown> = {}) {
  return mount(MultiSelectEnumFilter, {
    props: {
      modelValue: [],
      label: 'Estado',
      placeholder: 'Seleccioná estados',
      includeNullOption: 'Incluir sin valor',
      includeNullValue: false,
      options: [
        { label: 'Pagada', value: 'PAID' },
        { label: 'Parcial', value: 'PARTIAL' },
      ],
      ...overrideProps,
    },
    global: {
      stubs: {
        USelectMenu: {
          ...SelectStub,
        },
        SelectMenu: { ...SelectStub },
        UCheckbox: {
          ...CheckboxStub,
        },
        Checkbox: { ...CheckboxStub },
         UFormField: { props: ['error'], template: '<div><slot /><p data-testid="error">{{ error }}</p></div>' },
       },
     },
   })
}

describe('MultiSelectEnumFilter', () => {
  it('renders with default props', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[data-testid="multi-select-enum-filter"]').exists()).toBe(true)
  })

  it('emits single selected value', async () => {
    const wrapper = mountComponent()
    const select = wrapper.findComponent(SelectStub)

    select.vm.$emit('update:model-value', ['PAID'])
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['PAID']])
  })

  it('emits multiple selected values', async () => {
    const wrapper = mountComponent()
    const select = wrapper.findComponent(SelectStub)

    select.vm.$emit('update:model-value', ['PAID'])
    select.vm.$emit('update:model-value', ['PAID', 'PARTIAL'])
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([['PAID', 'PARTIAL']])
  })

  it('toggles includeNull on/off via bound model', async () => {
    const wrapper = mountComponent({ includeNullValue: false })
    const checkbox = wrapper.findComponent(CheckboxStub)

    await checkbox.trigger('click')
    await wrapper.setProps({ includeNullValue: true })
    await checkbox.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:includeNullValue')).toEqual([[true], [false]])
  })

  it('renders external error message', () => {
    const wrapper = mountComponent({
      error: 'Demasiados valores seleccionados',
      options: [{ label: 'Pagada', value: 'PAID' }],
    })

    expect(wrapper.text()).toContain('Demasiados valores seleccionados')
  })

  it('passes searchable flag and canonical value-key/multiple to USelectMenu', () => {
    const wrapper = mountComponent({
      options: [{ label: 'Pagada', value: 'PAID' }],
      searchable: true,
    })

    const select = wrapper.get('[data-testid="enum-select"]')
    expect(select.attributes('data-searchable')).toBe('true')
    expect(select.attributes('data-value-key')).toBe('value')
    expect(select.attributes('data-multiple')).toBe('true')
    const selectVm = wrapper.findComponent(SelectStub).vm as { $props: { items: Array<{ label: string; value: string }> } }
    expect(selectVm.$props.items).toEqual([
      { label: 'Pagada', value: 'PAID' },
    ])
  })

  it('follows trigger label rules 0/1/2-3/4+', async () => {
    const wrapper = mountComponent({ modelValue: [] })
    expect(wrapper.get('[data-testid="enum-trigger-label"]').text()).toContain('Seleccioná estados')

    await wrapper.setProps({ modelValue: ['PAID'] })
    expect(wrapper.get('[data-testid="enum-trigger-label"]').text()).toContain('Pagada')

    await wrapper.setProps({
      modelValue: ['PAID', 'PARTIAL'],
      options: [
        { label: 'Pagada', value: 'PAID' },
        { label: 'Parcial', value: 'PARTIAL' },
        { label: 'Pendiente', value: 'PENDING' },
        { label: 'Cancelada', value: 'CANCELLED' },
      ],
    })
    expect(wrapper.get('[data-testid="enum-trigger-label"]').text()).toContain('Pagada, Parcial')

    await wrapper.setProps({ modelValue: ['PAID', 'PARTIAL', 'PENDING'] })
    expect(wrapper.get('[data-testid="enum-trigger-label"]').text()).toContain('Pagada, Parcial, Pendiente')

    await wrapper.setProps({ modelValue: ['PAID', 'PARTIAL', 'PENDING', 'CANCELLED'] })
    expect(wrapper.get('[data-testid="enum-trigger-label"]').text()).toContain('4 seleccionados')
  })

  it('uses w-full on control root', () => {
    const wrapper = mountComponent()
    expect(wrapper.get('[data-testid="enum-select"]').classes()).toContain('w-full')
  })
})
