import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import Cell from '../EditorialAttributeCell.vue'
import type { EditorialDefinition } from '../../../interfaces/editorial-contract-definition.types'
import type { EditorialAssignmentInput, EditorialPayloadInput } from '../../../utils/editorial-contract-assignment-input'

const target = { code: 'measure', owner: 'product' as const, variantId: null }
function definition(type: EditorialDefinition['type'], units = 2): EditorialDefinition {
  const base = { id: 'id', code: 'measure', label: 'Medida' }
  if (type === 'number' || type === 'range') return { ...base, type, numericPolicy: { status: 'pending' }, units: units === 1
    ? [{ code: 'cm', label: 'Centímetros', sortOrder: 0 }]
    : [{ code: 'cm', label: 'Centímetros', sortOrder: 1 }, { code: 'm', label: 'Metros', sortOrder: 2 }, { code: null, label: null, sortOrder: 0 }] }
  if (type === 'single' || type === 'multi') return { ...base, type, aliases: [], groups: [], options: [
    { code: 'z', label: 'Zeta', archived: false, sortOrder: 2 }, { code: 'a', label: 'Alfa', archived: true, sortOrder: 0 }] }
  return { ...base, type }
}
const known = (payload: EditorialPayloadInput, evidence: { sourceRef: string; verifiedOn: string } | null = null): EditorialAssignmentInput => ({ state: 'known', payload, evidence })
const tick = () => new Promise(resolve => setTimeout(resolve, 50))
const cleanup: (() => void)[] = []
afterEach(() => { cleanup.splice(0).forEach(stop => stop()); document.body.innerHTML = '' })

function render(type: EditorialDefinition['type'], initial: EditorialAssignmentInput = { state: 'omitted' }, extra: Record<string, unknown> = {}, units = 2) {
  const input = shallowRef<EditorialAssignmentInput>(structuredClone(initial))
  const events: string[] = []
  const wrapper = mount(defineComponent({ setup: () => () => h(Cell, {
    id: 'cell', label: 'Medida · Producto', definition: definition(type, units), target, modelValue: input.value, ...extra,
    'onUpdate:modelValue': (next: EditorialAssignmentInput) => { events.push('update'); input.value = next },
    onClear: () => { events.push('clear'); input.value = { state: 'omitted' } },
    onEnter: () => events.push('enter'),
  }) }), { attachTo: document.body })
  cleanup.push(() => wrapper.unmount())
  return { wrapper, input, events }
}
const menuItems = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
const menuLabels = () => menuItems().map(item => (item.textContent ?? '').trim())
async function choose(wrapper: ReturnType<typeof render>['wrapper'], label: string) {
  await wrapper.get('button[aria-haspopup="menu"]').trigger('click'); await tick()
  menuItems().find(item => (item.textContent ?? '').trim() === label)!.click(); await tick()
}

