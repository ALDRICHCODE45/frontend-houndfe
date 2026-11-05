/**
 * T10 (S13): the care review of a Cuidado presentation lives in a right drawer, flat and sectioned.
 * Requirements and warnings are list rows with a ⋯ menu that edit in a small dialog; their evidence
 * and Fundamento are the card's source. Opened from the «Presentación» card (T13).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import Section from '../EditorialPresentationSection.vue'
import HfCombobox from '@/core/shared/components/form/HfCombobox.vue'
import type { EditorialFactsEditingState } from '../../../utils/editorial-contract-facts-editing'
import { editorialToday, type EditorialCardSource } from '../../../utils/editorial-presentation-card'

const tick = () => new Promise(resolve => setTimeout(resolve, 60))
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })
const evidence = [{ sourceRef: 'Etiqueta del empaque', verifiedOn: editorialToday() }]
const basis = 'Según la etiqueta del empaque.'

function render() {
  const state = shallowRef<EditorialFactsEditingState>([]), sources = shallowRef<ReadonlyMap<string, EditorialCardSource>>(new Map())
  let counter = 0
  const wrapper = mount(defineComponent({ setup: () => () => h(Section, { id: 'p', selected: 'product', facts: state.value, subjects: [{ variantId: null, label: 'Producto' }],
    choices: [{ key: 'presentationKind', label: '', choices: [], toyTypeChoices: [] }], careAllowed: true, nextId: () => `n${++counter}`,
    sources: sources.value, productName: 'Shampoo de avena',
    'onUpdate:facts': (value: EditorialFactsEditingState) => { state.value = value },
    'onUpdate:sources': (value: ReadonlyMap<string, EditorialCardSource>) => { sources.value = value } }) }), { attachTo: document.body })
  return { wrapper, state }
}
const drawer = () => document.querySelector<HTMLElement>('[role="dialog"]')!
const dialogs = () => Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]'))
const top = () => dialogs()[dialogs().length - 1]!
const chipIn = (root: HTMLElement, group: string, text: string) => Array.from(Array.from(root.querySelectorAll<HTMLElement>('[data-testid="care-group"]'))
  .find(item => item.querySelector('legend')?.textContent?.trim() === group)!.querySelectorAll('label')).find(item => item.textContent?.trim() === text)!.querySelector('input')!
const buttonIn = (root: HTMLElement, text: string) => Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(item => item.textContent?.trim() === text)!
async function pickInput(input: HTMLInputElement) { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); await tick() }
async function type(field: HTMLInputElement | HTMLTextAreaElement, value: string) { field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); await tick() }
const care = (state: { value: EditorialFactsEditingState }) => state.value[0]!.careReview

async function openPrepared() {
  const rendered = render()
  rendered.wrapper.get('[data-testid="card-source"]').getComponent(HfCombobox).vm.$emit('update:modelValue', 'label'); await tick()
  await rendered.wrapper.get('[data-testid="card-open-care"]').trigger('click'); await tick()
  await pickInput(chipIn(drawer(), '¿Cómo va la revisión?', 'Lista'))
  return rendered
}

describe('the care review drawer', () => {
  it('opens from the card as a right drawer titled Revisión de cuidado', async () => {
    const { wrapper } = render()
    const entry = wrapper.get('.psection__care')
    expect(entry.text()).toContain('Revisión de cuidado')
    expect(entry.text()).toContain('Sin revisar')
    await wrapper.get('[data-testid="card-open-care"]').trigger('click'); await tick()
    expect(drawer().textContent).toContain('Revisión de cuidado')
    expect(drawer().textContent).toContain('Shampoo de avena')
  })

  it('Lista prepares the review with the card source as evidence and Fundamento', async () => {
    const { state } = await openPrepared()
    expect(care(state)).toEqual({ state: 'prepared', jurisdiction: 'México', intendedUse: '', determination: null, evidence, basis, requirements: [], warnings: [] })
    await type(drawer().querySelector<HTMLInputElement>('[data-testid="care-use"]')!, 'Baño de perros')
    await pickInput(chipIn(drawer(), '¿La etiqueta exige algo?', 'Sí, hay requisitos'))
    expect(care(state)).toMatchObject({ intendedUse: 'Baño de perros', determination: 'identified' })
  })

  it('adds a requirement and a warning in small dialogs, as compact rows', async () => {
    const { state } = await openPrepared()
    await pickInput(chipIn(drawer(), '¿La etiqueta exige algo?', 'Sí, hay requisitos'))
    buttonIn(drawer(), 'Agregar requisito').click(); await tick()
    await type(top().querySelector('textarea')!, 'Leyenda de uso externo')
    await pickInput(chipIn(top(), '¿Cómo se cumple?', 'Cumple'))
    buttonIn(top(), 'Guardar').click(); await tick()
    expect(care(state)).toMatchObject({ requirements: [{ key: 'requisito-1', description: 'Leyenda de uso externo', disposition: 'satisfied', evidence, basis }] })
    const row = drawer().querySelector<HTMLElement>('[data-testid="care-requirement"]')!
    expect(row.textContent).toContain('Leyenda de uso externo')
    expect(row.textContent).toContain('Cumple')

    buttonIn(drawer(), 'Agregar aviso').click(); await tick()
    await type(top().querySelector('textarea')!, 'No ingerir')
    await pickInput(chipIn(top(), '¿Quién lo ve?', 'Mostrar al público'))
    await pickInput(chipIn(top(), 'Viene de', 'Leyenda de uso externo'))
    buttonIn(top(), 'Guardar').click(); await tick()
    expect(care(state)).toMatchObject({ warnings: [{ key: 'aviso-1', text: 'No ingerir', disclosure: 'public_required', requirementKeys: ['requisito-1'], evidence, handlingBasis: basis }] })
    expect(drawer().querySelector('[data-testid="care-warning"]')!.textContent).toContain('Mostrar al público')
    expect(drawer().querySelectorAll('fieldset fieldset')).toHaveLength(0)
  })

  it('removes a requirement only after the modal, never the browser, and drops the warnings that cite it', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const { state } = await openPrepared()
    await pickInput(chipIn(drawer(), '¿La etiqueta exige algo?', 'Sí, hay requisitos'))
    buttonIn(drawer(), 'Agregar requisito').click(); await tick()
    await type(top().querySelector('textarea')!, 'Leyenda')
    await pickInput(chipIn(top(), '¿Cómo se cumple?', 'Por resolver'))
    buttonIn(top(), 'Guardar').click(); await tick()
    buttonIn(drawer(), 'Agregar aviso').click(); await tick()
    await type(top().querySelector('textarea')!, 'Aviso')
    await pickInput(chipIn(top(), '¿Quién lo ve?', 'Solo interna'))
    await pickInput(chipIn(top(), 'Viene de', 'Leyenda'))
    buttonIn(top(), 'Guardar').click(); await tick()
    drawer().querySelector<HTMLButtonElement>('[data-testid="care-requirement"] button[aria-haspopup="menu"]')!.click(); await tick()
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(item => item.textContent?.includes('Quitar'))!.click(); await tick()
    expect(top().textContent).toContain('¿Quitar el requisito?')
    buttonIn(top(), 'Quitar requisito').click(); await tick()
    expect(care(state)).toMatchObject({ requirements: [], warnings: [{ requirementKeys: [] }] })
    expect(confirm).not.toHaveBeenCalled()
  })

  it('leaves a blank review, or picks the same state, without asking', async () => {
    const { state } = await openPrepared()
    await pickInput(chipIn(drawer(), '¿Cómo va la revisión?', 'Lista'))
    await pickInput(chipIn(drawer(), '¿Cómo va la revisión?', 'No se sabe'))
    expect(care(state)).toEqual({ state: 'unknown' })
    expect(document.body.textContent).not.toContain('¿Descartar la revisión de cuidado?')
  })

  it('asks in a modal before discarding a filled review', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const { state } = await openPrepared()
    await type(drawer().querySelector<HTMLInputElement>('[data-testid="care-use"]')!, 'Baño')
    await pickInput(chipIn(drawer(), '¿Cómo va la revisión?', 'Sin revisar'))
    expect(care(state).state).toBe('prepared')
    expect(top().textContent).toContain('¿Descartar la revisión de cuidado?')
    buttonIn(top(), 'Descartar revisión').click(); await tick()
    expect(care(state)).toEqual({ state: 'omitted' })
    expect(confirm).not.toHaveBeenCalled()
  })
})
