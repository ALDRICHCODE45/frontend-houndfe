import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import HfUnitField from '../HfUnitField.vue'

// jsdom does not implement `scrollIntoView`, which Reka calls on the highlighted item.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

const units = [
  { label: 'kg', value: 'kg' },
  { label: 'g', value: 'g' },
  { label: 'lb', value: 'lb' },
]

const tick = () => new Promise(resolve => setTimeout(resolve, 50))
const options = () => Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))

// The latest update:modelValue payload.
const lastEmit = (wrapper: { emitted: (event: string) => unknown[][] | undefined }) => {
  const calls = wrapper.emitted('update:modelValue') ?? []
  return calls[calls.length - 1]
}

function mountField(props: Record<string, unknown> = {}) {
  return mount(HfUnitField, {
    attachTo: document.body,
    props: { units, label: 'Peso neto', modelValue: { value: 3, unit: 'kg' }, ...props },
  })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('HfUnitField single value', () => {
  it('joins the number and the unit in one control with an inner divider', () => {
    const wrapper = mountField({ id: 'peso-neto' })
    const root = wrapper.get('.hf-unit-field')
    const input = root.get('input')
    expect(input.attributes('id')).toBe('peso-neto')
    expect(input.attributes('inputmode')).toBe('decimal')
    expect((input.element as HTMLInputElement).value).toBe('3')
    expect(root.find('.hf-unit-field__divider').exists()).toBe(true)
    expect(root.get('[data-slot="base"]').attributes('aria-label')).toBe('Peso neto, unidad')
    expect(root.get('.hf-combobox__text').text()).toBe('kg')
  })

  it('emits the parsed number with the unit, accepting a decimal comma', async () => {
    const wrapper = mountField()
    await wrapper.get('input').setValue('2,5')
    expect(lastEmit(wrapper)).toEqual([{ value: 2.5, unit: 'kg' }])
  })

  it('emits no value when the number is cleared', async () => {
    const wrapper = mountField()
    await wrapper.get('input').setValue('')
    expect(lastEmit(wrapper)).toEqual([{ value: undefined, unit: 'kg' }])
  })

  it('keeps the typed text while it is not a number yet', async () => {
    const wrapper = mountField()
    const input = wrapper.get('input')
    await input.setValue('3.')
    expect(lastEmit(wrapper)).toEqual([{ value: 3, unit: 'kg' }])
    await wrapper.setProps({ modelValue: { value: 3, unit: 'kg' } })
    expect((input.element as HTMLInputElement).value).toBe('3.')
  })

  it('emits the unit picked from the unit list', async () => {
    const wrapper = mountField()
    await wrapper.get('[data-slot="base"]').trigger('click')
    await tick()
    options().find(option => option.textContent?.trim() === 'g')!.click()
    await tick()
    expect(lastEmit(wrapper)).toEqual([{ value: 3, unit: 'g' }])
  })

  it('marks the whole control invalid', () => {
    const wrapper = mountField({ invalid: true, describedby: 'peso-error' })
    expect(wrapper.get('.hf-unit-field').classes()).toContain('hf-unit-field--invalid')
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('input').attributes('aria-describedby')).toBe('peso-error')
  })
})

describe('HfUnitField range', () => {
  it('shows two named inputs joined by a dash', () => {
    const wrapper = mountField({ range: true, label: 'Peso de la mascota', modelValue: { min: 10, max: 40, unit: 'kg' } })
    const inputs = wrapper.findAll('input')
    expect(inputs.map(input => input.attributes('aria-label'))).toEqual(['Peso de la mascota, mínimo', 'Peso de la mascota, máximo'])
    expect(inputs.map(input => (input.element as HTMLInputElement).value)).toEqual(['10', '40'])
    expect(wrapper.get('.hf-unit-field__dash').text()).toBe('–')
  })

  it('emits min and max with the unit', async () => {
    const wrapper = mountField({ range: true, label: 'Peso de la mascota', modelValue: { min: 10, max: 40, unit: 'kg' } })
    const [min, max] = wrapper.findAll('input')
    await min!.setValue('12')
    expect(lastEmit(wrapper)).toEqual([{ min: 12, max: 40, unit: 'kg' }])
    await max!.setValue('35')
    expect(lastEmit(wrapper)).toEqual([{ min: 10, max: 35, unit: 'kg' }])
  })
})

describe('HfUnitField special answers', () => {
  it('shows the special label in place of the number and emits update:special from the unit list', async () => {
    const specials = [{ value: 'na', label: 'No aplica', icon: 'i-lucide-ban' }]
    const wrapper = mountField({ specialAnswers: specials, special: 'na' })
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.get('.hf-unit-field__special').text()).toBe('No aplica')
    await wrapper.get('[data-slot="base"]').trigger('click')
    await tick()
    options().find(option => option.textContent?.trim() === 'kg')!.click()
    await tick()
    expect(wrapper.emitted('update:special')).toEqual([[null]])
  })
})
