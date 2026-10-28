import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import ProductEditorialView from '../ProductEditorialView.vue'
import { EditorialApiError } from '../../api/product-editorial.api'
import type { EditorialDocument, EditorialValue } from '../../interfaces/product-editorial.types'

const api = vi.hoisted(() => ({ getState: vi.fn(), getVocabulary: vi.fn(), getContext: vi.fn(), publish: vi.fn(), discard: vi.fn() }))
const auth = reactive({ isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u' }, currentTenant: { id: 't' },
  permissionsLoaded: true, permissionCodes: [] as string[] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
vi.mock('../../api/product-editorial.api', async original => ({
  ...await original<typeof import('../../api/product-editorial.api')>(), editorialApi: api,
}))
const document: EditorialDocument = { commercialTitle: 'Título', description: 'Descripción', familyCode: null, mediaRefs: [], values: [] }
const value = (code: string, text: string): EditorialValue => ({ code, type: 'text', owner: 'product', variantId: null, value: text })
const state = (draft: unknown = document, published: unknown = document) => ({ cycle: 2,
  draft: { revision: 4, basePublishedRevision: 1, document: draft }, published: { revision: 1, document: published } })
let wrapper: ReturnType<typeof mount>
let router: ReturnType<typeof createRouter>
async function render() {
  router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/editor/:id', component: ProductEditorialView }, { path: '/away', component: { template: '<p>Away</p>' } },
  ] })
  await router.push('/editor/p1'); await router.isReady()
  wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
  await flushPromises()
}
function button(text: string) { return wrapper.findAll('button').find(item => item.text() === text)! }
const panel = () => wrapper.get('[aria-labelledby="publication-title"]')
beforeEach(() => {
  vi.resetAllMocks()
  auth.permissionCodes = ['read:ProductEditorialDraft', 'update:ProductEditorialDraft', 'publish:ProductEditorialDraft']
  api.getState.mockResolvedValue(state())
  api.getVocabulary.mockResolvedValue({ families: [], definitions: [] })
  api.getContext.mockResolvedValue({ variants: [] })
  api.publish.mockResolvedValue({ cycle: 2, draft: null, published: { revision: 2, document } })
  api.discard.mockResolvedValue({ cycle: 2, draft: null, published: { revision: 1, document } })
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks() })

