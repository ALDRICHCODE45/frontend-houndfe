import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import Field from '../EditorialCareReviewField.vue'
import Requirement from '../EditorialCareRequirementField.vue'
import Warning from '../EditorialCareWarningField.vue'
import type { EditorialCareReviewInput } from '../../../utils/editorial-contract-care-input'
import { removeEditorialCareRequirement, type PreparedEditorialCareInput } from '../../../utils/editorial-contract-care-edits'

const blank = (): PreparedEditorialCareInput => ({ state: 'prepared', jurisdiction: '', intendedUse: '', determination: null,
  basis: '', evidence: [], requirements: [], warnings: [] })
const populated = (): PreparedEditorialCareInput => ({ ...blank(), requirements: [0, 1].map(() => ({ key: 'same',
  description: '', disposition: null, basis: '', evidence: [] })), warnings: [{ key: 'w', requirementKeys: ['same', 'same', 'dangling'],
  text: '', disclosure: null, evidence: [], handlingBasis: '' }] })
function freeze(value: unknown) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
}
const cleanup: (() => void)[] = []
afterEach(() => { cleanup.splice(0).forEach(stop => stop()); vi.restoreAllMocks() })
function render(initial: EditorialCareReviewInput = blank(), disabled = false, issue?: string) {
  const original = JSON.stringify(initial)
  freeze(initial)
  const input = shallowRef(initial), identity = shallowRef(0)
  const ids = shallowRef({ requirements: ['r-a', 'r-b'], warnings: ['w-a'] })
  const wrapper = mount(defineComponent({ setup: () => () => h(Field, {
    key: identity.value, id: 'care', modelValue: input.value, rowIds: ids.value, disabled, issue,
    'onUpdate:modelValue': (next: EditorialCareReviewInput) => { input.value = next },
    onRemoveRequirement: (index: number) => {
      if (input.value.state !== 'prepared') return
      input.value = removeEditorialCareRequirement(input.value, index)
      ids.value = { ...ids.value, requirements: ids.value.requirements.filter((_, i) => i !== index) }
    },
    onRemoveWarning: (index: number) => {
      if (input.value.state !== 'prepared') return
      input.value = { ...input.value, warnings: input.value.warnings.filter((_, i) => i !== index) }
      ids.value = { ...ids.value, warnings: ids.value.warnings.filter((_, i) => i !== index) }
    },
  }) }))
  cleanup.push(() => { expect(JSON.stringify(initial)).toBe(original); wrapper.unmount() })
  return { wrapper, input, identity, field: () => wrapper.getComponent(Field), prepared: () => input.value as PreparedEditorialCareInput }
}
const value = (wrapper: ReturnType<typeof render>['wrapper'], selector: string) => wrapper.get<HTMLInputElement>(selector).element.value

