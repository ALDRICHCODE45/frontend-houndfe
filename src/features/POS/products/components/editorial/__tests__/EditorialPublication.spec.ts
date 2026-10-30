import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import EditorialPublication from '../EditorialPublication.vue'
import type { EditorialContractDocument } from '../../../interfaces/editorial-contract-document.types'
import type { EditorialValue } from '../../../interfaces/editorial-contract-value.types'
import { state, document, careDocument, careVocabulary } from '../../../__tests__/editorial-contract-fixtures'
let wrapper: ReturnType<typeof mount> | undefined
function render(care = false) {
  wrapper = mount(EditorialPublication, { attachTo: window.document.body, props: {
    state: state(care ? careDocument() : document()), canWrite: true, publishPermission: true, canPublish: true,
    canDiscard: true, hasUnsavedChanges: false, publishIssues: [], busy: false, needsReconciliation: false,
    vocabulary: care ? careVocabulary() : null, context: null,
  } })
  return wrapper
}
const button = (text: string) => wrapper!.findAll('button').find(item => item.text() === text)!
afterEach(() => { wrapper?.unmount(); wrapper = undefined })

const assignment = (code: string, text = code): Extract<EditorialValue, { state: 'known' }> => ({ code, owner: 'product', variantId: null,
  state: 'known', payload: { type: 'text', value: text }, evidence: null })
async function compare(before: EditorialContractDocument | null, after: EditorialContractDocument) {
  if (!wrapper) render()
  await wrapper!.setProps({ state: { ...state(after), published: before ? { revision: 1, document: before } : null } })
  await wrapper!.get('details summary').trigger('click')
  return wrapper!.get('details')
}
const comparisonRow = (label: string) => wrapper!.findAll('.comparison-row').find(row => row.get('dt').text() === label)!