describe('editorial publication public UI', () => {
  it('separates saved, published and local state before the form', async () => {
    await render()
    expect(panel().text()).toContain('Publicado: revisión 1')
    expect(panel().text()).toContain('Borrador guardado: revisión 4')
    await wrapper.get('#editorial-commercialTitle').setValue('Local')
    expect(panel().text()).toContain('Tienes cambios locales sin guardar.')
    expect(panel().text()).toContain('Guarda o descarta tus cambios locales antes de publicar. Solo se publica el borrador guardado.')
    expect(button('Publicar borrador…').attributes('disabled')).toBeDefined()
    expect(api.publish).not.toHaveBeenCalled()
  })
  it('confirms only the saved revision, cancels without POST, and keeps receipt historical', async () => {
    await render()
    await button('Publicar borrador…').trigger('click')
    expect(panel().get('[role="group"]').text()).toContain('Se publicará la revisión 4 del borrador guardado y reemplazará la versión publicada. El borrador se cerrará.')
    expect(api.publish).not.toHaveBeenCalled()
    await button('Cancelar').trigger('click')
    expect(api.publish).not.toHaveBeenCalled()
    await button('Publicar borrador…').trigger('click'); await button('Publicar ahora').trigger('click'); await flushPromises()
    expect(api.publish).toHaveBeenCalledExactlyOnceWith('p1', { expectedCycle: 2, expectedRevision: 4 }, expect.any(String))
    expect(wrapper.text()).toContain('Solicitud de publicación confirmada.')
    expect(wrapper.text()).toContain('Este acuse no representa el estado actual.')
    expect(panel().text()).toContain('Publicado: revisión 1')
  })
  it('supports a first publication for read+publish without exposing editing', async () => {
    auth.permissionCodes = ['read:ProductEditorialDraft', 'publish:ProductEditorialDraft']
    api.getState.mockResolvedValue({ ...state(), published: null })
    await render()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Puedes publicar el borrador guardado.')
    expect(panel().text()).toContain('Sin versión publicada')
    await button('Publicar borrador…').trigger('click')
    expect(panel().text()).toContain('y será la primera versión publicada. El borrador se cerrará.')
    await button('Publicar ahora').trigger('click'); await flushPromises()
    expect(api.publish).toHaveBeenCalledTimes(1)
  })
  it('shows missing permission only to writers and confirms saved-draft discard separately', async () => {
    auth.permissionCodes = ['read:ProductEditorialDraft', 'update:ProductEditorialDraft']
    await render()
    expect(panel().text()).toContain('No tienes permiso para publicar.')
    expect(button('Publicar borrador…')).toBeUndefined()
    await button('Descartar borrador guardado…').trigger('click')
    expect(panel().get('[role="group"]').text()).toContain('El borrador guardado se eliminará en el servidor. La versión publicada no cambia. Tus cambios locales sin guardar también se perderán.')
    await button('Cancelar').trigger('click'); expect(api.discard).not.toHaveBeenCalled()
    await button('Descartar borrador guardado…').trigger('click'); await button('Descartar borrador').trigger('click'); await flushPromises()
    expect(api.discard).toHaveBeenCalledExactlyOnceWith('p1', { expectedCycle: 2, expectedRevision: 4 }, expect.any(String))
    expect(wrapper.text()).toContain('Solicitud para descartar el borrador confirmada.')
    // Local edits were dropped with the confirmed discard: no stale local-change controls remain.
    expect(button('Consultar y descartar cambios…')).toBeUndefined()
    expect(button('Consultar y cargar borrador')).toBeDefined()
    expect(panel().text()).not.toContain('Tienes cambios locales sin guardar.')
  })
  it.each([
    ['title', { ...document, commercialTitle: '  ' }, 'Agrega un título comercial editorial y guarda el borrador antes de publicar.'],
    ['media', { ...document, mediaRefs: ['private'] }, 'El borrador tiene referencias de medios. Por ahora no se pueden publicar medios ni quitarlos desde este editor; descarta el borrador guardado para salir de este estado.'],
    ['limits', { ...document, commercialTitle: 'x'.repeat(201) }, 'El contenido supera los límites de guardado'],
    ['structure', { unknown: true }, 'Revisa el formato del contenido.'],
    ['family', { ...document, familyCode: 'missing' }, 'La familia ya no está disponible.'],
  ])('explains %s and prevents publishing', async (_, draft, message) => {
    api.getState.mockResolvedValue(state(draft)); await render()
    expect(panel().text()).toContain(message)
    expect(button('Publicar borrador…').attributes('disabled')).toBeDefined()
    await button('Publicar borrador…').trigger('click')
    expect(api.publish).not.toHaveBeenCalled()
    if (_ === 'media') expect(button('Descartar borrador guardado…')).toBeDefined()
  })
  it.each([
    ['metadata', 'No se pudieron validar los metadatos editoriales.'],
    ['baseline', 'El borrador guardado no se puede interpretar.'],
    ['binding', 'El atributo ya no corresponde a esta familia o cambió de tipo.'],
    ['variant', 'La presentación guardada ya no está disponible en el contexto actual.'],
    ['unit', 'Selecciona una unidad disponible.'],
    ['option', 'Una opción guardada ya no está disponible.'],
  ])('renders the existing %s mapping without POSTs', async (code, message) => {
    const assignment: EditorialValue = code === 'unit'
      ? { code: 'a', type: 'number', owner: 'product', variantId: null, value: 1, unit: 'missing' }
      : code === 'option' ? { code: 'a', type: 'single', owner: 'product', variantId: null, value: 'missing' }
        : { ...value('a', 'text'), ...(code === 'variant' ? { owner: 'sellable' as const, variantId: 'missing' } : {}) }
    const definition = code === 'unit' ? { id: 'a', code: 'a', label: 'A', type: 'number', units: [] }
      : code === 'option' ? { id: 'a', code: 'a', label: 'A', type: 'single', options: [] }
        : { id: 'a', code: 'a', label: 'A', type: 'text' }
    api.getVocabulary.mockResolvedValue({ families: [{ id: 'f', code: 'f', label: 'Familia', bindings: code === 'binding' ? [] : [
      { definitionId: 'a', definitionCode: 'a', owner: code === 'variant' ? 'sellable' : 'product', sortOrder: 0 },
    ] }], definitions: [definition] })
    if (code === 'metadata') api.getVocabulary.mockRejectedValue(new Error('Unavailable'))
    api.getState.mockResolvedValue(code === 'baseline' ? state(document, { unreadable: true })
      : state({ ...document, familyCode: 'f', values: [assignment] }))
    await render()
    expect(panel().text()).toContain(message)
    expect(button('Publicar borrador…').attributes('disabled')).toBeDefined()
    await button('Publicar borrador…').trigger('click')
    expect(api.publish).not.toHaveBeenCalled()
  })
  it('explains archived options against Published rather than the saved baseline', async () => {
    api.getVocabulary.mockResolvedValue({ families: [{ id: 'f', code: 'f', label: 'Familia', bindings: [
      { definitionId: 'c', definitionCode: 'color', owner: 'product', sortOrder: 0 },
    ] }], definitions: [{ id: 'c', code: 'color', label: 'Color', type: 'single', options: [{ code: 'old', label: 'Anterior', archived: true, sortOrder: 0 }] }] })
    api.getState.mockResolvedValue(state({ ...document, familyCode: 'f', values: [{ code: 'color', owner: 'product', variantId: null, type: 'single', value: 'old' }] }))
    await render()
    expect(panel().text()).toContain('Un atributo usa una opción archivada que no está en la versión publicada. Cámbiala, guarda y vuelve a intentar.')
    expect(button('Publicar borrador…').attributes('disabled')).toBeDefined()
    expect(api.publish).not.toHaveBeenCalled()
  })
  it('compares authoritative values with added, removed, changed and unchanged fields', async () => {
    api.getState.mockResolvedValue(state({ ...document, familyCode: 'f', commercialTitle: 'Nuevo', values: [value('changed', 'nuevo'), value('added', 'agregado')] },
      { ...document, familyCode: 'f', values: [value('changed', 'anterior'), value('removed', 'quitado')] }))
    await render()
    const comparison = panel().get('details')
    expect(comparison.get('summary').text()).toBe('Comparar borrador guardado con la versión publicada')
    for (const text of ['Sin cambios', 'Publicado: Título', 'Borrador guardado: Nuevo', 'changed · Cambiado', 'added · Agregado', 'removed · Eliminado', 'anterior', 'nuevo']) expect(comparison.text()).toContain(text)
    await wrapper.get('#editorial-commercialTitle').setValue('LOCAL NOT COMPARED')
    expect(comparison.text()).not.toContain('LOCAL NOT COMPARED')
  })
  it('describes compared attributes in Spanish without technical type or owner codes', async () => {
    api.getState.mockResolvedValue(state({ ...document, familyCode: 'f', values: [
      { code: 'tags', owner: 'product', variantId: null, type: 'multi', value: ['a', 'b'] },
      { code: 'weight', owner: 'sellable', variantId: 'v1', type: 'number', value: 0.25, unit: 'kg' },
    ] }))
    await render()
    const comparison = panel().get('details')
    expect(comparison.text()).toContain('Borrador guardado: a, b · Producto')
    expect(comparison.text()).toContain('Borrador guardado: 0.25 kg · Presentación')
    for (const technical of ['multi', 'number', 'sellable', '· product', '["a"']) expect(comparison.text()).not.toContain(technical)
  })
  it('labels compared attributes with current vocabulary and variant names, falling back to codes', async () => {
    api.getVocabulary.mockResolvedValue({ families: [{ id: 'f', code: 'f', label: 'Familia', bindings: [
      { definitionId: 'finish', definitionCode: 'finish', owner: 'sellable', sortOrder: 0 },
    ] }], definitions: [{ id: 'finish', code: 'finish', label: 'Acabado', type: 'single', options: [
      { code: 'matte', label: 'Mate', archived: false, sortOrder: 0 }, { code: 'gloss', label: 'Brillante', archived: true, sortOrder: 1 },
    ] }] })
    api.getContext.mockResolvedValue({ variants: [{ id: 'variant-l-123456', name: 'L' }] })
    const finish = (option: string): EditorialValue => ({ code: 'finish', owner: 'sellable', variantId: 'variant-l-123456', type: 'single', value: option })
    api.getState.mockResolvedValue(state({ ...document, familyCode: 'f', values: [finish('matte'), value('gone', 'x')] },
      { ...document, familyCode: 'f', values: [finish('gloss')] }))
    await render()
    const text = panel().get('details').text()
    expect(text).toContain('Acabado · L · variant- · Cambiado')
    expect(text).toContain('Publicado: Brillante · Presentación')
    expect(text).toContain('Borrador guardado: Mate · Presentación')
    expect(text).toContain('gone · Agregado')
    expect(text).not.toContain('variant-l-123456')
  })
  it('reports unchanged attributes even when both versions have none', async () => {
    await render()
    const comparison = panel().get('details')
    expect(comparison.text()).toContain('Atributos editoriales')
    expect(comparison.findAll('dd').map(item => item.text())).toEqual(['Sin cambios', 'Sin cambios', 'Sin cambios', 'Sin cambios'])
  })
  it.each(['draft', 'published'])('reports unreadable %s without normalization', async side => {
    api.getState.mockResolvedValue(side === 'draft' ? state({ secret: 'DO NOT DISPLAY' }) : state(document, { secret: 'DO NOT DISPLAY' }))
    await render()
    expect(panel().get('details').text()).toContain(side === 'draft' ? 'El borrador guardado no se puede interpretar.' : 'La versión publicada no se puede interpretar.')
    expect(panel().text()).not.toContain('DO NOT DISPLAY')
  })
  it('does not offer comparison without a saved draft or expose publication to read-only users', async () => {
    api.getState.mockResolvedValue({ ...state(), draft: null }); await render()
    expect(panel().text()).toContain('Sin borrador guardado')
    expect(panel().find('details').exists()).toBe(false)
    auth.permissionCodes = ['read:ProductEditorialDraft']; await flushPromises()
    expect(wrapper.find('[aria-labelledby="publication-title"]').exists()).toBe(false)
  })
  it('guards route leave and beforeunload only while local changes exist, cleaning up on unmount', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await render()
    const clean = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(clean); expect(clean.defaultPrevented).toBe(false)
    await wrapper.get('#editorial-commercialTitle').setValue('Local')
    const dirty = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(dirty); expect(dirty.defaultPrevented).toBe(true)
    await wrapper.get('#editorial-commercialTitle').setValue('Título')
    const restored = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(restored); expect(restored.defaultPrevented).toBe(false)
    await wrapper.get('#editorial-commercialTitle').setValue('Local')
    await router.push('/away'); expect(router.currentRoute.value.path).toBe('/editor/p1')
    expect(confirm).toHaveBeenCalledWith('Tienes cambios sin guardar en el borrador editorial. ¿Salir sin guardarlos?')
    confirm.mockReturnValue(true); await router.push('/away'); await flushPromises()
    expect(router.currentRoute.value.path).toBe('/away')
    const after = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(after); expect(after.defaultPrevented).toBe(false)
    await router.push('/editor/p1'); await flushPromises(); confirm.mockClear()
    await router.push('/away'); expect(confirm).not.toHaveBeenCalled()
  })
  it.each(['publish', 'discard'] as const)('requires explicit reconciliation after a %s conflict', async kind => {
    api[kind].mockRejectedValueOnce(new EditorialApiError(409, { statusCode: 409, error: 'CONFLICT' }))
    await render()
    await button(kind === 'publish' ? 'Publicar borrador…' : 'Descartar borrador guardado…').trigger('click')
    await button(kind === 'publish' ? 'Publicar ahora' : 'Descartar borrador').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('No se reenvía automáticamente.')
    expect(button('Retransmitir la misma solicitud (mismo contenido y clave)')).toBeUndefined()
    expect(api[kind]).toHaveBeenCalledTimes(1)
    expect(panel().text()).toContain('Borrador guardado: revisión 4')
    expect(button('Publicar borrador…').attributes('disabled')).toBeDefined()
  })
  it.each(['publish', 'discard'] as const)('retransmits ambiguous %s with the identical intent', async kind => {
    if (kind === 'publish') auth.permissionCodes = ['read:ProductEditorialDraft', 'publish:ProductEditorialDraft']
    api[kind].mockRejectedValueOnce(new EditorialApiError(null, null))
    await render()
    await button(kind === 'publish' ? 'Publicar borrador…' : 'Descartar borrador guardado…').trigger('click')
    await button(kind === 'publish' ? 'Publicar ahora' : 'Descartar borrador').trigger('click'); await flushPromises()
    const first = api[kind].mock.calls[0]
    const retry = button('Retransmitir la misma solicitud (mismo contenido y clave)')
    expect(retry.attributes('disabled')).toBeUndefined()
    await retry.trigger('click'); await flushPromises()
    expect(api[kind].mock.calls[1]).toEqual(first)
  })
})
