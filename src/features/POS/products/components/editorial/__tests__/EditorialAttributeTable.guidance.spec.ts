/**
 * T9 (S12): the attribute table guides the user. "No aplica" is offered only where the editorial policy
 * admits it (the same evaluation the save validator runs), "Requerido para publicar" and "Interno" are
 * marked from the policy, and a definition's description is the row's help.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Table from '../EditorialAttributeTable.vue'
import { stubEditorialSelect } from './editorialSelectStub'
import type { EditorialDefinition } from '../../../interfaces/editorial-contract-definition.types'
import type { EditorialDeclaration } from '../../../interfaces/editorial-contract-declaration.types'
import type { EditorialBinding, EditorialFamily } from '../../../interfaces/editorial-contract-vocabulary.types'
import { toEditorialFactsEditingState } from '../../../utils/editorial-contract-facts-editing'
import type { EditorialAssignmentEditingRow } from '../../../utils/editorial-contract-document-editing'

beforeAll(stubEditorialSelect)
const tick = () => new Promise(resolve => setTimeout(resolve, 50))
afterEach(() => { document.body.innerHTML = '' })

const content = (parameter: 'measure.net_mass' | 'measure.net_volume'): EditorialBinding['policy'] => ({ route: 'fact_rule', rule: { family: 'food', ruleId: 'content', parameter } })
const optional = (parameter: 'measure.net_volume'): EditorialBinding['policy'] => ({ route: 'fact_rule', rule: { family: 'food', ruleId: 'optional', parameter } })
const binding = (code: string, owner: 'product' | 'sellable', policy: EditorialBinding['policy'], exposure: EditorialBinding['exposure'] = 'DETAIL'): EditorialBinding => ({
  definitionId: code, definitionCode: code, owner, sortOrder: 0, exposure, searchable: false, publicationCheck: 'when_asserted', policy,
})
const openCase: EditorialBinding['policy'] = { route: 'option_cases', cases: [{ code: 'open', when: [], applicability: 'not_applicable', required: false, allowNA: true, evidenceRequired: true, documentary: 'resolved' }] }
const closedCase: EditorialBinding['policy'] = { route: 'option_cases', cases: [{ code: 'closed', when: [], applicability: 'applicable', required: false, allowNA: false, evidenceRequired: true, documentary: 'resolved' }] }
const def = (code: string, label: string, description?: string | null): EditorialDefinition => ({ id: code, code, label, type: 'text', ...(description === undefined ? {} : { description }) })
const definitions: EditorialDefinition[] = [
  def('measure.net_mass', 'Peso neto'),
  def('measure.net_volume', 'Volumen neto'),
  def('material', 'Material'),
  def('origin', 'Origen'),
  def('text.clinical_analysis', 'Análisis clínico', 'Texto interno del equipo. No se publica.'),
]
const family: EditorialFamily = { id: 'food', code: 'food', label: 'Alimento', bindings: [
  binding('measure.net_mass', 'sellable', content('measure.net_mass')),
  binding('measure.net_volume', 'sellable', optional('measure.net_volume')),
  binding('material', 'product', openCase),
  binding('origin', 'product', closedCase),
  binding('text.clinical_analysis', 'product', { route: 'pending' }, 'INTERNAL'),
] }
const subjects = [{ variantId: 'v1', label: '3 kg' }, { variantId: 'v2', label: '1 kg' }]
const evidence = { sourceRef: 'Etiqueta', verifiedOn: '2026-01-01' }
const declared = (variantId: string, declarations: EditorialDeclaration[]) => {
  let counter = 0
  return toEditorialFactsEditingState([{ variantId, presentation: variantId, declarations, careReview: null }], () => `f${++counter}`)
}
const mass = declared('v1', [{ key: 'contentMagnitude', state: 'known', value: 'mass', evidence, basis: 'Etiqueta' }])
const volumeIsNotRelevant = declared('v1', [{ key: 'optionalNonpertinenceCodes', state: 'known', value: ['measure.net_volume'], evidence, basis: 'No lleva volumen' }])

function render(props: Record<string, unknown> = {}) {
  const wrapper = mount(Table, { attachTo: document.body, props: { values: [], family, definitions, subjects, nextId: () => 'new', facts: [], ...props } })
  return wrapper
}
const cellOf = (wrapper: ReturnType<typeof render>, rowLabel: string, column: number) =>
  wrapper.findAll('tbody tr').find(row => row.get('th').text().startsWith(rowLabel))!.findAll('td')[column]!
const labels = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).map(item => (item.textContent ?? '').trim())
const disabledLabels = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).filter(item => item.hasAttribute('data-disabled') || item.getAttribute('aria-disabled') === 'true').map(item => (item.textContent ?? '').trim())
async function openMenu(cell: ReturnType<typeof cellOf>) {
  document.body.click()
  await cell.get('button[aria-haspopup="menu"]').trigger('click'); await tick()
}
async function closeMenu() { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await tick() }

describe('EditorialAttributeTable — "No aplica" only where the policy admits it', () => {
  it('offers it where an option case admits it, and explains its absence where none does', async () => {
    const wrapper = render()
    await openMenu(cellOf(wrapper, 'Material', 0))
    expect(labels()).toContain('No aplica')
    expect(labels()).not.toContain('No aplica no disponible')
    await closeMenu()
    await openMenu(cellOf(wrapper, 'Origen', 0))
    expect(labels()).not.toContain('No aplica')
    expect(labels()).toContain('No aplica no disponible')
    expect(labels()).toContain('Déjalo vacío si no corresponde.')
    expect(disabledLabels()).toEqual(expect.arrayContaining(['No aplica no disponible']))
  })

  it('follows the declaration of the presentation it is asked about, live', async () => {
    const wrapper = render()
    await openMenu(cellOf(wrapper, 'Volumen neto', 1))
    expect(labels()).toContain('No aplica no disponible')
    await closeMenu()
    await wrapper.setProps({ facts: volumeIsNotRelevant })
    await openMenu(cellOf(wrapper, 'Volumen neto', 1))
    expect(labels()).toContain('No aplica')
    expect(labels()).not.toContain('No aplica no disponible')
    await closeMenu()
    // The other presentation did not declare it.
    await openMenu(cellOf(wrapper, 'Volumen neto', 2))
    expect(labels()).toContain('No aplica no disponible')
    await closeMenu()
    await wrapper.setProps({ facts: [] })
    await openMenu(cellOf(wrapper, 'Volumen neto', 1))
    expect(labels()).toContain('No aplica no disponible')
  })

  it('never admits it for the weight and volume of a food, whatever is declared', async () => {
    const wrapper = render({ facts: mass })
    await openMenu(cellOf(wrapper, 'Peso neto', 1))
    expect(labels()).not.toContain('No aplica')
    expect(labels()).toContain('No aplica no disponible')
  })

  it('keeps the error of a cell that is "No aplica" but is no longer admitted, and offers Quitar dato', async () => {
    const stored: EditorialAssignmentEditingRow = { id: 'na', target: { code: 'origin', owner: 'product', variantId: null }, input: { state: 'not_applicable' } }
    const wrapper = render({ values: [stored], issues: new Map([['na', 'Este dato no admite «No aplica».']]) })
    const cell = cellOf(wrapper, 'Origen', 0)
    expect(cell.get('[role="alert"]').text()).toBe('Este dato no admite «No aplica».')
    await openMenu(cell)
    expect(labels()).toContain('Quitar dato')
    expect(labels()).not.toContain('No aplica')
    expect(labels()).not.toContain('No aplica no disponible')
  })
})

describe('EditorialAttributeTable — "Requerido para publicar"', () => {
  it('marks the cell the policy requires once mass is declared, and no other', () => {
    const wrapper = render({ facts: mass })
    expect(cellOf(wrapper, 'Peso neto', 1).text()).toContain('Requerido para publicar')
    expect(cellOf(wrapper, 'Peso neto', 2).text()).not.toContain('Requerido para publicar')
    expect(cellOf(wrapper, 'Volumen neto', 1).text()).not.toContain('Requerido para publicar')
  })

  it('does not mark anything before the content is declared, and updates live', async () => {
    const wrapper = render()
    expect(wrapper.text()).not.toContain('Requerido para publicar')
    await wrapper.setProps({ facts: mass })
    expect(cellOf(wrapper, 'Peso neto', 1).text()).toContain('Requerido para publicar')
  })

  it('is guidance only: the cell stays editable and nothing is reported as an error', () => {
    const wrapper = render({ facts: mass })
    const cell = cellOf(wrapper, 'Peso neto', 1)
    expect(cell.find('input').exists()).toBe(true)
    expect(cell.find('[role="alert"]').exists()).toBe(false)
  })

  it('leaves the completeness count alone: a cell that cannot be "No aplica" and is empty is still missing', () => {
    const wrapper = render({ facts: mass })
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
  })
})

describe('EditorialAttributeTable — "Interno"', () => {
  it('labels the rows whose binding is internal, with what it means', () => {
    const wrapper = render()
    const internal = wrapper.findAll('tbody th').find(th => th.text().includes('Análisis clínico'))!
    const chip = internal.get('[data-testid="internal-chip"]')
    expect(chip.text()).toBe('Interno')
    expect(chip.attributes('title')).toBe('No se muestra al público')
    const other = wrapper.findAll('tbody th').find(th => th.text().startsWith('Material'))!
    expect(other.find('[data-testid="internal-chip"]').exists()).toBe(false)
  })
})

describe('EditorialAttributeTable — row help from the vocabulary description', () => {
  const helpOf = (wrapper: ReturnType<typeof render>, label: string) =>
    wrapper.findAll('tbody th').find(th => th.text().startsWith(label))!.find('button[data-testid="row-help"]')

  it('opens the description of a definition that has one, on click', async () => {
    const wrapper = render()
    const help = helpOf(wrapper, 'Análisis clínico')
    expect(help.exists()).toBe(true)
    expect(help.attributes('aria-label')).toBe('Qué es Análisis clínico')
    expect(document.querySelector('[data-testid="row-help-content"]')).toBeNull()
    await help.trigger('click'); await tick()
    expect(document.querySelector('[data-testid="row-help-content"]')!.textContent).toContain('Texto interno del equipo. No se publica.')
  })

  it('describes the button by the description for assistive technology', () => {
    const wrapper = render()
    const help = helpOf(wrapper, 'Análisis clínico')
    const target = document.getElementById(help.attributes('aria-describedby')!)
    expect(target?.textContent).toBe('Texto interno del equipo. No se publica.')
  })

  it.each([['absent', undefined], ['null', null], ['blank', '   '], ['empty', '']])('shows no help when the description is %s', (_name, description) => {
    const wrapper = render({ definitions: definitions.map(item => (item.code === 'text.clinical_analysis' ? def(item.code, item.label, description) : item)) })
    expect(wrapper.findAll('[data-testid="row-help"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('Análisis clínico')
  })
})
