// DurationField — human units ↔ business minutes. The model is minutes, `null` is «Sin plazo».
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DurationField from '../DurationField.vue'

function mountField(props: Record<string, unknown> = {}) {
  return mount(DurationField, { props: { modelValue: 240, label: 'Atender queja', id: 'f', ...props } })
}
const input = (w: ReturnType<typeof mountField>) => w.get('[data-testid="duration-input"]')
// The unit is the system select: read its model, drive it through its own event.
const unitSelect = (w: ReturnType<typeof mountField>) => w.getComponent({ name: 'Select' })
const unitValue = (w: ReturnType<typeof mountField>) => unitSelect(w).props('modelValue')
const setUnit = async (w: ReturnType<typeof mountField>, value: string) => {
  unitSelect(w).vm.$emit('update:modelValue', value)
  await w.vm.$nextTick()
}
const last = (w: ReturnType<typeof mountField>) => {
  const calls = w.emitted('update:modelValue')!
  return calls[calls.length - 1]![0]
}

describe('DurationField', () => {
  it('uses the system select for the unit, labelled, with no native select', () => {
    const w = mountField()
    expect(w.find('select:not([aria-hidden="true"])').exists()).toBe(false)
    const trigger = w.get('[data-testid="duration-unit"]')
    expect(trigger.attributes('role')).toBe('combobox')
    expect(trigger.attributes('aria-label')).toBe('Unidad de Atender queja')
    expect(trigger.text()).toBe('h')
  })

  it('shows whole hours in hours and the rest in minutes', () => {
    const hours = mountField({ modelValue: 240 })
    expect((input(hours).element as HTMLInputElement).value).toBe('4')
    expect(unitValue(hours)).toBe('h')

    const minutes = mountField({ modelValue: 45 })
    expect((input(minutes).element as HTMLInputElement).value).toBe('45')
    expect(unitValue(minutes)).toBe('min')
  })

  it('typing minutes or hours emits minutes', async () => {
    const w = mountField({ modelValue: 45 })
    await input(w).setValue('50')
    expect(last(w)).toBe(50)

    await setUnit(w, 'h')
    await input(w).setValue('1,5')
    expect(last(w)).toBe(90)
  })

  it('switching the unit keeps the same amount of time', async () => {
    const w = mountField({ modelValue: 90 })
    await setUnit(w, 'h')
    expect((input(w).element as HTMLInputElement).value).toBe('1.5')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('text that is not a number emits NaN, never a silent zero', async () => {
    const w = mountField({ modelValue: 45 })
    await input(w).setValue('abc')
    expect(last(w)).toBeNaN()
  })

  it('«Sin plazo» emits null, disables the number and can come back to a value', async () => {
    const w = mountField({ modelValue: 45 })
    await setUnit(w, 'none')
    expect(last(w)).toBeNull()
    expect((input(w).element as HTMLInputElement).disabled).toBe(true)

    await setUnit(w, 'min')
    expect((input(w).element as HTMLInputElement).disabled).toBe(false)
    await input(w).setValue('20')
    expect(last(w)).toBe(20)
  })

  it('starts on «Sin plazo» for a null model', () => {
    const w = mountField({ modelValue: null })
    expect(unitValue(w)).toBe('none')
    expect((input(w).element as HTMLInputElement).disabled).toBe(true)
  })

  it('a field that cannot be null has no «Sin plazo» and a blank number is invalid', async () => {
    const w = mountField({ modelValue: 60, nullable: false })
    expect((unitSelect(w).props('items') as Array<{ value: string }>).map((o) => o.value)).toEqual(['min', 'h'])
    await input(w).setValue('')
    expect(last(w)).toBeNaN()
  })

  it('resyncs when the model changes from outside (discard, reload) and marks invalid', async () => {
    const w = mountField({ modelValue: 240 })
    await w.setProps({ modelValue: 30 })
    expect((input(w).element as HTMLInputElement).value).toBe('30')
    expect(unitValue(w)).toBe('min')

    await w.setProps({ invalid: true })
    expect(input(w).attributes('aria-invalid')).toBe('true')
  })

  it('does not rewrite what the user is typing when the model echoes it back', async () => {
    const w = mountField({ modelValue: 45 })
    await input(w).setValue('1.')
    await w.setProps({ modelValue: Number.NaN })
    expect((input(w).element as HTMLInputElement).value).toBe('1.')
  })
})
