import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import Table from '../EditorialAttributeTable.vue'
import { stubEditorialSelect } from './editorialSelectStub'
import type { EditorialDefinition } from '../../../interfaces/editorial-contract-definition.types'
import type { EditorialBinding, EditorialFamily } from '../../../interfaces/editorial-contract-vocabulary.types'
import { editorialTargetKey } from '../../../utils/editorial-attribute-table'
import type { EditorialAssignmentEditingRow } from '../../../utils/editorial-contract-document-editing'

beforeAll(stubEditorialSelect)
const source = readFileSync(resolve(__dirname, '../EditorialAttributeTable.vue'), 'utf8')
const binding = (code: string, owner: 'product' | 'sellable'): EditorialBinding => ({
  definitionId: code, definitionCode: code, owner, sortOrder: 0, exposure: 'DETAIL', searchable: false, publicationCheck: 'when_asserted', policy: { route: 'pending' },
})
const definitions: EditorialDefinition[] = [
  { id: 'animal.target', code: 'animal.target', label: 'Especie', type: 'single', groups: [], aliases: [], options: [{ code: 'dog', label: 'Perro', archived: false, sortOrder: 0 }] },
  { id: 'material', code: 'material', label: 'Material', type: 'text' },
  { id: 'origin', code: 'origin', label: 'Origen', type: 'text' },
  { id: 'measure.net_mass', code: 'measure.net_mass', label: 'Peso neto', type: 'text' },
]
// An option case with no condition that admits "No aplica": the policy the ⋯ menu follows.
const admitsNotApplicable: EditorialBinding['policy'] = { route: 'option_cases', cases: [{ code: 'open', when: [], applicability: 'not_applicable', required: false, allowNA: true, evidenceRequired: true, documentary: 'resolved' }] }
const family: EditorialFamily = { id: 'food', code: 'food', label: 'Alimento', bindings: [{ ...binding('animal.target', 'product'), policy: admitsNotApplicable }, binding('material', 'product'), binding('origin', 'product'), binding('measure.net_mass', 'sellable')] }
const subjects = [{ variantId: 'v1', label: '15 kg' }, { variantId: 'v2', label: '7.5 kg' }]
const text = (value: string) => ({ state: 'known' as const, payload: { type: 'text' as const, value }, evidence: null })
const rowOf = (id: string, code: string, owner: 'product' | 'sellable', variantId: string | null, input: EditorialAssignmentEditingRow['input']): EditorialAssignmentEditingRow => ({ id, target: { code, owner, variantId }, input })
const tick = () => new Promise(resolve => setTimeout(resolve, 50))
const cleanup: (() => void)[] = []
afterEach(() => { cleanup.splice(0).forEach(stop => stop()); document.body.innerHTML = '' })

function render(initial: EditorialAssignmentEditingRow[] = [], extra: Record<string, unknown> = {}) {
  const values = shallowRef(initial)
  let counter = 0
  const wrapper = mount(defineComponent({ setup: () => () => h(Table, { values: values.value, family, definitions, subjects, nextId: () => `new-${++counter}`,
    ...extra, 'onUpdate:values': (next: EditorialAssignmentEditingRow[]) => { values.value = next } }) }), { attachTo: document.body })
  cleanup.push(() => wrapper.unmount())
  return { wrapper, values }
}
const cellOf = (wrapper: ReturnType<typeof render>['wrapper'], rowLabel: string, column: number) =>
  wrapper.findAll('tbody tr').find(row => row.get('th').text() === rowLabel)!.findAll('td')[column]!
const menuItems = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
async function chooseIn(cell: ReturnType<typeof cellOf>, label: string) {
  await cell.get('button[aria-haspopup="menu"]').trigger('click'); await tick()
  menuItems().find(item => (item.textContent ?? '').trim() === label)!.click(); await tick()
}

