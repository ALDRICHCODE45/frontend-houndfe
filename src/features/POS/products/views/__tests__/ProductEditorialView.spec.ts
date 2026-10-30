import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import ProductEditorialView from '../ProductEditorialView.vue'
import { document, state, success, vocabularyEnvelope, read, update, failure, deferred } from '../../__tests__/editorial-contract-fixtures'
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({ isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u' }, currentTenant: { id: 't' }, permissionsLoaded: true, permissionCodes: [read, update] })
const route = reactive({ params: { id: 'p1' } })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
vi.mock('vue-router', () => ({ useRoute: () => route }))
let wrapper: ReturnType<typeof mount>
function reads(snapshot = state()) {
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope() }
    : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success(snapshot)))
}
const render = async () => { wrapper = mount(ProductEditorialView); await flushPromises() }
beforeEach(() => { vi.resetAllMocks(); Object.assign(auth, { isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u' }, currentTenant: { id: 't' }, permissionsLoaded: true, permissionCodes: [read, update] }); route.params.id = 'p1'; reads() })
afterEach(() => wrapper?.unmount())

describe('integrated target workspace', () => {
  it('uses the real controlled document form, sends exact raw text, preserves receipt as historical', async () => {
    http.put.mockResolvedValue(success(state({ ...document(), commercialTitle: 'RECEIPT ONLY' }, 99)))
    await render()
    await wrapper.get('#editorial-title').setValue('  😀 exact  ')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(http.put.mock.calls[0]![1]).toEqual({ expectedCycle: 2, expectedRevision: 3, document: { ...document(), commercialTitle: '  😀 exact  ' } })
    expect(wrapper.text()).toContain('Acuse histórico')
    expect(wrapper.text()).not.toContain('RECEIPT ONLY')
    expect(wrapper.text()).toContain('Revisión consultada: 3')
    expect(wrapper.findAll('img')).toHaveLength(0)
  })
  it.each(['empty', 'Published'])('initializes %s explicitly, then loads only from a new coherent GET', async source => {
    const published = source === 'Published' ? { revision: 1, document: document() } : null
    reads({ cycle: source === 'empty' ? null : 2, draft: null, published })
    http.post.mockResolvedValue(success(state({ ...document(), commercialTitle: 'ACK ONLY' }, 99), 201))
    await render(); expect(http.post).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="initialize"]').trigger('click'); await flushPromises()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('ACK ONLY')
    reads(state({ ...document(), commercialTitle: 'FROM GET' }, 1))
    await wrapper.get('[data-testid="refresh-retain"]').trigger('click'); await flushPromises()
    expect((wrapper.get('#editorial-title').element as HTMLInputElement).value).toBe('FROM GET')
    expect(http.get).toHaveBeenCalledTimes(6)
  })
  it('retain and confirmed discard are separate and cancellation preserves actual DOM/raw edits', async () => {
    await render(); await wrapper.get('#editorial-title').setValue('LOCAL')
    await wrapper.get('[data-testid="refresh-discard"]').trigger('click')
    await wrapper.get('[data-testid="cancel-discard"]').trigger('click')
    expect(http.get).toHaveBeenCalledTimes(3)
    reads(state({ ...document(), commercialTitle: 'REMOTE' }))
    await wrapper.get('[data-testid="refresh-retain"]').trigger('click'); await flushPromises()
    expect((wrapper.get('#editorial-title').element as HTMLInputElement).value).toBe('LOCAL')
    await wrapper.get('[data-testid="refresh-discard"]').trigger('click')
    await wrapper.get('[data-testid="confirm-discard"]').trigger('click'); await flushPromises()
    expect((wrapper.get('#editorial-title').element as HTMLInputElement).value).toBe('REMOTE')
    expect(http.put).not.toHaveBeenCalled()
  })
  it('keeps oversized title intact, reports fresh failure and sends no save', async () => {
    reads(state({ ...document(), commercialTitle: '😀'.repeat(201) }))
    await render(); expect((wrapper.get('#editorial-title').element as HTMLInputElement).value).toBe('😀'.repeat(201))
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.text()).toContain('TITLE_LIMIT')
    expect(http.put).not.toHaveBeenCalled()
  })
  it('read-only shows all stored content without inputs, preserving oversized history/private refs without fetching bytes', async () => {
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
    expect(wrapper.text()).toContain('No se pudo consultar')
    expect(wrapper.text()).not.toContain('DO NOT DISPLAY')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(http.get).toHaveBeenCalledTimes(3)
  })
  it('does not render unsafe failures, retry automatically, or retain identity-private UI on revocation', async () => {
    await render(); expect(wrapper.text()).toContain(' exact ')
    auth.permissionCodes = []; await flushPromises()
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
    waiting.reject(failure(403, 'FORBIDDEN')); await flushPromises()
    expect(wrapper.text()).toContain('No tienes acceso')
    expect(http.get).toHaveBeenCalledTimes(1)
    reads(); await wrapper.get('[data-testid="refresh-retain"]').trigger('click'); await flushPromises()
    expect(wrapper.find('form').exists()).toBe(true)
    const next = deferred<unknown>(); http.get.mockReturnValueOnce(next.promise)
    await wrapper.get('[data-testid="refresh-retain"]').trigger('click')
    const signal = http.get.mock.calls[http.get.mock.calls.length - 1]![1].signal as AbortSignal
    wrapper.unmount(); expect(signal.aborted).toBe(true)
    next.resolve({ ...success(), data: vocabularyEnvelope() }); await flushPromises()
  })
  it('offers archived choices only from whole reference-qualified stored Draft, never from raw current selections', async () => {
    const vocab = vocabularyEnvelope().vocabulary
    vocab.families = [{ id: 'f', code: 'f', label: 'Familia', bindings: [{ definitionId: 'c', definitionCode: 'color', owner: 'product', sortOrder: 0, exposure: 'DETAIL', searchable: false, publicationCheck: 'always', policy: { route: 'pending' } }] }]
    vocab.definitions = [{ id: 'c', code: 'color', label: 'Color', type: 'single', options: [{ code: 'old', label: 'Anterior', archived: true, sortOrder: 0 }], groups: [], aliases: [] }]
    const saved = { ...document(), familyCode: 'f', values: [{ code: 'color', owner: 'product' as const, variantId: null, state: 'known' as const, payload: { type: 'single' as const, value: 'old' }, evidence: null }] }
    http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope(vocab) }
      : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success(state(saved))))
    await render()
    expect(wrapper.get('option[value="old"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('form select[id$="-state"]').setValue('unknown')
    await wrapper.get('form select[id$="-state"]').setValue('known')
    expect(wrapper.get('option[value="old"]').attributes('disabled')).toBeUndefined()
    http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope(vocab) }
      : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success(state({ ...saved, values: [] }))))
    await wrapper.get('[data-testid="refresh-retain"]').trigger('click'); await flushPromises()
    expect(wrapper.get('option[value="old"]').attributes('disabled')).toBeDefined()
  })
  it('does not fetch while permissions hydrate', async () => {
    auth.permissionsLoaded = false; await render()
    expect(http.get).not.toHaveBeenCalled()
  })
})
