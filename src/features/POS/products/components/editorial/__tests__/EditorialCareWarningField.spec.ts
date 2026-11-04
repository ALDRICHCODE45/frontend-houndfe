import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import Field from '../EditorialCareWarningField.vue'
import { EditorialSelectStub, stubEditorialSelect } from './editorialSelectStub'
import type { PreparedEditorialCareInput } from '../../../utils/editorial-contract-care-edits'

type Warning = PreparedEditorialCareInput['warnings'][number]
const sample = (): Warning => ({ key: ' warning ', text: 'Texto', disclosure: null, handlingBasis: 'Base',
  requirementKeys: ['missing', 'same', 'same', ''], evidence: [{ sourceRef: 'source', verifiedOn: '2026-01-01' }] })
const cleanup: (() => void)[] = []
beforeAll(stubEditorialSelect)
afterEach(() => cleanup.splice(0).forEach(stop => stop()))
function render(disabled = false, issue?: string) {
  const initial = sample(), original = structuredClone(initial)
  initial.evidence.forEach(Object.freeze); Object.freeze(initial.evidence); Object.freeze(initial.requirementKeys); Object.freeze(initial)
  const raw = shallowRef(initial), generation = shallowRef(0)
  const wrapper = mount(defineComponent({ setup: () => () => h(Field, { id: 'warning', key: generation.value,
    modelValue: raw.value, disabled, issue, 'onUpdate:modelValue': (value: Warning) => { raw.value = value } }) }))
  cleanup.push(() => { expect(initial).toEqual(original); wrapper.unmount() })
  return { wrapper, raw, generation }
}
describe('controlled care warning', () => {
  it('picks the disclosure in a Nuxt UI list named like its label, with the "Elige…" placeholder', () => {
    const select = render().wrapper.getComponent(EditorialSelectStub)
    expect(select.props('label')).toBe('Divulgación')
    expect(select.props('placeholder')).toBe('Elige…')
    expect(select.props('items')).toEqual([{ label: 'Solo privada', value: 'private_only' }, { label: 'Pública requerida', value: 'public_required' }, { label: 'Sin resolver', value: 'unresolved' }])
    expect(select.props('modelValue')).toBeUndefined()
  })
  it('renders associated labels and literal diagnostics without changing raw history', () => {
    const { wrapper, raw } = render(false, '<b>Revisar referencias</b>')
    expect(wrapper.get('legend').text()).toBe('Advertencia de cuidado')
    expect(wrapper.get('#warning-issue').text()).toBe('<b>Revisar referencias</b>')
    expect(wrapper.find('b').exists()).toBe(false)
    for (const label of wrapper.findAll('label')) expect(wrapper.find('#' + label.attributes('for')).exists()).toBe(true)
    for (const control of wrapper.findAll('input,textarea,select')) {
      expect(control.attributes('aria-describedby')).toBe('warning-issue')
      expect(control.attributes('aria-invalid')).toBe('true')
    }
    expect(raw.value).toEqual(sample())
  })
  it.each(['private_only', 'public_required', 'unresolved', null] as const)('retains disclosure %s on remount', async value => {
    const { wrapper, raw, generation } = render()
    await wrapper.get('#warning-disclosure').setValue(value ?? '')
    expect(raw.value).toEqual({ ...sample(), disclosure: value })
    generation.value++; await nextTick()
    expect(wrapper.get<HTMLSelectElement>('#warning-disclosure').element.value).toBe(value ?? '')
  })
  it('copies nested data and retains exact raw text on every edit', async () => {
    const { wrapper, raw } = render()
    for (const key of ['key', 'text', 'handlingBasis'] as const) {
      const before = raw.value, value = '  <img src=x>\nraw  '
      await wrapper.get('#warning-' + key).setValue(key === 'key' ? ' raw key ' : value)
      expect(raw.value).toEqual({ ...before, [key]: key === 'key' ? ' raw key ' : value })
      expect(raw.value).not.toBe(before); expect(raw.value.requirementKeys).not.toBe(before.requirementKeys)
      expect(raw.value.evidence).not.toBe(before.evidence); expect(raw.value.evidence[0]).not.toBe(before.evidence[0])
    }
    expect(wrapper.find('img').exists()).toBe(false)
  })
  it('edits reference entries by position without pruning duplicates, blanks or dangling keys', async () => {
    const { wrapper, raw, generation } = render()
    expect(wrapper.findAll('[data-reference]').map(el => (el.element as HTMLInputElement).value)).toEqual(sample().requirementKeys)
    await wrapper.get('#warning-reference-2').setValue(' explicit ')
    expect(raw.value).toEqual({ ...sample(), requirementKeys: ['missing', 'same', ' explicit ', ''] })
    await wrapper.get('[data-action="add-reference"]').trigger('click')
    await wrapper.get('[data-action="remove-reference-1"]').trigger('click')
    expect(raw.value.requirementKeys).toEqual(['missing', ' explicit ', '', ''])
    generation.value++; await nextTick()
    expect(wrapper.findAll('[data-reference]').map(el => (el.element as HTMLInputElement).value)).toEqual(raw.value.requirementKeys)
    for (let n = 0; n < 4; n++) await wrapper.get('[data-action="remove-reference-0"]').trigger('click')
    expect(raw.value).toEqual({ ...sample(), requirementKeys: [] })
  })
  it('retains partial ordered evidence through removal and remount', async () => {
    const { wrapper, raw, generation } = render()
    await wrapper.get('[data-action="add-evidence"]').trigger('click')
    await wrapper.get('#warning-evidence-1-source').setValue(' partial ')
    await wrapper.get('#warning-evidence-1-date').setValue('2026-')
    expect(raw.value).toEqual({ ...sample(), evidence: [...sample().evidence, { sourceRef: ' partial ', verifiedOn: '2026-' }] })
    await wrapper.get('[data-action="remove-evidence-0"]').trigger('click')
    generation.value++; await nextTick()
    expect(wrapper.get<HTMLInputElement>('#warning-evidence-0-date').element.value).toBe('2026-')
    expect(wrapper.get('#warning-evidence-0-date').attributes('type')).toBe('text')
    await wrapper.get('[data-action="remove-evidence-0"]').trigger('click')
    expect(raw.value).toEqual({ ...sample(), evidence: [] })
  })
  it('only emits a payload-free removal intent', async () => {
    const { wrapper, raw } = render(), field = wrapper.getComponent(Field)
    await wrapper.get('[data-action="remove-warning"]').trigger('click')
    expect(field.emitted('remove')).toEqual([[]])
    expect(field.emitted('update:modelValue')).toBeUndefined()
    expect(raw.value).toEqual(sample())
  })
  it('suppresses all synthetic events when disabled', async () => {
    const { wrapper, raw } = render(true), field = wrapper.getComponent(Field)
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    for (const control of wrapper.findAll('input,textarea,select,button')) {
      expect((control.element as HTMLInputElement).disabled).toBe(true)
      for (const event of ['input', 'change', 'click']) control.element.dispatchEvent(new Event(event, { bubbles: true }))
    }
    await nextTick()
    expect(field.emitted('update:modelValue')).toBeUndefined(); expect(field.emitted('remove')).toBeUndefined()
    expect(raw.value).toEqual(sample())
  })
})
