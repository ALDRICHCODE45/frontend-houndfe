import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MultiSelectAsyncFilter from '../MultiSelectAsyncFilter.vue'

const SelectStub = {
  name: 'SelectStub',
  props: ['modelValue', 'items', 'searchInput', 'valueKey', 'multiple', 'loading'],
  emits: ['update:model-value'],
  template: '<div data-testid="u-select-menu" :data-searchable="String(searchInput)" :data-value-key="valueKey" :data-multiple="String(multiple)" :data-loading="String(loading)"><slot /></div>',
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
         UFormField: { props: ['error'], template: '<div><slot /><p data-testid="error">{{ error }}</p></div>' },
      },
    },
  })
}

describe('MultiSelectAsyncFilter', () => {
  it('renders with default props', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[data-testid="multi-select-async-filter"]').exists()).toBe(true)
  })

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

  it('appends includeNull as an additional virtual item', () => {
    const wrapper = mountComponent()
    const selectVm = wrapper.findComponent(SelectStub).vm as { $props: { items: Array<{ label: string; value: string }> } }
    expect(selectVm.$props.items).toEqual([
      { label: 'María Pérez', value: 'uuid-1' },
      { label: 'Juan Gomez', value: 'uuid-2' },
      { label: 'Marco Díaz', value: 'uuid-3' },
      { label: 'Incluir público general', value: '__INCLUDE_NULL__' },
    ])
  })

  it('selecting virtual option sets includeNull without polluting modelValue', async () => {
    const wrapper = mountComponent()
    const select = wrapper.findComponent(SelectStub)

    select.vm.$emit('update:model-value', ['uuid-1', '__INCLUDE_NULL__'])
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['uuid-1']])
    expect(wrapper.emitted('update:includeNullValue')?.[0]).toEqual([true])
  })

  it('deselecting virtual option sets includeNull to false', async () => {
    const wrapper = mountComponent()
    const select = wrapper.findComponent(SelectStub)

    await wrapper.setProps({ includeNullValue: true, modelValue: ['uuid-1'] })
    select.vm.$emit('update:model-value', ['uuid-1'])
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:includeNullValue')?.[0]).toEqual([false])
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

  it('shows joined labels for 2-3 selections', () => {
    const wrapper = mount(MultiSelectAsyncFilter, {
      props: { modelValue: ['uuid-1', 'uuid-2'], label: 'Cliente', placeholder: 'Buscar', options: [{ label: 'A', value: 'uuid-1' }, { label: 'B', value: 'uuid-2' }] },
      global: { stubs: { USelectMenu: { ...SelectStub }, UFormField: { template: '<div><slot /></div>' } } },
    })

    expect(wrapper.get('[data-testid="async-trigger-label"]').text()).toContain('A, B')
  })

  it('shows includeNull label when only virtual option is active', async () => {
    const wrapper = mountComponent()
    await wrapper.setProps({ modelValue: [], includeNullValue: true, includeNullOption: 'Incluir público general' })
    expect(wrapper.get('[data-testid="async-trigger-label"]').text()).toContain('Incluir público general')
  })

  it('combines real labels and includeNull label in trigger', async () => {
    const wrapper = mountComponent()
    await wrapper.setProps({
      modelValue: ['uuid-1'],
      includeNullValue: true,
      includeNullOption: 'Sin método',
      options: [{ label: 'Efectivo', value: 'uuid-1' }],
    })
    expect(wrapper.get('[data-testid="async-trigger-label"]').text()).toContain('Efectivo, sin método')
  })

  it('uses canonical value-key/multiple with string model and searchable true', () => {
    const wrapper = mountComponent()
    const select = wrapper.get('[data-testid="async-select"]')
    expect(select.attributes('data-searchable')).toBe('true')
    expect(select.attributes('data-value-key')).toBe('value')
    expect(select.attributes('data-multiple')).toBe('true')
    expect(select.attributes('data-loading')).toBe('false')
  })

  it('uses w-full on control root', () => {
    const wrapper = mountComponent()
    expect(wrapper.get('[data-testid="async-select"]').classes()).toContain('w-full')
  })
})
