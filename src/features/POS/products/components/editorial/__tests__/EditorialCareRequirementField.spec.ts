import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import Field from '../EditorialCareRequirementField.vue'
import { renameEditorialCareRequirement, removeEditorialCareRequirement, type PreparedEditorialCareInput } from '../../../utils/editorial-contract-care-edits'
import { resolveEditorialCareReviewInput } from '../../../utils/editorial-contract-care-input'

type Requirement = PreparedEditorialCareInput['requirements'][number]
const requirement = (): Requirement => ({ key: ' original ', description: 'Descripción', disposition: null, basis: 'Base', evidence: [] })
const review = (row: Requirement): PreparedEditorialCareInput => ({ state: 'prepared', jurisdiction: 'AR', intendedUse: 'Uso',
  determination: 'identified', evidence: [], basis: 'Revisión', requirements: [row, { ...requirement(), key: 'second', disposition: 'satisfied' }],
  warnings: [{ key: 'warning', requirementKeys: [' original ', 'second', ' original ', 'dangling'], text: 'Advertencia',
    disclosure: 'unresolved', evidence: [], handlingBasis: 'Pendiente' }] })
const cleanup: (() => void)[] = []
afterEach(() => cleanup.splice(0).forEach(stop => stop()))
function render(initial = requirement(), disabled = false, issue?: string) {
  const original = JSON.stringify(initial)
  Object.freeze(initial.evidence)
  initial.evidence.forEach(Object.freeze)
  Object.freeze(initial)
  const input = shallowRef(review(initial)), identity = shallowRef(0)
  const wrapper = mount(defineComponent({ setup: () => () => input.value.requirements[0] ? h(Field, {
    key: identity.value, id: 'care', modelValue: input.value.requirements[0], disabled, issue,
    'onUpdate:modelValue': (next: Requirement) => {
      // Production parent must use S38 rename/remove policy; no warning cascade.
      const renamed = renameEditorialCareRequirement(input.value, 0, next.key)
      renamed.requirements[0] = next
      input.value = renamed
    }, onRemove: () => { input.value = removeEditorialCareRequirement(input.value, 0) },
  }) : null }))
  cleanup.push(() => { expect(JSON.stringify(initial)).toBe(original); wrapper.unmount() })
  return { wrapper, input, identity }
}
const selected = (element: HTMLSelectElement) => Array.from(element.selectedOptions, option => option.value)

