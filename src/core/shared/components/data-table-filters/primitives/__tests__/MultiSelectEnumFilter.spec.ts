import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MultiSelectEnumFilter from '../MultiSelectEnumFilter.vue'

const SelectStub = {
  name: 'SelectStub',
  props: ['modelValue', 'searchInput'],
  emits: ['update:model-value'],
  template: '<div data-testid="u-select-menu" :data-searchable="String(searchInput)"><slot /><slot name="content-bottom" /></div>',
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
        UFormField: {
          template: '<div><slot /></div>',
        },
      },
    },
  })
}

describe('MultiSelectEnumFilter', () => {
  it('starts with empty selection', () => {
    const wrapper = mountComponent()

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
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

  it('passes searchable flag to USelectMenu', () => {
    const wrapper = mountComponent({
      options: [{ label: 'Pagada', value: 'PAID' }],
      searchable: true,
    })

    expect(wrapper.get('[data-testid="enum-select"]').attributes('data-searchable')).toBe('true')
  })

  it('shows compact trigger label', () => {
    const wrapper = mountComponent({ modelValue: ['PAID', 'PARTIAL'] })
    expect(wrapper.get('[data-testid="enum-trigger-label"]').text()).toContain('2 seleccionados')
  })
})
