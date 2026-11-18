import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import HfToggleChips from '../HfToggleChips.vue'

const items = [
  { value: 'mon', label: 'Lun' },
  { value: 'tue', label: 'Mar' },
  { value: 'wed', label: 'Mié', disabled: true },
  { value: 'thu', label: 'Jue' },
]

function mountChips(props: Record<string, unknown> = {}) {
  return mount(HfToggleChips, {
    attachTo: document.body,
    props: { items, label: 'Días', modelValue: ['tue'], ...props },
  })
}

const chips = (wrapper: ReturnType<typeof mountChips>) => wrapper.findAll('.hf-toggle-chip')
const last = (wrapper: ReturnType<typeof mountChips>) => {
  const calls = wrapper.emitted('update:modelValue') ?? []
  return calls[calls.length - 1]
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('HfToggleChips', () => {
  it('is a named group of native buttons with aria-pressed and a check icon when pressed', () => {
    const wrapper = mountChips()
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Días')
    expect(chips(wrapper).map((c) => c.element.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON', 'BUTTON'])
    expect(chips(wrapper).map((c) => c.attributes('aria-pressed'))).toEqual(['false', 'true', 'false', 'false'])
    expect(chips(wrapper)[1]!.find('.hf-toggle-chip__check').exists()).toBe(true)
    expect(chips(wrapper)[0]!.find('.hf-toggle-chip__check').exists()).toBe(false)
  })

  it('toggles on click, keeping item order, and ignores a disabled chip', async () => {
    const wrapper = mountChips()
    await chips(wrapper)[0]!.trigger('click')
    expect(last(wrapper)).toEqual([['mon', 'tue']])
    await chips(wrapper)[1]!.trigger('click')
    expect(last(wrapper)).toEqual([[]])
    const before = wrapper.emitted('update:modelValue')!.length
    await chips(wrapper)[2]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')!.length).toBe(before)
  })

  it('offers «Limpiar (n)» only when clearable and something is on', async () => {
    const wrapper = mountChips({ clearable: true, modelValue: ['mon', 'thu'] })
    const clear = wrapper.get('.hf-toggle-chips__clear')
    expect(clear.text()).toBe('Limpiar (2)')
    await clear.trigger('click')
    expect(last(wrapper)).toEqual([[]])
    expect(wrapper.emitted('clear')).toHaveLength(1)
    await wrapper.setProps({ modelValue: [] })
    expect(wrapper.find('.hf-toggle-chips__clear').exists()).toBe(false)
    await wrapper.setProps({ clearable: false, modelValue: ['mon'] })
    expect(wrapper.find('.hf-toggle-chips__clear').exists()).toBe(false)
  })

  it('does nothing when the group is disabled', async () => {
    const wrapper = mountChips({ disabled: true })
    await chips(wrapper)[0]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
