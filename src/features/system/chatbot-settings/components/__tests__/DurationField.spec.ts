// DurationField — human units ↔ business minutes. The model is minutes, `null` is «Sin plazo».
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DurationField from '../DurationField.vue'

function mountField(props: Record<string, unknown> = {}) {
  return mount(DurationField, { props: { modelValue: 240, label: 'Atender queja', id: 'f', ...props } })
}
const input = (w: ReturnType<typeof mountField>) => w.get('[data-testid="duration-input"]')
const unit = (w: ReturnType<typeof mountField>) => w.get('[data-testid="duration-unit"]')
const last = (w: ReturnType<typeof mountField>) => {
  const calls = w.emitted('update:modelValue')!
  return calls[calls.length - 1]![0]
}

describe('DurationField', () => {
  it('shows whole hours in hours and the rest in minutes', () => {
    const hours = mountField({ modelValue: 240 })
    expect((input(hours).element as HTMLInputElement).value).toBe('4')
    expect((unit(hours).element as HTMLSelectElement).value).toBe('h')

    const minutes = mountField({ modelValue: 45 })
    expect((input(minutes).element as HTMLInputElement).value).toBe('45')
    expect((unit(minutes).element as HTMLSelectElement).value).toBe('min')
  })

  it('typing minutes or hours emits minutes', async () => {
    const w = mountField({ modelValue: 45 })
    await input(w).setValue('50')
    expect(last(w)).toBe(50)

    await unit(w).setValue('h')
    await input(w).setValue('1,5')
    expect(last(w)).toBe(90)
  })

  it('switching the unit keeps the same amount of time', async () => {
    const w = mountField({ modelValue: 90 })
    await unit(w).setValue('h')
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
    await unit(w).setValue('none')
    expect(last(w)).toBeNull()
    expect((input(w).element as HTMLInputElement).disabled).toBe(true)

    await unit(w).setValue('min')
    expect((input(w).element as HTMLInputElement).disabled).toBe(false)
    await input(w).setValue('20')
    expect(last(w)).toBe(20)
  })

  it('starts on «Sin plazo» for a null model', () => {
    const w = mountField({ modelValue: null })
    expect((unit(w).element as HTMLSelectElement).value).toBe('none')
    expect((input(w).element as HTMLInputElement).disabled).toBe(true)
  })

  it('a field that cannot be null has no «Sin plazo» and a blank number is invalid', async () => {
    const w = mountField({ modelValue: 60, nullable: false })
    expect(unit(w).findAll('option').map((o) => o.attributes('value'))).toEqual(['min', 'h'])
    await input(w).setValue('')
    expect(last(w)).toBeNaN()
  })

  it('resyncs when the model changes from outside (discard, reload) and marks invalid', async () => {
    const w = mountField({ modelValue: 240 })
    await w.setProps({ modelValue: 30 })
    expect((input(w).element as HTMLInputElement).value).toBe('30')
    expect((unit(w).element as HTMLSelectElement).value).toBe('min')

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
