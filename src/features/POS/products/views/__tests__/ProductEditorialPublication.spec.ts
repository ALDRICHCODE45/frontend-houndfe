import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import ProductEditorialView from '../ProductEditorialView.vue'
import { document, state, success, vocabularyEnvelope, careDocument, careVocabulary, read, update, publish, failure } from '../../__tests__/editorial-contract-fixtures'
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({ isSuperAdmin: false, isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u' }, currentTenant: { id: 't' }, permissionsLoaded: true, permissionCodes: [read, update, publish] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
let wrapper: ReturnType<typeof mount>
let router: ReturnType<typeof createRouter>
function reads(care = false, revision = 3) {
  const doc = care ? careDocument() : document()
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope(care ? careVocabulary() : undefined) }
    : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success(state(doc, revision))))
}
async function render() {
  router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/editor/:id', component: ProductEditorialView }, { path: '/away', component: { template: '<p>Away</p>' } }] })
  await router.push('/editor/p1'); await router.isReady()
  wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } }); await flushPromises()
}
function button(text: string) { return wrapper.findAll('button').find(item => item.text() === text)! }
const panel = () => wrapper.get('[aria-labelledby="publication-title"]')
beforeEach(() => { vi.resetAllMocks(); auth.isSuperAdmin = false; auth.permissionCodes = [read, update, publish]; reads(); http.post.mockResolvedValue(success({ cycle: 2, draft: null, published: { revision: 2, document: document() } })) })
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks() })