describe('stored content classifications through publication', () => {
  it.each([
    ['Agregado', [], [assignment('target', 'nuevo')], 'Sin atributo', 'nuevo'],
    ['Eliminado', [assignment('target', 'anterior')], [], 'anterior', 'Sin atributo'],
    ['Cambiado', [assignment('target', 'anterior')], [assignment('target', 'nuevo')], 'anterior', 'nuevo'],
    ['Sin cambios', [assignment('target', 'igual')], [assignment('target', 'igual')], 'igual', 'igual'],
  ] as const)('classifies actual assignment content as %s', async (change, oldValues, newValues, oldText, newText) => {
    await compare({ ...document(), values: [...oldValues] }, { ...document(), values: [...newValues] })
    const row = comparisonRow(`target · ${change}`)
    expect(row, `missing target classification ${change}`).toBeDefined()
    expect(row.findAll('dd p').map(item => item.text())).toEqual([
      expect.stringContaining(oldText), expect.stringContaining(newText),
    ])
    expect(wrapper!.emitted('publish')).toBeUndefined()
    expect(wrapper!.emitted('discard')).toBeUndefined()
  })
  it('compares exact envelope content including null, empty strings and ordered media', async () => {
    const before = { ...document(), commercialTitle: null, description: '', familyCode: 'old', mediaRefs: ['a', 'b'] }
    const after = { ...document(), commercialTitle: '', description: null, familyCode: 'new', mediaRefs: ['b', 'a'] }
    await compare(before, after)
    for (const label of ['Título comercial editorial', 'Descripción editorial', 'Familia editorial', 'Referencias de medios']) {
      expect(comparisonRow(`${label} · Cambiado`)).toBeDefined()
    }
    expect(comparisonRow('Título comercial editorial · Cambiado').text()).toContain('Sin valor')
    expect(comparisonRow('Título comercial editorial · Cambiado').text()).toContain('Texto vacío')
    await compare(after, { ...after })
    expect(comparisonRow('Título comercial editorial · Sin cambios')).toBeDefined()
    expect(comparisonRow('Atributos editoriales · Sin cambios')).toBeDefined()
    await compare(null, document())
    expect(comparisonRow('Título comercial editorial · Agregado')).toBeDefined()
  })
  it('pairs duplicate identities by occurrence without changing either complete ordered history', async () => {
    const before = { ...document(), values: [assignment('dup', 'primero'), assignment('dup', 'segundo'), assignment('removed'), assignment('stable')] }
    const after = { ...document(), values: [assignment('dup', 'primero'), assignment('dup', 'modificado'), assignment('added'), assignment('stable')] }
    const snapshot = JSON.stringify({ before, after })
    const details = await compare(before, after)
    const rows = details.findAll('.comparison-row').filter(row => row.get('dt').text().startsWith('dup ·'))
    expect(rows.map(row => row.get('dt').text())).toEqual(['dup · Sin cambios', 'dup · Cambiado'])
    expect(rows[1]!.text()).toContain('segundo')
    expect(rows[1]!.text()).toContain('modificado')
    expect(details.findAll('[data-history-assignment]').map(row => row.text())).toEqual([
      ...['primero', 'segundo', 'removed', 'stable'], ...['primero', 'modificado', 'added', 'stable'],
    ].map(text => expect.stringContaining(text)))
    expect(JSON.stringify({ before, after })).toBe(snapshot)
    after.values.pop()
    await wrapper!.setProps({ state: { ...state(after), published: { revision: 1, document: before } } })
    expect(comparisonRow('stable · Eliminado')).toBeDefined()
  })
  it.each(['Agregado', 'Eliminado'] as const)('classifies an unmatched duplicate occurrence as %s', async change => {
    const one = { ...document(), values: [assignment('dup', 'primero')] }
    const two = { ...document(), values: [assignment('dup', 'primero'), assignment('dup', 'segundo')] }
    await compare(change === 'Agregado' ? one : two, change === 'Agregado' ? two : one)
    expect(comparisonRow('dup · Sin cambios').text()).toContain('primero')
    expect(comparisonRow(`dup · ${change}`).text()).toContain('segundo')
    expect(wrapper!.get('details').findAll('[data-history-assignment]')).toHaveLength(3)
  })
  it.each(['presentation', 'declaration', 'care'] as const)('detects an isolated %s change in facts', async field => {
    const before = careDocument()
    const after = careDocument()
    if (field === 'presentation') after.facts[0]!.presentation = 'Otra presentación'
    if (field === 'declaration') after.facts[0]!.declarations = [{ key: 'presentationKind', state: 'unknown', evidence: null }]
    if (field === 'care') after.facts[0]!.careReview = { state: 'prepared', jurisdiction: 'Jurisdicción', intendedUse: 'Uso',
      determination: 'none_applicable', evidence: [], basis: 'Fundamento', requirements: [], warnings: [] }
    await compare(before, after)
    const row = comparisonRow('Hechos y revisiones de cuidado · Sin presentación · Cambiado')
    expect(row).toBeDefined()
    expect(row.text()).toContain(field === 'presentation' ? 'Otra presentación' : field === 'declaration' ? 'presentationKind' : 'Fundamento')
    expect(wrapper!.get('details').findAll('[data-history-facts]')).toHaveLength(2)
  })
  it('ignores object property insertion order but retains exact assignment content', async () => {
    const oldValue = assignment('target', '')
    const newValue: EditorialValue = { evidence: null, payload: { value: '', type: 'text' }, state: 'known',
      variantId: null, owner: 'product', code: 'target' }
    await compare({ ...document(), values: [oldValue] }, { ...document(), values: [newValue] })
    expect(comparisonRow('target · Sin cambios')).toBeDefined()
  })
  it('compares evidence, assignment states and full facts/care without hiding their histories', async () => {
    const before = careDocument()
    before.values = [assignment('evidence'), { code: 'state', owner: 'product', variantId: null, state: 'unknown', evidence: null }]
    const after = careDocument()
    after.values = [{ ...assignment('evidence'), evidence: { sourceRef: 'fuente nueva', verifiedOn: '2026-01-01' } },
      { code: 'state', owner: 'product', variantId: null, state: 'not_applicable', evidence: null }]
    after.facts[0]!.declarations = [{ key: 'presentationKind', state: 'unknown', evidence: null }]
    after.facts[0]!.careReview = null
    await compare(before, after)
    expect(comparisonRow('evidence · Cambiado').text()).toContain('fuente nueva')
    expect(comparisonRow('state · Cambiado').text()).toContain('not_applicable')
    const facts = comparisonRow('Hechos y revisiones de cuidado · Sin presentación · Cambiado')
    expect(facts.text()).toContain('presentationKind')
    expect(facts.text()).toContain('careReview')
    expect(wrapper!.get('details').findAll('[data-history-facts]')).toHaveLength(2)
    await wrapper!.setProps({ state: { ...state(before), published: { revision: 1, document: structuredClone(before) } } })
    expect(comparisonRow('Hechos y revisiones de cuidado · Sin presentación · Sin cambios')).toBeDefined()
  })
})

