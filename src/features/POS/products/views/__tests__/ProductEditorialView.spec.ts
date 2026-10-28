import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import ProductEditorialView from '../ProductEditorialView.vue'
import { EditorialApiError } from '../../api/product-editorial.api'

const { getState, getVocabulary, getContext, save, initialize } = vi.hoisted(() => ({
  getState: vi.fn(), getVocabulary: vi.fn(), getContext: vi.fn(), save: vi.fn(), initialize: vi.fn(),
}))
const auth = reactive({ isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u1' }, currentTenant: { id: 't1' },
  permissionsLoaded: true, permissionCodes: ['read:ProductEditorialDraft'] })
const route = reactive({ params: { id: 'p1' } })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('../../api/product-editorial.api', async (original) => ({
  ...await original<typeof import('../../api/product-editorial.api')>(), editorialApi: { getState, getVocabulary, getContext, save, initialize },
}))
const document = { commercialTitle: 'Título editorial', description: 'Descripción editorial',
  familyCode: null, mediaRefs: ['private-1', 'private-2'], values: [] }
let wrapper: ReturnType<typeof mount>
let client: QueryClient
function render() {
  client = new QueryClient()
  wrapper = mount(ProductEditorialView, { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } })
  return wrapper
}
async function settle() { await flushPromises(); await new Promise((resolve) => setTimeout(resolve, 10)); await flushPromises() }

beforeEach(() => {
  vi.resetAllMocks()
  getVocabulary.mockResolvedValue({ families: [], definitions: [] })
  getContext.mockResolvedValue({ variants: [] })
  Object.assign(auth, { isAuthenticated: true, user: { id: 'u1' }, currentTenant: { id: 't1' },
    permissionsLoaded: true, permissionCodes: ['read:ProductEditorialDraft'] })
  route.params.id = 'p1'
})
afterEach(() => { wrapper?.unmount(); client?.clear() })

