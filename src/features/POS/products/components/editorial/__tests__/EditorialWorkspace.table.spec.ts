/**
 * EditorialWorkspace — the draft lifecycle around the section cards (ported from the T8 table spec in T13):
 * the four states, the save bar, saving and refreshing, conflicts, the family, the history drawer and
 * read-only users behave as before. The section cards themselves are in EditorialWorkspace.cards.spec.ts.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import EditorialWorkspace from '../EditorialWorkspace.vue'
import HfCombobox from '@/core/shared/components/form/HfCombobox.vue'
import HfSaveBar from '@/core/shared/components/form/HfSaveBar.vue'
import type { EditorialContractDocument } from '../../../interfaces/editorial-contract-document.types'
import type { EditorialContractVocabulary } from '../../../interfaces/editorial-contract-vocabulary.types'
import { editorialToday } from '../../../utils/editorial-presentation-card'
import { document as emptyDocument, read, update, state, success, failure, vocabularyEnvelope, deferred } from '../../../__tests__/editorial-contract-fixtures'

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
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
let wrapper: VueWrapper

function reads(snapshot = state(doc()), context: { variants: { id: string; name: string }[] } = { variants }) {
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope(vocabulary) }
    : url.endsWith('/context') ? { status: 200, data: context } : success(snapshot)))
}
const render = async (props: Record<string, unknown> = {}) => {
  wrapper = mount(EditorialWorkspace, { attachTo: document.body, props: { productId: 'p1', embedded: true, ...props } })
  await flushPromises()
}
const tick = () => new Promise(resolve => setTimeout(resolve, 60))
const field = (label: string) => wrapper.findAll('[data-testid="attribute-field"]').find(item => item.get('.hf-form-field__label').text() === label)
const materialText = () => field('Material')!.get('input[type="text"]')
const combo = (label: string) => wrapper.findAllComponents(HfCombobox).find(item => item.props('label') === label)!
const bar = () => wrapper.findComponent(HfSaveBar)
const button = (text: string) => wrapper.findAll('button').find(item => item.text().includes(text))!
const domButton = (text: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(item => item.textContent?.trim() === text)!
const submit = async () => { await wrapper.get('form').trigger('submit'); await flushPromises() }

beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(auth, { permissionCodes: [read, update], isAuthenticated: true, authPhase: 'authenticated', permissionsLoaded: true })
  reads()
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })

describe('EditorialWorkspace — the four states', () => {
  it('empty: no draft is one empty state with the single action to start', async () => {
    reads({ cycle: null, draft: null, published: null })
    await render()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Aún no hay ficha para el catálogo')
    expect(wrapper.get('[data-testid="initialize"]').text()).toContain('Empezar ficha')
    expect(wrapper.find('.hf-section-card').exists()).toBe(false)
    expect(wrapper.findComponent(HfSaveBar).exists()).toBe(false)
  })

  it('empty with a published version: the one action starts from it', async () => {
    reads({ cycle: 2, draft: null, published: { revision: 1, document: doc() } })
    await render()
    expect(wrapper.get('[data-testid="initialize"]').text()).toContain('Empezar desde lo publicado')
    expect(wrapper.get('.hf-empty-state__description').text()).toContain('versión publicada')
  })

  it('loading: a skeleton of the index and the cards, with a spoken status', async () => {
    const pending = deferred<unknown>()
    http.get.mockReturnValue(pending.promise)
    await render()
    const skeleton = wrapper.get('[data-testid="editorial-skeleton"]')
    expect(skeleton.attributes('aria-busy')).toBe('true')
    expect(skeleton.text()).toContain('Cargando contenido editorial')
    expect(skeleton.findAll('.editorial-skeleton-card')).toHaveLength(3)
    expect(skeleton.findAll('[data-skeleton="field"]').length).toBeGreaterThanOrEqual(6)
    expect(wrapper.find('.hf-section-card').exists()).toBe(false)
  })

  it('data: the header, the cards and the save bar', async () => {
    await render()
    expect(wrapper.get('[data-testid="editorial-head"]').text()).toContain('Contenido')
    expect(wrapper.get('#editorial-title').element).toHaveProperty('value', 'Croqueta')
    expect(wrapper.findAll('.hf-section-card').length).toBeGreaterThanOrEqual(3)
    expect(bar().exists()).toBe(true)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('error: a failed read is the shared error with Reintentar, and Reintentar loads it', async () => {
    http.get.mockRejectedValue(failure(500, 'INTERNAL_ERROR'))
    await render()
    const error = wrapper.get('.hf-empty-state[data-kind="error"]')
    expect(error.attributes('role')).toBe('alert')
    expect(error.get('[data-testid="empty-state-action"]').text()).toContain('Reintentar')
    expect(wrapper.find('.hf-section-card').exists()).toBe(false)
    reads()
    await error.get('[data-testid="empty-state-action"]').trigger('click'); await flushPromises()
    expect(wrapper.find('.hf-section-card').exists()).toBe(true)
  })

  it('forbidden: a refused read is the forbidden state, never a retryable error', async () => {
    http.get.mockRejectedValue(failure(403, 'FORBIDDEN'))
    await render()
    expect(wrapper.get('.hf-empty-state').attributes('data-kind')).toBe('forbidden')
  })
})

describe('EditorialWorkspace — the save bar', () => {
  it('says what changed as soon as something changes, with Guardar as its only primary', async () => {
    await render()
    expect(bar().text()).not.toContain('sin guardar')
    await materialText().setValue('Nylon')
    expect(bar().text()).toContain('1 cambio sin guardar')
    expect(wrapper.findAll('.hf-primary-control').map(item => item.text())).toEqual(['Guardar'])
  })

  it('the publication placeholder is gone; «Publicar» (T23) stays off until readiness says ready, and loading sends no write', async () => {
    auth.permissionCodes = ['manage:all']
    await render()
    expect(wrapper.findAll('button').some(item => /Publicación próximamente/.test(item.text()))).toBe(false)
    expect(wrapper.get('[data-testid="publish"]').attributes('disabled')).toBeDefined()
    expect(http.post).not.toHaveBeenCalled()
    expect(source).not.toMatch(/Publicación próximamente/)
  })

  it('keeps «Descartar borrador» in the header and asks before discarding the saved draft', async () => {
    http.post.mockResolvedValue(success({ cycle: 2, draft: null, published: null }))
    await render()
    await wrapper.get('[data-testid="discard-draft"]').trigger('click'); await tick()
    expect(document.body.textContent).toContain('¿Descartar el borrador?')
    expect(document.body.textContent).toContain('Lo publicado no cambia.')
    domButton('Cancelar').click(); await tick()
    expect(http.post).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="discard-draft"]').trigger('click'); await tick()
    domButton('Descartar borrador').click(); await flushPromises()
    expect(http.post.mock.calls[0]![0]).toContain('/draft/discard')
  })

  it('goes back to the empty state once the draft is discarded', async () => {
    http.post.mockResolvedValue(success({ cycle: 3, draft: null, published: null }))
    await render()
    reads({ cycle: 3, draft: null, published: null })
    await wrapper.get('[data-testid="discard-draft"]').trigger('click'); await tick()
    domButton('Descartar borrador').click(); await flushPromises()
    expect(wrapper.find('[data-testid="initialize"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Aún no hay ficha para el catálogo')
  })

  it('Descartar asks before replacing the unsaved changes with the saved version', async () => {
    await render()
    await materialText().setValue('Nylon')
    bar().vm.$emit('discard'); await tick()
    expect(wrapper.find('[aria-labelledby="discard-title"]').exists()).toBe(true)
    await wrapper.get('[data-testid="confirm-discard"]').trigger('click'); await flushPromises()
    expect(materialText().element).toHaveProperty('value', '')
  })

  it('is the last thing of the scroll, sticky at the bottom, full bleed on mobile', () => {
    expect(source).toMatch(/\.editorial-save\s*\{[^}]*position:\s*sticky[^}]*bottom:\s*0/)
    expect(source).toMatch(/\.editorial-save\s*\{[^}]*margin-inline:\s*-16px/)
  })
})

describe('EditorialWorkspace — after a save', () => {
  it('says it was saved and refreshes the saved draft with one GET', async () => {
    http.put.mockResolvedValue(success(state(doc({ values: [material('Nylon')] }), 99)))
    await render()
    await materialText().setValue('Nylon')
    reads(state(doc({ values: [material('Nylon')] }), 4))
    await submit()
    expect(bar().text()).toContain('Guardado justo ahora')
    expect(http.get).toHaveBeenCalledTimes(8) // two coherent reads, each followed by its readiness (T23)
    expect(materialText().element).toHaveProperty('value', 'Nylon')
    expect(wrapper.find('[data-testid="retry-view"]').exists()).toBe(false)
    expect(button('Guardar').attributes('disabled')).toBeDefined()
  })

  it('a failed refresh still says it was saved, adds a quiet retry and never an error that suggests the save failed', async () => {
    http.put.mockResolvedValue(success(state(doc({ values: [material('Nylon')] }), 99)))
    await render()
    await materialText().setValue('Nylon')
    http.get.mockRejectedValue(failure(500, 'INTERNAL_ERROR'))
    await submit()
    expect(wrapper.get('[data-testid="stale-view"]').text()).toContain('no se pudo actualizar la vista')
    expect(wrapper.find('.hf-empty-state[data-kind="error"]').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(bar().text()).not.toMatch(/No se guardó/)
    expect(materialText().element).toHaveProperty('value', 'Nylon')
    expect(http.put).toHaveBeenCalledTimes(1)
  })

  it('Reintentar loads the saved draft and the stale note goes away', async () => {
    http.put.mockResolvedValue(success())
    await render()
    await materialText().setValue('Nylon')
    http.get.mockRejectedValue(failure(500, 'INTERNAL_ERROR'))
    await submit()
    reads(state(doc({ values: [material('Nylon')] }), 4))
    await wrapper.get('[data-testid="retry-view"]').trigger('click'); await flushPromises()
    expect(wrapper.find('[data-testid="retry-view"]').exists()).toBe(false)
    expect(bar().text()).toMatch(/Guardado/)
  })
})

describe('EditorialWorkspace — conflicts and reconciliation', () => {
  it('a conflict says so in plain words above the cards and keeps the local edits', async () => {
    http.put.mockRejectedValue(failure(409, 'CONFLICT'))
    await render()
    await materialText().setValue('LOCAL')
    await submit()
    const alert = wrapper.get('[data-testid="reconciliation"]')
    expect(alert.text()).toContain('Alguien más guardó cambios. Carga la versión más reciente para continuar.')
    expect(alert.text()).not.toMatch(/acuse|ciclo|revisión/i)
    expect(materialText().element).toHaveProperty('value', 'LOCAL')
    expect(http.put).toHaveBeenCalledTimes(1)
  })

  it('Cargar la versión más reciente asks first, and cancelling keeps the edits', async () => {
    http.put.mockRejectedValue(failure(409, 'CONFLICT'))
    await render()
    await materialText().setValue('LOCAL')
    await submit()
    await wrapper.get('[data-testid="refresh-discard"]').trigger('click')
    expect(wrapper.get('[aria-labelledby="discard-title"]').text()).toContain('¿Reemplazar tus cambios sin guardar')
    await wrapper.get('[data-testid="cancel-discard"]').trigger('click')
    expect(materialText().element).toHaveProperty('value', 'LOCAL')
    expect(http.get).toHaveBeenCalledTimes(4) // the coherent read and its readiness (T23)
    reads(state(doc({ values: [material('REMOTE')] }), 5))
    await wrapper.get('[data-testid="refresh-discard"]').trigger('click')
    await wrapper.get('[data-testid="confirm-discard"]').trigger('click'); await flushPromises()
    expect(materialText().element).toHaveProperty('value', 'REMOTE')
    expect(wrapper.find('[data-testid="reconciliation"]').exists()).toBe(false)
  })

  it('Conservar mis cambios y actualizar re-reads and keeps the local edits', async () => {
    http.put.mockRejectedValue(failure(409, 'CONFLICT'))
    await render()
    await materialText().setValue('LOCAL')
    await submit()
    reads(state(doc({ values: [material('REMOTE')] }), 5))
    await wrapper.get('[data-testid="reconciliation"] [data-testid="refresh-retain"]').trigger('click'); await flushPromises()
    expect(materialText().element).toHaveProperty('value', 'LOCAL')
    expect(wrapper.find('[data-testid="reconciliation"]').exists()).toBe(false)
  })

  it('an ambiguous result says it could not confirm, and retries the same request', async () => {
    http.put.mockRejectedValueOnce(new Error('network')).mockResolvedValue(success())
    await render()
    await materialText().setValue('LOCAL')
    await submit()
    expect(wrapper.get('[data-testid="reconciliation"]').text()).toContain('No pudimos confirmar si se guardó')
    await button('Reintentar guardado').trigger('click'); await flushPromises()
    expect(http.put).toHaveBeenCalledTimes(2)
    expect(http.put.mock.calls[1]![1]).toBe(http.put.mock.calls[0]![1])
    expect(http.put.mock.calls[1]![2].headers).toEqual(http.put.mock.calls[0]![2].headers)
  })
})

describe('EditorialWorkspace — the family', () => {
  const modalButton = (label: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(item => item.textContent?.trim() === label)!

  it('lives in the Presentación card and asks in a modal before changing; cancelling keeps the data', async () => {
    reads(state(doc({ values: [material('Nylon')] })))
    const confirm = vi.spyOn(window, 'confirm')
    await render()
    expect(wrapper.get('[data-testid="presentation-section"]').findComponent(HfCombobox).props('label')).toBe('Familia')
    combo('Familia').vm.$emit('update:modelValue', '1'); await tick()
    expect(confirm).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('¿Cambiar la familia?')
    expect(document.body.textContent).toContain('Se borran los datos de la familia actual')
    modalButton('Cancelar').click(); await tick()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(materialText().element).toHaveProperty('value', 'Nylon')
    expect(combo('Familia').props('modelValue')).toBe('0')
  })

  it('changes the family and clears its data once the modal is confirmed', async () => {
    reads(state(doc({ values: [material('Nylon')] })))
    await render()
    combo('Familia').vm.$emit('update:modelValue', '1'); await tick()
    modalButton('Cambiar familia').click(); await tick()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(wrapper.findAll('[data-testid="attribute-field"]').map(item => item.get('.hf-form-field__label').text())).toEqual(['Material'])
    expect(materialText().element).toHaveProperty('value', '')
  })

  it('without a family there are no attribute cards, but a prompt', async () => {
    reads(state(doc({ familyCode: null })))
    await render()
    expect(wrapper.find('[data-testid="attribute-section"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Elige una familia')
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
    await materialText().setValue('Nylon')
    await submit()
    await wrapper.get('[data-testid="open-history"]').trigger('click'); await tick()
    expect(document.querySelector('[role="dialog"]')!.textContent).toMatch(/Guardado el \d{1,2} [a-záéíóú]+\.?(?: \d{4})?, \d{2}:\d{2}/)
  })

  it('keeps the page free of history text: no cycle, revision or acknowledgement anywhere in the view', async () => {
    http.put.mockResolvedValue(success(state(doc(), 99)))
    await render()
    await materialText().setValue('Nylon')
    await submit()
    expect(wrapper.text()).not.toMatch(/acuse|ciclo|revisión|Consultar y/i)
  })
})

describe('EditorialWorkspace — read-only users', () => {
  it('see the cards as words, with no controls, save bar or draft actions', async () => {
    auth.permissionCodes = [read]
    reads(state(doc({ values: [material('Nylon'), { code: 'animal.target', owner: 'product', variantId: null, state: 'known', payload: { type: 'single', value: 'dog' }, evidence: null }] })))
    await render()
    expect(wrapper.text()).toContain('Solo consulta')
    expect(field('Material')!.text()).toContain('Nylon')
    expect(field('Especie')!.text()).toContain('Perro')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.find('input, textarea, select').exists()).toBe(false)
    expect(bar().exists()).toBe(false)
    expect(wrapper.find('[data-testid="attribute-field"] button').exists()).toBe(false)
    expect(wrapper.find('[data-testid="discard-draft"]').exists()).toBe(false)
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

describe('EditorialWorkspace — the Presentación card', () => {
  const today = editorialToday()
  const segmented = (key: string) => wrapper.get(`[data-question="${key}"]`).findComponent({ name: 'HfSegmented' })

  it('comes first, before Título y descripción, with «¿Cómo se mide el contenido?» as segments ending in «No sé»', async () => {
    await render()
    expect(wrapper.findAll('.hf-section-card__title').map(item => item.text()).slice(0, 2)).toEqual(['Presentación', 'Título y descripción'])
    expect(segmented('contentMagnitude').props('items').map((item: { label: string }) => item.label)).toEqual(['Peso', 'Volumen', 'Piezas', 'Largo', 'Área', 'No sé'])
  })

  it('an answer with no source is not saved and says so on the source field', async () => {
    await render()
    segmented('contentMagnitude').vm.$emit('update:modelValue', 'mass'); await tick()
    await submit()
    expect(http.put).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="card-source"] .hf-form-field__message').text()).toBe('Indica de dónde sale la información')
    expect(wrapper.text()).not.toContain('Revisa la captura de hechos')
  })

  it('«No sé» saves the unknown state with no evidence', async () => {
    http.put.mockResolvedValue(success())
    await render()
    segmented('contentMagnitude').vm.$emit('update:modelValue', 'unknown'); await tick()
    await submit()
    expect(http.put.mock.calls[0]![1].document.facts).toEqual([{ variantId: 'v1', presentation: '15 kg', careReview: null,
      declarations: [{ key: 'contentMagnitude', state: 'unknown', evidence: null }] }])
  })

  it('a saved «Producto» presentation reads back with its answer and source', async () => {
    const saved = doc({ facts: [{ variantId: null, presentation: 'Croqueta', careReview: null, declarations: [
      { key: 'contentMagnitude', state: 'known', value: 'mass', evidence: { sourceRef: 'Ficha del fabricante', verifiedOn: '2026-11-04' }, basis: 'Según la ficha del fabricante.' }] }] })
    reads(state(saved, 4), { variants: [] })
    await render()
    expect(segmented('contentMagnitude').props('modelValue')).toBe('mass')
    expect(combo('Fuente').props('modelValue')).toBe('maker')
    expect(wrapper.text()).not.toContain('Sin presentación')
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