describe('publication exact stored review and confirmation', () => {
  it.each(['Publicar borrador…', 'Descartar borrador guardado…'])('moves focus to safe Cancelar and restores %s', async trigger => {
    render(); await button(trigger).trigger('click'); await flushPromises()
    expect(window.document.activeElement?.textContent?.trim()).toBe('Cancelar')
    await button('Cancelar').trigger('click'); await flushPromises()
    expect(window.document.activeElement?.textContent?.trim()).toBe(trigger)
    expect(wrapper!.emitted('publish')).toBeUndefined()
    expect(wrapper!.emitted('discard')).toBeUndefined()
  })
  it('shows every candidate review and exact cycle/revision, requires explicit review-v1 consent, no invented eligibility', async () => {
    render(true)
    expect(wrapper!.text()).toContain('La elegibilidad se valida en el servidor')
    expect(wrapper!.text()).toContain('Presentación exacta')
    expect(wrapper!.text()).toContain('Desconocido')
    expect(wrapper!.text()).toContain('Ciclo 2 · revisión 3')
    expect(wrapper!.text()).not.toMatch(/inactiv[oa]|certificad[oa]/i)
    await button('Publicar borrador…').trigger('click')
    expect(button('Publicar ahora').attributes('disabled')).toBeDefined()
    await wrapper!.get('input[type="checkbox"]').setValue(true)
    expect(button('Publicar ahora').attributes('disabled')).toBeUndefined()
    await button('Publicar ahora').trigger('click')
    expect(wrapper!.emitted('publish')).toEqual([['review-v1']])
  })
  it('new cycle/revision/state resets care consent and open confirmation', async () => {
    render(true); await button('Publicar borrador…').trigger('click')
    await wrapper!.get('input[type="checkbox"]').setValue(true)
    await wrapper!.setProps({ state: { ...state(careDocument(), 4), cycle: 3 } })
    expect(wrapper!.find('[role="group"]').exists()).toBe(false)
    await button('Publicar borrador…').trigger('click')
    expect((wrapper!.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false)
    expect(button('Publicar ahora').attributes('disabled')).toBeDefined()
  })
  it('noncare explicitly emits null and disabled/changed permissions cannot confirm', async () => {
    render(); await button('Publicar borrador…').trigger('click'); await button('Publicar ahora').trigger('click')
    expect(wrapper!.emitted('publish')).toEqual([[null]])
    await button('Publicar borrador…').trigger('click')
    await wrapper!.setProps({ canPublish: false, publishPermission: false })
    expect(wrapper!.find('[role="group"]').exists()).toBe(false)
  })
  it('comparison displays ordered duplicate assignments and facts from GET only', async () => {
    const doc = careDocument()
    doc.values = [
      { code: 'dup', owner: 'product', variantId: null, state: 'unknown', evidence: null },
      { code: 'dup', owner: 'product', variantId: null, state: 'not_applicable', evidence: null },
    ]
    render(true); await wrapper!.setProps({ state: { ...state(doc), published: { revision: 1, document: document() } } })
    const comparison = wrapper!.get('details')
    expect(comparison.text()).toContain('Desconocido')
    expect(comparison.text()).toContain('No aplica')
    expect(comparison.text()).toContain('Presentación exacta')
    expect(comparison.findAll('[data-history-assignment]')).toHaveLength(2)
  })
})
