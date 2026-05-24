import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MultiTextInputFilter from '../MultiTextInputFilter.vue'

const UInputStub = {
  props: ['modelValue'],
  emits: ['update:modelValue', 'blur', 'keydown'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" @keydown="$emit(\'keydown\', $event)" />',
}

function mountComponent() {
  return mount(MultiTextInputFilter, {
    props: {
      modelValue: [],
      label: 'Folio',
      placeholder: 'Ingresá folios',
      stripPrefix: '#',
      max: 3,
    },
    global: {
      stubs: {
        UInput: UInputStub,
        UFormField: {
          template: '<div><slot /></div>',
        },
      },
    },
  })
}

describe('MultiTextInputFilter', () => {
  it('parses comma-separated values on blur, strips # and dedupes', async () => {
    const wrapper = mountComponent()
    await wrapper.get('[data-testid="multi-text-input"]').setValue('#15, #16, 20, #15')
    await wrapper.get('[data-testid="multi-text-input"]').trigger('blur')

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([['15', '16', '20']])
  })

  it('commits parsed values on Enter', async () => {
    const wrapper = mountComponent()
    await wrapper.get('[data-testid="multi-text-input"]').setValue('#7, #8')
    await wrapper.get('[data-testid="multi-text-input"]').trigger('keydown', { key: 'Enter' })

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([['7', '8']])
  })

  it('applies value cap when parsing', async () => {
    const wrapper = mountComponent()
    await wrapper.get('[data-testid="multi-text-input"]').setValue('1,2,3,4,5')
    await wrapper.get('[data-testid="multi-text-input"]').trigger('blur')

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([['1', '2', '3']])
  })
})