describe('S43 controlled care review composition', () => {
  it.each(['omitted', 'unknown'] as const)('creates only explicit blank prepared state from %s without hidden restoration', async state => {
    const { wrapper, input } = render({ state })
    expect(value(wrapper, '#care-state')).toBe(state)
    expect(wrapper.find('#care-jurisdiction').exists()).toBe(false)
    await wrapper.get('#care-state').setValue('prepared')
    expect(input.value).toEqual(blank())
    await wrapper.get('#care-state').setValue('unknown')
    await wrapper.get('#care-state').setValue('prepared')
    expect(input.value).toEqual(blank())
  })
  it('does not confirm or emit for same-state selection, and leaves blank prepared without confirmation', async () => {
    const { wrapper, input, field } = render(blank())
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await wrapper.get('#care-state').trigger('change')
    expect(field().emitted('update:modelValue')).toBeUndefined()
    await wrapper.get('#care-state').setValue('omitted')
    expect(input.value).toEqual({ state: 'omitted' })
    expect(confirm).not.toHaveBeenCalled()
  })
  it('edits exact review prose and nullable determination without clearing arrays', async () => {
    const { wrapper, prepared } = render(populated())
    for (const part of ['jurisdiction', 'intendedUse', 'basis']) await wrapper.get(`#care-${part}`).setValue('  raw\n prose ')
    expect(prepared()).toMatchObject({ jurisdiction: '  raw\n prose ', intendedUse: '  raw\n prose ', basis: '  raw\n prose ' })
    for (const determination of ['identified', 'none_applicable', '']) {
      await wrapper.get('#care-determination').setValue(determination)
      expect(prepared().determination).toBe(determination || null)
      expect(prepared().requirements).toEqual(populated().requirements)
      expect(prepared().warnings).toEqual(populated().warnings)
    }
  })
  it('preserves ordered review evidence and partial dates through remount and explicit removals', async () => {
    const { wrapper, prepared, identity } = render({ ...blank(), evidence: [{ sourceRef: 'first', verifiedOn: 'old' }] })
    await wrapper.get('[data-action="add-review-evidence"]').trigger('click')
    await wrapper.get('#care-evidence-1-source').setValue(' source ')
    await wrapper.get('#care-evidence-1-date').setValue('2026-0')
    expect(prepared().evidence).toEqual([{ sourceRef: 'first', verifiedOn: 'old' }, { sourceRef: ' source ', verifiedOn: '2026-0' }])
    identity.value++; await nextTick()
    expect(value(wrapper, '#care-evidence-1-date')).toBe('2026-0')
    expect(wrapper.get('#care-evidence-1-date').attributes('type')).toBe('text')
    await wrapper.get('[data-action="remove-review-evidence-0"]').trigger('click')
    expect(prepared().evidence).toEqual([{ sourceRef: ' source ', verifiedOn: '2026-0' }])
    await wrapper.get('[data-action="remove-review-evidence-0"]').trigger('click')
    expect(prepared().evidence).toEqual([])
  })
  it.each(['unknown', 'omitted'] as const)('cancel preserves raw, actual select and emissions; confirmation discards to %s', async destination => {
    const { wrapper, input, field } = render(populated())
    const before = JSON.stringify(input.value)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await wrapper.get('#care-state').setValue(destination)
    expect(confirm).toHaveBeenCalledOnce()
    expect(confirm.mock.calls[0]?.[0]).toMatch(/descartar/i)
    expect(JSON.stringify(input.value)).toBe(before)
    expect(value(wrapper, '#care-state')).toBe('prepared')
    expect(field().emitted('update:modelValue')).toBeUndefined()
    await wrapper.get('#care-state').trigger('change')
    expect(confirm).toHaveBeenCalledOnce()
    confirm.mockReturnValue(true)
    await wrapper.get('#care-state').setValue(destination)
    expect(input.value).toEqual({ state: destination })
    expect(field().emitted('update:modelValue')).toEqual([[{ state: destination }]])
    expect(value(wrapper, '#care-state')).toBe(destination)
    await wrapper.get('#care-state').setValue('prepared')
    expect(input.value).toEqual(blank())
  })
  it.each([
    { jurisdiction: ' ' }, { intendedUse: 'x' }, { basis: ' ' }, { determination: 'identified' as const },
    { evidence: [{ sourceRef: '', verifiedOn: '' }] }, { requirements: populated().requirements }, { warnings: populated().warnings },
  ])('counts every raw content category for confirmation: %j', async patch => {
    const { wrapper, input } = render({ ...blank(), ...patch })
    const before = JSON.stringify(input.value)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await wrapper.get('#care-state').setValue('unknown')
    expect(confirm).toHaveBeenCalledOnce()
    expect(JSON.stringify(input.value)).toBe(before)
    expect(value(wrapper, '#care-state')).toBe('prepared')
  })
  it('uses stable external IDs for duplicate editable keys, preserves references and child edits across removal/remount', async () => {
    const { wrapper, prepared, identity, field } = render(populated())
    const references = structuredClone(prepared().warnings)
    const remaining = wrapper.get('#care-r-b-description').element
    await wrapper.get('#care-r-b-description').setValue(' partial child ')
    await wrapper.get('#care-r-b-key').setValue(' renamed ')
    expect(prepared().warnings).toEqual(references)
    await wrapper.get('#care-r-a-key').setValue(' renamed ')
    await wrapper.findAllComponents(Requirement)[0]!.get('[data-action="remove-requirement"]').trigger('click')
    expect(field().emitted('removeRequirement')).toEqual([[0]])
    expect(wrapper.get('#care-r-b-description').element).toBe(remaining)
    expect(prepared().requirements).toHaveLength(1)
    expect(prepared().requirements[0]?.description).toBe(' partial child ')
    expect(prepared().warnings).toEqual(references)
    identity.value++; await nextTick()
    expect(value(wrapper, '#care-r-b-description')).toBe(' partial child ')
    expect(value(wrapper, '#care-r-b-key')).toBe(' renamed ')
    await wrapper.getComponent(Requirement).get('[data-action="add-evidence"]').trigger('click')
    await wrapper.get('#care-r-b-evidence-0-date').setValue('2026-')
    const requirements = structuredClone(prepared().requirements)
    await wrapper.get('#care-w-a-text').setValue(' warning edit ')
    expect(prepared().requirements).toEqual(requirements)
    expect(prepared().warnings[0]?.requirementKeys).toEqual(references[0]?.requirementKeys)
    identity.value++; await nextTick()
    expect(value(wrapper, '#care-r-b-evidence-0-date')).toBe('2026-')
    expect(value(wrapper, '#care-w-a-text')).toBe(' warning edit ')
    await wrapper.get('[data-action="add-requirement"]').trigger('click')
    await wrapper.get('[data-action="add-warning"]').trigger('click')
    expect(field().emitted('addRequirement')).toEqual([[]])
    expect(field().emitted('addWarning')).toEqual([[]])
    expect(prepared().requirements).toHaveLength(1)
    await wrapper.getComponent(Warning).get('[data-action="remove-warning"]').trigger('click')
    expect(field().emitted('removeWarning')).toEqual([[0]])
    expect(prepared().warnings).toEqual([])
  })
  it('associates literal aggregate diagnostics and visible labels', () => {
    const { wrapper } = render(blank(), false, '<b>Revisar cuidado</b>')
    expect(wrapper.get('#care-issue').text()).toBe('<b>Revisar cuidado</b>')
    expect(wrapper.find('b').exists()).toBe(false)
    for (const label of wrapper.findAll('label')) expect(wrapper.find(`#${label.attributes('for')}`).exists()).toBe(true)
    for (const control of wrapper.findAll('input, textarea, select')) expect(control.attributes('aria-describedby')).toBe('care-issue')
  })
  it('suppresses disabled native and synthetic edits, child emissions, intents and confirmation', async () => {
    const { wrapper, input, field } = render({ ...populated(), evidence: [{ sourceRef: '', verifiedOn: '' }] }, true)
    const before = JSON.stringify(input.value)
    const confirm = vi.spyOn(window, 'confirm')
    for (const control of wrapper.findAll('input, textarea, select, button')) {
      expect((control.element as HTMLInputElement).disabled).toBe(true)
      control.element.dispatchEvent(new Event(control.element.tagName === 'BUTTON' ? 'click' : control.element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    }
    wrapper.getComponent(Requirement).vm.$emit('update:modelValue', { ...populated().requirements[0], key: 'ignored' })
    wrapper.getComponent(Requirement).vm.$emit('remove')
    wrapper.getComponent(Warning).vm.$emit('update:modelValue', { ...populated().warnings[0], text: 'ignored' })
    wrapper.getComponent(Warning).vm.$emit('remove')
    await nextTick()
    expect(field().emitted()).toEqual({})
    expect(confirm).not.toHaveBeenCalled()
    expect(JSON.stringify(input.value)).toBe(before)
  })
})
