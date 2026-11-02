import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CategorySelect from '../CategorySelect.vue'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
function setup(disabled = false) {
  const wrapper = mount(CategorySelect, { attachTo: document.body, props: {
    disabled, items: [
      { label: 'Alimentos', value: 'food' },
      { label: 'Servicios con una etiqueta muy larga', value: 'service' },
      { label: '', value: 'separator', type: 'separator' },
      { label: 'Crear categoría', value: 'create', type: 'action' },
    ],
  }, global: { stubs: { UIcon: true } } })
  wrappers.push(wrapper)
  return wrapper
}

describe('CategorySelect HF contract', () => {
  it('filters, highlights the filtered row, selects by keyboard and restores focus', async () => {
    const wrapper = setup()
    const trigger = wrapper.get('button')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    const input = wrapper.get('input')
    expect(document.activeElement).toBe(input.element)
    await input.setValue('Servicios')
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.get('[data-highlighted="true"]').text()).toContain('Servicios')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')).toEqual([['service']])
    expect(document.activeElement).toBe(trigger.element)
    expect(trigger.attributes('aria-expanded')).toBe('false')
  })

  it('keeps create separate from selection and closes on Escape with focus restored', async () => {
    const wrapper = setup()
    const trigger = wrapper.get('button')
    await trigger.trigger('click')
    await wrapper.get('input').setValue('No match')
    await wrapper.get('input').trigger('keydown', { key: 'ArrowDown' })
    await wrapper.get('input').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('action')).toEqual([['create']])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await trigger.trigger('click')
    await wrapper.get('input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('input').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
  })

  it('owns an HF boundary and prevents a disabled trigger from opening', async () => {
    const wrapper = setup(true)
    expect(wrapper.classes()).toContain('hf-theme')
    expect(wrapper.html()).not.toContain('coco-gold')
    await wrapper.get('button').trigger('click')
    expect(wrapper.find('input').exists()).toBe(false)
  })
})
