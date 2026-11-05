/**
 * EditorialWorkspace — T8: Merge Revisar into Contenido. The table of the family's data is the way to
 * edit attributes; save, conflicts and the discard confirmation behave as before.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import EditorialWorkspace from '../EditorialWorkspace.vue'
import { stubEditorialSelect } from './editorialSelectStub'
import type { EditorialContractDocument } from '../../../interfaces/editorial-contract-document.types'
import type { EditorialContractVocabulary } from '../../../interfaces/editorial-contract-vocabulary.types'
import { editorialToday } from '../../../utils/editorial-presentation-card'
import { document as emptyDocument, read, update, state, success, failure, vocabularyEnvelope, deferred } from '../../../__tests__/editorial-contract-fixtures'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({ isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u' }, currentTenant: { id: 't' }, permissionsLoaded: true, permissionCodes: [read, update] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
const source = readFileSync(resolve(__dirname, '../EditorialWorkspace.vue'), 'utf8')

const binding = (code: string, owner: 'product' | 'sellable') => ({ definitionId: code, definitionCode: code, owner, sortOrder: 0, exposure: 'DETAIL' as const, searchable: false, publicationCheck: 'when_asserted' as const, policy: { route: 'pending' as const } })
const vocabulary: EditorialContractVocabulary = {
  semanticsVersion: 'editorial-production-1',
  families: [
    { id: 'food', code: 'food', label: 'Alimento', bindings: [binding('animal.target', 'product'), binding('material', 'product'), binding('measure.net_mass', 'sellable')] },
    { id: 'toy', code: 'toy', label: 'Juguete', bindings: [binding('material', 'product')] },
  ],
  definitions: [
    { id: 'animal.target', code: 'animal.target', label: 'Especie', type: 'single', groups: [], aliases: [], options: [{ code: 'dog', label: 'Perro', archived: false, sortOrder: 0 }, { code: 'old', label: 'Anterior', archived: true, sortOrder: 1 }] },
    { id: 'material', code: 'material', label: 'Material', type: 'text' },
    { id: 'measure.net_mass', code: 'measure.net_mass', label: 'Peso neto', type: 'number', units: [{ code: 'kg', label: 'kg', sortOrder: 0 }], numericPolicy: { status: 'pending' } },
  ],
}
const variants = [{ id: 'v1', name: '15 kg' }, { id: 'v2', name: '7.5 kg' }]
const material = (value: string) => ({ code: 'material', owner: 'product' as const, variantId: null, state: 'known' as const, payload: { type: 'text' as const, value }, evidence: null })
const doc = (patch: Partial<EditorialContractDocument> = {}): EditorialContractDocument => ({ ...emptyDocument(), commercialTitle: 'Croqueta', familyCode: 'food', ...patch })
let wrapper: ReturnType<typeof mount>

function reads(snapshot = state(doc()), context: { variants: { id: string; name: string }[] } = { variants }) {
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope(vocabulary) }
    : url.endsWith('/context') ? { status: 200, data: context } : success(snapshot)))
}
const render = async (props: Record<string, unknown> = {}) => {
  wrapper = mount(EditorialWorkspace, { attachTo: document.body, props: { productId: 'p1', embedded: true, ...props } })
  await flushPromises()
}
const tick = () => new Promise(resolve => setTimeout(resolve, 60))
const row = (label: string) => wrapper.findAll('tbody tr').find(item => item.get('th').text() === label)!
const cell = (label: string, column: number) => row(label).findAll('td')[column]!
const button = (text: string) => wrapper.findAll('button').find(item => item.text().includes(text))!
const menuItems = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
async function pick(trigger: { trigger(event: string): Promise<void> }, label: string) {
  await trigger.trigger('click'); await tick()
  menuItems().find(item => (item.textContent ?? '').trim() === label)!.click(); await tick()
}

beforeAll(stubEditorialSelect)
beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(auth, { permissionCodes: [read, update], isAuthenticated: true, authPhase: 'authenticated', permissionsLoaded: true })
  reads()
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })

describe('EditorialWorkspace — the table', () => {
  it('lists the family data by human label, with Producto and one column per presentation', async () => {
    await render()
    expect(wrapper.findAll('thead th').map(th => th.text())).toEqual(['Dato', 'Producto', '15 kg', '7.5 kg'])
    expect(wrapper.findAll('tbody th[scope="row"]').map(th => th.text())).toEqual(['Especie', 'Material', 'Peso neto'])
    expect(wrapper.text()).not.toContain('animal.target')
  })

  it('offers a control only where a binding allows the target', async () => {
    await render()
    expect(cell('Especie', 0).find('select').exists()).toBe(true)
    expect(cell('Especie', 1).find('select, input').exists()).toBe(false)
    expect(cell('Peso neto', 1).find('input').exists()).toBe(true)
    expect(cell('Peso neto', 0).find('input').exists()).toBe(false)
  })

  it('shows one presentation column when the product has no variants, never "Sin presentación"', async () => {
    reads(state(doc()), { variants: [] })
    await render()
    expect(wrapper.findAll('thead th').map(th => th.text())).toEqual(['Dato', 'Producto', 'Presentación'])
    expect(wrapper.text()).not.toContain('Sin presentación')
  })

  it('has no table, but a prompt, while there is no family', async () => {
    reads(state(doc({ familyCode: null })))
    await render()
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.text()).toContain('Elige una familia')
  })

  it('editing a cell creates the assignment, and Guardar sends the same document shape', async () => {
    http.put.mockResolvedValue(success(state(doc({ values: [material('Nylon')] }), 4)))
    await render()
    await cell('Material', 0).get('input').setValue('Nylon')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(http.put.mock.calls[0]![1]).toEqual({ expectedCycle: 2, expectedRevision: 3, document: doc({ values: [material('Nylon')] }) })
  })

  it('editing again updates the same assignment instead of adding another', async () => {
    http.put.mockResolvedValue(success())
    reads(state(doc({ values: [material('Ny')] })))
    await render()
    await cell('Material', 0).get('input').setValue('Nylon')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(http.put.mock.calls[0]![1].document.values).toEqual([material('Nylon')])
  })

  it('the ⋯ menu sets a state, which is saved as that state', async () => {
    http.put.mockResolvedValue(success())
    await render()
    await pick(cell('Especie', 0).get('button[aria-haspopup="menu"]'), 'Desconocido')
    expect(cell('Especie', 0).get('.hf-status-badge').text()).toBe('Desconocido')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(http.put.mock.calls[0]![1].document.values).toEqual([{ code: 'animal.target', owner: 'product', variantId: null, state: 'unknown', evidence: null }])
  })

  it('offers "No aplica" only where the policy admits it, with no stand-in item otherwise', async () => {
    await render()
    await wrapper.get('button[aria-label="Acciones de Especie · Producto"]').trigger('click'); await tick()
    const labels = menuItems().map(item => (item.textContent ?? '').trim())
    expect(labels).toContain('Desconocido')
    expect(labels.filter(label => label.startsWith('No aplica') || label.startsWith('Déjalo'))).toEqual([])
  })

  it('a stored "No aplica" the policy does not admit is refused on save, next to its cell, and can be removed', async () => {
    reads(state(doc({ values: [{ code: 'animal.target', owner: 'product', variantId: null, state: 'not_applicable', evidence: null }] })))
    await render()
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(http.put).not.toHaveBeenCalled()
    expect(cell('Especie', 0).get('[role="alert"]').text()).toBe('Este dato no admite «No aplica».')
    await pick(cell('Especie', 0).get('button[aria-haspopup="menu"]'), 'Quitar dato')
    expect(cell('Especie', 0).get('.hf-status-badge').text()).toBe('Sin dato')
  })

  it('marks "Requerido para publicar" from the saved declarations, without blocking the save', async () => {
    const policy = { route: 'fact_rule' as const, rule: { family: 'food' as const, ruleId: 'content' as const, parameter: 'measure.net_mass' as const } }
    const guided: EditorialContractVocabulary = { ...vocabulary, families: [{ ...vocabulary.families[0]!,
      bindings: vocabulary.families[0]!.bindings.map(item => (item.definitionCode === 'measure.net_mass' ? { ...item, policy } : item)) }, vocabulary.families[1]!] }
    const facts = [{ variantId: 'v1', presentation: '15 kg', careReview: null,
      declarations: [{ key: 'contentMagnitude' as const, state: 'known' as const, value: 'mass' as const, evidence: { sourceRef: 'Etiqueta', verifiedOn: '2026-01-01' }, basis: 'Etiqueta' }] }]
    http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope(guided) }
      : url.endsWith('/context') ? { status: 200, data: { variants } } : success(state(doc({ facts })))))
    await render()
    expect(cell('Peso neto', 1).text()).toContain('Requerido para publicar')
    expect(cell('Peso neto', 2).text()).not.toContain('Requerido para publicar')
    expect(wrapper.find('[data-testid="attribute-table"] [role="alert"]').exists()).toBe(false)
  })

  it('Quitar dato removes the assignment from the saved document', async () => {
    http.put.mockResolvedValue(success())
    reads(state(doc({ values: [material('Nylon')] })))
    await render()
    await pick(cell('Material', 0).get('button[aria-haspopup="menu"]'), 'Quitar dato')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(http.put.mock.calls[0]![1].document.values).toEqual([])
  })

  it('shows a save problem next to its cell with aria-invalid', async () => {
    reads(state(doc({ values: [{ code: 'measure.net_mass', owner: 'sellable', variantId: 'v1', state: 'known', payload: { type: 'number', value: 5, unit: 'kg' }, evidence: null }] })))
    await render()
    await cell('Peso neto', 1).get('input').setValue('5x')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(http.put).not.toHaveBeenCalled()
    expect(cell('Peso neto', 1).get('input').attributes('aria-invalid')).toBe('true')
    expect(cell('Peso neto', 1).get('[role="alert"]').text()).toBe('Escribe solo números')
    expect(wrapper.get('[data-testid="editorial-footer"]').text()).toContain('No se guardó')
  })

  it('keeps stored data that the table cannot show, and says so', async () => {
    reads(state(doc({ values: [material('Nylon'), { code: 'gone.code', owner: 'product', variantId: null, state: 'unknown', evidence: null }] })))
    http.put.mockResolvedValue(success())
    await render()
    expect(wrapper.get('[data-testid="attribute-orphans"]').text()).toContain('1 dato guardado')
  })
})

describe('EditorialWorkspace — completeness and Solo faltantes', () => {
  it('counts the data that have an answer over all of them', async () => {
    reads(state(doc({ values: [material('Nylon'), { code: 'animal.target', owner: 'product', variantId: null, state: 'unknown', evidence: null }] })))
    await render()
    expect(wrapper.get('.editorial-completeness').text()).toBe('2 de 4 datos')
  })

  it('the count follows an edit as it happens', async () => {
    await render()
    expect(wrapper.get('.editorial-completeness').text()).toBe('0 de 4 datos')
    await cell('Material', 0).get('input').setValue('Nylon')
    expect(wrapper.get('.editorial-completeness').text()).toBe('1 de 4 datos')
  })

  it('Solo faltantes shows only the rows with something missing, and keeps a row while it is filled', async () => {
    reads(state(doc({ values: [material('Nylon')] })))
    await render()
    expect(wrapper.get('[data-testid="only-missing"]').text()).toContain('2')
    await wrapper.get('[data-testid="only-missing"]').trigger('click')
    expect(wrapper.get('[data-testid="only-missing"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('tbody th[scope="row"]').map(th => th.text())).toEqual(['Especie', 'Peso neto'])
    await cell('Especie', 0).get('select').setValue('dog')
    expect(wrapper.findAll('tbody th[scope="row"]').map(th => th.text())).toEqual(['Especie', 'Peso neto'])
    await wrapper.get('[data-testid="only-missing"]').trigger('click')
    expect(wrapper.findAll('tbody th[scope="row"]')).toHaveLength(3)
  })

  it('says nothing is missing when every datum has an answer', async () => {
    const answered = (code: string, owner: 'product' | 'sellable', variantId: string | null) => ({ code, owner, variantId, state: 'unknown' as const, evidence: null })
    reads(state(doc({ values: [answered('animal.target', 'product', null), answered('material', 'product', null), answered('measure.net_mass', 'sellable', 'v1'), answered('measure.net_mass', 'sellable', 'v2')] })))
    await render()
    await wrapper.get('[data-testid="only-missing"]').trigger('click')
    expect(wrapper.get('.hf-empty-state').attributes('data-kind')).toBe('no-match')
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('No falta ningún dato')
    await wrapper.get('[data-testid="clear-missing"]').trigger('click')
    expect(wrapper.findAll('tbody th[scope="row"]')).toHaveLength(3)
  })
})

describe('EditorialWorkspace — the four states', () => {
  it('empty: no draft is one empty state with the single action to start', async () => {
    reads({ cycle: null, draft: null, published: null })
    await render()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Aún no hay ficha para el catálogo')
    expect(wrapper.get('[data-testid="initialize"]').text()).toContain('Empezar ficha')
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.find('[data-testid="editorial-footer"]').exists()).toBe(false)
  })

  it('empty with a published version: the one action starts from it', async () => {
    reads({ cycle: 2, draft: null, published: { revision: 1, document: doc() } })
    await render()
    expect(wrapper.get('[data-testid="initialize"]').text()).toContain('Empezar desde lo publicado')
    expect(wrapper.get('.hf-empty-state__description').text()).toContain('versión publicada')
  })

  it('loading: a skeleton shaped like the toolbar and the table, with a spoken status', async () => {
    const pending = deferred<unknown>()
    http.get.mockReturnValue(pending.promise)
    await render()
    const skeleton = wrapper.get('[data-testid="editorial-skeleton"]')
    expect(skeleton.attributes('aria-busy')).toBe('true')
    expect(skeleton.text()).toContain('Cargando contenido editorial')
    expect(skeleton.findAll('[data-skeleton="section"]')).toHaveLength(2)
    expect(skeleton.findAll('.editorial-skeleton-row').length).toBeGreaterThanOrEqual(5)
    expect(skeleton.findAll('.hf-skeleton').length).toBeGreaterThan(5)
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('data: the toolbar, the document fields, the table and the footer', async () => {
    await render()
    expect(wrapper.find('[role="toolbar"]').exists()).toBe(true)
    expect(wrapper.get('#editorial-title').element).toHaveProperty('value', 'Croqueta')
    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.find('[data-testid="editorial-footer"]').exists()).toBe(true)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('error: a failed read is the shared error with Reintentar, and Reintentar loads it', async () => {
    http.get.mockRejectedValue(failure(500, 'INTERNAL_ERROR'))
    await render()
    const error = wrapper.get('.hf-empty-state[data-kind="error"]')
    expect(error.attributes('role')).toBe('alert')
    expect(error.get('[data-testid="empty-state-action"]').text()).toContain('Reintentar')
    expect(wrapper.find('table').exists()).toBe(false)
    reads()
    await error.get('[data-testid="empty-state-action"]').trigger('click'); await flushPromises()
    expect(wrapper.find('table').exists()).toBe(true)
  })
})

describe('EditorialWorkspace — the footer', () => {
  it('shows the unsaved state as soon as something changes, with Guardar as its only primary', async () => {
    await render()
    expect(wrapper.get('[data-testid="editorial-footer"] .editorial-save-state').text()).toBe('Guardado')
    await cell('Material', 0).get('input').setValue('Nylon')
    expect(wrapper.get('[data-testid="editorial-footer"] .editorial-save-state').text()).toBe('Cambios sin guardar')
    expect(wrapper.findAll('.hf-primary-control').map(item => item.text())).toEqual(['Guardar'])
  })

  it('says publication is coming, as a disabled button, and never offers to publish', async () => {
    auth.permissionCodes = ['manage:all']
    await render()
    const soon = button('Publicación próximamente')
    expect(soon.attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('button').some(item => /^Publicar/.test(item.text()))).toBe(false)
    expect(http.post).not.toHaveBeenCalled()
    expect(source).toMatch(/Publicación próximamente/)
  })

  it('keeps Descartar borrador… in the ⋯ menu and asks before discarding the saved draft', async () => {
    http.post.mockResolvedValue(success({ cycle: 2, draft: null, published: null }))
    await render()
    await wrapper.get('[data-testid="editorial-footer"] button[aria-haspopup="menu"]').trigger('click'); await tick()
    expect(menuItems().map(item => (item.textContent ?? '').trim())).toEqual(['Descartar borrador…'])
    menuItems()[0]!.click(); await tick()
    expect(document.body.textContent).toContain('¿Descartar el borrador?')
    expect(document.body.textContent).toContain('Lo publicado no cambia.')
    expect(http.post).not.toHaveBeenCalled()
    Array.from(document.querySelectorAll('button')).find(item => item.textContent?.trim() === 'Cancelar')!.click(); await tick()
    expect(http.post).not.toHaveBeenCalled()
    await pick(wrapper.get('[data-testid="editorial-footer"] button[aria-haspopup="menu"]'), 'Descartar borrador…')
    Array.from(document.querySelectorAll('button')).find(item => item.textContent?.trim() === 'Descartar borrador')!.click(); await flushPromises()
    expect(http.post.mock.calls[0]![0]).toContain('/draft/discard')
  })

  it('goes back to the empty state once the draft is discarded', async () => {
    http.post.mockResolvedValue(success({ cycle: 3, draft: null, published: null }))
    await render()
    reads({ cycle: 3, draft: null, published: null })
    await pick(wrapper.get('[data-testid="editorial-footer"] button[aria-haspopup="menu"]'), 'Descartar borrador…')
    Array.from(document.querySelectorAll('button')).find(item => item.textContent?.trim() === 'Descartar borrador')!.click(); await flushPromises()
    expect(wrapper.find('[data-testid="initialize"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Aún no hay ficha para el catálogo')
  })

  it('offers to undo unsaved changes while there are some, and asks before replacing them', async () => {
    await render()
    await cell('Material', 0).get('input').setValue('Nylon')
    await wrapper.get('[data-testid="editorial-footer"] button[aria-haspopup="menu"]').trigger('click'); await tick()
    expect(menuItems().map(item => (item.textContent ?? '').trim())).toEqual(['Deshacer cambios sin guardar…', 'Descartar borrador…'])
    menuItems()[0]!.click(); await tick()
    expect(wrapper.find('[aria-labelledby="discard-title"]').exists()).toBe(true)
    await wrapper.get('[data-testid="confirm-discard"]').trigger('click'); await flushPromises()
    expect(cell('Material', 0).get('input').element).toHaveProperty('value', '')
  })

  it('is sticky, and on mobile keeps Guardar beside the ⋯ menu without the disabled publication button', () => {
    expect(source).toMatch(/\.editorial-footer\s*\{[^}]*position:\s*sticky[^}]*bottom:\s*0/)
    expect(source).toMatch(/@media \(max-width: 767px\)[\s\S]*\.editorial-footer__soon\s*\{[^}]*display:\s*none/)
    expect(source).toMatch(/@media \(max-width: 767px\)[\s\S]*\.editorial-footer__actions\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\)/)
    expect(source).not.toMatch(/grid-column:\s*1 \/ -1/)
  })

  it('on mobile keeps the band to one row (Historial as an icon) and the toolbar to two', () => {
    expect(source).toMatch(/@media \(max-width: 767px\)[\s\S]*\.editorial-history-label\s*\{[^}]*(?:clip|sr-only|position:\s*absolute)/)
    expect(source).toMatch(/\.editorial-completeness\s*\{[^}]*white-space:\s*nowrap/)
    expect(source).toMatch(/@media \(max-width: 767px\)[\s\S]*\.editorial-toolbar :deep\(\.family-field\)\s*\{[^}]*flex:\s*1 1 100%/)
  })

  it('has a header band with the state of the sheet and Historial, apart from the filter toolbar', async () => {
    await render()
    const band = wrapper.get('[data-testid="editorial-band"]')
    expect(band.text()).toContain('Ficha para el catálogo')
    expect(band.text()).toContain('Borrador')
    expect(band.find('[data-testid="open-history"]').exists()).toBe(true)
    const toolbar = wrapper.get('[role="toolbar"]')
    expect(toolbar.find('[data-testid="only-missing"]').exists()).toBe(true)
    expect(toolbar.find('[data-testid="open-history"]').exists()).toBe(false)
    expect(toolbar.text()).toContain('de 4 datos')
  })
})

describe('EditorialWorkspace — after a save', () => {
  it('shows Guardado with the time and refreshes the saved draft with one GET', async () => {
    http.put.mockResolvedValue(success(state(doc({ values: [material('Nylon')] }), 99)))
    await render()
    await cell('Material', 0).get('input').setValue('Nylon')
    reads(state(doc({ values: [material('Nylon')] }), 4))
    await wrapper.get('form').trigger('submit'); await flushPromises()
    const status = wrapper.get('[data-testid="editorial-footer"] .editorial-save-state')
    expect(status.text()).toMatch(/^Guardado · \d{1,2} [a-záéíóú]+\.?(?: \d{4})?, \d{2}:\d{2}$/)
    expect(status.text()).not.toMatch(/sin guardar|No se/i)
    expect(http.get).toHaveBeenCalledTimes(6)
    expect(cell('Material', 0).get('input').element).toHaveProperty('value', 'Nylon')
    expect(wrapper.find('[data-testid="retry-view"]').exists()).toBe(false)
    expect(button('Guardar').attributes('disabled')).toBeUndefined()
  })

  it('a failed refresh still says Guardado, adds a quiet retry and never an error that suggests the save failed', async () => {
    http.put.mockResolvedValue(success(state(doc({ values: [material('Nylon')] }), 99)))
    await render()
    await cell('Material', 0).get('input').setValue('Nylon')
    http.get.mockRejectedValue(failure(500, 'INTERNAL_ERROR'))
    await wrapper.get('form').trigger('submit'); await flushPromises()
    const status = wrapper.get('[data-testid="editorial-footer"] .editorial-save-state')
    expect(status.text()).toMatch(/^Guardado · .+ · No se pudo actualizar la vista · Reintentar$/)
    expect(wrapper.find('.hf-empty-state[data-kind="error"]').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(status.text()).not.toMatch(/No se guardó/)
    expect(wrapper.find('table').exists()).toBe(true)
    expect(cell('Material', 0).get('input').element).toHaveProperty('value', 'Nylon')
    expect(http.put).toHaveBeenCalledTimes(1)
  })

  it('Reintentar loads the saved draft and the stale note goes away', async () => {
    http.put.mockResolvedValue(success())
    await render()
    await cell('Material', 0).get('input').setValue('Nylon')
    http.get.mockRejectedValue(failure(500, 'INTERNAL_ERROR'))
    await wrapper.get('form').trigger('submit'); await flushPromises()
    reads(state(doc({ values: [material('Nylon')] }), 4))
    await wrapper.get('[data-testid="retry-view"]').trigger('click'); await flushPromises()
    expect(wrapper.find('[data-testid="retry-view"]').exists()).toBe(false)
    expect(wrapper.get('.editorial-save-state').text()).toMatch(/^Guardado/)
  })
})

describe('EditorialWorkspace — conflicts and reconciliation', () => {
  it('a conflict says so in plain words above the table and keeps the local edits', async () => {
    http.put.mockRejectedValue(failure(409, 'CONFLICT'))
    await render()
    await cell('Material', 0).get('input').setValue('LOCAL')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    const alert = wrapper.get('[data-testid="reconciliation"]')
    expect(alert.text()).toContain('Alguien más guardó cambios. Carga la versión más reciente para continuar.')
    expect(alert.text()).not.toMatch(/acuse|ciclo|revisión/i)
    expect(cell('Material', 0).get('input').element).toHaveProperty('value', 'LOCAL')
    expect(http.put).toHaveBeenCalledTimes(1)
  })

  it('Cargar la versión más reciente asks first, and cancelling keeps the edits', async () => {
    http.put.mockRejectedValue(failure(409, 'CONFLICT'))
    await render()
    await cell('Material', 0).get('input').setValue('LOCAL')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    await wrapper.get('[data-testid="refresh-discard"]').trigger('click')
    expect(wrapper.get('[aria-labelledby="discard-title"]').text()).toContain('¿Reemplazar tus cambios sin guardar')
    await wrapper.get('[data-testid="cancel-discard"]').trigger('click')
    expect(cell('Material', 0).get('input').element).toHaveProperty('value', 'LOCAL')
    expect(http.get).toHaveBeenCalledTimes(3)
    reads(state(doc({ values: [material('REMOTE')] }), 5))
    await wrapper.get('[data-testid="refresh-discard"]').trigger('click')
    await wrapper.get('[data-testid="confirm-discard"]').trigger('click'); await flushPromises()
    expect(cell('Material', 0).get('input').element).toHaveProperty('value', 'REMOTE')
    expect(wrapper.find('[data-testid="reconciliation"]').exists()).toBe(false)
  })

  it('Conservar mis cambios y actualizar re-reads and keeps the local edits', async () => {
    http.put.mockRejectedValue(failure(409, 'CONFLICT'))
    await render()
    await cell('Material', 0).get('input').setValue('LOCAL')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    reads(state(doc({ values: [material('REMOTE')] }), 5))
    await wrapper.get('[data-testid="refresh-retain"]').trigger('click'); await flushPromises()
    expect(cell('Material', 0).get('input').element).toHaveProperty('value', 'LOCAL')
    expect(wrapper.find('[data-testid="reconciliation"]').exists()).toBe(false)
  })

  it('an ambiguous result says it could not confirm, and retries the same request', async () => {
    http.put.mockRejectedValueOnce(new Error('network')).mockResolvedValue(success())
    await render()
    await cell('Material', 0).get('input').setValue('LOCAL')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.get('[data-testid="reconciliation"]').text()).toContain('No pudimos confirmar si se guardó')
    await button('Reintentar guardado').trigger('click'); await flushPromises()
    expect(http.put).toHaveBeenCalledTimes(2)
    expect(http.put.mock.calls[1]![1]).toBe(http.put.mock.calls[0]![1])
    expect(http.put.mock.calls[1]![2].headers).toEqual(http.put.mock.calls[0]![2].headers)
  })
})

describe('EditorialWorkspace — the family', () => {
  const modalButton = (label: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(item => item.textContent?.trim() === label)!

  it('asks in a modal before changing the family, and cancelling keeps the data of the table', async () => {
    reads(state(doc({ values: [material('Nylon')] })))
    const confirm = vi.spyOn(window, 'confirm')
    await render()
    await wrapper.get('#editorial-family').setValue('1'); await tick()
    expect(confirm).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('¿Cambiar la familia?')
    expect(document.body.textContent).toContain('Se borran los datos de la familia actual')
    expect(cell('Material', 0).get('input').element).toHaveProperty('value', 'Nylon')
    modalButton('Cancelar').click(); await tick()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(cell('Material', 0).get('input').element).toHaveProperty('value', 'Nylon')
    expect(wrapper.get('#editorial-family').element).toHaveProperty('value', '0')
  })

  it('changes the family and clears the data of the table once the modal is confirmed', async () => {
    reads(state(doc({ values: [material('Nylon')] })))
    await render()
    await wrapper.get('#editorial-family').setValue('1'); await tick()
    modalButton('Cambiar familia').click(); await tick()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(wrapper.findAll('tbody th[scope="row"]').map(th => th.text())).toEqual(['Material'])
    expect(cell('Material', 0).get('input').element).toHaveProperty('value', '')
  })
})

describe('EditorialWorkspace — the history drawer', () => {
  it('opens from Historial with what is saved and only what changed against the published version', async () => {
    reads({ cycle: 2, draft: { revision: 3, basePublishedRevision: 1, document: doc({ commercialTitle: 'Nuevo título', values: [material('Nylon')] }) },
      published: { revision: 1, document: doc({ commercialTitle: 'Título publicado', values: [material('Nylon')] }) } })
    await render()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    await wrapper.get('[data-testid="open-history"]').trigger('click'); await tick()
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog.textContent).toContain('Historial')
    expect(dialog.textContent).toContain('Versión publicada')
    const rows = Array.from(dialog.querySelectorAll('[data-testid="history-diff"] > li'))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.textContent).toContain('Título comercial')
    expect(rows[0]!.querySelector('[data-column="before"]')!.textContent).toContain('Título publicado')
    expect(rows[0]!.querySelector('[data-column="after"]')!.textContent).toContain('Nuevo título')
    expect(dialog.textContent).not.toMatch(/ciclo|revisión|acuse/i)
  })

  it('says when the draft was saved after saving it in this session', async () => {
    http.put.mockResolvedValue(success())
    await render()
    await cell('Material', 0).get('input').setValue('Nylon')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    await wrapper.get('[data-testid="open-history"]').trigger('click'); await tick()
    expect(document.querySelector('[role="dialog"]')!.textContent).toMatch(/Guardado el \d{1,2} [a-záéíóú]+\.?(?: \d{4})?, \d{2}:\d{2}/)
  })

  it('keeps the page free of history text: no cycle, revision or acknowledgement anywhere in the view', async () => {
    http.put.mockResolvedValue(success(state(doc(), 99)))
    await render()
    await cell('Material', 0).get('input').setValue('Nylon')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.text()).not.toMatch(/acuse|ciclo|revisión|Consultar y/i)
  })
})

describe('EditorialWorkspace — read-only users', () => {
  it('see the table as words, with no controls, footer or draft actions', async () => {
    auth.permissionCodes = [read]
    reads(state(doc({ values: [material('Nylon'), { code: 'animal.target', owner: 'product', variantId: null, state: 'known', payload: { type: 'single', value: 'dog' }, evidence: null }] })))
    await render()
    expect(wrapper.text()).toContain('Solo consulta')
    expect(wrapper.get('table').text()).toContain('Nylon')
    expect(wrapper.get('table').text()).toContain('Perro')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.find('input, textarea, select').exists()).toBe(false)
    expect(wrapper.find('[data-testid="editorial-footer"]').exists()).toBe(false)
    expect(wrapper.find('table button').exists()).toBe(false)
    expect(wrapper.find('[data-testid="open-history"]').exists()).toBe(true)
  })

  it('see the published version when there is no draft, and no action to start one', async () => {
    auth.permissionCodes = [read]
    reads({ cycle: 2, draft: null, published: { revision: 1, document: doc({ commercialTitle: 'Publicado', values: [material('Nylon')] }) } })
    await render()
    expect(wrapper.get('[data-field="title"]').text()).toBe('Publicado')
    expect(wrapper.find('[data-testid="initialize"]').exists()).toBe(false)
  })

  it('can still look again with Actualizar', async () => {
    auth.permissionCodes = [read]
    await render()
    reads(state(doc({ commercialTitle: 'Nuevo' }), 4))
    await wrapper.get('[data-testid="refresh-retain"]').trigger('click'); await flushPromises()
    expect(wrapper.get('[data-field="title"]').text()).toBe('Nuevo')
  })
})

describe('EditorialWorkspace — copy', () => {
  it('has no uppercase labels, tracking or developer wording in the source', () => {
    expect(source).not.toMatch(/\buppercase\b|tracking-/)
    expect(source).not.toMatch(/Acuse histórico|Consultar y cargar borrador|Ciclo |Revisión \{\{/)
  })
})

describe('EditorialWorkspace — the presentation cards', () => {
  const simple = { variants: [] }
  const today = editorialToday()
  const optional = { route: 'fact_rule' as const, rule: { family: 'food' as const, ruleId: 'optional' as const, parameter: 'measure.net_mass' as const } }
  const guided: EditorialContractVocabulary = { ...vocabulary, families: [{ ...vocabulary.families[0]!,
    bindings: vocabulary.families[0]!.bindings.map(item => (item.definitionCode === 'measure.net_mass' ? { ...item, policy: optional } : item)) }, vocabulary.families[1]!] }
  const readGuided = (snapshot = state(doc()), context: { variants: { id: string; name: string }[] } = { variants }) =>
    http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope(guided) }
      : url.endsWith('/context') ? { status: 200, data: context } : success(snapshot)))
  const card = (title: string) => wrapper.findAll('[data-testid="presentation-card"]').find(item => item.get('h4').text() === title)!
  const chipOf = (title: string, text: string) => card(title).findAll('label').find(item => item.text() === text)!.get('input')

  it('sit above the table, and the folded section and its badge are gone', async () => {
    await render()
    const html = wrapper.html()
    expect(html.indexOf('data-testid="presentation-cards"')).toBeGreaterThan(-1)
    expect(html.indexOf('data-testid="presentation-cards"')).toBeLessThan(html.indexOf('data-testid="attribute-table"'))
    expect(wrapper.find('[data-testid="complete-to-publish"]').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/Completar para publicar|Opcional por ahora|Agregar una presentación/)
    expect(wrapper.findAll('[data-testid="presentation-card"] h4').map(item => item.text())).toEqual(['15 kg', '7.5 kg'])
  })

  it('an answer and its source save as a facts row with the evidence and the generated Fundamento', async () => {
    http.put.mockResolvedValue(success())
    await render()
    await chipOf('15 kg', 'Peso').setValue(true)
    await chipOf('15 kg', 'Etiqueta del empaque').setValue(true)
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(http.put.mock.calls[0]![1].document.facts).toEqual([{ variantId: 'v1', presentation: '15 kg', careReview: null, declarations: [
      { key: 'contentMagnitude', state: 'known', value: 'mass', evidence: { sourceRef: 'Etiqueta del empaque', verifiedOn: today }, basis: 'Según la etiqueta del empaque.' }] }])
  })

  it('an answer with no source is not saved and says so on the source row', async () => {
    await render()
    await chipOf('15 kg', 'Peso').setValue(true)
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(http.put).not.toHaveBeenCalled()
    expect(card('15 kg').get('[data-testid="card-source-error"]').text()).toBe('Indica de dónde sale la información')
    expect(wrapper.text()).not.toContain('Revisa la captura de hechos')
  })

  it('"No aplica" on an optional datum declares its code for that presentation, and removing it takes the code out', async () => {
    http.put.mockResolvedValue(success())
    readGuided()
    await render()
    await chipOf('15 kg', 'Etiqueta del empaque').setValue(true)
    await pick(cell('Peso neto', 1).get('button[aria-haspopup="menu"]'), 'No aplica')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    const sent = http.put.mock.calls[0]![1].document
    expect(sent.values).toEqual([{ code: 'measure.net_mass', owner: 'sellable', variantId: 'v1', state: 'not_applicable', evidence: null }])
    expect(sent.facts).toEqual([{ variantId: 'v1', presentation: '15 kg', careReview: null, declarations: [
      { key: 'optionalNonpertinenceCodes', state: 'known', value: ['measure.net_mass'], evidence: { sourceRef: 'Etiqueta del empaque', verifiedOn: today }, basis: 'Según la etiqueta del empaque.' }] }])
    expect(card('15 kg').text()).not.toContain('optionalNonpertinenceCodes')

    await pick(cell('Peso neto', 1).get('button[aria-haspopup="menu"]'), 'Quitar dato')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(http.put.mock.calls[1]![1].document.facts).toEqual([{ variantId: 'v1', presentation: '15 kg', careReview: null, declarations: [] }])
  })

  it('a saved "Producto" card reads back after a reload as one collapsed line', async () => {
    const saved = doc({ facts: [{ variantId: null, presentation: 'Croqueta', careReview: null, declarations: [
      { key: 'contentMagnitude', state: 'known', value: 'mass', evidence: { sourceRef: 'Ficha del fabricante', verifiedOn: '2026-11-04' }, basis: 'Según la ficha del fabricante.' }] }] })
    reads(state(saved, 4), simple)
    await render()
    expect(card('Producto').get('[data-testid="card-summary"]').text()).toMatch(/^Se mide en peso · Ficha del fabricante · 4 nov/)
    expect(wrapper.text()).not.toContain('Sin presentación')
  })
})