describe('editorial editor integration', () => {
  it('exposes an accessible explicit save form only to writers and keeps media private', async () => {
    auth.permissionCodes = ['read:ProductEditorialDraft', 'update:ProductEditorialDraft']
    getState.mockResolvedValue({ cycle: 1, draft: { revision: 2, basePublishedRevision: null, document }, published: null })
    save.mockResolvedValue({ cycle: 1, draft: { revision: 3, basePublishedRevision: null, document }, published: null })
    render(); await settle()
    await wrapper.get('input[id="editorial-commercialTitle"]').setValue('  😀 sin recortar  ')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(save).toHaveBeenCalledWith('p1', { expectedCycle: 1, expectedRevision: 2,
      document: { ...document, commercialTitle: '  😀 sin recortar  ' } }, expect.any(String))
    expect(wrapper.text()).toContain('Acuse histórico')
    expect(wrapper.text()).toContain('consulta explícita')
    expect(wrapper.findAll('img')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('private-1')
  })
  it('maps receipt warnings by current vocabulary IDs and asks to correct invalid history before saving', async () => {
    auth.permissionCodes = ['read:ProductEditorialDraft', 'update:ProductEditorialDraft']
    getVocabulary.mockResolvedValue({ families: [{ id: 'family-now', code: 'f', label: 'Familia actual', bindings: [
      { definitionId: 'definition-now', definitionCode: 'color', owner: 'product', sortOrder: 0 },
    ] }], definitions: [{ id: 'definition-now', code: 'color', label: 'Color actual', type: 'single', options: [
      { code: 'old', label: 'Opción anterior', archived: true, sortOrder: 0 },
    ] }] })
    const orphan = { code: 'missing', owner: 'product', variantId: null, type: 'text', value: 'No borrar' }
    getState.mockResolvedValue({ cycle: 1, draft: { revision: 2, basePublishedRevision: null,
      document: { ...document, familyCode: 'f', values: [orphan] } }, published: null })
    render(); await settle()
    expect(wrapper.text()).toContain('Historial con atributos o contexto no disponibles')
    expect(wrapper.text()).toContain('Quita o corrige esos atributos en el borrador para poder guardarlo.')
    expect(wrapper.text()).not.toContain('Limitación conocida')
    expect(wrapper.text()).not.toContain('no garantiza')
    expect(wrapper.text()).toContain('Atributo huérfano')
    await wrapper.get('[data-testid="remove-0"]').trigger('click')
    save.mockRejectedValueOnce(new EditorialApiError(400, { statusCode: 400, error: 'MALFORMED' }))
    await wrapper.get('form').trigger('submit'); await settle()
    expect(wrapper.text()).toContain('Conservamos tus cambios locales')
    expect(wrapper.find('[data-testid="assignment-0"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('No borrar') // historical GET is never normalized
    await wrapper.get('[data-testid="refresh-retain"]').trigger('click'); await settle()
    save.mockResolvedValueOnce({ cycle: 1, draft: null, published: null, warnings: [
      { code: 'ARCHIVED_OPTION', familyId: 'family-now', definitionId: 'definition-now', owner: 'product', variantId: null, optionCode: 'old' },
      { code: 'ARCHIVED_OPTION', familyId: 'gone', definitionId: 'gone', owner: 'sellable', variantId: 'variant-gone', optionCode: 'fallback-code' },
    ] })
    await wrapper.get('form').trigger('submit'); await settle()
    expect(wrapper.text()).toContain('Familia actual · Color actual · Opción anterior · Producto')
    expect(wrapper.text()).toContain('Familia no disponible · Atributo no disponible · fallback-code')
    expect(wrapper.text()).not.toContain('[object Object]')
  })
  it('requires explicit initialization for empty and Published-only state', async () => {
    auth.permissionCodes = ['read:ProductEditorialDraft', 'update:ProductEditorialDraft']
    getState.mockResolvedValue({ cycle: 2, draft: null, published: { revision: 1, document } })
    initialize.mockResolvedValue({ cycle: 2, draft: { revision: 1, basePublishedRevision: 1, document }, published: { revision: 1, document } })
    render(); await settle()
    expect(initialize).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="initialize"]').trigger('click'); await settle()
    expect(initialize).toHaveBeenCalledWith('p1', { expectedCycle: 2 }, expect.any(String))
    expect(wrapper.find('form').exists()).toBe(false)
  })
  it.each(['empty', 'Published'] as const)('loads an editable fresh GET explicitly after initializing %s, without adopting the receipt', async source => {
    auth.permissionCodes = ['read:ProductEditorialDraft', 'update:ProductEditorialDraft']
    const expectedCycle = source === 'empty' ? null : 2
    const published = source === 'empty' ? null : { revision: 1, document }
    const freshCycle = expectedCycle ?? 1
    getState.mockResolvedValueOnce({ cycle: expectedCycle, draft: null, published })
    let acknowledge!: (receipt: unknown) => void
    initialize.mockReturnValueOnce(new Promise(resolve => { acknowledge = resolve }))
    render(); await settle()
    expect(getState).toHaveBeenCalledExactlyOnceWith('p1')
    expect(getVocabulary).toHaveBeenCalledTimes(1)
    expect(getContext).toHaveBeenCalledExactlyOnceWith('p1')
    expect(initialize).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="initialize"]').trigger('click')
    expect(initialize).toHaveBeenCalledExactlyOnceWith('p1', { expectedCycle }, expect.any(String))
    const key = initialize.mock.calls[0]![2] as string
    expect(key.length).toBeGreaterThan(0)
    expect(key.length).toBeLessThanOrEqual(200)
    expect(wrapper.get('[data-testid="refresh-retain"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="refresh-retain"]').trigger('click')
    expect(getState).toHaveBeenCalledTimes(1)
    acknowledge({ cycle: 9, draft: { revision: 99, basePublishedRevision: null,
      document: { ...document, commercialTitle: 'ACUSE NO ES BASELINE' } }, published: null })
    await settle()
    expect(wrapper.text()).toContain('Acuse histórico')
    expect(wrapper.get('[data-testid="refresh-retain"]').text()).toBe('Consultar y cargar borrador')
    expect(wrapper.text()).not.toContain('ACUSE NO ES BASELINE')
    expect(wrapper.text()).not.toContain('Revisión consultada: 99')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(getState).toHaveBeenCalledTimes(1)
    expect(getVocabulary).toHaveBeenCalledTimes(1)
    expect(getContext).toHaveBeenCalledTimes(1)
    const loadedDocument = { ...document, commercialTitle: `Título desde GET ${source}` }
    getState.mockResolvedValueOnce({ cycle: freshCycle, draft: { revision: 1,
      basePublishedRevision: source === 'empty' ? null : 1, document: loadedDocument }, published })
    await wrapper.get('[data-testid="refresh-retain"]').trigger('click'); await settle()
    expect(wrapper.find('form').exists()).toBe(true)
    expect((wrapper.get('#editorial-commercialTitle').element as HTMLInputElement).value).toBe(loadedDocument.commercialTitle)
    expect(wrapper.text()).toContain('Revisión consultada: 1')
    expect(getState).toHaveBeenCalledTimes(2)
    expect(getVocabulary).toHaveBeenCalledTimes(2)
    expect(getContext).toHaveBeenCalledTimes(2)
    expect(initialize).toHaveBeenCalledTimes(1)
    expect(save).not.toHaveBeenCalled()
    await wrapper.get('#editorial-commercialTitle').setValue('CAMBIOS LOCALES')
    getState.mockResolvedValueOnce({ cycle: freshCycle, draft: { revision: 2, basePublishedRevision: null,
      document: { ...loadedDocument, commercialTitle: 'CAMBIO REMOTO' } }, published })
    expect(wrapper.get('[data-testid="refresh-retain"]').text()).toBe('Consultar y conservar cambios')
    await wrapper.get('[data-testid="refresh-retain"]').trigger('click'); await settle()
    expect((wrapper.get('#editorial-commercialTitle').element as HTMLInputElement).value).toBe('CAMBIOS LOCALES')
    expect(getState).toHaveBeenCalledTimes(3)
    expect(save).not.toHaveBeenCalled()
  })
  it('does not fabricate a buffer when the explicit post-initialize GET contains unreadable history', async () => {
    auth.permissionCodes = ['read:ProductEditorialDraft', 'update:ProductEditorialDraft']
    getState.mockResolvedValueOnce({ cycle: null, draft: null, published: null })
    initialize.mockResolvedValueOnce({ cycle: 1, draft: { revision: 1, basePublishedRevision: null, document }, published: null })
    render(); await settle()
    await wrapper.get('[data-testid="initialize"]').trigger('click'); await settle()
    getState.mockResolvedValueOnce({ cycle: 1, draft: { revision: 1, basePublishedRevision: null,
      document: { unreadable: true } }, published: null })
    await wrapper.get('[data-testid="refresh-retain"]').trigger('click'); await settle()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('No se puede interpretar este documento')
    expect(getState).toHaveBeenCalledTimes(2)
    expect(initialize).toHaveBeenCalledTimes(1)
    expect(save).not.toHaveBeenCalled()
  })
  it('keeps oversized editable strings intact and blocks saving with associated counts/errors', async () => {
    auth.permissionCodes = ['read:ProductEditorialDraft', 'update:ProductEditorialDraft']
    getState.mockResolvedValue({ cycle: 1, draft: { revision: 1, basePublishedRevision: null,
      document: { ...document, commercialTitle: '😀'.repeat(201), description: 'x'.repeat(20001) } }, published: null })
    render(); await settle()
    const title = wrapper.get('input[id="editorial-commercialTitle"]')
    expect((title.element as HTMLInputElement).value).toBe('😀'.repeat(201))
    expect(title.attributes('maxlength')).toBeUndefined()
    expect(title.attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).toContain('201 / 200')
    await wrapper.get('form').trigger('submit'); await settle()
    expect(save).not.toHaveBeenCalled()
  })
  it('requires confirmation to discard on refresh and offers retain independently', async () => {
    auth.permissionCodes = ['read:ProductEditorialDraft', 'update:ProductEditorialDraft']
    getState.mockResolvedValue({ cycle: 1, draft: { revision: 1, basePublishedRevision: null, document }, published: null })
    render(); await settle()
    await wrapper.get('input[id="editorial-commercialTitle"]').setValue('LOCAL')
    await wrapper.get('[data-testid="refresh-discard"]').trigger('click')
    expect(getState).toHaveBeenCalledTimes(1)
    await wrapper.get('[data-testid="cancel-discard"]').trigger('click')
    expect((wrapper.get('#editorial-commercialTitle').element as HTMLInputElement).value).toBe('LOCAL')
    getState.mockResolvedValue({ cycle: 1, draft: { revision: 3, basePublishedRevision: null,
      document: { ...document, commercialTitle: 'REMOTE' } }, published: null })
    await wrapper.get('[data-testid="refresh-retain"]').trigger('click'); await settle()
    expect((wrapper.get('#editorial-commercialTitle').element as HTMLInputElement).value).toBe('LOCAL')
    await wrapper.get('[data-testid="refresh-discard"]').trigger('click')
    await wrapper.get('[data-testid="confirm-discard"]').trigger('click'); await settle()
    expect((wrapper.get('#editorial-commercialTitle').element as HTMLInputElement).value).toBe('REMOTE')
    expect(save).not.toHaveBeenCalled()
  })
  it.each([
    [{ cycle: null, draft: null, published: null }, 'Todavía no hay contenido editorial'],
    [{ cycle: 1, draft: null, published: { revision: 3, document } }, 'Sin borrador'],
    [{ cycle: 1, draft: { revision: 2, basePublishedRevision: null, document }, published: null }, 'Título editorial'],
    [{ cycle: 1, draft: { revision: 2, basePublishedRevision: null, document: { secret: 'DO NOT DISPLAY' } }, published: { revision: 1, document } }, 'No se puede interpretar este documento'],
  ])('presents stored state without editable controls', async (state, text) => {
    getState.mockResolvedValue(state)
    render()
    await settle()
    expect(wrapper.text()).toContain(text)
    expect(wrapper.text()).not.toContain('DO NOT DISPLAY')
    expect(wrapper.text()).not.toContain('[object Object]')
    expect(wrapper.findAll('input, textarea, form, img')).toHaveLength(0)
    expect(wrapper.text()).toContain('Solo consulta')
    expect(wrapper.findAll('button')).toHaveLength(1)
  })

  it('keeps oversized history and all media references without fetching media', async () => {
    const title = 'x'.repeat(201)
    getState.mockResolvedValue({ cycle: 1, draft: { revision: 1, basePublishedRevision: null,
      document: { ...document, commercialTitle: title, description: 'y'.repeat(20001),
        mediaRefs: Array.from({ length: 21 }, (_, i) => `private-${i}`) } }, published: null })
    render()
    await settle()
    expect(wrapper.text()).toContain(title)
    expect(wrapper.text()).toContain('21 referencias de medios conservadas')
    expect(wrapper.text()).toContain('y'.repeat(20001))
    expect(wrapper.find('details').exists()).toBe(true)
  })

  it('shows loading, refreshes only explicitly, and safely reports a 403', async () => {
    let resolve!: (state: unknown) => void
    getState.mockReturnValueOnce(new Promise((done) => { resolve = done }))
    render()
    expect(wrapper.text()).toContain('Cargando contenido editorial')
    resolve({ cycle: null, draft: null, published: null })
    await settle()
    getState.mockRejectedValueOnce(new EditorialApiError(403, { statusCode: 403, error: 'FORBIDDEN' }))
    await wrapper.get('button').trigger('click')
    await settle()
    expect(getState).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[role="alert"]').text()).toContain('No tienes acceso')
    expect(wrapper.text()).not.toContain('Todavía no hay contenido')
  })

  it('hides previous identity data immediately and makes no unauthorized request', async () => {
    getState.mockResolvedValue({ cycle: 1, draft: { revision: 1, basePublishedRevision: null, document }, published: null })
    render()
    await settle()
    expect(wrapper.text()).toContain('Título editorial')
    auth.permissionCodes = ['manage:all']
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('Título editorial')
    await wrapper.get('button').trigger('click')
    await settle()
    expect(getState).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('No tienes acceso')
  })

  it('does not render unsafe errors or retry failed reads', async () => {
    getState.mockRejectedValue(new Error('<script>private backend details</script>'))
    render()
    await settle()
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudo consultar')
    expect(wrapper.text()).not.toContain('private backend details')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(getState).toHaveBeenCalledTimes(1)
  })

  it('keeps an unreadable published document distinct from an absent one', async () => {
    getState.mockResolvedValue({ cycle: 1, draft: null,
      published: { revision: 2, document: null } })
    render()
    await settle()
    expect(wrapper.text()).toContain('No se puede interpretar este documento')
    expect(wrapper.text()).toContain('Revisión 2')
    expect(wrapper.text()).not.toContain('Sin versión publicada')
  })

  it('does not read while context or permission hydration is incomplete', async () => {
    auth.permissionsLoaded = false
    render()
    await settle()
    expect(getState).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('Título editorial')
  })
})
