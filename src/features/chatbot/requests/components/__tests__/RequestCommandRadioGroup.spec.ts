import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestCommandRadioGroup from '../RequestCommandRadioGroup.vue'

const ITEMS = [
  { value: 'A', label: 'Uno', hint: 'Primera' },
  { value: 'B', label: 'Dos' },
  { value: 'C', label: 'Tres' },
]

const mountGroup = (modelValue = 'B', extra: Record<string, unknown> = {}) =>
  mount(RequestCommandRadioGroup, { props: { modelValue, items: ITEMS, label: 'Opciones', ...extra } })

describe('RequestCommandRadioGroup', () => {
  it('is a radiogroup of radio rows with the chosen one checked and no checkbox', () => {
    const wrapper = mountGroup()
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('Opciones')
    expect(wrapper.findAll('[role="radio"]').map((row) => row.attributes('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ])
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Primera')
  })

  it('makes the chosen row the only tab stop (the first when nothing is chosen)', () => {
    expect(mountGroup('B').findAll('[role="radio"]').map((row) => row.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
    expect(mountGroup('').findAll('[role="radio"]').map((row) => row.attributes('tabindex'))).toEqual(['0', '-1', '-1'])
  })

  it('emits the value of the clicked row', async () => {
    const wrapper = mountGroup()
    await wrapper.get('[data-testid="radio-C"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['C']])
  })

  it('moves and selects with the arrows, wrapping, and Home / End', async () => {
    const wrapper = mountGroup('C')
    await wrapper.get('[data-testid="radio-C"]').trigger('keydown', { key: 'ArrowDown' })
    await wrapper.get('[data-testid="radio-C"]').trigger('keydown', { key: 'ArrowUp' })
    await wrapper.get('[data-testid="radio-C"]').trigger('keydown', { key: 'Home' })
    await wrapper.setProps({ modelValue: 'A' })
    await wrapper.get('[data-testid="radio-A"]').trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:modelValue')).toEqual([['A'], ['B'], ['A'], ['C']])
  })

  it('does nothing when disabled and shows the error with its link', async () => {
    const wrapper = mountGroup('B', { disabled: true, error: 'Elige una opción.' })
    await wrapper.get('[data-testid="radio-C"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    const group = wrapper.get('[role="radiogroup"]')
    expect(group.attributes('aria-invalid')).toBe('true')
    expect(wrapper.get(`#${group.attributes('aria-describedby')}`).text()).toBe('Elige una opción.')
  })
})