describe('live publication integration', () => {
  it.each(['global', 'tenant'] as const)('%s admin loses pending care confirmation on privilege away/back', async kind => {
    auth.isSuperAdmin = kind === 'global'
    auth.permissionCodes = kind === 'global' ? [] : ['manage:all']
    reads(true); await render()
    expect(wrapper.find('form').exists()).toBe(true)
    await button('Publicar borrador…').trigger('click')
    await panel().get('input[type="checkbox"]').setValue(true)
    if (kind === 'global') auth.isSuperAdmin = false
    else auth.permissionCodes = []
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Presentación exacta')
    auth.isSuperAdmin = kind === 'global'
    auth.permissionCodes = kind === 'global' ? [] : ['manage:all']
    await flushPromises()
    expect(button('Publicar ahora')).toBeUndefined()
    await button('Publicar borrador…').trigger('click')
    expect((panel().get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false)
    expect(button('Publicar ahora').attributes('disabled')).toBeDefined()
    expect(http.post).not.toHaveBeenCalled()
  })
  it('publishes saved GET only with explicit confirmation and keeps receipt out of current comparison', async () => {
    await render(); await button('Publicar borrador…').trigger('click')
    expect(panel().text()).toContain('Se publicará la revisión 3')
    await button('Cancelar').trigger('click'); expect(http.post).not.toHaveBeenCalled()
    await button('Publicar borrador…').trigger('click'); await button('Publicar ahora').trigger('click'); await flushPromises()
    expect(http.post.mock.calls[0]![1]).toEqual({ expectedCycle: 2, expectedRevision: 3 })
    expect(http.post.mock.calls[0]![2].headers['Editorial-Care-Confirmation']).toBeUndefined()
    expect(wrapper.text()).toContain('Solicitud de publicación confirmada.')
    expect(panel().text()).toContain('Sin versión publicada')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(http.get).toHaveBeenCalledTimes(3)
  })
  it('allows read+publish without update and never infers E from variants', async () => {
    auth.permissionCodes = [read, publish]
    http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope() }
      : url.endsWith('/context') ? { status: 200, data: { variants: [{ id: 'possibly-inactive', name: 'Context only' }] } } : success()))
    await render()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(panel().text()).toContain('La elegibilidad se valida en el servidor')
    expect(button('Publicar borrador…').attributes('disabled')).toBeUndefined()
    await button('Publicar borrador…').trigger('click'); await button('Publicar ahora').trigger('click'); await flushPromises()
    expect(http.post).toHaveBeenCalledTimes(1)
  })
  it('shows every care review and requires new explicit token after a new saved revision', async () => {
    reads(true); await render()
    expect(panel().text()).toContain('Presentación exacta')
    expect(panel().text()).toContain('Ciclo 2 · revisión 3')
    await button('Publicar borrador…').trigger('click')
    expect(button('Publicar ahora').attributes('disabled')).toBeDefined()
    await panel().get('input[type="checkbox"]').setValue(true)
    await button('Cancelar').trigger('click')
    reads(true, 4); await wrapper.get('[data-testid="refresh-retain"]').trigger('click'); await flushPromises()
    await button('Publicar borrador…').trigger('click')
    expect((panel().get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false)
    await panel().get('input[type="checkbox"]').setValue(true)
    await button('Publicar ahora').trigger('click'); await flushPromises()
    expect(http.post.mock.calls[0]![1]).toEqual({ expectedCycle: 2, expectedRevision: 4 })
    expect(http.post.mock.calls[0]![2].headers['Editorial-Care-Confirmation']).toBe('review-v1')
  })
  it('dirty local changes block publication and stay out of stored history/comparison', async () => {
    await render(); await wrapper.get('#editorial-title').setValue('LOCAL NOT COMPARED')
    expect(panel().text()).toContain('Tienes cambios locales sin guardar.')
    expect(panel().get('details').text()).not.toContain('LOCAL NOT COMPARED')
    expect(button('Publicar borrador…').attributes('disabled')).toBeDefined()
    expect(http.post).not.toHaveBeenCalled()
  })
  it('uses separate saved-draft discard consent and exact update permission', async () => {
    auth.permissionCodes = [read, update]; await render()
    expect(panel().text()).toContain('No tienes permiso para publicar.')
    expect(button('Publicar borrador…')).toBeUndefined()
    await button('Descartar borrador guardado…').trigger('click'); await button('Cancelar').trigger('click')
    expect(http.post).not.toHaveBeenCalled()
    await button('Descartar borrador guardado…').trigger('click'); await button('Descartar borrador').trigger('click'); await flushPromises()
    expect(http.post.mock.calls[0]![0]).toContain('/draft/discard')
    expect(wrapper.find('form').exists()).toBe(false)
  })
  it.each(['CONFLICT', 'VOCABULARY_CHANGED'])('retains current GET and prohibits automatic retry after %s', async code => {
    http.post.mockRejectedValue(failure(409, code)); await render()
    await button('Publicar borrador…').trigger('click'); await button('Publicar ahora').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('No se reenvía automáticamente.')
    expect(button('Retransmitir la misma solicitud (mismo contenido y clave)')).toBeUndefined()
    expect(panel().text()).toContain('Borrador guardado: revisión 3')
    expect(http.post).toHaveBeenCalledTimes(1)
  })
  it.each(['publish', 'discard'])('ambiguous %s retry sends captured body/key/R/token, never a new intent', async kind => {
    http.post.mockRejectedValueOnce(new Error('network')); await render()
    await button(kind === 'publish' ? 'Publicar borrador…' : 'Descartar borrador guardado…').trigger('click')
    await button(kind === 'publish' ? 'Publicar ahora' : 'Descartar borrador').trigger('click'); await flushPromises()
    await button('Retransmitir la misma solicitud (mismo contenido y clave)').trigger('click'); await flushPromises()
    expect(http.post.mock.calls[1]![1]).toBe(http.post.mock.calls[0]![1])
    expect(http.post.mock.calls[1]![2].headers).toEqual(http.post.mock.calls[0]![2].headers)
  })
  it('guards route leave and beforeunload only while raw dirty, removing listeners on unmount', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await render()
    const clean = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(clean); expect(clean.defaultPrevented).toBe(false)
    await wrapper.get('#editorial-title').setValue('local')
    const dirty = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(dirty); expect(dirty.defaultPrevented).toBe(true)
    await router.push('/away'); expect(router.currentRoute.value.path).toBe('/editor/p1')
    expect(confirm).toHaveBeenCalledWith('Tienes cambios sin guardar en el borrador editorial. ¿Salir sin guardarlos?')
    confirm.mockReturnValue(true); await router.push('/away'); await flushPromises()
    const after = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(after); expect(after.defaultPrevented).toBe(false)
  })
})