describe('EditorialAttributeCell controls', () => {
  it.each<[EditorialDefinition['type'], EditorialPayloadInput]>([
    ['text', { type: 'text', value: 'a' }], ['number', { type: 'number', value: '1', unit: 'cm' }],
  ])('creates a known %s value from the first keystroke', async (type, expected) => {
    const { wrapper, input } = render(type)
    await wrapper.get('input[type="text"]').setValue(expected.type === 'text' ? 'a' : '1')
    if (type === 'number') await wrapper.get('select[id$="-unit"]').setValue(JSON.stringify('cm'))
    expect(input.value).toEqual(known(expected))
  })

  it('offers sí/no and distinguishes no from empty', async () => {
    const { wrapper, input } = render('boolean')
    await wrapper.get('select').setValue('false')
    expect(input.value).toEqual(known({ type: 'boolean', value: false }))
    await wrapper.get('select').setValue('')
    expect(input.value).toEqual({ state: 'omitted' })
  })

  it('single: keeps option order, labels archived ones and disables an archived option that is not conserved', async () => {
    const { wrapper, input } = render('single')
    expect(wrapper.get('select').findAll('option').map(option => option.text())).toEqual(['Elige', 'Zeta', 'Alfa (archivada)'])
    expect(wrapper.get('option[value="a"]').attributes('disabled')).toBeDefined()
    await wrapper.get('select').setValue('z')
    expect(input.value).toEqual(known({ type: 'single', value: 'z' }))
  })

  it('single: enables only the archived option the stored draft conserved, and keeps a missing code visible', () => {
    const { wrapper } = render('single', known({ type: 'single', value: 'lost' }), { conservedOptions: ['a'] })
    expect(wrapper.get('option[value="a"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('option[value="lost"]').text()).toContain('lost')
    expect(wrapper.get('option[value="lost"]').attributes('disabled')).toBeDefined()
  })

  it('multi: checks several options and clears the cell when all are unchecked', async () => {
    const { wrapper, input, events } = render('multi', { state: 'omitted' }, { conservedOptions: ['a'] })
    await wrapper.get('input[type="checkbox"][value="z"]').setValue(true)
    expect(input.value).toEqual(known({ type: 'multi', value: ['z'] }))
    await wrapper.get('input[type="checkbox"][value="a"]').setValue(true)
    expect(input.value).toEqual(known({ type: 'multi', value: ['z', 'a'] }))
    await wrapper.get('input[type="checkbox"][value="z"]').setValue(false)
    await wrapper.get('input[type="checkbox"][value="a"]').setValue(false)
    expect(events[events.length - 1]).toBe('clear')
    expect(wrapper.get('summary').text()).toContain('Elegir')
  })

  it('multi: the option list closes with Escape and on a click outside, not on a click inside', async () => {
    const { wrapper } = render('multi', { state: 'omitted' })
    const details = wrapper.get('details').element as HTMLDetailsElement
    details.open = true
    details.querySelector('input')!.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(details.open).toBe(true)
    wrapper.get('summary').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(details.open).toBe(false)
    details.open = true
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(details.open).toBe(false)
  })

  it('marks a cell that has a value with a "Con dato" chip', () => {
    expect(render('text', known({ type: 'text', value: 'Nylon' })).wrapper.text()).toContain('Con dato')
    expect(render('text', { state: 'omitted' }).wrapper.text()).not.toContain('Con dato')
  })

  it('multi: summarizes the selection with option labels', () => {
    const { wrapper } = render('multi', known({ type: 'multi', value: ['z', 'lost'] }))
    expect(wrapper.get('summary').text()).toContain('Zeta')
    expect(wrapper.get('summary').text()).toContain('lost')
  })

  it('number: a single unit is implied and shown as text, several units need a choice', async () => {
    const single = render('number', { state: 'omitted' }, {}, 1)
    expect(single.wrapper.find('select[id$="-unit"]').exists()).toBe(false)
    await single.wrapper.get('input[type="text"]').setValue('3')
    expect(single.input.value).toEqual(known({ type: 'number', value: '3', unit: 'cm' }))
    expect(single.wrapper.text()).toContain('Centímetros')
    const many = render('number')
    await many.wrapper.get('input[type="text"]').setValue('3')
    expect(many.wrapper.get('[role="alert"]').text()).toBe('Elige la unidad')
    expect(many.wrapper.get('input[type="text"]').attributes('aria-invalid')).toBe('true')
    await many.wrapper.get('select[id$="-unit"]').setValue('null')
    expect(many.input.value).toEqual(known({ type: 'number', value: '3', unit: null }))
    expect(many.wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('number: remembers the unit chosen before the value, and says "solo números" for anything else', async () => {
    const { wrapper, input } = render('number')
    await wrapper.get('select[id$="-unit"]').setValue(JSON.stringify('cm'))
    expect(input.value).toEqual({ state: 'omitted' })
    await wrapper.get('input[type="text"]').setValue('2x')
    expect(input.value).toEqual(known({ type: 'number', value: '2x', unit: 'cm' }))
    expect(wrapper.get('[role="alert"]').text()).toBe('Escribe solo números')
  })

  it('range: does not offer a no-unit choice and asks for both ends', async () => {
    const { wrapper, input } = render('range')
    expect(wrapper.find('select[id$="-unit"] option[value="null"]').exists()).toBe(false)
    await wrapper.get('input[id$="-min"]').setValue('1')
    await wrapper.get('select[id$="-unit"]').setValue(JSON.stringify('cm'))
    expect(input.value).toEqual(known({ type: 'range', min: '1', max: '', unit: 'cm' }))
    expect(wrapper.get('[role="alert"]').text()).toBe('Completa mínimo y máximo')
    await wrapper.get('input[id$="-max"]').setValue('2')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('shows a stored value of another type as an error without converting it', () => {
    const stored = known({ type: 'text', value: 'history' })
    const { wrapper, input } = render('number', stored)
    expect(wrapper.get('[role="alert"]').text()).toContain('otro formato')
    expect(wrapper.find('input[type="text"]').exists()).toBe(false)
    expect(input.value).toEqual(stored)
  })

  it('Enter in a text control asks the table to move down, never submits', async () => {
    const { wrapper, events } = render('text', known({ type: 'text', value: 'a' }))
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    wrapper.get('input[type="text"]').element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(events).toContain('enter')
  })
})

describe('EditorialAttributeCell states', () => {
  it.each([
    [{ state: 'omitted' } as EditorialAssignmentInput, 'Sin dato'],
    [{ state: 'unknown' } as EditorialAssignmentInput, 'Desconocido'],
    [{ state: 'not_applicable' } as EditorialAssignmentInput, 'No aplica'],
  ])('shows the chip for %j', (initial, label) => {
    const { wrapper } = render('text', initial)
    expect(wrapper.get('.hf-status-badge').text()).toBe(label)
  })

  it('shows a Con dato chip for a known value', () => {
    const { wrapper } = render('text', known({ type: 'text', value: 'a' }))
    expect(wrapper.get('.hf-status-badge').text()).toBe('Con dato')
  })

  it('replaces the control with the state while it is unknown or not applicable', () => {
    const { wrapper } = render('text', { state: 'unknown' })
    expect(wrapper.find('input[type="text"]').exists()).toBe(false)
  })

  it('the ⋯ menu offers Desconocido, No aplica, Agregar evidencia and Quitar dato for a known value', async () => {
    const { wrapper } = render('text', known({ type: 'text', value: 'a' }))
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click'); await tick()
    expect(menuLabels()).toEqual(['Desconocido', 'No aplica', 'Agregar evidencia', 'Quitar dato'])
    expect(wrapper.get('button[aria-haspopup="menu"]').attributes('aria-label')).toBe('Acciones de Medida · Producto')
  })

  it('Desconocido and No aplica set the state, Quitar dato clears the cell', async () => {
    const { wrapper, input, events } = render('text', known({ type: 'text', value: 'a' }))
    await choose(wrapper, 'Desconocido')
    expect(input.value).toEqual({ state: 'unknown' })
    await choose(wrapper, 'No aplica')
    expect(input.value).toEqual({ state: 'not_applicable' })
    await choose(wrapper, 'Quitar dato')
    expect(events[events.length - 1]).toBe('clear')
    expect(input.value).toEqual({ state: 'omitted' })
  })

  it('while unknown, the menu offers to write a value again and evidence is disabled', async () => {
    const { wrapper, events } = render('text', { state: 'unknown' })
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click'); await tick()
    expect(menuLabels()).toEqual(['Escribir valor', 'No aplica', 'Agregar evidencia', 'Quitar dato'])
    expect(menuItems().find(item => item.textContent?.includes('Agregar evidencia'))!.getAttribute('aria-disabled')).toBe('true')
    menuItems()[0]!.click(); await tick()
    expect(events[events.length - 1]).toBe('clear')
  })

  it('a cell with no data has nothing to remove', async () => {
    const { wrapper } = render('text')
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click'); await tick()
    expect(menuItems().find(item => item.textContent?.includes('Quitar dato'))!.getAttribute('aria-disabled')).toBe('true')
  })
})

describe('EditorialAttributeCell evidence', () => {
  it('opens a small form with source and date, and stores them with the value', async () => {
    const { wrapper, input } = render('text', known({ type: 'text', value: 'a' }))
    await choose(wrapper, 'Agregar evidencia')
    const source = document.querySelector<HTMLInputElement>('#cell-evidence-source')!
    const date = document.querySelector<HTMLInputElement>('#cell-evidence-date')!
    expect(source).not.toBeNull()
    expect(date.type).toBe('date')
    source.value = ' Ficha del proveedor '; source.dispatchEvent(new Event('input', { bubbles: true }))
    date.value = '2026-10-12'; date.dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelector<HTMLButtonElement>('[data-action="save-evidence"]')!.click(); await tick()
    expect(input.value).toEqual(known({ type: 'text', value: 'a' }, { sourceRef: ' Ficha del proveedor ', verifiedOn: '2026-10-12' }))
    expect(wrapper.get('[data-evidence]').attributes('title')).toBe('Con evidencia')
  })

  it('does not store an incomplete evidence and says what is missing', async () => {
    const { wrapper, input } = render('text', known({ type: 'text', value: 'a' }))
    await choose(wrapper, 'Agregar evidencia')
    document.querySelector<HTMLButtonElement>('[data-action="save-evidence"]')!.click(); await tick()
    expect(document.querySelector('#cell-evidence-error')!.textContent).toContain('fuente y una fecha')
    expect(input.value).toEqual(known({ type: 'text', value: 'a' }))
  })

  it('removes an existing evidence without touching the value', async () => {
    const { wrapper, input } = render('text', known({ type: 'text', value: 'a' }, { sourceRef: 'Fuente', verifiedOn: '2026-01-01' }))
    await choose(wrapper, 'Editar evidencia')
    expect((document.querySelector('#cell-evidence-source') as HTMLInputElement).value).toBe('Fuente')
    document.querySelector<HTMLButtonElement>('[data-action="remove-evidence"]')!.click(); await tick()
    expect(input.value).toEqual(known({ type: 'text', value: 'a' }))
  })

  it('moving to unknown drops the evidence with the value', async () => {
    const { wrapper, input } = render('text', known({ type: 'text', value: 'a' }, { sourceRef: 'Fuente', verifiedOn: '2026-01-01' }))
    await choose(wrapper, 'No aplica')
    expect(input.value).toEqual({ state: 'not_applicable' })
  })
})

describe('EditorialAttributeCell issues and read-only', () => {
  it('shows an issue next to the control with aria-invalid and a described-by link', () => {
    const { wrapper } = render('text', known({ type: 'text', value: 'a' }), { issue: 'Este dato no se puede guardar.' })
    const control = wrapper.get('input[type="text"]')
    expect(control.attributes('aria-invalid')).toBe('true')
    expect(control.attributes('aria-describedby')).toBe('cell-issue')
    expect(wrapper.get('#cell-issue').text()).toBe('Este dato no se puede guardar.')
  })

  it('has no error text and no aria-invalid when the cell is fine', () => {
    const { wrapper } = render('text', known({ type: 'text', value: 'a' }))
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('input[type="text"]').attributes('aria-invalid')).toBeUndefined()
  })

  it('read-only shows words, no controls and no menu', () => {
    const { wrapper } = render('single', known({ type: 'single', value: 'z' }), { readonly: true })
    expect(wrapper.text()).toContain('Zeta')
    expect(wrapper.find('input, select, button').exists()).toBe(false)
  })

  it('read-only still tells unknown from no data', () => {
    expect(render('text', { state: 'unknown' }, { readonly: true }).wrapper.text()).toContain('Desconocido')
    expect(render('text', { state: 'omitted' }, { readonly: true }).wrapper.text()).toContain('Sin dato')
  })

  it('a disabled cell ignores even synthetic events', async () => {
    const { wrapper, events } = render('text', known({ type: 'text', value: 'a' }), { disabled: true })
    const control = wrapper.get('input[type="text"]')
    expect(control.attributes('disabled')).toBeDefined()
    ;(control.element as HTMLInputElement).value = 'b'
    control.element.dispatchEvent(new Event('input', { bubbles: true }))
    expect(events).toEqual([])
  })
})
