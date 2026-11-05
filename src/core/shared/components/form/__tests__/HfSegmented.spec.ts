import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import HfSegmented from '../HfSegmented.vue'

const items = ['Peso', 'Volumen', 'Piezas', 'Largo'].map(label => ({ label, value: label.toLowerCase() }))

// The latest update:modelValue payload.
const lastEmit = (wrapper: { emitted: (event: string) => unknown[][] | undefined }) => {
  const calls = wrapper.emitted('update:modelValue') ?? []
  return calls[calls.length - 1]
}

function mountSegmented(props: Record<string, unknown> = {}) {
  return mount(HfSegmented, {
    attachTo: document.body,
    props: { items, label: '¿Cómo se mide el contenido?', modelValue: 'peso', ...props },
  })
}

const radios = (wrapper: ReturnType<typeof mountSegmented>) => wrapper.findAll('[role="radio"]')

afterEach(() => {
  document.body.innerHTML = ''
})

describe('HfSegmented', () => {
  it('is a named radiogroup whose checked segment is the only tab stop', () => {
    const wrapper = mountSegmented()
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('¿Cómo se mide el contenido?')
    expect(radios(wrapper).map(radio => radio.attributes('aria-checked'))).toEqual(['true', 'false', 'false', 'false'])
    expect(radios(wrapper).map(radio => radio.attributes('tabindex'))).toEqual(['0', '-1', '-1', '-1'])
    expect(wrapper.get('[role="radiogroup"]').attributes('style')).toContain('--hf-segments: 4')
  })

  it('makes the first segment the tab stop when nothing is chosen', () => {
    const wrapper = mountSegmented({ modelValue: undefined })
    expect(radios(wrapper).map(radio => radio.attributes('tabindex'))).toEqual(['0', '-1', '-1', '-1'])
  })

  it('selects on click', async () => {
    const wrapper = mountSegmented()
    await radios(wrapper)[2]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['piezas']])
  })

  it('moves and selects with the arrow keys, wrapping at the ends', async () => {
    const wrapper = mountSegmented()
    await radios(wrapper)[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(lastEmit(wrapper)).toEqual(['volumen'])
    expect(document.activeElement).toBe(radios(wrapper)[1]!.element)
    await wrapper.setProps({ modelValue: 'volumen' })
    await radios(wrapper)[1]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(lastEmit(wrapper)).toEqual(['peso'])
    await wrapper.setProps({ modelValue: 'peso' })
    await radios(wrapper)[0]!.trigger('keydown', { key: 'ArrowUp' })
    expect(lastEmit(wrapper)).toEqual(['largo'])
  })

  it('jumps to the first and last segment with Home and End', async () => {
    const wrapper = mountSegmented({ modelValue: 'volumen' })
    await radios(wrapper)[1]!.trigger('keydown', { key: 'End' })
    expect(lastEmit(wrapper)).toEqual(['largo'])
    await radios(wrapper)[1]!.trigger('keydown', { key: 'Home' })
    expect(lastEmit(wrapper)).toEqual(['peso'])
  })

  it('skips disabled segments', async () => {
    const wrapper = mountSegmented({ items: [items[0], { ...items[1]!, disabled: true }, items[2]] })
    await radios(wrapper)[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(lastEmit(wrapper)).toEqual(['piezas'])
    expect(radios(wrapper)[1]!.attributes('disabled')).toBeDefined()
  })

  it('does nothing when the whole control is disabled', async () => {
    const wrapper = mountSegmented({ disabled: true })
    await radios(wrapper)[0]!.trigger('keydown', { key: 'ArrowRight' })
    await radios(wrapper)[2]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
