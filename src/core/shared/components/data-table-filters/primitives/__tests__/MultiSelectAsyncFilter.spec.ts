import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MultiSelectAsyncFilter from '../MultiSelectAsyncFilter.vue'

const SelectStub = {
  name: 'SelectStub',
  props: ['modelValue', 'items'],
  emits: ['update:modelValue'],
  template: '<div data-testid="u-select-menu" />',
}

const CheckboxStub = {
  name: 'CheckboxStub',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<div data-testid="u-checkbox" />',
}

const UInputStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

function mountComponent() {
  return mount(MultiSelectAsyncFilter, {
    props: {
      modelValue: [],
      label: 'Cliente',
      placeholder: 'Buscá cliente',
      includeNullOption: 'Incluir público general',
      includeNullValue: false,
      options: [
        { label: 'María Pérez', value: 'uuid-1' },
        { label: 'Juan Gomez', value: 'uuid-2' },
        { label: 'Marco Díaz', value: 'uuid-3' },
      ],
    },
    global: {
      stubs: {
        USelectMenu: { ...SelectStub },
        SelectMenu: { ...SelectStub },
        UCheckbox: { ...CheckboxStub },
        Checkbox: { ...CheckboxStub },
        UInput: UInputStub,
      },
    },
  })
}

describe('MultiSelectAsyncFilter', () => {
  it('filters options by local search', async () => {
    const wrapper = mountComponent()

    await wrapper.get('[data-testid="async-search"]').setValue('Mar')

    const select = wrapper.findComponent(SelectStub)
    expect(select.props('items')).toEqual([
      { label: 'María Pérez', value: 'uuid-1' },
      { label: 'Marco Díaz', value: 'uuid-3' },
    ])
  })

  it('emits selected UUIDs', async () => {
    const wrapper = mountComponent()
    const select = wrapper.findComponent(SelectStub)

    select.vm.$emit('update:model-value', ['uuid-1', 'uuid-2'])
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([['uuid-1', 'uuid-2']])
  })

  it('toggles includeNull on/off', async () => {
    const wrapper = mountComponent()
    const checkbox = wrapper.findComponent(CheckboxStub)

    checkbox.vm.$emit('update:model-value', true)
    checkbox.vm.$emit('update:model-value', false)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:includeNullValue')).toEqual([[true], [false]])
  })

  it('renders external error', () => {
    const wrapper = mount(MultiSelectAsyncFilter, {
      props: {
        modelValue: [],
        label: 'Cliente',
        placeholder: 'Buscá cliente',
        options: [{ label: 'María Pérez', value: 'uuid-1' }],
        error: 'Demasiados valores seleccionados',
      },
      global: {
        stubs: {
          USelectMenu: { ...SelectStub },
          SelectMenu: { ...SelectStub },
          UInput: UInputStub,
        },
      },
    })

    expect(wrapper.text()).toContain('Demasiados valores seleccionados')
  })
})
