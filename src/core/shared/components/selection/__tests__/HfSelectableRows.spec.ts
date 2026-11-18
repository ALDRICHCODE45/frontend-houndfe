import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import HfSelectableRows from '../HfSelectableRows.vue'

const items = [
  { value: 'a', label: 'Lista general' },
  { value: 'b', label: 'Mayoreo' },
  { value: 'c', label: 'Interna', disabled: true },
  { value: 'd', label: 'Distribuidores' },
  { value: 'e', label: 'Empleados' },
]

function mountRows(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(HfSelectableRows, {
    attachTo: document.body,
    props: { items, label: 'Listas públicas', modelValue: ['a'], ...props },
    slots,
  })
}

const options = (wrapper: ReturnType<typeof mountRows>) => wrapper.findAll('[role="option"]')
const last = (wrapper: ReturnType<typeof mountRows>) => {
  const calls = wrapper.emitted('update:modelValue') ?? []
  return calls[calls.length - 1]
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('HfSelectableRows', () => {
  it('is a named multiselect listbox of options with aria-selected', () => {
    const wrapper = mountRows()
    const list = wrapper.get('[role="listbox"]')
    expect(list.attributes('aria-multiselectable')).toBe('true')
    expect(list.attributes('aria-label')).toBe('Listas públicas')
    expect(options(wrapper).map((o) => o.attributes('aria-selected'))).toEqual(['true', 'false', 'false', 'false', 'false'])
    expect(options(wrapper)[2]!.attributes('aria-disabled')).toBe('true')
    expect(options(wrapper)[0]!.get('.hf-sel-mark').attributes('data-state')).toBe('checked')
    expect(options(wrapper)[1]!.get('.hf-sel-mark').attributes('data-state')).toBe('unchecked')
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })

  it('toggles on a click anywhere on the row, keeping item order', async () => {
    const wrapper = mountRows({ modelValue: ['d'] })
    await options(wrapper)[0]!.get('.hf-selectable-rows__label').trigger('click')
    expect(last(wrapper)).toEqual([['a', 'd']])
    await wrapper.setProps({ modelValue: ['a', 'd'] })
    await options(wrapper)[0]!.trigger('click')
    expect(last(wrapper)).toEqual([['d']])
  })

  it('ignores a disabled row', async () => {
    const wrapper = mountRows()
    await options(wrapper)[2]!.trigger('click')
    await options(wrapper)[2]!.trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('Space and Enter toggle the focused row', async () => {
    const wrapper = mountRows()
    await options(wrapper)[1]!.trigger('keydown', { key: ' ' })
    expect(last(wrapper)).toEqual([['a', 'b']])
    await options(wrapper)[0]!.trigger('keydown', { key: 'Enter' })
    expect(last(wrapper)).toEqual([[]])
  })

  it('has one tab stop and moves focus with arrows, Home and End, skipping disabled rows', async () => {
    const wrapper = mountRows()
    expect(options(wrapper).map((o) => o.attributes('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1'])
    await options(wrapper)[0]!.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(options(wrapper)[1]!.element)
    expect(options(wrapper).map((o) => o.attributes('tabindex'))).toEqual(['-1', '0', '-1', '-1', '-1'])
    await options(wrapper)[1]!.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(options(wrapper)[3]!.element)
    await options(wrapper)[3]!.trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(options(wrapper)[1]!.element)
    await options(wrapper)[1]!.trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(options(wrapper)[4]!.element)
    await options(wrapper)[4]!.trigger('keydown', { key: 'Home' })
    expect(document.activeElement).toBe(options(wrapper)[0]!.element)
    // Moving focus never changes the selection.
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('says a live count, overridable', async () => {
    const wrapper = mountRows({ modelValue: ['a', 'b'] })
    const count = wrapper.get('.hf-selectable-rows__count')
    expect(count.attributes('aria-live')).toBe('polite')
    expect(count.text()).toBe('2 de 5 seleccionadas')
    await wrapper.setProps({ countLabel: (n: number, total: number) => `${n} de ${total} públicas` })
    expect(wrapper.get('.hf-selectable-rows__count').text()).toBe('2 de 5 públicas')
    await wrapper.setProps({ countLabel: false })
    expect(wrapper.find('.hf-selectable-rows__count').exists()).toBe(false)
  })

  it('links an error under the list with aria-describedby', () => {
    const wrapper = mountRows({ modelValue: [], error: 'Elige al menos una lista.' })
    const error = wrapper.get('.hf-selectable-rows__error')
    expect(error.text()).toContain('Elige al menos una lista.')
    expect(wrapper.get('[role="listbox"]').attributes('aria-describedby')).toContain(error.attributes('id'))
    expect(wrapper.get('[role="listbox"]').attributes('aria-invalid')).toBe('true')
  })

  it('a group header shows mixed and toggles every enabled row', async () => {
    const wrapper = mountRows({ groupLabel: 'Todas las listas', modelValue: ['a'] })
    const header = () => wrapper.get('.hf-selectable-rows__group')
    expect(header().attributes('aria-pressed')).toBe('mixed')
    expect(header().text()).toContain('Todas las listas')
    await header().trigger('click')
    expect(last(wrapper)).toEqual([['a', 'b', 'd', 'e']])
    await wrapper.setProps({ modelValue: ['a', 'b', 'd', 'e'] })
    expect(header().attributes('aria-pressed')).toBe('true')
    await header().trigger('click')
    expect(last(wrapper)).toEqual([[]])
    await wrapper.setProps({ modelValue: [] })
    expect(header().attributes('aria-pressed')).toBe('false')
  })

  it('keeps a disabled row that is selected when the header toggles all', async () => {
    const wrapper = mountRows({ groupLabel: 'Todas', modelValue: ['c', 'a', 'b', 'd', 'e'] })
    await wrapper.get('.hf-selectable-rows__group').trigger('click')
    expect(last(wrapper)).toEqual([['c']])
  })
})
