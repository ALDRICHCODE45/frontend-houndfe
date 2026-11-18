import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import HfRowMark from '../HfRowMark.vue'

function mountMark(props: Record<string, unknown> = {}) {
  return mount(HfRowMark, {
    attachTo: document.body,
    props: { label: 'Seleccionar a Laura Méndez', checked: false, ...props },
  })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('HfRowMark', () => {
  it('is a labelled native button with aria-pressed for each state', async () => {
    const wrapper = mountMark()
    const button = wrapper.get('button')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-label')).toBe('Seleccionar a Laura Méndez')
    expect(button.attributes('aria-pressed')).toBe('false')
    expect(button.get('.hf-sel-mark').attributes('data-state')).toBe('unchecked')
    await wrapper.setProps({ checked: true })
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.get('.hf-sel-mark').attributes('data-state')).toBe('checked')
    await wrapper.setProps({ checked: 'mixed' })
    expect(button.attributes('aria-pressed')).toBe('mixed')
    expect(button.get('.hf-sel-mark').attributes('data-state')).toBe('mixed')
  })

  it('emits the next value and the event: unchecked → true, mixed → true, checked → false', async () => {
    const wrapper = mountMark()
    await wrapper.get('button').trigger('click', { shiftKey: true })
    await wrapper.setProps({ checked: 'mixed' })
    await wrapper.get('button').trigger('click')
    await wrapper.setProps({ checked: true })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:checked')).toEqual([[true], [true], [false]])
    const toggles = wrapper.emitted('toggle') as [boolean, MouseEvent][]
    expect(toggles).toHaveLength(3)
    expect(toggles[0]![0]).toBe(true)
    expect(toggles[0]![1].shiftKey).toBe(true)
  })

  it('does not bubble the click to a clickable row', async () => {
    const parentClicks: Event[] = []
    const wrapper = mount(
      {
        components: { HfRowMark },
        template: '<div @click="onRow"><HfRowMark label="Seleccionar" :checked="false" /></div>',
        methods: { onRow: (e: Event) => parentClicks.push(e) },
      },
      { attachTo: document.body },
    )
    await wrapper.get('button').trigger('click')
    expect(parentClicks).toHaveLength(0)
  })

  it('does nothing when disabled', async () => {
    const wrapper = mountMark({ disabled: true })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:checked')).toBeUndefined()
  })
})