describe('controlled single care requirement', () => {
  it('renders visible labels and unselected disposition without inventing satisfaction', () => {
    const { wrapper, input } = render()
    expect(wrapper.get('legend').text()).toBe('Requisito de cuidado')
    expect(wrapper.get('#care-disposition').findAll('option').map(option => option.text())).toEqual([
      'Selecciona una disposición', 'Satisfecho', 'No aplica', 'Sin resolver', 'En conflicto',
    ])
    expect(selected(wrapper.get<HTMLSelectElement>('#care-disposition').element)).toEqual([''])
    for (const label of wrapper.findAll('label')) expect(wrapper.find(`#${label.attributes('for')}`).exists()).toBe(true)
    expect(input.value.requirements[0]?.disposition).toBeNull()
    expect(wrapper.findAll('textarea')).toHaveLength(2)
  })
  it.each(['satisfied', 'not_applicable', 'unresolved', 'conflicting', null] as const)('retains disposition %s through remount', async disposition => {
    const { wrapper, input, identity } = render()
    await wrapper.get('#care-disposition').setValue(disposition ?? '')
    expect(input.value.requirements[0]?.disposition).toBe(disposition)
    identity.value++; await nextTick()
    expect(selected(wrapper.get<HTMLSelectElement>('#care-disposition').element)).toEqual([disposition ?? ''])
  })
  it('emits detached requirements and preserves exact raw multiline text without HTML interpretation', async () => {
    const { wrapper, input } = render()
    const first = input.value.requirements[0]!
    for (const [part, text] of [['key', '  new  '], ['description', '<img src=x>\n descripción '], ['basis', '\n base  ']] as const) {
      const previous = input.value.requirements[0]!
      await wrapper.get(`#care-${part}`).setValue(text)
      const next = input.value.requirements[0]!
      expect(next).not.toBe(previous); expect(next.evidence).not.toBe(previous.evidence)
      expect(next[part]).toBe(text)
    }
    expect(first.key).toBe(' original ')
    expect(wrapper.find('img').exists()).toBe(false)
  })
  it('edits ordered evidence, retains partial strings across remount, and removes only the selected entry', async () => {
    const initial = { ...requirement(), disposition: 'conflicting' as const,
      evidence: [{ sourceRef: 'first', verifiedOn: '2026-01-01' }, { sourceRef: 'second', verifiedOn: '2026-02-02' }] }
    const { wrapper, input, identity } = render(initial)
    await wrapper.get('#care-evidence-1-source').setValue('  raw source  ')
    await wrapper.get('#care-evidence-1-date').setValue('2026-0')
    await wrapper.get('[data-action="add-evidence"]').trigger('click')
    expect(input.value.requirements[0]?.evidence).toEqual([initial.evidence[0], { sourceRef: '  raw source  ', verifiedOn: '2026-0' }, { sourceRef: '', verifiedOn: '' }])
    expect(resolveEditorialCareReviewInput(input.value).status).toBe('incomplete')
    identity.value++; await nextTick()
    expect(wrapper.get<HTMLInputElement>('#care-evidence-1-source').element.value).toBe('  raw source  ')
    expect(wrapper.get<HTMLInputElement>('#care-evidence-1-date').element.value).toBe('2026-0')
    expect(wrapper.get('#care-evidence-1-date').attributes('type')).toBe('text')
    await wrapper.get('[data-action="remove-evidence-0"]').trigger('click')
    expect(input.value.requirements[0]?.evidence).toEqual([{ sourceRef: '  raw source  ', verifiedOn: '2026-0' }, { sourceRef: '', verifiedOn: '' }])
    await wrapper.get('[data-action="remove-evidence-1"]').trigger('click')
    await wrapper.get('[data-action="remove-evidence-0"]').trigger('click')
    expect(input.value.requirements[0]?.evidence).toEqual([])
    // Encoding complete does not grant capture/save/publication permission.
    expect(resolveEditorialCareReviewInput(input.value).status).toBe('complete')
  })
  it('uses parent policy helpers for rename/delete without rewriting any warning references', async () => {
    const { wrapper, input } = render()
    const warnings = structuredClone(input.value.warnings)
    const published = structuredClone(input.value)
    await wrapper.get('#care-key').setValue(' renamed ')
    expect(input.value.requirements[0]?.key).toBe(' renamed ')
    expect(input.value.warnings).toEqual(warnings)
    const field = wrapper.getComponent(Field)
    await wrapper.get('[data-action="remove-requirement"]').trigger('click')
    expect(field.emitted('remove')).toEqual([[]])
    expect(input.value.requirements.map(row => row.key)).toEqual(['second'])
    expect(input.value.warnings).toEqual(warnings)
    expect(published.requirements[0]?.key).toBe(' original ')
    expect(published.warnings).toEqual(warnings)
  })
  it('associates caller diagnostics with every editable control as literal text', () => {
    const { wrapper } = render({ ...requirement(), evidence: [{ sourceRef: '', verifiedOn: '' }] }, false, '<b>Corrige el requisito</b>')
    expect(wrapper.get('#care-issue').text()).toBe('<b>Corrige el requisito</b>')
    expect(wrapper.find('b').exists()).toBe(false)
    for (const control of wrapper.findAll('input, textarea, select')) {
      expect(control.attributes('aria-describedby')).toBe('care-issue')
      expect(control.attributes('aria-invalid')).toBe('true')
    }
  })
  it('suppresses synthetic input/change/button events while disabled, beyond native attributes', async () => {
    const { wrapper, input } = render({ ...requirement(), evidence: [{ sourceRef: 'old', verifiedOn: '' }] }, true)
    const original = JSON.stringify(input.value)
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    const field = wrapper.getComponent(Field)
    for (const control of wrapper.findAll('input, textarea, select, button')) {
      expect((control.element as HTMLInputElement).disabled).toBe(true)
      control.element.dispatchEvent(new Event(control.element.tagName === 'BUTTON' ? 'click' : control.element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    }
    await nextTick()
    expect(field.emitted('update:modelValue')).toBeUndefined()
    expect(field.emitted('remove')).toBeUndefined()
    expect(JSON.stringify(input.value)).toBe(original)
  })
})
