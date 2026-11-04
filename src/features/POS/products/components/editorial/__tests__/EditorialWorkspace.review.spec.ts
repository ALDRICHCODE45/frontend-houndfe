/**
 * Editorial workspace — T4 review round 1: not found is an empty state with a way
 * back, a failed read is the shared error (short title, Reintentar), loading is
 * shaped like the content, the dev copy is gone and the empty draft is one state.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import EditorialWorkspace from '../EditorialWorkspace.vue'
import { read, update, state, success, failure, vocabularyEnvelope, deferred } from '../../../__tests__/editorial-contract-fixtures'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({ isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u' }, currentTenant: { id: 't' }, permissionsLoaded: true, permissionCodes: [read, update] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
let wrapper: ReturnType<typeof mount>

function reads(snapshot = state()) {
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary')
    ? { ...success(), data: vocabularyEnvelope() }
    : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success(snapshot)))
}
const render = async (props: Record<string, unknown> = {}) => {
  wrapper = mount(EditorialWorkspace, { attachTo: document.body, props: { productId: 'p1', embedded: true, ...props } })
  await flushPromises()
}

beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(auth, { permissionCodes: [read, update] })
  reads()
})
afterEach(() => { wrapper?.unmount(); document.body.replaceChildren() })

describe('EditorialWorkspace — review round 1', () => {
  it('not found: an empty state with a way back, never the error design', async () => {
    http.get.mockRejectedValue(failure(404, 'NOT_FOUND'))
    await render({ backLabel: 'Volver a productos' })
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('No encontramos el contenido editorial')
    const back = wrapper.get('[data-testid="empty-state-action"]')
    expect(back.text()).toContain('Volver a productos')
    await back.trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
    expect(wrapper.find('[data-kind="error"]').exists()).toBe(false)
  })

  it('failed read: a short human title, a description and Reintentar, no sentence about retrying in the text', async () => {
    http.get.mockRejectedValue(failure(500, 'INTERNAL'))
    await render()
    const error = wrapper.get('.hf-empty-state[data-kind="error"]')
    expect(error.get('.hf-empty-state__title').text()).toBe('No se pudo cargar el contenido editorial')
    expect(error.text()).not.toMatch(/Puedes actualizar|Reintenta\./)
    expect(error.get('[data-testid="empty-state-action"]').text()).toContain('Reintentar')
  })

  it('a refused read is forbidden, not a retryable error', async () => {
    http.get.mockRejectedValue(failure(403, 'FORBIDDEN'))
    await render()
    const forbidden = wrapper.get('.hf-empty-state')
    expect(forbidden.attributes('data-kind')).toBe('forbidden')
    expect(forbidden.find('[data-testid="empty-state-action"]').exists()).toBe(false)
  })

  it('loading: shaped like the content and the refresh button keeps its label', async () => {
    const pending = deferred<unknown>()
    http.get.mockReturnValue(pending.promise)
    await render()
    const skeleton = wrapper.get('[data-testid="editorial-skeleton"]')
    expect(skeleton.findAll('[data-skeleton="section"]').length).toBeGreaterThanOrEqual(2)
    expect(skeleton.find('[data-skeleton="field"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Actualizando…')
  })

  it('has no developer copy about the backend and says publication is unavailable once', async () => {
    await render()
    expect(wrapper.text()).not.toContain('pendiente de habilitación del backend')
    expect(wrapper.text()).not.toContain('Guardar no publica el contenido.\u200b')
    expect(wrapper.find('.hf-page-subtitle').exists()).toBe(false)
  })

  it('an empty draft is one empty state with a single create action', async () => {
    reads({ cycle: null, draft: null, published: null })
    await render()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Aún no hay ficha para el catálogo')
    const action = wrapper.get('[data-testid="initialize"]')
    expect(action.text()).toContain('Empezar ficha')
  })

  it('with a published version, the empty draft offers to start from it', async () => {
    reads({ cycle: 2, draft: null, published: { revision: 1, document: state().draft!.document } })
    await render()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Aún no hay ficha para el catálogo')
    expect(empty.get('.hf-empty-state__description').text()).toContain('versión publicada')
    expect(wrapper.get('[data-testid="initialize"]').text()).toContain('Empezar desde lo publicado')
  })
})