describe('EditorialAttributeTable structure', () => {
  it('has a caption, a Dato column and the Producto and presentation columns', () => {
    const { wrapper } = render()
    expect(wrapper.get('caption').text()).toContain('Datos de la ficha')
    expect(wrapper.findAll('thead th').map(th => th.text())).toEqual(['Dato', 'Producto', '15 kg', '7.5 kg'])
  })

  it('lists the rows by human label, sorted, one scope="row" header each', () => {
    const { wrapper } = render()
    expect(wrapper.findAll('tbody th[scope="row"]').map(th => th.text())).toEqual(['Especie', 'Material', 'Origen', 'Peso neto'])
    expect(wrapper.text()).not.toContain('animal.target')
  })

  it('has controls only where a binding allows the target, and a quiet dash elsewhere', () => {
    const { wrapper } = render()
    expect(cellOf(wrapper, 'Especie', 0).find('select').exists()).toBe(true)
    expect(cellOf(wrapper, 'Especie', 1).find('select, input').exists()).toBe(false)
    expect(cellOf(wrapper, 'Especie', 1).text()).toContain('—')
    expect(cellOf(wrapper, 'Peso neto', 0).find('input').exists()).toBe(false)
    expect(cellOf(wrapper, 'Peso neto', 1).find('input').exists()).toBe(true)
    expect(cellOf(wrapper, 'Peso neto', 2).find('input').exists()).toBe(true)
  })

  it('names every control after its row and column', () => {
    const { wrapper } = render()
    expect(cellOf(wrapper, 'Peso neto', 2).get('input').attributes('aria-label')).toBe('Peso neto · 7.5 kg')
    expect(cellOf(wrapper, 'Material', 0).get('input').attributes('aria-label')).toBe('Material · Producto')
  })

  it('scrolls horizontally inside its own container, with the attribute column sticky', () => {
    expect(source).toMatch(/\.hf-attr-table\s*\{[^}]*overflow-x:\s*auto/)
    expect(source).toMatch(/th\[scope='row'\][^{]*\{[^}]*position:\s*sticky[^}]*left:\s*0/)
    expect(source).not.toMatch(/\buppercase\b/)
    // On a phone the sticky attribute column is narrow, so the controls keep most of the screen.
    expect(source).toMatch(/@media \(max-width: 767px\)[\s\S]*th\[scope='row'\][^{]*\{[^}]*width:\s*8rem/)
  })

  it('shows only the requested rows', () => {
    const { wrapper } = render([], { visibleCodes: new Set(['material']) })
    expect(wrapper.findAll('tbody th[scope="row"]').map(th => th.text())).toEqual(['Material'])
  })

  it('says how many stored data are not in the table, and keeps them', () => {
    const stray = rowOf('x', 'gone.code', 'product', null, text('1'))
    const { wrapper, values } = render([stray])
    expect(wrapper.get('[data-testid="attribute-orphans"]').text()).toContain('1 dato guardado')
    expect(values.value).toEqual([stray])
  })

  it.each([
    ['a presentation that no longer exists', rowOf('x', 'measure.net_mass', 'sellable', 'gone', text('1'))],
    ['an owner the binding no longer allows', rowOf('x', 'material', 'sellable', 'v1', text('1'))],
    ['a definition outside the family', rowOf('x', 'unbound.definition', 'product', null, text('1'))],
  ])('keeps %s literally in the document, outside the grid', (_name, stray) => {
    const { wrapper, values } = render([stray])
    expect(wrapper.find('[data-testid="attribute-orphans"]').exists()).toBe(true)
    expect(values.value).toEqual([stray])
    expect(values.value[0]).toBe(stray)
  })

  it('has no note when every stored datum is shown', () => {
    expect(render([rowOf('a', 'material', 'product', null, text('x'))]).wrapper.find('[data-testid="attribute-orphans"]').exists()).toBe(false)
  })
})

describe('EditorialAttributeTable editing', () => {
  it('creates the assignment when an empty cell gets a value', async () => {
    const { wrapper, values } = render()
    await cellOf(wrapper, 'Material', 0).get('input').setValue('Nylon')
    expect(values.value).toEqual([{ id: 'new-1', target: { code: 'material', owner: 'product', variantId: null }, input: text('Nylon') }])
  })

  it('targets the presentation of the column it was typed in', async () => {
    const { wrapper, values } = render()
    await cellOf(wrapper, 'Peso neto', 2).get('input').setValue('7.5')
    expect(values.value[0]!.target).toEqual({ code: 'measure.net_mass', owner: 'sellable', variantId: 'v2' })
  })

  it('updates the same assignment in place on the next keystroke', async () => {
    const { wrapper, values } = render([rowOf('a', 'material', 'product', null, text('Ny'))])
    await cellOf(wrapper, 'Material', 0).get('input').setValue('Nylon')
    expect(values.value).toEqual([{ id: 'a', target: { code: 'material', owner: 'product', variantId: null }, input: text('Nylon') }])
  })

  it('creates the assignment when an empty cell gets a state from ⋯', async () => {
    const { wrapper, values } = render()
    await chooseIn(cellOf(wrapper, 'Especie', 0), 'No aplica')
    expect(values.value).toEqual([{ id: 'new-1', target: { code: 'animal.target', owner: 'product', variantId: null }, input: { state: 'not_applicable' } }])
    expect(cellOf(wrapper, 'Especie', 0).find('.hf-status-badge').text()).toBe('No aplica')
  })

  it('Quitar dato removes the assignment and keeps the others', async () => {
    const keep = rowOf('b', 'animal.target', 'product', null, { state: 'unknown' })
    const { wrapper, values } = render([rowOf('a', 'material', 'product', null, text('Nylon')), keep])
    await chooseIn(cellOf(wrapper, 'Material', 0), 'Quitar dato')
    expect(values.value).toEqual([keep])
    expect(values.value[0]).toBe(keep)
  })

  it('emptying a control removes its assignment instead of leaving a blank to save', async () => {
    const { wrapper, values } = render([rowOf('a', 'material', 'product', null, text('Nylon'))])
    await cellOf(wrapper, 'Material', 0).get('input').setValue('')
    expect(values.value).toEqual([])
  })

  it('does not rewrite stored duplicates of the same target', async () => {
    const first = rowOf('a', 'material', 'product', null, text('1'))
    const second = rowOf('b', 'material', 'product', null, text('2'))
    const { wrapper, values } = render([first, second])
    await cellOf(wrapper, 'Material', 0).get('input').setValue('9')
    expect(values.value[1]).toBe(second)
    expect(values.value[0]!.input).toEqual(text('9'))
  })

  it('Enter moves to the same column of the next row instead of submitting', () => {
    const { wrapper } = render()
    const material = cellOf(wrapper, 'Material', 0).get('input').element as HTMLInputElement
    material.focus()
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    material.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(cellOf(wrapper, 'Origen', 0).get('input').element)
  })

  it('stays put on the last row that has a control in that column', () => {
    const { wrapper } = render()
    const origin = cellOf(wrapper, 'Origen', 0).get('input').element as HTMLInputElement
    origin.focus()
    origin.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(origin)
  })
})

describe('EditorialAttributeTable read-only and issues', () => {
  it('a disabled table ignores even the events its cells raise', async () => {
    const { wrapper, values } = render([rowOf('a', 'material', 'product', null, text('Nylon'))], { disabled: true })
    const input = cellOf(wrapper, 'Material', 0).get('input')
    expect(input.attributes('disabled')).toBeDefined()
    ;(input.element as HTMLInputElement).value = 'Cuero'
    input.element.dispatchEvent(new Event('input', { bubbles: true }))
    expect(values.value[0]!.input).toEqual(text('Nylon'))
    expect(cellOf(wrapper, 'Material', 0).find('button[aria-haspopup="menu"]').exists()).toBe(false)
  })

  it('shows values as words with no controls and no menus', () => {
    const { wrapper } = render([rowOf('a', 'animal.target', 'product', null, { state: 'known', payload: { type: 'single', value: 'dog' }, evidence: null })], { readonly: true })
    expect(wrapper.text()).toContain('Perro')
    expect(wrapper.find('input, select, button').exists()).toBe(false)
  })

  it('puts each issue next to its cell with aria-invalid', () => {
    const { wrapper } = render([rowOf('a', 'material', 'product', null, text('Nylon'))], { issues: new Map([['a', 'Este dato no se puede guardar.']]) })
    const cell = cellOf(wrapper, 'Material', 0)
    expect(cell.get('input').attributes('aria-invalid')).toBe('true')
    expect(cell.get('[role="alert"]').text()).toBe('Este dato no se puede guardar.')
    expect(cellOf(wrapper, 'Especie', 0).find('[role="alert"]').exists()).toBe(false)
  })

  it('passes the archived options the stored draft conserved to the cell', () => {
    const { wrapper } = render([rowOf('a', 'animal.target', 'product', null, { state: 'known', payload: { type: 'single', value: 'dog' }, evidence: null })], { conserved: new Map([[editorialTargetKey({ code: 'animal.target', owner: 'product', variantId: null }), ['dog']]]) })
    expect(cellOf(wrapper, 'Especie', 0).get('option[value="dog"]').attributes('disabled')).toBeUndefined()
  })
})
