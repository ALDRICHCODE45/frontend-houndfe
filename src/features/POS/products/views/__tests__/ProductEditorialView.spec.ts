import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import ProductEditorialView from '../ProductEditorialView.vue'
import EditorialWorkspace from '../../components/editorial/EditorialWorkspace.vue'
import { stubEditorialSelect } from '../../components/editorial/__tests__/editorialSelectStub'
import { document, state, success, vocabularyEnvelope, read, update, publish, failure, deferred } from '../../__tests__/editorial-contract-fixtures'
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({ isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u' }, currentTenant: { id: 't' }, permissionsLoaded: true, permissionCodes: [read, update] })
const route = reactive({ params: { id: 'p1' } })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
const routerPush = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ push: routerPush }) }))
const productGetById = vi.hoisted(() => vi.fn())
vi.mock('../../api/product.api', () => ({ productApi: { getById: productGetById } }))
let wrapper: ReturnType<typeof mount>
function reads(snapshot = state()) {
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope() }
    : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success(snapshot)))
}
const render = async () => { wrapper = mount(ProductEditorialView); await flushPromises() }
beforeAll(stubEditorialSelect)
beforeEach(() => { vi.resetAllMocks(); productGetById.mockResolvedValue({ name: 'Collar ajustable' }); Object.assign(auth, { isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u' }, currentTenant: { id: 't' }, permissionsLoaded: true, permissionCodes: [read, update] }); route.params.id = 'p1'; reads() })
afterEach(() => { wrapper?.unmount(); window.document.body.innerHTML = '' })

const tick = () => new Promise(resolve => setTimeout(resolve, 60))
const menuItems = () => Array.from(window.document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
const colorVocabulary = () => {
  const vocab = vocabularyEnvelope().vocabulary
  vocab.families = [{ id: 'f', code: 'f', label: 'Familia', bindings: [{ definitionId: 'c', definitionCode: 'color', owner: 'product', sortOrder: 0, exposure: 'DETAIL', searchable: false, publicationCheck: 'always', policy: { route: 'pending' } }] }]
  vocab.definitions = [{ id: 'c', code: 'color', label: 'Color', type: 'single', options: [{ code: 'old', label: 'Anterior', archived: true, sortOrder: 0 }], groups: [], aliases: [] }]
  return vocab
}

describe('integrated target workspace', () => {
  it.each([false, true])('keeps production publication unavailable (embedded=%s) with the history and the discard in reach', async embedded => {
    auth.permissionCodes = ['manage:all']
    wrapper = mount(EditorialWorkspace, { attachTo: window.document.body, props: { productId: 'p1', embedded } })
    await flushPromises()
    expect(wrapper.text()).toContain('Publicación próximamente')
    expect(wrapper.text()).not.toContain('Puedes publicar')
    expect(wrapper.findAll('button').some(item => item.text().startsWith('Publicar'))).toBe(false)
    expect(wrapper.find('[data-testid="open-history"]').exists()).toBe(true)
    await wrapper.get('[data-testid="editorial-footer"] button[aria-haspopup="menu"]').trigger('click'); await tick()
    expect(menuItems().map(item => (item.textContent ?? '').trim())).toContain('Descartar borrador…')
    expect(http.get).toHaveBeenCalledTimes(3)
    expect(http.post).not.toHaveBeenCalled()
  })
  it('does not promise publication to a read-and-publish user without update access', async () => {
    auth.permissionCodes = [read, publish]
    await render()
    expect(wrapper.text()).not.toContain('Puedes publicar')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.find('[data-testid="editorial-footer"]').exists()).toBe(false)
    expect(wrapper.findAll('button').some(item => item.text().includes('Publicar'))).toBe(false)
    expect(http.post).not.toHaveBeenCalled()
  })
  it('uses the real controlled document form, sends exact raw text, and only says Guardado afterwards', async () => {
    http.put.mockResolvedValue(success(state({ ...document(), commercialTitle: 'RECEIPT ONLY' }, 99)))
    await render()
    await wrapper.get('#editorial-title').setValue('  😀 exact  ')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(http.put.mock.calls[0]![1]).toEqual({ expectedCycle: 2, expectedRevision: 3, document: { ...document(), commercialTitle: '  😀 exact  ' } })
    expect(wrapper.text()).not.toMatch(/Acuse histórico|Revisión consultada/)
    expect(wrapper.text()).not.toContain('RECEIPT ONLY')
    expect(wrapper.find('.editorial-save-state').exists()).toBe(true)
    expect(wrapper.findAll('img')).toHaveLength(0)
  })
  it.each(['empty', 'Published'])('initializes %s explicitly, then loads only from a new coherent GET', async source => {
    const published = source === 'Published' ? { revision: 1, document: document() } : null
    reads({ cycle: source === 'empty' ? null : 2, draft: null, published })
    http.post.mockResolvedValue(success(state({ ...document(), commercialTitle: 'ACK ONLY' }, 99), 201))
    await render(); expect(http.post).not.toHaveBeenCalled()
    expect(wrapper.find('form').exists()).toBe(false)
    reads(state({ ...document(), commercialTitle: 'FROM GET' }, 1))
    await wrapper.get('[data-testid="initialize"]').trigger('click'); await flushPromises()
    expect(http.post).toHaveBeenCalledTimes(1)
    expect((wrapper.get('#editorial-title').element as HTMLInputElement).value).toBe('FROM GET')
    expect(wrapper.text()).not.toContain('ACK ONLY')
    expect(http.get).toHaveBeenCalledTimes(6)
  })
  it('a failed read after initializing is the read error with Reintentar, never a hidden draft', async () => {
    reads({ cycle: null, draft: null, published: null })
    http.post.mockResolvedValue(success(state(document(), 1), 201))
    await render()
    http.get.mockRejectedValue(failure(500, 'INTERNAL_ERROR'))
    await wrapper.get('[data-testid="initialize"]').trigger('click'); await flushPromises()
    expect(wrapper.get('.hf-empty-state[data-kind="error"]').get('[data-testid="empty-state-action"]').text()).toContain('Reintentar')
    reads(state({ ...document(), commercialTitle: 'FROM GET' }, 1))
    await wrapper.get('[data-testid="empty-state-action"]').trigger('click'); await flushPromises()
    expect((wrapper.get('#editorial-title').element as HTMLInputElement).value).toBe('FROM GET')
  })
  it('retain and confirmed discard are separate and cancellation preserves actual DOM/raw edits', async () => {
    http.put.mockRejectedValue(failure(409, 'CONFLICT'))
    await render(); await wrapper.get('#editorial-title').setValue('LOCAL')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    await wrapper.get('[data-testid="refresh-discard"]').trigger('click')
    await wrapper.get('[data-testid="cancel-discard"]').trigger('click')
    expect(http.get).toHaveBeenCalledTimes(3)
    reads(state({ ...document(), commercialTitle: 'REMOTE' }))
    await wrapper.get('[data-testid="refresh-retain"]').trigger('click'); await flushPromises()
    expect((wrapper.get('#editorial-title').element as HTMLInputElement).value).toBe('LOCAL')
    http.put.mockRejectedValue(failure(409, 'CONFLICT'))
    await wrapper.get('form').trigger('submit'); await flushPromises()
    await wrapper.get('[data-testid="refresh-discard"]').trigger('click')
    await wrapper.get('[data-testid="confirm-discard"]').trigger('click'); await flushPromises()
    expect((wrapper.get('#editorial-title').element as HTMLInputElement).value).toBe('REMOTE')
  })
  it('keeps oversized title intact, reports the fresh failure next to it and sends no save', async () => {
    reads(state({ ...document(), commercialTitle: '😀'.repeat(201) }))
    await render(); expect((wrapper.get('#editorial-title').element as HTMLInputElement).value).toBe('😀'.repeat(201))
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.get('#editorial-title-issue').text()).toContain('máximo es 200 caracteres')
    expect(wrapper.text()).not.toContain('TITLE_LIMIT')
    expect(http.put).not.toHaveBeenCalled()
  })
  it('read-only shows all stored content as text, preserving oversized history/private refs without fetching bytes', async () => {
    auth.permissionCodes = [read]
    reads(state({ ...document(), commercialTitle: 'x'.repeat(201), description: 'y'.repeat(20001), mediaRefs: ['private-ref'] }))
    await render()
    expect(wrapper.text()).toContain('x'.repeat(201)); expect(wrapper.text()).toContain('y'.repeat(20001)); expect(wrapper.text()).toContain('private-ref')
    expect(wrapper.findAll('input,textarea,form,img')).toHaveLength(0)
    expect(wrapper.text()).toContain('Solo consulta')
    expect(http.get).toHaveBeenCalledTimes(3)
  })
  it('rejects old/unreadable envelope atomically instead of displaying private payload or falling back', async () => {
    http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope() }
      : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : { ...success(), data: { ...success().data, state: { ...state(), draft: { revision: 1, basePublishedRevision: null, document: { secret: 'DO NOT DISPLAY' } } } } }))
    await render()
    expect(wrapper.text()).toContain('No se pudo cargar el contenido editorial')
    expect(wrapper.get('.hf-empty-state[data-kind="error"]').attributes('role')).toBe('alert')
    expect(wrapper.get('[data-testid="empty-state-action"]').text()).toContain('Reintentar')
    expect(wrapper.text()).not.toContain('DO NOT DISPLAY')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(http.get).toHaveBeenCalledTimes(3)
  })
  it('does not render unsafe failures, retry automatically, or retain identity-private UI on revocation', async () => {
    await render(); expect((wrapper.get('#editorial-title').element as HTMLInputElement).value).toBe(' exact ')
    auth.permissionCodes = []; await flushPromises()
    expect(wrapper.find('#editorial-title').exists()).toBe(false)
    expect(wrapper.text()).not.toContain(' exact ')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(http.get).toHaveBeenCalledTimes(3)
    auth.permissionCodes = [read]
    http.get.mockRejectedValue(new Error('<script>PRIVATE</script>')); await flushPromises()
    expect(wrapper.text()).not.toContain('PRIVATE')
    expect(wrapper.find('script').exists()).toBe(false)
  })
  it('shows loading, handles safe 403 and aborts disposed pending reads', async () => {
    const waiting = deferred<unknown>(); http.get.mockReturnValueOnce(waiting.promise)
    wrapper = mount(ProductEditorialView)
    expect(wrapper.text()).toContain('Cargando contenido editorial')
    expect(wrapper.get('[data-testid="editorial-skeleton"]').attributes('aria-busy')).toBe('true')
    waiting.reject(failure(403, 'FORBIDDEN')); await flushPromises()
    expect(wrapper.text()).toContain('No tienes acceso')
    expect(http.get).toHaveBeenCalledTimes(1)
    reads(); await wrapper.get('[data-testid="refresh-retain"]').trigger('click'); await flushPromises()
    expect(wrapper.find('form').exists()).toBe(true)
    const next = deferred<unknown>(); http.get.mockReturnValueOnce(next.promise)
    wrapper.unmount()
    wrapper = mount(ProductEditorialView)
    await flushPromises()
    const signal = http.get.mock.calls[http.get.mock.calls.length - 1]![1].signal as AbortSignal
    wrapper.unmount(); expect(signal.aborted).toBe(true)
    next.resolve({ ...success(), data: vocabularyEnvelope() }); await flushPromises()
  })
  it('offers archived choices only from whole reference-qualified stored Draft, never from raw current selections', async () => {
    const vocab = colorVocabulary()
    const saved = { ...document(), familyCode: 'f', values: [{ code: 'color', owner: 'product' as const, variantId: null, state: 'known' as const, payload: { type: 'single' as const, value: 'old' }, evidence: null }] }
    const withDraft = (draft: typeof saved) => http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope(vocab) }
      : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success(state(draft))))
    withDraft(saved)
    await render()
    const option = () => wrapper.get('tbody select option[value="old"]')
    expect(option().attributes('disabled')).toBeUndefined()
    // Clear the datum and write it again: the stored draft still conserves the archived option for this target.
    await wrapper.get('tbody button[aria-haspopup="menu"]').trigger('click'); await tick()
    menuItems().find(item => item.textContent?.trim() === 'Quitar dato')!.click(); await tick()
    expect(option().attributes('disabled')).toBeUndefined()
    // A new coherent GET whose saved draft no longer holds the option stops offering it.
    http.put.mockRejectedValue(failure(409, 'CONFLICT'))
    await wrapper.get('form').trigger('submit'); await flushPromises()
    withDraft({ ...saved, values: [] })
    await wrapper.get('[data-testid="refresh-retain"]').trigger('click'); await flushPromises()
    expect(option().attributes('disabled')).toBeDefined()
  })
  it('does not fetch while permissions hydrate', async () => {
    auth.permissionsLoaded = false; await render()
    expect(http.get).not.toHaveBeenCalled()
  })
})
