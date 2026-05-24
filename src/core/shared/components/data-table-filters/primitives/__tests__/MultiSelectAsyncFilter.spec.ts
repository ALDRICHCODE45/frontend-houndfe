import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MultiSelectAsyncFilter from '../MultiSelectAsyncFilter.vue'

const SelectStub = {
  name: 'SelectStub',
  props: ['modelValue', 'items', 'searchInput'],
  emits: ['update:model-value'],
  template: '<div data-testid="u-select-menu" :data-searchable="String(searchInput)"><slot /><slot name="content-bottom" /></div>',
}

const CheckboxStub = {
  name: 'CheckboxStub',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<button data-testid="u-checkbox" @click="$emit(\'update:modelValue\', !modelValue)"></button>',
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
        UFormField: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('MultiSelectAsyncFilter', () => {
  it('renders a single searchable select (no duplicate search input)', () => {
    const wrapper = mountComponent()
    const selects = wrapper.findAllComponents(SelectStub)
    expect(selects.length).toBe(1)
    expect(wrapper.find('[data-testid="async-search"]').exists()).toBe(false)
    expect(selects[0]?.props('searchInput')).toBe(true)
  })

  it('emits selected UUIDs', async () => {
    const wrapper = mountComponent()
    const select = wrapper.findComponent(SelectStub)

    select.vm.$emit('update:model-value', ['uuid-1', 'uuid-2'])
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([['uuid-1', 'uuid-2']])
  })

  it('toggles includeNull on/off via bound model', async () => {
    const wrapper = mountComponent()
    const checkbox = wrapper.findComponent(CheckboxStub)

    await checkbox.trigger('click')
    await wrapper.setProps({ includeNullValue: true })
    await checkbox.trigger('click')
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
          UFormField: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Demasiados valores seleccionados')
  })

  it('renders loading hint when options are loading', () => {
    const wrapper = mount(MultiSelectAsyncFilter, {
      props: {
        modelValue: [],
        label: 'Cliente',
        placeholder: 'Buscá cliente',
        options: [],
        loading: true,
        loadingLabel: 'Cargando clientes...',
      },
      global: {
        stubs: {
          USelectMenu: { ...SelectStub },
          SelectMenu: { ...SelectStub },
          UFormField: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.get('[data-testid="async-loading-hint"]').text()).toContain('Cargando clientes...')
  })

  it('shows selected counter', () => {
    const wrapper = mount(MultiSelectAsyncFilter, {
      props: { modelValue: ['uuid-1', 'uuid-2'], label: 'Cliente', placeholder: 'Buscar', options: [{ label: 'A', value: 'uuid-1' }, { label: 'B', value: 'uuid-2' }] },
      global: { stubs: { USelectMenu: { ...SelectStub }, UFormField: { template: '<div><slot /></div>' } } },
    })

    expect(wrapper.get('[data-testid="async-trigger-label"]').text()).toContain('2 seleccionados')
  })
})
