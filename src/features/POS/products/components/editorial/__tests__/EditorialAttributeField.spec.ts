/**
 * T13 (S15): one datum of a section card. One shared control per definition type, «No lo sé» and
 * «No aplica» inside it (only where the policy admits «No aplica»), the markers by the label, the
 * evidence as a small action of the label row. Ported from the T8/T9 cell specs.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import { CalendarDate } from '@internationalized/date'
import Field from '../EditorialAttributeField.vue'
import HfCombobox from '@/core/shared/components/form/HfCombobox.vue'
import HfUnitField from '@/core/shared/components/form/HfUnitField.vue'
import type { EditorialDefinition } from '../../../interfaces/editorial-contract-definition.types'
import type { EditorialAssignmentInput, EditorialPayloadInput } from '../../../utils/editorial-contract-assignment-input'
import type { EditorialTableCell, EditorialTableRow } from '../../../utils/editorial-attribute-table'

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
const target = { code: 'measure', owner: 'product' as const, variantId: null }
function definition(type: EditorialDefinition['type'], units = 2, code = 'measure'): EditorialDefinition {
  const base = { id: 'id', code, label: 'Medida' }
  if (type === 'number' || type === 'range') return { ...base, type, numericPolicy: { status: 'pending' }, units: units === 1
    ? [{ code: 'cm', label: 'Centímetros', sortOrder: 0 }]
    : units === 0 ? [{ code: null, label: null, sortOrder: 0 }]
      : [{ code: 'cm', label: 'Centímetros', sortOrder: 1 }, { code: 'm', label: 'Metros', sortOrder: 2 }, { code: null, label: null, sortOrder: 0 }] }
  if (type === 'single' || type === 'multi') return { ...base, type, aliases: [], groups: [], options: [
    { code: 'z', label: 'Zeta', archived: false, sortOrder: 2 }, { code: 'a', label: 'Alfa', archived: true, sortOrder: 0 }] }
  return { ...base, type }
}
const known = (payload: EditorialPayloadInput, evidence: { sourceRef: string; verifiedOn: string } | null = null): EditorialAssignmentInput => ({ state: 'known', payload, evidence })
const tick = () => new Promise(resolve => setTimeout(resolve, 50))
const cleanup: (() => void)[] = []
afterEach(() => { cleanup.splice(0).forEach(stop => stop()); document.body.innerHTML = '' })

type Options = { naAdmitted?: boolean; required?: boolean; internal?: boolean; description?: string | null; readonly?: boolean; disabled?: boolean; issue?: string
  conservedOptions?: string[]; units?: number; code?: string }
function render(type: EditorialDefinition['type'], initial: EditorialAssignmentInput = { state: 'omitted' }, options: Options = {}) {
  const input = shallowRef<EditorialAssignmentInput>(structuredClone(initial))
  const rowId = shallowRef<string | null>(initial.state === 'omitted' ? null : 'r1')
  const events: string[] = []
  const def = definition(type, options.units ?? 2, options.code)
  const wrapper = mount(defineComponent({ setup: () => () => {
    const cell: EditorialTableCell = { key: 'product', target, rowId: rowId.value, input: input.value, filled: input.value.state !== 'omitted',
      naAdmitted: options.naAdmitted ?? false, required: options.required ?? false }
    const row: EditorialTableRow = { code: def.code, label: 'Medida', definition: def, owner: 'product', sectionCode: null, sectionSortOrder: null,
      internal: options.internal ?? false, description: options.description ?? null, cells: [cell] }
    return h(Field, { id: 'f', row, cell, readonly: options.readonly, disabled: options.disabled, issue: options.issue, conservedOptions: options.conservedOptions,
      onUpdate: (next: EditorialAssignmentInput) => { events.push('update'); input.value = next; rowId.value = 'r1' },
      onClear: () => { events.push('clear'); input.value = { state: 'omitted' }; rowId.value = null } })
  } }), { attachTo: document.body })
  cleanup.push(() => wrapper.unmount())
  return { wrapper, input, events }
}
type Wrapper = ReturnType<typeof render>['wrapper']
const specials = (component: { props: (key: string) => unknown }) => (component.props('specialAnswers') as { label: string }[]).map(item => item.label)
const message = (wrapper: Wrapper) => wrapper.find('.hf-form-field__message')

describe('EditorialAttributeField — one control per type', () => {
  it('short text: a single-line input in one column that creates the value from the first keystroke', async () => {
    const { wrapper, input } = render('text', known({ type: 'text', value: 'Animal' }), { code: 'text.protein_origin' })
    expect(wrapper.get('[data-testid="attribute-field"]').attributes('span')).toBeUndefined()
    expect(wrapper.find('textarea').exists()).toBe(false)
    const control = wrapper.get('input#f-value')
    expect(control.attributes('type')).toBe('text')
    expect((control.element as HTMLInputElement).value).toBe('Animal')
    await control.setValue('a')
    expect(input.value).toEqual(known({ type: 'text', value: 'a' }))
    await control.setValue('')
    expect(input.value).toEqual({ state: 'omitted' })
  })

  it.each(['text.ingredients', 'text.composition', 'text.instructions', 'text.clinical_analysis'])(
    'long text (%s): a textarea across both columns', async (code) => {
      const { wrapper, input } = render('text', { state: 'omitted' }, { code })
      expect(wrapper.get('[data-testid="attribute-field"]').attributes('span')).toBe('full')
      await wrapper.get('textarea#f-value').setValue('a')
      expect(input.value).toEqual(known({ type: 'text', value: 'a' }))
    })

  it('single: the shared combobox in option order, archived options marked and locked unless the stored draft conserves them', () => {
    const { wrapper } = render('single')
    const combo = wrapper.getComponent(HfCombobox)
    expect(combo.props('label')).toBe('Medida')
    expect(combo.props('items')).toEqual([{ value: 'z', label: 'Zeta', disabled: false }, { value: 'a', label: 'Alfa (archivada)', disabled: true }])
    cleanup.splice(0).forEach(stop => stop())
    const conserved = render('single', known({ type: 'single', value: 'gone' }), { conservedOptions: ['a'] }).wrapper.getComponent(HfCombobox)
    expect(conserved.props('items')).toEqual([{ value: 'z', label: 'Zeta', disabled: false }, { value: 'a', label: 'Alfa (archivada)', disabled: false },
      { value: 'gone', label: 'gone (no disponible)', disabled: true }])
  })

  it('single and multi: a pick stores the value; multi keeps the option order and clears when nothing is left', async () => {
    const one = render('single')
    one.wrapper.getComponent(HfCombobox).vm.$emit('update:modelValue', 'z'); await tick()
    expect(one.input.value).toEqual(known({ type: 'single', value: 'z' }))
    cleanup.splice(0).forEach(stop => stop())
    const many = render('multi')
    expect(many.wrapper.getComponent(HfCombobox).props('multiple')).toBe(true)
    many.wrapper.getComponent(HfCombobox).vm.$emit('update:modelValue', ['a', 'z']); await tick()
    expect(many.input.value).toEqual(known({ type: 'multi', value: ['z', 'a'] }))
    many.wrapper.getComponent(HfCombobox).vm.$emit('update:modelValue', []); await tick()
    expect(many.input.value).toEqual({ state: 'omitted' })
  })

  it('boolean: Sí and No in the combobox', async () => {
    const { wrapper, input } = render('boolean')
    expect(wrapper.getComponent(HfCombobox).props('items')).toEqual([{ label: 'Sí', value: 'true' }, { label: 'No', value: 'false' }])
    wrapper.getComponent(HfCombobox).vm.$emit('update:modelValue', 'false'); await tick()
    expect(input.value).toEqual(known({ type: 'boolean', value: false }))
  })

  it('number with units: the unit field; several units need a choice, a single one is implied', async () => {
    const many = render('number')
    const unit = () => many.wrapper.getComponent(HfUnitField)
    expect(unit().props('units').map((item: { label: string }) => item.label)).toEqual(['Centímetros', 'Metros', 'Sin unidad'])
    unit().vm.$emit('update:text', 'value', '3'); await tick()
    expect(message(many.wrapper).text()).toBe('Elige la unidad')
    expect(unit().props('invalid')).toBe(true)
    unit().vm.$emit('update:modelValue', { value: 3, unit: 'null' }); await tick()
    expect(many.input.value).toEqual(known({ type: 'number', value: '3', unit: null }))
    expect(message(many.wrapper).exists()).toBe(false)
    cleanup.splice(0).forEach(stop => stop())
    const single = render('number', { state: 'omitted' }, { units: 1 })
    expect(single.wrapper.getComponent(HfUnitField).props('modelValue')).toEqual({ value: undefined, unit: JSON.stringify('cm') })
    single.wrapper.getComponent(HfUnitField).vm.$emit('update:text', 'value', '3'); await tick()
    expect(single.input.value).toEqual(known({ type: 'number', value: '3', unit: 'cm' }))
  })

  it('number: remembers the unit chosen before the value, and says «Escribe solo números» for anything else', async () => {
    const { wrapper, input } = render('number')
    wrapper.getComponent(HfUnitField).vm.$emit('update:modelValue', { unit: JSON.stringify('cm') }); await tick()
    expect(input.value).toEqual({ state: 'omitted' })
    wrapper.getComponent(HfUnitField).vm.$emit('update:text', 'value', '2x'); await tick()
    expect(input.value).toEqual(known({ type: 'number', value: '2x', unit: 'cm' }))
    expect(message(wrapper).text()).toBe('Escribe solo números')
  })

  it('number with no unit: a plain input', async () => {
    const { wrapper, input } = render('number', { state: 'omitted' }, { units: 0 })
    expect(wrapper.findComponent(HfUnitField).exists()).toBe(false)
    await wrapper.get('input#f-value').setValue('4')
    expect(input.value).toEqual(known({ type: 'number', value: '4', unit: null }))
  })

  it('range: the unit field as a range, no "none" unit, and both ends asked for', async () => {
    const { wrapper, input } = render('range')
    const unit = () => wrapper.getComponent(HfUnitField)
    expect(unit().props('range')).toBe(true)
    expect(unit().props('units').map((item: { value: string }) => item.value)).not.toContain('null')
    unit().vm.$emit('update:text', 'min', '1'); await tick()
    unit().vm.$emit('update:modelValue', { min: 1, unit: JSON.stringify('cm') }); await tick()
    expect(input.value).toEqual(known({ type: 'range', min: '1', max: '', unit: 'cm' }))
    expect(message(wrapper).text()).toBe('Completa mínimo y máximo')
    unit().vm.$emit('update:text', 'max', '2'); await tick()
    expect(message(wrapper).exists()).toBe(false)
  })

  it('shows a stored value of another type as an error, as words, and offers to remove it', async () => {
    const stored = known({ type: 'text', value: 'history' })
    const { wrapper, input } = render('number', stored)
    expect(message(wrapper).text()).toContain('otro formato')
    expect(wrapper.findComponent(HfUnitField).exists()).toBe(false)
    expect(input.value).toEqual(stored)
    await wrapper.get('[data-action="clear"]').trigger('click')
    expect(input.value).toEqual({ state: 'omitted' })
  })
})

describe('EditorialAttributeField — special answers inside the control', () => {
  it('a list offers «No lo sé», and «No aplica» only where the policy admits it', () => {
    expect(specials(render('single').wrapper.getComponent(HfCombobox))).toEqual(['No lo sé'])
    cleanup.splice(0).forEach(stop => stop())
    expect(specials(render('single', { state: 'omitted' }, { naAdmitted: true }).wrapper.getComponent(HfCombobox))).toEqual(['No lo sé', 'No aplica'])
  })

  it('maps «No lo sé» to unknown and «No aplica» to not applicable, and a stored refused «No aplica» still shows', async () => {
    const { wrapper, input } = render('single', { state: 'omitted' }, { naAdmitted: true })
    wrapper.getComponent(HfCombobox).vm.$emit('update:special', 'unknown'); await tick()
    expect(input.value).toEqual({ state: 'unknown' })
    expect(wrapper.getComponent(HfCombobox).props('special')).toBe('unknown')
    wrapper.getComponent(HfCombobox).vm.$emit('update:special', 'not_applicable'); await tick()
    expect(input.value).toEqual({ state: 'not_applicable' })
    cleanup.splice(0).forEach(stop => stop())
    const refused = render('single', { state: 'not_applicable' })
    expect(specials(refused.wrapper.getComponent(HfCombobox))).toEqual(['No lo sé', 'No aplica'])
    expect(refused.wrapper.getComponent(HfCombobox).props('special')).toBe('not_applicable')
  })

  it('a unit field carries them on its unit list; picking a unit again takes the answer away', async () => {
    const { wrapper, input, events } = render('number', { state: 'unknown' }, { naAdmitted: true })
    expect(specials(wrapper.getComponent(HfUnitField))).toEqual(['No lo sé', 'No aplica'])
    expect(wrapper.getComponent(HfUnitField).props('special')).toBe('unknown')
    wrapper.getComponent(HfUnitField).vm.$emit('update:special', null); await tick()
    expect(events).toEqual(['clear'])
    expect(input.value).toEqual({ state: 'omitted' })
  })

  it('a text field offers them as ghost actions; the answer then shows in the control with «Escribir» to go back', async () => {
    const { wrapper, input } = render('text', { state: 'omitted' }, { naAdmitted: true })
    expect(wrapper.findAll('.hf-form-field__ghost').map(item => item.text())).toEqual(['No lo sé', 'No aplica'])
    await wrapper.findAll('.hf-form-field__ghost')[0]!.trigger('click')
    expect(input.value).toEqual({ state: 'unknown' })
    const write = wrapper.get('[data-action="write"]')
    expect(write.text()).toContain('No lo sé')
    expect(write.text()).toContain('Escribir')
    expect(wrapper.find('#f-value').exists()).toBe(false)
    await write.trigger('click'); await tick()
    expect(input.value).toEqual({ state: 'omitted' })
    expect(document.activeElement).toBe(wrapper.get('#f-value').element)
  })

  it('moving to a special answer drops the value and its evidence', async () => {
    const { wrapper, input } = render('text', known({ type: 'text', value: 'a' }, { sourceRef: 'Fuente', verifiedOn: '2026-01-01' }), { naAdmitted: true })
    await wrapper.findAll('.hf-form-field__ghost')[1]!.trigger('click')
    expect(input.value).toEqual({ state: 'not_applicable' })
  })
})

describe('EditorialAttributeField — the label row', () => {
  it('always points the control at the description, which HfFormField shows on focus or from the info button', () => {
    const { wrapper } = render('text', { state: 'omitted' }, { description: 'Escríbelos como aparecen en el empaque.' })
    expect(wrapper.get('#f-value').attributes('aria-describedby')).toBe('f-value-message')
    expect(wrapper.get('#f-value-message').attributes('data-tone')).toBe('help')
    expect(wrapper.get('.hf-form-field__info').attributes('aria-controls')).toBe('f-value-message')
  })

  it('keeps the evidence paperclip of a field that has evidence as an active indicator', () => {
    const evidence = { sourceRef: 'Fuente', verifiedOn: '2026-01-01' }
    expect(render('text', known({ type: 'text', value: 'a' }, evidence)).wrapper.get('[data-action="evidence"]').attributes('data-active')).toBe('true')
    cleanup.splice(0).forEach(stop => stop())
    expect(render('text', known({ type: 'text', value: 'a' }, evidence), { readonly: true }).wrapper.get('[data-evidence]').attributes('data-active')).toBe('true')
    cleanup.splice(0).forEach(stop => stop())
    expect(render('text', known({ type: 'text', value: 'a' })).wrapper.get('[data-action="evidence"]').attributes('data-active')).toBeUndefined()
  })

  it('marks «Requerido para publicar» while the datum has no value, «Interno», and the description as help', () => {
    const { wrapper } = render('single', { state: 'omitted' }, { required: true, internal: true, description: 'Qué dice el empaque.' })
    expect(wrapper.get('.hf-form-field__required').text()).toBe('Requerido para publicar')
    expect(wrapper.get('.hf-form-field__internal').text()).toBe('Interno')
    expect(message(wrapper).text()).toBe('Qué dice el empaque.')
    cleanup.splice(0).forEach(stop => stop())
    expect(render('single', known({ type: 'single', value: 'z' }), { required: true }).wrapper.find('.hf-form-field__required').exists()).toBe(false)
  })

  it('has no state chip and no ⋯ menu', () => {
    const { wrapper } = render('single', known({ type: 'single', value: 'z' }))
    expect(wrapper.find('.hf-status-badge').exists()).toBe(false)
    expect(wrapper.find('button[aria-haspopup="menu"]').exists()).toBe(false)
  })

  it('offers evidence only on a known value, as a small action that opens the same form', async () => {
    expect(render('text').wrapper.find('[data-action="evidence"]').exists()).toBe(false)
    cleanup.splice(0).forEach(stop => stop())
    const { wrapper, input } = render('text', known({ type: 'text', value: 'a' }))
    const action = wrapper.get('[data-action="evidence"]')
    expect(action.attributes('aria-label')).toBe('Agregar evidencia de Medida')
    await action.trigger('click'); await tick()
    const source = document.querySelector<HTMLInputElement>('#f-evidence-source')!
    // The date is the app's calendar field, never the browser's native date input.
    const date = wrapper.findComponent({ name: 'InputDate' })
    expect(date.exists()).toBe(true)
    // (the calendar field keeps one aria-hidden form input of its own)
    expect([...document.querySelectorAll('input[type="date"]')].filter(item => item.getAttribute('aria-hidden') !== 'true')).toHaveLength(0)
    expect(date.props('modelValue')).toBeUndefined()
    document.querySelector<HTMLButtonElement>('[data-action="save-evidence"]')!.click(); await tick()
    expect(document.body.textContent).toContain('Escribe la fuente y una fecha válida.')
    expect(input.value).toEqual(known({ type: 'text', value: 'a' }))
    source.value = ' Ficha del proveedor '; source.dispatchEvent(new Event('input', { bubbles: true }))
    date.vm.$emit('update:modelValue', new CalendarDate(2026, 10, 12)); await tick()
    expect(String(date.props('modelValue'))).toBe('2026-10-12')
    document.querySelector<HTMLButtonElement>('[data-action="save-evidence"]')!.click(); await tick()
    expect(input.value).toEqual(known({ type: 'text', value: 'a' }, { sourceRef: ' Ficha del proveedor ', verifiedOn: '2026-10-12' }))
    expect(wrapper.get('[data-action="evidence"]').attributes('aria-label')).toBe('Editar evidencia de Medida')
  })

  it('removes an existing evidence without touching the value', async () => {
    const { wrapper, input } = render('text', known({ type: 'text', value: 'a' }, { sourceRef: 'Fuente', verifiedOn: '2026-01-01' }))
    await wrapper.get('[data-action="evidence"]').trigger('click'); await tick()
    expect((document.querySelector('#f-evidence-source') as HTMLInputElement).value).toBe('Fuente')
    expect(String(wrapper.findComponent({ name: 'InputDate' }).props('modelValue'))).toBe('2026-01-01')
    document.querySelector<HTMLButtonElement>('[data-action="remove-evidence"]')!.click(); await tick()
    expect(input.value).toEqual(known({ type: 'text', value: 'a' }))
  })

  it('«Quitar dato» clears a list value, which has no empty pick', async () => {
    const { wrapper, input } = render('single', known({ type: 'single', value: 'z' }))
    await wrapper.get('[data-action="clear"]').trigger('click')
    expect(input.value).toEqual({ state: 'omitted' })
    expect(wrapper.find('[data-action="clear"]').exists()).toBe(false)
  })
})

describe('EditorialAttributeField — issues, read-only and disabled', () => {
  it('shows an issue under the control with aria-invalid and a described-by link', () => {
    const { wrapper } = render('text', known({ type: 'text', value: 'a' }), { issue: 'Este dato no se puede guardar.' })
    const control = wrapper.get('#f-value')
    expect(control.attributes('aria-invalid')).toBe('true')
    expect(control.attributes('aria-describedby')).toBe('f-value-message')
    expect(wrapper.get('#f-value-message').text()).toBe('Este dato no se puede guardar.')
  })

  it('read-only shows words, no controls and no actions, and still tells «No lo sé» from no data', () => {
    expect(render('single', known({ type: 'single', value: 'z' }), { readonly: true }).wrapper.text()).toContain('Zeta')
    expect(document.querySelector('[data-testid="attribute-field"] :is(input, textarea, button)')).toBeNull()
    cleanup.splice(0).forEach(stop => stop())
    expect(render('text', { state: 'unknown' }, { readonly: true }).wrapper.text()).toContain('No lo sé')
    cleanup.splice(0).forEach(stop => stop())
    expect(render('text', { state: 'omitted' }, { readonly: true }).wrapper.text()).toContain('Sin dato')
  })

  it('a disabled field ignores even synthetic events', async () => {
    const { wrapper, events } = render('text', known({ type: 'text', value: 'a' }), { disabled: true })
    const control = wrapper.get('#f-value')
    expect(control.attributes('disabled')).toBeDefined()
    ;(control.element as HTMLTextAreaElement).value = 'b'
    control.element.dispatchEvent(new Event('input', { bubbles: true }))
    expect(events).toEqual([])
  })
})
