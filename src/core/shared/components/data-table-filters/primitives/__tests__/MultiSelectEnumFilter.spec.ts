import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import MultiSelectEnumFilter from '../MultiSelectEnumFilter.vue'

const SelectStub = {
  name: 'SelectStub',
  props: ['modelValue', 'searchable'],
  emits: ['update:modelValue'],
  template: '<div data-testid="u-select-menu" :data-searchable="String(searchable)" />',
}

const CheckboxStub = {
  name: 'CheckboxStub',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<div data-testid="u-checkbox" />',
}

function mountComponent(overrideProps: Record<string, unknown> = {}) {
  return shallowMount(MultiSelectEnumFilter, {
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

  it('toggles includeNull on/off', async () => {
    const wrapper = mountComponent()
    const checkbox = wrapper.findComponent(CheckboxStub)

    checkbox.vm.$emit('update:model-value', true)
    checkbox.vm.$emit('update:model-value', false)
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

    expect(wrapper.get('[data-testid="u-select-menu"]').attributes('data-searchable')).toBe('true')
  })
})
